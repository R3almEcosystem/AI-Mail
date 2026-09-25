import type { UserRole } from "@/lib/types";

export type Capability = "mail:read" | "mail:write" | "ai:use" | "admin:manage";
export function can(role: UserRole, capability: Capability): boolean {
  const roles: UserRole[] = ["super_admin", "admin", "manager", "member", "viewer"];
  if (!roles.includes(role)) return false;
  if (capability === "mail:read") return true;
  if (capability === "admin:manage") return role === "admin" || role === "super_admin";
  if (capability === "mail:write" || capability === "ai:use") return role !== "viewer";
  return false;
}

/** Only same-origin relative return paths; WHATWG normalization catches backslashes. */
export function safeReturnPath(value: string | null, fallback = "/inbox"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020\u007f]/u.test(value)) return fallback;
  try {
    const base = "https://ai-mail.r3alm.com";
    const target = new URL(value, base);
    if (target.origin !== base || target.pathname.startsWith("/api/") || target.pathname.startsWith("/oauth/")) return fallback;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch { return fallback; }
}

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  if (!origin) return true; // Non-browser clients still require a valid session/capability.
  try { return origin === new URL(request.url).origin; } catch { return false; }
}
