import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { testMailConnection } from "@/lib/mail";
import { mailConnectionFailure, safeMailConnectionLog } from "@/lib/mail-connection-error";
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
    try {
      await testMailConnection(parsed.data.service, id);
    } catch (connectionError) {
      if (connectionError && typeof connectionError === "object") {
        Object.defineProperty(connectionError, "service", { value: parsed.data.service, enumerable: false, configurable: true });
      }
      throw connectionError;
    }
    return NextResponse.json({ ok: true, service: parsed.data.service }, { headers: privateHeaders });
  } catch (error) {
    if (error instanceof Error && error.message === "MAIL_ACCOUNT_NOT_FOUND") return NextResponse.json({ error: "Mail account not found." }, { status: 404, headers: privateHeaders });
    if (error instanceof Error && error.message === "MAIL_ACCOUNT_NOT_CONFIGURED") return NextResponse.json({ error: "This mail account is missing required incoming-mail configuration.", code: "MAIL_ACCOUNT_NOT_CONFIGURED" }, { status: 409, headers: privateHeaders });
    if (error instanceof Error && error.message === "SMTP is not configured") return NextResponse.json({ error: "This account does not have a complete SMTP sending configuration.", code: "SMTP_NOT_CONFIGURED" }, { status: 409, headers: privateHeaders });

    const service = (() => {
      try {
        const bodyService = (error as { service?: unknown })?.service;
        return bodyService === "smtp" ? "smtp" as const : "imap" as const;
      } catch {
        return "imap" as const;
      }
    })();
    const failure = mailConnectionFailure(error, service);
    console.error("[mail-account-test] connection failed", {
      accountId: (await context.params).id,
      service,
      ...safeMailConnectionLog(error),
      diagnostic: failure.code,
    });
    return NextResponse.json({ error: failure.message, code: failure.code }, { status: failure.status, headers: privateHeaders });
  }
}
