import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getMail, listMail } from "@/lib/mail";
import { privateHeaders } from "@/lib/api-error";
import { getServiceSecret } from "@/lib/service-secrets";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BERNIE_ACCOUNT_ID = "8c78cf6e-d247-4796-ad65-233c3da01c81";
const TARGET_SUBJECT = "Bloodline Killer - The Next Chapter Files";
const RECEIVED_UID = 2577;

async function authorized(request: Request) {
  const value = request.headers.get("authorization") || "";
  const token = value.startsWith("Bearer ") ? value.slice(7) : "";
  if (!/^[0-9a-f]{64}$/i.test(token)) return false;

  const scannerSecret = await getServiceSecret("ai_mail_cloudmersive_api_key");
  if (!scannerSecret) return false;
  const expected = Buffer.from(createHash("sha256").update(scannerSecret).digest("hex"));
  const actual = Buffer.from(token.toLowerCase());
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
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "Not found." }, { status: 404, headers: privateHeaders });
  }

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
