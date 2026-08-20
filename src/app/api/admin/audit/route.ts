import { NextResponse } from "next/server";
import { databaseConfigured, listAudit } from "@/lib/admin-data";
import { requireAdminUser } from "@/lib/session";

export async function GET() {
  try {
    await requireAdminUser();
    return NextResponse.json({ events: await listAudit(), demo: !databaseConfigured() });
  } catch (error) {
    const status = error instanceof Error && error.message === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json({ error: status === 403 ? "Administrator access required." : "Authentication required." }, { status });
  }
}
