import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMail, mailConfiguration, updateMail } from "@/lib/mail";
import { mockMessages } from "@/lib/mock-mail";
import { requireCapability } from "@/lib/session";
import { apiError, privateHeaders } from "@/lib/api-error";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const actionSchema = z.object({ action: z.enum(["read", "unread", "flag", "unflag", "archive"]), folder: z.string().min(1).max(120).optional() });
type RouteContext = { params: Promise<{ uid: string }> };
const validUid = (uid: number) => Number.isSafeInteger(uid) && uid >= 1 && uid <= 4294967295;
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireCapability("mail:read");
    const uid = Number((await context.params).uid);
    if (!validUid(uid)) return NextResponse.json({ error: "Invalid message identifier." }, { status: 400 });
    if (user.demo) {
      const message = mockMessages.find(item => item.uid === uid);
      return message ? NextResponse.json({ message, demo: true }, { headers: privateHeaders }) : NextResponse.json({ error: "Message not found." }, { status: 404 });
    }
    if (!mailConfiguration().imap) return NextResponse.json({ error: "Incoming mail is not configured." }, { status: 503 });
    const folder = request.nextUrl.searchParams.get("folder") || "INBOX";
    return NextResponse.json({ message: await getMail(uid, folder), demo: false }, { headers: privateHeaders });
  } catch (error) { return apiError(error, "The message could not be loaded."); }
}
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireCapability("mail:write", request);
    const uid = Number((await context.params).uid);
    if (!validUid(uid)) return NextResponse.json({ error: "Invalid message identifier." }, { status: 400 });
    const parsed = actionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid mailbox action." }, { status: 400 });
    if (user.demo) return NextResponse.json({ ok: true, demo: true }, { headers: privateHeaders });
    if (!mailConfiguration().imap) return NextResponse.json({ error: "Incoming mail is not configured." }, { status: 503 });
    await updateMail(uid, parsed.data.action, parsed.data.folder || "INBOX");
    return NextResponse.json({ ok: true, demo: false }, { headers: privateHeaders });
  } catch (error) { return apiError(error, "The mail server did not confirm the change."); }
}
