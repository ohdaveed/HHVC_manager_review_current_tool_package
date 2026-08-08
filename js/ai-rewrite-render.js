/* AI rewrite: view layer.

   Owns the floating "AI rewrite" button that appears near a text selection,
   the popover it opens, and their positioning against a DOMRect the caller
   supplies. Holds no request logic and talks to no network — the
   orchestrator in js/ai-rewrite.js (Task 8, not yet written) owns the
   selection listener, the fetch to /api/ai/generate, and every transition of
   `state` below. This module only ever reads `state` to decide what to draw
   and writes to it nowhere itself, mirroring how js/ai-assist-render.js's
   `renderPanel()` is a pure function of js/ai-assist.js's state.

   Load-order dependency: needs `window.utils.escapeHtml`, so it loads after
   js/utils.js. It must also load before js/ai-rewrite.js, which reads
   `window.AiRewrite.render` at mount time — see js/main.js's import list,
   directly after js/ai-assist.js.

   Everything interpolated into innerHTML here is untrusted by this module's
   own rules, for two different reasons: `state.fieldText` is copied straight
   out of `pages/*.js` page data (paragraph/bullet copy, not markup), and
   `state.result` is text the model wrote, which is exactly the "nobody in
   this repo wrote it" case js/ai-assist-render.js's header calls out. Both
   go through escapeHtml before they reach the DOM, with no exception — unlike
   the AI-assist panel, this view never renders a trusted preview via
   renderPageMain(), so there is no second path to keep escaping-consistent
   with. */
;(function mountAiRewriteRender() {
  if (typeof window === 'undefined') return

  const escapeHtml = window.utils?.escapeHtml
  if (typeof escapeHtml !== 'function') return

  window.AiRewrite = window.AiRewrite || {}

  /**
   * Popover/button state. Mirrors js/ai-assist-render.js's `state` object:
   * a single mutable record the orchestrator writes to and this module reads
   * from on every render. Not persisted anywhere — like the AI-assist draft,
   * a pending rewrite is deliberately ephemeral and does not survive a page
   * reload.
   *
   * - `fieldPath` — the `data-rewrite-field` path of the selected element
   *   (e.g. `sections.2.paragraphs.0`), which is what the orchestrator will
   *   eventually pass to `window.utils.setByPath` to apply a result.
   * - `fieldText` — the full text of that field, not just the highlighted
   *   substring. The popover says so via the scope note in `renderPopover`,
   *   because rewriting only the highlighted fragment would leave the
   *   surrounding sentence's grammar to chance.
   * - `instruction` — optional free-text steering for the rewrite request;
   *   empty means "apply our content standards" per the placeholder copy.
   * - `busy` — a request is in flight; disables the instruction input's
   *   effect on the action row (the Cancel state) the same way
   *   js/ai-assist-render.js disables its form fields while `state.busy`.
   * - `error` — the last request's failure message, if any, cleared by the
   *   orchestrator before the next attempt.
   * - `result` — `{rewrittenText}` from a successful `rewrite-field`
   *   generation, or `null` before one exists.
   * - `applied` — true once the orchestrator has written `result` back into
   *   the in-memory page data via `setByPath`. Gates the Undo/Close pair
   *   in `renderPopover` versus the Apply/Discard pair.
   * - `previousValue` — the field's value immediately before an apply,
   *   captured by the orchestrator so Undo has something to restore.
   *   `undefined` (not `''`) before any apply, so "no prior value captured
   *   yet" is never confused with "the field was empty."
   */
  const state = {
    fieldPath: '',
    fieldText: '',
    instruction: '',
    busy: false,
    error: '',
    result: null,
    applied: false,
    previousValue: undefined,
  }

  // Created lazily on first showButton()/openPopover() call rather than at
  // mount time, so a reviewer who never selects text never pays for two
  // extra nodes sitting in the DOM. Both are appended straight to
  // document.body — not into #reviewWorkspace or any page-mockup
  // container — because a text selection can happen anywhere in the
  // document and a fixed-position element positioned from a DOMRect has no
  // need of a specific parent.
  let buttonEl = null
  let popoverEl = null

  /**
   * Lazily create and cache the floating button element.
   * @returns {HTMLElement}
   */
  function ensureButton() {
    if (buttonEl) return buttonEl
    buttonEl = document.createElement('button')
    buttonEl.type = 'button'
    buttonEl.id = 'aiRewriteButton'
    buttonEl.className = 'ai-rewrite-button'
    buttonEl.hidden = true
    buttonEl.textContent = 'AI rewrite'
    document.body.appendChild(buttonEl)
    return buttonEl
  }

  /**
   * Lazily create and cache the popover element.
   * @returns {HTMLElement}
   */
  function ensurePopover() {
    if (popoverEl) return popoverEl
    popoverEl = document.createElement('div')
    popoverEl.id = 'aiRewritePopover'
    popoverEl.className = 'ai-rewrite-popover'
    popoverEl.setAttribute('role', 'dialog')
    popoverEl.setAttribute('aria-label', 'AI rewrite')
    popoverEl.hidden = true
    document.body.appendChild(popoverEl)
    return popoverEl
  }

  /**
   * Place an element under a selection rect, clamped into the viewport.
   *
   * `rect` comes from `Selection.getRangeAt(0).getBoundingClientRect()` in
   * the orchestrator, which is already in the same fixed/viewport coordinate
   * space this function positions into — no scroll-offset math needed, which
   * is also why both elements are `position: fixed` rather than `absolute`.
   *
   * Horizontal clamping needs the element's own width
   * (`el.offsetWidth`), which only exists once the element is in the DOM and
   * unhidden — callers unhide before calling this, never after. Vertical
   * clamping is simpler (a fixed 40px floor from the bottom edge) because
   * only the button is short enough that its own height rarely matters here;
   * the popover's much larger footprint is why it also gets `max-height: 70vh`
   * plus internal scrolling in css/ai-rewrite.css rather than relying on this
   * clamp alone.
   * @param {HTMLElement} el
   * @param {DOMRect} rect
   * @returns {void}
   */
  function position(el, rect) {
    el.style.top = `${Math.min(rect.bottom + 8, window.innerHeight - 40)}px`
    el.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - el.offsetWidth - 8))}px`
  }

  /**
   * Show the floating button near a text selection.
   * @param {DOMRect} rect bounding rect of the current selection.
   * @returns {void}
   */
  function showButton(rect) {
    const el = ensureButton()
    el.hidden = false
    position(el, rect)
  }

  /**
   * Hide the floating button. Safe to call before it has ever been shown —
   * the orchestrator calls this on every selection change, including the
   * very first one, when `buttonEl` may still be null.
   * @returns {void}
   */
  function hideButton() {
    if (buttonEl) buttonEl.hidden = true
  }

  /**
   * Hide the popover without discarding `state`. Closing is not the same as
   * resetting: the orchestrator decides whether a closed popover's state
   * should be cleared (e.g. after Discard/Undo) or left alone (e.g. a
   * reviewer who closes mid-instruction and reopens the same selection).
   * That decision belongs to js/ai-rewrite.js, not this view.
   * @returns {void}
   */
  function closePopover() {
    if (popoverEl) popoverEl.hidden = true
  }

  /**
   * Redraw the popover from `state`.
   *
   * Rebuilt wholesale on every call rather than patched incrementally —
   * the same tradeoff js/ai-assist-render.js's `renderPanel()` makes, and
   * for the same reason: the state machine here has few enough transitions
   * (idle -> busy -> result -> applied, or an error at any point) that a
   * full re-render is simpler to keep correct than hand-written DOM patches,
   * and the popover is small enough that the cost is not worth avoiding.
   *
   * Every value interpolated here is escaped: `state.fieldText` is page copy
   * and `state.result.rewrittenText` is model output, and this module's
   * header explains why neither gets a trusted-content exception.
   * @returns {void}
   */
  function renderPopover() {
    const el = ensurePopover()
    const suggestion = state.result?.rewrittenText || ''
    el.innerHTML = `
      <h3 class="ai-rewrite-title">Rewrite this text</h3>
      <p class="ai-rewrite-scope-note">The whole paragraph or bullet below is replaced, not only what you highlighted.</p>
      <div class="ai-rewrite-field-text">${escapeHtml(state.fieldText)}</div>
      ${
        state.result
          ? `<h4>Suggestion</h4><div class="ai-rewrite-suggestion">${escapeHtml(suggestion)}</div>`
          : `<label class="ai-rewrite-instruction-label" for="aiRewriteInstruction">Instruction (optional)</label>
             <input id="aiRewriteInstruction" class="ai-rewrite-instruction" type="text" value="${escapeHtml(state.instruction)}" placeholder="Leave empty to apply our content standards" />`
      }
      ${state.error ? `<p class="ai-rewrite-error" role="alert">${escapeHtml(state.error)}</p>` : ''}
      <div class="ai-rewrite-actions">
        ${
          state.applied
            ? `<button type="button" id="aiRewriteUndo">Undo</button>
               <button type="button" id="aiRewriteClose">Close</button>`
            : state.result
              ? `<button type="button" id="aiRewriteApply">Apply</button>
                 <button type="button" id="aiRewriteDiscard">Discard</button>`
              : state.busy
                ? `<button type="button" id="aiRewriteCancel">Cancel</button>`
                : `<button type="button" id="aiRewriteRun">Rewrite</button>
                   <button type="button" id="aiRewriteClose">Close</button>`
        }
      </div>
      ${state.busy ? '<p class="ai-rewrite-status">Rewriting…</p>' : ''}
    `
    el.hidden = false
  }

  /**
   * Open the popover near a selection rect and render its current state.
   *
   * Renders before positioning, deliberately: `position()` reads
   * `el.offsetWidth` to clamp the horizontal edge, and that width depends on
   * the popover's actual content (the instruction form is narrower than a
   * rendered suggestion), so positioning against stale or absent markup
   * would clamp to the wrong width on the very first open.
   * @param {DOMRect} rect bounding rect of the current selection.
   * @returns {void}
   */
  function openPopover(rect) {
    renderPopover()
    position(ensurePopover(), rect)
  }

  const api = {
    state,
    showButton,
    hideButton,
    openPopover,
    closePopover,
    renderPopover,
  }

  window.AiRewrite.render = api

  if (typeof module !== 'undefined' && module.exports) module.exports = api
})()
