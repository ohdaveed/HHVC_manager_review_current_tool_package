// Overview insight cards, driven through the real UI.
//
// The unit tests in tests/review-insights-data.test.js and
// tests/review-insights-render.test.js already cover the data shaping and the
// markup exhaustively. What only a browser can prove is the part those cannot
// touch: that the ECharts chunk actually loads on demand, that it draws into
// the mounted container, and that the card survives the Overview panel
// rebuilding its innerHTML underneath it.
//
// Two cards, not three. The "Decision mix" stacked bar was cut — the filter
// chips directly above print the same five counts and filter by them, and the
// chart's own legend reprinted them a third time within about 200 pixels.
const { test, expect } = require('@playwright/test')
const { gotoFresh, seedState, makeReviewRecord, openWorkspaceTab } = require('./helpers')

/** Seed decisions plus the history entries the activity chart reads. */
async function seedDecidedPages(page) {
  await seedState(page, {
    pestsTopic: {
      ...makeReviewRecord('pestsTopic', { decision: 'Approved' }),
      history: [{ timestamp: '2026-07-10T10:00:00.000Z', decision: 'Approved', reviewer: 'DA' }],
    },
    article11Guide: {
      ...makeReviewRecord('article11Guide', { decision: 'Blocked' }),
      history: [{ timestamp: '2026-07-12T10:00:00.000Z', decision: 'Blocked', reviewer: 'DA' }],
    },
  })
  await page.reload()
  await page.waitForSelector('#mockPage h1')
}

test.describe('Overview insight charts', () => {
  test('renders two cards: one drawn chart and one ranked list', async ({ page }) => {
    await gotoFresh(page)
    await seedDecidedPages(page)
    await openWorkspaceTab(page, 'overview')

    await expect(page.locator('.insights-card')).toHaveCount(2)
    // ECharts arrives in a lazily imported chunk, so the SVG appears a tick
    // after the cards do. Waiting on it is what proves the dynamic import
    // resolved and drew, rather than just that the markup shell rendered.
    await expect(page.locator('.insights-chart svg')).toHaveCount(1)
    // The failing-checks card draws no chart at all now.
    await expect(page.locator('.insights-ranked')).toHaveCount(1)
  })

  test('pairs the chart with an accessible data table', async ({ page }) => {
    await gotoFresh(page)
    await seedDecidedPages(page)
    await openWorkspaceTab(page, 'overview')
    await expect(page.locator('.insights-chart svg')).toHaveCount(1)

    // The graphic is not the accessible artifact; the table is. The chart box
    // is hidden from assistive tech and a captioned table carries its numbers.
    await expect(page.locator('.insights-chart[aria-hidden="true"]')).toHaveCount(1)
    await expect(page.locator('.insights-card table.hhvc-sr-only')).toHaveCount(1)

    const activityTable = page.locator('table.hhvc-sr-only', {
      hasText: 'Pages decided over time',
    })
    await expect(activityTable).toContainText('2026-07-10')

    // The ranking needs no parallel table: it is visible content, so one copy
    // of those numbers serves both audiences.
    await expect(
      page.locator('.insights-card', { hasText: 'Checks needing attention' }).locator('table')
    ).toHaveCount(0)
  })

  test('the ranking names pages, and counts failures rather than passes', async ({ page }) => {
    await gotoFresh(page)
    await seedDecidedPages(page)
    await openWorkspaceTab(page, 'overview')

    const ranked = page.locator('.insights-ranked-item').first()
    // "N of M failing" — the bar chart this replaced drew a PASS rate, so a
    // page at 95% rendered a nearly-full bar under a heading about attention.
    await expect(ranked.locator('.insights-ranked-value')).toContainText(/\d+ of \d+ failing/)
    await expect(ranked.locator('.insights-ranked-title')).not.toBeEmpty()
  })

  test('cards survive the panel rebuilding on filter and search', async ({ page }) => {
    await gotoFresh(page)
    await seedDecidedPages(page)
    await openWorkspaceTab(page, 'overview')
    await expect(page.locator('.insights-chart svg')).toHaveCount(1)
    const rankedBefore = await page.locator('.insights-ranked-item').count()

    // Capture the rendered VALUES, not just how many rows there are. A count
    // alone lets every page name and every "X of Y failing" figure change while
    // the test still passes — which would miss exactly the regression this test
    // exists to catch, since the claim being tested is that the numbers are
    // unaffected rather than that the rows are still present.
    const activityBefore = await page.locator('.insights-card table.hhvc-sr-only').innerText()
    const rankedTextBefore = await page.locator('.insights-ranked').innerText()

    // Every filter, sort and keystroke replaces the Overview panel's entire
    // innerHTML. The chart host is deliberately re-parented rather than
    // rebuilt, so a filter must leave the drawn SVG intact — and must not
    // change the numbers, since the cards describe the whole site, not the
    // filtered view.
    await page.click('[data-queue-filter="Blocked"]')
    await expect(page.locator('.insights-chart svg')).toHaveCount(1)
    await expect(page.locator('.insights-ranked-item')).toHaveCount(rankedBefore)
    expect(await page.locator('.insights-card table.hhvc-sr-only').innerText()).toBe(activityBefore)
    expect(await page.locator('.insights-ranked').innerText()).toBe(rankedTextBefore)

    await page.fill('#reviewQueueSearch', 'mosquito')
    await expect(page.locator('.insights-chart svg')).toHaveCount(1)
    await expect(page.locator('.insights-ranked-item')).toHaveCount(rankedBefore)
    expect(await page.locator('.insights-card table.hhvc-sr-only').innerText()).toBe(activityBefore)
    expect(await page.locator('.insights-ranked').innerText()).toBe(rankedTextBefore)
  })

  test('shows an empty state for activity before anything is decided', async ({ page }) => {
    await gotoFresh(page)
    await openWorkspaceTab(page, 'overview')

    // A fresh browser has no history, so the activity chart has nothing to
    // draw. It says so rather than rendering a flat line at zero, which would
    // read as measured data.
    const activityCard = page.locator('.insights-card', { hasText: 'Review activity' })
    await expect(activityCard.locator('.ds-empty')).toContainText('No decisions recorded yet')
    await expect(activityCard.locator('svg')).toHaveCount(0)

    // The failing-checks card still renders, so an empty series does not take
    // the row down with it.
    await expect(page.locator('.insights-ranked')).toHaveCount(1)
  })
})
