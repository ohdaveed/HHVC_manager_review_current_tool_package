/* Shared review-record merge logic: the single place "existing < patch"
   precedence and history-entry construction happen. Consumed by the browser
   (js/review/review-queue-state.js, js/ux-improvements-export.js,
   js/sync/review-state-sync.js) via window.reviewMerge, and by server.ts's
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
  const updatedBy = options.updatedBy || 'local'

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
    updated_by: updatedBy,
  }
  // historyEntrySchema declares decision as optional, not empty-string-valid
  // — omit the key entirely rather than writing '' when there's no decision.
  if (merged.decision) newEntry.decision = merged.decision

  merged.history = combineHistory(source.history, patch?.history, [newEntry])

  // Every merge except the server's own is a LOCAL change that hasn't
  // reached the sync server yet, so it marks the record dirty. `updatedBy:
  // 'sync'` is used only by server.ts's putReviewPage, whose result is by
  // definition what the server now holds — so the record it stores and
  // echoes back is clean, and a client adopting that response wholesale
  // inherits the correct flag instead of immediately re-flagging itself.
  merged.local_dirty = updatedBy !== 'sync'

  return merged
}

/** Fields that describe WHEN/WHETHER a record synced rather than what it says. */
const NON_CONTENT_FIELDS = new Set(['updated_at', 'synced_at', 'local_dirty', 'history'])

/**
 * Whether two field values are equal, for reviewContentEquals below. Most
 * review-record fields are plain strings and compare fine as `String(...)`
 * — but `section_edits` is object-valued (a flat map of field path -> current
 * value), and `String({...})` collapses every non-null object to the literal
 * "[object Object]" regardless of its contents, so two records with
 * DIFFERENT section edits would compare equal: a push landing while another
 * edit is in flight would then treat the newer local record as unchanged and
 * let the server's response overwrite it, and an edit to a previously-clean
 * record could leave `local_dirty` false and be silently overwritten by the
 * next pull. JSON.stringify is used instead for either side that is a
 * non-null object, matching the technique js/editing/inline-content-edit-data.js's
 * own deepEqual() already uses for this exact field's values.
 *
 * A missing/null object-valued field normalizes to `{}` rather than to
 * JSON.stringify(null) — buildReviewRecord always writes `section_edits: {}`
 * (never omits the key) when there are no section edits, but a record saved
 * before this feature existed has no `section_edits` key at all. Comparing
 * those two shapes literally would read every untouched legacy page as
 * content-changed on its first autosave under this fix, which is exactly the
 * false-dirty regression this function exists to prevent.
 * @param {unknown} left
 * @param {unknown} right
 * @returns {boolean}
 */
function fieldContentEquals(left, right) {
  const isObjectish = (value) => Boolean(value) && typeof value === 'object'
  if (isObjectish(left) || isObjectish(right)) {
    const normalize = (value) => JSON.stringify(isObjectish(value) ? value : {})
    return normalize(left) === normalize(right)
  }
  return String(left ?? '') === String(right ?? '')
}

/**
 * Whether two review records carry the same reviewer-visible content,
 * ignoring bookkeeping fields (timestamps, the sync baseline, the dirty
 * flag, and the append-only history array).
 *
 * Used by the autosave path to decide whether a save actually changed
 * anything: autosave also fires on navigation flushes and on edits to
 * unrelated form fields, so marking a record dirty on every call would
 * flag untouched pages as having unsynced work and turn every later pull
 * into a spurious conflict.
 * @param {object|null|undefined} a
 * @param {object|null|undefined} b
 * @returns {boolean}
 */
function reviewContentEquals(a, b) {
  const left = a && typeof a === 'object' ? a : {}
  const right = b && typeof b === 'object' ? b : {}
  const keys = new Set([...Object.keys(left), ...Object.keys(right)])
  for (const key of keys) {
    if (NON_CONTENT_FIELDS.has(key)) continue
    if (!fieldContentEquals(left[key], right[key])) return false
  }
  return true
}

if (typeof window !== 'undefined') {
  window.reviewMerge = { mergeReviewRecord, combineHistory, reviewContentEquals }
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { mergeReviewRecord, combineHistory, reviewContentEquals }
}
