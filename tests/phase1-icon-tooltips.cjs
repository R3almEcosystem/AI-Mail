const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

function read(path) {
  return fs.readFileSync(path, "utf8");
}

test("icon-only controls expose accessible labels used by global tooltips", () => {
  const css = read("src/app/globals.css");
  const research = read("src/components/mail-research-modal.tsx");
  const inbox = read("src/components/inbox-workspace.tsx");
  const dashboard = read("src/components/mail-dashboard.tsx");
  const compose = read("src/components/compose-modal.tsx");
  const admin = read("src/components/admin-console.tsx");

  assert.ok(css.includes("button[aria-label]:has(> svg)::after"));
  assert.ok(css.includes("content: attr(aria-label)"));
  assert.ok(css.includes("@media (hover: hover)"));
  assert.ok(css.includes(":focus-visible::after"));

  for (const label of [
    "Expand report to full panel view",
    "Collapse report to standard panel view",
    "Refresh ",
    "Back to messages",
    "Archive",
    "Flag message",
    "More options",
    "Open alerts",
    "Attach file",
    "Write with AI",
    "Open navigation",
    "Close navigation",
    "Refresh available OpenAI models",
  ]) {
    assert.ok(
      research.includes(label) ||
      inbox.includes(label) ||
      dashboard.includes(label) ||
      compose.includes(label) ||
      admin.includes(label),
      "missing accessible icon label: " + label,
    );
  }
});
