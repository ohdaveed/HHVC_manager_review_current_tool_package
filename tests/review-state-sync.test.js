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
const { mergeReviewRecord, combineHistory, reviewContentEquals } = require('../js/review-merge.js')

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
    reviewMerge: { mergeReviewRecord, combineHistory, reviewContentEquals },
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

describe('pullFromServer revision handling', () => {
  test('applies a server revision this browser has not observed, when nothing is unpushed', async () => {
    const localRecord = {
      page_key: 'pestsTopic',
      decision: 'Needs review',
      notes: 'stale local notes',
      updated_at: '2026-01-01T00:00:00.000Z',
      synced_at: '2026-01-01T00:00:00.000Z',
      local_dirty: false,
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
    expect(page.local_dirty).toBe(false)
  })

  test('no-ops when the server holds no revision newer than the one already observed', async () => {
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
      synced_at: '2026-01-01T00:00:00.000Z',
      local_dirty: true,
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

  test('does not discard an unpushed local edit just because the browser clock lags the server', async () => {
    // Regression coverage for a real data-loss bug: the decision used to
    // compare the server's updated_at against the LOCAL record's
    // updated_at, which is stamped by the browser's own clock. On a browser
    // running behind the server, a genuine unsynced local edit carries an
    // updated_at that looks older than an unchanged server record, so the
    // server's copy was applied wholesale and the edit vanished. Both
    // values in the real comparison are now server-issued (synced_at vs the
    // server's updated_at), so clock skew can't reach the decision at all.
    const serverRecord = {
      page_key: 'pestsTopic',
      decision: 'Approved',
      notes: 'server notes',
      // Server clock is well ahead of this browser's.
      updated_at: '2026-06-01T00:00:00.000Z',
      history: [],
    }
    const localRecord = {
      page_key: 'pestsTopic',
      decision: 'Blocked',
      notes: 'unpushed local edit made on a lagging browser clock',
      // Browser clock: older than the server's timestamp despite being the
      // more recent *edit*.
      updated_at: '2026-01-05T00:00:00.000Z',
      // ...but this browser HAS already observed the server's current
      // revision, so there is nothing new to pull.
      synced_at: '2026-06-01T00:00:00.000Z',
      local_dirty: true,
      history: [],
    }
    const { mod, getState } = loadReviewStateSync({ localPages: { pestsTopic: localRecord } })
    global.fetch = fetchReturning({ pestsTopic: serverRecord })

    const result = await mod.pullFromServer()

    expect(result.ok).toBe(true)
    expect(result.pulledCount).toBe(0)
    expect(result.conflicts).toEqual([])
    expect(getState().pages.pestsTopic).toEqual(localRecord)
  })

  test('treats a legacy record with no local_dirty field as unsynced, not as clean', async () => {
    // Regression coverage for an upgrade-path data-loss bug: every record
    // saved before local_dirty existed lacks the field, and the storage
    // version was deliberately not bumped (the field is additive). Reading
    // a missing flag as "clean" would let the first pull after an upgrade
    // wholesale replace reviews this browser may never have pushed.
    const serverRecord = {
      page_key: 'pestsTopic',
      decision: 'Approved',
      notes: 'server notes',
      updated_at: '2026-01-02T00:00:00.000Z',
      history: [],
    }
    const legacyRecord = {
      page_key: 'pestsTopic',
      decision: 'Blocked',
      notes: 'review written before this browser was upgraded',
      updated_at: '2026-01-01T00:00:00.000Z',
      // No synced_at and, crucially, no local_dirty at all.
      history: [],
    }
    const { mod, getState } = loadReviewStateSync({ localPages: { pestsTopic: legacyRecord } })
    global.fetch = fetchReturning({ pestsTopic: serverRecord })

    const result = await mod.pullFromServer()

    expect(result.ok).toBe(true)
    expect(result.pulledCount).toBe(0)
    expect(result.conflicts).toEqual(['pestsTopic'])
    expect(getState().pages.pestsTopic).toEqual(legacyRecord)
  })

  test('reports (but does not auto-merge) a page with unpushed edits and a newer server revision', async () => {
    // Regression coverage for a second real data-loss bug: an earlier
    // version merged the server record with the ENTIRE local record as the
    // patch, which let this browser's stale copies of fields Bob changed on
    // the server (e.g. `reviewer`) silently overwrite them on the next
    // push. There is no safe way to auto-resolve this without a stored
    // 3-way base, so the record must be left untouched and the conflict
    // surfaced instead of guessed at.
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
      // Behind the server's revision: this browser never observed Bob's push.
      synced_at: '2026-01-01T00:00:00.000Z',
      local_dirty: true,
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
    // The server's copy comes back so the reviewer can resolve the exact
    // revision they were shown.
    expect(result.conflictRecords.ratsReport).toEqual(serverRecord)
    // Completely untouched — no field-level guessing, no synced_at bump
    // that would let a later push silently pass the staleness check.
    expect(getState().pages.ratsReport).toEqual(localRecord)
  })
})

describe('resolveConflict', () => {
  const serverRecord = {
    page_key: 'ratsReport',
    decision: 'Approved',
    notes: 'server notes',
    reviewer: 'Bob',
    updated_at: '2026-01-02T00:00:00.000Z',
    history: [],
  }
  const localRecord = {
    page_key: 'ratsReport',
    decision: 'Blocked',
    notes: 'local notes',
    reviewer: 'Alice',
    updated_at: '2026-01-03T00:00:00.000Z',
    synced_at: '2026-01-01T00:00:00.000Z',
    local_dirty: true,
    history: [],
  }

  test("'server' adopts the server copy and marks the page clean", async () => {
    const { mod, getState } = loadReviewStateSync({ localPages: { ratsReport: localRecord } })

    expect(mod.resolveConflict('ratsReport', 'server', serverRecord).ok).toBe(true)

    const page = getState().pages.ratsReport
    expect(page.decision).toBe('Approved')
    expect(page.notes).toBe('server notes')
    expect(page.synced_at).toBe('2026-01-02T00:00:00.000Z')
    expect(page.local_dirty).toBe(false)
  })

  test("'local' keeps local content but adopts the server revision as observed", async () => {
    const { mod, getState } = loadReviewStateSync({ localPages: { ratsReport: localRecord } })

    expect(mod.resolveConflict('ratsReport', 'local', serverRecord).ok).toBe(true)

    const page = getState().pages.ratsReport
    // Content is untouched...
    expect(page.decision).toBe('Blocked')
    expect(page.notes).toBe('local notes')
    // ...but the baseline advances, so the next push stops getting a 409
    // and this browser's version wins the page.
    expect(page.synced_at).toBe('2026-01-02T00:00:00.000Z')
    expect(page.local_dirty).toBe(true)
  })

  test('rejects an unknown resolution instead of silently doing nothing', async () => {
    const { mod, getState } = loadReviewStateSync({ localPages: { ratsReport: localRecord } })

    const outcome = mod.resolveConflict('ratsReport', 'whatever', serverRecord)

    expect(outcome.ok).toBe(false)
    expect(getState().pages.ratsReport).toEqual(localRecord)
  })

  test('refuses to resolve against a server the settings no longer point at', async () => {
    // Regression coverage: conflict rows captured a serverRecord from
    // server X. If the reviewer then saved server Y, acting on a stale row
    // would import X's content — and 'local' would restore X's revision
    // into synced_at right after writeConfig cleared it, letting a later
    // push pass Y's staleness check against content never observed there.
    const { mod, getState } = loadReviewStateSync({
      localPages: { ratsReport: localRecord },
      apiUrl: 'https://server-x.test',
    })

    mod.writeConfig({ apiUrl: 'https://server-y.test', apiToken: 'test-token' })

    const outcome = mod.resolveConflict(
      'ratsReport',
      'local',
      serverRecord,
      'https://server-x.test'
    )

    expect(outcome.ok).toBe(false)
    expect(outcome.error).toMatch(/sync server changed/i)
    // writeConfig's baseline clearing stands — not re-minted by the stale row.
    expect(getState().pages.ratsReport.synced_at).toBe('')
  })

  test('still resolves when the endpoint is unchanged', async () => {
    const { mod, getState } = loadReviewStateSync({
      localPages: { ratsReport: localRecord },
      apiUrl: 'https://server-x.test',
    })

    const outcome = mod.resolveConflict(
      'ratsReport',
      'local',
      serverRecord,
      'https://server-x.test'
    )

    expect(outcome.ok).toBe(true)
    expect(getState().pages.ratsReport.synced_at).toBe('2026-01-02T00:00:00.000Z')
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

  test('clears baselines across a clear-then-reconfigure, not just a direct swap', async () => {
    // Regression coverage: requiring BOTH the old and new URL to be
    // non-empty meant clearing the settings (X -> '') skipped the clear,
    // and then configuring a different server ('' -> Y) skipped it again —
    // carrying X's baselines all the way to Y, where a coincidentally
    // newer timestamp could pass Y's staleness check and overwrite records
    // this browser had never seen.
    const localPages = {
      pestsTopic: {
        page_key: 'pestsTopic',
        decision: 'Approved',
        synced_at: '2026-01-01T00:00:00.000Z',
      },
    }
    const { mod, getState } = loadReviewStateSync({ localPages, apiUrl: 'https://old-deploy.test' })

    mod.writeConfig({ apiUrl: '', apiToken: '' })
    expect(getState().pages.pestsTopic.synced_at).toBe('')

    mod.writeConfig({ apiUrl: 'https://new-deploy.test', apiToken: 'test-token' })
    expect(getState().pages.pestsTopic.synced_at).toBe('')
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
})

describe('pushPage', () => {
  test('clears local_dirty when it adopts the server response', async () => {
    const record = {
      page_key: 'pestsTopic',
      decision: 'Needs review',
      notes: 'ready to push',
      updated_at: '2026-01-01T00:00:00.000Z',
      synced_at: '',
      local_dirty: true,
      history: [],
    }
    const { mod, getState } = loadReviewStateSync({ localPages: { pestsTopic: record } })
    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ...record,
        decision: 'Approved',
        updated_at: '2026-01-01T00:00:01.000Z',
        local_dirty: false,
        history: [{ timestamp: '2026-01-01T00:00:01.000Z', updated_by: 'sync' }],
      }),
    })

    const result = await mod.pushPage('pestsTopic')

    expect(result.ok).toBe(true)
    const page = getState().pages.pestsTopic
    expect(page.decision).toBe('Approved')
    expect(page.synced_at).toBe('2026-01-01T00:00:01.000Z')
    expect(page.local_dirty).toBe(false)
  })

  test('folds the server-appended history entry into local history when local changes mid-push', async () => {
    const record = {
      page_key: 'pestsTopic',
      decision: 'Needs review',
      notes: 'about to push',
      updated_at: '2026-01-01T00:00:00.000Z',
      synced_at: '',
      local_dirty: true,
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
    // Still dirty: the mid-flight edit has not reached the server.
    expect(page.local_dirty).toBe(true)
  })
})
