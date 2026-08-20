import { NextResponse } from "next/server";
import { aiConfiguration } from "@/lib/ai";
import { authenticationConfigured, demoLoginEnabled } from "@/lib/auth";
import { databaseConfigured } from "@/lib/admin-data";
import { mailConfiguration } from "@/lib/mail";
import type { AppStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const mail = mailConfiguration();
  const ai = aiConfiguration();
  const status: AppStatus = {
    mode: mail.imap ? "live" : "demo",
    authentication: authenticationConfigured(),
    database: databaseConfigured(),
    demoLogin: demoLoginEnabled(),
    imap: mail.imap,
    smtp: mail.smtp,
    openai: ai.configured,
    model: ai.model,
  };

  return NextResponse.json(status, {
    headers: { "Cache-Control": "no-store" },
  });
}
