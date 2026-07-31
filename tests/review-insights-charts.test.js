// Unit tests for the ECharts option builders (js/review-insights-charts.js).
//
// The option objects are plain data, and their tooltip `formatter` functions
// are plain functions, so the security-relevant behaviour can be asserted
// directly — no browser, no hover, no chart instance. That matters most for
// the escaping: driving it through a real hover would be a slow and flaky way
// to test the one thing that must never regress.
const { describe, test, expect } = require('bun:test')
const { decisionOption, activityOption, checksOption } = require('../js/review-insights-charts.js')

/** Minimal stand-in for readTheme()'s output. */
const THEME = {
  text: '#000',
  muted: '#666',
  border: '#eee',
  surface: '#fff',
  decision: {
    'Needs review': '#8a8d8d',
    Approved: '#00734f',
    'Approved with edits': '#c07000',
    'Revise and resubmit': '#8f57b3',
    Blocked: '#c0392b',
  },
  line: '#0072b2',
  bar: '#009e73',
  barWarn: '#d55e00',
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

describe('checks tooltip escaping', () => {
  test('escapes a page title before returning it as tooltip HTML', () => {
    // A page title is NOT trusted input: js/ux-improvements-state-sync.js
    // assigns a restored edited_title straight onto the in-memory page object,
    // so a JSON backup or a sync response can put markup here — and an ECharts
    // formatter's return value is inserted as HTML.
    const failing = [{ key: 'a', title: XSS, passed: 1, total: 2, pct: 50 }]
    const option = checksOption(model({ checks: failing, checksFailing: failing }), THEME, 8)
    const html = option.tooltip.formatter({ dataIndex: 0 })

    // The payload survives as inert TEXT — "onerror=" still appears as
    // characters, which is fine and expected. What must not survive is anything
    // the HTML parser would act on: the tag delimiters and the attribute
    // quotes. Asserting on the absence of the word "onerror" would be testing
    // the wrong thing and would pass against a merely-stripped payload.
    expect(html).not.toContain('<img')
    expect(html).not.toContain('"')
    expect(html).toContain('&lt;img')
    expect(html).toContain('&quot;')
  })

  test('escapes the numeric fields too, rather than trusting their type', () => {
    const failing = [{ key: 'a', title: 'A', passed: '<b>1</b>', total: 2, pct: 50 }]
    const option = checksOption(model({ checks: failing, checksFailing: failing }), THEME, 8)

    expect(option.tooltip.formatter({ dataIndex: 0 })).not.toContain('<b>')
  })
})

describe('decision tooltip escaping', () => {
  test('escapes the series name, which is a saved decision string', () => {
    // buildDecisionMix deliberately counts unrecognised decisions rather than
    // dropping them, so an imported backup can put arbitrary text in a series
    // name.
    const option = decisionOption(model(), THEME)
    const html = option.tooltip.formatter({ seriesName: XSS, value: 1 })

    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
  })
})

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

describe('checks chart contents', () => {
  test('draws only pages with failing checks, never padding with passing ones', () => {
    const checks = [
      { key: 'fail', title: 'Failing', passed: 1, total: 2, pct: 50 },
      { key: 'pass', title: 'Passing', passed: 2, total: 2, pct: 100 },
    ]
    const option = checksOption(
      model({ checks, checksFailing: checks.filter((item) => item.pct < 100) }),
      THEME,
      8
    )

    expect(option.yAxis.data).toEqual(['Failing'])
  })

  test('honours the row cap', () => {
    const failing = Array.from({ length: 12 }, (_, i) => ({
      key: `k${i}`,
      title: `Page ${i}`,
      passed: 1,
      total: 2,
      pct: 50,
    }))
    const option = checksOption(model({ checks: failing, checksFailing: failing }), THEME, 8)

    expect(option.yAxis.data).toHaveLength(8)
  })
})
