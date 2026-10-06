const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const read = (path) => fs.readFileSync(path, "utf8");

test("Secure HTML offers explicit remote image loading without direct browser fetches", () => {
  const ui = read("src/components/inbox-workspace.tsx");
  assert.match(ui, /Remote images blocked/);
  assert.match(ui, /Load images/);
  assert.match(ui, /\/remote-images/);
  assert.match(ui, /remoteImagesLoading/);
});

test("remote image endpoint is authenticated and rebuilds HTML server-side", () => {
  assert.equal(fs.existsSync("src/app/api/mail/[uid]/remote-images/route.ts"), true);
  const route = read("src/app/api/mail/[uid]/remote-images/route.ts");
  assert.match(route, /requireCapability\("mail:read"/);
  assert.match(route, /getMail\(/);
  assert.match(route, /hydrateRemoteEmailImages/);
  assert.doesNotMatch(route, /request\.json/);
});
