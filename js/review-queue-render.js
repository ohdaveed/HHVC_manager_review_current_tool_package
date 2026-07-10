/* Cross-page review queue: rendering. Loads after js/review-queue-rows.js. */
;(function mountReviewQueueRender() {
  const DATA = window.HHVC_DATA
  if (!DATA || !DATA.pages || !DATA.order || !window.ReviewQueueInternal?.rows) return

  const { escapeHtml, getStatusChipClass, getCurrentKey } = window.utils
  const state = window.ReviewQueueInternal.state
  const { QUEUE_PANEL_ID, STALE_DAYS, getSidebarReviewerName, normalize, restoreQueueUiState } =
    window.ReviewQueueInternal.helpers

  // The Overview table (~1,150 elements for 40 pages) is not built until the
  // workspace's Overview tab first opens; renders requested before then no-op.
  // Every render is a full rebuild from review state, so the first mounted
  // render is always current — no dirty tracking needed.
  let queueMounted = false
  const { getQueueStats, getVisibleRows, getSelectedKeys, pruneSelection } =
    window.ReviewQueueInternal.rows

  function formatAgeLabel(row) {
    if (row.ageDays === null) return 'Not reviewed yet'
    if (row.ageDays === 0) return 'Updated today'
    if (row.ageDays === 1) return 'Updated 1 day ago'
    return `Updated ${row.ageDays} days ago`
  }

  function renderQueueStats(stats, visibleCount) {
    return `
      <section class="review-queue-overview">
        <div class="review-queue-kpis" aria-label="Queue metrics">
          <div class="review-queue-kpi">
            <span class="review-queue-kpi-label">Visible</span>
            <strong class="review-queue-kpi-value">${visibleCount}</strong>
          </div>
          <div class="review-queue-kpi">
            <span class="review-queue-kpi-label">Blocked</span>
            <strong class="review-queue-kpi-value">${stats.blocked}</strong>
          </div>
          <div class="review-queue-kpi">
            <span class="review-queue-kpi-label">Unassigned</span>
            <strong class="review-queue-kpi-value">${stats.unassigned}</strong>
          </div>
          <div class="review-queue-kpi">
            <span class="review-queue-kpi-label">Stale ${STALE_DAYS}+d</span>
            <strong class="review-queue-kpi-value">${stats.stale}</strong>
          </div>
        </div>
      </section>
    `
  }

  function renderBulkBar(selectedCount, visibleCount) {
    const allVisibleSelected = visibleCount > 0 && selectedCount === visibleCount
    return `
      <section class="review-queue-bulk" aria-label="Bulk queue actions">
        <div class="review-queue-bulk-main">
          <label class="review-queue-select-all">
            <input
              type="checkbox"
              id="reviewQueueSelectAll"
              ${allVisibleSelected ? 'checked' : ''}
              ${visibleCount ? '' : 'disabled'}
            />
            <span>Select all visible</span>
          </label>
          <span class="review-queue-bulk-count">${selectedCount} selected</span>
          <button type="button" class="review-queue-action" data-queue-select="clear"${selectedCount ? '' : ' disabled'}>Clear</button>
        </div>
        <div class="review-queue-bulk-actions" role="group" aria-label="Apply to selected pages">
          <button type="button" class="review-queue-action" data-queue-bulk-action="assign-me"${selectedCount ? '' : ' disabled'}>Assign to me</button>
          <button type="button" class="review-queue-action" data-queue-bulk-action="needs-review"${selectedCount ? '' : ' disabled'}>Needs review</button>
          <button type="button" class="review-queue-action" data-queue-bulk-action="revise"${selectedCount ? '' : ' disabled'}>Revise</button>
          <button type="button" class="review-queue-action" data-queue-bulk-action="blocked"${selectedCount ? '' : ' disabled'}>Blocked</button>
          <button type="button" class="review-queue-action" data-queue-bulk-action="approved"${selectedCount ? '' : ' disabled'}>Approve</button>
          <button type="button" class="review-queue-action" data-queue-bulk-action="approved-with-edits"${selectedCount ? '' : ' disabled'}>Approve w/ edits</button>
        </div>
        <div class="review-queue-import">
          <button type="button" class="review-queue-action" data-queue-import="csv">Import CSV</button>
        </div>
      </section>
    `
  }

  function captureSearchFocus() {
    const active = document.activeElement
    if (!active || !active.closest('#' + QUEUE_PANEL_ID)) return null
    const selector = active.id
      ? `#${active.id}`
      : active.getAttribute('data-queue-filter')
        ? `[data-queue-filter="${active.getAttribute('data-queue-filter')}"]`
        : active.getAttribute('data-queue-bulk-action')
          ? `[data-queue-bulk-action="${active.getAttribute('data-queue-bulk-action')}"]`
          : active.getAttribute('data-queue-action')
            ? `[data-queue-action="${active.getAttribute('data-queue-action')}"]`
            : active.getAttribute('data-queue-select-key')
              ? `[data-queue-select-key="${active.getAttribute('data-queue-select-key')}"]`
              : null
    if (!selector) return null
    return {
      selector,
      selectionStart: active.selectionStart,
      selectionEnd: active.selectionEnd,
    }
  }

  function restoreSearchFocus(snapshot) {
    if (!snapshot) return
    const target = document.querySelector(snapshot.selector)
    if (!target) return
    target.focus()
    try {
      if (typeof target.setSelectionRange === 'function')
        target.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd)
    } catch {
      // Some browsers disallow setSelectionRange on search inputs; focus alone is fine.
    }
  }

  function syncSelectionUi() {
    const selectedCount = getSelectedKeys().length
    const visibleRows = getVisibleRows()
    const visibleKeys = visibleRows.map((row) => row.key)
    const allVisibleSelected =
      visibleKeys.length > 0 && visibleKeys.every((key) => state.selected.has(key))

    const selectAllCheckbox = document.getElementById('reviewQueueSelectAll')
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = allVisibleSelected
      if (visibleKeys.length > 0) {
        selectAllCheckbox.removeAttribute('disabled')
      } else {
        selectAllCheckbox.setAttribute('disabled', '')
      }
    }

    const bulkCountSpan = document.querySelector('.review-queue-bulk-count')
    if (bulkCountSpan) {
      bulkCountSpan.textContent = `${selectedCount} selected`
    }

    const buttons = document.querySelectorAll(
      '[data-queue-select="clear"], [data-queue-bulk-action]'
    )
    buttons.forEach((btn) => {
      if (selectedCount === 0) {
        btn.setAttribute('disabled', '')
      } else {
        btn.removeAttribute('disabled')
      }
    })

    const rows = document.querySelectorAll('.review-queue-table-row[data-page-key]')
    rows.forEach((row) => {
      const key = row.getAttribute('data-page-key')
      const isSelected = state.selected.has(key)
      row.classList.toggle('is-selected', isSelected)

      const checkbox = row.querySelector('[data-queue-select-key]')
      if (checkbox) {
        checkbox.checked = isSelected
      }
    })
  }

  function mountReviewQueueOnTabOpen() {
    if (queueMounted) return
    queueMounted = true
    // The workspace can open (persisted workspace_open / onboarding) before
    // review-queue.js's init() has restored filter/sort/query; restoring here
    // is idempotent and keeps the first paint consistent with saved UI state.
    restoreQueueUiState()
    renderReviewQueue()
  }

  function renderReviewQueue() {
    if (!queueMounted) return
    const panel = document.getElementById(QUEUE_PANEL_ID)
    if (!panel) return

    const searchFocus = captureSearchFocus()
    const stats = getQueueStats()
    const rows = getVisibleRows()
    const visibleKeys = rows.map((row) => row.key)
    pruneSelection(visibleKeys)
    const selectedCount = getSelectedKeys().length
    const currentKey = getCurrentKey()
    const progressPct = stats.total ? Math.round((stats.reviewed / stats.total) * 100) : 0

    const filterButtons = [
      { id: 'All', label: `All (${stats.total})` },
      { id: 'Needs review', label: `Needs review (${stats.byDecision['Needs review'] || 0})` },
      {
        id: 'Approved',
        label: `Approved (${(stats.byDecision.Approved || 0) + (stats.byDecision['Approved with edits'] || 0)})`,
      },
      { id: 'Blocked', label: `Blocked (${stats.blocked})` },
      { id: 'Unassigned', label: `Unassigned (${stats.unassigned})` },
      { id: 'Stale', label: `Stale (${stats.stale})` },
      { id: 'Failing checks', label: `Failing checks (${stats.failingChecks})` },
    ]

    panel.innerHTML = `
      <section class="review-queue">
        <header class="review-queue-header">
          <div>
            <h3>Overview</h3>
            <p class="review-queue-subtitle">Triage every page by decision, checks, ownership, and staleness. Use <strong>Open</strong> to switch pages (rows no longer navigate on click). Press <kbd>1</kbd> for this tab or <kbd>?</kbd> for all shortcuts.</p>
          </div>
          <div class="review-queue-progress" aria-label="Review progress">
            <div class="review-queue-progress-bar">
              <span class="review-queue-progress-fill" style="width: ${progressPct}%"></span>
            </div>
            <span class="review-queue-progress-label">${stats.reviewed}/${stats.total} reviewed</span>
          </div>
        </header>
        <div class="review-queue-stats" aria-label="Decision breakdown">
          <span class="status-chip warn">Needs review ${stats.byDecision['Needs review'] || 0}</span>
          <span class="status-chip pass">Approved ${stats.byDecision.Approved || 0}</span>
          <span class="status-chip warn">Edits ${stats.byDecision['Approved with edits'] || 0}</span>
          <span class="status-chip fail">Revise ${stats.byDecision['Revise and resubmit'] || 0}</span>
          <span class="status-chip fail">Blocked ${stats.byDecision.Blocked || 0}</span>
          <button type="button" class="review-queue-action" data-queue-next-needs-review="true">Next needs review</button>
        </div>
        ${renderQueueStats(stats, rows.length)}
        <div class="review-queue-toolbar" aria-label="Queue controls">
          <label class="review-queue-search">
            <span class="review-queue-control-label">Search queue</span>
            <input
              id="reviewQueueSearch"
              type="search"
              placeholder="Search title, type, owner, notes, blockers, or page key"
              value="${escapeHtml(state.query)}"
            />
          </label>
          <label class="review-queue-sort">
            <span class="review-queue-control-label">Sort by</span>
            <select id="reviewQueueSort">
              <option value="priority"${state.sort === 'priority' ? ' selected' : ''}>Risk priority</option>
              <option value="checks"${state.sort === 'checks' ? ' selected' : ''}>Checks (failing first)</option>
              <option value="updated"${state.sort === 'updated' ? ' selected' : ''}>Last updated</option>
              <option value="title"${state.sort === 'title' ? ' selected' : ''}>Title</option>
              <option value="type"${state.sort === 'type' ? ' selected' : ''}>Page type</option>
            </select>
          </label>
        </div>
        <div class="review-queue-filters" role="group" aria-label="Filter review queue">
          ${filterButtons
            .map(
              (button) => `
            <button
              type="button"
              class="review-queue-filter"
              data-queue-filter="${escapeHtml(button.id)}"
              aria-pressed="${state.filter === button.id ? 'true' : 'false'}"
            >${escapeHtml(button.label)}</button>
          `
            )
            .join('')}
        </div>
        ${renderBulkBar(selectedCount, rows.length)}
        ${
          rows.length
            ? `
          <div class="review-queue-table-wrap">
            <table class="review-queue-table" aria-label="Pages in review overview">
              <thead>
                <tr>
                  <th scope="col"></th>
                  <th scope="col">Page</th>
                  <th scope="col">Checks</th>
                  <th scope="col">Decision</th>
                  <th scope="col">Owner</th>
                  <th scope="col">Updated</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${rows
                  .map((row) => {
                    const chipClass = getStatusChipClass(row.decision)
                    const ownerLabel = row.followUpOwner || 'No owner'
                    const notesLabel = row.notes ? 'Notes saved' : 'No notes'
                    const ageChipClass = row.isStale
                      ? 'fail'
                      : row.ageDays === null
                        ? 'warn'
                        : 'pass'
                    const checksChipClass = row.checksPassed === row.checksTotal ? 'pass' : 'warn'
                    const checksLabel = row.isCurrentPage
                      ? `${row.checksPassed}/${row.checksTotal} live`
                      : `${row.checksPassed}/${row.checksTotal}`
                    const suggestedOwner = getSidebarReviewerName()
                    const isOwnerAssigned =
                      normalize(row.followUpOwner) === normalize(suggestedOwner) &&
                      !!row.followUpOwner
                    const isSelected = state.selected.has(row.key)

                    return `
                  <tr
                    class="review-queue-table-row${row.key === currentKey ? ' is-current' : ''}${isSelected ? ' is-selected' : ''}"
                    data-page-key="${escapeHtml(row.key)}"
                  >
                    <td class="review-queue-table-select">
                      <label class="review-queue-checkbox" aria-label="Select ${escapeHtml(row.title)}">
                        <input
                          type="checkbox"
                          data-queue-select-key="${escapeHtml(row.key)}"
                          ${isSelected ? 'checked' : ''}
                        />
                      </label>
                    </td>
                    <td class="review-queue-table-page">
                      <span class="review-queue-row-title">${escapeHtml(row.title)}</span>
                      <span class="review-queue-row-meta">${escapeHtml(row.type || 'Page')} · ${escapeHtml(row.key)}</span>
                      <span class="review-queue-row-detail">
                        <span>${escapeHtml(row.reviewer || 'No reviewer')}</span>
                      </span>
                      <span class="review-queue-row-tags">
                        ${row.notes ? `<span class="status-chip">${escapeHtml(notesLabel)}</span>` : ''}
                        ${row.blockers ? '<span class="status-chip fail">Blockers logged</span>' : ''}
                      </span>
                    </td>
                    <td class="review-queue-table-checks">
                      <span class="status-chip ${checksChipClass}">${escapeHtml(checksLabel)}</span>
                    </td>
                    <td class="review-queue-table-decision">
                      <span class="status-chip ${chipClass}">${escapeHtml(row.decision)}</span>
                      ${row.followUpOwner ? '' : '<span class="status-chip warn">Needs owner</span>'}
                    </td>
                    <td class="review-queue-table-owner">${escapeHtml(ownerLabel)}</td>
                    <td class="review-queue-table-updated">
                      <span class="status-chip ${ageChipClass}">${escapeHtml(formatAgeLabel(row))}</span>
                    </td>
                    <td class="review-queue-table-actions">
                      <span class="review-queue-actions" aria-label="Queue actions">
                        <button type="button" class="review-queue-action" data-queue-action="assign-me"${isOwnerAssigned ? ' disabled' : ''}>Assign to me</button>
                        <button type="button" class="review-queue-action" data-queue-action="needs-review"${row.decision === 'Needs review' ? ' disabled' : ''}>Needs review</button>
                        <button type="button" class="review-queue-action" data-queue-action="revise"${row.decision === 'Revise and resubmit' ? ' disabled' : ''}>Revise</button>
                        <button type="button" class="review-queue-action" data-queue-action="blocked"${row.decision === 'Blocked' ? ' disabled' : ''}>Blocked</button>
                        <button type="button" class="review-queue-action" data-queue-action="approved"${row.decision === 'Approved' ? ' disabled' : ''}>Approve</button>
                        <button type="button" class="review-queue-action" data-queue-action="approved-with-edits"${row.decision === 'Approved with edits' ? ' disabled' : ''}>Approve w/ edits</button>
                        <button type="button" class="review-queue-action" data-queue-action="open">Open</button>
                      </span>
                    </td>
                  </tr>
                `
                  })
                  .join('')}
              </tbody>
            </table>
          </div>
        `
            : `
          <aside class="review-queue-empty">
            <p>No pages match the current filter and search.</p>
            <button type="button" class="review-queue-filter" data-queue-reset="true">Clear queue filters</button>
          </aside>
        `
        }
      </section>
    `

    restoreSearchFocus(searchFocus)
  }

  window.ReviewQueueInternal.render = {
    formatAgeLabel,
    renderQueueStats,
    renderBulkBar,
    captureSearchFocus,
    restoreSearchFocus,
    syncSelectionUi,
    renderReviewQueue,
    mountReviewQueueOnTabOpen,
  }
})()
