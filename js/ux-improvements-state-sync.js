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

  // Re-entrancy guard for the section_edits follow-up render triggered by
  // applySavedPageState below. window.renderPage is always the WRAPPED
  // version by the time applySavedPageState can run (js/ux-improvements.js's
  // wrapRenderPage() installs it before restoreInitialPage()/any navigation
  // calls this), so calling it from inside applySavedPageState re-enters
  // that wrapper: originalRenderPage runs synchronously (this is what
  // actually repaints the DOM — good), but the wrapper then schedules
  // ANOTHER deferred applyAndRefresh -> applySavedPageState(pageKey) call of
  // its own. Without this guard, that second call would see the same
  // still-true "wrote something" signal from applyContentEditsToPageData
  // (the data hasn't changed) and trigger a THIRD render, which would
  // trigger a fourth applySavedPageState call, forever.
  //
  // Holds the pageKey of an in-flight self-triggered render, or null when
  // none is pending. Set immediately before calling window.renderPage from
  // here; cleared at the very top of the NEXT applySavedPageState call for
  // that same key — not right after the synchronous renderPage() call
  // returns, since the reapply this guard is protecting against happens
  // asynchronously (setTimeout(0) or a View Transitions promise), so the
  // corresponding applySavedPageState call for the render this triggered
  // hasn't happened yet at that point.
  //
  // A suppressed follow-up render is never a STALE render, only a possibly
  // REDUNDANT one — this is the invariant that makes suppressing it safe.
  // Two calls to applySavedPageState(pageKey) can interleave (call X sets
  // this guard and triggers a deferred render; before that render fires,
  // call Y runs for the same key and, seeing the guard set, suppresses its
  // own trigger). That is safe only because of what applySavedPageState
  // does immediately above this guard, in the same synchronous turn:
  // `const page = DATA.pages[pageKey]` reads the LIVE object DATA already
  // holds — never a clone or snapshot — and
  // `applyContentEditsToPageData(page, saved)` mutates that same shared
  // object in place, synchronously, before either call reaches this guard
  // check. JavaScript is single-threaded and run-to-completion: whichever
  // call's applySavedPageState body runs second (Y, in the scenario above)
  // finishes its synchronous write to `page` before X's deferred render
  // callback can fire. So by the time ANY triggered render actually reads
  // `DATA.pages[pageKey]` to paint the DOM, it always sees the most recent
  // write, regardless of which call's guard check was the one that
  // triggered it. A suppressed render is therefore redundant (something
  // else's render will paint the same current data) rather than wrong.
  //
  // This safety argument breaks silently if applySavedPageState is ever
  // changed to operate on a cloned/snapshotted page object instead of the
  // live one held in DATA.pages — do not make that change without also
  // reworking this guard (e.g. keying it by a call-generation token and
  // re-validating that the data a suppressed call would have painted is
  // still current before suppressing).
  let refreshInFlightForKey = null

  /**
   * A page whose data has moved since the last paint, but whose repaint was
   * suppressed because the call that moved it was itself the deferred
   * follow-up of an earlier render (isOwnTriggeredRefresh).
   *
   * Needed once applyContentEditsToPageData reports real CHANGES rather than
   * mere writes (issue #118). Before that, the follow-up call re-reported
   * true unconditionally and so always painted, which accidentally covered
   * this case. Now it does not: a second call carrying newer data — a sync
   * pull landing between a render and its deferred follow-up — changes the
   * page, suppresses its own render, and would leave the DOM showing the
   * older value forever. Remembering "something moved and nobody painted it"
   * is what makes the next call paint anyway.
   */
  let dirtySinceLastPaintForKey = null

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
        // scored: false — see scoredRules() below. `type` is required with
        // min(1) by build_scripts/schema.js and enforced by `bun run validate`
        // in CI, so this can only fail for a page that could not ship. It reads
        // as a permanently green check while padding the denominator.
        label: 'Page type',
        scored: false,
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
        // Same as Page type: the schema requires a non-empty audience[].
        label: 'Audience',
        scored: false,
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
        // Also schema-required. Note this is only the DECLARED target — whether
        // the copy actually hits it is 'Computed reading level' below, which is
        // scored and does fail.
        label: 'Reading target',
        scored: false,
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

  /**
   * The rules that count toward "checks passed".
   *
   * Three entries in the list describe the page rather than test it. Page type,
   * Audience and Reading target are all required by build_scripts/schema.js and
   * enforced by `bun run validate`, so no page that can ship will ever fail
   * them. Scoring them meant every page carried three free passes, which
   * inflated the ratio by a constant and — worse — buried the rules that do
   * fail among a wall of permanent green. They still render, as page facts
   * rather than as results.
   * @param {Array<object>} rules
   * @returns {Array<object>}
   */
  function scoredRules(rules) {
    return (rules || []).filter((rule) => rule.scored !== false)
  }

  // Exposed for js/review-queue.js's Overview tab, which needs to compute a
  // checks passed/total count for every page, not just the one currently
  // open in the editor.
  window.reviewChecks = window.reviewChecks || {}
  window.reviewChecks.getRuleResultsFor = getRuleResultsFor
  window.reviewChecks.scoredRules = scoredRules

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
    const originalPage = window.ORIGINAL_DATA?.pages?.[pageKey]

    return buildReviewRecord(page, pageKey, {
      page_title: page.title || '',
      url_slug: getValue('urlInput') || page.slug || '',
      edited_title: page.title || '',
      edited_summary: page.summary || '',
      primary_cta: getPrimaryCta(page) || '',
      // Derived fresh from live page state on every save, same as the three
      // fields above — never accumulated as a stored diff that could drift
      // from what page.sections actually contains. See
      // js/inline-content-edit-data.js for why this makes "reset to
      // original" correct by construction. originalPage can be undefined in
      // a context with no ORIGINAL_DATA (e.g. a future non-browser caller);
      // computeSectionEdits() itself returns {} rather than throwing.
      section_edits: window.inlineEditData?.computeSectionEdits(page, originalPage) || {},
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

  /**
   * @param {object} page
   * @param {object} saved
   * @returns {boolean} true if the CTA changed and still needs a DOM
   *   repaint — see the comment on the `primary_cta` branch below.
   */
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

    // Unlike title/summary above, there's no single DOM node to patch
    // directly: setPrimaryCta() can write to a step's button, a section's
    // button, the spotlight's button, or the page-level fallback, depending
    // on what the page structurally has — and button() (js/page-render.js)
    // wraps whichever one renders in a karlTag() placement annotation plus,
    // for an external link, a trailing arrow glyph, so a plain textContent
    // write here would also clobber that markup. Report whether the value
    // actually changed instead, so the caller can fold it into the same
    // "does this page need a follow-up render" decision it already makes
    // for section_edits — see applySavedPageState below.
    let ctaChanged = false
    if (saved.primary_cta) {
      const beforeCta = getPrimaryCta(page)
      setPrimaryCta(page, saved.primary_cta)
      ctaChanged = getPrimaryCta(page) !== beforeCta
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
    return ctaChanged
  }

  /**
   * Reapply every saved edited_title/edited_summary onto EVERY page in
   * DATA.pages, not just the one about to render.
   *
   * applySavedPageState(pageKey) only ever runs for the page a reviewer is
   * actually opening, which is correct for that page's own hero — but
   * cardTitle()/cardDescription() in js/page-render.js resolve an inheriting
   * card's title and description from `pageData[card.target]`, and a card's
   * target is very often a page the reviewer hasn't opened in this session.
   * Without this, a saved edit to a destination page's title or summary is
   * invisible on every OTHER page whose card inherits from it, until the
   * reviewer happens to visit that destination directly — including the
   * default `pestsTopic` landing page, whose Services/Resources cards
   * inherit from six different destinations.
   *
   * Deliberately narrower than applySavedPageState: it calls
   * updateMockupTextFromSavedState() directly rather than the full function,
   * so it never touches the review-form sidebar fields (reviewer/date/
   * decision/notes), never reapplies section_edits, and never triggers a
   * render — those all belong to the ONE page actually being opened.
   * updateMockupTextFromSavedState()'s own DOM writes
   * (`document.querySelector('#mockPage .hero h1')` etc.) are safe no-ops
   * for every page except whichever one is currently painted, so calling it
   * for all of them here does not risk patching the wrong page's DOM.
   *
   * Cannot run before EVERY render of the session — js/app.js's own initial
   * render happens synchronously at module-import time, before this file (or
   * any of the review layer) has even loaded, so the very first paint is
   * always from pristine pageData no matter where this is called from. That
   * first paint already gets corrected for its OWN hero title/summary by
   * applySavedPageState()'s existing DOM patch; the gap this function closes
   * is everything else on the page — its inherited cards — which is why
   * restoreInitialPage() must force one repaint of the current page
   * immediately after calling this, in the branches that don't already
   * re-render (see that function's comment for which branches those are).
   */
  function hydrateAllPageTextFromSavedState() {
    const state = window.reviewState.read()
    for (const pageKey of Object.keys(state.pages || {})) {
      const page = DATA.pages[pageKey]
      const saved = state.pages[pageKey]
      if (page && saved) updateMockupTextFromSavedState(page, saved)
    }
  }

  function applySavedPageState(pageKey) {
    // If this call is the one a prior call in this same function triggered
    // (see the follow-up-render block below), clear the guard now — this is
    // the guaranteed next invocation for that key, regardless of whether the
    // render that got us here settled via setTimeout(0) or a View
    // Transitions promise .then(). Clearing here, rather than right after
    // window.renderPage() returns below, is what makes the guard correct:
    // that call is synchronous only up to the DOM repaint, but the deferred
    // applyAndRefresh (and thus the next applySavedPageState call for this
    // key) hasn't happened yet at that point.
    const isOwnTriggeredRefresh = refreshInFlightForKey === pageKey
    if (isOwnTriggeredRefresh) refreshInFlightForKey = null

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
      // Title and summary patch their own DOM node directly above; the CTA
      // cannot (see updateMockupTextFromSavedState's comment on that branch)
      // and reports whether it changed instead, so a CTA-only save still
      // gets the same follow-up render section_edits triggers below —
      // otherwise the mockup keeps showing the bundled CTA label while
      // storage holds the edited one until something else repaints the page.
      const ctaChanged = updateMockupTextFromSavedState(page, saved)
      // updateMockupTextFromSavedState (title/summary) and setPrimaryCta
      // (CTA, inside it) already made page.title/page.summary/the CTA
      // correct at this exact point — but nothing has re-run inline
      // content editing's "Edited" badge/reset-control decoration against
      // that freshly-correct data yet. That decoration normally happens as
      // a side effect of js/inline-content-edit.js's own render wrapper,
      // chained off THIS SAME render's promise — but that wrapper's
      // callback and this function's callback are two independent .then()s
      // on the same promise, and this one can resolve first, leaving
      // inline content editing's decorate() pass to run against whatever
      // it happened to catch (sometimes before this patch, sometimes
      // after, depending on real network/paint timing) — confirmed live on
      // the deployed production build: the badge reappeared on 3 of 4
      // reloads and silently didn't on the 4th, with no console error and
      // the underlying data correct every time. Calling decoration
      // directly, right here, removes the dependency on that ordering
      // entirely: by the time this line runs, the data it reads is
      // guaranteed current, so there is nothing left to race.
      window.inlineEdit?.decorateEditedFields?.()
      // Section-level edits (heading/paragraphs/bullets) are reapplied
      // separately from the three page-level fields above:
      // updateMockupTextFromSavedState already owns edited_title/
      // edited_summary/primary_cta, and this must not duplicate that.
      // applyContentEditsToPageData is DOM-free (see js/inline-content-edit-
      // data.js) — it only mutates page.sections in memory. The page was
      // already rendered from its PRISTINE shape before this function ever
      // ran (js/app.js's initial render is unwrapped, and every wrapped
      // render calls the real DOM-producing render before this reapply
      // step), so a true return here means the DOM the reviewer is looking
      // at is now stale and needs exactly one follow-up render to catch up.
      // refreshInFlightForKey's whole safety argument (see its own comment
      // above) rests on `page` staying reference-equal to DATA.pages[pageKey]
      // from the read at the top of this function through this exact call —
      // a future change that reads a clone here instead would silently start
      // suppressing renders it shouldn't, with no thrown error to catch it.
      // This turns that invariant loud instead of silent.
      console.assert(
        page === DATA.pages[pageKey],
        'applySavedPageState: page identity drifted from DATA.pages[pageKey] before ' +
          'applyContentEditsToPageData — refreshInFlightForKey depends on in-place mutation ' +
          "of the live object (see the comment above refreshInFlightForKey's declaration)."
      )
      const appliedSectionEdits = window.inlineEditData?.applyContentEditsToPageData(page, saved)
      // Note this now means "the page actually changed", not "a path was
      // written" — see applyContentEditsToPageData's own docblock and issue
      // #118. A repaint that changes nothing is not free: it replaces
      // #mockPage wholesale, which removes whatever holds focus, which fires
      // an open inline editor's focusout, which commits it against a
      // detached editor and loses the reviewer's in-flight text.
      const dataMoved = Boolean(appliedSectionEdits || ctaChanged)
      if (dataMoved && isOwnTriggeredRefresh) {
        // This call moved data but must not render (it IS the follow-up of a
        // render already in flight). Record the debt so the next call pays
        // it even if that call changes nothing itself.
        dirtySinceLastPaintForKey = pageKey
      }
      if (
        (dataMoved || dirtySinceLastPaintForKey === pageKey) &&
        !isOwnTriggeredRefresh &&
        typeof window.renderPage === 'function'
      ) {
        dirtySinceLastPaintForKey = null
        refreshInFlightForKey = pageKey
        // skipHistory=true: this is an internal refresh to reflect a reapply
        // that already happened, not a user navigation — it must not push a
        // history entry or disturb the back button.
        window.renderPage(pageKey, true)
      }
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

  /**
   * Render the Checks panel for the page currently in the mockup.
   *
   * @param {string} [pageKey] The page to score. Same reasoning as
   *   `renderStickyBar()`: the `getCurrentPage()` fallback reads
   *   `#pageSelect.value`, which is still on its first `<option>` while the
   *   initial View Transition is in flight. This panel returns early while
   *   hidden, so the stale read only surfaced for a reviewer who left the
   *   Checks tab open — `initWorkspaceTabs()` restores that tab before
   *   `restoreInitialPage()` runs, and they came back to another page's scores.
   */
  function renderPageChecksPanel(pageKey) {
    const panel = document.getElementById(CHECKS_PANEL_ID)
    if (!panel) return

    // Skip rebuilds while the panel can't be seen; the Checks tab re-renders on
    // activation (setWorkspaceTab in js/ux-improvements-workspace.js).
    const workspace = document.getElementById('reviewWorkspace')
    if (workspace?.hidden || panel.hidden) return

    const page = (pageKey && DATA.pages[pageKey]) || getCurrentPage()
    const allRules = getRuleResults(page)
    const scored = scoredRules(allRules)
    const facts = allRules.filter((rule) => rule.scored === false)
    // Failures first. The list used to render in declaration order, so on a
    // page passing all but one rule a reviewer scanned a column of green to
    // find the single item they could act on — and the three schema-guaranteed
    // rules sat at the top of it. Order within each group is preserved.
    const ordered = [...scored.filter((rule) => !rule.pass), ...scored.filter((rule) => rule.pass)]
    const passed = scored.filter((rule) => rule.pass).length

    // The advisory section is still a template string, so it gets its own
    // child element: writing innerHTML on the panel itself would tear out the
    // React root next to it. Both hosts are created once and then updated in
    // place, in DOM order — scored list first, advice below it.
    const islandHost = ensureChecksHost(panel, 'reviewChecksIsland')
    const adviceHost = ensureChecksHost(panel, 'reviewChecksAdvice')
    adviceHost.innerHTML = renderPlainLanguageAdvice(page)

    // A generation counter, for the same reason js/review-insights.js keeps
    // one: the island arrives over a dynamic import, and a reviewer can change
    // page again while that promise is in flight. Without this, a slow first
    // load repaints the previous page's scores over the current ones.
    const generation = ++checksIslandGeneration
    loadChecksIsland().then((mountChecksPanel) => {
      if (!mountChecksPanel || generation !== checksIslandGeneration) return
      mountChecksPanel(panel, {
        pageTitle: page.title || pageKey || getCurrentKey(),
        rules: ordered,
        facts,
        passed,
      })
    })
  }

  /** Bumped per render; a resolved import older than this one is discarded. */
  let checksIslandGeneration = 0

  /** @type {Promise<Function|null>|null} Cached module load, see below. */
  let checksIslandPromise = null

  /**
   * Load the React + MUI island on first use.
   *
   * Dynamic, not a static import, and for the same reason ECharts is: React,
   * React DOM, Emotion and MUI are far larger than the rest of the app, and a
   * reviewer who never opens the Checks tab should never download them. Vite
   * emits them as their own chunk because this import is dynamic.
   *
   * A failed load resolves to `null` rather than rejecting — the panel's
   * advisory section has already rendered by then, and an unhandled rejection
   * in a review aid should not surface as a broken tab.
   *
   * @returns {Promise<Function|null>} `mountChecksPanel`, or null if it failed.
   */
  function loadChecksIsland() {
    if (!checksIslandPromise) {
      checksIslandPromise = import('./react/checks-panel.jsx')
        .then((module) => module.mountChecksPanel)
        .catch(() => null)
    }
    return checksIslandPromise
  }

  /**
   * Find or create one of the Checks panel's two host elements.
   *
   * @param {Element} panel
   * @param {string} id
   * @returns {Element}
   */
  function ensureChecksHost(panel, id) {
    const existing = panel.querySelector(`#${id}`)
    if (existing) return existing
    const host = document.createElement('div')
    host.id = id
    panel.appendChild(host)
    return host
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
    hydrateAllPageTextFromSavedState,
    applySavedPageState,
    applySavedUiPreferences,
    updateLocalStorageStatus,
    SEO_TITLE_LIMIT,
    META_DESCRIPTION_LIMIT,
  }
})()
