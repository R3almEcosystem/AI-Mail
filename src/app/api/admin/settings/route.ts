import { NextResponse } from "next/server";
import { z } from "zod";
import { databaseConfigured, getSettings, updateSettings } from "@/lib/admin-data";
import { requireCapability } from "@/lib/session";
import { demoLoginEnabled } from "@/lib/auth";
import { apiError, privateHeaders } from "@/lib/api-error";
const settingsSchema = z.object({
  organizationName: z.string().trim().min(2).max(100),
  workspaceName: z.string().trim().min(2).max(120),
  defaultSenderName: z.string().trim().min(2).max(100),
  supportEmail: z.string().trim().email().max(320),
  aiModel: z.string().trim().min(2).max(100),
  aiTone: z.enum(["concise", "balanced", "detailed"]),
  aiAutoSummarize: z.boolean(), aiPriorityDetection: z.boolean(), requireMfa: z.boolean(),
  sessionTimeoutMinutes: z.number().int().min(15).max(10080), allowDemoLogin: z.boolean(),
});
export async function GET() {
  try {
    await requireCapability("admin:manage");
    return NextResponse.json({ settings: await getSettings(), demo: !databaseConfigured() }, { headers: privateHeaders });
  } catch (error) { return apiError(error, "Unable to load workspace settings."); }
}
export async function PATCH(request: Request) {
  try {
    const actor = await requireCapability("admin:manage", request);
    const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Review the settings and try again." }, { status: 400 });
    // Prevent a nonfunctional checkbox from locking out every direct user.
    if (parsed.data.requireMfa) return NextResponse.json({ error: "MFA enrollment, challenge, and recovery must be implemented before this policy can be enabled.", code: "MFA_NOT_AVAILABLE" }, { status: 409 });
    if (parsed.data.allowDemoLogin && !demoLoginEnabled()) return NextResponse.json({ error: "Demo login is available only in an explicitly isolated nonproduction environment.", code: "DEMO_NOT_ISOLATED" }, { status: 409 });
    const settings = await updateSettings(parsed.data, actor);
    return NextResponse.json({ settings, demo: !databaseConfigured() }, { headers: privateHeaders });
  } catch (error) { return apiError(error, "Unable to save workspace settings."); }
}
