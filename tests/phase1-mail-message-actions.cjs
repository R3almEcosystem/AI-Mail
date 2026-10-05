const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

function read(path) {
  return fs.readFileSync(path, "utf8");
}

test("mail detail actions persist read, flag and tag state through the authenticated API", () => {
  const route = read("src/app/api/mail/[uid]/route.ts");
  const gateway = read("src/mail/client.ts");
  const mail = read("src/lib/mail.ts");
  const policy = read("src/mail/policy.ts");

  assert.ok(route.includes('"tag", "untag"'));
  assert.ok(route.includes('z.enum(["follow-up", "waiting", "finance", "legal", "technology", "personal"])'));
  assert.ok(route.includes('requireCapability("mail:write"'));
  assert.ok(gateway.includes("messageFlagsAdd"));
  assert.ok(gateway.includes("messageFlagsRemove"));
  assert.ok(gateway.includes("mailTagFlag(tag!)"));
  assert.ok(gateway.includes("flags: updated.flags"));
  assert.ok(mail.includes("mailTagsFromFlags(message.flags)"));
  assert.ok(policy.includes("R3almFollowUp"));
});

test("Inbox and Sent detail icons update UI state and expose functional menus", () => {
  const workspace = read("src/components/inbox-workspace.tsx");
  const dashboard = read("src/components/mail-dashboard.tsx");
  const css = read("src/app/globals.css");

  assert.ok(workspace.includes('aria-label={selected.flagged ? "Unflag message" : "Flag message"}'));
  assert.ok(workspace.includes('"Manage message tags"'));
  assert.ok(workspace.includes('aria-label="More message actions"'));
  assert.ok(workspace.includes('aria-label={detailsOpen ? "Hide message details" : "Show message details"}'));
  assert.ok(workspace.includes('(["all", "unread", "flagged"] as const)'));
  assert.ok(workspace.includes('onAction(active ? "untag" : "tag", option.id)'));
  assert.ok(dashboard.includes("mailTagsFromFlags(canonicalFlags)"));
  assert.ok(dashboard.includes('action === "unread"'));
  assert.ok(css.includes(".message-popover"));
  assert.ok(css.includes(".message-details-card"));
});


test("message toolbar states use distinct shapes and colors", () => {
  const workspace = read("src/components/inbox-workspace.tsx");
  const css = read("src/app/globals.css");

  assert.ok(workspace.includes('selected.unread ? <Mail size={17}'));
  assert.ok(workspace.includes(': <MailOpen size={17}'));
  assert.ok(workspace.includes('fill={selected.flagged ? "currentColor" : "none"}'));
  assert.ok(workspace.includes('"message-status-button--flagged"'));
  assert.ok(workspace.includes('"message-status-button--tagged"'));
  assert.ok(css.includes(".message-status-button--unread"));
  assert.ok(css.includes(".message-status-button--read"));
  assert.ok(css.includes(".message-status-button--flagged"));
  assert.ok(css.includes(".message-status-button--tagged"));
});


test("HTML-only email bodies use a sandboxed secure tab", () => {
  const workspace = read("src/components/inbox-workspace.tsx");
  const client = read("src/mail/client.ts");
  const mail = read("src/lib/mail.ts");
  const css = read("src/app/globals.css");

  assert.ok(client.includes("function buildSafeEmailHtml"));
  assert.ok(client.includes("default-src 'none'"));
  assert.ok(client.includes("img-src data:"));
  assert.ok(client.includes("form-action 'none'"));
  assert.ok(mail.includes("hasPlainTextBody"));
  assert.ok(mail.includes("safeHtmlBody"));
  assert.ok(workspace.includes("selectedHasSecureHtmlFallback"));
  assert.ok(workspace.includes(">Secure HTML<") || workspace.includes("Secure HTML"));
  assert.ok(workspace.includes('sandbox=""'));
  assert.ok(workspace.includes('referrerPolicy="no-referrer"'));
  assert.ok(workspace.includes("srcDoc={selected.safeHtmlBody}"));
  assert.ok(css.includes(".secure-html-frame"));
});


test("message actions remain below body format tabs", () => {
  const workspace = read("src/components/inbox-workspace.tsx");
  const css = read("src/app/globals.css");

  const bodyRegionIndex = workspace.indexOf('className="message-body-region"');
  const actionsIndex = workspace.indexOf('className="message-actions"');
  assert.ok(bodyRegionIndex >= 0);
  assert.ok(actionsIndex > bodyRegionIndex);
  assert.ok(css.includes(".message-panel { display: flex; flex-direction: column; overflow: hidden;"));
  assert.ok(css.includes(".message-body-region {"));
  assert.ok(css.includes("overflow: hidden;"));
  assert.ok(css.includes(".message-actions {"));
  assert.ok(css.includes("flex: 0 0 auto;"));
  assert.ok(css.includes("border-top: 1px solid var(--line);"));
  assert.ok(css.includes(".secure-html-frame"));
  assert.ok(css.includes("min-height: 0;"));
});
