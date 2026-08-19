const { test, expect } = require('@playwright/test')
const { gotoFresh, selectPage, recordToasts, readRecordedToasts } = require('./helpers')

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
  'article11Compliance',
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

  test('a bare URL with no page parameter renders the default page', async ({ page }) => {
    // Every other spec navigates through gotoFresh(), which defaults to
    // `/?page=pestsTopic` — so nothing here had ever opened the app the way a
    // reviewer first opens it. That blind spot hid a crash: renderPage() had a
    // `if (!key)` branch that set `.textContent` on `#pageTitle`, an element
    // index.html does not contain, and js/core/app.js passed an explicit null for a
    // bare URL. The app threw before rendering anything, and the same happened
    // on every history pop back to the parameterless URL.
    //
    // Asserting the heading is not enough on its own — a page error can be
    // thrown while the DOM still looks plausible — so this fails on any
    // uncaught exception as well.
    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    await page.goto('/')
    await page.waitForSelector('#mockPage h1')

    await expect(page.locator('#pageSelect')).toHaveValue('pestsTopic')
    await expect(page.locator('#mockPage h1')).toContainText(/healthy housing/i)
    await expect(page.locator('#hhvcGlobalErrorBanner')).toHaveCount(0)
    expect(pageErrors).toEqual([])
  })

  test('all registered pages render without errors', async ({ page }) => {
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
    // Boot-time toasts auto-dismiss after 4s and can be gone before goto()
    // resolves under parallel-worker load, so assert on the recorded history.
    await recordToasts(page)
    await page.goto('/?page=ratsReport')
    await page.waitForSelector('#mockPage h1')
    await expect(page.locator('#pageSelect')).toHaveValue('rodentsReport')
    expect(await readRecordedToasts(page)).toMatch(/consolidated/i)
  })

  test('unknown page key falls back to the agency page with a toast', async ({ page }) => {
    await recordToasts(page)
    await page.goto('/?page=notARealPage')
    await page.waitForSelector('#mockPage h1')
    await expect(page.locator('#pageSelect')).toHaveValue('pestsTopic')
    expect(await readRecordedToasts(page)).toMatch(/not a page/i)
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

  // Regression: the served bundle must actually contain the embedded workshop
  // form and the stylesheets that form links by absolute path.
  //
  // The form is a separate Vite sub-app whose built output is committed and
  // copied into dist/ by build_scripts/copy-workshop-form.js. Two ways it has
  // broken: the copy step not running at all in a serving path (so the CTA in
  // pages/mosquito-education-workshop.js 404s), and the form's hand-written
  // <link href="/css/…"> tags pointing at files the bundler now hashes into
  // dist/assets/ (so the form hydrates but renders unstyled). Neither shows up
  // in any page-level test, because the form lives outside the mockup viewer.
  test('the built bundle serves the workshop form and its shared stylesheets', async ({
    request,
  }) => {
    for (const url of [
      '/forms/mosquito-workshop-request/',
      '/css/styles.css',
      '/css/ux-improvements.css',
    ]) {
      const response = await request.get(url)
      expect(response.status(), `${url} should be served by the built bundle`).toBe(200)
    }
  })
})
