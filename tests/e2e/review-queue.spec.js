const { test, expect } = require('@playwright/test')
const {
  gotoFresh,
  seedState,
  readState,
  makeReviewRecord,
  openWorkspaceTab,
  DECISIONS,
} = require('./helpers')

async function reloadAndOpenQueue(page) {
  await page.reload()
  await page.waitForSelector('#mockPage h1')
  await openWorkspaceTab(page, 'overview')
  await page.waitForSelector('.review-queue-table-row')
}

test.describe('review queue (Overview tab)', () => {
  test('renders one row per page', async ({ page }) => {
    await gotoFresh(page)
    await openWorkspaceTab(page, 'overview')
    await expect(page.locator('.review-queue-table-row[data-page-key]')).toHaveCount(19)
  })

  test('decision filters narrow the visible rows', async ({ page }) => {
    await gotoFresh(page)
    // Seed pages other than the currently open one: the app flushes the
    // current page's live field values to localStorage on pagehide, which
    // would overwrite a seeded record for the open page during the reload.
    await seedState(page, {
      rodentsReport: makeReviewRecord('rodentsReport', { decision: DECISIONS.approved }),
      payFee: makeReviewRecord('payFee', { decision: DECISIONS.blocked }),
    })
    await reloadAndOpenQueue(page)

    await page.click('.review-queue-filter[data-queue-filter="Approved"]')
    await expect(page.locator('.review-queue-table-row')).toHaveCount(1)
    await expect(page.locator('.review-queue-table-row').first()).toHaveAttribute(
      'data-page-key',
      'rodentsReport'
    )

    await page.click('.review-queue-filter[data-queue-filter="Blocked"]')
    await expect(page.locator('.review-queue-table-row')).toHaveCount(1)
    await expect(page.locator('.review-queue-table-row').first()).toHaveAttribute(
      'data-page-key',
      'payFee'
    )

    await page.click('.review-queue-filter[data-queue-filter="All"]')
    await expect(page.locator('.review-queue-table-row')).toHaveCount(19)
  })

  test('queue search filters rows and clearing restores them', async ({ page }) => {
    await gotoFresh(page)
    await openWorkspaceTab(page, 'overview')
    await page.waitForSelector('.review-queue-table-row')

    await page.fill('#reviewQueueSearch', 'mosquito')
    // The queue rebuilds its table on each keystroke; wait for a known
    // non-matching row to drop out before counting (count() doesn't auto-wait).
    await expect(page.locator('.review-queue-table-row[data-page-key="payFee"]')).toBeHidden()
    const visible = await page.locator('.review-queue-table-row').count()
    expect(visible).toBeGreaterThan(0)
    expect(visible).toBeLessThan(19)
    await expect(
      page.locator('.review-queue-table-row[data-page-key="mosquitoControl"]')
    ).toHaveCount(1)

    await page.fill('#reviewQueueSearch', '')
    await expect(page.locator('.review-queue-table-row')).toHaveCount(19)
  })

  test('sorting by title orders rows alphabetically', async ({ page }) => {
    await gotoFresh(page)
    await openWorkspaceTab(page, 'overview')
    await page.waitForSelector('.review-queue-table-row')

    await page.selectOption('#reviewQueueSort', 'title')

    // The sort re-renders asynchronously; poll until the row order is
    // alphabetical instead of reading the DOM once and racing the rebuild.
    await expect
      .poll(async () => {
        const titles = await page.locator('.review-queue-row-title').allTextContents()
        return (
          titles.length === 19 &&
          titles.every((title, i) => i === 0 || titles[i - 1].localeCompare(title) <= 0)
        )
      })
      .toBe(true)
  })

  test('row action updates that page decision in saved state', async ({ page }) => {
    await gotoFresh(page)
    await openWorkspaceTab(page, 'overview')
    await page.waitForSelector('.review-queue-table-row')

    await page.click(
      '.review-queue-table-row[data-page-key="payFee"] [data-queue-action="approved"]'
    )

    await expect(
      page.locator('.review-queue-table-row[data-page-key="payFee"] .review-queue-table-decision')
    ).toContainText('Approved')
    const state = await readState(page)
    expect(state.pages.payFee?.decision).toBe(DECISIONS.approved)
  })

  test('bulk action applies a decision to all selected rows', async ({ page }) => {
    await gotoFresh(page)
    await openWorkspaceTab(page, 'overview')
    await page.waitForSelector('.review-queue-table-row')

    await page.check('[data-queue-select-key="scopeInfo"]')
    await page.check('[data-queue-select-key="tenantRights"]')
    await expect(page.locator('.review-queue-bulk-count')).toHaveText('2 selected')

    await page.click('[data-queue-bulk-action="blocked"]')

    const state = await readState(page)
    expect(state.pages.scopeInfo?.decision).toBe(DECISIONS.blocked)
    expect(state.pages.tenantRights?.decision).toBe(DECISIONS.blocked)

    await page.click('[data-queue-select="clear"]')
    await expect(page.locator('.review-queue-bulk-count')).toHaveText('0 selected')
  })

  test('select all visible selects every row in the current filter', async ({ page }) => {
    await gotoFresh(page)
    await openWorkspaceTab(page, 'overview')
    await page.waitForSelector('.review-queue-table-row')

    await page.check('#reviewQueueSelectAll')
    await expect(page.locator('.review-queue-bulk-count')).toHaveText('19 selected')
  })

  test('row Open action navigates to that page', async ({ page }) => {
    await gotoFresh(page)
    await openWorkspaceTab(page, 'overview')
    await page.waitForSelector('.review-queue-table-row')

    await page.click(
      '.review-queue-table-row[data-page-key="article11Guide"] [data-queue-action="open"]'
    )

    await expect(page.locator('#pageSelect')).toHaveValue('article11Guide')
  })

  test('queue filter and sort preferences persist across reload', async ({ page }) => {
    await gotoFresh(page)
    await openWorkspaceTab(page, 'overview')
    await page.waitForSelector('.review-queue-table-row')

    await page.click('.review-queue-filter[data-queue-filter="Needs review"]')
    await page.selectOption('#reviewQueueSort', 'title')

    await reloadAndOpenQueue(page)

    await expect(
      page.locator('.review-queue-filter[data-queue-filter="Needs review"]')
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('#reviewQueueSort')).toHaveValue('title')
  })
})
