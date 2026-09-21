'use strict';
// Real PostgreSQL (WASM), in memory only. No external database/socket is opened.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const { loadModule } = require('./module-loader.cjs');
let db;
let store;
let sequence = 0;
const previousUrl = process.env.AI_MAIL_DATABASE_URL;
const previousSecret = process.env.AUTH_SECRET;
const testUrl = 'postgres://synthetic.invalid/in-memory-only';

before(async () => {
  db = new PGlite();
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
  const directory = path.join(__dirname, '../supabase/migrations');
  for (const file of fs.readdirSync(directory).filter(name => name.endsWith('.sql')).sort()) {
    await db.exec(fs.readFileSync(path.join(directory, file), 'utf8'));
  }
  process.env.AI_MAIL_DATABASE_URL = testUrl;
  process.env.AUTH_SECRET = 'synthetic-test-secret-32-bytes-minimum';
  // Replace only the wire adapter: all queries/conditions come from production code.
  store = loadModule('src/lib/session-store.ts', {
    postgres: (url) => {
      assert.equal(url, testUrl);
      return async (strings, ...values) => {
        const query = strings.map((part, index) => part + (index < values.length ? `$${index + 1}` : '')).join('');
        return (await db.query(query, values)).rows;
      };
    },
  });
});

after(async () => {
  if (previousUrl === undefined) delete process.env.AI_MAIL_DATABASE_URL;
  else process.env.AI_MAIL_DATABASE_URL = previousUrl;
  if (previousSecret === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = previousSecret;
  if (db) await db.close();
});

async function fixture() {
  const id = `synthetic-${++sequence}`;
  const user = { id, name: 'Synthetic User', email: `${id}@example.test`, role: 'admin', demo: false };
  await db.query('INSERT INTO public.ai_mail_users(id,name,email,role,status,password_hash) VALUES($1,$2,$3,$4,$5,$6)', [id, user.name, user.email, user.role, 'active', 'synthetic-hash']);
  const sessionId = await store.createDatabaseSession(user, 'synthetic-hash', 3600);
  return { user, claims: { ...user, sessionId } };
}

test('the exact migrations support the existing bootstrap ON CONFLICT(email)', async () => {
  const { user } = await fixture();
  await db.query('INSERT INTO public.ai_mail_users(id,name,email,role,status) VALUES($1,$2,$3,$4,$5) ON CONFLICT(email) DO NOTHING', ['duplicate', user.name, user.email, 'admin', 'active']);
  assert.equal((await db.query('SELECT count(*)::integer AS total FROM public.ai_mail_users WHERE email=$1', [user.email])).rows[0].total, 1);
});

test('production session SQL accepts a current database-backed session', async () => {
  const { user, claims } = await fixture();
  assert.deepEqual(await store.findActiveSession(claims), user);
});

test('logout durably revokes a session and repeated logout is safe', async () => {
  const { claims } = await fixture();
  await store.revokeDatabaseSession(claims);
  await store.revokeDatabaseSession(claims);
  assert.equal(await store.findActiveSession(claims), null);
});

for (const [column, value] of [['password_hash', 'replacement-hash'], ['role', 'viewer'], ['status', 'suspended'], ['status', 'deleted']]) {
  test(`${column}=${value} invalidates existing session privileges`, async () => {
    const { user, claims } = await fixture();
    // Column names are this fixed test list, never supplied by an application user.
    await db.query(`UPDATE public.ai_mail_users SET ${column}=$1 WHERE id=$2`, [value, user.id]);
    assert.equal(await store.findActiveSession(claims), null);
  });
}

test('changing account email invalidates its old session', async () => {
  const { user, claims } = await fixture();
  await db.query('UPDATE public.ai_mail_users SET email=$1 WHERE id=$2', [`changed-${user.email}`, user.id]);
  assert.equal(await store.findActiveSession(claims), null);
});

test('reactivation does not resurrect a suspended session', async () => {
  const { user, claims } = await fixture();
  await db.query("UPDATE public.ai_mail_users SET status='suspended' WHERE id=$1", [user.id]);
  await db.query("UPDATE public.ai_mail_users SET status='active' WHERE id=$1", [user.id]);
  assert.equal(await store.findActiveSession(claims), null);
});

test('updating last login does not invalidate the new session', async () => {
  const { user, claims } = await fixture();
  await db.query('UPDATE public.ai_mail_users SET last_login_at=NOW() WHERE id=$1', [user.id]);
  assert.deepEqual(await store.findActiveSession(claims), user);
});

test('the database refuses an expired session', async () => {
  const { user, claims } = await fixture();
  await db.query("UPDATE public.ai_mail_sessions SET created_at=NOW()-INTERVAL '2 hours', expires_at=NOW()-INTERVAL '1 hour' WHERE user_id=$1", [user.id]);
  assert.equal(await store.findActiveSession(claims), null);
});

test('credential changes between password verification and session creation are rejected', async () => {
  const { user } = await fixture();
  await db.query("UPDATE public.ai_mail_users SET password_hash='new-hash' WHERE id=$1", [user.id]);
  await assert.rejects(store.createDatabaseSession(user, 'synthetic-hash', 3600), /UNAUTHORIZED/);
});

test('MFA-required policy refuses password-only sessions', async () => {
  const { user, claims } = await fixture();
  await db.exec("UPDATE public.ai_mail_settings SET require_mfa=TRUE WHERE id='default'");
  try {
    assert.equal(await store.findActiveSession(claims), null);
    await assert.rejects(store.createDatabaseSession(user, 'synthetic-hash', 3600), /UNAUTHORIZED/);
  } finally {
    await db.exec("UPDATE public.ai_mail_settings SET require_mfa=FALSE WHERE id='default'");
  }
});

test('login rate limits enforce the boundary and renew an expired window', async () => {
  const email = 'rate-limit@example.test';
  for (let i = 0; i < 10; i++) assert.equal(await store.consumeLoginAttempt(email), true);
  assert.equal(await store.consumeLoginAttempt(email.toUpperCase()), false);
  await db.exec("UPDATE public.ai_mail_login_limits SET window_started_at=NOW()-INTERVAL '16 minutes'");
  assert.equal(await store.consumeLoginAttempt(email), true);
});

test('session identifiers are stored only as digests', async () => {
  const { user, claims } = await fixture();
  const row = (await db.query('SELECT id_hash FROM public.ai_mail_sessions WHERE user_id=$1', [user.id])).rows[0];
  assert.match(row.id_hash, /^[a-f0-9]{64}$/);
  assert.notEqual(row.id_hash, claims.sessionId);
});

test('public API roles cannot read or write the session and login-limit tables', async () => {
  for (const table of ['ai_mail_sessions', 'ai_mail_login_limits']) {
    assert.equal((await db.query('SELECT relrowsecurity FROM pg_class WHERE oid=$1::regclass', [`public.${table}`])).rows[0].relrowsecurity, true);
    for (const role of ['anon', 'authenticated']) {
      for (const operation of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        assert.equal((await db.query('SELECT has_table_privilege($1,$2,$3) AS allowed', [role, `public.${table}`, operation])).rows[0].allowed, false);
      }
    }
  }
});
