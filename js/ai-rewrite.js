/* AI rewrite: orchestrator. Watches text selections inside the mockup,
   resolves the containing field's dot-path, runs the rewrite request, and
   applies the result back into in-memory page data.

   Loads after js/ai-rewrite-render.js (reads window.AiRewrite.render) and
   after js/ai-assist-client.js (reuses its configured generate()). Never
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
   * The page object currently open in the mockup.
   * @returns {object|null}
   */
  function getCurrentPage() {
    const key = window.utils?.getCurrentKey?.()
    return (window.HHVC_DATA?.pages || {})[key] || null
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
    if (!available) return
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
      state.error = `Check before applying: ${response.result.issues.join(' ')}`
    }
    render.renderPopover()
  }

  /**
   * Write the rewrite into in-memory page data.
   *
   * Written as the object form the text arrays already accept, flagged
   * unverified so the mockup renders the existing pill — an AI-touched line
   * must be visually distinguishable from human-authored copy without opening
   * anything.
   * @returns {void}
   */
  function applyResult() {
    const page = getCurrentPage()
    const text = state.result?.rewrittenText
    if (!page || !text) return

    state.previousValue = window.utils.getByPath(page, state.fieldPath)
    const wrote = window.utils.setByPath(page, state.fieldPath, {
      text,
      unverified: true,
      unverifiedReason: 'AI-rewritten draft — verify before publishing',
    })
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
   * surface in this tool (js/review-queue-undo.js) makes the same choice for
   * the same reason.
   * @returns {void}
   */
  function undoApply() {
    const page = getCurrentPage()
    if (!page || state.previousValue === undefined) return
    window.utils.setByPath(page, state.fieldPath, state.previousValue)
    state.previousValue = undefined
    state.applied = false
    state.result = null
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
      return render.closePopover()
    }
    return undefined
  }

  /**
   * Ask the server what it supports once, at init.
   *
   * The button never appears on a deployment with no AI backend — a Netlify
   * build has no runtime for /api/ai/*, and an affordance that always fails is
   * worse than no affordance.
   * @returns {Promise<void>}
   */
  async function checkAvailability() {
    if (!client.isConfigured()) return
    const result = await client.fetchCapabilities()
    available = Boolean(result.ok && result.capabilities?.tasks?.includes('rewrite-field'))
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
