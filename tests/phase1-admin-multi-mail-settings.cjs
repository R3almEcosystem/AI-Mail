const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const read = (path) => fs.readFileSync(path, "utf8");

test("Admin AI & mail settings use the multi-account mailbox manager", () => {
  const admin = read("src/components/admin-console.tsx");
  const manager = read("src/components/mail-accounts-manager.tsx");
  const css = read("src/app/globals.css");

  assert.match(admin, /MailAccountsManager onAccountsChanged={refreshServiceState}/);
  assert.match(admin, /Global mail policy/);
  assert.match(admin, /At least one active IMAP mailbox can be monitored/);
  assert.match(admin, /At least one connected account can send through SMTP/);
  assert.match(admin, /Save AI & policy/);
  assert.doesNotMatch(admin, /Save & test IMAP/);
  assert.doesNotMatch(admin, /Save & test SMTP/);
  assert.doesNotMatch(admin, /<h3>Incoming mail<\/h3>/);
  assert.doesNotMatch(admin, /<h3>Outgoing mail<\/h3>/);

  assert.match(manager, /onAccountsChanged/);
  assert.match(css, /\.admin-mail-accounts/);
  assert.match(css, /grid-column: 1 \/ -1/);
});

test("saving Admin AI policy refreshes primary mail settings before PATCH", () => {
  const admin = read("src/components/admin-console.tsx");

  assert.match(admin, /if \(section === "services"\)/);
  assert.match(admin, /currentResponse = await fetch\(webPath\("\/api\/admin\/settings"\)/);
  assert.match(admin, /\.\.\.current\.settings/);
  assert.match(admin, /aiModel: settings\.aiModel/);
  assert.match(admin, /aiTone: settings\.aiTone/);
  assert.match(admin, /outboundAllowedDomains: settings\.outboundAllowedDomains/);
  assert.match(admin, /credentials\.openaiApiKey \? \{ openaiApiKey: credentials\.openaiApiKey \} : \{\}/);
});
