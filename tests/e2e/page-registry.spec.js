// Adding and deleting page mockups through the UI (js/page-registry*.js).
//
// There is a unit layer beneath this — tests/page-registry-data.test.js covers
// the pure validation and the in-place mutation — but three of the properties
// this feature depends on are only observable in a real browser, and each one
// fails SILENTLY when it breaks:
//
//   1. An added page's inline content edits persist. That works only because
//      js/page-registry.js runs before js/state.js takes its one-time
//      ORIGINAL_DATA clone, and seeds ORIGINAL_DATA itself for a page added
//      mid-session. Without either, computeSectionEdits() returns {} and the
//      edit is accepted, autosaved, and gone on the next load.
//   2. Deleting the page on screen does not blank that page's saved review.
//      reviewFormPageKey stays pinned to the deleted key until the follow-up
//      navigation settles, so a keystroke landing in between would rewrite the
//      record from a page object that no longer exists.
//   3. An added page survives the JSON backup round trip. The import path's
//      page filter requires DATA.pages[key], so the registry has to be applied
//      before it runs or the reviews come back and the pages do not.
//
// Everything here drives the real UI — the sidebar buttons, the real confirm
// dialog, the real file input — for the reason the deleted review-import spec
// is a cautionary tale in CLAUDE.md: a test that reimplements the logic it is
// checking stays green against the bug.
const fs = require('fs')
const { test, expect } = require('@playwright/test')
const {
  gotoFresh,
  openAdvancedSection,
  openWorkspaceTab,
  readState,
  selectPage,
  setDecision,
  settleDebounce,
  DECISIONS,
  editorJsBlock,
  replaceEditorJsFieldText,
  commitEditorJsField,
} = require('./helpers')

const NEW_PAGE = {
  key: 'noiseComplaints',
  title: 'Report a noise complaint',
  type: 'Transaction',
  summary: 'Tell us about ongoing noise from a neighbouring property.',
  audience: 'A tenant kept awake by a neighbour',
  reading: 'Grade 6',
}

/** Accept every confirm() this page raises, and record what it asked. */
async function acceptDialogs(page) {
  const seen = []
  page.on('dialog', (dialog) => {
    seen.push(dialog.message())
    dialog.accept().catch(() => {})
  })
  return seen
}

/** Fill and submit the sidebar's add-page form. */
async function addPage(page, overrides) {
  const values = { ...NEW_PAGE, ...overrides }
  await page.click('#addPageButton')
  await page.waitForSelector('#pageAdminAddForm')
  await page.fill('#newPageTitle', values.title)
  await page.selectOption('#newPageType', values.type)
  await page.fill('#newPageSummary', values.summary)
  await page.fill('#newPageAudience', values.audience)
  await page.fill('#newPageReading', values.reading)
  await page.fill('#newPageKey', values.key)
  await page.click('#pageAdminAddForm button[type="submit"]')
  return values
}

/** Open the Help tab's "Pages added and deleted" disclosure. */
async function openPagesPanel(page) {
  return openAdvancedSection(page, 'Pages added and deleted')
}

async function downloadToText(page, trigger) {
  const [download] = await Promise.all([page.waitForEvent('download'), trigger()])
  return fs.readFileSync(await download.path(), 'utf8')
}

function writeTempFile(name, content) {
  const filePath = test.info().outputPath(name)
  fs.writeFileSync(filePath, content)
  return filePath
}

test.describe('adding a page mockup', () => {
  test('renders the new page and puts it in the picker and the review queue', async ({ page }) => {
    await gotoFresh(page)
    await addPage(page)

    // Navigated to, not merely created.
    await expect(page.locator('#mockPage h1')).toHaveText(NEW_PAGE.title)
    await expect(page.locator('#browserUrl')).toHaveText('https://sf.gov/report-a-noise-complaint')
    await expect(page.locator('#pageSelect')).toHaveValue(NEW_PAGE.key)

    // In the picker, under the optgroup its type belongs to — buildPageSelect()
    // strips the type prefix from the order label, so the option text is the
    // bare title.
    const option = page.locator(`#pageSelect optgroup[label="Transaction pages"] option`, {
      hasText: NEW_PAGE.title,
    })
    await expect(option).toHaveCount(1)

    // Matched on the row's own data-page-key rather than on its title text: the
    // title legitimately appears more than once in this panel (the row, and the
    // failing-checks ranking above it), so a text match asserts the wrong thing
    // and fails for a reason that has nothing to do with the queue.
    await openWorkspaceTab(page, 'overview')
    await expect(
      page.locator(`.review-queue-table-row[data-page-key="${NEW_PAGE.key}"]`)
    ).toHaveCount(1)
  })

  test('appends the page rather than displacing the agency page', async ({ page }) => {
    await gotoFresh(page)
    await addPage(page)
    const order = await page.evaluate(() => window.HHVC_DATA.order.map(([key]) => key))
    expect(order[0]).toBe('pestsTopic')
    expect(order.at(-1)).toBe(NEW_PAGE.key)
  })

  test('reports validation errors without discarding what was typed', async ({ page }) => {
    await gotoFresh(page)
    // `ownerHub` is a real page key, so this collides.
    await addPage(page, { key: 'ownerHub' })

    await expect(page.locator('.page-admin-errors')).toBeVisible()
    await expect(page.locator('.page-admin-errors')).toContainText('already in use')
    // The form is still open and still holds the reviewer's work.
    await expect(page.locator('#newPageTitle')).toHaveValue(NEW_PAGE.title)
    await expect(page.locator('#newPageSummary')).toHaveValue(NEW_PAGE.summary)
  })

  test('rejects a key that is not a bare identifier', async ({ page }) => {
    await gotoFresh(page)
    await addPage(page, { key: 'noise complaints' })
    await expect(page.locator('.page-admin-errors')).toContainText('must start with a letter')
  })

  // THE ORIGINAL_DATA PROOF. computeSectionEdits() diffs the live page against
  // window.ORIGINAL_DATA and returns {} when the page has no entry there, so
  // without the seeding in js/page-registry.js this edit would be accepted,
  // autosaved, and silently absent after the reload.
  test('keeps an inline paragraph edit on an added page across a reload', async ({ page }) => {
    await gotoFresh(page)
    await addPage(page)

    // Wait for the new page to actually be on screen first. renderPage applies
    // content inside a View Transition, so the paragraph selector matches the
    // OUTGOING page's element for a moment — clicking that opens an editor on
    // pestsTopic and then detaches mid-action.
    await expect(page.locator('#mockPage h1')).toHaveText(NEW_PAGE.title)

    const paragraph = page.locator('#mockPage p[data-rewrite-field="sections.0.paragraphs.0"]')
    await expect(paragraph).toBeVisible()
    await paragraph.click()

    const block = await editorJsBlock(page)
    await replaceEditorJsFieldText(page, block, 'Edited on the added page.')
    await commitEditorJsField(page)
    await expect(
      page.locator('#mockPage p', { hasText: 'Edited on the added page.' })
    ).toBeVisible()
    await settleDebounce(page)

    const saved = await readState(page)
    expect(saved.pages[NEW_PAGE.key].section_edits['sections.0.paragraphs']).toBeTruthy()

    await page.reload()
    await page.waitForSelector('#mockPage h1')
    await selectPage(page, NEW_PAGE.key)
    await expect(page.locator('#mockPage')).toContainText('Edited on the added page.')
  })
})

test.describe('deleting a page mockup', () => {
  test('removes it from the picker and the queue but keeps its review', async ({ page }) => {
    await acceptDialogs(page)
    await gotoFresh(page)

    await selectPage(page, 'tenantRights')
    await setDecision(page, DECISIONS.approved)
    await page.fill('#reviewNotes', 'Reviewed before deletion')
    await page.dispatchEvent('#reviewNotes', 'change')
    await settleDebounce(page)

    await page.click('#deletePageButton')
    await page.waitForFunction(() => !window.HHVC_DATA.pages.tenantRights)

    await expect(page.locator('#pageSelect option[value="tenantRights"]')).toHaveCount(0)
    await openWorkspaceTab(page, 'overview')
    await expect(
      page.locator('#reviewWorkspaceOverview [data-page-key="tenantRights"]')
    ).toHaveCount(0)

    const saved = await readState(page)
    expect(saved.pages.tenantRights.decision).toBe(DECISIONS.approved)
    expect(saved.pages.tenantRights.notes).toBe('Reviewed before deletion')
    expect(saved.globals.page_registry.hidden.tenantRights).toBeTruthy()
  })

  // THE SHARP EDGE, and the reason js/page-registry.js flushes before it
  // mutates. reviewFormPageKey still points at the deleted key until the
  // follow-up navigation settles, so an autosave landing in that window would
  // rebuild the record from `DATA.pages[key] || {}` — blanking page_title,
  // edited_title, edited_summary and section_edits, which is exactly what
  // Restore is supposed to bring back.
  //
  // Driven by leaving keystrokes INSIDE the 300ms autosave debounce at the
  // moment of deletion (page.fill dispatches `input`, not `change`, so the save
  // is pending rather than done). Asserting on the outcome — the stored record
  // still describes the page — rather than on which internal path saved it:
  // clicking the button also blurs the textarea, so in a real browser the
  // native change event may well win the race. That is fine. The property worth
  // pinning is that no ordering of those two leaves the record blanked.
  test('does not blank the deleted page’s saved review mid-keystroke', async ({ page }) => {
    await acceptDialogs(page)
    await gotoFresh(page)

    await selectPage(page, 'tenantRights')
    // Read the real title off the page rather than hardcoding it, so this keeps
    // checking "the stored title was not blanked" instead of failing whenever
    // someone legitimately rewrites that page's title.
    const title = await page.locator('#mockPage h1').first().innerText()
    await setDecision(page, DECISIONS.blocked)
    await page.fill('#reviewNotes', 'Notes that must survive')
    await page.dispatchEvent('#reviewNotes', 'change')
    await settleDebounce(page)

    // Pending, not saved: no `change`, no settle.
    await page.fill('#reviewNotes', 'Notes still inside the debounce')
    await page.click('#deletePageButton')
    await page.waitForFunction(() => !window.HHVC_DATA.pages.tenantRights)
    await settleDebounce(page)

    const saved = await readState(page)
    expect(saved.pages.tenantRights.decision).toBe(DECISIONS.blocked)
    expect(saved.pages.tenantRights.page_title).toBe(title)
    expect(saved.pages.tenantRights.notes).toBe('Notes still inside the debounce')
    // Restoring it has to give the reviewer that content back, which is the
    // whole point of not blanking it.
    await openPagesPanel(page)
    await page.click('[data-page-admin="restore"][data-page-key="tenantRights"]')
    await page.waitForFunction(() => Boolean(window.HHVC_DATA.pages.tenantRights))
    await selectPage(page, 'tenantRights')
    await expect(page.locator('#reviewNotes')).toHaveValue('Notes still inside the debounce')
  })

  test('files later keystrokes under the page that replaced the deleted one', async ({ page }) => {
    await acceptDialogs(page)
    await gotoFresh(page)

    await selectPage(page, 'tenantRights')
    await page.click('#deletePageButton')
    await page.waitForFunction(() => !window.HHVC_DATA.pages.tenantRights)
    // Wait for the replacement navigation to settle before typing. Typing into
    // the form mid-navigation is a race the app resolves in the navigation's
    // favour (applySavedPageState replaces the field and disarms the pending
    // save), which is correct behaviour and not what this asserts.
    await expect(page.locator('#pageSelect')).not.toHaveValue('tenantRights')
    await settleDebounce(page)

    const currentKey = await page.locator('#pageSelect').inputValue()
    await page.fill('#reviewNotes', 'Typed after the delete')
    await page.dispatchEvent('#reviewNotes', 'change')
    await settleDebounce(page)

    const saved = await readState(page)
    expect(saved.pages[currentKey].notes).toBe('Typed after the delete')
    expect(saved.pages.tenantRights?.notes ?? '').not.toBe('Typed after the delete')
  })

  test('names the pages that link to it in the confirmation', async ({ page }) => {
    const dialogs = await acceptDialogs(page)
    await gotoFresh(page)

    // ownerHub is a hub other pages point cards at, so it has inbound links.
    await selectPage(page, 'ownerHub')
    await page.click('#deletePageButton')
    await page.waitForFunction(() => !window.HHVC_DATA.pages.ownerHub)

    expect(dialogs).toHaveLength(1)
    expect(dialogs[0]).toContain('point here')
    // The consequence, stated: an inheriting card falls back to the text
    // written on the card, which cannot publish on the real site.
    expect(dialogs[0]).toContain('cannot publish')
  })

  test('refuses to delete the HHVC agency page', async ({ page }) => {
    await gotoFresh(page)
    // pestsTopic is the boot page, so the button is already disabled.
    await expect(page.locator('#deletePageButton')).toBeDisabled()
    await expect(page.locator('#deletePageButton')).toHaveAttribute('title', /cannot be deleted/)

    await selectPage(page, 'tenantRights')
    await expect(page.locator('#deletePageButton')).toBeEnabled()
  })

  test('leaves a deleted page out of the orphaned-records report', async ({ page }) => {
    await acceptDialogs(page)
    await gotoFresh(page)

    await selectPage(page, 'tenantRights')
    await setDecision(page, DECISIONS.approved)
    await settleDebounce(page)
    await page.click('#deletePageButton')
    await page.waitForFunction(() => !window.HHVC_DATA.pages.tenantRights)

    // A deleted page's record is not orphaned — it is what Restore brings
    // back — so offering to prune it would destroy a review one click from
    // recovery.
    const group = await openAdvancedSection(page, 'Stored review data on this browser')
    await expect(group).toContainText('Records for pages that no longer exist')
    await expect(group.locator('[data-ops-action="prune-orphans"]')).toHaveCount(0)
  })
})

test.describe('restoring a deleted page', () => {
  test('puts it back at its original position in the page order', async ({ page }) => {
    await acceptDialogs(page)
    await gotoFresh(page)

    const originalOrder = await page.evaluate(() => window.HHVC_DATA.order.map(([key]) => key))
    const originalIndex = originalOrder.indexOf('tenantRights')

    await selectPage(page, 'tenantRights')
    await page.click('#deletePageButton')
    await page.waitForFunction(() => !window.HHVC_DATA.pages.tenantRights)

    await openPagesPanel(page)
    await page.click('[data-page-admin="restore"][data-page-key="tenantRights"]')
    await page.waitForFunction(() => Boolean(window.HHVC_DATA.pages.tenantRights))

    // Appending instead would silently permute the reviewer's reading order,
    // which drives j/k navigation, the queue and batch PNG export.
    const restored = await page.evaluate(() => window.HHVC_DATA.order.map(([key]) => key))
    expect(restored.indexOf('tenantRights')).toBe(originalIndex)
    expect(restored).toEqual(originalOrder)
    await expect(page.locator('#pageSelect option[value="tenantRights"]')).toHaveCount(1)
  })

  test('keeps the decision and notes recorded before the deletion', async ({ page }) => {
    await acceptDialogs(page)
    await gotoFresh(page)

    await selectPage(page, 'tenantRights')
    await setDecision(page, DECISIONS.revise)
    await page.fill('#reviewNotes', 'Survives a delete and a restore')
    await page.dispatchEvent('#reviewNotes', 'change')
    await settleDebounce(page)

    await page.click('#deletePageButton')
    await page.waitForFunction(() => !window.HHVC_DATA.pages.tenantRights)
    await openPagesPanel(page)
    await page.click('[data-page-admin="restore"][data-page-key="tenantRights"]')
    await page.waitForFunction(() => Boolean(window.HHVC_DATA.pages.tenantRights))

    await selectPage(page, 'tenantRights')
    await expect(page.locator('#reviewDecision')).toHaveValue(DECISIONS.revise)
    await expect(page.locator('#reviewNotes')).toHaveValue('Survives a delete and a restore')
  })
})

test.describe('the JSON backup round trip', () => {
  // The import path's page filter requires DATA.pages[key], so if the registry
  // were applied after it the reviews would come back and the pages would not —
  // and the reviewer would be told "imported 1 page reviews" with nothing to
  // show for it.
  test('carries an added page and its review to a cleared browser', async ({ page }) => {
    await gotoFresh(page)
    await addPage(page)
    await setDecision(page, DECISIONS.approvedWithEdits)
    await page.fill('#reviewNotes', 'Reviewed the page I added')
    await page.dispatchEvent('#reviewNotes', 'change')
    await settleDebounce(page)

    await page.selectOption('#exportScope', 'backup-json')
    const backup = await downloadToText(page, () => page.click('#exportReviews'))
    expect(JSON.parse(backup).globals.page_registry.added[NEW_PAGE.key]).toBeTruthy()

    // A genuinely empty browser: clear, then reload so js/page-registry.js
    // re-boots with no registry at all.
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForSelector('#mockPage h1')
    await expect(page.locator(`#pageSelect option[value="${NEW_PAGE.key}"]`)).toHaveCount(0)

    await page.setInputFiles('#reviewImportFile', writeTempFile('backup.json', backup))
    await page.waitForFunction((key) => Boolean(window.HHVC_DATA.pages[key]), NEW_PAGE.key)

    await expect(page.locator(`#pageSelect option[value="${NEW_PAGE.key}"]`)).toHaveCount(1)
    await selectPage(page, NEW_PAGE.key)
    await expect(page.locator('#mockPage h1')).toHaveText(NEW_PAGE.title)
    await expect(page.locator('#reviewDecision')).toHaveValue(DECISIONS.approvedWithEdits)
    await expect(page.locator('#reviewNotes')).toHaveValue('Reviewed the page I added')
  })

  test('an import that adds pages but matches no reviews still reports success', async ({
    page,
  }) => {
    await gotoFresh(page)
    await addPage(page)
    await page.selectOption('#exportScope', 'backup-json')
    const backup = await downloadToText(page, () => page.click('#exportReviews'))

    // Strip the reviews, keep the registry — the shape a backup taken before
    // any of the added pages were reviewed would have.
    const parsed = JSON.parse(backup)
    parsed.pages = {}
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForSelector('#mockPage h1')

    await page.setInputFiles(
      '#reviewImportFile',
      writeTempFile('pages-only.json', JSON.stringify(parsed))
    )
    await page.waitForFunction((key) => Boolean(window.HHVC_DATA.pages[key]), NEW_PAGE.key)
    // Reporting "no reviews matching the current page list" here would tell the
    // reviewer nothing happened, moments after a page appeared.
    await expect(page.locator('#reviewExportStatus')).toContainText('added or deleted page')
  })
})

test.describe('the Help tab’s pages panel', () => {
  test('lists an added page and removes it for good on request', async ({ page }) => {
    const dialogs = await acceptDialogs(page)
    await gotoFresh(page)
    await addPage(page)

    const group = await openPagesPanel(page)
    await expect(group).toContainText(NEW_PAGE.title)
    await expect(group).toContainText(NEW_PAGE.key)

    await group.locator(`[data-page-admin="remove"][data-page-key="${NEW_PAGE.key}"]`).click()
    await page.waitForFunction((key) => !window.HHVC_DATA.pages[key], NEW_PAGE.key)

    expect(dialogs.at(-1)).toContain('cannot be restored')
    // The review record is deliberately left for the existing orphan prune
    // rather than deleted by a second review-data-deletion path.
    expect(dialogs.at(-1)).toContain('Export a backup first')
    const saved = await readState(page)
    expect(saved.globals.page_registry.added[NEW_PAGE.key]).toBeUndefined()
  })

  test('reports an empty state before anything has been added or deleted', async ({ page }) => {
    await gotoFresh(page)
    const group = await openPagesPanel(page)
    await expect(group).toContainText('No pages have been added in this browser.')
    await expect(group).toContainText('No pages have been deleted.')
  })
})

test.describe('regressions found in review', () => {
  // Codex, P1. Restore used to re-seed ORIGINAL_DATA from the stashed LIVE page,
  // which by then holds the reviewer's edits — so "original" became "edited",
  // computeSectionEdits() found no difference, and the next autosave recomputed
  // section_edits as empty. The reviewer's inline edits were gone after a
  // reload, with nothing erroring at any point.
  test('an inline edit survives delete and restore of the same page', async ({ page }) => {
    await acceptDialogs(page)
    await gotoFresh(page)
    await selectPage(page, 'tenantRights')

    const paragraph = page
      .locator('#mockPage p[data-rewrite-field^="sections."][data-rewrite-field$=".paragraphs.0"]')
      .first()
    await paragraph.click()
    const block = await editorJsBlock(page)
    await replaceEditorJsFieldText(page, block, 'Edited before the delete.')
    await commitEditorJsField(page)
    await expect(
      page.locator('#mockPage p', { hasText: 'Edited before the delete.' })
    ).toBeVisible()
    await settleDebounce(page)

    const editedPath = Object.keys((await readState(page)).pages.tenantRights.section_edits)[0]
    expect(editedPath).toBeTruthy()

    await page.click('#deletePageButton')
    await page.waitForFunction(() => !window.HHVC_DATA.pages.tenantRights)
    await openPagesPanel(page)
    await page.click('[data-page-admin="restore"][data-page-key="tenantRights"]')
    await page.waitForFunction(() => Boolean(window.HHVC_DATA.pages.tenantRights))

    await selectPage(page, 'tenantRights')
    await expect(page.locator('#mockPage')).toContainText('Edited before the delete.')
    // The stored diff must still be there: an ORIGINAL_DATA overwritten with the
    // edited copy makes this recompute to {} on the very next autosave.
    await page.fill('#reviewNotes', 'touch to force an autosave')
    await page.dispatchEvent('#reviewNotes', 'change')
    await settleDebounce(page)
    const after = await readState(page)
    expect(after.pages.tenantRights.section_edits[editedPath]).toBeTruthy()

    await page.reload()
    await page.waitForSelector('#mockPage h1')
    await selectPage(page, 'tenantRights')
    await expect(page.locator('#mockPage')).toContainText('Edited before the delete.')
  })

  // Codex, P2. The stashed index was measured against an already-shortened
  // order, so deleting two pages recorded overlapping indexes and restoring them
  // reordered the site.
  test('restoring two deleted pages preserves the canonical page order', async ({ page }) => {
    await acceptDialogs(page)
    await gotoFresh(page)

    const before = await page.evaluate(() => window.HHVC_DATA.order.map(([key]) => key))

    for (const key of ['ownerHub', 'tenantRights']) {
      await selectPage(page, key)
      await page.click('#deletePageButton')
      await page.waitForFunction((k) => !window.HHVC_DATA.pages[k], key)
    }

    // Restored in the REVERSE order of deletion — the case a remembered index
    // gets wrong.
    await openPagesPanel(page)
    for (const key of ['tenantRights', 'ownerHub']) {
      await page.click(`[data-page-admin="restore"][data-page-key="${key}"]`)
      await page.waitForFunction((k) => Boolean(window.HHVC_DATA.pages[k]), key)
    }

    const after = await page.evaluate(() => window.HHVC_DATA.order.map(([key]) => key))
    expect(after).toEqual(before)
  })

  // Codex, P1. An import that hides the page on screen used to rebuild the
  // picker without navigating, leaving #mockPage showing a deleted page while
  // #pageSelect had moved on — and later edits filed under the replacement key.
  test('an import that deletes the open page navigates away from it', async ({ page }) => {
    await acceptDialogs(page)
    await gotoFresh(page)

    // Build a backup in which tenantRights is deleted.
    await selectPage(page, 'tenantRights')
    await page.click('#deletePageButton')
    await page.waitForFunction(() => !window.HHVC_DATA.pages.tenantRights)
    await page.selectOption('#exportScope', 'backup-json')
    const backup = await downloadToText(page, () => page.click('#exportReviews'))
    expect(JSON.parse(backup).globals.page_registry.hidden.tenantRights).toBeTruthy()

    // Fresh browser, sitting ON tenantRights, then import.
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForSelector('#mockPage h1')
    await selectPage(page, 'tenantRights')
    await page.setInputFiles('#reviewImportFile', writeTempFile('hides-current.json', backup))
    await page.waitForFunction(() => !window.HHVC_DATA.pages.tenantRights)

    // The picker and the mockup must agree — a mismatch is what misfiles writes.
    await expect(page.locator('#pageSelect')).not.toHaveValue('tenantRights')
    const shownKey = await page.locator('#pageSelect').inputValue()
    const shownTitle = await page.evaluate((k) => window.HHVC_PAGES[k].title, shownKey)
    await expect(page.locator('#mockPage h1')).toHaveText(shownTitle)
  })

  // Codex, P1. applyImportedRegistry() removes deleted pages from DATA.pages
  // before the import filter runs, so filtering on presence alone dropped
  // exactly the reviews the reviewer deleted the page WITHOUT losing.
  test('imports the review of a page the same backup deletes', async ({ page }) => {
    await acceptDialogs(page)
    await gotoFresh(page)

    await selectPage(page, 'tenantRights')
    await setDecision(page, DECISIONS.blocked)
    await page.fill('#reviewNotes', 'Reviewed, then deleted')
    await page.dispatchEvent('#reviewNotes', 'change')
    await settleDebounce(page)
    await page.click('#deletePageButton')
    await page.waitForFunction(() => !window.HHVC_DATA.pages.tenantRights)

    await page.selectOption('#exportScope', 'backup-json')
    const backup = await downloadToText(page, () => page.click('#exportReviews'))

    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForSelector('#mockPage h1')
    await page.setInputFiles('#reviewImportFile', writeTempFile('deleted-review.json', backup))
    await page.waitForFunction(() => !window.HHVC_DATA.pages.tenantRights)

    // Restoring must hand back the review the backup carried, not a blank page.
    await openPagesPanel(page)
    await page.click('[data-page-admin="restore"][data-page-key="tenantRights"]')
    await page.waitForFunction(() => Boolean(window.HHVC_DATA.pages.tenantRights))
    await selectPage(page, 'tenantRights')
    await expect(page.locator('#reviewDecision')).toHaveValue(DECISIONS.blocked)
    await expect(page.locator('#reviewNotes')).toHaveValue('Reviewed, then deleted')
  })
})

test.describe('regressions found in the second review round', () => {
  // Codex, P1. refreshDerivedViews(key) selected the restored page in the picker
  // without rendering it, so getCurrentKey() returned the restored key while
  // #mockPage still showed the previous page — and the next note edit was filed
  // under the restored page. The reviewer also could not navigate to it, because
  // the picker already claimed it was current.
  test('restoring a page leaves the picker on the page actually being shown', async ({ page }) => {
    await acceptDialogs(page)
    await gotoFresh(page)

    await selectPage(page, 'tenantRights')
    await page.click('#deletePageButton')
    await page.waitForFunction(() => !window.HHVC_DATA.pages.tenantRights)
    await expect(page.locator('#pageSelect')).not.toHaveValue('tenantRights')

    const shownKey = await page.locator('#pageSelect').inputValue()
    await openPagesPanel(page)
    await page.click('[data-page-admin="restore"][data-page-key="tenantRights"]')
    await page.waitForFunction(() => Boolean(window.HHVC_DATA.pages.tenantRights))

    // The picker must still agree with the mockup.
    await expect(page.locator('#pageSelect')).toHaveValue(shownKey)
    const shownTitle = await page.evaluate((k) => window.HHVC_PAGES[k].title, shownKey)
    await expect(page.locator('#mockPage h1')).toHaveText(shownTitle)

    // And a note typed now belongs to the page on screen, not the restored one.
    await page.fill('#reviewNotes', 'Belongs to the visible page')
    await page.dispatchEvent('#reviewNotes', 'change')
    await settleDebounce(page)
    const saved = await readState(page)
    expect(saved.pages[shownKey].notes).toBe('Belongs to the visible page')
    expect(saved.pages.tenantRights?.notes ?? '').not.toBe('Belongs to the visible page')
  })

  // Codex, P2. exportSavedLocalReviewsCsv() iterated DATA.order only, so a
  // deleted page's retained review silently vanished from the CSV — review data
  // lost from an export the reviewer never asked to narrow.
  test('the saved-reviews CSV still carries a deleted page’s review', async ({ page }) => {
    await acceptDialogs(page)
    await gotoFresh(page)

    await selectPage(page, 'tenantRights')
    await setDecision(page, DECISIONS.blocked)
    await page.fill('#reviewNotes', 'Kept after deletion')
    await page.dispatchEvent('#reviewNotes', 'change')
    await settleDebounce(page)
    await page.click('#deletePageButton')
    await page.waitForFunction(() => !window.HHVC_DATA.pages.tenantRights)

    await page.selectOption('#exportScope', 'all-csv')
    const csv = await downloadToText(page, () => page.click('#exportReviews'))
    expect(csv).toContain('tenantRights')
    expect(csv).toContain('Kept after deletion')
    // And the page metadata falls back to the record rather than emitting
    // "undefined | San Francisco" from an empty page object.
    expect(csv).not.toContain('undefined')
  })
})
