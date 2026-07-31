// The Tool status (ops) tab, driven through the real UI.
//
// The diagnostics themselves are covered exhaustively as pure functions in
// tests/review-ops-data.test.js. What only a browser can prove is the part
// that touches saved state: that the tab mounts lazily, that it reports real
// records, and above all that its one destructive button asks first, deletes
// exactly what it named, and leaves everything else alone.
const { test, expect } = require('@playwright/test')
const { gotoFresh, readState, openWorkspaceTab, focusMockPage } = require('./helpers')

/** Seed a live record plus two for pages the site no longer has. */
async function seedWithOrphans(page) {
  await page.evaluate(() => {
    const state = window.reviewState.read()
    state.pages.pestsTopic = {
      page_key: 'pestsTopic',
      decision: 'Approved',
      history: [{ timestamp: '2026-07-01T10:00:00.000Z', decision: 'Approved' }],
    }
    state.pages.retiredOldPage = { page_key: 'retiredOldPage', decision: 'Blocked', history: [] }
    state.pages.anotherGonePage = { page_key: 'anotherGonePage', decision: 'Approved', history: [] }
    window.reviewState.write(state)
  })
  await page.reload()
  await page.waitForSelector('#mockPage h1')
}

test.describe('Tool status tab', () => {
  test('opens from the 6 shortcut without renumbering the others', async ({ page }) => {
    await gotoFresh(page)
    // Shortcuts are gated on focus being in a shortcut context.
    await focusMockPage(page)

    await page.keyboard.press('6')
    await expect(page.locator('[data-workspace-panel="ops"]')).toBeVisible()

    // The tab was appended, so 5 must still be Help.
    await page.keyboard.press('5')
    await expect(page.locator('[data-workspace-panel="help"]')).toBeVisible()
  })

  test('reports connection status when nothing is configured', async ({ page }) => {
    await gotoFresh(page)
    await openWorkspaceTab(page, 'ops')

    // "Not configured" is a normal answer for both optional backends, not an
    // error state.
    await expect(page.locator('.ops-panel')).toContainText('Review sync')
    await expect(page.locator('.ops-panel')).toContainText('Not configured')
  })

  test('names the records whose pages no longer exist', async ({ page }) => {
    await gotoFresh(page)
    await seedWithOrphans(page)
    await openWorkspaceTab(page, 'ops')

    const finding = page.locator('.ops-finding', { hasText: 'pages that no longer exist' })
    await expect(finding).toContainText('2 found')
    // Listed in full, not summarised — the point of naming them is that an
    // operator can go and look.
    await expect(finding).toContainText('retiredOldPage')
    await expect(finding).toContainText('anotherGonePage')
  })

  test('says so plainly when there is nothing wrong', async ({ page }) => {
    await gotoFresh(page)
    await openWorkspaceTab(page, 'ops')

    const finding = page.locator('.ops-finding', { hasText: 'pages that no longer exist' })
    await expect(finding).toContainText('None')
    // No destructive button when there is nothing to destroy.
    await expect(page.locator('[data-ops-action="prune-orphans"]')).toHaveCount(0)
  })

  test('removing orphans asks first and deletes only those records', async ({ page }) => {
    await gotoFresh(page)
    await seedWithOrphans(page)
    await openWorkspaceTab(page, 'ops')

    const seen = []
    page.on('dialog', (dialog) => {
      seen.push(dialog.message())
      dialog.accept()
    })
    await page.click('[data-ops-action="prune-orphans"]')

    // It must name the count and the keys before deleting anything — this is
    // the only path in the tool that deletes review data outright.
    expect(seen).toHaveLength(1)
    expect(seen[0]).toContain('2')
    expect(seen[0]).toContain('retiredOldPage')

    const state = await readState(page)
    expect(Object.keys(state.pages)).toEqual(['pestsTopic'])
    // The live record keeps its decision and its history.
    expect(state.pages.pestsTopic.decision).toBe('Approved')
    expect(state.pages.pestsTopic.history).toHaveLength(1)
  })

  test('cancelling the prompt changes nothing', async ({ page }) => {
    await gotoFresh(page)
    await seedWithOrphans(page)
    await openWorkspaceTab(page, 'ops')

    page.on('dialog', (dialog) => dialog.dismiss())
    await page.click('[data-ops-action="prune-orphans"]')

    const state = await readState(page)
    expect(Object.keys(state.pages).sort()).toEqual([
      'anotherGonePage',
      'pestsTopic',
      'retiredOldPage',
    ])
  })

  test('re-derives the orphan list at click time, not from what was rendered', async ({ page }) => {
    await gotoFresh(page)
    await seedWithOrphans(page)
    await openWorkspaceTab(page, 'ops')

    // The panel can sit open while a sync pull or an import changes saved
    // state underneath it. Deleting the list it happened to render would then
    // remove the wrong records.
    await page.evaluate(() => {
      const state = window.reviewState.read()
      delete state.pages.anotherGonePage
      state.pages.yetAnotherGhost = { page_key: 'yetAnotherGhost', decision: 'Blocked' }
      window.reviewState.write(state)
    })

    const seen = []
    page.on('dialog', (dialog) => {
      seen.push(dialog.message())
      dialog.accept()
    })
    await page.click('[data-ops-action="prune-orphans"]')

    // The record that appeared after the render is caught; the one that went
    // away is not mentioned.
    expect(seen[0]).toContain('yetAnotherGhost')
    expect(seen[0]).not.toContain('anotherGonePage')

    const state = await readState(page)
    expect(Object.keys(state.pages)).toEqual(['pestsTopic'])
  })
})
