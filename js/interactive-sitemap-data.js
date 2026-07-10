/* Interactive HHVC sitemap: graph-building and page-row query layer.
   Loads before js/interactive-sitemap-render.js and js/interactive-sitemap.js,
   which read window.InteractiveSitemap.state and window.InteractiveSitemap.data. */
;(function mountInteractiveSitemapData() {
  const DATA = window.HHVC_DATA
  if (!hasValidPageData(DATA)) return

  const TOPIC_KEY = 'pestsTopic'

  const state = {
    filter: 'All',
    search: '',
    selectedKey: document.getElementById('pageSelect')?.value || TOPIC_KEY,
    showLinksFromSelected: false,
  }

  const { getCurrentKey: getCurrentKeyShared, buildPageRows } = window.utils

  function getCurrentKey() {
    return getCurrentKeyShared(state.selectedKey)
  }

  function normalizeType(type) {
    const normalized = String(type || '').toLowerCase()
    if (normalized.includes('topic')) return 'Topic'
    if (normalized.includes('agency')) return 'Agency'
    if (normalized.includes('resource collection')) return 'Resource Collection'
    if (normalized.includes('transaction')) return 'Transaction'
    if (normalized.includes('campaign')) return 'Campaign'
    return 'Information'
  }

  function getOutgoingTargets(page) {
    const targets = new Set()
    for (const section of page.sections || []) {
      for (const card of section.cards || []) {
        if (card.target) targets.add(card.target)
      }
      if (section.buttonTarget) targets.add(section.buttonTarget)
      for (const step of section.steps || []) {
        if (step.buttonTarget) targets.add(step.buttonTarget)
      }
    }
    return Array.from(targets)
  }

  function getPlacementTargets(page) {
    const targets = new Set()
    for (const section of page.sections || []) {
      if (section.kind !== 'placement') continue
      if (
        String(section.heading || '')
          .toLowerCase()
          .includes('related')
      )
        continue
      for (const card of section.cards || []) {
        if (card.target) targets.add(card.target)
      }
    }
    return Array.from(targets)
  }

  function buildLinkGraph() {
    const graph = {}
    for (const [key] of DATA.order) {
      graph[key] = { incoming: new Set(), outgoing: new Set() }
    }
    for (const [key, page] of Object.entries(DATA.pages || {})) {
      const targets = getOutgoingTargets(page)
      for (const target of targets) {
        if (graph[target]) {
          graph[target].incoming.add(key)
          graph[key].outgoing.add(target)
        }
      }
    }
    return graph
  }

  function getLinkGraph() {
    if (!state._linkGraph) state._linkGraph = buildLinkGraph()
    return state._linkGraph
  }

  function getPageRows() {
    const graph = getLinkGraph()
    return buildPageRows(DATA, (key, label, page) => ({
      key,
      label,
      page,
      type: normalizeType(page.type || label),
      incomingCount: graph[key]?.incoming?.size || 0,
      outgoingCount: graph[key]?.outgoing?.size || 0,
    })).map((row, orderIndex) => ({ ...row, orderIndex }))
  }

  function getHubKeys() {
    return getPageRows()
      .filter((row) => row.type === 'Resource Collection')
      .map((row) => row.key)
  }

  function buildDiagramGroups() {
    const rows = getPageRows()
    const rowByKey = Object.fromEntries(rows.map((row) => [row.key, row]))
    const hubKeys = getHubKeys()
    const assigned = new Set([TOPIC_KEY, ...hubKeys])
    const groups = hubKeys.map((hubKey) => ({
      hubKey,
      hub: rowByKey[hubKey],
      children: [],
    }))
    const groupByHub = Object.fromEntries(groups.map((group) => [group.hubKey, group]))

    for (const hubKey of hubKeys) {
      const hubPage = DATA.pages[hubKey]
      if (!hubPage) continue
      for (const target of getPlacementTargets(hubPage)) {
        if (assigned.has(target) || !rowByKey[target]) continue
        assigned.add(target)
        groupByHub[hubKey].children.push(rowByKey[target])
      }
    }

    for (const group of groups) {
      group.children.sort((a, b) => a.orderIndex - b.orderIndex)
    }

    const crossCutting = rows
      .filter((row) => !assigned.has(row.key))
      .sort((a, b) => a.orderIndex - b.orderIndex)

    return {
      root: rowByKey[TOPIC_KEY] || rows[0],
      groups,
      crossCutting,
    }
  }

  function getFilteredRows() {
    const q = String(state.search || '')
      .trim()
      .toLowerCase()
    return getPageRows().filter((row) => {
      const matchesType = state.filter === 'All' || row.type === state.filter
      if (!matchesType) return false
      if (!q) return true
      const haystack =
        `${row.key} ${row.label} ${row.page.title || ''} ${row.page.summary || ''} ${row.page.slug || ''}`.toLowerCase()
      return haystack.includes(q)
    })
  }

  function getFilteredKeySet() {
    return new Set(getFilteredRows().map((row) => row.key))
  }

  function getSelectedRow() {
    const key = getCurrentKey()
    return getPageRows().find((row) => row.key === key) || getPageRows()[0]
  }

  window.InteractiveSitemap = window.InteractiveSitemap || {}
  window.InteractiveSitemap.state = state
  window.InteractiveSitemap.data = {
    getCurrentKey,
    normalizeType,
    getOutgoingTargets,
    getPlacementTargets,
    buildLinkGraph,
    getLinkGraph,
    getPageRows,
    getHubKeys,
    buildDiagramGroups,
    getFilteredRows,
    getFilteredKeySet,
    getSelectedRow,
  }
})()
