import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { aiConfiguration, analyzeMail } from "@/lib/ai";

export const maxDuration = 60;

const aiRequestSchema = z.object({
  action: z.enum(["summarize", "draft", "prioritize", "extract"]),
  message: z.object({
    sender: z.string().max(300),
    senderEmail: z.string().max(320),
    subject: z.string().max(500),
    preview: z.string().max(3_000),
    body: z.string().max(50_000).optional(),
  }),
  instructions: z.string().max(1_000).optional(),
});

const demoResponses = {
  summarize:
    "• The sender is requesting a response or review.\n• The message should be handled within the next business day.\n• Confirm ownership, timing, and any required attachments before replying.\n• Connect the OpenAI API to replace this preview with live analysis.",
  draft:
    "Thank you for the update. I have reviewed the request and will coordinate the outstanding items with our team. I will send the consolidated materials and proposed next steps shortly.\n\nBest,\nBernie",
  prioritize:
    "IMPORTANT — The message appears to require a business response or review. Recommended response window: within one business day.",
  extract:
    "☐ Confirm the requested deliverable\n☐ Identify the responsible team member\n☐ Verify any stated deadline\n☐ Prepare and send the response",
} as const;

export async function POST(request: NextRequest) {
  const parsed = aiRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid AI request." }, { status: 400 });
  }

  if (!aiConfiguration().configured) {
    return NextResponse.json({
      text: demoResponses[parsed.data.action],
      demo: true,
      model: null,
    });
  }

  try {
    const result = await analyzeMail(
      parsed.data.action,
      parsed.data.message,
      parsed.data.instructions,
    );
    return NextResponse.json({
      text: result.text,
      usage: result.usage,
      demo: false,
      model: aiConfiguration().model,
    });
  } catch (error) {
    console.error("OpenAI analysis failed", error);
    return NextResponse.json(
      { error: "AI processing failed. Check the OpenAI API configuration." },
      { status: 502 },
    );
  }
}

