import { NextResponse } from "next/server";
import { z } from "zod";
import { addAudit, databaseConfigured, getSettings, updateSettings } from "@/lib/admin-data";
import { requireCapability } from "@/lib/session";
import { demoLoginEnabled } from "@/lib/auth";
import { getServiceSecretStatus, setServiceSecret } from "@/lib/service-secrets";
import { apiError, privateHeaders } from "@/lib/api-error";

const credentialsSchema = z.object({
  openaiApiKey: z.string().min(20).max(4096).optional(),
  imapPassword: z.string().min(1).max(4096).optional(),
  smtpPassword: z.string().min(1).max(4096).optional(),
}).optional();

const settingsSchema = z.object({
  organizationName: z.string().trim().min(2).max(100),
  workspaceName: z.string().trim().min(2).max(120),
  defaultSenderName: z.string().trim().min(2).max(100),
  supportEmail: z.string().trim().email().max(320),
  aiModel: z.string().trim().min(2).max(100),
  aiTone: z.enum(["concise", "balanced", "detailed"]),
  aiAutoSummarize: z.boolean(),
  aiPriorityDetection: z.boolean(),
  imapHost: z.string().trim().min(1).max(255),
  imapPort: z.number().int().min(1).max(65535),
  imapSecure: z.boolean(),
  imapUser: z.string().trim().min(1).max(320),
  smtpHost: z.string().trim().min(1).max(255),
  smtpPort: z.number().int().min(1).max(65535),
  smtpSecure: z.boolean(),
  smtpUser: z.string().trim().min(1).max(320),
  smtpFrom: z.string().trim().min(1).max(320),
  mailArchiveFolder: z.string().trim().min(1).max(255).refine((value) => !/[\u0000-\u001f\u007f]/u.test(value), "Invalid archive folder"),
  outboundAllowedDomains: z.string().max(4000).refine((value) => value.split(",").every((entry) => !entry.trim() || /^[a-z0-9.-]+$/i.test(entry.trim())), "Invalid recipient domain list"),
  requireMfa: z.boolean(),
  sessionTimeoutMinutes: z.number().int().min(15).max(10080),
  allowDemoLogin: z.boolean(),
  credentials: credentialsSchema,
});

export async function GET() {
  try {
    await requireCapability("admin:manage");
    const [settings, secrets] = await Promise.all([getSettings(), getServiceSecretStatus()]);
    return NextResponse.json({ settings, secrets, demo: !databaseConfigured() }, { headers: privateHeaders });
  } catch (error) {
    return apiError(error, "Unable to load workspace settings.");
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireCapability("admin:manage", request);
    const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Review the settings and try again." }, { status: 400 });

    if (parsed.data.requireMfa) {
      return NextResponse.json({ error: "MFA enrollment, challenge, and recovery must be implemented before this policy can be enabled.", code: "MFA_NOT_AVAILABLE" }, { status: 409 });
    }
    if (parsed.data.allowDemoLogin && !demoLoginEnabled()) {
      return NextResponse.json({ error: "Demo login is available only in an explicitly isolated nonproduction environment.", code: "DEMO_NOT_ISOLATED" }, { status: 409 });
    }

    const { credentials, ...settingsInput } = parsed.data;
    const settings = await updateSettings(settingsInput, actor);
    const changedSecrets: string[] = [];

    if (credentials?.openaiApiKey) {
      await setServiceSecret("ai_mail_openai_api_key", credentials.openaiApiKey, "AI-Mail OpenAI API key");
      changedSecrets.push("OpenAI API key");
    }
    if (credentials?.imapPassword) {
      await setServiceSecret("ai_mail_imap_password", credentials.imapPassword, "AI-Mail IMAP password");
      changedSecrets.push("IMAP password");
    }
    if (credentials?.smtpPassword) {
      await setServiceSecret("ai_mail_smtp_password", credentials.smtpPassword, "AI-Mail SMTP password");
      changedSecrets.push("SMTP password");
    }
    if (changedSecrets.length) {
      await addAudit(actor, "Updated private service credentials", changedSecrets.join(", "));
    }

    return NextResponse.json(
      { settings, secrets: await getServiceSecretStatus(), demo: !databaseConfigured() },
      { headers: privateHeaders },
    );
  } catch (error) {
    return apiError(error, "Unable to save workspace settings.");
  }
}
