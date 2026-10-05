import "server-only";

import postgres from "postgres";
import { databaseConnectionString } from "@/lib/auth";
import type { MailResearchMode, MailResearchScope } from "@/lib/mail-research";
import type { SessionUser } from "@/lib/types";

type SqlClient = ReturnType<typeof postgres>;

let client: SqlClient | null = null;

function database() {
  const url = databaseConnectionString();
  if (!url) throw new Error("AUTH_UNAVAILABLE");
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

export type ResearchHistorySummary = {
  id: string;
  query: string;
  requestedScope: MailResearchScope;
  scope: MailResearchScope;
  title: string;
  mode: MailResearchMode;
  matched: number;
  included: number;
  excluded: number;
  capped: boolean;
  model: string | null;
  warnings: string[];
  createdAt: string;
};

export type ResearchHistoryDetail = ResearchHistorySummary & {
  markdown: string;
};

type ResearchResult = {
  title: string;
  markdown: string;
  scope: MailResearchScope;
  mode: MailResearchMode;
  matched: number;
  included: number;
  excluded: number;
  capped: boolean;
  model: string | null;
  warnings: string[];
};

function iso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}

function mapSummary(row: Record<string, unknown>): ResearchHistorySummary {
  return {
    id: String(row.id),
    query: String(row.query),
    requestedScope: row.requested_scope as MailResearchScope,
    scope: row.result_scope as MailResearchScope,
    title: String(row.title),
    mode: row.mode as MailResearchMode,
    matched: Number(row.matched || 0),
    included: Number(row.included || 0),
    excluded: Number(row.excluded || 0),
    capped: Boolean(row.capped),
    model: row.model ? String(row.model) : null,
    warnings: Array.isArray(row.warnings) ? row.warnings.map(String) : [],
    createdAt: iso(row.created_at),
  };
}

export async function saveResearchHistory(
  user: SessionUser,
  query: string,
  requestedScope: MailResearchScope,
  result: ResearchResult,
) {
  if (user.demo) return null;
  const sql = database();
  const id = crypto.randomUUID();
  const rows = await sql`
    INSERT INTO private.ai_mail_research_history (
      id, user_id, query, requested_scope, result_scope, title, markdown, mode,
      matched, included, excluded, capped, model, warnings
    ) VALUES (
      ${id}::uuid, ${user.id}, ${query.trim()}, ${requestedScope}, ${result.scope},
      ${result.title}, ${result.markdown}, ${result.mode}, ${result.matched},
      ${result.included}, ${result.excluded}, ${result.capped}, ${result.model},
      ${JSON.stringify(result.warnings)}::jsonb
    )
    RETURNING created_at
  `;
  return { id, createdAt: iso(rows[0]?.created_at) };
}

export async function listResearchHistory(user: SessionUser, offset: number, limit: number) {
  if (user.demo) return { items: [] as ResearchHistorySummary[], hasMore: false, nextOffset: null as number | null };
  const sql = database();
  const boundedLimit = Math.min(Math.max(limit, 1), 100);
  const boundedOffset = Math.max(offset, 0);
  const rows = await sql`
    SELECT id, query, requested_scope, result_scope, title, mode, matched, included,
           excluded, capped, model, warnings, created_at
    FROM private.ai_mail_research_history
    WHERE user_id = ${user.id}
    ORDER BY created_at DESC, id DESC
    LIMIT ${boundedLimit + 1}
    OFFSET ${boundedOffset}
  `;
  const hasMore = rows.length > boundedLimit;
  const items = rows.slice(0, boundedLimit).map((row) => mapSummary(row));
  return {
    items,
    hasMore,
    nextOffset: hasMore ? boundedOffset + items.length : null,
  };
}

export async function getResearchHistory(user: SessionUser, id: string): Promise<ResearchHistoryDetail | null> {
  if (user.demo) return null;
  const sql = database();
  const rows = await sql`
    SELECT id, query, requested_scope, result_scope, title, markdown, mode, matched,
           included, excluded, capped, model, warnings, created_at
    FROM private.ai_mail_research_history
    WHERE user_id = ${user.id} AND id = ${id}::uuid
    LIMIT 1
  `;
  if (!rows[0]) return null;
  return { ...mapSummary(rows[0]), markdown: String(rows[0].markdown) };
}
