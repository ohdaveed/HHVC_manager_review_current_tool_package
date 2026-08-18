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
    'seo_title',
    'meta_description',
    'primary_cta',
    'reading_target',
    'edited_title',
    'edited_summary',
    'section_edits',
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

  // The path/value contract for a section_edits entry — a restatement of
  // build_scripts/review-state-schema.js's SECTION_EDIT_PATH_PATTERN and
  // sectionEditTextItemSchema, for the same CJS/browser-Zod split reason
  // VALID_DECISIONS above is restated rather than imported. Restated again
  // as defense-in-depth in js/editing/inline-content-edit-data.js#applyContentEdits-
  // ToPageData, which has no ESM `export` surface either side can import
  // from. tests/review-state-schema.test.js pins all three together.
  const SECTION_EDIT_VALUE_KINDS = [
    [/^sections\.\d+\.heading$/, 'string'],
    [/^sections\.\d+\.paragraphs$/, 'textArray'],
    [/^sections\.\d+\.bullets$/, 'textArray'],
    [/^sections\.\d+\.table$/, 'table'],
    [/^sections\.\d+\.callout\.(title|text)$/, 'string'],
    [/^sections\.\d+\.steps\.\d+\.title$/, 'string'],
    [/^sections\.\d+\.steps\.\d+\.(text|bullets)$/, 'textArray'],
    [/^sections\.\d+\.steps\.\d+\.callout\.(title|text)$/, 'string'],
    [/^whatToKnow\.cost$/, 'string'],
    [/^whatToKnow\.(thingsToKnow|items)$/, 'textArray'],
    [/^spotlight\.title$/, 'string'],
    [/^spotlight\.paragraphs$/, 'textArray'],
    [/^contact\.(address|hours)$/, 'string'],
    [/^contact\.(phone|email|other)$/, 'stringArray'],
  ]

  const SECTION_EDIT_PATH_PATTERN = new RegExp(
    `^(?:${SECTION_EDIT_VALUE_KINDS.map(([pattern]) => pattern.source.replace(/^\^|\$$/g, '')).join('|')})$`
  )

  function sectionEditValueKind(path) {
    const entry = SECTION_EDIT_VALUE_KINDS.find(([pattern]) => pattern.test(path))
    return entry ? entry[1] : null
  }

  function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
  }

  function isValidSectionEditItem(item) {
    if (typeof item === 'string') return true
    return isPlainObject(item) && typeof item.text === 'string'
  }

  /**
   * Filter a section_edits map down to entries whose path matches
   * SECTION_EDIT_PATH_PATTERN and whose value shape matches that path's
   * suffix (heading -> string; paragraphs/bullets -> array of
   * string|{text,...}), dropping the rest — matching how a malformed
   * history entry above is dropped rather than kept malformed, rather than
   * failing the whole record over one bad nested value.
   * @param {unknown} sectionEdits
   * @returns {Record<string, unknown>|undefined}
   */
  function sanitizeSectionEdits(sectionEdits) {
    if (!isPlainObject(sectionEdits)) return undefined
    const clean = {}
    for (const [path, value] of Object.entries(sectionEdits)) {
      const kind = sectionEditValueKind(path)
      if (!kind) continue
      if (kind === 'string') {
        if (typeof value === 'string') clean[path] = value
        continue
      }
      if (!Array.isArray(value)) continue
      if (kind === 'textArray' && value.every(isValidSectionEditItem)) clean[path] = value
      if (kind === 'stringArray' && value.every((item) => typeof item === 'string')) {
        clean[path] = value
      }
      if (
        kind === 'table' &&
        value.every((row) => Array.isArray(row) && row.every((cell) => typeof cell === 'string'))
      ) {
        clean[path] = value
      }
    }
    return clean
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
      // section_edits is a flat map of field-path -> current value (a
      // string, or an array of strings/objects for paragraphs/bullets), not
      // a string field itself. Same reasoning as history: the generic
      // String() coercion below would turn the whole map into the literal
      // string "[object Object]", silently destroying every section-level
      // edit on the next read. sanitizeSectionEdits both requires an object
      // AND filters its entries to the supported path/value contract, so an
      // imported backup or sync response can't smuggle in an unsupported
      // field or a malformed paragraphs/bullets value that would corrupt
      // page.sections when reapplied.
      if (key === 'section_edits') {
        const sanitized = sanitizeSectionEdits(value)
        if (sanitized) clean.section_edits = sanitized
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
    SECTION_EDIT_PATH_PATTERN,
    sanitizeSectionEdits,
    validateReviewState,
    sanitizeReviewRecord,
  }
})()
