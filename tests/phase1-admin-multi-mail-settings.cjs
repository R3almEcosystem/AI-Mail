const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const read = (path) => fs.readFileSync(path, "utf8");

test("Admin separates S.I. settings from Connected mailboxes and mail policy", () => {
  const admin = read("src/components/admin-console.tsx");
  const manager = read("src/components/mail-accounts-manager.tsx");
  const css = read("src/app/globals.css");

  assert.match(admin, /id: "services", label: "S\.I\."/);
  assert.doesNotMatch(admin, /id: "services", label: "AI & mail"/);
  assert.match(admin, /services: \{ eyebrow: "INTELLIGENCE", title: "S\.I\. settings"/);
  assert.doesNotMatch(admin, /title: "AI & mail settings"/);

  assert.match(admin, /id: "mailboxes", label: "Connected mailboxes"/);
  assert.match(admin, /mailboxes: \{ eyebrow: "MAIL INFRASTRUCTURE", title: "Connected mailboxes"/);
  assert.match(admin, /section === "mailboxes" && settings/);
  assert.match(admin, /MailAccountsManager onAccountsChanged={refreshServiceState}/);
  assert.match(admin, /<h3>Global mail policy<\/h3>/);
  assert.match(admin, /<h3>Mailbox readiness<\/h3>/);
  assert.match(admin, /<h3>S\.I\. service readiness<\/h3>/);
  assert.match(admin, /Save mail policy/);
  assert.match(admin, /Global mail policy saved\./);
  assert.match(admin, /managed above/);

  assert.match(admin, /At least one active IMAP mailbox can be monitored/);
  assert.match(admin, /At least one connected account can send through SMTP/);
  assert.match(admin, /Save S\.I\. settings/);
  assert.doesNotMatch(admin, /Save AI & policy/);
  assert.doesNotMatch(admin, /Save & test IMAP/);
  assert.doesNotMatch(admin, /Save & test SMTP/);
  assert.doesNotMatch(admin, /<h3>Incoming mail<\/h3>/);
  assert.doesNotMatch(admin, /<h3>Outgoing mail<\/h3>/);

  assert.match(manager, /onAccountsChanged/);
  assert.match(css, /\.admin-mail-accounts/);
  assert.match(css, /grid-column: 1 \/ -1/);
  assert.match(css, /\.admin-mailboxes-page \.global-mail-policy-card/);
  assert.match(css, /\.admin-mailboxes-page \.mailbox-readiness-card/);
});

test("S.I. and mailbox policy saves preserve settings owned by the other page", () => {
  const admin = read("src/components/admin-console.tsx");

  assert.match(admin, /if \(section === "services"\)/);
  assert.match(admin, /else if \(section === "mailboxes"\)/);
  assert.match(admin, /currentResponse = await fetch\(webPath\("\/api\/admin\/settings"\)/);
  assert.match(admin, /\.\.\.current\.settings/);
  assert.match(admin, /aiModel: settings\.aiModel/);
  assert.match(admin, /aiTone: settings\.aiTone/);
  assert.match(admin, /aiAutoSummarize: settings\.aiAutoSummarize/);
  assert.match(admin, /aiPriorityDetection: settings\.aiPriorityDetection/);
  assert.match(admin, /outboundAllowedDomains: settings\.outboundAllowedDomains/);
  assert.match(admin, /credentials\.openaiApiKey \? \{ openaiApiKey: credentials\.openaiApiKey \} : \{\}/);

  const aiBlock = admin.match(/if \(section === "services"\) \{[\s\S]*?\} else if \(section === "mailboxes"\)/)?.[0] || "";
  assert.doesNotMatch(aiBlock, /outboundAllowedDomains:/);

  const mailboxBlock = admin.match(/else if \(section === "mailboxes"\) \{[\s\S]*?\n    \}/)?.[0] || "";
  assert.match(mailboxBlock, /outboundAllowedDomains: settings\.outboundAllowedDomains/);
  assert.match(mailboxBlock, /suppliedCredentials = \{\}/);
});
