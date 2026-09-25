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
    const limit = Number(request.nextUrl.searchParams.get("limit") || 50);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) return NextResponse.json({ error: "Invalid message limit." }, { status: 400 });
    if (user.demo) return NextResponse.json({ messages: mockMessages, unread: mockMessages.filter(message => message.unread).length, total: mockMessages.length, demo: true }, { headers: privateHeaders });
    if (!mailConfiguration().imap) return NextResponse.json({ error: "Incoming mail is not configured." }, { status: 503 });
    return NextResponse.json(await listMail(folder, limit), { headers: privateHeaders });
  } catch (error) { return apiError(error, "The mailbox could not be loaded."); }
}
