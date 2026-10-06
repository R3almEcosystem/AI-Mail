const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const read = (path) => fs.readFileSync(path, "utf8");

test("Audit workspace has administrative and external AI call tabs", () => {
  const admin = read("src/components/admin-console.tsx");
  const route = read("src/app/api/admin/audit/ai-calls/route.ts");
  const telemetry = read("src/lib/ai-telemetry.ts");
  const css = read("src/app/globals.css");

  assert.match(admin, /Administrative activity/);
  assert.match(admin, /External AI calls/);
  assert.match(admin, /aiAuditSummary/);
  assert.match(admin, /\/api\/admin\/audit\/ai-calls/);
  assert.match(route, /requireAdminUser/);
  assert.match(route, /listAiCallAudit/);
  assert.match(telemetry, /private\.ai_mail_ai_calls/);
  assert.match(telemetry, /estimatedCostUsd/);
  assert.match(telemetry, /responseTimeMs/);
  assert.match(css, /\.audit-tabs/);
  assert.match(css, /\.ai-audit-metrics/);
});

test("AI telemetry excludes prompts and response content from persistence", () => {
  const telemetry = read("src/lib/ai-telemetry.ts");
  const migration = read("supabase/migrations/20261005214500_ai_call_telemetry.sql");

  assert.doesNotMatch(migration, /prompt\s+text/i);
  assert.doesNotMatch(migration, /response_content/i);
  assert.match(migration, /operational metadata only/i);
  assert.doesNotMatch(telemetry, /input\.prompt/);
});
