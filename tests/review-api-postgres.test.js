// Postgres parity for the /api/review-state* routes.
//
// The sibling suite (tests/review-api-server.test.js) proves these behaviours
// against SQLite, which is what CI runs. This one proves the SAME behaviours
// against a real Postgres, because the two drivers in build_scripts/storage.js
// express the compare-and-swap differently — SQLite reports `changes`, Postgres
// reports rows RETURNINGed — and a lost update there is silent. Asserting the
// SQL by reading it is not enough; the only convincing evidence is a second
// writer actually losing the race.
//
// **Skipped unless a Postgres is reachable.** It looks for TEST_DATABASE_URL,
// then a local server on the default port. CI has neither, so this suite is a
// developer/pre-deploy check rather than a gate — adding a service container to
// the one CI job that currently needs nothing is a cost with no matching risk,
// since the SQLite suite already covers the route logic and this file covers
// only the dialect.
const { describe, test, expect, beforeAll, afterAll } = require('bun:test')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const PORT = 8137
const TOKEN = 'test-review-api-token'
const base = `http://127.0.0.1:${PORT}`

/**
 * Resolve the Postgres to test against, or null to skip the suite.
 *
 * @returns {string|null}
 */
function resolveDatabaseUrl() {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL
  const ready = Bun.spawnSync(['pg_isready', '-q'])
  if (ready.exitCode !== 0) return null
  return 'postgres://localhost:5432/hhvc_parity'
}

const DATABASE_URL = resolveDatabaseUrl()

// This wait window (attempts x 100ms = 8000ms) and the explicit timeout on the
// beforeAll that calls it (15000ms) are a pair: whichever is smaller is what
// actually fires, so the window must stay under the timeout. It did not use to
// — the window was already 8000ms while the hook passed no timeout, leaving it
// on Bun's 5000ms default, so the wait could never run to completion. That was
// invisible because this suite skips without a Postgres; it would have failed
// the first time anyone ran it with one. Change both together or neither.
async function waitForServer(url, attempts = 80) {
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

function authHeaders() {
  return { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' }
}

async function putPage(pageKey, body) {
  return fetch(`${base}/api/review-state/pages/${pageKey}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
}

describe.skipIf(!DATABASE_URL)('review-state API on Postgres', () => {
  let proc
  let sql

  beforeAll(async () => {
    const { SQL } = await import('bun')
    sql = new SQL(DATABASE_URL, { max: 1 })

    proc = Bun.spawn(['bun', 'run', 'server.ts'], {
      cwd: ROOT,
      env: {
        ...process.env,
        PORT: String(PORT),
        HOST: '127.0.0.1',
        REVIEW_API_TOKEN: TOKEN,
        DATABASE_URL,
        // Same reasoning as the SQLite suite: a developer's own hardening
        // values would otherwise turn this into a test of their environment.
        REVIEW_API_PRINCIPALS: undefined,
        REVIEW_API_ALLOWED_ORIGINS: undefined,
      },
      stdout: 'ignore',
      stderr: 'ignore',
    })
    await waitForServer(`${base}/api/review-state`)
    // After boot, so the server's own CREATE TABLE IF NOT EXISTS has run.
    await sql`TRUNCATE review_pages`
  }, 15000)

  afterAll(async () => {
    proc?.kill()
    await sql?.close()
  })

  test('starts against Postgres and reports an empty state', async () => {
    const response = await fetch(`${base}/api/review-state`, { headers: authHeaders() })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.version).toBe(1)
    expect(body.pages).toEqual({})
  })

  test('stores a pushed record and returns it merged with a history entry', async () => {
    const response = await putPage('pestsTopic', {
      page_key: 'pestsTopic',
      decision: 'Approved',
      reviewer: 'PG Tester',
      notes: 'first push',
    })
    expect(response.status).toBe(200)
    const merged = await response.json()
    expect(merged.decision).toBe('Approved')
    expect(merged.history).toHaveLength(1)
    expect(merged.history[0].updated_by).toBe('sync')
    // The server's own merge marks the record clean so the client can adopt it.
    expect(merged.local_dirty).toBe(false)

    const readBack = await fetch(`${base}/api/review-state`, { headers: authHeaders() })
    const state = await readBack.json()
    expect(state.pages.pestsTopic.notes).toBe('first push')
  })

  test('round-trips jsonb without mangling a nested object field', async () => {
    // section_edits is the field most likely to be flattened by a driver that
    // stringifies objects; js/review-merge.js compares it structurally.
    const response = await putPage('scopeInfo', {
      page_key: 'scopeInfo',
      decision: 'Needs review',
      section_edits: { 'sections.0.heading': 'Edited heading' },
      synced_at: '',
    })
    expect(response.status).toBe(200)
    const merged = await response.json()
    expect(merged.section_edits).toEqual({ 'sections.0.heading': 'Edited heading' })
  })

  test('stores the record as a queryable jsonb object, not a JSON string', async () => {
    // The read path parses a string just as happily as an object, so a
    // double-encoded record round-trips through the API looking perfectly
    // correct while `record->>'decision'` returns NULL and every SQL query
    // against reviews silently matches nothing. Passing the JSON as
    // `${JSON.stringify(record)}::jsonb` does exactly that — Bun sends it as a
    // JSON parameter and the cast wraps it. Asserting the stored TYPE is the
    // only thing that catches it.
    await putPage('jsonbShape', {
      page_key: 'jsonbShape',
      decision: 'Approved',
      notes: 'queryable',
      synced_at: '',
    })

    const [row] = await sql`
      SELECT jsonb_typeof(record) AS kind, record->>'decision' AS decision
      FROM review_pages WHERE page_key = 'jsonbShape'
    `
    expect(row.kind).toBe('object')
    expect(row.decision).toBe('Approved')
  })

  test('rejects a stale push instead of overwriting the newer record', async () => {
    const first = await putPage('staleTest', { page_key: 'staleTest', decision: 'Approved' })
    const stored = await first.json()

    const stale = await putPage('staleTest', {
      page_key: 'staleTest',
      decision: 'Blocked',
      // A baseline older than what the server holds.
      synced_at: '2000-01-01T00:00:00.000Z',
    })
    expect(stale.status).toBe(409)
    const conflict = await stale.json()
    expect(conflict.current.decision).toBe('Approved')

    const readBack = await fetch(`${base}/api/review-state`, { headers: authHeaders() })
    const state = await readBack.json()
    expect(state.pages.staleTest.decision).toBe('Approved')
    expect(state.pages.staleTest.updated_at).toBe(stored.updated_at)
  })

  test('rejects a push with no baseline against a page that already exists', async () => {
    await putPage('noBaseline', { page_key: 'noBaseline', decision: 'Approved' })
    const response = await putPage('noBaseline', { page_key: 'noBaseline', decision: 'Blocked' })
    expect(response.status).toBe(409)
  })

  test('accepts a push with a current baseline', async () => {
    const first = await putPage('freshBaseline', {
      page_key: 'freshBaseline',
      decision: 'Approved',
    })
    const stored = await first.json()

    const response = await putPage('freshBaseline', {
      page_key: 'freshBaseline',
      decision: 'Blocked',
      synced_at: stored.updated_at,
    })
    expect(response.status).toBe(200)
    const merged = await response.json()
    expect(merged.decision).toBe('Blocked')
    // Append-only: the earlier round survives the overwrite.
    expect(merged.history.length).toBeGreaterThan(1)
  })

  test('the compare-and-swap refuses a second writer racing the same prior row', async () => {
    const first = await putPage('casTest', { page_key: 'casTest', decision: 'Approved' })
    const stored = await first.json()

    // Both pushes carry the SAME baseline, which is what two replicas that each
    // passed the staleness check against one prior row would do. Exactly one
    // must win; the other's statement has to match nothing.
    const [a, b] = await Promise.all([
      putPage('casTest', {
        page_key: 'casTest',
        decision: 'Blocked',
        synced_at: stored.updated_at,
      }),
      putPage('casTest', {
        page_key: 'casTest',
        decision: 'Revise and resubmit',
        synced_at: stored.updated_at,
      }),
    ])

    const statuses = [a.status, b.status].sort()
    expect(statuses).toEqual([200, 409])
  })

  test('writes to one page never touch another', async () => {
    await putPage('isolationA', { page_key: 'isolationA', decision: 'Approved', notes: 'A' })
    await putPage('isolationB', { page_key: 'isolationB', decision: 'Blocked', notes: 'B' })

    const response = await fetch(`${base}/api/review-state`, { headers: authHeaders() })
    const state = await response.json()
    expect(state.pages.isolationA.notes).toBe('A')
    expect(state.pages.isolationB.notes).toBe('B')
  })
})
