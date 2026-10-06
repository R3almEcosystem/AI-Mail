import { NextResponse } from "next/server";
import { getAttachmentPolicy } from "@/lib/attachment-policy";
import { inspectAttachments, type FileInspection } from "@/security/attachment-scan";
import { privateHeaders } from "@/lib/api-error";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  if (process.env.VERCEL_ENV === "production") {
    return NextResponse.json({ error: "Not available in production." }, { status: 404, headers: privateHeaders });
  }

  const policy = await getAttachmentPolicy();
  if (policy.mode !== "required" || !policy.scanner) {
    return NextResponse.json({
      ok: false,
      configured: false,
      required: policy.mode === "required",
      provider: policy.scanner?.id ?? null,
      result: "scanner_unavailable",
    }, { status: 503, headers: privateHeaders });
  }

  const synthetic = new TextEncoder().encode("S.I.-Mail scanner synthetic harmless document.");
  const startedAt = Date.now();
  const result = await inspectAttachments([synthetic], policy);
  return NextResponse.json({
    ok: result.status === "clean",
    configured: true,
    required: true,
    provider: result.provider,
    status: result.status,
    reason: result.reason || result.files[0]?.reason || null,
    files: result.files.map((file: FileInspection) => ({
      status: file.status,
      bytes: file.bytes,
      hasSha256: /^[0-9a-f]{64}$/i.test(file.sha256),
      reason: file.reason || null,
    })),
    responseTimeMs: Date.now() - startedAt,
  }, {
    status: result.status === "clean" ? 200 : 502,
    headers: privateHeaders,
  });
}
