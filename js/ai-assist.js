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

  function toast(message, type) {
    // Reads window.showToast rather than a bare `showToast`. The bare form
    // does work — an undeclared identifier resolves through the scope chain to
    // the global object, where js/ui-controls.js publishes it, and the bundler
    // hoists both modules into one scope anyway — and a review flagged it as
    // dead only for the guard to pass when actually tested (see "saving AI
    // settings shows a confirmation toast" in tests/e2e/ai-assist.spec.js).
    // It is spelled out explicitly because that is the pattern every other
    // self-mounting layer uses (js/review-queue-state.js,
    // js/ux-improvements-workspace.js), and because a global that only works
    // by scope-chain fallback is worth not making anyone re-derive.
    window.showToast?.(message, type)
  }

  /** The page open in the mockup, sent as grounding when the box is ticked. */
  function getCurrentPage() {
    const key = window.utils?.getCurrentKey?.()
    return (window.HHVC_DATA?.pages || {})[key] || null
  }

  /** Ask the server what it supports, then re-render whatever that implies. */
  async function refreshCapabilities() {
    if (!client.isConfigured()) {
      state.capabilities = null
      render.renderPanel()
      return
    }
    const result = await client.fetchCapabilities()
    state.capabilities = result.ok ? result.capabilities : null
    state.error = result.ok ? '' : result.error
    render.renderPanel()
  }

  async function handleGenerate() {
    if (state.busy) return
    const promptField = document.getElementById('aiAssistPrompt')
    const prompt = (promptField?.value || '').trim()
    if (!prompt) {
      state.error = 'Describe what the draft should cover first.'
      render.renderPanel()
      return
    }

    const includePage = document.getElementById('aiAssistIncludePage')?.checked
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

  function handleSaveSettings() {
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

  function handleCopyJson() {
    if (!state.result) return
    const copy = window.ReviewUx?.exportImport?.copyText
    if (typeof copy !== 'function') return
    copy(JSON.stringify(state.result.result, null, 2))
  }

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

  /** Called by setWorkspaceTab the first time the AI assist tab opens. */
  function ensureRendered() {
    if (!mounted) {
      mounted = true
      render.renderPanel()
      refreshCapabilities()
      return
    }
    render.renderPanel()
  }

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
  }
})()
