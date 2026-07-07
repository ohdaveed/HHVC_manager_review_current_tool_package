// Compare pages/*.js on disk against the <script> tags in index.html. Page
// modules are independent (each only writes into window.HHVC_PAGES), so tag
// *order* doesn't matter — only that every page file has a tag and every tag
// points at a real file. Split out as a pure function so it's testable
// without touching the real index.html (see tests/index-html-checks.test.js).

const SCRIPT_TAG_RE = /<script src="(pages\/[\w-]+\.js)"><\/script>/g

/**
 * Extract `pages/*.js` script src paths referenced by an index.html string.
 * @param {string} html
 * @returns {string[]}
 */
function findPageScriptTags(html) {
  const tags = []
  let match
  const re = new RegExp(SCRIPT_TAG_RE)
  while ((match = re.exec(html))) {
    tags.push(match[1])
  }
  return tags
}

/**
 * @param {string[]} pageFilesOnDisk repo-relative paths, e.g. 'pages/foo.js'
 * @param {string[]} scriptTagsInHtml repo-relative paths parsed from index.html
 * @returns {{missingFromHtml: string[], missingFromDisk: string[]}}
 */
function findScriptTagDrift(pageFilesOnDisk, scriptTagsInHtml) {
  const inHtml = new Set(scriptTagsInHtml)
  const onDisk = new Set(pageFilesOnDisk)
  return {
    missingFromHtml: pageFilesOnDisk.filter((file) => !inHtml.has(file)),
    missingFromDisk: scriptTagsInHtml.filter((file) => !onDisk.has(file)),
  }
}

module.exports = { findPageScriptTags, findScriptTagDrift }
