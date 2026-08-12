/* Inline content editing: a hand-written @editorjs/editorjs inline tool for
   internal-page and external links. Editor.js ships no inline link tool of
   its own — its stock 'link' behavior is a block-level preview card, not an
   inline anchor around a text selection — so this reproduces the
   data-render-target (internal page) vs external-https:// branching
   js/page-render.js's formatMarkdown() already applies when rendering
   authored [label](target) markdown, using the exact same
   /^https?:\/\// test. The two anchor shapes this tool builds
   (<a data-render-target="...">label</a> and
   <a href="..." target="_blank" rel="noopener noreferrer">label</a>) are the
   SAME two shapes js/inline-content-edit-adapter.js's markdownToEditingHtml
   already produces when opening existing authored content for editing, and
   the only two shapes its editingHtmlToMarkdown inverse recognizes — this
   tool exists so a link a reviewer TYPES matches what one they open already
   sees, with no third shape for the adapter to fail to round-trip.

   An external target is run through window.utils.safeUrl() before being
   accepted into the href attribute: new code at a new entry point (a
   reviewer-typed URL, never previously an href anywhere in this feature), so
   nothing upstream has validated it. safeUrl() is the same scheme guard
   every other href in this tool goes through (js/utils.js).

   Self-mounting IIFE publishing window.InlineEdit.LinkTool, mirroring
   js/inline-content-edit-render.js's window.InlineEdit.render — loads after
   js/utils.js (for safeUrl) and before js/inline-content-edit.js, which
   registers this class in openEditorJsEditor()'s Editor.js `tools` config
   for paragraph/bullet fields only (the only fields that ever get an inline
   toolbar at all — see that function's inlineToolbar gate; title/summary/
   primaryCta/heading render through a bare escapeHtml() with no
   formatMarkdown() call, so a link typed there could never render as one). */
;(function mountInlineContentEditLinkTool() {
  if (typeof window === 'undefined') return
  window.InlineEdit = window.InlineEdit || {}

  const { safeUrl } = window.utils

  /**
   * Owns the one hand-off point between this file and js/inline-content-
   * edit.js's commit() — the dataset key both sides used to independently
   * spell out as a bare string literal (`holderEl.dataset.hhvcPendingLinkHtml`
   * in both places, agreeing only by convention). See commitLink()'s own
   * comment below for WHY the hand-off exists (an Editor.js blur-cleanup bug
   * that strips a just-inserted anchor before commit() can read it); this
   * object exists so the two files agree on HOW without either retyping the
   * key, and a third caller (or a future rename) has one place to look.
   */
  const PENDING_LINK_ATTR = 'hhvcPendingLinkHtml'
  const LinkCommitBridge = {
    /**
     * @param {HTMLElement|null|undefined} holderEl
     * @param {string} html
     * @returns {void}
     */
    stash(holderEl, html) {
      if (!holderEl) return
      holderEl.dataset[PENDING_LINK_ATTR] = html
    },
    /**
     * @param {HTMLElement|null|undefined} holderEl
     * @returns {string|undefined} the stashed HTML, or undefined if none was
     *   stashed for this element. Always clears the stash it finds, so a
     *   second call on the same element returns undefined.
     */
    take(holderEl) {
      if (!holderEl) return undefined
      const html = holderEl.dataset[PENDING_LINK_ATTR]
      delete holderEl.dataset[PENDING_LINK_ATTR]
      return html
    },
  }
  window.InlineEdit.LinkCommitBridge = LinkCommitBridge

  class InlineEditLinkTool {
    static get isInline() {
      return true
    }

    static get title() {
      return 'Link'
    }

    /**
     * Allow exactly the attributes markdownToEditingHtml/editingHtmlToMarkdown
     * (js/inline-content-edit-adapter.js) round-trip through. Editor.js's
     * sanitizer strips any attribute not explicitly listed here from every
     * <a> in the block, including one this tool itself just inserted —
     * omitting one here would silently drop it before editor.save() ever
     * hands the HTML to the adapter.
     * @returns {object}
     */
    static get sanitize() {
      return {
        a: {
          'data-render-target': true,
          href: true,
          target: true,
          rel: true,
        },
      }
    }

    /**
     * @param {{api: object}} tool
     */
    constructor({ api }) {
      this.api = api
      this.button = null
      this.actionsWrapper = null
      this.input = null
      this.savedRange = null
    }

    /**
     * @returns {HTMLElement}
     */
    render() {
      this.button = document.createElement('button')
      this.button.type = 'button'
      this.button.classList.add('ce-inline-tool', 'inline-edit-link-button')
      this.button.textContent = 'Link'
      return this.button
    }

    /**
     * The target-entry input, shown/hidden by showActions()/commitLink()/
     * clear() rather than by Editor.js itself — renderActions() is called
     * once to build this element, not once per open (per the docs: "an
     * input for the 'link' tool ... placed below the buttons list").
     * @returns {HTMLElement}
     */
    renderActions() {
      this.actionsWrapper = document.createElement('div')
      this.actionsWrapper.classList.add('inline-edit-link-actions')
      this.actionsWrapper.hidden = true

      this.input = document.createElement('input')
      this.input.type = 'text'
      this.input.placeholder = 'Page key or https://…'
      this.input.classList.add('inline-edit-link-input')
      this.actionsWrapper.appendChild(this.input)

      this.input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          this.commitLink()
        } else if (event.key === 'Escape') {
          event.preventDefault()
          this.actionsWrapper.hidden = true
          this.savedRange = null
          this.api.inlineToolbar.close()
        }
      })

      return this.actionsWrapper
    }

    /**
     * Click handler Editor.js's own InlineToolbar core wires to the button
     * render() returned, called with the current selection's range. A
     * selection already inside a link removes it outright (click to add,
     * click again to remove — this tool has no separate "edit an existing
     * link" affordance; changing a target means removing and re-adding).
     * Anything else opens the target-entry input.
     * @param {Range} range
     * @returns {void}
     */
    surround(range) {
      if (!range) return
      const existingAnchor = this.api.selection.findParentTag('A')
      if (existingAnchor) {
        this.unwrap(existingAnchor)
        return
      }
      this.savedRange = range
      this.showActions()
    }

    /**
     * Reveal the target-entry input and focus it.
     * @returns {void}
     */
    showActions() {
      if (!this.actionsWrapper || !this.input) return
      this.input.value = ''
      this.actionsWrapper.hidden = false
      this.input.focus()
    }

    /**
     * Remove an existing link, unwrapping its contents back into plain
     * text. Mirrors the Editor.js docs' own MarkerTool.unwrap() example.
     * @param {HTMLElement} anchor
     * @returns {void}
     */
    unwrap(anchor) {
      this.api.selection.expandToTag(anchor)
      const selection = window.getSelection()
      const range = selection.getRangeAt(0)
      const unwrappedContent = range.extractContents()
      anchor.parentNode.removeChild(anchor)
      range.insertNode(unwrappedContent)
      selection.removeAllRanges()
      selection.addRange(range)
    }

    /**
     * Build the anchor for whatever the reviewer typed and insert it at the
     * range surround() saved — the same internal-vs-external branching
     * markdownToEditingHtml applies when opening existing content, so a
     * link created here round-trips through editingHtmlToMarkdown on commit
     * exactly like an authored one. An empty or whitespace-only value
     * inserts nothing (equivalent to Escape).
     *
     * Also stashes the resulting block HTML on the holder element, keyed
     * off `data-inline-edit-editorjs-holder` (js/inline-content-edit-
     * render.js's editorJsHolderHtml). This is a workaround, not
     * incidental: Editor.js's own blur-triggered internal cleanup on the
     * contenteditable — which runs on the SAME native blur that later
     * drives js/inline-content-edit.js's commit(), before that async
     * function ever starts — strips this anchor down to plain text using a
     * narrower rule set than editor.save()'s own sanitizer honors. Measured
     * live: calling editor.save() directly right after this method returns
     * preserves the anchor perfectly; the same call made once a real blur
     * has intervened does not, silently. Capturing the correct HTML here,
     * before that blur can happen, is what js/inline-content-edit.js's
     * commit() prefers over editor.save()'s own (by-then-corrupted) output.
     * @returns {void}
     */
    commitLink() {
      const raw = (this.input?.value || '').trim()
      this.actionsWrapper.hidden = true
      const range = this.savedRange
      this.savedRange = null
      if (!raw || !range) {
        this.api.inlineToolbar.close()
        return
      }
      const anchor = document.createElement('a')
      if (/^https?:\/\//.test(raw)) {
        anchor.setAttribute('href', safeUrl(raw))
        anchor.setAttribute('target', '_blank')
        anchor.setAttribute('rel', 'noopener noreferrer')
      } else {
        anchor.setAttribute('data-render-target', raw)
      }
      anchor.appendChild(range.extractContents())
      range.insertNode(anchor)
      this.api.selection.expandToTag(anchor)

      const container = range.commonAncestorContainer
      const startEl = container.nodeType === Node.ELEMENT_NODE ? container : container.parentElement
      const editableEl = startEl?.closest('.ce-paragraph')
      const holderEl = editableEl?.closest('[data-inline-edit-editorjs-holder]')
      if (holderEl && editableEl) {
        LinkCommitBridge.stash(holderEl, editableEl.innerHTML)
      }

      this.api.inlineToolbar.close()
    }

    /**
     * Updates the button's active/highlighted state only — deliberately
     * does not also manage actionsWrapper visibility, since checkState() can
     * fire while the target-entry input is open and focused (e.g. on a
     * selection change Editor.js itself triggers), and hiding the input out
     * from under a reviewer mid-type would be exactly the "closes the
     * instant you try to use it" bug this split avoids. clear() below is
     * the documented hook for resetting that state instead.
     * @returns {boolean}
     */
    checkState() {
      const anchor = this.api.selection.findParentTag('A')
      this.button?.classList.toggle('ce-inline-tool--active', !!anchor)
      return !!anchor
    }

    /**
     * Called by Editor.js on inline-toolbar open/close. Resets any
     * left-open target-entry input from a previous use so the next open
     * (on a different selection, possibly without ever pressing Enter or
     * Escape on this one) starts clean.
     * @returns {void}
     */
    clear() {
      if (this.actionsWrapper) this.actionsWrapper.hidden = true
      this.savedRange = null
    }
  }

  window.InlineEdit.LinkTool = InlineEditLinkTool
})()
