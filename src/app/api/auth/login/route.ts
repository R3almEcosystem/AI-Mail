import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticationConfigured, createSessionToken, SESSION_NAME } from "@/lib/auth";
import { findUserForLogin, getSettings, recordLogin, verifyPassword } from "@/lib/admin-data";
import { createDatabaseSession, consumeLoginAttempt } from "@/lib/session-store";
import { isSameOriginRequest } from "@/lib/auth-policy";
import { privateHeaders } from "@/lib/api-error";
const loginSchema = z.object({ email: z.string().trim().email().max(320), password: z.string().min(1).max(500) });
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin sign-in is not allowed." }, { status: 403 });
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
  if (!authenticationConfigured()) return NextResponse.json({ error: "Individual-account authentication is not configured." }, { status: 503 });
  try {
    const email = parsed.data.email.toLowerCase();
    if (!await consumeLoginAttempt(email)) return NextResponse.json({ error: "Too many sign-in attempts. Try again after the rate-limit window." }, { status: 429, headers: { "Retry-After": "900" } });
    const login = await findUserForLogin(email);
    if (!login || login.status !== "active" || !login.passwordHash || !await verifyPassword(parsed.data.password, login.passwordHash)) return NextResponse.json({ error: "The email or password is incorrect." }, { status: 401 });
    const settings = await getSettings();
    // Until an MFA-capable direct identity flow is deployed, never treat password-only access as MFA.
    if (settings.requireMfa) return NextResponse.json({ error: "MFA is required. Password-only sign-in is blocked; the MFA identity flow must be configured.", code: "MFA_REQUIRED" }, { status: 403 });
    const duration = settings.sessionTimeoutMinutes * 60;
    const sessionId = await createDatabaseSession(login.user, login.passwordHash, duration);
    const token = await createSessionToken(login.user, duration, sessionId);
    if (!token) return NextResponse.json({ error: "Session signing is unavailable." }, { status: 503 });
    await recordLogin(login.user);
    const response = NextResponse.json({ ok: true }, { headers: privateHeaders });
    response.cookies.set(SESSION_NAME, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: duration });
    return response;
  } catch {
    return NextResponse.json({ error: "Authentication is temporarily unavailable. No access was granted." }, { status: 503 });
  }
}
