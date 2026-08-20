import { NextResponse } from "next/server";
import { listAlertGroups } from "@/lib/admin-data";
import { requireSessionUser } from "@/lib/session";

export async function GET() {
  try {
    await requireSessionUser();
    return NextResponse.json({ groups: await listAlertGroups(true) });
  } catch (error) {
    const status = error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "Authentication required." : "Unable to load escalation groups." }, { status });
  }
}
