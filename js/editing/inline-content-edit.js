/* Inline content editing: orchestrator. Delegated click handling on
   #mockPage, the edit-widget lifecycle (open/commit/cancel), and wiring
   into the existing autosave path. Sibling to js/editing/inline-content-edit-render.js
   (markup) and js/editing/inline-content-edit-data.js (pure section_edits logic).
   Mirrors the ai-assist split (js/ai/ai-assist.js orchestrates
   js/ai/ai-assist-client.js + js/ai/ai-assist-render.js).

   Unlike AI assist, this needs no backend and no capability check: the
   affordance is present whenever the page has loaded. Loads after
   js/editing/inline-content-edit-render.js and after js/ux-improvements.js (for
   window.ReviewUx.stateSync.saveCurrentPageToLocalStorage). */
;(function mountInlineContentEdit() {
  if (typeof window === 'undefined') return
  if (!window.InlineEdit?.render) return

  const render = window.InlineEdit.render
  const { getByPath, setByPath, getPrimaryCta, setPrimaryCta } = window.utils

  /** The data-rewrite-field path currently being edited, or null. One field
      editable at a time — opening a second editor commits/cancels the first
      implicitly by re-rendering the mockup, which the commit path already
      does. */
  let editingPath = null

  /**
   * Whether inline editing is currently open on any field. Exposed for
   * Task 8's e2e assertions and for any future caller that needs to avoid
   * stomping on an in-progress edit (e.g. a keyboard shortcut).
   * @returns {boolean}
   */
  function isEditing() {
    return editingPath !== null
  }

  /**
   * The `unverifiedReason` written onto a manually edited paragraph or bullet.
   *
   * Resolved from js/editing/inline-content-edit-adapter.js, which declares it, rather
   * than restated here: it is a persisted value inside `section_edits`, and
   * two literals of a stored string means two classes of edited item that stop
   * comparing equal. Read off `window` — this file has no import of the
   * adapter, matching how it already reaches it in EditorSession.open — with
   * the literal as a fallback so an adapter that has not mounted degrades to
   * the historical value rather than writing `undefined` into the review
   * record. js/main.js loads the adapter first, so the fallback is a guard,
   * not the expected path.
   */
  const MANUAL_EDIT_UNVERIFIED_REASON =
    window.inlineEditAdapter?.MANUAL_EDIT_UNVERIFIED_REASON || 'Manually edited during review'

  let editorJsModulePromise = null
  /**
   * Dynamically import @editorjs/editorjs on first use, mirroring
   * js/review-insights-charts.js's ECharts precedent — kept out of the
   * initial bundle since most reviewers never open an editor, and Editor.js
   * is real weight against a tool whose initial-load budget is protected.
   * @returns {Promise<Function>} the EditorJS class
   */
  function loadEditorJs() {
    if (!editorJsModulePromise) {
      editorJsModulePromise = import('@editorjs/editorjs').then((mod) => mod.default)
    }
    return editorJsModulePromise
  }

  /**
   * Map a data-rewrite-field path to js/editing/inline-content-edit-adapter.js's
   * FIELD_TYPES vocabulary: 'paragraph'/'bullet' for a numeric-suffixed
   * array item path, otherwise the page-level field name itself.
   * @param {string} path
   * @returns {string}
   */
  function editorFieldTypeFor(path) {
    if (path === 'title' || path === 'summary' || path === 'primaryCta') return path
    if (/\.heading$/.test(path)) return 'heading'
    // A field whose renderer does NOT call formatMarkdown() — a step title, a
    // contact phone number, the What-to-know cost — is edited as plain text
    // and written as a plain string. `markdownText` covers the two that are
    // plain strings in the schema but markdown-bearing on the page (a callout
    // body, a table cell), so their links survive the round trip.
    if (itemKindFor(path) === 'plainString') {
      return MARKDOWN_STRING_PATH_PATTERN.test(path) ? 'markdownText' : 'heading'
    }
    return /\.bullets\.\d+$/.test(path) ? 'bullet' : 'paragraph'
  }

  /**
   * The plain-string fields js/mockup/page-render.js renders through
   * formatMarkdown() rather than a bare escapeHtml(): a callout's body (on a
   * section or a step) and a table cell. Editing one of these as plain text
   * would show the reviewer raw `[label](target)` source and strip the link
   * tool from the toolbar, so they take the markdownText field type instead.
   */
  const MARKDOWN_STRING_PATH_PATTERN = /(?:\.callout\.text|\.table\.\d+\.\d+)$/

  /**
   * Read a scalar field's current text value, given its data-rewrite-field
   * path. Title/summary/CTA are page-level and read directly (they predate
   * getByPath's section-path scope); everything else is a getByPath lookup
   * against the current page object, unwrapped from the paragraph/bullet
   * {text, unverified, ...} object form when present.
   * @param {object} page
   * @param {string} path
   * @returns {string}
   */
  function readScalarValue(page, path) {
    if (path === 'title') return page.title || ''
    if (path === 'summary') return page.summary || ''
    if (path === 'primaryCta') return getPrimaryCta(page) || ''
    const raw = getByPath(page, path)
    if (raw && typeof raw === 'object') return raw.text || ''
    return typeof raw === 'string' ? raw : ''
  }

  /**
   * Write a committed scalar edit back onto the page object.
   *
   * A paragraph/bullet item is written as the tagged object form
   * {text, unverified: true, unverifiedReason: 'Manually edited during
   * review'} — reusing the existing Unverified-pill rendering with no
   * renderer change. Title/summary/heading/CTA have no such slot and are
   * written as plain strings; their "edited" signal is the CSS-only badge
   * applied separately in decorateEditedFields().
   * @param {object} page
   * @param {string} path
   * @param {string} value
   * @returns {void}
   */
  function writeScalarValue(page, path, value) {
    if (path === 'title') {
      page.title = value
      return
    }
    if (path === 'summary') {
      page.summary = value
      return
    }
    if (path === 'primaryCta') {
      setPrimaryCta(page, value)
      return
    }
    // Which of the two forms this field takes is decided by one shared
    // classifier (js/editing/inline-content-edit-data.js's editableItemKind), not by
    // a regex here. The tagged object is only correct for a body-copy item
    // whose renderer runs it through normalizeTextItem(); a table cell, a
    // contact phone number, a spotlight paragraph and every whole-field
    // string are printed directly, so writing the object into one of those
    // renders the literal "[object Object]" on the mockup.
    if (itemKindFor(path) === 'taggedText') {
      // Spread whatever the item already was, so a field the tagged form does
      // not name survives the edit. `label` is the live case: a
      // whatToKnow.thingsToKnow entry carries {label, text} and its label is
      // what renderWhatToKnow() prints as the entry's own H3 — replacing the
      // object wholesale would silently delete that heading the moment a
      // reviewer edited the paragraph under it.
      const existing = getByPath(page, path)
      const carried =
        existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {}
      setByPath(page, path, {
        ...carried,
        text: value,
        unverified: true,
        unverifiedReason: MANUAL_EDIT_UNVERIFIED_REASON,
      })
      return
    }
    setByPath(page, path, value)
  }

  /**
   * editableItemKind, resolved off the shared data module at call time.
   *
   * Read through window rather than captured at module scope for the same
   * reason js/mockup/page-render.js reads window.cardInheritance that way: this file
   * is an IIFE with no import of the dual-export module, and reading it lazily
   * keeps the two files' load order from mattering.
   * @param {string} path
   * @returns {'taggedText'|'plainString'|null}
   */
  function itemKindFor(path) {
    const kind = window.inlineEditData?.editableItemKind?.(path)
    if (kind) return kind
    // The classifier is unavailable (js/editing/inline-content-edit-data.js failed to
    // evaluate) or does not recognize the path. Fall back to the rule that
    // predates it — a heading is a plain string, anything else addressed by an
    // item path is tagged body copy — rather than to one branch of it. The
    // wrong default here is not cosmetic in either direction: a tagged object
    // written into a plain-string field renders "[object Object]", and a plain
    // string written into a paragraph silently drops its Unverified pill.
    return /\.heading$/.test(path) ? 'plainString' : 'taggedText'
  }

  /**
   * Persist the current page's review record through the existing autosave
   * path — no new history entry, matching every other keystroke-level field
   * in this tool.
   * @returns {void}
   */
  function persist() {
    window.ReviewUx?.stateSync?.saveCurrentPageToLocalStorage?.()
  }

  /**
   * Re-render the mockup for the current page. Decoration (add/remove
   * controls, Edited badges) is NOT done here directly — it happens inside
   * wrapRenderPageForDecoration()'s wrapper around window.renderPage below,
   * so every render this module didn't itself trigger (page-picker
   * navigation, js/ux-improvements.js's restoreInitialPage(), the async
   * section_edits follow-up render) gets decorated too, not just the ones
   * this function causes.
   *
   * Returns whatever window.renderPage returns — in a real browser with
   * View Transitions support that is a pending promise, not a completed
   * paint (see js/mockup/page-render.js's renderPage(), which routes through
   * document.startViewTransition()). Most callers here don't need to know
   * that (they do nothing DOM-dependent afterward), but addListItem() does
   * — see its use of this return value below.
   * @returns {Promise<void>|undefined}
   */
  function rerender() {
    const key = window.utils.getCurrentKey()
    return window.renderPage?.(key, true)
  }

  /**
   * Wrap window.renderPage so every render — regardless of who triggers it —
   * is followed by decorateListControls()/decorateEditedFields(). This is
   * the same "wrap window.renderPage, run extra work after" pattern
   * js/ux-improvements.js's wrapRenderPage() and
   * js/manager-review-export.js's (removed) wrapper used; see CLAUDE.md's
   * "Some functions are deliberately published onto window" section.
   *
   * Required because renderPageMain()'s output carries neither the add/
   * remove controls nor the Edited-badge/reset decorations (Task 1 kept the
   * renderer itself untouched beyond data-rewrite-field attributes — see
   * Step 1's rationale), and this module is not the only caller of
   * window.renderPage: js/app.js's initial render, js/ux-improvements.js's
   * restoreInitialPage() (both a synchronous call and, for a page carrying
   * saved section_edits, an async setTimeout(0) follow-up call — see
   * js/ux-improvements-state-sync.js's refreshInFlightForKey guard), and
   * page-picker navigation all call window.renderPage without going through
   * this module's own rerender(). A one-time decoration call from init()
   * alone only ever catches whichever render happened to be current at
   * module-load time — every later render (including that async follow-up,
   * which by construction happens AFTER this module has already loaded and
   * decorated once) would otherwise leave #mockPage completely undecorated
   * with nothing left to re-trigger it.
   *
   * This module loads after js/ux-improvements.js in js/main.js, so by the
   * time this wrapper installs, window.renderPage is already
   * js/ux-improvements.js's own wrapper around the original — this wraps
   * that, keeping decoration outermost (runs after every render in the
   * chain, including that wrapper's own deferred section_edits reapply,
   * which calls window.renderPage — the live, wrapped reference — rather
   * than a captured original).
   *
   * Decoration must wait for the ACTUAL DOM mutation, not just for
   * original.apply() to return. js/mockup/page-render.js's renderPage() uses
   * document.startViewTransition() when the browser supports it (real
   * Chromium does; happy-dom does not), and in that case the DOM update
   * happens asynchronously inside the transition's callback — renderPage()
   * returns a promise (transition.updateCallbackDone) rather than having
   * already painted by the time it returns. Decorating synchronously right
   * after original.apply() would then run against the PREVIOUS page's
   * stale DOM (or, on the very first render, an empty #mockPage), which is
   * exactly the bug this wrapper exists to prevent — mirrors
   * js/ux-improvements.js's own wrapRenderPage(), which defers its
   * post-render work the same way for the same reason.
   * @returns {void}
   */
  function wrapRenderPageForDecoration() {
    const original = window.renderPage
    if (typeof original !== 'function' || original.__inlineEditWrapped) return
    window.renderPage = function (...args) {
      const result = original.apply(this, args)
      const decorate = () => {
        decorateListControls()
        decorateEditedFields()
      }
      if (result && typeof result.then === 'function') result.then(decorate, decorate)
      else decorate()
      return result
    }
    window.renderPage.__inlineEditWrapped = true
  }

  /**
   * Given any element carrying a data-rewrite-field path shaped
   * 'sections.N.bullets.M' or 'sections.N.paragraphs.M', return the array's
   * container path ('sections.N.bullets') and the DOM elements that
   * currently render its items, in order.
   *
   * Paragraphs and bullets render differently (bulletList wraps every item
   * in one shared <ul>; paragraphList renders bare sibling <p> elements with
   * no wrapper), so the two need different DOM-walking strategies to find
   * "every rendered item in this array" — but both return the same shape so
   * the add/remove logic above them can stay one implementation.
   * @param {string} itemPath e.g. 'sections.2.bullets.1'
   * @returns {{containerPath: string, itemElements: HTMLElement[]}|null}
   */
  function locateListContainer(itemPath) {
    const match = itemPath.match(/^(sections\.\d+\.(?:paragraphs|bullets))\.\d+$/)
    if (!match) return null
    const containerPath = match[1]
    const escapedPath = CSS.escape(containerPath)
    const itemElements = Array.from(
      document.querySelectorAll(`#mockPage [data-rewrite-field^="${escapedPath}."]`)
    ).filter((el) =>
      new RegExp(`^${escapedPath}\\.\\d+$`).test(el.getAttribute('data-rewrite-field'))
    )
    return { containerPath, itemElements }
  }

  /**
   * Append a new, empty item to a paragraphs/bullets array and open it
   * immediately in edit mode. The whole resulting array is written back
   * (never a per-index patch) — see the Global Constraints on why deletes
   * make per-index addressing unsafe, which applies symmetrically to adds
   * kept consistent with the same array-replace approach.
   * @param {string} containerPath e.g. 'sections.2.bullets'
   * @returns {void}
   */
  function addListItem(containerPath) {
    const key = window.utils.getCurrentKey()
    const page = window.HHVC_DATA.pages[key]
    if (!page) return
    const current = getByPath(page, containerPath)
    const array = Array.isArray(current) ? current : []
    const nextArray = [
      ...array,
      { text: '', unverified: true, unverifiedReason: MANUAL_EDIT_UNVERIFIED_REASON },
    ]
    setByPath(page, containerPath, nextArray)
    persist()
    // Open the newly added (last) item in edit mode immediately, matching
    // the design spec's "already open in edit mode, at the next index" —
    // but only once the render rerender() just triggered has actually
    // repainted #mockPage. In a real browser with View Transitions support,
    // rerender()'s return value is a pending promise (the DOM mutation
    // happens asynchronously inside the transition's callback — see
    // js/mockup/page-render.js's renderPage()), so querying for the new field
    // synchronously right after calling rerender() would run against the
    // PREVIOUS paint, before the new item exists at all. Without View
    // Transitions (including happy-dom, which has none — see the unit
    // tests for this path), rerender() is fully synchronous and openNew()
    // runs immediately, exactly as before.
    const newIndex = nextArray.length - 1
    const openNew = () => {
      const newField = document.querySelector(
        `#mockPage [data-rewrite-field="${CSS.escape(`${containerPath}.${newIndex}`)}"]`
      )
      if (!newField) return
      openEditorJsEditor(newField)
    }
    // persist() just wrote this page's section_edits to localStorage, which
    // now includes the item being added here — so the SAME render this
    // function triggers below can itself cause js/ux-improvements.js's
    // applyAndRefresh to run applySavedPageState, find that saved
    // section_edits, and (depending on what it finds) kick off a SECOND,
    // independent View Transition to reapply it. That follow-up is a
    // separate async paint that resolves later than this render's own
    // promise, so opening the editor immediately once THIS render settles
    // can win the race, get shown, and then be wiped out moments later when
    // the follow-up paint replaces #mockPage's DOM again — confirmed live
    // via Playwright (the widget was momentarily visible, then gone).
    // Waiting two real animation frames — the same "wait for the next real
    // paint" idiom init() already uses below for a structurally similar
    // problem — gives that follow-up time to land first, so openNew() runs
    // against the DOM's actually-settled state instead of a transient one.
    // Gated on View Transitions support existing at all, matching init():
    // happy-dom (every unit test here) has none, so this keeps the exact
    // prior synchronous behavior in tests; the race is real-browser-only.
    const scheduleOpenNew =
      typeof document.startViewTransition === 'function'
        ? () => requestAnimationFrame(() => requestAnimationFrame(openNew))
        : openNew
    const renderResult = rerender()
    if (renderResult && typeof renderResult.then === 'function') {
      renderResult.then(scheduleOpenNew, scheduleOpenNew)
    } else {
      scheduleOpenNew()
    }
  }

  /**
   * Remove one item from a paragraphs/bullets array, show a one-step-undo
   * toast (matching js/review-queue-undo.js's precedent), and persist the
   * reduced array as a whole-field replace.
   *
   * The undo affordance is built through the existing showToast()'s
   * {label, callback} action parameter (js/ui-controls.js) rather than
   * render.undoToastMarkup()'s raw-HTML button: showToast renders `message`
   * via textContent, and several existing callers pass externally-supplied
   * strings straight into that parameter (e.g. js/sync/review-state-sync.js's
   * sync-failure toasts), so switching it to innerHTML to accommodate an
   * embedded <button> would break that invariant tool-wide. showToast's
   * action.className/action.dataset (added alongside this function) still
   * let the generated button carry the same data-inline-edit-undo marker
   * and inline-edit-undo-action class Task 8's e2e coverage and CSS expect,
   * with zero HTML injection.
   * @param {string} containerPath
   * @param {number} index
   * @returns {void}
   */
  function removeListItem(containerPath, index) {
    const key = window.utils.getCurrentKey()
    const page = window.HHVC_DATA.pages[key]
    if (!page) return
    const current = getByPath(page, containerPath)
    const array = Array.isArray(current) ? current : []
    if (index < 0 || index >= array.length) return

    const removedItem = array[index]
    const nextArray = array.filter((_, i) => i !== index)
    setByPath(page, containerPath, nextArray)
    persist()
    rerender()

    const label = /bullets$/.test(containerPath) ? 'bullet' : 'paragraph'
    window.showToast?.(`Removed ${label}.`, 'info', {
      label: 'Undo',
      className: 'inline-edit-undo-action',
      dataset: { inlineEditUndo: '' },
      callback: () => {
        // Undo is scoped to the page it happened on. persist()/rerender()
        // both resolve "which page" via getCurrentKey() at call time, not
        // via a key captured when the removal happened — so restoring onto
        // `page` (still the correct in-memory object) and then saving would
        // silently write THIS page's restored section_edits under whatever
        // page the reviewer has since navigated to, corrupting that page's
        // save. Worse, navigating back to the original page later would
        // reapply its still-stale (pre-undo) saved section_edits, silently
        // re-removing the item the reviewer just undid. Treating the undo
        // as expired once the reviewer has moved on is simpler and safer
        // than threading an explicit page-key parameter through persist()/
        // rerender() to make a non-current-page save correct.
        if (window.utils.getCurrentKey() !== key) return
        const restoreCurrent = getByPath(page, containerPath)
        const restoreArray = Array.isArray(restoreCurrent) ? [...restoreCurrent] : []
        restoreArray.splice(index, 0, removedItem)
        setByPath(page, containerPath, restoreArray)
        persist()
        rerender()
      },
    })
  }

  /**
   * Reset one field to its ORIGINAL_DATA value and re-render. Modeled on
   * js/sync/review-state-sync.js's restorePageContentFromOriginal, which resets
   * an entire page's title/summary/SEO/CTA — this is the per-field
   * equivalent this design calls for, since that function's granularity
   * (whole page) is too coarse for "undo just this one heading edit".
   * @param {string} path
   * @returns {void}
   */
  function resetFieldToOriginal(path) {
    const key = window.utils.getCurrentKey()
    const page = window.HHVC_DATA.pages[key]
    const originalPage = window.ORIGINAL_DATA?.pages?.[key]
    if (!page || !originalPage) return

    if (path === 'title') {
      page.title = originalPage.title
    } else if (path === 'summary') {
      page.summary = originalPage.summary
    } else if (path === 'primaryCta') {
      const originalCta = getPrimaryCta(originalPage) || ''
      setPrimaryCta(page, originalCta)
    } else {
      const originalValue = getByPath(originalPage, path)
      if (originalValue !== undefined) setByPath(page, path, originalValue)
    }
    persist()
    rerender()
  }

  /**
   * Append a remove control to every rendered paragraph/bullet item, and an
   * add control after the last item in each section's paragraphs/bullets
   * list. Runs after every mockup render (rerender() above, and the initial
   * page load), since renderPageMain()'s output carries no such controls —
   * see Task 1's scope note on why the renderer itself stays untouched
   * beyond the data-rewrite-field attributes.
   *
   * Idempotent per item/container: init() can call this twice for the same
   * painted DOM (a synchronous catch-up call, then a deferred
   * requestAnimationFrame one guarding against a View-Transitions-async
   * initial render — see init() below), and wrapRenderPageForDecoration()
   * adds a third call site. Guarding here, rather than trying to make those
   * call sites mutually exclusive, keeps each call site simple and correct
   * on its own regardless of how many times it fires against the same DOM.
   * @returns {void}
   */
  function decorateListControls() {
    const seenContainers = new Set()
    const itemFields = document.querySelectorAll('#mockPage [data-rewrite-field^="sections."]')
    itemFields.forEach((el) => {
      const path = el.getAttribute('data-rewrite-field')
      const match = path.match(/^(sections\.\d+\.(?:paragraphs|bullets))\.(\d+)$/)
      if (!match) return
      const [, containerPath, indexStr] = match
      const index = Number(indexStr)
      seenContainers.add(containerPath)
      if (el.querySelector('[data-inline-edit-remove]')) return // already decorated
      const removeHtml = render.listRemoveControlHtml(containerPath, index)
      const wrapper = document.createElement('span')
      wrapper.innerHTML = removeHtml
      el.appendChild(wrapper.firstElementChild)
    })

    // A paragraphs/bullets array that currently has ZERO items — because
    // the reviewer just removed its last item, or because the page was
    // authored with an empty array — renders no elements at all
    // (paragraphList()/bulletList() in js/mockup/page-render.js both return '' for
    // an empty array), so the DOM walk above never discovers it and
    // seenContainers would otherwise never gain its containerPath. Without
    // this pass, emptying a list is a one-way door: nothing left in the DOM
    // to hang an Add control off of, and no other code path ever adds one
    // back. Walk the live page data directly instead, so every container
    // that CAN hold paragraphs/bullets is considered regardless of its
    // current item count.
    const key = window.utils.getCurrentKey()
    const page = window.HHVC_DATA.pages[key]
    if (page && Array.isArray(page.sections)) {
      page.sections.forEach((section, sectionIndex) => {
        ;['paragraphs', 'bullets'].forEach((field) => {
          if (Array.isArray(section[field])) seenContainers.add(`sections.${sectionIndex}.${field}`)
        })
      })
    }

    seenContainers.forEach((containerPath) => {
      const existingAdd = document.querySelector(
        `#mockPage [data-inline-edit-add="${CSS.escape(containerPath)}"]`
      )
      if (existingAdd) return // already decorated
      const located = locateListContainer(`${containerPath}.0`)
      const addHtml = render.listAddControlHtml(containerPath)
      const wrapper = document.createElement('span')
      wrapper.innerHTML = addHtml
      if (located && located.itemElements.length) {
        const lastItem = located.itemElements[located.itemElements.length - 1]
        // Bullets share one <ul> parent; paragraphs are bare siblings with a
        // shared parent too (the section's own container element in both
        // cases), so inserting after the last item's parentNode position
        // works uniformly for both shapes — EXCEPT a <ul>'s only valid
        // children are <li> (axe's "list" rule flags a bare <button> sibling
        // of <li>s as a serious violation, confirmed live on scopeInfo).
        // Paragraphs have no such wrapper to respect, so only bullets need
        // this extra <li>.
        const addNode = /\.bullets$/.test(containerPath)
          ? (() => {
              const li = document.createElement('li')
              // A plain <li> inherits the list's bullet marker, which would
              // render a stray • next to "+ Add" — this <li> exists only to
              // satisfy list-structure rules (a <ul>'s only valid children
              // are <li>), not to be a visible list item itself.
              li.className = 'inline-edit-add-li'
              li.appendChild(wrapper.firstElementChild)
              return li
            })()
          : wrapper.firstElementChild
        lastItem.parentNode.insertBefore(addNode, lastItem.nextSibling)
        return
      }
      // Zero items: no item element to anchor near, so fall back to the
      // section's own heading — every section carries a required heading
      // (build_scripts/schema.js), and renderSection() (Task 1) tags it
      // data-rewrite-field="sections.N.heading" for every section that went
      // through partitionSections(), which is all of them except the
      // hardcoded "What to do" transaction-flow heading (js/mockup/page-render.js),
      // which carries no such attribute and is skipped below rather than
      // guessed at.
      const sectionIndexMatch = containerPath.match(/^sections\.(\d+)\./)
      if (!sectionIndexMatch) return
      const headingEl = document.querySelector(
        `#mockPage [data-rewrite-field="sections.${sectionIndexMatch[1]}.heading"]`
      )
      if (!headingEl) return
      headingEl.parentNode.insertBefore(wrapper.firstElementChild, headingEl.nextSibling)
    })
  }

  /**
   * Apply the "Edited" badge and a "Reset to original" control next to
   * title, summary, heading, and CTA fields whose current value differs
   * from ORIGINAL_DATA. Paragraphs/bullets are excluded: they already carry
   * the Unverified pill (set at write time in writeScalarValue), which is
   * their edited signal, and adding a second one would be a duplicate cue
   * for the same fact.
   * @returns {void}
   */
  function decorateEditedFields() {
    const key = window.utils.getCurrentKey()
    const page = window.HHVC_DATA.pages[key]
    const originalPage = window.ORIGINAL_DATA?.pages?.[key]
    if (!page || !originalPage) return

    const scalarPaths = ['title', 'summary', 'primaryCta']
    document.querySelectorAll('#mockPage [data-rewrite-field]').forEach((el) => {
      const path = el.getAttribute('data-rewrite-field')
      // Every plain-string field, not just headings and the three page-level
      // scalars: a step title, a callout, a table cell, a contact entry and
      // the What-to-know cost are all committed as bare strings, so none of
      // them can carry the Unverified pill that marks an edited paragraph or
      // bullet. Without this they were the only edited fields on the mockup
      // showing no sign of having been edited — and, since the reset control
      // rides along with the badge, no way back to the original short of
      // clearing the whole review record.
      if (!scalarPaths.includes(path) && itemKindFor(path) !== 'plainString') return

      // Both sides through readScalarValue: it resolves the page-level three
      // and unwraps the {text, ...} object form, so an original stored as an
      // object is compared as the text it renders rather than as "[object
      // Object]" against a string, which never matches.
      const currentValue = readScalarValue(page, path)
      const originalValue = readScalarValue(originalPage, path)

      if (currentValue === originalValue) return
      if (el.querySelector('.inline-edit-badge')) return // already decorated

      const badgeWrapper = document.createElement('span')
      badgeWrapper.innerHTML = render.editedBadgeHtml() + render.resetControlHtml(path)
      while (badgeWrapper.firstChild) el.appendChild(badgeWrapper.firstChild)
    })
  }

  let editorJsHolderCounter = 0
  /**
   * Distinguishes the broken-link notice ids between concurrently mounted
   * holders, so `aria-describedby` on one field's holder can never resolve to
   * another field's notice.
   */
  let brokenLinkNoticeCounter = 0

  /**
   * Owns one open Editor.js instance's full lifecycle: the re-entrancy guard
   * against Editor.js's undeclared single-block invariant, the stale-edit
   * checks planted after each async boundary (dynamic import, isReady,
   * save()), and the commit/cancel paths — everything openEditorJsEditor()
   * used to hold as closures over one 200-line function body. Pulling these
   * into named methods is what lets isStale() in particular be read (and
   * reasoned about) on its own, rather than requiring a reader to hold the
   * whole function in their head at once.
   *
   * One instance per open field. `editingPath` (module-scope, see its own
   * declaration above) is still the cross-session "is anything open right
   * now" flag — this class only owns what is specific to ONE session; two
   * sessions never coexist because openEditorJsEditor() below refuses to
   * start a second one while editingPath is already set.
   */
  class EditorSession {
    /**
     * @param {object} deps
     * @param {string} deps.path data-rewrite-field path being edited
     * @param {string} deps.key the page key open at the moment editing started
     * @param {object} deps.page the live page object (window.HHVC_DATA.pages[key])
     * @param {string} deps.value the field's current value, read before editing
     */
    constructor({ path, key, page, value }) {
      this.path = path
      this.key = key
      this.page = page
      this.value = value
      this.adapter = window.inlineEditAdapter
      this.fieldType = editorFieldTypeFor(path)
      this.holder = null
      this.editor = null
      this.blockGuardActive = false
      this.settled = false
      this.refusalEl = null
    }

    /**
     * Whether a different edit has since taken over (a second click, a
     * navigation, a page delete) or this session's holder has been detached
     * from the live #mockPage. Checked after every async boundary — see
     * open()'s two call sites below.
     *
     * Deliberately NOT used inside commit()/cancel() — they use the narrower
     * editingPath check; see their own comments.
     * @returns {boolean}
     */
    isStale() {
      return editingPath !== this.path || !this.holder || !document.body.contains(this.holder)
    }

    /**
     * Mount the Editor.js instance and wire its commit/cancel listeners.
     * @param {HTMLElement} target the element carrying data-rewrite-field
     * @returns {Promise<void>}
     */
    async open(target) {
      const outputData = this.adapter.pageValueToEditorData(this.fieldType, this.value)

      const holderId = `inline-edit-editorjs-${++editorJsHolderCounter}`
      const widgetHtml = render.editorJsHolderHtml({ path: this.path, id: holderId })
      const wrapper = document.createElement('span')
      wrapper.innerHTML = widgetHtml
      this.holder = wrapper.firstElementChild
      target.replaceWith(this.holder)

      const EditorJS = await loadEditorJs()
      // The click that opened this editor may have been followed by a second
      // click, a navigation, or a page delete while the import above was in
      // flight — isStale() catches all three. Continuing past this point
      // would mount a live Editor.js instance into stale DOM.
      if (this.isStale()) return

      this.editor = new EditorJS({
        holder: holderId,
        data: outputData,
        autofocus: true,
        // Only markdown-bearing fields get bold/link formatting — paragraph
        // and bullet items, plus the markdownText fields (a callout body, a
        // table cell) whose renderer also calls formatMarkdown(). title,
        // summary, primaryCta, and heading render through a bare escapeHtml()
        // with no formatMarkdown() call (js/mockup/page-render.js:216,219,560,631),
        // so offering Bold or Link there would visibly format text while
        // editing and then silently revert to plain on commit
        // (js/editing/inline-content-edit-adapter.js's editingHtmlToPlainText strips both,
        // correctly, since the renderer could never show them anyway) —
        // confusing rather than useful. The explicit ['bold', 'hhvcLink']
        // array (rather than Editor.js's boolean `true`, which would also
        // enable its own built-in 'link' — a block-level preview card, not an
        // inline anchor) is what keeps js/editing/inline-content-edit-link-tool.js's
        // custom tool the only link affordance offered; registering it in
        // `tools` below with `inlineToolbar: false` for scalar fields is
        // harmless, since a tool never referenced in the toolbar array is
        // never shown regardless of being registered.
        inlineToolbar: this.adapter.isMarkdownFieldType(this.fieldType)
          ? ['bold', 'hhvcLink']
          : false,
        minHeight: 0,
        tools: { hhvcLink: window.InlineEdit.LinkTool },
        onChange: (api) => {
          // Enforce the single-block constraint every field this feature
          // edits requires (see the integration plan's "Instance
          // granularity" design: a plain string/tagged-object has no home
          // for a second block). Editor.js has no built-in cap on block
          // count, so a paste or an Enter keypress is trimmed back down here.
          // Re-entrancy guarded, since deleting a block itself fires
          // onChange again.
          if (this.blockGuardActive) return
          const count = api.blocks.getBlocksCount()
          if (count <= 1) return
          this.blockGuardActive = true
          for (let i = count - 1; i >= 1; i--) api.blocks.delete(i)
          this.blockGuardActive = false
        },
      })

      // e2e-only hook: exposes the live instance on its own holder (never a
      // shared/global slot, so nothing to go stale across separate open
      // editors) so tests can trigger Editor.js's OWN inline-toolbar open path
      // (editor.inlineToolbar.open()) directly. Editor.js only populates the
      // toolbar's tool buttons after its own mousedown-driven
      // BlockManager.setCurrentBlockByChildNode has run (UI.documentTouched) —
      // a synthetic Playwright selection with no real mousedown on the
      // redactor leaves that unset, so the toolbar element appears with zero
      // buttons. No production code path reads this property.
      this.holder.__inlineEditEditor = this.editor

      try {
        await this.editor.isReady
      } catch {
        // A real failure mode per Editor.js's own isReady contract, not
        // hypothetical — fall back to cancelling this edit rather than
        // leaving the reviewer looking at a dead holder with nothing to type
        // into.
        editingPath = null
        rerender()
        return
      }
      if (this.isStale()) {
        this.editor.destroy()
        return
      }

      this.holder.addEventListener('focusout', (event) => {
        // Editor.js's inline-formatting toolbar and any tool popover render as
        // a DESCENDANT of this holder — Editor.js nests its own .codex-editor
        // wrapper INSIDE the element it's given as `holder`, with the toolbar
        // and any tool popover nested further inside that — not as a sibling
        // outside holder's subtree. A plain blur/focusout with no containment
        // check would commit the instant a reviewer clicked a toolbar tool
        // (Bold, or js/editing/inline-content-edit-link-tool.js's Link), since that
        // click moves focus off the contenteditable block and onto the tool's
        // own button/input, still within the same holder.
        //
        // holder.contains(nextFocus) is the correct check for that. An earlier
        // version instead walked UP from holder via .closest('.codex-editor')
        // — which can never match, since .codex-editor is a DESCENDANT of
        // holder, never an ancestor, so ownRoot was always null and the check
        // unconditionally committed on every focusout. Measured live with real
        // (non-synthetic) Playwright clicks: clicking the Link tool's button
        // destroyed the whole field before its target-entry input ever
        // appeared, every time — a real Phase 4 bug, not a test-harness
        // artifact, and one Bold had already been carrying silently with zero
        // e2e coverage of any toolbar-tool click.
        const nextFocus = event.relatedTarget
        if (nextFocus instanceof Element && this.holder.contains(nextFocus)) return
        // Direction 2 from issue #118: if the holder has been removed from
        // the document (because a render replaced #mockPage under the open
        // editor), this focusout is a DOM teardown rather than a reviewer
        // action. Committing here would either write empty text (the editor
        // had just opened and the reviewer hadn't typed yet) or silently
        // discard any text that was already in flight. Cancel without a
        // re-render: the existing render already repainted #mockPage
        // correctly, and clearing editingPath lets any follow-up interaction
        // open a fresh session.
        //
        // This guard pairs with the focusRenderedPageHeading() fix in
        // js/mockup/page-render.js (which is the primary mechanism behind the
        // residual failures) — together they cover both the "holder still in
        // the document but focus was stolen" case and the "holder torn out"
        // case that can arise from any future paint.
        if (!document.body.contains(this.holder)) {
          this.cancel({ dontRerender: true })
          return
        }
        // Refusing holds the reviewer in the field by taking focus back, and
        // doing that when the whole DOCUMENT has lost focus — a tab switch,
        // devtools opening, an OS-level window blur — would fight the browser
        // and steal focus the moment they returned to the tab.
        //
        // document.hasFocus() is the discriminator, NOT a null relatedTarget.
        // A null relatedTarget also describes the most ordinary exit there is
        // — clicking any NON-FOCUSABLE element, which is most of the mockup —
        // so keying on it disabled the refusal in exactly the common case.
        // Measured: the e2e paste case blurs with no relatedTarget, and while
        // it did, the refusal never fired.
        //
        // Whether hasFocus() has ALREADY flipped to false by the time
        // focusout runs on a window blur is timing-dependent and could not be
        // verified here — headless Chromium reports the page as focused even
        // with another tab brought to the front, so that branch is unproven
        // rather than measured. It is therefore not the only guard: the
        // deferred refocus in showBrokenLinkRefusal() re-checks hasFocus()
        // itself, where the question does not arise. If this check turns out
        // to be true during a window blur, the cost is a notice the reviewer
        // sees on return — not stolen focus.
        this.commit({ mayRefuse: document.hasFocus() })
      })
      this.holder.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          this.cancel()
        }
      })
      this.holder.addEventListener('input', (event) => {
        // Keep js/editing/inline-content-edit-link-tool.js's commitLink() pre-blur
        // HTML stash (LinkCommitBridge, read in commit() below) in sync
        // with any typing that happens after a link is inserted but before
        // the field is blurred. Without this, commit() always preferred
        // the ONE-TIME snapshot commitLink() took at link-insertion time,
        // so any text typed afterward — a completely normal add-link-then-
        // keep-typing flow — was silently discarded: not an error, just
        // missing from the saved value. Re-capturing on every 'input'
        // event (which fires synchronously, ahead of any later blur) means
        // the stash always reflects the latest DOM, including the still-
        // intact anchor, right up until the blur that later strips it — so
        // commit() never reads a stale copy. Guarded on the stash already
        // existing: with no pending link, editor.save()'s own output is
        // authoritative and this must not invent a stash for it to prefer
        // instead.
        const bridge = window.InlineEdit.LinkCommitBridge
        if (!bridge.has(this.holder)) return
        const target = event.target
        const editableEl = target instanceof Element ? target.closest('.ce-paragraph') : null
        if (editableEl) bridge.stash(this.holder, editableEl.innerHTML)
      })
    }

    /**
     * Save whatever Editor.js currently holds and write it back onto the
     * page object, or no-op if this session has already settled or been
     * superseded.
     * @returns {Promise<void>}
     */
    async commit({ mayRefuse = true } = {}) {
      if (this.settled) return
      this.settled = true
      if (editingPath !== this.path) {
        this.editor.destroy()
        return
      }
      let outputValue
      try {
        outputValue = await this.editor.save()
      } catch {
        editingPath = null
        this.editor.destroy()
        rerender()
        return
      }
      // Editor.js's own blur-triggered internal cleanup on the
      // contenteditable runs BEFORE this async commit() ever starts (it
      // fires as part of the same native blur that triggers the holder's
      // 'focusout' listener above, in the target phase, ahead of any
      // ancestor-level bubble-phase listener) — and it strips a link
      // js/editing/inline-content-edit-link-tool.js just inserted, using a
      // narrower rule set than editor.save()'s own sanitizer: measured live
      // via Playwright, calling editor.save() directly immediately after
      // insertion preserves the anchor perfectly (proving this feature's
      // sanitize() config is correct), while the SAME save() call made
      // after a real blur has already occurred returns it silently
      // stripped to plain text — no thrown error, no sanitizer-config
      // fix available on this side of the library. commitLink() therefore
      // captures the block's HTML itself at insertion time, before that
      // blur can run, and stashes it via LinkCommitBridge; prefer that
      // snapshot here over whatever editor.save() returned. The holder's
      // 'input' listener above keeps that stash in sync with any further
      // typing, so it is never stale by the time this reads it.
      const pendingLinkHtml = window.InlineEdit.LinkCommitBridge.take(this.holder)
      if (pendingLinkHtml !== undefined) {
        outputValue = { blocks: [{ type: 'paragraph', data: { text: pendingLinkHtml } }] }
      }
      // Re-check after the async save — the reviewer may have navigated to
      // a different page while save() was pending, the same race
      // removeListItem's undo callback already guards against above.
      const stillCurrentPage = window.utils.getCurrentKey() === this.key
      const newValue = this.adapter.editorDataToPageValue(this.fieldType, outputValue)

      // Refuse a value carrying a link that points nowhere, BEFORE any write.
      // Ordering this after the write would make the refusal cosmetic: the
      // loop below re-runs on every blur, so a broken link would be
      // re-persisted each time round while the reviewer was being told it had
      // been rejected.
      //
      // This is the paste path. A TYPED target never reaches here as an
      // invalid one — js/editing/inline-content-edit-link-tool.js's commitLink()
      // refuses before an anchor is built — but a pasted anchor bypasses that
      // code entirely, since the tool's sanitize() config allows `href` and
      // `data-render-target` and Editor.js carries a copied link straight
      // through. By this point the adapter has serialized every anchor back
      // to `[label](target)` markdown, so one check covers both origins.
      const brokenTargets = mayRefuse && stillCurrentPage ? this.findBrokenLinks(newValue) : []
      if (brokenTargets.length) {
        // Un-settle rather than tear down: the editor stays alive and holds
        // the reviewer's text, which is the entire point — refusing is not
        // cancelling. Note `editingPath` is deliberately left pointing at
        // this path, so a click elsewhere in the mockup still resolves to
        // this session rather than opening a second editor over it.
        this.settled = false
        this.showBrokenLinkRefusal(brokenTargets)
        return
      }
      this.clearBrokenLinkRefusal()

      editingPath = null
      this.editor.destroy()
      if (!stillCurrentPage) return

      const newText = this.adapter.isItemFieldType(this.fieldType) ? newValue.text : newValue
      if (newText === this.value) {
        // Nothing actually changed — compare the adapter's serialized text
        // against the value captured at open, not the raw OutputData,
        // since Editor.js's own block metadata can differ block-for-block
        // even on a true no-op open/close.
        rerender()
        return
      }
      const isPageLevelScalar =
        this.path === 'title' || this.path === 'summary' || this.path === 'primaryCta'
      if (isPageLevelScalar && newText.trim() === '') {
        window.showToast?.(
          "Title, summary, and the primary CTA can't be cleared to blank — edit the text instead of deleting it.",
          'warn'
        )
        rerender()
        return
      }
      // One write path for both field shapes. An item used to be written here
      // as the adapter's tagged object directly, which REPLACED the stored
      // item wholesale — and a whatToKnow entry is {label, text}, so editing
      // the paragraph silently deleted the label renderWhatToKnow() prints as
      // that entry's own H3 heading (seen live before this was unified).
      // writeScalarValue builds the same tagged object, carrying any key the
      // tagged form does not name, and it is the one place that decides
      // tagged-vs-plain — see editableItemKind.
      writeScalarValue(this.page, this.path, newText)
      persist()
      rerender()
    }

    /**
     * The invalid link targets in a value this session is about to write.
     *
     * The rule lives in js/mockup/inline-link-target.js, shared with
     * build_scripts/data-checks.js; only the key set is resolved here, since
     * that is a browser concern the predicate deliberately knows nothing
     * about. window.InlineEdit.linkableKeys() is the live page set UNIONED
     * with the registry's own keys, so a reviewer-hidden page still counts —
     * hiding is reversible, and a link to a hidden page must not be destroyed
     * by a delete the reviewer may undo.
     *
     * @param {string|{text?: string}} value
     * @returns {Array<string>}
     */
    findBrokenLinks(value) {
      return window.inlineLinkTarget.findInvalidInlineLinkTargets(
        value,
        window.InlineEdit.linkableKeys()
      )
    }

    /**
     * Mark the open field as refused and offer the one way out.
     *
     * The notice is appended INSIDE the holder, and that placement is
     * load-bearing rather than cosmetic: the holder's own focusout listener
     * returns early whenever focus moves to a descendant, so focusing this
     * button cannot re-enter commit() and re-refuse before the reviewer has
     * pressed it.
     *
     * One button for all of them rather than one per link: several buttons
     * multiply the aria-describedby target problem inside a widget rendered
     * inline in body copy, and a strip-one-per-press design makes the number
     * of clicks a function of a count the reviewer cannot see.
     *
     * @param {Array<string>} targets
     * @returns {void}
     */
    showBrokenLinkRefusal(targets) {
      if (!this.refusalEl) {
        const id = `inline-edit-broken-links-${++brokenLinkNoticeCounter}`
        this.refusalEl = render.brokenLinkNoticeElement(id)
        this.refusalEl
          .querySelector('[data-inline-edit-remove-broken-links]')
          .addEventListener('click', () => this.removeBrokenLinks())
        this.holder.appendChild(this.refusalEl)
        // Points at the notice, which names both the problem and the way out
        // in one focus event — an aria-invalid with nothing describing it is
        // compliant-looking and unhelpful, and it matters more here than in
        // the typed case because this refusal BLOCKS rather than merely
        // declining to insert.
        this.holder.setAttribute('aria-describedby', id)
      }
      this.holder.setAttribute('aria-invalid', 'true')
      this.holder.classList.add('has-broken-links')
      render.updateBrokenLinkNotice(this.refusalEl, targets)

      // Deferred, because .focus() called synchronously inside a focusout
      // handler is unreliable — focus is mid-transition. Without the refocus
      // neither the hold-in-field behaviour nor the aria-invalid announcement
      // happens at all, and the refusal would silently do nothing.
      //
      // Deliberately NOT bounded to N attempts: "refuse once, then let it
      // through" is the silent salvage this design rejected, reached by a
      // counter the reviewer cannot see. The loop ends when the link is
      // fixed, removed, or Escape is pressed.
      window.setTimeout(() => {
        // The reviewer may have navigated (j/k, a page delete) while this was
        // queued. isStale() is the same check the session already applies for
        // this class of race; without it this focuses a detached node and
        // strands the invalid-state markers on a dead holder.
        if (this.settled || this.isStale()) return
        // Re-checked HERE rather than trusted from focusout time: this is the
        // moment focus would actually be taken, so "does the document have
        // focus" has an unambiguous answer. If the reviewer has switched tabs
        // or windows, leave the notice standing and take nothing — they will
        // find the refused field waiting when they come back, which is the
        // outcome the focusout-time check is aiming at anyway.
        if (!document.hasFocus()) return
        const editable = this.holder.querySelector('[contenteditable="true"]')
        if (editable instanceof HTMLElement) editable.focus()
      }, 0)
    }

    /**
     * @returns {void}
     */
    clearBrokenLinkRefusal() {
      this.holder?.removeAttribute('aria-invalid')
      this.holder?.classList.remove('has-broken-links')
      this.refusalEl?.remove()
      this.refusalEl = null
    }

    /**
     * Unwrap every broken link in the open editor back to plain text, then
     * retry the commit.
     *
     * Unwrapping in the live DOM rather than rewriting the stored value is
     * what keeps the reviewer's other edits: everything else in the block is
     * left exactly as they typed it, and only the anchors that cannot resolve
     * lose their linking. Their visible label survives as text, so nothing
     * they wrote disappears.
     * @returns {void}
     */
    removeBrokenLinks() {
      const keys = window.InlineEdit.linkableKeys()
      const isValid = window.inlineLinkTarget.isValidInlineLinkTarget
      for (const anchor of this.holder.querySelectorAll('a')) {
        const target =
          anchor.getAttribute('data-render-target') ?? anchor.getAttribute('href') ?? ''
        if (isValid(target, keys)) continue
        anchor.replaceWith(...anchor.childNodes)
      }
      // Keep js/editing/inline-content-edit-link-tool.js's pre-blur HTML stash in
      // step. commit() prefers that snapshot over editor.save()'s output when
      // one exists, so leaving it holding the pre-removal HTML would hand the
      // retry the very anchors just removed.
      const bridge = window.InlineEdit.LinkCommitBridge
      if (bridge.has(this.holder)) {
        const editable = this.holder.querySelector('.ce-paragraph')
        if (editable) bridge.stash(this.holder, editable.innerHTML)
      }
      this.clearBrokenLinkRefusal()
      this.commit()
    }

    /**
     * Discard whatever Editor.js currently holds and re-render the original
     * value, or no-op if this session has already settled or been
     * superseded.
     * @returns {void}
     */
    cancel() {
      if (this.settled) return
      this.settled = true
      // Escape stays a full cancel even while a commit is being refused —
      // that is the whole reason the "remove broken links" button is
      // ADDITIVE rather than the only way out. Escape discards everything
      // (rare, deliberate); the button salvages the typing and drops only the
      // links. Forcing every reviewer through the button to preserve one
      // guarantee would be the worse trade.
      this.clearBrokenLinkRefusal()
      if (editingPath !== this.path) {
        this.editor.destroy()
        return
      }
      editingPath = null
      this.editor.destroy()
      rerender()
    }
  }

  /**
   * Open a scalar field's editor using @editorjs/editorjs.
   * js/editing/inline-content-edit-adapter.js is the serialization boundary
   * EditorSession is built around: Editor.js's block-JSON output never
   * becomes the storage format, only a transient editing representation, so
   * every value it ends up writing is exactly the shape writeScalarValue
   * already writes for the plain-widget path.
   * @param {HTMLElement} target the element carrying data-rewrite-field
   * @returns {Promise<void>}
   */
  async function openEditorJsEditor(target) {
    const path = target.getAttribute('data-rewrite-field')
    if (!path || editingPath) return
    const key = window.utils.getCurrentKey()
    const page = window.HHVC_DATA.pages[key]
    if (!page) return

    editingPath = path
    const value = readScalarValue(page, path)
    await new EditorSession({ path, key, page, value }).open(target)
  }

  /**
   * Delegated click handler on #mockPage. Walks up from the click target to
   * the nearest [data-rewrite-field] ancestor. List add/remove controls and
   * the per-field reset control (Task 7) are matched first since they can
   * sit inside a [data-rewrite-field] element's subtree (e.g. a remove "×"
   * inside a <li> that itself carries the attribute, or a reset button
   * appended inside an edited heading) and must not also open a scalar
   * editor on the same click.
   *
   * The one-step-undo control is deliberately NOT matched here: it lives
   * inside the toast rendered by showToast() (js/ui-controls.js), which is
   * appended to #toastContainer, outside #mockPage entirely — showToast's
   * own action.callback click listener owns that click, and this handler
   * never sees it.
   * @param {MouseEvent} event
   * @returns {void}
   */
  function handleMockPageClick(event) {
    const target = event.target
    if (!(target instanceof Element)) return

    const resetControl = target.closest('[data-inline-edit-reset]')
    if (resetControl) {
      event.preventDefault()
      resetFieldToOriginal(resetControl.getAttribute('data-inline-edit-reset'))
      return
    }
    const addControl = target.closest('[data-inline-edit-add]')
    if (addControl) {
      event.preventDefault()
      addListItem(addControl.getAttribute('data-inline-edit-add'))
      return
    }
    const removeControl = target.closest('[data-inline-edit-remove]')
    if (removeControl) {
      event.preventDefault()
      const containerPath = removeControl.getAttribute('data-inline-edit-remove')
      const index = Number(removeControl.getAttribute('data-inline-edit-index'))
      removeListItem(containerPath, index)
      return
    }

    if (editingPath) return // already editing something; let blur/Enter/Escape resolve it first
    const field = target.closest('[data-rewrite-field]')
    if (!field) return
    // By design: clicking any link — CTA or an inline body-text link —
    // inside an editable field opens that field's editor instead of
    // following the link. Editing takes priority over navigating away from
    // the review tool while a reviewer is trying to edit the very field the
    // link sits in.
    //
    // A [data-rewrite-field] element can contain a real navigating
    // <a href>, and its position in the DOM doesn't matter — this rule
    // applies wherever the anchor sits relative to the field boundary, not
    // just at the field's own root. Two real cases hit this today:
    //   - The hero CTA: data-rewrite-field="primaryCta" sits on the
    //     wrapping <div class="hero-cta"> (renderHero() in
    //     js/mockup/page-render.js), not on the interactive element itself, and
    //     button() renders a real <a href target="_blank"> when the CTA has
    //     a buttonUrl (confirmed live on the payFee page).
    //   - An inline citation/reference link inside paragraph or bullet body
    //     text: formatMarkdown() (js/mockup/page-render.js) turns a
    //     [label](https://...) markdown link into
    //     <a class="inline-link" href="..." target="_blank">, rendered
    //     directly inside the <p data-rewrite-field="sections.N.paragraphs.M">
    //     or <li data-rewrite-field="sections.N.bullets.M"> the text belongs
    //     to — reachable on multiple pages wherever body copy cites a
    //     source.
    // Without this guard, clicking either kind of link both opened this
    // editor (the delegated click bubbling to the ancestor
    // [data-rewrite-field]) AND navigated in a new tab (native anchor
    // behavior) at once.
    //
    // Scoped to "the click landed on or inside a navigating anchor" rather
    // than a blanket preventDefault() on every click, since a blanket call
    // could interfere with normal focus/selection behavior once the editor
    // widget itself is open. The internal-target CTA variant renders as a
    // <button> (no href, no default navigation), so this guard is a
    // documented no-op for it — verified by a regression test below rather
    // than left as an implicit assumption.
    const navigatingAnchor = target.closest('a[href]')
    if (navigatingAnchor) event.preventDefault()
    // Only open on scalar-shaped targets in this task's scope: title,
    // summary, primaryCta, a heading, or a single paragraph/bullet item
    // (the numeric-suffixed paths). A bare container path like
    // 'sections.2.paragraphs' (Task 7's add-target) is never itself a
    // data-rewrite-field attribute value — only individual items and the
    // three page-level fields are — so no extra guard is needed here.
    openEditorJsEditor(field)
  }

  /**
   * Bind the delegated click listener once. Safe to call multiple times.
   * @returns {void}
   */
  function ensureBound() {
    const mockPage = document.getElementById('mockPage')
    if (!mockPage || mockPage.dataset.inlineEditBound) return
    mockPage.dataset.inlineEditBound = 'true'
    mockPage.addEventListener('click', handleMockPageClick)
  }

  /**
   * @returns {void}
   */
  function init() {
    ensureBound()
    wrapRenderPageForDecoration()
    const decorate = () => {
      decorateListControls()
      decorateEditedFields()
    }
    // Decorate once here for the render that already happened before this
    // module loaded (js/app.js's initial renderPage() call, which predates
    // this module in js/main.js's import order and therefore predates the
    // wrapper installed just above — every render from this point on goes
    // through that wrapper instead).
    decorate()
    // The call above is enough UNLESS js/mockup/page-render.js's renderPage()
    // routed through document.startViewTransition() for that initial
    // render: in a real browser that supports it, the actual DOM mutation
    // happens asynchronously inside the transition's callback, so the
    // renderPage() call js/app.js already made had returned a pending
    // promise by the time this function runs, with #mockPage not yet
    // repainted — the decorate() call above then ran against stale
    // (possibly empty) DOM and found nothing to decorate. There's no handle
    // to that specific promise to await (js/app.js never exposed it), so
    // this schedules a second, deferred pass via a double
    // requestAnimationFrame — the standard "wait for the next real paint"
    // idiom — gated on View Transitions support existing at all: without
    // it, renderPage() is fully synchronous, the sync decorate() above
    // already caught everything, and scheduling a redundant deferred pass
    // would only cost a wasted rAF round-trip (harmless, but pointless).
    // happy-dom has no startViewTransition, so this branch never schedules
    // under the unit test suite — the async race is real-browser-only, and
    // is instead verified live (see the Playwright smoke test in Task 7's
    // report).
    if (typeof document.startViewTransition === 'function') {
      requestAnimationFrame(() => requestAnimationFrame(decorate))
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }

  window.inlineEdit = {
    ensureBound,
    isEditing,
    decorateEditedFields,
    decorateListControls,
  }
})()
