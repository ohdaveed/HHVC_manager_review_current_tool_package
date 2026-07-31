// One-step undo for queue decision actions, driven through the real UI.
//
// The unit-testable half lives in js/review-queue-undo.js, but the parts worth
// proving are the ones that only exist end to end: that the button appears
// after an action and names what it will reverse, that the reversal actually
// reaches localStorage, that history[] survives it, and that a page edited
// after the action is left alone rather than silently rolled back.
const { test, expect } = require('@playwright/test')
const { gotoFresh, readState, openWorkspaceTab } = require('./helpers')

/** Select two pages in the queue and apply a bulk action to them. */
async function bulkApprove(page) {
  await page.check('[data-queue-select-key="scopeInfo"]')
  await page.check('[data-queue-select-key="tenantRights"]')
  await page.click('[data-queue-bulk-action="approved"]')
  await expect(page.locator('[data-queue-undo="last"]')).toBeVisible()
}

test.describe('review queue undo', () => {
  test('no undo button until an action has been taken', async ({ page }) => {
    await gotoFresh(page)
    await openWorkspaceTab(page, 'overview')

    await expect(page.locator('[data-queue-undo="last"]')).toHaveCount(0)
  })

  test('the undo button names the action and page count it will reverse', async ({ page }) => {
    await gotoFresh(page)
    await openWorkspaceTab(page, 'overview')
    await bulkApprove(page)

    // Never a mystery button: a reviewer about to undo should not have to
    // remember what they last did.
    await expect(page.locator('[data-queue-undo="last"]')).toContainText('2 pages')
  })

  test('undo restores the previous decisions', async ({ page }) => {
    await gotoFresh(page)
    await openWorkspaceTab(page, 'overview')
    await bulkApprove(page)

    const afterAction = await readState(page)
    expect(afterAction.pages.scopeInfo.decision).toBe('Approved')
    expect(afterAction.pages.tenantRights.decision).toBe('Approved')

    await page.click('[data-queue-undo="last"]')

    const afterUndo = await readState(page)
    expect(afterUndo.pages.scopeInfo.decision).toBe('Needs review')
    expect(afterUndo.pages.tenantRights.decision).toBe('Needs review')
  })

  test('undo appends a round rather than erasing the one it reverses', async ({ page }) => {
    await gotoFresh(page)
    await openWorkspaceTab(page, 'overview')
    await bulkApprove(page)

    const afterAction = await readState(page)
    const roundsAfterAction = afterAction.pages.scopeInfo.history.length

    await page.click('[data-queue-undo="last"]')

    // history[] is append-only — mergeReviewRecord is the only thing that ever
    // writes an entry and it only ever adds. An undo that removed the entry
    // would let a reviewer quietly delete a decision from the audit trail.
    const afterUndo = await readState(page)
    expect(afterUndo.pages.scopeInfo.history.length).toBe(roundsAfterAction + 1)
    expect(afterUndo.pages.scopeInfo.history.some((entry) => entry.decision === 'Approved')).toBe(
      true
    )
  })

  test('the button is consumed once used', async ({ page }) => {
    await gotoFresh(page)
    await openWorkspaceTab(page, 'overview')
    await bulkApprove(page)

    await page.click('[data-queue-undo="last"]')

    // A second press must not reverse a different set of pages than the label
    // described.
    await expect(page.locator('[data-queue-undo="last"]')).toHaveCount(0)
  })

  test('a page changed after the action is left alone, not rolled back', async ({ page }) => {
    await gotoFresh(page)
    await openWorkspaceTab(page, 'overview')
    await bulkApprove(page)

    // Move one of the two pages on independently, the way a sidebar edit,
    // import or sync pull would.
    await page.click('[data-queue-select="clear"]')
    await page.check('[data-queue-select-key="scopeInfo"]')
    await page.click('[data-queue-bulk-action="blocked"]')

    // That second action takes over the undo slot, so reach past the UI to
    // exercise the staleness guard itself.
    const result = await page.evaluate(() => {
      const undo = window.ReviewQueueInternal.undo
      undo.recordAction({
        label: 'Approved',
        entries: [
          { pageKey: 'scopeInfo', prior: { decision: 'Needs review' }, appliedUpdatedAt: 'stale' },
          {
            pageKey: 'tenantRights',
            prior: { decision: 'Needs review' },
            appliedUpdatedAt: window.reviewState.read().pages.tenantRights.updated_at,
          },
        ],
      })
      return undo.undoLastAction()
    })

    expect(result.undone).toBe(1)
    expect(result.skipped).toEqual(['scopeInfo'])

    // The page that moved on keeps its newer decision; the untouched one reverts.
    const state = await readState(page)
    expect(state.pages.scopeInfo.decision).toBe('Blocked')
    expect(state.pages.tenantRights.decision).toBe('Needs review')
  })
})
