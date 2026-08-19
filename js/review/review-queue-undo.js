/* Cross-page review queue: one-step undo for decision actions.

   Loads after js/review/review-queue-state.js (it calls updateLocalReviewForPage)
   and before js/review/review-queue-rows.js, whose applyQueueAction is the single
   funnel every row and bulk action goes through and the only place that
   records a snapshot.

   Why this exists: a bulk action can rewrite the decision on every page in
   the site from one click, and before this there was no way back. That does
   not just risk a mistake — it makes a reviewer slow on purpose, checking the
   selection twice before every action. Triage speed comes from being able to
   act and then correct.

   THE UNDO IS A NEW ROUND, NOT A DELETION. history[] is append-only (see
   mergeReviewRecord in js/review/review-merge.js, the only place an entry is ever
   constructed), so undoing writes the previous content back as another
   recorded round rather than removing the entry the action made. The audit
   trail ends up reading "set to Approved, then reverted", which is what
   actually happened. Anything else would let a reviewer quietly erase a
   decision from the record. */
;(function mountReviewQueueUndo() {
  if (typeof window === 'undefined') return
  window.ReviewQueueInternal = window.ReviewQueueInternal || {}

  /**
   * The fields an undo restores: everything a reviewer authored, and nothing
   * that describes when or how the record was stored. `history` is excluded
   * because it is append-only and must survive; `updated_at`, `synced_at` and
   * `local_dirty` are bookkeeping the write path owns; `page_key` never
   * changes.
   */
  const RESTORED_FIELDS = ['decision', 'notes', 'risks_or_blockers', 'reviewer', 'review_date']

  /** What a page reverts to when the action created its record from nothing. */
  const EMPTY_RECORD = {
    decision: 'Needs review',
    notes: '',
    risks_or_blockers: '',
  }

  /**
   * The single stored snapshot. One level deep on purpose: a stack would
   * imply an undo history the review state cannot actually reconstruct, since
   * every undo is itself a forward-only write.
   */
  let lastAction = null

  /**
   * Take the restorable content of a saved record.
   * @param {object|null|undefined} record
   * @returns {object|null} null when the page had no record at all
   */
  function captureRecord(record) {
    if (!record || typeof record !== 'object') return null
    const captured = {}
    for (const field of RESTORED_FIELDS) captured[field] = record[field] ?? ''
    return captured
  }

  /**
   * Remember what a just-applied action replaced.
   *
   * `entries` carries, per page, the content that was there before and the
   * `updated_at` the action produced. That second value is the guard: it is
   * what lets the undo tell "nothing has happened since" from "the reviewer
   * has edited this page in the meantime".
   * @param {{label: string, entries: Array<{pageKey: string, prior: object|null, appliedUpdatedAt: string}>}} snapshot
   * @returns {void}
   */
  function recordAction(snapshot) {
    if (!snapshot?.entries?.length) return
    lastAction = snapshot
  }

  /** Forget the snapshot — used when an undo has been consumed. */
  function clearAction() {
    lastAction = null
  }

  /** @returns {boolean} */
  function canUndo() {
    return Boolean(lastAction?.entries?.length)
  }

  /**
   * Reviewer-facing description of what undo would reverse, e.g.
   * "Undo Approved · 6 pages". Returns '' when there is nothing to undo.
   * @returns {string}
   */
  function describeUndo() {
    if (!canUndo()) return ''
    const count = lastAction.entries.length
    return count === 1 ? `Undo ${lastAction.label}` : `Undo ${lastAction.label} · ${count} pages`
  }

  /**
   * Reverse the last recorded action.
   *
   * Pages whose record has moved on since the action are SKIPPED rather than
   * overwritten. A snapshot says "this action produced exactly this record";
   * if the stored record no longer matches, someone has edited the page since
   * — through the sidebar, an import, or a sync pull — and restoring the
   * pre-action content would silently throw that newer work away. Undo is
   * supposed to reduce the cost of a mistake, not introduce a new way to make
   * one.
   * @returns {{undone: number, skipped: string[]}}
   */
  function undoLastAction() {
    if (!canUndo()) return { undone: 0, skipped: [] }

    const state = window.reviewState?.read?.() || { pages: {} }
    const updateLocalReviewForPage = window.ReviewQueueInternal?.helpers?.updateLocalReviewForPage
    if (typeof updateLocalReviewForPage !== 'function') return { undone: 0, skipped: [] }

    const skipped = []
    let undone = 0

    for (const entry of lastAction.entries) {
      const current = state.pages?.[entry.pageKey]
      if (!current || current.updated_at !== entry.appliedUpdatedAt) {
        skipped.push(entry.pageKey)
        continue
      }
      const patch = entry.prior ? { ...entry.prior } : { ...EMPTY_RECORD }
      updateLocalReviewForPage(entry.pageKey, patch, 'undo')
      undone += 1
    }

    // Consumed either way. Leaving a snapshot that partly failed to apply
    // invites a second press that reverts a different set of pages than the
    // button described.
    clearAction()
    return { undone, skipped }
  }

  window.ReviewQueueInternal.undo = {
    RESTORED_FIELDS,
    captureRecord,
    recordAction,
    clearAction,
    canUndo,
    describeUndo,
    undoLastAction,
  }
})()
