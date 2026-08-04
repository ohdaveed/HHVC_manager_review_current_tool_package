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
  test('the tab strip carries exactly three tabs', async ({ page }) => {
    await gotoFresh(page)
    await openWorkspaceTab(page, 'overview')

    await expect(page.locator('[data-workspace-tab]')).toHaveCount(3)
    await expect(page.locator('[data-workspace-tab="sitemap"]')).toHaveCount(0)
  })

  test('the workspace docks beside the mockup rather than below it', async ({ page }) => {
    // The panel used to be the last child of .canvas, which put it about 9,400
    // pixels down a 10,300-pixel document — so the page under review and the
    // instruments judging it could never be on screen together.
    await page.setViewportSize({ width: 1800, height: 1000 })
    await gotoFresh(page)
    await openWorkspaceTab(page, 'overview')

    const shell = await page.locator('.browser-shell').boundingBox()
    const workspace = await page.locator('#reviewWorkspace').boundingBox()

    // Side by side: the panel starts to the right of the mockup, and both are
    // within one viewport vertically.
    expect(workspace.x).toBeGreaterThan(shell.x + shell.width - 1)
    expect(workspace.y).toBeLessThan(1000)
    expect(shell.y).toBeLessThan(1000)
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
    await expect(page.locator('.review-advanced-group')).toHaveCount(3)
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
