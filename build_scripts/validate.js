// Validate the HHVC page data model before inventory exports or single-file builds.
// This loads the browser-style page modules in a Node VM context, then enforces
// required fields and shape constraints with Zod so bad page data fails fast.
const fs = require('fs')
const path = require('path')
const { dataSchema } = require('./schema')
const { loadPageData, getPageScriptPaths, root } = require('./load-pages')
const {
  findMissingOrderKeys,
  findBrokenCardTargets,
  findBrokenButtonTargets,
  findBrokenInlineLinks,
  isTopicPageFirst,
  findBannedTerms,
  findListFormatViolations,
  findUnsafeUrls,
  countUnverifiedClaims,
} = require('./data-checks')
const { findPageImports, findPageImportDrift } = require('./page-import-checks')

// A page file nobody imports never registers onto window.HHVC_PAGES, so the
// page silently disappears from the tool. Vite catches the opposite case (an
// import naming a file that does not exist) as a build error, but not this
// one — see build_scripts/page-import-checks.js.
const pageFilesOnDisk = getPageScriptPaths().filter((file) => file !== 'js/page-data.js')
const pageDataSource = fs.readFileSync(path.join(root, 'js/page-data.js'), 'utf8')
const importDrift = findPageImportDrift(pageFilesOnDisk, findPageImports(pageDataSource))
if (importDrift.missingFromImports.length) {
  throw new Error(
    'pages/*.js file(s) never imported by js/page-data.js: ' +
      importDrift.missingFromImports.join(', ')
  )
}
if (importDrift.missingFromDisk.length) {
  throw new Error(
    'js/page-data.js imports pages/*.js file(s) that no longer exist: ' +
      importDrift.missingFromDisk.join(', ')
  )
}

const data = loadPageData()
const parsed = dataSchema.safeParse(data)
if (!parsed.success) {
  console.error('Validation errors:')
  for (const issue of parsed.success === false ? parsed.error.issues : []) {
    console.error(`- ${issue.path.join('.') || 'root'}: ${issue.message}`)
  }
  process.exit(1)
}

// The main HHVC Agency page keeps the key `pestsTopic` (held over from the
// Topic-page era) so invariants, tests, and saved review state stay stable.
// The bare `agency` key stays banned so nobody "fixes" the key name and
// breaks that stability.
const keys = new Set(Object.keys(parsed.data.pages))
if (!keys.has('pestsTopic')) throw new Error('pestsTopic missing')
if (keys.has('agency')) throw new Error('old agency key still present')
if (!isTopicPageFirst(parsed.data.order)) throw new Error('Agency page (pestsTopic) not first')

const missingOrderKeys = findMissingOrderKeys(parsed.data.pages, parsed.data.order)
if (missingOrderKeys.length) throw new Error('order key missing: ' + missingOrderKeys[0])

const brokenCardTargets = findBrokenCardTargets(parsed.data.pages)
if (brokenCardTargets.length) {
  const { pageKey, target } = brokenCardTargets[0]
  throw new Error(`${pageKey} links to missing target ${target}`)
}

const brokenButtonTargets = findBrokenButtonTargets(parsed.data.pages)
if (brokenButtonTargets.length) {
  const { pageKey, target } = brokenButtonTargets[0]
  throw new Error(`${pageKey} links to missing target ${target}`)
}

const brokenInlineLinks = findBrokenInlineLinks(parsed.data.pages)
if (brokenInlineLinks.length) {
  const { pageKey, target } = brokenInlineLinks[0]
  throw new Error(`${pageKey} has an inline markdown link to missing target ${target}`)
}

const bannedTerms = ['plumbing', 'dbi', 'roof leak', 'sewer', 'permit issue', 'construction defect']
const foundBannedTerms = findBannedTerms(parsed.data.pages.pestsTopic, bannedTerms)
if (foundBannedTerms.length) throw new Error('Agency page banned term: ' + foundBannedTerms[0])

const listFormatViolations = findListFormatViolations(parsed.data.pages)
if (listFormatViolations.length) {
  const { pageKey, path, count } = listFormatViolations[0]
  throw new Error(`${pageKey} ${path} has ${count} items; use bullets[] for lists of 3 or more`)
}

const unsafeUrls = findUnsafeUrls(parsed.data.pages)
if (unsafeUrls.length) {
  const { pageKey, path, url } = unsafeUrls[0]
  throw new Error(`${pageKey} ${path} has an unsafe URL scheme: ${url}`)
}

const unverifiedCount = countUnverifiedClaims(parsed.data.pages)
console.log(
  'validated',
  Object.keys(parsed.data.pages).length,
  'pages,',
  unverifiedCount,
  'unverified claims flagged'
)
