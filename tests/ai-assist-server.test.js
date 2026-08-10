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
const fs = require('fs')

const ROOT = path.resolve(__dirname, '..')

const PORT = 8131
const STUB_PORT = 8132
const GEMINI_STUB_PORT = 8133
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

/**
 * The Gemini stub's own mutable state, deliberately separate from `stub`.
 *
 * Keeping one shared queue for both providers would make "the request went to
 * Gemini and not to Claude" unassertable — which is the single most important
 * thing about provider routing, and the failure a plausible-looking `switch`
 * bug actually produces.
 */
const geminiStub = {
  queue: [],
  requests: [],
}

/** Fixed per-call usage, so a retried generation's total is checkable. */
const STUB_USAGE = { input_tokens: 10, output_tokens: 20 }

/** Gemini's counters, deliberately different numbers from STUB_USAGE. */
const GEMINI_STUB_USAGE = {
  promptTokenCount: 11,
  candidatesTokenCount: 22,
  thoughtsTokenCount: 7,
  totalTokenCount: 40,
}

/** A Gemini generateContent response carrying `object` as its JSON payload. */
function geminiResponse(object) {
  return {
    candidates: [{ content: { parts: [{ text: JSON.stringify(object) }] }, finishReason: 'STOP' }],
    modelVersion: 'gemini-2.5-pro',
    usageMetadata: { ...GEMINI_STUB_USAGE },
  }
}

/**
 * A Gemini response that declined.
 *
 * Modelled as a candidate-level `finishReason`, which is the harder of the two
 * refusal shapes: generation started and was then stopped, so unlike a
 * prompt-level `blockReason` there IS a candidate — just one with no parts.
 * Reaching for its text before checking the reason is what throws a TypeError
 * over the real cause.
 */
function geminiRefusalResponse() {
  return {
    candidates: [
      {
        finishReason: 'PROHIBITED_CONTENT',
        // NOT finishMessage, which looks like the field for this and is always
        // absent here: it is Vertex-only and the SDK's response converter drops
        // it on the Gemini Developer API path. safetyRatings survives, so that
        // is what the explanation is built from.
        safetyRatings: [
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', probability: 'HIGH', blocked: true },
          { category: 'HARM_CATEGORY_HARASSMENT', probability: 'LOW', blocked: false },
        ],
      },
    ],
    modelVersion: 'gemini-2.5-pro',
    usageMetadata: { promptTokenCount: 11, candidatesTokenCount: 0, totalTokenCount: 11 },
  }
}

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

function createTestDbDir(name) {
  return fs.mkdtempSync(path.join(ROOT, `.ai-api-${name}-`))
}

function isolatedApiEnvironment(overrides) {
  const env = { ...process.env }
  for (const key of [
    'REVIEW_API_PRINCIPALS',
    'REVIEW_API_ALLOWED_ORIGINS',
    'REVIEW_API_RATE_LIMIT',
    'REVIEW_API_RATE_WINDOW_MS',
  ]) {
    delete env[key]
  }
  return { ...env, ...overrides }
}

function spawnServer(env) {
  return Bun.spawn(['bun', 'run', 'server.ts'], {
    cwd: ROOT,
    env: isolatedApiEnvironment({ PORT: String(PORT), HOST: '127.0.0.1', ...env }),
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
  let geminiStubServer
  let dbDir

  beforeAll(async () => {
    dbDir = createTestDbDir('main')

    // The Gemini Developer API's wire paths, as @google/genai builds them from
    // httpOptions.baseUrl: GET /v1beta/models to list, and
    // POST /v1beta/models/{model}:generateContent to generate. Matched on the
    // suffix rather than the exact string so an apiVersion change in the SDK
    // does not silently route every request into the 404 branch and leave the
    // failure looking like a server bug.
    geminiStubServer = Bun.serve({
      port: GEMINI_STUB_PORT,
      hostname: '127.0.0.1',
      async fetch(req) {
        const url = new URL(req.url)
        if (url.pathname.endsWith('/models')) {
          return Response.json({ models: [{ name: 'models/gemini-2.5-pro' }] })
        }
        geminiStub.requests.push(await req.json().catch(() => null))
        const next = geminiStub.queue.shift()
        if (!next) return Response.json(geminiResponse(VALID_PAGE))
        if (next.status) return Response.json(next.body, { status: next.status })
        return Response.json(next.body)
      },
    })

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
      // Both providers configured, which is the interesting case: it is the
      // only one where routing, the picker, and the default can be wrong.
      GEMINI_API_KEY: 'gemini-stub',
      GEMINI_BASE_URL: `http://127.0.0.1:${GEMINI_STUB_PORT}`,
      DATA_DB_PATH: path.join(dbDir, 'review-state.db'),
    })
    await waitForServer(`${base}/api/ai/capabilities`)
  })

  afterAll(() => {
    proc?.kill()
    stubServer?.stop(true)
    geminiStubServer?.stop(true)
    fs.rmSync(dbDir, { recursive: true, force: true })
  })

  beforeEach(() => {
    stub.queue = []
    stub.always = null
    stub.delayMs = 0
    stub.requests = []
    geminiStub.queue = []
    geminiStub.requests = []
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
      // The browser reads this list to decide whether to mount the
      // selection-rewrite affordance at all, so a task missing here is the
      // difference between a working button and no button.
      expect(body.tasks).toEqual(['content', 'rewrite-field'])
      expect(body.groundedBy).toContain('writing-and-style.md')
      expect(body.pageCount).toBe(22)
      expect(body.disclosureRequired).toBe(true)
    })

    test('reports every configured provider, with its model and label', async () => {
      const res = await fetch(`${base}/api/ai/capabilities`, { headers: authed() })
      const body = await res.json()
      expect(body.providers).toEqual({ claude: true, gemini: true })
      expect(body.models.claude).toBe('claude-opus-5')
      expect(body.models.gemini).toBe('gemini-pro-latest')
      // Labels drive the browser's picker. Without them it would have to map
      // registry keys to display names itself, which is the sort of duplicated
      // table that goes stale the first time a provider is added.
      expect(body.providerLabels).toEqual({ claude: 'Claude', gemini: 'Gemini' })
    })

    test('names the provider an unnamed request would run on', async () => {
      const res = await fetch(`${base}/api/ai/capabilities`, { headers: authed() })
      // Registration order, so the picker's initial selection matches what the
      // server actually does rather than merely looking plausible.
      expect((await res.json()).defaultProvider).toBe('claude')
    })
  })

  describe('models', () => {
    test('lists what the configured key can actually see', async () => {
      const res = await fetch(`${base}/api/ai/models`, { headers: authed() })
      expect(res.status).toBe(200)
      expect((await res.json()).claude).toContain('claude-opus-5')
    })

    test('lists each provider separately', async () => {
      const res = await fetch(`${base}/api/ai/models`, { headers: authed() })
      const body = await res.json()
      // Stripped of the `models/` resource prefix the API returns, so the ids
      // listed are the ids GEMINI_MODEL accepts. Returning a name the config
      // would reject makes this endpoint actively misleading.
      expect(body.gemini).toEqual(['gemini-2.5-pro'])
      expect(body.claude).toContain('claude-opus-5')
    })
  })

  // Routing, and the two ways it can be wrong: sending a request to the wrong
  // provider, and attributing a draft to a provider that did not write it.
  describe('provider selection', () => {
    test('routes an unnamed request to the default provider', async () => {
      const body = await (await post({ task: 'content', prompt: 'Draft a page.' })).json()
      expect(body.provider).toBe('claude')
      expect(stub.requests).toHaveLength(1)
      // The negative half matters as much as the positive one: a broken switch
      // that calls both providers still satisfies "claude answered".
      expect(geminiStub.requests).toHaveLength(0)
    })

    test('routes a request naming gemini to gemini, and nowhere else', async () => {
      const res = await post({ task: 'content', prompt: 'Draft a page.', provider: 'gemini' })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.provider).toBe('gemini')
      expect(body.model).toBe('gemini-2.5-pro')
      expect(geminiStub.requests).toHaveLength(1)
      expect(stub.requests).toHaveLength(0)
    })

    test('sends the same system prompt and schema to gemini', async () => {
      await post({ task: 'content', prompt: 'Draft a page.', provider: 'gemini' })
      const sent = geminiStub.requests[0]
      // The system prompt goes in systemInstruction, not folded into contents:
      // a prefix-cached corpus that moves into the user turn stops being a
      // stable prefix and starts costing full price on every call.
      expect(JSON.stringify(sent.systemInstruction)).toContain('Healthy Housing')
      // responseJsonSchema, not responseSchema — the latter takes a narrower
      // OpenAPI subset that PAGE_OUTPUT_SCHEMA would not survive intact.
      expect(sent.generationConfig.responseJsonSchema).toBeDefined()
      expect(sent.generationConfig.responseMimeType).toBe('application/json')
    })

    test('normalizes gemini usage into the same shape as claude', async () => {
      const body = await (
        await post({ task: 'content', prompt: 'Draft a page.', provider: 'gemini' })
      ).json()
      expect(body.usage).toEqual({
        inputTokens: GEMINI_STUB_USAGE.promptTokenCount,
        outputTokens: GEMINI_STUB_USAGE.candidatesTokenCount,
        // totalTokenCount is taken as authoritative rather than recomputed:
        // Gemini bills thinking tokens on top of prompt+candidates, so
        // input+output (33 here) understates the real 40.
        totalTokens: GEMINI_STUB_USAGE.totalTokenCount,
      })
      expect(body.usageByAttempt[0].thoughtsTokenCount).toBe(GEMINI_STUB_USAGE.thoughtsTokenCount)
    })

    test('maps a gemini finishReason refusal to 422, not a 500', async () => {
      geminiStub.queue = [{ body: geminiRefusalResponse() }]
      const res = await post({ task: 'content', prompt: 'Draft a page.', provider: 'gemini' })
      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.category).toBe('PROHIBITED_CONTENT')
      // Only the BLOCKED categories, not every rating. Listing HARASSMENT here
      // because it was scored at all would tell a reviewer to reword something
      // that was never the problem.
      expect(body.explanation).toBe('Blocked on HARM_CATEGORY_DANGEROUS_CONTENT.')
    })

    test('maps a gemini prompt-level block to 422', async () => {
      // The other refusal shape: the INPUT was blocked, so there is no
      // candidate at all. Checking only finishReason misses this entirely and
      // it surfaces as "returned no text content" — an outage, to a reviewer.
      geminiStub.queue = [
        {
          body: {
            promptFeedback: { blockReason: 'SAFETY', blockReasonMessage: 'Blocked on input.' },
          },
        },
      ]
      const res = await post({ task: 'content', prompt: 'Draft a page.', provider: 'gemini' })
      expect(res.status).toBe(422)
      expect((await res.json()).category).toBe('SAFETY')
    })

    test('rejects a provider this build does not know about', async () => {
      const res = await post({ task: 'content', prompt: 'Draft a page.', provider: 'gpt-9' })
      // Caught by the Zod enum before any provider work happens.
      expect(res.status).toBe(400)
    })

    test('rewrites one field and carries the mandatory disclosure', async () => {
      stub.queue = [{ body: messageResponse({ rewrittenText: 'Report the problem to [us](x).' }) }]
      const res = await post({
        task: 'rewrite-field',
        fieldText: 'You are required to report the problem to [us](x).',
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.task).toBe('rewrite-field')
      expect(body.result.rewrittenText).toBe('Report the problem to [us](x).')
      expect(body.valid).toBe(true)
      expect(body.attempts).toBe(1)
      // Standards manual §1.11 and SF.gov's AI guidelines both require the
      // label to travel with generated content, on every task.
      expect(body.disclosure).toContain('AI-assisted')
    })

    test('sends the rewrite system prompt, not the page-drafting one', async () => {
      stub.queue = [{ body: messageResponse({ rewrittenText: 'Short copy.' }) }]
      await post({ task: 'rewrite-field', fieldText: 'Some long copy.' })
      const system = stub.requests[0].system.map((block) => block.text).join('\n')
      // Proves the route actually dispatched on task rather than falling
      // through to generateContent, which no status code would reveal.
      expect(system).toContain('You rewrite one field of body copy')
      expect(system).not.toContain('<karl_field_notes>')
    })

    test('retries once and names the dropped link target', async () => {
      // Both attempts drop the link, so the retry is exhausted and the result
      // comes back invalid rather than being hidden from the reviewer.
      stub.queue = [
        { body: messageResponse({ rewrittenText: 'See the guide.' }) },
        { body: messageResponse({ rewrittenText: 'Read the guide.' }) },
      ]
      const res = await post({
        task: 'rewrite-field',
        fieldText: 'See [the guide](pestsTopic).',
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.attempts).toBe(2)
      expect(body.valid).toBe(false)
      expect(body.issues.join(' ')).toContain('pestsTopic')
      // The rejected attempt must travel with the failures, or "fix this and
      // change nothing else" is an instruction the model cannot follow.
      expect(JSON.stringify(stub.requests[1].messages)).toContain('See the guide.')
    })

    test('rejects a rewrite request with no fieldText', async () => {
      const res = await post({ task: 'rewrite-field' })
      // The discriminated union requires fieldText on this branch, so this
      // fails validation before any provider call is made.
      expect(res.status).toBe(400)
      expect(stub.requests).toHaveLength(0)
    })

    test('ignores a stray prompt on a rewrite request rather than failing it', async () => {
      stub.queue = [{ body: messageResponse({ rewrittenText: 'Short copy.' }) }]
      const res = await post({ task: 'rewrite-field', fieldText: 'x', prompt: 'do a thing' })
      // Zod's z.object STRIPS unknown keys rather than rejecting them, and the
      // rewrite branch declares no `prompt`. Documented rather than tightened
      // with .strict(): the content branch is not strict either, and making
      // only one branch reject extra fields would be an inconsistency a future
      // reader would have to rediscover. The stray value is dropped, never
      // forwarded to the provider.
      expect(res.status).toBe(200)
      expect(JSON.stringify(stub.requests[0])).not.toContain('do a thing')
    })

    test('validates and retries on gemini exactly as it does on claude', async () => {
      geminiStub.queue = [
        { body: geminiResponse(INVALID_PAGE) },
        { body: geminiResponse(VALID_PAGE) },
      ]
      const body = await (
        await post({ task: 'content', prompt: 'Draft a page.', provider: 'gemini' })
      ).json()
      expect(body.attempts).toBe(2)
      expect(body.valid).toBe(true)
      // The retry names the failures AND carries the rejected draft, which is
      // the orchestration layer's job rather than the provider's — this asserts
      // the new provider really is behind the same loop, not beside it.
      const retry = JSON.stringify(geminiStub.requests[1].contents)
      expect(retry).toContain('validation_failures')
      expect(retry).toContain('previous_draft')
    })

    test('sums normalized usage across a gemini retry', async () => {
      geminiStub.queue = [
        { body: geminiResponse(INVALID_PAGE) },
        { body: geminiResponse(VALID_PAGE) },
      ]
      const body = await (
        await post({ task: 'content', prompt: 'Draft a page.', provider: 'gemini' })
      ).json()
      expect(body.usage.totalTokens).toBe(2 * GEMINI_STUB_USAGE.totalTokenCount)
      expect(body.usageByAttempt).toHaveLength(2)
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
      // The oversized page should be rejected by schema validation with a 400.
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(JSON.stringify(body.issues || body)).toContain('serialize')
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

    test('leaves the connection usable after the Content-Length pre-check rejects a body', async () => {
      // The sibling test above covers the STREAMING path, where the cap trips
      // while `readBodyWithLimit` is already reading and the drain branch keeps
      // the socket clean. This covers the other path: an honest Content-Length
      // is refused by the pre-check, which answers 413 without ever touching
      // `req.body`. The client's body is still in the socket, so the next
      // request on that keep-alive connection starts parsing mid-body and Bun
      // reads the leftover bytes as a header block — answering 431 to a
      // perfectly valid request.
      //
      // This is the long-standing "flaky" failure in this file. Whichever test
      // happened to be declared next collected the 431 and looked like an
      // unrelated validation bug, which is why it always passed when run alone.
      const rejected = await post({
        task: 'content',
        prompt: 'Draft a page.',
        page: { filler: 'x'.repeat(200_000) },
      })
      expect(rejected.status).toBe(413)

      // Immediately reuse the connection with a request that must succeed.
      stub.queue = [{ body: messageResponse(VALID_PAGE) }]
      const after = await post({ task: 'content', prompt: 'Draft a page.' })
      expect(after.status).toBe(200)
      expect((await after.json()).valid).toBe(true)
    })

    test('closes the connection when the pre-check itself rejects an honestly declared oversized body', async () => {
      // The sibling test above proves the pre-check's threshold (the 8x drain
      // limit, 1 MiB here) leaves the connection usable for a body BELOW that
      // threshold — because such a body falls through into readBodyWithLimit,
      // whose streaming drain branch is what actually keeps the socket clean.
      // A body genuinely ABOVE the drain limit never reaches that branch: the
      // pre-check answers 413 on Content-Length alone, before touching
      // req.body at all, so the client's payload is left unread in the
      // socket — the exact keep-alive corruption this whole pre-check exists
      // to prevent, just moved to a higher bar. The fix is Connection: close
      // on that specific response, verified here rather than assumed: a
      // Content-Length declaring more than the drain limit, with only a
      // trickle actually sent, must get back a response that says so.
      const declaredLength = 2_000_000 // well past MAX_REQUEST_BODY_BYTES (128 KB) * 8
      const chunk = new TextEncoder().encode('x'.repeat(32 * 1024))
      let sent = 0
      const body = new ReadableStream({
        async pull(controller) {
          if (sent >= 2) return controller.close()
          sent += 1
          await new Promise((resolve) => setTimeout(resolve, 15))
          controller.enqueue(chunk)
        },
      })
      const rejected = await fetch(`${base}/api/ai/generate`, {
        method: 'POST',
        headers: { ...authed(), 'content-length': String(declaredLength) },
        body,
        duplex: 'half',
      })
      expect(rejected.status).toBe(413)
      expect(rejected.headers.get('connection')).toBe('close')

      // A fresh request must still succeed — this response closing ITS OWN
      // connection must not take down the server or any other connection.
      // Unlike the sibling drain test above, this one genuinely tears down
      // the socket rather than leaving it open for reuse, and fetch()'s own
      // connection pool does not always notice a Connection: close in time to
      // evict that socket before immediately handing it back out — a real
      // client-side race with no server-side fix, so one retry is what a real
      // client would also do rather than treat a torn-down pooled socket as a
      // failure.
      //
      // That retry MUST be bounded by a timeout, and this is the whole reason
      // the test needs one. The poisoned socket does not always surface as an
      // ECONNRESET the way an earlier revision assumed: on Bun 1.3.11 the first
      // follow-up simply HANGS, so a catch that only matches ECONNRESET never
      // runs, the request never settles, and the test burns its full 5s budget
      // and times out. That took the spawned server down with it and cascaded
      // ConnectionRefused into the other 21 tests in this file — which is how
      // it read as a server bug rather than a client-pool artifact. The server
      // is fine: measured directly against a raw socket, it answers 413 with
      // Connection: close, stays up, and serves the next connection normally.
      // Measured recovery is exactly one bad attempt, so one bounded retry is
      // enough; a hang and a reset both mean the same thing here.
      stub.queue = [{ body: messageResponse(VALID_PAGE) }]
      const POOL_RECOVERY_TIMEOUT_MS = 2_000
      const postBounded = () =>
        fetch(`${base}/api/ai/generate`, {
          method: 'POST',
          headers: authed(),
          body: JSON.stringify({ task: 'content', prompt: 'Draft a page.' }),
          signal: AbortSignal.timeout(POOL_RECOVERY_TIMEOUT_MS),
        })
      let after
      try {
        after = await postBounded()
      } catch (error) {
        if (!/ECONNRESET|socket connection was closed|timed out|aborted/i.test(String(error)))
          throw error
        after = await postBounded()
      }
      expect(after.status).toBe(200)
      expect((await after.json()).valid).toBe(true)
      // Explicit budget: bun's default is 5s, and this test can legitimately
      // spend one full POOL_RECOVERY_TIMEOUT_MS on the hung socket before the
      // retry even starts. Leaving it on the default made the bounded retry
      // useless — the test died at 5s mid-retry and still looked like a server
      // failure, which is the same misread this whole block exists to prevent.
    }, 20_000)

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
      //
      // Asserted on the NORMALIZED counters, not Anthropic's own field names.
      // Each provider maps its native counters into this shape before
      // addUsage() sums them, which is what lets one assertion describe a
      // retried generation regardless of who answered it.
      expect(body.usage.outputTokens).toBe(2 * STUB_USAGE.output_tokens)
      expect(body.usage.inputTokens).toBe(2 * STUB_USAGE.input_tokens)
      expect(body.usage.totalTokens).toBe(2 * (STUB_USAGE.input_tokens + STUB_USAGE.output_tokens))
      // The provider-native counters ride alongside, one entry per attempt,
      // rather than being folded into the sum — addUsage keeps the FIRST
      // attempt's value for non-numeric fields, so a nested raw object in the
      // total would claim attempt one's numbers covered both.
      expect(body.usageByAttempt).toHaveLength(2)
      expect(body.usageByAttempt[0].input_tokens).toBe(STUB_USAGE.input_tokens)
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

  // The compliance-audit task, nested inside this describe block rather than
  // sibling to it: unlike every other describe block in this file, it needs
  // the Gemini stub server that only exists within THIS block's beforeAll/
  // afterAll lifecycle, and it needs a Gemini key actually configured (the
  // outer proc has both providers configured, which is what makes the "no
  // chunks ingested yet" gate reachable at all — see the next describe block
  // below for the "no Gemini key" half of the gate).
  //
  // The outer beforeEach only resets the stub queues, never the DB, so this
  // block seeds knowledge_chunks itself and must run its own tests in an
  // order that does not surprise a later one: the "no chunks ingested" gate
  // test runs FIRST, before anything below it seeds a row into the same
  // dbDir database the whole outer suite shares.
  describe('compliance-audit task', () => {
    /** A Gemini embedContent response carrying one embedding. */
    function geminiEmbeddingResponse(values) {
      return { embeddings: [{ values }] }
    }

    /**
     * Insert one knowledge chunk directly into the shared test DB, bypassing
     * `bun run ingest` entirely. `INSERT OR REPLACE` rather than a bare
     * INSERT so a second test seeding the same id (the retry test reuses the
     * happy-path's chunk) does not fail on the PRIMARY KEY constraint.
     */
    function seedChunk({ id, sourceFile, headingPath, content, embedding }) {
      const { Database } = require('bun:sqlite')
      // The running server filters knowledge_chunks by the CURRENTLY
      // configured embedding model (see knowledge-retrieval.js's
      // loadChunks), so a seeded row has to carry that same model string or
      // it is silently excluded from retrieval, not just "an arbitrary
      // label" — reading it from the real provider module keeps this in
      // sync with whatever the default actually is.
      const { getEmbeddingModel } = require('../build_scripts/ai/provider-gemini')
      const db = new Database(path.join(dbDir, 'review-state.db'), { create: true })
      db.run(`
        CREATE TABLE IF NOT EXISTS knowledge_chunks (
          id TEXT PRIMARY KEY,
          source_file TEXT NOT NULL,
          category TEXT NOT NULL,
          heading_path TEXT,
          content TEXT NOT NULL,
          chunk_index INTEGER NOT NULL,
          embedding BLOB NOT NULL,
          embedding_model TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
      `)
      const buffer = Buffer.from(Float32Array.from(embedding).buffer)
      db.run(
        `INSERT OR REPLACE INTO knowledge_chunks
         (id, source_file, category, heading_path, content, chunk_index, embedding, embedding_model, created_at)
         VALUES (?, ?, 'hhvc-policy', ?, ?, 0, ?, ?, ?)`,
        [
          id,
          sourceFile,
          headingPath,
          content,
          buffer,
          getEmbeddingModel(),
          new Date().toISOString(),
        ]
      )
      db.close()
    }

    test('returns 501 when no chunks have been ingested', async () => {
      // Runs first in this describe block, before any sibling test below
      // seeds a row — Gemini IS configured on the outer proc (both providers
      // are, for this whole file's main suite), so this isolates the "empty
      // knowledge_chunks table" half of the compliance-audit gate from the
      // "Gemini not configured" half, which gets its own server below.
      const res = await post({ task: 'compliance-audit', page: VALID_PAGE })
      expect(res.status).toBe(501)
      const body = await res.json()
      expect(body.error).toContain('bun run ingest')
    })

    test('rejects compliance-audit without a page', async () => {
      // Zod requires `page` for this task (unlike `content`, where it is
      // optional), so this is a 400 from request validation and never
      // reaches the knowledge-base gate at all.
      const res = await post({ task: 'compliance-audit' })
      expect(res.status).toBe(400)
    })

    test('embeds the page, retrieves the closest chunk, and returns cited findings', async () => {
      seedChunk({
        id: 'hhvc-policy/rats.md#0',
        sourceFile: 'hhvc-policy/rats.md',
        headingPath: 'Reporting a sighting',
        content: 'Reporting a sighting\n\nCall 311 to report rats.',
        embedding: [1, 0, 0],
      })

      geminiStub.queue = [
        // First call: embedContent for the page under review.
        { body: geminiEmbeddingResponse([1, 0, 0]) },
        // Second call: generateContent for the audit itself.
        {
          body: geminiResponse({
            findings: [
              {
                issue: 'The page never mentions calling 311.',
                severity: 'error',
                citedChunkIds: ['hhvc-policy/rats.md#0'],
                recommendation: 'Add a step telling the reader to call 311.',
              },
            ],
            summary: 'One grounded finding about the missing 311 instruction.',
          }),
        },
      ]

      const res = await post({ task: 'compliance-audit', page: VALID_PAGE, provider: 'gemini' })
      expect(res.status).toBe(200)
      const body = await res.json()

      expect(body.task).toBe('compliance-audit')
      expect(body.provider).toBe('gemini')
      expect(body.valid).toBe(true)
      expect(body.findings).toHaveLength(1)
      // citedSources is resolved server-side from the matched chunk row, not
      // echoed back from the model — this is the assertion that proves that
      // resolution actually happened rather than merely returning 200.
      expect(body.findings[0].citedSources[0].sourceFile).toBe('hhvc-policy/rats.md')
      expect(body.disclosure).toContain('AI-assisted draft')

      // Two Gemini calls: the embed, then the generate. Confirms the
      // embed-then-generate sequence actually reached the stub twice, not
      // that a single call happened to satisfy both expectations.
      expect(geminiStub.requests).toHaveLength(2)
    })

    test('retries once when the model cites a chunk id that was never retrieved', async () => {
      seedChunk({
        id: 'hhvc-policy/rats.md#0',
        sourceFile: 'hhvc-policy/rats.md',
        headingPath: 'Reporting a sighting',
        content: 'Reporting a sighting\n\nCall 311 to report rats.',
        embedding: [1, 0, 0],
      })

      geminiStub.queue = [
        { body: geminiEmbeddingResponse([1, 0, 0]) },
        {
          // First generate attempt cites an id that was never retrieved.
          body: geminiResponse({
            findings: [
              {
                issue: 'Bad citation',
                severity: 'error',
                citedChunkIds: ['nonexistent.md#0'],
                recommendation: 'x',
              },
            ],
            summary: 'x',
          }),
        },
        {
          // Second attempt cites the real, retrieved id.
          body: geminiResponse({
            findings: [
              {
                issue: 'Fixed citation',
                severity: 'error',
                citedChunkIds: ['hhvc-policy/rats.md#0'],
                recommendation: 'x',
              },
            ],
            summary: 'x',
          }),
        },
      ]

      const res = await post({ task: 'compliance-audit', page: VALID_PAGE, provider: 'gemini' })
      expect(res.status).toBe(200)
      const body = await res.json()

      expect(body.attempts).toBe(2)
      expect(body.valid).toBe(true)
      expect(body.findings[0].issue).toBe('Fixed citation')
      // Embed once, generate twice: 3 Gemini calls total.
      expect(geminiStub.requests).toHaveLength(3)
      // The retry turn named the bad id from attempt 1, the same
      // "state what was wrong" contract the content task's retry uses.
      const retryPrompt = JSON.stringify(geminiStub.requests[2].contents)
      expect(retryPrompt).toContain('nonexistent.md#0')
    })
  })
})

// A standalone server with only Anthropic configured (GEMINI_API_KEY
// explicitly blanked, since isolatedApiEnvironment only strips
// REVIEW_API_*, and a developer's real exported key would otherwise turn
// "unconfigured" into "configured" and silently invalidate this test). This
// is the other half of the compliance-audit gate: Gemini is the ONLY
// embedding source (see provider-gemini.js), so a request naming any
// provider — even Claude, which the earlier tests use to generate the audit
// TEXT — must still fail closed if there is no Gemini key to embed with.
describe('compliance-audit task when Gemini is not configured', () => {
  const NO_GEMINI_PORT = 8138
  const noGeminiBase = `http://127.0.0.1:${NO_GEMINI_PORT}`
  let proc
  let stubServer
  let dbDir

  beforeAll(async () => {
    dbDir = createTestDbDir('no-gemini')

    stubServer = Bun.serve({
      port: NO_GEMINI_PORT + 1000,
      hostname: '127.0.0.1',
      async fetch(req) {
        const url = new URL(req.url)
        if (url.pathname === '/v1/models') {
          return Response.json({
            data: [{ id: 'claude-opus-5', display_name: 'Claude Opus 5', type: 'model' }],
            has_more: false,
          })
        }
        return Response.json(messageResponse(VALID_PAGE))
      },
    })

    proc = Bun.spawn(['bun', 'run', 'server.ts'], {
      cwd: ROOT,
      env: isolatedApiEnvironment({
        PORT: String(NO_GEMINI_PORT),
        HOST: '127.0.0.1',
        REVIEW_API_TOKEN: TOKEN,
        ANTHROPIC_API_KEY: 'sk-ant-stub',
        ANTHROPIC_BASE_URL: `http://127.0.0.1:${NO_GEMINI_PORT + 1000}`,
        GEMINI_API_KEY: '',
        DATA_DB_PATH: path.join(dbDir, 'review-state.db'),
      }),
      stdout: 'ignore',
      stderr: 'ignore',
    })
    await waitForServer(`${noGeminiBase}/api/ai/capabilities`)
  })

  afterAll(() => {
    proc?.kill()
    stubServer?.stop(true)
    fs.rmSync(dbDir, { recursive: true, force: true })
  })

  test('returns 501 naming GEMINI_API_KEY, even though Claude is configured', async () => {
    // Claude IS configured here (it could generate the audit text), but the
    // request must still fail closed: there is no provider that can embed
    // the page, so retrieval can never run.
    const res = await fetch(`${noGeminiBase}/api/ai/generate`, {
      method: 'POST',
      headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ task: 'compliance-audit', page: VALID_PAGE }),
    })
    expect(res.status).toBe(501)
    const body = await res.json()
    expect(body.error).toContain('GEMINI_API_KEY')
  })
})

describe('AI assist API when unconfigured', () => {
  const UNCONFIGURED_PORT = 8133
  const unconfiguredBase = `http://127.0.0.1:${UNCONFIGURED_PORT}`
  let proc
  let dbDir

  beforeAll(async () => {
    dbDir = createTestDbDir('unconfigured')
    proc = Bun.spawn(['bun', 'run', 'server.ts'], {
      cwd: ROOT,
      env: isolatedApiEnvironment({
        PORT: String(UNCONFIGURED_PORT),
        HOST: '127.0.0.1',
        REVIEW_API_TOKEN: TOKEN,
        ANTHROPIC_API_KEY: '',
        // Blanked explicitly, like the Anthropic key. The spawn inherits
        // process.env, so a developer who has a real Gemini key exported would
        // otherwise turn "unconfigured" into "configured with one provider" and
        // every assertion in this block would fail on their machine only.
        GEMINI_API_KEY: '',
        DATA_DB_PATH: path.join(dbDir, 'review-state.db'),
      }),
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
    const body = await res.json()
    expect(body.providers.claude).toBe(false)
    expect(body.providers.gemini).toBe(false)
    // Every REGISTERED provider is listed, including the unconfigured ones, so
    // the panel can say "this server has no Gemini key" rather than only
    // "Gemini is not a thing here". Those want different copy.
    expect(body.defaultProvider).toBeNull()
  })

  test('fails closed on generate with 501, never an unauthenticated success', async () => {
    const res = await fetch(`${unconfiguredBase}/api/ai/generate`, {
      method: 'POST',
      headers: authed(),
      body: JSON.stringify({ task: 'content', prompt: 'Draft a page.' }),
    })
    expect(res.status).toBe(501)
    // Names both keys: with two providers registered, pointing only at
    // ANTHROPIC_API_KEY would send an operator who intended to run Gemini off
    // to set a key they do not want.
    const { error } = await res.json()
    expect(error).toContain('ANTHROPIC_API_KEY')
    expect(error).toContain('GEMINI_API_KEY')
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
    dbDir = createTestDbDir('request-timeout')

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
      env: isolatedApiEnvironment({
        PORT: String(TIMEOUT_PORT),
        HOST: '127.0.0.1',
        REVIEW_API_TOKEN: TOKEN,
        ANTHROPIC_API_KEY: 'sk-ant-stub',
        ANTHROPIC_BASE_URL: `http://127.0.0.1:${TIMEOUT_STUB_PORT}`,
        AI_REQUEST_TIMEOUT_MS: '400',
        DATA_DB_PATH: path.join(dbDir, 'review-state.db'),
      }),
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
    expect((await res.json()).error).toBe('Generation timed out.')
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
    dbDir = createTestDbDir('sdk-timeout')

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
      env: isolatedApiEnvironment({
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
      }),
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
    expect((await res.json()).error).toBe('Generation timed out.')
  })
})
