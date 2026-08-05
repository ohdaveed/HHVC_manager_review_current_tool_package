# AGENTS.md

**Canonical, tool-agnostic guide for any AI assistant working in this repo** —
Cursor, Copilot, Codex, Windsurf, Aider, ChatGPT, Claude, and human contributors.
It is the single source of truth for how this project is built and how the author
likes work done. `CLAUDE.md` (Claude Code) and `.github/copilot-instructions.md`
(Copilot) mirror the same facts and defer here for anything they don't cover; if
they ever disagree with this file, this file wins. Keep it accurate — a stale
instruction file is worse than none, because it teaches the wrong thing
confidently.

## What this is

A static, no-framework mockup tool for **manager review** of a redesigned HHVC
(Healthy Housing and Vector Control) section of SF.gov. It is **bundled by Vite**
from a single ES-module entry point (`js/main.js`), and `server.ts` serves the
build output plus the optional sync API. **Bun** powers the CLI scripts
(validate/export/build) and the test runner. There is still **no UI framework** —
rendering is data-driven string templates, not components. Reviewer state lives in the browser's `localStorage` by
default, and the tool works fully offline with **no backend/database/external
service required.** `server.ts` also hosts an **optional** Bun + SQLite
review-state sync backend (see [Review-state sync backend](#review-state-sync-backend-optional))
that reviewers can opt into per-browser to sync decisions across
machines/reviewers — it's off unless deployed and configured, and every other
part of the tool works identically whether or not it's ever used.

A separate **Vite** sub-app lives at `forms/mosquito-workshop-request/` (a real
build step, built independently — see [Build outputs](#build-outputs)).

If `bun` is not found, it installs to `~/.bun/bin`; run
`export PATH="$HOME/.bun/bin:$PATH"`. Run `bun install` before the first `dev` —
`js/main.js` imports `@sfgov/design-system` CSS and the third-party libraries for
Vite to bundle.

## Commands

```bash
bun install                 # install deps (required before first `dev`)
bun run dev                  # Vite dev server (HMR) at http://127.0.0.1:8080
bun run dev:api              # optional sync backend (server.ts) on :8081; dev proxies /api
bun run start                # production-like: build:netlify then serve dist/ + the API
bun run serve                # serve an already-built dist/ without rebuilding
bun run validate             # Zod-validate pages/*.js + js/page-data.js (schema + invariants)
bun run test                  # Bun test runner over the 22 unit-test files in tests/
bun run test:e2e              # Playwright end-to-end tests (starts static server on :8080)
bun run export                # regenerate data/page_inventory.{json,csv} + local tracking sheet
bun run sync-tracking         # regenerate the local mockup tracking CSVs
bun run push-tracking         # push page review status to the Google Sheets tracker
bun run build                 # validate -> export -> workshop form -> build:app -> publish form -> singlefile
bun run build:app             # vite build -> dist/ (what server.ts and Netlify serve)
bun run build:singlefile      # vite build --mode singlefile -> dist-singlefile/index.html
bun run build:workshop-form   # bun install + vite build inside forms/mosquito-workshop-request
bun run build:netlify         # validate -> build:app -> copy-workshop-form.js (assembles dist/)
bun run format                # prettier --write on everything
bun run format:check          # prettier --check — THIS IS THE LINT STEP (no ESLint/tsc)
```

`HOST=0.0.0.0 bun run dev` / `PORT=3000 bun run dev` override the dev server bind.
`start-dev.sh` kills any stale listener on the port before starting.

**There IS a real test suite** (a common stale claim in older docs is that there
isn't). `bun run test` runs twenty-two Bun unit-test files under `tests/` —
`utils`, `data-validation`, `page-render`, `csv`, `review-state-schema`,
`reading-level`, `plain-language`, `page-import-checks`, `mockup-image-export`,
`review-insights-data`, `review-insights-charts`, `review-insights-render`,
`review-ops-data`,
`decision-vocabulary` (pins the two module-boundary restatements of the
decision list against the canonical table in `js/utils.js`), `doc-counts`
(reads the counts back out of these docs and compares them to the filesystem),
`review-merge`,
`review-api-server` (which spawns `server.ts` as a subprocess
against a temp SQLite DB), `review-state-sync`, `ai-assist-schema`,
`ai-assist-env`, `ai-assist-providers` (the provider registry and usage
normalization, varying the provider keys directly — which the server tests
cannot, since a spawn only ever sees the environment it was given), and
`ai-assist-server` (which spawns `server.ts` against stub Anthropic and Gemini
endpoints, so both AI paths are covered without a key or a paid call). **The list in
`package.json`'s `test` script is explicit, not a glob** — a new
`tests/*.test.js` that is not added there simply never runs, and reports
nothing
— plus `bun run test:e2e`
(Playwright, in `tests/e2e/`:
fourteen spec files — thirteen UI-driven ones covering navigation, editor
panel, review workflow, review queue, review-queue undo, stored review data,
import/export, keyboard shortcuts, workspace panels, accessibility, AI
assist, mockup PNG export, and the Overview insight cards, plus the original
`review-import-export` API-level
round-trip — sharing plain helper functions in
`tests/e2e/helpers.js`, no fixture framework). `gotoFresh()` waits on
`window.reviewKeyboardShortcuts.ready`, not just the sticky bar, so a test
cannot press a global shortcut before the `keydown` listener exists. In a sandbox with a
pre-installed Chromium, point Playwright at it instead of downloading:
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium bun run test:e2e`.
`bun run validate` is a **complementary, not redundant** check: it loads every
`pages/*.js` plus `js/page-data.js` into a Node VM and Zod-validates
fields/shapes, plus a few business invariants (below). It always validates the
full page set — you can't validate a single page file in isolation. **Run `bun
run validate` and `bun run test` after editing anything under `pages/` or
`js/page-data.js`.**

### CI

`.github/workflows/ci.yml` runs on pushes to `main` and every pull request, in
two deliberately separate jobs so a formatting or schema failure reports in
seconds without waiting on a Chromium download, and a flaky browser run never
masks a unit failure:

- **checks** — `bun install --frozen-lockfile` → `format:check` → `validate` →
  `build:netlify` → `test`. `build:netlify` doubles as a deploy-integrity check:
  it fails if the committed workshop-form `dist` references assets that were
  never committed (the "form shell that never hydrates" regression). **It runs
  before `test` on purpose**, even though that delays a unit failure by a
  build: one test in `tests/review-api-server.test.js` asserts that a
  set-but-empty `STATIC_ROOT` still serves the real built app, and it can only
  tell a correct fallback from a broken one if `dist/` exists. It skips itself
  when there is no build — so with the fast order it passed by skipping and
  covered nothing.
- **e2e** — installs Playwright Chromium and runs `test:e2e`, uploading
  `playwright-report/` as an artifact on failure.

## Architecture

### Data-driven rendering, no framework

Each file in `pages/*.js` assigns a page object onto the global
`window.HHVC_PAGES['<pageKey>']`. `js/page-data.js` then builds
`window.HHVC_DATA = { pages, order }`, where `order` is the array of
`[pageKey, menuLabel]` pairs driving navigation/menu order.

**Load order lives in `js/main.js`, not `index.html`.** `index.html` has exactly
one script tag — `<script type="module" src="/js/main.js">` — and `js/main.js` is
the root of the module graph: CSS, then the three third-party libraries, then the
core modules, then the review/UX layers. The old model (~47 classic `<script>`
tags sharing one global lexical scope) and the committed `js/vendor/` IIFE
bundles are both gone; Fuse.js, defu and papaparse are npm imports now.

Order is enforced two ways. **Core modules enforce it themselves** — a module
that needs `escapeHtml` imports it, and `js/state.js` imports `js/page-data.js`,
which imports all 19 `pages/*.js`, so `window.HHVC_DATA` is always populated
before anything reads it. **The self-mounting IIFE subsystems still depend on
listed order** — `js/ux-improvements*.js`, `js/review-queue*.js`,
`js/dashboard-guidance.js` and
`js/keyboard-shortcuts.js` take no imports and communicate through
`window.<Namespace>` objects, so their sequence in `js/main.js` is load-bearing
and hand-reviewed.

A few functions are deliberately republished onto `window`, because callers
depend on the implicit globals the old shared scope provided: `window.renderPage`
(three modules wrap it to refresh after navigation — the decorator chain only
forms if the original is on `window`), `window.toggleSidebar` (an inline
`onclick` in `index.html`), `window.showToast` and `window.updateSearchPreview`
(called optionally by the IIFE layers, which degrade to silence rather than
throw), and `window.ORIGINAL_DATA` (read by `js/review-state-sync.js`).

When adding a new page file: add `import '../pages/<file>.js'` to
`js/page-data.js` and a `[pageKey, menuLabel]` entry to its `order` array. A new
`js/*.js` module just needs an importer; if it is a self-mounting IIFE with no
importer, add it to `js/main.js` in the right position. Node-side scripts
(`build_scripts/`, `tests/`) hardcode no file lists — they discover `pages/*.js`
dynamically via `build_scripts/load-pages.js`. If you forget the page import,
`bun run validate` catches it: `build_scripts/page-import-checks.js` diffs
`pages/*.js` on disk against `js/page-data.js`'s imports. Vite already turns the
reverse case (an import naming a missing file) into a build error, but a page
nobody imports fails silently — it never registers onto `window.HHVC_PAGES`, so
the page just disappears. Import _order_ isn't checked; it's irrelevant, since
each page module only writes into `window.HHVC_PAGES` and navigation order comes
from the `order` array.

### Core module split (formerly one `app.js`)

The old monolithic `app.js` was split into focused modules — **do not re-monolith
them.**

- **`js/utils.js`** — shared helpers (`escapeHtml`, `getPrimaryCta`,
  `setPrimaryCta`, `today`, `csvEscape`, `toCsv`, `downloadFile`, `debounce`,
  `throttle`), exposed as `window.utils` and as bare top-level functions. Loads
  first. **Add new cross-cutting helpers here rather than duplicating logic.**
- **`js/state.js`** — core state: `DATA`/`ORIGINAL_DATA` (a deep clone for
  field-reset), `pageData`, `pageOrder`, `currentPageKey`.
- **`js/ui-controls.js`** — toasts, sidebar collapse/scroll persistence, the
  page-picker `<select>`, review checklist.
- **`js/editor-panel.js`** — SEO/editor panel: input↔page sync, dirty-state
  indicators, search-result preview, per-field reset.
- **`js/page-render.js`** — turns `pages/*.js` objects into `#mockPage` HTML,
  including `karlTag()` for Karl CMS placement annotations.
- **`js/app.js`** — bootstraps DOM event listeners (`init()`) and renders the
  first page (`pestsTopic`).
- **`js/manager-review-export.js`** — manager review CSV/JSON snapshot,
  published on `window.ReviewExport` for the consolidated export control. It no
  longer wraps `renderPage`: that decorator existed only to refresh a sidebar
  label that has been cut.

### Review/UX layers are additive, on top of the core

`js/ux-improvements.js`, `js/review-queue.js`, `js/dashboard-guidance.js`,
and `js/keyboard-shortcuts.js` are self-contained
IIFEs that read `window.HHVC_DATA` and `localStorage`. Some write edited
title/summary/CTA/SEO fields back onto the **in-memory** `pageData` objects when
restoring saved edits — but **must never write back to the `pages/*.js` source
files or publish content.** They are review aids only, not publishing tools.

`js/ux-improvements.js` and `js/review-queue.js` are
thin orchestrators (event wiring + `init()` + public API) over sibling files that
do the work, each attaching functions to an internal `window.<Namespace>` object
(implementation detail — never referenced from `pages/*.js`):

- **`window.ReviewUx`** ← `js/review-state-store.js` (shared `window.reviewState`
  read/write/update), `js/ux-improvements-state-sync.js`,
  `js/ux-improvements-workspace.js`, `js/ux-improvements-export.js`.
  `js/review-merge.js` (`window.reviewMerge`) and `js/review-state-sync.js`
  (`window.reviewStateSync`) sit alongside these as their own small globals —
  not under `window.ReviewUx` — since `js/review-merge.js` is also imported
  directly by `server.ts` (no DOM dependency) and needs no browser-only
  namespace.
- **`window.ReviewQueueInternal`** ← `js/review-queue-state.js`,
  `js/review-queue-rows.js`, `js/review-queue-render.js`, and
  `js/review-queue-import.js` (CSV import — kept isolated as the
  highest-regression-risk area; see [Local persistence](#local-persistence)).
- **`window.ReviewInsights`** (`js/review-insights.js`) ←
  `js/review-insights-data.js`, which attaches `.data`. The Overview cards;
  `js/review-queue-render.js` calls `window.ReviewInsights.render()` at the end
  of its own render, optional-chained.
- **`window.ReviewOps`** (`js/review-ops.js`) ← `js/review-ops-data.js`, which
  attaches `.data`. The stored-review-data panel, a collapsed section in Help.
- **`window.MockupImageExport`** (`js/mockup-image-export.js`) — PNG export of
  the mockups, standing on its own.

- **Two lazily-mounted panels publish a mount hook rather than rendering at
  init:** `window.__mountAiAssistOnTabOpen` and `window.__mountReviewOpsOnTabOpen`.
  Both are collapsed `<details>` at the end of the Help panel now rather than
  tabs of their own, so `setWorkspaceTab` calls **both** when Help opens — a
  reviewer expanding one must never find an empty box. Each panel ALSO catches
  an already-open tab at its own `init()` via `mountWorkspacePanelIfOpen('help')`
  in `js/utils.js` — `js/ux-improvements.js` initializes earlier and restores a
  persisted `workspace_tab` before these hooks exist, so without the catch-up a
  reviewer who left Help open came back to an empty panel.

- **AI assist breaks that naming pattern — mind the case.** `window.AiAssist` is
  the **internal** namespace (`js/ai-assist-client.js` attaches `.client`, the
  browser half of the optional `/api/ai/*` routes and a no-op unless configured;
  `js/ai-assist-render.js` attaches `.render`). `js/ai-assist.js` consumes both,
  owns the request lifecycle and cancel, and publishes its public API on the
  separate lowercase **`window.aiAssist`** (`ensureRendered`,
  `refreshCapabilities`, `getCurrentPage`, `captureForm`). `window.AiAssist.ensureRendered`
  does not exist.

The workspace tab strip is `['overview', 'checks', 'help']`, numbered left to
right by the `1`–`3` shortcuts. It carried six until a UX review cut three:
**Sitemap** was removed outright (a fourth way to navigate 19 pages, drawing a
hierarchy one level deep), and **AI assist** and **Tool status** became
collapsed `<details>` at the end of Help — both depend on `server.ts`, which the
Netlify deploy has no runtime for, so on the build managers actually open they
were two permanently-empty panels holding two of six slots. Help stays last, so
it is the digit that moves whenever the strip changes; `WORKSPACE_TABS`
(`js/ux-improvements-workspace.js`), the tab markup in `index.html` and the
`1`–`3` cases in `js/keyboard-shortcuts.js` must change together. The two
surviving lazy panels **also catch an already-open Help tab at their own
`init()`** — `js/ux-improvements.js` initializes earlier and restores a
persisted `workspace_tab` before those hooks exist, so without the catch-up a
restored tab painted empty until the reviewer switched away and back.
Relatedly, `hhvc:shortcuts-ready` and
`window.reviewKeyboardShortcuts.ready` are set **from `init()`, after** the
`keydown` listener is attached; firing at module scope announced a capability
that did not exist yet.

### The workspace is docked, not stacked

`#reviewWorkspace` is a **third grid column in `.app`**, sticky to the viewport,
not the last child of `.canvas`. It used to be the latter, and the numbers are
the argument: the mockup runs about 8,766px, so the panel began around y=9,413
in a 10,348px document — more than nine screenfuls down. A reviewer could never
see the page and the instruments judging it at once, which was sharpest on
**Page checks**, a panel that scores _the page currently in the mockup_ and
rendered that score nine screens away from it.

Most of the redundancy this layout accumulated followed from that: the same fact
had to be repeated wherever the reviewer might be looking. Co-visibility is what
makes one copy enough, so resist re-adding a second printing of anything.

- **`.app.workspace-docked` is what grows the third column**, toggled alongside
  the panel's `hidden` attribute. `applyWorkspaceVisibility()` in
  `js/ux-improvements-workspace.js` is the single place that does both, plus the
  toggle button's label — the first-run onboarding path used to set `hidden`
  inline and missed the class, so a first-run reviewer got an open panel the
  grid had made no room for.
- **`.review-workspace[hidden] { display: none }` is load-bearing.** The rule
  above it sets `display: flex`, and a class selector outranks the UA
  stylesheet's `[hidden]` rule — without the pairing, "Hide workspace" and the
  `w` shortcut both appeared to do nothing.
- **Below 1400px the panel returns under the canvas, in `grid-column: 2`** —
  not `1 / -1`. Spanning both columns puts it beneath the sticky, full-height
  sidebar, which then slides over the queue's left edge as you scroll. Axe
  caught that before a human did (57 queue cells reported as "partially obscured
  by another element"); it is not visible in a screenshot taken at scroll 0.

### What the UX review removed, and why not to re-add it

- **The Karl-tag legend above the mockup.** A toggle, a four-row colour key, an
  explanatory sentence and a "What are Karl tags?" disclosure occupied ~495px —
  half a screen — between the toolbar and the SF.gov header, on every page and
  every load. The key decoded something that was never encoded in colour alone:
  each tag already reads `METADATA`, `BODY`, `PLACEMENT` or `EDITOR ONLY` in
  words. The switch moved to `.canvas-toolbar`; the legend renders once, in Help.
- **Three of four Overview KPI tiles.** "Visible" restated the "N of 19" printed
  directly above it. "Blocked" showed `stats.blocked`, which counts Blocked
  **plus** Revise and resubmit — so it read 5 while the Blocked filter chip forty
  pixels away read 2. Both numbers were right and the label was not, and a panel
  that visibly disagrees with itself in its first two rows spends the
  credibility the rest of it needs. The decision tally belongs to the chips,
  which count and filter with one control.
- **The page's name, printed four times.** The sidebar picker, a "Current page:"
  label under it, a "Viewing: …" badge in the toolbar, and the sticky bar. The
  middle two are gone — and with the label went the only reason
  `js/manager-review-export.js` wrapped `renderPage` at all, so that decorator
  went too.
- **The decision `<select>`.** It sat directly above five chips writing the same
  field. `#reviewDecision` survives as an `<input type="hidden">` because it is
  the field every persistence path reads through `getValue`/`setValue` and whose
  `change` event autosave, the history-round detection and the sticky bar all
  listen for; the chips carry the visible and accessible semantics.
- **Six of nine export/import controls.** Five ways to get review data out, in
  two formats, split across the sidebar and the Overview panel, with nothing on
  screen distinguishing "Export current review JSON" from "Download backup
  (JSON)" from "Export saved local reviews CSV". There is now one **Export
  reviews** button with a scope `<select>` (`runExport()` dispatches) and one
  **Import reviews** button whose file input takes either format
  (`importReviewFile()` routes by extension). Fewer doors into the merge path is
  a safety property here, not only tidiness — see [Local persistence](#local-persistence).

### Checks that cannot fail are not scored

`getRuleResultsFor()` marks **Page type**, **Audience** and **Reading target**
`scored: false`. All three are required by `build_scripts/schema.js` and
enforced by `bun run validate` in CI, so no page that can ship will ever fail
them: scoring them handed every page three free passes, lifting every ratio by a
constant and burying the rules that do fail under a wall of permanent green.
`window.reviewChecks.scoredRules()` is the filter, and both the Checks panel and
the queue's `checksPassed`/`checksTotal` go through it. They still render, under
a "Page facts" subheading, and the scored list orders **failures first**.

### Content-standards scoring

`js/plain-language.js` encodes written standards, not preferences. Each check
carries `severity` plus a `source`/`section` pair and a ready-to-render
`citation`. `severity: 'error'` mandates join the scored rule list behind the
"checks passed" ratio and render their citation on the Checks tab;
`severity: 'warning'` findings are advisory, run to ~115 across the 19 pages,
and render separately so they cannot swamp the ratio. A scored rule must always
be pushed, pass or fail — dropping one shrinks the denominator and flatters the
thinnest pages. `source` exists because not every rule comes from the manual:
`house-style` and `list-length` cite the vendored `docs/source/sfgov-style/`
snapshot, and `button-length` cites manual §6.3 (Karl Button component), not
§7.8. Requiring a bare §7.x number is what previously forced all three into
miscitations. Like `js/review-merge.js` the module is dual-export
(`window.plainLanguage` + `module.exports`, no DOM dependency).

### URL schemes are validated, not just escaped

`escapeHtml` does not neutralize a scheme, so every structured `href` in
`js/page-render.js` runs through `safeUrl()` from `js/utils.js`. It is a
**scheme** guard, not a URL allowlist: `http`, `https`, `mailto`, `tel` and
**anything with no scheme at all** pass unchanged — root-relative
(`/forms/…`), document-relative (`help/foo`, `../help`), and bare fragment or
query targets (`#top`, `?q=1`). What it rewrites to the inert `#` is a
recognized-but-unsafe scheme (`javascript:`, `data:`, `vbscript:`) or
protocol-relative `//host`, which reads as relative but leaves the origin. It
strips control characters from the string it _tests_ (browsers resolve
`java\tscript:` as `javascript:`) but **trims whitespace from the value it
returns**. Since `findUnsafeUrls()` decides by comparing `safeUrl(value)`
against the original, a whitespace-padded but otherwise safe URL is reported as
an unsafe scheme — a false positive, not intended behaviour. No page carries
one today.
`findUnsafeUrls()` in `build_scripts/data-checks.js` enforces the same rule in
`bun run validate` and in the AI output validator, importing `safeUrl` rather
than restating it so renderer and validator cannot drift. That import crosses
the CJS/ESM boundary; **Bun is the only runtime CI exercises** (both
`bun run validate` and `build:netlify` invoke `bun build_scripts/validate.js`),
so the Node `require(esm)` path works but is not covered by CI. That path needs
`require(esm)` enabled — check `process.features.require_module` rather than a
version number; it is opt-out by default on current Node 22 but was flag-gated
in early 22.x.

### Overview insight cards (`js/review-insights*.js`)

Two compact cards above the review queue table — review activity over time (a
chart) and the pages whose automated checks are failing (a ranked list). They
live on the **Overview tab rather than a workspace tab of their own**: a tab is
a scarce slot bound to a number key.

There were three, and the two that were cut are worth not re-adding:

- **Decision mix** was a stacked bar of the five decision counts. The filter
  chips directly above it already print those counts _and_ filter by them, and
  the chart's own legend reprinted them a third time, all within about 200
  vertical pixels. A chart whose exact values are already on screen twice is a
  restatement rather than an encoding.
- **Checks needing attention** was a horizontal bar chart. On real data every
  bar landed between 86% and 95% — one colour, eight near-identical lengths —
  while the axis labels truncated at ~18 characters, and the polarity read
  backwards (a bar at 95% under a heading about what needs attention). The
  ranking was always the value, so it ships as a ranked list naming the page and
  the count of failing rules, and needs no parallel screen-reader table because
  it is visible content rather than an aria-hidden graphic.

That leaves **ECharts drawing exactly one line chart**. Still worth deferring
rather than inlining, but a thin justification for a ~170 KB gzip chunk — a
hand-drawn SVG line would remove the dependency outright. That is a build call,
not a UX one, and was left alone.

- **`js/review-insights-data.js`** — pure data shaping, dual
  `window`/`module.exports` like `js/review-merge.js`, so
  `tests/review-insights-data.test.js` can `require` it with no browser.
- **`js/review-insights.js`** — orchestrator: card markup, the hidden data
  table, the ranked list, redraw gating.
- **`js/review-insights-charts.js`** — the only module importing ECharts.

**ECharts is dynamically imported, and that is load-bearing.** It is ~530 KB
raw / ~180 KB gzip, more than the whole rest of the bundle. The dynamic import
makes Vite emit it as its own chunk, keeping the initial download at ~114 KB
gzip. The headings and data tables are built **synchronously, before the import
is requested**, so the numbers are present even if the chunk never loads.

- **The chart host is re-parented, never rebuilt** — the Overview panel replaces
  its whole `innerHTML` per keystroke. `insightsSignature()` gates redraws and a
  generation counter stops a slow async draw overwriting newer numbers.
- **Charts describe the whole site, never the filtered view.**
- **Decision fills use `--viz-decision-*`, not the `--status-*-border` chip
  tokens** — as large fills the chip borders put Approved and Needs review at
  ΔE 8.4 under normal vision against a floor of 15. Dark mode is a separately
  chosen set, not a lightened copy. Re-validate rather than eyeball.
- **Colour is never the only encoding**: visible legend with counts, every chart
  `aria-hidden` beside an `.hhvc-sr-only` table, and the checks chart states its
  own top-8 cap while the table carries every page.

### Queue undo (`js/review-queue-undo.js`)

One step of undo for row and bulk decision actions. `applyQueueAction` in
`js/review-queue-rows.js` is the single funnel every such action goes through,
so it is the only place a snapshot is recorded.

- **The undo is a new round, not a deletion.** `history[]` is append-only —
  `mergeReviewRecord` is the only thing that ever constructs an entry, and it
  only ever appends — so undoing writes the previous content back as another
  recorded round. The trail reads "set to Approved, then reverted", which is
  what happened. Removing the entry would let a reviewer quietly erase a
  decision from the record.
- **A page edited since the action is skipped, not rolled back.** Each snapshot
  entry stores the `updated_at` its own write produced; if the stored record no
  longer matches, something else has touched the page (sidebar, import, sync
  pull) and restoring the pre-action content would discard newer work. The
  toast reports the skipped count rather than claiming a clean undo.
- **One level deep, and consumed on use.** A stack would imply an undo history
  the review state cannot reconstruct, since every undo is itself a
  forward-only write. The button also leaves the bulk bar once pressed, so a
  second press cannot reverse a different set of pages than its label named.
- It lives in the bulk bar rather than in the action toast, because toasts
  self-dismiss after 4s — far too short to notice a wrong bulk action and
  reverse it. Keyboard shortcut `z`.

### Stored review data (`js/review-ops*.js`)

A collapsed section at the end of the **Help** tab reporting what this browser
is actually holding and how it is connected — previously only visible in
devtools. There are no roles in this tool: the reviewer and the operator are the
same person, deliberately.

- **`js/review-ops-data.js`** — pure diagnostics (`findOrphanedRecords`,
  `groupBySyncState`, `findRecordsWithoutHistory`, `measureStorage`), dual
  `window`/`module.exports` so the tests need no browser.
- **`js/review-ops.js`** — the panel, lazily mounted when Help opens with the
  same `mountIfTabAlreadyOpen()` catch-up the AI assist panel uses.

**It had a tab of its own — the `5` key — and lost it.** On a default or Netlify
deploy every value it reported was "not configured" or "none", because both
optional backends need `server.ts`. That is not worth one of the strip's slots.
The one line a reviewer genuinely needs from it — _reviews are saved in this
browser only_ — was promoted into the sidebar beside the export controls, where
the risk it describes actually lives. What stays here is the diagnostics and the
orphan pruning, which a reviewer opens deliberately.

- **Orphaned records are a real class, not a hypothetical.** Review state is
  keyed by page key and nothing prunes it when a page is retired, so a browser
  that reviewed an earlier IA still carries rows for keys that no longer
  exist. They are invisible in the queue, inflate any total taken from saved
  state, and ride along in every backup.
- **An empty page-key set reports NO orphans, not all of them.** An empty set
  means page data has not loaded; the other reading would put a "remove these"
  button in front of the reviewer's entire review history.
- **`local_dirty`'s three states are reported separately.** `true`,
  an explicit `false`, and ABSENT are different things — the whole reason the
  field is tri-state is that missing must not be read as clean.
- **Pruning is the only path in the tool that deletes review data outright**
  (everything else merges). It confirms with the count and the keys first, and
  **re-derives the list at click time** rather than trusting what was
  rendered — the panel can sit open while a sync pull or import changes state
  underneath it.

### Page object shape and validation rules

The enforced Zod schema lives in `build_scripts/schema.js` (shared by
`build_scripts/validate.js` and `tests/data-validation.test.js`, so the schema
has coverage independent of current page content). A page has `slug`,
`type` (a free-form string, only `min(1)` checked — values in use are `Agency`,
`Transaction`, `Information`, `Resource Collection`, `Campaign`, and `Report`,
matching Karl content-type names; see `docs/wagtail-content-mapping.md`), `title`,
`summary`, `audience[]`,
`reading` (grade-level string), and `sections[]`. For Karl editor field mapping by
content type, see `docs/source/hhvc-policy/karl-content-type-field-reference.md`.
Sections carry a required `heading` and `karl`, plus optional `kind`, `component`
(enum: `body`, `services`, `resources`, `related`, `contact`, `spotlight`,
`what-to-do`, `supporting`, `intro`), `open` (renders a Transaction supporting
accordion expanded), `cards[]`, `bullets[]`, `paragraphs[]`, `table[][]`,
`image`, a `callout` (`text` + optional `title`/`variant` of
`info`/`warning`/`note`), a `button`/`buttonUrl`/`buttonTarget`/`buttonStyle`,
and/or `steps[]`; steps carry `title`, `text[]`, `bullets[]`, `callout`, `karl`,
and `button`/`buttonTarget`/`buttonUrl`. Optional page-level fields: `seoTitle`,
`metaDescription`, `primaryCta`, `editorNote`, `topicTag`, `whatToKnow`,
`contact`, `spotlight`, `reportDate`, `printVersionUrl`, and `editorStatus`
(`needs-review` | `blocked` | `placeholder`). Text-bearing arrays
(`paragraphs`, `bullets`, step `text`/`bullets`) accept either a plain string or
`{ text, unverified?, unverifiedReason? }` — `unverified: true` flags a claim
needing SME confirmation, rendered as an "Unverified" pill and counted in
`validate.js`'s summary line. Cards support the same two fields.

Beyond schema shape, `validate.js` enforces business invariants:

- The `pestsTopic` key must exist and be **first** in `order`. This is now the
  HHVC **Agency page** ("Healthy Housing and Vector Control") — the key name is
  retained from the Topic-page era for invariant/test/review-state stability.
- The bare `agency` key must **not** be present (nobody should "fix" the key name
  and break that stability).
- Every page key must appear in `order` (`findMissingOrderKeys`).
- Every `card.target` **and** every section/step `buttonTarget` must resolve to a
  real page key, and every inline markdown link `[label](pageKey)` in
  paragraphs/bullets/table cells/callouts/step text must resolve to a real page
  key, an `http(s)` URL, or the inert `#` sentinel.
- The Agency page's content must not contain banned out-of-scope terms
  (`plumbing`, `dbi`, `roof leak`, `sewer`, `permit issue`, `construction
defect`) — HHVC scope is Article 11 only.
- **Lists of three or more items must use `bullets[]`**, not `paragraphs[]` or
  step `text[]` (`findListFormatViolations`) — a hard validation failure.
- **No image may be loaded from another host** (`findExternalAssetUrls`) —
  absolute `http(s)` or protocol-relative `image.src`, on a section or on the
  spotlight, fails validation. The tool claims to work fully offline, and that
  was false for a long time because of one hotlinked `images.unsplash.com` URL
  on the Agency page; it hid well because on a connected machine it simply
  worked, and only an air-gapped review or that page's PNG export showed the
  problem. **`data:` is allowed here, deliberately the opposite of
  `findUnsafeUrls`'s rule** — there the value is navigated to, where a data URL
  is a phishing vector; here it is an `<img src>` that renders bytes, and being
  self-contained is the point. The Agency spotlight photo is an inline
  WebP data URI, and has to be one rather than a file under `public/` so it
  survives `vite build --mode singlefile`, where a relative path would 404.
  `findBannedTerms` skips `src` for a related reason: it substring-matches the
  serialized page, and the base64 photo contains the sequence `dbi`, which
  failed validation on a page whose copy never mentions DBI.
  It tests the browser-normalized string via the `urlProbe()` helper it shares
  with `safeUrl`: matching the raw value on `/^(https?:)?\/\//` misses
  `\\cdn.example.com/a.jpg`, `\/cdn…`, `/\cdn…` and `https:<TAB>//cdn…`, all of
  which still fetch off-origin (confirmed in Chromium, not inferred).

All of these live in `build_scripts/data-checks.js` as pure functions, testable
without the real page data.

**`karl` fields are first-class content, not comments.** Every card, step,
section, and callout can carry a `karl` string — a precise, CMS-technical
placement/rationale note mapping mockup content onto real Karl StreamField blocks,
surfaced to reviewers via `karlTag()`. They routinely embed open questions/flags
for the client team and cite governance docs by section number. Keep them accurate
when editing copy. Page copy itself is plain-language, ~Grade 6, tenant-facing,
empathetic civic writing.

### Local persistence

All reviewer state (decisions, notes, edited SEO fields, workspace UI prefs) is
saved client-side under the versioned key `hhvcManagerReviewState:v1`. Bump the
version suffix if the persisted shape changes incompatibly. Workspace UI prefs
(`workspace_open`, `workspace_tab`, `last_page_key`, `show_karl_tags`) live under
`state.ui` in the same blob. This localStorage layer — synchronous
`window.reviewState.read()/write()/update()` — is the tool's always-available
core and is unaffected by whether the optional sync backend below is ever used.

Each page's review record also carries an append-only `history[]` array:
`{ timestamp, reviewer, decision, notes, risks_or_blockers, updated_by }`
entries recording each review round. **`mergeReviewRecord()` in
`js/review-merge.js` is the only place a history entry gets constructed**, and
only at discrete round-boundary events — queue actions/keyboard shortcuts
(`updateLocalReviewForPage`), CSV/JSON import (`importReviewStateBackup`),
server sync (`server.ts`'s `putReviewPage`), and a decision change made from
the sidebar. The continuous per-keystroke/blur autosave
(`saveCurrentPageToLocalStorage`) deliberately skips `mergeReviewRecord` — it
just refreshes the working snapshot, carrying `history` forward untouched —
otherwise every debounced keystroke would append an entry.

The sidebar decision (`<select>` or quick-action chip) is the one exception
that shares the autosave path, so `saveCurrentPageToLocalStorage` singles it
out via `isDecisionRound()`: one entry when the decision actually
_transitions_, never per keystroke, and on a brand-new record only when the
reviewer moved off the default `Needs review`. Queue actions append their own
entry before dispatching sidebar-sync events, so autosave sees a matching
decision and nothing double-records.

**The review import/export round-trip can destroy existing reviews** — a prior
regression replaced saved state wholesale instead of merging. The actual
round-trip logic lives in `js/review-queue-import.js` (CSV import) and
`js/ux-improvements-export.js` (saved-state JSON backup/restore), both merging
through the same `mergeReviewRecord` per-page-key path the sync backend uses;
`js/review-queue.js` wires the handlers and `js/manager-review-export.js`
exports current-page snapshots. **Any change to any of these review
import/export modules, or to `js/review-merge.js`, must be manually
verified**: export a snapshot, re-import it, and confirm existing
decisions/notes survive rather than being wiped.
`tests/e2e/review-import-export.spec.js` covers this round-trip at the API
level, and `tests/e2e/import-export.spec.js` covers it through the real UI
(export button clicks + file-input imports asserting merge-not-wipe).

### Review-state sync backend (optional)

`server.ts` optionally serves a small sync API alongside its static file
serving, backed by SQLite (`bun:sqlite`, no extra dependency) — entirely
additive, off by default, and fails closed (501) rather than open if
unconfigured.

- **Routes**: `GET /api/review-state` (full state, same shape as
  `window.reviewState.read()`); `PUT /api/review-state/pages/:pageKey` (merges
  a patch via the shared `mergeReviewRecord()` — `server.ts` imports
  `js/review-merge.js` directly, the same file a `<script>` tag loads
  client-side — and returns the merged record). Every write is scoped to one
  `page_key`; the server never wholesale-replaces the table. The PUT body is
  capped at `MAX_REVIEW_BODY_BYTES` (1 MB) via the same streaming
  `readBodyWithLimit()` the AI routes use, in front of the parse — so an
  oversized body never reaches `mergeReviewRecord` and a rejected write is
  never partial. **Deliberately larger than the AI cap:** `history[]` is
  append-only and the client pushes the whole record, so this bounds a page's
  entire review life, not one edit. Too low and it is a permanent sync lockout
  — 64 KB measured at ~70 recorded rounds with long notes.
- **Auth**: `Authorization: Bearer <REVIEW_API_TOKEN>` required on every
  `/api/*` request; missing/wrong → 401; `REVIEW_API_TOKEN` unset → 501 (not
  open access).
- **Storage**: SQLite table `review_pages (page_key TEXT PRIMARY KEY, record
TEXT, updated_at TEXT)` at `DATA_DB_PATH` (default: gitignored
  `.data/review-state.local.db` for local dev; point at a mounted volume in
  production).
- **Client**: `js/review-state-sync.js`, a no-op unless configured. Its
  settings live under their own `hhvcReviewSyncConfig` localStorage key,
  separate from `hhvcManagerReviewState:v1` on purpose — the token must never
  round-trip through the shareable CSV/JSON export/import/backup files. Sync
  is manual-trigger only (Pull from server / Push all pages), not a
  background timer, keeping sync-triggered history entries bounded to
  explicit actions.
- **Push vs. pull differ on purpose**: push sends one page's full record and
  accepts the server's merged response as authoritative for that page; pull
  is last-write-wins **per page**, never a field-level re-merge client-side
  (the server's `history` is already merged — re-merging it would duplicate
  entries, and treating a full local snapshot as a "patch" onto the server's
  record would let stale local copies of fields another reviewer changed
  silently overwrite them).
- **Never compare a browser-clock timestamp against a server-clock one.**
  `pullFromServer` decides each page from two clock-independent facts:
  does the server hold a revision this browser hasn't observed
  (`serverRecord.updated_at > localRecord.synced_at` — _both_ server-issued,
  since `synced_at` is only ever assigned from a sync response), and does
  this browser hold unpushed work (the explicit boolean `local_dirty`)? A
  local record's `updated_at` comes from the browser's own clock and must
  never take part: on a browser running behind the server, a genuine
  unsynced edit looks older than an untouched server record and used to be
  silently overwritten by it. `local_dirty` is set by the local write paths
  (autosave only when content actually changed, per `reviewContentEquals`;
  every `mergeReviewRecord` call except the server's own
  `updatedBy: 'sync'`) and cleared only by a real push/pull. It is a genuine
  boolean, hence the explicit branch in `js/review-state-validation.js` —
  the generic `String()` coercion there would turn `false` into the truthy
  string `'false'`. Only an **explicit `false`** means clean: records
  written before the field existed don't carry it (the storage version was
  deliberately not bumped, the field being additive), and treating
  "missing" as "clean" would let the first pull after an upgrade overwrite
  reviews that were never pushed. The absence has to survive autosave too:
  `nextLocalDirty()` (`js/ux-improvements-state-sync.js`) returns
  `undefined` for an unchanged legacy record instead of collapsing it to a
  boolean, since a content-neutral save would otherwise write an explicit
  `false` and grant the pull path the very permission this rule withholds.
- **A divergence is surfaced, never guessed.** A new server revision _and_
  unpushed local edits means neither side has seen the other's work; the
  record is left completely untouched (no content change, and no `synced_at`
  bump, which would let the next push sail through the server's staleness
  check) and reported in `conflicts`, with the server's copy in
  `conflictRecords`. `resolveConflict(pageKey, 'server'|'local',
serverRecord)` is the only way out, one page at a time — `'server'` adopts
  the server copy and clears `local_dirty`; `'local'` keeps local content
  but records the server's revision as observed so the next push stops being
  rejected. The sync controls render a button pair per conflicted page. Each
  resolution is bound to the endpoint that produced it (`pullFromServer`
  returns `apiUrl`, `resolveConflict` refuses a mismatch, and saving new
  settings clears the panel): a stale row would otherwise import another
  deployment's content, and its `'local'` branch would re-mint the exact
  `synced_at` baseline `writeConfig` had just cleared.
- **A resolution is bound to the _divergence_ too.** A row asserts "the
  server holds a revision this browser hasn't observed", and that can stop
  being true underneath it: a push whose PUT reaches the server before an
  overlapping pull's GET, but whose response lands after, makes the pull
  report a conflict against this browser's **own** content and then quietly
  reconcile the record. `resolveConflict` refuses when
  `serverRecord.updated_at <= localRecord.synced_at` (both server-issued,
  so the no-cross-clock rule holds) — acting on such a row adopts a revision
  the page already moved past, discarding anything edited since the push.
  No misfire on a genuine conflict: `pullFromServer` reports one only when
  the server revision is _newer_ than `synced_at`, and leaves `synced_at`
  alone for conflicted pages. `pruneReconciledConflicts()` after a push and
  the mutually-disabled Push/Pull buttons are hygiene on top, not the
  mechanism — either call can be made programmatically.
- **That binding starts at _request_ time.** `pullFromServer` and
  `pushPage` capture `readConfig().apiUrl` before calling `apiFetch` and
  re-check it (`assertEndpointUnchanged()`) before touching state, so a
  response that outlived its configuration is rejected rather than applied.
  Reading the endpoint in the `.then()` instead is the bug it fixes: a pull
  from X landing after the reviewer saved Y gets labelled `Y`, passes
  `resolveConflict`'s guard, and writes X's revision into `synced_at`
  under Y.
- Switching the sync server URL (`writeConfig`) clears every local page's
  `synced_at` **and deletes its `local_dirty` flag**, since both only mean
  something relative to the deployment that issued them. A `false` dirty
  flag asserts "matches what the server has" — a judgement made against
  the _old_ server, so carrying it over lets the first pull from the new
  one see a new revision plus an explicitly clean record and overwrite the
  local decision/notes. It's `delete`d rather than forced to `true`:
  absent is the honest state (unknown provenance) and is already what
  `pullFromServer` treats as possibly-unpushed. There is deliberately **no
  "both non-empty" guard** on that comparison: clearing settings then
  pointing at a different server is two transitions (`X` → `''` → `Y`), and
  requiring both sides to be non-empty would skip the clear on both,
  carrying `X`'s baselines to `Y`.
- **A superseded pull must not drive the conflict UI.** Two Pull clicks put
  two GETs in flight with no ordering guarantee, and
  `assertEndpointUnchanged` can't help — both go to the _same_ endpoint. A
  module-level generation counter stamps each `pullFromServer()` call, and
  its result carries `stale: true` when a later pull started while it was
  in flight. Applying either response's _state_ is safe (last-write-wins
  per page regardless); the conflict panel is not, since a stale empty
  conflict list would erase resolution controls a newer pull correctly
  populated. The guard lives in `pullFromServer`, not the click handler, so
  it's unit-testable and inherited by any caller; the button is disabled
  for the duration as well.
- **Deployment**: run `server.ts` (`bun run start`) with a persistent volume
  mounted, `DATA_DB_PATH` pointed at it, and `REVIEW_API_TOKEN` set to a
  generated secret (never committed). Local dev and Netlify's static-only
  deploy (`build:netlify`, no server runtime for these routes) are unaffected
  either way.
- **Tests**: `tests/review-merge.test.js` (unit) and
  `tests/review-api-server.test.js` (spawns `server.ts` against a temp SQLite
  DB, exercises auth/merge/isolation over real HTTP).

### AI assist backend (optional)

`server.ts` also hosts an optional content-drafting API under `/api/ai/*`,
backed by `build_scripts/ai/`. Same posture as the sync backend: additive, off
by default, failing closed.

- **Two independent gates.** `REVIEW_API_TOKEN` (shared with the sync routes —
  one server secret, not two) decides whether the API exists; unset makes every
  `/api/ai/*` route 501 — except a CORS `OPTIONS` preflight, answered 204
  _before_ the token gate so a cross-origin client can preflight an
  unconfigured server. Don't move the gate above the `OPTIONS` branch. `ANTHROPIC_API_KEY` decides whether generation works;
  unset makes `generate` and `models` 501 while `capabilities` still answers.
  That asymmetry is deliberate — `capabilities` is the browser's discovery
  endpoint, and a 501 there cannot be told apart from "no server at all".
- **The provider gate lives inside each route, not before routing**, so an
  unknown path answers 404 rather than 501 claiming the route exists.
- **Two providers, behind a registry.** `build_scripts/ai/providers.js` holds
  `provider-anthropic.js` and `provider-gemini.js` behind one list; nothing in
  `index.js` or `server.ts` names a provider. A third is a require plus a line
  there. Every entry exports the same surface: `name`, `label`,
  `isConfigured()`, `getModel()`, `listModelIds()`, `normalizeUsage()`, and
  `generateObject({system, userPrompt, jsonSchema, signal})`. Configuration is
  read from the environment **per call**, not snapshot at require time — the
  registry is a module singleton `server.ts` imports once at startup, so caching
  it would freeze the first environment it ever saw.
- **Registration order is the preference order.** An unnamed request runs on the
  first _configured_ provider (Claude, then Gemini). A request naming an
  unconfigured provider is a **400**, never a silent fallback — running a Gemini
  request on Claude would attribute one model's output to another in the panel's
  meta line and in the downloaded module. "Nothing configured at all" stays a
  501: the server genuinely cannot, rather than merely lacking what was asked for.
- **Shared error types live in `build_scripts/ai/errors.js`**, not in a provider
  module. `RefusalError` is raised by both providers from entirely different
  signals — Claude's `stop_reason: 'refusal'`, Gemini's `promptFeedback.blockReason`
  or a `finishReason` of `SAFETY`/`PROHIBITED_CONTENT`/`BLOCKLIST`/`SPII` — so
  `server.ts` maps 422 with one `instanceof` instead of a per-provider branch
  that rots the day a provider is added. `provider-anthropic.js` re-exports it,
  since that was the documented import site.
- **Usage is normalized at the provider boundary** to
  `{inputTokens, outputTokens, totalTokens}`, because `addUsage()` sums usage
  across the validation retry field by field and Anthropic's `input_tokens` and
  Gemini's `promptTokenCount` would otherwise sum into something meaningless.
  Gemini's `totalTokenCount` is trusted over input+output: thinking tokens are
  billed on top, so recomputing understates exactly the thinking-heavy requests
  this feature makes. Provider-native counters ride alongside as
  `usageByAttempt[]` rather than inside the sum — `addUsage` keeps the _first_
  attempt's value for non-numeric fields, so a nested raw object in the total
  would claim attempt one's numbers covered every attempt.
- **Anthropic's input total is all THREE counters**, per the API's own
  definition: `input_tokens` **+** `cache_creation_input_tokens` **+**
  `cache_read_input_tokens`. They are reported separately, not folded in. This
  is not a rounding detail here: `prompts.js` inlines the whole vendored style
  corpus and marks it `cache_control` precisely so it is cached, so on a warm
  request nearly the entire prompt is billed through `cache_read_input_tokens`
  and `input_tokens` is a small remainder. Reading only that counter reported
  **42** input tokens for a request that really used **18042** — understating
  usage by most of the prompt on exactly the requests the caching exists to
  make cheap.
- **The `provider` enum is read from the registry, never written out.**
  `schemas.js` builds it from `allProviderNames()`. A second hardcoded list
  silently breaks the "a require plus a line in `REGISTRY`" contract:
  `capabilities` would advertise the new provider and the browser picker would
  send its name, but the schema would reject the request as malformed before
  `resolveProvider` ever ran — a failure that reads as a client bug rather than
  a missed registration.
- **Routes**: `GET /api/ai/capabilities` (per-provider `providers`, `models`,
  `providerLabels`, and `defaultProvider` — every _registered_ provider, including
  unconfigured ones, so the panel can tell "no key for Gemini" from "no Gemini
  here"), `GET /api/ai/models` (queried live, never hardcoded; settled per
  provider so one bad key does not blank the other's list),
  `POST /api/ai/generate` (`{task, prompt, page?, provider?}`, Zod-validated).
- **Env**: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (default `claude-opus-5`),
  `AI_EFFORT` (default `high`), `ANTHROPIC_BASE_URL` (tests only);
  `GEMINI_API_KEY`, `GEMINI_MODEL` (default `gemini-2.5-pro`),
  `GEMINI_MAX_ATTEMPTS` (default 2), `GEMINI_TIMEOUT_MS`, `GEMINI_BASE_URL`
  (tests only). Keep them in the gitignored `.env.local`.
- **Gemini specifics that a naive port gets wrong.** Use `responseJsonSchema`,
  not `responseSchema` — the latter takes a narrower OpenAPI subset, and the
  wider one is what lets `PAGE_OUTPUT_SCHEMA` be shared byte-for-byte instead of
  forked into a second copy `tests/ai-assist-schema.test.js` would have to guard
  twice. Check `promptFeedback.blockReason` **and** `candidates[0].finishReason`:
  the first covers a blocked _input_ where no candidate exists at all, and
  checking only the second makes those surface as "returned no text" and read as
  an outage. Both are checked before touching content, for the same reason the
  Claude path checks `stop_reason` first. `finishMessage` looks like the refusal
  explanation and is always absent — it is Vertex-only and the SDK's converter
  drops it on the Developer API path — so the explanation is built from the
  blocked `safetyRatings` entries instead. `httpOptions.retryOptions.attempts`
  defaults to **5**, which composes as badly as the Anthropic default did: two
  validation attempts times five is ten upstream calls per click, so it is
  pinned to 2. There is no `cache_control` equivalent; Gemini caches implicitly
  on a prefix match, which is exactly what `prompts.js`'s byte-stability rule
  already provides. API-key auth only — `@google/genai` also speaks to Vertex,
  but that is a different credential story than a single `GEMINI_API_KEY`.
- **Every input is bounded, and the bound is enforced while reading.** `prompt`
  caps at 8000 characters, but `page` is serialized into the provider prompt
  just the same — so it carries its own limits (96 KB serialized, 12 levels
  deep). The body goes through `readBodyWithLimit()`, which streams `req.body`
  and stops at the first byte past 128 KB. `await req.text()` is the wrong
  tool: it buffers everything before anything can measure it, so a chunked or
  Content-Length-lying client allocates freely and a later 413 does not give
  that back. The Content-Length pre-check stays as a cheap first pass. The count
  is in **bytes, not characters** — `String#length` against a byte limit lets
  multi-byte UTF-8 through at ~3× the cap. Depth is measured iteratively, never
  recursively: a recursive walk over attacker-supplied nesting is itself the
  denial of service it exists to detect.
- **Past the cap it stops accumulating but keeps draining.** Cancelling the
  reader leaves the connection framed mid-request, so the client's _next_
  request is read as garbage and gets an empty-bodied protocol-level 400 from
  Bun — a 413 followed by an inexplicable failure on a valid follow-up.
  Dropping the accumulated text is what bounds memory; draining costs only
  bandwidth already in flight. `DRAIN_LIMIT_MULTIPLIER` (8×) bounds that too.
  The regression test must trickle chunks on a timer, or the client finishes
  sending before the server reads and the bug hides.
- **The `page` cap measures the string actually sent.**
  `serializePageForPrompt()` is shared by the size refinement and
  `buildContentUserPrompt`. They used to differ (compact measured,
  pretty-printed sent), so a page could measure ~100 KB and arrive ~4x larger.
  Real pages expand only ~1.2x, so nothing legitimate is rejected.
- **Cancellation is decided by signal state, not the error's shape.** The SDK
  client sets `maxRetries: 1` and a 150s per-call timeout; the route combines
  `req.signal` with `AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS)` (default 240s)
  and hands **both** to `aiErrorResponse`, which maps `client.aborted` → **499**
  and `timeout.aborted` → **504**. Matching on the error does not work: the SDK
  throws `APIUserAbortError` / `APIConnectionTimeoutError`, both inheriting
  `name` `"Error"` with no `status`, so a `name === 'AbortError'` test never
  fired and every cancellation was logged as a 500. `AbortSignal.timeout()`
  reports `"TimeoutError"` besides. Signal state is also provider-agnostic.
  The 504 path is tested against a slow stub — 499 is not observable, since the
  client that aborts cannot read the response.
- **The fallback arm matches `constructor.name`, never `instanceof`.** Neither
  signal is aborted when the SDK's own per-call timeout fires first — which a
  short `ANTHROPIC_TIMEOUT_MS`, or `ANTHROPIC_MAX_RETRIES=0` removing the
  retries that would carry the call past the route budget, makes routine — so
  the fallback is a live path, not a safety net. It was dead for a **second**
  reason on top of the `name` one above: `@anthropic-ai/sdk` ships separate
  `require` and `import` builds, and `server.ts` imported it while
  `build_scripts/ai/provider-anthropic.js` requires it, so `instanceof` compared
  the thrown error against a different copy of the same class and was
  permanently false. Measured: an SDK timeout returned **500**, not the 499 the
  code read as. `constructor.name` is one string on one object, crosses that
  boundary intact, and lets `server.ts` drop the SDK import entirely. The two
  cases split the same way the signal branches do —
  `APIUserAbortError` → 499, `APIConnectionTimeoutError` → **504** — because an
  upstream that ran out of time is not a client that hung up.
- **Gemini's timeout has to be normalized at the provider, because its SDK
  makes it unrecognizable at the route.** `@google/genai` implements
  `httpOptions.timeout` as a bare `abortController.abort()` — no reason — which
  rejects with a `DOMException` whose `name` is `"AbortError"`: byte-identical
  to a reviewer pressing Cancel, and so answered **499 "Generation was
  cancelled."** for a request nobody cancelled. `constructor.name` cannot help
  here the way it does for Anthropic; it is `"DOMException"`. The caller's
  signal is the only thing that still distinguishes the two, and it is in scope
  only inside the provider, so `classifyAbort()` in `provider-gemini.js` raises
  a `ProviderTimeoutError` when the SDK aborted and the caller's signal did
  **not** — and rethrows untouched when it did, so a genuine cancel still
  reaches the signal branches. `ProviderTimeoutError` lives in `errors.js` for
  the reason `RefusalError` does: it belongs to no provider, and normalizing it
  keeps `aiErrorResponse` one `instanceof` instead of a per-provider branch.
- **Numeric env tunables are range-checked, not merely parsed.**
  `numberFromEnv` (`build_scripts/ai/env.js`) rejects NaN, Infinity, negatives,
  fractions, and anything outside `[min, max]` (default max
  `Number.MAX_SAFE_INTEGER`), warning and falling back rather than throwing.
  `Number.isFinite` is not sufficient: `AI_REQUEST_TIMEOUT_MS=1e20` is finite
  and `AbortSignal.timeout()` rejects it, and that call sits outside the
  generate route's `try` — so the value becomes an unmapped 500 on every
  generation, the very failure the helper exists to prevent. Both timeouts also
  cap at one hour and `ANTHROPIC_MAX_RETRIES` at 10.
- **The retry carries the rejected draft, not just the failures.** Each API
  call is stateless, so "fix these and change nothing else" is only followable
  if the draft travels with the instruction. Usage is summed across attempts
  for the same reason: reporting only the last call understates exactly the
  requests that cost the most.
- **The draft is checked under two different sentinel keys.** `data-checks.js`
  uses one `pages` object both for what to walk and for which targets resolve,
  so filing the draft under `__generated__` made that string a resolvable
  target. Running each check under `__generated__` and `__generated_probe__`
  and unioning the broken targets closes that with no duplicated traversal.
- **Validation is the feature.** `build_scripts/ai/validate-output.js` runs a
  generated page through `build_scripts/schema.js`,
  the `data-checks.js` invariants, and `js/plain-language.js`'s mandates — then
  names the failures back to the model for exactly one retry. Results always
  return 200 with issues attached, since a draft failing one rule still helps a
  reviewer who can see which rule.
- **The system prompt must stay byte-stable.** It inlines the vendored
  `docs/source/sfgov-style/` corpus behind a `cache_control` breakpoint;
  caching is a prefix match, so anything variable in it kills the cache.
- **Never writes anything** — no filesystem, no review state, no `pages/*.js`.
  Standards manual §1.11 forbids automated approval and SF.gov's AI guidelines
  require disclosing generative-AI use, so every successful `generate` result
  carries a `disclosure` string — scoped to that shape only (`capabilities`
  advertises `disclosureRequired: true`, `models` returns bare ids, errors
  carry none). Both browser export paths carry it: Download and Copy emit the
  same `buildPageModuleSource()` output. So the field's presence is not a test
  for whether a payload holds generated content.
- **Tests**: `tests/ai-assist-server.test.js` (spawns `server.ts` against a stub
  Anthropic endpoint — no API key, CI never makes a paid call) and
  `tests/ai-assist-schema.test.js` (guards the structured-output schema against
  drifting from the Zod page schema).

### Build outputs

- **`bun run build:singlefile`** (`vite build --mode singlefile`, via
  `vite-plugin-singlefile`) inlines every script and stylesheet into one portable
  `dist-singlefile/index.html`. It replaced the hand-rolled
  `build_scripts/build-single-file.js`. That output and `dist/` are
  **gitignored generated files; never hand-edit.** Edit sources, re-run `bun run build`.
- **`build_scripts/extract-pages.js`** (first half of `bun run export`)
  regenerates `data/page_inventory.{json,csv}`. `data/` is absent on a fresh
  clone (gitignored); this script creates it. Dev/serve never touches `data/`.
- **`build_scripts/sync-tracking-sheet.js`** (second half of `bun run export`,
  also `bun run sync-tracking`) regenerates the Google Sheets–ready tracking CSVs
  under `review/`. **`build_scripts/push-tracking-sheet.js`**
  (`bun run push-tracking`) three-way-merges against the live Master Control
  workbook (IDs/tab gids in `build_scripts/sheet-config.json`) and optionally
  pushes via the Sheets API. It needs a Google service-account key — gitignored,
  and it must stay that way (never commit `*-service-account*.json` or
  `.env.local`).
- **`bun run build:netlify`** (driven by `netlify.toml`) runs `validate` →
  `build:app` (the real Vite production build) →
  `build_scripts/copy-workshop-form.js`. That copy step does **not** run the
  sub-app's Vite build — it copies whatever is checked into
  `forms/mosquito-workshop-request/dist`, so rebuild that form first
  (`bun run build:workshop-form`) after editing its `src` or Netlify ships stale
  assets. It fails loudly if the committed form HTML references assets that were
  never committed (the "form shell that never hydrates" regression).
- `server.ts` mirrors the same security headers (`X-Content-Type-Options`,
  `X-Frame-Options`, etc.) that `netlify.toml` sets for the deployed site.

### Other directories

- **`forms/mosquito-workshop-request/`** — independent Vite app (own
  `package.json`, `vite.config.js`, `src/main.js`), built separately.
- **`review/`** — reference/output for the manager review process
  (`manager_review_packet.md`, `manager_decision_log.csv`, etc.), distinct from
  the in-browser `localStorage` review state.
- **`docs/source/hhvc-policy/`** — source policy documents (PDFs + markdown
  extracts) page copy is based on; not code.
- **`docs/superpowers/plans/` and `docs/superpowers/specs/`** — planning/design
  docs from prior sessions; useful background, not standing instructions.

## Code style & idioms

### Formatting (a hard CI gate)

Prettier is the **only** linter (`.prettierrc.json`): **no semicolons**, single
quotes, 2-space indentation, `printWidth: 100`, ES5 trailing commas. Code must be
ASI-safe and semicolon-free. Run `bun run format` before committing;
`bun run format:check` is the lint step. `.prettierignore` excludes `data/`,
`server.ts`, the generated single-file HTML exports, and reference/planning dirs.

### JavaScript

- **This is plain browser JS — not TypeScript — but it IS bundled, and
  `js/*.js` ARE ES modules.** Use `import`/`export` with explicit relative
  specifiers including the `.js` extension (`import { escapeHtml } from
'./utils.js'`). Vite builds it; `server.ts` is the one TypeScript file.
  (Notes elsewhere describing "no build step, no ES modules" predate the Vite
  migration.)
- **File naming:** lowercase — single words for the core modules (`app.js`,
  `state.js`, `utils.js`), hyphenated for multi-word ones
  (`review-queue-state.js`, `page-render.js`); never camelCase. Match sibling
  files.
- **Two deliberate module patterns:** (1) plain modules for the core files —
  bare `const`/`function` declarations plus an `export { … }` block at the bottom,
  and a `window.X = X` line for the few things other code reaches through
  `window`; (2) **named IIFEs with a leading semicolon** — `;(function mountX(){…})()`
  — for newer stateful subsystems (the leading `;` is required because there are
  no statement-terminating semicolons). Expose via `window.<Namespace>` with the
  idempotent `window.X = window.X || {}` idiom.
- **Naming:** `camelCase` for JS identifiers, `UPPER_SNAKE_CASE` for module
  constants, `snake_case` for serialized/CSV data fields (`review_date`). That
  camelCase-code / snake_case-data boundary is firm.
- **Defensive by default:** run every value that reaches `innerHTML` through
  `escapeHtml`; use optional chaining + `?? ''` coercion and guard-clause early
  returns; guard test/SSR contexts with a `typeof window === 'undefined'` early
  return; `csvEscape` includes spreadsheet formula-injection protection. Prefer
  reusing `js/utils.js` helpers over inlining new logic.
- **State:** in-memory module singletons + versioned `localStorage` updated via
  functional updater callbacks (`updateLocalState((s) => { …; return s })`) +
  `HHVC_DATA`/`HHVC_PAGES` globals; `ORIGINAL_DATA` is a deep clone for reset.

### Comment & documentation voice — the most distinctive trait

Write **detailed, explanatory** comments and docs, not terse ones (the author's
stated preference: verbose, comment-heavy, explain the reasoning). Every module
opens with a header block stating its role **and its load-order dependency**.
Functions carry full JSDoc (`@param`/`@returns`). Comments justify the _why_ —
product rationale, trade-offs, and exact WCAG contrast math in CSS — not
restatements of the code. Prose docs use plain-English framing with
`**Bold label:**` bullets that state a non-obvious fact _and why it matters_, and
annotate config inline (e.g. the `"// script": "description"` keys in
`package.json`). Match this voice.

### CSS

Design-token-first: raw `--sfds-*` tokens (from the SF.gov/Karl design guide) →
a semantic `--brand-*`/`--surface-*`/`--text-*` layer with baked-in `var(fallback)`
values, so reviewers retheme by touching tokens only. Hand-authored, no
preprocessor. Boxed section-banner comments; justify color/accessibility choices
in-comment with the contrast math. `!important` is used liberally **only** in the
self-aware override layer (`css/ux-improvements.css`). Dark mode via
`@media (prefers-color-scheme: dark)` token overrides; responsive type via
`clamp()`.

**The seven stylesheets, in `js/main.js` import order** (`css/theme.css` MUST
stay last — it is the semantic token layer, and its dark-mode block overrides
the `--sfds-*` primitives `css/styles.css` declares on `:root`):

| File                      | Owns                                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------------- |
| `css/styles.css`          | the mockup itself, plus the raw `--sfds-*` primitives                                          |
| `css/ux-improvements.css` | the review layer's own chrome — the designated `!important` override sheet                     |
| `css/ai-assist.css`       | the AI assist panel                                                                            |
| `css/dashboard.css`       | the `.ds-*` primitives and the workspace shell, tabs, KPI tiles, progress bar and status chips |
| `css/review-insights.css` | the Overview cards and the failing-checks ranking                                              |
| `css/review-ops.css`      | the stored-review-data panel                                                                   |
| `css/theme.css`           | **the semantic token layer** — surfaces, type scale, status/decision colours, dark mode        |

Retheming should mean editing `css/theme.css` only. A component rule that needs
a colour, a size step or a radius takes a semantic token; it should not reach
for a raw `--sfds-*` value, and it must never hardcode a literal — every
dark-mode contrast bug this repo has had came from a literal sitting where a
token belonged.

**A selector should be declared in exactly one file.** `.review-workspace`,
its tabs, the KPI tiles and `.status-chip` were each split across
`css/ux-improvements.css` and `css/dashboard.css`, with the later file
declaring only what it wanted to change — so what actually rendered was a merge
of the two and neither block described it. They now live wholly in
`css/dashboard.css`.

### Tests

Bun test: `import { describe, test, expect } from 'bun:test'`, importing the
modules under test directly. `tests/helpers/browser-env.js` — preloaded via
`bunfig.toml` — registers a happy-dom global environment before the loader runs,
restores Bun's native fetch, and clears localStorage after every test. The old
`tests/helpers/load-scripts.js` vm harness is gone — it evaluated classic scripts
into a shared context, which ES modules made impossible. `describe` blocks are named after the unit under test;
`test` names are **behavioral verb sentences** ("escapes all five HTML special
characters"). Prefer exact-string assertions over loose matching. The XSS/escaping
surface (`page-render.test.js`) is exhaustively covered — one assertion per render
function. Use `test.todo` (with a reasoning comment) to document a
known-but-unfixed bug rather than asserting wrong behavior.

## Commits & pull requests

- **Imperative mood.** Prefer **Conventional-Commits prefixes** for code changes
  (`fix:`, `feat:`, `style:`, `content:`); keep the subject ≤ ~72 chars.
- **Bodies scale with complexity:** a one-liner for CSV/doc refreshes; for
  behavior/layout changes, a problem statement + a dash-bulleted list of changes +
  an explicit **verification line** (e.g. "Verified headless at 1600px and
  850px…"). AI-assisted commits carry `Co-Authored-By` and `Claude-Session`
  trailers.
- **Keep dashboard-UX changes and policy-copy changes in separate PRs** — reduces
  merge conflicts and keeps review focused.
- **Never hand-edit generated files** (single-file HTML exports,
  `data/page_inventory.*`) — edit sources and rebuild.
- **Review exports** (`review/*.csv`, saved local-review CSV/JSON) are for manager
  decisions only — **never treat them as automatic publication approval.**

## Editing rules (quick reference)

- Public page content → `pages/*.js`.
- Core render/state → `js/state.js`, `js/page-render.js`, `js/ui-controls.js`,
  `js/editor-panel.js`, `js/app.js`.
- Review/UX layers → `js/ux-improvements.js`, `js/review-queue.js`,
  `js/dashboard-guidance.js`, `js/keyboard-shortcuts.js`,
  `js/manager-review-export.js`, `css/ux-improvements.css`.
- Shared merge/history logic → `js/review-merge.js` (the only place a
  `history` entry should be constructed; loaded both as a browser `<script>`
  and imported directly by `server.ts`). Optional sync backend → `server.ts`
  (API routes) and `js/review-state-sync.js` (client pull/push + settings UI).
- Styles → `css/styles.css`; design tokens → `css/theme.css`.
- After editing `pages/*.js` or `js/page-data.js`, run `bun run validate` **and**
  `bun run test`. After touching the import/export round-trip, manually verify it
  (export → re-import → decisions survive).

## Karl CMS

Login URL for the Karl (Wagtail-based) CMS admin:
`https://api.sf.gov/sso/login?next=/admin/`. Keep user-specific credentials and
private MCP config out of the repo (in `~/.codex/config.toml` or equivalent).

## Cross-tool canon

**This file is the source of truth.** Every other agent-instruction file in the
repo mirrors it. If any two disagree, this one wins and the other is the bug.

Two of the mirrors carry real content and must be updated alongside this file:

| File                              | Role                                                                   |
| --------------------------------- | ---------------------------------------------------------------------- |
| `CLAUDE.md`                       | Claude Code's mirror — the same facts plus Claude Code–specific notes. |
| `.github/copilot-instructions.md` | Copilot's mirror — a condensed subset.                                 |

The rest are **pointers on purpose** and must stay that way — no counts, no file
inventories, no architecture summaries:

- `.cursor/rules/repo-context.mdc` (Cursor)
- `.windsurfrules` (Windsurf)
- `.claude/skills/HHVC_manager_review_current_tool_package/SKILL.md` and
  `.agents/skills/HHVC_manager_review_current_tool_package/SKILL.md` (kept
  byte-identical; different tools read different paths)
- `.codex/AGENTS.md` (Codex — MCP baseline only, no architecture claims)

**Why pointers.** All six previously restated a summary of the architecture, and
every one of those summaries rotted. Months after the Vite migration they were
still telling agents this repo had "no bundler", "no ES modules/`import`/`export`
in `js/*.js`", a `tests/helpers/load-scripts.js` harness that no longer exists,
and — worst — that registering a new page meant adding a `<script>` tag to
`index.html`, which now has exactly one. None of them were in anybody's update
path, because this section did not exist to name them. A mirror that repeats a
fact drifts from it; a mirror that points at it cannot.

**When you add a fact here,** decide whether `CLAUDE.md` and
`.github/copilot-instructions.md` need it too. When you add a new
agent-instruction file for some other tool, add it to the pointer list above and
write it as a pointer.
