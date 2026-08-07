const { test, expect } = require('@playwright/test')
const {
  gotoFresh,
  readState,
  seedState,
  settleDebounce,
  openWorkspaceTab,
  selectPage,
  setDecision,
} = require('./helpers')

test.describe('manager review workflow', () => {
  test('requires a reviewer name before recording a non-default decision', async ({ page }) => {
    await gotoFresh(page)

    await page.click('#decisionQuickActions .decision-chip[data-decision="Approved"]')

    await expect(page.locator('#reviewDecision')).toHaveValue('Needs review')
    await expect(page.locator('#reviewerDecisionError')).toHaveText(
      'Enter your name or initials before recording this decision.'
    )
    await expect(page.locator('#reviewerInput')).toBeFocused()
    await expect(page.locator('#reviewerInput')).toHaveAttribute('aria-invalid', 'true')
    expect((await readState(page)).pages.pestsTopic).toBeUndefined()

    await page.fill('#reviewerInput', 'E2E Reviewer')
    await expect(page.locator('#reviewerDecisionError')).toBeHidden()
    await page.click('#decisionQuickActions .decision-chip[data-decision="Approved"]')
    await settleDebounce(page)

    expect((await readState(page)).pages.pestsTopic?.decision).toBe('Approved')
  })

  test('decision, notes, and reviewer save to local review state', async ({ page }) => {
    await gotoFresh(page)

    await setDecision(page, 'Approved')
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

    await setDecision(page, 'Revise and resubmit')
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

    await page.fill('#reviewerInput', 'E2E Reviewer')
    await page.click('#decisionQuickActions .decision-chip[data-decision="Blocked"]')

    await expect(page.locator('#reviewDecision')).toHaveValue('Blocked')
    await expect(page.locator('#toastContainer .toast').first()).toBeVisible()
    await settleDebounce(page)
    const state = await readState(page)
    expect(state.pages.pestsTopic?.decision).toBe('Blocked')
  })

  test('sidebar decision changes are recorded as history rounds, typing is not', async ({
    page,
  }) => {
    await gotoFresh(page)

    // A decision set from the sidebar is a real review round, even though it
    // persists through the same autosave path as free-text fields.
    await setDecision(page, 'Approved')
    await settleDebounce(page)

    let history = (await readState(page)).pages.pestsTopic?.history || []
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({ decision: 'Approved', updated_by: 'decision' })

    // Typing notes must NOT append: that would put one entry per debounced
    // keystroke into the audit trail.
    await page.fill('#reviewNotes', 'some notes typed after deciding')
    await page.dispatchEvent('#reviewNotes', 'change')
    await settleDebounce(page)

    history = (await readState(page)).pages.pestsTopic?.history || []
    expect(history).toHaveLength(1)

    // A second, different decision is a second round.
    await setDecision(page, 'Blocked')
    await settleDebounce(page)

    history = (await readState(page)).pages.pestsTopic?.history || []
    expect(history).toHaveLength(2)
    expect(history[1]).toMatchObject({ decision: 'Blocked', updated_by: 'decision' })
  })

  test('editing notes on a record with no stored decision does not fabricate a decision round', async ({
    page,
  }) => {
    await gotoFresh(page)

    // `decision` is optional on a stored record — an imported or
    // server-provided one may omit it, and the sidebar then shows the
    // default 'Needs review'. Comparing the sidebar's unchanged default
    // against a raw `undefined` used to read as a transition and record a
    // decision round for someone who only edited a note.
    await seedState(page, {
      pestsTopic: {
        page_key: 'pestsTopic',
        notes: 'imported without a decision field',
        updated_at: '2026-01-01T00:00:00.000Z',
        history: [],
      },
    })
    await page.reload()
    await page.waitForSelector('#mockPage h1')

    await expect(page.locator('#reviewDecision')).toHaveValue('Needs review')

    await page.fill('#reviewNotes', 'just adding a note, no decision made')
    await page.dispatchEvent('#reviewNotes', 'change')
    await settleDebounce(page)

    const state = await readState(page)
    expect(state.pages.pestsTopic?.notes).toBe('just adding a note, no decision made')
    expect(state.pages.pestsTopic?.history || []).toHaveLength(0)
  })

  test('a content-neutral autosave never marks a legacy record clean', async ({ page }) => {
    // Regression coverage: records written before local_dirty existed carry
    // no such field, and pullFromServer treats that absence as "may hold
    // unpushed work" so an upgraded browser can't lose a never-pushed
    // review. An autosave whose content matched the stored record used to
    // evaluate Boolean(undefined) || false and stamp an explicit false —
    // handing the pull path permission to overwrite it wholesale.
    await gotoFresh(page)

    await seedState(page, {
      pestsTopic: {
        page_key: 'pestsTopic',
        decision: 'Approved',
        notes: 'reviewed before this browser was upgraded',
        updated_at: '2026-01-01T00:00:00.000Z',
        // No local_dirty field at all — this is the legacy shape.
        history: [],
      },
    })
    await page.reload()
    await page.waitForSelector('#mockPage h1')

    // Type and undo, so the debounced save fires with unchanged content.
    await page.fill('#reviewNotes', 'reviewed before this browser was upgraded typo')
    await page.fill('#reviewNotes', 'reviewed before this browser was upgraded')
    await page.dispatchEvent('#reviewNotes', 'change')
    await settleDebounce(page)

    const saved = (await readState(page)).pages.pestsTopic
    expect(saved.notes).toBe('reviewed before this browser was upgraded')
    // Still unknown provenance — never an explicit false.
    expect(saved.local_dirty).not.toBe(false)
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

  // Regression (fba9ef5): the pre-navigation flush used to save
  // unconditionally, so merely LOOKING at a page created a review record —
  // marking it "touched" in the queue, reordering the priority sort
  // mid-navigation, and skewing progress counts.
  test('plain navigation does not create saved review records', async ({ page }) => {
    await gotoFresh(page)

    await page.click('[data-sticky-action="next"]')
    await settleDebounce(page)

    const state = await readState(page)
    expect(Object.keys(state.pages || {})).toEqual([])
  })

  // Companion regression: the flush must still rescue keystrokes sitting in
  // the debounce window when the reviewer switches pages — and file them
  // under the OUTGOING page's key. (The page picker's <select> already holds
  // the destination key when its change handler runs, so a flush keyed off
  // #pageSelect.value would misfile the note under the new page.)
  test('pending edits flush under the outgoing page key on page switch', async ({ page }) => {
    await gotoFresh(page)

    // fill() fires 'input' (arming the 300ms debounce) but not 'change', so
    // the save is still pending when the page switch happens.
    await page.fill('#reviewNotes', 'Flushed before switch')
    await page.selectOption('#pageSelect', 'payFee')
    await settleDebounce(page)

    const state = await readState(page)
    expect(state.pages.pestsTopic?.notes).toBe('Flushed before switch')
    // The destination page was only opened, never edited — no record for it.
    expect(state.pages.payFee).toBeUndefined()
  })

  // Regression: page-picker navigation must run through the DECORATED
  // window.renderPage, not js/page-render.js's raw export.
  //
  // js/ux-improvements.js wraps window.renderPage after startup. It is the
  // only wrapper left — js/interactive-sitemap.js was deleted and
  // js/manager-review-export.js's decorator went with the sidebar label it
  // refreshed — but one is enough to make the bug below reachable.
  // Reassigning window.renderPage does not rebind an ES module `import`, so
  // when js/app.js called its imported binding the picker silently bypassed
  // every wrapper — and applySavedPageState() never ran for the destination,
  // leaving the PREVIOUS page's decision and notes sitting in the sidebar
  // form. The next autosave would then write them onto the wrong page.
  //
  // The sibling flush test above does not catch this: the debounced save
  // fires on its own timer under the stale reviewFormPageKey, so the note
  // still lands under the outgoing key whether or not the wrapper ran. Only
  // the restore half of the wrapper is observably missing, which is what this
  // asserts. It navigates with #pageSelect specifically — the sticky bar and
  // queue rows call window.renderPage directly and were never affected.
  test('page-picker navigation restores each page saved review fields', async ({ page }) => {
    await gotoFresh(page)

    await setDecision(page, 'Approved')
    await page.fill('#reviewNotes', 'Agency page reads well')
    await settleDebounce(page)

    await selectPage(page, 'payFee')
    await setDecision(page, 'Blocked')
    await page.fill('#reviewNotes', 'Fee amount unconfirmed')
    await settleDebounce(page)

    // Back to the first page: its own saved values must be restored, not the
    // ones left over from the page we just came from.
    await selectPage(page, 'pestsTopic')
    await expect(page.locator('#reviewDecision')).toHaveValue('Approved')
    await expect(page.locator('#reviewNotes')).toHaveValue('Agency page reads well')

    // And forward again, to prove the restore is per-page rather than a
    // one-off replay of whatever was saved first.
    await selectPage(page, 'payFee')
    await expect(page.locator('#reviewDecision')).toHaveValue('Blocked')
    await expect(page.locator('#reviewNotes')).toHaveValue('Fee amount unconfirmed')

    // Neither page may have inherited the other's content on disk.
    const state = await readState(page)
    expect(state.pages.pestsTopic.decision).toBe('Approved')
    expect(state.pages.pestsTopic.notes).toBe('Agency page reads well')
    expect(state.pages.payFee.decision).toBe('Blocked')
    expect(state.pages.payFee.notes).toBe('Fee amount unconfirmed')
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

  test('the decision toast offers a jump to the next page needing review', async ({ page }) => {
    await gotoFresh(page)

    // js/ux-improvements-workspace.js has always passed this action to
    // showToast, but showToast only declared (message, type), so the object
    // was dropped and the button never rendered — a shipped affordance that
    // did nothing, with matching CSS that styled nothing.
    await setDecision(page, 'Approved')

    const toast = page.locator('.toast', { hasText: 'Decision set: Approved' })
    await expect(toast).toBeVisible()
    const action = toast.locator('.toast-action')
    await expect(action).toHaveText('Next Actionable Page')

    // It must land on the page the LABEL names, not merely somewhere else —
    // asserting "the key changed" would pass for a callback navigating anywhere.
    // Same capture-then-compare shape as keyboard-shortcuts.spec.js's `n` test.
    const expected = await page.evaluate(() => window.reviewQueue.getNextNeedsReviewKey())
    await action.click()
    await expect(page.locator('#pageSelect')).toHaveValue(expected)
    // Clicking dismisses the toast, which otherwise describes the page we left.
    // The explicit timeout has to beat showToast's 4s auto-dismiss: on the 5s
    // default this passes whether or not the click removes anything.
    await expect(toast).toHaveCount(0, { timeout: 1000 })
  })

  test('checks tab renders rule results for the current page', async ({ page }) => {
    await gotoFresh(page)
    await openWorkspaceTab(page, 'checks')

    const panel = page.locator('#reviewChecksPanel')
    await expect(panel).toBeVisible()
    await expect(panel).toContainText(/title/i)
    await expect(panel).toContainText(/summary/i)
  })

  // A failed mandate has to name the document it comes from, or a reviewer who
  // disagrees has nothing to check. The citation used to be computed and then
  // dropped on the way to this list.
  test('checks tab shows the source citation on a plain-language rule', async ({ page }) => {
    await gotoFresh(page)
    await openWorkspaceTab(page, 'checks')
    const citations = page.locator('#reviewChecksPanel .compliance-citation')
    expect(await citations.count()).toBeGreaterThan(0)
    await expect(citations.first()).toContainText(/Manual §\d|SF\.gov/)
  })

  test('karl tag toggle hides tags and the preference survives reload', async ({ page }) => {
    await gotoFresh(page)
    await expect(page.locator('#tagToggle')).not.toBeChecked()

    // The checkbox is visually replaced by the .karl-slider span, so click the
    // wrapping switch label instead of the hidden input.
    await page.locator('.karl-switch').click()
    await expect(page.locator('#tagToggle')).toBeChecked()
    await expect(page.locator('body')).not.toHaveClass(/hide-karl-tags/)
    await settleDebounce(page)

    await page.reload()
    await page.waitForSelector('#mockPage h1')
    await expect(page.locator('#tagToggle')).toBeChecked()
    await expect(page.locator('body')).not.toHaveClass(/hide-karl-tags/)
  })
})
