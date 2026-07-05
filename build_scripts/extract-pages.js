// Export structured page inventory from the HHVC source data modules.
// This runs the page-definition files in a VM to avoid browser-only globals,
// then writes JSON and CSV artifacts for review and build automation.
const fs = require('fs')
const vm = require('vm')
const path = require('path')
const { createObjectCsvWriter } = require('csv-writer')

const root = path.resolve(__dirname, '..')
const ctx = { window: {} }
ctx.window.HHVC_PAGES = {}
vm.createContext(ctx)

// Source page modules to evaluate. The VM context populates `window.HHVC_PAGES`
// and ultimately `window.HHVC_DATA`, which is what the app consumes at runtime.
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
]
for (const f of files) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f })
}

const data = ctx.window.HHVC_DATA
fs.mkdirSync(path.join(root, 'data'), { recursive: true })
fs.writeFileSync(path.join(root, 'data/page_inventory.json'), JSON.stringify(data, null, 2))

// Mirrors js/utils.js's getPrimaryCta() (browser-only, not loaded into this
// script's Node VM), so the exported inventory agrees with the rendered
// review tool: skip section buttons marked buttonStyle: 'secondary'.
function primaryCta(page) {
  for (const section of page.sections || []) {
    for (const step of section.steps || []) {
      if (step.button) return step.button
    }
    if (section.button && section.buttonStyle !== 'secondary') return section.button
  }
  return page.primaryCta || ''
}

function defaultSeoTitle(page) {
  return page.seoTitle || `${page.title} | San Francisco`
}

function defaultMetaDescription(page) {
  return page.metaDescription || page.summary || ''
}

const csvWriter = createObjectCsvWriter({
  path: path.join(root, 'data/page_inventory.csv'),
  header: [
    { id: 'pageKey', title: 'Page Key' },
    { id: 'menuLabel', title: 'Menu Label' },
    { id: 'pageTitle', title: 'Page Title' },
    { id: 'pageType', title: 'Page Type' },
    { id: 'urlSlug', title: 'URL Slug' },
    { id: 'audienceCount', title: 'Audience Count' },
    { id: 'sectionCount', title: 'Section Count' },
    { id: 'readingTarget', title: 'Reading Target' },
    { id: 'seoTitle', title: 'SEO Title' },
    { id: 'metaDescription', title: 'Meta Description' },
    { id: 'primaryCta', title: 'Primary CTA' },
  ],
})

const records = data.order.map(([key, label]) => {
  const page = data.pages[key]
  return {
    pageKey: key,
    menuLabel: label,
    pageTitle: page.title || '',
    pageType: page.type || '',
    urlSlug: page.slug || '',
    audienceCount: String((page.audience || []).length),
    sectionCount: String((page.sections || []).length),
    readingTarget: page.reading || '',
    seoTitle: defaultSeoTitle(page),
    metaDescription: defaultMetaDescription(page),
    primaryCta: primaryCta(page),
  }
})

csvWriter.writeRecords(records).then(() => {
  console.log('wrote data/page_inventory.csv')
})
