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

  test('groups by the reviewer local day, not the UTC one', () => {
    // Regression: this used toISOString().slice(0, 10), so a decision made at
    // 5pm in San Francisco was filed under the NEXT day — disagreeing with the
    // review_date stored beside it, which utils.today() builds from local
    // getFullYear/getMonth/getDate. Asserted against the same local calendar
    // fields rather than a literal, so it holds in any TZ the suite runs in
    // (CI runs UTC, where the two happen to coincide).
    const ts = '2026-07-01T23:30:00-07:00'
    const local = new Date(ts)
    const expected = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`
    expect(toDayKey(ts)).toBe(expected)
  })

  test('maps two spellings of the same instant to the same day', () => {
    // TZ-independent: the same moment written with different offsets must not
    // land on different days.
    expect(toDayKey('2026-07-01T23:30:00-07:00')).toBe(toDayKey('2026-07-02T06:30:00Z'))
  })

  test('passes a plain calendar date through untouched', () => {
    // review_date is stored as YYYY-MM-DD. Parsing it would read it as UTC
    // midnight and re-render it locally, shifting it back a day everywhere
    // west of Greenwich.
    expect(toDayKey('2026-07-01')).toBe('2026-07-01')
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

  test('falls back to review_date for a legacy record with no history', () => {
    // history[] was added without bumping the storage version, so records
    // written before it carry a real decision and no history at all. Without
    // the fallback such a page counts as decided in the mix but contributes
    // nothing to activity — the same card contradicting itself.
    expect(firstDecidedDay({ decision: 'Approved', review_date: '2026-06-15' })).toBe('2026-06-15')
  })

  test('falls back to updated_at when a legacy record has no review_date', () => {
    const day = firstDecidedDay({ decision: 'Blocked', updated_at: '2026-06-20T10:00:00.000Z' })
    expect(day).toBe(toDayKey('2026-06-20T10:00:00.000Z'))
  })

  test('does not invent a decided day for a legacy record still needing review', () => {
    expect(firstDecidedDay({ decision: 'Needs review', review_date: '2026-06-15' })).toBeNull()
    expect(firstDecidedDay({ review_date: '2026-06-15' })).toBeNull()
  })

  test('prefers real history over the legacy fallback', () => {
    const record = {
      decision: 'Approved',
      review_date: '2026-06-15',
      history: [{ timestamp: '2026-07-03T10:00:00.000Z', decision: 'Approved' }],
    }
    expect(firstDecidedDay(record)).toBe('2026-07-03')
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

  test('ignores saved records for page keys the site no longer has', () => {
    // Nothing prunes review records when a page is retired, so a browser that
    // reviewed the old IA still holds rows for dead keys. Counting them made
    // the running total climb past the site total the other charts use.
    const pages = {
      live: { history: [{ timestamp: '2026-07-01T10:00:00.000Z', decision: 'Approved' }] },
      retired: { history: [{ timestamp: '2026-07-01T10:00:00.000Z', decision: 'Approved' }] },
    }
    expect(buildActivitySeries(pages, new Set(['live']))).toEqual([
      { date: '2026-07-01', decided: 1, total: 1 },
    ])
  })

  test('counts every record when no key set is supplied', () => {
    const pages = {
      a: { history: [{ timestamp: '2026-07-01T10:00:00.000Z', decision: 'Approved' }] },
    }
    expect(buildActivitySeries(pages)).toHaveLength(1)
    expect(buildActivitySeries(pages, new Set())).toHaveLength(1)
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

  test('changes when a page title changes but its pass rate does not', () => {
    // Restoring an edited_title from a backup import or a sync pull changes
    // what the axis label and the accessible table render while leaving pct
    // identical. The old signature missed it and the redraw was skipped, so
    // both kept showing the previous title.
    const pages = {}
    const before = buildInsightsModel(
      [{ key: 'a', title: 'Old', checksPassed: 1, checksTotal: 2 }],
      pages
    )
    const after = buildInsightsModel(
      [{ key: 'a', title: 'New', checksPassed: 1, checksTotal: 2 }],
      pages
    )

    expect(insightsSignature(before)).not.toBe(insightsSignature(after))
  })

  test('changes when passed/total change but the rounded percentage does not', () => {
    const pages = {}
    const before = buildInsightsModel(
      [{ key: 'a', title: 'A', checksPassed: 1, checksTotal: 2 }],
      pages
    )
    const after = buildInsightsModel(
      [{ key: 'a', title: 'A', checksPassed: 2, checksTotal: 4 }],
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

describe('buildInsightsModel checksFailing', () => {
  test('carries only the pages with failing checks', () => {
    // The "Checks needing attention" card draws this subset. Slicing the full
    // list padded the chart out to its row cap with pages sitting at 100%.
    const rows = [
      { key: 'a', title: 'A', checksPassed: 2, checksTotal: 2 },
      { key: 'b', title: 'B', checksPassed: 1, checksTotal: 2 },
    ]
    const model = buildInsightsModel(rows, {})

    expect(model.checks.map((item) => item.key)).toEqual(['b', 'a'])
    expect(model.checksFailing.map((item) => item.key)).toEqual(['b'])
  })

  test('is empty when every page passes, so the card can say so', () => {
    const model = buildInsightsModel(
      [{ key: 'a', title: 'A', checksPassed: 3, checksTotal: 3 }],
      {}
    )

    expect(model.checks).toHaveLength(1)
    expect(model.checksFailing).toEqual([])
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
