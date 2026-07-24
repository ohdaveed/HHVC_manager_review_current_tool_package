const { describe, test, expect } = require('bun:test')
const { mergeReviewRecord } = require('../js/review-merge.js')

describe('mergeReviewRecord', () => {
  test('patch fields overwrite existing fields, unrelated fields untouched', () => {
    const existing = {
      page_key: 'pestsTopic',
      decision: 'Needs review',
      notes: 'first pass',
      follow_up_owner: 'David',
      seo_title: 'Original SEO title',
    }
    const merged = mergeReviewRecord(existing, { decision: 'Approved', notes: 'looks good' })

    expect(merged.decision).toBe('Approved')
    expect(merged.notes).toBe('looks good')
    // Fields not present in the patch survive untouched.
    expect(merged.follow_up_owner).toBe('David')
    expect(merged.seo_title).toBe('Original SEO title')
    expect(merged.page_key).toBe('pestsTopic')
  })

  test('appends exactly one history entry per call, preserving prior entries', () => {
    const first = mergeReviewRecord(null, { decision: 'Needs review', reviewer: 'David' })
    expect(first.history).toHaveLength(1)
    expect(first.history[0]).toMatchObject({ decision: 'Needs review', reviewer: 'David' })

    const second = mergeReviewRecord(first, { decision: 'Approved', notes: 'ship it' })
    expect(second.history).toHaveLength(2)
    // Prior entry is untouched, not rewritten.
    expect(second.history[0]).toMatchObject({ decision: 'Needs review', reviewer: 'David' })
    expect(second.history[1]).toMatchObject({ decision: 'Approved', notes: 'ship it' })
  })

  test('treats a missing/null existing record as a fresh record, not a crash', () => {
    const merged = mergeReviewRecord(undefined, { decision: 'Blocked' })
    expect(merged.decision).toBe('Blocked')
    expect(merged.history).toHaveLength(1)
  })

  test('records who/when via options.updatedBy and options.timestamp', () => {
    const merged = mergeReviewRecord(
      null,
      { decision: 'Approved' },
      { updatedBy: 'sync', timestamp: '2026-01-01T00:00:00.000Z' }
    )
    expect(merged.updated_at).toBe('2026-01-01T00:00:00.000Z')
    expect(merged.history[0]).toMatchObject({
      updated_by: 'sync',
      timestamp: '2026-01-01T00:00:00.000Z',
    })
  })

  test('defaults options.updatedBy to "local" when not specified', () => {
    const merged = mergeReviewRecord(null, { decision: 'Approved' })
    expect(merged.history[0].updated_by).toBe('local')
  })

  test("a patch to one page never touches another record's data (caller-level isolation)", () => {
    const pageA = mergeReviewRecord(null, { decision: 'Approved', page_key: 'pestsTopic' })
    const pageB = mergeReviewRecord(null, { decision: 'Blocked', page_key: 'ratsReport' })

    expect(pageA.page_key).toBe('pestsTopic')
    expect(pageA.decision).toBe('Approved')
    expect(pageB.page_key).toBe('ratsReport')
    expect(pageB.decision).toBe('Blocked')
  })

  test('preserves history carried by the patch itself when merging into an empty/no-history record', () => {
    // This is the exact shape of a JSON backup import, or a client's first
    // push to an empty sync server: `patch` is a full saved record with its
    // own multi-round history, and `existing` is empty (nothing local yet).
    const patchWithHistory = {
      page_key: 'pestsTopic',
      decision: 'Revise and resubmit',
      notes: 'round 3 notes',
      history: [
        { timestamp: '2026-01-01T00:00:00.000Z', decision: 'Needs review', reviewer: 'Alice' },
        { timestamp: '2026-01-02T00:00:00.000Z', decision: 'Approved with edits', reviewer: 'Bob' },
        {
          timestamp: '2026-01-03T00:00:00.000Z',
          decision: 'Revise and resubmit',
          reviewer: 'Alice',
        },
      ],
    }

    const merged = mergeReviewRecord(null, patchWithHistory, {
      updatedBy: 'import',
      timestamp: '2026-01-04T00:00:00.000Z',
    })

    // All 3 prior rounds survive, plus the new boundary entry for this merge.
    expect(merged.history).toHaveLength(4)
    expect(merged.history[0]).toMatchObject({ reviewer: 'Alice', decision: 'Needs review' })
    expect(merged.history[1]).toMatchObject({ reviewer: 'Bob', decision: 'Approved with edits' })
    expect(merged.history[2]).toMatchObject({ reviewer: 'Alice', decision: 'Revise and resubmit' })
    expect(merged.history[3]).toMatchObject({
      updated_by: 'import',
      timestamp: '2026-01-04T00:00:00.000Z',
    })
  })

  test('combines existing history and patch history without duplicating either', () => {
    const existing = mergeReviewRecord(
      null,
      { decision: 'Needs review' },
      { timestamp: '2026-01-01T00:00:00.000Z' }
    )
    const patchWithHistory = {
      decision: 'Approved',
      history: [
        { timestamp: '2026-01-02T00:00:00.000Z', decision: 'Approved with edits', reviewer: 'Bob' },
      ],
    }

    const merged = mergeReviewRecord(existing, patchWithHistory, {
      timestamp: '2026-01-03T00:00:00.000Z',
    })

    expect(merged.history).toHaveLength(3)
    expect(merged.history.map((entry) => entry.timestamp)).toEqual([
      '2026-01-01T00:00:00.000Z',
      '2026-01-02T00:00:00.000Z',
      '2026-01-03T00:00:00.000Z',
    ])
  })

  test('re-merging the same history entries does not duplicate them (idempotent dedupe)', () => {
    const first = mergeReviewRecord(
      null,
      { decision: 'Needs review' },
      { timestamp: '2026-01-01T00:00:00.000Z' }
    )
    // Re-import the exact same record (same history) onto itself.
    const merged = mergeReviewRecord(first, { ...first }, { timestamp: '2026-01-01T00:00:00.000Z' })

    expect(merged.history).toHaveLength(1)
  })

  test('omits the decision key on a history entry instead of writing an empty string', () => {
    const merged = mergeReviewRecord(null, { notes: 'no decision yet' })
    expect(merged.history[0]).not.toHaveProperty('decision')
  })
})
