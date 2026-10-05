import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getResearchHistory } from "@/lib/mail-research-history";
import { requireCapability } from "@/lib/session";
import { apiError, privateHeaders } from "@/lib/api-error";

const idSchema = z.string().uuid();

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCapability("ai:use", request);
    const { id } = await context.params;
    const parsed = idSchema.safeParse(id);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid research history record." }, { status: 400, headers: privateHeaders });
    }
    const item = await getResearchHistory(user, parsed.data);
    if (!item) {
      return NextResponse.json({ error: "Research history record not found." }, { status: 404, headers: privateHeaders });
    }
    return NextResponse.json({ item }, { headers: privateHeaders });
  } catch (error) {
    return apiError(error, "Research history record could not be loaded.");
  }
}
