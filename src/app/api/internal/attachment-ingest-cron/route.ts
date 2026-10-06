import { NextResponse } from "next/server";
import { getMail, listMail } from "@/lib/mail";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BERNIE_ACCOUNT_ID = "8c78cf6e-d247-4796-ad65-233c3da01c81";
const TARGET_SUBJECT = "Bloodline Killer - The Next Chapter Files";
const RECEIVED_UID = 2577;

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== "production") return new NextResponse(null, { status: 404 });
  if (request.headers.get("user-agent") !== "vercel-cron/1.0") return new NextResponse(null, { status: 404 });

  try {
    const received = await getMail(RECEIVED_UID, "INBOX");
    const sentPage = await listMail("INBOX.Sent", 20, undefined, BERNIE_ACCOUNT_ID);
    const candidate = sentPage.messages.find((message) => message.subject === TARGET_SUBJECT);
    if (!candidate) throw new Error("TARGET_SENT_MESSAGE_NOT_FOUND");
    const sent = await getMail(candidate.uid, "INBOX.Sent", BERNIE_ACCOUNT_ID);

    console.info("[attachment-ingest-cron] completed", {
      receivedUid: received.uid,
      receivedAttachments: received.attachmentFiles?.length || 0,
      sentUid: sent.uid,
      sentAttachments: sent.attachmentFiles?.length || 0,
      subjectMatch: received.subject === sent.subject,
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[attachment-ingest-cron] failed", {
      code: error instanceof Error ? error.message.slice(0, 160) : "ERROR",
    });
    return NextResponse.json({ error: "Attachment ingestion verification failed." }, { status: 500 });
  }
}
