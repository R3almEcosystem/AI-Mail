import { NextResponse } from "next/server";
import { loadAttachmentBytes } from "@/lib/attachment-content";
import { requireCapability } from "@/lib/session";
import { apiError, privateHeaders } from "@/lib/api-error";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };
const validId = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

function disposition(filename: unknown) {
  const safe = typeof filename === "string"
    ? filename.replace(/[\u0000-\u001f\u007f"]/g, "").slice(0, 240)
    : "attachment";
  return "attachment; filename*=UTF-8''" + encodeURIComponent(safe || "attachment");
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireCapability("mail:read");
    const id = (await context.params).id;
    if (!validId(id)) return NextResponse.json({ error: "Invalid attachment identifier." }, { status: 400, headers: privateHeaders });

    const { bytes, record } = await loadAttachmentBytes(id);
    if (record.vault_state !== "available" || record.scan_status !== "clean" || record.analysis_allowed !== true) {
      return NextResponse.json({ error: "This attachment is quarantined or has not passed required inspection." }, { status: 423, headers: privateHeaders });
    }

    return new Response(bytes, {
      status: 200,
      headers: {
        ...privateHeaders,
        "Content-Type": String(record.mime_type || "application/octet-stream"),
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": disposition(record.filename),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "ATTACHMENT_NOT_FOUND") return NextResponse.json({ error: "Attachment not found." }, { status: 404, headers: privateHeaders });
    return apiError(error, "The attachment could not be downloaded.");
  }
}
