const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const read = (path) => fs.readFileSync(path, "utf8");

test("Admin S.I. Rules provide a complete editor", () => {
  const ui = read("src/components/settings-views.tsx");
  const admin = read("src/components/admin-console.tsx");
  const css = read("src/app/globals.css");

  assert.match(admin, /AiRulesView onChanged={refreshAudit} editable/);
  assert.match(ui, /function AiRuleEditor/);
  assert.match(ui, /Rule name/);
  assert.match(ui, /Match conditions/);
  assert.match(ui, /S\.I\. actions/);
  assert.match(ui, /Sender domains/);
  assert.match(ui, /Sender addresses/);
  assert.match(ui, /Recipient terms/);
  assert.match(ui, /Subject prefixes/);
  assert.match(ui, /Subject terms/);
  assert.match(ui, /Body terms/);
  assert.match(ui, /Require reply\/thread context/);
  assert.match(ui, /Save rule/);
  assert.match(ui, /Protected metadata such as rule ID, system status, and sort order/);
  assert.match(css, /\.rule-editor-backdrop/);
  assert.match(css, /\.rule-action-grid/);
});

test("full S.I. rule updates are validated, persisted, and audited", () => {
  const route = read("src/app/api/ai-rules/route.ts");
  const store = read("src/lib/ai-rules.ts");

  assert.match(route, /const editSchema = z\.object/);
  assert.match(route, /senderAddresses: z\.array\(z\.email\(\)/);
  assert.match(route, /direction: z\.enum\(\["inbound", "outbound", "both"\]\)/);
  assert.match(route, /actions: actionSchema/);
  assert.match(route, /await updateAiRule/);
  assert.match(route, /"Updated S\.I\. rule"/);

  assert.match(store, /export async function updateAiRule/);
  assert.match(store, /sender_domains =/);
  assert.match(store, /sender_addresses =/);
  assert.match(store, /recipient_terms =/);
  assert.match(store, /subject_terms =/);
  assert.match(store, /body_terms =/);
  assert.match(store, /subject_prefixes =/);
  assert.match(store, /actions = .*::jsonb/);
  assert.doesNotMatch(store, /system = \$\{/);
  assert.doesNotMatch(store, /sort_order = \$\{/);
});
