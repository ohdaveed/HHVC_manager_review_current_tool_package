/* AI assist: orchestrator. Wires events, owns the request lifecycle, and
   publishes the mount hook the workspace tab calls. Thin by design — the
   client lives in js/ai/ai-assist-client.js and the rendering in
   js/ai/ai-assist-render.js, mirroring the ux-improvements / review-queue /
   review-queue split.

   Loads after js/ai/ai-assist-render.js. May load after js/review/ux-improvements.js,
   because setWorkspaceTab calls the mount hook through optional chaining at
   tab-open time rather than at init. */
;(function mountAiAssist() {
  if (typeof window === 'undefined') return
  if (!window.AiAssist?.client || !window.AiAssist?.render) return

  const client = window.AiAssist.client
  const render = window.AiAssist.render
  const state = render.state

  let mounted = false
  /** In-flight generation, so Cancel has something to abort. */
  let controller = null
  /**
   * Monotonic stamp for capability requests. Saving settings twice puts two
   * GETs in flight with no ordering guarantee, and the older one finishing
   * last would overwrite the newer server's capabilities with its own — quite
   * possibly a `null` from an endpoint-changed error, leaving the panel
   * disabled for a server that is actually fine. Only the newest request may
   * write state.
   */
  let capabilitiesGeneration = 0

  /**
   * @param {string} message
   * @param {string} [type]
   * @returns {void}
   */
  function toast(message, type) {
    // Reads window.showToast rather than a bare `showToast`. The bare form
    // does work — an undeclared identifier resolves through the scope chain to
    // the global object, where js/review/ui-controls.js publishes it, and the bundler
    // hoists both modules into one scope anyway — and a review flagged it as
    // dead only for the guard to pass when actually tested (see "saving AI
    // settings shows a confirmation toast" in tests/e2e/ai-assist.spec.js).
    // It is spelled out explicitly because that is the pattern every other
    // self-mounting layer uses (js/review/review-queue-state.js,
    // js/review/ux-improvements-workspace.js), and because a global that only works
    // by scope-chain fallback is worth not making anyone re-derive.
    window.showToast?.(message, type)
  }

  /**
   * The page open in the mockup, sent as grounding when the box is ticked.
   *
   * Delegates to js/core/utils.js rather than carrying its own copy: js/ai/ai-rewrite.js
   * needs the same lookup and the two IIFEs share no namespace, so two copies
   * had nothing stopping the next edit from landing on only one. Reached through
   * `window` rather than an import, so it stays optional-chained.
   * @returns {object|null}
   */
  function getCurrentPage() {
    return window.utils?.getCurrentPage?.() || null
  }

  /**
   * Copy the form's live values into panel state.
   *
   * renderPanel replaces the whole panel, so anything typed but not mirrored
   * here is gone on the next render. Called before every state change that
   * triggers one.
   * @returns {void}
   */
  function captureForm() {
    const promptField = document.getElementById('aiAssistPrompt')
    if (promptField) state.prompt = promptField.value || ''
    const includeField = document.getElementById('aiAssistIncludePage')
    if (includeField) state.includePage = Boolean(includeField.checked)
    // Absent whenever fewer than two providers are configured, which is why
    // this is a guarded read rather than an assignment: blanking state.provider
    // on a single-provider server would be harmless today (the server falls
    // back to its default) but would silently discard a pick the moment a
    // second key is added and the picker appears mid-session.
    const providerField = document.getElementById('aiAssistProvider')
    if (providerField) state.provider = providerField.value || ''
  }

  /**
   * Ask the server what it supports, then re-render whatever that implies.
   * @returns {Promise<void>}
   */
  async function refreshCapabilities() {
    const generation = ++capabilitiesGeneration
    if (!client.isConfigured()) {
      state.capabilities = null
      render.renderPanel()
      return
    }
    const result = await client.fetchCapabilities()
    // A later refresh started while this one was in flight, so this answer is
    // about a server the panel has already moved on from. Dropping it is
    // always safe: the newer request writes the state that matters.
    if (generation !== capabilitiesGeneration) return
    // Re-capture immediately before rendering, not just at the call site. The
    // reviewer can type through the whole await — a capability GET is a real
    // round trip — and the render below replaces the textarea with
    // `state.prompt`. Capturing only when Save was clicked silently discards
    // everything typed since.
    captureForm()
    state.capabilities = result.ok ? result.capabilities : null
    state.error = result.ok ? '' : result.error
    // After capabilities, before the render that draws the picker from them. A
    // selection made against another deployment (or against this one before a
    // key was removed) would otherwise be sent verbatim and earn a 400 for a
    // choice the reviewer never consciously made.
    render.reconcileProvider()
    render.renderPanel()
  }

  /** @returns {Promise<void>} */
  async function handleGenerate() {
    if (state.busy) return
    captureForm()
    const prompt = state.prompt.trim()
    if (!prompt) {
      state.error = 'Describe what the draft should cover first.'
      render.renderPanel()
      return
    }

    const includePage = state.includePage
    controller = new AbortController()
    state.busy = true
    state.error = ''
    state.result = null
    state.status = 'Generating. This can take a minute at high effort.'
    render.renderPanel()

    const response = await client.generate({
      task: 'content',
      prompt,
      page: includePage ? getCurrentPage() : undefined,
      provider: state.provider,
      signal: controller.signal,
    })

    state.busy = false
    controller = null
    state.status = ''

    if (!response.ok) {
      state.error = response.error
      render.renderPanel()
      toast(response.error, 'warn')
      // A 400 from this route means the server rejected the PROVIDER, not the
      // prompt — the only 400 generate can produce past client-side validation
      // is UnknownProviderError (a schema rejection needs a body this panel
      // cannot construct). That happens when the server's keys changed after
      // the panel last read capabilities: a Claude-only deployment becoming
      // Gemini-only leaves `state.provider` pinned to a provider that no longer
      // exists, and every retry sends the same dead choice.
      //
      // Re-reading capabilities is the fix because refreshCapabilities() calls
      // reconcileProvider(), which drops a selection the server no longer
      // offers. Without this the reviewer had to reload the page or re-save
      // otherwise-unchanged settings to escape — neither of which the failure
      // message suggests. Deliberately narrowed to 400: refreshing on every
      // failure would fire a capability GET after each network blip.
      if (response.status === 400) refreshCapabilities()
      return
    }

    state.result = response.result
    render.renderPanel()
    toast(
      response.result.valid
        ? 'Draft ready and passing every check.'
        : `Draft ready with ${response.result.issues.length} issue(s) to review.`,
      response.result.valid ? 'success' : 'warn'
    )
  }

  /** @returns {void} */
  function handleSaveSettings() {
    captureForm()
    const apiUrl = document.getElementById('aiAssistApiUrl')?.value || ''
    const apiToken = document.getElementById('aiAssistApiToken')?.value || ''
    if (!client.writeConfig({ apiUrl, apiToken })) return
    // A saved draft came from the previous endpoint, so it is not this
    // server's output any more. Drop it rather than leave it attributed to a
    // server that never produced it.
    state.result = null
    state.error = ''
    toast(client.isConfigured() ? 'AI settings saved.' : 'AI settings cleared.', 'success')
    refreshCapabilities()
  }

  /**
   * Copy the same artifact handleDownload() writes, disclosure included.
   *
   * This used to serialize `state.result.result` alone, which dropped the
   * sibling `disclosure` field and let a draft leave the panel with no label on
   * it — the one thing standards manual §1.11 and SF.gov's AI guidelines both
   * require to travel with generated content. Copy and Download now emit byte-
   * identical output, so there is one artifact to reason about rather than two
   * that disagree about disclosure.
   */
  function handleCopyJson() {
    if (!state.result) return
    const copy = window.ReviewUx?.exportImport?.copyText
    if (typeof copy !== 'function') return
    copy(render.buildPageModuleSource(state.result.result, state.result.disclosure || ''))
  }

  /** @returns {void} */
  function handleDownload() {
    if (!state.result) return
    const page = state.result.result
    const key = render.pageKeyFromSlug(page.slug)
    window.utils?.downloadFile?.(
      `${key}.js`,
      render.buildPageModuleSource(page, state.result.disclosure || ''),
      'text/javascript'
    )
    toast('Downloaded. Nothing was written to this repository.', 'success')
  }

  /**
   * One delegated listener on document, bound at init. The panel does not
   * exist until the tab is first opened, so binding per-element would have to
   * be redone after every re-render.
   * @param {Event} event
   * @returns {void}
   */
  function handleClick(event) {
    const target = event.target
    if (!(target instanceof Element)) return
    if (target.closest('#aiAssistSaveSettings')) return handleSaveSettings()
    if (target.closest('#aiAssistGenerate')) return handleGenerate()
    if (target.closest('#aiAssistCancel')) return controller?.abort()
    if (target.closest('#aiAssistCopyJson')) return handleCopyJson()
    if (target.closest('#aiAssistDownload')) return handleDownload()
    return undefined
  }

  /**
   * Called by setWorkspaceTab the first time the AI assist tab opens.
   * @returns {void}
   */
  function ensureRendered() {
    if (!mounted) {
      mounted = true
      render.renderPanel()
      refreshCapabilities()
      return
    }
    // Re-opening the tab re-renders, which would blank an unsent prompt.
    captureForm()
    render.renderPanel()
  }

  /** @returns {void} */
  function init() {
    document.addEventListener('click', handleClick)
    window.__mountAiAssistOnTabOpen = ensureRendered
    // Catch a tab that is ALREADY open at init time — see
    // mountWorkspacePanelIfOpen in js/core/utils.js for why every lazy panel needs
    // this, and why panel visibility is the signal rather than saved state.
    // 'help', not 'assist': this panel no longer has a tab of its own — it is a
    // collapsed section inside Help, so Help being open is what means "already
    // on screen" at init time.
    window.utils.mountWorkspacePanelIfOpen('help', ensureRendered)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }

  window.aiAssist = {
    ensureRendered,
    refreshCapabilities,
    getCurrentPage,
    captureForm,
  }
})()
