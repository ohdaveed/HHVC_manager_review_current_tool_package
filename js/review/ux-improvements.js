/* Manager review UX/UI enhancements: orchestrator.
   Runs after js/core/app.js and does not change source page content or review
   export schemas. Composes window.ReviewUx.stateSync/.workspace/.exportImport
   (each in their own file, loaded before this one) into init()/refresh
   wiring. */

import { hasValidPageData, resolvePageKey } from '../core/utils.js'
;(function improveManagerReviewUx() {
  const DATA = window.HHVC_DATA
  if (
    !hasValidPageData(DATA) ||
    !window.ReviewUx?.stateSync ||
    !window.ReviewUx?.workspace ||
    !window.ReviewUx?.exportImport
  )
    return

  const { debounce, getCurrentKey } = window.utils
  // Rebuilding the dashboard grid/scorecard and page-search list on every
  // keystroke is wasted work while the reviewer is still typing. Debounce the
  // 'input' path; 'change' (fires on blur) still refreshes immediately so the
  // dashboard is never stale once the reviewer moves on.
  const REFRESH_DEBOUNCE_MS = 300

  function refreshUx() {
    // Pass reviewFormPageKey rather than letting these re-derive the page from
    // #pageSelect: during startup the picker still holds its first <option>
    // while the initial View Transition is in flight, and both panels were
    // painting that arbitrary page. reviewFormPageKey is assigned in every
    // branch of restoreInitialPage() before the first refreshUx(), and again
    // in applyAndRefresh() after each render, so it is the one value here that
    // is never mid-navigation. It is null only before the first render, where
    // both callees fall back to the old behaviour.
    window.ReviewUx.workspace.renderStickyBar(reviewFormPageKey ?? undefined)
    window.ReviewUx.stateSync.renderPageChecksPanel(reviewFormPageKey ?? undefined)
    window.ReviewUx.stateSync.updateLocalStorageStatus()
    window.ReviewUx.workspace.updateDecisionQuickActions()
    document.dispatchEvent(new CustomEvent('hhvc:review-data-changed'))
  }

  // True only while reviewer keystrokes are sitting in the debounce window
  // below, waiting to be persisted. The flush paths (page switch, pagehide,
  // beforeunload, visibilitychange) must save ONLY when this is set:
  // saving unconditionally creates a review record for a page the reviewer
  // merely looked at, which marks it "touched" in the queue, reorders the
  // priority sort mid-navigation, and skews progress counts (the regression
  // behind the 3 e2e navigation failures introduced by fba9ef5).
  let pendingPersist = false

  // Set once, inside wrapRenderPage(), to the pre-wrap render function.
  // restoreInitialPage()'s hydration-only repaints call this directly rather
  // than the wrapped window.renderPage — see the comment at those call sites
  // for why going through the wrapper's applyAndRefresh is actively wrong
  // there, not just redundant.
  let unwrappedRenderPage = null

  // The page key whose review-form values are currently loaded in the
  // sidebar. getCurrentKey() (which reads #pageSelect.value) is NOT a safe
  // stand-in mid-navigation: when the reviewer switches pages via the page
  // picker, the <select> already holds the DESTINATION key when its change
  // handler calls renderPage, so a flush keyed off getCurrentKey() would file
  // the outgoing page's unsaved edits under the incoming page. Updated in
  // applyAndRefresh() after each render; null until the first render settles
  // (persistAndRefresh falls back to getCurrentKey() then, which is correct
  // outside of navigation).
  let reviewFormPageKey = null

  function persistAndRefresh() {
    pendingPersist = false
    window.ReviewUx.stateSync.saveCurrentPageToLocalStorage(reviewFormPageKey ?? undefined)
    refreshUx()
  }

  /**
   * Persist immediately if (and only if) debounced edits are still pending.
   * Clearing pendingPersist inside persistAndRefresh also disarms the
   * trailing debounce timer (it re-checks the flag), so a flush followed by
   * a page switch can never save the NEW page's form values under a stale
   * timer — the exact cross-page-write bug the flush exists to stop.
   */
  function flushPendingPersist() {
    if (!pendingPersist) return
    persistAndRefresh()
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
    ]

    // The debounced path re-checks pendingPersist so that an intervening
    // flush (page switch / pagehide) makes the trailing timer a no-op
    // instead of double-saving — or worse, saving after the page changed.
    const debouncedPersistAndRefresh = debounce(() => {
      if (pendingPersist) persistAndRefresh()
    }, REFRESH_DEBOUNCE_MS)

    for (const id of persistedFields) {
      const el = document.getElementById(id)
      if (!el) continue
      el.addEventListener('input', () => {
        pendingPersist = true
        debouncedPersistAndRefresh()
      })
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
    // localStorage ('change' only fires on blur). Conditional on
    // pendingPersist: an unconditional save here would create a review
    // record for every page the reviewer merely opened.
    window.addEventListener('pagehide', flushPendingPersist)
    window.addEventListener('beforeunload', flushPendingPersist)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushPendingPersist()
    })
  }

  function wrapRenderPage() {
    if (typeof window.renderPage !== 'function' || window.renderPage.__uxWrapped) return
    const originalRenderPage = window.renderPage
    unwrappedRenderPage = originalRenderPage
    // Forward skipHistory so wrapped popstate renders don't push history
    // entries (which would clear the browser's forward stack).
    window.renderPage = function renderPageWithUxRefresh(key, skipHistory) {
      // Flush any in-progress sidebar edits before the page switch. The
      // debounced input handler can still be pending; without this flush,
      // applyPageContent overwrites the form and the pending save can write
      // the *new* page's values under the wrong key — or drop the previous
      // page's unsaved keystrokes entirely (critique P3). flushPendingPersist
      // is a no-op when nothing was typed, so plain navigation never
      // manufactures a saved review record for an untouched page. Compare
      // against reviewFormPageKey (not getCurrentKey()): the page picker's
      // <select> already reflects the destination when this runs.
      const outgoingKey =
        reviewFormPageKey ?? (typeof getCurrentKey === 'function' ? getCurrentKey() : null)
      if (key && key !== outgoingKey) {
        flushPendingPersist()
      }

      const result = originalRenderPage.call(this, key, skipHistory)
      const applyAndRefresh = () => {
        // Read after applyPageContent so aliases/unknown keys resolve to the
        // page that actually rendered (View Transitions set currentPageKey
        // inside the transition callback, not before renderPage returns).
        const resolvedKey = typeof getCurrentKey === 'function' ? getCurrentKey() : key
        window.reviewState.update((state) => {
          state.ui.last_page_key = resolvedKey
          state.ui.show_karl_tags = document.getElementById('tagToggle')?.checked !== false
          return state
        })
        window.ReviewUx.stateSync.applySavedPageState(resolvedKey)
        // The sidebar form now holds this page's values; future flushes and
        // debounced persists must save under this key (see reviewFormPageKey).
        reviewFormPageKey = resolvedKey
        // Any keystrokes still pending from before the switch belonged to the
        // outgoing page; the pre-switch flush already saved or disarmed them,
        // but clear the flag defensively so a same-key re-render can't
        // persist form values that applySavedPageState just replaced.
        pendingPersist = false
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
    // Reapply every saved edited_title/edited_summary onto EVERY page's
    // in-memory data — not just the one about to (re)render below — before
    // anything here reads pageData for a card that might inherit its title
    // or description from a page the reviewer hasn't opened yet this
    // session. See hydrateAllPageTextFromSavedState()'s own comment for why
    // this can't reach js/core/app.js's already-completed initial render, which
    // is exactly why the branches below that don't otherwise re-render force
    // one after this call.
    window.ReviewUx?.stateSync?.hydrateAllPageTextFromSavedState?.()

    // An explicit ?page= URL param (a deep link, bookmark, or shared/review-
    // queue link) already drove js/core/app.js's initial render before this ran.
    // That takes priority over "reopen the page I was last viewing" — without
    // this guard, restoring last_page_key here silently overrides the
    // requested page moments after it renders (issue #68).
    const params = new URLSearchParams(window.location.search)
    if (params.has('page')) {
      // Resolve the ?page= param the same way js/core/app.js's initial render did
      // rather than trusting getCurrentKey(): under View Transitions the
      // initial applyPageContent runs asynchronously inside the transition
      // callback, so #pageSelect can still be sitting on its first <option>
      // (an arbitrary page) when this executes — caching that stale value
      // would misfile the first pre-navigation flush under the wrong key.
      const deepLinkKey =
        typeof resolvePageKey === 'function'
          ? resolvePageKey(
              params.get('page'),
              DATA.pages,
              window.HHVC_DELETED_PAGE_ALIASES,
              'pestsTopic'
            ).key
          : window.utils?.getCurrentKey?.()
      window.ReviewUx?.stateSync?.applySavedPageState(deepLinkKey)
      reviewFormPageKey = deepLinkKey ?? reviewFormPageKey
      // js/core/app.js already painted this page from PRISTINE data, before the
      // hydration above ever ran. That paint's own hero title/summary get
      // patched by applySavedPageState's direct DOM writes, but any card
      // this page renders that inherits from a DIFFERENT, hydrated page
      // needs a full repaint to pick that up — skipHistory=true since this
      // reflects a reapply that already happened, not a new navigation.
      // Calls the UNWRAPPED render function directly, not window.renderPage:
      // applySavedPageState(deepLinkKey) already ran, synchronously, on the
      // line above, so the wrapper's own applyAndRefresh would just repeat
      // that call for no reason — and worse, it would also stamp the
      // reviewer's CURRENT (possibly still-default, untouched) Karl-tags
      // toggle state into state.ui.show_karl_tags as though this were a real
      // page navigation. On a session where the reviewer has never touched
      // that toggle, that premature write turns an unset preference into a
      // persisted "false", which a later reload then wrongly treats as a
      // deliberate choice and hides Karl annotations that should still be
      // showing. This repaint is bookkeeping, not navigation, so it must not
      // carry navigation's side effects.
      if (unwrappedRenderPage) unwrappedRenderPage(deepLinkKey, true)
      refreshUx()
      return
    }

    const state = window.reviewState.read()
    const savedKey = state.ui.last_page_key

    if (savedKey && DATA.pages[savedKey] && typeof window.renderPage === 'function') {
      // Claim the key BEFORE the render settles: the wrapped renderPage only
      // assigns reviewFormPageKey inside its deferred applyAndRefresh
      // (setTimeout(0) or a View Transition promise), leaving it null in the
      // meantime. In that gap a page-picker navigation would fall back to
      // getCurrentKey() — already the DESTINATION key — so the pre-navigation
      // flush would be skipped and pending debounced edits dropped or misfiled
      // under the incoming page. The deep-link and default branches below
      // assign reviewFormPageKey for the same reason.
      reviewFormPageKey = savedKey
      // Already a full repaint (unlike the other two branches), so it reads
      // the hydration above with no extra render needed.
      window.renderPage(savedKey)
      return
    }

    // No deep link and no saved page: js/core/app.js's initial render already
    // showed the default page, from pristine data, before hydration above
    // ever ran — same gap as the deep-link branch, same fix.
    // Recompute that key the same way app.js did instead of reading
    // getCurrentKey() — under View Transitions the initial applyPageContent
    // runs asynchronously, so #pageSelect may still be on its first
    // <option> (an arbitrary page) at this point.
    const initialKey =
      typeof resolvePageKey === 'function'
        ? resolvePageKey(null, DATA.pages, window.HHVC_DELETED_PAGE_ALIASES, 'pestsTopic').key
        : getCurrentKey()
    window.ReviewUx.stateSync.applySavedPageState(initialKey)
    reviewFormPageKey = initialKey
    // Unwrapped, same reasoning as the deep-link branch above: applySavedPageState
    // already ran on the line above, so this is a bookkeeping repaint, not a
    // navigation, and must not carry the wrapper's applyAndRefresh side effects
    // (most importantly, must not stamp an untouched Karl-tags toggle into storage
    // as though the reviewer had made a real choice).
    if (unwrappedRenderPage) unwrappedRenderPage(initialKey, true)
    refreshUx()
  }

  function init() {
    window.ReviewUx.workspace.initWorkspaceTabs()
    window.ReviewUx.workspace.initDecisionQuickActions()
    window.ReviewUx.exportImport.mountReviewDataControls()
    window.reviewStateSync?.mountSyncControls()
    attachRefreshListeners()
    wrapRenderPage()
    window.ReviewUx.stateSync.applySavedUiPreferences()
    restoreInitialPage()
    // Pull the server's copy once the UI is standing, not before: the pull
    // adopts records into window.reviewState and calls renderConflicts, both
    // of which need the panel this init() just mounted. It resolves to a
    // no-op when sync is unconfigured, so an offline/local-only browser pays
    // nothing for this line. Deliberately not awaited — a slow or unreachable
    // server must not delay first paint of the mockup.
    window.reviewStateSync?.startAutoSync?.()
    refreshUx()
    window.ReviewUx.workspace.maybeShowWorkspaceOnboarding()
    // Defer one refresh so review-queue.js (loaded next) is ready for sticky bar stats.
    window.setTimeout(refreshUx, 0)
  }

  window.ReviewUx.refreshUx = refreshUx

  /* Published for js/core/page-registry.js, which has to flush before it mutates.
     Hiding a page removes it from DATA.pages, and reviewFormPageKey stays
     pinned to that key until the follow-up navigation settles — so a debounced
     keystroke landing in between would call collectCurrentPageReviewState()
     for a page that no longer exists, where `DATA.pages[key] || {}` makes
     page_title, edited_title, edited_summary and section_edits all resolve
     empty and rewrites the record with the reviewer's content blanked. That
     record is the thing Restore brings back, so the loss would be permanent.

     Flushing rather than discarding, deliberately: the pending keystrokes are
     real edits to the page being hidden, and at flush time that page still
     exists, so the save is well formed and lands under the right key. It also
     leaves pendingPersist false, which makes the wrapper's own pre-navigation
     flush a no-op instead of a second write. */
  window.ReviewUx.flushPendingPersist = flushPendingPersist

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
