/* Interactive HHVC sitemap diagram.
   Single hub-tree layout driven by HHVC_DATA.order and resource-collection
   card targets. Uses existing HHVC_DATA and renderPage() so nodes open mockups. */
;(function mountInteractiveSitemap() {
  const DATA = window.HHVC_DATA
  if (!hasValidPageData(DATA)) return

  const PANEL_ID = 'interactiveSitemapPanel'
  const TOPIC_KEY = 'pestsTopic'
  const state = {
    filter: 'All',
    search: '',
    selectedKey: document.getElementById('pageSelect')?.value || TOPIC_KEY,
    showLinksFromSelected: false,
  }

  let sitemapMounted = false

  const {
    escapeHtml,
    getPrimaryCta,
    countRelatedLinks,
    getCurrentKey: getCurrentKeyShared,
    buildPageRows,
    debounce,
  } = window.utils

  function getWorkspaceSitemapPanel() {
    return document.getElementById('reviewWorkspaceSitemap')
  }

  function getCurrentKey() {
    return getCurrentKeyShared(state.selectedKey)
  }

  function normalizeType(type) {
    const normalized = String(type || '').toLowerCase()
    if (normalized.includes('topic')) return 'Topic'
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

  function shortTitle(title, max = 34) {
    const text = String(title || '').trim()
    if (text.length <= max) return text
    return `${text.slice(0, max - 1).trimEnd()}…`
  }

  function renderLegend() {
    const types = [
      ['Topic', 'var(--sfds-action-blue)'],
      ['Resource Collection', '#7c3aed'],
      ['Transaction', 'var(--sfds-green)'],
      ['Information', 'var(--sfds-warning-border)'],
      ['Campaign', '#0891b2'],
    ]
    return `
      <ul class="sitemap-legend" aria-label="Page type legend">
        ${types
          .map(
            ([label, color]) => `
          <li class="sitemap-legend-item">
            <span class="sitemap-legend-swatch" style="background:${color}"></span>
            ${escapeHtml(label)}
          </li>
        `
          )
          .join('')}
      </ul>
    `
  }

  function renderSearchAndFilters() {
    const filters = [
      'All',
      'Topic',
      'Resource Collection',
      'Transaction',
      'Information',
      'Campaign',
    ]
    const clearLabel = state.search ? '✕ Clear search' : ''
    const filteredCount = getFilteredRows().length
    const totalCount = getPageRows().length
    const isEmpty = state.search.trim().length > 0 && filteredCount === 0
    return `
      <div class="sitemap-search-bar">
        <input type="search" class="sitemap-search-input" value="${escapeHtml(state.search)}" placeholder="Search pages by title, slug, or keyword..." aria-label="Search sitemap pages" autocomplete="off" />
        <button type="button" class="sitemap-reset-button" data-sitemap-action="clear-search" ${clearLabel ? '' : 'hidden'}>${escapeHtml(clearLabel || '')}</button>
        <button type="button" class="sitemap-reset-button" data-sitemap-action="go-to-current">Go to current page</button>
        <button type="button" class="sitemap-toggle" data-sitemap-action="toggle-links" aria-pressed="${state.showLinksFromSelected ? 'true' : 'false'}">
          ${state.showLinksFromSelected ? 'Hide link highlights' : 'Highlight links'}
        </button>
      </div>
      <div class="sitemap-filter-bar" aria-label="Sitemap page type filters">
        ${filters
          .map(
            (filter) => `
          <button type="button" class="sitemap-filter-button ${state.filter === filter ? 'active' : ''}" data-sitemap-filter="${filter}" aria-pressed="${state.filter === filter ? 'true' : 'false'}">
            ${escapeHtml(filter)} ${filter !== 'All' ? `(${getPageRows().filter((r) => r.type === filter).length})` : `(${totalCount})`}
          </button>
        `
          )
          .join('')}
      </div>
      ${renderLegend()}
      <p class="sitemap-diagram-footnote" style="margin:0;">Showing ${filteredCount} of ${totalCount} pages in <code>js/page-data.js</code> order.</p>
      ${isEmpty ? '<p class="sitemap-empty-note">No pages match your search or filter. Try adjusting your terms.</p>' : ''}
    `
  }

  function renderDiagramNode(row, options = {}) {
    const { hub = false, dimmed = false, linked = false } = options
    const active = row.key === getCurrentKey()
    const title = row.page.title || row.label
    return `
      <button
        type="button"
        class="sitemap-diagram-node ${active ? 'active' : ''} ${dimmed ? 'dimmed' : ''} ${linked ? 'linked' : ''}"
        data-sitemap-key="${escapeHtml(row.key)}"
        data-page-type="${escapeHtml(row.type)}"
        title="${escapeHtml(title)}"
        ${active ? 'aria-current="page"' : ''}
      >
        <span class="sitemap-diagram-order" aria-hidden="true">${row.orderIndex + 1}</span>
        <span class="sitemap-diagram-node-body">
          <span class="sitemap-diagram-title">${escapeHtml(hub ? title : shortTitle(title))}</span>
          <span class="sitemap-diagram-meta">${escapeHtml(row.type)}${hub ? '' : ` · ${escapeHtml(row.key)}`}</span>
        </span>
      </button>
    `
  }

  function renderDiagram() {
    const { root, groups, crossCutting } = buildDiagramGroups()
    const visibleKeys = getFilteredKeySet()
    const selectedKey = getCurrentKey()
    const graph = getLinkGraph()
    const outgoing = graph[selectedKey]?.outgoing || new Set()

    function nodeOptions(row) {
      const visible = visibleKeys.has(row.key)
      const linked = state.showLinksFromSelected && outgoing.has(row.key)
      return {
        hub: row.type === 'Resource Collection',
        dimmed: !visible,
        linked,
      }
    }

    const columns = groups
      .map((group) => {
        const visibleChildren = group.children.filter((child) => visibleKeys.has(child.key))
        const childMarkup = group.children.length
          ? group.children.map((child) => renderDiagramNode(child, nodeOptions(child))).join('')
          : '<p class="sitemap-empty-note">No child pages assigned.</p>'
        const hubVisible = visibleKeys.has(group.hubKey)
        return `
          <section class="sitemap-diagram-column" aria-label="${escapeHtml(group.hub?.page.title || group.hubKey)}">
            <h4 class="sitemap-diagram-column-header">
              Hub
              <span class="sitemap-diagram-column-count">${visibleChildren.length}/${group.children.length}</span>
            </h4>
            ${group.hub ? renderDiagramNode(group.hub, { ...nodeOptions(group.hub), hub: true }) : ''}
            <div class="sitemap-diagram-children" role="list" aria-hidden="${hubVisible && visibleChildren.length === 0 ? 'true' : 'false'}">
              ${childMarkup}
            </div>
          </section>
        `
      })
      .join('')

    const crossCuttingMarkup = crossCutting.length
      ? `
        <section class="sitemap-diagram-crosscut" aria-label="Topic-linked and cross-cutting pages">
          <h4 class="sitemap-diagram-column-header">
            Topic-linked pages
            <span class="sitemap-diagram-column-count">${crossCutting.filter((row) => visibleKeys.has(row.key)).length}/${crossCutting.length}</span>
          </h4>
          <div class="sitemap-diagram-crosscut-grid" role="list">
            ${crossCutting.map((row) => renderDiagramNode(row, nodeOptions(row))).join('')}
          </div>
        </section>
      `
      : ''

    return `
      <figure class="sitemap-diagram" role="group" aria-label="HHVC page inventory diagram">
        <div class="sitemap-diagram-root-wrap">
          ${root ? renderDiagramNode(root, { ...nodeOptions(root), hub: true }) : ''}
        </div>
        <div class="sitemap-diagram-connector" aria-hidden="true">↓</div>
        <div class="sitemap-diagram-columns">${columns}</div>
        ${crossCuttingMarkup}
        <p class="sitemap-diagram-footnote">Columns group child pages under each resource-collection hub using placement card targets. Inventory order is shown on every node.</p>
      </figure>
    `
  }

  function renderLinkChips(title, targets) {
    if (!targets || !targets.length) return ''
    const graph = getLinkGraph()
    return `
      <section class="sitemap-link-section">
        <h5>${escapeHtml(title)}</h5>
        <div class="sitemap-link-chips">
          ${targets
            .map((target) => {
              const page = DATA.pages[target]
              const label = page ? escapeHtml(page.title || target) : escapeHtml(target)
              const incoming = graph[target]?.incoming?.size || 0
              const outgoing = graph[target]?.outgoing?.size || 0
              return `<button type="button" class="sitemap-link-chip" data-sitemap-key="${escapeHtml(target)}" data-sitemap-action="open-link">${label} <span aria-hidden="true">→${outgoing} ←${incoming}</span></button>`
            })
            .join('')}
        </div>
      </section>
    `
  }

  function renderDetail() {
    const row = getSelectedRow()
    if (!row) return ''

    const page = row.page
    const primaryCta = getPrimaryCta(page) || 'None set'
    const audienceCount = Array.isArray(page.audience) ? page.audience.length : 0
    const relatedCount = countRelatedLinks(page)
    const graph = getLinkGraph()
    const outgoingTargets = getOutgoingTargets(page)
    const incomingTargets = Array.from(graph[row.key]?.incoming || [])

    return `
      <aside class="sitemap-detail-card" aria-label="Selected sitemap page details">
        <h4>${escapeHtml(page.title || row.label)}</h4>
        <p>${escapeHtml(page.summary || 'No summary available.')}</p>
        <ul class="sitemap-detail-list">
          <li><strong>Inventory #:</strong> ${row.orderIndex + 1} of ${getPageRows().length}</li>
          <li><strong>Page type:</strong> ${escapeHtml(row.type)}</li>
          <li><strong>Reading target:</strong> ${escapeHtml(page.reading || 'Not set')}</li>
          <li><strong>Primary CTA:</strong> ${escapeHtml(primaryCta)}</li>
          <li><strong>Audience entries:</strong> ${audienceCount}</li>
          <li><strong>Linked items:</strong> ${relatedCount}</li>
          <li><strong>URL slug:</strong> ${escapeHtml(page.slug || 'Not set')}</li>
          <li><strong>Links to:</strong> ${outgoingTargets.length} page(s)</li>
          <li><strong>Linked from:</strong> ${incomingTargets.length} page(s)</li>
        </ul>
        ${renderLinkChips('Outgoing links', outgoingTargets)}
        ${renderLinkChips('Incoming links', incomingTargets)}
      </aside>
    `
  }

  function mountPanel() {
    if (document.getElementById(PANEL_ID)) return document.getElementById(PANEL_ID)

    const host = getWorkspaceSitemapPanel()
    if (!host) return null

    const panel = document.createElement('section')
    panel.id = PANEL_ID
    panel.className = 'interactive-sitemap-panel'
    panel.setAttribute('aria-label', 'Interactive sitemap diagram')
    host.appendChild(panel)
    return panel
  }

  function renderPanel() {
    const panel = mountPanel()
    if (!panel) return

    panel.innerHTML = `
      <div class="interactive-sitemap-header">
        <div>
          <h3>Page inventory diagram</h3>
          <p>One diagram from <code>js/page-data.js</code>: topic page at top, four resource-collection hubs below, child pages grouped by hub placement links. Click any node to open that mockup.</p>
        </div>
      </div>
      <div class="sitemap-toolbar">${renderSearchAndFilters()}</div>
      <div class="interactive-sitemap-layout">
        ${renderDiagram()}
        ${renderDetail()}
      </div>
    `
  }

  function rerender() {
    state.selectedKey = getCurrentKey()
    state._linkGraph = null
    renderPanel()
  }

  function openPageByKey(key) {
    if (!key || !DATA.pages[key]) return
    state.selectedKey = key
    window.renderPage?.(key)
    window.setTimeout(rerender, 0)
    window.setTimeout(() => {
      const node = document.querySelector(`[data-sitemap-key="${CSS.escape(key)}"]`)
      if (node) node.focus()
    }, 50)
  }

  function handleClick(event) {
    const actionButton = event.target.closest('[data-sitemap-action]')
    if (actionButton) {
      const action = actionButton.getAttribute('data-sitemap-action')
      if (action === 'clear-search') {
        state.search = ''
        rerender()
        return
      }
      if (action === 'go-to-current') {
        openPageByKey(getCurrentKey())
        return
      }
      if (action === 'toggle-links') {
        state.showLinksFromSelected = !state.showLinksFromSelected
        rerender()
        return
      }
      if (action === 'open-link') {
        const chip = event.target.closest('[data-sitemap-key]')
        const key = chip?.getAttribute('data-sitemap-key')
        openPageByKey(key)
        return
      }
    }

    const filterButton = event.target.closest('[data-sitemap-filter]')
    if (filterButton) {
      state.filter = filterButton.getAttribute('data-sitemap-filter') || 'All'
      state.showLinksFromSelected = false
      rerender()
      return
    }

    const nodeButton = event.target.closest('[data-sitemap-key]')
    if (nodeButton) {
      const key = nodeButton.getAttribute('data-sitemap-key')
      openPageByKey(key)
      return
    }
  }

  function handleKeydown(event) {
    const searchInput = event.target.closest('.sitemap-search-input')
    if (searchInput) {
      if (event.key === 'Escape') {
        state.search = ''
        searchInput.value = ''
        rerender()
        searchInput.focus()
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        const firstNode = document.querySelector('.sitemap-diagram-node:not(.dimmed)')
        if (firstNode) firstNode.focus()
        return
      }
    }

    if (event.key === 'Escape') {
      state.showLinksFromSelected = false
      state.filter = 'All'
      rerender()
      return
    }

    const focusedNode = document.activeElement?.closest('.sitemap-diagram-node')
    if (!focusedNode || focusedNode.classList.contains('dimmed')) return

    const nodes = Array.from(document.querySelectorAll('.sitemap-diagram-node:not(.dimmed)'))
    const index = nodes.indexOf(focusedNode)

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      nodes[index + 1]?.focus()
      return
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      nodes[index - 1]?.focus()
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      nodes[0]?.focus()
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      nodes[nodes.length - 1]?.focus()
      return
    }
  }

  const handleSearchInput = debounce((event) => {
    if (!event.target.closest('.sitemap-search-input')) return
    state.search = event.target.value
    state.showLinksFromSelected = false
    rerender()
    const input = document.querySelector('.sitemap-search-input')
    if (input) {
      input.focus()
      const end = input.value.length
      input.setSelectionRange(end, end)
    }
  }, 180)

  function wrapRenderPageForSitemap() {
    if (typeof window.renderPage !== 'function' || window.renderPage.__sitemapWrapped) return
    const originalRenderPage = window.renderPage
    window.renderPage = function renderPageWithSitemapRefresh(key) {
      const result = originalRenderPage.call(this, key)
      // Under View Transitions, renderPage returns a promise that resolves
      // once #pageSelect reflects the new page; rerendering earlier would
      // highlight the previous page as current.
      if (result && typeof result.then === 'function')
        result.then(() => {
          if (sitemapMounted) rerender()
        })
      else if (sitemapMounted) rerender()
      return result
    }
    window.renderPage.__sitemapWrapped = true
  }

  function ensureSitemapRendered() {
    if (sitemapMounted) {
      rerender()
      return
    }
    sitemapMounted = true
    rerender()
  }

  function init() {
    document.addEventListener('click', handleClick)
    document.addEventListener('keydown', handleKeydown)
    document.addEventListener('input', handleSearchInput)
    document.addEventListener('hhvc:review-data-changed', () => {
      if (sitemapMounted) rerender()
    })
    wrapRenderPageForSitemap()

    window.__mountInteractiveSitemapOnTabOpen = ensureSitemapRendered
  }

  function teardown() {
    sitemapMounted = false
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }

  if (typeof window !== 'undefined') {
    window.__mountInteractiveSitemapTeardown = teardown
  }
})()
