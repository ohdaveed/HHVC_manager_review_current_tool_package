// Unit tests for js/review-state-sync.js's pull conflict-resolution logic
// (round 4 fix: the "local looks newer" branch in pullFromServer must merge
// diverged records instead of silently skipping forever — see
// js/review-state-sync.js's pullFromServer doc comment and CLAUDE.md's
// "Review-state sync backend" section). This file is browser-only (an IIFE
// with no top-level exports) except for a dual module.exports tail mirroring
// js/review-merge.js's pattern, added specifically to make this logic
// testable here without a real browser/DOM.
//
// bun:test runs every test file in one shared process, and other files
// (tests/review-api-server.test.js) make real fetch() calls against a
// spawned server. Stubbing global.fetch/window/localStorage here without
// restoring them afterward permanently overwrites those globals for the
// REST of the process, silently corrupting any real fetch() call that
// happens to run later — exactly what broke review-api-server.test.js in
// CI (every request appeared to return this file's last mock response).
// beforeEach/afterEach save and restore the originals around every test so
// the stubbing window is scoped to this file's own tests only.
const { describe, test, expect, beforeEach, afterEach } = require('bun:test')
const path = require('path')
const { mergeReviewRecord } = require('../js/review-merge.js')

const MODULE_PATH = path.resolve(__dirname, '../js/review-state-sync.js')

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

function loadReviewStateSync({ localPages = {} } = {}) {
  let state = { version: 1, updated_at: '', ui: {}, globals: {}, pages: { ...localPages } }

  const store = new Map()
  store.set(
    'hhvcReviewSyncConfig',
    JSON.stringify({ apiUrl: 'https://example.test', apiToken: 'test-token' })
  )
  global.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  }

  global.window = {
    reviewState: {
      read: () => state,
      update: (updater) => {
        state = updater(state)
        return state
      },
    },
    reviewMerge: { mergeReviewRecord },
    HHVC_DATA: { pages: { pestsTopic: {}, ratsReport: {} } },
  }

  delete require.cache[MODULE_PATH]
  const mod = require(MODULE_PATH)
  return { mod, getState: () => state }
}

function fetchReturning(serverPages) {
  return async () => ({
    ok: true,
    status: 200,
    json: async () => ({ version: 1, updated_at: null, ui: {}, globals: {}, pages: serverPages }),
  })
}

describe('pullFromServer conflict resolution', () => {
  test('applies the server record wholesale when it is strictly newer than local', async () => {
    const localRecord = {
      page_key: 'pestsTopic',
      decision: 'Needs review',
      notes: 'stale local notes',
      updated_at: '2026-01-01T00:00:00.000Z',
      synced_at: '2026-01-01T00:00:00.000Z',
      history: [{ timestamp: '2026-01-01T00:00:00.000Z', decision: 'Needs review' }],
    }
    const serverRecord = {
      page_key: 'pestsTopic',
      decision: 'Approved',
      notes: 'server notes',
      updated_at: '2026-01-02T00:00:00.000Z',
      history: [{ timestamp: '2026-01-02T00:00:00.000Z', decision: 'Approved' }],
    }
    const { mod, getState } = loadReviewStateSync({ localPages: { pestsTopic: localRecord } })
    global.fetch = fetchReturning({ pestsTopic: serverRecord })

    const result = await mod.pullFromServer()

    expect(result.ok).toBe(true)
    expect(result.pulledCount).toBe(1)
    const page = getState().pages.pestsTopic
    expect(page.decision).toBe('Approved')
    expect(page.notes).toBe('server notes')
    expect(page.synced_at).toBe('2026-01-02T00:00:00.000Z')
  })

  test('no-ops when local is newer but has already reconciled this exact server revision', async () => {
    const serverRecord = {
      page_key: 'pestsTopic',
      decision: 'Approved',
      notes: 'server notes',
      updated_at: '2026-01-01T00:00:00.000Z',
      history: [],
    }
    const localRecord = {
      page_key: 'pestsTopic',
      decision: 'Approved with local edits',
      notes: 'local notes after reconciling',
      updated_at: '2026-01-03T00:00:00.000Z',
      // Already at/past the server's updated_at: this browser has already
      // seen this revision and edited on top of it locally.
      synced_at: '2026-01-01T00:00:00.000Z',
      history: [{ timestamp: '2026-01-03T00:00:00.000Z', decision: 'Approved with local edits' }],
    }
    const { mod, getState } = loadReviewStateSync({ localPages: { pestsTopic: localRecord } })
    global.fetch = fetchReturning({ pestsTopic: serverRecord })

    const result = await mod.pullFromServer()

    expect(result.ok).toBe(true)
    expect(result.pulledCount).toBe(0)
    // Untouched — same content as before the pull.
    expect(getState().pages.pestsTopic).toEqual(localRecord)
  })

  test('merges when local is newer but has diverged from an un-synced server revision', async () => {
    const serverRecord = {
      page_key: 'ratsReport',
      decision: 'Approved',
      notes: 'server notes from another reviewer',
      reviewer: 'Bob',
      updated_at: '2026-01-02T00:00:00.000Z',
      history: [{ timestamp: '2026-01-02T00:00:00.000Z', decision: 'Approved', reviewer: 'Bob' }],
    }
    const localRecord = {
      page_key: 'ratsReport',
      decision: 'Blocked',
      notes: 'local notes never pushed',
      reviewer: 'Alice',
      updated_at: '2026-01-03T00:00:00.000Z',
      // Behind the server's updated_at: this browser never observed Bob's push.
      synced_at: '2026-01-01T00:00:00.000Z',
      history: [
        { timestamp: '2026-01-01T00:00:00.000Z', decision: 'Needs review', reviewer: 'Alice' },
      ],
    }
    const { mod, getState } = loadReviewStateSync({ localPages: { ratsReport: localRecord } })
    global.fetch = fetchReturning({ ratsReport: serverRecord })

    const result = await mod.pullFromServer()

    expect(result.ok).toBe(true)
    expect(result.pulledCount).toBe(1)
    const page = getState().pages.ratsReport
    // Local's own newer edits win field-by-field over the server's.
    expect(page.decision).toBe('Blocked')
    expect(page.notes).toBe('local notes never pushed')
    expect(page.reviewer).toBe('Alice')
    // The sync baseline advances to what the server had, breaking the
    // otherwise-permanent 409 loop on the next push.
    expect(page.synced_at).toBe('2026-01-02T00:00:00.000Z')
    expect(page.page_key).toBe('ratsReport')
    // Both sides' history rounds survive, plus the new merge boundary entry.
    expect(page.history).toHaveLength(3)
    expect(page.history.map((entry) => entry.reviewer)).toEqual(['Alice', 'Bob', 'Alice'])
  })
})
