const { test, expect } = require('@playwright/test')
const { gotoFresh, openWorkspaceTab } = require('./helpers')

test.describe('interactive sitemap and workspace panels', () => {
  test('sitemap mounts lazily and renders a node per page', async ({ page }) => {
    await gotoFresh(page)
    await expect(page.locator('.sitemap-diagram-node')).toHaveCount(0)

    await openWorkspaceTab(page, 'sitemap')

    await expect(page.locator('.sitemap-diagram-node[data-sitemap-key]')).toHaveCount(19)
  })

  test('clicking a sitemap node navigates to that page', async ({ page }) => {
    await gotoFresh(page)
    await openWorkspaceTab(page, 'sitemap')

    await page.click('.sitemap-diagram-node[data-sitemap-key="payFee"]')

    await expect(page.locator('#pageSelect')).toHaveValue('payFee')
  })

  test('sitemap search dims non-matching nodes', async ({ page }) => {
    await gotoFresh(page)
    await openWorkspaceTab(page, 'sitemap')

    await page.fill('.sitemap-search-input', 'mosquito')

    // The sitemap search dims non-matching nodes (class "dimmed") rather than
    // removing them, so assert on the class, not on visibility.
    await expect(page.locator('.sitemap-diagram-node[data-sitemap-key="payFee"]')).toHaveClass(
      /dimmed/
    )
    await expect(
      page.locator('.sitemap-diagram-node[data-sitemap-key="mosquitoControl"]')
    ).not.toHaveClass(/dimmed/)
  })

  test('help tab renders guidance panels and the review checklist', async ({ page }) => {
    await gotoFresh(page)
    await openWorkspaceTab(page, 'help')

    await expect(page.locator('#dashboardGuidancePanel')).toBeVisible()
    await expect(page.locator('#dashboardShortcutsPanel')).toBeVisible()
    const checks = await page.locator('#reviewWorkspaceHelp .checklist .check').count()
    expect(checks).toBeGreaterThan(0)
  })

  test('sidebar toggle collapses and expands the sidebar', async ({ page }) => {
    await gotoFresh(page)
    const app = page.locator('.app')

    await page.click('#sidebarToggle')
    await expect(app).toHaveClass(/sidebar-collapsed/)

    await page.click('#sidebarToggle')
    await expect(app).not.toHaveClass(/sidebar-collapsed/)
  })
})
