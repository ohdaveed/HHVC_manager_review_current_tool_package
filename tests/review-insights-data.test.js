// Unit tests for the Overview charts' data shaping (js/review-insights-data.js).
//
// These functions are the whole reason that file is separate from the chart
// rendering: the decisions they encode — what counts as "decided", how a
// running total is built from an append-only history, what gets excluded and
// why — are testable as plain data transforms, with no browser and no ECharts.
const { describe, test, expect } = require('bun:test')
const {
  DECISION_ORDER,
  buildDecisionMix,
  buildActivitySeries,
  buildChecksSeries,
  buildInsightsModel,
  insightsSignature,
  firstDecidedDay,
  toDayKey,
} = require('../js/review-insights-data.js')

describe('buildDecisionMix', () => {
  test('counts every decision in canonical order', () => {
    const rows = [
      { decision: 'Approved' },
      { decision: 'Blocked' },
      { decision: 'Approved' },
      { decision: 'Needs review' },
    ]
    const mix = buildDecisionMix(rows)

    expect(mix.map((item) => item.decision)).toEqual(DECISION_ORDER)
    expect(mix.find((item) => item.decision === 'Approved').count).toBe(2)
    expect(mix.find((item) => item.decision === 'Blocked').count).toBe(1)
    expect(mix.find((item) => item.decision === 'Needs review').count).toBe(1)
  })

  test('keeps zero-count decisions rather than dropping them', () => {
    const mix = buildDecisionMix([{ decision: 'Approved' }])

    // A chart that omits empty categories cannot distinguish "no blocked
    // pages" from "blocked pages are not shown here".
    expect(mix).toHaveLength(DECISION_ORDER.length)
    expect(mix.find((item) => item.decision === 'Blocked').count).toBe(0)
  })

  test('treats a row with no decision as needing review', () => {
    const mix = buildDecisionMix([{}, { decision: '' }])

    expect(mix.find((item) => item.decision === 'Needs review').count).toBe(2)
  })

  test('counts an unrecognised decision instead of silently discarding it', () => {
    const mix = buildDecisionMix([{ decision: 'Escalated' }, { decision: 'Approved' }])

    // Dropping it would make the chart's total disagree with the queue table.
    expect(mix.find((item) => item.decision === 'Escalated').count).toBe(1)
    expect(mix.reduce((sum, item) => sum + item.count, 0)).toBe(2)
  })

  test('computes each decision share as a whole percentage', () => {
    const mix = buildDecisionMix([
      { decision: 'Approved' },
      { decision: 'Approved' },
      { decision: 'Blocked' },
      { decision: 'Blocked' },
    ])

    expect(mix.find((item) => item.decision === 'Approved').pct).toBe(50)
  })

  test('reports zero percent rather than dividing by zero on an empty queue', () => {
    const mix = buildDecisionMix([])

    expect(mix.every((item) => item.count === 0 && item.pct === 0)).toBe(true)
  })

  test('tolerates a non-array input', () => {
    expect(buildDecisionMix(null)).toHaveLength(DECISION_ORDER.length)
    expect(buildDecisionMix(undefined)[0].count).toBe(0)
  })
})

describe('toDayKey', () => {
  test('reduces an ISO timestamp to its calendar day', () => {
    expect(toDayKey('2026-07-31T18:45:12.000Z')).toBe('2026-07-31')
  })

  test('returns null for a malformed or missing timestamp', () => {
    // History entries arrive from CSV/JSON imports as well as local writes, so
    // a bad timestamp is realistic and must not take the chart down.
    expect(toDayKey('not a date')).toBeNull()
    expect(toDayKey('')).toBeNull()
    expect(toDayKey(undefined)).toBeNull()
    expect(toDayKey(12345)).toBeNull()
  })
})

describe('firstDecidedDay', () => {
  test('returns the earliest day carrying a real decision', () => {
    const record = {
      history: [
        { timestamp: '2026-07-20T10:00:00.000Z', decision: 'Approved' },
        { timestamp: '2026-07-18T10:00:00.000Z', decision: 'Blocked' },
      ],
    }

    expect(firstDecidedDay(record)).toBe('2026-07-18')
  })

  test('scans the whole history rather than trusting array order', () => {
    // combineHistory merges two histories on a backup import, so the earliest
    // qualifying entry is not reliably first in the array.
    const record = {
      history: [
        { timestamp: '2026-07-25T10:00:00.000Z', decision: 'Approved' },
        { timestamp: '2026-07-01T10:00:00.000Z', decision: 'Approved' },
        { timestamp: '2026-07-10T10:00:00.000Z', decision: 'Approved' },
      ],
    }

    expect(firstDecidedDay(record)).toBe('2026-07-01')
  })

  test('ignores entries that carry no decision or only Needs review', () => {
    const record = {
      history: [
        { timestamp: '2026-07-01T10:00:00.000Z', decision: 'Needs review' },
        { timestamp: '2026-07-02T10:00:00.000Z' },
        { timestamp: '2026-07-03T10:00:00.000Z', decision: 'Approved' },
      ],
    }

    expect(firstDecidedDay(record)).toBe('2026-07-03')
  })

  test('returns null for a record that was never decided', () => {
    expect(
      firstDecidedDay({ history: [{ timestamp: '2026-07-01', decision: 'Needs review' }] })
    ).toBeNull()
    expect(firstDecidedDay({ history: [] })).toBeNull()
    expect(firstDecidedDay({})).toBeNull()
    expect(firstDecidedDay(null)).toBeNull()
  })

  test('skips an entry whose timestamp will not parse', () => {
    const record = {
      history: [
        { timestamp: 'garbage', decision: 'Approved' },
        { timestamp: '2026-07-09T10:00:00.000Z', decision: 'Approved' },
      ],
    }

    expect(firstDecidedDay(record)).toBe('2026-07-09')
  })
})

describe('buildActivitySeries', () => {
  test('builds a running total of decided pages, oldest day first', () => {
    const pages = {
      a: { history: [{ timestamp: '2026-07-01T10:00:00.000Z', decision: 'Approved' }] },
      b: { history: [{ timestamp: '2026-07-01T12:00:00.000Z', decision: 'Blocked' }] },
      c: { history: [{ timestamp: '2026-07-03T09:00:00.000Z', decision: 'Approved' }] },
    }

    expect(buildActivitySeries(pages)).toEqual([
      { date: '2026-07-01', decided: 2, total: 2 },
      { date: '2026-07-03', decided: 1, total: 3 },
    ])
  })

  test('counts each page once, on the day it was first decided', () => {
    // A page revisited three times is still one decided page, and it belongs
    // to the day the decision was first made, not the most recent round.
    const pages = {
      a: {
        history: [
          { timestamp: '2026-07-01T10:00:00.000Z', decision: 'Approved' },
          { timestamp: '2026-07-05T10:00:00.000Z', decision: 'Blocked' },
          { timestamp: '2026-07-09T10:00:00.000Z', decision: 'Approved' },
        ],
      },
    }

    expect(buildActivitySeries(pages)).toEqual([{ date: '2026-07-01', decided: 1, total: 1 }])
  })

  test('returns an empty series when nothing has been decided', () => {
    // The caller renders an explicit empty state for this rather than a flat
    // line pinned at zero, which would read as real measured data.
    const pages = {
      a: { history: [{ timestamp: '2026-07-01T10:00:00.000Z', decision: 'Needs review' }] },
      b: {},
    }

    expect(buildActivitySeries(pages)).toEqual([])
  })

  test('tolerates a missing or non-object pages map', () => {
    expect(buildActivitySeries(null)).toEqual([])
    expect(buildActivitySeries(undefined)).toEqual([])
  })
})

describe('buildChecksSeries', () => {
  test('sorts by pass rate ascending so failing pages come first', () => {
    const rows = [
      { key: 'a', title: 'A', checksPassed: 5, checksTotal: 5 },
      { key: 'b', title: 'B', checksPassed: 1, checksTotal: 4 },
      { key: 'c', title: 'C', checksPassed: 3, checksTotal: 4 },
    ]

    expect(buildChecksSeries(rows).map((item) => item.key)).toEqual(['b', 'c', 'a'])
  })

  test('breaks ties on page key so equal scores hold a stable order', () => {
    // Without a tiebreaker the bars reshuffle between renders, which on a
    // panel that rebuilds per keystroke reads as flicker.
    const rows = [
      { key: 'zebra', title: 'Z', checksPassed: 1, checksTotal: 2 },
      { key: 'alpha', title: 'A', checksPassed: 1, checksTotal: 2 },
    ]

    expect(buildChecksSeries(rows).map((item) => item.key)).toEqual(['alpha', 'zebra'])
  })

  test('excludes pages whose checks never ran', () => {
    // A 0% bar would read as "every check failed" when it means "nothing was
    // evaluated" — a materially different message to a reviewer.
    const rows = [
      { key: 'a', title: 'A', checksPassed: 0, checksTotal: 0 },
      { key: 'b', title: 'B', checksPassed: 2, checksTotal: 4 },
    ]

    expect(buildChecksSeries(rows).map((item) => item.key)).toEqual(['b'])
  })

  test('computes a whole-percentage pass rate and falls back to the page key for a title', () => {
    const series = buildChecksSeries([{ key: 'somePage', checksPassed: 1, checksTotal: 3 }])

    expect(series[0].pct).toBe(33)
    expect(series[0].title).toBe('somePage')
  })

  test('treats a missing passed count as zero rather than NaN', () => {
    const series = buildChecksSeries([{ key: 'a', title: 'A', checksTotal: 4 }])

    expect(series[0].passed).toBe(0)
    expect(series[0].pct).toBe(0)
  })
})

describe('insightsSignature', () => {
  test('is stable for identical data', () => {
    const rows = [{ key: 'a', title: 'A', decision: 'Approved', checksPassed: 1, checksTotal: 2 }]
    const pages = {
      a: { history: [{ timestamp: '2026-07-01T10:00:00.000Z', decision: 'Approved' }] },
    }

    expect(insightsSignature(buildInsightsModel(rows, pages))).toBe(
      insightsSignature(buildInsightsModel(rows, pages))
    )
  })

  test('changes when a decision changes', () => {
    const pages = {}
    const before = buildInsightsModel([{ key: 'a', title: 'A', decision: 'Approved' }], pages)
    const after = buildInsightsModel([{ key: 'a', title: 'A', decision: 'Blocked' }], pages)

    expect(insightsSignature(before)).not.toBe(insightsSignature(after))
  })

  test('changes when a check result changes', () => {
    const pages = {}
    const before = buildInsightsModel(
      [{ key: 'a', title: 'A', checksPassed: 1, checksTotal: 2 }],
      pages
    )
    const after = buildInsightsModel(
      [{ key: 'a', title: 'A', checksPassed: 2, checksTotal: 2 }],
      pages
    )

    expect(insightsSignature(before)).not.toBe(insightsSignature(after))
  })

  test('is unchanged by row order, since the charts sort their own data', () => {
    // The Overview panel re-sorts rows on every sort-control change. Those
    // renders must not rebuild the charts, which is the whole point of the
    // signature.
    const pages = {}
    const rowA = { key: 'a', title: 'A', decision: 'Approved', checksPassed: 1, checksTotal: 2 }
    const rowB = { key: 'b', title: 'B', decision: 'Blocked', checksPassed: 2, checksTotal: 2 }

    expect(insightsSignature(buildInsightsModel([rowA, rowB], pages))).toBe(
      insightsSignature(buildInsightsModel([rowB, rowA], pages))
    )
  })
})

describe('buildInsightsModel', () => {
  test('assembles all three series and the page total', () => {
    const rows = [
      { key: 'a', title: 'A', decision: 'Approved', checksPassed: 2, checksTotal: 2 },
      { key: 'b', title: 'B', decision: 'Needs review', checksPassed: 1, checksTotal: 2 },
    ]
    const pages = {
      a: { history: [{ timestamp: '2026-07-02T10:00:00.000Z', decision: 'Approved' }] },
    }
    const model = buildInsightsModel(rows, pages)

    expect(model.total).toBe(2)
    expect(model.decisionMix.find((item) => item.decision === 'Approved').count).toBe(1)
    expect(model.activity).toEqual([{ date: '2026-07-02', decided: 1, total: 1 }])
    expect(model.checks.map((item) => item.key)).toEqual(['b', 'a'])
  })
})
