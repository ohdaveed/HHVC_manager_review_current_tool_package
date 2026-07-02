/* Manager review UX/UI enhancements.
   Runs after js/app.js and does not change source page content or review export schemas. */
;(function improveManagerReviewUx() {
  const DATA = window.HHVC_DATA
  if (!DATA || !DATA.pages || !DATA.order) return

  const SEO_TITLE_LIMIT = 60
  const META_DESCRIPTION_LIMIT = 110
  const DASHBOARD_CORE_ID = 'reviewDashboardCore'
  const STICKY_BAR_ID = 'reviewStickyBar'
  const WORKSPACE_ID = 'reviewWorkspace'
  const STORAGE_KEY = 'hhvcManagerReviewState:v1'
  const STORAGE_VERSION = 1

  const WORKSPACE_TABS = ['queue', 'checks', 'sitemap', 'help']

  let isRestoringState = false

  // js/utils.js loads first (see index.html script order), so the shared
  // helpers are always available.
  const { escapeHtml, getPrimaryCta, setPrimaryCta, today, debounce, toCsv, downloadFile } =
    window.utils
  // Rebuilding the dashboard grid/scorecard and page-search list on every
  // keystroke is wasted work while the reviewer is still typing. Debounce the
  // 'input' path; 'change' (fires on blur) still refreshes immediately so the
  // dashboard is never stale once the reviewer moves on.
  const REFRESH_DEBOUNCE_MS = 300

  function getValue(id) {
    return document.getElementById(id)?.value || ''
  }

  function setValue(id, value) {
    const element = document.getElementById(id)
    if (element) element.value = value ?? ''
  }

  function setText(id, value) {
    const element = document.getElementById(id)
    if (element) element.textContent = value ?? ''
  }

  function getCurrentKey() {
    return document.getElementById('pageSelect')?.value || 'pestsTopic'
  }

  function getCurrentPage() {
    return DATA.pages[getCurrentKey()] || {}
  }

  function defaultSeoTitle(page) {
    return page.seoTitle || `${page.title || ''} | San Francisco`
  }

  function defaultMetaDescription(page) {
    return page.metaDescription || page.summary || ''
  }

  function getSeoTitle(page) {
    return getValue('seoTitleInput') || defaultSeoTitle(page)
  }

  function getMetaDescription(page) {
    return getValue('metaDescriptionInput') || defaultMetaDescription(page)
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

  function getRuleResults(page) {
    const seoTitle = getSeoTitle(page)
    const metaDescription = getMetaDescription(page)
    const primaryCta = getValue('ctaInput') || getPrimaryCta(page)
    const relatedLinks = countRelatedLinks(page)
    const normalizedType = String(page.type || '')
      .trim()
      .toLowerCase()
    const isTransaction = normalizedType === 'transaction' || normalizedType === 'transaction page'

    return [
      {
        label: 'Page type',
        pass: Boolean(page.type),
        detail: page.type || 'Missing page type',
      },
      {
        label: 'Title',
        pass: Boolean(page.title) && page.title.length <= 80,
        detail: page.title ? `${page.title.length} characters` : 'Missing title',
      },
      {
        label: 'Summary',
        pass: Boolean(page.summary) && page.summary.length <= 180,
        detail: page.summary ? `${page.summary.length} characters` : 'Missing summary',
      },
      {
        label: 'Audience',
        pass: Array.isArray(page.audience) && page.audience.length > 0,
        detail: Array.isArray(page.audience)
          ? `${page.audience.length} audience entries`
          : 'Missing audience section',
      },
      {
        label: 'Primary CTA',
        pass: !isTransaction || Boolean(primaryCta),
        detail: primaryCta || 'Manual check: not required for this page type',
      },
      {
        label: 'Related links',
        pass: relatedLinks >= 3,
        detail: `${relatedLinks} linked cards or action links`,
      },
      {
        label: 'SEO title',
        pass: seoTitle.length <= SEO_TITLE_LIMIT,
        detail: `${seoTitle.length}/${SEO_TITLE_LIMIT} characters`,
      },
      {
        label: 'Meta description',
        pass: metaDescription.length <= META_DESCRIPTION_LIMIT,
        detail: `${metaDescription.length}/${META_DESCRIPTION_LIMIT} characters`,
      },
      {
        label: 'Reading target',
        pass: Boolean(page.reading),
        detail: page.reading || 'Missing reading target',
      },
    ]
  }

  function getStatusChipClass(value) {
    if (value === 'Approved') return 'pass'
    if (value === 'Blocked' || value === 'Revise and resubmit') return 'fail'
    return 'warn'
  }

  function getEmptyState() {
    return {
      version: STORAGE_VERSION,
      updated_at: null,
      ui: {},
      globals: {},
      pages: {},
    }
  }

  function readLocalState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return getEmptyState()
      const parsed = JSON.parse(raw)
      if (!parsed || parsed.version !== STORAGE_VERSION) return getEmptyState()

      return {
        ...getEmptyState(),
        ...parsed,
        ui: parsed.ui || {},
        globals: parsed.globals || {},
        pages: parsed.pages || {},
      }
    } catch {
      return getEmptyState()
    }
  }

  function writeLocalState(state) {
    const nextState = {
      ...getEmptyState(),
      ...state,
      version: STORAGE_VERSION,
      updated_at: new Date().toISOString(),
      ui: state.ui || {},
      globals: state.globals || {},
      pages: state.pages || {},
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState))
    } catch (err) {
      // Storage can throw (quota exceeded, private browsing, disabled storage).
      // Surface it to the reviewer instead of failing silently mid-review.
      console.error('Failed to save review state locally:', err)
      window.utils?.showErrorBanner?.(
        'Your last change was not saved locally. Local storage may be full or disabled in this browser.'
      )
    }
    return nextState
  }

  function updateLocalState(updater) {
    const state = readLocalState()
    const updated = updater(state) || state
    return writeLocalState(updated)
  }

  function collectCurrentPageReviewState() {
    const page = getCurrentPage()
    const pageKey = getCurrentKey()
    const seoTitle = getSeoTitle(page)
    const metaDescription = getMetaDescription(page)

    return {
      page_key: pageKey,
      page_title: getValue('titleInput') || page.title || '',
      page_type: page.type || '',
      url_slug: getValue('urlInput') || page.slug || '',
      edited_title: getValue('titleInput') || page.title || '',
      edited_summary: getValue('descriptionInput') || page.summary || '',
      primary_cta: getValue('ctaInput') || getPrimaryCta(page) || '',
      seo_title: seoTitle,
      meta_description: metaDescription,
      reviewer: getValue('reviewerInput'),
      review_date: getValue('reviewDateInput') || today(),
      decision: getValue('reviewDecision') || 'Needs review',
      notes: getValue('reviewNotes'),
      risks_or_blockers: getValue('reviewRisks'),
      follow_up_owner: getValue('reviewOwner'),
      reading_target: page.reading || '',
      updated_at: new Date().toISOString(),
    }
  }

  function saveCurrentPageToLocalStorage() {
    if (isRestoringState) return

    const snapshot = collectCurrentPageReviewState()
    updateLocalState((state) => {
      state.ui.last_page_key = snapshot.page_key
      state.ui.show_karl_tags = document.getElementById('tagToggle')?.checked !== false
      state.globals.reviewer = snapshot.reviewer
      state.pages[snapshot.page_key] = snapshot
      return state
    })

    updateLocalStorageStatus()
  }

  function clearReviewFieldsForNewPage() {
    setValue('reviewDateInput', today())
    setValue('reviewDecision', 'Needs review')
    setValue('reviewNotes', '')
    setValue('reviewRisks', '')
    setValue('reviewOwner', '')
  }

  function updateMockupTextFromSavedState(page, saved) {
    if (saved.edited_title) {
      page.title = saved.edited_title
      setValue('titleInput', saved.edited_title)
      const h1 = document.querySelector('#mockPage h1')
      if (h1) h1.textContent = saved.edited_title
    }

    if (saved.edited_summary) {
      page.summary = saved.edited_summary
      setValue('descriptionInput', saved.edited_summary)
      const summary = document.querySelector('#mockPage .summary')
      if (summary) summary.textContent = saved.edited_summary
    }

    if (saved.primary_cta) {
      setPrimaryCta(page, saved.primary_cta)
      setValue('ctaInput', saved.primary_cta)
      const primaryButton = document.querySelector('#mockPage .btn:not(.secondary)')
      if (primaryButton) {
        const tag =
          typeof window.karlTag === 'function'
            ? window.karlTag('Button label: Primary CTA', 'placement')
            : ''
        primaryButton.innerHTML = tag + escapeHtml(saved.primary_cta)
      }
    }

    if (saved.seo_title) {
      page.seoTitle = saved.seo_title
      page.seoTitleEdited = true
      setValue('seoTitleInput', saved.seo_title)
    }

    if (saved.meta_description) {
      page.metaDescription = saved.meta_description
      page.metaDescriptionEdited = true
      setValue('metaDescriptionInput', saved.meta_description)
    }

    if (saved.url_slug) {
      setValue('urlInput', saved.url_slug)
      setText('browserUrl', `https://${saved.url_slug}`)
    }

    if (typeof window.updateSearchPreview === 'function') window.updateSearchPreview()
  }

  function applySavedPageState(pageKey) {
    const state = readLocalState()
    const page = DATA.pages[pageKey]
    if (!page) return

    isRestoringState = true
    const saved = state.pages[pageKey]

    setValue(
      'reviewerInput',
      state.globals.reviewer || saved?.reviewer || getValue('reviewerInput')
    )

    if (saved) {
      setValue('reviewDateInput', saved.review_date || today())
      setValue('reviewDecision', saved.decision || 'Needs review')
      setValue('reviewNotes', saved.notes || '')
      setValue('reviewRisks', saved.risks_or_blockers || '')
      setValue('reviewOwner', saved.follow_up_owner || '')
      updateMockupTextFromSavedState(page, saved)
    } else {
      clearReviewFieldsForNewPage()
    }

    isRestoringState = false
    updateLocalStorageStatus()
  }

  function applySavedUiPreferences() {
    const state = readLocalState()
    const tagToggle = document.getElementById('tagToggle')
    if (tagToggle && typeof state.ui.show_karl_tags === 'boolean') {
      tagToggle.checked = state.ui.show_karl_tags
      document.body.classList.toggle('hide-karl-tags', !tagToggle.checked)
    }
  }

  function updateLocalStorageStatus() {
    const status = document.getElementById('localStorageStatus')
    if (!status) return

    const state = readLocalState()
    const savedCount = Object.keys(state.pages || {}).length
    const updatedAt = state.updated_at ? new Date(state.updated_at) : null
    const updatedLabel = updatedAt
      ? updatedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : 'not saved yet'

    status.textContent = `${savedCount} page review${savedCount === 1 ? '' : 's'} saved locally. Last save: ${updatedLabel}.`
  }

  function renderReviewDashboard() {
    const dashboard = document.getElementById(DASHBOARD_CORE_ID)
    if (!dashboard) return

    const page = getCurrentPage()
    const seoTitle = getSeoTitle(page)
    const metaDescription = getMetaDescription(page)
    const rules = getRuleResults(page)
    const primaryCta = getValue('ctaInput') || getPrimaryCta(page) || 'None set'

    dashboard.innerHTML = `
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
        <p class="review-decision-note">Live checks update as you edit title, summary, CTA, and search metadata in the sidebar.</p>
        <ul class="compliance-list">
          ${rules
            .map(
              (rule) => `
            <li class="compliance-item ${rule.pass ? 'pass' : 'warn'}">
              <span>
                <span class="compliance-rule">${escapeHtml(rule.label)}</span>
                <span class="compliance-detail">${escapeHtml(rule.detail)}</span>
              </span>
            </li>
          `
            )
            .join('')}
        </ul>
      </div>
    `
  }

  function renderStickyBar() {
    const bar = document.getElementById(STICKY_BAR_ID)
    if (!bar) return

    const page = getCurrentPage()
    const decision = getValue('reviewDecision') || 'Needs review'
    const rules = getRuleResults(page)
    const passed = rules.filter((rule) => rule.pass).length
    const reviewReady = decision === 'Approved' && passed === rules.length
    const chipClass = reviewReady ? 'pass' : getStatusChipClass(decision)
    const stats = window.reviewQueue?.getQueueStats?.() || { reviewed: 0, total: DATA.order.length }
    const filter = window.reviewQueue?.getFilter?.() || 'All'
    const prevKey = window.reviewQueue?.getAdjacentKey?.(-1, filter)
    const nextKey = window.reviewQueue?.getAdjacentKey?.(1, filter)
    const state = readLocalState()
    const workspaceOpen = Boolean(state.ui.workspace_open)

    bar.innerHTML = `
      <div class="review-sticky-bar-main">
        <p class="review-sticky-bar-title">${escapeHtml(page.title || getCurrentKey())}</p>
        <span class="status-chip ${chipClass}">${escapeHtml(decision)}</span>
        <span class="status-chip ${passed === rules.length ? 'pass' : 'warn'}">${passed}/${rules.length} checks</span>
        <span class="status-chip ${stats.reviewed > 0 ? 'pass' : 'warn'}">${stats.reviewed}/${stats.total} reviewed</span>
      </div>
      <div class="review-sticky-bar-actions">
        <button type="button" class="review-sticky-btn" data-sticky-action="prev"${prevKey ? '' : ' disabled'}>Previous</button>
        <button type="button" class="review-sticky-btn" data-sticky-action="next"${nextKey ? '' : ' disabled'}>Next</button>
        <button type="button" class="review-sticky-btn" data-sticky-action="next-needs-review">Next needs review</button>
        <button type="button" class="review-sticky-btn primary" data-sticky-action="toggle-workspace" aria-expanded="${workspaceOpen ? 'true' : 'false'}">
          ${workspaceOpen ? 'Hide workspace' : 'Show workspace'}
        </button>
      </div>
    `
  }

  function setWorkspaceTab(tabId) {
    if (!WORKSPACE_TABS.includes(tabId)) tabId = 'queue'

    const tabs = document.querySelectorAll('[data-workspace-tab]')
    const panels = document.querySelectorAll('[data-workspace-panel]')

    tabs.forEach((tab) => {
      const isSelected = tab.getAttribute('data-workspace-tab') === tabId
      tab.setAttribute('aria-selected', isSelected ? 'true' : 'false')
    })

    panels.forEach((panel) => {
      const isActive = panel.getAttribute('data-workspace-panel') === tabId
      panel.hidden = !isActive
    })

    if (tabId === 'sitemap' && typeof window.__mountInteractiveSitemapOnTabOpen === 'function') {
      window.__mountInteractiveSitemapOnTabOpen()
    }

    updateLocalState((state) => {
      state.ui.workspace_tab = tabId
      return state
    })
  }

  function setWorkspaceOpen(isOpen) {
    const workspace = document.getElementById(WORKSPACE_ID)
    if (!workspace) return

    workspace.hidden = !isOpen

    const toggleButton = document.querySelector('[data-sticky-action="toggle-workspace"]')
    if (toggleButton) {
      toggleButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false')
      toggleButton.textContent = isOpen ? 'Hide workspace' : 'Show workspace'
    }

    updateLocalState((state) => {
      state.ui.workspace_open = isOpen
      if (isOpen && !state.ui.workspace_tab) state.ui.workspace_tab = 'queue'
      return state
    })

    if (isOpen) {
      const state = readLocalState()
      setWorkspaceTab(state.ui.workspace_tab || 'queue')
    }
  }

  function toggleWorkspace() {
    const state = readLocalState()
    setWorkspaceOpen(!state.ui.workspace_open)
  }

  function handleStickyBarClick(event) {
    const button = event.target.closest('[data-sticky-action]')
    if (!button || button.disabled) return

    const action = button.getAttribute('data-sticky-action')
    const filter = window.reviewQueue?.getFilter?.() || 'All'

    if (action === 'prev') {
      const key = window.reviewQueue?.getAdjacentKey?.(-1, filter)
      if (key) window.renderPage?.(key)
      return
    }

    if (action === 'next') {
      const key = window.reviewQueue?.getAdjacentKey?.(1, filter)
      if (key) window.renderPage?.(key)
      return
    }

    if (action === 'next-needs-review') {
      const key = window.reviewQueue?.getNextNeedsReviewKey?.()
      if (key) window.renderPage?.(key)
      return
    }

    if (action === 'toggle-workspace') {
      toggleWorkspace()
    }
  }

  function initWorkspaceTabs() {
    const tablist = document.getElementById('reviewWorkspaceTabs')
    if (!tablist || tablist.dataset.bound === 'true') return
    tablist.dataset.bound = 'true'

    tablist.addEventListener('click', (event) => {
      const tab = event.target.closest('[data-workspace-tab]')
      if (!tab) return
      setWorkspaceTab(tab.getAttribute('data-workspace-tab') || 'queue')
    })

    const stickyBar = document.getElementById(STICKY_BAR_ID)
    stickyBar?.addEventListener('click', handleStickyBarClick)

    const state = readLocalState()
    setWorkspaceOpen(Boolean(state.ui.workspace_open))
    if (state.ui.workspace_open) {
      setWorkspaceTab(state.ui.workspace_tab || 'queue')
    }
  }

  function renderMetric(label, value, help) {
    return `
      <div class="metric-card">
        <span class="metric-label">${escapeHtml(label)}</span>
        <span class="metric-value">${escapeHtml(value)}</span>
        <span class="metric-help">${escapeHtml(help)}</span>
      </div>
    `
  }

  function isLong(value) {
    return String(value || '').length > 36
  }

  function pageSearchItems(query) {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return DATA.order.slice(0, 5)

    return DATA.order
      .filter(([key, label]) => {
        const page = DATA.pages[key] || {}
        const haystack =
          `${key} ${label} ${page.title || ''} ${page.type || ''} ${page.summary || ''}`.toLowerCase()
        return haystack.includes(normalizedQuery)
      })
      .slice(0, 6)
  }

  function renderPageQuickList() {
    const input = document.getElementById('pageFilterInput')
    const list = document.getElementById('pageQuickList')
    if (!input || !list) return

    const items = pageSearchItems(input.value)
    list.innerHTML = items
      .map(([key, label]) => {
        const page = DATA.pages[key] || {}
        const type = page.type || label.split(':')[0] || 'Page'
        return `
        <button type="button" class="page-quick-button" data-page-key="${escapeHtml(key)}">
          ${escapeHtml(page.title || label)}
          <span class="page-quick-type">${escapeHtml(type)} · ${escapeHtml(key)}</span>
        </button>
      `
      })
      .join('')
  }

  function mountPageSearch() {
    const select = document.getElementById('pageSelect')
    const selectLabel = document.querySelector('label[for="pageSelect"]')
    if (!select || !selectLabel || document.getElementById('pageFilterInput')) return

    const control = document.createElement('div')
    control.className = 'page-filter-control'
    control.innerHTML = `
      <label for="pageFilterInput">Find a page fast</label>
      <input id="pageFilterInput" type="search" aria-label="Search page mockups" placeholder="Search by page title, type, summary, or page key">
      <div id="pageQuickList" class="page-quick-list" aria-label="Quick page results"></div>
    `
    selectLabel.parentNode.insertBefore(control, selectLabel)

    document.getElementById('pageFilterInput')?.addEventListener('input', renderPageQuickList)
    document.getElementById('pageQuickList')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-page-key]')
      if (!button) return
      window.renderPage?.(button.getAttribute('data-page-key'))
      refreshUx()
    })
    renderPageQuickList()
  }

  function getCurrentReviewSummaryLines() {
    const page = getCurrentPage()
    const seoTitle = getSeoTitle(page)
    const metaDescription = getMetaDescription(page)
    const rules = getRuleResults(page)
    const passed = rules.filter((rule) => rule.pass).length

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
      `Follow-up owner: ${getValue('reviewOwner')}`,
    ]
  }

  function buildReviewSummary() {
    return getCurrentReviewSummaryLines().join('\n')
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text)
    }

    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    try {
      textarea.select()
      const copied = document.execCommand('copy')
      if (!copied) {
        return Promise.reject(
          new Error('Failed to copy text to clipboard. Browser clipboard access may be blocked.')
        )
      }
      return Promise.resolve()
    } catch (error) {
      return Promise.reject(error)
    } finally {
      textarea.remove()
    }
  }

  function exportSavedLocalReviewsCsv() {
    saveCurrentPageToLocalStorage()

    const state = readLocalState()
    const headers = [
      'review_date',
      'reviewer',
      'page_key',
      'page_title',
      'page_type',
      'url_slug',
      'decision',
      'notes',
      'risks_or_blockers',
      'follow_up_owner',
      'seo_title',
      'meta_description',
      'primary_cta',
      'reading_target',
      'updated_at',
    ]

    const rows = [headers]
    for (const [pageKey] of DATA.order) {
      const page = DATA.pages[pageKey] || {}
      const saved = state.pages[pageKey]
      if (!saved) continue

      rows.push([
        saved.review_date || '',
        saved.reviewer || state.globals.reviewer || '',
        pageKey,
        saved.page_title || page.title || '',
        saved.page_type || page.type || '',
        saved.url_slug || page.slug || '',
        saved.decision || 'Needs review',
        saved.notes || '',
        saved.risks_or_blockers || '',
        saved.follow_up_owner || '',
        saved.seo_title || defaultSeoTitle(page),
        saved.meta_description || defaultMetaDescription(page),
        saved.primary_cta || getPrimaryCta(page),
        saved.reading_target || page.reading || '',
        saved.updated_at || '',
      ])
    }

    downloadFile('hhvc-saved-local-manager-reviews.csv', toCsv(rows), 'text/csv;charset=utf-8')
    setText('reviewExportStatus', 'Exported saved local reviews CSV.')
    if (typeof window.showToast === 'function')
      window.showToast('Saved local reviews exported', 'success')
  }

  function clearSavedLocalReviews() {
    const confirmed = window.confirm(
      'Clear all locally saved HHVC review data in this browser? This does not change source files or exported CSVs.'
    )
    if (!confirmed) return

    localStorage.removeItem(STORAGE_KEY)
    clearReviewFieldsForNewPage()
    setValue('reviewerInput', '')
    updateLocalStorageStatus()
    refreshUx()
    setText('reviewExportStatus', 'Cleared locally saved review data in this browser.')
    if (typeof window.showToast === 'function')
      window.showToast('Local review data cleared', 'info')
  }

  function mountLocalStorageControls() {
    const actions = document.querySelector('.review-actions')
    if (!actions || document.getElementById('exportSavedLocalReviewsCsv')) return

    const exportButton = document.createElement('button')
    exportButton.type = 'button'
    exportButton.className = 'tool-btn secondary-tool'
    exportButton.id = 'exportSavedLocalReviewsCsv'
    exportButton.textContent = 'Export saved local reviews CSV'
    actions.appendChild(exportButton)
    exportButton.addEventListener('click', exportSavedLocalReviewsCsv)

    const clearButton = document.createElement('button')
    clearButton.type = 'button'
    clearButton.className = 'tool-btn danger-tool'
    clearButton.id = 'clearSavedLocalReviews'
    clearButton.textContent = 'Clear local saved reviews'
    actions.appendChild(clearButton)
    clearButton.addEventListener('click', clearSavedLocalReviews)

    const status = document.createElement('p')
    status.id = 'localStorageStatus'
    status.className = 'field-help local-storage-status'
    status.textContent = 'No local review data saved yet.'
    actions.insertAdjacentElement('afterend', status)
  }

  function mountCopySummaryButton() {
    const actions = document.querySelector('.review-actions')
    if (!actions || document.getElementById('copyReviewSummary')) return

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'tool-btn copy-summary'
    button.id = 'copyReviewSummary'
    button.textContent = 'Copy review summary'
    actions.appendChild(button)

    button.addEventListener('click', () => {
      saveCurrentPageToLocalStorage()
      copyText(buildReviewSummary())
        .then(() => {
          const status = document.getElementById('reviewExportStatus')
          if (status) status.textContent = 'Copied review summary to clipboard.'
          if (typeof window.showToast === 'function') {
            window.showToast('Review summary copied', 'success')
          }
        })
        .catch(() => {
          const status = document.getElementById('reviewExportStatus')
          if (status) status.textContent = 'Copy failed. Copy manually instead.'
          if (typeof window.showToast === 'function') {
            window.showToast('Copy failed. Copy manually instead.', 'warn')
          }
        })
    })
  }

  function refreshUx() {
    renderStickyBar()
    renderReviewDashboard()
    renderPageQuickList()
    updateLocalStorageStatus()
    document.dispatchEvent(new CustomEvent('hhvc:review-data-changed'))
  }

  function persistAndRefresh() {
    saveCurrentPageToLocalStorage()
    refreshUx()
  }

  function attachRefreshListeners() {
    const persistedFields = [
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
      'reviewOwner',
    ]

    const debouncedPersistAndRefresh = debounce(persistAndRefresh, REFRESH_DEBOUNCE_MS)

    for (const id of persistedFields) {
      const el = document.getElementById(id)
      if (!el) continue
      el.addEventListener('input', debouncedPersistAndRefresh)
      el.addEventListener('change', persistAndRefresh)
    }

    document.getElementById('tagToggle')?.addEventListener('change', () => {
      updateLocalState((state) => {
        state.ui.show_karl_tags = document.getElementById('tagToggle')?.checked !== false
        state.ui.last_page_key = getCurrentKey()
        return state
      })
      refreshUx()
    })

    // Flush keystrokes still sitting in the debounce window when the tab is
    // reloaded, closed, or backgrounded — otherwise they never reach
    // localStorage ('change' only fires on blur).
    window.addEventListener('pagehide', saveCurrentPageToLocalStorage)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') saveCurrentPageToLocalStorage()
    })
  }

  function wrapRenderPage() {
    if (typeof window.renderPage !== 'function' || window.renderPage.__uxWrapped) return
    const originalRenderPage = window.renderPage
    window.renderPage = function renderPageWithUxRefresh(key) {
      const result = originalRenderPage.call(this, key)
      updateLocalState((state) => {
        state.ui.last_page_key = key
        state.ui.show_karl_tags = document.getElementById('tagToggle')?.checked !== false
        return state
      })
      const applyAndRefresh = () => {
        applySavedPageState(key)
        refreshUx()
      }
      // Under View Transitions, renderPage returns a promise that resolves
      // once the new page content is in the DOM; patching earlier would hit
      // the outgoing page's elements.
      if (result && typeof result.then === 'function') result.then(applyAndRefresh)
      else window.setTimeout(applyAndRefresh, 0)
      return result
    }
    window.renderPage.__uxWrapped = true
  }

  function restoreInitialPage() {
    const state = readLocalState()
    const savedKey = state.ui.last_page_key

    if (savedKey && DATA.pages[savedKey] && typeof window.renderPage === 'function') {
      window.renderPage(savedKey)
      return
    }

    applySavedPageState(getCurrentKey())
    refreshUx()
  }

  function init() {
    initWorkspaceTabs()
    mountPageSearch()
    mountCopySummaryButton()
    mountLocalStorageControls()
    attachRefreshListeners()
    wrapRenderPage()
    applySavedUiPreferences()
    restoreInitialPage()
    refreshUx()
    // Defer one refresh so review-queue.js (loaded next) is ready for sticky bar stats.
    window.setTimeout(refreshUx, 0)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
