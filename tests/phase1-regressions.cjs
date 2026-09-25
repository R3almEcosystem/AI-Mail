const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./module-loader.cjs');
const user = { id: 'user-test', name: 'Bernie O’Neill', email: 'person@example.test', role: 'super_admin', demo: false };
const secret = 'test-only-secret-not-for-production-0123456789';
function environment(values, run) {
  const before = { ...process.env };
  for (const key of ['AUTH_SECRET','ENABLE_DEMO_LOGIN','AI_MAIL_DEMO_MODE','DATABASE_URL','POSTGRES_URL','POSTGRES_URL_NON_POOLING','AI_MAIL_DATABASE_URL','APP_ACCESS_PASSWORD','IMAP_PASSWORD','SMTP_PASSWORD','MAIL_PASSWORD','OPENAI_API_KEY','SUPABASE_SERVICE_ROLE_KEY']) delete process.env[key];
  Object.assign(process.env, { NODE_ENV: 'test', VERCEL_ENV: 'preview' }, values);
  return Promise.resolve().then(run).finally(() => {
    for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key];
    Object.assign(process.env, before);
  });
}
test('remote preview cannot issue cookies without an explicit secret', () => environment({}, async () => {
  const auth = loadModule('src/lib/auth.ts');
  assert.equal(await auth.createSessionToken(user), null);
}));
test('short signing secrets fail closed', () => environment({ AUTH_SECRET: 'short' }, async () => {
  assert.equal(await loadModule('src/lib/auth.ts').createSessionToken(user), null);
}));
test('explicit demo disable wins in preview', () => environment({ AUTH_SECRET: secret, ENABLE_DEMO_LOGIN: 'false' }, () => {
  assert.equal(loadModule('src/lib/auth.ts').demoLoginEnabled(), false);
}));
test('production cannot opt into demo access', () => environment({ NODE_ENV: 'production', VERCEL_ENV: 'production', AUTH_SECRET: secret, ENABLE_DEMO_LOGIN: 'true', AI_MAIL_DEMO_MODE: 'isolated' }, () => {
  assert.equal(loadModule('src/lib/auth.ts').demoLoginEnabled(), false);
}));
for (const key of ['DATABASE_URL','POSTGRES_URL','POSTGRES_URL_NON_POOLING','AI_MAIL_DATABASE_URL','IMAP_PASSWORD','SMTP_PASSWORD','MAIL_PASSWORD','OPENAI_API_KEY','SUPABASE_SERVICE_ROLE_KEY']) {
  test(`demo is unavailable alongside ${key}`, () => environment({ AUTH_SECRET: secret, ENABLE_DEMO_LOGIN: 'true', AI_MAIL_DEMO_MODE: 'isolated', [key]: 'live-shaped-fixture' }, () => {
    assert.equal(loadModule('src/lib/auth.ts').demoLoginEnabled(), false);
  }));
}
test('session claims preserve Unicode names', () => environment({ AUTH_SECRET: secret }, async () => {
  const auth = loadModule('src/lib/auth.ts'); const token = await auth.createSessionToken(user);
  assert.equal((await auth.verifySessionToken(token)).name, user.name);
}));
test('extra token segments are rejected', () => environment({ AUTH_SECRET: secret }, async () => {
  const auth = loadModule('src/lib/auth.ts'); const token = await auth.createSessionToken(user);
  assert.equal(await auth.verifySessionToken(`${token}.extra`), null);
}));
for (const reason of ['suspended','deleted','password reset','demoted','revoked by logout','MFA required']) {
  test(`stale cookie cannot authorize after ${reason}`, () => environment({ AUTH_SECRET: secret, DATABASE_URL: 'postgres://test.invalid/test' }, async () => {
    const session = loadModule('src/lib/session.ts', {
      'next/headers': { cookies: async () => ({ get: () => ({ value: 'cookie-fixture' }) }) },
      '@/lib/auth': { SESSION_NAME: 'test', verifySessionToken: async () => ({ ...user, sessionId: 'x'.repeat(64), version: 2 }), demoLoginEnabled: () => false },
      '@/lib/session-store': { findActiveSession: async () => null }
    });
    assert.equal(await session.getSessionUser(), null);
  }));
}
test('OAuth callback keeps query and fragment until the consent client consumes them', () => {
  const before = global.window; let destination;
  global.window = { localStorage: { getItem: () => 'test-authorization' }, location: { search: '?code=test-code', hash: '#access_token=test-only', replace: (value) => { destination = value; } } };
  try { loadModule('src/components/oauth-resume.tsx', { react: { useEffect: (fn) => fn() } }).OAuthResume(); }
  finally { global.window = before; }
  assert.equal(destination, '/oauth/consent?code=test-code#access_token=test-only');
});
