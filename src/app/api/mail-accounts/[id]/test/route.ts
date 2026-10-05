import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { testMailConnection } from "@/lib/mail";
import { requireCapability } from "@/lib/session";
import { apiError, privateHeaders } from "@/lib/api-error";

const schema = z.object({ service: z.enum(["imap", "smtp"]) });
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    await requireCapability("admin:manage", request);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Choose IMAP or SMTP to test." }, { status: 400, headers: privateHeaders });
    const id = (await context.params).id;
    await testMailConnection(parsed.data.service, id);
    return NextResponse.json({ ok: true, service: parsed.data.service }, { headers: privateHeaders });
  } catch (error) {
    if (error instanceof Error && error.message === "MAIL_ACCOUNT_NOT_FOUND") return NextResponse.json({ error: "Mail account not found." }, { status: 404, headers: privateHeaders });
    return apiError(error, "The mail account connection could not be verified.");
  }
}
