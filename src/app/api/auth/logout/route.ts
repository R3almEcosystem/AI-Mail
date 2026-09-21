import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_NAME, verifySessionToken } from "@/lib/auth";
import { revokeDatabaseSession } from "@/lib/session-store";
import { isSameOriginRequest } from "@/lib/auth-policy";
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin sign-out is not allowed." }, { status: 403 });
  let failed = false;
  try {
    const store = await cookies();
    const claims = await verifySessionToken(store.get(SESSION_NAME)?.value);
    if (claims && !claims.demo) await revokeDatabaseSession(claims);
  } catch { failed = true; }
  // Keep the cookie on a database outage so the user can retry durable revocation.
  if (failed) return NextResponse.json({ error: "Sign-out could not revoke the session. Please retry." }, { status: 503 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_NAME, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
  return response;
}
