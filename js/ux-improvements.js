/* Manager review UX/UI enhancements.
   Runs after js/app.js and does not change source page content or review export schemas. */
(function improveManagerReviewUx() {
  const DATA = window.HHVC_DATA;
  if (!DATA || !DATA.pages || !DATA.order) return;

  const SEO_TITLE_LIMIT = 60;
  const META_DESCRIPTION_LIMIT = 110;
  const DASHBOARD_ID = 'reviewDashboard';

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function getValue(id) {
    return document.getElementById(id)?.value || '';
  }

  function getCurrentKey() {
    return document.getElementById('pageSelect')?.value || 'pestsTopic';
  }

  function getCurrentPage() {
    return DATA.pages[getCurrentKey()] || {};
  }

  function defaultSeoTitle(page) {
    return page.seoTitle || `${page.title || ''} | San Francisco`;
  }

  function defaultMetaDescription(page) {
    return page.metaDescription || page.summary || '';
  }

  function getPrimaryCta(page) {
    for (const section of page.sections || []) {
      for (const step of section.steps || []) {
        if (step.button) return step.button;
      }
      if (section.button) return section.button;
    }
    return page.primaryCta || '';
  }

  function getSeoTitle(page) {
    return getValue('seoTitleInput') || defaultSeoTitle(page);
  }

  function getMetaDescription(page) {
    return getValue('metaDescriptionInput') || defaultMetaDescription(page);
  }

  function countRelatedLinks(page) {
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

  function getRuleResults(page) {
    const seoTitle = getSeoTitle(page);
    const metaDescription = getMetaDescription(page);
    const primaryCta = getValue('ctaInput') || getPrimaryCta(page);
    const relatedLinks = countRelatedLinks(page);
    const isTransaction = page.type === 'Transaction page';

    return [
      {
        label: 'Page type',
        pass: Boolean(page.type),
        detail: page.type || 'Missing page type'
      },
      {
        label: 'Title',
        pass: Boolean(page.title) && page.title.length <= 80,
        detail: page.title ? `${page.title.length} characters` : 'Missing title'
      },
      {
        label: 'Summary',
        pass: Boolean(page.summary) && page.summary.length <= 180,
        detail: page.summary ? `${page.summary.length} characters` : 'Missing summary'
      },
      {
        label: 'Audience',
        pass: Array.isArray(page.audience) && page.audience.length > 0,
        detail: Array.isArray(page.audience) ? `${page.audience.length} audience entries` : 'Missing audience section'
      },
      {
        label: 'Primary CTA',
        pass: !isTransaction || Boolean(primaryCta),
        detail: primaryCta || 'Manual check: not required for this page type'
      },
      {
        label: 'Related links',
        pass: relatedLinks >= 3,
        detail: `${relatedLinks} linked cards or action links`
      },
      {
        label: 'SEO title',
        pass: seoTitle.length <= SEO_TITLE_LIMIT,
        detail: `${seoTitle.length}/${SEO_TITLE_LIMIT} characters`
      },
      {
        label: 'Meta description',
        pass: metaDescription.length <= META_DESCRIPTION_LIMIT,
        detail: `${metaDescription.length}/${META_DESCRIPTION_LIMIT} characters`
      },
      {
        label: 'Reading target',
        pass: Boolean(page.reading),
        detail: page.reading || 'Missing reading target'
      }
    ];
  }

  function getStatusChipClass(value) {
    if (value === 'Approved') return 'pass';
    if (value === 'Blocked' || value === 'Revise and resubmit') return 'fail';
    return 'warn';
  }

  function renderReviewDashboard() {
    const dashboard = document.getElementById(DASHBOARD_ID);
    if (!dashboard) return;

    const page = getCurrentPage();
    const decision = getValue('reviewDecision') || 'Needs review';
    const seoTitle = getSeoTitle(page);
    const metaDescription = getMetaDescription(page);
    const rules = getRuleResults(page);
    const passed = rules.filter(rule => rule.pass).length;
    const reviewReady = decision === 'Approved' && passed === rules.length;
    const chipClass = reviewReady ? 'pass' : getStatusChipClass(decision);
    const primaryCta = getValue('ctaInput') || getPrimaryCta(page) || 'None set';

    dashboard.innerHTML = `
      <div class="review-dashboard-header">
        <div>
          <p class="review-dashboard-title">Manager review dashboard</p>
          <p class="review-decision-note">Live checks update as you edit title, summary, CTA, and search metadata.</p>
        </div>
        <div class="review-dashboard-meta" aria-label="Current review status">
          <span class="status-chip ${chipClass}">${escapeHtml(decision)}</span>
          <span class="status-chip ${passed === rules.length ? 'pass' : 'warn'}">${passed}/${rules.length} checks</span>
        </div>
      </div>
      <div class="review-dashboard-grid">
        ${renderMetric('Page type', page.type || 'Missing', 'Karl placement')}
        ${renderMetric('Reading target', page.reading || 'Missing', 'Plain-language target')}
        ${renderMetric('Primary CTA', primaryCta, isLong(primaryCta) ? 'Review label length' : 'Next-step clarity')}
        ${renderMetric('SEO title', `${seoTitle.length}/${SEO_TITLE_LIMIT}`, seoTitle.length <= SEO_TITLE_LIMIT ? 'Ready' : 'Too long')}
        ${renderMetric('Meta description', `${metaDescription.length}/${META_DESCRIPTION_LIMIT}`, metaDescription.length <= META_DESCRIPTION_LIMIT ? 'Ready' : 'Too long')}
        ${renderMetric('Related links', String(countRelatedLinks(page)), 'Dead-end prevention')}
        ${renderMetric('Audience entries', String(Array.isArray(page.audience) ? page.audience.length : 0), 'This page can help if...')}
        ${renderMetric('Page key', getCurrentKey(), 'Workbook sync field')}
      </div>
      <div class="compliance-panel">
        <h3>Karl compliance scorecard</h3>
        <ul class="compliance-list">
          ${rules.map(rule => `
            <li class="compliance-item ${rule.pass ? 'pass' : 'warn'}">
              <span>
                <span class="compliance-rule">${escapeHtml(rule.label)}</span>
                <span class="compliance-detail">${escapeHtml(rule.detail)}</span>
              </span>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  function renderMetric(label, value, help) {
    return `
      <div class="metric-card">
        <span class="metric-label">${escapeHtml(label)}</span>
        <span class="metric-value">${escapeHtml(value)}</span>
        <span class="metric-help">${escapeHtml(help)}</span>
      </div>
    `;
  }

  function isLong(value) {
    return String(value || '').length > 36;
  }

  function mountDashboard() {
    const toolbar = document.querySelector('.canvas-toolbar');
    if (!toolbar || document.getElementById(DASHBOARD_ID)) return;

    const dashboard = document.createElement('section');
    dashboard.id = DASHBOARD_ID;
    dashboard.className = 'review-dashboard';
    dashboard.setAttribute('aria-label', 'Manager review dashboard');
    toolbar.appendChild(dashboard);
  }

  function pageSearchItems(query) {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return DATA.order.slice(0, 5);

    return DATA.order
      .filter(([key, label]) => {
        const page = DATA.pages[key] || {};
        const haystack = `${key} ${label} ${page.title || ''} ${page.type || ''} ${page.summary || ''}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .slice(0, 6);
  }

  function renderPageQuickList() {
    const input = document.getElementById('pageFilterInput');
    const list = document.getElementById('pageQuickList');
    if (!input || !list) return;

    const items = pageSearchItems(input.value);
    list.innerHTML = items.map(([key, label]) => {
      const page = DATA.pages[key] || {};
      const type = page.type || label.split(':')[0] || 'Page';
      return `
        <button type="button" class="page-quick-button" data-page-key="${escapeHtml(key)}">
          ${escapeHtml(page.title || label)}
          <span class="page-quick-type">${escapeHtml(type)} · ${escapeHtml(key)}</span>
        </button>
      `;
    }).join('');
  }

  function mountPageSearch() {
    const select = document.getElementById('pageSelect');
    const selectLabel = document.querySelector('label[for="pageSelect"]');
    if (!select || !selectLabel || document.getElementById('pageFilterInput')) return;

    const control = document.createElement('div');
    control.className = 'page-filter-control';
    control.innerHTML = `
      <label for="pageFilterInput">Find a page fast</label>
      <input id="pageFilterInput" type="search" aria-label="Search page mockups" placeholder="Search by page title, type, or page key">
      <div id="pageQuickList" class="page-quick-list" aria-label="Quick page results"></div>
    `;
    selectLabel.parentNode.insertBefore(control, selectLabel);

    document.getElementById('pageFilterInput')?.addEventListener('input', renderPageQuickList);
    document.getElementById('pageQuickList')?.addEventListener('click', event => {
      const button = event.target.closest('[data-page-key]');
      if (!button) return;
      window.renderPage?.(button.getAttribute('data-page-key'));
      renderReviewDashboard();
    });
    renderPageQuickList();
  }

  function buildReviewSummary() {
    const page = getCurrentPage();
    const seoTitle = getSeoTitle(page);
    const metaDescription = getMetaDescription(page);
    const rules = getRuleResults(page);
    const passed = rules.filter(rule => rule.pass).length;

    return [
      'HHVC manager review summary',
      `Page: ${page.title || ''}`,
      `Page key: ${getCurrentKey()}`,
      `Type: ${page.type || ''}`,
      `URL: https://${getValue('urlInput') || page.slug || ''}`,
      `Decision: ${getValue('reviewDecision') || 'Needs review'}`,
      `Checks: ${passed}/${rules.length}`,
      `SEO title: ${seoTitle} (${seoTitle.length}/${SEO_TITLE_LIMIT})`,
      `Meta description: ${metaDescription} (${metaDescription.length}/${META_DESCRIPTION_LIMIT})`,
      `Reading target: ${page.reading || ''}`,
      `Primary CTA: ${getValue('ctaInput') || getPrimaryCta(page) || ''}`,
      `Reviewer: ${getValue('reviewerInput')}`,
      `Review date: ${getValue('reviewDateInput')}`,
      `Notes: ${getValue('reviewNotes')}`,
      `Risks or blockers: ${getValue('reviewRisks')}`,
      `Follow-up owner: ${getValue('reviewOwner')}`
    ].join('\n');
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
    return Promise.resolve();
  }

  function mountCopySummaryButton() {
    const actions = document.querySelector('.review-actions');
    if (!actions || document.getElementById('copyReviewSummary')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tool-btn copy-summary';
    button.id = 'copyReviewSummary';
    button.textContent = 'Copy review summary';
    actions.appendChild(button);

    button.addEventListener('click', () => {
      copyText(buildReviewSummary()).then(() => {
        const status = document.getElementById('reviewExportStatus');
        if (status) status.textContent = 'Copied review summary to clipboard.';
        if (typeof window.showToast === 'function') {
          window.showToast('Review summary copied', 'success');
        }
      });
    });
  }

  function refreshUx() {
    renderReviewDashboard();
    renderPageQuickList();
  }

  function attachRefreshListeners() {
    const fields = [
      'pageSelect',
      'urlInput',
      'titleInput',
      'descriptionInput',
      'ctaInput',
      'seoTitleInput',
      'metaDescriptionInput',
      'reviewDecision',
      'reviewerInput',
      'reviewDateInput',
      'reviewNotes',
      'reviewRisks',
      'reviewOwner'
    ];

    for (const id of fields) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.addEventListener('input', refreshUx);
      el.addEventListener('change', refreshUx);
    }
  }

  function wrapRenderPage() {
    if (typeof window.renderPage !== 'function' || window.renderPage.__uxWrapped) return;
    const originalRenderPage = window.renderPage;
    window.renderPage = function renderPageWithUxRefresh(key) {
      const result = originalRenderPage.call(this, key);
      window.setTimeout(refreshUx, 0);
      return result;
    };
    window.renderPage.__uxWrapped = true;
  }

  function init() {
    mountDashboard();
    mountPageSearch();
    mountCopySummaryButton();
    attachRefreshListeners();
    wrapRenderPage();
    refreshUx();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
