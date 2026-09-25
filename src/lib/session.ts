import "server-only";
import { cookies } from "next/headers";
import { SESSION_NAME, verifySessionToken, demoLoginEnabled } from "@/lib/auth";
import { findActiveSession } from "@/lib/session-store";
import { can, isSameOriginRequest, type Capability } from "@/lib/auth-policy";
import type { SessionUser } from "@/lib/types";

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const claims = await verifySessionToken(store.get(SESSION_NAME)?.value);
  if (!claims) return null;
  if (claims.demo) {
    if (!demoLoginEnabled()) return null;
    return { id: claims.id, name: claims.name, email: claims.email, role: claims.role, demo: true };
  }
  try { return await findActiveSession(claims); }
  catch { throw new Error("AUTH_UNAVAILABLE"); } // Never fall back to cookie authority during an outage.
}
export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}
export async function requireCapability(capability: Capability, request?: Request): Promise<SessionUser> {
  if (request && !["GET", "HEAD", "OPTIONS"].includes(request.method) && !isSameOriginRequest(request)) throw new Error("FORBIDDEN");
  const user = await requireSessionUser();
  if (!can(user.role, capability)) throw new Error("FORBIDDEN");
  return user;
}
export async function requireAdminUser(): Promise<SessionUser> { return requireCapability("admin:manage"); }
