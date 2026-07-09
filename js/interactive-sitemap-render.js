/* Interactive HHVC sitemap: rendering layer.
   Loads after js/interactive-sitemap-data.js and before js/interactive-sitemap.js. */
;(function mountInteractiveSitemapRender() {
  const DATA = window.HHVC_DATA
  if (!hasValidPageData(DATA) || !window.InteractiveSitemap?.data) return

  const PANEL_ID = 'interactiveSitemapPanel'
  const state = window.InteractiveSitemap.state

  const { escapeHtml } = window.utils

  function getWorkspaceSitemapPanel() {
    return document.getElementById('reviewWorkspaceSitemap')
  }

  function shortTitle(title, max = 34) {
    const text = String(title || '').trim()
    if (text.length <= max) return text
    return `${text.slice(0, max - 1).trimEnd()}…`
  }

  function renderLegend() {
    const types = [
      ['Topic', 'topic'],
      ['Resource Collection', 'resource-collection'],
      ['Transaction', 'transaction'],
      ['Information', 'information'],
      ['Campaign', 'campaign'],
    ]
    return `
      <ul class="sitemap-legend" aria-label="Page type legend">
        ${types
          .map(
            ([label, color]) => `
          <li class="sitemap-legend-item">
            <span class="sitemap-legend-swatch" data-page-type="${color}"></span>
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
    const filteredCount = window.InteractiveSitemap.data.getFilteredRows().length
    const totalCount = window.InteractiveSitemap.data.getPageRows().length
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
            ${escapeHtml(filter)} ${filter !== 'All' ? `(${window.InteractiveSitemap.data.getPageRows().filter((r) => r.type === filter).length})` : `(${totalCount})`}
          </button>
        `
          )
          .join('')}
      </div>
      ${renderLegend()}
      <p class="sitemap-diagram-footnote sitemap-diagram-footnote-compact">Showing ${filteredCount} of ${totalCount} pages in <code>js/page-data.js</code> order.</p>
      ${isEmpty ? '<p class="sitemap-empty-note">No pages match your search or filter. Try adjusting your terms.</p>' : ''}
    `
  }

  function renderDiagramNode(row, options = {}) {
    const { hub = false, dimmed = false, linked = false } = options
    const active = row.key === window.InteractiveSitemap.data.getCurrentKey()
    const title = row.page.title || row.label
    return `
      <button
        type="button"
        class="sitemap-diagram-node ${active ? 'active' : ''} ${dimmed ? 'dimmed' : ''} ${linked ? 'linked' : ''}"
        data-sitemap-key="${escapeHtml(row.key)}"
        data-page-type="${escapeHtml(row.type)}"
        title="${escapeHtml(title)}"
        ${active ? 'aria-current="page"' : ''}
        ${dimmed ? 'aria-hidden="true" tabindex="-1"' : ''}
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
    const { root, groups, crossCutting } = window.InteractiveSitemap.data.buildDiagramGroups()
    const visibleKeys = window.InteractiveSitemap.data.getFilteredKeySet()
    const selectedKey = window.InteractiveSitemap.data.getCurrentKey()
    const graph = window.InteractiveSitemap.data.getLinkGraph()
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
      ${renderDiagram()}
    `
  }

  function rerender() {
    state.selectedKey = window.InteractiveSitemap.data.getCurrentKey()
    state._linkGraph = null
    renderPanel()
  }

  window.InteractiveSitemap.render = {
    renderLegend,
    renderSearchAndFilters,
    renderDiagramNode,
    renderDiagram,
    mountPanel,
    renderPanel,
    rerender,
  }
})()
