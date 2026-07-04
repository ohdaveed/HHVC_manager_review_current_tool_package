/* Interactive HHVC sitemap diagram.
   Single hub-tree layout driven by HHVC_DATA.order and resource-collection
   card targets. Uses existing HHVC_DATA and renderPage() so nodes open mockups. */
;(function mountInteractiveSitemap() {
  const DATA = window.HHVC_DATA
  if (!hasValidPageData(DATA)) return

  const PANEL_ID = 'interactiveSitemapPanel'
  const STYLE_ID = 'interactiveSitemapStyles'
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
    if (normalized.includes('resource collection')) return 'Resource collection'
    if (normalized.includes('transaction')) return 'Transaction'
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
      .filter((row) => row.type === 'Resource collection')
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

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return

    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = `
      .interactive-sitemap-panel {
        border-top: 1px solid var(--sfds-border);
        padding: 1rem;
        background: var(--sfds-white);
      }

      .interactive-sitemap-header {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: flex-start;
        margin-bottom: 0.8rem;
        flex-wrap: wrap;
      }

      .interactive-sitemap-header h3 {
        margin: 0 0 0.25rem;
        font-size: 1rem;
      }

      .interactive-sitemap-header p {
        margin: 0;
        color: var(--sfds-slate-3);
        font-size: 0.8rem;
        line-height: 1.35;
        max-width: 56rem;
      }

      .sitemap-toolbar {
        display: grid;
        gap: 0.65rem;
        margin-bottom: 0.85rem;
      }

      .sitemap-search-bar {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        flex-wrap: wrap;
      }

      .sitemap-search-input {
        min-height: 2.1rem;
        padding: 0.35rem 0.6rem;
        border: 1px solid var(--sfds-border);
        border-radius: var(--radius);
        font: inherit;
        color: var(--sfds-slate-1);
        background: var(--sfds-white);
        width: 18rem;
      }

      .sitemap-search-input:focus {
        outline: 2px solid var(--sfds-action-blue);
        outline-offset: 1px;
      }

      .sitemap-reset-button,
      .sitemap-toggle {
        min-height: 2.1rem;
        padding: 0.35rem 0.8rem;
        border: 1px solid var(--sfds-border);
        border-radius: var(--radius);
        background: var(--sfds-white);
        color: var(--sfds-action-blue);
        cursor: pointer;
        font: inherit;
        font-weight: 700;
      }

      .sitemap-reset-button:hover,
      .sitemap-reset-button:focus-visible,
      .sitemap-toggle:hover,
      .sitemap-toggle:focus-visible {
        border-color: var(--sfds-action-blue);
        background: var(--sfds-blue-soft-bg);
      }

      .sitemap-toggle[aria-pressed='true'] {
        background: var(--sfds-blue-soft-bg);
        border-color: var(--sfds-action-blue);
      }

      .sitemap-filter-bar,
      .sitemap-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
        align-items: center;
      }

      .sitemap-legend {
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .sitemap-filter-button,
      .sitemap-diagram-node {
        border: 1px solid var(--sfds-border);
        border-radius: var(--radius);
        background: var(--sfds-white);
        color: var(--sfds-action-blue);
        cursor: pointer;
        font: inherit;
      }

      .sitemap-filter-button {
        min-height: 2rem;
        padding: 0.35rem 0.65rem;
        font-size: 0.78rem;
        font-weight: 800;
      }

      .sitemap-filter-button.active,
      .sitemap-filter-button:hover,
      .sitemap-diagram-node:hover,
      .sitemap-diagram-node.active {
        border-color: var(--sfds-action-blue);
        background: var(--sfds-blue-soft-bg);
        color: var(--sfds-action-blue-hover);
      }

      .sitemap-legend-item {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        font-size: 0.72rem;
        color: var(--sfds-slate-2);
        font-weight: 700;
      }

      .sitemap-legend-swatch {
        width: 0.75rem;
        height: 0.75rem;
        border-radius: 2px;
        border: 1px solid var(--sfds-border);
        flex: none;
      }

      .interactive-sitemap-layout {
        display: grid;
        grid-template-columns: minmax(0, 1.55fr) minmax(16rem, 0.75fr);
        gap: 1rem;
        align-items: start;
      }

      .sitemap-diagram {
        border: 1px solid var(--sfds-border);
        border-radius: var(--radius);
        background: var(--sfds-slate-6, #f8fafc);
        padding: 0.9rem;
        overflow-x: auto;
      }

      .sitemap-diagram-root-wrap {
        display: grid;
        justify-items: center;
        margin-bottom: 0.55rem;
      }

      .sitemap-diagram-connector {
        display: grid;
        justify-items: center;
        margin: 0.15rem 0 0.55rem;
        color: var(--sfds-slate-3);
        font-size: 0.9rem;
        font-weight: 900;
        user-select: none;
      }

      .sitemap-diagram-columns {
        display: grid;
        grid-template-columns: repeat(4, minmax(10.5rem, 1fr));
        gap: 0.65rem;
        min-width: 44rem;
      }

      .sitemap-diagram-column {
        display: grid;
        gap: 0.45rem;
        align-content: start;
      }

      .sitemap-diagram-column-header {
        margin: 0;
        font-size: 0.68rem;
        font-weight: 900;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--sfds-slate-3);
        display: flex;
        align-items: center;
        gap: 0.35rem;
      }

      .sitemap-diagram-column-count {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 1.15rem;
        height: 1.15rem;
        padding: 0 0.25rem;
        border-radius: 999px;
        background: var(--sfds-slate-5);
        color: var(--sfds-slate-2);
        font-size: 0.62rem;
      }

      .sitemap-diagram-node {
        width: 100%;
        min-height: 2.35rem;
        padding: 0.4rem 0.5rem;
        text-align: left;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 0.4rem;
        align-items: start;
      }

      .sitemap-diagram-node:focus-visible {
        outline: 2px solid var(--sfds-action-blue);
        outline-offset: 1px;
      }

      .sitemap-diagram-node.dimmed {
        opacity: 0.28;
        pointer-events: none;
      }

      .sitemap-diagram-node.linked {
        box-shadow: 0 0 0 2px var(--sfds-action-blue);
      }

      .sitemap-diagram-order {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 1.25rem;
        height: 1.25rem;
        border-radius: 999px;
        background: var(--sfds-slate-5);
        color: var(--sfds-slate-2);
        font-size: 0.6rem;
        font-weight: 900;
        flex: none;
      }

      .sitemap-diagram-node-body {
        display: grid;
        gap: 0.08rem;
        min-width: 0;
      }

      .sitemap-diagram-title {
        color: var(--sfds-slate-1);
        font-size: 0.74rem;
        font-weight: 800;
        line-height: 1.25;
      }

      .sitemap-diagram-meta {
        color: var(--sfds-slate-3);
        font-size: 0.62rem;
        line-height: 1.2;
      }

      .sitemap-diagram-node[data-page-type='Topic'] {
        border-left: 4px solid var(--sfds-action-blue);
        max-width: 18rem;
      }

      .sitemap-diagram-node[data-page-type='Resource collection'] {
        border-left: 4px solid #7c3aed;
      }

      .sitemap-diagram-node[data-page-type='Transaction'] {
        border-left: 4px solid var(--sfds-green);
      }

      .sitemap-diagram-node[data-page-type='Information'] {
        border-left: 4px solid var(--sfds-warning-border);
      }

      .sitemap-diagram-children {
        display: grid;
        gap: 0.35rem;
      }

      .sitemap-diagram-crosscut {
        margin-top: 0.75rem;
        padding-top: 0.75rem;
        border-top: 1px dashed var(--sfds-border);
      }

      .sitemap-diagram-crosscut-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
        gap: 0.35rem;
      }

      .sitemap-diagram-footnote {
        margin: 0.65rem 0 0;
        color: var(--sfds-slate-3);
        font-size: 0.72rem;
        line-height: 1.35;
      }

      .sitemap-detail-card {
        border: 1px solid var(--sfds-border);
        border-radius: var(--radius);
        background: var(--sfds-white);
        padding: 0.9rem;
        position: sticky;
        top: 0.5rem;
      }

      .sitemap-detail-card h4 {
        margin: 0 0 0.35rem;
        font-size: 1rem;
      }

      .sitemap-detail-card p {
        margin: 0 0 0.65rem;
        color: var(--sfds-slate-2);
        font-size: 0.86rem;
        line-height: 1.4;
      }

      .sitemap-detail-list {
        display: grid;
        gap: 0.45rem;
        margin: 0 0 0.8rem;
        padding: 0;
        list-style: none;
      }

      .sitemap-detail-list li {
        border-top: 1px solid var(--sfds-border);
        margin: 0;
        padding-top: 0.45rem;
        color: var(--sfds-slate-2);
        font-size: 0.78rem;
        line-height: 1.35;
      }

      .sitemap-detail-list strong {
        color: var(--sfds-slate-1);
      }

      .sitemap-link-section {
        border-top: 1px solid var(--sfds-border);
        padding-top: 0.6rem;
      }

      .sitemap-link-section h5 {
        margin: 0 0 0.4rem;
        font-size: 0.78rem;
        color: var(--sfds-slate-2);
      }

      .sitemap-link-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
      }

      .sitemap-link-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.25rem 0.5rem;
        border: 1px solid var(--sfds-border);
        border-radius: 999px;
        background: var(--sfds-white);
        color: var(--sfds-action-blue);
        font-size: 0.72rem;
        font-weight: 700;
        cursor: pointer;
        text-decoration: none;
      }

      .sitemap-link-chip:hover,
      .sitemap-link-chip:focus-visible {
        background: var(--sfds-blue-soft-bg);
        border-color: var(--sfds-action-blue);
      }

      .sitemap-empty-note {
        color: var(--sfds-slate-3);
        font-size: 0.76rem;
        margin: 0;
        padding: 0.35rem 0;
      }

      @media (max-width: 980px) {
        .interactive-sitemap-layout {
          grid-template-columns: 1fr;
        }

        .sitemap-diagram-columns {
          grid-template-columns: repeat(2, minmax(10rem, 1fr));
          min-width: 0;
        }
      }

      @media (max-width: 640px) {
        .sitemap-diagram-columns {
          grid-template-columns: 1fr;
        }

        .sitemap-search-input {
          width: 100%;
        }
      }
    `

    document.head.appendChild(style)
  }

  function renderLegend() {
    const types = [
      ['Topic', 'var(--sfds-action-blue)'],
      ['Resource collection', '#7c3aed'],
      ['Transaction', 'var(--sfds-green)'],
      ['Information', 'var(--sfds-warning-border)'],
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
    const filters = ['All', 'Topic', 'Resource collection', 'Transaction', 'Information']
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
        hub: row.type === 'Resource collection',
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
    injectStyles()
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
    injectStyles()
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
