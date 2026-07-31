/* Review insights: data shaping.

   Pure functions that turn the review queue's rows and the saved review state
   into the three series the Overview charts draw. Deliberately free of both
   DOM and ECharts: everything here is a plain array-in / array-out transform,
   so the interesting logic (what counts as "decided", how a day's cumulative
   total is built, how ties sort) is unit-testable without a browser or a
   charting library. js/review-insights.js owns all the rendering.

   Loaded before js/review-insights.js. Takes no imports — it is required
   directly by tests/review-insights.test.js as well as being bundled. */

/**
 * The five decisions, in the order a reviewer moves through them. Chart
 * segments and table rows both follow this order rather than whatever order
 * the data happens to arrive in, so the mix bar does not reshuffle itself as
 * counts change during triage.
 */
const DECISION_ORDER = [
  'Needs review',
  'Approved',
  'Approved with edits',
  'Revise and resubmit',
  'Blocked',
]

/** A page counts as reviewed once it carries any decision but this one. */
const UNDECIDED = 'Needs review'

/**
 * Count pages by decision, in canonical order.
 *
 * Returns every decision including the ones at zero. A chart that silently
 * drops empty categories tells a manager "there are no blocked pages" and
 * "blocked pages are not measured here" with the same picture.
 * @param {Array<{decision?: string}>} rows queue rows
 * @returns {Array<{decision: string, count: number, pct: number}>}
 */
function buildDecisionMix(rows) {
  const list = Array.isArray(rows) ? rows : []
  const counts = new Map(DECISION_ORDER.map((decision) => [decision, 0]))

  for (const row of list) {
    const decision = row?.decision || UNDECIDED
    // An unrecognised decision is counted rather than dropped — it is real
    // saved state, and losing it here would make the chart disagree with the
    // queue table's own totals.
    counts.set(decision, (counts.get(decision) || 0) + 1)
  }

  const total = list.length
  return Array.from(counts, ([decision, count]) => ({
    decision,
    count,
    pct: total ? Math.round((count / total) * 100) : 0,
  }))
}

/**
 * Parse a history timestamp into a YYYY-MM-DD day key.
 *
 * Returns null rather than throwing or coercing: history entries are written
 * by several code paths and imported from CSV/JSON backups, so a malformed or
 * missing timestamp is a realistic input, and one bad entry must not take the
 * whole chart down.
 * @param {unknown} timestamp
 * @returns {string|null}
 */
function toDayKey(timestamp) {
  if (typeof timestamp !== 'string' || !timestamp) return null
  // An already-plain calendar date (review_date is stored this way) is passed
  // through untouched. Parsing it would read it as UTC midnight and then
  // re-render it locally, which shifts it back a day in every timezone west of
  // Greenwich — turning a stored date into the previous one.
  if (/^\d{4}-\d{2}-\d{2}$/.test(timestamp)) return timestamp

  const parsed = new Date(timestamp)
  if (Number.isNaN(parsed.getTime())) return null
  // The reviewer's LOCAL day, not the UTC one. This used to be
  // toISOString().slice(0, 10), which buckets a decision made at 5pm in San
  // Francisco into the following day — disagreeing with the review_date saved
  // alongside it, since utils.today() builds that from local getFullYear/
  // getMonth/getDate. The chart has to speak the same calendar as the record.
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * The day a page was first actually decided, or null if it never was.
 *
 * Reads the whole history rather than trusting its order. Entries are appended
 * chronologically today, but a JSON backup import merges two histories
 * together (see combineHistory in js/review-merge.js), so "first entry that
 * counts" is not reliably the earliest one in the array.
 * @param {{history?: Array<{timestamp?: string, decision?: string}>}} record
 * @returns {string|null}
 */
function firstDecidedDay(record) {
  const history = Array.isArray(record?.history) ? record.history : []
  let earliest = null

  for (const entry of history) {
    if (!entry?.decision || entry.decision === UNDECIDED) continue
    const day = toDayKey(entry.timestamp)
    if (!day) continue
    if (!earliest || day < earliest) earliest = day
  }
  if (earliest) return earliest

  // Legacy fallback. history[] was added alongside the sync backend, and the
  // storage version was deliberately NOT bumped because the field is additive
  // — so a record saved before it exists carries a real decision and no
  // history at all, and autosave preserves that emptiness rather than
  // backfilling it. Without this branch such a page counts as decided in the
  // mix and the queue but contributes nothing to activity, so the two halves
  // of the same card contradict each other: "12 of 19 decided" above a chart
  // reading "No decisions recorded yet".
  //
  // review_date first: it is the reviewer's own stated date. updated_at is the
  // fallback's fallback — it is a browser-clock write time rather than a
  // decision date, which is why it is not preferred.
  if (record?.decision && record.decision !== UNDECIDED) {
    return toDayKey(record.review_date) || toDayKey(record.updated_at)
  }

  return null
}

/**
 * Cumulative count of decided pages per day, oldest first.
 *
 * Only days on which something was decided appear — the series is a set of
 * observations, not a calendar. Gaps are the chart's problem to render (the
 * line joins across them), not this function's to invent rows for.
 *
 * Pages with no qualifying history contribute nothing, which is why a fresh
 * browser with unreviewed pages produces an empty array rather than a flat
 * line at zero. The caller renders an empty state for that.
 * @param {Record<string, object>} savedPages the `pages` map from review state
 * @returns {Array<{date: string, decided: number, total: number}>}
 */
function buildActivitySeries(savedPages, validKeys) {
  const pages = savedPages && typeof savedPages === 'object' ? savedPages : {}
  // Saved state outlives the sitemap. Review records are keyed by page key and
  // nothing prunes them when a page is retired in an IA consolidation, so a
  // browser that reviewed the old site still holds rows for keys that no
  // longer exist. Counting those makes the running total climb past the site
  // total the other two charts are computed from — a chart claiming 23 of 19
  // pages decided. Restricted to the keys the queue actually has.
  //
  // An absent/empty set means "no restriction", so a caller that has no key
  // list still gets the whole map rather than an empty chart.
  const allowed = validKeys instanceof Set ? validKeys : null
  const perDay = new Map()

  for (const key of Object.keys(pages)) {
    if (allowed && allowed.size && !allowed.has(key)) continue
    const day = firstDecidedDay(pages[key])
    if (!day) continue
    perDay.set(day, (perDay.get(day) || 0) + 1)
  }

  const days = Array.from(perDay.keys()).sort()
  let running = 0
  return days.map((date) => {
    const decided = perDay.get(date) || 0
    running += decided
    return { date, decided, total: running }
  })
}

/**
 * Per-page check results, worst first.
 *
 * Sorted by pass rate ascending so the pages needing attention are the ones a
 * manager reads first, with page key as the tiebreaker so equal scores hold a
 * stable order between renders instead of shuffling on every keystroke.
 *
 * Pages whose checks have not been evaluated (checksTotal of 0) are excluded:
 * a bar at 0% would read as "every check failed" when it means "nothing ran".
 * @param {Array<{key: string, title?: string, checksPassed?: number, checksTotal?: number}>} rows
 * @returns {Array<{key: string, title: string, passed: number, total: number, pct: number}>}
 */
function buildChecksSeries(rows) {
  const list = Array.isArray(rows) ? rows : []
  return list
    .filter((row) => Number(row?.checksTotal) > 0)
    .map((row) => {
      const total = Number(row.checksTotal)
      const passed = Number(row.checksPassed) || 0
      return {
        key: row.key,
        title: row.title || row.key,
        passed,
        total,
        pct: Math.round((passed / total) * 100),
      }
    })
    .sort((a, b) => a.pct - b.pct || String(a.key).localeCompare(String(b.key)))
}

/**
 * A cheap fingerprint of everything the charts draw.
 *
 * The Overview panel rebuilds its innerHTML on every filter, sort and search
 * keystroke, and re-initialising three ECharts instances each time is both
 * slow and visibly flickery. The charts depend only on the full row set, never
 * on the active filter, so the orchestrator compares this string and skips the
 * rebuild when nothing it draws has changed.
 * @param {object} model output of buildInsightsModel
 * @returns {string}
 */
function insightsSignature(model) {
  const mix = (model?.decisionMix || []).map((item) => `${item.decision}:${item.count}`).join(',')
  const activity = (model?.activity || []).map((item) => `${item.date}:${item.total}`).join(',')
  // Every field that gets RENDERED belongs in the fingerprint, not just the
  // one the bar length is drawn from. A page whose title changes while its
  // pass rate does not — restoring an edited_title from a backup import or a
  // sync pull — produced an identical signature, so the redraw was skipped and
  // both the chart's axis label and its accessible data table kept showing the
  // old title indefinitely.
  const checks = (model?.checks || [])
    .map((item) => `${item.key}:${item.title}:${item.passed}/${item.total}`)
    .join(',')
  return `${mix}|${activity}|${checks}`
}

/**
 * Build every series the Overview charts need, in one pass.
 * @param {Array<object>} rows queue rows (all of them, not the filtered view)
 * @param {Record<string, object>} savedPages the `pages` map from review state
 * @returns {{decisionMix: Array, activity: Array, checks: Array, total: number}}
 */
function buildInsightsModel(rows, savedPages) {
  const list = Array.isArray(rows) ? rows : []
  const checks = buildChecksSeries(list)
  return {
    decisionMix: buildDecisionMix(list),
    // Scoped to the keys the queue holds, so activity can never describe more
    // pages than the site has.
    activity: buildActivitySeries(savedPages, new Set(list.map((row) => row?.key))),
    checks,
    // The pages the "Checks needing attention" card should actually draw.
    // `checks` keeps every page for the accessible table; this is the subset
    // the card's own title promises. Without it the chart pads itself out to
    // its row cap with pages at 100%, and a site where everything passes shows
    // eight green bars under a heading about problems instead of saying so.
    checksFailing: checks.filter((item) => item.pct < 100),
    total: list.length,
  }
}

if (typeof window !== 'undefined') {
  window.ReviewInsights = window.ReviewInsights || {}
  window.ReviewInsights.data = {
    DECISION_ORDER,
    buildDecisionMix,
    buildActivitySeries,
    buildChecksSeries,
    buildInsightsModel,
    insightsSignature,
    firstDecidedDay,
    toDayKey,
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DECISION_ORDER,
    buildDecisionMix,
    buildActivitySeries,
    buildChecksSeries,
    buildInsightsModel,
    insightsSignature,
    firstDecidedDay,
    toDayKey,
  }
}
