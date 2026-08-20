import { NextRequest, NextResponse } from "next/server";
import { listMail, mailConfiguration } from "@/lib/mail";
import { mockMessages } from "@/lib/mock-mail";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const folder = request.nextUrl.searchParams.get("folder") || "INBOX";
  const requestedLimit = Number(request.nextUrl.searchParams.get("limit") || 50);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(100, Math.max(1, requestedLimit))
    : 50;

  if (!mailConfiguration().imap) {
    return NextResponse.json({
      messages: mockMessages,
      unread: mockMessages.filter((message) => message.unread).length,
      total: mockMessages.length,
      demo: true,
    });
  }

  try {
    return NextResponse.json(await listMail(folder, limit));
  } catch (error) {
    console.error("IMAP list failed", error);
    return NextResponse.json(
      { error: "The mailbox could not be loaded. Check the IMAP configuration." },
      { status: 502 },
    );
  }
}

