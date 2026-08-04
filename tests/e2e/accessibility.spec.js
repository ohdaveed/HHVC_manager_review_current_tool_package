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

/**
 * Wait for the "Viewing: …" badge to finish fading, in EITHER direction.
 *
 * .page-badge animates opacity over 250ms, and axe computes color-contrast
 * from the BLENDED colour it sees. Measured on the real page, a partially
 * faded badge is a serious `color-contrast` violation from about 0.7 down;
 * only ~0.8 and above passes. So any scan overlapping the transition fails on
 * a defect that does not exist once it settles. Excluding the node would blind
 * the scan to a genuine regression on it, so settle it instead.
 *
 * The class alone is NOT a proxy for "settled", which is what this used to
 * test. `js/editor-panel.js` adds `.visible`, then removes it again on a 5s
 * timer, so the class is absent in two completely different states:
 *
 *   - before the fade in starts  — opacity 0, nothing running, settled
 *   - during the fade OUT        — opacity mid-transition, NOT settled
 *
 * Returning `true` for the second one let a scan land in the 250ms fade-out
 * around t=5s and read a blended badge. That needs a slow enough run for the
 * scan to reach t=5s, which is why it only ever appeared in a loaded full
 * suite and never in an isolated run.
 *
 * Asking the element what it is actually doing covers both directions, and
 * any future transition added to it. It terminates because a CSS transition
 * is bounded — 250ms here.
 */
async function waitForBadgeToSettle(page) {
  await page.waitForFunction(() => {
    const badge = document.getElementById('currentPageBadge')
    if (!badge) return true
    if (badge.getAnimations().some((animation) => animation.playState === 'running')) return false
    const opacity = Number(window.getComputedStyle(badge).opacity)
    return opacity === 0 || opacity === 1
  })
}

async function expectNoSeriousViolations(page) {
  await waitForBadgeToSettle(page)
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

  test('badge wait does not return mid fade-out', async ({ page }) => {
    await gotoFresh(page)

    // Drive the state the 5s auto-hide produces: `.visible` removed while the
    // 250ms opacity transition is still running.
    await page.evaluate(() => document.getElementById('currentPageBadge').classList.add('visible'))
    await page.waitForFunction(
      () => Number(getComputedStyle(document.getElementById('currentPageBadge')).opacity) === 1
    )
    await page.evaluate(() =>
      document.getElementById('currentPageBadge').classList.remove('visible')
    )
    // The fade must genuinely be in flight, or this guards nothing.
    expect(
      await page.evaluate(() =>
        document
          .getElementById('currentPageBadge')
          .getAnimations()
          .some((animation) => animation.playState === 'running')
      )
    ).toBe(true)

    await waitForBadgeToSettle(page)

    // Assert the WAIT's contract directly rather than going through axe. An
    // axe scan cannot detect this: AxeBuilder.analyze() takes longer to inject
    // and run than the 250ms transition, so the fade always finishes before it
    // samples colours, and the assertion passes whether or not the wait is
    // correct. Measured — the first version of this test passed against the
    // old implementation, which made it decoration rather than a guard.
    const opacity = await page.evaluate(() =>
      Number(window.getComputedStyle(document.getElementById('currentPageBadge')).opacity)
    )
    expect(opacity).toBe(0)
  })

  test('shortcuts help dialog has no serious violations', async ({ page }) => {
    await gotoFresh(page)
    await page.locator('#mockPage h1').first().click()
    await page.keyboard.press('?')
    await expect(page.locator('#shortcutsHelpDialog')).toBeVisible()
    await expectNoSeriousViolations(page)
  })
})
