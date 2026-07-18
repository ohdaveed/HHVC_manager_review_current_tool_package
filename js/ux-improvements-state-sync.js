/* Manager review: page state sync between the SEO/editor sidebar and
   window.reviewState. Loads after js/review-state-store.js. */
;(function mountUxImprovementsStateSync() {
  const DATA = window.HHVC_DATA
  if (!hasValidPageData(DATA) || !window.reviewState) return

  const SEO_TITLE_LIMIT = 60
  const META_DESCRIPTION_LIMIT = 110
  const CHECKS_PANEL_ID = 'reviewChecksPanel'

  let isRestoringState = false

  const {
    escapeHtml,
    getPrimaryCta,
    setPrimaryCta,
    today,
    getValue,
    setValue,
    setText,
    buildReviewRecord,
    getCurrentKey,
    countRelatedLinks,
    defaultSeoTitle,
    defaultMetaDescription,
  } = window.utils

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

  // Exposed for js/review-queue.js's Overview tab, which needs to compute a
  // checks passed/total count for every page, not just the one currently
  // open in the editor.
  window.reviewChecks = { getRuleResultsFor }

  /**
   * Snapshot the review form into a persistable record.
   *
   * @param {string} [pageKeyOverride] Save under this page key instead of
   *   getCurrentKey(). Needed by the pre-navigation flush in
   *   js/ux-improvements.js: getCurrentKey() reads #pageSelect.value, which is
   *   ALREADY the destination page when navigation comes from the page picker
   *   (the <select>'s change event fires with the new value before renderPage
   *   runs), so a flush that trusted it would file the outgoing page's
   *   unsaved edits under the incoming page's key.
   */
  function collectCurrentPageReviewState(pageKeyOverride) {
    const pageKey = typeof pageKeyOverride === 'string' ? pageKeyOverride : getCurrentKey()
    const page = DATA.pages[pageKey] || {}

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

  /**
   * Persist the current review form to localStorage.
   * @param {string} [pageKeyOverride] See collectCurrentPageReviewState —
   *   used by the pre-navigation flush to save under the OUTGOING page key.
   */
  function saveCurrentPageToLocalStorage(pageKeyOverride) {
    if (isRestoringState) return

    const snapshot = collectCurrentPageReviewState(pageKeyOverride)
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

    // Skip rebuilds while the panel can't be seen; the Checks tab re-renders on
    // activation (setWorkspaceTab in js/ux-improvements-workspace.js).
    const workspace = document.getElementById('reviewWorkspace')
    if (workspace?.hidden || panel.hidden) return

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

  window.ReviewUx = window.ReviewUx || {}
  window.ReviewUx.stateSync = {
    getCurrentPage,
    getSeoTitle,
    getMetaDescription,
    getRuleResultsFor,
    getRuleResults,
    renderPageChecksPanel,
    collectCurrentPageReviewState,
    saveCurrentPageToLocalStorage,
    clearReviewFieldsForNewPage,
    updateMockupTextFromSavedState,
    applySavedPageState,
    applySavedUiPreferences,
    updateLocalStorageStatus,
    SEO_TITLE_LIMIT,
    META_DESCRIPTION_LIMIT,
  }
})()
