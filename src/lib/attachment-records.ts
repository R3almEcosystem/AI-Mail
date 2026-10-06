import "server-only";

import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import postgres from "postgres";
import { databaseConnectionString } from "@/lib/auth";
import { indexAttachmentText } from "@/lib/attachment-index";
import { putAttachmentObject } from "@/lib/attachment-storage";
import type { AttachmentInspection, FileInspection } from "../security/attachment-scan";

type SqlClient = ReturnType<typeof postgres>;
let client: SqlClient | null = null;

const CLEAN_BUCKET = "si-mail-attachments";
const QUARANTINE_BUCKET = "si-mail-quarantine";
const MAX_STORED_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export type AttachmentSource = {
  filename?: string;
  mimeType?: string;
  disposition?: string;
  related?: boolean;
  contentId?: string;
  content: Uint8Array | ArrayBuffer;
};

export type PersistedMailAttachment = {
  id: string;
  filename: string;
  mimeType: string;
  bytes: number;
  vaultState: "available" | "quarantine";
  scanStatus: "clean" | "blocked" | "error" | "not_scanned";
  scanReason: string | null;
  analysisAllowed: boolean;
  extractionStatus: "pending" | "complete" | "unsupported" | "failed";
};

function database() {
  const url = databaseConnectionString();
  if (!url) throw new Error("AUTH_UNAVAILABLE");
  if (!client) {
    client = postgres(url, {
      max: 3,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
      ssl: process.env.DATABASE_SSL === "false" ? false : "require",
    });
  }
  return client;
}

function bytesOf(value: Uint8Array | ArrayBuffer): Uint8Array {
  if (value instanceof Uint8Array) return new Uint8Array(value);
  return new Uint8Array(value.slice(0));
}

function digest(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

function safeMime(value?: string): string {
  const mime = (value || "application/octet-stream").trim().toLowerCase();
  return /^[a-z0-9!#$&^_.+-]+\/[a-z0-9a#$&^_.+-]+$/i.test(mime)
    ? mime.slice(0, 160)
    : "application/octet-stream";
}

function safeFilename(value: string | undefined, index: number): string {
  const cleaned = (value || `attachment-${index + 1}`)
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 240);
  return cleaned || `attachment-${index + 1}`;
}

function objectPath(sha: string) {
  return `sha256/${sha.slice(0, 2)}/${sha}`;
}

function scanEvidence(
  inspection: AttachmentInspection,
  index: number,
): {
  status: PersistedMailAttachment["scanStatus"];
  reason: string | null;
  provider: string | null;
  evidence: FileInspection | null;
} {
  const evidence = inspection.files[index] || null;
  if (evidence) {
    return {
      status: evidence.status,
      reason: evidence.reason || null,
      provider: inspection.provider,
      evidence,
    };
  }
  if (inspection.status === "clean") return { status: "clean", reason: null, provider: inspection.provider, evidence: null };
  if (inspection.status === "blocked") return { status: "blocked", reason: inspection.reason || null, provider: inspection.provider, evidence: null };
  if (inspection.status === "error") return { status: "error", reason: inspection.reason || null, provider: inspection.provider, evidence: null };
  return { status: "not_scanned", reason: inspection.reason || null, provider: inspection.provider, evidence: null };
}

async function storeFallback(sql: SqlClient, blobId: string, bytes: Uint8Array) {
  await sql`
    INSERT INTO private.ai_mail_attachment_blob_data (blob_id, content)
    VALUES (${blobId}::uuid, ${Buffer.from(bytes)})
    ON CONFLICT (blob_id) DO UPDATE SET content = excluded.content
  `;
}

async function ensureBlob(
  sql: SqlClient,
  bytes: Uint8Array,
  mimeType: string,
  scan: ReturnType<typeof scanEvidence>,
) {
  if (!bytes.byteLength || bytes.byteLength > MAX_STORED_ATTACHMENT_BYTES) {
    throw new Error("ATTACHMENT_STORAGE_LIMIT");
  }

  const sha = scan.evidence?.sha256 || digest(bytes);
  const desiredState = scan.status === "clean" ? "available" as const : "quarantine" as const;
  const desiredBucket = desiredState === "available" ? CLEAN_BUCKET : QUARANTINE_BUCKET;
  const path = objectPath(sha);

  const existing = await sql`
    SELECT id::text, storage_backend, storage_bucket, storage_path, vault_state, extraction_status
    FROM private.ai_mail_attachment_blobs
    WHERE sha256 = ${sha}
    LIMIT 1
  `;
  if (existing[0]) {
    const id = String(existing[0].id);
    let backend = String(existing[0].storage_backend) as "supabase_storage" | "postgres_bytea";
    let bucket = String(existing[0].storage_bucket);
    let storedPath = String(existing[0].storage_path);
    let vaultState = String(existing[0].vault_state) as "available" | "quarantine";

    if (desiredState === "available" && vaultState !== "available") {
      const uploaded = await putAttachmentObject(CLEAN_BUCKET, path, bytes, mimeType);
      if (uploaded) {
        backend = "supabase_storage";
        bucket = CLEAN_BUCKET;
        storedPath = path;
        await sql`DELETE FROM private.ai_mail_attachment_blob_data WHERE blob_id = ${id}::uuid`;
      } else {
        backend = "postgres_bytea";
        bucket = CLEAN_BUCKET;
        storedPath = path;
        await storeFallback(sql, id, bytes);
      }
      vaultState = "available";
    } else if (backend === "postgres_bytea") {
      await storeFallback(sql, id, bytes);
    }

    await sql`
      UPDATE private.ai_mail_attachment_blobs
      SET vault_state = ${vaultState},
          scan_status = ${scan.status},
          scan_provider = ${scan.provider},
          scan_reason = ${scan.reason},
          scanned_at = CASE WHEN ${scan.status} = 'not_scanned' THEN scanned_at ELSE now() END,
          storage_backend = ${backend},
          storage_bucket = ${bucket},
          storage_path = ${storedPath},
          updated_at = now()
      WHERE id = ${id}::uuid
    `;
    if (scan.status === "clean" && String(existing[0].extraction_status) !== "complete") {
      await indexAttachmentText(id, mimeType, bytes);
    }
    const status = await sql`
      SELECT extraction_status
      FROM private.ai_mail_attachment_blobs
      WHERE id = ${id}::uuid
    `;
    return {
      id,
      vaultState,
      extractionStatus: String(status[0]?.extraction_status || "pending") as PersistedMailAttachment["extractionStatus"],
    };
  }

  const uploaded = await putAttachmentObject(desiredBucket, path, bytes, mimeType);
  const backend = uploaded ? "supabase_storage" as const : "postgres_bytea" as const;
  const inserted = await sql`
    INSERT INTO private.ai_mail_attachment_blobs (
      sha256, bytes, mime_type, storage_backend, storage_bucket, storage_path, vault_state,
      scan_status, scan_provider, scan_reason, scanned_at
    ) VALUES (
      ${sha}, ${bytes.byteLength}, ${mimeType}, ${backend}, ${desiredBucket}, ${path}, ${desiredState},
      ${scan.status}, ${scan.provider}, ${scan.reason},
      CASE WHEN ${scan.status} = 'not_scanned' THEN NULL ELSE now() END
    )
    RETURNING id::text
  `;
  const id = String(inserted[0].id);
  if (!uploaded) await storeFallback(sql, id, bytes);

  if (scan.status === "clean") await indexAttachmentText(id, mimeType, bytes);
  const status = await sql`
    SELECT extraction_status
    FROM private.ai_mail_attachment_blobs
    WHERE id = ${id}::uuid
  `;
  return {
    id,
    vaultState: desiredState,
    extractionStatus: String(status[0]?.extraction_status || "pending") as PersistedMailAttachment["extractionStatus"],
  };
}

export async function persistMessageAttachments(input: {
  accountId: string;
  folder: "INBOX" | "INBOX.Sent";
  uid: number;
  uidValidity?: string | null;
  messageId?: string | null;
  sources: AttachmentSource[];
  inspection: AttachmentInspection;
}): Promise<PersistedMailAttachment[]> {
  if (!input.sources.length) return [];
  const sql = database();
  const output: PersistedMailAttachment[] = [];

  for (let index = 0; index < input.sources.length; index++) {
    const source = input.sources[index];
    const bytes = bytesOf(source.content);
    const mimeType = safeMime(source.mimeType);
    const filename = safeFilename(source.filename, index);
    const scan = scanEvidence(input.inspection, index);

    try {
      const blob = await ensureBlob(sql, bytes, mimeType, scan);
      const existing = await sql`
        SELECT id::text
        FROM private.ai_mail_message_attachments
        WHERE account_id = ${input.accountId}
          AND folder = ${input.folder}
          AND coalesce(uid_validity, '') = ${input.uidValidity || ""}
          AND uid = ${input.uid}
          AND attachment_index = ${index}
        LIMIT 1
      `;
      let id: string;
      const analysisAllowed = scan.status === "clean" && blob.vaultState === "available";
      if (existing[0]) {
        id = String(existing[0].id);
        await sql`
          UPDATE private.ai_mail_message_attachments
          SET blob_id = ${blob.id}::uuid,
              message_id = ${input.messageId || null},
              filename = ${filename},
              mime_type = ${mimeType},
              disposition = ${source.disposition || null},
              content_id = ${source.contentId || null},
              analysis_allowed = ${analysisAllowed},
              updated_at = now()
          WHERE id = ${id}::uuid
        `;
      } else {
        const inserted = await sql`
          INSERT INTO private.ai_mail_message_attachments (
            blob_id, account_id, folder, uid, uid_validity, message_id, attachment_index,
            filename, mime_type, disposition, content_id, analysis_allowed
          ) VALUES (
            ${blob.id}::uuid, ${input.accountId}, ${input.folder}, ${input.uid},
            ${input.uidValidity || null}, ${input.messageId || null}, ${index},
            ${filename}, ${mimeType}, ${source.disposition || null}, ${source.contentId || null},
            ${analysisAllowed}
          )
          RETURNING id::text
        `;
        id = String(inserted[0].id);
      }

      output.push({
        id,
        filename,
        mimeType,
        bytes: bytes.byteLength,
        vaultState: blob.vaultState,
        scanStatus: scan.status,
        scanReason: scan.reason,
        analysisAllowed,
        extractionStatus: blob.extractionStatus,
      });
    } catch (error) {
      console.error("[attachment-vault] unable to persist attachment", {
        accountId: input.accountId,
        folder: input.folder,
        uid: input.uid,
        index,
        code: error instanceof Error ? error.message.slice(0, 100) : "ERROR",
      });
    }
  }

  return output;
}

export async function listMessageAttachments(
  accountId: string,
  folder: "INBOX" | "INBOX.Sent",
  uid: number,
): Promise<PersistedMailAttachment[]> {
  const sql = database();
  const rows = await sql`
    SELECT ma.id::text, ma.filename, ma.mime_type, b.bytes, b.vault_state, b.scan_status,
           b.scan_reason, ma.analysis_allowed, b.extraction_status
    FROM private.ai_mail_message_attachments ma
    JOIN private.ai_mail_attachment_blobs b ON b.id = ma.blob_id
    WHERE ma.account_id = ${accountId} AND ma.folder = ${folder} AND ma.uid = ${uid}
    ORDER BY ma.attachment_index ASC
  `;
  return rows.map(row => ({
    id: String(row.id),
    filename: String(row.filename),
    mimeType: String(row.mime_type),
    bytes: Number(row.bytes),
    vaultState: row.vault_state as PersistedMailAttachment["vaultState"],
    scanStatus: row.scan_status as PersistedMailAttachment["scanStatus"],
    scanReason: row.scan_reason ? String(row.scan_reason) : null,
    analysisAllowed: Boolean(row.analysis_allowed),
    extractionStatus: row.extraction_status as PersistedMailAttachment["extractionStatus"],
  }));
}
