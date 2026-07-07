// Browser-side validation for hhvcManagerReviewState:v1.
// Mirrors build_scripts/review-state-schema.js rules without requiring Zod in the browser.
;(function initReviewStateValidation() {
  if (typeof window === 'undefined') return

  const STORAGE_VERSION = 1

  const VALID_DECISIONS = new Set([
    'Approved',
    'Approved with edits',
    'Revise and resubmit',
    'Blocked',
    'Needs review',
  ])

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
  ])

  function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
  }

  function sanitizeReviewRecord(record) {
    if (!isPlainObject(record)) return null
    const clean = {}
    for (const [key, value] of Object.entries(record)) {
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
