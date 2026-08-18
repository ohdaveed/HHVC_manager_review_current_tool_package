/* AI assist: browser-side client for the optional /api/ai/* routes on
   server.ts. Attaches to window.AiAssist.client; the orchestrator in
   js/ai-assist.js assembles the public API. Loads before js/ai-assist.js.

   Every function here is a no-op unless a server URL and token are configured,
   so the tool keeps working exactly as it did before this file existed. This
   is the same shape js/sync/review-state-sync.js uses for the sync backend, with
   two deliberate differences noted at readConfig and apiFetch. */
;(function mountAiAssistClient() {
  if (typeof window === 'undefined') return

  const CONFIG_KEY = 'hhvcAiConfig'

  // Far longer than the sync client's 15s. A generation runs the model at high
  // effort and may retry once after validation, so 15s would abort almost
  // every real request. fetch() has no default timeout, so without this a hung
  // server leaves the panel stuck on "Generating…" forever.
  const API_TIMEOUT_MS = 180000

  /**
   * Settings live in their own localStorage key, deliberately separate from
   * hhvcManagerReviewState:v1 — that blob round-trips through the CSV/JSON
   * export/import/backup paths, which are meant to be shareable files, so a
   * token must never be able to leak through them. Same reasoning, and the
   * same separation, as js/sync/review-state-sync.js's hhvcReviewSyncConfig.
   *
   * Unlike the sync config there is no synced_at/local_dirty bookkeeping to
   * clear when the endpoint changes: nothing here is reconciled against server
   * state, so switching servers has no consequence beyond the next request
   * going somewhere else.
   * @returns {{apiUrl: string, apiToken: string}}
   */
  function readConfig() {
    try {
      const raw = localStorage.getItem(CONFIG_KEY)
      if (!raw) return { apiUrl: '', apiToken: '' }
      const parsed = JSON.parse(raw)
      return {
        apiUrl: typeof parsed.apiUrl === 'string' ? parsed.apiUrl : '',
        apiToken: typeof parsed.apiToken === 'string' ? parsed.apiToken : '',
      }
    } catch {
      return { apiUrl: '', apiToken: '' }
    }
  }

  /**
   * @param {{apiUrl?: string, apiToken?: string}} config
   * @returns {boolean} whether the write succeeded
   */
  function writeConfig(config) {
    try {
      localStorage.setItem(
        CONFIG_KEY,
        JSON.stringify({
          apiUrl: (config.apiUrl || '').trim(),
          apiToken: (config.apiToken || '').trim(),
        })
      )
      return true
    } catch {
      window.utils?.showErrorBanner?.('Could not save AI settings in this browser.')
      return false
    }
  }

  /** @returns {boolean} */
  function isConfigured() {
    const config = readConfig()
    return Boolean(config.apiUrl && config.apiToken)
  }

  /**
   * Throw if the configured endpoint changed while a request was in flight.
   * Applying a response from a server the reviewer has since navigated away
   * from would attribute one deployment's output to another.
   * @param {string} requestApiUrl
   * @returns {void}
   */
  function assertEndpointUnchanged(requestApiUrl) {
    if (readConfig().apiUrl !== requestApiUrl) {
      throw new Error('AI settings changed during this request — try again.')
    }
  }

  /**
   * @param {string} path
   * @param {RequestInit} [options]
   * @returns {Promise<Response>}
   */
  function apiFetch(path, options = {}) {
    const config = readConfig()
    if (!config.apiUrl || !config.apiToken) {
      return Promise.reject(new Error('AI assist is not configured.'))
    }
    const base = config.apiUrl.replace(/\/+$/, '')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS)
    if (options.signal) {
      if (options.signal.aborted) controller.abort()
      else options.signal.addEventListener('abort', () => controller.abort(), { once: true })
    }

    return fetch(base + path, {
      ...options,
      signal: controller.signal,
      headers: {
        ...(options.headers || {}),
        authorization: `Bearer ${config.apiToken}`,
        'content-type': 'application/json',
      },
    }).finally(() => clearTimeout(timeoutId))
  }

  /**
   * Turn a non-OK response into the clearest message available.
   *
   * The server sends a JSON `error` for every failure it generates itself, but
   * a misconfigured URL can land on something that is not this API at all, so
   * the body may not be JSON. Fall back to the status rather than throwing a
   * parse error over the real problem.
   * @param {Response} response
   * @returns {Promise<string>}
   */
  async function describeFailure(response) {
    let body = null
    try {
      body = await response.json()
    } catch {
      // Not JSON. The status line is all we have.
    }
    if (body && typeof body.error === 'string') return body.error
    if (response.status === 401) return 'Unauthorized — check the AI token.'
    if (response.status === 404) return 'Not found — check the server URL.'
    return `Request failed (${response.status}).`
  }

  /**
   * Ask the server what it can do. Answers even when the server has no model
   * key, which is exactly how the panel tells "no AI configured" apart from
   * "no server reachable".
   * @returns {Promise<{ok: boolean, capabilities?: object, error?: string}>}
   */
  async function fetchCapabilities() {
    if (!isConfigured()) return { ok: false, error: 'AI assist is not configured.' }
    const requestApiUrl = readConfig().apiUrl
    try {
      const response = await apiFetch('/api/ai/capabilities', { method: 'GET' })
      assertEndpointUnchanged(requestApiUrl)
      if (!response.ok) return { ok: false, error: await describeFailure(response) }
      return { ok: true, capabilities: await response.json() }
    } catch (error) {
      return { ok: false, error: error?.message || 'Could not reach the AI server.' }
    }
  }

  /**
   * Generate a draft.
   *
   * `provider` is omitted from the body when empty rather than sent as `''`.
   * The server reads a missing provider as "use this deployment's default",
   * which is what a single-provider server should do and what every caller did
   * before the picker existed; an empty string would fail the enum instead.
   * @param {{task: string, prompt?: string, fieldText?: string,
   *   instruction?: string, page?: object, provider?: string,
   *   signal?: AbortSignal}} request `prompt` belongs to the `content` task;
   *   `fieldText` (required) and `instruction` (optional) to `rewrite-field`.
   * @returns {Promise<{ok: boolean, result?: object, error?: string, status?: number}>}
   */
  async function generate({ task, prompt, fieldText, instruction, page, provider, signal }) {
    if (!isConfigured()) return { ok: false, error: 'AI assist is not configured.' }
    const requestApiUrl = readConfig().apiUrl
    try {
      const response = await apiFetch('/api/ai/generate', {
        method: 'POST',
        signal,
        body: JSON.stringify({
          task,
          // The server's request schema is a discriminated union on `task`:
          // `content` carries a prompt, `rewrite-field` carries the field text
          // instead and declares no prompt at all. This branch OMITS the other
          // task's field rather than sending it empty — an empty `prompt`
          // would fail min(1) exactly as a missing one does, so sending `''`
          // buys nothing and only muddies which task the body describes.
          ...(task === 'rewrite-field'
            ? { fieldText, ...(instruction ? { instruction } : {}) }
            : { prompt }),
          ...(page ? { page } : {}),
          ...(provider ? { provider } : {}),
        }),
      })
      assertEndpointUnchanged(requestApiUrl)
      if (!response.ok) {
        // `status` rides along with the message. Reducing a failure to its
        // error string throws away the one thing that distinguishes a
        // recoverable "your provider choice is stale" 400 from a network
        // problem, and the caller then has no basis for deciding whether
        // re-reading capabilities would help.
        return { ok: false, status: response.status, error: await describeFailure(response) }
      }
      return { ok: true, result: await response.json() }
    } catch (error) {
      if (error?.name === 'AbortError') return { ok: false, error: 'Generation cancelled.' }
      return { ok: false, error: error?.message || 'The AI request failed.' }
    }
  }

  const api = {
    CONFIG_KEY,
    API_TIMEOUT_MS,
    readConfig,
    writeConfig,
    isConfigured,
    assertEndpointUnchanged,
    apiFetch,
    describeFailure,
    fetchCapabilities,
    generate,
  }

  window.AiAssist = window.AiAssist || {}
  window.AiAssist.client = api

  // Dual export so the client logic is unit-testable in Bun without a DOM,
  // matching js/review-merge.js and js/standards/plain-language.js.
  if (typeof module !== 'undefined' && module.exports) module.exports = api
})()
