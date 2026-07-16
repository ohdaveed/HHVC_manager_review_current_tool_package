const { test, expect } = require('@playwright/test')
const { gotoFresh, seedState, readState, makeReviewRecord, DECISIONS } = require('./helpers')

// Shortcuts only fire while focus is inside #reviewWorkspace, .canvas-toolbar,
// or #mockPage (isShortcutContext in js/keyboard-shortcuts.js), so each test
// clicks the mock page heading first to land focus in a shortcut context.
async function focusMockPage(page) {
  await page.locator('#mockPage h1').first().click()
}

test.describe('keyboard shortcuts', () => {
  test('j and k navigate to the next and previous queue page', async ({ page }) => {
    await gotoFresh(page)
    await focusMockPage(page)

    // j/k walk the queue's current sort order (not the menu order), so read
    // the app's computed target instead of hardcoding a page key.
    const expectedNext = await page.evaluate(() => window.reviewQueue.getAdjacentKey(1, 'All'))
    expect(expectedNext).toBeTruthy()

    await page.keyboard.press('j')
    await expect(page.locator('#pageSelect')).toHaveValue(expectedNext)

    await focusMockPage(page)
    await page.keyboard.press('k')
    await expect(page.locator('#pageSelect')).toHaveValue('pestsTopic')
  })

  test('w toggles the workspace and number keys switch tabs', async ({ page }) => {
    await gotoFresh(page)
    await focusMockPage(page)

    const workspace = page.locator('#reviewWorkspace')
    await page.keyboard.press('w')
    await expect(workspace).toBeVisible()

    await page.keyboard.press('2')
    await expect(page.locator('#reviewWorkspaceTabChecks')).toHaveAttribute('aria-selected', 'true')

    await page.keyboard.press('4')
    await expect(page.locator('#reviewWorkspaceTabHelp')).toHaveAttribute('aria-selected', 'true')

    await focusMockPage(page)
    await page.keyboard.press('w')
    await expect(workspace).toBeHidden()
  })

  test('decision keys set the current page decision', async ({ page }) => {
    await gotoFresh(page)
    await focusMockPage(page)

    await page.keyboard.press('a')
    await expect(page.locator('#reviewDecision')).toHaveValue(DECISIONS.approved)

    await focusMockPage(page)
    await page.keyboard.press('b')
    await expect(page.locator('#reviewDecision')).toHaveValue(DECISIONS.blocked)

    const state = await readState(page)
    expect(state.pages.pestsTopic?.decision).toBe(DECISIONS.blocked)
  })

  test('? opens the shortcuts help dialog and Escape closes it', async ({ page }) => {
    await gotoFresh(page)
    await focusMockPage(page)

    await page.keyboard.press('?')
    await expect(page.locator('#shortcutsHelpDialog')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.locator('#shortcutsHelpDialog')).toBeHidden()
  })

  test('shortcuts are ignored while typing in a form field', async ({ page }) => {
    await gotoFresh(page)

    await page.click('#reviewNotes')
    await page.keyboard.press('j')

    await expect(page.locator('#pageSelect')).toHaveValue('pestsTopic')
    await expect(page.locator('#reviewNotes')).toHaveValue('j')
  })

  test('n jumps to the next page that still needs review', async ({ page }) => {
    await gotoFresh(page)
    await seedState(page, {
      rodentsReport: makeReviewRecord('rodentsReport', { decision: DECISIONS.approved }),
    })
    await page.reload()
    await page.waitForSelector('#mockPage h1')
    await focusMockPage(page)

    const expected = await page.evaluate(() => window.reviewQueue.getNextNeedsReviewKey())
    expect(expected).toBeTruthy()
    expect(expected).not.toBe('rodentsReport')

    await page.keyboard.press('n')

    await expect(page.locator('#pageSelect')).toHaveValue(expected)
  })
})
