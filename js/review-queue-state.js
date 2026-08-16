/* Cross-page review queue: shared mutable state, action helpers, sidebar
   sync, and queue UI persistence. Loads first among the review-queue-*.js
   files, right where js/review-queue.js used to sit in index.html. */
;(function mountReviewQueueState() {
  const DATA = window.HHVC_DATA
  if (!DATA || !DATA.pages || !DATA.order || !window.reviewState || !window.reviewMerge) return

  const QUEUE_PANEL_ID = 'reviewWorkspaceOverview'
  const STALE_DAYS = 3
  const DEFAULT_STATE = {
    filter: 'All',
    query: '',
    sort: 'priority',
  }

  const { getCurrentKey, DECISION_LABELS, DECISION_LABEL_BY_SLUG } = window.utils
  const readLocalState = window.reviewState.read
  const updateLocalState = window.reviewState.update

  const VALID_DECISIONS = new Set(DECISION_LABELS)

  /**
   * Human label for each queue action.
   *
   * The decision entries are derived from the canonical table in js/utils.js
   * rather than retyped. They used to be spelled out here AND inverted by hand
   * in js/keyboard-shortcuts.js, so the same five pairs lived in two files with
   * nothing keeping them agreed.
   *
   * `assign-me` is spread in on top because it is a queue action that is not a
   * decision — it sets the reviewer without touching `decision` — so it belongs
   * to this map and not to the decision vocabulary.
   */
  const ACTION_LABELS = {
    ...DECISION_LABEL_BY_SLUG,
  }

  function toast(message, tone = 'success') {
    if (typeof window.showToast === 'function') {
      window.showToast(message, tone)
    }
  }

  function actionLabel(action) {
    return ACTION_LABELS[action] || action
  }

  function actionToastTone(action) {
    if (action === 'blocked' || action === 'revise') return 'warn'
    if (action === 'needs-review') return 'info'
    return 'success'
  }

  function buildActionPatch(action, suggestedOwner, reviewDate, currentSaved) {
    const decision = ACTION_LABELS[action]
    if (!decision || !VALID_DECISIONS.has(decision)) return null

    if (currentSaved.decision === decision) return null

    return {
      decision,
      review_date: reviewDate,
    }
  }

  function getSidebarReviewerName() {
    const v = document.getElementById('reviewerInput')?.value
    const trimmed = String(v || '').trim()
    return trimmed || 'Me'
  }

  function getSidebarReviewDate() {
    const v = document.getElementById('reviewDateInput')?.value
    const trimmed = String(v || '').trim()
    return trimmed || window.utils.today()
  }

  /**
   * @param {string} pageKey
   * @param {object} patch
   * @param {string} [updatedBy] History-entry provenance tag. Defaults to
   *   'action' (a queue button/keyboard shortcut, this function's usual
   *   caller in js/review-queue-rows.js). js/review-queue-import.js's CSV
   *   import path passes 'import' explicitly — without that override every
   *   CSV-imported row would be indistinguishable from a manual action in
   *   the history audit trail, unlike JSON backup import which already
   *   correctly tags its entries 'import' (js/ux-improvements-export.js).
   */
  function updateLocalReviewForPage(pageKey, patch, updatedBy = 'action') {
    const page = DATA.pages[pageKey] || {}
    const actingReviewer = getSidebarReviewerName()
    let nextSaved

    window.reviewState.update((localState) => {
      const existing = localState.pages[pageKey] || {}
      const defaults = window.utils.buildReviewRecord(page, pageKey, {
        review_date: getSidebarReviewDate(),
        reviewer: actingReviewer,
      })
      // defaults < existing: existing (if any) wins over freshly-computed
      // defaults so mergeReviewRecord sees the real prior record, including
      // its history array, as `existing` — EXCEPT reviewer, which must not
      // follow that precedence: queue action patches never include
      // `reviewer`, so letting a stale existing.reviewer win would
      // attribute this action's new history entry to whoever last saved
      // the record, not whoever is acting right now (e.g. Bob bulk-
      // approving pages Alice previously reviewed would misattribute the
      // approval to Alice).
      const base = { ...defaults, ...existing, reviewer: actingReviewer }
      nextSaved = window.reviewMerge.mergeReviewRecord(base, patch, {
        updatedBy,
      })
      localState.pages[pageKey] = nextSaved
      return localState
    })

    return nextSaved
  }

  function syncSidebarForKey(pageKey, saved) {
    if (pageKey !== getCurrentKey()) return
    window.utils.setValue('reviewDecision', saved.decision || 'Needs review')
    window.utils.setValue('reviewNotes', saved.notes || '')
    window.utils.setValue('reviewRisks', saved.risks_or_blockers || '')
    window.utils.setValue('reviewDateInput', saved.review_date || getSidebarReviewDate())
    if (!String(document.getElementById('reviewerInput')?.value || '').trim())
      window.utils.setValue('reviewerInput', saved.reviewer || '')
  }

  function dispatchReviewFieldChange(id) {
    const el = document.getElementById(id)
    if (!el) return
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }

  const state = {
    ...DEFAULT_STATE,
    selected: new Set(),
  }

  function writeQueueUiState() {
    try {
      const raw = localStorage.getItem(window.reviewState.STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (!parsed || parsed.version !== window.reviewState.STORAGE_VERSION) return
      }
    } catch {
      return
    }

    updateLocalState((localState) => {
      localState.ui.overview = {
        filter: state.filter,
        query: state.query,
        sort: state.sort,
      }
      return localState
    })
  }

  function restoreQueueUiState() {
    const overviewUi = readLocalState().ui?.overview || {}
    state.filter = overviewUi.filter || DEFAULT_STATE.filter
    state.query = overviewUi.query || DEFAULT_STATE.query
    state.sort = overviewUi.sort || DEFAULT_STATE.sort
  }

  function getDecisionForKey(pageKey, savedPages) {
    const saved = savedPages[pageKey]
    if (!saved) return 'Needs review'
    return saved.decision || 'Needs review'
  }

  function normalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
  }

  function parseIsoDate(value) {
    if (!value) return null
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  function getAgeInDays(value) {
    const date = parseIsoDate(value)
    if (!date) return null
    const ms = Date.now() - date.getTime()
    return ms < 0 ? 0 : Math.floor(ms / 86400000)
  }

  window.ReviewQueueInternal = window.ReviewQueueInternal || {}
  window.ReviewQueueInternal.state = state
  window.ReviewQueueInternal.helpers = {
    QUEUE_PANEL_ID,
    STALE_DAYS,
    DEFAULT_STATE,
    VALID_DECISIONS,
    toast,
    actionLabel,
    actionToastTone,
    buildActionPatch,
    getSidebarReviewerName,
    getSidebarReviewDate,
    updateLocalReviewForPage,
    syncSidebarForKey,
    dispatchReviewFieldChange,
    writeQueueUiState,
    restoreQueueUiState,
    getDecisionForKey,
    normalize,
    parseIsoDate,
    getAgeInDays,
  }
})()
