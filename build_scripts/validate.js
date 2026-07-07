// Validate the HHVC page data model before inventory exports or single-file builds.
// This loads the browser-style page modules in a Node VM context, then enforces
// required fields and shape constraints with Zod so bad page data fails fast.
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const { dataSchema } = require('./schema')
const { VM_DATA_FILES, assertIndexHtmlScriptSync } = require('./page-files')
const {
  findMissingOrderKeys,
  findBrokenCardTargets,
  findBrokenButtonTargets,
  isTopicPageFirst,
  findBannedTerms,
  findListFormatViolations,
  findInformationTableViolations,
  findResourceCollectionBodyGaps,
  findAccordionViolations,
  findStepByStepLimitViolations,
} = require('./data-checks')

const root = path.resolve(__dirname, '..')
assertIndexHtmlScriptSync(root, fs, path)

const ctx = { window: {} }
ctx.window.HHVC_PAGES = {}
vm.createContext(ctx)

for (const f of VM_DATA_FILES) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f })
}

const data = ctx.window.HHVC_DATA
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

const informationTableViolations = findInformationTableViolations(parsed.data.pages)
if (informationTableViolations.length) {
  throw new Error(`${informationTableViolations[0].pageKey} has a table on an Information page`)
}

const resourceCollectionGaps = findResourceCollectionBodyGaps(parsed.data.pages)
if (resourceCollectionGaps.length) {
  throw new Error(`${resourceCollectionGaps[0].pageKey} Resource collection has no body assets`)
}

const accordionViolations = findAccordionViolations(parsed.data.pages)
if (accordionViolations.length) {
  const { pageKey, count } = accordionViolations[0]
  throw new Error(`${pageKey} has ${count} accordions in a section (max 5)`)
}

const stepByStepLimitViolations = findStepByStepLimitViolations(parsed.data.pages)
if (stepByStepLimitViolations.length) {
  const { pageKey, count } = stepByStepLimitViolations[0]
  throw new Error(`${pageKey} has ${count} steps (max 15 for Step-by-step)`)
}

if (keys.size !== VM_DATA_FILES.length - 1) {
  throw new Error(
    `page module count (${keys.size}) does not match page-files.js (${VM_DATA_FILES.length - 1}). ` +
      'Add missing keys to js/page-data.js or remove stale modules.'
  )
}

console.log('validated', Object.keys(parsed.data.pages).length, 'pages')
