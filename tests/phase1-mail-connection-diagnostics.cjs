const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { loadModule } = require("./module-loader.cjs");

const diagnostics = loadModule("src/lib/mail-connection-error.ts");

test("mail connection diagnostics distinguish authentication, TLS, DNS and timeout failures", () => {
  assert.equal(diagnostics.mailConnectionFailure(Object.assign(new Error("Authentication failed"), { code: "AUTHENTICATIONFAILED" }), "imap").code, "MAIL_AUTH_REJECTED");
  assert.equal(diagnostics.mailConnectionFailure(Object.assign(new Error("certificate hostname mismatch"), { code: "ERR_TLS_CERT_ALTNAME_INVALID" }), "imap").code, "MAIL_TLS_FAILED");
  assert.equal(diagnostics.mailConnectionFailure(Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" }), "imap").code, "MAIL_HOST_NOT_FOUND");
  assert.equal(diagnostics.mailConnectionFailure(Object.assign(new Error("connect ETIMEDOUT"), { code: "ETIMEDOUT" }), "smtp").code, "MAIL_CONNECTION_TIMEOUT");
  assert.equal(diagnostics.mailConnectionFailure(Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }), "smtp").code, "MAIL_CONNECTION_REFUSED");
});

test("mail account test API returns safe diagnostics instead of a generic 502", () => {
  const route = fs.readFileSync("src/app/api/mail-accounts/[id]/test/route.ts", "utf8");
  assert.match(route, /mailConnectionFailure/);
  assert.match(route, /safeMailConnectionLog/);
  assert.match(route, /MAIL_ACCOUNT_NOT_CONFIGURED/);
  assert.match(route, /SMTP_NOT_CONFIGURED/);
  assert.match(route, /diagnostic: failure\.code/);
  assert.match(route, /status: failure\.status/);
});
