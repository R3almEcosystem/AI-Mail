import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getMail, listMail } from "@/lib/mail";
import { privateHeaders } from "@/lib/api-error";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const EXPECTED_TOKEN_SHA256 = "1d93f9d11ce7fbfdf69029ab6bc5c2da48fe82e9910d4ab8db70e4a1f1499839";
const BERNIE_ACCOUNT_ID = "8c78cf6e-d247-4796-ad65-233c3da01c81";
const TARGET_SUBJECT = "Bloodline Killer - The Next Chapter Files";
const RECEIVED_UID = 2577;

function authorized(request: Request) {
  const value = request.headers.get("authorization") || "";
  const token = value.startsWith("Bearer ") ? value.slice(7) : "";
  const actual = Buffer.from(createHash("sha256").update(token).digest("hex"));
  const expected = Buffer.from(EXPECTED_TOKEN_SHA256);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function attachmentSummary(message: Awaited<ReturnType<typeof getMail>>) {
  return {
    uid: message.uid,
    subject: message.subject,
    senderEmail: message.senderEmail,
    receivedAt: message.receivedAt,
    accountId: message.accountId || null,
    accountLabel: message.accountLabel || null,
    attachmentCount: message.attachmentFiles?.length || 0,
    attachments: (message.attachmentFiles || []).map((attachment) => ({
      id: attachment.id,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      bytes: attachment.bytes,
      vaultState: attachment.vaultState,
      scanStatus: attachment.scanStatus,
      scanReason: attachment.scanReason,
      analysisAllowed: attachment.analysisAllowed,
      extractionStatus: attachment.extractionStatus,
    })),
  };
}

export async function POST(request: Request) {
  if (process.env.VERCEL_ENV !== "production") {
    return NextResponse.json({ error: "Production verification only." }, { status: 404, headers: privateHeaders });
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: "Not found." }, { status: 404, headers: privateHeaders });
  }

  let received: Awaited<ReturnType<typeof getMail>> | null = null;
  let receivedError: string | null = null;
  try {
    received = await getMail(RECEIVED_UID, "INBOX");
  } catch (error) {
    receivedError = error instanceof Error ? error.message : "RECEIVED_INGEST_FAILED";
  }

  let sent: Awaited<ReturnType<typeof getMail>> | null = null;
  let sentError: string | null = null;
  let sentCandidateUid: number | null = null;
  try {
    const sentPage = await listMail("INBOX.Sent", 20, undefined, BERNIE_ACCOUNT_ID);
    const candidate = sentPage.messages.find((message) => message.subject === TARGET_SUBJECT)
      || sentPage.messages[0];
    if (!candidate) {
      sentError = "No Bernie Sent message was available for verification.";
    } else {
      sentCandidateUid = candidate.uid;
      sent = await getMail(candidate.uid, "INBOX.Sent", BERNIE_ACCOUNT_ID);
    }
  } catch (error) {
    sentError = error instanceof Error ? error.message : "SENT_INGEST_FAILED";
  }

  return NextResponse.json({
    received: received ? attachmentSummary(received) : null,
    receivedError,
    sent: sent ? attachmentSummary(sent) : null,
    sentError,
    sentCandidateUid,
    sameSubject: Boolean(received && sent && received.subject === sent.subject),
  }, { status: received && sent ? 200 : 207, headers: privateHeaders });
}
