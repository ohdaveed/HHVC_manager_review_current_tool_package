const { test, expect } = require('@playwright/test')
const AxeBuilder = require('@axe-core/playwright').default
const { gotoFresh, openWorkspaceTab, selectPage } = require('./helpers')

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
   `.visible` CLASS is not a proxy for "settled". `js/editor-panel.js` added it
   and then removed it again on a 5s timer, so the class was absent in two
   completely different states — before the fade in (settled) and during the
   fade OUT (not settled). The fix was to ask the element what it is doing
   (`getAnimations()` plus a terminal opacity) rather than to read the class,
   and that is the shape any replacement should take. */

async function expectNoSeriousViolations(page) {
  // color-contrast is ENABLED. It used to be disabled here, which meant the
  // suite could not catch the most common WCAG failure in the product it
  // guards. The css/theme.css token layer now carries measured ratios for
  // every text/surface pairing in both themes, so the rule has something
  // deliberate to check rather than a pile of ad-hoc colours.
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  // Map to a compact summary so a failure prints the offending rules and
  // nodes instead of dumping full Axe violation objects.
  const serious = results.violations
    .filter((v) => v.impact === 'critical' || v.impact === 'serious')
    .map((v) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      nodes: v.nodes.map((n) => n.html),
    }))
  expect(serious).toEqual([])
}

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
