/* Applies the reviewer-managed page registry onto window.HHVC_DATA, and owns
   the runtime add/delete/restore operations.

   LOAD ORDER — this is the whole reason the file exists where it does.

   js/state.js imports THIS file in place of js/page-data.js, so the module
   graph guarantees the sequence rather than js/main.js doing it by convention.
   Running before js/state.js is not a preference:

   - js/state.js:24 takes ORIGINAL_DATA as a ONE-TIME deep clone of
     window.HHVC_DATA. A page added after that clone has no ORIGINAL_DATA entry,
     and computeSectionEdits() returns {} when the original is missing — so
     inline paragraph and bullet edits on a reviewer-created page would appear
     to work, autosave, and silently vanish on the next load. Applying the
     registry first puts added pages inside the clone for free, and keeps hidden
     pages out of it.
   - js/app.js's init() runs at import time, calling buildPageSelect() and
     resolving the ?page= parameter. Applying the registry earlier means a deep
     link to an added page just works, instead of toasting "not a page in this
     mockup" and falling back to pestsTopic before the registry has been read.

   The three side-effect imports below are ordered, and ./page-data.js MUST stay
   first: js/review-state-store.js returns early when window.HHVC_DATA is
   absent, so importing it ahead of page-data.js would leave window.reviewState
   unpublished — turning a silent registry no-op into a hard TypeError in
   js/ux-improvements.js, which reads window.reviewState unguarded.

   FAILURE POSTURE. Everything here is wrapped so that a corrupt registry
   degrades to "the registry did nothing" rather than taking the app down. This
   file evaluates at the root of the module graph, so an uncaught throw kills
   every module after it and leaves the reviewer looking at index.html's static
   "Loading…" placeholder — with no UI left to remove the bad entry. The
   recovery path for that state is the sidebar's "Clear saved reviews" button,
   which clears the registry and reloads (see js/ux-improvements-export.js). */

import './page-data.js'
import './review-state-validation.js'
import './review-state-store.js'
import './page-registry-data.js'
;(function mountPageRegistry() {
  const DATA = window.HHVC_DATA
  const registryData = window.pageRegistryData
  if (!DATA || !DATA.pages || !DATA.order || !registryData) return
  // Defensive: js/review-state-store.js publishes this, and the import above
  // guarantees it has run — but it self-guards on page data, so a malformed
  // HHVC_DATA would leave it unpublished and every call below would throw.
  if (!window.reviewState) return

  const {
    PROTECTED_PAGE_KEYS,
    applyRegistryToData,
    countInboundLinks,
    deepClone,
    emptyRegistry,
    menuLabelFor,
    readRegistry,
    validateNewPage,
  } = registryData

  /* Hidden pages, keyed by page key, holding what is needed to put each one
     back exactly where it was: `{index, entry: [key, label], page}`.

     In memory only, and rebuilt on every load — which is correct rather than a
     shortcut. A hidden page authored in pages/*.js is re-registered onto
     window.HHVC_PAGES by its own module on the next load, so the stash is
     repopulated from live data before anything removes it again. Only the KEY
     needs to persist, which is why globals.page_registry.hidden stores a
     timestamp and nothing else. */
  const hiddenStash = {}

  /**
   * Read the registry out of saved review state.
   * @returns {{added: object, hidden: object}}
   */
  function currentRegistry() {
    try {
      return readRegistry(window.reviewState.read())
    } catch {
      return emptyRegistry()
    }
  }

  /**
   * Write a registry back, through the shared functional-updater store so it
   * merges with whatever else is in the blob rather than replacing it.
   * @param {(registry: {added: object, hidden: object}) => void} mutate
   */
  function updateRegistry(mutate) {
    window.reviewState.update((state) => {
      if (!state.globals || typeof state.globals !== 'object') state.globals = {}
      const registry = readRegistry(state)
      mutate(registry)
      state.globals.page_registry = registry
      return state
    })
  }

  /**
   * Every page key a new page could collide with.
   *
   * The alias keys are the ones easy to forget and the reason this is a
   * function rather than an inline expression: an added page shadowing a
   * retired key is harmless to resolvePageKey (it checks pageData first), but
   * it silently redirects a legacy shared link to content its author never
   * wrote — worse than the consolidation redirect it replaced.
   * @returns {Set<string>}
   */
  function existingKeys() {
    const registry = currentRegistry()
    return new Set([
      ...Object.keys(DATA.pages),
      ...Object.keys(registry.added),
      ...Object.keys(registry.hidden),
      ...Object.keys(window.HHVC_DELETED_PAGE_ALIASES || {}),
    ])
  }

  /**
   * Repaint everything derived from `order`/`pages` after a mutation.
   *
   * buildPageSelect() first and always: applyPageContent() sets
   * `#pageSelect.value = key` and silently no-ops when that option does not
   * exist, and getCurrentKey() reads the same value — so navigating to a page
   * the picker has never heard of files every later review write under
   * pestsTopic. Restoring the selection afterwards matters for the same reason:
   * buildPageSelect() rewrites innerHTML wholesale and does not preserve it.
   *
   * The queue and the ops panel are NOT called directly. Both already subscribe
   * to hhvc:review-data-changed, and a second explicit render would be a second
   * printing of the same refresh.
   * @param {string} [selectKey] page key to leave selected
   */
  function refreshDerivedViews(selectKey) {
    window.buildPageSelect?.()
    const select = document.getElementById('pageSelect')
    if (select && selectKey && DATA.pages[selectKey]) select.value = selectKey
    document.dispatchEvent(new CustomEvent('hhvc:review-data-changed'))
  }

  /**
   * Seed or drop the pristine snapshot for one page.
   *
   * A deep clone, never the live object: ORIGINAL_DATA is what
   * computeSectionEdits() diffs the live page against, so an alias would make
   * every inline edit diff clean and quietly stop section edits from
   * persisting. It is also what the per-field "reset to original" control and
   * the Edited badge read, both of which early-return without it.
   * @param {string} key
   * @param {object|null} page the page to snapshot, or null to remove it
   */
  function syncOriginalData(key, page) {
    const original = window.ORIGINAL_DATA
    if (!original || !original.pages) return
    if (page) original.pages[key] = deepClone(page)
    else delete original.pages[key]
  }

  /**
   * Apply the saved registry onto live page data. Called once at boot, and
   * again after an import merges another browser's registry in.
   * @returns {{added: string[], hidden: string[], dropped: string[]}}
   */
  function applySavedRegistry() {
    try {
      const result = applyRegistryToData(DATA, currentRegistry(), hiddenStash)
      if (result.dropped.length) {
        // Reported rather than silently swallowed: a dropped entry means saved
        // state the reviewer cannot see and this tool will not honour.
        console.warn('HHVC page registry: ignored unusable entries for', result.dropped.join(', '))
      }
      return result
    } catch (err) {
      console.error('HHVC page registry: failed to apply saved pages.', err)
      return { added: [], hidden: [], dropped: [] }
    }
  }

  /**
   * Create a page from validated form values.
   *
   * Persists before mutating, so a storage failure leaves the page absent
   * rather than present-but-unsaved — the direction that survives a reload
   * honestly.
   * @param {object} input raw form values
   * @returns {{ok: boolean, errors: string[], key: string}}
   */
  function addPage(input) {
    const validation = validateNewPage(input, { existingKeys: existingKeys() })
    if (!validation.ok) return { ok: false, errors: validation.errors, key: '' }

    const { key, page, label } = validation
    updateRegistry((registry) => {
      registry.added[key] = { page: deepClone(page), label, created_at: new Date().toISOString() }
      // An added key can never also be hidden — the two halves would disagree
      // about whether the page exists.
      delete registry.hidden[key]
    })
    applySavedRegistry()
    syncOriginalData(key, DATA.pages[key])
    refreshDerivedViews(key)
    // Through window.renderPage, not the import: the js/ux-improvements.js
    // wrapper is what reassigns reviewFormPageKey and runs applySavedPageState
    // for the destination.
    window.renderPage?.(key)
    return { ok: true, errors: [], key }
  }

  /**
   * Hide a page — the tool's "delete".
   *
   * Uniform across both kinds of page, and reversible either way: an added page
   * keeps its object in registry.added, an authored one comes back from its own
   * source module on the next load. The review record is never touched, which
   * is what makes Restore meaningful.
   * @param {string} key
   * @returns {{ok: boolean, error: string|null}}
   */
  function deletePage(key) {
    if (!key || !DATA.pages[key]) return { ok: false, error: 'That page is not in the mockup.' }
    if (PROTECTED_PAGE_KEYS.includes(key)) {
      return { ok: false, error: 'The HHVC agency page cannot be deleted — it anchors the site.' }
    }
    if (DATA.order.length <= 1) {
      return { ok: false, error: 'This is the last page in the mockup. It cannot be deleted.' }
    }

    const wasCurrent = window.utils?.getCurrentKey?.() === key

    /* Flush BEFORE mutating. reviewFormPageKey still points at this page until
       the navigation below settles, so a keystroke still inside the autosave
       debounce would otherwise save a record built from `DATA.pages[key] || {}`
       — blanking the very title, summary and section edits Restore exists to
       bring back. At this moment the page still exists, so the flush is well
       formed; it also leaves pendingPersist false, which makes the render
       wrapper's own pre-navigation flush a no-op rather than a second write. */
    window.ReviewUx?.flushPendingPersist?.()

    updateRegistry((registry) => {
      registry.hidden[key] = { hidden_at: new Date().toISOString() }
    })
    applySavedRegistry()
    syncOriginalData(key, null)

    /* The queue's one-step undo is the only queue path that does NOT filter on
       DATA.pages, so a snapshot taken before this hide would still offer
       "Undo Approved · N pages" and then write a record for a page that is no
       longer here — with a count that is a lie. Consume it. */
    window.ReviewQueueInternal?.undo?.clearAction?.()

    const nextKey = DATA.order[0]?.[0]
    refreshDerivedViews(wasCurrent ? nextKey : window.utils?.getCurrentKey?.())
    if (wasCurrent && nextKey) window.renderPage?.(nextKey)
    return { ok: true, error: null }
  }

  /**
   * Put a hidden page back at its original position in `order`.
   *
   * The original index, not the end: `order` is the reviewer's reading order
   * and drives j/k navigation, the queue's row order, the picker and batch PNG
   * export, so appending on restore would silently permute the site.
   * @param {string} key
   * @returns {{ok: boolean, error: string|null}}
   */
  function restorePage(key) {
    const stashed = hiddenStash[key]
    updateRegistry((registry) => {
      delete registry.hidden[key]
    })

    if (stashed && !DATA.pages[key]) {
      DATA.pages[key] = stashed.page
      const index = Math.min(Math.max(stashed.index, 0), DATA.order.length)
      DATA.order.splice(index, 0, stashed.entry)
      delete hiddenStash[key]
      syncOriginalData(key, DATA.pages[key])
    } else {
      // No stash — the page was hidden in an earlier session and its source
      // module has not run this session either (an added page). Re-apply the
      // registry, which will materialise it from registry.added.
      applySavedRegistry()
      syncOriginalData(key, DATA.pages[key])
    }

    if (!DATA.pages[key]) {
      return {
        ok: false,
        error: 'That page could not be restored in this session. Reload the page.',
      }
    }
    refreshDerivedViews(key)
    return { ok: true, error: null }
  }

  /**
   * Drop a reviewer-added page for good.
   *
   * Deliberately does NOT delete the page's review record. Every other path in
   * this tool merges rather than deletes, and there is already exactly one
   * sanctioned review-data deletion flow — the orphan prune in the same Help
   * panel, which this leaves the record to. Re-deriving a second one here would
   * duplicate that machinery and double the number of buttons that can lose a
   * review.
   * @param {string} key
   * @returns {{ok: boolean, error: string|null}}
   */
  function removeAddedPage(key) {
    const registry = currentRegistry()
    if (!registry.added[key]) {
      return { ok: false, error: 'That page was not added during review.' }
    }
    const wasCurrent = window.utils?.getCurrentKey?.() === key
    window.ReviewUx?.flushPendingPersist?.()

    updateRegistry((next) => {
      delete next.added[key]
      delete next.hidden[key]
    })

    const index = DATA.order.findIndex(([orderKey]) => orderKey === key)
    if (index !== -1) DATA.order.splice(index, 1)
    delete DATA.pages[key]
    delete hiddenStash[key]
    syncOriginalData(key, null)
    window.ReviewQueueInternal?.undo?.clearAction?.()

    const nextKey = DATA.order[0]?.[0]
    refreshDerivedViews(wasCurrent ? nextKey : window.utils?.getCurrentKey?.())
    if (wasCurrent && nextKey) window.renderPage?.(nextKey)
    return { ok: true, error: null }
  }

  /**
   * Merge another browser's registry in from a JSON backup, then apply it.
   *
   * Local wins on a key collision. That is the same "merge, never wipe" posture
   * the review-record import path takes, and the keyed-object storage shape is
   * what makes it a spread: two arrays would concatenate and duplicate every
   * entry on the first import.
   *
   * Must run BEFORE importReviewStateBackup()'s `entries` filter, which
   * requires DATA.pages[key] and would otherwise silently drop every imported
   * review record belonging to an added page. It persists through its own
   * reviewState.update, so the caller's later update — which re-reads state and
   * spreads ...state.globals — carries the merged registry forward untouched.
   * @param {object} importedState a validated review-state blob
   * @returns {{added: string[], hidden: string[], dropped: string[]}}
   */
  function applyImportedRegistry(importedState) {
    const empty = { added: [], hidden: [], dropped: [] }
    try {
      const imported = readRegistry(importedState)
      if (!Object.keys(imported.added).length && !Object.keys(imported.hidden).length) return empty
      updateRegistry((registry) => {
        registry.added = { ...imported.added, ...registry.added }
        registry.hidden = { ...imported.hidden, ...registry.hidden }
      })
      const result = applySavedRegistry()
      for (const key of result.added) syncOriginalData(key, DATA.pages[key])
      for (const key of result.hidden) syncOriginalData(key, null)
      refreshDerivedViews(window.utils?.getCurrentKey?.())
      return result
    } catch (err) {
      console.error('HHVC page registry: failed to apply an imported registry.', err)
      return empty
    }
  }

  /**
   * The pages a reviewer added, newest last, each with whether it is hidden.
   * @returns {Array<{key: string, label: string, title: string, hidden: boolean, createdAt: string}>}
   */
  function listAdded() {
    const registry = currentRegistry()
    return Object.entries(registry.added)
      .map(([key, entry]) => ({
        key,
        label: typeof entry?.label === 'string' ? entry.label : menuLabelFor(entry?.page),
        title: String(entry?.page?.title ?? key),
        hidden: Boolean(registry.hidden[key]),
        createdAt: String(entry?.created_at ?? ''),
      }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  /**
   * The pages a reviewer deleted, with the title resolved from whatever source
   * still knows it — the in-memory stash first, then the added registry.
   * @returns {Array<{key: string, title: string, wasAdded: boolean, hiddenAt: string}>}
   */
  function listHidden() {
    const registry = currentRegistry()
    return Object.entries(registry.hidden)
      .map(([key, entry]) => ({
        key,
        title: String(hiddenStash[key]?.page?.title ?? registry.added[key]?.page?.title ?? key),
        wasAdded: Boolean(registry.added[key]),
        hiddenAt: String(entry?.hidden_at ?? ''),
      }))
      .sort((a, b) => a.hiddenAt.localeCompare(b.hiddenAt))
  }

  /**
   * @param {string} key
   * @returns {boolean} whether this key is currently deleted
   */
  function isHidden(key) {
    return Boolean(currentRegistry().hidden[key])
  }

  // Boot. Wrapped inside applySavedRegistry, so a corrupt blob costs the
  // registry and nothing else.
  applySavedRegistry()

  window.pageRegistry = {
    addPage,
    applyImportedRegistry,
    countInboundLinks: (key) => countInboundLinks(DATA, key),
    deletePage,
    existingKeys,
    hiddenKeys: () => Object.keys(currentRegistry().hidden),
    isHidden,
    listAdded,
    listHidden,
    removeAddedPage,
    restorePage,
  }
})()
