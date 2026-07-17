const { test, expect } = require('@playwright/test')
const { gotoFresh, readState, settleDebounce, openWorkspaceTab } = require('./helpers')

test.describe('manager review workflow', () => {
  test('decision, notes, and reviewer save to local review state', async ({ page }) => {
    await gotoFresh(page)

    await page.selectOption('#reviewDecision', 'Approved')
    await page.fill('#reviewNotes', 'Looks good overall')
    await page.fill('#reviewerInput', 'E2E Reviewer')
    await page.dispatchEvent('#reviewerInput', 'change')
    await settleDebounce(page)

    const state = await readState(page)
    expect(state.pages.pestsTopic?.decision).toBe('Approved')
    expect(state.pages.pestsTopic?.notes).toBe('Looks good overall')
    expect(state.pages.pestsTopic?.reviewer).toBe('E2E Reviewer')
  })

  test('review fields are restored after a page reload', async ({ page }) => {
    await gotoFresh(page)

    await page.selectOption('#reviewDecision', 'Revise and resubmit')
    await page.fill('#reviewNotes', 'Needs shorter summary')
    await page.dispatchEvent('#reviewNotes', 'change')
    await settleDebounce(page)

    await page.reload()
    await page.waitForSelector('#mockPage h1')

    await expect(page.locator('#reviewDecision')).toHaveValue('Revise and resubmit')
    await expect(page.locator('#reviewNotes')).toHaveValue('Needs shorter summary')
  })

  test('quick-action chips set the decision and show a toast', async ({ page }) => {
    await gotoFresh(page)

    await page.click('#decisionQuickActions .decision-chip[data-decision="Blocked"]')

    await expect(page.locator('#reviewDecision')).toHaveValue('Blocked')
    await expect(page.locator('#toastContainer .toast').first()).toBeVisible()
    await settleDebounce(page)
    const state = await readState(page)
    expect(state.pages.pestsTopic?.decision).toBe('Blocked')
  })

  test('sticky bar next/prev navigate through the review queue order', async ({ page }) => {
    await gotoFresh(page)

    // Next/prev walk the queue's current sort order (not the menu order), so
    // read the app's computed target instead of hardcoding a page key.
    const expectedNext = await page.evaluate(() => window.reviewQueue.getAdjacentKey(1, 'All'))
    expect(expectedNext).toBeTruthy()

    await page.click('[data-sticky-action="next"]')
    await expect(page.locator('#pageSelect')).toHaveValue(expectedNext)

    await page.click('[data-sticky-action="prev"]')
    await expect(page.locator('#pageSelect')).toHaveValue('pestsTopic')
  })

  test('sticky bar toggle opens and closes the review workspace', async ({ page }) => {
    await gotoFresh(page)
    const workspace = page.locator('#reviewWorkspace')

    if (await workspace.isVisible()) {
      await page.click('[data-sticky-action="toggle-workspace"]')
      await expect(workspace).toBeHidden()
    }

    await page.click('[data-sticky-action="toggle-workspace"]')
    await expect(workspace).toBeVisible()

    await page.click('[data-sticky-action="toggle-workspace"]')
    await expect(workspace).toBeHidden()
  })

  test('checks tab renders rule results for the current page', async ({ page }) => {
    await gotoFresh(page)
    await openWorkspaceTab(page, 'checks')

    const panel = page.locator('#reviewChecksPanel')
    await expect(panel).toBeVisible()
    await expect(panel).toContainText(/title/i)
    await expect(panel).toContainText(/summary/i)
  })

  test('karl tag toggle hides tags and the preference survives reload', async ({ page }) => {
    await gotoFresh(page)
    await expect(page.locator('#tagToggle')).toBeChecked()

    // The checkbox is visually replaced by the .karl-slider span, so click the
    // wrapping switch label instead of the hidden input.
    await page.locator('.karl-switch').click()
    await expect(page.locator('#tagToggle')).not.toBeChecked()
    await expect(page.locator('body')).toHaveClass(/hide-karl-tags/)
    await settleDebounce(page)

    await page.reload()
    await page.waitForSelector('#mockPage h1')
    await expect(page.locator('#tagToggle')).not.toBeChecked()
    await expect(page.locator('body')).toHaveClass(/hide-karl-tags/)
  })
})
