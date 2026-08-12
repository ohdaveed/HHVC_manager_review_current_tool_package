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
    restoreOrderIndex,
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

  /* Every page key in canonical site order. `applyRegistryToData()` does not
     mutate this array in place — it returns a new `canonicalOrder` alongside
     its other results, and every call site below reassigns this `let`
     binding from that return value. This is what restore positions against,
     rather than the numeric index recorded at hide time: that index is
     measured against an already-shortened order, so two hides can record the
     same number and restoring them permutes the site. See
     restoreOrderIndex()'s comment in js/page-registry-data.js for the worked
     example. */
  let canonicalOrder = []

  /* The keys that come from pages/*.js, captured NOW — before applySavedRegistry()
     has run even once, so `DATA.pages` still holds exactly the authored set.

     This is what tells an idempotent re-apply apart from a genuine collision. An
     old backup can carry `added.foo` for a key that has since become a real
     authored page; applyRegistryToData() then reports `foo` in `collided`
     because a page already occupies it, and without this set that is
     indistinguishable from re-applying a page the registry itself added earlier.
     Treating it as reviewer-added is actively harmful: the Help panel would
     present an authored page as one the reviewer created, and Remove would
     delete it from the live mockup until the next reload. */
  const authoredKeys = new Set(Object.keys(DATA.pages))

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
    let intended = null
    window.reviewState.update((state) => {
      if (!state.globals || typeof state.globals !== 'object') state.globals = {}
      const registry = readRegistry(state)
      mutate(registry)
      state.globals.page_registry = registry
      intended = registry
      return state
    })

    /* Verified by re-reading, because reviewState.update() cannot fail loudly.
       writeLocalState() catches the setItem exception itself (localStorage
       disabled, or quota exhausted) and returns normally after showing the global
       error banner — so a caller that trusts it would mutate live page data,
       report success and show an "Added" toast for a page that is gone on the
       next reload. Comparing what we meant to store against what actually came
       back is the only honest check available from here. */
    try {
      const stored = currentRegistry()
      return JSON.stringify(stored) === JSON.stringify(intended)
    } catch {
      return false
    }
  }

  /** The message shown when the registry could not be written to localStorage. */
  const STORAGE_FAILED =
    'That change could not be saved in this browser — local storage may be full or disabled. ' +
    'Nothing was changed.'

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
   * Record the pristine snapshot for a page that has none.
   *
   * A deep clone, never the live object: ORIGINAL_DATA is what
   * computeSectionEdits() diffs the live page against, so an alias would make
   * every inline edit diff clean and quietly stop section edits from
   * persisting. It is also what the per-field "reset to original" control and
   * the Edited badge read, both of which early-return without it.
   *
   * ONLY WHEN MISSING, which is the whole correctness argument on the restore
   * path. An existing entry is by definition the pristine copy — either cloned
   * by js/state.js at boot or written here when the page was created — and
   * overwriting it with whatever is live now would replace "original" with
   * "edited". The damage from that is silent and total: computeSectionEdits()
   * would then find no difference, the next autosave would recompute
   * `section_edits` as empty, and every heading, paragraph and bullet edit the
   * reviewer had made would be dropped from storage. "Reset to original" would
   * reset to the edit. This is why deletePage() no longer removes the entry at
   * all: leaving it in place is what makes restore correct, and a snapshot for a
   * page that is temporarily absent costs nothing.
   * @param {string} key
   * @param {object|null} page the page to snapshot when none is recorded yet
   */
  function seedOriginalDataIfMissing(key, page) {
    const original = window.ORIGINAL_DATA
    if (!original || !original.pages || !page) return
    if (original.pages[key]) return
    original.pages[key] = deepClone(page)
  }

  /**
   * Forget a page's pristine snapshot. Only for a page that is gone for good —
   * a hidden page keeps its snapshot so restore can hand back the edits.
   * @param {string} key
   */
  function dropOriginalData(key) {
    const original = window.ORIGINAL_DATA
    if (!original || !original.pages) return
    delete original.pages[key]
  }

  /**
   * Apply the saved registry onto live page data. Called once at boot, and
   * again after an import merges another browser's registry in.
   * @returns {{added: string[], hidden: string[], dropped: string[]}}
   */
  function applySavedRegistry() {
    try {
      const result = applyRegistryToData(DATA, currentRegistry(), hiddenStash, canonicalOrder)
      canonicalOrder = result.canonicalOrder
      if (result.dropped.length) {
        // Reported rather than silently swallowed: a dropped entry means saved
        // state the reviewer cannot see and this tool will not honour.
        console.warn('HHVC page registry: ignored unusable entries for', result.dropped.join(', '))
      }
      const collisions = result.collided.filter((key) => authoredKeys.has(key))
      if (collisions.length) {
        console.warn(
          'HHVC page registry: these added pages collide with real pages in pages/*.js and are ' +
            'being ignored — the authored page wins:',
          collisions.join(', ')
        )
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
    const persisted = updateRegistry((registry) => {
      registry.added[key] = { page: deepClone(page), label, created_at: new Date().toISOString() }
      // An added key can never also be hidden — the two halves would disagree
      // about whether the page exists.
      delete registry.hidden[key]
    })
    // Nothing is mutated on a failed write. applySavedRegistry() reads the
    // PERSISTED registry, so it would find nothing to add and the page would
    // never appear — while this function reported success.
    if (!persisted) return { ok: false, errors: [STORAGE_FAILED], key: '' }
    applySavedRegistry()
    seedOriginalDataIfMissing(key, DATA.pages[key])
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

    if (
      !updateRegistry((registry) => {
        registry.hidden[key] = { hidden_at: new Date().toISOString() }
      })
    ) {
      return { ok: false, error: STORAGE_FAILED }
    }
    applySavedRegistry()
    /* The pristine snapshot in ORIGINAL_DATA is deliberately LEFT IN PLACE. It
       is what restore hands back: drop it here and the reviewer's inline
       heading/paragraph/bullet edits on this page are lost the moment they
       restore it, because seeding a fresh snapshot from the (already edited)
       live object makes computeSectionEdits() see no difference and the next
       autosave recompute `section_edits` as empty. Only removeAddedPage()
       forgets a snapshot, because only there is the page gone for good. */

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
   * Put a hidden page back where it belongs in `order`.
   *
   * Positioned against the canonical sequence, not the index recorded at hide
   * time: `order` is the reviewer's reading order and drives j/k navigation, the
   * queue, the picker and batch PNG export, and a remembered index permutes it
   * as soon as two pages are hidden and restored. See restoreOrderIndex().
   *
   * The persisted `hidden` flag is cleared LAST, only once the page is actually
   * back. Clearing it first — which this did — means a restore that cannot
   * materialise the page returns an error having already recorded the page as
   * not hidden: it vanishes from the Help list's deleted section while still
   * being absent from the mockup, so the reviewer is left with no control for it
   * at all. addPage() states the same ordering rule for the same reason.
   * @param {string} key
   * @returns {{ok: boolean, error: string|null}}
   */
  function restorePage(key) {
    const stashed = hiddenStash[key]

    let restoredFromStash = false

    if (stashed && !DATA.pages[key]) {
      DATA.pages[key] = stashed.page
      const index = restoreOrderIndex(
        canonicalOrder,
        DATA.order.map(([orderKey]) => orderKey),
        key
      )
      DATA.order.splice(index, 0, stashed.entry)
      delete hiddenStash[key]
      restoredFromStash = true
    } else if (!DATA.pages[key]) {
      /* No stash — the page was hidden in an earlier session and its source
         module has not run this session either, so it can only be a
         reviewer-added page held in registry.added. applySavedRegistry() reads
         the PERSISTED registry, so the hidden flag has to come off first here;
         the guard below then puts nothing back if it still failed to appear. */
      if (
        !updateRegistry((registry) => {
          delete registry.hidden[key]
        })
      ) {
        return { ok: false, error: STORAGE_FAILED }
      }
      applySavedRegistry()
    }

    if (!DATA.pages[key]) {
      // Put the flag back, so the row stays in the Help list and the reviewer
      // can retry after a reload rather than losing sight of the page entirely.
      updateRegistry((registry) => {
        registry.hidden[key] = registry.hidden[key] || { hidden_at: new Date().toISOString() }
      })
      return {
        ok: false,
        error: 'That page could not be restored in this session. Reload the page.',
      }
    }

    /* The live restore is ROLLED BACK if this write fails. Reporting success
       here while the persisted registry still says "hidden" is the worst of both
       worlds: the page is in the mockup now and gone again after a reload, with
       the reviewer told it was restored. Better to leave the page deleted —
       which is at least the state that survives — and say the save failed. */
    if (
      !updateRegistry((registry) => {
        delete registry.hidden[key]
      })
    ) {
      if (restoredFromStash) {
        const at = DATA.order.findIndex(([orderKey]) => orderKey === key)
        if (at !== -1) DATA.order.splice(at, 1)
        delete DATA.pages[key]
        hiddenStash[key] = stashed
      }
      return { ok: false, error: STORAGE_FAILED }
    }
    seedOriginalDataIfMissing(key, DATA.pages[key])
    /* The picker keeps the page the reviewer is actually LOOKING AT selected,
       not the one just restored. Selecting the restored key without rendering it
       is the same mismatch deletePage() guards against, pointing the other way:
       getCurrentKey() would return the restored key while #mockPage still showed
       the previous page, so the next note or content edit would be filed under
       the restored page — and the reviewer could not navigate to it by picking an
       option the picker already claimed was current. Restoring from a panel in
       Help should not yank the mockup either, so the fix is to leave the
       selection alone; the restored page is in the picker to be chosen normally. */
    refreshDerivedViews(window.utils?.getCurrentKey?.())
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
    /* Refused for a key that is really an authored page. An old backup can carry
       `added.foo` for a key that has since shipped in pages/*.js, and without
       this the reviewer's "Remove" would delete that authored page out of the
       live mockup — which the registry has no business doing and which would
       silently come back on the next reload anyway. */
    if (authoredKeys.has(key)) {
      return {
        ok: false,
        error:
          'That page now exists in the mockup’s own source files, so it cannot be removed here. ' +
          'Delete it instead if you want it out of the review.',
      }
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
    dropOriginalData(key)
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

      /* Captured before the mutation, because an import can hide the page that
         is currently on screen and that has to be navigated away from — not
         merely dropped from the picker. Leaving it means #mockPage still shows
         the deleted page while #pageSelect has moved to another key, and the
         caller's own applySavedPageState(getCurrentKey()) then patches that
         stale DOM and files later edits under the replacement key. Same hazard
         deletePage() handles, reached through import instead of a button. */
      const keyBefore = window.utils?.getCurrentKey?.()
      window.ReviewUx?.flushPendingPersist?.()

      updateRegistry((registry) => {
        registry.added = { ...imported.added, ...registry.added }
        registry.hidden = { ...imported.hidden, ...registry.hidden }
      })
      const result = applySavedRegistry()
      // Only ever SEEDS, never drops: a hidden page keeps its pristine snapshot
      // so a later restore can hand the reviewer their edits back.
      for (const key of result.added) seedOriginalDataIfMissing(key, DATA.pages[key])

      const lostCurrent = Boolean(keyBefore) && !DATA.pages[keyBefore]
      const nextKey = DATA.order[0]?.[0]
      refreshDerivedViews(lostCurrent ? nextKey : keyBefore)
      if (lostCurrent && nextKey) {
        window.ReviewQueueInternal?.undo?.clearAction?.()
        window.renderPage?.(nextKey)
      }
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
    return (
      Object.entries(registry.added)
        /* An authored page is never listed as reviewer-added, however stale the
         registry entry claiming otherwise is. Presenting a real pages/*.js page
         as something the reviewer created is a lie about where content came
         from, and it is the lie that made Remove look applicable to it. */
        .filter(([key]) => !authoredKeys.has(key))
        .map(([key, entry]) => ({
          key,
          label: typeof entry?.label === 'string' ? entry.label : menuLabelFor(entry?.page),
          title: String(entry?.page?.title ?? key),
          hidden: Boolean(registry.hidden[key]),
          createdAt: String(entry?.created_at ?? ''),
        }))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    )
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
    /* Every key the registry knows about, present in the mockup or not. The
       JSON import path needs this: a deleted page is absent from DATA.pages but
       its review record must still be merged, or restoring the page later hands
       back the mockup without the review the backup was taken to preserve. */
    knownKeys: () => {
      const registry = currentRegistry()
      return [...new Set([...Object.keys(registry.added), ...Object.keys(registry.hidden)])]
    },
    listAdded,
    listHidden,
    removeAddedPage,
    restorePage,
  }
})()
