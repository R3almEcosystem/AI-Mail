const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

test('Vercel executes core verification before the production build', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  assert.equal(config.buildCommand, 'node scripts/verify-core.cjs && npm run build');
});

function verifier() { return require('../scripts/verify-core.cjs'); }

test('verification children do not inherit provider keys, databases, or Node injection options', () => {
  const { isolatedEnvironment } = verifier();
  const env = isolatedEnvironment({ PATH: process.env.PATH, HOME: '/private', AUTH_SECRET: 'synthetic', DATABASE_URL: 'synthetic', OPENAI_API_KEY: 'synthetic', NODE_OPTIONS: '--require malicious.cjs', VERCEL_ENV: 'production' });
  assert.equal(env.PATH, process.env.PATH);
  assert.equal(env.NODE_ENV, 'test');
  assert.equal(env.CI, 'true');
  for (const key of ['HOME', 'AUTH_SECRET', 'DATABASE_URL', 'OPENAI_API_KEY', 'NODE_OPTIONS', 'VERCEL_ENV']) assert.equal(env[key], undefined);
});

test('a passing subprocess is accepted', () => {
  assert.doesNotThrow(() => verifier().runNodeStep('synthetic-pass', ['-e', 'process.exit(0)'], root));
});

test('a failing subprocess blocks the gate', () => {
  assert.throws(() => verifier().runNodeStep('synthetic-failure', ['-e', 'process.exit(7)'], root), /synthetic-failure failed.*7/);
});

test('subprocess environment isolation is enforced at execution', () => {
  const old = process.env.AI_MAIL_DATABASE_URL;
  process.env.AI_MAIL_DATABASE_URL = 'synthetic-do-not-inherit';
  try {
    assert.doesNotThrow(() => verifier().runNodeStep('isolated-child', ['-e', 'if (process.env.AI_MAIL_DATABASE_URL || process.env.NODE_ENV !== "test") process.exit(9)'], root));
  } finally {
    if (old === undefined) delete process.env.AI_MAIL_DATABASE_URL;
    else process.env.AI_MAIL_DATABASE_URL = old;
  }
});

test('missing installed tools are not treated as successful verification', () => {
  const os = require('node:os');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'aimail-gate-'));
  try { assert.throws(() => verifier().verifyCore(temp), /Missing verification dependency/); }
  finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

function withSyntheticNpm(program, check) {
  const os = require('node:os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aimail-audit-command-'));
  const originalPath = process.env.PATH;
  fs.writeFileSync(path.join(dir, 'npm'), `#!${process.execPath}\n${program}\n`, { mode: 0o700 });
  process.env.PATH = `${dir}${path.delimiter}${originalPath}`;
  try { check(); }
  finally { process.env.PATH = originalPath; fs.rmSync(dir, { recursive: true, force: true }); }
}

test('a failed dependency audit blocks verification', () => {
  withSyntheticNpm('process.exit(1)', () => {
    assert.throws(() => verifier().runDependencyAudit(root), /production-dependency-audit failed/);
  });
});

test('dependency audit requires the production graph and moderate severity threshold', () => {
  withSyntheticNpm(`
    const assert = require('node:assert/strict');
    assert.deepEqual(process.argv.slice(2), ['audit', '--omit=dev', '--audit-level=moderate']);
    assert.equal(process.env.AUTH_SECRET, undefined);
    assert.equal(process.env.DATABASE_URL, undefined);
    assert.ok(process.env.HOME.includes('aimail-audit-home-'));
  `, () => { assert.doesNotThrow(() => verifier().runDependencyAudit(root)); });
});
