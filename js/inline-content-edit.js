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
   * Re-render the mockup for the current page, then re-bind (delegated
   * listeners survive re-render since they're attached to a stable
   * ancestor, but any transient editing-widget DOM does not).
   * @returns {void}
   */
  function rerender() {
    const key = window.utils.getCurrentKey()
    window.renderPage?.(key, true)
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
   * the nearest [data-rewrite-field] ancestor. List add/remove controls
   * (Task 7) are matched first since they can sit inside a
   * [data-rewrite-field] element's subtree (e.g. a remove "×" inside a
   * <li> that itself carries the attribute) and must not also open a
   * scalar editor on the same click.
   * @param {MouseEvent} event
   * @returns {void}
   */
  function handleMockPageClick(event) {
    const target = event.target
    if (!(target instanceof Element)) return
    if (
      target.closest('[data-inline-edit-add], [data-inline-edit-remove], [data-inline-edit-undo]')
    ) {
      return // handled by Task 7's listeners
    }
    if (editingPath) return // already editing something; let blur/Enter/Escape resolve it first
    const field = target.closest('[data-rewrite-field]')
    if (!field) return
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

  function init() {
    ensureBound()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }

  window.inlineEdit = { ensureBound, isEditing }
})()
