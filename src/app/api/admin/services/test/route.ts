import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { testAiConnection } from "@/lib/ai";
import { testMailConnection } from "@/lib/mail";
import { getAttachmentPolicy } from "@/lib/attachment-policy";
import { inspectAttachments } from "../../../../../security/attachment-scan";
import { requireCapability } from "@/lib/session";
import { apiError, privateHeaders } from "@/lib/api-error";

const testSchema = z.object({ service: z.enum(["imap", "smtp", "openai", "attachment"]) });

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let service: "imap" | "smtp" | "openai" | "attachment" | null = null;
  try {
    const user = await requireCapability("admin:manage", request);
    const parsed = testSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Select a valid service to test." }, { status: 400, headers: privateHeaders });
    service = parsed.data.service;

    if (service === "openai") {
      const result = await testAiConnection({ actorId: user.id, actorName: user.name });
      return NextResponse.json({
        ok: result.ok,
        service: "openai",
        model: result.model,
        providerModel: result.providerModel,
      }, { headers: privateHeaders });
    }

    if (service === "attachment") {
      const policy = await getAttachmentPolicy();
      if (policy.mode !== "required" || !policy.scanner) {
        return NextResponse.json({
          error: "Required attachment scanning is not fully configured. Save a Cloudmersive API key first.",
        }, { status: 503, headers: privateHeaders });
      }
      const probe = new TextEncoder().encode("S.I.-Mail attachment scanner connection test.");
      const result = await inspectAttachments([probe], policy);
      if (result.status !== "clean") {
        return NextResponse.json({
          error: "Attachment scanner verification did not return a clean result.",
          status: result.status,
          reason: result.reason || result.files[0]?.reason || null,
        }, { status: 502, headers: privateHeaders });
      }
      return NextResponse.json({
        ok: true,
        service: "attachment",
        provider: result.provider,
      }, { headers: privateHeaders });
    }

    await testMailConnection(service);
    return NextResponse.json({ ok: true, service }, { headers: privateHeaders });
  } catch (error) {
    if (service === "attachment") {
      console.error("[si-mail] attachment scanner verification failed", {
        code: error instanceof Error ? error.message.slice(0, 120) : "ERROR",
      });
    }
    if (service === "openai" && error instanceof Error && error.message.startsWith("OpenAI")) {
      console.error("[ai-mail] OpenAI service verification failed:", error.message);
      return NextResponse.json({ error: error.message }, { status: 502, headers: privateHeaders });
    }
    return apiError(error, "The saved service configuration could not be verified.");
  }
}
