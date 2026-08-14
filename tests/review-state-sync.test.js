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

  test('reports which pages it applied so their in-memory content can be reset', async () => {
    // A clean pull adopts the server's ABSENCES too — a cleared
    // edited_title has to actually disappear from the in-memory page, or
    // applySavedPageState's truthy-only assignment leaves the old value on
    // screen and the next autosave re-saves it as unpushed work.
    const localRecord = {
      page_key: 'pestsTopic',
      decision: 'Needs review',
      updated_at: '2026-01-01T00:00:00.000Z',
      synced_at: '2026-01-01T00:00:00.000Z',
      local_dirty: false,
      history: [],
    }
    const serverRecord = {
      page_key: 'pestsTopic',
      decision: 'Approved',
      edited_title: '',
      updated_at: '2026-01-02T00:00:00.000Z',
      history: [],
    }
    const { mod } = loadReviewStateSync({ localPages: { pestsTopic: localRecord } })
    global.fetch = fetchReturning({ pestsTopic: serverRecord })

    const result = await mod.pullFromServer()

    expect(result.pulledKeys).toEqual(['pestsTopic'])
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

describe('endpoint binding across an in-flight request', () => {
  const localRecord = {
    page_key: 'pestsTopic',
    decision: 'Blocked',
    notes: 'local work',
    updated_at: '2026-01-01T00:00:00.000Z',
    synced_at: '2026-01-01T00:00:00.000Z',
    local_dirty: false,
    history: [],
  }

  test('a pull labels its conflicts with the endpoint configured when it started', async () => {
    const { mod } = loadReviewStateSync({ apiUrl: 'https://server-x.test' })
    global.fetch = fetchReturning({})

    const result = await mod.pullFromServer()

    expect(result.ok).toBe(true)
    expect(result.apiUrl).toBe('https://server-x.test')
  })

  test('a pull refuses to apply a response that outlived its configuration', async () => {
    // Regression coverage: the endpoint used to be read in the response
    // handler, so a pull from X that landed after the reviewer saved Y was
    // labelled Y. resolveConflict's endpoint guard then saw no mismatch and
    // would happily adopt X's content, or mint X's revision as Y's baseline
    // right after writeConfig cleared it.
    const { mod, getState } = loadReviewStateSync({
      localPages: { pestsTopic: localRecord },
      apiUrl: 'https://server-x.test',
    })
    global.fetch = async () => {
      mod.writeConfig({ apiUrl: 'https://server-y.test', apiToken: 'test-token' })
      return {
        ok: true,
        status: 200,
        json: async () => ({
          version: 1,
          updated_at: null,
          ui: {},
          globals: {},
          pages: {
            pestsTopic: {
              page_key: 'pestsTopic',
              decision: 'Approved',
              updated_at: '2026-09-09T00:00:00.000Z',
            },
          },
        }),
      }
    }

    const result = await mod.pullFromServer()

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/sync settings changed/i)
    // Server X's content was not written, and writeConfig's baseline
    // clearing stands.
    expect(getState().pages.pestsTopic.decision).toBe('Blocked')
    expect(getState().pages.pestsTopic.synced_at).toBe('')
  })

  test('a push refuses to apply a response that outlived its configuration', async () => {
    const { mod, getState } = loadReviewStateSync({
      localPages: { pestsTopic: localRecord },
      apiUrl: 'https://server-x.test',
    })
    global.fetch = async () => {
      mod.writeConfig({ apiUrl: 'https://server-y.test', apiToken: 'test-token' })
      return {
        ok: true,
        status: 200,
        json: async () => ({ ...localRecord, updated_at: '2026-09-09T00:00:00.000Z' }),
      }
    }

    const result = await mod.pushPage('pestsTopic')

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/sync settings changed/i)
    // Server X's updated_at must not become a baseline under server Y.
    expect(getState().pages.pestsTopic.synced_at).toBe('')
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

  test('refuses a row whose divergence the local record has already caught up with', async () => {
    // A conflict row asserts "the server holds a revision this browser has
    // not observed." Seed the state as though something already observed a
    // revision at least as new — the push-in-flight case below is how that
    // happens for real — and the assertion is simply no longer true.
    const reconciled = {
      ...localRecord,
      decision: 'Blocked',
      notes: 'work done after the page was reconciled',
      synced_at: serverRecord.updated_at,
      local_dirty: true,
    }
    const { mod, getState } = loadReviewStateSync({ localPages: { ratsReport: reconciled } })

    const outcome = mod.resolveConflict('ratsReport', 'server', serverRecord)

    expect(outcome.ok).toBe(false)
    expect(outcome.error).toMatch(/re-synced/i)
    // The point is the content survives, not merely that a boolean came
    // back false — adopting the server copy here is the data loss.
    expect(getState().pages.ratsReport).toEqual(reconciled)
  })

  test('a push that lands after a conflicting pull retires that conflict row', async () => {
    // The finding as behaviour. Push and pull overlap: the PUT reaches the
    // server before the GET, but its response lands after, so the pull sees
    // a "new" server revision that is really this browser's own push and
    // reports a conflict. Once the push response settles, the row describes
    // a divergence that no longer exists — and by then the reviewer may
    // have edited the page again.
    const beforePush = {
      page_key: 'ratsReport',
      decision: 'Blocked',
      notes: 'local notes',
      updated_at: '2026-01-03T00:00:00.000Z',
      synced_at: '2026-01-01T00:00:00.000Z',
      local_dirty: true,
      history: [],
    }
    const { mod, getState } = loadReviewStateSync({ localPages: { ratsReport: beforePush } })
    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        page_key: 'ratsReport',
        decision: 'Blocked',
        notes: 'local notes',
        updated_at: '2026-01-04T00:00:00.000Z',
        history: [],
      }),
    })

    expect((await mod.pushPage('ratsReport')).ok).toBe(true)
    expect(getState().pages.ratsReport.synced_at).toBe('2026-01-04T00:00:00.000Z')

    // An edit made after the push — exactly what a stale row would discard.
    getState().pages.ratsReport.notes = 'edited after the push landed'

    // serverRecord is the revision the overlapping pull captured, older
    // than what the push established.
    const outcome = mod.resolveConflict('ratsReport', 'server', serverRecord)

    expect(outcome.ok).toBe(false)
    expect(getState().pages.ratsReport.notes).toBe('edited after the push landed')
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
        local_dirty: false,
      },
    }
    const { mod, getState } = loadReviewStateSync({
      localPages,
      apiUrl: 'https://same-deploy.test',
    })

    mod.writeConfig({ apiUrl: 'https://same-deploy.test', apiToken: 'a-new-token' })

    expect(getState().pages.pestsTopic.synced_at).toBe('2026-01-01T00:00:00.000Z')
    // The dirty flag is endpoint-relative too, but nothing about it changed
    // meaning here — the endpoint is the same one that set it.
    expect(getState().pages.pestsTopic.local_dirty).toBe(false)
  })

  test('drops local_dirty to unknown when the sync server URL changes', async () => {
    // `local_dirty: false` means "matches what the server has", and that
    // judgement was made against the OLD server. It has to become absent
    // (unknown), not stay `false` and not be forced to `true`: absent is
    // the honest state, and it's the one pullFromServer already treats as
    // possibly-unpushed. Asserting absence explicitly rather than
    // `!== false` matters — `!== false` would also pass on the buggy
    // carry-over of `true`, which is exactly the wrong remedy.
    const localPages = {
      pestsTopic: {
        page_key: 'pestsTopic',
        decision: 'Approved',
        synced_at: '2026-01-01T00:00:00.000Z',
        local_dirty: false,
      },
      ratsReport: {
        page_key: 'ratsReport',
        decision: 'Blocked',
        synced_at: '2026-01-02T00:00:00.000Z',
        local_dirty: true,
      },
    }
    const { mod, getState } = loadReviewStateSync({ localPages, apiUrl: 'https://old-deploy.test' })

    mod.writeConfig({ apiUrl: 'https://new-deploy.test', apiToken: 'test-token' })

    const state = getState()
    expect('local_dirty' in state.pages.pestsTopic).toBe(false)
    expect('local_dirty' in state.pages.ratsReport).toBe(false)
    // Content still survives the invalidation untouched.
    expect(state.pages.pestsTopic.decision).toBe('Approved')
    expect(state.pages.ratsReport.decision).toBe('Blocked')
  })

  test('a pull after a server switch reports a conflict instead of overwriting', async () => {
    // The finding stated as behaviour rather than as a field value: a page
    // marked clean against server X must not be silently replaced by
    // server Y's copy on the very first pull after the switch.
    const localPages = {
      pestsTopic: {
        page_key: 'pestsTopic',
        decision: 'Approved',
        notes: 'local review that was only ever pushed to the old server',
        updated_at: '2026-01-01T00:00:00.000Z',
        synced_at: '2026-01-01T00:00:00.000Z',
        local_dirty: false,
      },
    }
    const { mod, getState } = loadReviewStateSync({ localPages, apiUrl: 'https://old-deploy.test' })

    mod.writeConfig({ apiUrl: 'https://new-deploy.test', apiToken: 'test-token' })
    global.fetch = fetchReturning({
      pestsTopic: {
        page_key: 'pestsTopic',
        decision: 'Blocked',
        notes: 'unrelated content from a server this browser never synced with',
        updated_at: '2026-02-01T00:00:00.000Z',
      },
    })

    const result = await mod.pullFromServer()

    expect(result.ok).toBe(true)
    expect(result.conflicts).toEqual(['pestsTopic'])
    expect(result.pulledCount).toBe(0)
    const page = getState().pages.pestsTopic
    expect(page.decision).toBe('Approved')
    expect(page.notes).toBe('local review that was only ever pushed to the old server')
    // A conflict never advances the baseline — see pullFromServer.
    expect(page.synced_at).toBe('')
  })
})

describe('overlapping pulls', () => {
  test('marks a superseded pull stale and the pull that superseded it fresh', async () => {
    // Two Pull clicks put two GETs in flight with no ordering guarantee.
    // assertEndpointUnchanged cannot catch this — both go to the SAME
    // endpoint — so pullFromServer stamps each call and reports whether it
    // has been superseded, letting the caller keep a stale (possibly
    // empty) conflict list from wiping the panel a newer pull populated.
    const { mod } = loadReviewStateSync()
    const pending = []
    global.fetch = () =>
      new Promise((resolve) => {
        pending.push(() =>
          resolve({
            ok: true,
            status: 200,
            json: async () => ({ version: 1, updated_at: null, ui: {}, globals: {}, pages: {} }),
          })
        )
      })

    const first = mod.pullFromServer()
    const second = mod.pullFromServer()
    // Resolve out of order, the case that actually bites: the second
    // request answers first, so the first click's result lands last and
    // must not be allowed to drive the UI.
    pending[1]()
    pending[0]()
    const [firstResult, secondResult] = await Promise.all([first, second])

    expect(secondResult.stale).toBe(false)
    expect(firstResult.stale).toBe(true)
  })

  test('marks a lone pull fresh', async () => {
    const { mod } = loadReviewStateSync()
    global.fetch = fetchReturning({})

    expect((await mod.pullFromServer()).stale).toBe(false)
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

  test('a duplicate-content autosave landing mid-push does not leave the page dirty', async () => {
    // Regression coverage: clicking "Push all pages" within the 300 ms
    // debounce window leaves a pending timer that re-saves the SAME content
    // with a later updated_at. The mid-flight test used to be a timestamp
    // comparison, so that duplicate read as a real edit and pinned
    // local_dirty true forever — permanently claiming already-pushed
    // content was unpushed, and turning the next server revision into a
    // false conflict.
    const record = {
      page_key: 'pestsTopic',
      decision: 'Approved',
      notes: 'typed just before clicking push',
      updated_at: '2026-01-01T00:00:00.000Z',
      synced_at: '',
      local_dirty: true,
      history: [],
    }
    const { mod, getState } = loadReviewStateSync({ localPages: { pestsTopic: record } })

    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => {
        // The pending debounce fires: identical content, later stamp.
        global.window.reviewState.update((state) => ({
          ...state,
          pages: {
            ...state.pages,
            pestsTopic: { ...record, updated_at: '2026-01-01T00:00:00.500Z' },
          },
        }))
        return {
          ...record,
          updated_at: '2026-01-01T00:00:01.000Z',
          history: [{ timestamp: '2026-01-01T00:00:01.000Z', updated_by: 'sync' }],
        }
      },
    })

    const result = await mod.pushPage('pestsTopic')

    expect(result.ok).toBe(true)
    const page = getState().pages.pestsTopic
    expect(page.synced_at).toBe('2026-01-01T00:00:01.000Z')
    // The content reached the server, so the page is clean.
    expect(page.local_dirty).toBe(false)
  })

  test('keeps history rounds added mid-push even when the final content matches what was sent', async () => {
    // Regression coverage: a decision changed and changed back while the
    // PUT is in flight leaves content equal to the sent snapshot but adds
    // real audit rounds. reviewContentEquals ignores history by design, so
    // that read as "no mid-flight change" and the server's response was
    // adopted wholesale — silently discarding rounds the server never saw.
    const record = {
      page_key: 'pestsTopic',
      decision: 'Approved',
      notes: 'stable content',
      updated_at: '2026-01-01T00:00:00.000Z',
      synced_at: '',
      local_dirty: true,
      history: [{ timestamp: '2026-01-01T00:00:00.000Z', decision: 'Approved' }],
    }
    const { mod, getState } = loadReviewStateSync({ localPages: { pestsTopic: record } })

    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => {
        // Decision flipped away and back: same content, two extra rounds.
        global.window.reviewState.update((state) => ({
          ...state,
          pages: {
            ...state.pages,
            pestsTopic: {
              ...record,
              updated_at: '2026-01-01T00:00:00.500Z',
              history: [
                ...record.history,
                {
                  timestamp: '2026-01-01T00:00:00.200Z',
                  decision: 'Blocked',
                  updated_by: 'decision',
                },
                {
                  timestamp: '2026-01-01T00:00:00.400Z',
                  decision: 'Approved',
                  updated_by: 'decision',
                },
              ],
            },
          },
        }))
        return {
          ...record,
          updated_at: '2026-01-01T00:00:01.000Z',
          history: [
            ...record.history,
            { timestamp: '2026-01-01T00:00:01.000Z', updated_by: 'sync' },
          ],
        }
      },
    })

    const result = await mod.pushPage('pestsTopic')

    expect(result.ok).toBe(true)
    const page = getState().pages.pestsTopic
    // Both local decision rounds survive alongside the server's sync round.
    expect(page.history).toHaveLength(4)
    expect(page.history.map((entry) => entry.updated_by)).toEqual([
      undefined,
      'decision',
      'decision',
      'sync',
    ])
    // Those rounds have not reached the server, so the page is still dirty.
    expect(page.local_dirty).toBe(true)
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

describe('restorePageContentFromOriginal', () => {
  // The helper reaches for the real getPrimaryCta/setPrimaryCta, whose
  // fallback behaviour is the whole point of the CTA branch — stubbing them
  // would test the stub. js/utils.js is an ES module now, and its namespace
  // has the same shape as the window.utils object it publishes, so it can be
  // handed straight to the fake window below.
  const utilsModule = require('../js/utils.js')

  // ORIGINAL_DATA is published onto `window` by js/state.js, and
  // restorePageContentFromOriginal reads it from there rather than importing
  // it (see that function's comment). loadReviewStateSync() builds a fresh
  // fake window per test, so each test sets it on that object and nothing
  // needs saving or restoring across tests.

  test('clears a local CTA when the original page had none anywhere', () => {
    // Regression coverage: the reset skipped an empty original CTA, so
    // adopting a server record with an empty primary_cta left the local
    // CTA in memory — shown in the mockup and written back by the next
    // autosave, re-dirtying the page just resolved.
    const { mod } = loadReviewStateSync()
    global.window.utils = utilsModule
    global.window.HHVC_DATA.pages.pestsTopic = {
      title: 'Locally retitled',
      summary: 'locally edited summary',
      // No sections/spotlight, so setPrimaryCta wrote to this fallback.
      primaryCta: 'CTA added locally',
    }
    global.window.ORIGINAL_DATA = {
      pages: {
        pestsTopic: { title: 'Original title', summary: 'original summary' },
      },
    }

    mod.restorePageContentFromOriginal('pestsTopic')

    const page = global.window.HHVC_DATA.pages.pestsTopic
    expect(page.title).toBe('Original title')
    expect(page.summary).toBe('original summary')
    expect(page.primaryCta).toBe('')
  })

  test('restores a real CTA rather than blanking the button it lives on', () => {
    const { mod } = loadReviewStateSync()
    global.window.utils = utilsModule
    global.window.HHVC_DATA.pages.pestsTopic = {
      title: 'Locally retitled',
      sections: [{ steps: [{ button: 'Locally renamed button' }] }],
    }
    global.window.ORIGINAL_DATA = {
      pages: {
        pestsTopic: {
          title: 'Original title',
          sections: [{ steps: [{ button: 'Report a problem' }] }],
        },
      },
    }

    mod.restorePageContentFromOriginal('pestsTopic')

    const page = global.window.HHVC_DATA.pages.pestsTopic
    // The structural button is restored to the original label, not blanked.
    expect(page.sections[0].steps[0].button).toBe('Report a problem')
  })

  test('resets locally-edited section content, not just title/summary/SEO/CTA', () => {
    // Regression coverage: the reset used to skip page.sections entirely.
    // applyContentEditsToPageData() only OVERLAYS paths present in an
    // adopted section_edits map, so a local edit absent from that map (an
    // empty/narrower server record, or "Use server version") stayed in
    // memory and was resurrected by the next autosave's computeSectionEdits
    // diff — silently undoing the reset the reviewer just asked for.
    const { mod } = loadReviewStateSync()
    global.window.utils = utilsModule
    const page = {
      title: 'T',
      sections: [{ heading: 'Locally edited heading', paragraphs: ['locally edited p'] }],
    }
    global.window.HHVC_DATA.pages.pestsTopic = page
    global.window.ORIGINAL_DATA = {
      pages: {
        pestsTopic: {
          title: 'T',
          sections: [{ heading: 'Original heading', paragraphs: ['original p'] }],
        },
      },
    }

    mod.restorePageContentFromOriginal('pestsTopic')

    expect(page.sections[0].heading).toBe('Original heading')
    expect(page.sections[0].paragraphs).toEqual(['original p'])
    // Mutating the reset result must not reach back into ORIGINAL_DATA — it
    // has to be a deep clone, not a shared reference to the pristine copy.
    page.sections[0].heading = 'Mutated after reset'
    expect(global.window.ORIGINAL_DATA.pages.pestsTopic.sections[0].heading).toBe(
      'Original heading'
    )
  })

  test('resets the page-level whatToKnow, spotlight and contact containers too', () => {
    // Same failure as the sections case one level up. These three became
    // inline-editable without joining this reset, so a local edit to a
    // contact phone number or a spotlight paragraph survived adopting a
    // server record that never mentioned it, and the next
    // computeSectionEdits() diff resurrected it as unpushed work.
    const { mod } = loadReviewStateSync()
    global.window.utils = utilsModule
    const page = {
      title: 'T',
      sections: [],
      whatToKnow: { cost: 'Locally edited cost', thingsToKnow: ['locally edited thing'] },
      spotlight: { title: 'Locally edited spotlight', paragraphs: ['locally edited p'] },
      contact: { phone: ['555-0000'], address: 'Locally edited address' },
    }
    global.window.HHVC_DATA.pages.pestsTopic = page
    global.window.ORIGINAL_DATA = {
      pages: {
        pestsTopic: {
          title: 'T',
          sections: [],
          whatToKnow: { cost: 'Free', thingsToKnow: ['original thing'] },
          spotlight: { title: 'Original spotlight', paragraphs: ['original p'] },
          contact: { phone: ['311 (call or text)'], address: 'Original address' },
        },
      },
    }

    mod.restorePageContentFromOriginal('pestsTopic')

    expect(page.whatToKnow).toEqual({ cost: 'Free', thingsToKnow: ['original thing'] })
    expect(page.spotlight).toEqual({ title: 'Original spotlight', paragraphs: ['original p'] })
    expect(page.contact).toEqual({
      phone: ['311 (call or text)'],
      address: 'Original address',
    })
    // Deep clone, not a shared reference — the same guarantee the sections
    // case above pins, and for the same reason: a later inline edit must not
    // reach back and corrupt the baseline every future diff compares against.
    page.contact.phone[0] = 'Mutated after reset'
    expect(global.window.ORIGINAL_DATA.pages.pestsTopic.contact.phone[0]).toBe('311 (call or text)')
  })

  test('removes a page-level container the original never had, rather than blanking it', () => {
    // A reviewer can edit a SYNTHESIZED contact box only when the page really
    // authored one, but a page registry entry or an import can still leave a
    // container the pristine copy lacks. Assigning `undefined` would leave the
    // key present — invisible to `page.contact?.phone`, but not to the JSON
    // serialization the export path performs.
    const { mod } = loadReviewStateSync()
    global.window.utils = utilsModule
    const page = { title: 'T', sections: [], contact: { phone: ['555-0000'] } }
    global.window.HHVC_DATA.pages.pestsTopic = page
    global.window.ORIGINAL_DATA = { pages: { pestsTopic: { title: 'T', sections: [] } } }

    mod.restorePageContentFromOriginal('pestsTopic')

    expect('contact' in page).toBe(false)
  })
})
