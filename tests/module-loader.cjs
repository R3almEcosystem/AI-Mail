// Test-only loader: executes repository TypeScript with external I/O adapters replaced.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function loadModule(entry, overrides = {}) {
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} }; cache.set(filename, module);
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
    }).outputText;
    const localRequire = (id) => {
      if (Object.hasOwn(overrides, id)) return overrides[id];
      if (id === 'server-only') return {};
      if (id.startsWith('@/') || id.startsWith('.')) {
        let base = id.startsWith('@/') ? path.join(__dirname, '../src', id.slice(2)) : path.resolve(path.dirname(filename), id);
        const options = [base, base.replace(/\.js$/, '.ts'), `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')];
        const resolved = options.find(p => fs.existsSync(p) && fs.statSync(p).isFile());
        if (!resolved) throw new Error(`Unresolved test import ${id} from ${filename}`);
        return load(resolved);
      }
      return require(id);
    };
    new Function('require', 'module', 'exports', '__filename', '__dirname', source)(localRequire, module, module.exports, filename, path.dirname(filename));
    return module.exports;
  }
  return load(path.resolve(__dirname, '..', entry));
}
module.exports = { loadModule };
