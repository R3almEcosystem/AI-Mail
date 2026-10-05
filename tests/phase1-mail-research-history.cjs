const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

function read(path) {
  return fs.readFileSync(path, "utf8");
}

test("research history is private and scoped to the authenticated user", () => {
  const store = read("src/lib/mail-research-history.ts");
  const migration = read("supabase/migrations/20261005143000_ai_mail_research_history.sql");
  const warningMigration = read("supabase/migrations/20261005145000_ai_mail_research_history_warnings.sql");

  assert.ok(store.includes("WHERE user_id = ${user.id}"));
  assert.ok(store.includes("WHERE user_id = ${user.id} AND id = ${id}::uuid"));
  assert.ok(store.includes("private.ai_mail_research_history"));
  assert.match(migration, /revoke all on schema private from authenticated/i);
  assert.match(migration, /enable row level security/i);
  assert.match(warningMigration, /add column if not exists warnings jsonb/i);
  assert.ok(store.includes("warnings: Array.isArray(row.warnings)"));
  assert.ok(store.includes("JSON.stringify(result.warnings)"));
});

test("AI Mail Research exposes a History tab and authenticated history APIs", () => {
  const component = read("src/components/mail-research-modal.tsx");
  const route = read("src/app/api/ai/research/history/route.ts");
  const detail = read("src/app/api/ai/research/history/[id]/route.ts");

  assert.ok(component.includes('activeTab === "history"'));
  assert.ok(component.includes("/api/ai/research/history"));
  assert.ok(component.includes("Saved research"));
  assert.ok(component.includes("selectedHistoryView.warnings"));
  assert.ok(component.includes("research-history-warning-badge"));
  assert.ok(route.includes('requireCapability("ai:use"'));
  assert.ok(detail.includes('requireCapability("ai:use"'));
});


test("research results generate canonical warnings for incomplete coverage", () => {
  const research = read("src/lib/mail-research.ts");
  assert.ok(research.includes("buildMailResearchWarnings"));
  assert.ok(research.includes("The newest matches are included"));
  assert.ok(research.includes("processing or security limits"));
});
