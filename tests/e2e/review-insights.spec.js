// Overview charts, driven through the real UI.
//
// The unit tests in tests/review-insights-data.test.js already cover the data
// shaping exhaustively. What only a browser can prove is the part those cannot
// touch: that the ECharts chunk actually loads on demand, that it draws into
// the mounted containers, that the accessible data tables carry the same
// numbers the graphics do, and that the charts survive the Overview panel
// rebuilding its innerHTML underneath them.
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
  test('renders three cards, each with a drawn chart', async ({ page }) => {
    await gotoFresh(page)
    await seedDecidedPages(page)
    await openWorkspaceTab(page, 'overview')

    await expect(page.locator('.insights-card')).toHaveCount(3)
    // ECharts arrives in a lazily imported chunk, so the SVGs appear a tick
    // after the cards do. Waiting on the SVG is what proves the dynamic import
    // resolved and drew, rather than just that the markup shell rendered.
    await expect(page.locator('.insights-chart svg')).toHaveCount(3)
  })

  test('pairs every chart with an accessible data table', async ({ page }) => {
    await gotoFresh(page)
    await seedDecidedPages(page)
    await openWorkspaceTab(page, 'overview')
    await expect(page.locator('.insights-chart svg')).toHaveCount(3)

    // The graphic is not the accessible artifact; the table is. Each chart box
    // is hidden from assistive tech and a captioned table carries its numbers.
    await expect(page.locator('.insights-chart[aria-hidden="true"]')).toHaveCount(3)
    await expect(page.locator('.insights-card table.hhvc-sr-only')).toHaveCount(3)

    const decisionTable = page.locator('table.hhvc-sr-only', {
      hasText: 'Pages by review decision',
    })
    await expect(decisionTable).toContainText('Approved')
    await expect(decisionTable).toContainText('Blocked')
  })

  test('the decision table agrees with the queue it summarises', async ({ page }) => {
    await gotoFresh(page)
    await seedDecidedPages(page)
    await openWorkspaceTab(page, 'overview')
    await expect(page.locator('.insights-chart svg')).toHaveCount(3)

    // Two pages were seeded as decided, so the card heading must say so. This
    // is the assertion that would catch the charts silently summarising a
    // filtered view instead of the whole site.
    await expect(page.locator('.insights-card').first()).toContainText('2 of 19 pages decided')
  })

  test('charts survive the panel rebuilding on filter and search', async ({ page }) => {
    await gotoFresh(page)
    await seedDecidedPages(page)
    await openWorkspaceTab(page, 'overview')
    await expect(page.locator('.insights-chart svg')).toHaveCount(3)

    // Every filter, sort and keystroke replaces the Overview panel's entire
    // innerHTML. The chart host is deliberately re-parented rather than
    // rebuilt, so a filter must leave the drawn SVGs intact — and must not
    // change them, since the charts describe the whole site, not the filter.
    await page.click('[data-queue-filter="Blocked"]')
    await expect(page.locator('.insights-chart svg')).toHaveCount(3)
    await expect(page.locator('.insights-card').first()).toContainText('2 of 19 pages decided')

    await page.fill('#reviewQueueSearch', 'mosquito')
    await expect(page.locator('.insights-chart svg')).toHaveCount(3)
    await expect(page.locator('.insights-card').first()).toContainText('2 of 19 pages decided')
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

    // The other two still draw, so an empty series does not take the row down.
    await expect(page.locator('.insights-chart svg')).toHaveCount(2)
  })
})
