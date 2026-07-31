// Coverage for the pages/*.js <-> js/page-data.js import drift check used by
// build_scripts/validate.js. Replaces tests/index-html-checks.test.js, which
// covered the same drift class back when membership was expressed as
// <script> tags in index.html rather than as imports.
const { describe, test, expect } = require('bun:test')
const { findPageImports, findPageImportDrift } = require('../build_scripts/page-import-checks')

describe('findPageImports', () => {
  test('extracts page import paths in source order, normalized to repo-relative', () => {
    const source = `
import '../pages/foo.js'
import '../pages/bar.js'

window.HHVC_DATA = { pages: window.HHVC_PAGES, order: [] }
`
    expect(findPageImports(source)).toEqual(['pages/foo.js', 'pages/bar.js'])
  })

  test('ignores imports that are not page modules', () => {
    const source = `
import './utils.js'
import '../css/styles.css'
import '../pages/foo.js'
`
    expect(findPageImports(source)).toEqual(['pages/foo.js'])
  })

  test('returns an empty array when there are no page imports', () => {
    expect(findPageImports('window.HHVC_DATA = { pages: {}, order: [] }\n')).toEqual([])
  })
})

describe('findPageImportDrift', () => {
  test('reports no drift when disk and imports match, regardless of order', () => {
    const onDisk = ['pages/bar.js', 'pages/foo.js']
    const imported = ['pages/foo.js', 'pages/bar.js']
    expect(findPageImportDrift(onDisk, imported)).toEqual({
      missingFromImports: [],
      missingFromDisk: [],
    })
  })

  test('flags a page file that js/page-data.js never imports', () => {
    // The silent-failure case the check exists for: the file is on disk and
    // looks wired up, but never registers onto window.HHVC_PAGES, so the page
    // just is not in the tool.
    const onDisk = ['pages/foo.js', 'pages/new-page.js']
    const imported = ['pages/foo.js']
    const drift = findPageImportDrift(onDisk, imported)
    expect(drift.missingFromImports).toEqual(['pages/new-page.js'])
    expect(drift.missingFromDisk).toEqual([])
  })

  test('flags an import pointing at a deleted page file', () => {
    const onDisk = ['pages/foo.js']
    const imported = ['pages/foo.js', 'pages/removed-page.js']
    const drift = findPageImportDrift(onDisk, imported)
    expect(drift.missingFromImports).toEqual([])
    expect(drift.missingFromDisk).toEqual(['pages/removed-page.js'])
  })
})
