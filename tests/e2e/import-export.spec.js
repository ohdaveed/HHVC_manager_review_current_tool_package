const fs = require('fs')
const os = require('os')
const path = require('path')
const { test, expect } = require('@playwright/test')
const {
  gotoFresh,
  seedState,
  readState,
  makeReviewRecord,
  settleDebounce,
  DECISIONS,
} = require('./helpers')

async function downloadToText(page, trigger) {
  const [download] = await Promise.all([page.waitForEvent('download'), trigger()])
  const filePath = await download.path()
  return { download, text: fs.readFileSync(filePath, 'utf8') }
}

const tempDirs = []

function writeTempFile(name, content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hhvc-e2e-'))
  tempDirs.push(dir)
  const filePath = path.join(dir, name)
  fs.writeFileSync(filePath, content)
  return filePath
}

test.afterEach(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
  tempDirs.length = 0
})

test.describe('review import/export through the UI', () => {
  test('single-page CSV export contains the current review', async ({ page }) => {
    await gotoFresh(page)
    await page.selectOption('#reviewDecision', DECISIONS.approved)
    await page.fill('#reviewNotes', 'Exported note')
    await page.dispatchEvent('#reviewNotes', 'change')
    await settleDebounce(page)

    const { download, text } = await downloadToText(page, () => page.click('#exportReviewCsv'))

    expect(download.suggestedFilename()).toBe('pestsTopic-manager-review.csv')
    expect(text).toContain('page_key')
    expect(text).toContain('pestsTopic')
    expect(text).toContain(DECISIONS.approved)
    expect(text).toContain('Exported note')
  })

  test('all-page template CSV export has one row per page', async ({ page }) => {
    await gotoFresh(page)

    const { download, text } = await downloadToText(page, () => page.click('#exportAllTemplateCsv'))

    expect(download.suggestedFilename()).toBe('hhvc-all-page-manager-review-template.csv')
    const lines = text.trim().split('\n')
    expect(lines.length).toBe(20)
    expect(lines[0]).toContain('page_key')
  })

  test('JSON state backup export matches saved localStorage state', async ({ page }) => {
    await gotoFresh(page)
    await page.selectOption('#reviewDecision', DECISIONS.blocked)
    await page.fill('#reviewNotes', 'Backup me')
    await page.dispatchEvent('#reviewNotes', 'change')
    await settleDebounce(page)

    const { text } = await downloadToText(page, () => page.click('#exportReviewStateBackup'))

    const backup = JSON.parse(text)
    expect(backup.version).toBe(1)
    expect(backup.pages.pestsTopic.decision).toBe(DECISIONS.blocked)
    expect(backup.pages.pestsTopic.notes).toBe('Backup me')
  })

  test('CSV import via file input merges without wiping other pages', async ({ page }) => {
    await gotoFresh(page)
    await seedState(page, {
      pestsTopic: makeReviewRecord('pestsTopic', {
        decision: DECISIONS.approved,
        notes: 'Existing pests note',
      }),
      payFee: makeReviewRecord('payFee', {
        decision: DECISIONS.blocked,
        notes: 'Existing fee note',
      }),
    })
    await page.reload()
    await page.waitForSelector('#mockPage h1')

    const csvPath = writeTempFile(
      'import.csv',
      'page_key,decision,notes\npestsTopic,Revise and resubmit,Imported pests note\n'
    )
    await page.setInputFiles('#reviewQueueCsvInput', csvPath)
    await expect(
      page.locator('#toastContainer .toast').filter({ hasText: /imported 1/i })
    ).toBeVisible()

    const state = await readState(page)
    expect(state.pages.pestsTopic.decision).toBe(DECISIONS.revise)
    expect(state.pages.pestsTopic.notes).toBe('Imported pests note')
    expect(state.pages.payFee.decision).toBe(DECISIONS.blocked)
    expect(state.pages.payFee.notes).toBe('Existing fee note')
  })

  test('JSON backup import via file input merges without wiping other pages', async ({ page }) => {
    await gotoFresh(page)
    await seedState(page, {
      pestsTopic: makeReviewRecord('pestsTopic', {
        decision: DECISIONS.blocked,
        notes: 'Keep this note',
      }),
      scopeInfo: makeReviewRecord('scopeInfo', {
        decision: DECISIONS.approved,
        notes: 'Scope approved',
      }),
    })
    await page.reload()
    await page.waitForSelector('#mockPage h1')

    const backupPath = writeTempFile(
      'backup.json',
      JSON.stringify({
        version: 1,
        updated_at: new Date().toISOString(),
        ui: {},
        globals: {},
        pages: {
          pestsTopic: makeReviewRecord('pestsTopic', {
            decision: DECISIONS.approvedWithEdits,
            notes: 'Imported pests note',
          }),
        },
      })
    )
    await page.setInputFiles('#importReviewStateFile', backupPath)
    await settleDebounce(page)

    const state = await readState(page)
    expect(state.pages.pestsTopic.decision).toBe(DECISIONS.approvedWithEdits)
    expect(state.pages.pestsTopic.notes).toBe('Imported pests note')
    expect(state.pages.scopeInfo.decision).toBe(DECISIONS.approved)
    expect(state.pages.scopeInfo.notes).toBe('Scope approved')
  })

  test('full round-trip: decide, export backup, clear, re-import restores decisions', async ({
    page,
  }) => {
    await gotoFresh(page)
    await page.selectOption('#reviewDecision', DECISIONS.approvedWithEdits)
    await page.fill('#reviewNotes', 'Round-trip note')
    await page.dispatchEvent('#reviewNotes', 'change')
    await settleDebounce(page)

    const { text } = await downloadToText(page, () => page.click('#exportReviewStateBackup'))
    const backupPath = writeTempFile('roundtrip.json', text)

    page.on('dialog', (dialog) => dialog.accept())
    await page.click('#clearSavedLocalReviews')
    await expect(page.locator('#reviewDecision')).toHaveValue(DECISIONS.needsReview)
    const cleared = await readState(page)
    expect(cleared.pages.pestsTopic).toBeUndefined()

    await page.setInputFiles('#importReviewStateFile', backupPath)
    await settleDebounce(page)

    const restored = await readState(page)
    expect(restored.pages.pestsTopic.decision).toBe(DECISIONS.approvedWithEdits)
    expect(restored.pages.pestsTopic.notes).toBe('Round-trip note')
  })
})
