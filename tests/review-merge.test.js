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
})
