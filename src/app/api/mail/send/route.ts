import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { mailConfiguration, sendMail } from "@/lib/mail";
import { requireCapability } from "@/lib/session";
import { apiError, privateHeaders } from "@/lib/api-error";
export const maxDuration = 60;
const sendSchema = z.object({ to: z.email(), cc: z.union([z.email(), z.literal("")]).optional(), subject: z.string().trim().min(1).max(250), text: z.string().trim().min(1).max(50000) });
export async function POST(request: NextRequest) {
  try {
    const user = await requireCapability("mail:write", request);
    const parsed = sendSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Check the recipient, subject, and message." }, { status: 400 });
    if (user.demo) return NextResponse.json({ ok: true, demo: true, messageId: "demo-message" }, { headers: privateHeaders });
    if (!mailConfiguration().smtp) return NextResponse.json({ error: "Outgoing mail is not configured. No message was sent." }, { status: 503 });
    const result = await sendMail(parsed.data);
    return NextResponse.json({ ok: true, demo: false, ...result }, { headers: privateHeaders });
  } catch (error) { return apiError(error, "The message could not be accepted. Check the recipient policy and mail service before retrying."); }
}
