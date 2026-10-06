import "server-only";

import { Buffer } from "node:buffer";

const DEFAULT_URL = "https://cvrihauikkflnvunmvma.supabase.co";

function config() {
  const url = (process.env.AI_MAIL_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_URL).replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return { url, key, configured: Boolean(url && key) };
}

function pathValue(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

export function attachmentStorageConfigured() {
  return config().configured;
}

export async function putAttachmentObject(bucket: string, path: string, bytes: Uint8Array, mimeType: string) {
  const current = config();
  if (!current.configured) return false;
  const response = await fetch(current.url + "/storage/v1/object/" + encodeURIComponent(bucket) + "/" + pathValue(path), {
    method: "POST",
    headers: {
      apikey: current.key,
      Authorization: "Bearer " + current.key,
      "Content-Type": mimeType,
      "x-upsert": "false",
    },
    body: Buffer.from(bytes),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (!response) return false;
  if (response.ok || response.status === 409) return true;
  console.warn("[attachment-storage] upload unavailable", { bucket, status: response.status });
  return false;
}

export async function getAttachmentObject(bucket: string, path: string) {
  const current = config();
  if (!current.configured) return null;
  const response = await fetch(current.url + "/storage/v1/object/authenticated/" + encodeURIComponent(bucket) + "/" + pathValue(path), {
    headers: {
      apikey: current.key,
      Authorization: "Bearer " + current.key,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (!response?.ok) return null;
  const bytes = new Uint8Array(await response.arrayBuffer());
  return bytes.byteLength ? bytes : null;
}
