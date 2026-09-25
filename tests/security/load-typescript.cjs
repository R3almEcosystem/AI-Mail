const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
// Execute the exact production module, replacing only explicitly named dependencies.
module.exports = function loadTypescript(filename, dependencies = {}) {
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, { fileName: filename, compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
    jsx: ts.JsxEmit.ReactJSX,
  }}).outputText;
  const module = { exports: {} };
  const localRequire = name => {
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    if (name.startsWith('node:')) return require(name);
    throw new Error(`Unexpected test dependency: ${name}`);
  };
  vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`, { filename })(localRequire, module, module.exports);
  return module.exports;
};
