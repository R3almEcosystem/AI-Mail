const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

function read(path) {
  return fs.readFileSync(path, "utf8");
}

test("status cards use non-overlapping responsive layouts", () => {
  const css = read("src/app/globals.css");

  assert.ok(css.includes(".metric-card {"));
  assert.ok(css.includes("grid-template-columns: 39px minmax(0, 1fr);"));
  assert.ok(css.includes(".metric-card > div {"));
  assert.ok(css.includes("flex-direction: column;"));
  assert.ok(css.includes("white-space: normal;"));
  assert.ok(css.includes("overflow-wrap: anywhere;"));

  assert.ok(css.includes(".connection-card {"));
  assert.ok(css.includes("grid-template-columns: 42px minmax(0, 1fr) auto;"));
  assert.ok(css.includes(".connection-card dl div {"));
  assert.ok(css.includes("text-align: right;"));

  assert.ok(css.includes(".status-row-summary {"));
  assert.ok(css.includes("grid-template-columns: 28px minmax(0, 1fr) auto;"));
  assert.ok(css.includes(".status-text {"));
  assert.ok(css.includes("border-radius: 999px;"));
  assert.ok(css.includes(".status-row-summary { grid-template-columns: 28px minmax(0, 1fr); }"));
});


test("readiness checklist entries expand into detailed configuration state", () => {
  const view = read("src/components/settings-views.tsx");
  const css = read("src/app/globals.css");

  assert.ok(view.includes('<details className="status-row status-row--expandable">'));
  assert.ok(view.includes('<summary className="status-row-summary">'));
  assert.ok(view.includes('status-row-detail-panel'));
  assert.ok(view.includes('Current state'));
  assert.ok(view.includes('Next check'));
  assert.ok(view.includes('Used by'));
  assert.ok(view.includes('Required'));
  assert.ok(view.includes('Use Test IMAP'));
  assert.ok(view.includes('Use Test SMTP'));
  assert.ok(view.includes('Admin → S.I. Settings'));
  assert.ok(view.includes('Review users, roles, and MFA policy'));
  assert.ok(css.includes(".status-row[open] .status-row-chevron"));
  assert.ok(css.includes(".status-row-detail-panel"));
  assert.ok(css.includes("grid-template-columns: repeat(2, minmax(0, 1fr));"));
});
