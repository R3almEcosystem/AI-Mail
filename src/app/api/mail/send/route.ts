import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { mailConfiguration, sendMail } from "@/lib/mail";

export const maxDuration = 30;

const sendSchema = z.object({
  to: z.email(),
  cc: z.union([z.email(), z.literal("")]).optional(),
  subject: z.string().trim().min(1).max(250),
  text: z.string().trim().min(1).max(50_000),
});

export async function POST(request: NextRequest) {
  const parsed = sendSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the recipient, subject, and message." }, { status: 400 });
  }

  if (!mailConfiguration().smtp) {
    return NextResponse.json({ ok: true, demo: true, messageId: "demo-message" });
  }

  try {
    const result = await sendMail(parsed.data);
    return NextResponse.json({ ok: true, demo: false, ...result });
  } catch (error) {
    console.error("SMTP send failed", error);
    return NextResponse.json({ error: "The message could not be sent." }, { status: 502 });
  }
}

