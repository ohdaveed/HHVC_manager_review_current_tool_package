/* Shared review-record merge logic: the single place "existing < patch"
   precedence and history-entry construction happen. Consumed by the browser
   (js/review-queue-state.js, js/ux-improvements-export.js,
   js/review-state-sync.js) via window.reviewMerge, and by server.ts's
   /api/review-state routes via a plain require/import — so it has no DOM
   dependency and must stay loadable in both contexts. Loads early, right
   after js/review-state-store.js, since every one of those files depends on
   it existing first. */

/**
 * A composite identity for a history entry, built from its actual content
 * in a fixed field order — NOT just `timestamp`. `Date.toISOString()` is
 * only millisecond-precision, so two genuinely different entries (e.g. two
 * merges landing in the same millisecond) can share a timestamp; keying
 * dedup on timestamp alone would wrongly collapse them. Keying on full
 * content instead means only truly-identical entries collide, regardless
 * of what order their fields happen to be in (JSON.stringify would treat
 * differently-ordered-but-identical objects as different keys).
 * @param {object} entry
 * @returns {string}
 */
function historyEntryKey(entry) {
  return [
    entry.timestamp || '',
    entry.reviewer || '',
    entry.decision || '',
    entry.notes || '',
    entry.risks_or_blockers || '',
    entry.updated_by || '',
  ].join('')
}

/**
 * Combine history arrays (e.g. what's already on a record, what an
 * imported/synced patch itself carries, and the new boundary entry for
 * this merge) into one, deduped and chronological. Array.prototype.sort is
 * stable, so entries that share a timestamp keep the relative order they
 * were passed in (source before patch before the new entry).
 * @param {Array<object>} lists
 * @returns {Array<object>}
 */
function combineHistory(...lists) {
  const seen = new Map()
  for (const list of lists) {
    if (!Array.isArray(list)) continue
    for (const entry of list) {
      if (!entry || typeof entry !== 'object') continue
      const key = historyEntryKey(entry)
      if (!seen.has(key)) seen.set(key, entry)
    }
  }
  return Array.from(seen.values()).sort((a, b) =>
    String(a.timestamp || '').localeCompare(String(b.timestamp || ''))
  )
}

/**
 * Merge an incoming patch onto an existing review record and append one
 * history entry describing the result. This is the ONLY place a history
 * entry gets constructed — callers that just want to keep a working
 * snapshot fresh without recording a new "round" (e.g. the per-keystroke
 * autosave in js/ux-improvements-state-sync.js) must NOT route through
 * this function; they carry the existing history array forward untouched
 * instead.
 *
 * `patch` is sometimes a full saved record in its own right (a JSON backup
 * import, or a client's full local snapshot arriving at an empty sync
 * server) and can carry its own `history[]` — those prior rounds must
 * survive the merge, not just whatever `existing` already had.
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

  const newEntry = {
    timestamp,
    reviewer: merged.reviewer || '',
    notes: merged.notes || '',
    risks_or_blockers: merged.risks_or_blockers || '',
    updated_by: options.updatedBy || 'local',
  }
  // historyEntrySchema declares decision as optional, not empty-string-valid
  // — omit the key entirely rather than writing '' when there's no decision.
  if (merged.decision) newEntry.decision = merged.decision

  merged.history = combineHistory(source.history, patch?.history, [newEntry])

  return merged
}

if (typeof window !== 'undefined') {
  window.reviewMerge = { mergeReviewRecord }
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { mergeReviewRecord }
}
