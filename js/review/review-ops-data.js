/* Ops surface: data shaping.

   Pure functions that inspect the persisted review state and report what an
   operator — the same person as the reviewer here, since this tool has no
   roles — would otherwise have to open devtools to find out. No DOM, dual
   window/module.exports like js/review-merge.js, so tests/review-ops-data.test.js
   can require it with no browser.

   These are diagnostics, never repairs. Everything here answers a question;
   js/review/review-ops.js owns the one action that changes anything, and asks first. */

/**
 * Review records whose page key is no longer part of the site.
 *
 * These are real, not hypothetical. Review state is keyed by page key and
 * nothing prunes it when a page is retired in an IA consolidation, so a
 * browser that reviewed an earlier version of the site still carries rows for
 * keys that no longer exist. They are invisible in the queue (which iterates
 * the site, not the saved state), they inflate any total computed from the
 * saved state, and they ride along in every CSV/JSON backup — which is how
 * they spread to other machines.
 * @param {Record<string, object>} savedPages the `pages` map from review state
 * @param {Set<string>|string[]} validKeys the page keys the site currently has
 * @returns {string[]} orphaned keys, sorted
 */
function findOrphanedRecords(savedPages, validKeys) {
  const pages = savedPages && typeof savedPages === 'object' ? savedPages : {}
  const allowed = validKeys instanceof Set ? validKeys : new Set(validKeys || [])
  // An empty key set means the page data has not loaded. Reporting every
  // record as orphaned in that state would invite a reviewer to delete their
  // entire review history, so report nothing instead.
  if (!allowed.size) return []
  return Object.keys(pages)
    .filter((key) => !allowed.has(key))
    .sort()
}

/**
 * Split records by whether they hold work the sync server has not seen.
 *
 * `local_dirty` is deliberately tri-state (see the sync notes in AGENTS.md):
 * `true` means unpushed, an explicit `false` means "matches the server", and
 * ABSENT means the record predates the flag and its provenance is unknown.
 * Those three are reported separately rather than collapsed, because the
 * whole reason the field is tri-state is that "missing" must not be read as
 * "clean" — doing so is what would let a pull overwrite work that was never
 * pushed.
 * @param {Record<string, object>} savedPages
 * @returns {{dirty: string[], clean: string[], unknown: string[]}}
 */
function groupBySyncState(savedPages) {
  const pages = savedPages && typeof savedPages === 'object' ? savedPages : {}
  const dirty = []
  const clean = []
  const unknown = []

  for (const key of Object.keys(pages).sort()) {
    const flag = pages[key]?.local_dirty
    if (flag === true) dirty.push(key)
    else if (flag === false) clean.push(key)
    else unknown.push(key)
  }

  return { dirty, clean, unknown }
}

/**
 * Records carrying a real decision but no review round at all.
 *
 * `history[]` was added alongside the sync backend without bumping the
 * storage version, because the field is additive. A record written before
 * that therefore has a decision and an empty history, and autosave preserves
 * the emptiness rather than backfilling it. Worth surfacing because it is
 * exactly the shape that makes the Overview activity chart and the decision
 * mix disagree until the fallback in js/review/review-insights-data.js catches it.
 * @param {Record<string, object>} savedPages
 * @returns {string[]}
 */
function findRecordsWithoutHistory(savedPages) {
  const pages = savedPages && typeof savedPages === 'object' ? savedPages : {}
  return Object.keys(pages)
    .filter((key) => {
      const record = pages[key]
      const decided = record?.decision && record.decision !== 'Needs review'
      const rounds = Array.isArray(record?.history) ? record.history.length : 0
      return decided && rounds === 0
    })
    .sort()
}

/**
 * Size of the persisted blob, in bytes and in something readable.
 *
 * Bytes, not string length: localStorage quotas are counted in UTF-16 code
 * units by some browsers and bytes by others, but a reviewer wants to know
 * roughly how close they are to a limit, and `history[]` is append-only so
 * this only ever grows. TextEncoder is used when available and the length is
 * the honest fallback.
 * @param {string} raw the serialized review state
 * @returns {{bytes: number, label: string}}
 */
function measureStorage(raw) {
  const text = typeof raw === 'string' ? raw : ''
  const bytes =
    typeof TextEncoder === 'function' ? new TextEncoder().encode(text).length : text.length
  if (bytes < 1024) return { bytes, label: `${bytes} B` }
  if (bytes < 1024 * 1024) return { bytes, label: `${(bytes / 1024).toFixed(1)} KB` }
  return { bytes, label: `${(bytes / (1024 * 1024)).toFixed(2)} MB` }
}

/**
 * Total recorded review rounds across every page.
 * @param {Record<string, object>} savedPages
 * @returns {number}
 */
function countRounds(savedPages) {
  const pages = savedPages && typeof savedPages === 'object' ? savedPages : {}
  return Object.keys(pages).reduce((sum, key) => {
    const history = pages[key]?.history
    return sum + (Array.isArray(history) ? history.length : 0)
  }, 0)
}

/**
 * Everything the ops panel reports, in one pass.
 * @param {{savedPages: Record<string, object>, validKeys: Set<string>|string[], raw: string}} input
 * @returns {object}
 */
function buildOpsReport({ savedPages, validKeys, raw } = {}) {
  const pages = savedPages && typeof savedPages === 'object' ? savedPages : {}
  const sync = groupBySyncState(pages)
  return {
    recordCount: Object.keys(pages).length,
    rounds: countRounds(pages),
    orphaned: findOrphanedRecords(pages, validKeys),
    withoutHistory: findRecordsWithoutHistory(pages),
    sync,
    storage: measureStorage(raw),
  }
}

if (typeof window !== 'undefined') {
  window.ReviewOps = window.ReviewOps || {}
  window.ReviewOps.data = {
    findOrphanedRecords,
    groupBySyncState,
    findRecordsWithoutHistory,
    measureStorage,
    countRounds,
    buildOpsReport,
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    findOrphanedRecords,
    groupBySyncState,
    findRecordsWithoutHistory,
    measureStorage,
    countRounds,
    buildOpsReport,
  }
}
