// Unit tests for the Overview insight markup (js/review-insights.js).
//
// buildMarkup() is a pure string builder, so what it emits can be asserted
// without a browser, a chart instance, or ECharts being loaded at all — which
// is the point of building the headings, the data table and the failing-checks
// ranking synchronously, before the chart chunk is even requested.
//
// The escaping assertions moved here from tests/review-insights-charts.test.js
// when the failing-checks bar chart became a plain ranked list: the page titles
// that used to reach an ECharts tooltip formatter now reach innerHTML directly,
// so this is where that must not regress.
import { describe, test, expect } from 'bun:test'
import { buildMarkup } from '../js/review-insights.js'

const XSS = '<img src=x onerror="window.__xss=1">'

function model(overrides = {}) {
  return {
    total: 2,
    decisionMix: [
      { decision: 'Needs review', count: 1, pct: 50 },
      { decision: 'Approved', count: 1, pct: 50 },
    ],
    activity: [{ date: '2026-07-01', decided: 1, total: 1 }],
    checks: [{ key: 'a', title: 'A', passed: 1, total: 2, pct: 50 }],
    checksFailing: [{ key: 'a', title: 'A', passed: 1, total: 2, pct: 50 }],
    ...overrides,
  }
}

describe('insight cards', () => {
  test('renders exactly two cards, with no decision-mix card', () => {
    const html = buildMarkup(model())

    expect(html).toContain('Review activity')
    expect(html).toContain('Checks needing attention')
    // The filter chips above already print these five counts and filter by
    // them; the chart and its legend were the second and third rendering.
    expect(html).not.toContain('Decision mix')
    expect(html).not.toContain('insights-legend')
  })

  test('gives the activity chart a mount point and a hidden data table', () => {
    const html = buildMarkup(model())

    expect(html).toContain('data-insights-chart="activity"')
    expect(html).toContain('Pages decided over time')
  })

  test('gives the checks ranking no chart mount and no parallel table', () => {
    // The list is visible content, so it is both the graphic and the accessible
    // artifact; pairing it with a screen-reader table would read the same
    // numbers twice.
    const html = buildMarkup(model())

    expect(html).not.toContain('data-insights-chart="checks"')
    expect(html).not.toContain('Automated check results by page')
    expect(html).toContain('insights-ranked')
  })
})

describe('failing-checks ranking', () => {
  test('counts what is failing, not what is passing', () => {
    // The bar chart this replaced drew a PASS rate, so a page at 95% rendered
    // a nearly-full bar under a heading about needing attention.
    const html = buildMarkup(
      model({
        checks: [{ key: 'a', title: 'A', passed: 16, total: 18, pct: 89 }],
        checksFailing: [{ key: 'a', title: 'A', passed: 16, total: 18, pct: 89 }],
      })
    )

    expect(html).toContain('2 of 18 failing')
  })

  test('lists only pages with failing checks, never padding with passing ones', () => {
    const checks = [
      { key: 'fail', title: 'Failing', passed: 1, total: 2, pct: 50 },
      { key: 'pass', title: 'Passing', passed: 2, total: 2, pct: 100 },
    ]
    const html = buildMarkup(
      model({ checks, checksFailing: checks.filter((item) => item.pct < 100) })
    )

    expect(html).toContain('Failing')
    expect(html).not.toContain('>Passing<')
  })

  test('caps the list and says so in the card hint', () => {
    const failing = Array.from({ length: 12 }, (_, i) => ({
      key: `k${i}`,
      title: `Page ${i}`,
      passed: 1,
      total: 2,
      pct: 50,
    }))
    const html = buildMarkup(model({ checks: failing, checksFailing: failing }))

    expect(html.match(/insights-ranked-item/g) ?? []).toHaveLength(8)
    expect(html).toContain('Worst 8 of 12 pages with failing checks')
  })

  test('escapes a page title before it reaches innerHTML', () => {
    // A page title is NOT trusted input: js/ux-improvements-state-sync.js
    // assigns a restored edited_title straight onto the in-memory page object,
    // so a JSON backup or a sync response can put markup here.
    const failing = [{ key: 'a', title: XSS, passed: 1, total: 2, pct: 50 }]
    const html = buildMarkup(model({ checks: failing, checksFailing: failing }))

    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
    expect(html).toContain('&quot;')
  })

  test('shows an empty state rather than an empty list when everything passes', () => {
    const html = buildMarkup(
      model({
        checks: [{ key: 'a', title: 'A', passed: 2, total: 2, pct: 100 }],
        checksFailing: [],
      })
    )

    expect(html).toContain('Every page is passing all of its checks.')
    expect(html).not.toContain('insights-ranked')
  })
})

describe('activity card', () => {
  test('shows an empty state before anything is decided', () => {
    const html = buildMarkup(model({ activity: [] }))

    expect(html).toContain('No decisions recorded yet.')
    expect(html).not.toContain('data-insights-chart="activity"')
  })
})
