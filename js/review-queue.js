/* Review queue for HHVC manager review tool.
   Reads HHVC_DATA + local review state and renders progress, filters, and page list. */
;(function reviewQueueModule() {
  const DATA = window.HHVC_DATA
  if (!DATA || !DATA.pages || !DATA.order) return

  const STORAGE_KEY = 'hhvcManagerReviewState:v1'
  const STORAGE_VERSION = 1
  const QUEUE_PANEL_ID = 'reviewWorkspaceQueue'

  const FILTER_OPTIONS = [
    { id: 'all', label: 'All' },
    { id: 'needs-review', label: 'Needs review', decision: 'Needs review' },
    { id: 'approved', label: 'Approved', decision: 'Approved' },
    { id: 'approved-with-edits', label: 'Approved with edits', decision: 'Approved with edits' },
    { id: 'revise', label: 'Revise and resubmit', decision: 'Revise and resubmit' },
    { id: 'blocked', label: 'Blocked', decision: 'Blocked' },
  ]

  const { escapeHtml } = window.utils

  let activeFilter = 'all'

  function getEmptyState() {
    return { version: STORAGE_VERSION, updated_at: null, ui: {}, globals: {}, pages: {} }
  }

  function readLocalState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return getEmptyState()
      const parsed = JSON.parse(raw)
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

  function normalizeType(type, label) {
    const normalized = String(type || label || '')
      .trim()
      .toLowerCase()
    if (normalized.includes('topic')) return 'Topic'
    if (normalized.includes('transaction')) return 'Transaction'
    return 'Information'
  }

  function getStatusChipClass(decision) {
    if (decision === 'Approved' || decision === 'Approved with edits') return 'pass'
    if (decision === 'Blocked' || decision === 'Revise and resubmit') return 'fail'
    return 'warn'
  }

  function getQueueRows() {
    const state = readLocalState()
    return DATA.order.map(([key, label]) => {
      const page = DATA.pages[key] || {}
      const saved = state.pages[key]
      const decision = saved?.decision || 'Needs review'
      return {
        key,
        label,
        page,
        type: normalizeType(page.type, label),
        decision,
        saved: Boolean(saved),
        updated_at: saved?.updated_at || null,
      }
    })
  }

  function getQueueStats() {
    const rows = getQueueRows()
    const stats = {
      total: rows.length,
      reviewed: 0,
      'Needs review': 0,
      Approved: 0,
      'Approved with edits': 0,
      'Revise and resubmit': 0,
      Blocked: 0,
    }

    for (const row of rows) {
      stats[row.decision] = (stats[row.decision] || 0) + 1
      if (row.saved && row.decision !== 'Needs review') stats.reviewed += 1
    }

    return stats
  }

  function rowMatchesFilter(row) {
    if (activeFilter === 'all') return true
    const filter = FILTER_OPTIONS.find((option) => option.id === activeFilter)
    if (!filter) return true
    if (filter.id === 'needs-review') return row.decision === 'Needs review'
    return row.decision === filter.decision
  }

  function getFilteredRows() {
    return getQueueRows().filter(rowMatchesFilter)
  }

  function getNavigationKeys() {
    return getFilteredRows().map((row) => row.key)
  }

  function getCurrentKey() {
    return document.getElementById('pageSelect')?.value || 'pestsTopic'
  }

  function getNextNeedsReviewKey() {
    const rows = getQueueRows()
    const match = rows.find((row) => !row.saved || row.decision === 'Needs review')
    return match?.key || null
  }

  function getAdjacentKey(direction, useFilter = true) {
    const keys = useFilter ? getNavigationKeys() : DATA.order.map(([key]) => key)
    const current = getCurrentKey()
    const index = keys.indexOf(current)
    if (index === -1) return keys[0] || null
    const nextIndex = direction === 'prev' ? index - 1 : index + 1
    if (nextIndex < 0 || nextIndex >= keys.length) return null
    return keys[nextIndex]
  }

  function setActiveFilter(filterId) {
    activeFilter = filterId
    renderReviewQueue()
  }

  function getActiveFilter() {
    return activeFilter
  }

  function formatUpdatedAt(value) {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  function renderProgressBar(stats) {
    const percent = stats.total ? Math.round((stats.reviewed / stats.total) * 100) : 0
    return `
      <div class="review-queue-progress" aria-label="Review progress">
        <div class="review-queue-progress-label">
          <span>${stats.reviewed}/${stats.total} reviewed</span>
          <span>${percent}%</span>
        </div>
        <div class="review-queue-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="${stats.total}" aria-valuenow="${stats.reviewed}">
          <div class="review-queue-progress-fill" style="width:${percent}%"></div>
        </div>
      </div>
    `
  }

  function renderBreakdownChips(stats) {
    const chips = [
      { label: 'Approved', count: stats.Approved, className: 'pass' },
      { label: 'Approved with edits', count: stats['Approved with edits'], className: 'pass' },
      { label: 'Revise and resubmit', count: stats['Revise and resubmit'], className: 'fail' },
      { label: 'Blocked', count: stats.Blocked, className: 'fail' },
      { label: 'Needs review', count: stats['Needs review'], className: 'warn' },
    ]

    return `
      <div class="review-queue-breakdown" aria-label="Decision breakdown">
        ${chips
          .map(
            (chip) => `
          <span class="status-chip ${chip.className}">${escapeHtml(chip.label)}: ${chip.count}</span>
        `
          )
          .join('')}
      </div>
    `
  }

  function renderFilterRow() {
    return `
      <div class="review-queue-filters" role="group" aria-label="Filter review queue">
        ${FILTER_OPTIONS.map(
          (option) => `
          <button
            type="button"
            class="review-queue-filter ${activeFilter === option.id ? 'active' : ''}"
            data-queue-filter="${escapeHtml(option.id)}"
            aria-pressed="${activeFilter === option.id ? 'true' : 'false'}"
          >
            ${escapeHtml(option.label)}
          </button>
        `
        ).join('')}
      </div>
    `
  }

  function renderQueueList(rows) {
    if (!rows.length) {
      return '<p class="review-queue-empty">No pages match this filter.</p>'
    }

    return `
      <ul class="review-queue-list" aria-label="Review queue pages">
        ${rows
          .map((row) => {
            const isCurrent = row.key === getCurrentKey()
            const updatedLabel = formatUpdatedAt(row.updated_at)
            return `
              <li>
                <button
                  type="button"
                  class="review-queue-row ${isCurrent ? 'current' : ''}"
                  data-page-key="${escapeHtml(row.key)}"
                  ${isCurrent ? 'aria-current="page"' : ''}
                >
                  <span class="review-queue-row-main">
                    <span class="review-queue-row-title">${escapeHtml(row.page.title || row.label)}</span>
                    <span class="review-queue-row-meta">${escapeHtml(row.type)} · ${escapeHtml(row.key)}</span>
                  </span>
                  <span class="review-queue-row-status">
                    <span class="status-chip ${getStatusChipClass(row.decision)}">${escapeHtml(row.decision)}</span>
                    ${updatedLabel ? `<span class="review-queue-row-updated">${escapeHtml(updatedLabel)}</span>` : ''}
                  </span>
                </button>
              </li>
            `
          })
          .join('')}
      </ul>
    `
  }

  function renderReviewQueue() {
    const panel = document.getElementById(QUEUE_PANEL_ID)
    if (!panel) return

    const stats = getQueueStats()
    const rows = getFilteredRows()

    panel.innerHTML = `
      <div class="review-queue">
        <div class="review-queue-header">
          <div>
            <h3 class="review-queue-title">Review queue</h3>
            <p class="review-queue-note">Track progress across all ${stats.total} mockup pages. Click a row to open that page.</p>
          </div>
        </div>
        ${renderProgressBar(stats)}
        ${renderBreakdownChips(stats)}
        ${renderFilterRow()}
        ${renderQueueList(rows)}
      </div>
    `
  }

  function handleClick(event) {
    const filterButton = event.target.closest('[data-queue-filter]')
    if (filterButton) {
      setActiveFilter(filterButton.getAttribute('data-queue-filter') || 'all')
      document.dispatchEvent(new CustomEvent('hhvc:review-queue-filter-changed'))
      return
    }

    const rowButton = event.target.closest('.review-queue-row[data-page-key]')
    if (rowButton) {
      const key = rowButton.getAttribute('data-page-key')
      if (key) window.renderPage?.(key)
    }
  }

  function handleKeydown(event) {
    const rowButton = event.target.closest('.review-queue-row[data-page-key]')
    if (!rowButton || event.key !== 'Enter') return
    const key = rowButton.getAttribute('data-page-key')
    if (key) window.renderPage?.(key)
  }

  function init() {
    document.addEventListener('click', handleClick)
    document.addEventListener('keydown', handleKeydown)
    document.addEventListener('hhvc:review-data-changed', renderReviewQueue)
    renderReviewQueue()
    document.dispatchEvent(new CustomEvent('hhvc:review-queue-ready'))
  }

  window.reviewQueue = {
    getQueueRows,
    getQueueStats,
    getNextNeedsReviewKey,
    getAdjacentKey,
    getActiveFilter,
    setActiveFilter,
    renderReviewQueue,
    getNavigationKeys,
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
