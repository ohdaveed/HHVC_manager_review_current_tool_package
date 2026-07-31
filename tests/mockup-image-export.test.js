// Coverage for the PNG export filename contract.
//
// buildFilename is the part of js/mockup-image-export.js that reviewers
// actually depend on: exports pile up in a downloads folder, and a name that
// does not sort or identify cleanly makes a batch of 19 captures useless. The
// capture itself needs a real browser and is covered by
// tests/e2e/mockup-image-export.spec.js.
const { describe, test, expect } = require('bun:test')
const { buildFilename } = require('../js/mockup-image-export.js')

describe('buildFilename', () => {
  test('combines the page key and date into a sortable PNG name', () => {
    expect(buildFilename('pestsTopic', '2026-07-31')).toBe('hhvc-pestsTopic-2026-07-31.png')
  })

  test('keeps hyphens and underscores, which real page keys contain', () => {
    expect(buildFilename('find_records-v2', '2026-07-31')).toBe(
      'hhvc-find_records-v2-2026-07-31.png'
    )
  })

  test('replaces characters that are unsafe in a filename', () => {
    // A key containing a path separator would otherwise suggest a directory to
    // the browser, and the download would land somewhere unexpected or be
    // rejected outright.
    expect(buildFilename('a/b\\c:d*e', '2026-07-31')).toBe('hhvc-a-b-c-d-e-2026-07-31.png')
  })

  test('falls back to a generic name when the page key is missing', () => {
    expect(buildFilename('', '2026-07-31')).toBe('hhvc-page-2026-07-31.png')
    expect(buildFilename(undefined, '2026-07-31')).toBe('hhvc-page-2026-07-31.png')
  })

  test('defaults to today when no date is supplied', () => {
    // Asserting the shape rather than a literal date, so the test does not
    // start failing at midnight.
    expect(buildFilename('pestsTopic')).toMatch(/^hhvc-pestsTopic-\d{4}-\d{2}-\d{2}\.png$/)
  })
})
