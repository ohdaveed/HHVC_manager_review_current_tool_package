/* AI rewrite: orchestrator. Watches text selections inside the mockup,
   resolves the containing field's dot-path, runs the rewrite request, and
   applies the result back into in-memory page data.

   Loads after js/ai/ai-rewrite-render.js (reads window.AiRewrite.render) and
   after js/ai/ai-assist-client.js (reuses its configured generate()). Never
   writes to pages/*.js — this is a review aid, not a publishing tool. */
;(function mountAiRewrite() {
  if (typeof window === 'undefined') return
  if (!window.AiRewrite?.render || !window.AiAssist?.client) return

  const render = window.AiRewrite.render
  const client = window.AiAssist.client
  const state = render.state

  /** In-flight rewrite, so Cancel has something to abort. */
  let controller = null
  /** The rect the button/popover are anchored to. */
  let anchorRect = null
  /** Whether this deployment has an AI backend at all. */
  let available = false
  /**
   * True from `openForCurrentField()` until the popover closes. The popover
   * is non-modal, so `selectionchange` keeps firing while it is open — without
   * this guard, `handleSelection()` retargets `state.fieldPath` to whatever
   * the reviewer selects next while `state.fieldText`/`state.result` still
   * describe the field the popover actually opened for.
   */
  let popoverOpen = false

  /**
   * The page object currently open in the mockup.
   *
   * Delegates to js/core/utils.js rather than carrying its own copy — see the
   * matching note in js/ai/ai-assist.js, which needed the identical lookup.
   * @returns {object|null}
   */
  function getCurrentPage() {
    return window.utils?.getCurrentPage?.() || null
  }

  /**
   * Resolve the selection to the rewritable field containing its start.
   *
   * The selection's START decides, so a drag that runs past the end of a
   * paragraph still has one unambiguous target rather than none. The popover
   * shows the whole field, so what is about to change stays visible.
   * @returns {{path: string, rect: DOMRect}|null}
   */
  function resolveSelection() {
    const selection = window.getSelection?.()
    if (!selection || selection.isCollapsed || !selection.rangeCount) return null
    const node = selection.anchorNode
    if (!node) return null
    const el = node.nodeType === 1 ? node : node.parentElement
    const field = el?.closest?.('[data-rewrite-field]')
    if (!field || !field.closest('#mockPage')) return null
    const path = field.getAttribute('data-rewrite-field') || ''
    if (!path) return null
    return { path, rect: selection.getRangeAt(0).getBoundingClientRect() }
  }

  /**
   * Show or hide the floating button as the selection changes. Debounced at
   * init (150ms), since `selectionchange` fires on every caret movement, not
   * only on a completed drag.
   * @returns {void}
   */
  function handleSelection() {
    if (!available || popoverOpen) return
    const resolved = resolveSelection()
    if (!resolved) {
      render.hideButton()
      return
    }
    anchorRect = resolved.rect
    state.fieldPath = resolved.path
    render.showButton(resolved.rect)
  }

  /**
   * Read the field's CURRENT text from page data, never from the DOM.
   *
   * formatMarkdown() escapes HTML and rewrites [label](target) into elements,
   * so textContent is rendered output — feeding it back would hand the model
   * post-render text and drop the markdown on apply. Text-bearing fields
   * accept either a bare string or an object `{text, unverified?, ...}` per
   * the page schema, so both shapes are read here.
   * @returns {string}
   */
  function readFieldText() {
    const page = getCurrentPage()
    const value = window.utils.getByPath(page, state.fieldPath)
    if (typeof value === 'string') return value
    return typeof value?.text === 'string' ? value.text : ''
  }

  /**
   * Move from "button visible" to "popover open for this field," resetting
   * every field of `state` that belongs to the previous selection rather than
   * carrying it forward — a reviewer picking a second field mid-session must
   * not see the first field's stale result or instruction.
   * @returns {void}
   */
  function openForCurrentField() {
    popoverOpen = true
    state.pageKey = window.utils?.getCurrentKey?.() || ''
    state.fieldText = readFieldText()
    state.instruction = ''
    state.result = null
    state.error = ''
    state.applied = false
    state.previousValue = undefined
    if (!state.fieldText) {
      state.error = 'Could not read that field. Try re-selecting the text.'
    }
    render.hideButton()
    render.openPopover(anchorRect)
  }

  /**
   * Send the rewrite request for the currently open field and render the
   * outcome. Left running to completion rather than cancelled by a second
   * call — the Run button's popover has no way to trigger this twice before
   * `state.busy` gates it below.
   * @returns {Promise<void>}
   */
  async function runRewrite() {
    if (state.busy) return
    const input = document.getElementById('aiRewriteInstruction')
    if (input) state.instruction = input.value || ''

    controller = new AbortController()
    state.busy = true
    state.error = ''
    render.renderPopover()

    const response = await client.generate({
      task: 'rewrite-field',
      fieldText: state.fieldText,
      instruction: state.instruction.trim() || undefined,
      page: getCurrentPage() || undefined,
      signal: controller.signal,
    })

    state.busy = false
    controller = null

    if (!response.ok) {
      state.error = response.error
      render.renderPopover()
      return
    }
    state.result = response.result.result
    // A draft that failed validation is still shown — the reviewer can see
    // which rule it broke and decide — matching how the content panel treats
    // an invalid page draft rather than hiding it.
    if (!response.result.valid) {
      const issues = Array.isArray(response.result.issues) ? response.result.issues : []
      state.error = `Check before applying: ${issues.join(' ') || 'the draft failed validation.'}`
    }
    render.renderPopover()
  }

  /**
   * title/summary/primaryCta and a section heading are all plain-string
   * fields with no {text, unverified, ...} slot — js/editing/inline-content-edit.js's
   * writeScalarValue() draws exactly this line, for the same reason: title/
   * summary/primaryCta are read/reapplied elsewhere
   * (updateMockupTextFromSavedState, collectCurrentPageReviewState) as bare
   * strings, and a heading is schema-typed `z.string()`, never the tagged
   * object form paragraphs/bullets accept. This feature's v1 scope was
   * originally paragraphs/bullets/step text only, reached exclusively via
   * paragraphList()/bulletList()/renderSteps()'s pathPrefix — before
   * js/mockup/page-render.js's renderHero()/renderSection() also started emitting
   * data-rewrite-field="title"/"summary"/"primaryCta"/"sections.N.heading"
   * for the inline-content-editing feature. Selecting one of those and
   * applying a rewrite without this guard writes the tagged object form into
   * a field every other reader expects to be a bare string, corrupting it to
   * "[object Object]" the moment anything renders it as text.
   * @param {string} path
   * @returns {boolean}
   */
  function isPlainStringField(path) {
    return (
      path === 'title' ||
      path === 'summary' ||
      path === 'primaryCta' ||
      /\.heading$/.test(path) ||
      // A {label, text} item's label — a whatToKnow entry's or a top-facts
      // fact's — is printed with escapeHtml() as that entry's own H3. It has
      // no {text, unverified} slot, so the tagged form renders as the literal
      // "[object Object]" exactly like the four above.
      /\.\d+\.label$/.test(path)
    )
  }

  /**
   * A non-array object — the shape a {label, text} item takes.
   * @param {unknown} value
   * @returns {boolean}
   */
  function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
  }

  /**
   * Write the rewrite into in-memory page data.
   *
   * Section paragraphs/bullets are written as the object form those arrays
   * already accept, flagged unverified so the mockup renders the existing
   * pill — an AI-touched line must be visually distinguishable from
   * human-authored copy without opening anything. title/summary/primaryCta/
   * a heading are written as plain strings instead (see isPlainStringField
   * above); they still pick up the existing CSS-only "Edited" badge from
   * js/editing/inline-content-edit.js's decorateEditedFields(), which compares
   * against ORIGINAL_DATA regardless of which feature made the edit.
   * @returns {void}
   */
  function applyResult() {
    const page = getCurrentPage()
    const text = state.result?.rewrittenText
    if (!page || !text) return
    if (window.utils?.getCurrentKey?.() !== state.pageKey) {
      state.error = 'You switched pages while this was open. Nothing was changed.'
      render.renderPopover()
      return
    }

    state.previousValue = window.utils.getByPath(page, state.fieldPath)
    // Spread whatever the item already was, rather than replacing it. A
    // whatToKnow entry and a top-facts fact are both {label, text}, and the
    // label is what each renderer prints as the entry's own H3 — writing the
    // bare tagged object deleted that heading the moment a rewrite was
    // applied to the paragraph under it. Mirrors writeScalarValue() in
    // js/editing/inline-content-edit.js, which draws the same line for the same
    // reason; that path was unified for this exact defect, and this one was
    // left behind.
    const carried = isPlainObject(state.previousValue) ? state.previousValue : {}
    const newValue = isPlainStringField(state.fieldPath)
      ? text
      : {
          ...carried,
          text,
          unverified: true,
          unverifiedReason: 'AI-rewritten draft — verify before publishing',
        }
    const wrote = window.utils.setByPath(page, state.fieldPath, newValue)
    if (!wrote) {
      state.error = 'That field is no longer on the page. Nothing was changed.'
      render.renderPopover()
      return
    }
    state.applied = true
    window.renderPage?.(window.utils?.getCurrentKey?.())
    render.renderPopover()
    window.showToast?.('Rewrite applied. Nothing was written to the repository.', 'success')
  }

  /**
   * Restore the pre-apply value. One step, consumed on use — a stack would
   * imply a history this state cannot reconstruct, and every other undo
   * surface in this tool (js/review/review-queue-undo.js) makes the same choice for
   * the same reason.
   * @returns {void}
   */
  function undoApply() {
    const page = getCurrentPage()
    if (!page || state.previousValue === undefined) return
    if (window.utils?.getCurrentKey?.() !== state.pageKey) {
      state.error = 'You switched pages while this was open. Nothing was changed.'
      render.renderPopover()
      return
    }
    window.utils.setByPath(page, state.fieldPath, state.previousValue)
    state.previousValue = undefined
    state.applied = false
    state.result = null
    popoverOpen = false
    window.renderPage?.(window.utils?.getCurrentKey?.())
    render.closePopover()
    window.showToast?.('Rewrite undone.', 'success')
  }

  /**
   * One delegated listener, bound at init — the button and popover are created
   * lazily and re-rendered often, so per-element binding would have to be
   * redone after every render.
   * @param {Event} event
   * @returns {void}
   */
  function handleClick(event) {
    const target = event.target
    if (!(target instanceof Element)) return
    if (target.closest('#aiRewriteButton')) return openForCurrentField()
    if (target.closest('#aiRewriteRun')) return void runRewrite()
    if (target.closest('#aiRewriteCancel')) return controller?.abort()
    if (target.closest('#aiRewriteApply')) return applyResult()
    if (target.closest('#aiRewriteUndo')) return undoApply()
    if (target.closest('#aiRewriteDiscard') || target.closest('#aiRewriteClose')) {
      state.result = null
      state.error = ''
      popoverOpen = false
      return render.closePopover()
    }
    return undefined
  }

  /**
   * Ask the server what it supports once, at init.
   *
   * The button never appears on a deployment with no AI backend, and three
   * different gates land on that same outcome. A static host has no runtime for
   * /api/ai/* at all. A Railway deploy answers 401 until this browser is a
   * principal, since authorization is checked before anything else. And an
   * authorized deploy with no provider key answers 200 with an EMPTY `tasks`
   * array — /api/ai/capabilities is the discovery endpoint and deliberately
   * never 501s there, because a browser has to be able to tell "no AI key"
   * from "no server at all". So it is `tasks`, not the status code, that says
   * whether a rewrite can actually run. An affordance that always fails is
   * worse than no affordance.
   * @returns {Promise<void>}
   */
  async function checkAvailability() {
    if (!client.isConfigured()) return
    const result = await client.fetchCapabilities()
    available = Boolean(result.ok && result.capabilities?.tasks?.includes('rewrite-field'))
    // A reviewer can select text before this async check resolves. Without
    // this, `available` flips true but the button stays hidden until the
    // selection changes again — re-run the check against whatever is
    // currently selected so an existing selection's affordance appears
    // immediately instead of waiting for the next selectionchange event.
    if (available) handleSelection()
  }

  /** @returns {void} */
  function init() {
    document.addEventListener('selectionchange', window.utils.debounce(handleSelection, 150))
    document.addEventListener('click', handleClick)
    checkAvailability()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }

  window.aiRewrite = { handleSelection, runRewrite, applyResult, undoApply }
})()
