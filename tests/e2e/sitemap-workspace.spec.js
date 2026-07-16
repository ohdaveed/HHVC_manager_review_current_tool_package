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

  test('sitemap search filters visible nodes', async ({ page }) => {
    await gotoFresh(page)
    await openWorkspaceTab(page, 'sitemap')

    await page.fill('.sitemap-search-input', 'mosquito')

    // Wait for a known non-matching node to be filtered out before counting
    // (count() doesn't auto-wait on the search re-render).
    await expect(page.locator('.sitemap-diagram-node[data-sitemap-key="payFee"]')).toBeHidden()
    const visible = await page.locator('.sitemap-diagram-node[data-sitemap-key]:visible').count()
    expect(visible).toBeGreaterThan(0)
    expect(visible).toBeLessThan(19)
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
