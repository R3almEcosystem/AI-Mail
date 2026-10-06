const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const read = (path) => fs.readFileSync(path, "utf8");

test("multi-account credentials are stored in private registry and Supabase Vault", () => {
  const migration = read("supabase/migrations/20261005164500_ai_mail_accounts.sql");
  const accounts = read("src/lib/mail-accounts.ts");
  assert.match(migration, /private\.ai_mail_accounts/);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on table private\.ai_mail_accounts from anon/i);
  assert.match(accounts, /vault\.create_secret/);
  assert.match(accounts, /vault\.decrypted_secrets/);
  assert.match(accounts, /PRIMARY_MAIL_ACCOUNT_ID = "primary"/);
  assert.doesNotMatch(accounts, /imapPassword:\s*row\./);
});

test("mailbox APIs support all accounts and individual account IDs", () => {
  const mailRoute = read("src/app/api/mail/route.ts");
  const messageRoute = read("src/app/api/mail/[uid]/route.ts");
  const sendRoute = read("src/app/api/mail/send/route.ts");
  const mail = read("src/lib/mail.ts");
  assert.match(mailRoute, /accountId/);
  assert.match(mailRoute, /cursor/);
  assert.match(messageRoute, /accountId/);
  assert.match(sendRoute, /accountId/);
  assert.match(mail, /accountId === "all"/);
  assert.match(mail, /listAllAccounts/);
  assert.match(mail, /const concurrency = 4/);
});

test("S.I. Mail Research can search all accounts or one account", () => {
  const route = read("src/app/api/ai/research/route.ts");
  const research = read("src/lib/mail-research.ts");
  const ui = read("src/components/mail-research-modal.tsx");
  assert.match(route, /z\.literal\("all"\)/);
  assert.match(route, /runForAllAccounts/);
  assert.match(route, /Account Coverage/);
  assert.match(research, /runMailResearch\(query: string, selectedScope: MailResearchScope, accountId = "primary", context: AiTelemetryContext = \{\}\)/);
  assert.match(route, /actorId: user\.id/);
  assert.match(route, /actorName: user\.name/);
  assert.match(ui, /All accounts/);
  assert.match(ui, /accountId/);
});

test("Inbox Sent and Compose expose mailbox identity selection", () => {
  const dashboard = read("src/components/mail-dashboard.tsx");
  const inbox = read("src/components/inbox-workspace.tsx");
  const compose = read("src/components/compose-modal.tsx");
  const manager = read("src/components/mail-accounts-manager.tsx");
  assert.match(dashboard, /activeAccountId/);
  assert.match(dashboard, /nextCursor/);
  assert.match(inbox, /Select mail account/);
  assert.match(inbox, /mail-item-account/);
  assert.match(compose, />From<\/span><select/);
  assert.match(compose, /accountId/);
  assert.match(manager, /Add mail account/);
  assert.match(manager, /Test IMAP/);
  assert.match(manager, /Test SMTP/);
});


test("connected mailbox cards expose edit controls without returning stored passwords", () => {
  const manager = read("src/components/mail-accounts-manager.tsx");
  const route = read("src/app/api/mail-accounts/[id]/route.ts");
  const accounts = read("src/lib/mail-accounts.ts");

  assert.match(manager, /openEdit\(account\)/);
  assert.match(manager, /> Edit<\/button>/);
  assert.match(manager, /Save changes/);
  assert.match(manager, /Leave blank to keep current password/);
  assert.match(manager, /Monitor this account/);
  assert.match(route, /export async function GET/);
  assert.match(route, /requireCapability\("admin:manage"\)/);
  assert.match(route, /id === "primary"/);
  assert.match(route, /setServiceSecret\("ai_mail_imap_password"/);
  assert.match(accounts, /export type MailAccountDetails/);
  assert.match(accounts, /getMailAccountDetails/);
  assert.doesNotMatch(accounts, /MailAccountDetails[^}]*imapPassword/s);
  assert.doesNotMatch(accounts, /MailAccountDetails[^}]*smtpPassword/s);
});
