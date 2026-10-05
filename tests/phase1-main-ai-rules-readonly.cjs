const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const read = (path) => fs.readFileSync(path, "utf8");

test("main Portal AI Rules are read-only but expose full details", () => {
  const dashboard = read("src/components/mail-dashboard.tsx");
  const ui = read("src/components/settings-views.tsx");
  const css = read("src/app/globals.css");

  assert.match(dashboard, /<AiRulesView \/>/);
  assert.match(ui, /function AiRuleDetails/);
  assert.match(ui, /View details for/);
  assert.match(ui, /Details<\/button>/);
  assert.match(ui, /Read-only view\. Rule changes can only be made from the Admin Portal\./);
  assert.match(ui, /AI Rules are read-only in the main Portal/);
  assert.match(ui, /editable && canManage \? \(/);
  assert.match(ui, /rule-readonly-state/);
  assert.match(css, /\.rule-details-modal/);
  assert.match(css, /\.rule-view-button/);
});

test("Admin Portal retains AI Rule editing and status controls", () => {
  const admin = read("src/components/admin-console.tsx");
  const ui = read("src/components/settings-views.tsx");

  assert.match(admin, /<AiRulesView onChanged={refreshAudit} editable \/>/);
  assert.match(ui, /editable && canManage \? <button type="button" className="rule-edit-button"/);
  assert.match(ui, /onClick=\{\(\) => void toggleRule\(rule\)\}/);
  assert.match(ui, /<AiRuleEditor/);
});
