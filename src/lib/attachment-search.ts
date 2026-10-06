import "server-only";

import postgres from "postgres";
import { databaseConnectionString } from "@/lib/auth";

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

export type AttachmentKnowledgeHit = {
  attachmentId: string;
  accountId: string;
  folder: "INBOX" | "INBOX.Sent";
  uid: number;
  filename: string;
  mimeType: string;
  extractionStatus: string;
  content: string;
};

export async function searchAttachmentKnowledge(query: string, accountId = "all", limit = 30): Promise<AttachmentKnowledgeHit[]> {
  const sql = database();
  const q = query.trim().slice(0, 500);
  if (!q) return [];
  const pattern = "%" + q.replace(/[%_\\]/g, "\\$&") + "%";
  const rows = await sql`
    SELECT ma.id::text as attachment_id, ma.account_id, ma.folder, ma.uid, ma.filename, ma.mime_type,
           b.extraction_status,
           coalesce(
             nullif(left(b.extracted_text, 5000), ''),
             nullif(left(latest.result_markdown, 5000), ''),
             ''
           ) as content
    FROM private.ai_mail_message_attachments ma
    JOIN private.ai_mail_attachment_blobs b ON b.id = ma.blob_id
    LEFT JOIN LATERAL (
      SELECT result_markdown
      FROM private.ai_mail_attachment_analysis a
      WHERE a.message_attachment_id = ma.id
      ORDER BY a.created_at DESC
      LIMIT 1
    ) latest ON true
    WHERE (${accountId} = 'all' OR ma.account_id = ${accountId})
      AND ma.analysis_allowed = true
      AND (
        ma.filename ILIKE ${pattern} ESCAPE '\'
        OR b.extracted_text ILIKE ${pattern} ESCAPE '\'
        OR latest.result_markdown ILIKE ${pattern} ESCAPE '\'
        OR EXISTS (
          SELECT 1
          FROM private.ai_mail_attachment_chunks c
          WHERE c.blob_id = b.id
            AND c.content_tsv @@ websearch_to_tsquery('english', ${q})
        )
      )
    ORDER BY ma.updated_at DESC
    LIMIT ${Math.max(1, Math.min(limit, 100))}
  `;
  return rows.map(row => ({
    attachmentId: String(row.attachment_id),
    accountId: String(row.account_id),
    folder: String(row.folder) as "INBOX" | "INBOX.Sent",
    uid: Number(row.uid),
    filename: String(row.filename),
    mimeType: String(row.mime_type),
    extractionStatus: String(row.extraction_status),
    content: String(row.content || ""),
  }));
}


export async function listAttachmentKnowledgeForUids(
  accountId: string,
  folder: "INBOX" | "INBOX.Sent",
  uids: number[],
  limit = 100,
): Promise<AttachmentKnowledgeHit[]> {
  const selected = [...new Set(uids.filter(uid => Number.isSafeInteger(uid) && uid > 0 && uid <= 4294967295))].slice(0, 250);
  if (!selected.length) return [];
  const sql = database();
  const rows = await sql`
    SELECT ma.id::text as attachment_id, ma.account_id, ma.folder, ma.uid, ma.filename, ma.mime_type,
           b.extraction_status,
           coalesce(
             nullif(left(b.extracted_text, 12000), ''),
             nullif(left(latest.result_markdown, 12000), ''),
             ''
           ) as content
    FROM private.ai_mail_message_attachments ma
    JOIN private.ai_mail_attachment_blobs b ON b.id = ma.blob_id
    LEFT JOIN LATERAL (
      SELECT result_markdown
      FROM private.ai_mail_attachment_analysis a
      WHERE a.message_attachment_id = ma.id
      ORDER BY a.created_at DESC
      LIMIT 1
    ) latest ON true
    WHERE ma.account_id = ${accountId}
      AND ma.folder = ${folder}
      AND ma.uid = ANY(${selected}::bigint[])
      AND ma.analysis_allowed = true
    ORDER BY ma.message_date DESC NULLS LAST, ma.updated_at DESC
    LIMIT ${Math.max(1, Math.min(limit, 250))}
  `;
  return rows.map(row => ({
    attachmentId: String(row.attachment_id),
    accountId: String(row.account_id),
    folder: String(row.folder) as "INBOX" | "INBOX.Sent",
    uid: Number(row.uid),
    filename: String(row.filename),
    mimeType: String(row.mime_type),
    extractionStatus: String(row.extraction_status),
    content: String(row.content || ""),
  }));
}
