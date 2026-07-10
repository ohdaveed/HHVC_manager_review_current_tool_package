/* Manager review: sticky bar, workspace tabs, and decision quick actions.
   Loads after js/ux-improvements-state-sync.js. */
;(function mountUxImprovementsWorkspace() {
  const DATA = window.HHVC_DATA
  if (!hasValidPageData(DATA) || !window.reviewState || !window.ReviewUx?.stateSync) return

  const STICKY_BAR_ID = 'reviewStickyBar'
  const WORKSPACE_ID = 'reviewWorkspace'
  const WORKSPACE_TABS = ['overview', 'checks', 'sitemap', 'help']
  let workspaceTriggerButton = null

  const { getValue, getStatusChipClass, escapeHtml } = window.utils

  function renderStickyBar() {
    const bar = document.getElementById(STICKY_BAR_ID)
    if (!bar) return

    const page = window.ReviewUx.stateSync.getCurrentPage()
    const decision = getValue('reviewDecision') || 'Needs review'
    const chipClass = getStatusChipClass(decision)
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
    const currentKey = window.utils.getCurrentKey()

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

  /**
   * Selects a workspace tab and displays its associated panel.
   * @param {string} tabId - The workspace tab to select; invalid values select the overview tab.
   */
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
      if (isActive) panel.setAttribute('tabindex', '-1')
      else panel.removeAttribute('tabindex')
    })

    if (tabId === 'overview') {
      window.reviewQueue?.mountQueueOnTabOpen?.()
    }

    if (tabId === 'checks') {
      window.ReviewUx?.stateSync?.renderPageChecksPanel?.()
    }

    if (tabId === 'sitemap' && typeof window.__mountInteractiveSitemapOnTabOpen === 'function') {
      window.__mountInteractiveSitemapOnTabOpen()
    }

    if (tabId === 'help') {
      window.refreshDashboardGuidance?.()
    }

    window.reviewState.update((state) => {
      state.ui.workspace_tab = tabId
      return state
    })
  }

  function setWorkspaceOpen(isOpen) {
    const workspace = document.getElementById(WORKSPACE_ID)
    if (!workspace) return

    workspace.hidden = !isOpen

    const toggleButton = document.querySelector('[data-sticky-action="toggle-workspace"]')
    if (toggleButton) {
      toggleButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false')
      toggleButton.textContent = isOpen ? 'Hide workspace' : 'Show workspace'
    }

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
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      setTimeout(() => {
        workspace.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
          block: 'start',
        })
      }, 50)
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

    const workspace = document.getElementById(WORKSPACE_ID)
    if (workspace) workspace.hidden = false

    const toggleButton = document.querySelector('[data-sticky-action="toggle-workspace"]')
    if (toggleButton) {
      toggleButton.setAttribute('aria-expanded', 'true')
      toggleButton.textContent = 'Hide workspace'
    }

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

    updateDecisionQuickActions()
  }

  function applyDecisionToCurrentPage(decision) {
    const select = document.getElementById('reviewDecision')
    if (!select || !decision) return
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
  }

  window.reviewDecisions = { set: applyDecisionToCurrentPage }

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
    applyDecisionToCurrentPage,
  }
})()
