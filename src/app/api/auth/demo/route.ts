import { NextResponse } from "next/server";
import {
  createSessionToken,
  demoLoginEnabled,
  SESSION_DURATION_SECONDS,
  SESSION_NAME,
} from "@/lib/auth";
import type { SessionUser } from "@/lib/types";
import { databaseConfigured, getSettings } from "@/lib/admin-data";

const bernieDemo: SessionUser = {
  id: "demo-bernie",
  name: "Bernie O’Neill",
  email: "bernie@r3alm.com",
  role: "super_admin",
  demo: true,
};

export async function POST() {
  const policyAllowsDemo = !databaseConfigured() || (await getSettings()).allowDemoLogin;
  if (!demoLoginEnabled() || !policyAllowsDemo) {
    return NextResponse.json({ error: "Demo login is disabled." }, { status: 403 });
  }
  const token = await createSessionToken(bernieDemo);
  if (!token) {
    return NextResponse.json({ error: "Demo authentication is unavailable." }, { status: 503 });
  }
  const response = NextResponse.json({ ok: true, user: bernieDemo });
  response.cookies.set(SESSION_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
  return response;
}
