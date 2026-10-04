import { NextRequest, NextResponse } from "next/server";
import { listMail, mailConfiguration } from "@/lib/mail";
import { mockMessages } from "@/lib/mock-mail";
import { requireCapability } from "@/lib/session";
import { apiError, privateHeaders } from "@/lib/api-error";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: NextRequest) {
  try {
    const user = await requireCapability("mail:read");
    const folder = request.nextUrl.searchParams.get("folder") || "INBOX";
    if (folder !== "INBOX" && folder !== "INBOX.Sent") return NextResponse.json({ error: "Unsupported mailbox folder." }, { status: 400 });
    const limit = Number(request.nextUrl.searchParams.get("limit") || 50);
    const beforeParam = request.nextUrl.searchParams.get("beforeUid");
    const beforeUid = beforeParam === null ? undefined : Number(beforeParam);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) return NextResponse.json({ error: "Invalid message limit." }, { status: 400 });
    if (beforeUid !== undefined && (!Number.isSafeInteger(beforeUid) || beforeUid <= 1 || beforeUid > 4294967295)) return NextResponse.json({ error: "Invalid mailbox cursor." }, { status: 400 });
    if (user.demo) return NextResponse.json({ messages: beforeUid ? [] : mockMessages, unread: mockMessages.filter(message => message.unread).length, total: mockMessages.length, hasMore: false, nextBeforeUid: null, demo: true }, { headers: privateHeaders });
    if (!(await mailConfiguration()).imap) return NextResponse.json({ error: "Incoming mail is not configured." }, { status: 503 });
    return NextResponse.json(await listMail(folder, limit, beforeUid), { headers: privateHeaders });
  } catch (error) { return apiError(error, "The mailbox could not be loaded."); }
}
