const { test, expect } = require('@playwright/test')
const AxeBuilder = require('@axe-core/playwright').default
const { gotoFresh, openWorkspaceTab, selectPage } = require('./helpers')

// One representative page per content type in use (see docs/wagtail-content-mapping.md);
// scanning all 19 pages x states would be slow for little extra signal.
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

  test('shortcuts help dialog has no serious violations', async ({ page }) => {
    await gotoFresh(page)
    await page.locator('#mockPage h1').first().click()
    await page.keyboard.press('?')
    await expect(page.locator('#shortcutsHelpDialog')).toBeVisible()
    await expectNoSeriousViolations(page)
  })
})
