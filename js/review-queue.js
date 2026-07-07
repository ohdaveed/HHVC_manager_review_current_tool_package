/* Cross-page review queue for manager approval workflow.
   Reads HHVC_DATA and hhvcManagerReviewState:v1; does not mutate page source data. */
;(function mountReviewQueue() {
  const DATA = window.HHVC_DATA
  if (!DATA || !DATA.pages || !DATA.order || !window.reviewState) return

  const QUEUE_PANEL_ID = 'reviewWorkspaceOverview'
  const STALE_DAYS = 3
  const DEFAULT_STATE = {
    filter: 'All',
    query: '',
    sort: 'priority',
  }

  const { escapeHtml, getPrimaryCta, parseCsv, getStatusChipClass, getCurrentKey } = window.utils
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
    const savedPages = readLocalState().pages
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
      const isCurrentPage = key === getCurrentKey()
      const rules =
        window.reviewChecks?.getRuleResultsFor?.(page, { useEditor: isCurrentPage }) || []
      const checksPassed = rules.filter((rule) => rule.pass).length
      const checksTotal = rules.length
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
        checksPassed,
        checksTotal,
        isCurrentPage,
        searchText,
      }
    })
  }

  function isFailingChecks(row) {
    return row.checksTotal > 0 && row.checksPassed < row.checksTotal
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
    const failingChecks = rows.filter(isFailingChecks).length

    return { total, reviewed, stale, unassigned, blocked, failingChecks, byDecision }
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
    if (state.filter === 'Unassigned') return isUnassigned(row)
    if (state.filter === 'Stale') return row.isStale
    if (state.filter === 'Failing checks') return isFailingChecks(row)
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

    if (state.sort === 'title') return a.title.localeCompare(b.title)

    if (state.sort === 'type') {
      return a.type.localeCompare(b.type) || a.title.localeCompare(b.title)
    }

    if (state.sort === 'checks') {
      const failingA = a.checksTotal - a.checksPassed
      const failingB = b.checksTotal - b.checksPassed
      return failingB - failingA || a.title.localeCompare(b.title)
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

  function getSelectedKeys() {
    return [...state.selected].filter((key) => DATA.pages[key])
  }

  function pruneSelection(visibleKeys) {
    for (const key of [...state.selected]) {
      if (!DATA.pages[key]) state.selected.delete(key)
    }
  }

  function toggleSelected(key) {
    if (!DATA.pages[key]) return
    if (state.selected.has(key)) state.selected.delete(key)
    else state.selected.add(key)
  }

  function selectAllVisible() {
    for (const key of getFilteredKeys()) state.selected.add(key)
  }

  function clearSelection() {
    state.selected.clear()
  }

  function applyQueueAction(keys, action, options = {}) {
    const keyList = (Array.isArray(keys) ? keys : [keys]).filter((key) => DATA.pages[key])
    if (!keyList.length) return 0

    const suggestedOwner = getSidebarReviewerName()
    const reviewDate = getSidebarReviewDate()
    const fullState = readLocalState()
    let currentKeySaved = null
    let updatedCount = 0

    for (const key of keyList) {
      const currentSaved = fullState.pages[key] || {}
      const patch = buildActionPatch(action, suggestedOwner, reviewDate, currentSaved)
      if (!patch) continue
      const saved = updateLocalReviewForPage(key, patch)
      if (!saved || saved.updated_at === currentSaved.updated_at) continue
      updatedCount += 1
      if (key === getCurrentKey()) currentKeySaved = saved
    }

    if (currentKeySaved) {
      syncSidebarForKey(getCurrentKey(), currentKeySaved)
      if (!options.skipSidebarEvents) {
        dispatchReviewFieldChange('reviewDecision')
        dispatchReviewFieldChange('reviewOwner')
      }
    }

    document.dispatchEvent(new CustomEvent('hhvc:review-data-changed'))
    renderReviewQueue()

    if (!options.silent && updatedCount) {
      const label = actionLabel(action)
      toast(
        updatedCount === 1 ? `${label}` : `${label} · ${updatedCount} pages`,
        actionToastTone(action)
      )
    }

    return updatedCount
  }

  function getActionTargets(preferredKey) {
    const selected = getSelectedKeys()
    if (selected.length) return selected
    if (preferredKey && DATA.pages[preferredKey]) return [preferredKey]
    const current = getCurrentKey()
    return DATA.pages[current] ? [current] : []
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

  function renderReviewQueue() {
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

  function importReviewsFromCsvText(text) {
    const rows = parseCsv(text)
    if (rows.length < 2) {
      toast('Import failed: CSV has no data rows.', 'warn')
      return 0
    }

    const headers = rows[0].map((header) => normalize(header).replaceAll(' ', '_'))
    const indexOf = (name) => headers.indexOf(name)
    const pageKeyIndex = indexOf('page_key')
    if (pageKeyIndex === -1) {
      toast('Import failed: CSV needs a page_key column.', 'warn')
      return 0
    }

    let imported = 0
    let skipped = 0

    for (const cells of rows.slice(1)) {
      const pageKey = String(cells[pageKeyIndex] || '').trim()
      if (!pageKey || !DATA.pages[pageKey]) {
        skipped += 1
        continue
      }

      const get = (name) => {
        const index = indexOf(name)
        return index === -1 ? '' : String(cells[index] ?? '').trim()
      }

      const csvDecision = get('decision')
      if (csvDecision !== '' && !VALID_DECISIONS.has(csvDecision)) {
        skipped += 1
        continue
      }

      const patch = {}
      const fields = [
        'page_title',
        'page_type',
        'url_slug',
        'decision',
        'notes',
        'risks_or_blockers',
        'follow_up_owner',
        'reviewer',
        'review_date',
        'seo_title',
        'meta_description',
        'primary_cta',
        'reading_target',
      ]

      let hasField = false
      for (const field of fields) {
        const val = get(field)
        if (val !== '') {
          patch[field] = val
          hasField = true
        }
      }

      if (!hasField) {
        skipped += 1
        continue
      }

      const existing = readLocalState().pages[pageKey] || {}
      const saved = updateLocalReviewForPage(pageKey, patch)
      if (saved && saved.updated_at !== existing.updated_at) {
        imported += 1
      } else {
        skipped += 1
      }
    }

    if (!imported) {
      toast(
        skipped
          ? 'Import finished: no matching pages were updated.'
          : 'Import failed: no valid review rows found.',
        'warn'
      )
      return 0
    }

    const currentKey = getCurrentKey()
    if (typeof window.renderPage === 'function') {
      window.renderPage(currentKey)
    }

    document.dispatchEvent(new CustomEvent('hhvc:review-data-changed'))
    renderReviewQueue()
    toast(
      skipped
        ? `Imported ${imported} reviews (${skipped} skipped).`
        : `Imported ${imported} reviews.`,
      'success'
    )
    return imported
  }

  function importReviewsFromCsvFile(file) {
    file
      .text()
      .then((text) => importReviewsFromCsvText(text))
      .catch(() => toast('Import failed: could not read the CSV file.', 'warn'))
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
    renderReviewQueue()
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
