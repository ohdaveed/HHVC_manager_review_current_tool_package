/* Review insights: the Overview activity chart and failing-checks ranking.

   Two compact cards above the review queue table, answering what a manager
   asks before scanning 19 rows: is review actually progressing, and which pages
   are failing their checks. A third card ("Decision mix") was cut — the filter
   chips directly above already print the same five counts and filter by them,
   so the chart and its legend were the second and third rendering of numbers
   the reader had not yet scrolled past.

   ECharts is NOT imported here. It lives in js/review/review-insights-charts.js and
   is pulled in with a dynamic import the first time this renders, so Vite
   emits it as a separate chunk rather than adding ~530KB to the bundle every
   visitor downloads. That split has a second benefit worth stating, because it
   drove how this file is ordered: the card headings and the visually hidden
   data tables are built SYNCHRONOUSLY, before the library is even requested.
   The numbers are therefore in the DOM and available to a screen reader
   whether or not the chart chunk ever arrives — on a slow link, or if it fails
   to load outright, the accessible content is already there and only the
   decorative graphic is missing.

   The activity chart is aria-hidden and paired with one of those tables. That
   mirrors USWDS's data-visualisation guidance: the graphic is not the
   accessible artifact, the equivalent table is, and exposing both just makes a
   screen reader read the numbers twice. The checks card needs neither — it is a
   visible ranked list, which is already the accessible artifact.

   Load-order dependency: imported by js/main.js after js/review/review-queue*.js,
   because js/review/review-queue-render.js calls window.ReviewInsights.render() at
   the end of its own render. That call is optional-chained, so the ordering is
   a performance detail rather than a correctness one. */

import { escapeHtml } from '../core/utils.js'

// js/review/review-insights-data.js is a dual-export module (window.ReviewInsights.data
// plus module.exports, no DOM dependency — see its header) so it stays
// require()-able from Node/Bun test files with no ESM/CJS interop. It carries
// no `export` statement, so it's loaded here as a side effect (js/main.js
// imports it immediately before this file) and consumed off the window
// namespace, matching how js/review/review-ops.js calls window.ReviewOps.data.*.

/** How many pages the checks ranking lists. See checksList for why it is capped. */
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
    line: token('--viz-2', '#0072b2'),
  }
}

/* Escaping for the data tables, which are built as HTML strings.

   This used to be a local wrapper that read `window.utils?.escapeHtml` and,
   when it was absent, returned the raw string. That fallback failed OPEN,
   which is the wrong direction for a guard: the values passing through here
   are page titles and decision strings, and those arrive from imported
   CSV/JSON backups and from sync responses — content this repo did not
   author. js/review/review-ops.js hit the same question and answered it correctly
   in its own file; this module could not see that, because the two were
   written in parallel.

   The wrapper is gone rather than corrected. This is a real ES module, so it
   can import the one implementation directly and there is no third copy of
   the rule to keep in step. */
const escape = escapeHtml

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

/**
 * The pages failing checks, worst first, as a plain ranked list.
 *
 * This card used to be a horizontal bar chart. On real data every bar landed
 * between 86% and 95% — one colour, eight near-identical lengths — so the
 * encoding carried no signal a reader could act on, while the axis labels
 * truncated at ~18 characters and left several bars effectively anonymous. The
 * polarity read backwards too: bars sitting at 95% under a heading about
 * needing attention.
 *
 * The ranking was always the value here, so this ships the ranking and nothing
 * else. It also replaces the card's visually hidden table rather than sitting
 * beside one — the list IS the accessible content now, and pairing it with a
 * table would just read the same numbers twice.
 * @param {object} model
 * @param {number} limit How many rows to draw.
 * @returns {string}
 */
function checksList(model, limit) {
  const visible = model.checksFailing.slice(0, limit)
  return `
    <ol class="insights-ranked">
      ${visible
        .map((item) => {
          const failing = item.total - item.passed
          return `
        <li class="insights-ranked-item">
          <span class="insights-ranked-title">${escape(item.title)}</span>
          <span class="insights-ranked-value">${escape(failing)} of ${escape(item.total)} failing</span>
        </li>
      `
        })
        .join('')}
    </ol>
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

/**
 * Build the two cards, tables included, chart boxes still empty.
 *
 * There used to be three. The "Decision mix" stacked bar was cut: the Overview
 * already prints the same five counts in the filter chips — which filter as
 * well as count — and the chart's own legend then reprinted them a third time,
 * all within about 200 vertical pixels. A stacked bar whose exact values are
 * already on screen twice is a restatement rather than an encoding, so the card
 * carried no information a reader did not have before reaching it.
 *
 * What is left is the pair that says something the table cannot: how the review
 * is moving, and which pages are failing.
 */
function buildMarkup(model) {
  const activityTable = dataTable(
    'Pages decided over time',
    ['Date', 'Decided that day', 'Running total'],
    model.activity.map((point) => [point.date, point.decided, point.total])
  )

  return `
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
      model.checksFailing.length
        ? // No chart mount and no hidden table: checksList() renders the ranking
          // as visible content, which is both the graphic and the accessible
          // artifact. card() is not reused here because it would add an empty
          // aria-hidden chart box for a card that no longer draws one.
          `
      <section class="insights-card">
        <div class="insights-card-head">
          <h4 class="insights-card-title">Checks needing attention</h4>
          <p class="insights-card-hint">${escape(
            model.checksFailing.length > CHECKS_VISIBLE
              ? `Worst ${CHECKS_VISIBLE} of ${model.checksFailing.length} pages with failing checks`
              : `${model.checksFailing.length} of ${model.checks.length} pages have failing checks`
          )}</p>
        </div>
        ${checksList(model, CHECKS_VISIBLE)}
      </section>
    `
        : emptyCard(
            'Checks needing attention',
            'Automated page checks',
            model.checks.length
              ? 'Every page is passing all of its checks.'
              : 'No check results available for these pages.'
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
 * Called by js/review/review-queue-render.js after it rebuilds the panel. Safe to
 * call on every render: it re-parents the existing charts and only redraws
 * when the underlying numbers actually changed.
 * @returns {Promise<void>} resolves once any redraw has been applied
 */
async function render() {
  const slot = document.getElementById('reviewInsights')
  if (!slot) return

  const rows = window.ReviewQueueInternal?.rows?.getQueueRows?.() || []
  const savedPages = window.reviewState?.read?.()?.pages || {}
  const model = window.ReviewInsights.data.buildInsightsModel(rows, savedPages)
  const signature = window.ReviewInsights.data.insightsSignature(model)

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

  instances = charts.draw(chartsRoot, model, readTheme())
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
