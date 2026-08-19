// Unit tests for the ops panel's diagnostics (js/review/review-ops-data.js).
//
// These are the functions that decide whether the panel tells an operator
// their data is fine or that something needs removing, and one of them backs a
// destructive button — so the edge cases matter more than the happy path.
const { describe, test, expect } = require('bun:test')
const {
  findOrphanedRecords,
  groupBySyncState,
  findRecordsWithoutHistory,
  measureStorage,
  countRounds,
  buildOpsReport,
} = require('../js/review/review-ops-data.js')

describe('findOrphanedRecords', () => {
  test('reports records whose page key is not part of the site', () => {
    const pages = { live: {}, retired: {} }

    expect(findOrphanedRecords(pages, new Set(['live']))).toEqual(['retired'])
  })

  test('reports nothing when every record matches a real page', () => {
    expect(findOrphanedRecords({ a: {}, b: {} }, new Set(['a', 'b']))).toEqual([])
  })

  test('reports NOTHING when the key set is empty, rather than everything', () => {
    // An empty key set means page data has not loaded, not that the whole site
    // was deleted. Returning every record here would put a "remove these"
    // button in front of a reviewer's entire review history.
    expect(findOrphanedRecords({ a: {}, b: {} }, new Set())).toEqual([])
    expect(findOrphanedRecords({ a: {} }, [])).toEqual([])
    expect(findOrphanedRecords({ a: {} }, undefined)).toEqual([])
  })

  test('accepts an array of keys as well as a Set', () => {
    expect(findOrphanedRecords({ a: {}, gone: {} }, ['a'])).toEqual(['gone'])
  })

  test('sorts the result so the list is stable between renders', () => {
    const pages = { zulu: {}, alpha: {}, mike: {} }

    expect(findOrphanedRecords(pages, new Set(['other']))).toEqual(['alpha', 'mike', 'zulu'])
  })

  test('tolerates a missing pages map', () => {
    expect(findOrphanedRecords(null, new Set(['a']))).toEqual([])
  })
})

describe('groupBySyncState', () => {
  test('keeps the three states of local_dirty apart', () => {
    // The field is deliberately tri-state: absent means "written before the
    // flag existed", which must never be read as clean — that is the bug the
    // tri-state exists to prevent.
    const pages = {
      unpushed: { local_dirty: true },
      synced: { local_dirty: false },
      legacy: {},
    }
    const groups = groupBySyncState(pages)

    expect(groups.dirty).toEqual(['unpushed'])
    expect(groups.clean).toEqual(['synced'])
    expect(groups.unknown).toEqual(['legacy'])
  })

  test('treats a non-boolean flag as unknown rather than truthy', () => {
    // String 'false' is the exact coercion trap called out in the sync notes.
    const groups = groupBySyncState({ a: { local_dirty: 'false' }, b: { local_dirty: undefined } })

    expect(groups.unknown.sort()).toEqual(['a', 'b'])
    expect(groups.dirty).toEqual([])
    expect(groups.clean).toEqual([])
  })

  test('tolerates a missing pages map', () => {
    expect(groupBySyncState(undefined)).toEqual({ dirty: [], clean: [], unknown: [] })
  })
})

describe('findRecordsWithoutHistory', () => {
  test('reports a decided page carrying no recorded round', () => {
    const pages = { legacy: { decision: 'Approved', history: [] } }

    expect(findRecordsWithoutHistory(pages)).toEqual(['legacy'])
  })

  test('ignores a page that was never decided', () => {
    // No decision means no round is expected — that is not a defect.
    const pages = {
      untouched: { decision: 'Needs review', history: [] },
      blank: { history: [] },
    }

    expect(findRecordsWithoutHistory(pages)).toEqual([])
  })

  test('ignores a decided page that has its rounds', () => {
    const pages = { fine: { decision: 'Approved', history: [{ timestamp: 'x' }] } }

    expect(findRecordsWithoutHistory(pages)).toEqual([])
  })

  test('treats a missing history array as no rounds', () => {
    expect(findRecordsWithoutHistory({ old: { decision: 'Blocked' } })).toEqual(['old'])
  })
})

describe('countRounds', () => {
  test('sums recorded rounds across every page', () => {
    const pages = {
      a: { history: [{}, {}] },
      b: { history: [{}] },
      c: {},
    }

    expect(countRounds(pages)).toBe(3)
  })

  test('is zero for an empty or missing map', () => {
    expect(countRounds({})).toBe(0)
    expect(countRounds(null)).toBe(0)
  })
})

describe('measureStorage', () => {
  test('measures bytes, not characters', () => {
    // A multi-byte character costs more storage than its string length
    // suggests; reporting length would understate a blob heading for a quota.
    expect(measureStorage('“”').bytes).toBeGreaterThan(2)
  })

  test('scales the label from bytes to KB to MB', () => {
    expect(measureStorage('a'.repeat(10)).label).toBe('10 B')
    expect(measureStorage('a'.repeat(2048)).label).toBe('2.0 KB')
    expect(measureStorage('a'.repeat(2 * 1024 * 1024)).label).toBe('2.00 MB')
  })

  test('reports zero for a missing blob rather than throwing', () => {
    expect(measureStorage(undefined)).toEqual({ bytes: 0, label: '0 B' })
  })
})

describe('buildOpsReport', () => {
  test('assembles every diagnostic in one pass', () => {
    const savedPages = {
      live: { decision: 'Approved', history: [{}], local_dirty: true },
      retired: { decision: 'Blocked', history: [] },
    }
    const report = buildOpsReport({
      savedPages,
      validKeys: new Set(['live']),
      raw: JSON.stringify(savedPages),
    })

    expect(report.recordCount).toBe(2)
    expect(report.rounds).toBe(1)
    expect(report.orphaned).toEqual(['retired'])
    expect(report.withoutHistory).toEqual(['retired'])
    expect(report.sync.dirty).toEqual(['live'])
    expect(report.storage.bytes).toBeGreaterThan(0)
  })

  test('returns a usable report for a browser with no review state', () => {
    const report = buildOpsReport({})

    expect(report.recordCount).toBe(0)
    expect(report.orphaned).toEqual([])
    expect(report.storage.bytes).toBe(0)
  })
})
