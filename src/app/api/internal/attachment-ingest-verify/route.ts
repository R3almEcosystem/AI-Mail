import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getMail, listMail } from "@/lib/mail";
import { privateHeaders } from "@/lib/api-error";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const EXPECTED_TOKEN_SHA256 = "ba3940caf81aee9151847ec086ed6d395b062c905d69fc836e331de3272bac37";
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

async function runVerification() {
  const received = await getMail(RECEIVED_UID, "INBOX");

  const sentPage = await listMail("INBOX.Sent", 20, undefined, BERNIE_ACCOUNT_ID);
  const candidate = sentPage.messages.find((message) => message.subject === TARGET_SUBJECT)
    || sentPage.messages[0];
  if (!candidate) {
    return NextResponse.json({
      error: "No Bernie Sent message was available for verification.",
      received: attachmentSummary(received),
    }, { status: 404, headers: privateHeaders });
  }
  const sent = await getMail(candidate.uid, "INBOX.Sent", BERNIE_ACCOUNT_ID);

  return NextResponse.json({
    received: attachmentSummary(received),
    sent: attachmentSummary(sent),
    sameSubject: received.subject === sent.subject,
  }, { headers: privateHeaders });
}

export async function POST(request: Request) {
  if (process.env.VERCEL_ENV !== "production") {
    return NextResponse.json({ error: "Production verification only." }, { status: 404, headers: privateHeaders });
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: "Not found." }, { status: 404, headers: privateHeaders });
  }
  return runVerification();
}

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== "production") {
    return NextResponse.json({ error: "Production verification only." }, { status: 404, headers: privateHeaders });
  }
  if (new URL(request.url).searchParams.get("run") !== "latest-pdf-20261006") {
    return NextResponse.json({ error: "Not found." }, { status: 404, headers: privateHeaders });
  }
  return runVerification();
}
