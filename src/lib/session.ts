import "server-only";

import { cookies } from "next/headers";
import { SESSION_NAME, verifySessionToken } from "@/lib/auth";
import type { SessionUser } from "@/lib/types";

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_NAME)?.value);
}

export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export async function requireAdminUser() {
  const user = await requireSessionUser();
  if (user.role !== "admin" && user.role !== "super_admin") {
    throw new Error("FORBIDDEN");
  }
  return user;
}
