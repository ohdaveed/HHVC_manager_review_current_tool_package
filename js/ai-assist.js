/* AI assist: orchestrator. Wires events, owns the request lifecycle, and
   publishes the mount hook the workspace tab calls. Thin by design — the
   client lives in js/ai-assist-client.js and the rendering in
   js/ai-assist-render.js, mirroring the ux-improvements / review-queue /
   interactive-sitemap split.

   Loads after js/ai-assist-render.js. May load after js/ux-improvements.js,
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
    if (typeof showToast === 'function') showToast(message, type)
  }

  /**
   * The page open in the mockup, sent as grounding when the box is ticked.
   * @returns {object|null}
   */
  function getCurrentPage() {
    const key = window.utils?.getCurrentKey?.()
    return (window.HHVC_DATA?.pages || {})[key] || null
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
    state.capabilities = result.ok ? result.capabilities : null
    state.error = result.ok ? '' : result.error
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
      signal: controller.signal,
    })

    state.busy = false
    controller = null
    state.status = ''

    if (!response.ok) {
      state.error = response.error
      render.renderPanel()
      toast(response.error, 'warn')
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

  /** @returns {void} */
  function handleCopyJson() {
    if (!state.result) return
    const copy = window.ReviewUx?.exportImport?.copyText
    if (typeof copy !== 'function') return
    copy(JSON.stringify(state.result.result, null, 2))
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
