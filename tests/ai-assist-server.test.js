// Integration tests for the optional /api/ai/* routes added to server.ts.
//
// Spawns the real server as a subprocess, exactly like
// tests/review-api-server.test.js, and points its ANTHROPIC_BASE_URL at a stub
// Anthropic endpoint running in this process. That gives full coverage of the
// gates, the validate-and-retry loop, and the error mapping without a real API
// key — and keeps the suite runnable in CI, which has no credentials and must
// never make a paid call.
//
// The stub is a plain Bun.serve whose next response each test sets directly,
// so a test can say "return an invalid page, then a valid one" and assert the
// retry actually happened.
const { describe, test, expect, beforeAll, afterAll, beforeEach } = require('bun:test')
const path = require('path')
const os = require('os')
const fs = require('fs')

const ROOT = path.resolve(__dirname, '..')

const PORT = 8131
const STUB_PORT = 8132
const TOKEN = 'test-ai-api-token'
const base = `http://127.0.0.1:${PORT}`

/** A page object that satisfies the schema, the invariants, and the scorer. */
const VALID_PAGE = {
  slug: 'sf.gov/report-a-pest-problem',
  type: 'Information',
  title: 'Report a pest problem',
  summary: 'Tell us about pests in your home. We will send an inspector.',
  audience: ['A tenant who sees pests at home'],
  reading: 'Grade 6',
  sections: [
    {
      heading: 'What to do',
      karl: 'what_to_do StreamField. One Section block per step.',
      paragraphs: ['Call 311 to report the problem.', 'We will send an inspector.'],
    },
  ],
}

/** Same page, but with 3 paragraphs — a hard list-format invariant failure. */
const INVALID_PAGE = {
  ...VALID_PAGE,
  sections: [
    {
      heading: 'What to do',
      karl: 'what_to_do StreamField.',
      paragraphs: ['Call 311 now.', 'We send an inspector.', 'You get a result.'],
    },
  ],
}

/** Mutable stub state, reset per test. */
const stub = {
  /** Queue of responses; each request shifts one off. */
  queue: [],
  /**
   * A response returned for EVERY request, ignoring the queue. Needed to model
   * a persistently failing upstream: the SDK retries 429s and 5xxs on its own
   * (max_retries defaults to 2), so a single queued error is followed by
   * whatever comes next and the call quietly succeeds. Expressing "the upstream
   * is down" this way keeps the test from encoding the SDK's retry count.
   */
  always: null,
  /** Every request body the stub received. */
  requests: [],
}

function messageResponse(object) {
  return {
    id: 'msg_stub',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-5',
    content: [{ type: 'text', text: JSON.stringify(object) }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 10, output_tokens: 20 },
  }
}

function refusalResponse() {
  return {
    id: 'msg_stub',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-5',
    content: [],
    stop_reason: 'refusal',
    stop_details: { type: 'refusal', category: 'cyber', explanation: 'Declined.' },
    usage: { input_tokens: 10, output_tokens: 0 },
  }
}

async function waitForServer(url, attempts = 60) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      await fetch(url)
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }
  throw new Error(`Server at ${url} did not start in time`)
}

function spawnServer(env) {
  return Bun.spawn(['bun', 'run', 'server.ts'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', ...env },
    stdout: 'ignore',
    stderr: 'ignore',
  })
}

function authed(extra = {}) {
  return { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json', ...extra }
}

function post(body, headers = authed()) {
  return fetch(`${base}/api/ai/generate`, {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('AI assist API (server.ts)', () => {
  let proc
  let stubServer
  let dbDir

  beforeAll(async () => {
    dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hhvc-ai-api-'))

    stubServer = Bun.serve({
      port: STUB_PORT,
      hostname: '127.0.0.1',
      async fetch(req) {
        const url = new URL(req.url)
        if (url.pathname === '/v1/models') {
          return Response.json({
            data: [{ id: 'claude-opus-5', display_name: 'Claude Opus 5', type: 'model' }],
            has_more: false,
          })
        }
        stub.requests.push(await req.json().catch(() => null))
        const next = stub.always || stub.queue.shift()
        if (!next) return Response.json(messageResponse(VALID_PAGE))
        if (next.status) return Response.json(next.body, { status: next.status })
        return Response.json(next.body)
      },
    })

    proc = spawnServer({
      REVIEW_API_TOKEN: TOKEN,
      ANTHROPIC_API_KEY: 'sk-ant-stub',
      ANTHROPIC_BASE_URL: `http://127.0.0.1:${STUB_PORT}`,
      DATA_DB_PATH: path.join(dbDir, 'review-state.db'),
    })
    await waitForServer(`${base}/api/ai/capabilities`)
  })

  afterAll(() => {
    proc?.kill()
    stubServer?.stop(true)
    fs.rmSync(dbDir, { recursive: true, force: true })
  })

  beforeEach(() => {
    stub.queue = []
    stub.always = null
    stub.requests = []
  })

  describe('gates', () => {
    test('rejects a request with no bearer token', async () => {
      const res = await fetch(`${base}/api/ai/capabilities`)
      expect(res.status).toBe(401)
    })

    test('rejects a request with the wrong bearer token', async () => {
      const res = await fetch(`${base}/api/ai/capabilities`, {
        headers: { authorization: 'Bearer wrong-token' },
      })
      expect(res.status).toBe(401)
    })

    test('answers a CORS preflight without a token', async () => {
      const res = await fetch(`${base}/api/ai/generate`, { method: 'OPTIONS' })
      expect(res.status).toBe(204)
      expect(res.headers.get('access-control-allow-methods')).toContain('POST')
    })

    test('returns 404 for an unknown path rather than claiming it exists', async () => {
      const res = await fetch(`${base}/api/ai/nope`, { headers: authed() })
      expect(res.status).toBe(404)
    })

    test('returns 405-style 404 for the wrong method on a real route', async () => {
      const res = await fetch(`${base}/api/ai/generate`, { headers: authed() })
      expect(res.status).toBe(404)
    })
  })

  describe('capabilities', () => {
    test('reports the configured provider, tasks, and grounding files', async () => {
      const res = await fetch(`${base}/api/ai/capabilities`, { headers: authed() })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.providers.claude).toBe(true)
      expect(body.tasks).toEqual(['content'])
      expect(body.groundedBy).toContain('writing-and-style.md')
      expect(body.pageCount).toBe(19)
      expect(body.disclosureRequired).toBe(true)
    })
  })

  describe('models', () => {
    test('lists what the configured key can actually see', async () => {
      const res = await fetch(`${base}/api/ai/models`, { headers: authed() })
      expect(res.status).toBe(200)
      expect((await res.json()).claude).toContain('claude-opus-5')
    })
  })

  describe('request validation', () => {
    test('rejects a body that is not JSON', async () => {
      const res = await post('not json at all')
      expect(res.status).toBe(400)
      expect((await res.json()).error).toBe('Request body must be valid JSON.')
    })

    test('rejects a JSON array', async () => {
      const res = await post([1, 2, 3])
      expect(res.status).toBe(400)
      expect((await res.json()).error).toBe('Request body must be a JSON object.')
    })

    test('rejects an unknown task', async () => {
      const res = await post({ task: 'sitemap', prompt: 'x' })
      expect(res.status).toBe(400)
    })

    test('rejects an empty prompt', async () => {
      const res = await post({ task: 'content', prompt: '' })
      expect(res.status).toBe(400)
    })
  })

  describe('generation', () => {
    test('returns a validated draft on the happy path', async () => {
      stub.queue = [{ body: messageResponse(VALID_PAGE) }]
      const res = await post({ task: 'content', prompt: 'Draft a pest reporting page.' })
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.valid).toBe(true)
      expect(body.issues).toEqual([])
      expect(body.attempts).toBe(1)
      expect(body.result.title).toBe('Report a pest problem')
      expect(body.provider).toBe('claude')
    })

    test('carries the AI disclosure SF.gov guidelines require', async () => {
      stub.queue = [{ body: messageResponse(VALID_PAGE) }]
      const body = await (await post({ task: 'content', prompt: 'Draft a page.' })).json()
      expect(body.disclosure).toContain('AI-assisted draft')
      expect(body.disclosure).toContain('not approved')
    })

    test('grounds the system prompt in the vendored style corpus', async () => {
      stub.queue = [{ body: messageResponse(VALID_PAGE) }]
      await post({ task: 'content', prompt: 'Draft a page.' })
      const system = stub.requests[0].system[0].text
      // Asserted on single-line fragments: the prompt is hard-wrapped, so
      // "Healthy Housing and Vector Control" spans a newline in the source.
      expect(system).toContain('(HHVC) program')
      expect(system).toContain('Never use the word "shall"')
      // The vendored corpus must actually be inlined, not just referenced.
      expect(system).toContain('SF.gov writing and style guidance')
      expect(system).toContain('Karl content types and components')
      // Real page keys must be listed so the model cannot invent link targets.
      expect(system).toContain('pestsTopic')
    })

    test('marks the system prompt cacheable, since it never varies', async () => {
      stub.queue = [{ body: messageResponse(VALID_PAGE) }]
      await post({ task: 'content', prompt: 'Draft a page.' })
      expect(stub.requests[0].system[0].cache_control).toEqual({ type: 'ephemeral' })
    })

    test('passes the current page through as grounding context', async () => {
      stub.queue = [{ body: messageResponse(VALID_PAGE) }]
      await post({
        task: 'content',
        prompt: 'Rewrite this.',
        page: { title: 'An existing page', slug: 'sf.gov/existing' },
      })
      expect(stub.requests[0].messages[0].content).toContain('An existing page')
    })

    test('retries once with the failures named, then succeeds', async () => {
      stub.queue = [{ body: messageResponse(INVALID_PAGE) }, { body: messageResponse(VALID_PAGE) }]
      const body = await (await post({ task: 'content', prompt: 'Draft a page.' })).json()

      expect(body.attempts).toBe(2)
      expect(body.valid).toBe(true)
      // The retry turn must state what was wrong; a bare "try again" reproduces
      // the same violation.
      const retryPrompt = stub.requests[1].messages[0].content
      expect(retryPrompt).toContain('validation_failures')
      expect(retryPrompt).toContain('must use bullets')
    })

    test('returns the draft with its issues when both attempts fail', async () => {
      stub.queue = [
        { body: messageResponse(INVALID_PAGE) },
        { body: messageResponse(INVALID_PAGE) },
      ]
      const res = await post({ task: 'content', prompt: 'Draft a page.' })

      // 200, not an error: a draft that fails one rule is still useful to a
      // reviewer who can see which rule and fix it by hand.
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.valid).toBe(false)
      expect(body.attempts).toBe(2)
      expect(body.issues.join(' ')).toContain('must use bullets')
      expect(body.result).toBeTruthy()
    })

    test('reports a schema failure rather than crashing on a malformed page', async () => {
      stub.queue = [
        { body: messageResponse({ title: 'Missing everything else' }) },
        { body: messageResponse({ title: 'Missing everything else' }) },
      ]
      const body = await (await post({ task: 'content', prompt: 'Draft a page.' })).json()
      expect(body.valid).toBe(false)
      expect(body.issues.some((issue) => issue.startsWith('Schema:'))).toBe(true)
    })

    test('flags an invented link target against the real page-key universe', async () => {
      const withBadTarget = {
        ...VALID_PAGE,
        sections: [
          {
            heading: 'Related pages',
            karl: 'Related section.',
            cards: [{ title: 'Some other page', target: 'thisKeyDoesNotExist' }],
          },
        ],
      }
      stub.queue = [
        { body: messageResponse(withBadTarget) },
        { body: messageResponse(withBadTarget) },
      ]
      const body = await (await post({ task: 'content', prompt: 'Draft a page.' })).json()
      expect(body.valid).toBe(false)
      expect(body.issues.join(' ')).toContain('thisKeyDoesNotExist')
    })

    test('accepts a link to a page key that really exists', async () => {
      const withGoodTarget = {
        ...VALID_PAGE,
        sections: [
          ...VALID_PAGE.sections,
          {
            heading: 'Related pages',
            karl: 'Related section.',
            cards: [{ title: 'Report rats and mice', target: 'rodentsReport' }],
          },
        ],
      }
      stub.queue = [{ body: messageResponse(withGoodTarget) }]
      const body = await (await post({ task: 'content', prompt: 'Draft a page.' })).json()
      expect(body.valid).toBe(true)
    })
  })

  describe('error mapping', () => {
    test('maps a model refusal to 422, not a 500', async () => {
      stub.queue = [{ body: refusalResponse() }]
      const res = await post({ task: 'content', prompt: 'Something declined.' })
      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.category).toBe('cyber')
    })

    test('maps an upstream API error to 502 with the upstream status attached', async () => {
      stub.always = {
        status: 429,
        body: { type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } },
      }
      const res = await post({ task: 'content', prompt: 'Draft a page.' })
      expect(res.status).toBe(502)
      expect((await res.json()).upstreamStatus).toBe(429)
    })
  })
})

describe('AI assist API when unconfigured', () => {
  const UNCONFIGURED_PORT = 8133
  const unconfiguredBase = `http://127.0.0.1:${UNCONFIGURED_PORT}`
  let proc
  let dbDir

  beforeAll(async () => {
    dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hhvc-ai-unconfigured-'))
    proc = Bun.spawn(['bun', 'run', 'server.ts'], {
      cwd: ROOT,
      env: {
        ...process.env,
        PORT: String(UNCONFIGURED_PORT),
        HOST: '127.0.0.1',
        REVIEW_API_TOKEN: TOKEN,
        ANTHROPIC_API_KEY: '',
        DATA_DB_PATH: path.join(dbDir, 'review-state.db'),
      },
      stdout: 'ignore',
      stderr: 'ignore',
    })
    await waitForServer(`${unconfiguredBase}/api/ai/capabilities`)
  })

  afterAll(() => {
    proc?.kill()
    fs.rmSync(dbDir, { recursive: true, force: true })
  })

  test('still answers capabilities, so the browser can explain itself', async () => {
    const res = await fetch(`${unconfiguredBase}/api/ai/capabilities`, { headers: authed() })
    expect(res.status).toBe(200)
    expect((await res.json()).providers.claude).toBe(false)
  })

  test('fails closed on generate with 501, never an unauthenticated success', async () => {
    const res = await fetch(`${unconfiguredBase}/api/ai/generate`, {
      method: 'POST',
      headers: authed(),
      body: JSON.stringify({ task: 'content', prompt: 'Draft a page.' }),
    })
    expect(res.status).toBe(501)
    expect((await res.json()).error).toContain('ANTHROPIC_API_KEY unset')
  })
})
