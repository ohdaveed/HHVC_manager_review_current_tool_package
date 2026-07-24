// Integration tests for the optional /api/review-state* routes added to
// server.ts. Spawns the real server as a subprocess (rather than importing
// server.ts, which would trigger its top-level Bun.serve() side effect on
// whatever port/token this test process happens to have) so these tests
// exercise the exact code path a deployed Railway instance runs.
const { describe, test, expect, beforeAll, afterAll } = require('bun:test')
const path = require('path')
const os = require('os')
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

function spawnServer({ port, token, dbDir }) {
  return Bun.spawn(['bun', 'run', 'server.ts'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      REVIEW_API_TOKEN: token,
      DATA_DB_PATH: path.join(dbDir, 'review-state.db'),
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
    dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hhvc-review-api-'))
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
    const res = await fetch(`${base}/api/review-state/pages/pestsTopic`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ notes: 'ready now' }),
    })
    const body = await res.json()
    // decision survives from the first PUT even though this patch never mentioned it.
    expect(body.decision).toBe('Approved')
    expect(body.notes).toBe('ready now')
    expect(body.history.length).toBeGreaterThanOrEqual(2)
  })

  test('PUTs to different page_keys never clobber each other', async () => {
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

  test('CORS preflight succeeds without requiring auth', async () => {
    const res = await fetch(`${base}/api/review-state`, { method: 'OPTIONS' })
    expect(res.status).toBe(204)
  })
})

describe('review-state API without REVIEW_API_TOKEN configured', () => {
  const PORT = 8124
  const base = `http://127.0.0.1:${PORT}`
  let proc
  let dbDir

  beforeAll(async () => {
    dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hhvc-review-api-notoken-'))
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
