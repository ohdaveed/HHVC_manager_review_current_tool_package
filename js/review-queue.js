/* Cross-page review queue for manager approval workflow: orchestrator.
   Reads HHVC_DATA and hhvcManagerReviewState:v1; does not mutate page source
   data. Composes window.ReviewQueueInternal.state/.helpers/.rows/.render/.importCsv
   (each in their own file, loaded before this one) into event wiring, init(),
   and the public window.reviewQueue API. */
;(function mountReviewQueue() {
  const DATA = window.HHVC_DATA
  if (
    !DATA ||
    !DATA.pages ||
    !DATA.order ||
    !window.reviewState ||
    !window.ReviewQueueInternal?.rows ||
    !window.ReviewQueueInternal?.render ||
    !window.ReviewQueueInternal?.importCsv
  )
    return

  const state = window.ReviewQueueInternal.state
  const { DEFAULT_STATE, writeQueueUiState, restoreQueueUiState, toast, QUEUE_PANEL_ID } =
    window.ReviewQueueInternal.helpers
  const {
    getSelectedKeys,
    clearSelection,
    selectAllVisible,
    applyQueueAction,
    getNextNeedsReviewKey,
    getAdjacentKey,
    toggleSelected,
    getActionTargets,
    getQueueRows,
    getQueueStats,
  } = window.ReviewQueueInternal.rows
  const { renderReviewQueue, syncSelectionUi, mountReviewQueueOnTabOpen } =
    window.ReviewQueueInternal.render
  const { importReviewsFromCsvText, importReviewsFromCsvFile } =
    window.ReviewQueueInternal.importCsv

  function handleQueueClick(event) {
    const filterButton = event.target.closest('[data-queue-filter]')
    if (filterButton) {
      state.filter = filterButton.getAttribute('data-queue-filter') || 'All'
      writeQueueUiState()
      renderReviewQueue()
      return
    }

    const resetButton = event.target.closest('[data-queue-reset]')
    if (resetButton) {
      Object.assign(state, { ...DEFAULT_STATE })
      writeQueueUiState()
      renderReviewQueue()
      return
    }

    // Selection checkboxes update on `change` so label clicks do not double-toggle.
    if (
      event.target.closest('#reviewQueueSelectAll, [data-queue-select-key], .review-queue-checkbox')
    ) {
      return
    }

    const selectControl = event.target.closest('[data-queue-select]')
    if (selectControl) {
      if (selectControl.getAttribute('data-queue-select') === 'clear') {
        clearSelection()
        syncSelectionUi()
      }
      return
    }

    const importButton = event.target.closest('[data-queue-import="csv"]')
    if (importButton) {
      document.getElementById('reviewQueueCsvInput')?.click()
      return
    }

    const bulkActionButton = event.target.closest('[data-queue-bulk-action]')
    if (bulkActionButton) {
      const action = bulkActionButton.getAttribute('data-queue-bulk-action')
      const keys = getSelectedKeys()
      if (!action || !keys.length) return
      applyQueueAction(keys, action)
      return
    }

    const actionButton = event.target.closest('[data-queue-action]')
    if (actionButton) {
      const row = actionButton.closest('[data-page-key]')
      if (!row) return
      const key = row.getAttribute('data-page-key')
      const action = actionButton.getAttribute('data-queue-action')
      if (!key || !action) return
      if (action === 'open') {
        window.renderPage?.(key)
        return
      }
      applyQueueAction([key], action)
      return
    }

    const nextNeedsReviewButton = event.target.closest('[data-queue-next-needs-review]')
    if (nextNeedsReviewButton) {
      const key = getNextNeedsReviewKey()
      if (key) window.renderPage?.(key)
      else toast('No pages left that need review', 'success')
      return
    }

    if (event.target.closest('.review-queue-checkbox')) return
    if (event.target.closest('.review-queue-table-row')) return
  }

  function handleQueueInput(event) {
    if (event.target.id === 'reviewQueueSearch') {
      state.query = event.target.value || ''
      writeQueueUiState()
      renderReviewQueue()
      return
    }

    if (event.target.id === 'reviewQueueSort') {
      state.sort = event.target.value || 'priority'
      writeQueueUiState()
      renderReviewQueue()
    }
  }

  function handleQueueChange(event) {
    if (event.target.id === 'reviewQueueSelectAll') {
      if (event.target.checked) selectAllVisible()
      else clearSelection()
      syncSelectionUi()
      return
    }

    if (event.target.matches('[data-queue-select-key]')) {
      const key = event.target.getAttribute('data-queue-select-key')
      if (!key) return
      if (event.target.checked) state.selected.add(key)
      else state.selected.delete(key)
      syncSelectionUi()
      return
    }

    handleQueueInput(event)
  }

  function focusQueueSearch() {
    const workspace = document.getElementById('reviewWorkspace')
    if (workspace?.hidden) {
      document.querySelector('[data-sticky-action="toggle-workspace"]')?.click()
    }
    const overviewTab = document.querySelector('[data-workspace-tab="overview"]')
    if (overviewTab?.getAttribute('aria-selected') !== 'true') overviewTab?.click()
    const input = document.getElementById('reviewQueueSearch')
    if (!input) return
    input.focus()
    if (typeof input.select === 'function') input.select()
  }

  function init() {
    const panel = document.getElementById(QUEUE_PANEL_ID)
    if (!panel) return

    restoreQueueUiState()

    let fileInput = document.getElementById('reviewQueueCsvInput')
    if (!fileInput) {
      fileInput = document.createElement('input')
      fileInput.id = 'reviewQueueCsvInput'
      fileInput.type = 'file'
      fileInput.accept = '.csv,text/csv'
      fileInput.hidden = true
      document.body.appendChild(fileInput)
    }

    fileInput.addEventListener('change', (event) => {
      const file = event.target.files?.[0]
      if (file) importReviewsFromCsvFile(file)
      event.target.value = ''
    })

    panel.addEventListener('click', handleQueueClick)
    panel.addEventListener('input', handleQueueInput)
    panel.addEventListener('change', handleQueueChange)
    document.addEventListener('hhvc:review-data-changed', renderReviewQueue)
    // The table mounts lazily on first Overview tab open (setWorkspaceTab in
    // js/ux-improvements-workspace.js). If the workspace was already opened on
    // Overview before this init ran, mount now.
    const workspace = document.getElementById('reviewWorkspace')
    if (workspace && !workspace.hidden && !panel.hidden) {
      mountReviewQueueOnTabOpen()
    }
  }

  window.reviewQueue = {
    getQueueRows,
    getQueueStats,
    getNextNeedsReviewKey,
    getAdjacentKey,
    getFilter: () => state.filter,
    getSelectedKeys,
    selectAllVisible,
    clearSelection,
    toggleSelected,
    syncSelectionUi,
    applyQueueAction,
    getActionTargets,
    focusQueueSearch,
    importReviewsFromCsvText,
    renderReviewQueue,
    mountQueueOnTabOpen: mountReviewQueueOnTabOpen,
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
