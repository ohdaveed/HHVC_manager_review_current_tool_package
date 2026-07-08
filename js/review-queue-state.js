/* Cross-page review queue: shared mutable state, action helpers, sidebar
   sync, and queue UI persistence. Loads first among the review-queue-*.js
   files, right where js/review-queue.js used to sit in index.html. */
;(function mountReviewQueueState() {
  const DATA = window.HHVC_DATA
  if (!DATA || !DATA.pages || !DATA.order || !window.reviewState) return

  const QUEUE_PANEL_ID = 'reviewWorkspaceOverview'
  const STALE_DAYS = 3
  const DEFAULT_STATE = {
    filter: 'All',
    query: '',
    sort: 'priority',
  }

  const { getCurrentKey } = window.utils
  const readLocalState = window.reviewState.read
  const updateLocalState = window.reviewState.update

  const VALID_DECISIONS = new Set([
    'Approved',
    'Approved with edits',
    'Revise and resubmit',
    'Blocked',
    'Needs review',
  ])

  const ACTION_LABELS = {
    'assign-me': 'Assign to me',
    'needs-review': 'Needs review',
    revise: 'Revise and resubmit',
    blocked: 'Blocked',
    approved: 'Approved',
    'approved-with-edits': 'Approved with edits',
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
    if (action === 'assign-me') {
      if (currentSaved.follow_up_owner === suggestedOwner) return null
      return { follow_up_owner: suggestedOwner, review_date: reviewDate }
    }

    const decision = ACTION_LABELS[action]
    if (!decision || !VALID_DECISIONS.has(decision)) return null

    if (currentSaved.decision === decision) return null

    return {
      decision,
      follow_up_owner: currentSaved.follow_up_owner || suggestedOwner,
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

  function updateLocalReviewForPage(pageKey, patch) {
    const page = DATA.pages[pageKey] || {}
    let nextSaved

    window.reviewState.update((localState) => {
      const existing = localState.pages[pageKey] || {}
      const defaults = window.utils.buildReviewRecord(page, pageKey, {
        review_date: getSidebarReviewDate(),
        reviewer: document.getElementById('reviewerInput')?.value || '',
      })
      nextSaved = {
        ...defaults,
        ...existing,
        ...patch,
        updated_at: new Date().toISOString(),
      }
      localState.pages[pageKey] = nextSaved
      return localState
    })

    return nextSaved
  }

  function syncSidebarForKey(pageKey, saved) {
    if (pageKey !== getCurrentKey()) return
    window.utils.setValue('reviewDecision', saved.decision || 'Needs review')
    window.utils.setValue('reviewOwner', saved.follow_up_owner || '')
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
