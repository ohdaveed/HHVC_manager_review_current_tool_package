/* Cross-page review queue for manager approval workflow.
   Reads HHVC_DATA and hhvcManagerReviewState:v1 via window.reviewState
   (exposed by js/ux-improvements.js, which must load first); does not
   mutate page source data. */
;(function mountReviewQueue() {
  const DATA = window.HHVC_DATA
  if (!DATA || !DATA.pages || !DATA.order) return

  const QUEUE_PANEL_ID = 'reviewWorkspaceQueue'
  const STALE_DAYS = 3
  const DEFAULT_STATE = {
    filter: 'All',
    query: '',
    sort: 'priority',
  }

  const { escapeHtml, getPrimaryCta, today, getStatusChipClass, setValue, buildReviewRecord } =
    window.utils

  const state = { ...DEFAULT_STATE }

  function getSidebarReviewerName() {
    const v = document.getElementById('reviewerInput')?.value
    const trimmed = String(v || '').trim()
    return trimmed || 'Me'
  }

  function getSidebarReviewDate() {
    const v = document.getElementById('reviewDateInput')?.value
    const trimmed = String(v || '').trim()
    return trimmed || today()
  }

  function updateLocalReviewForPage(pageKey, patch) {
    const page = DATA.pages[pageKey] || {}
    let nextSaved

    window.reviewState.update((localState) => {
      const existing = localState.pages[pageKey] || {}
      const defaults = buildReviewRecord(page, pageKey, {
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
    setValue('reviewDecision', saved.decision || 'Needs review')
    setValue('reviewOwner', saved.follow_up_owner || '')
    setValue('reviewNotes', saved.notes || '')
    setValue('reviewRisks', saved.risks_or_blockers || '')
    setValue('reviewDateInput', saved.review_date || getSidebarReviewDate())
    // reviewerInput is editable; keep it if the user already typed something different.
    if (!String(document.getElementById('reviewerInput')?.value || '').trim())
      setValue('reviewerInput', saved.reviewer || '')
  }

  function dispatchReviewFieldChange(id) {
    const el = document.getElementById(id)
    if (!el) return
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }

  function writeQueueUiState() {
    window.reviewState.update((localState) => {
      localState.ui.review_queue = {
        filter: state.filter,
        query: state.query,
        sort: state.sort,
      }
      return localState
    })
  }

  function restoreQueueUiState() {
    const queueUi = window.reviewState.read().ui?.review_queue || {}
    state.filter = queueUi.filter || DEFAULT_STATE.filter
    state.query = queueUi.query || DEFAULT_STATE.query
    state.sort = queueUi.sort || DEFAULT_STATE.sort
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

  function getCurrentKey() {
    return document.getElementById('pageSelect')?.value || 'pestsTopic'
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

  function getPriorityRank(row) {
    if (row.decision === 'Blocked') return 5
    if (row.decision === 'Revise and resubmit') return 4
    if (row.decision === 'Needs review' && isUnassigned(row)) return 3
    if (row.isStale) return 2
    if (row.decision === 'Needs review') return 1
    return 0
  }

  function isUnassigned(row) {
    return (
      row.decision !== 'Approved' &&
      row.decision !== 'Approved with edits' &&
      !normalize(row.followUpOwner)
    )
  }

  function getQueueRows() {
    const savedPages = window.reviewState.read().pages
    return DATA.order.map(([key]) => {
      const page = DATA.pages[key] || {}
      const saved = savedPages[key]
      const decision = getDecisionForKey(key, savedPages)
      const updatedAt = saved?.updated_at || null
      const ageDays = getAgeInDays(updatedAt)
      const notes = saved?.notes || ''
      const blockers = saved?.risks_or_blockers || ''
      const followUpOwner = saved?.follow_up_owner || ''
      const reviewer = saved?.reviewer || ''
      const searchText = normalize(
        [
          key,
          page.title || '',
          page.type || '',
          page.summary || '',
          decision,
          followUpOwner,
          reviewer,
          notes,
          blockers,
        ].join(' ')
      )

      return {
        key,
        title: page.title || key,
        type: page.type || '',
        summary: page.summary || '',
        decision,
        updatedAt,
        reviewDate: saved?.review_date || '',
        followUpOwner,
        reviewer,
        notes,
        blockers,
        ageDays,
        isStale: ageDays !== null && ageDays >= STALE_DAYS,
        searchText,
      }
    })
  }

  function getQueueStats() {
    const rows = getQueueRows()
    const total = rows.length
    const byDecision = {
      'Needs review': 0,
      Approved: 0,
      'Approved with edits': 0,
      'Revise and resubmit': 0,
      Blocked: 0,
    }

    for (const row of rows) {
      byDecision[row.decision] = (byDecision[row.decision] || 0) + 1
    }

    const reviewed = rows.filter((row) => row.decision !== 'Needs review').length
    const stale = rows.filter((row) => row.isStale).length
    const unassigned = rows.filter(isUnassigned).length
    const blocked = rows.filter(
      (row) => row.decision === 'Blocked' || row.decision === 'Revise and resubmit'
    ).length

    return { total, reviewed, stale, unassigned, blocked, byDecision }
  }

  function matchesFilter(row) {
    if (state.filter === 'All') return true
    if (state.filter === 'Needs review') return row.decision === 'Needs review'
    if (state.filter === 'Approved') {
      return row.decision === 'Approved' || row.decision === 'Approved with edits'
    }
    if (state.filter === 'Blocked') {
      return row.decision === 'Blocked' || row.decision === 'Revise and resubmit'
    }
    if (state.filter === 'Unassigned') {
      return isUnassigned(row)
    }
    if (state.filter === 'Stale') return row.isStale
    return true
  }

  function matchesQuery(row) {
    const query = normalize(state.query)
    if (!query) return true
    return row.searchText.includes(query)
  }

  function compareRows(a, b) {
    if (state.sort === 'updated') {
      const left = parseIsoDate(a.updatedAt)?.getTime() || 0
      const right = parseIsoDate(b.updatedAt)?.getTime() || 0
      return right - left || a.title.localeCompare(b.title)
    }

    if (state.sort === 'title') {
      return a.title.localeCompare(b.title)
    }

    if (state.sort === 'type') {
      return a.type.localeCompare(b.type) || a.title.localeCompare(b.title)
    }

    const priorityDiff = getPriorityRank(b) - getPriorityRank(a)
    if (priorityDiff !== 0) return priorityDiff

    const ageDiff = (b.ageDays || -1) - (a.ageDays || -1)
    if (ageDiff !== 0) return ageDiff

    return a.title.localeCompare(b.title)
  }

  function getVisibleRows() {
    return getQueueRows().filter(matchesFilter).filter(matchesQuery).sort(compareRows)
  }

  function getFilteredKeys() {
    return getVisibleRows().map((row) => row.key)
  }

  function getNextNeedsReviewKey() {
    const rows = getQueueRows().sort(compareRows)
    const currentIndex = rows.findIndex((row) => row.key === getCurrentKey())
    const afterCurrent = rows.slice(currentIndex + 1).find((row) => row.decision === 'Needs review')
    if (afterCurrent) return afterCurrent.key
    return rows.find((row) => row.decision === 'Needs review')?.key || null
  }

  function getAdjacentKey(direction, filter) {
    const originalFilter = state.filter
    const keys =
      filter && filter !== 'All'
        ? (() => {
            state.filter = filter
            const nextKeys = getFilteredKeys()
            state.filter = originalFilter
            return nextKeys
          })()
        : getFilteredKeys()
    const currentKey = getCurrentKey()
    const index = keys.indexOf(currentKey)

    if (index === -1) {
      return direction > 0 ? keys[0] : keys[keys.length - 1]
    }

    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= keys.length) return null
    return keys[nextIndex]
  }

  function formatUpdatedAt(value) {
    if (!value) return 'Not saved yet'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Not saved yet'
    return `Updated ${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
  }

  function formatAgeLabel(row) {
    if (row.ageDays === null) return 'Not reviewed yet'
    if (row.ageDays === 0) return 'Updated today'
    if (row.ageDays === 1) return 'Updated 1 day ago'
    return `Updated ${row.ageDays} days ago`
  }

  function renderQueueStats(stats, visibleCount) {
    return `
      <div class="review-queue-overview">
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
      </div>
    `
  }

  function captureSearchFocus() {
    const active = document.activeElement
    if (!active || active.id !== 'reviewQueueSearch') return null
    return {
      selectionStart: active.selectionStart,
      selectionEnd: active.selectionEnd,
    }
  }

  function restoreSearchFocus(snapshot) {
    if (!snapshot) return
    const input = document.getElementById('reviewQueueSearch')
    if (!input) return
    input.focus()
    try {
      input.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd)
    } catch {
      // Some browsers disallow setSelectionRange on search inputs; focus alone is fine.
    }
  }

  function renderReviewQueue() {
    const panel = document.getElementById(QUEUE_PANEL_ID)
    if (!panel) return

    // Re-rendering replaces the search input; without this, every keystroke
    // would drop focus and interrupt typing.
    const searchFocus = captureSearchFocus()

    const stats = getQueueStats()
    const rows = getVisibleRows()
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
    ]

    panel.innerHTML = `
      <div class="review-queue">
        <div class="review-queue-header">
          <div>
            <h3>Review queue</h3>
            <p class="review-queue-subtitle">Triage pages by decision, ownership, staleness, and saved notes.</p>
          </div>
          <div class="review-queue-progress" aria-label="Review progress">
            <div class="review-queue-progress-bar">
              <span class="review-queue-progress-fill" style="width: ${progressPct}%"></span>
            </div>
            <span class="review-queue-progress-label">${stats.reviewed}/${stats.total} reviewed</span>
          </div>
        </div>
        <div class="review-queue-stats" aria-label="Decision breakdown">
          <span class="status-chip warn">Needs review ${stats.byDecision['Needs review'] || 0}</span>
          <span class="status-chip pass">Approved ${stats.byDecision.Approved || 0}</span>
          <span class="status-chip pass">Edits ${stats.byDecision['Approved with edits'] || 0}</span>
          <span class="status-chip fail">Revise ${stats.byDecision['Revise and resubmit'] || 0}</span>
          <span class="status-chip fail">Blocked ${stats.byDecision.Blocked || 0}</span>
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
        ${
          rows.length
            ? `
          <ul class="review-queue-list" aria-label="Pages in review queue">
            ${rows
              .map((row) => {
                const chipClass = getStatusChipClass(row.decision)
                const ownerLabel = row.followUpOwner || 'No owner'
                const notesLabel = row.notes ? 'Notes saved' : 'No notes'
                const blockersLabel = row.blockers ? 'Blockers logged' : 'No blockers'
                const ageChipClass = row.isStale ? 'fail' : row.ageDays === null ? 'warn' : 'pass'
                const suggestedOwner = getSidebarReviewerName()
                const suggestedOwnerNorm = normalize(suggestedOwner)
                const isOwnerAssigned =
                  normalize(row.followUpOwner) === suggestedOwnerNorm && !!row.followUpOwner

                const canAssignMe = !isOwnerAssigned
                const canNeedsReview = row.decision !== 'Needs review'
                const canMarkBlocked = row.decision !== 'Blocked'
                const canRevise = row.decision !== 'Revise and resubmit'
                const canApprove = row.decision !== 'Approved'
                const canApproveEdits = row.decision !== 'Approved with edits'

                return `
              <li>
                <div
                  class="review-queue-row${row.key === currentKey ? ' is-current' : ''}"
                  role="button"
                  tabindex="0"
                  data-page-key="${escapeHtml(row.key)}"
                >
                  <span>
                    <span class="review-queue-row-title">${escapeHtml(row.title)}</span>
                    <span class="review-queue-row-meta">${escapeHtml(row.type || 'Page')} · ${escapeHtml(row.key)}</span>
                    <span class="review-queue-row-detail">
                      <span>${escapeHtml(ownerLabel)}</span>
                      <span>${escapeHtml(row.reviewer || 'No reviewer')}</span>
                      <span>${escapeHtml(formatUpdatedAt(row.updatedAt))}</span>
                    </span>
                    <span class="review-queue-actions" aria-label="Queue actions">
                      <button
                        type="button"
                        class="review-queue-action"
                        data-queue-action="assign-me"
                        ${canAssignMe ? '' : 'disabled'}
                      >Assign to me</button>
                      <button
                        type="button"
                        class="review-queue-action"
                        data-queue-action="needs-review"
                        ${canNeedsReview ? '' : 'disabled'}
                      >Needs review</button>
                      <button
                        type="button"
                        class="review-queue-action"
                        data-queue-action="revise"
                        ${canRevise ? '' : 'disabled'}
                      >Revise</button>
                      <button
                        type="button"
                        class="review-queue-action"
                        data-queue-action="blocked"
                        ${canMarkBlocked ? '' : 'disabled'}
                      >Blocked</button>
                      <button
                        type="button"
                        class="review-queue-action"
                        data-queue-action="approved"
                        ${canApprove ? '' : 'disabled'}
                      >Approve</button>
                      <button
                        type="button"
                        class="review-queue-action"
                        data-queue-action="approved-with-edits"
                        ${canApproveEdits ? '' : 'disabled'}
                      >Approve w/ edits</button>
                    </span>
                    <span class="review-queue-row-tags">
                      ${row.notes ? `<span class="status-chip">${escapeHtml(notesLabel)}</span>` : ''}
                      ${row.blockers ? '<span class="status-chip fail">Blockers logged</span>' : ''}
                    </span>
                  </span>
                  <span class="review-queue-row-status">
                    <span class="status-chip ${chipClass}">${escapeHtml(row.decision)}</span>
                    <span class="status-chip ${ageChipClass}">${escapeHtml(formatAgeLabel(row))}</span>
                    ${row.followUpOwner ? '' : '<span class="status-chip warn">Needs owner</span>'}
                  </span>
                </div>
              </li>
            `
              })
              .join('')}
          </ul>
        `
            : `
          <div class="review-queue-empty">
            <p>No pages match the current filter and search.</p>
            <button type="button" class="review-queue-filter" data-queue-reset="true">Clear queue filters</button>
          </div>
        `
        }
      </div>
    `

    restoreSearchFocus(searchFocus)
  }

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
      Object.assign(state, DEFAULT_STATE)
      writeQueueUiState()
      renderReviewQueue()
      return
    }

    const actionButton = event.target.closest('[data-queue-action]')
    if (actionButton) {
      const row = actionButton.closest('[data-page-key]')
      if (!row) return
      const key = row.getAttribute('data-page-key')
      if (!key || !DATA.pages[key]) return

      const action = actionButton.getAttribute('data-queue-action')
      const suggestedOwner = getSidebarReviewerName()
      const reviewDate = getSidebarReviewDate()
      const currentSaved = window.reviewState.read().pages[key] || {}

      let saved
      if (action === 'assign-me') {
        saved = updateLocalReviewForPage(key, {
          follow_up_owner: suggestedOwner,
          review_date: reviewDate,
        })
      } else if (action === 'needs-review') {
        saved = updateLocalReviewForPage(key, {
          decision: 'Needs review',
          follow_up_owner: currentSaved.follow_up_owner || suggestedOwner,
          review_date: reviewDate,
        })
      } else if (action === 'revise') {
        saved = updateLocalReviewForPage(key, {
          decision: 'Revise and resubmit',
          follow_up_owner: currentSaved.follow_up_owner || suggestedOwner,
          review_date: reviewDate,
        })
      } else if (action === 'blocked') {
        saved = updateLocalReviewForPage(key, {
          decision: 'Blocked',
          follow_up_owner: currentSaved.follow_up_owner || suggestedOwner,
          review_date: reviewDate,
        })
      } else if (action === 'approved') {
        saved = updateLocalReviewForPage(key, {
          decision: 'Approved',
          follow_up_owner: currentSaved.follow_up_owner || suggestedOwner,
          review_date: reviewDate,
        })
      } else if (action === 'approved-with-edits') {
        saved = updateLocalReviewForPage(key, {
          decision: 'Approved with edits',
          follow_up_owner: currentSaved.follow_up_owner || suggestedOwner,
          review_date: reviewDate,
        })
      } else {
        return
      }

      syncSidebarForKey(key, saved)
      if (key === getCurrentKey()) {
        // Triggers the existing persistence + sticky-bar refresh logic in ux-improvements.js.
        dispatchReviewFieldChange('reviewDecision')
        dispatchReviewFieldChange('reviewOwner')
      }
      document.dispatchEvent(new CustomEvent('hhvc:review-data-changed'))
      renderReviewQueue()
      return
    }

    const rowButton = event.target.closest('[data-page-key]')
    if (!rowButton) return
    const key = rowButton.getAttribute('data-page-key')
    if (!key || !DATA.pages[key]) return
    window.renderPage?.(key)
  }

  function handleQueueKeyDown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    if (event.target.closest('[data-queue-action]')) return
    const row = event.target.closest('[data-page-key]')
    if (!row) return

    event.preventDefault()
    const key = row.getAttribute('data-page-key')
    if (!key || !DATA.pages[key]) return
    window.renderPage?.(key)
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

  function init() {
    const panel = document.getElementById(QUEUE_PANEL_ID)
    if (!panel) return

    restoreQueueUiState()
    panel.addEventListener('click', handleQueueClick)
    panel.addEventListener('keydown', handleQueueKeyDown)
    panel.addEventListener('input', handleQueueInput)
    panel.addEventListener('change', handleQueueInput)
    document.addEventListener('hhvc:review-data-changed', renderReviewQueue)
    renderReviewQueue()
  }

  window.reviewQueue = {
    getQueueRows,
    getQueueStats,
    getNextNeedsReviewKey,
    getAdjacentKey,
    getFilter: () => state.filter,
    renderReviewQueue,
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
