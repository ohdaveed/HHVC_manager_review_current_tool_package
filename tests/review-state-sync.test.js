// Unit tests for js/review-state-sync.js's pull/push conflict-handling logic.
// This file is browser-only (an IIFE with no top-level exports) except for a
// dual module.exports tail mirroring js/review-merge.js's pattern, added
// specifically to make this logic testable here without a real browser/DOM.
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
const { mergeReviewRecord, combineHistory } = require('../js/review-merge.js')

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

function loadReviewStateSync({ localPages = {}, apiUrl = 'https://example.test' } = {}) {
  let state = { version: 1, updated_at: '', ui: {}, globals: {}, pages: { ...localPages } }

  const store = new Map()
  store.set('hhvcReviewSyncConfig', JSON.stringify({ apiUrl, apiToken: 'test-token' }))
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
    reviewMerge: { mergeReviewRecord, combineHistory },
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
    expect(result.conflicts).toEqual([])
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
    expect(result.conflicts).toEqual([])
    // Untouched — same content as before the pull.
    expect(getState().pages.pestsTopic).toEqual(localRecord)
  })

  test('reports (but does not auto-merge) a page that has diverged from an un-synced server revision', async () => {
    // Regression coverage for a real data-loss bug: an earlier version of
    // pullFromServer merged the server record with the ENTIRE local record
    // as the patch, which let this browser's stale copies of fields Bob
    // changed on the server (e.g. `reviewer`) get silently overwritten by
    // Alice's local snapshot on the next push. There is no safe way to
    // auto-resolve this without a stored 3-way base, so the record must be
    // left untouched and the conflict must be surfaced instead of guessed at.
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
    expect(result.pulledCount).toBe(0)
    expect(result.conflicts).toEqual(['ratsReport'])
    // Completely untouched — no field-level guessing, no synced_at bump
    // that would let a later push silently pass the staleness check.
    expect(getState().pages.ratsReport).toEqual(localRecord)
  })
})

describe('writeConfig server-switch safety', () => {
  test('clears synced_at on every local page when the sync server URL changes', async () => {
    const localPages = {
      pestsTopic: {
        page_key: 'pestsTopic',
        decision: 'Approved',
        synced_at: '2026-01-01T00:00:00.000Z',
      },
      ratsReport: {
        page_key: 'ratsReport',
        decision: 'Blocked',
        synced_at: '2026-01-02T00:00:00.000Z',
      },
    }
    const { mod, getState } = loadReviewStateSync({ localPages, apiUrl: 'https://old-deploy.test' })

    mod.writeConfig({ apiUrl: 'https://new-deploy.test', apiToken: 'test-token' })

    const state = getState()
    expect(state.pages.pestsTopic.synced_at).toBe('')
    expect(state.pages.ratsReport.synced_at).toBe('')
    // Only synced_at is touched — everything else on each record survives.
    expect(state.pages.pestsTopic.decision).toBe('Approved')
    expect(state.pages.ratsReport.decision).toBe('Blocked')
  })

  test('leaves synced_at alone when the URL is unchanged (e.g. just updating the token)', async () => {
    const localPages = {
      pestsTopic: {
        page_key: 'pestsTopic',
        decision: 'Approved',
        synced_at: '2026-01-01T00:00:00.000Z',
      },
    }
    const { mod, getState } = loadReviewStateSync({
      localPages,
      apiUrl: 'https://same-deploy.test',
    })

    mod.writeConfig({ apiUrl: 'https://same-deploy.test', apiToken: 'a-new-token' })

    expect(getState().pages.pestsTopic.synced_at).toBe('2026-01-01T00:00:00.000Z')
  })

  test('does not touch synced_at on first-ever configuration (no previous URL to compare against)', async () => {
    const localPages = {
      pestsTopic: { page_key: 'pestsTopic', decision: 'Approved', synced_at: '' },
    }
    const { mod, getState } = loadReviewStateSync({ localPages, apiUrl: '' })

    mod.writeConfig({ apiUrl: 'https://first-deploy.test', apiToken: 'test-token' })

    expect(getState().pages.pestsTopic.synced_at).toBe('')
  })
})

describe('pushPage preserves server history when local changes during the request', () => {
  test('folds the server-appended history entry into local history instead of dropping it', async () => {
    const record = {
      page_key: 'pestsTopic',
      decision: 'Needs review',
      notes: 'about to push',
      updated_at: '2026-01-01T00:00:00.000Z',
      synced_at: '',
      history: [{ timestamp: '2026-01-01T00:00:00.000Z', decision: 'Needs review' }],
    }
    const { mod, getState } = loadReviewStateSync({ localPages: { pestsTopic: record } })

    // Simulate a debounced autosave landing while the PUT is in flight: by
    // the time the (fake) network response resolves, local state has moved
    // on to a newer record than the one pushPage read and sent.
    const newerLocalRecord = {
      ...record,
      notes: 'edited again before the push response arrived',
      updated_at: '2026-01-02T00:00:00.000Z',
    }
    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => {
        global.window.reviewState.update((state) => ({
          ...state,
          pages: { ...state.pages, pestsTopic: newerLocalRecord },
        }))
        return {
          ...record,
          decision: 'Approved',
          updated_at: '2026-01-01T00:00:01.000Z',
          history: [
            { timestamp: '2026-01-01T00:00:00.000Z', decision: 'Needs review' },
            { timestamp: '2026-01-01T00:00:01.000Z', decision: 'Approved', updated_by: 'sync' },
          ],
        }
      },
    })

    const result = await mod.pushPage('pestsTopic')

    expect(result.ok).toBe(true)
    const page = getState().pages.pestsTopic
    // The newer local edit is preserved, not overwritten by the server's response...
    expect(page.notes).toBe('edited again before the push response arrived')
    // ...but the server's sync-round history entry is folded in, not lost.
    expect(page.history).toHaveLength(2)
    expect(page.history.map((entry) => entry.updated_by)).toEqual([undefined, 'sync'])
    expect(page.synced_at).toBe('2026-01-01T00:00:01.000Z')
  })
})
