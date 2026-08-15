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

  /* The mockup and the workspace must never occupy the same pixels, at ANY
     width — whichever layout is in force.

     The test above proves docking works at 1800 and every other spec in the
     suite runs at Playwright's 1280 default, so for a while the only widths
     under test were one above the problem and one below it. In between, the
     breakpoint said "dock" while the mockup was still wider than the column
     left for it: .browser-shell will not shrink past its min-content floor, so
     it ran underneath the sticky panel at the widths a 14-inch laptop and a
     125%-scaled 1920px display actually report. Re-measured on 2026-08-15 after
     the SFDS type and spacing work moved that floor from 780px to 765px: the
     overlap a 1400px breakpoint would still produce is 147px at 1440, 80px at
     1536 and 35px at 1600.

     Sampling across the range is the point. A single extra width would just
     move the blind spot somewhere else.

     The assertion is plain rectangle non-intersection, and deliberately does
     NOT first work out which layout is in force. An earlier version decided
     that with `workspace.top < 400`, which is a bug rather than a shortcut:
     getBoundingClientRect() is viewport-relative, so the threshold moves with
     the scroll position. openWorkspaceTab() clicks the tab, and in the stacked
     layout Playwright scrolls that off-screen tab into view — which can drag a
     stacked panel under 400 and run the side-by-side assertion against it
     (left ~370 vs a shell ending near 1170: a failure with no defect behind
     it). The converse hid real breakage: a docked layout scrolled past the
     threshold skipped the check entirely.

     Non-intersection needs no mode at all. Two boxes are disjoint when one is
     entirely left, right, above or below the other, which is exactly what this
     test's name claims and is true in both layouts. It also avoids restating
     the 1700px breakpoint, so the guard cannot drift out of step with the
     rule it guards.

     THE SCROLL RESET BELOW IS LOAD-BEARING, and non-intersection alone did not
     remove the need for it. The workspace is `position: sticky`, so it holds
     the viewport while the mockup scrolls past underneath — which means the
     two rectangles' VERTICAL relationship still moves with scroll even though
     their horizontal one does not. openWorkspaceTab() leaves the page at
     scrollY 8589 (in the stacked layout the panel really is nine screenfuls
     down, which is the distance the docked layout exists to remove), and that
     scroll persists across every setViewportSize in the loop. Measured at
     1720px it left the shell at [-7925, 934] against a workspace at [0, 950]:
     an overlap of 934px, correct today but only by 933px of margin, from a
     page already scrolled to the bottom of the document. Anything that makes
     the mockup shorter or the stacked page taller pushes shell.bottom above
     the viewport, overlapY goes negative, and the horizontal check — the one
     that actually catches the bug — is masked at every docked width.

     Scrolling to the top before each measurement pins the one degree of
     freedom sticky positioning leaves. The area assertion underneath it closes
     the same class from the other side: a zero-sized rect (a panel gone
     display:none, a selector that stopped matching) intersects nothing and
     would otherwise sail through as a pass. */
  test('the mockup never overlaps the workspace, at any width', async ({ page }) => {
    await gotoFresh(page)
    await openWorkspaceTab(page, 'overview')

    for (let width = 1280; width <= 1920; width += 40) {
      await page.setViewportSize({ width, height: 950 })
      const boxes = await page.evaluate(() => {
        window.scrollTo(0, 0)
        const rect = (selector) => {
          const { left, right, top, bottom } = document
            .querySelector(selector)
            .getBoundingClientRect()
          return { left, right, top, bottom }
        }
        return { shell: rect('.browser-shell'), workspace: rect('#reviewWorkspace') }
      })

      const { shell, workspace } = boxes

      // Both boxes must actually exist before "they do not overlap" means
      // anything — see the header note on zero-sized rects.
      for (const [name, box] of Object.entries({ shell, workspace })) {
        expect(box.right - box.left, `${name} has no width at ${width}px`).toBeGreaterThan(0)
        expect(box.bottom - box.top, `${name} has no height at ${width}px`).toBeGreaterThan(0)
      }

      // Sub-pixel layout rounding can leave the two edges a hair apart in
      // either direction, so allow 1px of slack before calling it an overlap.
      const GAP_TOLERANCE = 1
      const overlapX = Math.min(shell.right, workspace.right) - Math.max(shell.left, workspace.left)
      const overlapY = Math.min(shell.bottom, workspace.bottom) - Math.max(shell.top, workspace.top)
      const intersects = overlapX > GAP_TOLERANCE && overlapY > GAP_TOLERANCE

      expect(
        intersects,
        `mockup overlaps the workspace at ${width}px by ` +
          `${Math.round(overlapX)}x${Math.round(overlapY)}px — ` +
          `shell [${Math.round(shell.left)},${Math.round(shell.right)}] ` +
          `workspace [${Math.round(workspace.left)},${Math.round(workspace.right)}]`
      ).toBe(false)
    }
  })

  /* The sweep above proves the two boxes never overlap AT THE BREAKPOINT WE
     SHIPPED. It cannot tell a breakpoint with 50px of margin from one with
     none, because a docked width that is one pixel from colliding passes it
     exactly as cleanly as one with room to spare — so it would go green right
     up to the moment the crossing point drifted past 1700 and then fail with
     no warning. This test measures the crossing itself.

     The crossing is arithmetic over two quantities. `.browser-shell` has a
     min-content floor it will not go below (measured 765px on 2026-08-15, down
     from 780px before the SFDS type and spacing work), and the sidebar plus the
     canvas's own padding put its right edge at a FIXED x while it sits on that
     floor — 370 + 20 + 765 = 1155. The docked panel occupies the third grid
     track, `minmax(340px, 30vw)`, so it starts at 0.7 x viewport. The two cross
     at 1155 / 0.7 = 1650px: below that the mockup runs underneath the sticky
     panel, above it there is clear air.

     That arithmetic describes ONE of two regimes, and holds only while the
     crossing falls inside it. While the canvas track is narrower than the
     floor the shell overflows its column and its right edge does not move,
     which is the case the division models. Above `(floor + 410) / 0.7` —
     1678.6px today, the width at which `0.7W - 370` minus the canvas's 40px of
     padding finally reaches 765 — the shell widens with its track instead, and
     from there the panel simply stays 20px clear of it (measured: a constant
     -20px gap from 1680 to 1920, the canvas's own right padding, never
     returning to an overlap). The crossing at 1650 sits below that boundary,
     so it is a real width rather than an extrapolation, and the test asserts
     the boundary rather than assuming it.

     Nothing here forces the docked layout on. That x is the same in both
     layouts — it is set by the sidebar track and the canvas padding, neither of
     which the media query touches — so it can be read at a viewport narrow
     enough to push the shell onto its floor, which 1100px does, while the
     stacked fallback is in force. Forcing the docked layout would mean
     restating the media block's six declarations in the test, where they would
     drift out of step with the stylesheet they exist to model. */
  test('the dock breakpoint clears the measured crossing point', async ({ page }) => {
    await gotoFresh(page)
    await openWorkspaceTab(page, 'overview')

    // 1100px is below the shell's floor plus the sidebar, so the shell is
    // pinned at its minimum and its right edge reads the fixed x the crossing
    // is derived from. It is also above the 980px block that collapses the
    // grid to one track, which would move the sidebar out of the sum.
    await page.setViewportSize({ width: 1100, height: 950 })
    const shellRight = await page.evaluate(() => {
      window.scrollTo(0, 0)
      return document.querySelector('.browser-shell').getBoundingClientRect().right
    })

    // The panel's left edge is `100vw - 30vw`, so the widths where the two
    // touch is shellRight / 0.7.
    const crossing = shellRight / 0.7
    const BREAKPOINT = 1700

    // 30vw only wins over the track's 340px minimum above 1133px; below that
    // the panel's left edge is `100vw - 340`, and this division stops
    // describing the layout at all.
    expect(
      crossing,
      `the 30vw track no longer sets the panel edge at ${crossing}px`
    ).toBeGreaterThan(1133)

    // And the crossing has to fall inside the regime where the shell is still
    // on its floor — see the header note. Above this width the shell grows with
    // its track and the two never touch, so a "crossing" computed out here
    // would be a width the layout never actually reaches.
    const floorRegimeEnds = (shellRight + 20) / 0.7
    expect(
      crossing,
      `the shell leaves its floor at ${Math.round(floorRegimeEnds)}px, before the ` +
        `${Math.ceil(crossing)}px this arithmetic calls the crossing`
    ).toBeLessThan(floorRegimeEnds)

    expect(
      crossing,
      `the mockup's right edge sits at ${shellRight}px, so the docked panel ` +
        `first clears it at ${Math.ceil(crossing)}px — past the ${BREAKPOINT}px ` +
        `breakpoint in css/dashboard.css, which now docks a layout that overlaps`
    ).toBeLessThanOrEqual(BREAKPOINT)
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
    await expect(page.locator('.review-advanced-group')).toHaveCount(4)
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
