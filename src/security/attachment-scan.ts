import { createHash } from 'node:crypto';

/** Server-side file inspection only. A scan result is NOT a quarantine release token. */
export type ScanStatus = 'clean' | 'blocked' | 'error';
export type ScanReason = 'policy_disabled' | 'scanner_unavailable' | 'invalid_configuration' | 'invalid_file'
  | 'inspection_limit' | 'scan_timeout' | 'provider_error' | 'content_changed' | 'threat_or_unsupported_content';
export type FileInspection = { sha256: string; bytes: number; status: ScanStatus; reason?: ScanReason };
export type AttachmentInspection = {
  required: boolean; status: ScanStatus | 'not_scanned' | 'no_attachments';
  provider: string | null; files: FileInspection[]; reason?: ScanReason;
};
export interface AttachmentScanner {
  readonly id: string;
  scan(bytes: Uint8Array, signal: AbortSignal): Promise<{ status: ScanStatus }>;
}
export interface AttachmentPolicy {
  mode: 'disabled' | 'required'; scanner?: AttachmentScanner; configurationError?: boolean; timeoutMs?: number;
}
export const ATTACHMENT_LIMITS = Object.freeze({ maxBytes: 1_048_576, maxTotalBytes: 4_194_304, maxFiles: 4, timeoutMs: 25_000 });
export const SCAN_FLAGS = [
  'ContainsExecutable', 'ContainsInvalidFile', 'ContainsScript', 'ContainsPasswordProtectedFile',
  'ContainsMacros', 'ContainsUnsafeArchive', 'ContainsXmlExternalEntities', 'ContainsInsecureDeserialization',
  'ContainsHtml', 'ContainsOleEmbeddedObject', 'ContainsUnwantedAction', 'ContainsRestrictedFileFormat',
] as const;
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
function copyBytes(value: unknown): Uint8Array | null {
  if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
  if (ArrayBuffer.isView(value) && value.buffer instanceof ArrayBuffer) {
    return new Uint8Array(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
  }
  return null;
}
/** Abort races also bound providers/streams that do not cooperate with AbortSignal. */
async function abortable<T>(operation: () => Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw new Error('aborted');
  let cancel!: () => void;
  const stopped = new Promise<never>((_, reject) => {
    cancel = () => reject(new Error('aborted'));
    signal.addEventListener('abort', cancel, { once: true });
  });
  try { return await Promise.race([operation(), stopped]); }
  finally { signal.removeEventListener('abort', cancel); }
}
export async function inspectAttachments(inputs: readonly unknown[], policy: AttachmentPolicy): Promise<AttachmentInspection> {
  const required = policy.mode !== 'disabled';
  const base = { required, provider: required ? policy.scanner?.id ?? null : null, files: [] as FileInspection[] };
  if (!Array.isArray(inputs)) return { ...base, status:'blocked', reason:'invalid_file' };
  if (!inputs.length) return { ...base, status:'no_attachments' };
  if (!required) return { ...base, status:'not_scanned', reason:'policy_disabled' };
  if (policy.configurationError || policy.mode !== 'required') return { ...base, status:'error', reason:'invalid_configuration' };
  if (!policy.scanner) return { ...base, status:'error', reason:'scanner_unavailable' };
  const timeoutMs = policy.timeoutMs ?? ATTACHMENT_LIMITS.timeoutMs;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > ATTACHMENT_LIMITS.timeoutMs) return { ...base, status:'error', reason:'invalid_configuration' };
  if (inputs.length > ATTACHMENT_LIMITS.maxFiles) return { ...base, status:'blocked', reason:'inspection_limit' };
  // Snapshot every file before the first await. Never permit caller mutation during an earlier scan.
  const snapshots: Uint8Array[] = []; let total = 0;
  for (const input of inputs) {
    const size = input instanceof ArrayBuffer || ArrayBuffer.isView(input) ? input.byteLength : -1;
    if (size < 1) return { ...base, status:'blocked', reason:'invalid_file' };
    if (size > ATTACHMENT_LIMITS.maxBytes || (total += size) > ATTACHMENT_LIMITS.maxTotalBytes) return { ...base, status:'blocked', reason:'inspection_limit' };
    const bytes = copyBytes(input);
    if (!bytes) return { ...base, status:'blocked', reason:'invalid_file' };
    snapshots.push(bytes);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const files: FileInspection[] = [];
  try {
    for (const bytes of snapshots) {
      const sha256 = digest(bytes); const entry = { sha256, bytes: bytes.byteLength };
      try {
        const verdict: unknown = await abortable(() => policy.scanner!.scan(bytes, controller.signal), controller.signal);
        if (digest(bytes) !== sha256) files.push({ ...entry, status:'error', reason:'content_changed' });
        else if (!isRecord(verdict) || typeof verdict.status !== 'string' || !['clean','blocked','error'].includes(verdict.status)) files.push({ ...entry, status:'error', reason:'provider_error' });
        else if (verdict.status === 'clean') files.push({ ...entry, status:'clean' });
        else files.push({ ...entry, status: verdict.status as ScanStatus, reason: verdict.status === 'blocked' ? 'threat_or_unsupported_content' : 'provider_error' });
      } catch {
        files.push({ ...entry, status:'error', reason: controller.signal.aborted ? 'scan_timeout' : 'provider_error' });
      }
    }
  } finally { clearTimeout(timer); controller.abort(); }
  const status = files.some(file => file.status === 'blocked') ? 'blocked' : files.some(file => file.status === 'error') ? 'error' : 'clean';
  return { ...base, files, status };
}

async function boundedProviderJson(response: Response, signal: AbortSignal): Promise<unknown> {
  if (!response.ok || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '') || !response.body) throw new Error('provider response');
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      const { value, done } = await abortable(() => reader.read(), signal);
      if (done) break;
      if ((total += value.byteLength) > 65_536) throw new Error('provider response limit');
      chunks.push(value);
    }
    const bytes = new Uint8Array(total); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder('utf-8', { fatal:true }).decode(bytes));
  } finally { void reader.cancel().catch(() => {}); reader.releaseLock(); }
}
/** API key stays server-side. No caller-defined provider URL, redirects, filenames or HTTP diagnostics. */
export function createCloudmersiveScanner(apiKey: string, request: typeof fetch = (...args) => fetch(...args)): AttachmentScanner {
  return {
    id:'cloudmersive-advanced',
    async scan(bytes, signal) {
      if (!apiKey || apiKey.length > 512 || /[\s\u0000-\u001f\u007f]/.test(apiKey)) return {status:'error'};
      try {
        const form = new FormData();
        // Copy to ArrayBuffer-backed memory for Blob, independent of caller ownership.
        form.set('inputFile', new Blob([new Uint8Array(bytes)], {type:'application/octet-stream'}), 'attachment.bin');
        const response = await abortable(() => request('https://api.cloudmersive.com/virus/scan/file/advanced', {
          method:'POST', redirect:'error', signal, body:form,
          headers:{
            Apikey:apiKey, Accept:'application/json',
            allowExecutables:'false', allowInvalidFiles:'false', allowScripts:'false', allowPasswordProtectedFiles:'false',
            allowMacros:'false', allowUnsafeArchives:'false', allowXmlExternalEntities:'false', allowInsecureDeserialization:'false',
            allowHtml:'false', allowOleEmbeddedObject:'false', allowUnwantedAction:'false',
          },
        }), signal);
        const result = await boundedProviderJson(response, signal);
        if (!isRecord(result) || typeof result.CleanResult !== 'boolean') return {status:'error'};
        if (result.CleanResult === false || SCAN_FLAGS.some(flag => result[flag] === true) || (Array.isArray(result.FoundViruses) && result.FoundViruses.length > 0)) return {status:'blocked'};
        if (SCAN_FLAGS.some(flag => result[flag] !== false) || typeof result.VerifiedFileFormat !== 'string' || !result.VerifiedFileFormat.trim()
          || !(result.FoundViruses === null || (Array.isArray(result.FoundViruses) && result.FoundViruses.length === 0))) return {status:'error'};
        return {status:'clean'};
      } catch { return {status:'error'}; }
    },
  };
}
export function attachmentPolicyFromEnv(env: Record<string, string | undefined> = process.env): AttachmentPolicy {
  const mode = env.EMAIL_ATTACHMENT_SCANNING;
  if (mode === undefined || mode === '' || mode === 'disabled') return {mode:'disabled'};
  if (mode !== 'required') return {mode:'required', configurationError:true};
  const key = env.CLOUDMERSIVE_API_KEY;
  if (!key || key.length > 512 || /[\s\u0000-\u001f\u007f]/.test(key)) return {mode:'required'};
  return {mode:'required', scanner:createCloudmersiveScanner(key)};
}
export function attachmentCapabilities(env: Record<string, string | undefined> = process.env) {
  const policy = attachmentPolicyFromEnv(env);
  return { required:policy.mode === 'required', configured:Boolean(policy.scanner), configurationValid:!policy.configurationError,
    provider:policy.scanner?.id ?? null, health:'not_probed' as const, limits:ATTACHMENT_LIMITS,
    scope:'on_demand_attachment_inspection' as const, durableQuarantine:false, automaticRelease:false };
}
