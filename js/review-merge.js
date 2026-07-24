/* Shared review-record merge logic: the single place "existing < patch"
   precedence and history-entry construction happen. Consumed by the browser
   (js/review-queue-state.js, js/ux-improvements-export.js,
   js/review-state-sync.js) via window.reviewMerge, and by server.ts's
   /api/review-state routes via a plain require/import — so it has no DOM
   dependency and must stay loadable in both contexts. Loads early, right
   after js/review-state-store.js, since every one of those files depends on
   it existing first. */

/**
 * Merge an incoming patch onto an existing review record and append one
 * history entry describing the result. This is the ONLY place a history
 * entry gets constructed — callers that just want to keep a working
 * snapshot fresh without recording a new "round" (e.g. the per-keystroke
 * autosave in js/ux-improvements-state-sync.js) must NOT route through
 * this function; they carry the existing history array forward untouched
 * instead.
 * @param {object|null|undefined} existing
 * @param {object} patch
 * @param {{ timestamp?: string, updatedBy?: string }} [options]
 * @returns {object}
 */
function mergeReviewRecord(existing, patch, options = {}) {
  const source = existing && typeof existing === 'object' ? existing : {}
  const timestamp = options.timestamp || new Date().toISOString()

  const merged = {
    ...source,
    ...patch,
    updated_at: timestamp,
  }

  const priorHistory = Array.isArray(source.history) ? source.history : []
  merged.history = priorHistory.concat([
    {
      timestamp,
      reviewer: merged.reviewer || '',
      decision: merged.decision || '',
      notes: merged.notes || '',
      risks_or_blockers: merged.risks_or_blockers || '',
      updated_by: options.updatedBy || 'local',
    },
  ])

  return merged
}

if (typeof window !== 'undefined') {
  window.reviewMerge = { mergeReviewRecord }
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { mergeReviewRecord }
}
