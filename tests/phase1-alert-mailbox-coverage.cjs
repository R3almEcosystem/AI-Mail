const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const read = (path) => fs.readFileSync(path, "utf8");

test("Activity Center alert feed uses bounded recent-message scans across every active mailbox", () => {
  const route = read("src/app/api/alerts/route.ts");
  const mail = read("src/lib/mail.ts");
  const client = read("src/mail/client.ts");
  const dashboard = read("src/components/mail-dashboard.tsx");
  const alerts = read("src/lib/alerts.ts");

  assert.match(route, /listActiveMailAccounts/);
  assert.match(route, /listAlertMessages\(account\.id, 30\)/);
  assert.match(route, /const concurrency = 4/);
  assert.match(route, /activeAccounts\.slice\(index, index \+ concurrency\)/);
  assert.match(route, /maxDuration = 90/);
  assert.match(route, /\[alerts\] slow mailbox scan/);
  assert.match(route, /\[alerts\] refresh complete/);
  assert.match(route, /Mailbox monitoring failed/);
  assert.match(route, /Mailbox monitoring is partially available/);
  assert.match(route, /coverage:/);
  assert.doesNotMatch(route, /listMail\(/);

  assert.match(mail, /export async function listAlertMessages/);
  assert.match(mail, /listRecentMessagesByFolders/);
  assert.match(client, /async listRecentMessagesByFolders/);
  assert.match(client, /const range = exists > limit \? `\*:-\$\{limit\}` : '1:\*'/);
  assert.match(client, /getMailboxLock\(folder, \{ readOnly: true \}\)/);
  assert.match(client, /25_000/);
  assert.doesNotMatch(client.match(/async listRecentMessagesByFolders[\s\S]*?\n  }\n\n  async listMessagesPage/)?.[0] || "", /client\.search/);

  assert.match(dashboard, /loadData\("INBOX", "all"\)\.then/);
  assert.match(dashboard, /if \(!cancelled\) return loadAlerts\(\)/);

  assert.match(alerts, /accountId\?: string/);
  assert.match(alerts, /accountLabel\?: string/);
  assert.match(alerts, /messageFolder\?: "INBOX" \| "INBOX\.Sent"/);
  assert.match(alerts, /"mail:" \+ accountId \+ ":" \+ folder \+ ":" \+ message\.uid/);
  assert.match(alerts, /message\.aiEscalate \|\| message\.priority === "urgent"/);
});

test("Activity Center mailbox filter composes with priority and unread filters", () => {
  const panel = read("src/components/alerts-panel.tsx");
  const dashboard = read("src/components/mail-dashboard.tsx");
  const css = read("src/app/globals.css");

  assert.match(panel, /Filter alerts by mailbox/);
  assert.match(panel, /All mailboxes/);
  assert.match(panel, /alert\.accountId === mailboxFilter/);
  assert.match(panel, /mailboxScopedAlerts/);
  assert.match(panel, /priorityFilter === "all" \|\| alert\.severity === priorityFilter/);
  assert.match(panel, /filter === "all" \|\| alert\.unread/);
  assert.match(panel, /alert\.accountLabel \? <small>/);
  assert.match(panel, /<dt>Mailbox<\/dt>/);

  assert.match(dashboard, /fetch\(webPath\("\/api\/alerts"\)/);
  assert.match(dashboard, /setAlertAccounts/);
  assert.match(dashboard, /setAlertCoverage/);
  assert.match(dashboard, /onClick=\{\(\) => \{ setAlertsOpen\(true\); void loadAlerts\(\); \}\}/);
  assert.match(dashboard, /accountId = alert\.accountId \|\| "primary"/);
  assert.match(dashboard, /alert\.messageFolder \|\| "INBOX"/);

  assert.match(css, /\.alert-filter-field/);
  assert.match(css, /\.alert-source-cell small/);
});


test("Activity Center uses a wider drawer and stronger dropdown controls", () => {
  const panel = read("src/components/alerts-panel.tsx");
  const css = read("src/app/globals.css");

  assert.match(panel, /Mailbox filter/);
  assert.match(panel, /Priority filter/);
  assert.match(panel, /className="alert-select-control"/);

  assert.match(css, /\.alerts-drawer \{ width: min\(760px, 100vw\)/);
  assert.match(css, /\.alert-select-control \{/);
  assert.match(css, /border: 1px solid #cfd9e7/);
  assert.match(css, /border-radius: 10px/);
  assert.match(css, /\.alert-filter-field:focus-within \.alert-select-control/);
  assert.match(css, /box-shadow: 0 0 0 3px rgba\(64, 112, 185, \.11\)/);
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\) 132px 64px/);
});
