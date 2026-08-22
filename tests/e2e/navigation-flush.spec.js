/**
 * The pre-navigation flush of in-progress sidebar edits.
 *
 * **Why this spec exists, and why it is e2e rather than a unit test.** The
 * autosave that carries a reviewer's keystrokes into localStorage is debounced
 * (REFRESH_DEBOUNCE_MS, 300ms in js/review/ux-improvements.js). Navigating
 * inside that window is the whole hazard: the outgoing page's edit is still
 * only in the DOM, and a render overwrites the very inputs the save reads.
 *
 * Two of the eight fields js/review/ux-improvements.js persists are written by
 * applyPageContent() on EVERY render — `seoTitleInput` and
 * `metaDescriptionInput`, both through syncEditorFields() — while
 * collectCurrentPageReviewState() reads them back out of the live DOM via
 * getValue(). So a flush that runs after the render reads the INCOMING page's
 * values and writes them under the OUTGOING page's key. That is silent
 * review-data loss, and this repo has fixed it once before.
 *
 * Two, not three: applyPageContent() also assigns `#urlInput`, and
 * collectCurrentPageReviewState() reads `url_slug` from it — but that element
 * does not exist in index.html, and every reference to it in js/ is guarded
 * (`if (urlInput)`), so getValue() returns '' and `url_slug` falls through to
 * `page.slug`. It is a vestigial third case rather than a live one. Do not
 * "restore" the element without revisiting this path: adding it back turns
 * that fallback off and makes `url_slug` corrupt the same way.
 *
 * js/review/ux-improvements.js is a self-mounting IIFE with no exports, so
 * there is no unit seam to drive this through — the timing, the render and the
 * storage write all have to be real. It sits beside merge-verification.spec.js
 * for the same reason that spec does: both cover a path where the failure is
 * lost reviewer work rather than a visible error.
 *
 * The existing navigation coverage does NOT catch this. Every other spec that
 * navigates either types nothing first or lets the debounce settle before
 * moving, which is exactly the case where the flush has nothing to do.
 */
const { test, expect } = require('@playwright/test')
const {
  gotoFresh,
  openSearchMetadata,
  selectPage,
  readState,
  settleDebounce,
} = require('./helpers')

const PAGE_A = 'pestsTopic'
const PAGE_B = 'rodentsReport'

test.describe('pre-navigation flush', () => {
  test('an SEO edit made just before navigating is saved under the page it was typed on', async ({
    page,
  }) => {
    await gotoFresh(page, `/?page=${PAGE_A}`)
    await openSearchMetadata(page)

    // Type, then navigate IMMEDIATELY — no settleDebounce(). The edit is still
    // inside the debounce window, so it lives only in the DOM at this point,
    // which is the state the flush exists to rescue.
    await page.fill('#seoTitleInput', 'Pest control in San Francisco — edited on page A')
    await selectPage(page, PAGE_B)
    await settleDebounce(page)

    const state = await readState(page)
    expect(state.pages[PAGE_A]?.seo_title).toBe('Pest control in San Francisco — edited on page A')
  })

  test('navigating does not write the destination page fields into the outgoing record', async ({
    page,
  }) => {
    await gotoFresh(page, `/?page=${PAGE_A}`)
    await openSearchMetadata(page)

    // The complementary assertion, and the one that actually named the bug:
    // it is not enough that A's record exists, it must not have been
    // overwritten with B's defaults. Captured from the live DOM after the
    // navigation rather than computed here, so the test cannot drift from
    // whatever defaultSeoTitle()/page.slug produce for B.
    await page.fill('#metaDescriptionInput', 'Meta description typed on page A')
    await selectPage(page, PAGE_B)
    await settleDebounce(page)

    const destinationMeta = await page.inputValue('#metaDescriptionInput')
    const state = await readState(page)

    expect(state.pages[PAGE_A]?.meta_description).toBe('Meta description typed on page A')
    expect(state.pages[PAGE_A]?.meta_description).not.toBe(destinationMeta)
    // A's record must also still name A, not the page navigated to.
    expect(state.pages[PAGE_A]?.page_key).toBe(PAGE_A)
  })
})
