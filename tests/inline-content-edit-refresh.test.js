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
const realInlineEditData = require('../js/inline-content-edit-data.js')

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

  const decorateEditedFieldsCalls = []
  global.window.inlineEdit = {
    decorateEditedFields: () => decorateEditedFieldsCalls.push(true),
    decorateListControls: () => {},
  }

  const modUrl = `${MODULE_PATH}?t=${Date.now()}-${Math.random()}`
  await import(modUrl)

  return {
    applySavedPageState: global.window.ReviewUx.stateSync.applySavedPageState,
    renderPageCalls,
    decorateEditedFieldsCalls,
  }
}

/** Wait for any pending setTimeout(0) callbacks (the deferred follow-up call) to run. */
function flushMicroAndMacroTasks() {
  return new Promise((resolve) => setTimeout(resolve, 10))
}

/**
 * Mount a fresh instance against the REAL js/inline-content-edit-data.js
 * (not the applyReturns stub above), so applyContentEditsToPageData actually
 * mutates the shared page object — required to prove what a "paint" reads at
 * the moment a triggered render fires, rather than just counting calls.
 *
 * Exposes `page` (the single shared object DATA.pages.pestsTopic holds
 * throughout — the same object every applySavedPageState call reads and
 * writes, matching the real DATA = window.HHVC_DATA closure) and a mutable
 * `setSavedSectionEdits` so a test can change what the next
 * applySavedPageState call will read as "saved," simulating a second,
 * more-current write (e.g. a sync pull) landing between two calls.
 * @returns {Promise<{applySavedPageState: Function, page: object, renderPaints: Array, setSavedSectionEdits: Function}>}
 */
async function mountStateSyncWithRealReapply() {
  const page = { title: 'T', sections: [{ heading: 'Original', paragraphs: [] }] }
  let state = {
    version: 1,
    updated_at: '',
    ui: {},
    globals: {},
    pages: { pestsTopic: { section_edits: {} } },
  }

  // What a render call would actually paint, captured at the moment it
  // fires — the live heading value on the shared page object right then.
  // This is the concrete evidence for the "never stale, only possibly
  // redundant" invariant: if a suppressed call's data were the one that
  // "should" have painted, this array would show the earlier value at some
  // point; if the invariant holds, every entry is the latest write.
  const renderPaints = []

  function stubRenderPage(key) {
    renderPaints.push(page.sections[0].heading)
    setTimeout(() => {
      global.window.ReviewUx.stateSync.applySavedPageState(key)
    }, 0)
  }

  global.window = {
    HHVC_DATA: { pages: { pestsTopic: page }, order: [['pestsTopic', 'Test']] },
    ORIGINAL_DATA: {
      pages: { pestsTopic: { title: 'T', sections: [{ heading: 'Original', paragraphs: [] }] } },
    },
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
    inlineEditData: realInlineEditData,
    renderPage: stubRenderPage,
  }

  const modUrl = `${MODULE_PATH}?t=${Date.now()}-${Math.random()}`
  await import(modUrl)

  return {
    applySavedPageState: global.window.ReviewUx.stateSync.applySavedPageState,
    page,
    renderPaints,
    setSavedSectionEdits: (heading) => {
      state = {
        ...state,
        pages: { pestsTopic: { section_edits: { 'sections.0.heading': heading } } },
      }
    },
  }
}

describe('applySavedPageState decorates the Edited badge synchronously', () => {
  test('calls window.inlineEdit.decorateEditedFields directly, not just via the render wrapper', async () => {
    // Confirmed live on the deployed production build: the "Edited" badge
    // intermittently failed to reappear after a reload even though the
    // underlying title/summary/CTA data was always correctly reapplied —
    // js/inline-content-edit.js's own decorate() pass (chained off the
    // SAME render promise as this function's own applyAndRefresh callback)
    // could resolve before or after this function's data patches depending
    // on real network/paint timing. applySavedPageState must call
    // decoration itself, synchronously, right after the data it depends on
    // is known-correct — not rely on a separately-scheduled callback that
    // may run too early.
    const { applySavedPageState, decorateEditedFieldsCalls } = await mountStateSync({
      savedRecord: { edited_title: 'Edited Title' },
    })

    applySavedPageState('pestsTopic')

    expect(decorateEditedFieldsCalls.length).toBeGreaterThanOrEqual(1)
  })

  test('is a no-op (not an error) when window.inlineEdit is not yet mounted', async () => {
    const { applySavedPageState } = await mountStateSync({
      savedRecord: { edited_title: 'Edited Title' },
    })
    global.window.inlineEdit = undefined

    expect(() => applySavedPageState('pestsTopic')).not.toThrow()
  })
})

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

  test('a CTA-only saved edit triggers a follow-up render too, not just section_edits', async () => {
    // Regression coverage: updateMockupTextFromSavedState writes a saved
    // primary_cta into page data (via setPrimaryCta) but, unlike title/
    // summary, has no single DOM node it can patch directly — so before this
    // fix, a CTA-only save (no section_edits at all) never triggered the
    // follow-up render and the mockup kept showing the bundled CTA label.
    const { applySavedPageState, renderPageCalls } = await mountStateSync({
      page: { title: 'T', sections: [], primaryCta: 'Original CTA' },
      savedRecord: { primary_cta: 'Edited CTA' }, // no section_edits
      applyReturns: false, // matches the real contract for absent section_edits
    })

    applySavedPageState('pestsTopic')
    await flushMicroAndMacroTasks()

    expect(renderPageCalls).toEqual([{ key: 'pestsTopic', skipHistory: true }])
  })

  test('a saved CTA identical to the current one triggers zero follow-up renders', async () => {
    const { applySavedPageState, renderPageCalls } = await mountStateSync({
      page: { title: 'T', sections: [], primaryCta: 'Same CTA' },
      savedRecord: { primary_cta: 'Same CTA' },
      applyReturns: false,
    })

    applySavedPageState('pestsTopic')
    await flushMicroAndMacroTasks()

    expect(renderPageCalls).toEqual([])
  })

  // Closes out a reviewer-flagged concern: the guard is keyed only by
  // pageKey, not a call-identity token, so a second external
  // applySavedPageState call for the same key landing while a first call's
  // deferred render is still pending sees the guard already set and
  // suppresses its own render trigger. The worry was that the FIRST call's
  // eventually-firing render could then paint stale data, superseding the
  // second call's more-current write. This test proves it does not: it uses
  // the REAL applyContentEditsToPageData (not the applyReturns stub above),
  // so the mutation actually lands on the shared page object, and it
  // records what a render would actually paint at the moment it fires.
  test('a suppressed follow-up render never paints stale data: the later of two interleaved section_edits wins', async () => {
    const { applySavedPageState, page, renderPaints, setSavedSectionEdits } =
      await mountStateSyncWithRealReapply()

    // Call X: saved section_edits says 'First'. Reapply mutates the shared
    // page synchronously; the guard is set and a render triggered — the
    // stub's render paints synchronously (matching the real wrapper's
    // synchronous originalRenderPage.call()) and separately schedules a
    // DEFERRED follow-up applySavedPageState call for later.
    setSavedSectionEdits('First')
    applySavedPageState('pestsTopic')
    expect(page.sections[0].heading).toBe('First')
    // X's render already fired (synchronously) and painted the data that
    // was live at that moment — 'First' is correct here, not stale: Y
    // hasn't run yet, so this is the only current data that exists so far.
    expect(renderPaints).toEqual(['First'])

    // Before X's deferred follow-up call fires, a second external call (Y)
    // runs for the SAME key with DIFFERENT, more-current data — e.g. a sync
    // pull landing between the two. Y's synchronous reapply overwrites the
    // shared page with 'Second'. Y sees refreshInFlightForKey already set
    // (by X) and suppresses its own render trigger — it does NOT clear the
    // guard until it reads it as its own at the top of applySavedPageState,
    // which it does here, since X's guard is still pointing at this key.
    setSavedSectionEdits('Second')
    applySavedPageState('pestsTopic')
    expect(page.sections[0].heading).toBe('Second')
    // Y triggered no new render (its own render-check saw isOwnTriggeredRefresh).
    expect(renderPaints).toEqual(['First'])

    // Let X's deferred follow-up call fire. Y already cleared the guard
    // when IT ran (isOwnTriggeredRefresh was true for Y, so Y cleared
    // refreshInFlightForKey back to null) — so when X's deferred call now
    // runs applySavedPageState again, the guard is null, this call is NOT
    // read as "its own triggered refresh," and it triggers one more render.
    await flushMicroAndMacroTasks()

    // That final render reads the LIVE shared page object at the moment it
    // actually fires — which by then holds Y's write, because Y's
    // synchronous reapply happened well before this deferred callback could
    // run. This is the concrete proof of the invariant: the LAST paint
    // always reflects the most current data, regardless of which call's
    // guard-check was the one that originally triggered the render chain.
    expect(page.sections[0].heading).toBe('Second')
    expect(renderPaints.at(-1)).toBe('Second')
  })
})
