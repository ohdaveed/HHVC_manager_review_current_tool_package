/* Manager review: sticky bar, workspace tabs, and decision quick actions.
   Loads after js/ux-improvements-state-sync.js. */

import { hasValidPageData } from './utils.js'
;(function mountUxImprovementsWorkspace() {
  const DATA = window.HHVC_DATA
  if (!hasValidPageData(DATA) || !window.reviewState || !window.ReviewUx?.stateSync) return

  const STICKY_BAR_ID = 'reviewStickyBar'
  const WORKSPACE_ID = 'reviewWorkspace'
  // Left-to-right tab order. Help stays LAST — it is the reference panel, not
  // a working one, and a reviewer scanning the strip expects it there.
  //
  // Six tabs became three. Sitemap was cut; AI assist and Status moved into
  // Help as collapsed sections (see the comment on #reviewWorkspaceAdvanced in
  // index.html). Because Help is last, and everything added lands before it,
  // Help's shortcut digit is the one that moves whenever the strip changes — so
  // keep this array, the tab markup in index.html and the 1-3 shortcut cases in
  // js/keyboard-shortcuts.js in step with each other.
  const WORKSPACE_TABS = ['overview', 'checks', 'help']
  const REVIEWER_REQUIRED_DECISIONS = new Set([
    'Approved',
    'Approved with edits',
    'Revise and resubmit',
    'Blocked',
  ])
  let workspaceTriggerButton = null

  const { getValue, getDecisionChipClass, escapeHtml } = window.utils

  /**
   * Paint the sticky review bar.
   *
   * @param {string} [pageKey] The page the bar should describe. Pass this
   *   whenever the caller already knows which page is loaded, because the
   *   fallback cannot be trusted during startup: `getCurrentKey()` reads
   *   `#pageSelect.value`, and under View Transitions the initial
   *   `applyPageContent()` runs inside the transition callback — so at
   *   `init()` time the picker can still be sitting on its first `<option>`,
   *   an arbitrary page. The bar was painted once from that stale value and
   *   never repainted until the reviewer navigated, so every load announced
   *   the wrong page beside a correct decision chip (the chip reads the
   *   sidebar, which `applySavedPageState()` had already filled in).
   *   js/ux-improvements.js tracks the authoritative key as
   *   `reviewFormPageKey` for exactly this class of bug; this parameter is
   *   how it reaches here.
   */
  function renderStickyBar(pageKey) {
    const bar = document.getElementById(STICKY_BAR_ID)
    if (!bar) return

    const page =
      (pageKey && DATA.pages[pageKey]) || window.ReviewUx.stateSync.getCurrentPage() || {}
    const decision = getValue('reviewDecision') || 'Needs review'
    const chipClass = getDecisionChipClass(decision)
    const stats = window.reviewQueue?.getQueueStats?.() || {
      reviewed: 0,
      total: DATA.order.length,
    }
    const filter = window.reviewQueue?.getFilter?.() || 'All'
    const filterLabel = filter !== 'All' ? filter : ''
    const prevKey = window.reviewQueue?.getAdjacentKey?.(-1, filter)
    const nextKey = window.reviewQueue?.getAdjacentKey?.(1, filter)
    const state = window.reviewState.read()
    const workspaceOpen = Boolean(state.ui.workspace_open)
    const prevNavLabel = filterLabel ? `Previous page (${filterLabel} filter)` : 'Previous page'
    const nextNavLabel = filterLabel ? `Next page (${filterLabel} filter)` : 'Next page'
    const currentKey = pageKey || window.utils.getCurrentKey()

    bar.innerHTML = `
      <div class="review-sticky-bar-main">
        <span class="status-chip ${chipClass}">${escapeHtml(decision)}</span>
        <p class="review-sticky-bar-title">${escapeHtml(page.title || currentKey)}</p>
        ${filterLabel ? `<span class="review-sticky-bar-filter">Filter: ${escapeHtml(filterLabel)}</span>` : ''}
      </div>
      <nav class="review-sticky-bar-actions">
        <span class="review-sticky-bar-progress">${stats.reviewed}/${stats.total} reviewed</span>
        <button type="button" class="review-sticky-btn" data-sticky-action="prev"${prevKey ? '' : ' disabled'} aria-label="${escapeHtml(prevNavLabel)}">Previous</button>
        <button type="button" class="review-sticky-btn" data-sticky-action="next"${nextKey ? '' : ' disabled'} aria-label="${escapeHtml(nextNavLabel)}">Next</button>
        <button type="button" class="review-sticky-btn primary" data-sticky-action="toggle-workspace" aria-expanded="${workspaceOpen ? 'true' : 'false'}">
          ${workspaceOpen ? 'Hide workspace' : 'Show workspace'}
        </button>
      </nav>
    `
  }

  function setWorkspaceTab(tabId) {
    if (!WORKSPACE_TABS.includes(tabId)) tabId = 'overview'

    const tabs = document.querySelectorAll('[data-workspace-tab]')
    const panels = document.querySelectorAll('[data-workspace-panel]')

    tabs.forEach((tab) => {
      const isSelected = tab.getAttribute('data-workspace-tab') === tabId
      tab.setAttribute('aria-selected', isSelected ? 'true' : 'false')
      // Roving tabindex: Tab lands on the active tab, arrows move between tabs.
      tab.tabIndex = isSelected ? 0 : -1
    })

    panels.forEach((panel) => {
      const isActive = panel.getAttribute('data-workspace-panel') === tabId
      panel.hidden = !isActive
      /* tabindex="0", not "-1". These panels scroll — the Checks panel runs
         well past a viewport on a page with many rules — and a scrollable
         region that is not in the tab order cannot be scrolled by a keyboard
         user at all: there is no way to put the caret inside it. That is
         WCAG 2.1 AA (axe's `scrollable-region-focusable`), and it went unseen
         because no accessibility scan opened this tab. "0" still allows the
         programmatic focus "-1" was chosen for, so the focus management on tab
         switch is unaffected; it only adds the stop a keyboard user needs. */
      if (isActive) panel.setAttribute('tabindex', '0')
      else panel.removeAttribute('tabindex')
    })

    if (tabId === 'overview') {
      window.reviewQueue?.mountQueueOnTabOpen?.()
    }

    if (tabId === 'checks') {
      window.ReviewUx?.stateSync?.renderPageChecksPanel?.()
    }

    if (tabId === 'help') {
      window.refreshDashboardGuidance?.()
      // Both of these used to be tabs of their own and mounted when their tab
      // opened. They now live inside Help as collapsed <details>, so Help's
      // opening is the event that has to mount them — a reviewer expanding one
      // must not find an empty box. Mounting both on Help open rather than on
      // each disclosure's toggle keeps the two panels' own init-time catch-up
      // (mountWorkspacePanelIfOpen) working unchanged.
      window.__mountAiAssistOnTabOpen?.()
      window.__mountReviewOpsOnTabOpen?.()
      window.__mountPageRegistryOnTabOpen?.()
    }

    window.reviewState.update((state) => {
      state.ui.workspace_tab = tabId
      return state
    })
  }

  /**
   * Put the DOM into the open or closed state, without touching saved state.
   *
   * Every caller that shows the workspace has to do all three of these, and the
   * onboarding path below used to do two of them inline — which is exactly how
   * it came to miss the third: `.workspace-docked` is what grows the `.app`
   * grid's third column, so a first-run reviewer got an open panel that the
   * grid had made no room for, and it wrapped underneath the sidebar instead of
   * docking. Sharing one function is what stops the next addition here from
   * being missed in the same place.
   * @param {boolean} isOpen
   * @returns {Element|null} the workspace element, or null if it is absent
   */
  function applyWorkspaceVisibility(isOpen) {
    const workspace = document.getElementById(WORKSPACE_ID)
    if (!workspace) return null

    workspace.hidden = !isOpen
    // The grid only carries a third column while the panel is open, so a closed
    // workspace gives its width back to the mockup rather than leaving a gap.
    // See the block comment on .review-workspace in css/dashboard.css.
    document.querySelector('.app')?.classList.toggle('workspace-docked', isOpen)

    const toggleButton = document.querySelector('[data-sticky-action="toggle-workspace"]')
    if (toggleButton) {
      toggleButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false')
      toggleButton.textContent = isOpen ? 'Hide workspace' : 'Show workspace'
    }

    return workspace
  }

  function setWorkspaceOpen(isOpen) {
    const workspace = applyWorkspaceVisibility(isOpen)
    if (!workspace) return

    window.reviewState.update((state) => {
      state.ui.workspace_open = isOpen
      if (isOpen && !state.ui.workspace_tab) state.ui.workspace_tab = 'overview'
      return state
    })

    if (isOpen) {
      const state = window.reviewState.read()
      setWorkspaceTab(state.ui.workspace_tab || 'overview')
      const selectedTab = document.querySelector('[data-workspace-tab][aria-selected="true"]')
      selectedTab?.focus()
      // No scrollIntoView any more. Opening the workspace used to scroll the
      // reviewer more than nine screens down to reach it, away from the page
      // they were reviewing. Docked, it is already beside them — and on the
      // narrow-screen fallback below 1400px, focusing the selected tab brings
      // it into view without commandeering the scroll position.
    } else if (workspaceTriggerButton && document.contains(workspaceTriggerButton)) {
      workspaceTriggerButton.focus()
    }
  }

  function toggleWorkspace() {
    const state = window.reviewState.read()
    setWorkspaceOpen(!state.ui.workspace_open)
  }

  function maybeShowWorkspaceOnboarding() {
    const state = window.reviewState.read()
    if (state.ui.workspace_onboarding_seen) return

    const hasExistingUsage =
      Object.keys(state.pages || {}).length > 0 || Boolean(state.ui.workspace_tab)

    if (hasExistingUsage) {
      window.reviewState.update((nextState) => {
        nextState.ui.workspace_onboarding_seen = true
        return nextState
      })
      return
    }

    window.reviewState.update((nextState) => {
      nextState.ui.workspace_onboarding_seen = true
      nextState.ui.workspace_open = true
      nextState.ui.workspace_tab = 'overview'
      return nextState
    })

    // Deliberately applyWorkspaceVisibility rather than setWorkspaceOpen: the
    // reviewState.update above has already recorded workspace_open, and
    // setWorkspaceOpen would also move focus to the selected tab, which on a
    // first run steals it from the page the reviewer just landed on.
    applyWorkspaceVisibility(true)

    setWorkspaceTab('overview')
    if (typeof window.showToast === 'function') {
      window.showToast(
        'Review workspace opened — use Overview for site-wide triage or Page checks for the open page.',
        'info'
      )
    }
  }

  window.reviewWorkspace = {
    setTab: setWorkspaceTab,
    setOpen: setWorkspaceOpen,
    toggle: toggleWorkspace,
    WORKSPACE_TABS,
  }

  function handleStickyBarClick(event) {
    const button = event.target.closest('[data-sticky-action]')
    if (!button || button.disabled) return

    const action = button.getAttribute('data-sticky-action')
    const filter = window.reviewQueue?.getFilter?.() || 'All'

    if (action === 'prev') {
      const key = window.reviewQueue?.getAdjacentKey?.(-1, filter)
      if (key) window.renderPage?.(key)
      return
    }

    if (action === 'next') {
      const key = window.reviewQueue?.getAdjacentKey?.(1, filter)
      if (key) window.renderPage?.(key)
      return
    }

    if (action === 'toggle-workspace') {
      workspaceTriggerButton = button
      toggleWorkspace()
    }
  }

  function initWorkspaceTabs() {
    const tablist = document.getElementById('reviewWorkspaceTabs')
    if (!tablist || tablist.dataset.bound === 'true') return
    tablist.dataset.bound = 'true'

    tablist.addEventListener('click', (event) => {
      const tab = event.target.closest('[data-workspace-tab]')
      if (!tab) return
      setWorkspaceTab(tab.getAttribute('data-workspace-tab') || 'overview')
    })

    tablist.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
      const tabs = Array.from(tablist.querySelectorAll('[data-workspace-tab]'))
      const currentIndex = tabs.indexOf(document.activeElement)
      if (currentIndex === -1) return

      event.preventDefault()
      let nextIndex = currentIndex
      if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
      if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length
      if (event.key === 'Home') nextIndex = 0
      if (event.key === 'End') nextIndex = tabs.length - 1

      const nextTab = tabs[nextIndex]
      nextTab.focus()
      setWorkspaceTab(nextTab.getAttribute('data-workspace-tab') || 'overview')
    })

    const stickyBar = document.getElementById(STICKY_BAR_ID)
    stickyBar?.addEventListener('click', handleStickyBarClick)

    const state = window.reviewState.read()
    setWorkspaceOpen(Boolean(state.ui.workspace_open))
    if (state.ui.workspace_open) {
      setWorkspaceTab(state.ui.workspace_tab || 'overview')
    }
  }

  function updateDecisionQuickActions() {
    const current = getValue('reviewDecision') || 'Needs review'
    document.querySelectorAll('#decisionQuickActions [data-decision]').forEach((button) => {
      const isActive = button.getAttribute('data-decision') === current
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false')
    })
  }

  function initDecisionQuickActions() {
    const group = document.getElementById('decisionQuickActions')
    if (!group || group.dataset.bound === 'true') return
    group.dataset.bound = 'true'

    group.addEventListener('click', (event) => {
      const button = event.target.closest('[data-decision]')
      if (!button) return
      applyDecisionToCurrentPage(button.getAttribute('data-decision'))
    })

    document.getElementById('reviewerInput')?.addEventListener('input', () => {
      clearReviewerDecisionError()
    })

    updateDecisionQuickActions()
  }

  function clearReviewerDecisionError() {
    const input = document.getElementById('reviewerInput')
    const error = document.getElementById('reviewerDecisionError')
    input?.removeAttribute('aria-invalid')
    if (error) {
      error.hidden = true
      error.textContent = ''
    }
  }

  function validateReviewerForDecision(decision) {
    if (!REVIEWER_REQUIRED_DECISIONS.has(decision)) {
      clearReviewerDecisionError()
      return true
    }

    const input = document.getElementById('reviewerInput')
    const error = document.getElementById('reviewerDecisionError')
    if (String(input?.value || '').trim()) {
      clearReviewerDecisionError()
      return true
    }

    input?.setAttribute('aria-invalid', 'true')
    if (error) {
      error.textContent = 'Enter your name or initials before recording this decision.'
      error.hidden = false
    }
    input?.focus()
    return false
  }

  function applyDecisionToCurrentPage(decision) {
    const select = document.getElementById('reviewDecision')
    if (!select || !decision) return
    if (!validateReviewerForDecision(decision)) return false
    if (select.value === decision) return

    select.value = decision
    // Reuse the existing persistence path bound to the select's change event.
    select.dispatchEvent(new Event('change', { bubbles: true }))
    if (typeof window.showToast === 'function') {
      const tone = decision === 'Blocked' || decision === 'Revise and resubmit' ? 'warn' : 'success'
      const nextKey = window.reviewQueue?.getNextNeedsReviewKey?.()
      let toastAction = null
      if (nextKey && typeof window.renderPage === 'function') {
        toastAction = {
          label: 'Next Actionable Page',
          callback: () => window.renderPage(nextKey),
        }
      }
      window.showToast(`Decision set: ${decision}`, tone, toastAction)
    }
    return true
  }

  window.reviewDecisions = {
    set: applyDecisionToCurrentPage,
    validateReviewerForDecision,
  }

  window.ReviewUx = window.ReviewUx || {}
  window.ReviewUx.workspace = {
    renderStickyBar,
    setWorkspaceTab,
    setWorkspaceOpen,
    toggleWorkspace,
    maybeShowWorkspaceOnboarding,
    handleStickyBarClick,
    initWorkspaceTabs,
    updateDecisionQuickActions,
    initDecisionQuickActions,
    clearReviewerDecisionError,
    validateReviewerForDecision,
    applyDecisionToCurrentPage,
  }
})()
