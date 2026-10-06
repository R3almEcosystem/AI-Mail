import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeStoredAttachment } from "@/lib/attachment-ai";
import { requireCapability } from "@/lib/session";
import { can } from "@/lib/auth-policy";
import { apiError, privateHeaders } from "@/lib/api-error";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  instructions: z.string().trim().max(1000).optional(),
});
type RouteContext = { params: Promise<{ id: string }> };
const validId = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireCapability("ai:use", request);
    if (!can(user.role, "mail:read")) throw new Error("FORBIDDEN");
    if (user.demo) return NextResponse.json({ error: "Attachment analysis is available only for live mail." }, { status: 409, headers: privateHeaders });

    const id = (await context.params).id;
    if (!validId(id)) return NextResponse.json({ error: "Invalid attachment identifier." }, { status: 400, headers: privateHeaders });
    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid attachment analysis request." }, { status: 400, headers: privateHeaders });

    const result = await analyzeStoredAttachment(id, parsed.data.instructions || "", {
      actorId: user.id,
      actorName: user.name,
    });
    return NextResponse.json(result, { headers: privateHeaders });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "ATTACHMENT_NOT_FOUND") return NextResponse.json({ error: "Attachment not found." }, { status: 404, headers: privateHeaders });
    if (code === "ATTACHMENT_TYPE_NOT_SUPPORTED") return NextResponse.json({ error: "This attachment type is not supported for S.I. analysis." }, { status: 415, headers: privateHeaders });
    if (code === "OpenAI is not configured.") return NextResponse.json({ error: "S.I. processing is not configured." }, { status: 503, headers: privateHeaders });
    return apiError(error, "S.I. could not analyze this attachment.");
  }
}
