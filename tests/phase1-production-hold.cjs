const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../vercel.json'), 'utf8'));

test('main production deployment is enabled after migration verification', () => {
  assert.equal(config.git?.deploymentEnabled?.main, true);
});
test('feature-branch previews remain enabled by default', () => {
  assert.deepEqual(config.git?.deploymentEnabled, { main: true });
});
test('production deployment does not weaken the existing verification gate', () => {
  assert.equal(config.buildCommand, 'node scripts/verify-core.cjs && npm run build');
  assert.equal(config.framework, 'nextjs');
});
