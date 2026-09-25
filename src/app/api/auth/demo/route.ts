import { NextResponse } from "next/server";
import { createSessionToken, demoLoginEnabled, SESSION_DURATION_SECONDS, SESSION_NAME } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/auth-policy";
import type { SessionUser } from "@/lib/types";
export const dynamic = "force-dynamic";
export function GET() { return NextResponse.json({ enabled: demoLoginEnabled() }, { headers: { "Cache-Control": "no-store" } }); }
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin sign-in is not allowed." }, { status: 403 });
  if (!demoLoginEnabled()) return NextResponse.json({ error: "Demo access requires an explicitly isolated non-production environment without live service credentials." }, { status: 403 });
  const user: SessionUser = { id: "demo-bernie", name: "Bernie O’Neill", email: "bernie@r3alm.com", role: "super_admin", demo: true };
  const token = await createSessionToken(user);
  if (!token) return NextResponse.json({ error: "Demo authentication is unavailable." }, { status: 503 });
  const response = NextResponse.json({ ok: true, user });
  response.cookies.set(SESSION_NAME, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: SESSION_DURATION_SECONDS });
  return response;
}
