const { test, expect } = require('@playwright/test')
const {
  gotoFresh,
  readState,
  selectPage,
  settleDebounce,
  openSearchMetadata,
} = require('./helpers')

test.describe('editor panel (search metadata)', () => {
  test('typing an SEO title updates the preview and character count', async ({ page }) => {
    await gotoFresh(page)
    await openSearchMetadata(page)

    await page.fill('#seoTitleInput', 'Custom SEO title')

    await expect(page.locator('#seoPreviewTitle')).toHaveText('Custom SEO title')
    await expect(page.locator('#seoTitleCount')).toHaveText('16 characters')
    await expect(page.locator('#seoTitleStatus')).toHaveClass('ok')
  })

  test('over-limit SEO title and meta description flip status to warn', async ({ page }) => {
    await gotoFresh(page)
    await openSearchMetadata(page)

    await page.fill('#seoTitleInput', 'x'.repeat(61))
    await expect(page.locator('#seoTitleStatus')).toHaveClass('warn')
    await expect(page.locator('#seoTitleStatus')).toHaveText('Over 60 characters')

    await page.fill('#metaDescriptionInput', 'y'.repeat(111))
    await expect(page.locator('#metaDescriptionStatus')).toHaveClass('warn')
    await expect(page.locator('#metaDescriptionStatus')).toHaveText('Over 110 characters')
  })

  test('edited SEO fields persist to saved review state', async ({ page }) => {
    await gotoFresh(page)
    await openSearchMetadata(page)

    await page.fill('#seoTitleInput', 'Persisted SEO title')
    await page.fill('#metaDescriptionInput', 'Persisted meta description')
    await page.dispatchEvent('#metaDescriptionInput', 'change')
    await settleDebounce(page)

    const state = await readState(page)
    expect(state.pages.pestsTopic?.seo_title).toBe('Persisted SEO title')
    expect(state.pages.pestsTopic?.meta_description).toBe('Persisted meta description')
  })

  test('fields resync to the new page defaults on page change', async ({ page }) => {
    await gotoFresh(page)
    await openSearchMetadata(page)

    await page.fill('#seoTitleInput', 'Only for the agency page')
    await page.dispatchEvent('#seoTitleInput', 'change')
    await settleDebounce(page)

    await selectPage(page, 'rodentsReport')

    const value = await page.inputValue('#seoTitleInput')
    expect(value).not.toBe('Only for the agency page')
    expect(value.length).toBeGreaterThan(0)
  })

  test('search preview URL reflects the current page slug', async ({ page }) => {
    await gotoFresh(page)
    const slug = await page.evaluate(() => window.HHVC_PAGES.pestsTopic.slug)
    await expect(page.locator('#seoPreviewUrl')).toHaveText(`https://${slug}`)

    await selectPage(page, 'payFee')
    const paySlug = await page.evaluate(() => window.HHVC_PAGES.payFee.slug)
    await expect(page.locator('#seoPreviewUrl')).toHaveText(`https://${paySlug}`)
  })
})
