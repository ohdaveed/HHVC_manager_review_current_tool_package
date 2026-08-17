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
  findExternalAssetUrls,
  findUnmappedSections,
  countUnverifiedClaims,
} = require('./data-checks')
const { UNRESOLVED } = require('../js/karl-blocks.js')
const { findUnmooredNotes, findWrongTypeNotes } = require('./karl-vocabulary')
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

const externalAssets = findExternalAssetUrls(parsed.data.pages)
if (externalAssets.length) {
  const { pageKey, path, url } = externalAssets[0]
  throw new Error(
    `${pageKey} ${path} loads an image from another host: ${url}\n` +
      'Inline it as a data: URI or serve it locally — a hotlinked image breaks ' +
      'offline review and makes this page’s PNG export depend on a third party.'
  )
}

// Content with no Karl destination. A KNOWN unmappable shape passes, because
// the unresolved register documents it and someone is waiting on a decision; a
// NEW one fails, because authoring content the CMS cannot hold is exactly what
// this tool exists to catch and noticing it after approval is too late.
const unmapped = findUnmappedSections(parsed.data.pages, UNRESOLVED)
if (unmapped.length) {
  const { pageKey, path, reason } = unmapped[0]
  throw new Error(
    `${pageKey} ${path} has no documented Karl destination: ${reason}\n` +
      'Either map it in js/karl-blocks.js, or open an entry in the unresolved ' +
      'register in docs/karl-export-field-map.md and add its shape rule there. ' +
      'Do not widen an existing rule to cover it — a rule is an exemption for ' +
      `one documented open question, not a category. (${unmapped.length} finding(s) total.)`
  )
}

// **A `karl` note that names a field the page's own content type does not have
// is a wrong instruction, not a typo.** It reads as precise — it names real
// Karl constructs — and it sends whoever rebuilds the page looking for controls
// that are not on the form. `sectionSchema` requires the field and checks only
// `min(1)`, so nothing else can catch this.
//
// Reported before the wrong-type list because a note naming NOTHING on its form
// is the broader failure; the wrong-type finding is a sharper subset of it and
// names the type the term really belongs to.
const wrongType = findWrongTypeNotes(parsed.data.pages)
if (wrongType.length) {
  const { pageKey, type, where, term, belongsTo } = wrongType[0]
  throw new Error(
    `${pageKey} (${type}) ${where}: the karl note names "${term}", which belongs to ` +
      `${belongsTo.join(', ')} and not to ${type}.\n` +
      "Correct the note against that type's table in docs/karl-export-field-map.md, " +
      'or — if the mapping genuinely does not exist — say so in the note, citing the ' +
      `register entry that records it. (${wrongType.length} finding(s) total.)`
  )
}

const unmoored = findUnmooredNotes(parsed.data.pages)
if (unmoored.length) {
  const { pageKey, type, where, karl } = unmoored[0]
  throw new Error(
    `${pageKey} (${type}) ${where}: the karl note names no field on the ${type} form.\n` +
      `  ${karl.slice(0, 140)}\n` +
      "Name the panel it maps to, using that type's table in " +
      'docs/karl-export-field-map.md — or, if there is no mapping, declare it the ' +
      'way the rest of the corpus does ("no clean mapping", "flag for Digital ' +
      `Services", "BLOCKED"). (${unmoored.length} finding(s) total.)`
  )
}

const unverifiedCount = countUnverifiedClaims(parsed.data.pages)
console.log(
  'validated',
  Object.keys(parsed.data.pages).length,
  'pages,',
  unverifiedCount,
  'unverified claims flagged'
)
