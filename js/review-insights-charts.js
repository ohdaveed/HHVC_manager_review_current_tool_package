/* Review insights: the ECharts layer.

   Split from js/review-insights.js so it can be loaded on demand. This is the
   only module that imports ECharts, which is what lets Vite emit it as its own
   chunk: the library is ~530KB raw, and pulling it into the main bundle would
   more than double the initial download for three charts most reviewers never
   scroll to. js/review-insights.js dynamic-imports this module the first time
   the Overview tab renders.

   Rendering is the SVG renderer, not the default canvas one. SVG costs a
   little performance that three small charts will never notice, and buys
   output that inherits the page's font rendering, stays sharp at any zoom, and
   survives DOM serialisation — the last one keeping these charts compatible
   with the capture in js/mockup-image-export.js should they ever be included
   in one.

   Takes no window globals and reads no DOM beyond the nodes it is handed, so
   it stays a pure "draw this model into these boxes" module. */

import * as echarts from 'echarts/core'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { SVGRenderer } from 'echarts/renderers'
import { escapeHtml } from './utils.js'

// Register only what these three charts use, so the rest of ECharts is
// tree-shaken out of the chunk rather than merely deferred.
echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, SVGRenderer])

/** Shared styling, so the three charts read as one family. */
function baseOption(theme) {
  return {
    animation: false,
    textStyle: { color: theme.muted, fontSize: 11 },
    tooltip: {
      trigger: 'item',
      backgroundColor: theme.surface,
      borderColor: theme.border,
      textStyle: { color: theme.text, fontSize: 12 },
    },
  }
}

/**
 * Decision mix: one horizontal bar split into the five decisions.
 *
 * A stacked bar rather than a pie. The question is "how much of the site is in
 * each state" — a part-to-whole comparison along one axis, which is the thing
 * a pie is worst at and a single stacked bar is best at, especially with five
 * categories where several are usually zero.
 * @param {object} model
 * @param {object} theme
 * @returns {object} ECharts option
 */
function decisionOption(model, theme) {
  const present = model.decisionMix.filter((item) => item.count > 0)
  return {
    ...baseOption(theme),
    grid: { top: 8, bottom: 8, left: 0, right: 0 },
    xAxis: { type: 'value', max: model.total || 1, show: false },
    yAxis: { type: 'category', data: [''], show: false },
    tooltip: {
      ...baseOption(theme).tooltip,
      // ECharts renders a formatter's return value as HTML. Everything
      // interpolated here is escaped for the same reason the queue table and
      // the hidden data tables are: a decision string is saved state, and
      // buildDecisionMix deliberately counts unrecognised values rather than
      // dropping them, so an imported backup can put arbitrary text here.
      formatter: (params) =>
        `${escapeHtml(params.seriesName)}: ${escapeHtml(params.value)} of ${escapeHtml(model.total)}`,
    },
    series: present.map((item) => ({
      name: item.decision,
      type: 'bar',
      stack: 'mix',
      barWidth: 28,
      data: [item.count],
      itemStyle: {
        color: theme.decision[item.decision] || theme.muted,
        // A 2px gap in the surface colour between touching segments. Abutting
        // fills are judged against each other rather than against the surface,
        // and adjacent chart colours are nowhere near 3:1 apart; the separator
        // means each segment contrasts against it instead of its neighbour.
        borderColor: theme.surface,
        borderWidth: 2,
      },
    })),
  }
}

/**
 * Review activity: cumulative pages decided, by day.
 *
 * Cumulative rather than per-day counts. Per-day bars across a 19-page review
 * are mostly zeroes with one or two spikes, which says nothing; the running
 * total shows whether the review is converging, and how fast.
 * @param {object} model
 * @param {object} theme
 * @returns {object} ECharts option
 */
function activityOption(model, theme) {
  return {
    ...baseOption(theme),
    grid: { top: 12, bottom: 24, left: 32, right: 12 },
    // A TIME axis, not a category one. The model deliberately records only the
    // days something was decided, so on a category axis July 1 and July 30 sit
    // one tick apart exactly like two consecutive days — which erases a
    // month-long stall and makes a slow review look identical to a fast one.
    // Since the whole point of this card is the pace of review, the gaps have
    // to be to scale.
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: theme.border } },
      axisTick: { show: false },
      axisLabel: { formatter: '{MM}-{dd}', hideOverlap: true },
    },
    yAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: theme.border } } },
    tooltip: {
      ...baseOption(theme).tooltip,
      trigger: 'axis',
      formatter: (params) => {
        const point = model.activity[params[0]?.dataIndex] || {}
        return `${escapeHtml(point.date)}<br>${escapeHtml(point.total)} decided (+${escapeHtml(point.decided)})`
      },
    },
    series: [
      {
        type: 'line',
        data: model.activity.map((point) => [point.date, point.total]),
        smooth: false,
        symbolSize: 6,
        lineStyle: { color: theme.line, width: 2 },
        itemStyle: { color: theme.line },
        areaStyle: { color: theme.line, opacity: 0.12 },
      },
    ],
  }
}

/**
 * Checks pass rate, worst pages first.
 *
 * Draws only the lowest `limit` pages. Nineteen horizontal bars would make the
 * card taller than the table it sits above, and the bottom of that list — the
 * pages already passing everything — is exactly the part a manager does not
 * need to look at. The card heading states the cap and the hidden data table
 * carries every page, so nothing is silently dropped.
 * @param {object} model
 * @param {object} theme
 * @param {number} limit
 * @returns {object} ECharts option
 */
function checksOption(model, theme, limit) {
  // checksFailing, not checks: this card is titled "Checks needing attention",
  // and slicing the full list pads it out to `limit` with pages sitting at
  // 100%. On a site where everything passes that produced eight green bars
  // under a heading about problems.
  const visible = model.checksFailing.slice(0, limit).reverse()
  return {
    ...baseOption(theme),
    grid: { top: 4, bottom: 8, left: 4, right: 36, containLabel: true },
    // The value axis carries no labels: every bar is already labelled with its
    // own percentage on the right, so a second scale along the bottom is
    // duplicate ink that also crowds into an unreadable "0%20%40%" run at this
    // card width.
    xAxis: { type: 'value', max: 100, axisLabel: { show: false }, splitLine: { show: false } },
    yAxis: {
      type: 'category',
      data: visible.map((item) => item.title),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        // interval: 0 forces every category label to draw. ECharts thins them
        // out by default when they would collide, which on a chart whose whole
        // point is naming the pages needing attention leaves some bars
        // anonymous.
        interval: 0,
        width: 110,
        overflow: 'truncate',
      },
    },
    tooltip: {
      ...baseOption(theme).tooltip,
      // item.title is NOT trusted input. js/ux-improvements-state-sync.js
      // assigns a restored edited_title straight onto the in-memory page
      // object, so a JSON backup or a sync response can put markup here — and
      // this formatter's return value is inserted as HTML. Escaped, like every
      // other path in this repo that reaches innerHTML.
      formatter: (params) => {
        const item = visible[params.dataIndex] || {}
        return `${escapeHtml(item.title)}<br>${escapeHtml(item.passed)} of ${escapeHtml(item.total)} checks passing`
      },
    },
    series: [
      {
        type: 'bar',
        data: visible.map((item) => ({
          value: item.pct,
          // Colour by outcome, not by rank: anything short of every check
          // passing is the same call to action.
          itemStyle: { color: item.pct === 100 ? theme.bar : theme.barWarn },
        })),
        barMaxWidth: 14,
        label: {
          show: true,
          position: 'right',
          formatter: '{c}%',
          color: theme.muted,
          fontSize: 10,
        },
      },
    ],
  }
}

/**
 * Draw every chart the model has data for into the mount points already
 * present in `root`, and return the live instances.
 *
 * The caller owns the markup (including the accessible data tables) and owns
 * disposing what comes back; this function only fills in the boxes.
 * @param {Element} root
 * @param {object} model
 * @param {object} theme
 * @param {number} checksLimit
 * @returns {Array<object>} ECharts instances
 */
function draw(root, model, theme, checksLimit) {
  const instances = []
  const mount = (id, option) => {
    const node = root.querySelector(`[data-insights-chart="${id}"]`)
    if (!node) return
    const instance = echarts.init(node, null, { renderer: 'svg' })
    instance.setOption(option)
    instances.push(instance)
  }

  mount('decision', decisionOption(model, theme))
  if (model.activity.length) mount('activity', activityOption(model, theme))
  if (model.checks.length) mount('checks', checksOption(model, theme, checksLimit))
  return instances
}

export { draw, decisionOption, activityOption, checksOption }
