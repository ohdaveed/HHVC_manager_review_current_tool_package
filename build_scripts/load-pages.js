// Discover and load HHVC page modules into a Node VM context.
// Replaces hardcoded file lists in validate.js, extract-pages.js, and tests.
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const fg = require('fast-glob')

const root = path.resolve(__dirname, '..')

/**
 * Return repo-relative paths for all page modules plus page-data.js.
 * Page files are sorted alphabetically; page-data.js is always last.
 * @returns {string[]}
 */
function getPageScriptPaths() {
  const pageFiles = fg
    .sync('pages/*.js', { cwd: root, onlyFiles: true })
    .sort((a, b) => a.localeCompare(b))
  return [...pageFiles, 'js/page-data.js']
}

/**
 * Return repo-relative paths for all js/*.js modules (excluding
 * js/vendor/*.js third-party files, which fast-glob's single-star pattern
 * naturally skips since it doesn't recurse into subdirectories).
 * @returns {string[]}
 */
function getJsScriptPaths() {
  return fg.sync('js/*.js', { cwd: root, onlyFiles: true }).sort((a, b) => a.localeCompare(b))
}

/**
 * Create a VM context with window.HHVC_PAGES ready for page modules.
 * @returns {vm.Context}
 */
function createPageContext() {
  const ctx = { window: {} }
  ctx.window.HHVC_PAGES = {}
  vm.createContext(ctx)
  return ctx
}

/**
 * Execute page script files in the given VM context.
 * @param {vm.Context} ctx
 * @param {string[]} files repo-relative paths
 * @param {{ exclude?: string[] }} [options]
 */
function runPageScripts(ctx, files, options = {}) {
  const exclude = new Set(options.exclude || [])
  for (const rel of files) {
    if (exclude.has(rel)) continue
    const abs = path.join(root, rel)
    if (!fs.existsSync(abs)) {
      throw new Error(`Page script not found: ${rel}`)
    }
    vm.runInContext(fs.readFileSync(abs, 'utf8'), ctx, { filename: rel })
  }
}

/**
 * Load all page modules and return HHVC_DATA from the VM context.
 * @param {{ exclude?: string[] }} [options]
 * @returns {object}
 */
function loadPageData(options = {}) {
  const ctx = createPageContext()
  runPageScripts(ctx, getPageScriptPaths(), options)
  return ctx.window.HHVC_DATA
}

module.exports = {
  root,
  getPageScriptPaths,
  getJsScriptPaths,
  createPageContext,
  runPageScripts,
  loadPageData,
}
