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
const { gotoFresh, readState, settleDebounce, openWorkspaceTab, DECISIONS } = require('./helpers')

const SEED = path.resolve(__dirname, '../../review/demo-review-state.json')

/* The shape the demo documentation promises, pinned.

   review/demo-run-of-show.md tells a presenter the Overview reads "12/19
   reviewed", and review/demo-readiness-notes.md adds "four decision types". Both
   are claims about this file, and neither has anything holding it true.

   BOTH HALVES OF THE RATIO ARE PINNED, and the denominator is not redundant.
   Pinning only the seed count is what let "12/19" go stale the moment a
   twentieth page was added: the seed was untouched and correct, the docs were
   wrong, and a guard watching only the numerator stayed green through it. The
   ratio is the claim, so the ratio is what gets held.

   Written as the decision map rather than as string literals: js/utils.js owns
   the decision vocabulary and tests/decision-vocabulary.test.js exists to stop
   the module-boundary restatements, so a spec spelling out "Approved with edits"
   would be one more copy to keep in step. */
const EXPECTED_SEEDED_PAGES = 12
const EXPECTED_TOTAL_PAGES = 29
const EXPECTED_DECISION_MIX = {
  [DECISIONS.approved]: 4,
  [DECISIONS.approvedWithEdits]: 4,
  [DECISIONS.revise]: 2,
  [DECISIONS.blocked]: 2,
}

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

    /* Exact numbers, not bounds. This started as `> 0` and `< totalPages`,
       which passes on anything from 1 to 18 records — so a seed entry could be
       dropped and this test would stay green while review/demo-run-of-show.md
       still told a presenter the Overview reads 12/19 and the filter chips show
       four decision types. A guard that permits the drift it exists to catch is
       worse than none, because it reads as coverage.

       Regenerating the seed should therefore require editing the constants at
       the top of this file — that is the point, not an inconvenience. */
    expect(seededCount).toBe(EXPECTED_SEEDED_PAGES)
    expect(totalPages).toBe(EXPECTED_TOTAL_PAGES)
    expect(seededCount).toBeLessThan(totalPages)

    const decisionCounts = {}
    for (const record of Object.values(state.pages)) {
      decisionCounts[record.decision] = (decisionCounts[record.decision] || 0) + 1
    }
    expect(decisionCounts).toEqual(EXPECTED_DECISION_MIX)

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
