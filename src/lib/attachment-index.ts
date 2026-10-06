import "server-only";

import postgres from "postgres";
import { databaseConnectionString } from "@/lib/auth";

type SqlClient = ReturnType<typeof postgres>;
let client: SqlClient | null = null;
const MAX_TEXT = 500_000;
const CHUNK = 4_000;
const OVERLAP = 400;

function database() {
  const url = databaseConnectionString();
  if (!url) throw new Error("AUTH_UNAVAILABLE");
  if (!client) client = postgres(url, { max: 2, idle_timeout: 20, connect_timeout: 10, prepare: false, ssl: process.env.DATABASE_SSL === "false" ? false : "require" });
  return client;
}

function localText(mimeType: string, bytes: Uint8Array) {
  const supported = mimeType.startsWith("text/") || mimeType === "application/json" || mimeType === "application/xml";
  if (!supported) return { status: "unsupported" as const, text: null };
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/\u0000/g, "").trim();
    return { status: "complete" as const, text: text.slice(0, MAX_TEXT) };
  } catch {
    return { status: "failed" as const, text: null };
  }
}

function splitText(text: string) {
  const out: string[] = [];
  for (let offset = 0; offset < text.length && out.length < 500;) {
    const end = Math.min(text.length, offset + CHUNK);
    out.push(text.slice(offset, end));
    if (end >= text.length) break;
    offset = Math.max(offset + 1, end - OVERLAP);
  }
  return out;
}

export async function indexAttachmentText(blobId: string, mimeType: string, bytes: Uint8Array) {
  const sql = database();
  const extracted = localText(mimeType, bytes);
  await sql`
    UPDATE private.ai_mail_attachment_blobs
    SET extraction_status = ${extracted.status}, extracted_text = ${extracted.text}, updated_at = now()
    WHERE id = ${blobId}::uuid
  `;
  await sql`DELETE FROM private.ai_mail_attachment_chunks WHERE blob_id = ${blobId}::uuid`;
  if (extracted.status !== "complete" || !extracted.text) return extracted.status;
  const parts = splitText(extracted.text);
  for (let index = 0; index < parts.length; index++) {
    await sql`
      INSERT INTO private.ai_mail_attachment_chunks (blob_id, chunk_index, content)
      VALUES (${blobId}::uuid, ${index}, ${parts[index]})
      ON CONFLICT (blob_id, chunk_index) DO UPDATE SET content = excluded.content
    `;
  }
  return extracted.status;
}
