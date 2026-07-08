// Compare pages/*.js and js/*.js on disk against the <script> tags in
// index.html. Page modules are independent (each only writes into
// window.HHVC_PAGES), so tag *order* doesn't matter for pages/*.js — only
// that every page file has a tag and every tag points at a real file. The
// same membership-only check applies to js/*.js: script *order* matters for
// correctness at runtime (see CLAUDE.md's script load order section), but
// that ordering is reviewed by hand same as it always has been — this check
// only catches a missing or stale <script> tag. js/vendor/*.js files are
// naturally excluded: the regex only matches a single path segment after
// the prefix, so a nested path like js/vendor/fuse.js never matches.
// Split out as pure functions so they're testable without touching the real
// index.html (see tests/index-html-checks.test.js).

function findScriptTagsWithPrefix(html, prefix) {
  const tags = []
  const re = new RegExp(`<script src="(${prefix}[\\w-]+\\.js)"><\\/script>`, 'g')
  let match
  while ((match = re.exec(html))) {
    tags.push(match[1])
  }
  return tags
}

/**
 * Extract `pages/*.js` script src paths referenced by an index.html string.
 * @param {string} html
 * @returns {string[]}
 */
function findPageScriptTags(html) {
  return findScriptTagsWithPrefix(html, 'pages/')
}

/**
 * Extract `js/*.js` script src paths referenced by an index.html string
 * (excluding nested paths such as js/vendor/*.js).
 * @param {string} html
 * @returns {string[]}
 */
function findJsScriptTags(html) {
  return findScriptTagsWithPrefix(html, 'js/')
}

/**
 * @param {string[]} filesOnDisk repo-relative paths, e.g. 'pages/foo.js'
 * @param {string[]} scriptTagsInHtml repo-relative paths parsed from index.html
 * @returns {{missingFromHtml: string[], missingFromDisk: string[]}}
 */
function findScriptTagDrift(filesOnDisk, scriptTagsInHtml) {
  const inHtml = new Set(scriptTagsInHtml)
  const onDisk = new Set(filesOnDisk)
  return {
    missingFromHtml: filesOnDisk.filter((file) => !inHtml.has(file)),
    missingFromDisk: scriptTagsInHtml.filter((file) => !onDisk.has(file)),
  }
}

module.exports = { findPageScriptTags, findJsScriptTags, findScriptTagDrift }
