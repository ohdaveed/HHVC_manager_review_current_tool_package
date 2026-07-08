/* Manager review UX/UI enhancements.
   Runs after js/app.js and does not change source page content or review export schemas. */
;(function improveManagerReviewUx() {
  const DATA = window.HHVC_DATA
  if (!hasValidPageData(DATA)) return

  const SEO_TITLE_LIMIT = 60
  const META_DESCRIPTION_LIMIT = 110
  const CHECKS_PANEL_ID = 'reviewChecksPanel'
  const STICKY_BAR_ID = 'reviewStickyBar'
  const WORKSPACE_ID = 'reviewWorkspace'

  const WORKSPACE_TABS = ['overview', 'checks', 'sitemap', 'help']

  let isRestoringState = false

  // js/utils.js loads first (see index.html script order), so the shared
  // helpers are always available.
  const {
    escapeHtml,
    getPrimaryCta,
    setPrimaryCta,
    today,
    debounce,
    toCsv,
    downloadFile,
    getStatusChipClass,
    defaultSeoTitle,
    defaultMetaDescription,
    getValue,
    setValue,
    setText,
    buildReviewRecord,
    getCurrentKey,
    countRelatedLinks,
  } = window.utils
  // Rebuilding the dashboard grid/scorecard and page-search list on every
  // keystroke is wasted work while the reviewer is still typing. Debounce the
  // 'input' path; 'change' (fires on blur) still refreshes immediately so the
  // dashboard is never stale once the reviewer moves on.
  const REFRESH_DEBOUNCE_MS = 300

  function getCurrentPage() {
    return DATA.pages[getCurrentKey()] || {}
  }

  function getSeoTitle(page) {
    return getValue('seoTitleInput') || defaultSeoTitle(page)
  }

  function getMetaDescription(page) {
    return getValue('metaDescriptionInput') || defaultMetaDescription(page)
  }

  // useEditor: true reads live SEO sidebar values (current page only);
  // false evaluates raw page data so any page can be scored for the portfolio view.
  function getRuleResultsFor(page, { useEditor = false } = {}) {
    const title = page.title || ''
    const summary = page.summary || ''
    const seoTitle = useEditor ? getSeoTitle(page) : defaultSeoTitle(page)
    const metaDescription = useEditor ? getMetaDescription(page) : defaultMetaDescription(page)
    const primaryCta = getPrimaryCta(page)
    const relatedLinks = countRelatedLinks(page)
    const normalizedType = String(page.type || '')
      .trim()
      .toLowerCase()
    const isTransaction = normalizedType === 'transaction' || normalizedType === 'transaction page'

    const rules = [
      {
        label: 'Page type',
        pass: Boolean(page.type),
        detail: page.type || 'Missing page type',
      },
      {
        label: 'Title',
        pass: Boolean(title) && title.length <= 80,
        detail: title ? `${title.length} characters` : 'Missing title',
      },
      {
        label: 'Summary',
        pass: Boolean(summary) && summary.length <= 180,
        detail: summary ? `${summary.length} characters` : 'Missing summary',
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

    const readingAnalysis = window.readingLevel?.analyzeReadingLevel?.(page)
    if (readingAnalysis && readingAnalysis.computed != null) {
      rules.push({
        label: 'Computed reading level',
        pass: readingAnalysis.withinTarget !== false,
        detail: readingAnalysis.detail,
      })
    }

    return rules
  }

  function getRuleResults(page) {
    return getRuleResultsFor(page, { useEditor: true })
  }

  // Exposed for js/review-queue.js's Overview tab (loads after this file), which
  // needs to compute a checks passed/total count for every page, not just the one
  // currently open in the editor.
  window.reviewChecks = { getRuleResultsFor }

  function collectCurrentPageReviewState() {
    const page = getCurrentPage()
    const pageKey = getCurrentKey()

    return buildReviewRecord(page, pageKey, {
      page_title: page.title || '',
      url_slug: getValue('urlInput') || page.slug || '',
      edited_title: page.title || '',
      edited_summary: page.summary || '',
      primary_cta: getPrimaryCta(page) || '',
      seo_title: getSeoTitle(page),
      meta_description: getMetaDescription(page),
      reviewer: getValue('reviewerInput'),
      review_date: getValue('reviewDateInput') || today(),
      decision: getValue('reviewDecision') || 'Needs review',
      notes: getValue('reviewNotes'),
      risks_or_blockers: getValue('reviewRisks'),
      follow_up_owner: getValue('reviewOwner'),
      reading_target: page.reading || '',
      updated_at: new Date().toISOString(),
    })
  }

  function saveCurrentPageToLocalStorage() {
    if (isRestoringState) return

    const snapshot = collectCurrentPageReviewState()
    window.reviewState.update((state) => {
      state.ui.last_page_key = snapshot.page_key
      state.ui.show_karl_tags = document.getElementById('tagToggle')?.checked !== false
      state.globals.reviewer = snapshot.reviewer
      state.globals.owner = snapshot.follow_up_owner
      state.pages[snapshot.page_key] = snapshot
      return state
    })

    updateLocalStorageStatus()
  }

  function clearReviewFieldsForNewPage(state) {
    setValue('reviewDateInput', today())
    setValue('reviewDecision', 'Needs review')
    setValue('reviewNotes', '')
    setValue('reviewRisks', '')
    setValue('reviewOwner', state?.globals?.owner || 'David')
  }

  function updateMockupTextFromSavedState(page, saved) {
    if (saved.edited_title) {
      page.title = saved.edited_title
      const h1 = document.querySelector('#mockPage .hero h1')
      if (h1) h1.textContent = saved.edited_title
    }

    if (saved.edited_summary) {
      page.summary = saved.edited_summary
      const summary = document.querySelector('#mockPage .hero .summary')
      if (summary) summary.textContent = saved.edited_summary
    }

    if (saved.primary_cta) {
      setPrimaryCta(page, saved.primary_cta)
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
    const state = window.reviewState.read()
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
      setValue('reviewOwner', saved.follow_up_owner || state.globals.owner || 'David')
      updateMockupTextFromSavedState(page, saved)
    } else {
      clearReviewFieldsForNewPage(state)
    }

    isRestoringState = false
    updateLocalStorageStatus()
  }

  function applySavedUiPreferences() {
    const state = window.reviewState.read()
    const tagToggle = document.getElementById('tagToggle')
    if (tagToggle && typeof state.ui.show_karl_tags === 'boolean') {
      tagToggle.checked = state.ui.show_karl_tags
      document.body.classList.toggle('hide-karl-tags', !tagToggle.checked)
    }
  }

  function updateLocalStorageStatus() {
    const status = document.getElementById('localStorageStatus')
    if (!status) return

    const state = window.reviewState.read()
    const savedCount = Object.keys(state.pages || {}).length
    const updatedAt = state.updated_at ? new Date(state.updated_at) : null
    const updatedLabel = updatedAt
      ? updatedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : 'not saved yet'

    status.textContent = `${savedCount} page review${savedCount === 1 ? '' : 's'} saved locally. Last save: ${updatedLabel}.`
  }

  function renderPageChecksPanel() {
    const panel = document.getElementById(CHECKS_PANEL_ID)
    if (!panel) return

    const page = getCurrentPage()
    const rules = getRuleResults(page)

    panel.innerHTML = `
      <section class="compliance-panel">
        <h3>Current page checks</h3>
        <p class="review-decision-note">
          Scores only the page open in the mockup (${escapeHtml(getCurrentKey())}). For all pages at
          once, use the <strong>Overview</strong> tab. Search metadata values update as you edit
          them in the sidebar.
        </p>
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
      </section>
    `
  }

  function renderStickyBar() {
    const bar = document.getElementById(STICKY_BAR_ID)
    if (!bar) return

    const page = getCurrentPage()
    const decision = getValue('reviewDecision') || 'Needs review'
    const chipClass = getStatusChipClass(decision)
    const stats = window.reviewQueue?.getQueueStats?.() || {
      reviewed: 0,
      total: DATA.order.length,
    }
    const filter = window.reviewQueue?.getFilter?.() || 'All'
    const filterLabel = filter !== 'All' ? filter : ''
    const prevKey = window.reviewQueue?.getAdjacentKey?.(-1, filter)
    const nextKey = window.reviewQueue?.getAdjacentKey?.(1, filter)
    const state = window.reviewState.read()
    const workspaceOpen = Boolean(state.ui.workspace_open)
    const prevNavLabel = filterLabel ? `Previous page (${filterLabel} filter)` : 'Previous page'
    const nextNavLabel = filterLabel ? `Next page (${filterLabel} filter)` : 'Next page'

    bar.innerHTML = `
      <div class="review-sticky-bar-main">
        <span class="status-chip ${chipClass}">${escapeHtml(decision)}</span>
        <p class="review-sticky-bar-title">${escapeHtml(page.title || getCurrentKey())}</p>
        ${filterLabel ? `<span class="review-sticky-bar-filter">Filter: ${escapeHtml(filterLabel)}</span>` : ''}
      </div>
      <nav class="review-sticky-bar-actions">
        <span class="review-sticky-bar-progress">${stats.reviewed}/${stats.total} reviewed</span>
        <button type="button" class="review-sticky-btn" data-sticky-action="prev"${prevKey ? '' : ' disabled'} aria-label="${escapeHtml(prevNavLabel)}">Previous</button>
        <button type="button" class="review-sticky-btn" data-sticky-action="next"${nextKey ? '' : ' disabled'} aria-label="${escapeHtml(nextNavLabel)}">Next</button>
        <button type="button" class="review-sticky-btn primary" data-sticky-action="toggle-workspace" aria-expanded="${workspaceOpen ? 'true' : 'false'}">
          ${workspaceOpen ? 'Hide workspace' : 'Show workspace'}
        </button>
      </nav>
    `
  }

  function setWorkspaceTab(tabId) {
    if (!WORKSPACE_TABS.includes(tabId)) tabId = 'overview'

    const tabs = document.querySelectorAll('[data-workspace-tab]')
    const panels = document.querySelectorAll('[data-workspace-panel]')

    tabs.forEach((tab) => {
      const isSelected = tab.getAttribute('data-workspace-tab') === tabId
      tab.setAttribute('aria-selected', isSelected ? 'true' : 'false')
      // Roving tabindex: Tab lands on the active tab, arrows move between tabs.
      tab.tabIndex = isSelected ? 0 : -1
    })

    panels.forEach((panel) => {
      const isActive = panel.getAttribute('data-workspace-panel') === tabId
      panel.hidden = !isActive
    })

    if (tabId === 'sitemap' && typeof window.__mountInteractiveSitemapOnTabOpen === 'function') {
      window.__mountInteractiveSitemapOnTabOpen()
    }

    if (tabId === 'help') {
      window.refreshDashboardGuidance?.()
    }

    window.reviewState.update((state) => {
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

    window.reviewState.update((state) => {
      state.ui.workspace_open = isOpen
      if (isOpen && !state.ui.workspace_tab) state.ui.workspace_tab = 'overview'
      return state
    })

    if (isOpen) {
      const state = window.reviewState.read()
      setWorkspaceTab(state.ui.workspace_tab || 'overview')
      setTimeout(() => {
        workspace.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 50)
    }
  }

  function toggleWorkspace() {
    const state = window.reviewState.read()
    setWorkspaceOpen(!state.ui.workspace_open)
  }

  function maybeShowWorkspaceOnboarding() {
    const state = window.reviewState.read()
    if (state.ui.workspace_onboarding_seen) return

    const hasExistingUsage =
      Object.keys(state.pages || {}).length > 0 || Boolean(state.ui.workspace_tab)

    if (hasExistingUsage) {
      window.reviewState.update((nextState) => {
        nextState.ui.workspace_onboarding_seen = true
        return nextState
      })
      return
    }

    window.reviewState.update((nextState) => {
      nextState.ui.workspace_onboarding_seen = true
      nextState.ui.workspace_open = true
      nextState.ui.workspace_tab = 'overview'
      return nextState
    })

    const workspace = document.getElementById(WORKSPACE_ID)
    if (workspace) workspace.hidden = false

    const toggleButton = document.querySelector('[data-sticky-action="toggle-workspace"]')
    if (toggleButton) {
      toggleButton.setAttribute('aria-expanded', 'true')
      toggleButton.textContent = 'Hide workspace'
    }

    setWorkspaceTab('overview')
    if (typeof window.showToast === 'function') {
      window.showToast(
        'Review workspace opened — use Overview for site-wide triage or Page checks for the open page.',
        'info'
      )
    }
  }

  window.reviewWorkspace = {
    setTab: setWorkspaceTab,
    setOpen: setWorkspaceOpen,
    toggle: toggleWorkspace,
    WORKSPACE_TABS,
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
      setWorkspaceTab(tab.getAttribute('data-workspace-tab') || 'overview')
    })

    tablist.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
      const tabs = Array.from(tablist.querySelectorAll('[data-workspace-tab]'))
      const currentIndex = tabs.indexOf(document.activeElement)
      if (currentIndex === -1) return

      event.preventDefault()
      let nextIndex = currentIndex
      if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
      if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length
      if (event.key === 'Home') nextIndex = 0
      if (event.key === 'End') nextIndex = tabs.length - 1

      const nextTab = tabs[nextIndex]
      nextTab.focus()
      setWorkspaceTab(nextTab.getAttribute('data-workspace-tab') || 'overview')
    })

    const stickyBar = document.getElementById(STICKY_BAR_ID)
    stickyBar?.addEventListener('click', handleStickyBarClick)

    const state = window.reviewState.read()
    setWorkspaceOpen(Boolean(state.ui.workspace_open))
    if (state.ui.workspace_open) {
      setWorkspaceTab(state.ui.workspace_tab || 'overview')
    }
  }

  function updateDecisionQuickActions() {
    const current = getValue('reviewDecision') || 'Needs review'
    document.querySelectorAll('#decisionQuickActions [data-decision]').forEach((button) => {
      const isActive = button.getAttribute('data-decision') === current
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false')
    })
  }

  function initDecisionQuickActions() {
    const group = document.getElementById('decisionQuickActions')
    if (!group || group.dataset.bound === 'true') return
    group.dataset.bound = 'true'

    group.addEventListener('click', (event) => {
      const button = event.target.closest('[data-decision]')
      if (!button) return
      applyDecisionToCurrentPage(button.getAttribute('data-decision'))
    })

    updateDecisionQuickActions()
  }

  function applyDecisionToCurrentPage(decision) {
    const select = document.getElementById('reviewDecision')
    if (!select || !decision) return
    if (select.value === decision) return

    select.value = decision
    // Reuse the existing persistence path bound to the select's change event.
    select.dispatchEvent(new Event('change', { bubbles: true }))
    if (typeof window.showToast === 'function') {
      const tone = decision === 'Blocked' || decision === 'Revise and resubmit' ? 'warn' : 'success'
      const nextKey = window.reviewQueue?.getNextNeedsReviewKey?.()
      let toastAction = null
      if (nextKey && typeof window.renderPage === 'function') {
        toastAction = {
          label: 'Next Actionable Page',
          callback: () => window.renderPage(nextKey),
        }
      }
      window.showToast(`Decision set: ${decision}`, tone, toastAction)
    }
  }

  window.reviewDecisions = { set: applyDecisionToCurrentPage }

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
      `Primary CTA: ${getPrimaryCta(page) || ''}`,
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

    const state = window.reviewState.read()
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

  function exportReviewStateBackup() {
    saveCurrentPageToLocalStorage()
    const state = window.reviewState.read()
    downloadFile(
      `hhvc-review-state-backup-${today()}.json`,
      JSON.stringify(state, null, 2),
      'application/json;charset=utf-8'
    )
    setText('reviewExportStatus', 'Downloaded review state backup JSON.')
    if (typeof window.showToast === 'function')
      window.showToast('Review state backup downloaded', 'success')
  }

  function importReviewStateBackup(file) {
    const fail = (message) => {
      setText('reviewExportStatus', message)
      if (typeof window.showToast === 'function') window.showToast(message, 'warn')
    }

    file
      .text()
      .then((text) => {
        let parsed
        try {
          parsed = JSON.parse(text)
        } catch {
          fail('Import failed: the file is not valid JSON.')
          return
        }

        if (
          !parsed ||
          parsed.version !== window.reviewState.STORAGE_VERSION ||
          typeof parsed.pages !== 'object' ||
          !parsed.pages
        ) {
          fail('Import failed: not a valid HHVC review state backup.')
          return
        }

        const validator = window.reviewStateValidation?.validateReviewState
        const validated =
          typeof validator === 'function' ? validator(parsed) : { ok: true, data: parsed }
        if (!validated.ok) {
          fail(`Import failed: ${validated.error}`)
          return
        }

        const entries = Object.entries(validated.data.pages).filter(
          ([key, value]) => DATA.pages[key] && value && typeof value === 'object'
        )
        if (!entries.length) {
          fail('Import finished: the backup has no reviews matching the current page list.')
          return
        }

        const merge = typeof window.defu === 'function' ? window.defu : null
        window.reviewState.update((state) => {
          const nextPages = { ...state.pages }
          for (const [key, saved] of entries) {
            nextPages[key] = { ...(state.pages[key] || {}), ...saved, page_key: key }
          }
          return {
            ...state,
            ui: merge
              ? merge({}, state.ui, validated.data.ui || {})
              : { ...state.ui, ...(validated.data.ui || {}) },
            globals: {
              ...state.globals,
              ...(validated.data.globals?.reviewer && !state.globals.reviewer
                ? { reviewer: validated.data.globals.reviewer }
                : {}),
              ...(validated.data.globals?.owner && !state.globals.owner
                ? { owner: validated.data.globals.owner }
                : {}),
            },
            pages: nextPages,
          }
        })

        applySavedPageState(getCurrentKey())
        refreshUx()
        setText('reviewExportStatus', `Imported ${entries.length} saved page reviews from backup.`)
        if (typeof window.showToast === 'function')
          window.showToast(`Imported ${entries.length} page reviews`, 'success')
      })
      .catch(() => fail('Import failed: could not read the selected file.'))
  }

  function mountBackupControls() {
    const actions = document.querySelector('.review-actions')
    if (!actions || document.getElementById('exportReviewStateBackup')) return

    const backupButton = document.createElement('button')
    backupButton.type = 'button'
    backupButton.className = 'tool-btn secondary-tool'
    backupButton.id = 'exportReviewStateBackup'
    backupButton.textContent = 'Download backup (JSON)'
    actions.appendChild(backupButton)
    backupButton.addEventListener('click', exportReviewStateBackup)

    const importInput = document.createElement('input')
    importInput.type = 'file'
    importInput.accept = 'application/json,.json'
    importInput.id = 'importReviewStateFile'
    importInput.hidden = true
    importInput.addEventListener('change', () => {
      const file = importInput.files?.[0]
      if (file) importReviewStateBackup(file)
      importInput.value = ''
    })

    const importButton = document.createElement('button')
    importButton.type = 'button'
    importButton.className = 'tool-btn secondary-tool'
    importButton.id = 'importReviewStateBackup'
    importButton.textContent = 'Import backup (JSON)'
    actions.appendChild(importButton)
    actions.appendChild(importInput)
    importButton.addEventListener('click', () => importInput.click())
  }

  function clearSavedLocalReviews() {
    const confirmed = window.confirm(
      'Clear all locally saved HHVC review data in this browser? This does not change source files or exported CSVs.'
    )
    if (!confirmed) return

    localStorage.removeItem(window.reviewState.STORAGE_KEY)
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
    renderPageChecksPanel()
    updateLocalStorageStatus()
    updateDecisionQuickActions()
    document.dispatchEvent(new CustomEvent('hhvc:review-data-changed'))
  }

  function persistAndRefresh() {
    saveCurrentPageToLocalStorage()
    refreshUx()
  }

  function attachRefreshListeners() {
    const persistedFields = [
      'urlInput',
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
      window.reviewState.update((state) => {
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
      window.reviewState.update((state) => {
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
    const state = window.reviewState.read()
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
    initDecisionQuickActions()
    mountCopySummaryButton()
    mountBackupControls()
    mountLocalStorageControls()
    attachRefreshListeners()
    wrapRenderPage()
    applySavedUiPreferences()
    restoreInitialPage()
    refreshUx()
    maybeShowWorkspaceOnboarding()
    // Defer one refresh so review-queue.js (loaded next) is ready for sticky bar stats.
    window.setTimeout(refreshUx, 0)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
