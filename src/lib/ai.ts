import "server-only";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { getSettings } from "@/lib/admin-data";
import { getServiceSecret } from "@/lib/service-secrets";
import {
  aiErrorCode,
  normalizeAiUsage,
  recordAiCall,
  type AiTelemetryContext,
} from "@/lib/ai-telemetry";
import { prepareAiDisclosure, validateAiOutput, type AiTask, type AiMailInput } from "../security/ai-disclosure";

const toneGuidance = {
  concise: "Be concise, executive-oriented, and direct. Prefer short paragraphs and only essential detail.",
  balanced: "Be clear and complete while staying efficient. Include enough context to support decisions.",
  detailed: "Provide a thorough, structured response with relevant context, implications, and next actions.",
} as const;

type OpenAiResponsePayload = {
  status?: string;
  model?: string;
  usage?: unknown;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  error?: { message?: string } | null;
};

type OpenAiModelsPayload = {
  data?: Array<{ id?: string; created?: number; owned_by?: string }>;
  error?: { message?: string } | null;
};

export async function aiConfiguration() {
  const settings = await getSettings();
  const apiKey = await getServiceSecret("ai_mail_openai_api_key") || process.env.OPENAI_API_KEY || "";
  const model = settings.aiModel || process.env.OPENAI_MODEL || null;
  return {
    configured: Boolean(apiKey && model),
    apiKey,
    model,
    tone: settings.aiTone,
    autoSummarize: settings.aiAutoSummarize,
    priorityDetection: settings.aiPriorityDetection,
  };
}

async function openAiError(response: Response, fallback: string): Promise<Error> {
  const payload = await response.json().catch(() => null) as OpenAiResponsePayload | OpenAiModelsPayload | null;
  const providerMessage = payload?.error?.message?.trim();
  const detail = providerMessage && providerMessage.length <= 500 ? providerMessage : fallback;
  return new Error(`OpenAI verification failed (${response.status}): ${detail}`);
}

function sdkRequestId(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const response = (result as { response?: { id?: unknown } }).response;
  return typeof response?.id === "string" ? response.id : null;
}

export async function listOpenAiModels(context: AiTelemetryContext = {}): Promise<string[]> {
  const configuration = await aiConfiguration();
  if (!configuration.apiKey) throw new Error("OpenAI API key is not configured.");

  const startedAt = Date.now();
  let response: Response | null = null;
  let logged = false;
  try {
    response = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${configuration.apiKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      await recordAiCall({
        ...context,
        provider: "openai",
        operation: "models.list",
        endpoint: "/v1/models",
        model: configuration.model,
        status: "failed",
        responseTimeMs: Date.now() - startedAt,
        providerRequestId: response.headers.get("x-request-id"),
        errorCode: "HTTP_" + response.status,
      });
      logged = true;
      throw await openAiError(response, "Unable to list models for this API key.");
    }

    const payload = await response.json() as OpenAiModelsPayload;
    await recordAiCall({
      ...context,
      provider: "openai",
      operation: "models.list",
      endpoint: "/v1/models",
      model: configuration.model,
      status: "succeeded",
      responseTimeMs: Date.now() - startedAt,
      providerRequestId: response.headers.get("x-request-id"),
    });
    logged = true;

    const excluded = /(audio|realtime|image|embedding|moderation|tts|transcri|whisper|search|computer-use|codex|live|rosalind|daybreak|sora)/i;
    const models = (payload.data || [])
      .filter((item) => typeof item.id === "string")
      .filter((item) => {
        const id = item.id as string;
        const textFamily = id.startsWith("gpt-") || /^o\d(?:-|$)/.test(id) || id === "chat-latest" || id.startsWith("chatgpt");
        return textFamily && !excluded.test(id);
      })
      .sort((a, b) => Number(b.created || 0) - Number(a.created || 0) || String(a.id).localeCompare(String(b.id)))
      .map((item) => item.id as string);

    if (configuration.model && !models.includes(configuration.model)) models.unshift(configuration.model);
    return [...new Set(models)];
  } catch (error) {
    if (!logged) {
      await recordAiCall({
        ...context,
        provider: "openai",
        operation: "models.list",
        endpoint: "/v1/models",
        model: configuration.model,
        status: "failed",
        responseTimeMs: Date.now() - startedAt,
        providerRequestId: response?.headers.get("x-request-id") || null,
        errorCode: aiErrorCode(error),
      });
    }
    throw error;
  }
}

export async function analyzeMail(
  action: AiTask,
  message: AiMailInput,
  extraInstructions?: string,
  context: AiTelemetryContext = {},
) {
  const prepared = prepareAiDisclosure(action, message, extraInstructions);
  const configuration = await aiConfiguration();
  if (!configuration.configured || !configuration.model || !configuration.apiKey) throw new Error("OpenAI is not configured.");

  const provider = createOpenAI({ apiKey: configuration.apiKey });
  const startedAt = Date.now();
  let logged = false;
  try {
    const result = await generateText({
      model: provider(configuration.model),
      system: `${prepared.system}\n\nResponse style: ${toneGuidance[configuration.tone]}`,
      prompt: prepared.prompt,
      maxOutputTokens: 1000,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(20_000),
    });
    const usage = normalizeAiUsage(result.usage);
    await recordAiCall({
      ...context,
      provider: "openai",
      operation: "mail." + action,
      endpoint: "ai-sdk/generateText",
      model: configuration.model,
      status: "succeeded",
      usage,
      responseTimeMs: Date.now() - startedAt,
      providerRequestId: sdkRequestId(result),
      metadata: { maxOutputTokens: 1000 },
    });
    logged = true;
    return { text: validateAiOutput(result.text), usage: result.usage, truncated: prepared.truncated };
  } catch (error) {
    if (!logged) {
      await recordAiCall({
        ...context,
        provider: "openai",
        operation: "mail." + action,
        endpoint: "ai-sdk/generateText",
        model: configuration.model,
        status: "failed",
        responseTimeMs: Date.now() - startedAt,
        errorCode: aiErrorCode(error),
        metadata: { maxOutputTokens: 1000 },
      });
    }
    throw error;
  }
}

export async function testAiConnection(context: AiTelemetryContext = {}) {
  const configuration = await aiConfiguration();
  if (!configuration.configured || !configuration.model || !configuration.apiKey) throw new Error("OpenAI is not configured.");

  const startedAt = Date.now();
  let response: Response | null = null;
  let logged = false;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${configuration.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: configuration.model,
        input: "Reply with exactly: OK",
        max_output_tokens: 16,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      await recordAiCall({
        ...context,
        provider: "openai",
        operation: "connection.test",
        endpoint: "/v1/responses",
        model: configuration.model,
        status: "failed",
        responseTimeMs: Date.now() - startedAt,
        providerRequestId: response.headers.get("x-request-id"),
        errorCode: "HTTP_" + response.status,
        metadata: { maxOutputTokens: 16 },
      });
      logged = true;
      throw await openAiError(response, "The configured model or API key was rejected.");
    }

    const payload = await response.json() as OpenAiResponsePayload;
    const text = (payload.output || [])
      .flatMap((item) => item.content || [])
      .find((item) => item.type === "output_text")
      ?.text?.trim();

    if (payload.status !== "completed" || !text) {
      await recordAiCall({
        ...context,
        provider: "openai",
        operation: "connection.test",
        endpoint: "/v1/responses",
        model: payload.model || configuration.model,
        status: "failed",
        usage: normalizeAiUsage(payload.usage),
        responseTimeMs: Date.now() - startedAt,
        providerRequestId: response.headers.get("x-request-id"),
        errorCode: "PROVIDER_INCOMPLETE",
        metadata: { maxOutputTokens: 16 },
      });
      logged = true;
      throw new Error("OpenAI verification failed: the provider did not return a completed text response.");
    }

    await recordAiCall({
      ...context,
      provider: "openai",
      operation: "connection.test",
      endpoint: "/v1/responses",
      model: payload.model || configuration.model,
      status: "succeeded",
      usage: normalizeAiUsage(payload.usage),
      responseTimeMs: Date.now() - startedAt,
      providerRequestId: response.headers.get("x-request-id"),
      metadata: { maxOutputTokens: 16 },
    });
    logged = true;

    return {
      ok: true,
      model: configuration.model,
      providerModel: payload.model || configuration.model,
      response: text,
    };
  } catch (error) {
    if (!logged) {
      await recordAiCall({
        ...context,
        provider: "openai",
        operation: "connection.test",
        endpoint: "/v1/responses",
        model: configuration.model,
        status: "failed",
        responseTimeMs: Date.now() - startedAt,
        providerRequestId: response?.headers.get("x-request-id") || null,
        errorCode: aiErrorCode(error),
        metadata: { maxOutputTokens: 16 },
      });
    }
    throw error;
  }
}
