import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { aiConfiguration, analyzeMail } from "@/lib/ai";
import { requireCapability } from "@/lib/session";
import { apiError, privateHeaders } from "@/lib/api-error";
export const maxDuration = 60;
const aiRequestSchema = z.object({
  action: z.enum(["summarize", "draft", "prioritize", "extract"]),
  message: z.object({ sender: z.string().max(300), senderEmail: z.string().max(320), subject: z.string().max(500), preview: z.string().max(3000), body: z.string().max(50000).optional() }),
  instructions: z.string().max(1000).optional(),
});
const demoResponses = {
  summarize: "Demo summary: confirm the requested deliverable, owner, and timing. This is simulated analysis.",
  draft: "Thank you for the update. I will review the outstanding items and confirm the next steps.\n\nThis is a demonstration draft, not a sent message.",
  prioritize: "DEMO — Review the request and confirm any deadline before assigning a priority.",
  extract: "Demo checklist: confirm the deliverable, identify an owner, verify the deadline, prepare a response.",
} as const;
export async function POST(request: NextRequest) {
  try {
    const user = await requireCapability("ai:use", request);
    const parsed = aiRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid AI request." }, { status: 400 });
    if (user.demo) return NextResponse.json({ text: demoResponses[parsed.data.action], demo: true, model: null }, { headers: privateHeaders });
    if (!aiConfiguration().configured) return NextResponse.json({ error: "AI processing is not configured." }, { status: 503 });
    const result = await analyzeMail(parsed.data.action, parsed.data.message, parsed.data.instructions);
    return NextResponse.json({ text: result.text, usage: result.usage, demo: false, model: aiConfiguration().model }, { headers: privateHeaders });
  } catch (error) { return apiError(error, "AI processing failed. No generated result is available."); }
}
