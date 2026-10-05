const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const read = (path) => fs.readFileSync(path, "utf8");

test("Overview right intelligence panel shows time-sensitive email details", () => {
  const view = read("src/components/overview-view.tsx");
  const css = read("src/app/globals.css");

  assert.match(view, /const timeSensitiveMessages = \[\.\.\.messages\]/);
  assert.match(view, /message\.priority === "urgent" \|\| message\.priority === "important" \|\| message\.aiEscalate/);
  assert.match(view, /TIME SENSITIVE/);
  assert.match(view, /Emails needing attention/);
  assert.match(view, /message\.accountLabel \|\| "Primary mailbox"/);
  assert.match(view, /message\.category/);
  assert.match(view, /message\.preview/);
  assert.match(view, /AI rule/);
  assert.match(view, /onClick=\{\(\) => onSelect\(message\)\}/);
  assert.doesNotMatch(view, /Two messages are time-sensitive/);

  assert.match(css, /\.time-sensitive-section/);
  assert.match(css, /\.time-sensitive-item--urgent/);
  assert.match(css, /\.time-sensitive-item--important/);
  assert.match(css, /\.time-sensitive-preview/);
  assert.match(css, /\.time-sensitive-context/);
});

test("time-sensitive ordering favors escalated or urgent then unread messages", () => {
  const view = read("src/components/overview-view.tsx");

  assert.match(view, /message\.aiEscalate \|\| message\.priority === "urgent" \? 0 : 1/);
  assert.match(view, /if \(left\.unread !== right\.unread\) return left\.unread \? -1 : 1/);
  assert.match(view, /Date\.parse\(right\.receivedAt\) - Date\.parse\(left\.receivedAt\)/);
  assert.match(view, /\.slice\(0, 4\)/);
});
