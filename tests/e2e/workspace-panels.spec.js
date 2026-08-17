const { test, expect } = require('@playwright/test')
const { gotoFresh, openWorkspaceTab } = require('./helpers')

/* The three sitemap tests that used to head this file are gone with the
   sitemap itself. It was a fourth way to navigate 19 pages — after the sidebar
   picker, the sticky bar's Previous/Next and the queue's Open — drawing a
   hierarchy one level deep, where most hubs rendered as "HUB 0/0" above "No
   child pages assigned". What is left here is the workspace shell: the Help
   panel's contents, the collapsed advanced sections that replaced three tabs,
   and the sidebar toggle. */

test.describe('workspace panels', () => {
  test('the narrow review layout does not overflow the document', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await gotoFresh(page)

    const width = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
    }))
    expect(width.document).toBe(width.viewport)
  })

  test('the tab strip carries exactly three tabs', async ({ page }) => {
    await gotoFresh(page)
    await openWorkspaceTab(page, 'overview')

    await expect(page.locator('[data-workspace-tab]')).toHaveCount(3)
    await expect(page.locator('[data-workspace-tab="sitemap"]')).toHaveCount(0)
  })

  test('hiding the workspace really removes it', async ({ page }) => {
    // `.review-workspace` declares its own `display`, which outranks the UA
    // stylesheet's `[hidden] { display: none }` — the panel stayed on screen
    // after the attribute was set until a matching `[hidden]` rule was added.
    await gotoFresh(page)
    await openWorkspaceTab(page, 'overview')

    await page.click('[data-sticky-action="toggle-workspace"]')

    await expect(page.locator('#reviewWorkspace')).toBeHidden()
    await expect(page.locator('.app')).not.toHaveClass(/workspace-docked/)
  })

  test('help tab renders guidance panels and the review checklist', async ({ page }) => {
    await gotoFresh(page)
    await openWorkspaceTab(page, 'help')

    await expect(page.locator('#dashboardGuidancePanel')).toBeVisible()
    await expect(page.locator('#dashboardShortcutsPanel')).toBeVisible()
    const checks = await page.locator('#reviewWorkspaceHelp .checklist .check').count()
    expect(checks).toBeGreaterThan(0)
  })

  test('help carries the Karl tag legend, and the mockup no longer does', async ({ page }) => {
    await gotoFresh(page)

    // The legend used to head a banner above every mockup — about 495px of
    // permanent reference material decoding a colour that was never the only
    // encoding, since each tag names its kind in words.
    await expect(page.locator('.browser-shell .karl-tag-legend')).toHaveCount(0)
    // The switch it sat above stays, in the toolbar.
    await expect(page.locator('.canvas-toolbar #tagToggle')).toHaveCount(1)

    await openWorkspaceTab(page, 'help')
    await expect(page.locator('#reviewWorkspaceHelp .karl-tag-legend')).toBeVisible()
  })

  test('server sync is local-only until saved configuration enables it', async ({ page }) => {
    await gotoFresh(page)

    const settings = page.locator('.review-sync-settings')
    await expect(settings).not.toHaveAttribute('open', '')
    await expect(settings.locator('summary')).toHaveText('Server sync (optional — local-only)')
    await expect(page.locator('#pullReviewState')).toBeDisabled()
    await expect(page.locator('#pushAllReviewState')).toBeDisabled()

    await settings.locator('summary').click()
    await page.fill('#reviewSyncApiUrl', 'https://sync.example.test')
    await page.fill('#reviewSyncApiToken', 'review-token')
    await expect(page.locator('#pullReviewState')).toBeDisabled()
    await page.click('#saveSyncSettings')

    await expect(settings.locator('summary')).toHaveText('Server sync')
    await expect(page.locator('#pullReviewState')).toBeEnabled()
    await expect(page.locator('#pushAllReviewState')).toBeEnabled()

    await page.fill('#reviewSyncApiUrl', '')
    await page.fill('#reviewSyncApiToken', '')
    await page.click('#saveSyncSettings')

    await expect(settings.locator('summary')).toHaveText('Server sync (optional — local-only)')
    await expect(page.locator('#pullReviewState')).toBeDisabled()
    await expect(page.locator('#pushAllReviewState')).toBeDisabled()
  })

  test('the advanced sections sit at the end of Help, after the guidance', async ({ page }) => {
    await gotoFresh(page)
    await openWorkspaceTab(page, 'help')

    // js/dashboard-guidance.js re-appends the block so DOM order matches
    // reading order rather than relying on a CSS `order` rule.
    const isLast = await page.evaluate(() => {
      const help = document.getElementById('reviewWorkspaceHelp')
      return help?.lastElementChild?.id === 'reviewWorkspaceAdvanced'
    })
    expect(isLast).toBe(true)
    await expect(page.locator('.review-advanced-group')).toHaveCount(5)
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
