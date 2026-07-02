/* Interactive HHVC sitemap diagram.
   Upgraded: search, link connectivity, keyboard nav, cluster counts, and linked-page spotlight.
   Uses existing HHVC_DATA and renderPage() so nodes can open page mockups directly. */
;(function mountInteractiveSitemap() {
  const DATA = window.HHVC_DATA
  if (!DATA || !DATA.pages || !DATA.order) return

  const PANEL_ID = 'interactiveSitemapPanel'
  const STYLE_ID = 'interactiveSitemapStyles'
  const state = {
    filter: 'All',
    search: '',
    selectedKey: document.getElementById('pageSelect')?.value || 'pestsTopic',
    showLinksFromSelected: false,
  }

  let sitemapMounted = false

  // js/utils.js loads first (see index.html script order), so the shared
  // helpers are always available.
  const { escapeHtml, getPrimaryCta } = window.utils

  function getWorkspaceSitemapPanel() {
    return document.getElementById('reviewWorkspaceSitemap')
  }

  function getCurrentKey() {
    return document.getElementById('pageSelect')?.value || state.selectedKey || 'pestsTopic'
  }

  function normalizeType(type) {
    const normalized = String(type || '').toLowerCase()
    if (normalized.includes('topic')) return 'Topic'
    if (normalized.includes('transaction')) return 'Transaction'
    return 'Information'
  }

  function countRelatedLinks(page) {
    let count = 0
    for (const section of page.sections || []) {
      count += Array.isArray(section.cards) ? section.cards.length : 0
      count += section.button ? 1 : 0
      for (const step of section.steps || []) {
        count += step.button ? 1 : 0
      }
    }
    return count
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

  function getCluster(key, page) {
    const title = String(page.title || '').toLowerCase()
    const summary = String(page.summary || '').toLowerCase()
    const haystack = `${key} ${title} ${summary}`

    if (key === 'pestsTopic') return 'Topic landing page'
    if (
      key === 'recordsHub' ||
      key === 'ownerHub' ||
      title.includes('look up') ||
      title.includes('lookup') ||
      title.includes('find complaints') ||
      title.includes('find residential hotel') ||
      title.includes('find your district') ||
      title.includes('public records') ||
      title.includes('notice of violation')
    )
      return 'Look up records'
    if (
      title.includes('pigeon') ||
      title.includes('raccoon') ||
      title.includes('mite') ||
      title.includes('dead bird') ||
      title.includes('mosquito control') ||
      title.includes('mosquito education workshop')
    )
      return 'Vector and wildlife information'
    if (title.includes('report') || haystack.includes('fee')) return 'Report or pay'
    if (
      title.includes('prevent') ||
      title.includes('keep') ||
      title.includes('integrated pest management') ||
      title.includes('rules')
    )
      return 'Prevent problems'
    if (title.includes('inspect') || title.includes('after') || title.includes('rights'))
      return 'Inspection and rights'
    return 'Information and education'
  }

  function getPageRows() {
    const graph = getLinkGraph()
    return DATA.order.map(([key, label]) => {
      const page = DATA.pages[key] || {}
      return {
        key,
        label,
        page,
        type: normalizeType(page.type || label),
        cluster: getCluster(key, page),
        incomingCount: graph[key]?.incoming?.size || 0,
        outgoingCount: graph[key]?.outgoing?.size || 0,
      }
    })
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

  function getSelectedRow() {
    const key = getCurrentKey()
    return getPageRows().find((row) => row.key === key) || getPageRows()[0]
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

      .sitemap-reset-button {
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
      .sitemap-reset-button:focus-visible {
        border-color: var(--sfds-action-blue);
        background: var(--sfds-blue-soft-bg);
      }

      .sitemap-filter-bar {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
        align-items: center;
      }

      .sitemap-filter-button,
      .sitemap-node-button {
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
      .sitemap-node-button:hover,
      .sitemap-node-button.active {
        border-color: var(--sfds-action-blue);
        background: var(--sfds-blue-soft-bg);
        color: var(--sfds-action-blue-hover);
      }

      .interactive-sitemap-layout {
        display: grid;
        grid-template-columns: minmax(0, 1.4fr) minmax(17rem, 0.8fr);
        gap: 1rem;
      }

      .sitemap-tree {
        border: 1px solid var(--sfds-border);
        border-radius: var(--radius);
        background: var(--sfds-white);
        padding: 0.9rem;
        overflow-x: auto;
      }

      .sitemap-toolbar {
        display: flex;
        gap: 0.5rem;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.7rem;
        flex-wrap: wrap;
      }

      .sitemap-root {
        display: grid;
        justify-items: center;
        margin-bottom: 0.8rem;
      }

      .sitemap-branches {
        display: grid;
        grid-template-columns: repeat(4, minmax(9rem, 1fr));
        gap: 0.75rem;
        min-width: 42rem;
      }

      .sitemap-cluster {
        position: relative;
        border-top: 2px solid var(--sfds-border);
        padding-top: 0.8rem;
      }

      .sitemap-cluster-title {
        margin: 0 0 0.45rem;
        color: var(--sfds-slate-3);
        font-size: 0.72rem;
        font-weight: 900;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        display: flex;
        align-items: center;
        gap: 0.45rem;
      }

      .sitemap-cluster-count {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 1.2rem;
        height: 1.2rem;
        padding: 0 0.25rem;
        border-radius: 999px;
        background: var(--sfds-slate-5);
        color: var(--sfds-slate-2);
        font-size: 0.65rem;
        font-weight: 900;
      }

      .sitemap-node-list {
        display: grid;
        gap: 0.4rem;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .sitemap-node-button {
        width: 100%;
        min-height: 2.65rem;
        padding: 0.5rem 0.6rem;
        text-align: left;
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
      }

      .sitemap-node-title {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        color: var(--sfds-slate-1);
        font-size: 0.78rem;
        font-weight: 800;
        line-height: 1.25;
      }

      .sitemap-node-meta {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        color: var(--sfds-slate-3);
        font-size: 0.68rem;
        line-height: 1.25;
        flex-wrap: wrap;
      }

      .sitemap-node-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.15rem;
        padding: 0.08rem 0.3rem;
        border-radius: 999px;
        background: var(--sfds-slate-5);
        color: var(--sfds-slate-2);
        font-size: 0.62rem;
        font-weight: 900;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .sitemap-node-highlight {
        box-shadow: 0 0 0 2px var(--sfds-action-blue);
      }

      .sitemap-node-links-annotation {
        font-size: 0.65rem;
        color: var(--sfds-slate-3);
        margin-top: 0.1rem;
      }

      .sitemap-node-button[data-page-type='Topic'] {
        border-left: 4px solid var(--sfds-action-blue);
      }

      .sitemap-node-button[data-page-type='Transaction'] {
        border-left: 4px solid var(--sfds-green);
      }

      .sitemap-node-button[data-page-type='Information'] {
        border-left: 4px solid var(--sfds-warning-border);
      }

      .sitemap-detail-card {
        border: 1px solid var(--sfds-border);
        border-radius: var(--radius);
        background: var(--sfds-white);
        padding: 0.9rem;
        position: sticky;
        top: 0.5rem;
      }

      .sitemap-detail-header {
        display: flex;
        justify-content: space-between;
        gap: 0.5rem;
        align-items: flex-start;
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

      .sitemap-toggle-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
      }

      .sitemap-toggle {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        font: inherit;
        font-size: 0.78rem;
        font-weight: 700;
        color: var(--sfds-action-blue);
        background: var(--sfds-white);
        border: 1px solid var(--sfds-border);
        border-radius: var(--radius);
        padding: 0.35rem 0.6rem;
        cursor: pointer;
      }

      .sitemap-toggle[aria-pressed='true'] {
        background: var(--sfds-blue-soft-bg);
        border-color: var(--sfds-action-blue);
      }

      @media (max-width: 980px) {
        .interactive-sitemap-header,
        .interactive-sitemap-layout,
        .sitemap-toolbar,
        .sitemap-search-bar {
          grid-template-columns: 1fr;
        }

        .interactive-sitemap-header {
          display: grid;
        }

        .sitemap-branches {
          grid-template-columns: repeat(2, minmax(10rem, 1fr));
          min-width: 0;
        }
      }

      @media (max-width: 640px) {
        .sitemap-branches {
          grid-template-columns: 1fr;
        }
        .sitemap-search-input {
          width: 100%;
        }
      }
    `

    document.head.appendChild(style)
  }

  function renderSearchAndFilters() {
    const filters = ['All', 'Topic', 'Transaction', 'Information']
    const clearLabel = state.search ? '✕ Clear search' : ''
    const isEmpty = state.search.trim().length > 0 && getFilteredRows().length === 0
    return `
      <div class="sitemap-search-bar">
        <input type="search" class="sitemap-search-input" value="${escapeHtml(state.search)}" placeholder="Search pages by title, slug, or keyword..." aria-label="Search sitemap pages" autocomplete="off" />
        <button type="button" class="sitemap-reset-button" data-sitemap-action="clear-search" ${clearLabel ? '' : 'hidden'}>${escapeHtml(clearLabel || '')}</button>
        <button type="button" class="sitemap-reset-button" data-sitemap-action="go-to-current">Go to current page</button>
      </div>
      <div class="sitemap-filter-bar" aria-label="Sitemap page type filters">
        ${filters
          .map(
            (filter) => `
          <button type="button" class="sitemap-filter-button ${state.filter === filter ? 'active' : ''}" data-sitemap-filter="${filter}" aria-pressed="${state.filter === filter ? 'true' : 'false'}">
            ${escapeHtml(filter)} ${filter !== 'All' ? `(${getPageRows().filter((r) => r.type === filter).length})` : `(${getPageRows().length})`}
          </button>
        `
          )
          .join('')}
      </div>
      ${isEmpty ? '<p style="color:var(--sfds-slate-3);font-size:0.8rem;margin:0.4rem 0 0;">No pages match your search or filter. Try adjusting your terms.</p>' : ''}
    `
  }

  function renderNode(row, isRoot = false) {
    const active = row.key === getCurrentKey()
    const graph = getLinkGraph()
    const isHighlighted =
      state.showLinksFromSelected && graph[getCurrentKey()]?.outgoing?.has(row.key)
    const pageref = row.page
    return `
      <button type="button" class="sitemap-node-button ${active ? 'active' : ''} ${isHighlighted ? 'sitemap-node-highlight' : ''}" data-sitemap-key="${escapeHtml(row.key)}" data-page-type="${escapeHtml(row.type)}" ${active ? 'aria-current="page"' : ''}>
        <span class="sitemap-node-title">${escapeHtml(pageref.title || row.label)}</span>
        <span class="sitemap-node-meta">
          <span class="sitemap-node-badge">${escapeHtml(isRoot ? 'Topic' : row.type)}</span>
          <span>· ${escapeHtml(row.key)}</span>
          <span class="sitemap-node-badge" title="${escapeHtml(isRoot ? 'Current topic landing page' : row.type + ' page')}">${escapeHtml(isRoot ? 'Landing' : row.type)}</span>
          ${!isRoot && row.outgoingCount ? `<span class="sitemap-node-badge" title="Links to ${row.outgoingCount} page(s)">→${row.outgoingCount}</span>` : ''}
          ${!isRoot && row.incomingCount ? `<span class="sitemap-node-badge" title="Linked from ${row.incomingCount} page(s)">←${row.incomingCount}</span>` : ''}
        </span>
        ${!isRoot && row.outgoingCount ? `<span class="sitemap-node-links-annotation">Links to ${row.outgoingCount} page(s)</span>` : ''}
      </button>
    `
  }

  function renderTree() {
    const rows = getFilteredRows()
    const root = getPageRows().find((row) => row.key === 'pestsTopic') || getPageRows()[0]
    const clusters = [
      'Topic landing page',
      'Report or pay',
      'Prevent problems',
      'Inspection and rights',
      'Information and education',
    ]

    const clusterTitles = {
      'Topic landing page': 'Topic landing page',
      'Report or pay': 'Report or pay',
      'Prevent problems': 'Prevent problems',
      'Inspection and rights': 'Inspection and rights',
      'Information and education': 'Information and education',
    }

    const rootCluster = 'Topic landing page'

    return `
      <div class="sitemap-tree" role="group" aria-label="Interactive HHVC sitemap tree">
        <div class="sitemap-toolbar">
          <div class="sitemap-toggle-row" style="flex:1 1 auto;">
            <button type="button" class="sitemap-toggle" data-sitemap-action="toggle-links" aria-pressed="${state.showLinksFromSelected ? 'true' : 'false'}">
              ${state.showLinksFromSelected ? 'Hide links from selected page' : 'Show links from selected page'}
            </button>
          </div>
          ${renderSearchAndFilters()}
        </div>
        <div class="sitemap-root">${root ? renderNode(root, true) : ''}</div>
        <div class="sitemap-branches">
          ${clusters
            .filter((c) => c !== rootCluster)
            .map((cluster) => {
              const clusterRows = rows.filter(
                (row) => row.key !== root?.key && row.cluster === cluster
              )
              const totalInCluster = getPageRows().filter(
                (row) => row.key !== root?.key && row.cluster === cluster
              ).length
              return `
              <section class="sitemap-cluster" aria-label="${escapeHtml(cluster)}">
                <p class="sitemap-cluster-title">${escapeHtml(cluster)} <span class="sitemap-cluster-count">${clusterRows.length}${totalInCluster !== clusterRows.length ? '/' + totalInCluster : ''}</span></p>
                <ul class="sitemap-node-list">
                  ${clusterRows.length ? clusterRows.map((row) => `<li>${renderNode(row)}</li>`).join('') : '<li><span class="sitemap-node-meta">No pages match this filter.</span></li>'}
                </ul>
              </section>
            `
            })
            .join('')}
        </div>
      </div>
    `
  }

  function renderLinkChips(title, targets) {
    if (!targets || !targets.length) return ''
    const graph = getLinkGraph()
    return `
      <div class="sitemap-link-section">
        <h5>${escapeHtml(title)}</h5>
        <div class="sitemap-link-chips">
          ${targets
            .map((target) => {
              const page = DATA.pages[target]
              const label = page ? escapeHtml(page.title || target) : escapeHtml(target)
              const incoming = graph[target]?.incoming?.size || 0
              const outgoing = graph[target]?.outgoing?.size || 0
              return `<button type="button" class="sitemap-link-chip" data-sitemap-key="${escapeHtml(target)}" data-sitemap-action="open-link">${label} <span class="sitemap-node-badge" title="Links to ${outgoing}, linked from ${incoming}">→${outgoing} ←${incoming}</span></button>`
            })
            .join('')}
        </div>
      </div>
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
        <div class="sitemap-detail-header">
          <div>
            <h4>${escapeHtml(page.title || row.label)}</h4>
            <p>${escapeHtml(page.summary || 'No summary available.')}</p>
          </div>
        </div>
        <ul class="sitemap-detail-list">
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

  // The panel mounts into the Sitemap workspace tab and renders lazily the first
  // time that tab is opened, so the 17-node tree is not built while collapsed.
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
          <h3>Interactive sitemap</h3>
          <p>Select a node to open that page mockup. Search, filter by page type, or spotlight linked pages to confirm the HHVC topic structure and navigation flow.</p>
        </div>
      </div>
      <div class="interactive-sitemap-layout">
        ${renderTree()}
        ${renderDetail()}
      </div>
    `
  }

  function rerender() {
    injectStyles()
    state.selectedKey = getCurrentKey()
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
        const firstNode = document.querySelector('.sitemap-node-button')
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

    const focusedNode = document.activeElement?.closest('.sitemap-node-button')
    if (!focusedNode) return

    const nodes = Array.from(document.querySelectorAll('.sitemap-node-button'))
    const index = nodes.indexOf(focusedNode)

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      const next = nodes[index + 1]
      if (next) next.focus()
      return
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      const prev = nodes[index - 1]
      if (prev) prev.focus()
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

  // Re-render when the mockup page changes, instead of inferring "something
  // changed" by observing #reviewDashboard mutations. renderPage is defined
  // by js/page-render.js and may already be wrapped by js/ux-improvements.js;
  // wrapping preserves whatever wrapper ran before this one.
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
