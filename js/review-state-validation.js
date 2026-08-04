// Browser-side validation for hhvcManagerReviewState:v1.
// Mirrors build_scripts/review-state-schema.js rules without requiring Zod in the browser.

// Imported rather than read off `window.utils`, so the decision vocabulary is
// guaranteed present by the module graph instead of by load order — and so
// tests/review-state-schema.test.js, which side-effect-imports this file on its
// own, gets it too. Safe to import here (unlike js/review-insights-data.js):
// this module publishes only onto `window` and nothing `require`s it.
import { DECISION_LABELS } from './utils.js'
;(function initReviewStateValidation() {
  if (typeof window === 'undefined') return

  const STORAGE_VERSION = 1

  // From the canonical decision table in js/utils.js. The Node-side mirror of
  // this validator (build_scripts/review-state-schema.js) keeps its own copy —
  // it is CommonJS and cannot reach a browser ES module — and
  // tests/decision-vocabulary.test.js pins the two together.
  const VALID_DECISIONS = new Set(DECISION_LABELS)

  const REVIEW_RECORD_FIELDS = new Set([
    'review_date',
    'reviewer',
    'page_key',
    'page_title',
    'page_type',
    'url_slug',
    'decision',
    'notes',
    'risks_or_blockers',
    'follow_up_owner',
    'seo_title',
    'meta_description',
    'primary_cta',
    'reading_target',
    'edited_title',
    'edited_summary',
    'updated_at',
    'synced_at',
    'local_dirty',
  ])

  const HISTORY_ENTRY_FIELDS = new Set([
    'timestamp',
    'reviewer',
    'decision',
    'notes',
    'risks_or_blockers',
    'updated_by',
  ])

  function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
  }

  function sanitizeHistoryEntry(entry) {
    if (!isPlainObject(entry)) return null
    const clean = {}
    for (const [key, value] of Object.entries(entry)) {
      if (!HISTORY_ENTRY_FIELDS.has(key)) continue
      // decision is optional on a history entry, not empty-string-valid
      // (matches historyEntrySchema in build_scripts/review-state-schema.js)
      // — drop a blank/invalid decision instead of keeping ''.
      if (
        key === 'decision' &&
        (value === '' || value == null || !VALID_DECISIONS.has(String(value)))
      ) {
        continue
      }
      if (value == null) continue
      clean[key] = String(value)
    }
    return clean
  }

  function sanitizeReviewRecord(record) {
    if (!isPlainObject(record)) return null
    const clean = {}
    for (const [key, value] of Object.entries(record)) {
      // history is an array of entries, not a flat string field like the
      // rest of REVIEW_RECORD_FIELDS, so it can't go through the generic
      // stringify-everything path below without corrupting it.
      if (key === 'history') {
        if (Array.isArray(value)) {
          clean.history = value.map(sanitizeHistoryEntry).filter(Boolean)
        }
        continue
      }
      // local_dirty is a real boolean, and the generic String() coercion
      // below would turn `false` into the string 'false' — which is TRUTHY.
      // That would make every clean record read back as having unpushed
      // local edits, turning routine pulls into permanent conflicts.
      if (key === 'local_dirty') {
        if (value != null) clean.local_dirty = value === true || value === 'true'
        continue
      }
      if (!REVIEW_RECORD_FIELDS.has(key) && key !== 'page_key') continue
      if (
        key === 'decision' &&
        value !== '' &&
        value != null &&
        !VALID_DECISIONS.has(String(value))
      ) {
        continue
      }
      if (value == null) continue
      clean[key] = typeof value === 'string' ? value : String(value)
    }
    return clean
  }

  /**
   * Validate and normalize parsed review state from localStorage or JSON import.
   * @param {unknown} input
   * @returns {{ ok: true, data: object } | { ok: false, error: string }}
   */
  function validateReviewState(input) {
    if (!isPlainObject(input)) {
      return { ok: false, error: 'Review state must be a JSON object.' }
    }
    if (input.version !== STORAGE_VERSION) {
      return { ok: false, error: `Unsupported review state version (expected ${STORAGE_VERSION}).` }
    }

    const pages = {}
    if (input.pages != null) {
      if (!isPlainObject(input.pages)) {
        return { ok: false, error: 'Review state pages must be an object.' }
      }
      for (const [key, record] of Object.entries(input.pages)) {
        const clean = sanitizeReviewRecord(record)
        if (clean) pages[key] = { ...clean, page_key: key }
      }
    }

    const globals = isPlainObject(input.globals) ? { ...input.globals } : {}
    const ui = isPlainObject(input.ui) ? { ...input.ui } : {}

    return {
      ok: true,
      data: {
        version: STORAGE_VERSION,
        updated_at: typeof input.updated_at === 'string' ? input.updated_at : null,
        ui,
        globals,
        pages,
      },
    }
  }

  window.reviewStateValidation = {
    STORAGE_VERSION,
    VALID_DECISIONS,
    validateReviewState,
    sanitizeReviewRecord,
  }
})()
