// Unit tests for js/ai/ai-assist-client.js's configuration and HTTP surface.
//
// This file exists because of a coverage asymmetry, not because the code
// looked untested. js/ai/ai-assist-client.js and js/sync/review-state-sync.js were
// written from one another and carry five near-identical functions —
// readConfig, writeConfig, isConfigured, assertEndpointUnchanged and
// apiFetch. Only the sync copy had tests: assertEndpointUnchanged was
// exercised solely by tests/review-state-sync.test.js, and apiFetch,
// readConfig and writeConfig by nothing at all. So the most similar pair in
// the repo was also the least covered, and an edit to one copy could not
// fail CI.
//
// assertEndpointUnchanged in particular is not boilerplate. It rejects a
// response that outlived its configuration: without it, a request sent to
// endpoint X that lands after the reviewer saved endpoint Y is applied as
// though Y had answered, attributing one deployment's output to another. The
// sync client's version of that bug is worse still (it re-mints a synced_at
// baseline under the wrong server), which is why that one got the test and
// this one did not — but the two are the same mechanism and both need
// pinning.
//
// The globals stubbed here (window, localStorage, fetch) are saved and
// restored per test. bun:test runs every file in one process, and
// tests/review-api-server.test.js makes real fetch() calls against a spawned
// server — a leaked stub is what once made every request in that file return
// this kind of mock.
const { describe, test, expect, beforeEach, afterEach } = require('bun:test')
const path = require('path')

const MODULE_PATH = path.resolve(__dirname, '../js/ai/ai-assist-client.js')

let originalFetch
let originalWindow
let originalLocalStorage

beforeEach(() => {
  originalFetch = global.fetch
  originalWindow = global.window
  originalLocalStorage = global.localStorage
})

afterEach(() => {
  global.fetch = originalFetch
  global.window = originalWindow
  global.localStorage = originalLocalStorage
  delete require.cache[MODULE_PATH]
})

/**
 * Mount js/ai/ai-assist-client.js against a fake window/localStorage, mirroring
 * loadReviewStateSync() in tests/review-state-sync.test.js.
 * @param {{stored?: string|null}} [options] `stored` is the RAW string the
 *   hhvcAiConfig key holds — a string rather than an object so a malformed
 *   blob can be tested, which is the case readConfig's try/catch exists for.
 * @returns {{mod: object, store: Map<string, string>, banners: string[]}}
 */
function loadAiAssistClient({ stored = null } = {}) {
  const store = new Map()
  if (stored !== null) store.set('hhvcAiConfig', stored)

  const banners = []
  global.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  }
  global.window = {
    utils: { showErrorBanner: (message) => banners.push(message) },
  }

  delete require.cache[MODULE_PATH]
  return { mod: require(MODULE_PATH), store, banners }
}

/**
 * @param {object} config
 * @returns {string}
 */
function storedConfig(config) {
  return JSON.stringify(config)
}

describe('readConfig', () => {
  test('returns empty strings when nothing has been saved', () => {
    // Unlike the sync client, there is deliberately NO default URL here: a
    // sync deployment is baked into the bundle, an AI endpoint is not.
    const { mod } = loadAiAssistClient()
    expect(mod.readConfig()).toEqual({ apiUrl: '', apiToken: '' })
  })

  test('returns the saved URL and token', () => {
    const { mod } = loadAiAssistClient({
      stored: storedConfig({ apiUrl: 'https://ai.example.test', apiToken: 'secret-token' }),
    })
    expect(mod.readConfig()).toEqual({
      apiUrl: 'https://ai.example.test',
      apiToken: 'secret-token',
    })
  })

  test('falls back to empty strings on a malformed blob rather than throwing', () => {
    // A throw here would take down every caller, including isConfigured,
    // which every entry point gates on.
    const { mod } = loadAiAssistClient({ stored: '{not json' })
    expect(mod.readConfig()).toEqual({ apiUrl: '', apiToken: '' })
  })

  test('coerces a non-string field to an empty string', () => {
    const { mod } = loadAiAssistClient({ stored: storedConfig({ apiUrl: 42, apiToken: null }) })
    expect(mod.readConfig()).toEqual({ apiUrl: '', apiToken: '' })
  })

  test('reads its own storage key, never the shared review-state blob', () => {
    // The separation is a security property: hhvcManagerReviewState:v1
    // round-trips through the shareable CSV/JSON export files, so a token
    // stored there would leak through a backup a reviewer emails on.
    const { mod } = loadAiAssistClient()
    expect(mod.CONFIG_KEY).toBe('hhvcAiConfig')
    expect(mod.CONFIG_KEY).not.toBe('hhvcManagerReviewState:v1')
  })
})

describe('writeConfig', () => {
  test('saves trimmed values under the AI config key and reports success', () => {
    const { mod, store } = loadAiAssistClient()
    expect(mod.writeConfig({ apiUrl: '  https://ai.example.test  ', apiToken: ' tok ' })).toBe(true)
    expect(JSON.parse(store.get('hhvcAiConfig'))).toEqual({
      apiUrl: 'https://ai.example.test',
      apiToken: 'tok',
    })
  })

  test('treats missing fields as empty rather than writing undefined', () => {
    const { mod, store } = loadAiAssistClient()
    expect(mod.writeConfig({})).toBe(true)
    expect(JSON.parse(store.get('hhvcAiConfig'))).toEqual({ apiUrl: '', apiToken: '' })
  })

  test('returns false and shows the error banner when storage refuses the write', () => {
    // The return value is the whole point: localStorage.setItem throws on a
    // disabled or exhausted store, and a caller that assumed success would
    // report saved settings the next reload does not have.
    const { mod, banners } = loadAiAssistClient()
    global.localStorage.setItem = () => {
      throw new Error('QuotaExceededError')
    }
    expect(mod.writeConfig({ apiUrl: 'https://ai.example.test', apiToken: 'tok' })).toBe(false)
    expect(banners).toEqual(['Could not save AI settings in this browser.'])
  })

  test('does NOT clear review-state sync baselines, unlike the sync client', () => {
    // js/sync/review-state-sync.js's writeConfig clears synced_at and deletes
    // local_dirty on an endpoint change, because those only mean something
    // relative to the deployment that issued them. Nothing here is
    // reconciled against server state, so there is nothing to clear — and
    // this client must not reach into review state to do it anyway. Pinned
    // because the two functions are otherwise near-identical, which is
    // exactly the condition under which the sync copy's extra behaviour gets
    // "helpfully" copied across.
    const { mod } = loadAiAssistClient({
      stored: storedConfig({ apiUrl: 'https://old.example.test', apiToken: 'tok' }),
    })
    let reviewStateTouched = false
    global.window.reviewState = {
      read: () => {
        reviewStateTouched = true
        return { pages: {} }
      },
      update: () => {
        reviewStateTouched = true
      },
    }
    mod.writeConfig({ apiUrl: 'https://new.example.test', apiToken: 'tok' })
    expect(reviewStateTouched).toBe(false)
  })
})

describe('isConfigured', () => {
  test('is false with nothing saved', () => {
    expect(loadAiAssistClient().mod.isConfigured()).toBe(false)
  })

  test('is false with a URL but no token', () => {
    // The token is what stays manual — this file ships in a public static
    // bundle, so a default token would be extractable by any visitor.
    const { mod } = loadAiAssistClient({
      stored: storedConfig({ apiUrl: 'https://ai.example.test', apiToken: '' }),
    })
    expect(mod.isConfigured()).toBe(false)
  })

  test('is false with a token but no URL', () => {
    const { mod } = loadAiAssistClient({ stored: storedConfig({ apiUrl: '', apiToken: 'tok' }) })
    expect(mod.isConfigured()).toBe(false)
  })

  test('is true only when both are present', () => {
    const { mod } = loadAiAssistClient({
      stored: storedConfig({ apiUrl: 'https://ai.example.test', apiToken: 'tok' }),
    })
    expect(mod.isConfigured()).toBe(true)
  })
})

describe('assertEndpointUnchanged', () => {
  test('returns quietly when the endpoint is still the one the request used', () => {
    const { mod } = loadAiAssistClient({
      stored: storedConfig({ apiUrl: 'https://ai.example.test', apiToken: 'tok' }),
    })
    expect(() => mod.assertEndpointUnchanged('https://ai.example.test')).not.toThrow()
  })

  test('throws when the reviewer saved a different endpoint mid-request', () => {
    // The failure this prevents: a response from server X applied under
    // server Y's settings, attributing one deployment's generated content to
    // another in the panel's meta line and in the downloaded page module.
    const { mod } = loadAiAssistClient({
      stored: storedConfig({ apiUrl: 'https://ai.example.test', apiToken: 'tok' }),
    })
    mod.writeConfig({ apiUrl: 'https://other.example.test', apiToken: 'tok' })
    expect(() => mod.assertEndpointUnchanged('https://ai.example.test')).toThrow(
      'AI settings changed during this request — try again.'
    )
  })

  test('throws when the settings were cleared mid-request', () => {
    // Cleared is a change like any other. Reading '' as "no opinion" would
    // let the response through under settings that no longer exist.
    const { mod } = loadAiAssistClient({
      stored: storedConfig({ apiUrl: 'https://ai.example.test', apiToken: 'tok' }),
    })
    mod.writeConfig({ apiUrl: '', apiToken: '' })
    expect(() => mod.assertEndpointUnchanged('https://ai.example.test')).toThrow()
  })

  test('compares the URL only, so a token change alone is not a changed endpoint', () => {
    // Rotating a token does not make an in-flight response foreign content.
    const { mod } = loadAiAssistClient({
      stored: storedConfig({ apiUrl: 'https://ai.example.test', apiToken: 'tok' }),
    })
    mod.writeConfig({ apiUrl: 'https://ai.example.test', apiToken: 'rotated' })
    expect(() => mod.assertEndpointUnchanged('https://ai.example.test')).not.toThrow()
  })
})

describe('apiFetch', () => {
  /**
   * Capture the single fetch call apiFetch makes.
   * @param {object} [response]
   * @returns {{calls: Array<{url: string, options: object}>}}
   */
  function captureFetch(response = { ok: true, status: 200 }) {
    const calls = []
    global.fetch = async (url, options) => {
      calls.push({ url, options })
      return response
    }
    return { calls }
  }

  test('rejects without touching the network when nothing is configured', async () => {
    const { mod } = loadAiAssistClient()
    const { calls } = captureFetch()
    await expect(mod.apiFetch('/api/ai/capabilities')).rejects.toThrow(
      'AI assist is not configured.'
    )
    expect(calls).toHaveLength(0)
  })

  test('rejects when the URL is set but the token is not', async () => {
    const { mod } = loadAiAssistClient({
      stored: storedConfig({ apiUrl: 'https://ai.example.test', apiToken: '' }),
    })
    const { calls } = captureFetch()
    await expect(mod.apiFetch('/api/ai/capabilities')).rejects.toThrow(
      'AI assist is not configured.'
    )
    expect(calls).toHaveLength(0)
  })

  test('sends the bearer token and JSON content type', async () => {
    const { mod } = loadAiAssistClient({
      stored: storedConfig({ apiUrl: 'https://ai.example.test', apiToken: 'tok' }),
    })
    const { calls } = captureFetch()
    await mod.apiFetch('/api/ai/capabilities', { method: 'GET' })
    expect(calls[0].url).toBe('https://ai.example.test/api/ai/capabilities')
    expect(calls[0].options.headers.authorization).toBe('Bearer tok')
    expect(calls[0].options.headers['content-type']).toBe('application/json')
    expect(calls[0].options.method).toBe('GET')
  })

  test('strips trailing slashes off the configured URL before joining the path', async () => {
    // Without this a reviewer pasting the URL with a trailing slash gets
    // //api/ai/… , which some servers 404 and some silently redirect.
    const { mod } = loadAiAssistClient({
      stored: storedConfig({ apiUrl: 'https://ai.example.test///', apiToken: 'tok' }),
    })
    const { calls } = captureFetch()
    await mod.apiFetch('/api/ai/models')
    expect(calls[0].url).toBe('https://ai.example.test/api/ai/models')
  })

  test('does not let a caller override the authorization header', async () => {
    // The spread order is what guarantees this: caller headers first, then
    // authorization/content-type. A caller-supplied auth header would defeat
    // the one place the token is attached.
    const { mod } = loadAiAssistClient({
      stored: storedConfig({ apiUrl: 'https://ai.example.test', apiToken: 'tok' }),
    })
    const { calls } = captureFetch()
    await mod.apiFetch('/api/ai/generate', { headers: { authorization: 'Bearer attacker' } })
    expect(calls[0].options.headers.authorization).toBe('Bearer tok')
  })

  test('passes an AbortSignal that a caller-supplied signal can abort', async () => {
    const { mod } = loadAiAssistClient({
      stored: storedConfig({ apiUrl: 'https://ai.example.test', apiToken: 'tok' }),
    })
    const { calls } = captureFetch()
    const controller = new AbortController()
    await mod.apiFetch('/api/ai/generate', { signal: controller.signal })
    const forwarded = calls[0].options.signal
    expect(forwarded).toBeInstanceOf(AbortSignal)
    // The caller's own signal is NOT forwarded directly — the timeout has to
    // be able to abort too, so the two are combined into a new controller.
    expect(forwarded).not.toBe(controller.signal)
    expect(forwarded.aborted).toBe(false)
    controller.abort()
    expect(forwarded.aborted).toBe(true)
  })

  test('forwards an already-aborted caller signal without waiting for an abort event', async () => {
    // addEventListener on an already-aborted signal never fires, so the
    // aborted case has to be checked up front or a cancelled request would
    // still be issued live.
    const { mod } = loadAiAssistClient({
      stored: storedConfig({ apiUrl: 'https://ai.example.test', apiToken: 'tok' }),
    })
    const { calls } = captureFetch()
    const controller = new AbortController()
    controller.abort()
    await mod.apiFetch('/api/ai/generate', { signal: controller.signal })
    expect(calls[0].options.signal.aborted).toBe(true)
  })

  test('uses a generation-length timeout, far longer than the sync client', () => {
    // 15s (the sync client's value) would abort almost every real
    // generation: the model runs at high effort and may retry once after
    // validation. Pinned as a number rather than described in a comment
    // because the two clients are otherwise near-identical here.
    const { mod } = loadAiAssistClient()
    expect(mod.API_TIMEOUT_MS).toBe(180000)
  })
})

describe('describeFailure', () => {
  test('prefers the server own JSON error message', async () => {
    const { mod } = loadAiAssistClient()
    const message = await mod.describeFailure({
      status: 400,
      json: async () => ({ error: 'Unknown provider "gemni".' }),
    })
    expect(message).toBe('Unknown provider "gemni".')
  })

  test('names the token on a 401 with no JSON body', async () => {
    const { mod } = loadAiAssistClient()
    const message = await mod.describeFailure({
      status: 401,
      json: async () => {
        throw new Error('not JSON')
      },
    })
    expect(message).toBe('Unauthorized — check the AI token.')
  })

  test('names the URL on a 404 with no JSON body', async () => {
    // A misconfigured URL can land on something that is not this API at all,
    // so the body may not be JSON — throwing a parse error over the real
    // problem is what this fallback prevents.
    const { mod } = loadAiAssistClient()
    const message = await mod.describeFailure({
      status: 404,
      json: async () => {
        throw new Error('not JSON')
      },
    })
    expect(message).toBe('Not found — check the server URL.')
  })

  test('falls back to the bare status for anything else', async () => {
    const { mod } = loadAiAssistClient()
    const message = await mod.describeFailure({
      status: 503,
      json: async () => ({ notAnError: true }),
    })
    expect(message).toBe('Request failed (503).')
  })
})
