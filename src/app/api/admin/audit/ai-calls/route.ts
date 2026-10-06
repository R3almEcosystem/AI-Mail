import { NextResponse } from "next/server";
import { listAiCallAudit } from "@/lib/ai-telemetry";
import { requireAdminUser } from "@/lib/session";
import { privateHeaders } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdminUser();
    const audit = await listAiCallAudit(250);
    return NextResponse.json(audit, { headers: privateHeaders });
  } catch (error) {
    const status = error instanceof Error && error.message === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json(
      { error: status === 403 ? "Administrator access required." : "Authentication required." },
      { status, headers: privateHeaders },
    );
  }
}
