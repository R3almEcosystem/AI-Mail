import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addAudit } from "@/lib/admin-data";
import { can } from "@/lib/auth-policy";
import { createMailAccount, listMailAccounts } from "@/lib/mail-accounts";
import { requireCapability } from "@/lib/session";
import { apiError, privateHeaders } from "@/lib/api-error";

const folder = z.string().trim().min(1).max(255).refine((value) => !/[\u0000-\u001f\u007f]/u.test(value), "Invalid mailbox folder");
const host = z.string().trim().min(1).max(255).regex(/^[a-z0-9.-]+$/i, "Invalid mail host");

const accountSchema = z.object({
  label: z.string().trim().min(1).max(120),
  email: z.email().max(320),
  active: z.boolean().optional().default(true),
  imapHost: host,
  imapPort: z.number().int().min(1).max(65535),
  imapSecure: z.boolean(),
  imapUser: z.string().trim().min(1).max(320),
  imapPassword: z.string().min(1).max(4096),
  sentFolder: folder,
  archiveFolder: folder,
  smtpEnabled: z.boolean(),
  smtpHost: host.optional(),
  smtpPort: z.number().int().min(1).max(65535).optional(),
  smtpSecure: z.boolean().optional().default(true),
  smtpUser: z.string().trim().min(1).max(320).optional(),
  smtpFrom: z.union([z.email().max(320), z.literal("")]).optional(),
  smtpPassword: z.string().max(4096).optional(),
}).superRefine((value, ctx) => {
  if (!value.smtpEnabled) return;
  for (const key of ["smtpHost", "smtpPort", "smtpUser", "smtpFrom"] as const) {
    if (!value[key]) ctx.addIssue({ code: "custom", path: [key], message: "SMTP configuration is required when outgoing mail is enabled." });
  }
});

export async function GET() {
  try {
    const user = await requireCapability("mail:read");
    return NextResponse.json({
      accounts: await listMailAccounts(true),
      canManage: can(user.role, "admin:manage"),
    }, { headers: privateHeaders });
  } catch (error) {
    return apiError(error, "Unable to load mail accounts.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireCapability("admin:manage", request);
    const parsed = accountSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Review the mail account settings and try again." }, { status: 400, headers: privateHeaders });
    const accounts = await listMailAccounts(true);
    if (accounts.filter((account) => !account.primary).length >= 20) {
      return NextResponse.json({ error: "AI-Mail currently supports up to 20 additional mail accounts." }, { status: 409, headers: privateHeaders });
    }
    const account = await createMailAccount(parsed.data, actor);
    await addAudit(actor, "Added mail account", account.email);
    return NextResponse.json({ account }, { status: 201, headers: privateHeaders });
  } catch (error) {
    return apiError(error, "Unable to add the mail account.");
  }
}
