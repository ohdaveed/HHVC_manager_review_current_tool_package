/* Review insights: the ECharts layer.

   Split from js/review/review-insights.js so it can be loaded on demand. This is the
   only module that imports ECharts, which is what lets Vite emit it as its own
   chunk: the library is ~530KB raw, and pulling it into the main bundle would
   more than double the initial download for a chart most reviewers never
   scroll to. js/review/review-insights.js dynamic-imports this module the first time
   the Overview tab renders.

   Only the activity line survives here — the decision-mix and checks cards were
   cut (see js/review/review-insights.js), so ECharts is now carrying a single chart.
   That is still worth deferring rather than inlining, but it is a thin
   justification for the dependency; a hand-drawn SVG line would remove it
   outright, which is a build decision rather than a UX one and is left alone.

   Rendering is the SVG renderer, not the default canvas one. SVG costs a
   little performance that one small chart will never notice, and buys
   output that inherits the page's font rendering, stays sharp at any zoom, and
   survives DOM serialisation — the last one keeping these charts compatible
   with the capture in js/mockup/mockup-image-export.js should they ever be included
   in one.

   Takes no window globals and reads no DOM beyond the nodes it is handed, so
   it stays a pure "draw this model into these boxes" module. */

import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { SVGRenderer } from 'echarts/renderers'
import { escapeHtml } from '../core/utils.js'

// Register only what this chart uses, so the rest of ECharts is tree-shaken out
// of the chunk rather than merely deferred. BarChart went with the decision-mix
// and checks cards — see js/review/review-insights.js for why both were cut.
echarts.use([LineChart, GridComponent, TooltipComponent, SVGRenderer])

/** Shared styling, kept as its own function so a second chart can rejoin it. */
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
 * Draw every chart the model has data for into the mount points already
 * present in `root`, and return the live instances.
 *
 * The caller owns the markup (including the accessible data tables) and owns
 * disposing what comes back; this function only fills in the boxes.
 * @param {Element} root
 * @param {object} model
 * @param {object} theme
 * @returns {Array<object>} ECharts instances
 */
function draw(root, model, theme) {
  const instances = []
  const mount = (id, option) => {
    const node = root.querySelector(`[data-insights-chart="${id}"]`)
    if (!node) return
    const instance = echarts.init(node, null, { renderer: 'svg' })
    instance.setOption(option)
    instances.push(instance)
  }

  if (model.activity.length) mount('activity', activityOption(model, theme))
  return instances
}

export { draw, activityOption }
