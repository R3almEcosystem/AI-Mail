'use strict';
// Runs only verification code, with no deployment credentials in child environments.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function isolatedEnvironment(source = process.env) {
  const env = { NODE_ENV: 'test', CI: 'true', TZ: 'UTC', NEXT_TELEMETRY_DISABLED: '1' };
  for (const key of ['PATH', 'SystemRoot', 'WINDIR', 'TMPDIR', 'TMP', 'TEMP', 'LANG']) {
    if (typeof source[key] === 'string') env[key] = source[key];
  }
  return env;
}

function runNodeStep(name, args, cwd) {
  console.log(`[phase1-verify] START ${name}`);
  const result = spawnSync(process.execPath, args, {
    cwd,
    env: isolatedEnvironment(),
    stdio: 'inherit',
    timeout: 180_000,
    shell: false,
  });
  if (result.error || result.signal || result.status !== 0) {
    const detail = result.error?.code || result.signal || String(result.status);
    throw new Error(`${name} failed (exit/status ${detail})`);
  }
  console.log(`[phase1-verify] PASS ${name}`);
}

function verifyCore(root = path.resolve(__dirname, '..')) {
  const tools = {
    typescript: 'node_modules/typescript/bin/tsc',
    vitest: 'node_modules/vitest/vitest.mjs',
  };
  for (const file of Object.values(tools)) {
    if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing verification dependency: ${file}`);
  }
  const regressions = fs.readdirSync(path.join(root, 'tests'))
    .filter(name => /^phase1-.*\.cjs$/.test(name))
    .sort()
    .map(name => path.join('tests', name));
  if (!regressions.length) throw new Error('No phase-1 regression tests found');
  runNodeStep('typecheck', [tools.typescript, '--noEmit'], root);
  runNodeStep('vitest', [tools.vitest, 'run'], root);
  runNodeStep('security-regressions', ['--test', ...regressions], root);
  runNodeStep('standalone-gateway', [tools.typescript, '-p', 'tsconfig.gateway.json'], root);
}

module.exports = { isolatedEnvironment, runNodeStep, verifyCore };
if (require.main === module) {
  try { verifyCore(); }
  catch (error) {
    console.error(`[phase1-verify] BLOCKED: ${error.message}`);
    process.exitCode = 1;
  }
}
