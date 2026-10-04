import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { testAiConnection } from "@/lib/ai";
import { testMailConnection } from "@/lib/mail";
import { requireCapability } from "@/lib/session";
import { apiError, privateHeaders } from "@/lib/api-error";

const testSchema = z.object({ service: z.enum(["imap", "smtp", "openai"]) });

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let service: "imap" | "smtp" | "openai" | null = null;
  try {
    await requireCapability("admin:manage", request);
    const parsed = testSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Select a valid service to test." }, { status: 400, headers: privateHeaders });
    service = parsed.data.service;

    if (service === "openai") {
      const result = await testAiConnection();
      return NextResponse.json({
        ok: result.ok,
        service: "openai",
        model: result.model,
        providerModel: result.providerModel,
      }, { headers: privateHeaders });
    }

    await testMailConnection(service);
    return NextResponse.json({ ok: true, service }, { headers: privateHeaders });
  } catch (error) {
    if (service === "openai" && error instanceof Error && error.message.startsWith("OpenAI")) {
      console.error("[ai-mail] OpenAI service verification failed:", error.message);
      return NextResponse.json({ error: error.message }, { status: 502, headers: privateHeaders });
    }
    return apiError(error, "The saved service configuration could not be verified.");
  }
}
