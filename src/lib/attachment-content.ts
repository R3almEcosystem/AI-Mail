import "server-only";

import { Buffer } from "node:buffer";
import postgres from "postgres";
import { databaseConnectionString } from "@/lib/auth";
import { getAttachmentObject, attachmentStorageConfigured } from "@/lib/attachment-storage";

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

export async function loadAttachmentRecord(id: string): Promise<Record<string, unknown>> {
  const sql = database();
  const rows = await sql`
    SELECT ma.id::text, ma.blob_id::text, ma.account_id, ma.folder, ma.uid, ma.filename, ma.mime_type,
           ma.analysis_allowed, b.bytes, b.storage_backend, b.storage_bucket, b.storage_path,
           b.vault_state, b.scan_status, b.scan_reason, b.extraction_status, b.extracted_text
    FROM private.ai_mail_message_attachments ma
    JOIN private.ai_mail_attachment_blobs b ON b.id = ma.blob_id
    WHERE ma.id = ${id}::uuid
    LIMIT 1
  `;
  if (!rows[0]) throw new Error("ATTACHMENT_NOT_FOUND");
  return rows[0] as Record<string, unknown>;
}

export async function loadAttachmentBytes(id: string): Promise<{ bytes: Uint8Array; record: Record<string, unknown> }> {
  const sql = database();
  const record = await loadAttachmentRecord(id);
  let bytes: Uint8Array | null = null;

  if (record.storage_backend === "supabase_storage") {
    bytes = await getAttachmentObject(String(record.storage_bucket), String(record.storage_path));
  }
  if (!bytes) {
    const rows = await sql`
      SELECT content
      FROM private.ai_mail_attachment_blob_data
      WHERE blob_id = ${String(record.blob_id)}::uuid
      LIMIT 1
    `;
    const value = rows[0]?.content;
    if (value instanceof Uint8Array) bytes = new Uint8Array(value);
    else if (Buffer.isBuffer(value)) bytes = new Uint8Array(value);
  }
  if (!bytes?.byteLength) throw new Error("ATTACHMENT_CONTENT_UNAVAILABLE");
  return { bytes, record };
}

export async function saveAttachmentAnalysis(input: {
  attachmentId: string;
  actorId?: string | null;
  analysisType: string;
  provider: string;
  model?: string | null;
  markdown: string;
  usage?: unknown;
  estimatedCostUsd?: number | null;
  responseTimeMs: number;
}) {
  const sql = database();
  await sql`
    INSERT INTO private.ai_mail_attachment_analysis (
      message_attachment_id, actor_id, analysis_type, provider, model,
      result_markdown, usage, estimated_cost_usd, response_time_ms
    ) VALUES (
      ${input.attachmentId}::uuid, ${input.actorId || null}, ${input.analysisType.slice(0, 80)},
      ${input.provider.slice(0, 80)}, ${input.model || null}, ${input.markdown},
      ${JSON.stringify(input.usage || {})}::jsonb, ${input.estimatedCostUsd ?? null},
      ${Math.max(0, Math.round(input.responseTimeMs))}
    )
  `;
}

export async function attachmentVaultStatus() {
  const sql = database();
  const rows = await sql`
    SELECT count(*)::int AS count
    FROM storage.buckets
    WHERE id IN ('si-mail-attachments', 'si-mail-quarantine')
  `;
  return {
    bucketsReady: Number(rows[0]?.count || 0) === 2,
    storageApiConfigured: attachmentStorageConfigured(),
    databaseFallback: true,
  };
}
