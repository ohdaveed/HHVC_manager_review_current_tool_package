// Canonical list of HHVC page modules and VM load order for build scripts.
// When adding a page: update ONLY this file, then run `bun run validate`
// (which checks index.html script tags stay in sync).
const PAGE_MODULE_FILES = [
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
]

const PAGE_DATA_FILE = 'js/page-data.js'

/** Page modules + registry — used by validate, export, and sync-tracking VM loads. */
const VM_DATA_FILES = [...PAGE_MODULE_FILES, PAGE_DATA_FILE]

function pageScriptTagsFromIndexHtml(html) {
  return [...html.matchAll(/<script src="(pages\/[^"]+\.js)"><\/script>/g)].map((m) => m[1])
}

function assertIndexHtmlScriptSync(rootDir, fs, path) {
  const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8')
  const tags = pageScriptTagsFromIndexHtml(html)
  const expected = PAGE_MODULE_FILES

  if (tags.length !== expected.length) {
    throw new Error(
      `index.html has ${tags.length} page scripts; build_scripts/page-files.js has ${expected.length}. ` +
        'Update both from the canonical page-files.js list.'
    )
  }

  for (let i = 0; i < expected.length; i++) {
    if (tags[i] !== expected[i]) {
      throw new Error(
        `index.html script order mismatch at position ${i + 1}: ` +
          `found ${tags[i]}, expected ${expected[i]}. ` +
          'Keep index.html page scripts aligned with build_scripts/page-files.js.'
      )
    }
  }
}

module.exports = {
  PAGE_MODULE_FILES,
  PAGE_DATA_FILE,
  VM_DATA_FILES,
  pageScriptTagsFromIndexHtml,
  assertIndexHtmlScriptSync,
}
