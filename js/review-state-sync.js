/* Optional network sync layer on top of window.reviewState (localStorage).
   Talks to the /api/review-state routes added to server.ts (see
   CLAUDE.md's "Review-state sync backend" section). Entirely additive: the
   synchronous core window.reviewState API is untouched, and every function
   here is a no-op whenever no sync URL/token is configured, so the app
   keeps working fully offline exactly as it did before this file existed.
   Loads after js/review-merge.js and js/review-state-store.js. */
;(function mountReviewStateSync() {
  if (typeof window === 'undefined' || !window.reviewState || !window.reviewMerge) return

  const CONFIG_KEY = 'hhvcReviewSyncConfig'
  const API_TIMEOUT_MS = 15000

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
      if (!raw) return { apiUrl: '', apiToken: '' }
      const parsed = JSON.parse(raw)
      return {
        apiUrl: typeof parsed.apiUrl === 'string' ? parsed.apiUrl : '',
        apiToken: typeof parsed.apiToken === 'string' ? parsed.apiToken : '',
      }
    } catch {
      return { apiUrl: '', apiToken: '' }
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
          nextPages[key] = { ...record, synced_at: '' }
        }
        return { ...state, pages: nextPages }
      })
    }
  }

  function isConfigured() {
    const config = readConfig()
    return Boolean(config.apiUrl && config.apiToken)
  }

  /**
   * A hung sync server would otherwise leave the UI stuck on "Pulling…"/
   * "Pushing…" forever, since fetch() has no default timeout. Aborts after
   * API_TIMEOUT_MS, or immediately if a caller-supplied signal aborts first.
   */
  function apiFetch(path, options = {}) {
    const config = readConfig()
    if (!config.apiUrl || !config.apiToken) {
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
      headers: {
        ...(options.headers || {}),
        authorization: `Bearer ${config.apiToken}`,
        'content-type': 'application/json',
      },
    }).finally(() => clearTimeout(timeoutId))
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

    return apiFetch('/api/review-state', { method: 'GET' })
      .then((res) => {
        if (!res.ok) throw new Error(`Server responded ${res.status}`)
        return res.json()
      })
      .then((serverState) => {
        const validator = window.reviewStateValidation?.validateReviewState
        const validated =
          typeof validator === 'function' ? validator(serverState) : { ok: true, data: serverState }
        if (!validated.ok) throw new Error(validated.error || 'Invalid server response.')

        let pulledCount = 0
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

            if (!localRecord?.local_dirty) {
              nextPages[key] = {
                ...serverRecord,
                page_key: key,
                synced_at: serverRevision,
                local_dirty: false,
              }
              pulledCount += 1
              continue
            }

            conflicts.push(key)
            conflictRecords[key] = serverRecord
          }
          return { ...state, pages: nextPages }
        })

        return { ok: true, pulledCount, conflicts, conflictRecords }
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
   * @returns {{ ok: boolean, error?: string }}
   */
  function resolveConflict(pageKey, resolution, serverRecord) {
    if (!pageKey || !serverRecord || typeof serverRecord !== 'object') {
      return { ok: false, error: 'Nothing to resolve for this page.' }
    }
    if (resolution !== 'server' && resolution !== 'local') {
      return { ok: false, error: `Unknown conflict resolution "${resolution}".` }
    }

    const serverRevision = serverRecord.updated_at || ''
    window.reviewState.update((state) => {
      const localRecord = state.pages[pageKey]
      state.pages[pageKey] =
        resolution === 'server'
          ? { ...serverRecord, page_key: pageKey, synced_at: serverRevision, local_dirty: false }
          : { ...localRecord, page_key: pageKey, synced_at: serverRevision, local_dirty: true }
      return state
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
        window.reviewState.update((state) => {
          // If an autosave landed on this page between reading `record`
          // above and this response arriving (a real possibility — a push
          // is a network round-trip, easily longer than the debounce
          // window), the current local record is now NEWER than the
          // snapshot this push was based on. Overwriting it with the
          // response unconditionally would silently drop that later edit.
          // Keep the newer local content in that case and only advance
          // synced_at with what the server confirmed.
          const currentRecord = state.pages[pageKey]
          const localChangedDuringPush =
            currentRecord?.updated_at && currentRecord.updated_at > record.updated_at

          state.pages[pageKey] = localChangedDuringPush
            ? {
                ...currentRecord,
                // `merged.history` includes the "sync" round entry the
                // server just appended for THIS push. Dropping it here
                // would lose that round from the local audit trail
                // permanently: synced_at is about to advance to the
                // server's updated_at, so a future pull would treat this
                // page as "already reconciled" and never fetch it again.
                // combineHistory's content-based dedup makes this a safe
                // additive union, not a re-merge of content fields.
                history: window.reviewMerge.combineHistory(currentRecord.history, merged.history),
                synced_at: merged.updated_at,
                // Still dirty: the edit that landed mid-flight is newer
                // than what this push sent, so it hasn't reached the
                // server yet and must survive the next pull.
                local_dirty: true,
              }
            : // synced_at = the server's returned updated_at: this push just
              // told us exactly what the server now has for this page, so
              // that's the new known-server baseline for the next push's
              // conflict check — must be set here (not left to
              // merged.synced_at, whatever the server happened to echo
              // back) since the server has no reason to know or persist
              // this client-side-only field.
              { ...merged, synced_at: merged.updated_at, local_dirty: false }
          return state
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

  function setSyncStatus(message) {
    const el = document.getElementById('reviewSyncStatus')
    if (el) el.textContent = message
  }

  /**
   * Render one row per conflicted page with the two explicit resolutions.
   * Built with DOM APIs rather than innerHTML so page keys and titles from
   * the server response are never interpreted as markup.
   * @param {string[]} conflicts
   * @param {Record<string, object>} conflictRecords
   */
  function renderConflicts(conflicts, conflictRecords) {
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
          const outcome = resolveConflict(key, resolution, serverRecord)
          if (!outcome.ok) {
            setSyncStatus(`Could not resolve ${key}: ${outcome.error}`)
            return
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

  function mountSyncControls() {
    const actions = document.querySelector('.review-actions')
    if (!actions || document.getElementById('reviewSyncApiUrl')) return

    const config = readConfig()

    // Placeholder text isn't a reliable accessible name (it disappears once
    // typed, and screen readers don't treat it as a persistent label), so
    // each input gets a real <label for="..."> alongside its placeholder.
    const urlLabel = document.createElement('label')
    urlLabel.htmlFor = 'reviewSyncApiUrl'
    urlLabel.className = 'field-help sync-config-label'
    urlLabel.textContent = 'Sync server URL'
    actions.appendChild(urlLabel)

    const urlInput = document.createElement('input')
    urlInput.type = 'text'
    urlInput.id = 'reviewSyncApiUrl'
    urlInput.placeholder = 'https://your-app.up.railway.app'
    urlInput.value = config.apiUrl
    urlInput.className = 'sync-config-input'
    actions.appendChild(urlInput)

    const tokenLabel = document.createElement('label')
    tokenLabel.htmlFor = 'reviewSyncApiToken'
    tokenLabel.className = 'field-help sync-config-label'
    tokenLabel.textContent = 'Sync token'
    actions.appendChild(tokenLabel)

    const tokenInput = document.createElement('input')
    tokenInput.type = 'password'
    tokenInput.id = 'reviewSyncApiToken'
    tokenInput.placeholder = 'Bearer token'
    tokenInput.value = config.apiToken
    tokenInput.className = 'sync-config-input'
    actions.appendChild(tokenInput)

    const saveButton = document.createElement('button')
    saveButton.type = 'button'
    saveButton.className = 'tool-btn secondary-tool'
    saveButton.id = 'saveSyncSettings'
    saveButton.textContent = 'Save sync settings'
    actions.appendChild(saveButton)
    saveButton.addEventListener('click', () => {
      writeConfig({ apiUrl: urlInput.value, apiToken: tokenInput.value })
      setSyncStatus(isConfigured() ? 'Sync settings saved.' : 'Sync settings cleared.')
    })

    const pullButton = document.createElement('button')
    pullButton.type = 'button'
    pullButton.className = 'tool-btn secondary-tool'
    pullButton.id = 'pullReviewState'
    pullButton.textContent = 'Pull from server'
    actions.appendChild(pullButton)
    pullButton.addEventListener('click', () => {
      setSyncStatus('Pulling from server…')
      pullFromServer().then((result) => {
        if (result.ok) {
          const conflictCount = result.conflicts?.length || 0
          let message = `Pulled ${result.pulledCount} updated page review${result.pulledCount === 1 ? '' : 's'} from server.`
          if (conflictCount) {
            message += ` ${conflictCount} page${conflictCount === 1 ? '' : 's'} could not be auto-merged — they have unsynced local edits that conflict with newer server changes. Choose a version for each below.`
          }
          setSyncStatus(message)
          renderConflicts(result.conflicts || [], result.conflictRecords || {})
          window.ReviewUx?.stateSync?.applySavedPageState(window.utils?.getCurrentKey?.())
          window.ReviewUx?.refreshUx?.()
          if (typeof window.showToast === 'function')
            window.showToast(
              conflictCount
                ? `Pulled from server — ${conflictCount} page${conflictCount === 1 ? '' : 's'} need a version chosen`
                : 'Pulled review state from server',
              conflictCount ? 'warn' : 'success'
            )
        } else {
          setSyncStatus(`Pull failed: ${result.error}`)
          if (typeof window.showToast === 'function')
            window.showToast(`Sync pull failed: ${result.error}`, 'warn')
        }
      })
    })

    const pushButton = document.createElement('button')
    pushButton.type = 'button'
    pushButton.className = 'tool-btn secondary-tool'
    pushButton.id = 'pushAllReviewState'
    pushButton.textContent = 'Push all pages'
    actions.appendChild(pushButton)
    pushButton.addEventListener('click', () => {
      window.ReviewUx?.stateSync?.saveCurrentPageToLocalStorage()
      setSyncStatus('Pushing to server…')
      pushAllPages().then((result) => {
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
    })

    const status = document.createElement('p')
    status.id = 'reviewSyncStatus'
    status.className = 'field-help'
    status.textContent = isConfigured()
      ? 'Sync configured.'
      : 'Sync not configured — enter a server URL and token above, then Save sync settings.'
    actions.insertAdjacentElement('afterend', status)

    const conflictPanel = document.createElement('div')
    conflictPanel.id = 'reviewSyncConflicts'
    conflictPanel.className = 'sync-conflict-panel'
    conflictPanel.hidden = true
    status.insertAdjacentElement('afterend', conflictPanel)
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
  }

  // Node/Bun-side export for unit testing the pull/push conflict-resolution
  // logic without a real browser — same dual-export pattern js/review-merge.js
  // uses. No behavior change in the browser; module is undefined there.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      pullFromServer,
      resolveConflict,
      pushPage,
      pushAllPages,
      isConfigured,
      readConfig,
      writeConfig,
    }
  }
})()
