import "server-only";

import postgres from "postgres";
import { databaseConnectionString } from "@/lib/auth";
import type { AiCallAuditEntry, AiCallAuditSummary, AiCallStatus } from "@/lib/types";

type SqlClient = ReturnType<typeof postgres>;

let client: SqlClient | null = null;

export type AiTelemetryContext = {
  actorId?: string | null;
  actorName?: string | null;
  accountId?: string | null;
};

export type AiTokenUsage = {
  inputTokens: number | null;
  cachedInputTokens: number | null;
  cacheWriteTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
};

type ModelRate = {
  input: number;
  cachedInput: number | null;
  cacheWrite: number | null;
  output: number;
  longContextAt?: number;
  longInputMultiplier?: number;
  longOutputMultiplier?: number;
};

const OPENAI_STANDARD_RATES: Array<{ matches: RegExp; rate: ModelRate }> = [
  { matches: /^gpt-6-astra(?:-|$)/i, rate: { input: 10, cachedInput: 1, cacheWrite: 12.5, output: 50, longContextAt: 272000, longInputMultiplier: 2, longOutputMultiplier: 1.5 } },
  { matches: /^gpt-6\.1-sol(?:-|$)/i, rate: { input: 2, cachedInput: 0.1, cacheWrite: 2.5, output: 10, longContextAt: 272000, longInputMultiplier: 2, longOutputMultiplier: 1.5 } },
  { matches: /^gpt-6-sol(?:-|$)/i, rate: { input: 2, cachedInput: 0.2, cacheWrite: 2.5, output: 10, longContextAt: 272000, longInputMultiplier: 2, longOutputMultiplier: 1.5 } },
  { matches: /^gpt-6-luna(?:-|$)/i, rate: { input: 0.1, cachedInput: 0.01, cacheWrite: 0.125, output: 0.5, longContextAt: 272000, longInputMultiplier: 2, longOutputMultiplier: 1.5 } },
  { matches: /^(?:gpt-5\.6-sol(?:-|$)|gpt-daybreak-blue-latest$)/i, rate: { input: 4, cachedInput: 0.4, cacheWrite: 5, output: 20, longContextAt: 272000, longInputMultiplier: 2, longOutputMultiplier: 1.5 } },
  { matches: /^(?:gpt-5\.6-cyber(?:-|$)|gpt-daybreak-red-latest$)/i, rate: { input: 12.5, cachedInput: 1.25, cacheWrite: 15.625, output: 75 } },
  { matches: /^gpt-5\.4-mini(?:-|$)/i, rate: { input: 0.75, cachedInput: 0.075, cacheWrite: null, output: 4.5, longContextAt: 272000, longInputMultiplier: 2, longOutputMultiplier: 1.5 } },
  { matches: /^gpt-5\.4-pro(?:-|$)/i, rate: { input: 30, cachedInput: null, cacheWrite: null, output: 180, longContextAt: 272000, longInputMultiplier: 2, longOutputMultiplier: 1.5 } },
  { matches: /^gpt-5\.4(?:-|$)/i, rate: { input: 2.5, cachedInput: 0.25, cacheWrite: null, output: 15, longContextAt: 272000, longInputMultiplier: 2, longOutputMultiplier: 1.5 } },
  { matches: /^gpt-5\.2-pro(?:-|$)/i, rate: { input: 21, cachedInput: null, cacheWrite: null, output: 168 } },
  { matches: /^(?:gpt-5\.2(?:-|$)|gpt-5\.2-chat-latest$)/i, rate: { input: 1.75, cachedInput: 0.175, cacheWrite: null, output: 14 } },
  { matches: /^(?:gpt-5\.1(?:-|$)|gpt-5\.1-chat-latest$)/i, rate: { input: 1.25, cachedInput: 0.125, cacheWrite: null, output: 10 } },
  { matches: /^gpt-5-pro(?:-|$)/i, rate: { input: 15, cachedInput: null, cacheWrite: null, output: 120 } },
  { matches: /^chat-latest$/i, rate: { input: 5, cachedInput: 0.5, cacheWrite: null, output: 30 } },
];

function database() {
  const url = databaseConnectionString();
  if (!url) return null;
  if (!client) {
    client = postgres(url, {
      max: 2,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
      ssl: process.env.DATABASE_SSL === "false" ? false : "require",
    });
  }
  return client;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function finiteNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) return Math.round(value);
  }
  return null;
}

export function normalizeAiUsage(value: unknown): AiTokenUsage {
  const usage = record(value);
  const inputDetails = record(usage.inputTokenDetails ?? usage.input_tokens_details ?? usage.inputDetails);
  const outputDetails = record(usage.outputTokenDetails ?? usage.output_tokens_details ?? usage.outputDetails);

  const inputTokens = finiteNumber(
    usage.inputTokens,
    usage.input_tokens,
    usage.promptTokens,
    usage.prompt_tokens,
  );
  const cachedInputTokens = finiteNumber(
    usage.cachedInputTokens,
    usage.cached_input_tokens,
    inputDetails.cachedTokens,
    inputDetails.cached_tokens,
    inputDetails.cacheReadTokens,
    inputDetails.cache_read_tokens,
  );
  const cacheWriteTokens = finiteNumber(
    usage.cacheWriteTokens,
    usage.cache_write_tokens,
    inputDetails.cacheWriteTokens,
    inputDetails.cache_write_tokens,
  );
  const outputTokens = finiteNumber(
    usage.outputTokens,
    usage.output_tokens,
    usage.completionTokens,
    usage.completion_tokens,
    outputDetails.totalTokens,
  );
  const suppliedTotal = finiteNumber(usage.totalTokens, usage.total_tokens);
  const totalTokens = suppliedTotal ?? (
    inputTokens !== null || outputTokens !== null
      ? (inputTokens || 0) + (outputTokens || 0)
      : null
  );

  return { inputTokens, cachedInputTokens, cacheWriteTokens, outputTokens, totalTokens };
}

function rateFor(model: string | null | undefined): ModelRate | null {
  if (!model) return null;
  return OPENAI_STANDARD_RATES.find((entry) => entry.matches.test(model))?.rate || null;
}

export function estimateOpenAiCost(model: string | null | undefined, usage: AiTokenUsage): number | null {
  const rate = rateFor(model);
  if (!rate || usage.inputTokens === null || usage.outputTokens === null) return null;

  const cached = Math.min(usage.cachedInputTokens || 0, usage.inputTokens);
  const cacheWrite = rate.cacheWrite === null
    ? 0
    : Math.min(usage.cacheWriteTokens || 0, Math.max(0, usage.inputTokens - cached));
  const uncached = Math.max(0, usage.inputTokens - cached - cacheWrite);
  const longContext = Boolean(rate.longContextAt && usage.inputTokens > rate.longContextAt);
  const inputMultiplier = longContext ? (rate.longInputMultiplier || 1) : 1;
  const outputMultiplier = longContext ? (rate.longOutputMultiplier || 1) : 1;

  const inputCost = uncached * rate.input * inputMultiplier;
  const cachedCost = cached * (rate.cachedInput ?? rate.input) * inputMultiplier;
  const cacheWriteCost = cacheWrite * (rate.cacheWrite ?? rate.input) * inputMultiplier;
  const outputCost = usage.outputTokens * rate.output * outputMultiplier;
  return Number(((inputCost + cachedCost + cacheWriteCost + outputCost) / 1_000_000).toFixed(8));
}

export function aiErrorCode(error: unknown): string {
  const value = record(error);
  const status = finiteNumber(value.status, value.statusCode);
  if (status !== null && status >= 100 && status <= 599) return "HTTP_" + status;
  if (error instanceof Error) {
    if (/timeout/i.test(error.name) || /timeout/i.test(error.message)) return "TIMEOUT";
    if (/abort/i.test(error.name)) return "ABORTED";
    if (error.name && error.name !== "Error") return error.name.slice(0, 80);
  }
  return "ERROR";
}

type RecordAiCallInput = AiTelemetryContext & {
  provider: string;
  operation: string;
  endpoint: string;
  model?: string | null;
  status: AiCallStatus;
  usage?: AiTokenUsage | null;
  responseTimeMs: number;
  providerRequestId?: string | null;
  errorCode?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
};

function cleanText(value: string | null | undefined, max: number): string | null {
  const text = value?.trim();
  return text ? text.slice(0, max) : null;
}

export async function recordAiCall(input: RecordAiCallInput): Promise<void> {
  const sql = database();
  if (!sql) return;

  const usage = input.usage || {
    inputTokens: null,
    cachedInputTokens: null,
    cacheWriteTokens: null,
    outputTokens: null,
    totalTokens: null,
  };
  const model = cleanText(input.model, 160);
  const estimatedCostUsd = input.provider.toLowerCase() === "openai"
    ? estimateOpenAiCost(model, usage)
    : null;

  try {
    await sql`
      INSERT INTO private.ai_mail_ai_calls (
        id, actor_id, actor_name, provider, operation, endpoint, model, account_id, status,
        input_tokens, cached_input_tokens, cache_write_tokens, output_tokens, total_tokens,
        estimated_cost_usd, response_time_ms, provider_request_id, error_code, metadata
      ) VALUES (
        ${crypto.randomUUID()}::uuid,
        ${cleanText(input.actorId, 160)},
        ${cleanText(input.actorName, 160)},
        ${cleanText(input.provider, 80) || "unknown"},
        ${cleanText(input.operation, 120) || "unknown"},
        ${cleanText(input.endpoint, 160) || "unknown"},
        ${model},
        ${cleanText(input.accountId, 160)},
        ${input.status},
        ${usage.inputTokens},
        ${usage.cachedInputTokens},
        ${usage.cacheWriteTokens},
        ${usage.outputTokens},
        ${usage.totalTokens},
        ${estimatedCostUsd},
        ${Math.max(0, Math.round(input.responseTimeMs))},
        ${cleanText(input.providerRequestId, 200)},
        ${cleanText(input.errorCode, 120)},
        ${JSON.stringify(input.metadata || {})}::jsonb
      )
    `;
  } catch (error) {
    console.error("[ai-telemetry] unable to persist AI call", {
      code: aiErrorCode(error),
      operation: input.operation,
      provider: input.provider,
    });
  }
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}

function mapCall(row: Record<string, unknown>): AiCallAuditEntry {
  const optionalNumber = (value: unknown) => value === null || value === undefined ? null : Number(value);
  return {
    id: String(row.id),
    provider: String(row.provider),
    operation: String(row.operation),
    endpoint: String(row.endpoint),
    model: row.model ? String(row.model) : null,
    actorName: row.actor_name ? String(row.actor_name) : null,
    accountId: row.account_id ? String(row.account_id) : null,
    status: row.status as AiCallStatus,
    inputTokens: optionalNumber(row.input_tokens),
    cachedInputTokens: optionalNumber(row.cached_input_tokens),
    cacheWriteTokens: optionalNumber(row.cache_write_tokens),
    outputTokens: optionalNumber(row.output_tokens),
    totalTokens: optionalNumber(row.total_tokens),
    estimatedCostUsd: optionalNumber(row.estimated_cost_usd),
    responseTimeMs: Number(row.response_time_ms || 0),
    providerRequestId: row.provider_request_id ? String(row.provider_request_id) : null,
    errorCode: row.error_code ? String(row.error_code) : null,
    createdAt: iso(row.created_at),
  };
}

export async function listAiCallAudit(limit = 250): Promise<{ calls: AiCallAuditEntry[]; summary: AiCallAuditSummary }> {
  const sql = database();
  if (!sql) {
    return {
      calls: [],
      summary: { calls: 0, successes: 0, failures: 0, tokenizedCalls: 0, pricedCalls: 0, totalTokens: 0, estimatedCostUsd: 0, averageResponseTimeMs: 0 },
    };
  }

  const boundedLimit = Math.min(Math.max(Math.round(limit), 1), 500);
  const [rows, summaryRows] = await Promise.all([
    sql`
      SELECT id, actor_name, provider, operation, endpoint, model, account_id, status,
             input_tokens, cached_input_tokens, cache_write_tokens, output_tokens, total_tokens,
             estimated_cost_usd, response_time_ms, provider_request_id, error_code, created_at
      FROM private.ai_mail_ai_calls
      ORDER BY created_at DESC, id DESC
      LIMIT ${boundedLimit}
    `,
    sql`
      SELECT
        COUNT(*)::bigint AS calls,
        COUNT(*) FILTER (WHERE status = 'succeeded')::bigint AS successes,
        COUNT(*) FILTER (WHERE status = 'failed')::bigint AS failures,
        COUNT(total_tokens)::bigint AS tokenized_calls,
        COUNT(estimated_cost_usd)::bigint AS priced_calls,
        COALESCE(SUM(total_tokens), 0)::bigint AS total_tokens,
        COALESCE(SUM(estimated_cost_usd), 0)::numeric AS estimated_cost_usd,
        COALESCE(AVG(response_time_ms), 0)::numeric AS average_response_time_ms
      FROM private.ai_mail_ai_calls
    `,
  ]);

  const summary = summaryRows[0] || {};
  return {
    calls: rows.map((row) => mapCall(row)),
    summary: {
      calls: Number(summary.calls || 0),
      successes: Number(summary.successes || 0),
      failures: Number(summary.failures || 0),
      tokenizedCalls: Number(summary.tokenized_calls || 0),
      pricedCalls: Number(summary.priced_calls || 0),
      totalTokens: Number(summary.total_tokens || 0),
      estimatedCostUsd: Number(summary.estimated_cost_usd || 0),
      averageResponseTimeMs: Math.round(Number(summary.average_response_time_ms || 0)),
    },
  };
}
