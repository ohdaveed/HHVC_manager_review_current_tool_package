/* The manual check CLAUDE.md mandates, written down so it stops being manual.

   "Any change to any of these modules, or to js/review-merge.js, must be
   manually verified before being called done: export a snapshot, re-import it,
   and confirm existing decisions/notes are still present rather than wiped."

   import-export.spec.js already covers merge-not-wipe, but not this shape of
   it: both of its merge tests seed state through seedState() (a direct
   localStorage write, so the export path never runs) and its round-trip test
   CLEARS state before re-importing (so there is nothing left to destroy). The
   case the warning is actually about is re-importing an older snapshot ON TOP
   of live state that has moved on since the export — a page reviewed after the
   snapshot was taken is absent from the file, and a wholesale replace drops it.
   That is the regression that already happened once here.

   Everything below goes through the real UI — sidebar fields, the export
   button, the import file input. Nothing reaches into review state directly,
   because the deleted review-import-export.spec.js proved what that is worth:
   it hand-rolled the merge inside page.evaluate() instead of calling
   importReviewStateBackup(), and so stayed green against the very wholesale
   replace it looked like it was guarding. */

const fs = require('fs')
const { test, expect } = require('@playwright/test')
const {
  gotoFresh,
  readState,
  settleDebounce,
  DECISIONS,
  setDecision,
  selectPage,
} = require('./helpers')

test('re-importing a snapshot over newer work merges rather than wipes', async ({ page }) => {
  await gotoFresh(page)

  // Three pages reviewed entirely through the sidebar, as a manager would.
  await page.fill('#reviewerInput', 'Director Demo')
  await page.dispatchEvent('#reviewerInput', 'change')
  await setDecision(page, DECISIONS.approved)
  await page.fill('#reviewNotes', 'Agency page reads well')
  await page.dispatchEvent('#reviewNotes', 'change')
  await settleDebounce(page)

  await selectPage(page, 'payFee')
  await setDecision(page, DECISIONS.blocked)
  await page.fill('#reviewNotes', 'Payment URL unconfirmed')
  await page.dispatchEvent('#reviewNotes', 'change')
  await settleDebounce(page)

  await selectPage(page, 'scopeInfo')
  await setDecision(page, DECISIONS.approvedWithEdits)
  await page.fill('#reviewNotes', 'Tighten the intro')
  await page.dispatchEvent('#reviewNotes', 'change')
  await settleDebounce(page)

  // Export the snapshot through the real button.
  await page.selectOption('#exportScope', 'backup-json')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#exportReviews'),
  ])
  const snapshot = fs.readFileSync(await download.path(), 'utf8')
  const backupPath = test.info().outputPath('snapshot.json')
  fs.writeFileSync(backupPath, snapshot)

  // Work continues AFTER the export: a fourth page is reviewed, and one of the
  // exported pages is revised. Neither is in the snapshot about to be imported.
  await selectPage(page, 'tenantRights')
  await setDecision(page, DECISIONS.revise)
  await page.fill('#reviewNotes', 'Added after the export')
  await page.dispatchEvent('#reviewNotes', 'change')
  await settleDebounce(page)

  const beforeImport = await readState(page)
  expect(Object.keys(beforeImport.pages).sort()).toEqual([
    'payFee',
    'pestsTopic',
    'scopeInfo',
    'tenantRights',
  ])
  const pestsHistoryBefore = beforeImport.pages.pestsTopic.history.length

  // Re-import the older snapshot WITHOUT clearing first.
  await page.setInputFiles('#reviewImportFile', backupPath)
  await settleDebounce(page)

  const after = await readState(page)

  // 1. The page reviewed after the export must survive. A wholesale replace
  //    would drop it entirely, because it is absent from the snapshot.
  expect(after.pages.tenantRights).toBeDefined()
  expect(after.pages.tenantRights.decision).toBe(DECISIONS.revise)
  expect(after.pages.tenantRights.notes).toBe('Added after the export')

  // 2. The three exported pages keep their decisions and notes.
  expect(after.pages.pestsTopic.decision).toBe(DECISIONS.approved)
  expect(after.pages.pestsTopic.notes).toBe('Agency page reads well')
  expect(after.pages.payFee.decision).toBe(DECISIONS.blocked)
  expect(after.pages.payFee.notes).toBe('Payment URL unconfirmed')
  expect(after.pages.scopeInfo.decision).toBe(DECISIONS.approvedWithEdits)
  expect(after.pages.scopeInfo.notes).toBe('Tighten the intro')

  // 3. history[] is append-only. The import records a round rather than
  //    replacing the trail, and attributes it to the import.
  expect(after.pages.pestsTopic.history.length).toBeGreaterThan(pestsHistoryBefore)
  expect(after.pages.pestsTopic.history.at(-1).updated_by).toBe('import')

  // 4. Nothing was lost overall.
  expect(Object.keys(after.pages).sort()).toEqual([
    'payFee',
    'pestsTopic',
    'scopeInfo',
    'tenantRights',
  ])
})
