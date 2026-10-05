import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addAudit } from "@/lib/admin-data";
import { listAiRules, setAiRuleActive, updateAiRule } from "@/lib/ai-rules";
import { requireCapability } from "@/lib/session";
import { apiError, privateHeaders } from "@/lib/api-error";

const term = z.string().trim().min(1).max(240);
const terms = z.array(term).max(50);
const actionSchema = z.object({
  autoSummary: z.boolean().optional(),
  suggestReply: z.boolean().optional(),
  extractActions: z.boolean().optional(),
  extractDeadline: z.boolean().optional(),
  escalate: z.boolean().optional(),
  sentiment: z.boolean().optional(),
  compress: z.boolean().optional(),
  sensitive: z.boolean().optional(),
}).strict();

const toggleSchema = z.object({
  id: z.string().trim().min(1).max(120),
  active: z.boolean(),
}).strict();

const editSchema = z.object({
  id: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500),
  category: z.string().trim().min(1).max(80),
  priority: z.enum(["urgent", "important", "normal", "low"]),
  senderDomains: terms,
  senderAddresses: z.array(z.email().max(320)).max(50),
  recipientTerms: terms,
  subjectTerms: terms,
  bodyTerms: terms,
  subjectPrefixes: terms,
  requireReply: z.boolean(),
  direction: z.enum(["inbound", "outbound", "both"]),
  actions: actionSchema,
  active: z.boolean(),
}).strict();

const updateSchema = z.union([editSchema, toggleSchema]);

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

    const fullEdit = "title" in parsed.data;
    const rule = fullEdit
      ? await updateAiRule(parsed.data.id, parsed.data)
      : await setAiRuleActive(parsed.data.id, parsed.data.active);
    if (!rule) return NextResponse.json({ error: "AI rule not found." }, { status: 404, headers: privateHeaders });

    await addAudit(
      actor,
      fullEdit ? "Updated AI rule" : parsed.data.active ? "Enabled AI rule" : "Disabled AI rule",
      rule.title,
    );
    return NextResponse.json({ rule }, { headers: privateHeaders });
  } catch (error) {
    return apiError(error, "Unable to update AI rule.");
  }
}
