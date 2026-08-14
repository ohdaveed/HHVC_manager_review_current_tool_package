/* Optional network sync layer on top of window.reviewState (localStorage).
   Talks to the /api/review-state routes added to server.ts (see
   the `hhvc-review-sync-backend` skill, extracted from CLAUDE.md; AGENTS.md
   carries the same section in full). Entirely additive: the
   synchronous core window.reviewState API is untouched, and every function
   here is a no-op whenever no sync URL/token is configured, so the app
   keeps working fully offline exactly as it did before this file existed.
   Loads after js/review-merge.js and js/review-state-store.js. */

;(function mountReviewStateSync() {
  if (typeof window === 'undefined' || !window.reviewState || !window.reviewMerge) return

  const CONFIG_KEY = 'hhvcReviewSyncConfig'
  const API_TIMEOUT_MS = 15000
  /**
   * Default sync endpoint: **the origin this page was served from.**
   *
   * It used to be a hardcoded Railway hostname, and it rotted exactly as you
   * would expect — it still named `sync-api-production-3097`, a deployment
   * that no longer exists, long after the live host became
   * `web-production-9bb3b`. A URL written down in a bundle is a fact about
   * where the app was deployed the day someone typed it.
   *
   * Same-origin is correct now in a way it was not before: `server.ts` serves
   * both the static app and `/api/*` from one port, so on Railway the API is
   * always exactly where the page came from. On a static host with no runtime
   * the same default resolves to an origin that answers 404 — sync then fails
   * closed and the tool stays local-only, which is the honest outcome there.
   *
   * The TOKEN still has no default, deliberately: this file ships in a public
   * bundle, so a hardcoded token would be extractable from devtools by anyone
   * who can load the page. Sync stays a no-op (see `isConfigured()`) until a
   * token is present — the one piece of setup that cannot be automated away
   * while the API is bearer-gated.
   *
   * @returns {string}
   */
  function defaultApiUrl() {
    const origin = typeof location !== 'undefined' ? location.origin : ''
    // A single-file export opened from disk has origin "null", and a file://
    // page has no API to talk to anyway.
    return /^https?:/.test(origin) ? origin : ''
  }

  // Monotonic stamp for in-flight pulls; see pullFromServer's `stale`.
  let pullGeneration = 0

  /**
   * Sync settings (server URL + bearer token) live in their own localStorage
   * key, deliberately separate from hhvcManagerReviewState:v1 — that blob
   * round-trips through the CSV/JSON export/import/backup paths, which are
   * meant to be shareable files, so a token must never be able to leak
   * through them.
   */
  function readConfig() {
    try {
      const raw = localStorage.getItem(CONFIG_KEY)
      // A browser that has never saved sync settings talks to the origin it
      // was served from. Once a reviewer explicitly saves settings — even
      // clearing the URL to point nowhere, or pointing it at a local/teammate
      // server — that saved choice is respected as-is and never silently
      // overridden back to the default.
      if (!raw) return { apiUrl: defaultApiUrl(), apiToken: '' }
      const parsed = JSON.parse(raw)
      return {
        apiUrl: typeof parsed.apiUrl === 'string' ? parsed.apiUrl : defaultApiUrl(),
        apiToken: typeof parsed.apiToken === 'string' ? parsed.apiToken : '',
      }
    } catch {
      return { apiUrl: defaultApiUrl(), apiToken: '' }
    }
  }

  function writeConfig(config) {
    const previous = readConfig()
    const nextApiUrl = (config.apiUrl || '').trim()
    try {
      localStorage.setItem(
        CONFIG_KEY,
        JSON.stringify({
          apiUrl: nextApiUrl,
          apiToken: (config.apiToken || '').trim(),
        })
      )
    } catch {
      window.utils?.showErrorBanner?.('Could not save sync settings in this browser.')
      return
    }

    // A synced_at baseline only means "the state this browser last observed
    // from THIS server" — server.ts's staleness check just compares
    // timestamps, with no notion of which deployment issued them. Pointing
    // sync at a different server (a fresh Railway deployment, a teammate's
    // local server, etc.) without clearing these would let an old
    // deployment's synced_at values pass the new target's staleness check
    // by pure timestamp coincidence, silently overwriting real content on a
    // server this browser has never actually synced against.
    //
    // The comparison is against the stored URL with NO "both non-empty"
    // guard, deliberately: clearing the settings and then configuring a
    // different server is two transitions (X -> '' -> Y), and requiring
    // both sides to be non-empty would skip the clear on BOTH of them,
    // carrying X's baselines all the way to Y. Clearing on any change also
    // makes first-ever configuration safe, where baselines can only have
    // come from someone else's browser via a JSON backup import.
    if (nextApiUrl !== previous.apiUrl) {
      window.reviewState.update((state) => {
        const nextPages = {}
        for (const [key, record] of Object.entries(state.pages || {})) {
          const next = { ...record, synced_at: '' }
          // local_dirty is endpoint-relative in exactly the same way
          // synced_at is: `false` means "matches what the server has," and
          // that judgement was made against the OLD server. Carrying it to
          // the new one lets pullFromServer see a new revision plus an
          // explicitly clean record and replace the local decision/notes
          // wholesale — losing a review on a server this browser has never
          // synced with. Delete rather than force `true`: absent is the
          // honest state (unknown provenance), and the pull path already
          // treats unknown as possibly-unpushed and raises a conflict.
          delete next.local_dirty
          nextPages[key] = next
        }
        return { ...state, pages: nextPages }
      })
    }
  }

  /**
   * Whether this browser holds a signed-in session with the API.
   *
   * Kept as a module flag rather than re-probed per request: it is refreshed
   * by `checkSession()` at init and by sign-in/sign-out, and a stale `true`
   * costs nothing worse than one 401 that the caller already handles.
   */
  let sessionActive = false

  /**
   * Whether sync can talk to the API at all.
   *
   * Two credentials satisfy it. A pasted **bearer token** is the original
   * path, still used by scripts and by anyone pointing at another deployment.
   * A **same-origin session cookie** is the one reviewers actually use: the
   * bundle is public so it can never carry a token, but it can carry a sign-in
   * form. `document.cookie` cannot see the cookie — it is HttpOnly on purpose —
   * so the flag comes from asking the server.
   */
  function isConfigured() {
    const config = readConfig()
    return Boolean(config.apiUrl && (config.apiToken || sessionActive))
  }

  /**
   * Ask the server whether this browser is signed in.
   *
   * @returns {Promise<{active: boolean, loginAvailable: boolean}>}
   */
  function checkSession() {
    const base = (readConfig().apiUrl || '').replace(/\/+$/, '')
    if (!base) return Promise.resolve({ active: false, loginAvailable: false })
    return fetch(`${base}/api/session`, { credentials: 'same-origin' })
      .then((response) =>
        response.ok ? response.json() : { active: false, loginAvailable: false }
      )
      .then((result) => {
        sessionActive = Boolean(result.active)
        return { active: sessionActive, loginAvailable: Boolean(result.loginAvailable) }
      })
      .catch(() => ({ active: false, loginAvailable: false }))
  }

  /**
   * Exchange the shared reviewer password for a session cookie.
   *
   * The password is sent and forgotten — never stored. The cookie the server
   * sets is HttpOnly, so unlike a pasted token it cannot be read back out of
   * this browser by any script on the page.
   *
   * @param {string} password
   * @returns {Promise<{ok: boolean, error: string|null}>}
   */
  function signIn(password) {
    const base = (readConfig().apiUrl || '').replace(/\/+$/, '')
    if (!base) return Promise.resolve({ ok: false, error: 'No server URL configured.' })

    return fetch(`${base}/api/session`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    })
      .then((response) =>
        response
          .json()
          .catch(() => ({}))
          .then((body) => {
            if (response.ok) {
              sessionActive = true
              return { ok: true, error: null }
            }
            sessionActive = false
            return { ok: false, error: body.error || `Sign-in failed (${response.status}).` }
          })
      )
      .catch((error) => ({
        ok: false,
        error: String(error && error.message ? error.message : error),
      }))
  }

  /**
   * Drop this browser's session.
   *
   * @returns {Promise<{ok: boolean}>}
   */
  function signOut() {
    const base = (readConfig().apiUrl || '').replace(/\/+$/, '')
    if (!base) return Promise.resolve({ ok: false })
    return fetch(`${base}/api/session`, { method: 'DELETE', credentials: 'same-origin' })
      .then(() => {
        sessionActive = false
        return { ok: true }
      })
      .catch(() => ({ ok: false }))
  }

  /**
   * A hung sync server would otherwise leave the UI stuck on "Pulling…"/
   * "Pushing…" forever, since fetch() has no default timeout. Aborts after
   * API_TIMEOUT_MS, or immediately if a caller-supplied signal aborts first.
   */
  function apiFetch(path, options = {}) {
    const config = readConfig()
    // Either credential will do: a pasted bearer token, or a session cookie
    // this browser holds. Without one of them there is nothing to send and the
    // request would just earn a 401.
    if (!config.apiUrl || (!config.apiToken && !sessionActive)) {
      return Promise.reject(new Error('Sync is not configured.'))
    }
    const base = config.apiUrl.replace(/\/+$/, '')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS)
    if (options.signal) {
      if (options.signal.aborted) controller.abort()
      else options.signal.addEventListener('abort', () => controller.abort(), { once: true })
    }

    return fetch(base + path, {
      ...options,
      signal: controller.signal,
      // Send the session cookie when there is one. 'same-origin' rather than
      // 'include' deliberately: the cookie is only ever set by the origin that
      // served the page, and 'include' would attach credentials to a
      // cross-origin deployment a reviewer had pointed at by hand.
      credentials: 'same-origin',
      headers: {
        ...(options.headers || {}),
        // Only send an Authorization header when a token was actually pasted.
        // Sending `Bearer ` with an empty token would be a credential the
        // server has to reject, which would mask a perfectly good cookie.
        ...(config.apiToken ? { authorization: `Bearer ${config.apiToken}` } : {}),
        'content-type': 'application/json',
      },
    }).finally(() => clearTimeout(timeoutId))
  }

  /**
   * Throw if the configured sync server changed while a request was in
   * flight. Applying a response under a different deployment's settings is
   * never safe: its records are foreign content, and its `updated_at`
   * written into `synced_at` would re-mint the very baseline writeConfig
   * clears on an endpoint change — letting a later push pass the NEW
   * server's staleness check against content this browser never saw there.
   * Callers run this before touching state; the existing .catch turns it
   * into the standard { ok: false, error } result.
   * @param {string} requestApiUrl Endpoint captured before the request.
   */
  function assertEndpointUnchanged(requestApiUrl) {
    if (readConfig().apiUrl !== requestApiUrl) {
      throw new Error('Sync settings changed during this request — try again.')
    }
  }

  /**
   * Pull the server's review state and merge it into local state, PER PAGE.
   *
   * Two questions decide each page, and NEITHER compares a browser-clock
   * timestamp against a server-clock one:
   *
   *  1. Does the server hold a revision this browser hasn't observed?
   *     `serverRecord.updated_at > localRecord.synced_at`. Both sides of
   *     that comparison are stamped by the SERVER (synced_at is only ever
   *     assigned from a sync response), so it stays correct no matter how
   *     far the browser's clock has drifted. An earlier version compared
   *     the server's `updated_at` against the local record's `updated_at`,
   *     which is written by the browser's own clock — on a browser running
   *     behind the server, a genuine unsynced local edit looked OLDER than
   *     an unchanged server record and got silently overwritten by it.
   *  2. Does this browser hold edits it hasn't pushed? The explicit
   *     `local_dirty` flag, set by the local write paths and cleared only
   *     by an actual push/pull. Also clock-independent.
   *
   * No new server revision -> nothing to do. New revision and nothing
   * unpushed -> apply the server's record wholesale; there is nothing to
   * lose. New revision AND unpushed local edits -> a genuine divergence.
   *
   * A divergence cannot be auto-resolved: the local record is a full
   * snapshot, not a field-level diff, so treating it as a "patch" onto the
   * server's record (an earlier version of this function did exactly that)
   * lets this browser's stale copies of fields ANOTHER reviewer changed
   * silently overwrite them on the next push. So the record is left
   * untouched — `synced_at` deliberately NOT advanced, or the next push
   * would sail through server.ts's staleness check having never
   * incorporated the server's content — and the page key is reported in
   * `conflicts`, with the server's copy returned in `conflictRecords` so
   * the reviewer can resolve it explicitly via resolveConflict().
   */
  function pullFromServer() {
    if (!isConfigured()) return Promise.resolve({ ok: false, error: 'Sync is not configured.' })

    // Two Pull clicks put two GETs in flight, and nothing guarantees they
    // resolve in order. Applying either one's STATE is fine (it's
    // last-write-wins per page either way), but the conflict panel is
    // different: an older response reporting no conflicts would erase the
    // resolution controls a newer one correctly populated, leaving a page
    // that is still dirty and still diverged with no way to resolve it.
    // Stamp each call so the caller can tell whether it has been
    // superseded. assertEndpointUnchanged doesn't cover this — both
    // requests go to the SAME endpoint.
    const generation = ++pullGeneration

    // Captured BEFORE the request, not after: apiFetch resolves the URL at
    // call time, so this is genuinely the endpoint being talked to. Reading
    // it in the response handler instead would label a response from server
    // X with whatever is configured by the time it lands — see the guard
    // below and resolveConflict's matching check.
    const requestApiUrl = readConfig().apiUrl

    return apiFetch('/api/review-state', { method: 'GET' })
      .then((res) => {
        if (!res.ok) throw new Error(`Server responded ${res.status}`)
        return res.json()
      })
      .then((serverState) => {
        assertEndpointUnchanged(requestApiUrl)
        const validator = window.reviewStateValidation?.validateReviewState
        const validated =
          typeof validator === 'function' ? validator(serverState) : { ok: true, data: serverState }
        if (!validated.ok) throw new Error(validated.error || 'Invalid server response.')

        let pulledCount = 0
        const pulledKeys = []
        const conflicts = []
        const conflictRecords = {}
        window.reviewState.update((state) => {
          const nextPages = { ...state.pages }
          for (const [key, serverRecord] of Object.entries(validated.data.pages || {})) {
            if (!window.HHVC_DATA?.pages?.[key]) continue
            const localRecord = state.pages[key]

            const serverRevision = serverRecord.updated_at || ''
            const observedRevision = localRecord?.synced_at || ''
            const serverHasNewRevision = !localRecord || serverRevision > observedRevision
            if (!serverHasNewRevision) continue

            // Only an EXPLICIT `false` counts as clean. A record saved
            // before local_dirty existed has no such field, and the storage
            // version was deliberately not bumped (the field is additive) —
            // so on the first pull after an upgrade, treating "missing" as
            // "clean" would wholesale replace reviews this browser may
            // never have pushed. Assume unsynced and let the reviewer
            // decide; a false conflict costs a click, the alternative
            // costs someone's review.
            const isClean = !localRecord || localRecord.local_dirty === false
            if (isClean) {
              nextPages[key] = {
                ...serverRecord,
                page_key: key,
                synced_at: serverRevision,
                local_dirty: false,
              }
              pulledCount += 1
              pulledKeys.push(key)
              continue
            }

            conflicts.push(key)
            conflictRecords[key] = serverRecord
          }
          return { ...state, pages: nextPages }
        })

        // Adopting a server record means adopting its ABSENCES too. If the
        // server cleared an edited title/summary/SEO field/CTA, the local
        // in-memory page still holds the old value: applySavedPageState
        // only assigns truthy saved values, so the stale edit would stay
        // visible in the mockup and be collected straight back by the next
        // autosave — reintroducing, as unpushed work, content the server
        // had deleted. Resetting first makes "empty on the server" mean
        // "back to the original" locally, exactly as the conflict path
        // already does for the resolutions it applies.
        for (const key of pulledKeys) restorePageContentFromOriginal(key)

        // The endpoint these conflicts came from. A resolution is only
        // meaningful against the server that produced it, and the settings
        // can change between a pull and a click — see resolveConflict.
        return {
          ok: true,
          pulledCount,
          pulledKeys,
          conflicts,
          conflictRecords,
          apiUrl: requestApiUrl,
          // True when a later pull started while this one was in flight.
          // The caller must not let a superseded result drive the conflict
          // UI — see the generation stamp at the top of this function.
          stale: generation !== pullGeneration,
        }
      })
      .catch((error) => ({ ok: false, error: error.message || String(error) }))
  }

  /**
   * Resolve one page reported by pullFromServer as a conflict. Both
   * outcomes are deliberate, reviewer-chosen, and scoped to a single page
   * — the alternative before this existed was "clear ALL local reviews,"
   * which throws away unsynced work on every other page too.
   *
   * - 'server': discard this browser's unpushed edits for the page and
   *   adopt the server's copy verbatim.
   * - 'local': keep this browser's content, but record the server's
   *   revision as observed. Nothing is pushed here; the next push simply
   *   stops being rejected, and this browser's version wins that page.
   *
   * @param {string} pageKey
   * @param {'server'|'local'} resolution
   * @param {object} serverRecord The server copy from pullFromServer's
   *   `conflictRecords` — passed in rather than re-fetched so the reviewer
   *   resolves exactly the revision they were shown.
   * @param {string} [fromApiUrl] The endpoint that produced `serverRecord`
   *   (pullFromServer's `apiUrl`). Refuses to act if the configured sync
   *   server has changed since: `serverRecord` describes a revision of a
   *   DIFFERENT deployment, so adopting it would import foreign content,
   *   and the 'local' branch would mint a `synced_at` baseline that
   *   writeConfig had deliberately cleared — letting a later push pass the
   *   new server's staleness check against content this browser has never
   *   seen. That is exactly the hole the writeConfig fix closed, so it must
   *   not be reopened through a stale conflict row.
   *
   * A resolution is bound to TWO things, and refuses on either: the
   * endpoint that produced it (above) and the divergence itself. See the
   * revision check in the body — a row whose page has since been
   * reconciled by a push describes a conflict that no longer exists, and
   * acting on it would discard whatever was edited after that push.
   * @returns {{ ok: boolean, error?: string }}
   */
  function resolveConflict(pageKey, resolution, serverRecord, fromApiUrl) {
    if (!pageKey || !serverRecord || typeof serverRecord !== 'object') {
      return { ok: false, error: 'Nothing to resolve for this page.' }
    }
    if (resolution !== 'server' && resolution !== 'local') {
      return { ok: false, error: `Unknown conflict resolution "${resolution}".` }
    }
    if (typeof fromApiUrl === 'string' && fromApiUrl !== readConfig().apiUrl) {
      return {
        ok: false,
        error: 'The sync server changed since this conflict was found — pull again first.',
      }
    }

    const serverRevision = serverRecord.updated_at || ''

    // A row asserts a divergence that was true when the pull ran. That
    // assertion can stop being true without the row knowing: a push whose
    // PUT reached the server before this pull's GET, but whose response
    // landed after it, produces a conflict against this browser's OWN
    // content and then quietly reconciles the record. Acting on the row
    // afterwards would adopt a revision the page has already moved past —
    // discarding any edit made since the push.
    //
    // Both sides of this comparison are server-issued (`updated_at` from
    // the conflict record, `synced_at` only ever assigned from a sync
    // response), so it obeys the same no-cross-clock rule as the rest of
    // this module. It cannot fire on a legitimate resolution either:
    // pullFromServer only reports a conflict when the server revision is
    // NEWER than synced_at, and deliberately leaves synced_at alone for
    // conflicted pages, so this passes right after any pull and trips only
    // once something else advanced the baseline past the row.
    const currentRecord = window.reviewState.read().pages[pageKey]
    if (serverRevision <= (currentRecord?.synced_at || '')) {
      return {
        ok: false,
        error: 'This page was re-synced after the conflict was found — pull again first.',
      }
    }

    window.reviewState.update((state) => {
      const localRecord = state.pages[pageKey]
      const next =
        resolution === 'server'
          ? { ...serverRecord, page_key: pageKey, synced_at: serverRevision, local_dirty: false }
          : { ...localRecord, page_key: pageKey, synced_at: serverRevision, local_dirty: true }
      return { ...state, pages: { ...state.pages, [pageKey]: next } }
    })

    return { ok: true }
  }

  /**
   * Push the current locally-saved record for one page. The server merges
   * it (field-level, appending one history entry) and returns the merged
   * record, which becomes the new local record for that page verbatim —
   * there is exactly one place a "sync" history entry gets constructed
   * (server-side, in server.ts's putReviewPage), so the client must not
   * re-derive or duplicate it.
   */
  function pushPage(pageKey) {
    if (!isConfigured()) return Promise.resolve({ ok: false, error: 'Sync is not configured.' })

    const record = window.reviewState.read().pages[pageKey]
    if (!record)
      return Promise.resolve({ ok: false, error: 'Nothing saved locally for this page yet.' })

    // Same request-time capture as pullFromServer: this response writes
    // synced_at, so it must never be applied under a different deployment's
    // settings.
    const requestApiUrl = readConfig().apiUrl

    return apiFetch(`/api/review-state/pages/${encodeURIComponent(pageKey)}`, {
      method: 'PUT',
      body: JSON.stringify(record),
    })
      .then((res) => {
        if (res.status === 409) {
          throw new Error(
            'Someone else pushed a newer version of this page — pull from server first, then push again. ' +
              'If pulling reports this page as a conflict, it needs manual resolution (see the pull status message).'
          )
        }
        if (!res.ok) throw new Error(`Server responded ${res.status}`)
        return res.json()
      })
      .then((merged) => {
        assertEndpointUnchanged(requestApiUrl)
        window.reviewState.update((state) => {
          // If an autosave landed on this page between reading `record`
          // above and this response arriving (a real possibility — a push
          // is a network round-trip, easily longer than the debounce
          // window), the local record may now hold content this push never
          // sent. Overwriting it with the response would silently drop that
          // later edit, so keep the local content and only advance
          // synced_at with what the server confirmed.
          //
          // The test is CONTENT, not `updated_at`: clicking "Push all
          // pages" within the debounce window leaves a pending timer that
          // re-saves the very same content with a later stamp. A timestamp
          // comparison reads that as a mid-flight edit and marks the page
          // dirty forever — permanently claiming already-pushed content is
          // unpushed, and turning the next server revision into a false
          // conflict. reviewContentEquals ignores exactly the bookkeeping
          // fields (updated_at/synced_at/local_dirty/history) that a
          // duplicate save churns.
          const currentRecord = state.pages[pageKey]
          const localChangedDuringPush =
            currentRecord && !window.reviewMerge.reviewContentEquals(currentRecord, record)

          // `merged.history` includes the "sync" round entry the server
          // just appended for THIS push, and the local record may have
          // gained rounds of its own while the request was in flight.
          // Union them in BOTH branches: synced_at is about to advance to
          // the server's updated_at, so a future pull would treat this page
          // as already reconciled and never fetch it again — anything
          // dropped here is dropped permanently. combineHistory dedups by
          // content, so this is purely additive, never a re-merge of
          // content fields.
          const history = window.reviewMerge.combineHistory(currentRecord?.history, merged.history)
          // A decision changed and changed back mid-flight leaves content
          // equal to what was sent but adds real audit rounds the server
          // has not seen. reviewContentEquals deliberately ignores history,
          // so that case looks unchanged — check it separately or those
          // rounds would be marked clean and never pushed.
          const historyGrew = history.length > (merged.history?.length || 0)

          const next = localChangedDuringPush
            ? {
                ...currentRecord,
                history,
                synced_at: merged.updated_at,
                // Still dirty: the edit that landed mid-flight is newer
                // than what this push sent, so it hasn't reached the
                // server yet and must survive the next pull.
                local_dirty: true,
              }
            : {
                // synced_at = the server's returned updated_at: this push
                // just told us exactly what the server now has for this
                // page, so that's the new known-server baseline for the
                // next push's conflict check — must be set here (not left
                // to merged.synced_at, whatever the server happened to echo
                // back) since the server has no reason to know or persist
                // this client-side-only field.
                ...merged,
                history,
                synced_at: merged.updated_at,
                local_dirty: historyGrew,
              }
          // Fresh objects rather than a mutated `state`, matching
          // writeConfig and pullFromServer — one rule for updating state
          // across the whole module.
          return { ...state, pages: { ...state.pages, [pageKey]: next } }
        })
        return { ok: true, record: merged }
      })
      .catch((error) => ({ ok: false, error: error.message || String(error) }))
  }

  /**
   * Push every locally-saved page, one PUT at a time. Sequential rather
   * than concurrent: this is a small (a few dozen pages at most), manual,
   * infrequent action, and sequential requests are simpler to reason about
   * than partial-failure handling across a concurrent batch.
   */
  function pushAllPages() {
    if (!isConfigured()) return Promise.resolve({ ok: false, error: 'Sync is not configured.' })

    const keys = Object.keys(window.reviewState.read().pages || {})
    if (!keys.length) return Promise.resolve({ ok: true, pushedCount: 0, error: null })

    let pushedCount = 0
    let firstError = null
    return keys
      .reduce(
        (chain, key) =>
          chain.then(() =>
            pushPage(key).then((result) => {
              if (result.ok) pushedCount += 1
              else firstError = firstError || result.error
            })
          ),
        Promise.resolve()
      )
      .then(() => ({ ok: !firstError, pushedCount, error: firstError }))
  }

  /* Automatic sync
     ==============
     Push and pull used to be two buttons inside a collapsed <details>, which
     meant the server only ever held what a reviewer remembered to send. The
     automatic layer below makes the server the record of truth without giving
     up the offline guarantee: localStorage is still the synchronous write that
     every keystroke lands in, and the network is a follow-up that may fail.

     Three rules this layer must not break, all of them load-bearing:

     1. **Never push before the first pull resolves.** A push carries the
        browser's whole local snapshot plus its `synced_at` baseline. Pushing
        before pulling means pushing with a baseline this browser has never
        observed, which `putReviewPage` correctly rejects with a 409 — turning
        every fresh browser's first edit into a conflict.
     2. **Never push through mergeReviewRecord on this side.** The server
        merges with `updatedBy: 'sync'`, which is what produces a record clean
        enough for the client to adopt. Merging here as well would append a
        history entry per debounce — the flood the autosave path exists to
        avoid.
     3. **A failed push must leave `local_dirty` alone.** `pushPage` only
        clears it on a real 200, so an offline reviewer keeps their work marked
        unpushed and the next successful push carries it. */

  /** Per-page debounce timers for the automatic push. */
  const autoPushTimers = new Map()

  /** Resolves once the first automatic pull has settled; gates every push. */
  let initialPull = null

  /** How long to wait after the last autosave for a page before pushing. */
  const AUTO_PUSH_DELAY_MS = 3000

  /**
   * Pull once on load, then let pushes proceed.
   *
   * Idempotent: repeated calls return the same promise rather than issuing a
   * second pull, so a re-mount cannot double-fetch.
   *
   * @returns {Promise<object>} The pull result, or a no-op result.
   */
  function startAutoSync() {
    if (initialPull) return initialPull

    // Ask about a session BEFORE deciding there is nothing to do: the cookie is
    // HttpOnly, so a signed-in browser looks identical to an unconfigured one
    // until the server says otherwise.
    initialPull = checkSession().then(({ active, loginAvailable }) => {
      if (!isConfigured()) {
        setSyncStatus(
          loginAvailable && !active
            ? 'Reviews are saved in this browser only. Sign in above to sync them.'
            : 'Reviews are saved in this browser only.'
        )
        return { ok: false, error: 'Sync is not configured.' }
      }
      return runInitialPull()
    })
    return initialPull
  }

  /**
   * The pull half of startAutoSync, split out so the session probe above reads
   * as one decision rather than a nested chain.
   *
   * @returns {Promise<object>}
   */
  function runInitialPull() {
    setSyncStatus('Loading reviews from the server…')
    return pullFromServer()
      .then((result) => {
        if (result.stale) return result
        if (result.ok) {
          const conflictCount = (result.conflicts || []).length
          setSyncStatus(
            conflictCount
              ? `Loaded from server. ${conflictCount} page${conflictCount === 1 ? '' : 's'} need${conflictCount === 1 ? 's' : ''} your attention below.`
              : 'Up to date with the server.'
          )
          renderConflicts(result.conflicts, result.conflictRecords, result.apiUrl)
          // Send anything this browser still owes the server — work saved
          // while it was unreachable, or an edit made just before the tab
          // closed inside the debounce window.
          return pushDirtyPages().then((pushResult) => {
            if (pushResult.pushedCount) {
              setSyncStatus(
                `Up to date. Sent ${pushResult.pushedCount} page${pushResult.pushedCount === 1 ? '' : 's'} saved while offline.`
              )
            }
            return result
          })
        } else {
          // An unreachable server is a normal state for this tool, not an
          // error worth a banner: everything still works, it just works in
          // this browser only until the server comes back.
          setSyncStatus(`Working offline — saved in this browser only. (${result.error})`)
        }
        return result
      })
      .catch((error) => ({
        ok: false,
        error: String(error && error.message ? error.message : error),
      }))
  }

  /**
   * Queue an automatic push for one page after its edits settle.
   *
   * Called by the autosave path (js/ux-improvements-state-sync.js) AFTER it
   * has written localStorage — never instead of it. Debounced per page key so
   * a reviewer typing a long note produces one PUT rather than one per
   * keystroke, and coalesced so switching between two pages does not cancel
   * the other's pending push.
   *
   * @param {string} pageKey
   * @returns {void}
   */
  function scheduleAutoPush(pageKey) {
    if (!pageKey || !isConfigured()) return

    clearTimeout(autoPushTimers.get(pageKey))
    autoPushTimers.set(
      pageKey,
      setTimeout(() => {
        autoPushTimers.delete(pageKey)
        // Rule 1: the first pull has to have resolved before any push, or the
        // push carries a baseline the browser never observed.
        startAutoSync()
          .then(() => pushPage(pageKey))
          .then((result) => {
            if (result.ok) {
              setSyncStatus('Saved to the server.')
              return
            }
            // A 409 is not a failure to retry — the reviewer has to choose.
            // pushPage already phrases it as "pull first"; surface it as-is.
            setSyncStatus(`Saved in this browser only — ${result.error}`)
          })
          .catch((error) => {
            setSyncStatus(
              `Saved in this browser only — ${String(error && error.message ? error.message : error)}`
            )
          })
      }, AUTO_PUSH_DELAY_MS)
    )
  }

  /**
   * Flush any pending automatic pushes immediately, in page order.
   *
   * Exposed for tests and for any caller that wants the debounce collapsed;
   * the tool itself does not rely on it at unload time. An unload handler is
   * the obvious place to reach for and the wrong one: `beforeunload` cannot
   * await a promise, and `sendBeacon` cannot carry the `Authorization` header
   * this API requires. The catch-up push below covers the same gap without
   * depending on the browser finishing anything during teardown.
   *
   * @returns {Promise<void>}
   */
  function flushAutoPushes() {
    const keys = [...autoPushTimers.keys()]
    for (const key of keys) {
      clearTimeout(autoPushTimers.get(key))
      autoPushTimers.delete(key)
    }
    return keys.reduce((chain, key) => chain.then(() => pushPage(key)), Promise.resolve())
  }

  /**
   * Push every page this browser still holds unpushed work for.
   *
   * Runs after the initial pull, and is what makes a closed tab safe: a
   * reviewer who edits and closes inside the debounce window keeps
   * `local_dirty: true` in localStorage, and this sends it the next time the
   * tool opens. It is also the recovery path after the server was down.
   *
   * Only explicit `true` counts. An ABSENT `local_dirty` means "provenance
   * unknown" — a record written before the field existed, or one whose
   * content matched on save — and pushing those would blast a browser's whole
   * legacy history at the server as if it were new work.
   *
   * @returns {Promise<{pushedCount: number, error: string|null}>}
   */
  function pushDirtyPages() {
    const pages = window.reviewState.read().pages || {}
    const dirty = Object.keys(pages).filter((key) => pages[key]?.local_dirty === true)
    if (!dirty.length) return Promise.resolve({ pushedCount: 0, error: null })

    let pushedCount = 0
    let firstError = null
    return dirty
      .reduce(
        (chain, key) =>
          chain.then(() =>
            pushPage(key).then((result) => {
              if (result.ok) pushedCount += 1
              else firstError = firstError || result.error
            })
          ),
        Promise.resolve()
      )
      .then(() => ({ pushedCount, error: firstError }))
  }

  function setSyncStatus(message) {
    const el = document.getElementById('reviewSyncStatus')
    if (el) el.textContent = message
  }

  /**
   * Discard whatever the reviewer's local edits did to the in-memory page
   * object, so adopting the server's copy actually shows the server's copy.
   *
   * `updateMockupTextFromSavedState` only assigns a field when the saved
   * value is truthy, so a server record with an EMPTY `edited_title` (the
   * page was never retitled on the server) would otherwise leave this
   * browser's local retitle sitting in `DATA.pages[key]` — visible in the
   * mockup, and written straight back by the next autosave, re-dirtying a
   * page the reviewer just resolved. Resetting from ORIGINAL_DATA first
   * makes "empty on the server" mean "back to the original," which is what
   * it means on the server.
   *
   * ORIGINAL_DATA is published onto `window` by js/state.js and read from
   * there rather than imported, deliberately. A static import would make
   * this module depend on js/state.js, which pulls in js/page-data.js and
   * all 19 pages/*.js — and would also make the guard below dead, since an
   * imported binding always exists. The Node unit tests for this file mount
   * it against a minimal fake window with no page data at all, and the
   * documented behavior there is that this function no-ops rather than
   * throwing. Reading through `window` keeps that true.
   *
   * Resets `page.sections` too, not just the page-level fields above. The
   * caller adopts a server (or previously-saved) `section_edits` map right
   * after this returns via applyContentEditsToPageData(), which only
   * OVERLAYS the paths present in that map — it never resets a field that
   * isn't in it. Without resetting sections first, a section this browser
   * edited locally but that the adopted record doesn't mention (an empty or
   * narrower server section_edits) would keep showing this browser's stray
   * local edit, and the next autosave's computeSectionEdits() diff would
   * resurrect it into section_edits as unpushed work — silently undoing
   * "Use server version" or a pull the reviewer just accepted. This mirrors
   * the exact reasoning above for title/summary/CTA, just for the field
   * updateMockupTextFromSavedState doesn't own.
   *
   * The three PAGE-LEVEL containers inline editing reaches — `whatToKnow`,
   * `spotlight` and `contact` — reset for exactly the same reason, and were
   * missed when they became editable. They live beside `sections` rather than
   * inside it, so the reset above does not cover them: a local edit to a
   * contact phone number or a spotlight paragraph survived adopting a server
   * record that never mentioned it, and the next computeSectionEdits() diff
   * put it back into `section_edits` as unpushed work. That is the failure
   * this whole function exists to prevent, one nesting level up.
   *
   * An absent container on the original is `delete`d rather than assigned
   * `undefined`. The two are indistinguishable to `page.contact?.phone`, but
   * not to a JSON round trip or an `in` check, and the page objects here are
   * what the export path serializes — writing an explicit `undefined` would
   * add a key `pages/*.js` never had.
   *
   * Deep-cloned via JSON round-trip rather than assigned by reference: a raw
   * `page.sections = original.sections` would let a later inline edit mutate
   * ORIGINAL_DATA itself (the same object both sides would then share),
   * corrupting the pristine baseline every future diff/reset compares
   * against.
   * @param {string} pageKey
   */
  function restorePageContentFromOriginal(pageKey) {
    const ORIGINAL_DATA = window.ORIGINAL_DATA
    if (typeof ORIGINAL_DATA === 'undefined') return
    const original = ORIGINAL_DATA?.pages?.[pageKey]
    const page = window.HHVC_DATA?.pages?.[pageKey]
    if (!original || !page) return

    page.title = original.title
    page.summary = original.summary
    page.seoTitle = original.seoTitle
    page.metaDescription = original.metaDescription
    page.seoTitleEdited = false
    page.metaDescriptionEdited = false
    page.sections = JSON.parse(JSON.stringify(original.sections || []))
    for (const field of ['whatToKnow', 'spotlight', 'contact']) {
      if (original[field] === undefined) delete page[field]
      else page[field] = JSON.parse(JSON.stringify(original[field]))
    }
    const originalCta = window.utils?.getPrimaryCta?.(original) || ''
    if (originalCta) {
      window.utils?.setPrimaryCta?.(page, originalCta)
    } else {
      // The original has no CTA anywhere, so a local one can only have
      // landed in page.primaryCta — setPrimaryCta's last-resort branch,
      // used when there's no step/section/spotlight button to write to.
      // Clearing that field IS the reset. Calling setPrimaryCta('')
      // instead would blank a real section or step button on pages that
      // have one, which is worse than the bug being fixed.
      page.primaryCta = original.primaryCta || ''
    }
  }

  /**
   * Render one row per conflicted page with the two explicit resolutions.
   * Built with DOM APIs rather than innerHTML so page keys and titles from
   * the server response are never interpreted as markup.
   * @param {string[]} conflicts
   * @param {Record<string, object>} conflictRecords
   * @param {string} [fromApiUrl] Endpoint the conflicts came from; passed
   *   through to resolveConflict so a row can't act after a server switch.
   */
  function renderConflicts(conflicts, conflictRecords, fromApiUrl) {
    const panel = document.getElementById('reviewSyncConflicts')
    if (!panel) return

    panel.replaceChildren()
    if (!conflicts.length) {
      panel.hidden = true
      return
    }
    panel.hidden = false

    const heading = document.createElement('h4')
    heading.textContent = 'Pages needing a version choice'
    heading.className = 'sync-conflict-heading'
    panel.appendChild(heading)

    for (const key of conflicts) {
      const serverRecord = conflictRecords[key]
      if (!serverRecord) continue

      const row = document.createElement('div')
      row.className = 'sync-conflict-row'
      row.dataset.pageKey = key
      // The revision this row is about, so pruneReconciledConflicts can
      // tell later whether the page has moved past it.
      row.dataset.serverRevision = serverRecord.updated_at || ''

      const label = document.createElement('span')
      label.className = 'sync-conflict-label'
      label.textContent = window.HHVC_DATA?.pages?.[key]?.title || key
      row.appendChild(label)

      for (const [resolution, text] of [
        ['server', 'Use server version'],
        ['local', 'Keep my version'],
      ]) {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'tool-btn secondary-tool'
        button.dataset.resolution = resolution
        button.textContent = text
        button.addEventListener('click', () => {
          const outcome = resolveConflict(key, resolution, serverRecord, fromApiUrl)
          if (!outcome.ok) {
            setSyncStatus(`Could not resolve ${key}: ${outcome.error}`)
            return
          }
          // Adopting the server's copy means abandoning this browser's
          // in-memory content edits for that page, not just its saved
          // record — otherwise the mockup keeps showing them and the next
          // autosave writes them back.
          if (resolution === 'server') {
            restorePageContentFromOriginal(key)
            if (
              key === window.utils?.getCurrentKey?.() &&
              typeof window.renderPage === 'function'
            ) {
              window.renderPage(key)
            }
          }
          row.remove()
          if (!panel.querySelector('.sync-conflict-row')) panel.hidden = true
          window.ReviewUx?.stateSync?.applySavedPageState(window.utils?.getCurrentKey?.())
          window.ReviewUx?.refreshUx?.()
          if (typeof window.showToast === 'function') {
            window.showToast(
              resolution === 'server'
                ? `Using the server's version of ${key}`
                : `Keeping your version of ${key} — push to send it`,
              'success'
            )
          }
        })
        row.appendChild(button)
      }

      panel.appendChild(row)
    }
  }

  /**
   * Drop conflict rows whose page has since been reconciled — a push that
   * settles after a pull rendered the row is the case that motivates this.
   * `resolveConflict` refuses those rows anyway; this is UI hygiene, so the
   * reviewer sees the control disappear rather than click it and get an
   * error. Same server-issued-only comparison the guard uses.
   */
  function pruneReconciledConflicts() {
    const panel = document.getElementById('reviewSyncConflicts')
    if (!panel) return
    const pages = window.reviewState.read().pages || {}
    for (const row of panel.querySelectorAll('.sync-conflict-row')) {
      const observed = pages[row.dataset.pageKey]?.synced_at || ''
      if ((row.dataset.serverRevision || '') <= observed) row.remove()
    }
    if (!panel.querySelector('.sync-conflict-row')) panel.hidden = true
  }

  function mountSyncControls() {
    const actions = document.querySelector('.review-actions')
    if (!actions || document.getElementById('reviewSyncApiUrl')) return

    const config = readConfig()

    // Sync configuration (server URL, bearer token, pull/push) is technical
    // setup, not a per-page review decision — nesting it in its own
    // <details> keeps the decision fields and export buttons above
    // immediately visible while collapsing the rarely-touched sync config
    // out of the way, mirroring the ai-assist-settings <details> pattern in
    // js/ai-assist-render.js. A local-only reviewer should not have to scan
    // server credentials or actions before reaching the review workflow.
    const details = document.createElement('details')
    details.className = 'review-sync-settings'
    actions.insertAdjacentElement('afterend', details)

    const summary = document.createElement('summary')
    details.appendChild(summary)

    /* Sign-in comes FIRST because it is what a reviewer is meant to use.
       The URL and token below it are the advanced path — pointing at another
       deployment, or scripting against the API — and a reviewer who never
       touches them still gets sync. The password is sent and forgotten; the
       cookie the server returns is HttpOnly, so unlike a pasted token nothing
       on the page can read it back out. */
    const signInLabel = document.createElement('label')
    signInLabel.htmlFor = 'reviewSyncPassword'
    signInLabel.className = 'field-help sync-config-label'
    signInLabel.textContent = 'Reviewer password'
    details.appendChild(signInLabel)

    const passwordInput = document.createElement('input')
    passwordInput.type = 'password'
    passwordInput.id = 'reviewSyncPassword'
    passwordInput.placeholder = 'Sign in to sync your reviews'
    passwordInput.className = 'sync-config-input'
    passwordInput.autocomplete = 'current-password'
    details.appendChild(passwordInput)

    const signInButton = document.createElement('button')
    signInButton.type = 'button'
    signInButton.id = 'reviewSyncSignIn'
    signInButton.className = 'tool-btn secondary-tool'
    signInButton.textContent = 'Sign in'
    signInButton.addEventListener('click', () => {
      const password = passwordInput.value
      if (!password) {
        setSyncStatus('Enter the reviewer password first.')
        return
      }
      signInButton.disabled = true
      setSyncStatus('Signing in…')
      signIn(password)
        .then((result) => {
          // Clear it either way: a wrong password should not sit in the field,
          // and a right one is already spent.
          passwordInput.value = ''
          if (!result.ok) {
            setSyncStatus(result.error)
            return
          }
          // A fresh sign-in is a fresh sync session — reset the one-shot gate
          // so this browser pulls now rather than at the next reload.
          initialPull = null
          updateSyncActionAvailability()
          return startAutoSync()
        })
        .finally(() => {
          signInButton.disabled = false
        })
    })
    details.appendChild(signInButton)

    const signOutButton = document.createElement('button')
    signOutButton.type = 'button'
    signOutButton.id = 'reviewSyncSignOut'
    signOutButton.className = 'tool-btn secondary-tool'
    signOutButton.textContent = 'Sign out'
    signOutButton.addEventListener('click', () => {
      signOut().then(() => {
        updateSyncActionAvailability()
        setSyncStatus('Signed out. Reviews are saved in this browser only.')
      })
    })
    details.appendChild(signOutButton)

    // Placeholder text isn't a reliable accessible name (it disappears once
    // typed, and screen readers don't treat it as a persistent label), so
    // each input gets a real <label for="..."> alongside its placeholder.
    const urlLabel = document.createElement('label')
    urlLabel.htmlFor = 'reviewSyncApiUrl'
    urlLabel.className = 'field-help sync-config-label'
    urlLabel.textContent = 'Sync server URL'
    details.appendChild(urlLabel)

    const urlInput = document.createElement('input')
    urlInput.type = 'text'
    urlInput.id = 'reviewSyncApiUrl'
    urlInput.placeholder = 'https://your-app.up.railway.app'
    urlInput.value = config.apiUrl
    urlInput.className = 'sync-config-input'
    details.appendChild(urlInput)

    const tokenLabel = document.createElement('label')
    tokenLabel.htmlFor = 'reviewSyncApiToken'
    tokenLabel.className = 'field-help sync-config-label'
    tokenLabel.textContent = 'Sync token'
    details.appendChild(tokenLabel)

    const tokenInput = document.createElement('input')
    tokenInput.type = 'password'
    tokenInput.id = 'reviewSyncApiToken'
    tokenInput.placeholder = 'Bearer token'
    tokenInput.value = config.apiToken
    tokenInput.className = 'sync-config-input'
    details.appendChild(tokenInput)

    const saveButton = document.createElement('button')
    saveButton.type = 'button'
    saveButton.className = 'tool-btn secondary-tool'
    saveButton.id = 'saveSyncSettings'
    saveButton.textContent = 'Save sync settings'
    details.appendChild(saveButton)
    saveButton.addEventListener('click', () => {
      writeConfig({ apiUrl: urlInput.value, apiToken: tokenInput.value })
      // Any conflicts still on screen describe revisions of the server
      // configured a moment ago. They are meaningless — and unsafe to act
      // on — against a different one, so drop them; a fresh pull will
      // re-report anything that still conflicts.
      renderConflicts([], {})
      setSyncStatus(isConfigured() ? 'Sync settings saved.' : 'Sync settings cleared.')
      updateSyncActionAvailability()
    })

    const pullButton = document.createElement('button')
    pullButton.type = 'button'
    pullButton.className = 'tool-btn secondary-tool'
    pullButton.id = 'pullReviewState'
    pullButton.textContent = 'Pull from server'
    details.appendChild(pullButton)

    // Declared before the handlers so each can disable the other. Pull and
    // push overlapping is what produces a conflict row against this
    // browser's own in-flight push; locking both out for the duration makes
    // that hard to reach, but it is feedback and race-narrowing only —
    // `stale` in pullFromServer and the revision check in resolveConflict
    // are the guards that actually hold, since either call can be made
    // programmatically.
    let pushButton
    let syncBusy = false
    const setSyncButtonsBusy = (busy) => {
      syncBusy = busy
      updateSyncActionAvailability()
    }

    pullButton.addEventListener('click', () => {
      setSyncStatus('Pulling from server…')
      setSyncButtonsBusy(true)
      pullFromServer()
        .then((result) => {
          if (result.ok) {
            const conflictCount = result.conflicts?.length || 0
            let message = `Pulled ${result.pulledCount} updated page review${result.pulledCount === 1 ? '' : 's'} from server.`
            if (conflictCount) {
              message += ` ${conflictCount} page${conflictCount === 1 ? '' : 's'} could not be auto-merged — they have unsynced local edits that conflict with newer server changes. Choose a version for each below.`
            }
            // A superseded pull must drive NO user-facing feedback for this
            // request — not the panel, whose (possibly empty) conflict list
            // would wipe controls a newer pull put there, and not the status
            // text or toast, which would then describe an outcome that
            // contradicts the panel actually on screen.
            if (!result.stale) {
              setSyncStatus(message)
              renderConflicts(result.conflicts || [], result.conflictRecords || {}, result.apiUrl)
            }
            // The pull reset in-memory content for the pages it applied, so
            // repaint if the open page was one of them — otherwise the mockup
            // keeps showing values the server no longer has.
            const currentKey = window.utils?.getCurrentKey?.()
            if (
              result.pulledKeys?.includes(currentKey) &&
              typeof window.renderPage === 'function'
            ) {
              window.renderPage(currentKey)
            }
            window.ReviewUx?.stateSync?.applySavedPageState(currentKey)
            window.ReviewUx?.refreshUx?.()
            if (!result.stale && typeof window.showToast === 'function')
              window.showToast(
                conflictCount
                  ? `Pulled from server — ${conflictCount} page${conflictCount === 1 ? '' : 's'} need a version chosen`
                  : 'Pulled review state from server',
                conflictCount ? 'warn' : 'success'
              )
          } else {
            // Deliberately NOT gated on staleness: a failure is additive
            // information rather than a claim that contradicts the panel,
            // and staying silent about a real one is the worse outcome.
            setSyncStatus(`Pull failed: ${result.error}`)
            if (typeof window.showToast === 'function')
              window.showToast(`Sync pull failed: ${result.error}`, 'warn')
          }
        })
        .finally(() => {
          setSyncButtonsBusy(false)
        })
    })

    pushButton = document.createElement('button')
    pushButton.type = 'button'
    pushButton.className = 'tool-btn secondary-tool'
    pushButton.id = 'pushAllReviewState'
    pushButton.textContent = 'Push all pages'
    details.appendChild(pushButton)
    pushButton.addEventListener('click', () => {
      window.ReviewUx?.stateSync?.saveCurrentPageToLocalStorage()
      setSyncStatus('Pushing to server…')
      setSyncButtonsBusy(true)
      pushAllPages()
        .then((result) => {
          setSyncStatus(
            result.ok
              ? `Pushed ${result.pushedCount} page review${result.pushedCount === 1 ? '' : 's'} to server.`
              : `Push failed after ${result.pushedCount} page${result.pushedCount === 1 ? '' : 's'}: ${result.error}`
          )
          if (typeof window.showToast === 'function') {
            window.showToast(
              result.ok ? 'Pushed review state to server' : `Sync push failed: ${result.error}`,
              result.ok ? 'success' : 'warn'
            )
          }
        })
        .finally(() => {
          // A push advances synced_at for the pages it reconciled, which can
          // retire a conflict row a pull rendered against this browser's own
          // in-flight push. Runs even on a partial failure — pushAllPages is
          // sequential, so the pages that did land are already reconciled.
          pruneReconciledConflicts()
          setSyncButtonsBusy(false)
        })
    })

    const status = document.createElement('p')
    status.id = 'reviewSyncStatus'
    status.className = 'field-help'
    status.textContent = isConfigured()
      ? 'Sync configured.'
      : 'Sync not configured — enter a server URL and token above, then Save sync settings.'
    details.appendChild(status)

    function updateSyncActionAvailability() {
      const configured = isConfigured()
      summary.textContent = configured ? 'Server sync' : 'Server sync (optional — local-only)'
      pullButton.disabled = syncBusy || !configured
      if (pushButton) pushButton.disabled = syncBusy || !configured
    }

    updateSyncActionAvailability()

    const conflictPanel = document.createElement('div')
    conflictPanel.id = 'reviewSyncConflicts'
    conflictPanel.className = 'sync-conflict-panel'
    conflictPanel.hidden = true
    details.appendChild(conflictPanel)
  }

  window.reviewStateSync = {
    CONFIG_KEY,
    readConfig,
    writeConfig,
    isConfigured,
    pullFromServer,
    resolveConflict,
    pushPage,
    pushAllPages,
    mountSyncControls,
    startAutoSync,
    scheduleAutoPush,
    flushAutoPushes,
    pushDirtyPages,
    checkSession,
    signIn,
    signOut,
  }

  // Node/Bun-side export for unit testing the pull/push conflict-resolution
  // logic without a real browser — same dual-export pattern js/review-merge.js
  // uses. No behavior change in the browser; module is undefined there.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      pullFromServer,
      resolveConflict,
      restorePageContentFromOriginal,
      pushPage,
      pushAllPages,
      isConfigured,
      readConfig,
      writeConfig,
      startAutoSync,
      scheduleAutoPush,
      flushAutoPushes,
      pushDirtyPages,
      checkSession,
      signIn,
      signOut,
    }
  }
})()
