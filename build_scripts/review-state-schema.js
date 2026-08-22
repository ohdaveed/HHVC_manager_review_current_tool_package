// Zod schema for hhvcManagerReviewState:v1 localStorage shape.
// Shared by tests and browser validation (js/review/review-state-validation.js mirrors rules).
const { z } = require('zod')

const STORAGE_VERSION = 1

/**
 * **A restatement of `DECISIONS` in js/core/utils.js, and one of only two left in
 * the repo.** It cannot import that table: this file is CommonJS and is loaded
 * by server.ts, so reaching into a browser ES module would pull the whole
 * browser utils graph into the server's dependency tree.
 *
 * `tests/decision-vocabulary.test.js` pins the two together, so a decision
 * added to the canonical table and not mirrored here fails CI rather than
 * producing a value the browser accepts and the sync API rejects.
 *
 * Order is not meaningful here — it feeds a Zod `z.enum()`.
 */
const VALID_DECISIONS = [
  'Approved',
  'Approved with edits',
  'Revise and resubmit',
  'Blocked',
  'Needs review',
]

/**
 * The path/value contract for a section_edits entry — see CLAUDE.md's
 * "Inline content editing" section, whose canonical list is
 * js/editing/inline-content-edit-data.js's EDITABLE_FIELD_SHAPES. Every path a
 * reviewer can edit resolves to one of four value kinds: a plain `string`, a
 * `textArray` of strings and/or {text, unverified?, unverifiedReason?}
 * objects, a `stringArray` of plain strings, or a `table` of row arrays of
 * plain strings — each keyed at the whole-field level rather than per item.
 * Anything else — an unsupported suffix like `sections.0.kind`, a card path,
 * a per-index path, or a value of the wrong shape for its kind — is not
 * something this feature ever produces, but a JSON backup or a sync response
 * is an external file/service this browser did not write: an entry that
 * doesn't match gets dropped rather than trusted, since
 * js/editing/inline-content-edit-data.js's applyContentEditsToPageData() would
 * otherwise pass it straight to the generic setByPath() and corrupt
 * page.sections (e.g. replacing a paragraphs array with a bare string, which
 * breaks the next render when it iterates the array).
 *
 * The kinds differ in what they permit, and the differences are load-bearing
 * rather than cosmetic: a tagged object in a `stringArray` (a contact phone
 * number) or a `table` cell renders as the literal "[object Object]", since
 * those renderers escape and print the value directly instead of running it
 * through normalizeTextItem().
 *
 * Restated (not imported) in js/review/review-state-validation.js for the same
 * CJS/browser-Zod split reason VALID_DECISIONS above is restated, and
 * restated again as defense-in-depth in
 * js/editing/inline-content-edit-data.js#applyContentEditsToPageData, which is a
 * dual CJS/browser file with no ESM `export` surface either side can import
 * from. tests/review-state-schema.test.js pins the three together.
 */
const SECTION_EDIT_VALUE_KINDS = [
  [/^sections\.\d+\.heading$/, 'string'],
  [/^sections\.\d+\.paragraphs$/, 'textArray'],
  [/^sections\.\d+\.bullets$/, 'textArray'],
  [/^sections\.\d+\.table$/, 'table'],
  [/^sections\.\d+\.facts$/, 'factsArray'],
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

/**
 * The value kind a section_edits path addresses, or null when the path is
 * outside the feature.
 * @param {string} path
 * @returns {'string'|'textArray'|'factsArray'|'stringArray'|'table'|null}
 */
function sectionEditValueKind(path) {
  const entry = SECTION_EDIT_VALUE_KINDS.find(([pattern]) => pattern.test(path))
  return entry ? entry[1] : null
}

const SECTION_EDIT_PATH_PATTERN = new RegExp(
  `^(?:${SECTION_EDIT_VALUE_KINDS.map(([pattern]) => pattern.source.replace(/^\^|\$$/g, '')).join('|')})$`
)

/**
 * The string-or-tagged-object shape a single paragraph/bullet item accepts.
 * Deliberately its OWN schema rather than a reuse of build_scripts/schema.js's
 * unverifiedItemSchema: that one requires `text.min(1)` for AUTHORED page
 * copy, but an inline edit can legitimately clear a paragraph to an empty
 * string (see tests/inline-content-edit.test.js's "committing a paragraph as
 * blank IS allowed" case) — reusing the stricter schema here would reject
 * exactly what this feature itself produces.
 */
const sectionEditTextItemSchema = z.union([
  z.string(),
  z
    .object({
      text: z.string(),
      unverified: z.boolean().optional(),
      unverifiedReason: z.string().optional(),
    })
    .passthrough(),
])

/**
 * One `sections.N.facts` entry: BOTH halves required, unlike a text item.
 * Kept as its own schema rather than a widened sectionEditTextItemSchema —
 * that one is shared by every textArray path, and requiring a label there
 * would reject an ordinary paragraph.
 */
const sectionEditFactItemSchema = z
  .object({
    // Non-blank, not merely a string: the interactive commit already refuses a
    // blank label, but an IMPORTED record never passes through that UI guard,
    // and a blank fact label renders an empty heading.
    //
    // `refine` rather than `.trim().min(1)`, which is a TRANSFORM — it would
    // store the trimmed string, silently rewriting the reviewer's value on its
    // way through validation. This validates and stores what it was given.
    label: z.string().refine((value) => value.trim() !== ''),
    text: z.string(),
    unverified: z.boolean().optional(),
    unverifiedReason: z.string().optional(),
  })
  .strict()

/**
 * Validate one section_edits entry against the contract above.
 * @param {string} path
 * @param {unknown} value
 * @returns {{ ok: true, value: unknown } | { ok: false }}
 */
function validateSectionEditEntry(path, value) {
  const kind = sectionEditValueKind(path)
  if (!kind) return { ok: false }
  if (kind === 'string') {
    return typeof value === 'string' ? { ok: true, value } : { ok: false }
  }
  const schema =
    kind === 'textArray'
      ? z.array(sectionEditTextItemSchema)
      : // A top-facts fact is {label, text} and renderTopFacts() prints the
        // label unguarded, so a generic textArray is too loose here: a bare
        // string, or an object carrying only `text`, would pass, replace the
        // authored facts array wholesale, and render a blank heading. Both
        // halves are required; the tagged meta fields stay optional, since an
        // edited fact still commits `unverified`.
        kind === 'factsArray'
        ? z.array(sectionEditFactItemSchema)
        : kind === 'stringArray'
          ? z.array(z.string())
          : z.array(z.array(z.string()))
  const parsed = schema.safeParse(value)
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false }
}

/**
 * Filter a section_edits map down to entries that satisfy the path/value
 * contract, dropping the rest. A drop rather than a whole-record rejection,
 * matching how every other malformed field in this schema (an invalid
 * decision, a malformed history entry) is already handled in
 * js/review/review-state-validation.js: one bad nested value should not cost the
 * reviewer the rest of an imported record.
 * @param {Record<string, unknown>|undefined} sectionEdits
 * @returns {Record<string, unknown>|undefined}
 */
function filterSectionEdits(sectionEdits) {
  if (!sectionEdits) return sectionEdits
  const clean = {}
  for (const [path, raw] of Object.entries(sectionEdits)) {
    const result = validateSectionEditEntry(path, raw)
    if (result.ok) clean[path] = result.value
  }
  return clean
}

const historyEntrySchema = z
  .object({
    timestamp: z.string().optional(),
    reviewer: z.string().optional(),
    decision: z.enum(VALID_DECISIONS).optional(),
    notes: z.string().optional(),
    risks_or_blockers: z.string().optional(),
    updated_by: z.string().optional(),
  })
  .passthrough()

const reviewRecordSchema = z
  .object({
    review_date: z.string().optional(),
    reviewer: z.string().optional(),
    page_key: z.string().optional(),
    page_title: z.string().optional(),
    page_type: z.string().optional(),
    url_slug: z.string().optional(),
    decision: z.enum(VALID_DECISIONS).optional(),
    notes: z.string().optional(),
    risks_or_blockers: z.string().optional(),
    seo_title: z.string().optional(),
    meta_description: z.string().optional(),
    primary_cta: z.string().optional(),
    reading_target: z.string().optional(),
    edited_title: z.string().optional(),
    edited_summary: z.string().optional(),
    updated_at: z.string().optional(),
    // Append-only round history. Constructed exclusively by
    // mergeReviewRecord (js/review/review-merge.js) — never hand-written.
    history: z.array(historyEntrySchema).optional(),
    // Last server updated_at this browser has actually observed (via a
    // pull or push response) — distinct from updated_at, which bumps on
    // every local edit. Used as the conflict-detection baseline in
    // server.ts's putReviewPage; see js/sync/review-state-sync.js.
    synced_at: z.string().optional(),
    // Flat map of field path -> current full value for section-level manual
    // edits (headings, paragraphs, bullets). Keyed at the array/scalar field
    // level, not the individual item level — see CLAUDE.md's "Inline content
    // editing" section for why. z.record's value type is z.unknown() because
    // a value here can be a string (a heading) or an array of strings/objects
    // — the base check just requires an object; filterSectionEdits (above)
    // does the actual per-entry path/value validation, dropping anything
    // that doesn't match rather than failing the whole record.
    section_edits: z
      .record(z.string(), z.unknown())
      .optional()
      .transform((value) => filterSectionEdits(value)),
    // Whether this browser holds edits it has not pushed. A real boolean,
    // not a timestamp, precisely so conflict detection never has to compare
    // a browser-clock value against a server-clock one — see
    // pullFromServer in js/sync/review-state-sync.js.
    local_dirty: z.boolean().optional(),
  })
  .passthrough()

const reviewStateSchema = z.object({
  version: z.literal(STORAGE_VERSION),
  updated_at: z.string().nullable().optional(),
  ui: z.record(z.unknown()).optional(),
  globals: z
    .object({
      reviewer: z.string().optional(),
      owner: z.string().optional(),
    })
    .passthrough()
    .optional(),
  pages: z.record(reviewRecordSchema).optional(),
})

/**
 * Validate parsed review state; returns { success, data?, error? }.
 * @param {unknown} input
 */
function validateReviewState(input) {
  return reviewStateSchema.safeParse(input)
}

/**
 * Validate a single page review record from CSV import.
 * @param {unknown} input
 */
function validateReviewRecord(input) {
  return reviewRecordSchema.safeParse(input)
}

module.exports = {
  STORAGE_VERSION,
  VALID_DECISIONS,
  SECTION_EDIT_PATH_PATTERN,
  validateSectionEditEntry,
  historyEntrySchema,
  reviewRecordSchema,
  reviewStateSchema,
  validateReviewState,
  validateReviewRecord,
}
