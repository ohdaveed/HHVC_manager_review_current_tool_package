/* Guards the committed demo seed, review/demo-review-state.json.

   The seed is a checked-in data file that a presenter imports before showing
   the tool. Nothing else in the suite references it, so it can rot silently:
   it keys every record by page key, and a page key that gets renamed or retired
   leaves the seed importing cleanly and quietly under-populating the panels it
   exists to fill. That failure looks like "the demo data is a bit thin", which
   is exactly the kind of thing nobody investigates five minutes before a
   presentation.

   Regenerate with `bun build_scripts/make-demo-review-state.js` if this fails
   because the page set legitimately changed. */

const fs = require('fs')
const path = require('path')
const { test, expect } = require('@playwright/test')
const { gotoFresh, readState, settleDebounce, openWorkspaceTab } = require('./helpers')

const SEED = path.resolve(__dirname, '../../review/demo-review-state.json')

test.describe('demo seed', () => {
  test('every seeded page key still exists in the page data', async ({ page }) => {
    await gotoFresh(page)
    const seeded = Object.keys(JSON.parse(fs.readFileSync(SEED, 'utf8')).pages)
    const real = await page.evaluate(() => Object.keys(window.HHVC_PAGES))

    expect(seeded.length).toBeGreaterThan(0)
    expect(seeded.filter((key) => !real.includes(key))).toEqual([])
  })

  test('importing it populates the queue rather than leaving it empty', async ({ page }) => {
    await gotoFresh(page)
    await page.setInputFiles('#reviewImportFile', SEED)
    await settleDebounce(page)

    const state = await readState(page)
    const seededCount = Object.keys(state.pages).length
    const totalPages = await page.evaluate(() => window.HHVC_DATA.order.length)

    // Partially reviewed on purpose: a fully-reviewed seed empties the filter
    // chips and removes "Next needs review" from the demo.
    expect(seededCount).toBeGreaterThan(0)
    expect(seededCount).toBeLessThan(totalPages)

    // Every record must carry history, or the activity card draws nothing —
    // which is most of the reason the seed exists.
    for (const [key, record] of Object.entries(state.pages)) {
      expect(record.history?.length, `${key} has no history entries`).toBeGreaterThan(0)
    }

    // Timestamps must span more than one day, or the activity series is a
    // single point and reads as a broken chart.
    const days = new Set(
      Object.values(state.pages).flatMap((record) =>
        record.history.map((entry) => entry.timestamp.slice(0, 10))
      )
    )
    expect(days.size).toBeGreaterThan(1)

    await openWorkspaceTab(page, 'overview')
    await page.waitForSelector('.review-queue-table-row')
    await expect(page.locator('.review-queue')).toContainText(`${seededCount}/${totalPages}`)
  })
})
