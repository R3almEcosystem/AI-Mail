const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadModule } = require('./module-loader.cjs');
test('web build resolves canonical gateway NodeNext .js imports to TypeScript sources', () => {
  const config = loadModule('next.config.ts').default;
  const resolved = config.webpack({resolve:{extensionAlias:{'.other':['.other']}}});
  assert.deepEqual(resolved.resolve.extensionAlias['.js'],['.ts','.tsx','.js']);
  assert.deepEqual(resolved.resolve.extensionAlias['.other'],['.other']);
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname,'../package.json'),'utf8'));
  assert.ok(pkg.scripts.build.includes('--webpack'));
  assert.ok(pkg.scripts.dev.includes('--webpack'));
});
