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

async function expectNoSeriousViolations(page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .disableRules(['color-contrast'])
    .analyze()
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
