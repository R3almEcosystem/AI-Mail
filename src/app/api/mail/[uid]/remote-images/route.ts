import { NextRequest, NextResponse } from "next/server";
import { getMail, mailConfiguration } from "@/lib/mail";
import { hydrateRemoteEmailImages } from "@/lib/remote-email-images";
import { requireCapability } from "@/lib/session";
import { apiError, privateHeaders } from "@/lib/api-error";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ uid: string }> };

function validUid(uid: number) {
  return Number.isSafeInteger(uid) && uid >= 1 && uid <= 4294967295;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireCapability("mail:read", request);
    const uid = Number((await context.params).uid);
    if (!validUid(uid)) {
      return NextResponse.json({ error: "Invalid message identifier." }, { status: 400, headers: privateHeaders });
    }
    if (user.demo) {
      return NextResponse.json({
        error: "Remote image loading is unavailable in demo mode.",
      }, { status: 400, headers: privateHeaders });
    }

    const accountId = request.nextUrl.searchParams.get("accountId") || "primary";
    if (accountId !== "primary" && !/^[0-9a-f-]{36}$/i.test(accountId)) {
      return NextResponse.json({ error: "Invalid mail account." }, { status: 400, headers: privateHeaders });
    }
    if (!(await mailConfiguration(accountId)).imap) {
      return NextResponse.json({ error: "Incoming mail is not configured for the selected account." }, { status: 503, headers: privateHeaders });
    }

    const folder = request.nextUrl.searchParams.get("folder") || "INBOX";
    if (folder !== "INBOX" && folder !== "INBOX.Sent") {
      return NextResponse.json({ error: "Unsupported mailbox folder." }, { status: 400, headers: privateHeaders });
    }

    const message = await getMail(uid, folder, accountId);
    if (!message.safeHtmlBody) {
      return NextResponse.json({
        error: "This message does not contain a secure HTML body.",
      }, { status: 404, headers: privateHeaders });
    }

    const result = await hydrateRemoteEmailImages(message.safeHtmlBody);
    return NextResponse.json({
      safeHtmlBody: result.html,
      loaded: result.loaded,
      blocked: result.blocked,
    }, { headers: privateHeaders });
  } catch (error) {
    return apiError(error, "Remote email images could not be loaded.");
  }
}
