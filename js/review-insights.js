/* Review insights: the Overview charts.

   Three compact cards above the review queue table, answering what a manager
   asks before scanning 19 rows: what is the decision mix, is review actually
   progressing, and which pages are failing their checks.

   ECharts is NOT imported here. It lives in js/review-insights-charts.js and
   is pulled in with a dynamic import the first time this renders, so Vite
   emits it as a separate chunk rather than adding ~530KB to the bundle every
   visitor downloads. That split has a second benefit worth stating, because it
   drove how this file is ordered: the card headings and the visually hidden
   data tables are built SYNCHRONOUSLY, before the library is even requested.
   The numbers are therefore in the DOM and available to a screen reader
   whether or not the chart chunk ever arrives — on a slow link, or if it fails
   to load outright, the accessible content is already there and only the
   decorative graphic is missing.

   Each chart is aria-hidden and paired with one of those tables. That mirrors
   USWDS's data-visualisation guidance: the graphic is not the accessible
   artifact, the equivalent table is, and exposing both just makes a screen
   reader read the numbers twice.

   Load-order dependency: imported by js/main.js after js/review-queue*.js,
   because js/review-queue-render.js calls window.ReviewInsights.render() at
   the end of its own render. That call is optional-chained, so the ordering is
   a performance detail rather than a correctness one. */

import { buildInsightsModel, insightsSignature } from './review-insights-data.js'

/** How many pages the checks chart draws. See checksOption for why. */
const CHECKS_VISIBLE = 8

/**
 * Chart colours come from the live CSS custom properties rather than being
 * hardcoded, so the charts follow the theme — including the dark-mode
 * overrides — without this module knowing a theme exists. That indirection is
 * what lets dark mode use a separately chosen set of chart fills rather than a
 * lightened copy of the light ones.
 * @returns {object}
 */
function readTheme() {
  const styles = window.getComputedStyle(document.documentElement)
  const token = (name, fallback) => (styles.getPropertyValue(name) || '').trim() || fallback
  return {
    text: token('--text-primary', '#0b0c0c'),
    muted: token('--text-secondary', '#6e7070'),
    border: token('--border-default', '#e9eaea'),
    surface: token('--surface-panel', '#fcfcfc'),
    // The --viz-decision-* tokens, not the --status-*-border ones the chips
    // use. See the block comment on them in css/theme.css: the chip borders are
    // tuned as 1px strokes and, used as large fills, Approved and Needs review
    // separate by ΔE 8.4 under normal vision against a floor of 15.
    decision: {
      'Needs review': token('--viz-decision-pending', '#8a8d8d'),
      Approved: token('--viz-decision-approved', '#00734f'),
      'Approved with edits': token('--viz-decision-edits', '#c07000'),
      'Revise and resubmit': token('--viz-decision-revise', '#8f57b3'),
      Blocked: token('--viz-decision-blocked', '#c0392b'),
    },
    line: token('--viz-2', '#0072b2'),
    bar: token('--viz-1', '#009e73'),
    barWarn: token('--viz-3', '#d55e00'),
  }
}

/** Escape for the data tables, which are built as HTML strings. */
function escape(value) {
  return window.utils?.escapeHtml
    ? window.utils.escapeHtml(String(value ?? ''))
    : String(value ?? '')
}

/**
 * The visually hidden table carrying a chart's data to assistive tech.
 * @param {string} caption
 * @param {string[]} headers
 * @param {Array<Array<string|number>>} rows
 * @returns {string}
 */
function dataTable(caption, headers, rows) {
  return `
    <table class="hhvc-sr-only">
      <caption>${escape(caption)}</caption>
      <thead><tr>${headers.map((header) => `<th scope="col">${escape(header)}</th>`).join('')}</tr></thead>
      <tbody>
        ${rows
          .map((row) => `<tr>${row.map((cell) => `<td>${escape(cell)}</td>`).join('')}</tr>`)
          .join('')}
      </tbody>
    </table>
  `
}

/** Stable slug for a decision, used to key the legend swatch colours in CSS. */
function decisionSlug(decision) {
  return String(decision)
    .toLowerCase()
    .replace(/[^a-z]+/g, '-')
}

/**
 * Visible legend for the decision mix, with a count beside each label.
 *
 * Not optional decoration. The stacked bar carries five series, and identity in
 * the graphic is otherwise conveyed by colour alone — so this is what keeps the
 * card off WCAG 1.4.1. It also supplies the secondary encoding that makes the
 * closest colour pair legitimate: the green/amber step separates at ΔE 7.4
 * under protanopia, which sits in the band that is only acceptable alongside
 * direct labels.
 *
 * Deliberately NOT aria-hidden, unlike the chart it labels — this is real
 * content, and it is the sighted reader's equivalent of the data table.
 * @param {object} model
 * @returns {string}
 */
function decisionLegend(model) {
  const present = model.decisionMix.filter((item) => item.count > 0)
  return `
    <ul class="insights-legend">
      ${present
        .map(
          (item) => `
        <li class="insights-legend-item">
          <span class="insights-swatch" data-decision="${escape(decisionSlug(item.decision))}"></span>
          <span class="insights-legend-label">${escape(item.decision)}</span>
          <b class="insights-legend-count">${escape(item.count)}</b>
        </li>
      `
        )
        .join('')}
    </ul>
  `
}

/** One card: heading, chart mount point, optional extras, and the table. */
function card(id, title, hint, table, extra = '') {
  return `
    <section class="insights-card">
      <div class="insights-card-head">
        <h4 class="insights-card-title">${escape(title)}</h4>
        <p class="insights-card-hint">${escape(hint)}</p>
      </div>
      <div class="insights-chart" data-insights-chart="${escape(id)}" aria-hidden="true"></div>
      ${extra}
      ${table}
    </section>
  `
}

/** Empty state, used when a chart genuinely has nothing to draw. */
function emptyCard(title, hint, message) {
  return `
    <section class="insights-card">
      <div class="insights-card-head">
        <h4 class="insights-card-title">${escape(title)}</h4>
        <p class="insights-card-hint">${escape(hint)}</p>
      </div>
      <p class="ds-empty">${escape(message)}</p>
    </section>
  `
}

/** Build the three cards, tables included, chart boxes still empty. */
function buildMarkup(model) {
  const decisionTable = dataTable(
    'Pages by review decision',
    ['Decision', 'Pages', 'Share'],
    model.decisionMix.map((item) => [item.decision, item.count, `${item.pct}%`])
  )
  const activityTable = dataTable(
    'Pages decided over time',
    ['Date', 'Decided that day', 'Running total'],
    model.activity.map((point) => [point.date, point.decided, point.total])
  )
  const checksTable = dataTable(
    'Automated check results by page',
    ['Page', 'Checks passing', 'Checks total', 'Pass rate'],
    model.checks.map((item) => [item.title, item.passed, item.total, `${item.pct}%`])
  )

  const decided = model.decisionMix
    .filter((item) => item.decision !== 'Needs review')
    .reduce((sum, item) => sum + item.count, 0)

  return `
    ${card(
      'decision',
      'Decision mix',
      `${decided} of ${model.total} pages decided`,
      decisionTable,
      decisionLegend(model)
    )}
    ${
      model.activity.length
        ? card('activity', 'Review activity', 'Pages decided, running total', activityTable)
        : emptyCard(
            'Review activity',
            'Pages decided, running total',
            'No decisions recorded yet. This fills in as pages are reviewed.'
          )
    }
    ${
      model.checks.length
        ? card(
            'checks',
            'Checks needing attention',
            model.checks.length > CHECKS_VISIBLE
              ? `${CHECKS_VISIBLE} lowest of ${model.checks.length} pages`
              : `${model.checks.length} pages`,
            checksTable
          )
        : emptyCard(
            'Checks needing attention',
            'Automated page checks',
            'No check results available for these pages.'
          )
    }
  `
}

// The chart host is created once and re-parented into each freshly rendered
// Overview panel rather than being rebuilt with it. The panel replaces its
// whole innerHTML on every filter, sort and search keystroke; redrawing three
// ECharts instances at that rate is slow and visibly flickery, and the charts
// do not depend on the active filter anyway.
let chartsRoot = null
let instances = []
let lastSignature = null
let resizeObserver = null
let themeQuery = null
let chartsModule = null

/**
 * Every render() call takes the next number, and an async draw checks it
 * before touching state. Renders can overlap — the panel rebuilds on each
 * keystroke while the chart chunk is still downloading — and without this an
 * earlier, slower draw could land after a later one and paint stale data over
 * current numbers.
 */
let generation = 0

function disposeCharts() {
  for (const instance of instances) instance.dispose()
  instances = []
}

/** Load the ECharts layer once, reusing the module namespace after that. */
function loadCharts() {
  if (!chartsModule) chartsModule = import('./review-insights-charts.js')
  return chartsModule
}

/**
 * Render the insights block into the Overview panel.
 *
 * Called by js/review-queue-render.js after it rebuilds the panel. Safe to
 * call on every render: it re-parents the existing charts and only redraws
 * when the underlying numbers actually changed.
 * @returns {Promise<void>} resolves once any redraw has been applied
 */
async function render() {
  const slot = document.getElementById('reviewInsights')
  if (!slot) return

  const rows = window.ReviewQueueInternal?.rows?.getQueueRows?.() || []
  const savedPages = window.reviewState?.read?.()?.pages || {}
  const model = buildInsightsModel(rows, savedPages)
  const signature = insightsSignature(model)

  if (!chartsRoot) {
    chartsRoot = document.createElement('div')
    chartsRoot.className = 'insights-grid'
  }
  // Moves the node when it was parented to a previous render's panel.
  if (chartsRoot.parentNode !== slot) slot.appendChild(chartsRoot)

  observe()

  if (signature === lastSignature && instances.length) {
    // Same numbers, but the panel may have been rebuilt at a different width,
    // and ECharts sizes to its container at init.
    for (const instance of instances) instance.resize()
    return
  }

  lastSignature = signature
  const mine = ++generation
  disposeCharts()
  // Headings and data tables go in now, before the library is requested, so
  // the numbers survive a slow or failed chunk load.
  chartsRoot.innerHTML = buildMarkup(model)

  let charts
  try {
    charts = await loadCharts()
  } catch {
    // The cards and their tables are already rendered; a missing chunk costs
    // the graphics, not the content.
    chartsModule = null
    return
  }
  if (mine !== generation) return

  instances = charts.draw(chartsRoot, model, readTheme(), CHECKS_VISIBLE)
}

/** Keep the charts sized to their container, and themed to the OS setting. */
function observe() {
  if (!resizeObserver && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      for (const instance of instances) instance.resize()
    })
    resizeObserver.observe(chartsRoot)
  }
  if (!themeQuery && typeof window.matchMedia === 'function') {
    themeQuery = window.matchMedia('(prefers-color-scheme: dark)')
    // Colours are read from CSS custom properties when the charts are drawn,
    // so a theme flip has to redraw rather than just resize.
    themeQuery.addEventListener?.('change', () => {
      lastSignature = null
      render()
    })
  }
}

window.ReviewInsights = window.ReviewInsights || {}
window.ReviewInsights.render = render
window.ReviewInsights.CHECKS_VISIBLE = CHECKS_VISIBLE

export { render, buildMarkup, readTheme, CHECKS_VISIBLE }
