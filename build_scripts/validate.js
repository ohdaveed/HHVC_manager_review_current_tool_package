// Validate the HHVC page data model before inventory exports or single-file builds.
// This loads the browser-style page modules in a Node VM context, then enforces
// required fields and shape constraints with Zod so bad page data fails fast.
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const { dataSchema } = require('./schema')
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
const ctx = { window: {} }
ctx.window.HHVC_PAGES = {}
vm.createContext(ctx)

// Page modules to execute in the shared VM context. `js/app.js` is intentionally
// excluded because it expects the full DOM and runtime globals.
const files = [
  'pages/agency-service-grouping.js',
  'pages/prevent-problems.js',
  'pages/report-a-problem.js',
  'pages/lookup-building-records.js',
  'pages/lookup-complaints-inspections.js',
  'pages/lookup-residential-violations.js',
  'pages/lookup-residential-hotel-records.js',
  'pages/find-district-inspector.js',
  'pages/public-records-request.js',
  'pages/property-owner-responsibilities.js',
  'pages/respond-to-notice-of-violation.js',
  'pages/report-rats-or-mice.js',
  'pages/report-cockroaches.js',
  'pages/report-bed-bugs.js',
  'pages/bed-bug-rules-prevention.js',
  'pages/bed-bug-forms-and-guides.js',
  'pages/healthy-housing-fee-schedule.js',
  'pages/healthy-housing-fee-schedule-report.js',
  'pages/owner-forms-and-templates.js',
  'pages/directors-rules-vector-control.js',
  'pages/raccoon-latrine-cleanup.js',
  'pages/mite-treatment-steps.js',
  'pages/report-mosquitoes.js',
  'pages/report-dead-bird.js',
  'pages/report-pigeons.js',
  'pages/report-garbage-clutter.js',
  'pages/report-overgrown-vegetation.js',
  'pages/report-mold-humidity-condensation.js',
  'pages/hhvc-inspection-scope.js',
  'pages/integrated-pest-management-property-managers.js',
  'pages/what-happens-after-report.js',
  'pages/tenant-rights-reporting.js',
  'pages/keep-rats-and-mice-out.js',
  'pages/prevent-cockroaches.js',
  'pages/prevent-mosquitoes.js',
  'pages/prevent-overgrown-vegetation.js',
  'pages/prevent-garbage-clutter.js',
  'pages/mosquito-control-program.js',
  'pages/mosquito-education-workshop.js',
  'pages/raccoon-information.js',
  'pages/pigeon-information.js',
  'pages/mite-information.js',
  'pages/ground-wasp-information.js',
  'pages/fly-information.js',
  'pages/pay-healthy-housing-fee.js',
  'pages/reduce-indoor-moisture.js',
  'js/page-data.js',
  'js/app.js',
]
for (const f of files.filter((f) => f !== 'js/app.js')) {
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

console.log('validated', Object.keys(parsed.data.pages).length, 'pages')
