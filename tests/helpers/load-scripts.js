// Loads the app's classic (non-module) <script> files into a shared Node vm
// context, mirroring how index.html loads them into one shared global scope
// in the browser. Function declarations in each file become properties of
// the returned context, so callers can invoke e.g. ctx.escapeHtml(...)
// exactly as sibling scripts would in the browser. Mirrors the vm.createContext
// pattern already used by build_scripts/validate.js and extract-pages.js.
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const root = path.resolve(__dirname, '..', '..')

function createDomStub() {
  const stubElement = () => ({
    style: {},
    setAttribute() {},
    appendChild() {},
    remove() {},
  })
  return {
    addEventListener() {},
    createElement: stubElement,
    getElementById() {
      return stubElement()
    },
    body: {},
  }
}

/**
 * Execute the given repo-relative script files in one shared vm context.
 * `window` is aliased to the context itself, matching the browser's
 * `window === globalThis`, so `window.foo(...)` and bare `foo(...)` reach
 * the same top-level function/const declarations either way.
 * @param {string[]} files repo-relative paths, loaded in order
 * @returns {vm.Context}
 */
function loadScripts(files) {
  const ctx = {}
  ctx.window = ctx
  ctx.addEventListener = () => {}
  ctx.document = createDomStub()
  vm.createContext(ctx)
  for (const f of files) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f })
  }
  return ctx
}

module.exports = { loadScripts }
