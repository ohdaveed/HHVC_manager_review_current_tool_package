const { test, expect } = require('@playwright/test')
const { gotoFresh, selectPage } = require('./helpers')

const PAGE_KEYS = [
  'pestsTopic',
  'rodentsReport',
  'filthReport',
  'insectsReport',
  'recordsHub',
  'findRecords',
  'findViolations',
  'findHotelRecords',
  'publicRecords',
  'ownerHub',
  'noticeOfViolation',
  'payFee',
  'scopeInfo',
  'article11Guide',
  'ownerGuidance',
  'afterReport',
  'tenantRights',
  'mosquitoControl',
  'mosquitoWorkshop',
]

test.describe('page navigation', () => {
  test('page picker switches pages and updates the URL and browser shell', async ({ page }) => {
    await gotoFresh(page)
    const initialUrl = await page.locator('#browserUrl').textContent()

    await selectPage(page, 'rodentsReport')

    await expect(page.locator('#pageSelect')).toHaveValue('rodentsReport')
    await expect(page.locator('#mockPage h1')).toContainText(/rats|mice/i)
    expect(await page.locator('#browserUrl').textContent()).not.toBe(initialUrl)
    expect(page.url()).toContain('page=rodentsReport')
  })

  test('all 19 pages render without errors', async ({ page }) => {
    await gotoFresh(page)
    for (const key of PAGE_KEYS.slice(1)) {
      await selectPage(page, key)
      const heading = await page.locator('#mockPage h1').first().textContent()
      expect(heading?.trim().length, `page "${key}" should render a heading`).toBeGreaterThan(0)
      await expect(page.locator('#hhvcGlobalErrorBanner')).toHaveCount(0)
    }
  })

  test('in-page buttons with data-render-target navigate between pages', async ({ page }) => {
    await gotoFresh(page)
    const target = page.locator('#mockPage [data-render-target]').first()
    await expect(target).toBeVisible()
    const key = await target.getAttribute('data-render-target')

    await target.click()

    await expect(page.locator('#pageSelect')).toHaveValue(key)
  })

  test('deep link ?page=payFee loads that page directly', async ({ page }) => {
    await page.goto('/?page=payFee')
    await page.waitForSelector('#mockPage h1')
    await expect(page.locator('#pageSelect')).toHaveValue('payFee')
    await expect(page.locator('#mockPage h1')).toContainText(/fee/i)
  })

  test('deleted-page alias redirects to the consolidated page with a toast', async ({ page }) => {
    await page.goto('/?page=ratsReport')
    // Assert the toast before waiting on the page render: toasts auto-dismiss
    // after 4s, and the first render can be slow under parallel-worker load.
    await expect(
      page.locator('#toastContainer .toast').filter({ hasText: /consolidated/i })
    ).toBeVisible()
    await page.waitForSelector('#mockPage h1')
    await expect(page.locator('#pageSelect')).toHaveValue('rodentsReport')
  })

  test('unknown page key falls back to the agency page with a toast', async ({ page }) => {
    await page.goto('/?page=notARealPage')
    await expect(
      page.locator('#toastContainer .toast').filter({ hasText: /not a page/i })
    ).toBeVisible()
    await page.waitForSelector('#mockPage h1')
    await expect(page.locator('#pageSelect')).toHaveValue('pestsTopic')
  })

  test('browser back and forward restore previous pages', async ({ page }) => {
    await gotoFresh(page)
    await selectPage(page, 'payFee')
    await selectPage(page, 'scopeInfo')

    await page.goBack()
    await expect(page.locator('#pageSelect')).toHaveValue('payFee')

    await page.goForward()
    await expect(page.locator('#pageSelect')).toHaveValue('scopeInfo')
  })
})
