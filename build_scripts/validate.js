// Validate the HHVC page data model before inventory exports or single-file builds.
// This loads the browser-style page modules in a Node VM context, then enforces
// required fields and shape constraints with Zod so bad page data fails fast.
const fs = require('fs')
const path = require('path')
const { dataSchema } = require('./schema')
const { loadPageData, getPageScriptPaths, getJsScriptPaths, root } = require('./load-pages')
const {
  findMissingOrderKeys,
  findBrokenCardTargets,
  findBrokenButtonTargets,
  isTopicPageFirst,
  findBannedTerms,
  findListFormatViolations,
  countUnverifiedClaims,
} = require('./data-checks')
const { findPageScriptTags, findJsScriptTags, findScriptTagDrift } = require('./index-html-checks')

const pageFilesOnDisk = getPageScriptPaths().filter((file) => file !== 'js/page-data.js')
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
const scriptDrift = findScriptTagDrift(pageFilesOnDisk, findPageScriptTags(indexHtml))
if (scriptDrift.missingFromHtml.length) {
  throw new Error(
    'pages/*.js file(s) missing a <script> tag in index.html: ' +
      scriptDrift.missingFromHtml.join(', ')
  )
}
if (scriptDrift.missingFromDisk.length) {
  throw new Error(
    'index.html references pages/*.js file(s) that no longer exist: ' +
      scriptDrift.missingFromDisk.join(', ')
  )
}

const jsFilesOnDisk = getJsScriptPaths()
const jsScriptDrift = findScriptTagDrift(jsFilesOnDisk, findJsScriptTags(indexHtml))
if (jsScriptDrift.missingFromHtml.length) {
  throw new Error(
    'js/*.js file(s) missing a <script> tag in index.html: ' +
      jsScriptDrift.missingFromHtml.join(', ')
  )
}
if (jsScriptDrift.missingFromDisk.length) {
  throw new Error(
    'index.html references js/*.js file(s) that no longer exist: ' +
      jsScriptDrift.missingFromDisk.join(', ')
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

const keys = new Set(Object.keys(parsed.data.pages))
if (!keys.has('pestsTopic')) throw new Error('pestsTopic missing')
if (keys.has('agency')) throw new Error('old agency key still present')
if (!isTopicPageFirst(parsed.data.order)) throw new Error('Topic page not first')

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

const bannedTerms = ['plumbing', 'dbi', 'roof leak', 'sewer', 'permit issue', 'construction defect']
const foundBannedTerms = findBannedTerms(parsed.data.pages.pestsTopic, bannedTerms)
if (foundBannedTerms.length) throw new Error('Topic page banned term: ' + foundBannedTerms[0])

const listFormatViolations = findListFormatViolations(parsed.data.pages)
if (listFormatViolations.length) {
  const { pageKey, path, count } = listFormatViolations[0]
  throw new Error(`${pageKey} ${path} has ${count} items; use bullets[] for lists of 3 or more`)
}

const unverifiedCount = countUnverifiedClaims(parsed.data.pages)
console.log(
  'validated',
  Object.keys(parsed.data.pages).length,
  'pages,',
  unverifiedCount,
  'unverified claims flagged'
)
