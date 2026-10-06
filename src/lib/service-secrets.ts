import "server-only";

import postgres from "postgres";
import { databaseConnectionString } from "@/lib/auth";
import type { ServiceSecretStatus } from "@/lib/types";

export type ServiceSecretName =
  | "ai_mail_openai_api_key"
  | "ai_mail_cloudmersive_api_key"
  | "ai_mail_imap_password"
  | "ai_mail_smtp_password";

let sqlClient: ReturnType<typeof postgres> | undefined;

function database() {
  const url = databaseConnectionString();
  if (!url) throw new Error("AUTH_UNAVAILABLE");
  if (!sqlClient) {
    sqlClient = postgres(url, {
      max: 2,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
      ssl: process.env.DATABASE_SSL === "false" ? false : "require",
    });
  }
  return sqlClient;
}

export async function getServiceSecret(name: ServiceSecretName): Promise<string | null> {
  const sql = database();
  const rows = await sql`
    SELECT decrypted_secret
    FROM vault.decrypted_secrets
    WHERE name = ${name}
    LIMIT 1
  `;
  const value = rows[0]?.decrypted_secret;
  return typeof value === "string" && value.length ? value : null;
}

export async function getServiceSecretStatus(): Promise<ServiceSecretStatus> {
  const sql = database();
  const rows = await sql`
    SELECT name
    FROM vault.secrets
    WHERE name IN (
      'ai_mail_openai_api_key',
      'ai_mail_cloudmersive_api_key',
      'ai_mail_imap_password',
      'ai_mail_smtp_password'
    )
  `;
  const names = new Set(rows.map((row) => String(row.name)));
  return {
    openaiApiKey: names.has("ai_mail_openai_api_key") || Boolean(process.env.OPENAI_API_KEY),
    cloudmersiveApiKey: names.has("ai_mail_cloudmersive_api_key") || Boolean(process.env.CLOUDMERSIVE_API_KEY),
    imapPassword: names.has("ai_mail_imap_password") || Boolean(process.env.IMAP_PASSWORD || process.env.MAIL_PASSWORD),
    smtpPassword: names.has("ai_mail_smtp_password") || Boolean(process.env.SMTP_PASSWORD || process.env.MAIL_PASSWORD),
  };
}

export async function setServiceSecret(
  name: ServiceSecretName,
  value: string,
  description: string,
): Promise<void> {
  if (!value || value.length > 4096) throw new Error("INVALID_SECRET");
  const sql = database();
  const rows = await sql`SELECT id FROM vault.secrets WHERE name = ${name} LIMIT 1`;
  if (rows[0]?.id) {
    await sql`SELECT vault.update_secret(${String(rows[0].id)}::uuid, ${value}, ${name}, ${description})`;
    return;
  }
  await sql`SELECT vault.create_secret(${value}, ${name}, ${description})`;
}
