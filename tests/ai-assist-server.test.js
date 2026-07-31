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
  /**
   * Hold the response open this long before answering. Lets a test cancel or
   * time out a generation mid-flight, which is the only way to exercise the
   * cancellation mapping — the bug it guards was a branch that looked right
   * and never executed.
   */
  delayMs: 0,
  /** Every request body the stub received. */
  requests: [],
}

/** Fixed per-call usage, so a retried generation's total is checkable. */
const STUB_USAGE = { input_tokens: 10, output_tokens: 20 }

function messageResponse(object) {
  return {
    id: 'msg_stub',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-5',
    content: [{ type: 'text', text: JSON.stringify(object) }],
    stop_reason: 'end_turn',
    usage: { ...STUB_USAGE },
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
        if (stub.delayMs) await new Promise((resolve) => setTimeout(resolve, stub.delayMs))
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
    stub.delayMs = 0
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

    test('rejects a body larger than the cap with 413, not a 400 after parsing it', async () => {
      // The point is the status: a 413 means the server refused the payload,
      // where a 400 would mean it buffered and parsed the whole thing first
      // and only then decided it was too big.
      const res = await post({
        task: 'content',
        prompt: 'Draft a page.',
        page: { filler: 'x'.repeat(200_000) },
      })
      expect(res.status).toBe(413)
      expect((await res.json()).error).toContain('bytes or fewer')
    })

    test('rejects an oversized page even when the prompt is within its own cap', async () => {
      // `prompt` was always capped at 8000 characters; `page` used to be
      // unbounded and is serialized into the provider prompt just the same, so
      // without its own limit the character cap was decorative.
      const res = await post({
        task: 'content',
        prompt: 'Draft a page.',
        page: { sections: [{ heading: 'x'.repeat(100_000) }] },
      })
      expect(res.status).toBe(400)
      expect(JSON.stringify((await res.json()).issues)).toContain('serialize')
    })

    test('rejects a deeply nested page', async () => {
      let nested = { end: true }
      for (let i = 0; i < 40; i++) nested = { nested }
      const res = await post({ task: 'content', prompt: 'Draft a page.', page: nested })
      expect(res.status).toBe(400)
      expect(JSON.stringify((await res.json()).issues)).toContain('nest')
    })

    test('rejects an oversized chunked body the Content-Length check cannot see', async () => {
      // The pre-check only catches an honest Content-Length. A streamed body
      // sends none, so this is the case that has to be enforced while reading
      // rather than after buffering.
      const chunk = new TextEncoder().encode('x'.repeat(64 * 1024))
      const body = new ReadableStream({
        start(controller) {
          for (let i = 0; i < 6; i += 1) controller.enqueue(chunk)
          controller.close()
        },
      })
      const res = await fetch(`${base}/api/ai/generate`, {
        method: 'POST',
        headers: authed(),
        body,
        duplex: 'half',
      })
      expect(res.status).toBe(413)
    })

    test('leaves the connection usable after rejecting an oversized body', async () => {
      // Rejecting a body must not poison the keep-alive connection. Cancelling
      // the request-body reader mid-stream does exactly that: the client is
      // still sending, so the next request on the same connection is read as
      // garbage and Bun answers it with an empty-bodied protocol-level 400.
      // That showed up first as a flaky failure in the test that happened to
      // run next; a real client would see a 413 followed by an inexplicable
      // 400 on their next, perfectly valid, request.
      // Chunks are produced SLOWLY and on demand. Enqueuing them all up front
      // lets the client finish sending before the server ever reads, so a
      // cancel has nothing to interrupt and the bug hides. Trickling them keeps
      // the client genuinely mid-send when the cap trips, which is the state
      // that corrupts the connection.
      const chunk = new TextEncoder().encode('x'.repeat(32 * 1024))
      let sent = 0
      const big = new ReadableStream({
        async pull(controller) {
          if (sent >= 12) return controller.close()
          sent += 1
          await new Promise((resolve) => setTimeout(resolve, 15))
          controller.enqueue(chunk)
        },
      })
      const rejected = await fetch(`${base}/api/ai/generate`, {
        method: 'POST',
        headers: authed(),
        body: big,
        duplex: 'half',
      })
      expect(rejected.status).toBe(413)

      // Immediately reuse the connection with a request that must succeed.
      stub.queue = [{ body: messageResponse(VALID_PAGE) }]
      const after = await post({ task: 'content', prompt: 'Draft a page.' })
      expect(after.status).toBe(200)
      expect((await after.json()).valid).toBe(true)
    })

    test('measures the body in bytes, not characters', async () => {
      // '€' is 3 bytes of UTF-8 but one JS character, so a cap compared against
      // String#length would let roughly three times the intended payload
      // through. 60k of them is ~180 KB on the wire, over the 128 KB cap, but
      // only 60k characters.
      const res = await post({
        task: 'content',
        prompt: 'Draft a page.',
        page: { filler: '€'.repeat(60_000) },
      })
      expect(res.status).toBe(413)
    })

    test('still accepts a real page from this repo as grounding', async () => {
      // The caps must not reject anything the tool itself displays, or the
      // "use the current page as context" checkbox silently stops working on
      // the largest pages — exactly the ones where context helps most.
      const { loadPageData } = require('../build_scripts/load-pages')
      const pages = loadPageData().pages
      const largest = Object.values(pages).sort(
        (a, b) => JSON.stringify(b).length - JSON.stringify(a).length
      )[0]
      stub.queue = [{ body: messageResponse(VALID_PAGE) }]
      const res = await post({ task: 'content', prompt: 'Draft a page.', page: largest })
      expect(res.status).toBe(200)
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

    test('sends the rejected draft back with the failures, not just the failures', async () => {
      stub.queue = [{ body: messageResponse(INVALID_PAGE) }, { body: messageResponse(VALID_PAGE) }]
      await post({ task: 'content', prompt: 'Draft a page.' })

      // Each API call is stateless, so "fix these and change nothing else" is
      // only followable if the thing to change travels with the instruction.
      // Without it the retry regenerates from scratch and loses whatever the
      // first attempt already got right.
      const retryPrompt = stub.requests[1].messages[0].content
      expect(retryPrompt).toContain('previous_draft')
      expect(retryPrompt).toContain('You get a result.')
    })

    test('reports the token usage of every attempt, not just the last', async () => {
      stub.queue = [{ body: messageResponse(INVALID_PAGE) }, { body: messageResponse(VALID_PAGE) }]
      const body = await (await post({ task: 'content', prompt: 'Draft a page.' })).json()

      expect(body.attempts).toBe(2)
      // The stub reports a fixed usage per call, so a retried generation must
      // total two calls' worth. Reporting only the final call would understate
      // the spend of exactly the requests that cost the most.
      expect(body.usage.output_tokens).toBe(2 * STUB_USAGE.output_tokens)
      expect(body.usage.input_tokens).toBe(2 * STUB_USAGE.input_tokens)
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

    test('flags a link to the validator’s own sentinel key', async () => {
      // The draft is filed under a sentinel so its internal links can resolve —
      // which used to make that sentinel a resolvable target too. A card
      // pointing at it passed every check while being inert in the downloaded
      // module, which is named from the page's slug and never from the
      // sentinel.
      const withSelfTarget = {
        ...VALID_PAGE,
        sections: [
          {
            heading: 'Related pages',
            karl: 'Related section.',
            cards: [{ title: 'Some other page', target: '__generated__' }],
          },
        ],
      }
      stub.queue = [
        { body: messageResponse(withSelfTarget) },
        { body: messageResponse(withSelfTarget) },
      ]
      const body = await (await post({ task: 'content', prompt: 'Draft a page.' })).json()
      expect(body.valid).toBe(false)
      expect(body.issues.join(' ')).toContain('__generated__')
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

// The whole-request timeout, on its own server so AI_REQUEST_TIMEOUT_MS can be
// short enough to hit deliberately.
//
// This is the regression test for the cancellation mapping. The old
// aiErrorResponse matched on `error.name === "AbortError"`, but aborting the
// SDK's call makes it throw APIUserAbortError — name "Error", no status — so
// the branch never ran and every timed-out generation came back as a logged
// 500. A client-cancelled request maps to 499 through the same code, but that
// case is not observable from a test: the client that aborts is precisely the
// one that cannot then read the response. The timeout path is the same branch
// with a client still attached to see the answer.
describe('AI assist API request timeout', () => {
  const TIMEOUT_PORT = 8134
  const TIMEOUT_STUB_PORT = 8135
  const timeoutBase = `http://127.0.0.1:${TIMEOUT_PORT}`
  let proc
  let slowStub
  let dbDir

  beforeAll(async () => {
    dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hhvc-ai-timeout-'))

    slowStub = Bun.serve({
      port: TIMEOUT_STUB_PORT,
      hostname: '127.0.0.1',
      async fetch() {
        // Far longer than the server's budget, so the server always gives up
        // first and the assertion is about the server, not about this timing.
        await new Promise((resolve) => setTimeout(resolve, 10_000))
        return Response.json(messageResponse(VALID_PAGE))
      },
    })

    proc = Bun.spawn(['bun', 'run', 'server.ts'], {
      cwd: ROOT,
      env: {
        ...process.env,
        PORT: String(TIMEOUT_PORT),
        HOST: '127.0.0.1',
        REVIEW_API_TOKEN: TOKEN,
        ANTHROPIC_API_KEY: 'sk-ant-stub',
        ANTHROPIC_BASE_URL: `http://127.0.0.1:${TIMEOUT_STUB_PORT}`,
        AI_REQUEST_TIMEOUT_MS: '400',
        DATA_DB_PATH: path.join(dbDir, 'review-state.db'),
      },
      stdout: 'ignore',
      stderr: 'ignore',
    })
    await waitForServer(`${timeoutBase}/api/ai/capabilities`)
  })

  afterAll(() => {
    proc?.kill()
    slowStub?.stop(true)
    fs.rmSync(dbDir, { recursive: true, force: true })
  })

  test('answers 504 when the upstream outlives the request budget', async () => {
    const res = await fetch(`${timeoutBase}/api/ai/generate`, {
      method: 'POST',
      headers: authed(),
      body: JSON.stringify({ task: 'content', prompt: 'Take your time.' }),
    })

    // Specifically NOT 500: a wedged upstream is a gateway timeout, and
    // logging it as a server fault buries the failures that are real ones.
    expect(res.status).toBe(504)
    expect((await res.json()).error).toContain('timed out')
  })
})

// The OTHER timeout — the SDK's own per-call one, firing inside the route's
// budget rather than at the end of it.
//
// Everything about this configuration is supported: ANTHROPIC_TIMEOUT_MS is
// documented, and ANTHROPIC_MAX_RETRIES=0 is explicitly a legitimate choice. So
// whenever the SDK's ceiling is the lower of the two, APIConnectionTimeoutError
// reaches aiErrorResponse's fallback with NEITHER signal aborted — the client is
// still connected and the route's own timer has not expired.
//
// That fallback was doubly broken. It matched with `instanceof` against a copy
// of the SDK imported into server.ts, while the throw came from the copy
// build_scripts/ai/ requires — the package ships separate require/import
// builds, so the two classes were different objects and the check was
// permanently false. Measured before the fix, this exact request returned
// **500**, not even the 499 the code reads as. And 499 would have been wrong
// too: it says the client hung up, when in fact the client was waiting and the
// provider was the one that ran out of time.
describe('AI assist API upstream (SDK) timeout', () => {
  const SDK_PORT = 8136
  const SDK_STUB_PORT = 8137
  const sdkBase = `http://127.0.0.1:${SDK_PORT}`
  let proc
  let slowStub
  let dbDir

  beforeAll(async () => {
    dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hhvc-ai-sdk-timeout-'))

    slowStub = Bun.serve({
      port: SDK_STUB_PORT,
      hostname: '127.0.0.1',
      async fetch() {
        await new Promise((resolve) => setTimeout(resolve, 10_000))
        return Response.json(messageResponse(VALID_PAGE))
      },
    })

    proc = Bun.spawn(['bun', 'run', 'server.ts'], {
      cwd: ROOT,
      env: {
        ...process.env,
        PORT: String(SDK_PORT),
        HOST: '127.0.0.1',
        REVIEW_API_TOKEN: TOKEN,
        ANTHROPIC_API_KEY: 'sk-ant-stub',
        ANTHROPIC_BASE_URL: `http://127.0.0.1:${SDK_STUB_PORT}`,
        // The inversion that makes this path reachable: the SDK gives up long
        // before the route does, and does not retry its way past it.
        ANTHROPIC_TIMEOUT_MS: '500',
        ANTHROPIC_MAX_RETRIES: '0',
        AI_REQUEST_TIMEOUT_MS: '30000',
        DATA_DB_PATH: path.join(dbDir, 'review-state.db'),
      },
      stdout: 'ignore',
      stderr: 'ignore',
    })
    await waitForServer(`${sdkBase}/api/ai/capabilities`)
  })

  afterAll(() => {
    proc?.kill()
    slowStub?.stop(true)
    fs.rmSync(dbDir, { recursive: true, force: true })
  })

  test('answers 504 when the SDK times out before the request budget', async () => {
    const res = await fetch(`${sdkBase}/api/ai/generate`, {
      method: 'POST',
      headers: authed(),
      body: JSON.stringify({ task: 'content', prompt: 'Take your time.' }),
    })

    expect(res.status).toBe(504)
    expect((await res.json()).error).toContain('timed out')
  })
})
