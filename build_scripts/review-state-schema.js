// Zod schema for hhvcManagerReviewState:v1 localStorage shape.
// Shared by tests and browser validation (js/review-state-validation.js mirrors rules).
const { z } = require('zod')

const STORAGE_VERSION = 1

const VALID_DECISIONS = [
  'Approved',
  'Approved with edits',
  'Revise and resubmit',
  'Blocked',
  'Needs review',
]

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
  reviewRecordSchema,
  reviewStateSchema,
  validateReviewState,
  validateReviewRecord,
}
