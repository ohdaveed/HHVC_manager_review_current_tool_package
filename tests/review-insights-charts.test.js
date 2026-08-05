// Unit tests for the ECharts option builders (js/review-insights-charts.js).
//
// The option objects are plain data, and their tooltip `formatter` functions
// are plain functions, so the security-relevant behaviour can be asserted
// directly — no browser, no hover, no chart instance. That matters most for
// the escaping: driving it through a real hover would be a slow and flaky way
// to test the one thing that must never regress.
//
// Only the activity chart is covered here because only the activity chart is
// left. The decision-mix bar and the failing-checks bar were both cut — the
// first was the third rendering of counts already printed twice above it, and
// the second drew eight indistinguishable lengths under a heading about what
// needs attention. The checks ranking is now plain markup, so its escaping is
// asserted in tests/review-insights-render.test.js instead.
const { describe, test, expect } = require('bun:test')
const { activityOption } = require('../js/review-insights-charts.js')

/** Minimal stand-in for readTheme()'s output. */
const THEME = {
  text: '#000',
  muted: '#666',
  border: '#eee',
  surface: '#fff',
  line: '#0072b2',
}

const XSS = '<img src=x onerror="window.__xss=1">'

function model(overrides = {}) {
  return {
    total: 2,
    decisionMix: [
      { decision: 'Needs review', count: 1, pct: 50 },
      { decision: 'Approved', count: 1, pct: 50 },
    ],
    activity: [
      { date: '2026-07-01', decided: 1, total: 1 },
      { date: '2026-07-30', decided: 1, total: 2 },
    ],
    checks: [{ key: 'a', title: 'A', passed: 1, total: 2, pct: 50 }],
    checksFailing: [{ key: 'a', title: 'A', passed: 1, total: 2, pct: 50 }],
    ...overrides,
  }
}

describe('activity axis', () => {
  test('uses a time axis so unequal gaps stay to scale', () => {
    // On a category axis, July 1 and July 30 sit one tick apart exactly like
    // two consecutive days, which erases a month-long stall on a chart whose
    // whole subject is the pace of review.
    const option = activityOption(model(), THEME)

    expect(option.xAxis.type).toBe('time')
    expect(option.series[0].data).toEqual([
      ['2026-07-01', 1],
      ['2026-07-30', 2],
    ])
  })
})

describe('activity tooltip escaping', () => {
  test('escapes the date, which arrives from saved review state', () => {
    // A review_date is whatever an imported CSV or a sync response put there,
    // and an ECharts formatter's return value is inserted as HTML.
    const option = activityOption(model({ activity: [{ date: XSS, decided: 1, total: 1 }] }), THEME)
    const html = option.tooltip.formatter([{ dataIndex: 0 }])

    // The payload survives as inert TEXT — "onerror=" still appears as
    // characters, which is fine and expected. What must not survive is anything
    // the HTML parser would act on: the tag delimiters and the attribute quotes.
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
  })

  test('escapes the numeric fields too, rather than trusting their type', () => {
    const option = activityOption(
      model({ activity: [{ date: '2026-07-01', decided: '<b>1</b>', total: 1 }] }),
      THEME
    )

    expect(option.tooltip.formatter([{ dataIndex: 0 }])).not.toContain('<b>')
  })
})
