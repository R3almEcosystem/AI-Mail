import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listResearchHistory } from "@/lib/mail-research-history";
import { requireCapability } from "@/lib/session";
import { apiError, privateHeaders } from "@/lib/api-error";

const querySchema = z.object({
  offset: z.coerce.number().int().min(0).max(100000).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireCapability("ai:use", request);
    const parsed = querySchema.safeParse({
      offset: request.nextUrl.searchParams.get("offset") || undefined,
      limit: request.nextUrl.searchParams.get("limit") || undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid research history page." }, { status: 400, headers: privateHeaders });
    }
    const history = await listResearchHistory(user, parsed.data.offset, parsed.data.limit);
    return NextResponse.json(history, { headers: privateHeaders });
  } catch (error) {
    return apiError(error, "Research history could not be loaded.");
  }
}
