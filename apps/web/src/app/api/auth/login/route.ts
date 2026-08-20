import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createSessionToken,
  SESSION_DURATION_SECONDS,
  SESSION_NAME,
} from "@/lib/auth";
import {
  findUserForLogin,
  getSettings,
  recordLogin,
  verifyPassword,
} from "@/lib/admin-data";
import type { SessionUser } from "@/lib/types";

const loginSchema = z.object({
  email: z.string().email().max(320).optional(),
  password: z.string().min(1).max(500),
});

export async function POST(request: NextRequest) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
  }

  let user: SessionUser | null = null;
  let durationSeconds = SESSION_DURATION_SECONDS;

  if (parsed.data.email) {
    const login = await findUserForLogin(parsed.data.email);
    if (
      login?.status === "active" &&
      (await verifyPassword(parsed.data.password, login.passwordHash))
    ) {
      user = login.user;
      const settings = await getSettings();
      durationSeconds = settings.sessionTimeoutMinutes * 60;
    }
  }

  if (!user && process.env.APP_ACCESS_PASSWORD === parsed.data.password) {
    user = {
      id: "legacy-owner",
      name: "Bernie O’Neill",
      email: parsed.data.email || process.env.ADMIN_INITIAL_EMAIL || "bernie@r3alm.com",
      role: "super_admin",
      demo: false,
    };
  }

  if (!user) {
    return NextResponse.json({ error: "The email or password is incorrect." }, { status: 401 });
  }

  const token = await createSessionToken(user, durationSeconds);
  if (!token) {
    return NextResponse.json(
      { error: "Authentication is not fully configured." },
      { status: 503 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: durationSeconds,
  });
  await recordLogin(user);
  return response;
}
