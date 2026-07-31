/* Manager review: page state sync between the SEO/editor sidebar and
   window.reviewState. Loads after js/review-state-store.js. */

import { hasValidPageData } from './utils.js'
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

    // Always pushed, never conditionally skipped.
    //
    // This used to be appended only when a grade could be computed, so a page
    // with too little body text -- or a browser where js/reading-level.js
    // failed to load -- silently lost a rule instead of failing one. That
    // shrinks the denominator behind the Overview tab's "checks passed" ratio,
    // which quietly flatters exactly the pages with the least content. It also
    // used to pass on `withinTarget !== false`, so an unparseable target
    // ("Grade six") scored as a pass rather than the data problem it is.
    const readingAnalysis = window.readingLevel?.analyzeReadingLevel?.(page)
    rules.push({
      label: 'Computed reading level',
      pass: readingAnalysis ? readingAnalysis.withinTarget === true : false,
      detail: readingAnalysis ? readingAnalysis.detail : 'Reading-level module not loaded',
    })

    // Plain-language rules via js/plain-language.js. Only mandates are scored
    // here; advisory rules are rendered separately by renderPageChecksPanel so
    // ~115 style suggestions cannot swamp the pass/fail ratio this list feeds.
    //
    // `citation` is carried through deliberately. It used to be dropped here,
    // which meant a reviewer looking at a failed mandate had no way to find the
    // rule's authority — the whole reason each rule records one. The
    // hand-written rules above carry no citation, so the renderer treats it as
    // optional rather than every rule growing an empty line.
    const plainLanguage = window.plainLanguage?.analyzePlainLanguage?.(page)
    for (const check of plainLanguage?.checks || []) {
      if (check.severity !== 'error') continue
      rules.push({
        label: check.label,
        pass: check.pass,
        detail: check.detail,
        citation: check.citation,
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
      const existing = state.pages[snapshot.page_key]

      // This is the continuous per-keystroke/blur autosave path, not a
      // discrete review "round" — it must NOT append a history entry (that
      // would flood history on every debounced save). It must also not
      // reset history to [] via the fresh buildReviewRecord() snapshot, so
      // carry the existing array forward untouched. Round-boundary events
      // (queue actions, imports, sync) go through mergeReviewRecord
      // instead, in js/review-merge.js.
      const existingHistory = existing?.history
      snapshot.history = Array.isArray(existingHistory) ? existingHistory : []
      // Same reasoning as history: synced_at tracks the last server state
      // this browser actually observed (via pull/push), NOT local edit
      // time — a fresh buildReviewRecord() snapshot would otherwise reset
      // it to '' on every keystroke, which would silently destroy the
      // conflict-detection baseline server.ts's putReviewPage relies on
      // the very first time a reviewer edits a page after syncing it. See
      // js/review-state-sync.js.
      snapshot.synced_at = existing?.synced_at || ''
      // Sticky until an actual push/pull clears it. Only flip it on when
      // the save really changed something: autosave also fires on
      // navigation flushes and on edits to other pages' unrelated fields,
      // and marking an untouched page dirty would make the next pull
      // report it as a conflict it isn't.
      const nextDirty = nextLocalDirty(existing, snapshot)
      if (nextDirty === undefined) delete snapshot.local_dirty
      else snapshot.local_dirty = nextDirty

      state.ui.last_page_key = snapshot.page_key
      state.ui.show_karl_tags = document.getElementById('tagToggle')?.checked !== false
      state.globals.reviewer = snapshot.reviewer
      state.globals.owner = snapshot.follow_up_owner

      // A decision change IS a discrete review round, even though it
      // arrives through this same autosave path (the sidebar <select> and
      // the quick-action chips both persist via the generic field
      // listeners in js/ux-improvements.js). Route just that transition
      // through mergeReviewRecord so the audit trail records it — without
      // opening the floodgates, since a decision only transitions on a
      // deliberate reviewer action, never per keystroke. Queue actions
      // already appended their own entry before dispatching, so by the
      // time this runs `existing.decision` matches and nothing is
      // double-recorded.
      state.pages[snapshot.page_key] = isDecisionRound(existing, snapshot)
        ? window.reviewMerge.mergeReviewRecord(existing, snapshot, {
            updatedBy: 'decision',
            timestamp: snapshot.updated_at,
          })
        : snapshot
      return state
    })

    updateLocalStorageStatus()
  }

  /**
   * The `local_dirty` value this save should persist — `true`, `false`, or
   * `undefined` for "still unknown."
   *
   * The third case is the important one. A record written before
   * `local_dirty` existed carries no such field, and `pullFromServer`
   * deliberately treats that absence as "may hold unpushed work" so an
   * upgraded browser can't have a never-pushed review silently replaced.
   * Collapsing the absent flag to a boolean here would quietly undo that:
   * an autosave whose content happens to match the stored record (typing
   * and undoing before the debounce fires, or a plain navigation flush)
   * would stamp an explicit `false` on a legacy record and hand the pull
   * path permission to overwrite it. So an unchanged legacy record keeps
   * its unknown state, and only a real edit, push, or pull resolves it.
   * @param {object|undefined} existing
   * @param {object} snapshot
   * @returns {boolean|undefined}
   */
  function nextLocalDirty(existing, snapshot) {
    if (!existing) return true
    if (existing.local_dirty === true) return true
    if (!window.reviewMerge.reviewContentEquals(existing, snapshot)) return true
    // Content is unchanged, so this save adds no unpushed work: report
    // whatever was already known, including "nothing".
    return existing.local_dirty === false ? false : undefined
  }

  /**
   * Whether this save represents a deliberate decision change worth one
   * history entry. A brand-new record only counts when the reviewer has
   * actually moved off the default — otherwise simply typing the first
   * character of a note on an untouched page would record a "Needs review"
   * round for every page in the site.
   * @param {object|undefined} existing
   * @param {object} snapshot
   * @returns {boolean}
   */
  function isDecisionRound(existing, snapshot) {
    if (!snapshot.decision) return false
    if (!existing) return snapshot.decision !== 'Needs review'
    // `decision` is optional on a stored record (an imported or
    // server-provided one may omit it), and applySavedPageState shows
    // 'Needs review' for exactly that case. Comparing against a raw
    // `undefined` would then read the sidebar's unchanged default as a
    // transition and record a decision round for someone who only edited
    // a note. Compare against what the reviewer is actually looking at.
    return snapshot.decision !== (existing.decision || 'Needs review')
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
                ${
                  rule.citation
                    ? `<span class="compliance-citation">${escapeHtml(rule.citation)}</span>`
                    : ''
                }
                <span class="compliance-detail">${escapeHtml(rule.detail)}</span>
              </span>
            </li>
          `
            )
            .join('')}
        </ul>
      </section>
      ${renderPlainLanguageAdvice(page)}
    `
  }

  // How many offending sentences to show per suggestion. A reviewer needs
  // enough to see the pattern, not every instance -- the full set is available
  // from window.plainLanguage.analyzePlainLanguage(page).
  const MAX_ADVICE_OFFENDERS = 5

  /**
   * Render the manual's advisory plain-language rules (severity 'warning')
   * as a separate, clearly non-blocking section.
   *
   * These are kept out of the scored list on purpose: they are suggestions,
   * they run to ~115 findings across the 19 pages, and mixing them into the
   * pass/fail ratio would make every page look broken. Each finding names the
   * field it came from so it can be acted on rather than just counted.
   * @param {object} page
   * @returns {string}
   */
  function renderPlainLanguageAdvice(page) {
    const analysis = window.plainLanguage?.analyzePlainLanguage?.(page)
    if (!analysis) return ''
    const suggestions = analysis.checks.filter(
      (check) => check.severity === 'warning' && !check.pass
    )
    if (!suggestions.length) return ''

    return `
      <section class="compliance-panel plain-language-panel">
        <h3>Plain-language suggestions</h3>
        <p class="review-decision-note">
          Advisory only — these do not count toward the checks above. Rules come from the HHVC
          Web Governance and Content Standards Manual and SF.gov's published style guidance;
          each finding cites its own source below.
          Average sentence length is ${escapeHtml(String(analysis.metrics.meanSentenceWords))}
          words across ${escapeHtml(String(analysis.metrics.sentenceCount))} sentences.
        </p>
        <ul class="compliance-list">
          ${suggestions
            .map(
              (check) => `
            <li class="compliance-item warn">
              <span>
                <span class="compliance-rule">${escapeHtml(check.label)}</span>
                <span class="compliance-citation">${escapeHtml(check.citation)}</span>
                <span class="compliance-detail">${escapeHtml(check.detail)}</span>
                ${
                  check.offenders.length
                    ? `<ul class="plain-language-offenders">${check.offenders
                        .slice(0, MAX_ADVICE_OFFENDERS)
                        .map(
                          (offender) => `
                          <li>
                            <code>${escapeHtml(offender.path)}</code>
                            <span>${escapeHtml(offender.text)}</span>
                            <em>${escapeHtml(offender.note)}</em>
                          </li>`
                        )
                        .join('')}${
                        check.offenders.length > MAX_ADVICE_OFFENDERS
                          ? `<li><em>and ${escapeHtml(
                              String(check.offenders.length - MAX_ADVICE_OFFENDERS)
                            )} more</em></li>`
                          : ''
                      }</ul>`
                    : ''
                }
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
    renderPlainLanguageAdvice,
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
