/* Inline content editing: a hand-written @editorjs/editorjs inline tool for
   internal-page and external links. Editor.js ships no inline link tool of
   its own — its stock 'link' behavior is a block-level preview card, not an
   inline anchor around a text selection — so this reproduces the
   data-render-target (internal page) vs external-https:// branching
   js/mockup/page-render.js's formatMarkdown() already applies when rendering
   authored [label](target) markdown, using the exact same
   /^https?:\/\// test. The two anchor shapes this tool builds
   (<a data-render-target="...">label</a> and
   <a href="..." target="_blank" rel="noopener noreferrer">label</a>) are the
   SAME two shapes js/editing/inline-content-edit-adapter.js's markdownToEditingHtml
   already produces when opening existing authored content for editing, and
   the only two shapes its editingHtmlToMarkdown inverse recognizes — this
   tool exists so a link a reviewer TYPES matches what one they open already
   sees, with no third shape for the adapter to fail to round-trip.

   An external target is run through window.utils.safeUrl() before being
   accepted into the href attribute: new code at a new entry point (a
   reviewer-typed URL, never previously an href anywhere in this feature), so
   nothing upstream has validated it. safeUrl() is the same scheme guard
   every other href in this tool goes through (js/core/utils.js).

   Self-mounting IIFE publishing window.InlineEdit.LinkTool, mirroring
   js/editing/inline-content-edit-render.js's window.InlineEdit.render — loads after
   js/core/utils.js (for safeUrl) and before js/editing/inline-content-edit.js, which
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
   * Distinguishes the DOM ids this tool mints (`<datalist>`, the rule
   * description) between instances. Editor.js constructs one tool instance per
   * editor, and js/editing/inline-content-edit.js can have opened a previous field's
   * editor whose actions markup has not yet been torn down — two elements
   * sharing an id would make `aria-describedby` and `list` resolve to
   * whichever the document happened to hold first.
   */
  let linkToolInstanceCounter = 0

  /**
   * Every page key an inline link may point at.
   *
   * The UNION of two sets, and it has to be both — measured, not assumed.
   * `window.HHVC_DATA.pages` is every page currently in the mockup, authored
   * or reviewer-added. `pageRegistry.knownKeys()` is NOT a superset of it: it
   * returns only what the registry itself holds, `added` plus `hidden`, so on
   * a browser where the reviewer has neither added nor deleted anything it is
   * the empty array. Resolving against it alone rejected every target,
   * including correct ones — caught by the existing e2e link cases, which
   * stopped inserting links at all.
   *
   * The `hidden` half still matters, which is why this is not simply
   * `DATA.pages`: a reviewer-hidden page leaves `DATA.pages` but is
   * recoverable by design, and rejecting a link to one would let deleting a
   * single page silently invalidate prose on every other page that links to
   * it — turning a reversible action into a destructive one.
   *
   * Published on window.InlineEdit so js/editing/inline-content-edit.js's paste-path
   * check resolves the identical set; two call sites building this union
   * separately is exactly the drift js/mockup/inline-link-target.js exists to stop,
   * one level up.
   *
   * @returns {Array<string>}
   */
  function linkableKeys() {
    const live = Object.keys(window.HHVC_DATA?.pages || {})
    const known = window.pageRegistry?.knownKeys?.() || []
    return [...new Set([...live, ...known])]
  }

  /**
   * Whether a reviewer-typed target is something an inline link may point at.
   *
   * The rule itself lives in js/mockup/inline-link-target.js, shared with
   * build_scripts/data-checks.js — see that file's header for why a second
   * copy here would be the exact drift the extraction removed. This wrapper
   * exists only to resolve the key set, which is a browser concern the
   * predicate deliberately knows nothing about.
   *
   * @param {string} raw
   * @returns {boolean}
   */
  function isValidTarget(raw) {
    return window.inlineLinkTarget.isValidInlineLinkTarget(raw, linkableKeys())
  }

  /**
   * Owns the one hand-off point between this file and js/editing/inline-content-edit.js's
   * commit() — the dataset key both sides used to independently spell out as a bare string
   * literal (`holderEl.dataset.hhvcPendingLinkHtml` in both places, agreeing only by
   * convention). See commitLink()'s own comment below for WHY the hand-off exists (an
   * Editor.js blur-cleanup bug that strips a just-inserted anchor before commit() can read
   * it); this object exists so the two files agree on HOW without either retyping the key,
   * and a third caller (or a future rename) has one place to look.
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
     * Whether a stash currently exists for this element, without consuming
     * it — unlike take(), a second call still returns the same answer. For
     * a caller (js/editing/inline-content-edit.js's holder-level 'input' listener)
     * that needs to know whether to keep the stash in sync with further
     * typing, not whether to resolve it.
     * @param {HTMLElement|null|undefined} holderEl
     * @returns {boolean}
     */
    has(holderEl) {
      return !!holderEl && holderEl.dataset[PENDING_LINK_ATTR] !== undefined
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
     * (js/editing/inline-content-edit-adapter.js) round-trip through. Editor.js's
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
      this.datalist = null
      this.ruleEl = null
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

      const uid = ++linkToolInstanceCounter
      const listId = `inline-edit-link-pages-${uid}`
      const ruleId = `inline-edit-link-rule-${uid}`

      this.input = document.createElement('input')
      this.input.type = 'text'
      this.input.placeholder = 'Page key or https://…'
      this.input.classList.add('inline-edit-link-input')
      // The suggestion list is a <datalist>, so it stays a combobox rather
      // than becoming a <select>: a reviewer must still be able to type an
      // https:// address, which no page list can enumerate. It suggests
      // without constraining, which is exactly why commitLink() below still
      // has to validate — the datalist is discoverability, not enforcement.
      this.input.setAttribute('list', listId)
      // Standing description rather than one injected at error time. Pointed
      // at permanently, it is announced when focus first enters the field, so
      // the reviewer learns the rule BEFORE getting it wrong; aria-invalid
      // alone then carries the state change. A description that appears only
      // once the value is rejected is a live region wearing a description's
      // clothes, and `placeholder` is no substitute — it is not reliably
      // announced and disappears at the first keystroke.
      this.input.setAttribute('aria-describedby', ruleId)

      this.datalist = document.createElement('datalist')
      this.datalist.id = listId

      this.ruleEl = document.createElement('span')
      this.ruleEl.id = ruleId
      this.ruleEl.className = 'hhvc-sr-only'
      // Read from js/mockup/inline-link-target.js rather than written out here, so
      // the rule and the sentence describing it cannot drift apart.
      this.ruleEl.textContent = window.inlineLinkTarget.INLINE_LINK_TARGET_RULE

      this.actionsWrapper.appendChild(this.input)
      this.actionsWrapper.appendChild(this.datalist)
      this.actionsWrapper.appendChild(this.ruleEl)

      this.input.addEventListener('input', () => {
        // Clear the rejected state as soon as the reviewer starts fixing it —
        // leaving aria-invalid set while they retype would keep announcing a
        // verdict on a value that no longer exists.
        this.markValid()
      })

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
      this.markValid()
      this.populateSuggestions()
      this.actionsWrapper.hidden = false
      this.input.focus()
    }

    /**
     * Rebuild the page suggestions from the CURRENT reading order.
     *
     * Deliberately called here rather than from renderActions(): Editor.js
     * calls renderActions() once to build the element, not once per open (see
     * that method), while `pageOrder` changes at runtime whenever a reviewer
     * adds or deletes a page (js/core/page-registry.js). Built once, the list goes
     * stale in exactly the session where a reviewer created the page they now
     * want to link to.
     *
     * Suggestions come from `order` while ACCEPTANCE (commitLink() below) goes
     * through pageRegistry.knownKeys(), and the two sets differ on purpose: a
     * hidden page is still a valid target, because hiding is reversible and
     * rejecting it would let deleting one page silently invalidate prose on
     * another — but suggesting it would invite a reviewer to link to something
     * absent from the mockup they are reviewing.
     *
     * The `#` sentinel is accepted and never suggested. It is an authoring
     * convention for placeholder copy, and listing it in a menu advertises
     * "make a link that does nothing" as a normal reviewer action.
     *
     * @returns {void}
     */
    populateSuggestions() {
      if (!this.datalist) return
      this.datalist.replaceChildren()
      const order = window.HHVC_DATA?.order || []
      for (const entry of order) {
        const [key, label] = Array.isArray(entry) ? entry : []
        if (!key) continue
        const option = document.createElement('option')
        // The value is what lands in `data-render-target`; the label is the
        // only form the reviewer recognizes, since page keys appear nowhere
        // in the UI they are looking at.
        option.value = key
        if (label) option.label = label
        this.datalist.appendChild(option)
      }
    }

    /**
     * Mark the target-entry input as holding a rejected value.
     *
     * State only — no message element is created. The rule sentence is
     * already the input's standing description (renderActions()), so a
     * screen reader reaching this field hears what is allowed; aria-invalid
     * is what says the current value is not.
     * @returns {void}
     */
    markInvalid() {
      this.input?.setAttribute('aria-invalid', 'true')
      this.input?.classList.add('is-invalid')
    }

    /**
     * @returns {void}
     */
    markValid() {
      this.input?.removeAttribute('aria-invalid')
      this.input?.classList.remove('is-invalid')
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
     * Also stashes the resulting block HTML on the holder element, keyed off
     * `data-inline-edit-editorjs-holder` (js/editing/inline-content-edit-render.js's
     * editorJsHolderHtml). This is a workaround, not
     * incidental: Editor.js's own blur-triggered internal cleanup on the
     * contenteditable — which runs on the SAME native blur that later
     * drives js/editing/inline-content-edit.js's commit(), before that async
     * function ever starts — strips this anchor down to plain text using a
     * narrower rule set than editor.save()'s own sanitizer honors. Measured
     * live: calling editor.save() directly right after this method returns
     * preserves the anchor perfectly; the same call made once a real blur
     * has intervened does not, silently. Capturing the correct HTML here,
     * before that blur can happen, is what js/editing/inline-content-edit.js's
     * commit() prefers over editor.save()'s own (by-then-corrupted) output.
     * This is only the INITIAL capture — js/editing/inline-content-edit.js's own
     * holder-level 'input' listener re-stashes via LinkCommitBridge on every
     * subsequent keystroke, so further typing after the link is inserted
     * but before the field blurs is not lost.
     * @returns {void}
     */
    commitLink() {
      const raw = (this.input?.value || '').trim()
      if (!raw || !this.savedRange) {
        // An empty value is the documented equivalent of Escape: insert
        // nothing and close. Checked before validation so a reviewer who
        // opens the input and changes their mind is not told their empty
        // string is a bad page key.
        this.actionsWrapper.hidden = true
        this.savedRange = null
        this.api.inlineToolbar.close()
        return
      }
      // Refuse rather than insert. The rejected alternatives: inserting the
      // link flagged `unverified: true` misuses a pill that means "a human
      // should confirm this claim" to mean "this control is broken", and
      // silently dropping the link discards what the reviewer was trying to
      // do. Refusing is the only outcome where they learn the target was
      // wrong while they can still fix it — the input stays open, holds what
      // they typed, and Enter retries.
      if (!isValidTarget(raw)) {
        this.markInvalid()
        this.input?.focus()
        this.input?.select()
        return
      }
      this.actionsWrapper.hidden = true
      const range = this.savedRange
      this.savedRange = null
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
      // Drop the rejected state with it. A left-over aria-invalid would
      // otherwise greet the next open — on a different selection the reviewer
      // has not typed anything for yet — with a verdict on a value that is
      // already gone.
      this.markValid()
      this.savedRange = null
    }
  }

  window.InlineEdit.LinkTool = InlineEditLinkTool
  window.InlineEdit.linkableKeys = linkableKeys
})()
