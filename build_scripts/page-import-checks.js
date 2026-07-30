// Compare pages/*.js on disk against the side-effect imports in
// js/page-data.js.
//
// This replaces the old index.html <script>-tag drift check. Before the Vite
// migration, every page and every js/*.js module needed a hand-written
// <script> tag, and a file with no tag — or a tag pointing at a deleted file
// — was a silent breakage that only showed up as a missing page in the UI.
//
// The bundler removed half of that problem and kept the other half. An import
// naming a file that does not exist is now a hard build error, so
// `missingFromDisk` can no longer reach production. But a page file that
// nobody imports still fails silently: it simply never registers itself onto
// window.HHVC_PAGES, so the page vanishes from the tool with no error
// anywhere. `missingFromImports` is that case, and it is the reason this
// check survived the migration instead of being deleted with index.html's
// tag list.
//
// Order is deliberately not checked. Page modules are independent — each only
// writes into window.HHVC_PAGES — so the sequence of imports carries no
// meaning; navigation order comes from the `order` array in js/page-data.js,
// which the schema and `findMissingOrderKeys` validate separately.
//
// Split out as pure functions so they are testable without touching the real
// js/page-data.js (see tests/page-import-checks.test.js).

/**
 * Extract the `pages/*.js` paths imported for side effects by a
 * js/page-data.js source string, normalized to repo-relative form.
 *
 * Matches `import '../pages/foo.js'` and returns `pages/foo.js`, so the
 * result can be compared directly against a fast-glob listing.
 * @param {string} source contents of js/page-data.js
 * @returns {string[]}
 */
function findPageImports(source) {
  const imports = []
  const re = /^import\s+'\.\.\/(pages\/[\w-]+\.js)'\s*$/gm
  let match
  while ((match = re.exec(source))) {
    imports.push(match[1])
  }
  return imports
}

/**
 * @param {string[]} filesOnDisk repo-relative paths, e.g. 'pages/foo.js'
 * @param {string[]} importsInPageData repo-relative paths parsed from js/page-data.js
 * @returns {{missingFromImports: string[], missingFromDisk: string[]}}
 */
function findPageImportDrift(filesOnDisk, importsInPageData) {
  const imported = new Set(importsInPageData)
  const onDisk = new Set(filesOnDisk)
  return {
    missingFromImports: filesOnDisk.filter((file) => !imported.has(file)),
    missingFromDisk: importsInPageData.filter((file) => !onDisk.has(file)),
  }
}

module.exports = { findPageImports, findPageImportDrift }
