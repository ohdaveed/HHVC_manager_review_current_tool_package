const { describe, test, expect } = require('bun:test')
const {
  validateReviewState,
  validateReviewRecord,
  STORAGE_VERSION,
} = require('../build_scripts/review-state-schema')

describe('review-state-schema', () => {
  test('accepts a valid review state backup', () => {
    const result = validateReviewState({
      version: STORAGE_VERSION,
      updated_at: '2026-07-06T00:00:00.000Z',
      ui: { workspace_open: true },
      globals: { reviewer: 'David' },
      pages: {
        pestsTopic: {
          page_key: 'pestsTopic',
          decision: 'Approved',
          notes: 'Looks good',
        },
      },
    })
    expect(result.success).toBe(true)
  })

  test('rejects invalid decision values', () => {
    const result = validateReviewRecord({
      page_key: 'pestsTopic',
      decision: 'Maybe later',
    })
    expect(result.success).toBe(false)
  })

  test('rejects unsupported versions', () => {
    const result = validateReviewState({ version: 99, pages: {} })
    expect(result.success).toBe(false)
  })
})
