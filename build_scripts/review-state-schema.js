// Zod schema for hhvcManagerReviewState:v1 localStorage shape.
// Shared by tests and browser validation (js/review-state-validation.js mirrors rules).
const { z } = require('zod')

const STORAGE_VERSION = 1

/**
 * **A restatement of `DECISIONS` in js/utils.js, and one of only two left in
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
    follow_up_owner: z.string().optional(),
    seo_title: z.string().optional(),
    meta_description: z.string().optional(),
    primary_cta: z.string().optional(),
    reading_target: z.string().optional(),
    edited_title: z.string().optional(),
    edited_summary: z.string().optional(),
    updated_at: z.string().optional(),
    // Append-only round history. Constructed exclusively by
    // mergeReviewRecord (js/review-merge.js) — never hand-written.
    history: z.array(historyEntrySchema).optional(),
    // Last server updated_at this browser has actually observed (via a
    // pull or push response) — distinct from updated_at, which bumps on
    // every local edit. Used as the conflict-detection baseline in
    // server.ts's putReviewPage; see js/review-state-sync.js.
    synced_at: z.string().optional(),
    // Whether this browser holds edits it has not pushed. A real boolean,
    // not a timestamp, precisely so conflict detection never has to compare
    // a browser-clock value against a server-clock one — see
    // pullFromServer in js/review-state-sync.js.
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
  historyEntrySchema,
  reviewRecordSchema,
  reviewStateSchema,
  validateReviewState,
  validateReviewRecord,
}
