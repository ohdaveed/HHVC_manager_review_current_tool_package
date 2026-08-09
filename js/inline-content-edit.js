/* Inline content editing: orchestrator. Delegated click handling on
   #mockPage, the edit-widget lifecycle (open/commit/cancel), and wiring
   into the existing autosave path. Sibling to js/inline-content-edit-render.js
   (markup) and js/inline-content-edit-data.js (pure section_edits logic).
   Mirrors the ai-assist split (js/ai-assist.js orchestrates
   js/ai-assist-client.js + js/ai-assist-render.js).

   Unlike AI assist, this needs no backend and no capability check: the
   affordance is present whenever the page has loaded. Loads after
   js/inline-content-edit-render.js and after js/ux-improvements.js (for
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
   * Multi-line fields get a <textarea> (Enter would fight normal multi-line
   * typing); everything else gets a single-line <input> committed on Enter.
   * @param {string} path
   * @returns {'input'|'textarea'}
   */
  function widgetTagFor(path) {
    if (path === 'summary') return 'textarea'
    if (path === 'title' || path === 'primaryCta') return 'input'
    if (/\.heading$/.test(path)) return 'input'
    // A single paragraph or bullet item path, e.g. 'sections.2.paragraphs.1'.
    return 'textarea'
  }

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
    if (/\.heading$/.test(path)) {
      setByPath(page, path, value)
      return
    }
    // A paragraph or bullet item path.
    setByPath(page, path, {
      text: value,
      unverified: true,
      unverifiedReason: 'Manually edited during review',
    })
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
   * paint (see js/page-render.js's renderPage(), which routes through
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
   * original.apply() to return. js/page-render.js's renderPage() uses
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
      { text: '', unverified: true, unverifiedReason: 'Manually edited during review' },
    ]
    setByPath(page, containerPath, nextArray)
    persist()
    // Open the newly added (last) item in edit mode immediately, matching
    // the design spec's "already open in edit mode, at the next index" —
    // but only once the render rerender() just triggered has actually
    // repainted #mockPage. In a real browser with View Transitions support,
    // rerender()'s return value is a pending promise (the DOM mutation
    // happens asynchronously inside the transition's callback — see
    // js/page-render.js's renderPage()), so querying for the new field
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
      if (newField) openScalarEditor(newField)
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
   * strings straight into that parameter (e.g. js/review-state-sync.js's
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
   * js/review-state-sync.js's restorePageContentFromOriginal, which resets
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
    // (paragraphList()/bulletList() in js/page-render.js both return '' for
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
      // hardcoded "What to do" transaction-flow heading (js/page-render.js),
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
      const isHeading = /\.heading$/.test(path)
      if (!scalarPaths.includes(path) && !isHeading) return

      const currentValue =
        path === 'primaryCta' ? getPrimaryCta(page) || '' : readScalarValue(page, path)
      const originalValue =
        path === 'title'
          ? originalPage.title || ''
          : path === 'summary'
            ? originalPage.summary || ''
            : path === 'primaryCta'
              ? getPrimaryCta(originalPage) || ''
              : getByPath(originalPage, path) || ''

      if (currentValue === originalValue) return
      if (el.querySelector('.inline-edit-badge')) return // already decorated

      const badgeWrapper = document.createElement('span')
      badgeWrapper.innerHTML = render.editedBadgeHtml() + render.resetControlHtml(path)
      while (badgeWrapper.firstChild) el.appendChild(badgeWrapper.firstChild)
    })
  }

  /**
   * Open a scalar field's editor in place of its rendered element.
   * @param {HTMLElement} target the element carrying data-rewrite-field
   * @returns {void}
   */
  function openScalarEditor(target) {
    const path = target.getAttribute('data-rewrite-field')
    if (!path || editingPath) return
    const key = window.utils.getCurrentKey()
    const page = window.HHVC_DATA.pages[key]
    if (!page) return

    editingPath = path
    const value = readScalarValue(page, path)
    const tag = widgetTagFor(path)
    const widgetHtml = render.scalarEditorHtml({ tag, value, path })
    const wrapper = document.createElement('span')
    wrapper.innerHTML = widgetHtml
    const widget = wrapper.firstElementChild
    target.replaceWith(widget)
    widget.focus()
    // Move the caret to the end rather than selecting-all, so a reviewer
    // fixing a typo at the end of a long paragraph doesn't have to retype
    // it entirely because their first keystroke replaced a selection.
    if (typeof widget.setSelectionRange === 'function') {
      widget.setSelectionRange(widget.value.length, widget.value.length)
    }

    const commit = () => {
      if (editingPath !== path) return // already committed/cancelled once
      const newValue = widget.value
      editingPath = null
      if (newValue === value) {
        // Nothing actually changed. Writing it anyway would still run
        // through writeScalarValue's paragraph/bullet branch, which tags a
        // plain string as {text, unverified: true, ...} — showing an
        // "Unverified" pill on copy the reviewer never touched.
        rerender()
        return
      }
      // title/summary/primaryCta have no schema slot to distinguish
      // "explicitly cleared" from "never edited": updateMockupTextFromSaved-
      // State (js/ux-improvements-state-sync.js) and
      // collectCurrentPageReviewState's own snapshot of these same three
      // fields both guard on truthiness, so a blank commit would appear to
      // save for this session and then silently revert to the authored
      // value on the next reload or navigation. Refuse rather than accept a
      // save that can't reliably persist.
      const isPageLevelScalar = path === 'title' || path === 'summary' || path === 'primaryCta'
      if (isPageLevelScalar && newValue.trim() === '') {
        window.showToast?.(
          "Title, summary, and the primary CTA can't be cleared to blank — edit the text instead of deleting it.",
          'warn'
        )
        rerender()
        return
      }
      writeScalarValue(page, path, newValue)
      persist()
      rerender()
    }
    const cancel = () => {
      if (editingPath !== path) return
      editingPath = null
      rerender()
    }

    if (tag === 'input') {
      widget.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          commit()
        } else if (event.key === 'Escape') {
          event.preventDefault()
          cancel()
        }
      })
      widget.addEventListener('blur', commit)
    } else {
      widget.addEventListener('blur', commit)
      widget.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          cancel()
        }
      })
    }
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
    //     js/page-render.js), not on the interactive element itself, and
    //     button() renders a real <a href target="_blank"> when the CTA has
    //     a buttonUrl (confirmed live on the payFee page).
    //   - An inline citation/reference link inside paragraph or bullet body
    //     text: formatMarkdown() (js/page-render.js) turns a
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
    openScalarEditor(field)
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
    // The call above is enough UNLESS js/page-render.js's renderPage()
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

  window.inlineEdit = { ensureBound, isEditing }
})()
