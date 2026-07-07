// Coverage for the pages/*.js <-> index.html <script> tag drift check used
// by build_scripts/validate.js.
const { describe, test, expect } = require('bun:test')
const { findPageScriptTags, findScriptTagDrift } = require('../build_scripts/index-html-checks')

describe('findPageScriptTags', () => {
  test('extracts page script src paths in document order', () => {
    const html = `
      <script src="js/utils.js"></script>
      <script src="pages/foo.js"></script>
      <script src="pages/bar.js"></script>
      <script src="js/page-data.js"></script>
    `
    expect(findPageScriptTags(html)).toEqual(['pages/foo.js', 'pages/bar.js'])
  })

  test('returns an empty array when there are no page script tags', () => {
    expect(findPageScriptTags('<script src="js/utils.js"></script>')).toEqual([])
  })
})

describe('findScriptTagDrift', () => {
  test('reports no drift when disk and html match, regardless of order', () => {
    const onDisk = ['pages/bar.js', 'pages/foo.js']
    const inHtml = ['pages/foo.js', 'pages/bar.js']
    expect(findScriptTagDrift(onDisk, inHtml)).toEqual({
      missingFromHtml: [],
      missingFromDisk: [],
    })
  })

  test('flags a page file with no <script> tag in index.html', () => {
    const onDisk = ['pages/foo.js', 'pages/new-page.js']
    const inHtml = ['pages/foo.js']
    const drift = findScriptTagDrift(onDisk, inHtml)
    expect(drift.missingFromHtml).toEqual(['pages/new-page.js'])
    expect(drift.missingFromDisk).toEqual([])
  })

  test('flags a <script> tag pointing at a deleted page file', () => {
    const onDisk = ['pages/foo.js']
    const inHtml = ['pages/foo.js', 'pages/removed-page.js']
    const drift = findScriptTagDrift(onDisk, inHtml)
    expect(drift.missingFromHtml).toEqual([])
    expect(drift.missingFromDisk).toEqual(['pages/removed-page.js'])
  })
})
