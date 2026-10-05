import "server-only";

import postgres from "postgres";
import { databaseConnectionString } from "@/lib/auth";
import { getSettings } from "@/lib/admin-data";
import { getServiceSecret } from "@/lib/service-secrets";
import type { MailAccountSummary, SessionUser } from "@/lib/types";

type SqlClient = ReturnType<typeof postgres>;

let client: SqlClient | null = null;

function database() {
  const url = databaseConnectionString();
  if (!url) throw new Error("AUTH_UNAVAILABLE");
  if (!client) {
    client = postgres(url, {
      max: 3,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
      ssl: process.env.DATABASE_SSL === "false" ? false : "require",
    });
  }
  return client;
}

export const PRIMARY_MAIL_ACCOUNT_ID = "primary";

export type MailAccountInput = {
  label: string;
  email: string;
  active?: boolean;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  imapUser: string;
  imapPassword: string;
  sentFolder: string;
  archiveFolder: string;
  smtpEnabled: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpFrom?: string;
  smtpPassword?: string;
};

export type MailAccountUpdateInput = Omit<MailAccountInput, "imapPassword"> & {
  active: boolean;
  imapPassword?: string;
};

export type MailAccountRuntime = MailAccountSummary & {
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  imapUser: string;
  imapPassword: string;
  sentFolder: string;
  archiveFolder: string;
  smtpEnabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpFrom: string;
  smtpPassword: string;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function text(value: unknown) {
  return value == null ? "" : String(value);
}

async function primaryRuntime(): Promise<MailAccountRuntime> {
  const [settings, imapVaultPassword, smtpVaultPassword] = await Promise.all([
    getSettings(),
    getServiceSecret("ai_mail_imap_password"),
    getServiceSecret("ai_mail_smtp_password"),
  ]);
  const imapPassword = imapVaultPassword || process.env.IMAP_PASSWORD || process.env.MAIL_PASSWORD || "";
  const smtpPassword = smtpVaultPassword || process.env.SMTP_PASSWORD || process.env.MAIL_PASSWORD || imapPassword;
  return {
    id: PRIMARY_MAIL_ACCOUNT_ID,
    label: "Primary mailbox",
    email: settings.imapUser,
    primary: true,
    active: true,
    imapReady: Boolean(settings.imapHost && settings.imapUser && imapPassword),
    smtpReady: Boolean(settings.smtpHost && settings.smtpUser && settings.smtpFrom && smtpPassword),
    imapHost: settings.imapHost,
    imapPort: settings.imapPort,
    imapSecure: settings.imapSecure,
    imapUser: settings.imapUser,
    imapPassword,
    sentFolder: "INBOX.Sent",
    archiveFolder: settings.mailArchiveFolder,
    smtpEnabled: true,
    smtpHost: settings.smtpHost,
    smtpPort: settings.smtpPort,
    smtpSecure: settings.smtpSecure,
    smtpUser: settings.smtpUser,
    smtpFrom: settings.smtpFrom,
    smtpPassword,
  };
}

function mapSummary(row: Record<string, unknown>): MailAccountSummary {
  const smtpEnabled = Boolean(row.smtp_enabled);
  return {
    id: String(row.id),
    label: String(row.label),
    email: String(row.email),
    primary: false,
    active: Boolean(row.active),
    imapReady: Boolean(row.imap_secret_present),
    smtpReady: smtpEnabled && Boolean(row.smtp_secret_present),
  };
}

export async function listMailAccounts(includeInactive = true): Promise<MailAccountSummary[]> {
  const primary = await primaryRuntime();
  const sql = database();
  const rows = await sql`
    SELECT a.id, a.label, a.email, a.active, a.sort_order, a.smtp_enabled,
           (vi.id IS NOT NULL) AS imap_secret_present,
           (vs.id IS NOT NULL) AS smtp_secret_present
    FROM private.ai_mail_accounts a
    LEFT JOIN vault.secrets vi ON vi.name = a.imap_secret_name
    LEFT JOIN vault.secrets vs ON vs.name = a.smtp_secret_name
    WHERE ${includeInactive} OR a.active = true
    ORDER BY a.active DESC, a.sort_order ASC, a.created_at ASC
  `;
  return [primary, ...rows.map((row) => mapSummary(row))];
}

export async function listActiveMailAccounts(): Promise<MailAccountSummary[]> {
  return (await listMailAccounts(false)).filter((account) => account.active && account.imapReady);
}

export async function resolveMailAccount(accountId = PRIMARY_MAIL_ACCOUNT_ID, allowInactive = false): Promise<MailAccountRuntime> {
  if (!accountId || accountId === PRIMARY_MAIL_ACCOUNT_ID) return primaryRuntime();
  if (!isUuid(accountId)) throw new Error("MAIL_ACCOUNT_NOT_FOUND");

  const sql = database();
  const rows = await sql`
    SELECT a.*,
           vi.decrypted_secret AS imap_password,
           vs.decrypted_secret AS smtp_password
    FROM private.ai_mail_accounts a
    LEFT JOIN vault.decrypted_secrets vi ON vi.name = a.imap_secret_name
    LEFT JOIN vault.decrypted_secrets vs ON vs.name = a.smtp_secret_name
    WHERE a.id = ${accountId}::uuid
    LIMIT 1
  `;
  const row = rows[0];
  if (!row || (!allowInactive && !row.active)) throw new Error("MAIL_ACCOUNT_NOT_FOUND");

  const smtpEnabled = Boolean(row.smtp_enabled);
  const imapPassword = text(row.imap_password);
  const smtpPassword = text(row.smtp_password);
  return {
    id: String(row.id),
    label: String(row.label),
    email: String(row.email),
    primary: false,
    active: Boolean(row.active),
    imapReady: Boolean(row.imap_host && row.imap_user && imapPassword),
    smtpReady: smtpEnabled && Boolean(row.smtp_host && row.smtp_user && row.smtp_from && smtpPassword),
    imapHost: String(row.imap_host),
    imapPort: Number(row.imap_port),
    imapSecure: Boolean(row.imap_secure),
    imapUser: String(row.imap_user),
    imapPassword,
    sentFolder: String(row.sent_folder || "INBOX.Sent"),
    archiveFolder: String(row.archive_folder || "Archive"),
    smtpEnabled,
    smtpHost: text(row.smtp_host),
    smtpPort: Number(row.smtp_port || 465),
    smtpSecure: row.smtp_secure !== false,
    smtpUser: text(row.smtp_user),
    smtpFrom: text(row.smtp_from),
    smtpPassword,
  };
}

export async function createMailAccount(input: MailAccountInput, actor: SessionUser): Promise<MailAccountSummary> {
  const sql = database();
  const id = crypto.randomUUID();
  const imapSecretName = `ai_mail_account_${id}_imap_password`;
  const smtpSecretName = input.smtpEnabled ? `ai_mail_account_${id}_smtp_password` : null;
  const smtpPassword = input.smtpEnabled ? (input.smtpPassword || input.imapPassword) : "";

  await sql.begin(async (tx) => {
    await tx`SELECT vault.create_secret(${input.imapPassword}, ${imapSecretName}, ${"AI-Mail IMAP password for " + input.email})`;
    if (smtpSecretName) {
      await tx`SELECT vault.create_secret(${smtpPassword}, ${smtpSecretName}, ${"AI-Mail SMTP password for " + input.email})`;
    }
    await tx`
      INSERT INTO private.ai_mail_accounts (
        id, label, email, active,
        imap_host, imap_port, imap_secure, imap_user, imap_secret_name,
        sent_folder, archive_folder,
        smtp_enabled, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_from, smtp_secret_name,
        created_by
      ) VALUES (
        ${id}::uuid, ${input.label}, ${input.email.toLowerCase()}, ${input.active !== false},
        ${input.imapHost}, ${input.imapPort}, ${input.imapSecure}, ${input.imapUser}, ${imapSecretName},
        ${input.sentFolder}, ${input.archiveFolder},
        ${input.smtpEnabled}, ${input.smtpEnabled ? input.smtpHost || null : null},
        ${input.smtpEnabled ? input.smtpPort || 465 : null}, ${input.smtpSecure !== false},
        ${input.smtpEnabled ? input.smtpUser || null : null}, ${input.smtpEnabled ? input.smtpFrom || null : null},
        ${smtpSecretName}, ${actor.id}
      )
    `;
  });

  const account = await resolveMailAccount(id, true);
  return {
    id: account.id,
    label: account.label,
    email: account.email,
    primary: false,
    active: account.active,
    imapReady: account.imapReady,
    smtpReady: account.smtpReady,
  };
}

export async function updateMailAccount(accountId: string, input: MailAccountUpdateInput): Promise<MailAccountSummary> {
  if (accountId === PRIMARY_MAIL_ACCOUNT_ID || !isUuid(accountId)) throw new Error("MAIL_ACCOUNT_NOT_FOUND");
  const current = await resolveMailAccount(accountId, true);
  const sql = database();

  const rows = await sql`
    SELECT imap_secret_name, smtp_secret_name
    FROM private.ai_mail_accounts
    WHERE id = ${accountId}::uuid
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) throw new Error("MAIL_ACCOUNT_NOT_FOUND");
  const imapSecretName = String(row.imap_secret_name);
  let smtpSecretName = row.smtp_secret_name ? String(row.smtp_secret_name) : null;

  await sql.begin(async (tx) => {
    if (input.imapPassword) {
      const secret = await tx`SELECT id FROM vault.secrets WHERE name = ${imapSecretName} LIMIT 1`;
      if (secret[0]?.id) {
        await tx`SELECT vault.update_secret(${String(secret[0].id)}::uuid, ${input.imapPassword}, ${imapSecretName}, ${"AI-Mail IMAP password for " + input.email})`;
      } else {
        await tx`SELECT vault.create_secret(${input.imapPassword}, ${imapSecretName}, ${"AI-Mail IMAP password for " + input.email})`;
      }
    }

    if (input.smtpEnabled) {
      if (!smtpSecretName) smtpSecretName = `ai_mail_account_${accountId}_smtp_password`;
      const smtpPassword = input.smtpPassword || (!current.smtpPassword ? input.imapPassword || "" : "");
      if (input.smtpPassword || (!current.smtpPassword && smtpPassword)) {
        const secret = await tx`SELECT id FROM vault.secrets WHERE name = ${smtpSecretName} LIMIT 1`;
        const value = input.smtpPassword || smtpPassword;
        if (secret[0]?.id) {
          await tx`SELECT vault.update_secret(${String(secret[0].id)}::uuid, ${value}, ${smtpSecretName}, ${"AI-Mail SMTP password for " + input.email})`;
        } else {
          await tx`SELECT vault.create_secret(${value}, ${smtpSecretName}, ${"AI-Mail SMTP password for " + input.email})`;
        }
      }
      if (!current.smtpPassword && !input.smtpPassword && !input.imapPassword) throw new Error("SMTP_PASSWORD_REQUIRED");
    }

    await tx`
      UPDATE private.ai_mail_accounts SET
        label = ${input.label},
        email = ${input.email.toLowerCase()},
        active = ${input.active},
        imap_host = ${input.imapHost},
        imap_port = ${input.imapPort},
        imap_secure = ${input.imapSecure},
        imap_user = ${input.imapUser},
        sent_folder = ${input.sentFolder},
        archive_folder = ${input.archiveFolder},
        smtp_enabled = ${input.smtpEnabled},
        smtp_host = ${input.smtpEnabled ? input.smtpHost || null : null},
        smtp_port = ${input.smtpEnabled ? input.smtpPort || 465 : null},
        smtp_secure = ${input.smtpSecure !== false},
        smtp_user = ${input.smtpEnabled ? input.smtpUser || null : null},
        smtp_from = ${input.smtpEnabled ? input.smtpFrom || null : null},
        smtp_secret_name = ${input.smtpEnabled ? smtpSecretName : null},
        updated_at = now()
      WHERE id = ${accountId}::uuid
    `;
  });

  const account = await resolveMailAccount(accountId, true);
  return {
    id: account.id,
    label: account.label,
    email: account.email,
    primary: false,
    active: account.active,
    imapReady: account.imapReady,
    smtpReady: account.smtpReady,
  };
}

export async function deleteMailAccount(accountId: string): Promise<void> {
  if (accountId === PRIMARY_MAIL_ACCOUNT_ID || !isUuid(accountId)) throw new Error("MAIL_ACCOUNT_NOT_FOUND");
  const sql = database();
  const rows = await sql`
    SELECT imap_secret_name, smtp_secret_name
    FROM private.ai_mail_accounts
    WHERE id = ${accountId}::uuid
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) throw new Error("MAIL_ACCOUNT_NOT_FOUND");
  const imapName = String(row.imap_secret_name);
  const smtpName = row.smtp_secret_name ? String(row.smtp_secret_name) : null;

  await sql.begin(async (tx) => {
    await tx`DELETE FROM private.ai_mail_accounts WHERE id = ${accountId}::uuid`;
    await tx`DELETE FROM vault.secrets WHERE name = ${imapName}`;
    if (smtpName) await tx`DELETE FROM vault.secrets WHERE name = ${smtpName}`;
  });
}
