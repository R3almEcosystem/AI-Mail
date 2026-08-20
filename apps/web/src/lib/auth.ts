import type { SessionUser, UserRole } from "@/lib/types";

const encoder = new TextEncoder();
const SESSION_NAME = "r3alm_ai_mail_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 12;

function toBase64Url(value: Uint8Array | string) {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function fromBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return atob(padded);
}

export function demoLoginEnabled() {
  if (process.env.ENABLE_DEMO_LOGIN === "true") return true;
  return process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV === "preview";
}

function sessionSecret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  const ephemeralPreview = process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV === "preview";
  if (!ephemeralPreview) return null;
  return `r3alm-ai-mail-preview:${process.env.VERCEL_URL || "local"}`;
}

async function sign(payload: string) {
  const secret = sessionSecret();
  if (!secret) return null;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return toBase64Url(new Uint8Array(signature));
}

export async function createSessionToken(
  user: SessionUser,
  durationSeconds = SESSION_DURATION_SECONDS,
) {
  const payload = toBase64Url(
    JSON.stringify({ ...user, exp: Math.floor(Date.now() / 1000) + durationSeconds }),
  );
  const signature = await sign(payload);
  return signature ? `${payload}.${signature}` : null;
}

export async function verifySessionToken(token?: string) {
  if (!token || !sessionSecret()) return null;

  const [payload, suppliedSignature] = token.split(".");
  if (!payload || !suppliedSignature) return null;

  const expectedSignature = await sign(payload);
  if (!expectedSignature || suppliedSignature.length !== expectedSignature.length) {
    return null;
  }

  let mismatch = 0;
  for (let index = 0; index < expectedSignature.length; index += 1) {
    mismatch |= expectedSignature.charCodeAt(index) ^ suppliedSignature.charCodeAt(index);
  }
  if (mismatch !== 0) return null;

  try {
    const parsed = JSON.parse(fromBase64Url(payload)) as Partial<SessionUser> & { exp?: number };
    const roles: UserRole[] = ["super_admin", "admin", "manager", "member", "viewer"];
    if (
      typeof parsed.exp !== "number" ||
      parsed.exp <= Date.now() / 1000 ||
      typeof parsed.id !== "string" ||
      typeof parsed.name !== "string" ||
      typeof parsed.email !== "string" ||
      !roles.includes(parsed.role as UserRole) ||
      typeof parsed.demo !== "boolean"
    ) {
      return null;
    }
    return {
      id: parsed.id,
      name: parsed.name,
      email: parsed.email,
      role: parsed.role as UserRole,
      demo: parsed.demo,
    };
  } catch {
    return null;
  }
}

export function authenticationConfigured() {
  return Boolean(process.env.AUTH_SECRET && (process.env.DATABASE_URL || process.env.APP_ACCESS_PASSWORD));
}

export function isAdminRole(role: UserRole) {
  return role === "admin" || role === "super_admin";
}

export { SESSION_DURATION_SECONDS, SESSION_NAME };
