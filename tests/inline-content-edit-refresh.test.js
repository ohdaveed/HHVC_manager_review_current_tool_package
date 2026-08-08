// Unit tests for the section_edits follow-up-render re-entrancy guard added
// to applySavedPageState() in js/ux-improvements-state-sync.js.
//
// js/ux-improvements-state-sync.js is a self-mounting IIFE (an ES module with
// no module.exports tail — unlike js/review-state-sync.js/js/review-merge.js,
// it publishes its API only onto window.ReviewUx.stateSync at import time),
// so there is no bare `require()` surface to test against. It is normally
// exercised only via e2e specs (see CLAUDE.md's "Local persistence" section).
//
// This file uses a dynamic import() with a cache-busting query string to get
// a FRESH module instance per test — required because the guard's state
// (refreshInFlightForKey) lives in the IIFE's closure, and Bun's ESM loader
// otherwise caches the module by resolved path, which would let one test's
// guard state leak into the next. Each test builds its own stub
// window.HHVC_DATA / window.reviewState / window.ORIGINAL_DATA /
// window.renderPage before importing, matching the pattern
// tests/review-state-sync.test.js uses for its CJS sibling (stub the globals
// the IIFE reads at mount time, then assert against what it published).
const { describe, test, expect, beforeEach, afterEach } = require('bun:test')
const path = require('path')
const realUtils = require('../js/utils.js')

const MODULE_PATH = path.resolve(__dirname, '../js/ux-improvements-state-sync.js')

let originalWindow

beforeEach(() => {
  originalWindow = global.window
})

afterEach(() => {
  global.window = originalWindow
})

/**
 * Mount a fresh instance of js/ux-improvements-state-sync.js against a
 * stubbed window, and return its published API plus test hooks.
 * @param {object} [options]
 * @param {object} [options.page] the pestsTopic page object DATA.pages will hold
 * @param {object} [options.savedRecord] state.pages.pestsTopic, or undefined for none
 * @param {boolean} [options.applyReturns] what the stubbed
 *   window.inlineEditData.applyContentEditsToPageData should report
 * @returns {Promise<{applySavedPageState: Function, renderPageCalls: Array}>}
 */
async function mountStateSync({
  page = { title: 'T', sections: [] },
  savedRecord,
  applyReturns = false,
} = {}) {
  let state = {
    version: 1,
    updated_at: '',
    ui: {},
    globals: {},
    pages: savedRecord ? { pestsTopic: savedRecord } : {},
  }

  const renderPageCalls = []
  // The real wrapper (js/ux-improvements.js's wrapRenderPage) synchronously
  // repaints the DOM via the original render, then defers a follow-up
  // applySavedPageState call. This stub mirrors exactly that shape — a
  // synchronous "render" recorded here, plus a setTimeout(0)-deferred call
  // back into applySavedPageState — since that's the specific re-entrancy
  // this guard exists to stop, and a stub that doesn't reproduce it wouldn't
  // exercise the guard at all.
  function stubRenderPage(key, skipHistory) {
    renderPageCalls.push({ key, skipHistory })
    setTimeout(() => {
      global.window.ReviewUx.stateSync.applySavedPageState(key)
    }, 0)
  }

  global.window = {
    HHVC_DATA: { pages: { pestsTopic: page }, order: [['pestsTopic', 'Test']] },
    ORIGINAL_DATA: { pages: { pestsTopic: { title: 'T', sections: [] } } },
    reviewState: {
      read: () => state,
      update: (updater) => {
        state = updater(state)
        return state
      },
    },
    reviewMerge: {
      mergeReviewRecord: (existing) => existing,
      combineHistory: (a) => a,
      reviewContentEquals: () => true,
    },
    utils: realUtils,
    inlineEditData: {
      applyContentEditsToPageData: () => applyReturns,
      computeSectionEdits: () => ({}),
    },
    renderPage: stubRenderPage,
  }

  const modUrl = `${MODULE_PATH}?t=${Date.now()}-${Math.random()}`
  await import(modUrl)

  return {
    applySavedPageState: global.window.ReviewUx.stateSync.applySavedPageState,
    renderPageCalls,
  }
}

/** Wait for any pending setTimeout(0) callbacks (the deferred follow-up call) to run. */
function flushMicroAndMacroTasks() {
  return new Promise((resolve) => setTimeout(resolve, 10))
}

describe('applySavedPageState section_edits follow-up render', () => {
  test('triggers exactly one follow-up render when a saved section edit was reapplied', async () => {
    const { applySavedPageState, renderPageCalls } = await mountStateSync({
      savedRecord: { section_edits: { 'sections.0.heading': 'Edited' } },
      applyReturns: true,
    })

    applySavedPageState('pestsTopic')
    await flushMicroAndMacroTasks()

    expect(renderPageCalls).toEqual([{ key: 'pestsTopic', skipHistory: true }])
  })

  test('does not recurse: the deferred follow-up call does not trigger a second render', async () => {
    const { applySavedPageState, renderPageCalls } = await mountStateSync({
      savedRecord: { section_edits: { 'sections.0.heading': 'Edited' } },
      // Reports true on every call, including the guard-protected second one —
      // this is the actual case the guard has to handle: the reapplied data
      // still matches savedRecord.section_edits on the second pass (nothing
      // changed since the first reapply already wrote it), and
      // applyContentEditsToPageData reports true whenever a path resolves,
      // not only when the value actually changed (see setByPath in
      // js/utils.js) — so the guard, not this return value, is what has to
      // stop the recursion.
      applyReturns: true,
    })

    applySavedPageState('pestsTopic')
    // Give the deferred follow-up call (and any further scheduling it might
    // wrongly trigger) more than one tick to settle.
    await flushMicroAndMacroTasks()
    await flushMicroAndMacroTasks()

    expect(renderPageCalls.length).toBeLessThanOrEqual(1)
  })

  test('a page with no saved section edits triggers zero follow-up renders', async () => {
    const { applySavedPageState, renderPageCalls } = await mountStateSync({
      savedRecord: { decision: 'Approved' }, // no section_edits at all
      applyReturns: false, // matches the real applyContentEditsToPageData contract for empty/absent section_edits
    })

    applySavedPageState('pestsTopic')
    await flushMicroAndMacroTasks()

    expect(renderPageCalls).toEqual([])
  })

  test('a page with no saved record at all triggers zero follow-up renders', async () => {
    const { applySavedPageState, renderPageCalls } = await mountStateSync({
      savedRecord: undefined,
      applyReturns: false,
    })

    applySavedPageState('pestsTopic')
    await flushMicroAndMacroTasks()

    expect(renderPageCalls).toEqual([])
  })
})
