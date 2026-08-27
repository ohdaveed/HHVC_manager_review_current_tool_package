const { test, expect } = require('@playwright/test')
const { gotoFresh, openWorkspaceTab, selectPage, expectNoSeriousViolations } = require('./helpers')

// One representative page per content type in use (see docs/wagtail-content-mapping.md);
// Scanning every page and state would be slow for little extra signal.
const REPRESENTATIVE_PAGES = [
  'pestsTopic', // Agency
  'payFee', // Transaction
  'scopeInfo', // Information
  'recordsHub', // Resource Collection
  'mosquitoWorkshop', // Campaign
  'article11Guide', // Report
]

/* There is no badge left to wait on.

   A `waitForBadgeToSettle()` helper used to run before every scan here. The
   "Viewing: …" badge faded over 250ms, and axe computes color-contrast from the
   BLENDED colour it sees — measured on the real page, a partially faded badge
   is a serious `color-contrast` violation from about 0.7 opacity down. Any scan
   overlapping the transition therefore failed on a defect that did not exist
   once it settled.

   The element is gone: it was the fourth place the open page's name appeared,
   after the sidebar picker, a "Current page:" label under it, and the sticky
   bar. Removing it removes the transition, so the wait has nothing left to do.

   Worth keeping from #92, which hardened this helper immediately before it was
   deleted, in case a fading element is ever added to a scanned page again: the
   `.visible` CLASS is not a proxy for "settled". `js/review/editor-panel.js` added it
   and then removed it again on a 5s timer, so the class was absent in two
   completely different states — before the fade in (settled) and during the
   fade OUT (not settled). The fix was to ask the element what it is doing
   (`getAnimations()` plus a terminal opacity) rather than to read the class,
   and that is the shape any replacement should take. */

test.describe('accessibility', () => {
  test('Karl annotations default off and do not expand a service action name', async ({ page }) => {
    await gotoFresh(page)

    await expect(page.locator('#tagToggle')).not.toBeChecked()
    await expect(
      page.locator('.services-region a, .services-region button').first()
    ).not.toHaveAccessibleName(/Karl:/)

    await page.locator('.karl-switch').click()
    await page.reload()
    await page.waitForSelector('#mockPage h1')
    await expect(page.locator('#tagToggle')).toBeChecked()
  })

  for (const key of REPRESENTATIVE_PAGES) {
    test(`page "${key}" has no serious violations`, async ({ page }) => {
      await gotoFresh(page)
      if (key !== 'pestsTopic') await selectPage(page, key)
      await expectNoSeriousViolations(page)
    })
  }

  test('open workspace with the review queue has no serious violations', async ({ page }) => {
    await gotoFresh(page)
    await openWorkspaceTab(page, 'overview')
    await page.waitForSelector('.review-queue-table-row')
    await expectNoSeriousViolations(page)
  })

  /* The workspace scan above opens Overview and stops there, so for a long time
     two of the three tabs were never scanned at all. Both were carrying serious
     WCAG 2.1 AA failures when these tests were added: 44 color-contrast nodes on
     Checks (--legacy-slate-3 on the docked panel's surface, 4.37:1) plus a
     scrollable-region-focusable failure on the panel itself, and 4 more contrast
     nodes on Help where a blanket `.dashboard-guidance-card span` rule reached
     into the Karl tag legend and overrode the slate-2 it carries deliberately.

     None of it was width-dependent — measured identically at 1280 and 1800 —
     so the gap was never the viewport, it was which tabs anyone thought to
     open. A tab that is not scanned is a tab with no accessibility coverage,
     however thorough the scan of its neighbour. */
  for (const tab of ['checks', 'help']) {
    test(`workspace "${tab}" tab has no serious violations`, async ({ page }) => {
      await gotoFresh(page)
      await openWorkspaceTab(page, tab)
      await expectNoSeriousViolations(page)
    })
  }

  /* Dark mode, which no scan had ever run in.

     The theme layer inverts the neutral ramp by ROLE rather than by value, and
     the mockup is pinned back to light inside .browser-shell so a reviewer is
     never approving a dark page that does not exist. Both are good decisions
     and both hid a failure until something measured them:

     - `color` is inherited, and inheritance carries the computed value, not the
       var() reference. `body` resolved --legacy-slate-1 against the dark :root and
       computed #f0f1f2; every element inside the shell without a colour rule of
       its own inherited that straight onto the shell's light background. #f0f1f2
       on #fcfcfc is 1.1:1 — most of the body copy on every page, invisible.
       Re-pointing the tokens could not fix it; .browser-shell has to restate
       `color` so the subtree inherits something correct.
     - @sfgov/design-system ships a bare `kbd` element rule hardcoding a
       light-mode blue with no dark counterpart. An element selector outranks
       inheritance, so it survived the panel's colour and landed at 2.09:1.

     Scanning the three tabs and two pages rather than everything: the chrome is
     what inverts, and the mockup is theme-pinned, so one Agency page and one
     Transaction is enough to catch a leak across the pinning boundary. */
  test.describe('dark mode', () => {
    for (const tab of ['overview', 'checks', 'help']) {
      test(`workspace "${tab}" tab has no serious violations in dark mode`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: 'dark' })
        await gotoFresh(page)
        await openWorkspaceTab(page, tab)
        if (tab === 'overview') await page.waitForSelector('.review-queue-table-row')
        await expectNoSeriousViolations(page)
      })
    }

    for (const key of ['pestsTopic', 'payFee']) {
      test(`page "${key}" has no serious violations in dark mode`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: 'dark' })
        await gotoFresh(page)
        if (key !== 'pestsTopic') await selectPage(page, key)
        await expectNoSeriousViolations(page)
      })
    }
  })

  test('shortcuts help dialog has no serious violations', async ({ page }) => {
    await gotoFresh(page)
    // .focus(), not .click() — the mockup's <h1> carries
    // data-rewrite-field="title" (inline content editing), so a real click
    // opens that field's inline editor instead of moving keyboard focus.
    // See tests/e2e/helpers.js's focusMockPage() for the same fix.
    await page.locator('#mockPage h1').first().focus()
    await page.keyboard.press('?')
    await expect(page.locator('#shortcutsHelpDialog')).toBeVisible()
    await expectNoSeriousViolations(page)
  })
})

/* ------------------------------------------------------------------------ *
 * The mockup body — what actually gets published (#220)
 *
 * This tool is a MOCKUP AUTHORING tool. The page bodies rendered inside
 * `#mockPage` become published SF.gov content by way of Karl; the review
 * shell around them — sidebar, workspace, browser chrome, export controls —
 * ships nowhere. WCAG obligations attach to the first. #217 and #219 were
 * closed as wrong-target for asserting against the second.
 *
 * These scans are therefore scoped with an axe include selector on
 * `#mockPage`, so a shell violation can neither pass nor fail this gate.
 *
 * They are ADDED to the whole-page scans above rather than replacing them.
 * Those currently pass, having been fixed in 507e258 after the 2026-08-06
 * audit found 44 contrast failures hiding behind tabs the scan never opened.
 * Un-gating something green buys nothing and loses the regression detector
 * that caught them; if the shell ever goes red and the fix is genuinely not
 * worth making under "the shell ships nowhere", un-gate THEN, with a real
 * failure in hand.
 *
 * Coverage is one representative page per Karl content type, DERIVED from the
 * real page data. The hardcoded list above names six and calls itself "one
 * per content type in use" — there are eight, so `Topic` and `About us` have
 * never been scanned by it. Deriving also means a ninth type cannot be added
 * without this gate noticing.
 *
 * KNOWN BLIND SPOT, stated rather than discovered later: one page per type
 * cannot see WITHIN-type variance — Transaction has fourteen pages and only
 * the first is scanned here. The cheap fix if something slips through is a
 * non-browser structural lint over all 29 page data modules, not more axe
 * runs at ~2s each.
 * ------------------------------------------------------------------------ */

const { loadPageData } = require('../../build_scripts/load-pages')
const { expectNoMockupBodyViolations, expectNoGenericLinkText } = require('./helpers')

/** One page key per content type, in `order` sequence so the pick is stable. */
function representativePerType() {
  const data = loadPageData()
  const seen = new Map()
  for (const [key] of data.order) {
    const type = data.pages[key] && data.pages[key].type
    if (type && !seen.has(type)) seen.set(type, key)
  }
  return [...seen.entries()].map(([type, key]) => ({ type, key }))
}

test.describe('mockup body: what survives export into Karl', () => {
  for (const { type, key } of representativePerType()) {
    test(`${type} page "${key}" body passes the Karl-relevant rules`, async ({ page }) => {
      await gotoFresh(page)
      if (key !== 'pestsTopic') await selectPage(page, key)
      await page.waitForSelector('#mockPage h1')
      await expectNoMockupBodyViolations(page, key)
    })

    test(`${type} page "${key}" ships no generic link label`, async ({ page }) => {
      await gotoFresh(page)
      if (key !== 'pestsTopic') await selectPage(page, key)
      await page.waitForSelector('#mockPage h1')
      await expectNoGenericLinkText(page, key)
    })
  }
})
