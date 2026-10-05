import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addAudit, getSettings, updateSettings } from "@/lib/admin-data";
import { deleteMailAccount, getMailAccountDetails, updateMailAccount } from "@/lib/mail-accounts";
import { requireCapability } from "@/lib/session";
import { setServiceSecret } from "@/lib/service-secrets";
import { apiError, privateHeaders } from "@/lib/api-error";

const folder = z.string().trim().min(1).max(255).refine((value) => !/[\u0000-\u001f\u007f]/u.test(value), "Invalid mailbox folder");
const host = z.string().trim().min(1).max(255).regex(/^[a-z0-9.-]+$/i, "Invalid mail host");

const updateSchema = z.object({
  label: z.string().trim().min(1).max(120),
  email: z.email().max(320),
  active: z.boolean(),
  imapHost: host,
  imapPort: z.number().int().min(1).max(65535),
  imapSecure: z.boolean(),
  imapUser: z.string().trim().min(1).max(320),
  imapPassword: z.string().max(4096).optional(),
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

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    await requireCapability("admin:manage");
    const id = (await context.params).id;
    const account = await getMailAccountDetails(id);
    return NextResponse.json({ account }, { headers: privateHeaders });
  } catch (error) {
    if (error instanceof Error && error.message === "MAIL_ACCOUNT_NOT_FOUND") return NextResponse.json({ error: "Mail account not found." }, { status: 404, headers: privateHeaders });
    return apiError(error, "Unable to load the mail account.");
  }
}


export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireCapability("admin:manage", request);
    const id = (await context.params).id;
    const parsed = updateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Review the mail account settings and try again." }, { status: 400, headers: privateHeaders });

    if (id === "primary") {
      const current = await getSettings();
      const settings = await updateSettings({
        ...current,
        imapHost: parsed.data.imapHost,
        imapPort: parsed.data.imapPort,
        imapSecure: parsed.data.imapSecure,
        imapUser: parsed.data.imapUser,
        smtpHost: parsed.data.smtpHost || current.smtpHost,
        smtpPort: parsed.data.smtpPort || current.smtpPort,
        smtpSecure: parsed.data.smtpSecure !== false,
        smtpUser: parsed.data.smtpUser || current.smtpUser,
        smtpFrom: parsed.data.smtpFrom || current.smtpFrom,
        mailArchiveFolder: parsed.data.archiveFolder,
      }, actor);
      if (parsed.data.imapPassword) {
        await setServiceSecret("ai_mail_imap_password", parsed.data.imapPassword, "AI-Mail primary IMAP password");
      }
      if (parsed.data.smtpPassword) {
        await setServiceSecret("ai_mail_smtp_password", parsed.data.smtpPassword, "AI-Mail primary SMTP password");
      }
      const account = await getMailAccountDetails("primary");
      await addAudit(actor, "Updated primary mail account", settings.imapUser);
      return NextResponse.json({ account }, { headers: privateHeaders });
    }

    const account = await updateMailAccount(id, parsed.data);
    await addAudit(actor, "Updated mail account", account.email);
    return NextResponse.json({ account }, { headers: privateHeaders });
  } catch (error) {
    if (error instanceof Error && error.message === "MAIL_ACCOUNT_NOT_FOUND") return NextResponse.json({ error: "Mail account not found." }, { status: 404, headers: privateHeaders });
    if (error instanceof Error && error.message === "SMTP_PASSWORD_REQUIRED") return NextResponse.json({ error: "An SMTP password is required when outgoing mail is enabled." }, { status: 400, headers: privateHeaders });
    return apiError(error, "Unable to update the mail account.");
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireCapability("admin:manage", request);
    const id = (await context.params).id;
    if (id === "primary") return NextResponse.json({ error: "The primary mailbox is managed in System Settings and cannot be removed here." }, { status: 409, headers: privateHeaders });
    await deleteMailAccount(id);
    await addAudit(actor, "Removed mail account", id);
    return NextResponse.json({ ok: true }, { headers: privateHeaders });
  } catch (error) {
    if (error instanceof Error && error.message === "MAIL_ACCOUNT_NOT_FOUND") return NextResponse.json({ error: "Mail account not found." }, { status: 404, headers: privateHeaders });
    return apiError(error, "Unable to remove the mail account.");
  }
}
