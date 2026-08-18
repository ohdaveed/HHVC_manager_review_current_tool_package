/* Ops surface: a collapsed section inside the Help tab.

   This tool has no roles — the reviewer and the operator are the same person
   (a deliberate product decision, not an omission). What that person lacked
   was any way to see the state the tool is actually in: whether sync and AI
   are configured, how much review data is stored, and whether any of it has
   gone bad. All of that previously required devtools.

   It shipped as a workspace tab of its own, fifth of six, and this header used
   to argue from that: a tab is a scarce slot bound to a number key, which is
   why the Phase 2 charts went on Overview rather than getting one. The
   argument outlived the tab. The strip is now `['overview', 'checks', 'help']`
   on shortcuts 1-3, and a diagnostics readout turned out not to earn a
   top-level slot either — so this panel is docked inside Help, next to AI
   assist.

   Mounts lazily when Help opens, and — like js/ai/ai-assist.js — also catches an
   already-open panel at its own init(), since js/ux-improvements.js restores a
   persisted workspace_tab before these hooks exist and a restored tab would
   otherwise paint empty.

   Loads after js/review-ops-data.js (its diagnostics) and after
   js/sync/review-state-sync.js, whose config it reads to report sync status. */

/* Imported rather than read off `window.utils` at call time. This file used to
   carry its own copy of the escape table as a fallback for "what if utils has
   not loaded yet", which is a load-order worry the module graph settles
   outright: an import cannot resolve late. It also left the repo with three
   hand-maintained copies of the same five replacements, and they had already
   drifted — js/review-insights.js's version failed OPEN. */
import { escapeHtml as escape } from './utils.js'
;(function mountReviewOps() {
  if (typeof window === 'undefined') return

  /* This used to be a tab of its own with `data-workspace-panel="ops"`. It is
     now a collapsed section inside Help, so its host is a plain id and the
     "is it on screen?" question is asked about the Help panel instead. */
  const PANEL_SELECTOR = '#reviewWorkspaceOps'

  /**
   * The page keys the site currently has, for the orphan check.
   *
   * A page the reviewer deleted during review is counted as still known, even
   * though js/page-registry.js has removed it from `order`. Its record is not
   * orphaned — it is the thing Restore brings back — so listing it under
   * "Records for pages that no longer exist" would offer the reviewer a button
   * that destroys the review they are one click away from recovering.
   *
   * Deliberately NOT extended to include reviewer-added pages that were removed
   * for good: once the page object is gone there is nothing to restore, and its
   * record genuinely is an orphan that this panel should collect.
   * @returns {Set<string>} every key in HHVC_DATA.order plus every deleted key,
   *   empty if data has not loaded
   */
  function siteKeys() {
    const keys = new Set((window.HHVC_DATA?.order || []).map(([key]) => key))
    // Only widen a NON-empty set. An empty one means page data has not loaded,
    // and findOrphanedRecords() reads that as "report nothing" — the guard that
    // stops this panel offering to delete a reviewer's entire history. Adding
    // keys to an empty set would defeat it.
    if (!keys.size) return keys
    for (const key of window.pageRegistry?.hiddenKeys?.() || []) keys.add(key)
    return keys
  }

  /**
   * Read the persisted blob as text, for an honest size measurement.
   *
   * The key comes from the store rather than being written out here. The
   * versioned suffix is meant to be bumped whenever the persisted shape
   * changes incompatibly, and a second hardcoded copy would not be bumped
   * with it — this panel would then read a key nothing writes and report
   * "0 B" forever, which is a wrong number rather than a visible failure.
   * @returns {string} the serialized blob, or '' when unreadable
   */
  function rawState() {
    const key = window.reviewState?.STORAGE_KEY
    if (!key) return ''
    try {
      return localStorage.getItem(key) || ''
    } catch {
      // Private-mode or a blocked storage partition.
      return ''
    }
  }

  /**
   * Assemble every diagnostic from the current saved state.
   * @returns {object} the report shape js/review-ops-data.js's buildOpsReport returns
   */
  function buildReport() {
    const state = window.reviewState?.read?.() || { pages: {} }
    return window.ReviewOps.data.buildOpsReport({
      savedPages: state.pages || {},
      validKeys: siteKeys(),
      raw: rawState(),
    })
  }

  /**
   * One labelled figure.
   * @param {string} label the uppercase caption
   * @param {string|number} value the figure itself
   * @param {string} [hint] optional secondary line explaining what the figure means
   * @returns {string} escaped markup
   */
  function stat(label, value, hint) {
    return `
      <div class="ops-stat">
        <span class="ops-stat-label">${escape(label)}</span>
        <strong class="ops-stat-value">${escape(value)}</strong>
        ${hint ? `<span class="ops-stat-hint">${escape(hint)}</span>` : ''}
      </div>
    `
  }

  /**
   * A finding: fine when the count is zero, actionable when it is not.
   * Never colour alone — the wording states the state too.
   * @param {string} title what was looked for
   * @param {string[]} keys the affected page keys; empty means nothing is wrong
   * @param {string} explanation why it matters, shown whether or not there are keys
   * @param {string} [action] markup for a remedy button, rendered only when keys exist
   * @returns {string} escaped markup
   */
  function finding(title, keys, explanation, action = '') {
    const count = keys.length
    const tone = count ? 'warn' : 'pass'
    return `
      <section class="ops-finding" data-ops-finding="${escape(title)}">
        <div class="ops-finding-head">
          <span class="status-chip ${tone}">${count ? `${count} found` : 'None'}</span>
          <h5 class="ops-finding-title">${escape(title)}</h5>
        </div>
        <p class="ops-finding-explain">${escape(explanation)}</p>
        ${
          count
            ? `<ul class="ops-finding-keys">${keys
                .map((key) => `<li><code>${escape(key)}</code></li>`)
                .join('')}</ul>${action}`
            : ''
        }
      </section>
    `
  }

  /**
   * Sync and AI are both optional; "not configured" is a normal answer.
   * @returns {string} escaped markup for the two connection cards
   */
  function connections() {
    const sync = window.reviewStateSync?.readConfig?.() || {}
    // The module's own predicate rather than a second copy of the same test —
    // if what counts as "configured" ever changes, this follows it.
    const syncOn = Boolean(window.reviewStateSync?.isConfigured?.())
    const ai = window.AiAssist?.client?.isConfigured?.() || false

    return `
      <div class="ops-connections">
        ${stat(
          'Review sync',
          syncOn ? 'Configured' : 'Not configured',
          // The URL, never the token: this panel is the kind of thing that
          // ends up in a screenshot.
          // Rendered as TEXT, not as an href — deliberately NOT run through
          // safeUrl(). That helper rewrites an unrecognised scheme to the
          // inert '#', which is right for something clickable and wrong here:
          // this panel's job is to report what is actually configured, and
          // showing '#' in place of a misconfigured URL would hide the very
          // problem an operator opened the tab to find.
          syncOn ? sync.apiUrl : 'Reviews stay in this browser'
        )}
        ${stat('AI assist', ai ? 'Configured' : 'Not configured', ai ? '' : 'Drafting is disabled')}
      </div>
    `
  }

  /**
   * Paint the whole panel from a fresh report.
   *
   * Rebuilds rather than patches: the panel is a snapshot of saved state, and
   * every figure on it can move together when a sync pull lands.
   * @returns {void} no-op when the panel or the diagnostics module is absent
   */
  function render() {
    const panel = document.querySelector(PANEL_SELECTOR)
    if (!panel || !window.ReviewOps?.data) return
    const report = buildReport()

    panel.innerHTML = `
      <section class="ops-panel">
        <header class="ds-section-header">
          <div>
            <h3 class="ds-section-title">Tool status</h3>
            <p class="ds-section-hint">
              What this browser is holding and how it is connected. Press <kbd>3</kbd> for Help,
              then expand this section.
            </p>
          </div>
        </header>

        ${connections()}

        <div class="ops-connections">
          ${stat('Saved page records', report.recordCount)}
          ${stat('Recorded review rounds', report.rounds)}
          ${stat('Stored data', report.storage.label, 'history is append-only, so this only grows')}
          ${stat(
            'Unpushed to sync',
            report.sync.dirty.length,
            report.sync.unknown.length
              ? `${report.sync.unknown.length} of unknown provenance`
              : 'records with local edits the server has not seen'
          )}
        </div>

        <h4 class="ops-subhead">Data health</h4>

        ${finding(
          'Records for pages that no longer exist',
          report.orphaned,
          'Review state is keyed by page key and nothing prunes it when a page is retired, so these are invisible in the queue, inflate any total taken from saved state, and ride along in every backup.',
          '<button type="button" class="review-queue-action" data-ops-action="prune-orphans">Remove these records</button>'
        )}

        ${finding(
          'Decided pages with no recorded round',
          report.withoutHistory,
          'These predate history[], which was added without a storage-version bump because it is additive. Nothing is broken — the charts fall back to review_date — but these pages cannot show when they were decided.'
        )}
      </section>
    `
  }

  /**
   * Delete the orphaned records, after saying exactly how many and which.
   *
   * The only thing on this panel that changes state, and it is destructive in
   * a way no other path is: every other write merges. It therefore confirms
   * first, and re-derives the orphan list at click time rather than trusting
   * what was rendered — the panel may have been sitting open while a sync
   * pull or an import changed the saved state underneath it.
   * @returns {number} how many records were deleted; 0 if declined or none found
   */
  function pruneOrphans() {
    const state = window.reviewState?.read?.() || { pages: {} }
    const orphaned = window.ReviewOps.data.findOrphanedRecords(state.pages || {}, siteKeys())
    if (!orphaned.length) {
      render()
      return 0
    }

    const message =
      `Permanently remove ${orphaned.length} review record(s) for pages that no longer exist?\n\n` +
      `${orphaned.join(', ')}\n\n` +
      'Their decisions, notes and history will be deleted from this browser. ' +
      'Export a backup first if you might need them.'
    // No confirm available means DO NOT DELETE. The inverted form — proceeding
    // when the prompt cannot be shown — reads as harmless but makes the one
    // irreversible path in this tool run unattended in exactly the contexts
    // where nobody is watching it.
    if (typeof window.confirm !== 'function' || !window.confirm(message)) return 0

    window.reviewState.update((localState) => {
      for (const key of orphaned) delete localState.pages[key]
      return localState
    })

    document.dispatchEvent(new CustomEvent('hhvc:review-data-changed'))
    window.showToast?.(`Removed ${orphaned.length} orphaned record(s).`, 'success')
    render()
    return orphaned.length
  }

  /**
   * Delegated click handling, so the panel's markup can be replaced wholesale
   * on every render without rebinding anything.
   * @param {Event} event a document-level click
   * @returns {void}
   */
  function handleClick(event) {
    const target = event.target
    if (!(target instanceof Element)) return
    if (target.closest('[data-ops-action="prune-orphans"]')) pruneOrphans()
  }

  /**
   * Called by setWorkspaceTab the first time the Ops tab opens.
   * @returns {void}
   */
  function ensureRendered() {
    render()
  }

  /**
   * Wire the delegated click handler and the tab-open hook.
   * @returns {void}
   */
  function init() {
    document.addEventListener('click', handleClick)
    // Diagnostics are a snapshot, not a live view — but a decision made in the
    // queue while this tab is open should not leave stale numbers on screen.
    document.addEventListener('hhvc:review-data-changed', () => {
      if (window.utils.isWorkspacePanelOpen('help')) render()
    })
    window.__mountReviewOpsOnTabOpen = ensureRendered
    // Catch a tab that is ALREADY open at init time — see
    // mountWorkspacePanelIfOpen in js/utils.js for why every lazy panel needs
    // this, and why panel visibility is the signal rather than saved state.
    // See the note in js/ai/ai-assist.js: this is a section inside Help now, so
    // Help is the panel whose open state matters.
    window.utils.mountWorkspacePanelIfOpen('help', render)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }

  window.ReviewOps = window.ReviewOps || {}
  window.ReviewOps.render = render
  window.ReviewOps.pruneOrphans = pruneOrphans
  window.ReviewOps.buildReport = buildReport
})()
