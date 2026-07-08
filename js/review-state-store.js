/* Shared review-state localStorage store.
   Extracted from js/ux-improvements.js so js/ux-improvements-state-sync.js,
   js/ux-improvements-workspace.js, js/ux-improvements-export.js, and
   js/review-queue*.js (all load after this file) can read/write the same
   hhvcManagerReviewState:v1 blob via window.reviewState. */
;(function mountReviewStateStore() {
  const DATA = window.HHVC_DATA
  if (!hasValidPageData(DATA)) return

  const STORAGE_KEY = 'hhvcManagerReviewState:v1'
  const STORAGE_VERSION = 1

  function getEmptyState() {
    return {
      version: STORAGE_VERSION,
      updated_at: null,
      ui: {},
      globals: {},
      pages: {},
    }
  }

  function readLocalState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return getEmptyState()
      const parsed = JSON.parse(raw)
      const validator = window.reviewStateValidation?.validateReviewState
      if (typeof validator === 'function') {
        const result = validator(parsed)
        if (!result.ok) return getEmptyState()
        return {
          ...getEmptyState(),
          ...result.data,
          ui: result.data.ui || {},
          globals: result.data.globals || {},
          pages: result.data.pages || {},
        }
      }
      if (!parsed || parsed.version !== STORAGE_VERSION) return getEmptyState()

      return {
        ...getEmptyState(),
        ...parsed,
        ui: parsed.ui || {},
        globals: parsed.globals || {},
        pages: parsed.pages || {},
      }
    } catch {
      return getEmptyState()
    }
  }

  function writeLocalState(state) {
    const nextState = {
      ...getEmptyState(),
      ...state,
      version: STORAGE_VERSION,
      updated_at: new Date().toISOString(),
      ui: state.ui || {},
      globals: state.globals || {},
      pages: state.pages || {},
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState))
    } catch (err) {
      // Storage can throw (quota exceeded, private browsing, disabled storage).
      // Surface it to the reviewer instead of failing silently mid-review.
      console.error('Failed to save review state locally:', err)
      window.utils?.showErrorBanner?.(
        'Your last change was not saved locally. Local storage may be full or disabled in this browser.'
      )
    }
    return nextState
  }

  function updateLocalState(updater) {
    const state = readLocalState()
    const updated = updater(state) || state
    return writeLocalState(updated)
  }

  window.reviewState = {
    STORAGE_KEY,
    STORAGE_VERSION,
    read: readLocalState,
    write: writeLocalState,
    update: updateLocalState,
    getEmptyState,
  }
})()
