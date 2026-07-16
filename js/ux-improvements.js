/* Manager review UX/UI enhancements: orchestrator.
   Runs after js/app.js and does not change source page content or review
   export schemas. Composes window.ReviewUx.stateSync/.workspace/.exportImport
   (each in their own file, loaded before this one) into init()/refresh
   wiring. */
;(function improveManagerReviewUx() {
  const DATA = window.HHVC_DATA
  if (
    !hasValidPageData(DATA) ||
    !window.ReviewUx?.stateSync ||
    !window.ReviewUx?.workspace ||
    !window.ReviewUx?.exportImport
  )
    return

  const { debounce, getCurrentKey } = window.utils
  // Rebuilding the dashboard grid/scorecard and page-search list on every
  // keystroke is wasted work while the reviewer is still typing. Debounce the
  // 'input' path; 'change' (fires on blur) still refreshes immediately so the
  // dashboard is never stale once the reviewer moves on.
  const REFRESH_DEBOUNCE_MS = 300

  function refreshUx() {
    window.ReviewUx.workspace.renderStickyBar()
    window.ReviewUx.stateSync.renderPageChecksPanel()
    window.ReviewUx.stateSync.updateLocalStorageStatus()
    window.ReviewUx.workspace.updateDecisionQuickActions()
    document.dispatchEvent(new CustomEvent('hhvc:review-data-changed'))
  }

  function persistAndRefresh() {
    window.ReviewUx.stateSync.saveCurrentPageToLocalStorage()
    refreshUx()
  }

  function attachRefreshListeners() {
    const persistedFields = [
      'urlInput',
      'seoTitleInput',
      'metaDescriptionInput',
      'reviewDecision',
      'reviewerInput',
      'reviewDateInput',
      'reviewNotes',
      'reviewRisks',
      'reviewOwner',
    ]

    const debouncedPersistAndRefresh = debounce(persistAndRefresh, REFRESH_DEBOUNCE_MS)

    for (const id of persistedFields) {
      const el = document.getElementById(id)
      if (!el) continue
      el.addEventListener('input', debouncedPersistAndRefresh)
      el.addEventListener('change', persistAndRefresh)
    }

    document.getElementById('tagToggle')?.addEventListener('change', () => {
      window.reviewState.update((state) => {
        state.ui.show_karl_tags = document.getElementById('tagToggle')?.checked !== false
        state.ui.last_page_key = getCurrentKey()
        return state
      })
      refreshUx()
    })

    // Flush keystrokes still sitting in the debounce window when the tab is
    // reloaded, closed, or backgrounded — otherwise they never reach
    // localStorage ('change' only fires on blur).
    window.addEventListener('pagehide', window.ReviewUx.stateSync.saveCurrentPageToLocalStorage)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden')
        window.ReviewUx.stateSync.saveCurrentPageToLocalStorage()
    })
  }

  function wrapRenderPage() {
    if (typeof window.renderPage !== 'function' || window.renderPage.__uxWrapped) return
    const originalRenderPage = window.renderPage
    window.renderPage = function renderPageWithUxRefresh(key) {
      const result = originalRenderPage.call(this, key)
      window.reviewState.update((state) => {
        state.ui.last_page_key = key
        state.ui.show_karl_tags = document.getElementById('tagToggle')?.checked !== false
        return state
      })
      const applyAndRefresh = () => {
        window.ReviewUx.stateSync.applySavedPageState(key)
        refreshUx()
      }
      // Under View Transitions, renderPage returns a promise that resolves
      // once the new page content is in the DOM; patching earlier would hit
      // the outgoing page's elements.
      if (result && typeof result.then === 'function') result.then(applyAndRefresh)
      else window.setTimeout(applyAndRefresh, 0)
      return result
    }
    window.renderPage.__uxWrapped = true
  }

  function restoreInitialPage() {
    // An explicit ?page= URL param (a deep link, bookmark, or shared/review-
    // queue link) already drove js/app.js's initial render before this ran.
    // That takes priority over "reopen the page I was last viewing" — without
    // this guard, restoring last_page_key here silently overrides the
    // requested page moments after it renders (issue #68).
    const params = new URLSearchParams(window.location.search)
    if (params.has('page')) {
      window.ReviewUx.stateSync.applySavedPageState(getCurrentKey())
      refreshUx()
      return
    }

    const state = window.reviewState.read()
    const savedKey = state.ui.last_page_key

    if (savedKey && DATA.pages[savedKey] && typeof window.renderPage === 'function') {
      window.renderPage(savedKey)
      return
    }

    window.ReviewUx.stateSync.applySavedPageState(getCurrentKey())
    refreshUx()
  }

  function init() {
    window.ReviewUx.workspace.initWorkspaceTabs()
    window.ReviewUx.workspace.initDecisionQuickActions()
    window.ReviewUx.exportImport.mountCopySummaryButton()
    window.ReviewUx.exportImport.mountBackupControls()
    window.ReviewUx.exportImport.mountLocalStorageControls()
    attachRefreshListeners()
    wrapRenderPage()
    window.ReviewUx.stateSync.applySavedUiPreferences()
    restoreInitialPage()
    refreshUx()
    window.ReviewUx.workspace.maybeShowWorkspaceOnboarding()
    // Defer one refresh so review-queue.js (loaded next) is ready for sticky bar stats.
    window.setTimeout(refreshUx, 0)
  }

  window.ReviewUx.refreshUx = refreshUx

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
