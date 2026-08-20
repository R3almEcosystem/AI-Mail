import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMail, mailConfiguration, updateMail } from "@/lib/mail";
import { mockMessages } from "@/lib/mock-mail";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const actionSchema = z.object({
  action: z.enum(["read", "unread", "flag", "unflag", "archive"]),
  folder: z.string().min(1).max(120).optional(),
});

type RouteContext = { params: Promise<{ uid: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { uid: uidValue } = await context.params;
  const uid = Number(uidValue);
  if (!Number.isInteger(uid) || uid < 1) {
    return NextResponse.json({ error: "Invalid message identifier." }, { status: 400 });
  }

  if (!mailConfiguration().imap) {
    const message = mockMessages.find((item) => item.uid === uid);
    return message
      ? NextResponse.json({ message, demo: true })
      : NextResponse.json({ error: "Message not found." }, { status: 404 });
  }

  try {
    const folder = request.nextUrl.searchParams.get("folder") || "INBOX";
    return NextResponse.json({ message: await getMail(uid, folder), demo: false });
  } catch (error) {
    console.error("IMAP message load failed", error);
    return NextResponse.json({ error: "The message could not be loaded." }, { status: 502 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { uid: uidValue } = await context.params;
  const uid = Number(uidValue);
  if (!Number.isInteger(uid) || uid < 1) {
    return NextResponse.json({ error: "Invalid message identifier." }, { status: 400 });
  }

  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid mailbox action." }, { status: 400 });
  }

  if (!mailConfiguration().imap) {
    return NextResponse.json({ ok: true, demo: true });
  }

  try {
    await updateMail(uid, parsed.data.action, parsed.data.folder || "INBOX");
    return NextResponse.json({ ok: true, demo: false });
  } catch (error) {
    console.error("IMAP update failed", error);
    return NextResponse.json({ error: "The message could not be updated." }, { status: 502 });
  }
}

