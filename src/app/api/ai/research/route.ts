import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { mailConfiguration } from "@/lib/mail";
import { runMailResearch } from "@/lib/mail-research";
import { saveResearchHistory } from "@/lib/mail-research-history";
import { requireCapability } from "@/lib/session";
import { apiError, privateHeaders } from "@/lib/api-error";

const requestSchema = z.object({
  query: z.string().trim().min(3).max(2000),
  scope: z.enum(["inbox", "sent", "both"]),
});

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const user = await requireCapability("ai:use", request);
    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter a mailbox research instruction and select a valid scope." }, { status: 400, headers: privateHeaders });
    }
    if (user.demo) {
      return NextResponse.json({ error: "Mailbox research requires the live mailbox." }, { status: 409, headers: privateHeaders });
    }
    if (!(await mailConfiguration()).imap) {
      return NextResponse.json({ error: "Incoming mail is not configured." }, { status: 503, headers: privateHeaders });
    }

    const result = await runMailResearch(parsed.data.query, parsed.data.scope);
    let history: { id: string; createdAt: string } | null = null;
    try {
      history = await saveResearchHistory(user, parsed.data.query, parsed.data.scope, result);
    } catch (historyError) {
      const historyMessage = historyError instanceof Error ? historyError.message : "";
      console.error("[mail-research-history] save failed", {
        name: historyError instanceof Error ? historyError.name : "UnknownError",
        code: historyMessage.slice(0, 120),
      });
    }
    return NextResponse.json({
      ...result,
      historySaved: Boolean(history),
      historyId: history?.id || null,
      historyCreatedAt: history?.createdAt || null,
    }, { headers: privateHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error("[mail-research] request failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      code: message.slice(0, 180),
    });
    if (message === "OpenAI is not configured.") {
      return NextResponse.json({ error: "OpenAI is not configured for mailbox research." }, { status: 503, headers: privateHeaders });
    }
    if (message.startsWith("OpenAI research request failed")) {
      return NextResponse.json({ error: "OpenAI could not complete the mailbox research step. Retry the request or choose another configured model." }, { status: 502, headers: privateHeaders });
    }
    if (message.includes("safe mailbox search")) {
      return NextResponse.json({ error: "The AI could not interpret this mailbox query reliably. Try naming the people, addresses, phrase, or date range more explicitly." }, { status: 422, headers: privateHeaders });
    }
    return apiError(error, "Mailbox research could not be completed.");
  }
}
