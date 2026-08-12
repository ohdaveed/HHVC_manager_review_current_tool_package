// Export structured page inventory from the HHVC source data modules.
// This runs the page-definition files in a VM to avoid browser-only globals,
// then writes JSON and CSV artifacts for review and build automation.
const fs = require('fs')
const path = require('path')
const { createObjectCsvWriter } = require('csv-writer')
const { loadPageData } = require('./load-pages')
// The page-metadata helpers come from the canonical browser module rather than
// being restated here, so the exported inventory, the tracking CSVs and the
// SEO preview the reviewer actually sees cannot come to disagree about a
// page's title, description or primary CTA. Three copies of these had already
// drifted: this script's primaryCta carried the buttonStyle rule that
// sync-tracking-sheet.js's copy lacked, and its defaultSeoTitle omitted the
// `|| ''` title guard the other two had. Requiring an ES module from CommonJS
// works because every build script here runs under Bun (see package.json's
// export/sync-tracking/push-tracking scripts) — the same crossing
// build_scripts/data-checks.js already makes for safeUrl.
const { defaultSeoTitle, defaultMetaDescription, getPrimaryCta } = require('../js/utils.js')

const root = path.resolve(__dirname, '..')
const data = loadPageData()

fs.mkdirSync(path.join(root, 'data'), { recursive: true })
fs.writeFileSync(path.join(root, 'data/page_inventory.json'), JSON.stringify(data, null, 2))

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
    primaryCta: getPrimaryCta(page),
  }
})

csvWriter.writeRecords(records).then(() => {
  console.log('wrote data/page_inventory.csv')
})
