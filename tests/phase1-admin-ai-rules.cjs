const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const read = (path) => fs.readFileSync(path, "utf8");

test("Admin Console exposes the shared AI Rules workspace", () => {
  const admin = read("src/components/admin-console.tsx");
  const rules = read("src/components/settings-views.tsx");
  const route = read("src/app/api/ai-rules/route.ts");
  const css = read("src/app/globals.css");

  assert.match(admin, /type AdminSection = .*"rules"/);
  assert.match(admin, /id: "rules", label: "AI Rules"/);
  assert.match(admin, /rules: \{ eyebrow: "AUTOMATION", title: "AI Rules"/);
  assert.match(admin, /section === "rules"/);
  assert.match(admin, /<AiRulesView onChanged={refreshAudit} \/>/);
  assert.match(admin, /Manage AI rules/);

  assert.match(rules, /export function AiRulesView\(\{ onChanged \}/);
  assert.match(rules, /await onChanged\?\.\(\)/);
  assert.match(route, /requireCapability\("admin:manage", request\)/);
  assert.match(route, /Enabled AI rule/);
  assert.match(route, /Disabled AI rule/);

  assert.match(css, /\.admin-ai-rules-page/);
  assert.match(css, /\.admin-ai-rules-page \.settings-page/);
});

test("Admin and main workspace use one persistent AI rule store", () => {
  const admin = read("src/components/admin-console.tsx");
  const dashboard = read("src/components/mail-dashboard.tsx");
  const rulesView = read("src/components/settings-views.tsx");
  const store = read("src/lib/ai-rules.ts");

  assert.match(admin, /AiRulesView/);
  assert.match(dashboard, /<AiRulesView \/>/);
  assert.match(rulesView, /fetch\(webPath\("\/api\/ai-rules"\)/);
  assert.match(store, /public\.ai_mail_ai_rules/);
});
