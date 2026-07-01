/* Interactive HHVC sitemap diagram.
   Uses existing HHVC_DATA and renderPage() so nodes can open page mockups directly. */
(function mountInteractiveSitemap() {
  const DATA = window.HHVC_DATA;
  if (!DATA || !DATA.pages || !DATA.order) return;

  const PANEL_ID = 'interactiveSitemapPanel';
  const STYLE_ID = 'interactiveSitemapStyles';
  const state = {
    filter: 'All',
    selectedKey: document.getElementById('pageSelect')?.value || 'pestsTopic'
  };

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function getCurrentKey() {
    return document.getElementById('pageSelect')?.value || state.selectedKey || 'pestsTopic';
  }

  function normalizeType(type) {
    const normalized = String(type || '').toLowerCase();
    if (normalized.includes('topic')) return 'Topic';
    if (normalized.includes('transaction')) return 'Transaction';
    return 'Information';
  }

  function getPrimaryCta(page) {
    for (const section of page.sections || []) {
      if (section.button) return section.button;
      for (const step of section.steps || []) {
        if (step.button) return step.button;
      }
    }
    return page.primaryCta || '';
  }

  function countLinks(page) {
    let count = 0;
    for (const section of page.sections || []) {
      count += Array.isArray(section.cards) ? section.cards.length : 0;
      count += section.button ? 1 : 0;
      for (const step of section.steps || []) {
        count += step.button ? 1 : 0;
      }
    }
    return count;
  }

  function getCluster(key, page) {
    const title = String(page.title || '').toLowerCase();
    const summary = String(page.summary || '').toLowerCase();
    const haystack = `${key} ${title} ${summary}`;

    if (key === 'pestsTopic') return 'Topic landing page';
    if (title.includes('report') || haystack.includes('fee')) return 'Report or pay';
    if (title.includes('prevent') || title.includes('keep') || title.includes('integrated pest management') || title.includes('rules')) return 'Prevent problems';
    if (title.includes('inspect') || title.includes('after') || title.includes('rights')) return 'Inspection and rights';
    return 'Information and education';
  }

  function getPageRows() {
    return DATA.order.map(([key, label]) => {
      const page = DATA.pages[key] || {};
      return {
        key,
        label,
        page,
        type: normalizeType(page.type || label),
        cluster: getCluster(key, page)
      };
    });
  }

  function getFilteredRows() {
    return getPageRows().filter(row => state.filter === 'All' || row.type === state.filter);
  }

  function getSelectedRow() {
    const key = getCurrentKey();
    return getPageRows().find(row => row.key === key) || getPageRows()[0];
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
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
      }

      .interactive-sitemap-header h3 {
        margin: 0 0 0.25rem;
        font-size: 1rem;
      }

      .interactive-sitemap-header p {
        margin: 0;
        color: #5a5c5c;
        font-size: 0.8rem;
        line-height: 1.35;
      }

      .sitemap-filter-bar {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
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
        background: #f1f4ff;
        color: var(--sfds-action-blue-hover);
      }

      .interactive-sitemap-layout {
        display: grid;
        grid-template-columns: minmax(0, 1.4fr) minmax(16rem, 0.8fr);
        gap: 1rem;
      }

      .sitemap-tree {
        border: 1px solid var(--sfds-border);
        border-radius: var(--radius);
        background: #fbfcfe;
        padding: 0.9rem;
        overflow-x: auto;
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
        color: #5a5c5c;
        font-size: 0.72rem;
        font-weight: 900;
        letter-spacing: 0.05em;
        text-transform: uppercase;
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
      }

      .sitemap-node-title {
        display: block;
        color: var(--sfds-slate-1);
        font-size: 0.78rem;
        font-weight: 800;
        line-height: 1.25;
      }

      .sitemap-node-meta {
        display: block;
        margin-top: 0.15rem;
        color: #5a5c5c;
        font-size: 0.68rem;
        line-height: 1.25;
      }

      .sitemap-node-button[data-page-type='Topic'] {
        border-left: 4px solid var(--sfds-action-blue);
      }

      .sitemap-node-button[data-page-type='Transaction'] {
        border-left: 4px solid var(--sfds-green);
      }

      .sitemap-node-button[data-page-type='Information'] {
        border-left: 4px solid #b7791f;
      }

      .sitemap-detail-card {
        border: 1px solid var(--sfds-border);
        border-radius: var(--radius);
        background: #fbfcfe;
        padding: 0.9rem;
      }

      .sitemap-detail-card h4 {
        margin: 0 0 0.35rem;
        font-size: 1rem;
      }

      .sitemap-detail-card p {
        margin: 0 0 0.65rem;
        color: #383939;
        font-size: 0.86rem;
        line-height: 1.4;
      }

      .sitemap-detail-list {
        display: grid;
        gap: 0.45rem;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .sitemap-detail-list li {
        border-top: 1px solid var(--sfds-border);
        margin: 0;
        padding-top: 0.45rem;
        color: #383939;
        font-size: 0.78rem;
        line-height: 1.35;
      }

      .sitemap-detail-list strong {
        color: var(--sfds-slate-1);
      }

      @media (max-width: 980px) {
        .interactive-sitemap-header,
        .interactive-sitemap-layout {
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
      }
    `;

    document.head.appendChild(style);
  }

  function renderFilterButtons() {
    return ['All', 'Topic', 'Transaction', 'Information'].map(filter => `
      <button type="button" class="sitemap-filter-button ${state.filter === filter ? 'active' : ''}" data-sitemap-filter="${filter}" aria-pressed="${state.filter === filter ? 'true' : 'false'}">
        ${escapeHtml(filter)}
      </button>
    `).join('');
  }

  function renderNode(row, isRoot = false) {
    const active = row.key === getCurrentKey();
    return `
      <button type="button" class="sitemap-node-button ${active ? 'active' : ''}" data-sitemap-key="${escapeHtml(row.key)}" data-page-type="${escapeHtml(row.type)}" ${active ? 'aria-current="page"' : ''}>
        <span class="sitemap-node-title">${escapeHtml(row.page.title || row.label)}</span>
        <span class="sitemap-node-meta">${escapeHtml(isRoot ? 'Current topic landing page' : row.type + ' page')} · ${escapeHtml(row.key)}</span>
      </button>
    `;
  }

  function renderTree() {
    const rows = getFilteredRows();
    const root = getPageRows().find(row => row.key === 'pestsTopic') || getPageRows()[0];
    const clusters = ['Report or pay', 'Prevent problems', 'Inspection and rights', 'Information and education'];

    return `
      <div class="sitemap-tree" role="group" aria-label="Interactive HHVC sitemap tree">
        <div class="sitemap-root">${root ? renderNode(root, true) : ''}</div>
        <div class="sitemap-branches">
          ${clusters.map(cluster => {
            const clusterRows = rows.filter(row => row.key !== root?.key && row.cluster === cluster);
            return `
              <section class="sitemap-cluster" aria-label="${escapeHtml(cluster)}">
                <p class="sitemap-cluster-title">${escapeHtml(cluster)}</p>
                <ul class="sitemap-node-list">
                  ${clusterRows.length ? clusterRows.map(row => `<li>${renderNode(row)}</li>`).join('') : '<li><span class="sitemap-node-meta">No pages match this filter.</span></li>'}
                </ul>
              </section>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  function renderDetail() {
    const row = getSelectedRow();
    if (!row) return '';

    const page = row.page;
    const primaryCta = getPrimaryCta(page) || 'None set';
    const audienceCount = Array.isArray(page.audience) ? page.audience.length : 0;
    const relatedCount = countLinks(page);

    return `
      <aside class="sitemap-detail-card" aria-label="Selected sitemap page details">
        <h4>${escapeHtml(page.title || row.label)}</h4>
        <p>${escapeHtml(page.summary || 'No summary available.')}</p>
        <ul class="sitemap-detail-list">
          <li><strong>Page type:</strong> ${escapeHtml(row.type)}</li>
          <li><strong>Reading target:</strong> ${escapeHtml(page.reading || 'Not set')}</li>
          <li><strong>Primary CTA:</strong> ${escapeHtml(primaryCta)}</li>
          <li><strong>Audience entries:</strong> ${audienceCount}</li>
          <li><strong>Linked items:</strong> ${relatedCount}</li>
          <li><strong>URL slug:</strong> ${escapeHtml(page.slug || 'Not set')}</li>
        </ul>
      </aside>
    `;
  }

  function renderPanel() {
    const dashboard = document.getElementById('reviewDashboard');
    if (!dashboard) return;

    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement('section');
      panel.id = PANEL_ID;
      panel.className = 'interactive-sitemap-panel';
      panel.setAttribute('aria-label', 'Interactive sitemap diagram');
    }

    panel.innerHTML = `
      <div class="interactive-sitemap-header">
        <div>
          <h3>Interactive sitemap</h3>
          <p>Select a node to open that page mockup. Use filters to review page types and confirm the HHVC topic structure.</p>
        </div>
        <div class="sitemap-filter-bar" aria-label="Sitemap page type filters">
          ${renderFilterButtons()}
        </div>
      </div>
      <div class="interactive-sitemap-layout">
        ${renderTree()}
        ${renderDetail()}
      </div>
    `;

    const guidancePanel = document.getElementById('dashboardGuidancePanel');
    if (guidancePanel) {
      guidancePanel.insertAdjacentElement('afterend', panel);
      return;
    }

    const compliancePanel = dashboard.querySelector('.compliance-panel');
    if (compliancePanel) {
      compliancePanel.insertAdjacentElement('afterend', panel);
      return;
    }

    dashboard.appendChild(panel);
  }

  function rerender() {
    injectStyles();
    state.selectedKey = getCurrentKey();
    renderPanel();
  }

  function handleClick(event) {
    const filterButton = event.target.closest('[data-sitemap-filter]');
    if (filterButton) {
      state.filter = filterButton.getAttribute('data-sitemap-filter') || 'All';
      rerender();
      return;
    }

    const nodeButton = event.target.closest('[data-sitemap-key]');
    if (nodeButton) {
      const key = nodeButton.getAttribute('data-sitemap-key');
      if (!key || !DATA.pages[key]) return;
      state.selectedKey = key;
      window.renderPage?.(key);
      window.setTimeout(rerender, 0);
    }
  }

  function observeDashboard() {
    const dashboard = document.getElementById('reviewDashboard');
    if (!dashboard || dashboard.dataset.sitemapObserved === 'true') return;

    dashboard.dataset.sitemapObserved = 'true';
    const observer = new MutationObserver(() => {
      window.requestAnimationFrame(rerender);
    });
    observer.observe(dashboard, { childList: true, subtree: false });
  }

  function init() {
    injectStyles();
    document.addEventListener('click', handleClick);
    rerender();
    observeDashboard();
    window.setTimeout(rerender, 0);
    window.setTimeout(rerender, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
