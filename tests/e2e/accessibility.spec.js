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
 * Wait for the "Viewing: …" badge to finish fading in.
 *
 * .page-badge animates opacity 0 → 1 over 250ms every time the page changes,
 * and axe computes color-contrast from the BLENDED colour it sees. A scan that
 * starts mid-fade therefore reports the badge as a serious contrast violation
 * that does not exist once the transition settles — a real flake, and one that
 * gets likelier as other work shifts render timing around it. Settling the
 * transition is the deterministic fix; excluding the node would blind the scan
 * to a genuine regression on it.
 */
async function waitForBadgeToSettle(page) {
  await page.waitForFunction(() => {
    const badge = document.getElementById('currentPageBadge')
    if (!badge || !badge.classList.contains('visible')) return true
    return Number(window.getComputedStyle(badge).opacity) === 1
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

  test('shortcuts help dialog has no serious violations', async ({ page }) => {
    await gotoFresh(page)
    await page.locator('#mockPage h1').first().click()
    await page.keyboard.press('?')
    await expect(page.locator('#shortcutsHelpDialog')).toBeVisible()
    await expectNoSeriousViolations(page)
  })
})
