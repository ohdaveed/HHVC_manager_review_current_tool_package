/* Cross-page review queue: row computation, filtering/sorting, selection,
   and bulk/single queue actions. Loads after js/review-queue-state.js. */
;(function mountReviewQueueRows() {
  const DATA = window.HHVC_DATA
  if (!DATA || !DATA.pages || !DATA.order || !window.ReviewQueueInternal?.helpers) return

  const state = window.ReviewQueueInternal.state
  const {
    STALE_DAYS,
    getSidebarReviewerName,
    getSidebarReviewDate,
    updateLocalReviewForPage,
    syncSidebarForKey,
    dispatchReviewFieldChange,
    getDecisionForKey,
    normalize,
    parseIsoDate,
    getAgeInDays,
    toast,
    actionLabel,
    actionToastTone,
    buildActionPatch,
  } = window.ReviewQueueInternal.helpers

  const { getCurrentKey } = window.utils
  const readLocalState = window.reviewState.read

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
    const filtered = getQueueRows().filter(matchesFilter)
    const query = state.query.trim()
    if (!query) return filtered.sort(compareRows)
    if (typeof Fuse === 'undefined') {
      const normalized = normalize(query)
      return filtered.filter((row) => row.searchText.includes(normalized)).sort(compareRows)
    }
    const fuse = new Fuse(filtered, {
      keys: [
        'key',
        'title',
        'type',
        'summary',
        'decision',
        'followUpOwner',
        'reviewer',
        'notes',
        'blockers',
      ],
      threshold: 0.4,
      ignoreLocation: true,
    })
    return fuse
      .search(query)
      .map((result) => result.item)
      .sort(compareRows)
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
    // Intentional circular reference: js/review-queue-render.js loads after
    // this file but defines .render before any user interaction can reach
    // this call — see the "Intentional circular reference" note in Task 12.
    window.ReviewQueueInternal.render.renderReviewQueue()

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

  window.ReviewQueueInternal.rows = {
    getPriorityRank,
    isUnassigned,
    getQueueRows,
    isFailingChecks,
    getQueueStats,
    matchesFilter,
    compareRows,
    getVisibleRows,
    getFilteredKeys,
    getSelectedKeys,
    pruneSelection,
    toggleSelected,
    selectAllVisible,
    clearSelection,
    applyQueueAction,
    getActionTargets,
    getNextNeedsReviewKey,
    getAdjacentKey,
  }
})()
