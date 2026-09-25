import type { SessionUser, UserRole } from "@/lib/types";

const encoder = new TextEncoder();
const SESSION_NAME = "r3alm_ai_mail_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 12;
export type SessionClaims = SessionUser & { version: 2; sessionId: string; exp: number };

export function databaseConnectionString(): string | undefined {
  return process.env.AI_MAIL_DATABASE_URL || process.env.POSTGRES_URL
    || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
}

export function demoLoginEnabled(): boolean {
  const remoteProduction = process.env.VERCEL_ENV === "production"
    || (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview");
  const liveSecretNames = ["MAIL_PASSWORD", "IMAP_PASSWORD", "SMTP_PASSWORD", "OPENAI_API_KEY",
    "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY", "MCP_API_TOKEN", "ADMIN_INITIAL_PASSWORD", "APP_ACCESS_PASSWORD"];
  return !remoteProduction && process.env.ENABLE_DEMO_LOGIN === "true"
    && process.env.AI_MAIL_DEMO_MODE === "isolated" && Boolean(sessionSecret())
    && !databaseConnectionString() && !liveSecretNames.some((key) => Boolean(process.env[key]));
}

function sessionSecret(): string | null {
  const secret = process.env.AUTH_SECRET;
  // Preview URLs are public identifiers, never signing keys. Fail closed everywhere.
  return secret && encoder.encode(secret).length >= 32 ? secret : null;
}
function toBase64Url(value: Uint8Array | string): string {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""))
    .replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
function fromBase64Url(value: string): string {
  const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "="));
  return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, c => c.charCodeAt(0)));
}
async function sign(payload: string): Promise<string | null> {
  const secret = sessionSecret();
  if (!secret) return null;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload))));
}
export function newSessionId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, "0")).join("");
}
export async function createSessionToken(user: SessionUser, durationSeconds = SESSION_DURATION_SECONDS, sessionId = newSessionId()): Promise<string | null> {
  if (!Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > 604800 || !/^[a-f0-9]{64}$/.test(sessionId)) return null;
  const payload = toBase64Url(JSON.stringify({ ...user, version: 2, sessionId, exp: Math.floor(Date.now() / 1000) + durationSeconds }));
  const signature = await sign(payload);
  return signature ? `${payload}.${signature}` : null;
}
export async function verifySessionToken(token?: string): Promise<SessionClaims | null> {
  if (!token || token.length > 4096 || !sessionSecret()) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts.every(part => /^[A-Za-z0-9_-]+$/.test(part))) return null;
  const [payload, supplied] = parts;
  const expected = await sign(payload);
  if (!expected || supplied.length !== expected.length) return null;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
  if (mismatch !== 0) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(payload)) as Partial<SessionClaims>;
    const roles: UserRole[] = ["super_admin", "admin", "manager", "member", "viewer"];
    if (parsed.version !== 2 || typeof parsed.sessionId !== "string" || !/^[a-f0-9]{64}$/.test(parsed.sessionId)
      || !Number.isSafeInteger(parsed.exp) || parsed.exp! <= Date.now() / 1000
      || typeof parsed.id !== "string" || !parsed.id || typeof parsed.name !== "string"
      || typeof parsed.email !== "string" || !roles.includes(parsed.role as UserRole) || typeof parsed.demo !== "boolean") return null;
    if (parsed.demo && !demoLoginEnabled()) return null;
    return parsed as SessionClaims;
  } catch { return null; }
}
export function authenticationConfigured(): boolean {
  return Boolean(sessionSecret() && databaseConnectionString());
}
export function isAdminRole(role: UserRole): boolean { return role === "admin" || role === "super_admin"; }
export { SESSION_DURATION_SECONDS, SESSION_NAME };
