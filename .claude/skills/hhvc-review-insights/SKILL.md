---
name: hhvc-review-insights
description: 'HHVC repo: the two Overview insight cards — why the other two were cut and should not be re-added, why the ECharts import must stay dynamic and the data tables built synchronously before it, the re-parented chart host and generation counter, and why decision fills use `--viz-decision-*` rather than the chip tokens. Load before editing js/review-insights*.js or css/review-insights.css.'
---

<!-- Extracted from CLAUDE.md/AGENTS.md on 2026-08-15. AGENTS.md remains the
     canonical copy of this content; see "Cross-tool canon" there. -->

# Overview insight cards (`js/review-insights*.js`)

Two compact cards above the review queue table — review activity over time (a
chart) and the pages whose automated checks are failing (a ranked list). They
sit on the **Overview tab rather than a workspace tab of their own** on purpose:
a tab is a scarce slot bound to a number key.

There were three, and the two that were cut are worth not re-adding:

- **Decision mix** was a stacked bar of the five decision counts. The filter
  chips directly above already print those counts _and_ filter by them, and the
  chart's own legend reprinted them a third time — all within about 200 vertical
  pixels. A chart whose exact values are already on screen twice is a
  restatement, not an encoding. The careful colour work behind it (the
  `--viz-decision-*` tokens, the separately chosen dark palette, the ΔE
  validation) was real and was spent on a card carrying no new information.
- **Checks needing attention** was a horizontal bar chart. On real data every
  bar landed between 86% and 95% — one colour, eight near-identical lengths —
  the axis labels truncated at ~18 characters, and the polarity read backwards
  (a bar at 95% under a heading about what needs attention). The ranking was
  always the value, so it ships as a ranked list naming the page and its count
  of failing rules. It needs no parallel `.hhvc-sr-only` table, because it is
  visible content rather than an aria-hidden graphic — one copy of those numbers
  serves both audiences.

That leaves **ECharts drawing exactly one line chart**. Still worth deferring
rather than inlining, but a thin justification for a ~170 KB gzip chunk — a
hand-drawn SVG line would remove the dependency outright. That is a build
decision rather than a UX one, and was deliberately left alone.

- **`js/review/review-insights-data.js`** — pure data shaping (`buildDecisionMix`,
  `buildActivitySeries`, `buildChecksSeries`, `insightsSignature`), dual
  `window`/`module.exports` like `js/review-merge.js` so
  `tests/review-insights-data.test.js` can `require` it with no browser.
  `buildDecisionMix` still runs: `insightsSignature()` uses it to gate redraws,
  since a decision change moves the activity series.
- **`js/review/review-insights.js`** — the orchestrator. Builds the card markup, the
  hidden data table and the ranked list, then draws.
- **`js/review/review-insights-charts.js`** — the only module that imports ECharts.

**ECharts is dynamically imported, and that is load-bearing, not tidiness.**
It is ~530 KB raw / ~180 KB gzip — more than the entire rest of the bundle.
The dynamic import makes Vite emit it as its own chunk, so the initial
download stays ~114 KB gzip and the library arrives only when the Overview
tab first renders. A second consequence shapes the file order: the headings
and data tables are built **synchronously, before the import is requested**,
so the numbers are in the DOM even if the chunk is slow or never loads.

Other invariants worth not rediscovering:

- **The chart host is re-parented, never rebuilt.** The Overview panel
  replaces its whole `innerHTML` on every filter, sort and search keystroke.
  `insightsSignature()` gates redraws, and a module-level generation counter
  stops a slow async draw from painting stale data over newer numbers.
- **The charts always describe the whole site, never the filtered view** —
  they read `getQueueRows()`, not the visible rows.
- **Decision fills use `--viz-decision-*`, not the `--status-*-border` chip
  tokens.** The chip borders are tuned as 1px strokes; as large fills,
  Approved and Needs review separate by ΔE 8.4 under _normal_ vision against
  a floor of 15 — and they are the two most common states, adjacent in the
  bar. Dark mode gets a separately chosen set, not a lightened copy (the
  light green lands at 2.96:1 on the dark panel). If you change these,
  re-validate rather than eyeball.
- **Colour is never the only encoding**: the decision card carries a visible
  legend with counts, every chart is `aria-hidden` beside an
  `.hhvc-sr-only` data table, and the checks chart states its own top-8 cap
  while the table carries every page.
