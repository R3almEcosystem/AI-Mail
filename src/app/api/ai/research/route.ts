import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { mailConfiguration } from "@/lib/mail";
import { runMailResearch } from "@/lib/mail-research";
import { requireCapability } from "@/lib/session";
import { apiError, privateHeaders } from "@/lib/api-error";

const requestSchema = z.object({
  query: z.string().trim().min(3).max(2000),
  scope: z.enum(["inbox", "sent", "both"]),
});

export const maxDuration = 60;

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
    return NextResponse.json(result, { headers: privateHeaders });
  } catch (error) {
    return apiError(error, "Mailbox research could not be completed.");
  }
}
