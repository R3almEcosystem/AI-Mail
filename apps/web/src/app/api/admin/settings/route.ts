import { NextResponse } from "next/server";
import { z } from "zod";
import { databaseConfigured, getSettings, updateSettings } from "@/lib/admin-data";
import { requireAdminUser } from "@/lib/session";

const settingsSchema = z.object({
  organizationName: z.string().trim().min(2).max(100),
  workspaceName: z.string().trim().min(2).max(120),
  defaultSenderName: z.string().trim().min(2).max(100),
  supportEmail: z.string().trim().email().max(320),
  aiModel: z.string().trim().min(2).max(100),
  aiTone: z.enum(["concise", "balanced", "detailed"]),
  aiAutoSummarize: z.boolean(),
  aiPriorityDetection: z.boolean(),
  requireMfa: z.boolean(),
  sessionTimeoutMinutes: z.number().int().min(15).max(10_080),
  allowDemoLogin: z.boolean(),
});

export async function GET() {
  try {
    await requireAdminUser();
    return NextResponse.json({ settings: await getSettings(), demo: !databaseConfigured() });
  } catch (error) {
    const status = error instanceof Error && error.message === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json({ error: status === 403 ? "Administrator access required." : "Authentication required." }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireAdminUser();
    const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Review the settings and try again." }, { status: 400 });
    const settings = await updateSettings(parsed.data, actor);
    return NextResponse.json({ settings, demo: !databaseConfigured() });
  } catch (error) {
    const status = error instanceof Error && error.message === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json({ error: status === 403 ? "Administrator access required." : "Authentication required." }, { status });
  }
}
