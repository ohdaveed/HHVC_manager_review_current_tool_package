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

  test('accepts a section_edits map of valid field paths and shapes', () => {
    const result = validateReviewRecord({
      page_key: 'pestsTopic',
      section_edits: {
        'sections.2.heading': 'New heading',
        'sections.2.paragraphs': ['p1', 'p2'],
        'sections.2.bullets': [{ text: 'b1' }, { text: 'b2', unverified: true }],
      },
    })
    expect(result.success).toBe(true)
    expect(result.data.section_edits).toEqual({
      'sections.2.heading': 'New heading',
      'sections.2.paragraphs': ['p1', 'p2'],
      'sections.2.bullets': [{ text: 'b1' }, { text: 'b2', unverified: true }],
    })
  })

  test('drops section_edits entries with an unsupported path, not the whole record', () => {
    // A per-index path and an unsupported suffix are both outside the
    // path/value contract — computeSectionEdits() never produces either.
    const result = validateReviewRecord({
      page_key: 'pestsTopic',
      section_edits: {
        'sections.2.heading': 'Kept',
        'sections.2.bullets.0': 'per-index path, not the whole array',
        'sections.2.kind': 'placement',
      },
    })
    expect(result.success).toBe(true)
    expect(result.data.section_edits).toEqual({ 'sections.2.heading': 'Kept' })
  })

  test('drops section_edits entries whose value shape does not match their path suffix', () => {
    const result = validateReviewRecord({
      page_key: 'pestsTopic',
      section_edits: {
        'sections.0.heading': 123, // must be a string
        'sections.1.paragraphs': 'broken', // must be an array
        'sections.2.bullets': ['ok', { text: 'also ok' }, { missing: 'text field' }],
      },
    })
    expect(result.success).toBe(true)
    // The whole sections.2.bullets array is dropped, not filtered item by
    // item — a mixed-validity array is itself malformed, and section_edits
    // always writes the whole field (see js/inline-content-edit-data.js's
    // "Array edits are always a whole-field replace" note in CLAUDE.md).
    expect(result.data.section_edits).toEqual({})
  })

  test('accepts an empty section_edits map', () => {
    const result = validateReviewRecord({ page_key: 'pestsTopic', section_edits: {} })
    expect(result.success).toBe(true)
  })

  test('rejects a non-object section_edits value', () => {
    const result = validateReviewRecord({ page_key: 'pestsTopic', section_edits: 'not an object' })
    expect(result.success).toBe(false)
  })

  test('rejects a section_edits value that is an array', () => {
    const result = validateReviewRecord({ page_key: 'pestsTopic', section_edits: ['x'] })
    expect(result.success).toBe(false)
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

  test('preserves section_edits as a real object rather than stringifying it', () => {
    const clean = sanitizeReviewRecord({
      page_key: 'pestsTopic',
      section_edits: { 'sections.2.heading': 'New heading', 'sections.2.bullets': [{ text: 'b' }] },
    })
    expect(clean.section_edits).toEqual({
      'sections.2.heading': 'New heading',
      'sections.2.bullets': [{ text: 'b' }],
    })
  })

  test('drops a non-object section_edits value rather than passing it through', () => {
    const clean = sanitizeReviewRecord({ page_key: 'pestsTopic', section_edits: 'not an object' })
    expect(clean).not.toHaveProperty('section_edits')
  })

  test('keeps an empty section_edits map rather than dropping it', () => {
    const clean = sanitizeReviewRecord({ page_key: 'pestsTopic', section_edits: {} })
    expect(clean.section_edits).toEqual({})
  })

  test('drops unsupported section_edits paths and shape-mismatched values, same as the Zod schema', () => {
    const clean = sanitizeReviewRecord({
      page_key: 'pestsTopic',
      section_edits: {
        'sections.2.heading': 'Kept',
        'sections.2.bullets.0': 'per-index path',
        'sections.2.kind': 'placement',
        'sections.0.heading': 123,
        'sections.1.paragraphs': 'broken',
      },
    })
    expect(clean.section_edits).toEqual({ 'sections.2.heading': 'Kept' })
  })
})

// A malformed section_edits map must be filtered THE SAME WAY on both sides
// of the CJS/browser split — a case the Zod schema drops but the browser
// validator keeps (or vice versa) would let a JSON backup pass one gate and
// fail the other, or worse, silently disagree about what a synced record
// contains. tests/decision-vocabulary.test.js pins VALID_DECISIONS the same
// way, for the same reason.
// There is a THIRD copy of this shape rule, and it is the one that had
// actually drifted: js/inline-content-edit-data.js's isValidSectionEditItem
// sits on the WRITE side (computing the diff that gets stored) while the two
// above sit on the read side (validating what comes back). Its check was
// `typeof item === 'object'`, which — unlike the read side's isPlainObject —
// admits an array carrying an own `.text` property. A value the write side
// stores and the read side then drops is precisely how a reviewer's inline
// edits disappear on the next load with nothing erroring, so all three are
// pinned together here rather than two of the three.
describe('section_edits whitelist agrees between the Zod schema, the browser validator, and the write-side differ', () => {
  const { sanitizeSectionEdits } = window.reviewStateValidation
  const { isValidSectionEditValue } = require('../js/inline-content-edit-data.js')

  test.each([
    [
      'all valid paths/shapes',
      {
        'sections.0.heading': 'H',
        'sections.0.paragraphs': ['p', { text: 'q', unverified: true }],
      },
    ],
    ['unsupported suffix', { 'sections.0.kind': 'placement' }],
    ['per-index path', { 'sections.0.bullets.0': 'x' }],
    ['heading as a non-string', { 'sections.0.heading': 123 }],
    ['paragraphs as a non-array', { 'sections.0.paragraphs': 'not an array' }],
    ['bullets with one malformed item', { 'sections.0.bullets': ['ok', { missing: 'text' }] }],
    ['bullets with a null item', { 'sections.0.bullets': ['ok', null] }],
    // The divergence itself. `typeof [] === 'object'` and this array carries
    // an own `text` property, so the pre-fix write-side check accepted it
    // while both read-side checks rejected it. It has to be a real Array
    // rather than an object literal, or the Array.isArray guard the fix added
    // never fires and the case proves nothing.
    ['bullets with an array item carrying .text', { 'sections.0.bullets': [arrayWithText()] }],
  ])('%s', (_label, sectionEdits) => {
    const zodResult = validateReviewRecord({ page_key: 'pestsTopic', section_edits: sectionEdits })
    expect(zodResult.success).toBe(true)
    const sanitized = sanitizeSectionEdits(sectionEdits)
    expect(zodResult.data.section_edits).toEqual(sanitized)

    // Same verdict, path by path, from the write side. `kept` is what both
    // read-side gates concluded; isValidSectionEditValue is asked the same
    // question about the same value and must answer identically.
    for (const [path, value] of Object.entries(sectionEdits)) {
      const suffix = /^sections\.\d+\.(heading|paragraphs|bullets)$/.exec(path)?.[1]
      if (!suffix) continue
      const kept = Object.prototype.hasOwnProperty.call(sanitized, path)
      expect(isValidSectionEditValue(suffix, value)).toBe(kept)
    }
  })
})

/**
 * An Array that also carries an own `text` string property — the one shape the
 * write-side and read-side item checks used to disagree about. An object
 * literal cannot stand in for it: the value has to really be an Array for
 * Array.isArray to fire.
 * @returns {string[]}
 */
function arrayWithText() {
  const value = ['nested']
  value.text = 'looks like an item'
  return value
}
