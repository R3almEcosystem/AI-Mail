import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { testAiConnection } from "@/lib/ai";
import { testMailConnection } from "@/lib/mail";
import { requireCapability } from "@/lib/session";
import { apiError, privateHeaders } from "@/lib/api-error";

const testSchema = z.object({ service: z.enum(["imap", "smtp", "openai"]) });

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    await requireCapability("admin:manage", request);
    const parsed = testSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Select a valid service to test." }, { status: 400, headers: privateHeaders });

    if (parsed.data.service === "openai") {
      const result = await testAiConnection();
      return NextResponse.json({ ok: true, service: "openai", ...result }, { headers: privateHeaders });
    }

    await testMailConnection(parsed.data.service);
    return NextResponse.json({ ok: true, service: parsed.data.service }, { headers: privateHeaders });
  } catch (error) {
    return apiError(error, "The saved service configuration could not be verified.");
  }
}
