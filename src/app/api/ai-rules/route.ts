import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addAudit } from "@/lib/admin-data";
import { listAiRules, setAiRuleActive } from "@/lib/ai-rules";
import { requireCapability } from "@/lib/session";
import { apiError, privateHeaders } from "@/lib/api-error";

const updateSchema = z.object({
  id: z.string().trim().min(1).max(120),
  active: z.boolean(),
});

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireCapability("ai:use");
    const rules = await listAiRules(false);
    return NextResponse.json({
      rules,
      canManage: user.role === "admin" || user.role === "super_admin",
    }, { headers: privateHeaders });
  } catch (error) {
    return apiError(error, "Unable to load AI rules.");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const actor = await requireCapability("admin:manage", request);
    const parsed = updateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid AI rule update." }, { status: 400, headers: privateHeaders });

    const rule = await setAiRuleActive(parsed.data.id, parsed.data.active);
    if (!rule) return NextResponse.json({ error: "AI rule not found." }, { status: 404, headers: privateHeaders });

    await addAudit(actor, parsed.data.active ? "Enabled AI rule" : "Disabled AI rule", rule.title);
    return NextResponse.json({ rule }, { headers: privateHeaders });
  } catch (error) {
    return apiError(error, "Unable to update AI rule.");
  }
}
