// Integration tests for the optional /api/review-state* routes added to
// server.ts. Spawns the real server as a subprocess (rather than importing
// server.ts, which would trigger its top-level Bun.serve() side effect on
// whatever port/token this test process happens to have) so these tests
// exercise the exact code path a deployed Railway instance runs.
const { describe, test, expect, beforeAll, afterAll } = require('bun:test')
const path = require('path')
const fs = require('fs')

const ROOT = path.resolve(__dirname, '..')

async function waitForServer(url, attempts = 50) {
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
  // Keep test artifacts in this checkout, not the host-wide temp directory:
  // these server subprocesses create SQLite files, and project-local cleanup
  // makes their lifecycle visible if a failed test needs investigation.
  return fs.mkdtempSync(path.join(ROOT, `.review-api-${name}-`))
}

function spawnServer({ port, token, dbDir, staticRoot, extraEnv = {} }) {
  // A developer may have API hardening values in their shell for a local
  // deployment. Tests that exercise the legacy token must explicitly remove
  // them or the opt-in principal config correctly takes precedence and turns
  // this compatibility suite into a test of the developer's environment.
  const env = { ...process.env }
  for (const key of [
    'REVIEW_API_PRINCIPALS',
    'REVIEW_API_ALLOWED_ORIGINS',
    'REVIEW_API_RATE_LIMIT',
    'REVIEW_API_RATE_WINDOW_MS',
  ]) {
    delete env[key]
  }

  return Bun.spawn(['bun', 'run', 'server.ts'], {
    cwd: ROOT,
    env: {
      ...env,
      PORT: String(port),
      HOST: '127.0.0.1',
      REVIEW_API_TOKEN: token,
      DATA_DB_PATH: path.join(dbDir, 'review-state.db'),
      ...(staticRoot === undefined ? {} : { STATIC_ROOT: staticRoot }),
      ...extraEnv,
    },
    stdout: 'ignore',
    stderr: 'ignore',
  })
}

describe('review-state API (server.ts)', () => {
  const PORT = 8123
  const TOKEN = 'test-review-api-token'
  const base = `http://127.0.0.1:${PORT}`
  let proc
  let dbDir

  beforeAll(async () => {
    dbDir = createTestDbDir('legacy')
    proc = spawnServer({ port: PORT, token: TOKEN, dbDir })
    await waitForServer(`${base}/api/review-state`)
  })

  afterAll(() => {
    proc?.kill()
    fs.rmSync(dbDir, { recursive: true, force: true })
  })

  test('rejects requests without a valid bearer token', async () => {
    const res = await fetch(`${base}/api/review-state`)
    expect(res.status).toBe(401)
  })

  test('GET returns empty state before anything is written', async () => {
    const res = await fetch(`${base}/api/review-state`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.version).toBe(1)
    expect(body.pages).toEqual({})
  })

  test('PUT merges a patch and returns the merged record with a history entry', async () => {
    const res = await fetch(`${base}/api/review-state/pages/pestsTopic`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ decision: 'Approved', notes: 'looks good', reviewer: 'David' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.decision).toBe('Approved')
    expect(body.history).toHaveLength(1)
    expect(body.history[0]).toMatchObject({ decision: 'Approved', updated_by: 'sync' })
  })

  test('a second PUT to the same page merges onto the prior record instead of replacing it', async () => {
    // pestsTopic already has a row from the previous test, so this push
    // needs a real synced_at baseline (the prior PUT's own updated_at) —
    // a missing one against an existing row is now rejected (409).
    const first = await fetch(`${base}/api/review-state`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    }).then((r) => r.json())

    const res = await fetch(`${base}/api/review-state/pages/pestsTopic`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ notes: 'ready now', synced_at: first.pages.pestsTopic.updated_at }),
    })
    const body = await res.json()
    // decision survives from the first PUT even though this patch never mentioned it.
    expect(body.decision).toBe('Approved')
    expect(body.notes).toBe('ready now')
    expect(body.history.length).toBeGreaterThanOrEqual(2)
  })

  test('PUTs to different page_keys never clobber each other', async () => {
    // First-ever write to ratsReport — no existing row, so no synced_at needed.
    await fetch(`${base}/api/review-state/pages/ratsReport`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ decision: 'Blocked' }),
    })

    const res = await fetch(`${base}/api/review-state`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    })
    const body = await res.json()
    expect(Object.keys(body.pages).sort()).toEqual(['pestsTopic', 'ratsReport'])
    expect(body.pages.pestsTopic.decision).toBe('Approved')
    expect(body.pages.ratsReport.decision).toBe('Blocked')
  })

  test('rejects a non-object JSON body', async () => {
    const res = await fetch(`${base}/api/review-state/pages/pestsTopic`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify('not an object'),
    })
    expect(res.status).toBe(400)
  })

  test('accepts a record with a long append-only history', async () => {
    // history[] is append-only and the client pushes the WHOLE record, so the
    // body cap is really a ceiling on a page's entire review life, not on one
    // edit. Set too low it becomes a permanent sync lockout: once a record
    // crosses it every push fails, and shortening the current note cannot
    // remove historical copies. 300 rounds with realistic notes is well beyond
    // any real review cycle and must still go through.
    const history = Array.from({ length: 300 }, (_, i) => ({
      timestamp: `2026-07-${String((i % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
      reviewer: 'Dana Alvarez',
      decision: i % 2 ? 'Approved with edits' : 'Revise and resubmit',
      notes:
        'The intro copy still leads with the department name instead of the tenant action. '.repeat(
          6
        ),
      risks_or_blockers: 'Waiting on SME confirmation for the inspection timeline. '.repeat(3),
      updated_by: 'reviewer',
    }))
    const res = await fetch(`${base}/api/review-state/pages/longHistoryPage`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ page_key: 'longHistoryPage', decision: 'Approved', history }),
    })
    expect(res.status).toBe(200)
  })

  test('rejects an oversized body with 413 before parsing or merging it', async () => {
    // This endpoint read req.json() with no size limit at all — the same gap
    // the AI routes had. The cap sits in FRONT of the parse, so an oversized
    // body never reaches mergeReviewRecord and cannot touch a stored record.
    const res = await fetch(`${base}/api/review-state/pages/pestsTopic`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ page_key: 'pestsTopic', notes: 'x'.repeat(2 * 1024 * 1024) }),
    })
    expect(res.status).toBe(413)

    // And the page it targeted is untouched — a rejected write must not be a
    // partial write.
    const after = await fetch(`${base}/api/review-state`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    }).then((r) => r.json())
    expect(after.pages.pestsTopic?.notes || '').not.toContain('xxxx')
  })

  test('rejects a body that fails schema validation (invalid decision enum value)', async () => {
    const before = await fetch(`${base}/api/review-state`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    }).then((r) => r.json())

    const res = await fetch(`${base}/api/review-state/pages/pestsTopic`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ decision: 'Maybe later' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid/i)

    // The invalid PUT must not have changed anything about the record —
    // not just decision, but notes/history/timestamps too.
    const check = await fetch(`${base}/api/review-state`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    })
    const state = await check.json()
    expect(state.pages.pestsTopic).toEqual(before.pages.pestsTopic)
  })

  test('rejects a stale push whose synced_at is older than the server has, without overwriting it', async () => {
    // ratsReport already has a row from the previous test — establishing
    // "current" needs a real synced_at baseline too, same as any other push
    // to an existing row.
    const before = await fetch(`${base}/api/review-state`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    }).then((r) => r.json())

    const current = await fetch(`${base}/api/review-state/pages/ratsReport`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        decision: 'Approved',
        notes: 'current',
        synced_at: before.pages.ratsReport.updated_at,
      }),
    }).then((r) => r.json())
    expect(current.decision).toBe('Approved')

    // A push carrying a synced_at from before that write should be rejected
    // — even though updated_at claims to be from the far future. This is
    // exactly the scenario a pre-push autosave creates in practice: it
    // freely rewrites updated_at to "now" on every push, so the freshness
    // check must key off synced_at (only ever set by an actual sync
    // response), not updated_at, or a stale push always looks fresh.
    const stale = await fetch(`${base}/api/review-state/pages/ratsReport`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        decision: 'Blocked',
        notes: 'stale',
        updated_at: '2099-01-01T00:00:00.000Z',
        synced_at: '2000-01-01T00:00:00.000Z',
      }),
    })
    expect(stale.status).toBe(409)

    // The server's data must be unchanged by the rejected push.
    const stateRes = await fetch(`${base}/api/review-state`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    })
    const state = await stateRes.json()
    expect(state.pages.ratsReport.decision).toBe('Approved')
    expect(state.pages.ratsReport.notes).toBe('current')
  })

  test('accepts a push whose synced_at is newer than the server record', async () => {
    const res = await fetch(`${base}/api/review-state/pages/ratsReport`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        decision: 'Blocked',
        notes: 'genuinely newer',
        synced_at: '2099-01-01T00:00:00.000Z',
      }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.decision).toBe('Blocked')
  })

  test('a push with no synced_at is accepted for a page the server has never seen (true first sync)', async () => {
    // A page with no existing server row at all has nothing to conflict
    // with — the same "no baseline needed" treatment applies. Uses a page
    // key untouched by every other test in this file, since ratsReport
    // already has a row by this point and a missing synced_at against an
    // *existing* row is a different (rejected) case — see the next test.
    const res = await fetch(`${base}/api/review-state/pages/article11Guide`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        decision: 'Approved with edits',
        notes: 'first sync from this browser',
      }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.decision).toBe('Approved with edits')
  })

  test('a push with no synced_at against an EXISTING row is rejected, not treated as first sync', async () => {
    // ratsReport already has a server row from earlier tests. A browser
    // that has never pulled/pushed it before (no synced_at) must not be
    // able to silently overwrite whatever's already there with a stale or
    // blank local snapshot — it must pull first, same as any other stale
    // push.
    const before = await fetch(`${base}/api/review-state`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    }).then((r) => r.json())

    const res = await fetch(`${base}/api/review-state/pages/ratsReport`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        decision: 'Blocked',
        notes: 'never synced this browser',
      }),
    })
    expect(res.status).toBe(409)

    const after = await fetch(`${base}/api/review-state`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    }).then((r) => r.json())
    expect(after.pages.ratsReport).toEqual(before.pages.ratsReport)
  })

  test('blocks dotfile paths from static serving instead of exposing the SQLite DB', async () => {
    const dbRes = await fetch(`${base}/.data/review-state.db`)
    expect(dbRes.status).toBe(404)

    const envRes = await fetch(`${base}/.env.local`)
    expect(envRes.status).toBe(404)

    const gitRes = await fetch(`${base}/.git/config`)
    expect(gitRes.status).toBe(404)
  })

  test('answers a non-CORS preflight without requiring auth or adding a wildcard origin', async () => {
    const res = await fetch(`${base}/api/review-state`, { method: 'OPTIONS' })
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
  })
})

describe('review-state API without REVIEW_API_TOKEN configured', () => {
  const PORT = 8124
  const base = `http://127.0.0.1:${PORT}`
  let proc
  let dbDir

  beforeAll(async () => {
    dbDir = createTestDbDir('no-token')
    proc = spawnServer({ port: PORT, token: '', dbDir })
    await waitForServer(`${base}/api/review-state`)
  })

  afterAll(() => {
    proc?.kill()
    fs.rmSync(dbDir, { recursive: true, force: true })
  })

  test('fails closed (501), not open, when no token is configured on the server', async () => {
    const res = await fetch(`${base}/api/review-state`, {
      headers: { authorization: 'Bearer anything' },
    })
    expect(res.status).toBe(501)
  })
})

// Regression: STATIC_ROOT set-but-empty must fall back to dist/, not resolve to
// the repository root.
//
// The fallback used `??`, which only catches null/undefined, so an empty string
// survived and resolve(APP_DIR, '') returned APP_DIR. The static handler then
// served the entire source tree: /server.ts and /package.json came back 200,
// and / served the unbundled index.html that no browser can run. The dotfile
// guard does not help — it blocks /.env.local and /.git, not ordinary source
// files. An env var that is set but empty is trivially common in shell
// wrappers, CI matrices and container manifests, so this is a realistic
// misconfiguration rather than a contrived one.
describe('review-state API (server.ts) with STATIC_ROOT set but empty', () => {
  const PORT = 8125
  const base = `http://127.0.0.1:${PORT}`
  let proc
  let dbDir

  beforeAll(async () => {
    dbDir = createTestDbDir('empty-static-root')
    proc = spawnServer({ port: PORT, token: 'token', dbDir, staticRoot: '' })
    await waitForServer(`${base}/api/review-state`)
  })

  afterAll(() => {
    proc?.kill()
    fs.rmSync(dbDir, { recursive: true, force: true })
  })

  test('does not serve repository source files', async () => {
    for (const sourcePath of ['/server.ts', '/package.json', '/vite.config.mjs']) {
      const res = await fetch(`${base}${sourcePath}`)
      expect(res.status, `${sourcePath} must not be served`).toBe(404)
    }
  })

  // The 404s above only prove the repository root was not selected. A typo'd
  // or nonexistent static root would 404 those same paths just as happily,
  // so the test would pass while serving nothing at all. Assert the positive
  // case too: the fallback has to land on the real built app.
  //
  // Unlike every other test in this suite, this one needs a build to exist —
  // it is asserting on what dist/ contains. `bun test` on a fresh clone has no
  // dist/, so it skips rather than failing for a reason unrelated to whatever
  // the developer changed. CI runs build:netlify before the unit tests
  // specifically so this never skips there; see the note in ci.yml.
  test.skipIf(!fs.existsSync(path.join(ROOT, 'dist', 'index.html')))(
    'still serves the built application from dist/',
    async () => {
      const res = await fetch(`${base}/`)
      expect(res.status).toBe(200)
      const html = await res.text()
      // The built index.html references Vite's hashed module bundle. The source
      // index.html points at /js/main.js instead, so this also distinguishes
      // "served dist/" from "served the repo root".
      expect(html).toMatch(/<script[^>]+type="module"[^>]+src="[^"]*assets\/index-[^"]+\.js"/)
    }
  )
})

// Principal configuration replaces the broad legacy token with individually
// scoped credentials. These integration tests run against the real server,
// since role checks must happen before both the SQLite write and AI provider
// gate; a mocked handler could easily prove the wrong ordering.
describe('optional API principal roles, CORS, and rate limits', () => {
  const PORT = 8126
  const base = `http://127.0.0.1:${PORT}`
  const TRUSTED_ORIGIN = 'https://manager.example.test'
  const tokens = {
    reader: 'test-reader-token',
    writer: 'test-writer-token',
    ai: 'test-ai-token',
    limited: 'test-rate-limit-token',
  }
  const principals = [
    { principal: 'read-only', token: tokens.reader, roles: ['review:read'] },
    { principal: 'write-only', token: tokens.writer, roles: ['review:write'] },
    { principal: 'ai-drafter', token: tokens.ai, roles: ['ai:generate'] },
    { principal: 'rate-limited', token: tokens.limited, roles: ['review:read'] },
  ]
  let proc
  let dbDir

  function bearer(token, extra = {}) {
    return { authorization: `Bearer ${token}`, ...extra }
  }

  beforeAll(async () => {
    dbDir = createTestDbDir('principals')
    proc = spawnServer({
      port: PORT,
      token: 'legacy-token-must-not-remain-active',
      dbDir,
      extraEnv: {
        REVIEW_API_PRINCIPALS: JSON.stringify(principals),
        REVIEW_API_ALLOWED_ORIGINS: TRUSTED_ORIGIN,
        REVIEW_API_RATE_LIMIT: '2',
        REVIEW_API_RATE_WINDOW_MS: '60000',
      },
    })
    await waitForServer(`${base}/api/review-state`)
  })

  afterAll(() => {
    proc?.kill()
    fs.rmSync(dbDir, { recursive: true, force: true })
  })

  test('enforces separate review read and write roles before touching review state', async () => {
    const read = await fetch(`${base}/api/review-state`, { headers: bearer(tokens.reader) })
    expect(read.status).toBe(200)

    const deniedWrite = await fetch(`${base}/api/review-state/pages/roleCheck`, {
      method: 'PUT',
      headers: bearer(tokens.reader, { 'content-type': 'application/json' }),
      body: JSON.stringify({ decision: 'Approved' }),
    })
    expect(deniedWrite.status).toBe(403)
    expect(deniedWrite.headers.get('x-content-type-options')).toBe('nosniff')
    expect(deniedWrite.headers.get('x-frame-options')).toBe('DENY')

    const deniedRead = await fetch(`${base}/api/review-state`, { headers: bearer(tokens.writer) })
    expect(deniedRead.status).toBe(403)

    const write = await fetch(`${base}/api/review-state/pages/roleCheck`, {
      method: 'PUT',
      headers: bearer(tokens.writer, { 'content-type': 'application/json' }),
      body: JSON.stringify({ decision: 'Approved' }),
    })
    expect(write.status).toBe(200)
  })

  test('requires the AI generation role for AI discovery and generation routes', async () => {
    const allowed = await fetch(`${base}/api/ai/capabilities`, { headers: bearer(tokens.ai) })
    expect(allowed.status).toBe(200)

    const denied = await fetch(`${base}/api/ai/generate`, {
      method: 'POST',
      headers: bearer(tokens.reader, { 'content-type': 'application/json' }),
      body: JSON.stringify({ task: 'content', prompt: 'Draft a page.' }),
    })
    expect(denied.status).toBe(403)
    expect(denied.headers.get('x-content-type-options')).toBe('nosniff')
  })

  test('reflects only trusted and same origins, and rejects an untrusted preflight', async () => {
    const trusted = await fetch(`${base}/api/review-state`, {
      headers: bearer(tokens.reader, { origin: TRUSTED_ORIGIN }),
    })
    expect(trusted.status).toBe(200)
    expect(trusted.headers.get('access-control-allow-origin')).toBe(TRUSTED_ORIGIN)
    expect(trusted.headers.get('vary')).toBe('Origin')

    const sameOrigin = await fetch(`${base}/api/ai/capabilities`, {
      headers: bearer(tokens.ai, { origin: base }),
    })
    expect(sameOrigin.status).toBe(200)
    expect(sameOrigin.headers.get('access-control-allow-origin')).toBe(base)

    const rejected = await fetch(`${base}/api/review-state`, {
      headers: bearer(tokens.reader, { origin: 'https://untrusted.example.test' }),
    })
    expect(rejected.status).toBe(403)
    expect(rejected.headers.get('access-control-allow-origin')).toBeNull()
    expect(rejected.headers.get('x-content-type-options')).toBe('nosniff')

    const preflight = await fetch(`${base}/api/review-state`, {
      method: 'OPTIONS',
      headers: {
        origin: TRUSTED_ORIGIN,
        'access-control-request-method': 'GET',
        'access-control-request-headers': 'authorization',
      },
    })
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('access-control-allow-origin')).toBe(TRUSTED_ORIGIN)

    const deniedPreflight = await fetch(`${base}/api/review-state`, {
      method: 'OPTIONS',
      headers: {
        origin: 'https://untrusted.example.test',
        'access-control-request-method': 'GET',
      },
    })
    expect(deniedPreflight.status).toBe(403)
    expect(deniedPreflight.headers.get('x-frame-options')).toBe('DENY')
  })

  test('limits authenticated principals in bounded role-specific buckets', async () => {
    for (let index = 0; index < 2; index += 1) {
      const res = await fetch(`${base}/api/review-state`, { headers: bearer(tokens.limited) })
      expect(res.status).toBe(200)
    }

    const limited = await fetch(`${base}/api/review-state`, { headers: bearer(tokens.limited) })
    expect(limited.status).toBe(429)
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0)
    expect(limited.headers.get('x-content-type-options')).toBe('nosniff')
  })
})

describe('optional API invalid security configuration', () => {
  const PORT = 8127
  const base = `http://127.0.0.1:${PORT}`
  let proc
  let dbDir

  beforeAll(async () => {
    dbDir = createTestDbDir('invalid-principals')
    proc = spawnServer({
      port: PORT,
      token: 'legacy-token-must-not-bypass-invalid-principals',
      dbDir,
      extraEnv: {
        // A present but malformed opt-in must not fall back to the broad
        // legacy credential, or a deployment typo becomes an escalation.
        REVIEW_API_PRINCIPALS: '{"principal":"missing-array"}',
      },
    })
    await waitForServer(`${base}/api/review-state`)
  })

  afterAll(() => {
    proc?.kill()
    fs.rmSync(dbDir, { recursive: true, force: true })
  })

  test('fails closed instead of falling back to REVIEW_API_TOKEN', async () => {
    const res = await fetch(`${base}/api/review-state`, {
      headers: { authorization: 'Bearer legacy-token-must-not-bypass-invalid-principals' },
    })
    expect(res.status).toBe(503)
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('x-frame-options')).toBe('DENY')
  })
})

describe('optional API invalid CORS configuration', () => {
  const PORT = 8128
  const base = `http://127.0.0.1:${PORT}`
  let proc
  let dbDir

  beforeAll(async () => {
    dbDir = createTestDbDir('invalid-origins')
    proc = spawnServer({
      port: PORT,
      token: 'valid-token-must-not-bypass-invalid-origins',
      dbDir,
      extraEnv: {
        // Origins are exact origins, not URL prefixes. A path must fail
        // closed instead of quietly broadening the browser trust boundary.
        REVIEW_API_ALLOWED_ORIGINS: 'https://manager.example.test/review',
      },
    })
    await waitForServer(`${base}/api/review-state`)
  })

  afterAll(() => {
    proc?.kill()
    fs.rmSync(dbDir, { recursive: true, force: true })
  })

  test('fails closed when an origin allowlist entry is not an exact origin', async () => {
    const res = await fetch(`${base}/api/review-state`, {
      headers: {
        authorization: 'Bearer valid-token-must-not-bypass-invalid-origins',
        origin: 'https://manager.example.test',
      },
    })
    expect(res.status).toBe(503)
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
  })
})
