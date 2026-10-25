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
let live=true;
const token=(identity)=>'header.'+Buffer.from(JSON.stringify({...identity,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.signature';
const previousUrl = process.env.AI_MAIL_DATABASE_URL;
const previousSecret = process.env.AUTH_SECRET;
const testUrl = 'postgres://synthetic.invalid/in-memory-only';

before(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users (id text PRIMARY KEY, email text UNIQUE, email_confirmed_at timestamptz, deleted_at timestamptz, banned_until timestamptz);`);
  const directory = path.join(__dirname, '../supabase/migrations');
  for (const file of fs.readdirSync(directory).filter(name => name.endsWith('.sql')).sort()) {
    await db.exec(fs.readFileSync(path.join(directory, file), 'utf8'));
  }
  process.env.AI_MAIL_DATABASE_URL = testUrl;
  process.env.AUTH_SECRET = 'synthetic-test-secret-32-bytes-minimum';
  // Replace only the wire adapter: all queries/conditions come from production code.
  store = loadModule('src/lib/session-store.ts', {
    '@/lib/sovsi-server':{verifySovsiAccess:async accessToken=>{if(!live)throw Error('UNAUTHORIZED');const c=JSON.parse(Buffer.from(accessToken.split('.')[1],'base64url'));return {subject:c.sub,sessionId:c.session_id,claims:c};},refreshSovsiSession:async()=>{throw Error('unexpected refresh');}},
    postgres: (url) => {
      assert.equal(url, testUrl);
      const tagged=async (strings, ...values) => {
        const query = strings.map((part, index) => part + (index < values.length ? `$${index + 1}` : '')).join('');
        return (await db.query(query, values)).rows;
      };
      tagged.begin=async callback=>db.transaction(async tx=>callback(async(strings,...values)=>{const query=strings.map((part,index)=>part+(index<values.length?`$${index+1}`:'')).join('');return (await tx.query(query,values)).rows;}));return tagged;
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
  await db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,NOW())', [id, user.email]);
  await db.query('INSERT INTO public.ai_mail_users(id,name,email,role,status,password_hash) VALUES($1,$2,$3,$4,$5,$6)', [id, user.name, user.email, user.role, 'active', 'synthetic-hash']);
  const subject=`00000000-0000-4000-8000-${String(sequence).padStart(12,'0')}`,sessionIdCentral='10000000-0000-4000-8000-000000000001';
  await db.query('INSERT INTO ai_mail_sovsi_identity_links(subject,user_id,verified_by) VALUES($1,$2,$3)',[subject,id,'synthetic-test']);
  const identity={subject,sessionId:sessionIdCentral},tokens={access_token:token({sub:subject,session_id:sessionIdCentral}),refresh_token:'synthetic-refresh-token'};
  const session=await store.createFederatedSession(identity,tokens);
  assert.equal(session.user.id,id);assert.equal(session.user.role,user.role);
  return { user,identity,tokens,claims: { ...user, sessionId:session.sessionId } };
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

test('disabled explicit identity links reject new and existing sessions',async()=>{
 const {identity,tokens,claims,user}=await fixture();await db.query('UPDATE ai_mail_sovsi_identity_links SET enabled=false WHERE user_id=$1',[user.id]);
 assert.equal(await store.findActiveSession(claims),null);await assert.rejects(store.createFederatedSession(identity,tokens),/FORBIDDEN/);
});
test('MFA-required settings accepts the centrally verified session without changing roles',async()=>{
 await db.exec("UPDATE ai_mail_settings SET require_mfa=true WHERE id='default'");
 const {user,claims}=await fixture();assert.deepEqual(await store.findActiveSession(claims),user);
});
test('central session revocation rejects even a current local cookie',async()=>{
 const {claims}=await fixture();live=false;try{await assert.rejects(store.findActiveSession(claims),/UNAUTHORIZED/);}finally{live=true;}
});
test('central tokens are encrypted and bound to the local session hash',async()=>{
 const first=await fixture(),second=await fixture();
 const row=(await db.query('SELECT sovsi_tokens FROM ai_mail_sessions WHERE user_id=$1',[first.user.id])).rows[0];
 assert.ok(!row.sovsi_tokens.includes(first.tokens.refresh_token));assert.ok(!row.sovsi_tokens.includes(first.tokens.access_token));
 await db.query('UPDATE ai_mail_sessions SET sovsi_tokens=$1 WHERE user_id=$2',[row.sovsi_tokens,second.user.id]);
 await assert.rejects(store.findActiveSession(second.claims));
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
  for (const table of ['ai_mail_sessions', 'ai_mail_login_limits','ai_mail_sovsi_identity_links']) {
    assert.equal((await db.query('SELECT relrowsecurity FROM pg_class WHERE oid=$1::regclass', [`public.${table}`])).rows[0].relrowsecurity, true);
    for (const role of ['anon', 'authenticated']) {
      for (const operation of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        assert.equal((await db.query('SELECT has_table_privilege($1,$2,$3) AS allowed', [role, `public.${table}`, operation])).rows[0].allowed, false);
      }
    }
  }
});
