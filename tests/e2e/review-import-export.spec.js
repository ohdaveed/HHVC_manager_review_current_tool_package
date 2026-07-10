const { test, expect } = require('@playwright/test')
const AxeBuilder = require('@axe-core/playwright').default

test.describe('HHVC manager review tool', () => {
  test('loads the HHVC agency page', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#mockPage h1')).toContainText(/healthy housing and vector control/i)
    await expect(page.locator('#pageSelect')).toBeVisible()
  })

  test('has no serious accessibility violations on the default page', async ({ page }) => {
    await page.goto('/')
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast'])
      .analyze()
    expect(
      results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
    ).toEqual([])
  })

  test('CSV export/import round-trip preserves review decisions', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.removeItem('hhvcManagerReviewState:v1'))

    await page.selectOption('#reviewDecision', 'Approved')
    await page.fill('#reviewNotes', 'E2E round-trip note')
    await page.fill('#reviewerInput', 'Playwright Tester')
    await page.dispatchEvent('#reviewNotes', 'change')

    await page.waitForTimeout(400)

    const exportedCsv = await page.evaluate(async () => {
      const state = window.reviewState.read()
      const headers = window.utils.REVIEW_RECORD_FIELDS
      const rows = [headers]
      for (const record of Object.values(state.pages)) {
        rows.push(headers.map((field) => record[field] || ''))
      }
      return window.utils.toCsv(rows)
    })

    await page.evaluate(() => localStorage.removeItem('hhvcManagerReviewState:v1'))

    const imported = await page.evaluate(async (csvText) => {
      return window.reviewQueue.importReviewsFromCsvText(csvText)
    }, exportedCsv)

    expect(imported).toBeGreaterThan(0)

    const restored = await page.evaluate(() => window.reviewState.read())
    const pestsTopic = restored.pages.pestsTopic
    expect(pestsTopic?.decision).toBe('Approved')
    expect(pestsTopic?.notes).toBe('E2E round-trip note')
    expect(pestsTopic?.reviewer).toBe('Playwright Tester')
  })

  test('JSON backup import merges without wiping unrelated pages', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.removeItem('hhvcManagerReviewState:v1'))

    await page.evaluate(() => {
      window.reviewState.write({
        version: 1,
        updated_at: new Date().toISOString(),
        ui: {},
        globals: { reviewer: 'Original Reviewer' },
        pages: {
          pestsTopic: {
            page_key: 'pestsTopic',
            decision: 'Blocked',
            notes: 'Keep this note',
            updated_at: new Date().toISOString(),
          },
          ratsReport: {
            page_key: 'ratsReport',
            decision: 'Approved',
            notes: 'Rat page approved',
            updated_at: new Date().toISOString(),
          },
        },
      })
    })

    const backup = {
      version: 1,
      updated_at: new Date().toISOString(),
      ui: {},
      globals: { reviewer: 'Backup Reviewer' },
      pages: {
        pestsTopic: {
          page_key: 'pestsTopic',
          decision: 'Approved with edits',
          notes: 'Imported pests note',
          updated_at: new Date().toISOString(),
        },
      },
    }

    await page.evaluate((json) => {
      const result = window.reviewStateValidation.validateReviewState(json)
      if (!result.ok) throw new Error(result.error)
      window.reviewState.update((state) => {
        const nextPages = { ...state.pages }
        for (const [key, saved] of Object.entries(result.data.pages)) {
          nextPages[key] = { ...(state.pages[key] || {}), ...saved, page_key: key }
        }
        return {
          ...state,
          ui: window.defu({}, state.ui, result.data.ui || {}),
          globals: {
            ...state.globals,
            ...(result.data.globals?.reviewer && !state.globals.reviewer
              ? { reviewer: result.data.globals.reviewer }
              : {}),
          },
          pages: nextPages,
        }
      })
    }, backup)

    const merged = await page.evaluate(() => window.reviewState.read())
    expect(merged.pages.pestsTopic.decision).toBe('Approved with edits')
    expect(merged.pages.pestsTopic.notes).toBe('Imported pests note')
    expect(merged.pages.ratsReport.decision).toBe('Approved')
    expect(merged.pages.ratsReport.notes).toBe('Rat page approved')
    expect(merged.globals.reviewer).toBe('Original Reviewer')
  })
})
