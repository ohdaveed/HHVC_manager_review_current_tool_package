// Round-trip persistence coverage for Task 7's add/remove/reset operations:
// add a bullet, remove a bullet, and reset a heading, each verified against
// the REAL section_edits recompute-on-save path (js/ux-improvements-state-sync.js's
// collectCurrentPageReviewState -> js/inline-content-edit-data.js's
// computeSectionEdits) and the REAL reapply-on-load path
// (applySavedPageState -> applyContentEditsToPageData), rather than the
// counting stubs tests/inline-content-edit.test.js uses for its click-behavior
// assertions. CLAUDE.md's "Local persistence" section requires this: "Any
// change to any of these modules...must be verified against the round trip
// itself before being called done."
//
// js/inline-content-edit.js and js/ux-improvements-state-sync.js are both
// self-mounting IIFEs with no module.exports, so each test imports fresh
// copies via cache-busting dynamic import() against a hand-built window --
// same pattern as tests/inline-content-edit-refresh.test.js's
// mountStateSyncWithRealReapply, extended here to also mount the inline-edit
// orchestrator on top of it so a real click can drive a real save.
const { describe, test, expect } = require('bun:test')
const path = require('path')
const realUtils = require('../js/utils.js')
const realInlineEditData = require('../js/inline-content-edit-data.js')
require('../js/inline-content-edit-render.js') // side-effect: populates window.InlineEdit.render

const STATE_SYNC_PATH = path.resolve(__dirname, '../js/ux-improvements-state-sync.js')
const INLINE_EDIT_PATH = path.resolve(__dirname, '../js/inline-content-edit.js')

let originalWindow

/**
 * Mount real js/ux-improvements-state-sync.js (for a real
 * saveCurrentPageToLocalStorage / applySavedPageState pair backed by real
 * computeSectionEdits/applyContentEditsToPageData) plus real
 * js/inline-content-edit.js on top of it, against one shared in-memory
 * window.reviewState store standing in for localStorage.
 * @returns {Promise<{
 *   page: object,
 *   originalPage: object,
 *   mockPage: HTMLElement,
 *   readState: () => object,
 *   applySavedPageState: Function,
 * }>}
 */
async function mountRoundTrip() {
  originalWindow = global.window

  const page = {
    title: 'T',
    summary: 'S',
    sections: [{ heading: 'Original Heading', paragraphs: [], bullets: ['First', 'Second'] }],
  }
  const originalPage = JSON.parse(JSON.stringify(page))

  let state = {
    version: 1,
    updated_at: '',
    ui: {},
    globals: {},
    pages: {},
  }

  document.body.innerHTML = '<div id="mockPage"></div>'
  const mockPage = document.getElementById('mockPage')

  global.window = window // keep the real happy-dom window/document
  window.HHVC_DATA = { pages: { testPage: page }, order: [['testPage', 'Test']] }
  window.ORIGINAL_DATA = { pages: { testPage: originalPage } }
  window.utils = { ...realUtils, getCurrentKey: () => 'testPage' }
  window.inlineEditData = realInlineEditData
  window.reviewState = {
    read: () => state,
    update: (updater) => {
      state = updater(state)
      return state
    },
  }
  window.reviewMerge = {
    mergeReviewRecord: (existing, snapshot) => snapshot,
    combineHistory: (a) => a,
    reviewContentEquals: () => false,
  }
  window.showToast = () => {}

  // renderPage is the seam js/inline-content-edit.js's rerender() calls.
  // window.HHVC_DATA is the single shared page object throughout this test
  // (mutated in place by add/remove/reset), so a no-op stub is sufficient --
  // there's no separate rendered-DOM copy to keep in sync for this file's
  // assertions, which are entirely about the persisted record and the
  // reapply path, not about what #mockPage displays.
  window.renderPage = () => {}

  const stateSyncUrl = `${STATE_SYNC_PATH}?t=${Date.now()}-${Math.random()}`
  await import(stateSyncUrl)
  // js/inline-content-edit.js's persist() reaches through
  // window.ReviewUx.stateSync.saveCurrentPageToLocalStorage -- the real one,
  // now mounted above.
  window.ReviewUx.stateSync.saveCurrentPageToLocalStorage

  const inlineEditUrl = `${INLINE_EDIT_PATH}?t=${Date.now()}-${Math.random()}`
  await import(inlineEditUrl)
  window.inlineEdit.ensureBound()

  return {
    page,
    originalPage,
    mockPage,
    readState: () => state,
    applySavedPageState: window.ReviewUx.stateSync.applySavedPageState,
  }
}

function click(el) {
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
}

describe('inline content edit: add/remove/reset round-trip through the real save/reapply path', () => {
  test('removing a bullet is reflected in the recomputed section_edits after a real save', async () => {
    const { page, mockPage, readState } = await mountRoundTrip()
    mockPage.innerHTML =
      '<li data-rewrite-field="sections.0.bullets.0">First</li>' +
      '<li data-rewrite-field="sections.0.bullets.1">Second</li>' +
      '<button type="button" data-inline-edit-remove="sections.0.bullets" data-inline-edit-index="0">×</button>'

    click(mockPage.querySelector('[data-inline-edit-remove]'))

    expect(page.sections[0].bullets).toEqual(['Second'])
    const saved = readState().pages.testPage
    expect(saved.section_edits['sections.0.bullets']).toEqual(['Second'])
  })

  test('a saved bullet removal reapplies correctly on a fresh load of the page object', async () => {
    const { page, applySavedPageState, readState } = await mountRoundTrip()
    // Simulate a prior save that removed the first bullet, exactly as the
    // real collectCurrentPageReviewState would have written it.
    readState().pages.testPage = {
      section_edits: { 'sections.0.bullets': ['Second'] },
    }
    // Reset the live in-memory page back to its pre-removal shape, as if the
    // page had just been re-rendered from pages/*.js on a fresh navigation.
    page.sections[0].bullets = ['First', 'Second']

    applySavedPageState('testPage')

    expect(page.sections[0].bullets).toEqual(['Second'])
  })

  test('adding a bullet is reflected in the recomputed section_edits after a real save', async () => {
    const { page, mockPage, readState } = await mountRoundTrip()
    mockPage.innerHTML =
      '<li data-rewrite-field="sections.0.bullets.0">First</li>' +
      '<li data-rewrite-field="sections.0.bullets.1">Second</li>' +
      '<button type="button" data-inline-edit-add="sections.0.bullets">+ Add</button>'

    click(mockPage.querySelector('[data-inline-edit-add]'))

    expect(page.sections[0].bullets.length).toBe(3)
    const saved = readState().pages.testPage
    expect(saved.section_edits['sections.0.bullets']).toEqual(page.sections[0].bullets)
  })

  test('a saved bullet addition reapplies correctly on a fresh load of the page object', async () => {
    const { page, applySavedPageState, readState } = await mountRoundTrip()
    const addedArray = [
      'First',
      'Second',
      { text: 'New item', unverified: true, unverifiedReason: 'Manually edited during review' },
    ]
    readState().pages.testPage = {
      section_edits: { 'sections.0.bullets': addedArray },
    }
    page.sections[0].bullets = ['First', 'Second']

    applySavedPageState('testPage')

    expect(page.sections[0].bullets).toEqual(addedArray)
  })

  test('resetting a heading to its original value drops it from the recomputed section_edits', async () => {
    const { page, mockPage, readState } = await mountRoundTrip()
    // Simulate the heading having been edited AND saved previously, exactly
    // as Task 6's commit path plus a real save would have left it.
    page.sections[0].heading = 'Edited Heading'
    mockPage.innerHTML =
      '<h2 data-rewrite-field="sections.0.heading">' +
      'Edited Heading<button type="button" data-inline-edit-reset="sections.0.heading">Reset to original</button>' +
      '</h2>'
    // A prior save already recorded the edit.
    readState().pages.testPage = {
      section_edits: { 'sections.0.heading': 'Edited Heading' },
    }

    click(mockPage.querySelector('[data-inline-edit-reset]'))

    expect(page.sections[0].heading).toBe('Original Heading')
    const saved = readState().pages.testPage
    // The whole point of "reset to original is correct by construction"
    // (js/inline-content-edit-data.js's design premise): once the live value
    // matches ORIGINAL_DATA again, computeSectionEdits's diff simply omits
    // the path on the next recompute -- no separate deletion step needed.
    expect(saved.section_edits['sections.0.heading']).toBeUndefined()
    expect('sections.0.heading' in saved.section_edits).toBe(false)
  })
})
