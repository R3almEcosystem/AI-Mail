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

  assert.ok(css.includes(".status-row {"));
  assert.ok(css.includes("grid-template-columns: 28px minmax(0, 1fr) auto;"));
  assert.ok(css.includes(".status-text {"));
  assert.ok(css.includes("border-radius: 999px;"));
  assert.ok(css.includes(".status-row { grid-template-columns: 28px minmax(0, 1fr); }"));
});
