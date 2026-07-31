import { describe, test, expect } from 'bun:test'
import '../js/review-state-validation.js'
import {
  validateReviewState,
  validateReviewRecord,
  STORAGE_VERSION,
} from '../build_scripts/review-state-schema.js'

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

  test('accepts local_dirty as a real boolean', () => {
    expect(validateReviewRecord({ page_key: 'pestsTopic', local_dirty: true }).success).toBe(true)
    expect(validateReviewRecord({ page_key: 'pestsTopic', local_dirty: false }).success).toBe(true)
    expect(validateReviewRecord({ page_key: 'pestsTopic', local_dirty: 'false' }).success).toBe(
      false
    )
  })
})

// The browser has no Zod, so js/review-state-validation.js hand-rolls the
// same rules. It runs on every read of hhvcManagerReviewState:v1, so a
// mismatch here silently corrupts state rather than failing loudly.
describe('browser-side sanitizeReviewRecord (js/review-state-validation.js)', () => {
  // The module is a self-mounting IIFE that publishes its API onto
  // window.reviewStateValidation; importing it for that side effect is the
  // ESM equivalent of the old harness evaluating it into a vm context.
  const { sanitizeReviewRecord } = window.reviewStateValidation

  test('preserves local_dirty as a boolean rather than stringifying it', () => {
    // The generic branch coerces every other field with String(), which
    // would turn `false` into 'false' — a TRUTHY string. Every clean record
    // would then read back as holding unpushed edits, and every routine
    // pull would report it as a conflict.
    expect(sanitizeReviewRecord({ local_dirty: false }).local_dirty).toBe(false)
    expect(sanitizeReviewRecord({ local_dirty: true }).local_dirty).toBe(true)
  })

  test('normalizes a stringified local_dirty from an older/JSON-round-tripped record', () => {
    expect(sanitizeReviewRecord({ local_dirty: 'true' }).local_dirty).toBe(true)
    expect(sanitizeReviewRecord({ local_dirty: 'false' }).local_dirty).toBe(false)
  })

  test('keeps synced_at and drops unknown fields', () => {
    const clean = sanitizeReviewRecord({
      page_key: 'pestsTopic',
      synced_at: '2026-01-01T00:00:00.000Z',
      sync_api_token: 'must-never-round-trip',
    })
    expect(clean.synced_at).toBe('2026-01-01T00:00:00.000Z')
    expect(clean).not.toHaveProperty('sync_api_token')
  })
})
