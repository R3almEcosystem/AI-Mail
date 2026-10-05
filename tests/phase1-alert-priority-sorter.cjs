const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const read = (path) => fs.readFileSync(path, "utf8");

test("Activity Center alerts expose a detected-priority dropdown sorter", () => {
  const panel = read("src/components/alerts-panel.tsx");
  const css = read("src/app/globals.css");

  assert.match(panel, /type AlertPriorityFilter = "all" \| AlertSeverity/);
  assert.match(panel, /alertPriorityRank/);
  assert.match(panel, /critical: 0/);
  assert.match(panel, /warning: 1/);
  assert.match(panel, /info: 2/);
  assert.match(panel, /success: 3/);
  assert.match(panel, /priorityFilter === "all" \|\| alert\.severity === priorityFilter/);
  assert.match(panel, /Sort alerts by detected priority/);
  assert.match(panel, /All priorities/);
  assert.match(panel, /Critical/);
  assert.match(panel, /Warning/);
  assert.match(panel, /Info/);
  assert.match(panel, /Success/);
  assert.match(panel, /priorityCounts\.critical/);
  assert.match(panel, /setExpandedId\(null\)/);

  assert.match(css, /\.alert-filter-field/);
  assert.match(css, /\.alert-select-control select/);
  assert.match(css, /\.alerts-toolbar-left/);
});

test("priority selection composes with All and Unread alert filters", () => {
  const panel = read("src/components/alerts-panel.tsx");

  assert.match(panel, /filter === "all" \|\| alert\.unread/);
  assert.match(panel, /priorityFilter === "all" \|\| alert\.severity === priorityFilter/);
  assert.match(panel, /alertPriorityRank\[left\.alert\.severity\] - alertPriorityRank\[right\.alert\.severity\]/);
  assert.match(panel, /No \$\{priorityFilter\} alerts/);
});
