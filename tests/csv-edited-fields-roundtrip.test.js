// Round-trip coverage for Task 9: edited_title/edited_summary as CSV
// columns in all three enumerations that previously omitted them
// (js/manager-review-export.js's MANAGER_REVIEW_RECORD_FIELDS,
// js/ux-improvements-export.js's exportSavedLocalReviewsCsv, and
// js/review-queue-import.js's importReviewsFromCsvText field list).
//
// CLAUDE.md's "Local persistence" section requires any change touching the
// import/export round trip to be verified against the round trip itself,
// not just against the individual functions in isolation — an export test
// and an import test that each pass in isolation would NOT catch a column
// added to one enumeration but misspelled or omitted in another. This file
// therefore drives an actual export -> CSV text -> actual import, using the
// REAL functions rather than hand-rolling the merge, mirroring the standard
// this repo already applies to tests/e2e/import-export.spec.js.
//
// All three modules under test are self-mounting IIFEs with no
// module.exports (js/manager-review-export.js is an ES module with real
// `import`s from js/state.js; the other two read window.utils/window.reviewState
// at mount time), so each test builds a fresh window via dynamic import()
// with a cache-busting query string -- the same pattern
// tests/inline-content-edit-refresh.test.js and
// tests/inline-content-edit-roundtrip.test.js use for the same reason.
// js/review-merge.js is dual-export (window/module.exports, see its header
// comment), so the REAL mergeReviewRecord is required directly rather than
// stubbed -- a stubbed merge would not prove the two enumerations actually
// agree on the field name.
const { describe, test, expect, beforeEach, afterEach } = require('bun:test')
const path = require('path')
const realUtils = require('../js/utils.js')
const realReviewMerge = require('../js/review-merge.js')

const MANAGER_REVIEW_EXPORT_PATH = path.resolve(__dirname, '../js/manager-review-export.js')
const UX_IMPROVEMENTS_EXPORT_PATH = path.resolve(__dirname, '../js/ux-improvements-export.js')
const REVIEW_QUEUE_STATE_PATH = path.resolve(__dirname, '../js/review-queue-state.js')
const REVIEW_QUEUE_IMPORT_PATH = path.resolve(__dirname, '../js/review-queue-import.js')

let originalWindow

beforeEach(() => {
  originalWindow = global.window
})

afterEach(() => {
  global.window = originalWindow
})

/**
 * Build a single-page HHVC_DATA fixture. Both the edited-in-browser page
 * object (page.title/page.summary, what a click-to-edit session mutates
 * live per Task 6) and the ORIGINAL_DATA pristine copy are included, since
 * js/state.js's module graph expects both.
 */
function buildData(overrides = {}) {
  const page = {
    slug: 'test-page',
    type: 'Information',
    title: 'Edited Title From Mockup',
    summary: 'Edited summary from mockup.',
    reading: 'Grade 6',
    ...overrides,
  }
  return {
    pages: { testPage: page },
    order: [['testPage', 'Test Page']],
  }
}

/**
 * Mount js/manager-review-export.js against a real happy-dom document with
 * the sidebar input fields it reads.
 *
 * js/state.js is a real, non-cache-busted `import` from
 * js/manager-review-export.js -- Bun's ESM loader evaluates a given module
 * path exactly once per process, so by the time this test file runs,
 * js/state.js has already been evaluated by an earlier test file's own
 * import chain (module graphs across this repo's own suite pull it in
 * transitively) against the REAL window.HHVC_DATA the happy-dom preload
 * built from pages/*.js. Its `currentPageKey`/`pageData` bindings are
 * therefore fixed at the real 'pestsTopic' page for the rest of the
 * process -- reassigning window.HHVC_DATA here does nothing, since
 * js/manager-review-export.js's `import { pageData } from './state.js'`
 * already resolved to the first-evaluated module instance (confirmed
 * empirically: a synthetic testPage fixture was read back as the real
 * page's title).
 *
 * Rather than fight the singleton, this mutates the REAL pageData.pestsTopic
 * object in place (exactly what Task 6's click-to-edit does to the live page
 * object at runtime) and restores it in the returned `restore()` so this
 * test cannot leak edited title/summary into any test file that runs after
 * it in the same process.
 */
async function mountManagerReviewExport({ title, summary } = {}) {
  document.body.innerHTML = `
    <input id="reviewDateInput" value="2026-08-08" />
    <input id="reviewerInput" value="Test Reviewer" />
    <input id="urlInput" value="" />
    <input id="reviewDecision" value="Needs review" />
    <textarea id="reviewNotes"></textarea>
    <textarea id="reviewRisks"></textarea>
    <input id="seoTitleInput" value="" />
    <textarea id="metaDescriptionInput"></textarea>
    <div id="reviewExportStatus"></div>
  `
  global.window = window
  window.showToast = () => {}

  const modUrl = `${MANAGER_REVIEW_EXPORT_PATH}?t=${Date.now()}-${Math.random()}`
  await import(modUrl)

  const pageData = window.HHVC_DATA.pages
  const originalTitle = pageData.pestsTopic.title
  const originalSummary = pageData.pestsTopic.summary
  if (title !== undefined) pageData.pestsTopic.title = title
  if (summary !== undefined) pageData.pestsTopic.summary = summary

  return {
    ReviewExport: window.ReviewExport,
    restore: () => {
      pageData.pestsTopic.title = originalTitle
      pageData.pestsTopic.summary = originalSummary
    },
  }
}

/**
 * Mount js/ux-improvements-export.js and js/manager-review-export.js's
 * sibling dependencies (window.reviewState, window.reviewMerge,
 * window.ReviewUx.stateSync) against a shared in-memory state store, so
 * exportSavedLocalReviewsCsv can read window.reviewState.read() the same
 * way it does in the browser.
 */
async function mountUxImprovementsExport({ savedPages = {} } = {}) {
  const DATA = buildData()
  let state = {
    version: 1,
    updated_at: '',
    ui: {},
    globals: { reviewer: 'Global Reviewer' },
    pages: savedPages,
  }

  document.body.innerHTML = '<div id="reviewExportStatus"></div>'
  global.window = window
  window.HHVC_DATA = DATA
  window.utils = realUtils
  window.reviewState = {
    read: () => state,
    update: (updater) => {
      state = updater(state)
      return state
    },
  }
  window.reviewMerge = realReviewMerge
  window.ReviewUx = {
    stateSync: {
      // exportSavedLocalReviewsCsv calls this unconditionally before reading
      // state; a no-op is sufficient here since this suite seeds
      // window.reviewState directly rather than through live form fields.
      saveCurrentPageToLocalStorage: () => {},
    },
  }
  window.showToast = () => {}

  const modUrl = `${UX_IMPROVEMENTS_EXPORT_PATH}?t=${Date.now()}-${Math.random()}`
  await import(modUrl)

  return { readState: () => state, DATA }
}

/**
 * Mount the REAL js/review-queue-state.js (for a real
 * updateLocalReviewForPage backed by the real mergeReviewRecord) plus the
 * REAL js/review-queue-import.js on top of it, against one shared
 * window.reviewState store. This is the import half of the round trip --
 * driving importReviewsFromCsvText for real, not a hand-rolled merge.
 */
async function mountReviewQueueImport({ savedPages = {} } = {}) {
  const DATA = buildData()
  let state = {
    version: 1,
    updated_at: '',
    ui: {},
    globals: {},
    pages: savedPages,
  }

  document.body.innerHTML = `
    <input id="reviewerInput" value="" />
    <input id="reviewDateInput" value="" />
  `
  global.window = window
  window.HHVC_DATA = DATA
  window.utils = realUtils
  window.reviewState = {
    read: () => state,
    update: (updater) => {
      state = updater(state)
      return state
    },
  }
  window.reviewMerge = realReviewMerge
  window.renderPage = () => {}
  window.showToast = () => {}
  // review-queue-import.js requires window.ReviewQueueInternal.render to
  // exist as its mount guard, and calls .renderReviewQueue() after a
  // successful import -- both are UI-repaint side effects out of scope for
  // this CSV-column test, so a no-op stub is sufficient.
  window.ReviewQueueInternal = { render: { renderReviewQueue: () => {} } }

  const stateModUrl = `${REVIEW_QUEUE_STATE_PATH}?t=${Date.now()}-${Math.random()}`
  await import(stateModUrl)

  const importModUrl = `${REVIEW_QUEUE_IMPORT_PATH}?t=${Date.now()}-${Math.random()}`
  await import(importModUrl)

  return {
    importReviewsFromCsvText: window.ReviewQueueInternal.importCsv.importReviewsFromCsvText,
    readState: () => state,
  }
}

/**
 * Runs `triggerExport` and captures the CSV text passed to downloadFile's
 * underlying Blob, without needing a click-driven browser download.
 *
 * Both js/manager-review-export.js (an ES module `import`) and
 * js/ux-improvements-export.js (destructures `downloadFile` from
 * window.utils at mount time) capture their own local reference to
 * downloadFile before this function ever runs, so monkeypatching
 * window.utils.downloadFile afterward does not intercept either call --
 * confirmed empirically (both such attempts failed with capturedCsv still
 * null). URL.createObjectURL is the one seam every path shares regardless of
 * import style, since js/utils.js's downloadBlob() always routes through it.
 * @param {() => void} triggerExport
 * @returns {Promise<string>} the exported CSV text
 */
async function captureDownloadedCsv(triggerExport) {
  const originalCreateObjectURL = URL.createObjectURL
  let capturedBlob = null
  URL.createObjectURL = (blob) => {
    capturedBlob = blob
    return originalCreateObjectURL.call(URL, blob)
  }
  try {
    triggerExport()
  } finally {
    URL.createObjectURL = originalCreateObjectURL
  }
  expect(capturedBlob).not.toBeNull()
  return capturedBlob.text()
}

describe('current-page CSV export carries edited_title/edited_summary', () => {
  test('ReviewExport.currentCsv header row and data row include the edited fields with live values', async () => {
    const { ReviewExport, restore } = await mountManagerReviewExport({
      title: 'Live Edited Title',
      summary: 'Live edited summary text.',
    })

    try {
      const capturedCsv = await captureDownloadedCsv(() => ReviewExport.currentCsv())

      const rows = realUtils.parseCsv(capturedCsv)
      const headers = rows[0]
      expect(headers).toContain('edited_title')
      expect(headers).toContain('edited_summary')
      // section_edits must NOT appear in CSV -- it's the documented
      // JSON-backup-only limitation this task's constraints call out.
      expect(headers).not.toContain('section_edits')

      const dataRow = rows[1]
      const editedTitleIndex = headers.indexOf('edited_title')
      const editedSummaryIndex = headers.indexOf('edited_summary')
      expect(dataRow[editedTitleIndex]).toBe('Live Edited Title')
      expect(dataRow[editedSummaryIndex]).toBe('Live edited summary text.')
    } finally {
      restore()
    }
  })
})

describe('all-saved-reviews CSV export carries edited_title/edited_summary', () => {
  test('exportSavedLocalReviewsCsv header and row include the saved edited fields', async () => {
    const { readState } = await mountUxImprovementsExport({
      savedPages: {
        testPage: realUtils.buildReviewRecord(
          { title: 'Original', summary: 'Original summary' },
          'testPage',
          {
            edited_title: 'Saved Edited Title',
            edited_summary: 'Saved edited summary.',
            decision: 'Approved',
          }
        ),
      },
    })

    // window.ReviewExport is not involved here -- exportSavedLocalReviewsCsv
    // is published on window.ReviewUx.exportImport by this module; call it
    // via that surface (mirrors how js/review-queue.js's export button
    // wiring reaches it in the browser).
    const capturedCsv = await captureDownloadedCsv(() =>
      window.ReviewUx.exportImport.exportSavedLocalReviewsCsv()
    )

    const rows = realUtils.parseCsv(capturedCsv)
    const headers = rows[0]
    expect(headers).toContain('edited_title')
    expect(headers).toContain('edited_summary')
    expect(headers).not.toContain('section_edits')

    const dataRow = rows[1]
    const editedTitleIndex = headers.indexOf('edited_title')
    const editedSummaryIndex = headers.indexOf('edited_summary')
    expect(dataRow[editedTitleIndex]).toBe('Saved Edited Title')
    expect(dataRow[editedSummaryIndex]).toBe('Saved edited summary.')
    void readState
  })
})

describe('CSV import reads edited_title/edited_summary back into saved review state', () => {
  test('importReviewsFromCsvText merges a non-empty edited_title/edited_summary cell into the saved record', async () => {
    const { importReviewsFromCsvText, readState } = await mountReviewQueueImport()

    const csvText = realUtils.toCsv([
      ['page_key', 'edited_title', 'edited_summary', 'decision'],
      ['testPage', 'Imported Title', 'Imported summary text.', 'Approved'],
    ])

    const importedCount = importReviewsFromCsvText(csvText)

    expect(importedCount).toBe(1)
    const saved = readState().pages.testPage
    expect(saved.edited_title).toBe('Imported Title')
    expect(saved.edited_summary).toBe('Imported summary text.')
    // Proves this went through the real mergeReviewRecord (which appends a
    // history entry for an 'import'-tagged round), not a stub.
    expect(saved.history.at(-1).updated_by).toBe('import')
  })

  test('a blank edited_title/edited_summary cell does not overwrite an existing saved value (merge, not wipe)', async () => {
    const existing = realUtils.buildReviewRecord(
      { title: 'Original', summary: 'Original summary' },
      'testPage',
      {
        edited_title: 'Previously Saved Title',
        edited_summary: 'Previously saved summary.',
        decision: 'Approved',
        notes: 'Existing notes',
      }
    )
    const { importReviewsFromCsvText, readState } = await mountReviewQueueImport({
      savedPages: { testPage: existing },
    })

    // A CSV row with edited_title/edited_summary present as columns but
    // blank cells, and a real field (notes) actually changing -- this is the
    // shape a reviewer's partial re-export/re-import produces, and it must
    // not blank out the previously-saved edited fields (the CSV/JSON import
    // path's core "merge, never wipe" invariant, extended to these two new
    // columns).
    const csvText = realUtils.toCsv([
      ['page_key', 'edited_title', 'edited_summary', 'notes'],
      ['testPage', '', '', 'Updated notes only'],
    ])

    const importedCount = importReviewsFromCsvText(csvText)

    expect(importedCount).toBe(1)
    const saved = readState().pages.testPage
    expect(saved.edited_title).toBe('Previously Saved Title')
    expect(saved.edited_summary).toBe('Previously saved summary.')
    expect(saved.notes).toBe('Updated notes only')
  })
})

describe('full export -> import round trip carries edited_title/edited_summary end to end', () => {
  test('exporting the all-saved-reviews CSV and re-importing it through the real import path preserves edited_title/edited_summary', async () => {
    // Step 1: export. Build a saved-state record with real edited fields and
    // run it through the REAL exportSavedLocalReviewsCsv.
    const { readState: readExportState } = await mountUxImprovementsExport({
      savedPages: {
        testPage: realUtils.buildReviewRecord(
          { title: 'Original', summary: 'Original summary' },
          'testPage',
          {
            edited_title: 'Round Trip Title',
            edited_summary: 'Round trip summary text.',
            decision: 'Approved',
            notes: 'Some notes',
          }
        ),
      },
    })

    const exportedCsv = await captureDownloadedCsv(() =>
      window.ReviewUx.exportImport.exportSavedLocalReviewsCsv()
    )
    void readExportState

    // Step 2: import. Mount a FRESH review-queue-state/import pair (a
    // separate browser session re-importing the file) with no prior saved
    // state for testPage, and feed it the CSV text step 1 actually produced.
    const { importReviewsFromCsvText, readState: readImportState } = await mountReviewQueueImport()

    const importedCount = importReviewsFromCsvText(exportedCsv)

    expect(importedCount).toBe(1)
    const saved = readImportState().pages.testPage
    expect(saved.edited_title).toBe('Round Trip Title')
    expect(saved.edited_summary).toBe('Round trip summary text.')
    expect(saved.decision).toBe('Approved')
    expect(saved.notes).toBe('Some notes')
  })
})
