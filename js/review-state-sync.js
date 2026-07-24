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
    try {
      localStorage.setItem(
        CONFIG_KEY,
        JSON.stringify({
          apiUrl: (config.apiUrl || '').trim(),
          apiToken: (config.apiToken || '').trim(),
        })
      )
    } catch {
      window.utils?.showErrorBanner?.('Could not save sync settings in this browser.')
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
   * Pull the server's review state and merge it into local state.
   * Deliberately last-write-wins PER PAGE by comparing updated_at, not a
   * field-level merge: a field-level merge here (on top of the field-level
   * merge the server already did on every PUT) would treat the server's
   * already-merged history array as just another "patch" and duplicate
   * history entries. Only overwriting a page's CONTENT when the server is
   * strictly newer keeps unsynced local edits (which bump updated_at on
   * every autosave) safe from being silently discarded by a pull.
   *
   * synced_at, though, is set on every page the server returns regardless
   * of whether its content was applied: pulling tells this browser what
   * the server currently has for that page even when local is kept because
   * it's newer (unpushed edits) — and that's exactly the baseline the next
   * push's conflict check (server.ts's putReviewPage) needs.
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
        window.reviewState.update((state) => {
          const nextPages = { ...state.pages }
          for (const [key, serverRecord] of Object.entries(validated.data.pages || {})) {
            if (!window.HHVC_DATA?.pages?.[key]) continue
            const localRecord = state.pages[key]
            const serverIsNewer =
              !localRecord?.updated_at ||
              (serverRecord.updated_at && serverRecord.updated_at > localRecord.updated_at)
            if (serverIsNewer) {
              nextPages[key] = {
                ...serverRecord,
                page_key: key,
                synced_at: serverRecord.updated_at,
              }
              pulledCount += 1
            } else {
              nextPages[key] = { ...localRecord, synced_at: serverRecord.updated_at }
            }
          }
          return { ...state, pages: nextPages }
        })

        return { ok: true, pulledCount }
      })
      .catch((error) => ({ ok: false, error: error.message || String(error) }))
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
            'Someone else pushed a newer version of this page — pull from server first, then push again.'
          )
        }
        if (!res.ok) throw new Error(`Server responded ${res.status}`)
        return res.json()
      })
      .then((merged) => {
        window.reviewState.update((state) => {
          // synced_at = the server's returned updated_at: this push just
          // told us exactly what the server now has for this page, so
          // that's the new known-server baseline for the next push's
          // conflict check — must be set here (not left to merged.synced_at,
          // whatever the server happened to echo back) since the server has
          // no reason to know or persist this client-side-only field.
          state.pages[pageKey] = { ...merged, synced_at: merged.updated_at }
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
          setSyncStatus(
            `Pulled ${result.pulledCount} updated page review${result.pulledCount === 1 ? '' : 's'} from server.`
          )
          window.ReviewUx?.stateSync?.applySavedPageState(window.utils?.getCurrentKey?.())
          window.ReviewUx?.refreshUx?.()
          if (typeof window.showToast === 'function')
            window.showToast('Pulled review state from server', 'success')
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
  }

  window.reviewStateSync = {
    CONFIG_KEY,
    readConfig,
    writeConfig,
    isConfigured,
    pullFromServer,
    pushPage,
    pushAllPages,
    mountSyncControls,
  }
})()
