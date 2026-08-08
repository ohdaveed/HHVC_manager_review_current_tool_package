# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, no-framework mockup tool for manager review of a redesigned HHVC
(Healthy Housing and Vector Control) section of SF.gov. It is **bundled by
Vite** from a single ES-module entry point (`js/main.js`), and `server.ts`
serves the build output plus the optional sync API. Bun runs the CLI scripts
(validate/export/build) and the test suite. There is still **no UI
framework** — rendering is data-driven string templates, not components.
Reviewer state lives in the browser's `localStorage` by default, and the tool
works fully offline with no server at all beyond serving static files —
**no backend/database/external service is required.** `server.ts` also hosts
an **optional**
review-state sync backend (Bun + SQLite, see "Review-state sync backend"
below) that reviewers can opt into per-browser to sync decisions across
machines; it's off unless deployed and configured, and every other part of
the tool is unaffected if it's never used.

A separate Vite sub-app lives at `forms/mosquito-workshop-request/` (a real
build step, built independently — see Build outputs below).

The repo currently holds **21 pages** under `pages/`. If `bun` isn't on
`PATH` it installs to `~/.bun/bin`; run `export PATH="$HOME/.bun/bin:$PATH"`.

## Commands

```bash
bun install                  # install deps (required before first `dev` — js/main.js
                             # imports @sfgov/design-system CSS + the third-party libs,
                             # and validate/test need zod, fast-glob, happy-dom)
bun run dev                   # Vite dev server (HMR) at http://127.0.0.1:8080
bun run dev:api               # optional sync backend (server.ts) on :8081; dev proxies /api to it
bun run start                 # production-like: build:netlify then serve dist/ + the API
bun run serve                 # serve an already-built dist/ without rebuilding
bun run validate              # Zod-validate pages/*.js + js/page-data.js (schema + invariants)
bun run test                  # bun test over the 22 unit-test files in tests/ (533 tests)
bun run test:e2e              # playwright test (123 specs across 16 files in tests/e2e/)
bun run export                # regenerate data/page_inventory.{json,csv} AND the local
                              # tracking CSVs (extract-pages.js + sync-tracking-sheet.js)
bun run sync-tracking         # regenerate the local mockup tracking CSVs only
bun run push-tracking         # push page review status to the Google Sheets tracker
bun run build                 # validate -> export -> workshop form -> build:app -> publish form -> singlefile
bun run build:app             # vite build -> dist/ (what server.ts and Netlify serve)
bun run build:singlefile      # vite build --mode singlefile -> dist-singlefile/index.html
bun run build:workshop-form   # bun install + vite build inside forms/mosquito-workshop-request
bun run build:netlify         # validate -> build:app -> copy-workshop-form.js (assembles dist/)
bun run format                # prettier --write . (everything not in .prettierignore)
bun run format:check          # prettier --check . — THIS IS THE LINT STEP (no ESLint/tsc)
```

`HOST=0.0.0.0 bun run dev` / `PORT=3000 bun run dev` override the dev server
bind (`vite.config.mjs` reads `HOST`/`PORT`, defaulting to `127.0.0.1:8080`).
`start-dev.sh` kills any stale **listener** on the port before starting.

**There is a build step now.** The app is bundled by **Vite 8**
(`vite.config.mjs`) from a single ES-module entry point, `js/main.js`. The old
model — ~47 hand-maintained classic `<script>` tags in `index.html` sharing one
global lexical scope — is gone, along with the `js/vendor/` IIFE bundles and
the `vendor:browser` script that rebuilt them. Third-party libraries are
imported from npm and tree-shaken. `server.ts` still owns the optional sync
API and now serves `dist/` rather than the repo root (override with
`STATIC_ROOT`).

**There IS a real test suite** (older docs sometimes claim otherwise — they're
wrong). `bun run test` runs twenty-two Bun unit-test files under `tests/`:
`utils`, `data-validation`, `page-render`, `csv`, `review-state-schema`,
`reading-level`, `plain-language`, `page-import-checks`, `mockup-image-export`,
`review-insights-data`, `review-insights-charts`, `review-insights-render`,
`review-ops-data`,
`decision-vocabulary` (pins the two module-boundary restatements of the
decision list against the canonical table in `js/utils.js`), `doc-counts`
(reads the counts back out of these docs and compares them to the filesystem),
`review-merge`,
`review-api-server` (which spawns
`server.ts` as a subprocess against a temp SQLite DB and exercises
auth/merge/isolation over real HTTP), `review-state-sync`, `ai-assist-schema`,
`ai-assist-env`, `ai-assist-providers` (the provider registry and per-provider
usage normalization, varying the provider API keys directly — which the server
tests structurally cannot, since a spawned subprocess only ever sees the
environment it was given), and `ai-assist-server` (which spawns `server.ts`
against stub Anthropic **and** Gemini endpoints, so both AI paths are covered
without a key or a paid call) — 533 tests at time of writing.
**That list is spelled out explicitly in `package.json`'s `test` script rather
than globbed**, so a newly added `tests/*.test.js` runs only once it is named
there; until then it passes locally when invoked by hand and covers nothing in
CI. Tests import the
modules under test directly. `tests/helpers/browser-env.js`, preloaded via
`bunfig.toml`, registers a **happy-dom** global environment first — the module
graph does real work at import time (`js/state.js` reads `window.HHVC_DATA`),
so the browser globals have to exist before the loader runs. It also restores
Bun's native `fetch`/`Request`/`Response` afterwards, because happy-dom's HTTP
client breaks `review-api-server`'s real requests, and redefines
`window`/`document`/`localStorage` as writable so `review-state-sync`'s tests
can still stub them.

`bun run test:e2e` drives Playwright over `tests/e2e/` — sixteen spec files
(123 specs), all UI-driven: navigation, editor panel, review workflow, review
queue, review-queue undo, stored review data, import/export, keyboard
shortcuts, workspace panels, accessibility, AI assist, mockup PNG export and
Overview insight cards, and workshop-form submission handling. They share plain helper functions in
`tests/e2e/helpers.js` (no fixture framework).
A fourteenth file, `review-import-export.spec.js`, was deleted rather than
repaired. Its two round-trip tests hand-rolled the merge inside
`page.evaluate()` instead of calling `importReviewStateBackup()`, so reverting
that function to the wholesale replace that once destroyed reviews left them
green — and its other two tests duplicated `keyboard-shortcuts.spec.js` and a
**weaker** copy of `accessibility.spec.js`'s scan with `color-contrast`
disabled. The real coverage is `import-export.spec.js`, which drives both
paths through the file input and asserts `history.at(-1).updated_by`.
**`gotoFresh()` waits on `window.reviewKeyboardShortcuts.ready`**, not just the
sticky bar: the bar is mounted early by `js/ux-improvements.js`, so waiting on
it alone let a test press a global shortcut before `js/keyboard-shortcuts.js`
had attached its `keydown` listener. Playwright's
`webServer` block starts `bun run start` on `:8080` itself. In a sandbox with
a pre-installed Chromium, point Playwright at it instead of downloading:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium bun run test:e2e
```

`bun run validate` (`build_scripts/validate.js`) is a **complementary, not
redundant** check: it loads every `pages/*.js` file plus `js/page-data.js`
into a Node VM context and Zod-validates required fields/shapes, plus several
hardcoded business invariants (see below). It always validates the full page
set — there's no way to validate a single page file in isolation. **Run
`bun run validate` and `bun run test` after editing anything under `pages/`
or `js/page-data.js`.**

### CI

`.github/workflows/ci.yml` runs on pushes to `main` and on every pull
request, in two deliberately separate jobs so a formatting or schema failure
reports in seconds without waiting on a Chromium download, and a flaky
browser run never masks a unit failure:

- **checks** — `bun install --frozen-lockfile` → `format:check` → `validate`
  → `build:netlify` → `test`. `build:netlify` doubles as a deploy-integrity
  check: it fails if the committed workshop-form `dist` references assets
  that were never committed (the "form shell that never hydrates" regression).
  **It runs before `test` on purpose**, even though that delays a unit
  failure by a build: one test in `tests/review-api-server.test.js` asserts
  that a set-but-empty `STATIC_ROOT` still serves the real built app, and it
  can only tell a correct fallback from a broken one if `dist/` exists. It
  skips itself when there is no build — so with the fast order it passed by
  skipping and covered nothing.
- **e2e** — installs Playwright Chromium and runs `test:e2e`, uploading
  `playwright-report/` as an artifact on failure (traces are on-first-retry).

## Architecture

### Data-driven rendering, no framework

Each file in `pages/*.js` assigns a page object onto the global
`window.HHVC_PAGES['<pageKey>']`. `js/page-data.js` then builds
`window.HHVC_DATA = { pages, order }`, where `order` is the array of
`[pageKey, menuLabel]` pairs driving navigation/menu order.

**Load order now lives in `js/main.js`, not `index.html`.** `index.html` has
exactly one script tag — `<script type="module" src="/js/main.js">` — and
`js/main.js` is the root of the module graph: it imports the CSS, the three
third-party libraries, then the core modules and the review/UX layers in
sequence. The old model (~47 classic `<script>` tags sharing one global
lexical scope, where a `const` in an earlier file was visible to later ones)
is gone.

Order still matters, but it is now enforced in two different ways:

- **Core modules enforce it themselves.** A module that needs `escapeHtml`
  imports it, so it cannot run too early no matter what `js/main.js` says.
  `js/state.js` imports `js/page-data.js`, which imports all 19 `pages/*.js`
  files — so `window.HHVC_DATA` is guaranteed populated before anything reads
  it, and `js/state.js`'s throw now only fires on genuinely malformed data.
- **The self-mounting IIFE subsystems still depend on listed order.**
  `js/ux-improvements*.js`, `js/review-queue*.js`,
  `js/dashboard-guidance.js` and `js/keyboard-shortcuts.js` talk to each other
  through `window.<Namespace>` objects rather than imports, so they must run
  after the core modules that create those namespaces. Their sequence in
  `js/main.js` is load-bearing and is still reviewed by hand.
  **Not "no imports"** — that was the old wording and only
  `js/review-queue*.js` actually takes none; the rest import `js/utils.js`
  helpers, `js/dashboard-guidance.js` four of them. The graph therefore orders
  them against the core already. What it cannot see is a `window.<Namespace>`
  a sibling assigns at mount time, and that is the edge this list enforces.

**Some functions are deliberately published onto `window`.** Under the old
shared scope every top-level function was implicitly a `window` property, and
several callers still rely on that rather than importing:

- `window.renderPage` (`js/page-render.js`) — wrapped to refresh after
  navigation by `js/ux-improvements.js`. (There were three wrappers;
  `js/interactive-sitemap.js` is gone, and `js/manager-review-export.js`'s
  existed only to refresh a "Current page:" sidebar label that has been cut.)
  The decorator chain only forms if the original
  is on `window`; otherwise each wrapper's `typeof` guard returns early and
  every wrapper silently no-ops while the page still renders.
- `window.toggleSidebar` (`js/ui-controls.js`) — called from an inline
  `onclick` in `index.html`, which has no way to reach a module scope.
- `window.showToast` (`js/ui-controls.js`) and `window.updateSearchPreview`
  (`js/editor-panel.js`) — called optionally (`window.showToast?.(…)`) by the
  IIFE layers, which are designed to degrade to silence rather than throw.
- `window.ORIGINAL_DATA` (`js/state.js`) — read by
  `js/review-state-sync.js`'s `restorePageContentFromOriginal`, which stays
  free of this module's page-data dependency chain on purpose.

**`bun run validate` enforces page-import membership.**
`build_scripts/page-import-checks.js` diffs `pages/*.js` on disk against the
side-effect imports in `js/page-data.js`. Vite turns "an import naming a file
that does not exist" into a build error, but the opposite case still fails
silently: a page file nobody imports simply never registers onto
`window.HHVC_PAGES`, so the page vanishes with no error anywhere. That is what
this check catches, and why it survived the migration.

- **Adding a new page file:** add `import '../pages/<file>.js'` to
  `js/page-data.js`, and a `[pageKey, menuLabel]` entry to its `order` array
  so it appears in navigation.
- **Adding a new `js/*.js` module:** import it from whoever needs it. If it is
  a self-mounting IIFE with no importer, add it to `js/main.js` in the right
  position for its `window.<Namespace>` dependencies.

Import _order_ isn't checked for pages — it genuinely doesn't matter, since
each page module only writes into `window.HHVC_PAGES`; navigation order comes
from the `order` array, validated separately by `findMissingOrderKeys`.

Node-side scripts (`build_scripts/`, `tests/`) hardcode no file lists — they
discover files dynamically via `build_scripts/load-pages.js`
(`getPageScriptPaths()` globs `pages/*.js` sorted, with `js/page-data.js`
always last). Those scripts still evaluate pages in a Node VM context rather
than importing them, which keeps `validate`/`export`/tracking-sheet paths
synchronous and preserves the `exclude` option tests use to load a
deliberately incomplete page set. `runPageScripts()` strips the side-effect
`import` lines from `js/page-data.js` before evaluating it, because the loop
has already executed every page file by then — the imports and the loop
express the same dependency.

### Core module split (formerly one `app.js`)

The old monolithic `app.js` was split into focused modules — **do not
re-monolith them.**

- **`js/utils.js`** — 849 lines publishing 36 entries on `window.utils`, also
  exported as bare top-level functions. Loads first. Beyond the obvious
  (`escapeHtml`, `today`, `debounce`, CSV parse/serialize/download, DOM
  get/set) it owns **`safeUrl`/`urlProbe`** (the scheme guard described below),
  the **decision vocabulary** (`DECISIONS` and its derived maps — the canonical
  list nothing else may restate), and `buildReviewRecord`/
  `REVIEW_RECORD_FIELDS`. **Add new cross-cutting helpers here** rather than
  duplicating logic — though the module has drifted toward a grab-bag, and
  `isWorkspacePanelOpen`/`mountWorkspacePanelIfOpen` sit here as a layer
  inversion: the bottom-most module reaching up into the workspace DOM.
- **`js/karl-tag-meta.js`** — the shared `KARL_TAG_KINDS` table (`meta`,
  `body`, `placement`, `editor`) and legend markup used by `karlTag()` and the
  workspace legend. Loads after `js/utils.js` for `escapeHtml`.
- **`js/state.js`** — core state: `DATA`/`ORIGINAL_DATA` (a deep clone used
  for field-reset), `pageData`, `pageOrder`, `currentPageKey`.
- **`js/ui-controls.js`** — toasts, sidebar collapse/scroll persistence, the
  page-picker `<select>`, and the review checklist.
- **`js/editor-panel.js`** — SEO/editor panel: syncing input fields with the
  current page, dirty-state indicators, search-result preview, per-field reset.
- **`js/page-render.js`** — turns `pages/*.js` page objects into the `#mockPage`
  HTML, including `karlTag()` for Karl CMS placement annotations and the
  `unverifiedPill()` warning badge.
- **`js/app.js`** — bootstraps DOM event listeners (`init()`) and kicks off
  the first `renderPage('pestsTopic')`.
- **`js/manager-review-export.js`** — manager review CSV/JSON export
  snapshot, published on `window.ReviewExport` for the consolidated export
  control. It no longer wraps `renderPage`: that decorator existed only to
  refresh a sidebar label that has been cut.
- **`js/reading-level.js`** — Flesch-Kincaid grade level for body copy, backed
  by `text-readability` (a runtime dependency, bundled: 40 kB raw / 17.9 kB
  gzip). **There used to be two implementations and now there is one.** This
  file carried a hand-rolled formula from the no-build-step era while
  `build_scripts/reading-level.js` wrapped the library for Node — and only the
  Node copy had tests, while only this one shipped. They disagreed by 1.14
  grades on average across the 21 pages, always in the direction of "easier
  than it is", so nine pages reported hitting a reading target they miss. The
  Node copy is deleted; `tests/reading-level.test.js` now imports this one.
- **`js/review-state-validation.js`** — browser-side validation of the
  `hhvcManagerReviewState:v1` blob, mirroring
  `build_scripts/review-state-schema.js`'s Zod rules without shipping Zod to
  the browser. Keep the two in step when the persisted shape changes.

### Review/UX layers are additive, on top of the core

`js/ux-improvements.js` (sticky review bar, workspace tabs, Karl compliance
scorecard), `js/review-queue.js` (cross-page review queue/progress),
`js/dashboard-guidance.js` (consolidates sidebar helper copy into the Help
workspace tab, hiding duplicated sidebar text at runtime without deleting
HTML), and `js/keyboard-shortcuts.js` (global shortcuts, ignored while typing in form
fields) are each self-contained IIFEs that read `window.HHVC_DATA` and
`localStorage`. Some (e.g. `js/ux-improvements.js`, when restoring saved
edits) do write edited title/summary/CTA/SEO fields back onto the **in-memory**
`pageData` objects — but **must never write back to the `pages/*.js` source
files or publish content**; they are review aids only, not publishing tools.

`js/ux-improvements.js` and `js/review-queue.js`
are thin orchestrators (event wiring + `init()` + public API assembly) over
sibling files that do the actual work, mirroring the existing
`window.utils`/`window.reviewState` pattern — each sibling attaches its
functions to an internal `window.<Namespace>` object (implementation detail,
never referenced from `pages/*.js` or outside its own module's files):

- **`window.ReviewUx`** (`js/ux-improvements.js`'s orchestrator) ←
  `js/review-state-store.js` (shared `window.reviewState` read/write/update,
  also consumed directly by `js/review-queue*.js`),
  `js/ux-improvements-state-sync.js` (per-page field sync/dirty-state),
  `js/ux-improvements-workspace.js` (sticky bar, workspace tabs, Karl
  scorecard), and `js/ux-improvements-export.js` (review summary copy,
  CSV/JSON backup export/import, clear-local-reviews).
  `js/review-merge.js` (`window.reviewMerge`) and `js/review-state-sync.js`
  (`window.reviewStateSync`) sit alongside these as their own small globals —
  deliberately **not** under `window.ReviewUx` — since `js/review-merge.js` is
  also imported directly by `server.ts` and must stay free of any browser-only
  namespace or DOM dependency.
- **`window.ReviewQueueInternal`** (`js/review-queue.js`'s orchestrator) ←
  `js/review-queue-state.js` (shared state + UI-persistence helpers),
  `js/review-queue-rows.js` (row building, filter/sort/selection, bulk
  actions, Fuse.js search), `js/review-queue-render.js` (table/stats/bulk-bar
  rendering), and `js/review-queue-import.js` (CSV import — kept isolated as
  the highest-regression-risk area; see "Local persistence" below).
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
  Both are collapsed `<details>` at the end of Help rather than tabs of their
  own, so `setWorkspaceTab` calls **both** when Help opens — a reviewer
  expanding one must never find an empty box. Each panel
  ALSO catches an already-open tab at its own `init()` via
  `mountWorkspacePanelIfOpen('help')` in `js/utils.js` — `js/ux-improvements.js`
  initializes earlier and restores a persisted `workspace_tab` before these
  hooks exist, so without the catch-up a reviewer who left one of these tabs
  open came back to an empty panel.

- **AI assist breaks the naming pattern above — mind the case.**
  `window.AiAssist` is the **internal** namespace: `js/ai-assist-client.js`
  attaches `.client` (the browser half of the optional `/api/ai/*` routes, a
  no-op unless configured) and `js/ai-assist-render.js` attaches `.render`
  (panel rendering, styles in `css/ai-assist.css`). `js/ai-assist.js` consumes
  both, owns the request lifecycle and cancel, and publishes its public API on
  the separate lowercase **`window.aiAssist`** (`ensureRendered`,
  `refreshCapabilities`, `getCurrentPage`, `captureForm`). The orchestrator does **not** own
  the capitalized namespace here — `window.AiAssist.ensureRendered` does not
  exist.

  `js/ai-assist-render.js` renders model output, which is text nobody in this
  repo wrote, so it escapes everything before `innerHTML` (the exception being
  the page preview, which routes through the escaping-audited
  `renderPageMain()`). **That is not a security boundary, though** — imported
  CSV/JSON backups and records pulled from the sync server also carry
  externally-supplied reviewer names, notes, and edited fields into the sticky
  bar, queue, and preview. Those are safe because they already use
  `escapeHtml`/`textContent`, and must stay that way.

The workspace tab strip is `['overview', 'checks', 'help']`, numbered left to
right by the `1`–`3` shortcuts. It carried six until a UX review cut three:
**Sitemap** was removed outright (a fourth way to navigate 20 pages, drawing a
hierarchy one level deep — most hubs rendered as `HUB 0/0` above "No child pages
assigned"), and **AI assist** and **Tool status** became collapsed `<details>`
at the end of Help. Both of those depend on `server.ts`, which the Netlify
deploy has no runtime for, so on the build managers actually open they were two
permanently-empty panels holding two of six slots. Help stays last, so it is the
digit that moves whenever the strip changes; `WORKSPACE_TABS`
(`js/ux-improvements-workspace.js`), the tab markup in `index.html` and the
`1`–`3` cases in `js/keyboard-shortcuts.js` must change together.

The two surviving lazy panels **also catch an already-open Help tab at their own
`init()`** (`mountWorkspacePanelIfOpen`): `js/ux-improvements.js` initializes earlier
and restores a persisted `workspace_tab` before those hooks exist, so without
the catch-up a reviewer who left Help open saw an empty panel until switching
tabs and back.

Relatedly, `js/keyboard-shortcuts.js` dispatches `hhvc:shortcuts-ready` and
sets `window.reviewKeyboardShortcuts.ready` **from `init()`, after** the
`keydown` listener is attached. It used to fire at module scope, announcing a
capability that did not exist yet.

### The workspace is docked, not stacked

`#reviewWorkspace` is a **third grid column in `.app`**, sticky to the viewport
— not the last child of `.canvas`, which is where it used to live. The numbers
are the whole argument: the mockup runs about 8,766px, so the panel began around
y=9,413 in a 10,348px document, more than nine screenfuls down. A reviewer could
never see the page and the instruments judging it at the same time, which was
sharpest on **Page checks** — a panel that scores _the page currently open in
the mockup_ and rendered that score nine screens away from it.

Most of the redundancy this tool accumulated followed from that one placement:
the same fact had to be repeated wherever the reviewer might be looking.
Co-visibility is what makes a single copy sufficient, so resist re-adding a
second printing of anything.

- **`.app.workspace-docked` is what grows the third column**, toggled alongside
  the panel's `hidden` attribute. `applyWorkspaceVisibility()` in
  `js/ux-improvements-workspace.js` is the single place that does both, plus the
  toggle button's label and `aria-expanded`. The first-run onboarding path used
  to set `hidden` inline and duplicate two of the three steps — which is exactly
  how it came to miss the third, giving a first-run reviewer an open panel the
  grid had made no room for.
- **`.review-workspace[hidden] { display: none }` is load-bearing.** The rule
  above it sets `display: flex`, and a class selector outranks the UA
  stylesheet's `[hidden] { display: none }`, which is where that attribute's
  entire effect lives. Without the pairing, "Hide workspace" and the `w`
  shortcut both appeared to do nothing. Any element that both carries `hidden`
  and declares its own `display` needs this.
- **Below 1700px the panel returns under the canvas, in `grid-column: 2`** —
  deliberately not `1 / -1`. Spanning both columns puts it beneath the sticky,
  full-height sidebar, which then slides over the queue's left edge as the
  reviewer scrolls. Axe caught that before a human did (57 queue cells reported
  as "background could not be determined, partially obscured by another
  element"); it is invisible in a screenshot taken at scroll position 0.
- **The breakpoint is 1700px because that is where three columns actually
  fit**, and it was 1400px for a while, which is not. `.browser-shell` carries
  `flex-shrink: 0` and bottoms out near 780px wide, so it ends around x=1170
  however narrow its column gets, while the panel starts at `100vw - 30vw`.
  Those cross at ~1671px: every width from 1401px to there docked the panel
  _on top of_ the mockup — 162px of overlap at 1440, 100px at 1536, 50px at 1600. Do not lower it again without re-measuring both numbers. The cost is
  that a 14-inch laptop (1512 CSS px) now stacks rather than docks; squeezing
  the mockup instead is the other way out and is rejected on purpose, since it
  would misrepresent the page under review.
- **Any new layout assertion should sweep a range of widths, not pick one.**
  The overlap survived because the only two widths under test sat either side
  of it: `workspace-panels.spec.js` set 1800 to prove docking, and every other
  spec ran at Playwright's 1280 default. The assertion added for it samples
  1280→1920 in 40px steps for that reason.

### What the UX review removed, and why not to re-add it

- **The Karl-tag legend above the mockup.** A toggle, a four-row `TAG COLORS`
  key, an explanatory sentence and a "What are Karl tags?" disclosure occupied
  ~495px — half a screen — between the toolbar and the SF.gov header, on every
  page and every load. The key decoded something that was never encoded in
  colour alone: each tag already reads `METADATA`, `BODY`, `PLACEMENT` or
  `EDITOR ONLY` in words. The switch moved into `.canvas-toolbar`; the legend
  renders once, in Help, via `renderKarlTagLegend()`. `mountKarlTagLegend()` is
  gone with both of its mount points — `#karlTagLegendCompact` had no element in
  `index.html` at all and had been a no-op for some time.
- **Three of four Overview KPI tiles.** "Visible" restated the "N of 19" printed
  directly above it. "Blocked" showed `stats.blocked`, which counts Blocked
  **plus** Revise and resubmit (`js/review-queue-rows.js`) — so it read 5 while
  the Blocked filter chip forty pixels away read 2. Both numbers were correct
  and the label was not, and a panel that visibly disagrees with itself in its
  first two rows spends the credibility the rest of it needs. The decision tally
  belongs to the filter chips, which count and filter with one control.
- **The open page's name, printed four times.** The sidebar picker, a "Current
  page:" label directly under it, a "Viewing: …" badge in the toolbar, and the
  sticky bar. The middle two are gone — and with the label went the only reason
  `js/manager-review-export.js` wrapped `renderPage` at all, so that decorator
  went with it.
- **The decision `<select>`.** It sat directly above five chips writing the same
  field: two controls, one value. `#reviewDecision` survives as an
  `<input type="hidden">` rather than being deleted, because it is the field
  every persistence path reads and writes through `getValue`/`setValue`, and its
  `change` event is what autosave, `isDecisionRound()` and the sticky bar all
  listen for. The chips carry the visible and accessible semantics. E2E specs
  set it through `setDecision()` in `tests/e2e/helpers.js`, not `selectOption`.
- **Six of nine export/import controls.** Five ways to get review data out, in
  two formats, split across the sidebar and the Overview panel, with nothing on
  screen distinguishing "Export current review JSON" from "Download backup
  (JSON)" from "Export saved local reviews CSV". There is now one **Export
  reviews** button with a scope `<select>` (`runExport()` dispatches on it) and
  one **Import reviews** button whose file input accepts either format
  (`importReviewFile()` routes by extension). The queue's separate "Import CSV"
  button is gone. Fewer doors into the merge path is a safety property here, not
  just tidiness — see "Local persistence" below for the regression that makes
  this the highest-consequence surface in the tool.

### Checks that cannot fail are not scored

`getRuleResultsFor()` marks **Page type**, **Audience** and **Reading target**
with `scored: false`. All three are required by `build_scripts/schema.js` and
enforced by `bun run validate` in CI, so no page that can ship will ever fail
them: scoring them handed every page three free passes, lifting every ratio by a
constant and burying the rules that do fail under a wall of permanent green.
(Note that **Reading target** only checks that a target is _declared_ — whether
the copy hits it is `Computed reading level`, which is scored and does fail.)

`window.reviewChecks.scoredRules()` is the filter, and both the Checks panel and
the queue's `checksPassed`/`checksTotal` go through it. The three still render,
under a "Page facts" subheading, and the scored list orders **failures first** —
it used to render in declaration order, so on a page passing all but one rule a
reviewer scanned a column of green to find the single item they could act on.

### Content-standards scoring

`js/plain-language.js` scores page copy against written standards, not
preferences. Each check carries `severity` plus a `source`/`section` pair and
a ready-to-render `citation`:

- **`severity: 'error'`** are the standards manual's mandates. They join the
  scored rule list behind the Overview tab's "checks passed" ratio, and their
  citation renders on the Checks tab alongside the rule.
- **`severity: 'warning'`** are advisory, run to ~115 across the 21 pages, and
  render separately — folding them into the ratio would make every page look
  broken.
- A scored rule must always be **pushed**, passing or failing, never omitted
  when it can't be computed: dropping one shrinks the denominator and quietly
  flatters exactly the thinnest pages.
- `source` exists because not every rule comes from the manual. Two
  (`house-style`, `list-length`) cite the vendored `docs/source/sfgov-style/`
  snapshot, and `button-length` cites manual §6.3 (the Karl Button component),
  not §7.8. Requiring a bare §7.x number is what previously pushed all three
  into miscitations.

Like `js/review-merge.js` it is **dual-export** (`window.plainLanguage` plus
`module.exports`, no DOM dependency) so the AI output validator and the tests
run the same implementation the Checks panel does.

### URL schemes are validated, not just escaped

`escapeHtml` does not neutralize a scheme — `javascript:alert(1)` contains
none of the five characters it escapes — so every structured `href` in
`js/page-render.js` goes through `safeUrl()` from `js/utils.js`, **except
`formatMarkdown()`'s inline `[label](target)` links** (`js/page-render.js:51`),
which gate on a bare `/^https?:\/\//` instead. Not a hole today: `escapeHtml`
runs over the whole string first so the attribute cannot be broken out of, and
the regex admits only `http(s)`, which `safeUrl` allows anyway. `safeUrl`
allows
`http`/`https`/`mailto`/`tel` **and anything without a scheme at all** —
root-relative (`/forms/…`), document-relative (`help/foo`, `../help`), and bare
fragment or query targets (`#top`, `?q=1`) all pass through unchanged. It is a
_scheme_ guard, not a URL allowlist: what it rewrites to the inert `#` is a
recognized-but-unsafe scheme (`javascript:`, `data:`, `vbscript:`) and
protocol-relative `//host`, which reads as relative but leaves the origin. It
strips control characters before testing, since browsers resolve
`java\tscript:` as `javascript:`.

Two normalization details matter, because `findUnsafeUrls()` decides by
comparing `safeUrl(value)` against the original. Control characters are removed
only from the string being _tested_, so an accepted URL keeps them — but
leading and trailing whitespace is trimmed from the **returned** value. **A
whitespace-padded but otherwise safe URL is therefore reported as an "unsafe
URL scheme"**, which is a false positive rather than intended behaviour: the
check is about schemes, not whitespace hygiene. No page carries a padded URL
today, so nothing is currently broken. `findUnsafeUrls()` in `build_scripts/data-checks.js` enforces the
same rule at validation time — in `bun run validate` **and** in the AI output
validator — and imports `safeUrl` rather than restating it, so the renderer
and the validator cannot come to disagree about what is safe. That import
crosses the CJS/ESM boundary. **CI never exercises that crossing under Node** —
every path that loads `data-checks.js` runs under Bun (`bun run validate`, and
`build:netlify`, which invokes `bun build_scripts/validate.js`). CI _does_ run
Node, at the end of `build:netlify` (`node build_scripts/copy-workshop-form.js`),
but that script never touches `data-checks.js`, so the `require(esm)` path is
_not_ covered. (That path
needs `require(esm)` enabled — check `process.features.require_module` rather
than trusting a version number; it is opt-out by default on current Node 22 but
was flag-gated in early 22.x.) Anything
relying on Node-specific interop here would go unnoticed.

### Overview insight cards (`js/review-insights*.js`)

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

- **`js/review-insights-data.js`** — pure data shaping (`buildDecisionMix`,
  `buildActivitySeries`, `buildChecksSeries`, `insightsSignature`), dual
  `window`/`module.exports` like `js/review-merge.js` so
  `tests/review-insights-data.test.js` can `require` it with no browser.
  `buildDecisionMix` still runs: `insightsSignature()` uses it to gate redraws,
  since a decision change moves the activity series.
- **`js/review-insights.js`** — the orchestrator. Builds the card markup, the
  hidden data table and the ranked list, then draws.
- **`js/review-insights-charts.js`** — the only module that imports ECharts.

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
devtools. There are no roles in this tool: the reviewer and the operator are
the same person, deliberately.

- **`js/review-ops-data.js`** — pure diagnostics (`findOrphanedRecords`,
  `groupBySyncState`, `findRecordsWithoutHistory`, `measureStorage`), dual
  `window`/`module.exports` so the tests need no browser.
- **`js/review-ops.js`** — the panel, lazily mounted when Help opens with the
  same `mountWorkspacePanelIfOpen()` catch-up the AI assist panel uses.

**It had a tab of its own — the `5` key — and lost it.** On a default or
Netlify deploy every value it reported was "not configured" or "none", because
both optional backends need `server.ts`; that is not worth one of the strip's
slots. The one line a reviewer genuinely needs from it — _reviews are saved in
this browser only_ — was promoted into the sidebar beside the export controls,
where the risk it describes actually lives. What stays here is the diagnostics
and the orphan pruning, which a reviewer opens deliberately.

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
has coverage independent of whatever `pages/*.js` currently contains).

A page carries `slug`, `type` (a free-form string — only `min(1)` is checked,
not an enum; values in use across `pages/*.js` are `Agency`, `Transaction`,
`Information`, `Resource Collection`, `Campaign`, and `Report`, matching
Karl's real content-type names — see `docs/wagtail-content-mapping.md`),
`title`, `summary`, `audience[]` (non-empty), `reading` (grade-level string),
and `sections[]`. Optional page-level fields: `seoTitle`, `metaDescription`,
`primaryCta`, `editorNote`, `topicTag`, `whatToKnow` (`cost`,
`thingsToKnow[]`, `items[]`), `contact` (`address`, `phone[]`, `email[]`,
`hours`, `other[]`), `spotlight`, `reportDate`, `printVersionUrl`, and
`editorStatus` (`needs-review` | `blocked` | `placeholder`). For Karl editor
field mapping by content type, see
`docs/source/hhvc-policy/karl-content-type-field-reference.md`.

Sections carry a required `heading` and `karl`, plus optional `kind`,
`component` (an enum: `body`, `services`, `resources`, `related`, `contact`,
`spotlight`, `what-to-do`, `supporting`, `intro`), `open` (Transaction
supporting sections render as accordions; `open: true` renders one expanded on
load), `cards[]`, `bullets[]`, `paragraphs[]`, `table[][]`, `image`, a
`callout` (`text` plus optional `title`/`variant` of `info`/`warning`/`note`),
a `button`/`buttonUrl`/`buttonTarget`/`buttonStyle`, and/or `steps[]`. Steps
carry `title`, `text[]`, `bullets[]`, `callout`, `karl`, and
`button`/`buttonTarget`/`buttonUrl` (the primary CTA).

Text-bearing arrays (`paragraphs`, `bullets`, step `text`/`bullets`) accept
either a plain string or an object `{ text, unverified?, unverifiedReason? }`.
`unverified: true` flags a claim needing SME confirmation; `js/page-render.js`
renders it as an "Unverified" pill (with `unverifiedReason` as the tooltip),
and `validate.js` prints the total count in its summary line. Cards support
the same two fields.

Beyond schema shape, `validate.js` enforces business invariants:

- The `pestsTopic` key must exist and must be **first** in `order`. This is now
  the HHVC **Agency page** ("Healthy Housing and Vector Control") — the key
  name is retained from the Topic-page era for invariant/test/review-state
  stability (`validate.js` only checks the key and ordering, not its `type`
  or content).
- The bare `agency` key must **not** be present (nobody should "fix" the key
  name and break that stability).
- Every page key must appear in `order` (`findMissingOrderKeys`).
- Every `card.target` **and** every section/step `buttonTarget` must resolve to
  a real page key (`findBrokenCardTargets`, `findBrokenButtonTargets`), and
  every inline markdown link `[label](pageKey)` in paragraphs/bullets/table
  cells/callouts/step text must resolve to a real page key, an `http(s)` URL,
  or the inert `#` sentinel (`findBrokenInlineLinks`).
- The Agency page's content must not contain banned out-of-scope terms
  (`plumbing`, `dbi`, `roof leak`, `sewer`, `permit issue`,
  `construction defect`) — HHVC scope is Article 11 only.
- **Lists of three or more items must use `bullets[]`**, not `paragraphs[]` or
  step `text[]` (`findListFormatViolations`). A section with 3+ paragraphs, or
  a step with 3+ text items, is a hard validation failure.
- **No image may be loaded from another host** (`findExternalAssetUrls`) —
  absolute `http(s)` or protocol-relative `image.src`, on a section or on the
  spotlight, fails validation. The tool's central claim is that it works fully
  offline, and for a long time that was false because of one hotlinked
  `images.unsplash.com` URL on the Agency page. It hid well precisely because
  it _worked_: on a connected machine the page looked right, and the only
  symptoms showed up elsewhere — an air-gapped review with a broken image, and
  that page's PNG export quietly depending on a third-party host.
  **`data:` is allowed here, which is deliberately the opposite of
  `findUnsafeUrls`'s rule.** There a `data:` value is rejected because it
  becomes a navigation target, where a data URL is a phishing vector; here it
  becomes an `<img src>`, which renders bytes rather than navigating, and
  self-contained is exactly the property wanted. The Agency spotlight
  photo is an inline WebP data URI for that reason, and it has to be one
  rather than a file under `public/`: it must survive
  `vite build --mode singlefile`, whose output is a single HTML file meant to
  be emailed and double-clicked, where a relative path would 404. WebP rather
  than the source JPEG, at the lowest quality with no visible cost — the
  string ships inside the bundle, so compare crops at 1:1 on the busiest
  region and pick from that rather than defaulting to a high number. The
  current photo (a row of SF apartment buildings, all window mullions and
  ironwork) is indistinguishable at q78, q70 and q64, so it ships at **q70,
  48 KB**. **Size is subject-dependent, not a fixed budget**: compared at the
  same q78, this photo is 57 KB where the model-house photo that preceded it
  was 17 KB. Quote the quality alongside any size here — the two numbers are
  meaningless apart.
  **`findBannedTerms` skips `src` for a related reason.** It asks an editorial
  question ("does this page discuss plumbing, DBI, sewers?") by substring-
  matching the serialized page, and base64 is an arbitrary run of letters: the
  inlined photo contains the sequence `dbi` and failed validation on a page
  whose copy never mentions DBI.
  **It tests the browser-normalized string, via the `urlProbe()` helper it
  shares with `safeUrl`.** Matching the raw value on `/^(https?:)?\/\//` is not
  enough: `\\cdn.example.com/a.jpg`, `\/cdn…`, `/\cdn…` and `https:<TAB>//cdn…`
  all pass that test and all still fetch off-origin — confirmed in Chromium
  against a live `<img>`, not inferred from the URL spec. The two guards ask
  different questions (scheme vs. host) but must agree on what a browser will
  actually do with the string, which is why the normalization lives in one
  place rather than being restated in each.

All of these live in `build_scripts/data-checks.js` as pure functions, so they
can be unit-tested without the real page data.

**`karl` fields are first-class content, not comments** — every card, step,
section, and callout can carry a `karl` string: a precise, CMS-technical
placement/rationale note mapping mockup content onto real Karl StreamField
blocks, surfaced to reviewers via `karlTag()` in `js/page-render.js`. They
routinely embed open questions/flags for the client team and cite governance
docs by section number. Keep them accurate when editing page copy. Page copy
itself is plain-language, ~Grade 6, tenant-facing, empathetic civic writing.

### Local persistence (browser-first; optional server sync layered on top)

All reviewer state (decisions, notes, edited SEO fields, workspace UI prefs)
is saved client-side under the versioned `localStorage` key
`hhvcManagerReviewState:v1`. Bump the version suffix if the persisted shape
changes incompatibly. Workspace UI prefs (`workspace_open`, `workspace_tab`,
`last_page_key`, `show_karl_tags`) live under `state.ui` in the same blob.
This localStorage layer is the tool's synchronous, always-available core —
`window.reviewState.read()/write()/update()` — and stays that way regardless
of whether the optional sync backend below is ever configured.

Each page's review record also carries an append-only `history[]` array
(added alongside the sync backend): `{ timestamp, reviewer, decision, notes,
risks_or_blockers, updated_by }` entries recording each review "round." A
history entry is constructed in exactly one place — `mergeReviewRecord()` in
`js/review-merge.js` — and only at discrete round-boundary events: queue bulk
actions/keyboard shortcuts (`updateLocalReviewForPage` in
`js/review-queue-state.js`), CSV/JSON backup import (`importReviewStateBackup`
in `js/ux-improvements-export.js`), server sync (`server.ts`'s
`putReviewPage`), and a **decision change made from the sidebar** (the
`<select>` or a quick-action chip). The continuous per-keystroke/blur autosave
(`saveCurrentPageToLocalStorage` in `js/ux-improvements-state-sync.js`)
deliberately does **not** go through `mergeReviewRecord` and does **not**
append a history entry — it just keeps the working snapshot fresh, carrying
the existing `history` array forward untouched. Routing autosave through the
merge/history path would flood `history` with one entry per debounced
keystroke.

The sidebar decision is the one exception that shares the autosave path
(both persist through the same field listeners in `js/ux-improvements.js`),
so `saveCurrentPageToLocalStorage` singles it out via `isDecisionRound()`:
one entry when the decision actually _transitions_, never per keystroke.
A brand-new record only counts when the reviewer moved off the default
`Needs review`, or typing the first character of a note on an untouched
page would record a round for every page in the site. Queue actions append
their own entry before dispatching their sidebar-sync events, so by the
time autosave runs the decision already matches and nothing double-records.

**The CSV/JSON import path can destroy existing reviews** — a prior
regression there replaced the saved state wholesale instead of merging. The
round-trip logic lives in `js/review-queue-import.js` (CSV) and
`js/ux-improvements-export.js`'s `importReviewStateBackup` (JSON backup);
both merge through the same `mergeReviewRecord` per-page-key path the sync
backend uses, while `js/review-queue.js` wires the handlers and
`js/manager-review-export.js` exports current-page snapshots. **Any change to
any of these modules, or to `js/review-merge.js`, must be manually verified
before being called done:** export a snapshot, re-import it, and confirm
existing decisions/notes are still present rather than wiped.
**`tests/e2e/import-export.spec.js` is the only automated coverage, and there
is no API-level or unit layer beneath it.** It drives both directions through
the real UI (export button clicks, file-input imports) and asserts
`history.at(-1).updated_by === 'import'`, which is what proves merge rather
than wipe. `review-import-export.spec.js` used to be described here as the
API-level half; it was deleted because it never was one — it hand-rolled the
merge inside `page.evaluate` instead of calling `importReviewStateBackup()`,
so it stayed green against the wholesale replace that destroyed reviews once
already.

Nothing can unit-test this path today: both modules are browser-only, with no
`module.exports` to import from Bun. **That gap is why the manual check above
is mandatory rather than advisory** — on this one path, a green CI run is not
evidence the round-trip still merges.

### Optional API access hardening

`server.ts`'s optional `/api/*` routes have one shared, server-side access
control layer. It protects the review-state and AI APIs without changing the
offline static tool.

- **Legacy compatibility and opt-in principals:** an unset
  `REVIEW_API_TOKEN` _and_ unset `REVIEW_API_PRINCIPALS` still yields 501 —
  the API is not accidentally open. Setting only `REVIEW_API_TOKEN` remains
  supported and creates one broad legacy principal with every role. For
  least-privilege deployments, set `REVIEW_API_PRINCIPALS` to a JSON array
  such as
  `[{"principal":"reviewer-a","token":"replace-with-a-secret","roles":["review:read"]}]`.
  Each entry has exactly `principal` (letters, digits, `.`, `_`, `-`),
  `token` (one non-whitespace bearer token), and nonempty `roles`; principal
  names and tokens must be unique. The allowed roles are `review:read`,
  `review:write`, and `ai:generate`.
- **No ambiguous fallback:** a present `REVIEW_API_PRINCIPALS` replaces the
  legacy token completely. Empty, malformed, oversized, duplicate, unknown,
  or invalid-role configuration fails closed with 503; it never falls back to
  `REVIEW_API_TOKEN`. Keep both token values out of source control and logs.
  `review:read` gates `GET /api/review-state`, `review:write` gates its PUT,
  and `ai:generate` gates all AI discovery/model/generation routes.
- **Origins:** no cross-origin browser origin is allowed by default and no API
  response sends `Access-Control-Allow-Origin: *`. Same-origin requests work
  normally. To authorize a separate trusted browser app, set
  `REVIEW_API_ALLOWED_ORIGINS` to a comma-separated list of exact serialized
  HTTP(S) origins, for example
  `https://review.example.gov,https://manager.example.gov`; no wildcards,
  paths, credentials, or `null` origins. Invalid origin configuration fails
  closed with 503. Allowed preflights do not authenticate or grant a role; the
  following request still does both.
- **Process-local rate limit:** authenticated requests use a fixed window per
  configured principal and role bucket. `REVIEW_API_RATE_LIMIT` defaults to
  120 requests and `REVIEW_API_RATE_WINDOW_MS` to 60000 (valid ranges are
  1–10000 and 1000–3600000 respectively); invalid numeric values warn and use
  those safe defaults. The in-memory map is bounded by the maximum configured
  principals and three roles, and 429 responses carry `Retry-After`.
- **Production boundary:** this limiter and bearer-token lookup are
  intentionally per-process. A public or multi-instance deployment **must**
  additionally enforce identity, origin policy, and shared rate limits at a
  reverse proxy or identity-aware edge; do not treat a process-local counter
  as coordinated abuse protection. API responses, including authorization,
  CORS, configuration, and rate-limit errors, retain the server's security
  headers and are `no-store`.

### Review-state sync backend (optional)

`server.ts` optionally hosts a small sync API on top of its static file
serving, backed by SQLite (`bun:sqlite`, no extra dependency). It is
**entirely additive and off by default** — nothing else in the tool depends
on it, and it fails closed (501, not open access) if unconfigured.

- **Routes**: `GET /api/review-state` returns the full `{version, updated_at,
ui, globals, pages}` state (same shape `window.reviewState.read()`
  produces). `PUT /api/review-state/pages/:pageKey` accepts one page's patch,
  merges it server-side via the shared `mergeReviewRecord()`
  (`js/review-merge.js`, imported directly by `server.ts` — the same file a
  `<script>` tag loads in the browser, no DOM dependency either side) and
  returns the merged record. Writes are always scoped to one `page_key` at a
  time — the server never wholesale-replaces the `review_pages` table — the
  server-side half of the same "merge, never wipe" invariant the CSV/JSON
  import path relies on. The PUT body is capped at `MAX_REVIEW_BODY_BYTES`
  (1 MB) through the same streaming `readBodyWithLimit()` the AI routes use.
  The check sits **in front of** the parse, so an oversized body never reaches
  `mergeReviewRecord` and a rejected write is never a partial one.
  **The cap is deliberately larger than the AI one**, even though a review
  record is typically far smaller: `history[]` is append-only and the client
  pushes the whole record, so this bounds a page's entire review life rather
  than one edit. Set too low it becomes a permanent sync lockout — once a
  record crosses it every push fails, and shortening the current note cannot
  remove historical copies. 64 KB was measured at roughly 70 recorded rounds
  with long notes, which a real review cycle can reach.
- **Auth**: see [Optional API access hardening](#optional-api-access-hardening).
  The legacy token remains broad for compatibility; production deployments
  should use per-token principals and grant only `review:read`/`review:write`
  to sync reviewers.
- **Storage**: SQLite table `review_pages (page_key TEXT PRIMARY KEY, record
TEXT, updated_at TEXT)` at `DATA_DB_PATH` (defaults to
  `.data/review-state.local.db`, gitignored, for local dev; point it at a
  mounted persistent volume in production — see Deployment below).
- **Client**: `js/review-state-sync.js` is a no-op unless a sync URL/token is
  configured. Its settings (`syncApiUrl`/`syncApiToken`) live under their own
  `hhvcReviewSyncConfig` localStorage key, **deliberately separate from**
  `hhvcManagerReviewState:v1` — the token must never round-trip through the
  CSV/JSON export/import/backup paths, which are meant to be shareable
  files. Sync is manual-trigger only (Pull from server / Push all pages
  buttons, mounted by `mountSyncControls()`), not a background timer — this
  keeps sync-triggered history entries bounded to explicit actions instead
  of firing on every debounced keystroke.
- **Pull vs push semantics differ on purpose**: push sends one page's full
  local record and treats the server's merged response as authoritative for
  that page (the server already did the field-level merge). Pull is
  last-write-wins **per page** and never does a field-level merge on the
  client side — the server's `history` array is already merged (re-merging
  it client-side would duplicate entries), and treating a full local
  snapshot as a "patch" onto the server's record would let this browser's
  stale copies of fields another reviewer changed silently overwrite them.
- **Never compare a browser-clock timestamp against a server-clock one.**
  `pullFromServer` decides each page from two clock-independent facts:
  whether the server holds a revision this browser hasn't observed
  (`serverRecord.updated_at > localRecord.synced_at` — _both_ server-issued,
  since `synced_at` is only ever assigned from a sync response), and whether
  this browser holds unpushed work (the explicit boolean `local_dirty`).
  `updated_at` on a local record is written by the browser's own clock, so
  it must never take part in a sync decision: on a browser running behind
  the server, a genuine unsynced edit looks older than an untouched server
  record and used to be silently overwritten by it. `local_dirty` is set by
  the local write paths (autosave only when content actually changed, per
  `reviewContentEquals`; every `mergeReviewRecord` call except the server's
  own `updatedBy: 'sync'`) and cleared only by an actual push/pull. It's a
  real boolean — note the explicit branch for it in
  `js/review-state-validation.js`, since the generic `String()` coercion
  there would turn `false` into the truthy string `'false'`. Only an
  **explicit `false`** counts as clean: records written before the field
  existed don't carry it (the storage version was deliberately not bumped,
  since the field is additive), and reading "missing" as "clean" would let
  the first pull after an upgrade overwrite reviews that were never pushed.
  That absence must also _survive_ — `nextLocalDirty()` in
  `js/ux-improvements-state-sync.js` returns `undefined` for an unchanged
  legacy record rather than collapsing it to a boolean, because an autosave
  with content equal to what's stored (typing and undoing, or a navigation
  flush) would otherwise stamp an explicit `false` and hand the pull path
  exactly the permission the rule above withholds.
- **A divergence is surfaced, never guessed.** A new server revision _and_
  unpushed local edits means neither side has seen the other's work.
  `pullFromServer` leaves the record completely untouched (notably without
  advancing `synced_at`, which would let the next push sail through
  `server.ts`'s staleness check) and returns the page key in `conflicts`
  plus the server's copy in `conflictRecords`.
  `resolveConflict(pageKey, 'server'|'local', serverRecord)` is the only way
  out, one page at a time: `'server'` adopts the server copy and clears
  `local_dirty`; `'local'` keeps local content but records the server's
  revision as observed, so the next push stops being rejected. The sync
  controls render a button pair per conflicted page. A resolution is bound
  to the endpoint that produced it (`pullFromServer` returns `apiUrl`;
  `resolveConflict` refuses a mismatch, and saving new settings clears the
  panel) — otherwise a stale row could import a different deployment's
  content, and its `'local'` branch would re-mint the very `synced_at`
  baseline `writeConfig` had just cleared.
- **A resolution is bound to the _divergence_ as well as the endpoint.** A
  row asserts "the server holds a revision this browser hasn't observed",
  and that can stop being true underneath it: a push whose PUT reaches the
  server before an overlapping pull's GET, but whose response lands after
  it, makes the pull report a conflict against this browser's **own**
  content and then quietly reconciles the record. `resolveConflict`
  therefore refuses when `serverRecord.updated_at <= localRecord.synced_at`
  — both server-issued, so the no-cross-clock rule holds — since acting on
  such a row would adopt a revision the page has already moved past,
  discarding anything edited since the push. It can't misfire on a real
  conflict: `pullFromServer` only reports one when the server revision is
  _newer_ than `synced_at`, and deliberately leaves `synced_at` alone for
  conflicted pages. `pruneReconciledConflicts()` (run after a push settles)
  and the mutually-disabled Push/Pull buttons are UI hygiene on top of
  this, not the mechanism — both calls can be made programmatically.
- **The endpoint binding starts at _request_ time, not response time.**
  `pullFromServer` and `pushPage` each capture `readConfig().apiUrl` before
  calling `apiFetch` and re-check it via `assertEndpointUnchanged()` before
  touching state; a response that outlived its configuration is rejected
  outright rather than applied. Capturing it in the `.then()` instead is
  the bug, not a simplification: a pull from server X landing after the
  reviewer saved server Y would be labelled `Y`, sail through
  `resolveConflict`'s guard, and write X's revision into `synced_at` under
  Y — the exact hole the guard exists to close.
- Switching the configured sync server URL (`writeConfig`) clears every
  local page's `synced_at` **and deletes its `local_dirty` flag**, since
  both are only meaningful relative to the deployment that issued them. A
  baseline is obvious; the dirty flag is the same thing in disguise —
  `local_dirty: false` asserts "matches what the server has", and that
  judgement was made against the _old_ server. Carrying it over lets the
  first pull from the new server see a new revision plus an explicitly
  clean record and replace the local decision/notes wholesale, losing a
  review on a server this browser never synced with. It's `delete`d rather
  than forced to `true` because absent is the honest state (unknown
  provenance) and is already the value `pullFromServer` treats as
  possibly-unpushed. The comparison has **no "both non-empty" guard on
  purpose** — clearing the settings and then pointing at a different server
  is two transitions (`X` → `''` → `Y`), and requiring both sides to be
  non-empty would skip the clear on both, carrying `X`'s baselines all the
  way to `Y`.
- **A superseded pull must not drive the conflict UI.** Two Pull clicks put
  two GETs in flight with no ordering guarantee, and
  `assertEndpointUnchanged` can't help — both go to the _same_ endpoint. A
  module-level generation counter stamps each `pullFromServer()` call and
  the result carries `stale: true` if a later pull started while it was in
  flight. Applying either response's _state_ is fine (last-write-wins per
  page either way); the conflict panel is not, since an older response
  reporting no conflicts would erase resolution controls a newer one
  correctly populated, stranding a page that is still dirty and still
  diverged. The guard lives in `pullFromServer` rather than the click
  handler so it's unit-testable and any future caller inherits it; the
  button is also disabled for the duration, as feedback and to make the
  race harder to reach at all.
- **Deployment (e.g. Railway)**: run `server.ts` (`bun run start`) with a
  persistent volume mounted, `DATA_DB_PATH` pointed at that volume, and
  either a generated `REVIEW_API_TOKEN` or the documented
  `REVIEW_API_PRINCIPALS` secret configuration — none of this is committed.
  Apply the reverse-proxy/identity-aware edge control described above for
  public or replicated deployments. Local `bun run dev`/`bun run start` keep
  working fully offline with sync simply disabled when unconfigured; Netlify's
  static-only deploy (`build:netlify`) has no server runtime for these routes
  and stays a read-only/no-sync deployment target.
- **Tests**: `tests/review-merge.test.js` (unit tests for
  `mergeReviewRecord`), `tests/review-state-sync.test.js` (the client
  pull/push/conflict logic), and `tests/review-api-server.test.js` (spawns
  `server.ts` as a subprocess with a temp SQLite DB and exercises auth,
  merge-not-wipe, and per-page isolation over real HTTP).

### AI assist backend (optional)

`server.ts` also hosts an optional content-drafting API under `/api/ai/*`,
backed by `build_scripts/ai/`. Same posture as the sync backend above:
**entirely additive and off by default**, nothing else in the tool depends on
it, and it fails closed rather than open.

- **Two independent gates.** The shared optional API authorization
  configuration described above (legacy `REVIEW_API_TOKEN` or
  `REVIEW_API_PRINCIPALS`) decides whether the API exists; no configuration
  makes every actual `/api/ai/*` route 501. A CORS `OPTIONS` preflight remains
  unauthenticated because browsers cannot attach the bearer header to it, but
  it must pass the exact-origin policy and grants no role. `ai:generate` is
  required for every AI route. `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` decides
  whether generation is possible; unset makes `generate` and `models` 501
  while `capabilities` still answers. That asymmetry is deliberate:
  `capabilities` is the discovery endpoint the browser uses for its empty
  state, and a 501 there cannot be told apart from "no server at all".
- **The provider gate is checked inside each route, not before routing.**
  Hoisting it would make every unmatched path answer 501 "no provider
  configured" instead of 404 — telling a client a route exists when it does not.
  The condition is "no provider **at all**", read from the registry per request
  rather than from a start-time constant: a deployment holding only a Gemini key
  is fully working.
- **Two providers, behind a registry.** `build_scripts/ai/providers.js` holds
  `provider-anthropic.js` and `provider-gemini.js` behind one list, and nothing
  in `index.js` or `server.ts` names a provider — a third is a `require` plus a
  line in `REGISTRY`. Every entry exports the same surface: `name`, `label`,
  `isConfigured()`, `getModel()`, `listModelIds()`, `normalizeUsage()`, and
  `generateObject({system, userPrompt, jsonSchema, signal})` resolving to
  `{object, model, usage, rawUsage, stopReason}`. Configuration is read from the
  environment **on every call**, never snapshot at require time: the registry is
  a module singleton `server.ts` imports once at startup, so caching
  `isConfigured()` would freeze whatever the environment looked like during that
  first import — and would still pass every server test, since a spawned
  subprocess only ever sees one environment anyway.
- **Registration order is the preference order.** A request that names no
  provider runs on the first _configured_ one (Claude, then Gemini), reported
  back as the resolved `provider` so a draft is never unattributed. A request
  naming an **unconfigured** provider is a **400** carrying the list of what is
  available — never a silent fallback, because running a Gemini request on
  Claude would attribute one model's output to another in the panel's meta line
  and in the downloaded module. In practice a 400 here means a panel still
  holding a picker built from a different endpoint's capabilities, which the
  client can recover from; "nothing configured at all" stays a 501, because
  then the server genuinely cannot rather than merely lacking what was asked for.
- **Shared error types live in `build_scripts/ai/errors.js`**, not in a provider
  module. `RefusalError` used to be defined in and imported from
  `provider-anthropic.js`, which made `server.ts` reach into an Anthropic module
  for a concept belonging to no provider: both raise it, from entirely different
  signals (Claude's `stop_reason: 'refusal'`; Gemini's
  `promptFeedback.blockReason`, or a `finishReason` of
  `SAFETY`/`PROHIBITED_CONTENT`/`BLOCKLIST`/`SPII`). Normalizing there is what
  keeps `aiErrorResponse`'s 422 mapping a single `instanceof` instead of a
  per-provider branch that rots the day a provider is added and nobody extends
  it. `provider-anthropic.js` re-exports it, since that was the documented
  import site. `UnknownProviderError` lives alongside it and maps to the 400 above.
- **Usage is normalized at the provider boundary** to
  `{inputTokens, outputTokens, totalTokens}`. `addUsage()` sums usage across the
  validation retry field by field, and Anthropic's `input_tokens` against
  Gemini's `promptTokenCount` would sum into something not merely incomplete but
  meaningless — while forcing every consumer to know who answered. Gemini's
  `totalTokenCount` is trusted over `input + output`: thinking tokens are billed
  on top of prompt+candidates, so recomputing understates exactly the
  thinking-heavy requests this feature makes. The provider-native counters ride
  alongside as `usageByAttempt[]` rather than inside the sum, because `addUsage`
  keeps the **first** attempt's value for non-numeric fields — a nested raw
  object folded into the total would claim attempt one's numbers covered every
  attempt.
- **Anthropic's input total is all three counters**, per the API's own
  definition: `input_tokens` **+** `cache_creation_input_tokens` **+**
  `cache_read_input_tokens`, which are reported separately rather than folded
  into the first. That distinction is load-bearing here rather than pedantic:
  `prompts.js` inlines the entire vendored style corpus into the system prompt
  and marks it `cache_control` precisely so it is cached, so on every warm
  request virtually the whole prompt is billed through `cache_read_input_tokens`
  while `input_tokens` is a small remainder. Reading only `input_tokens`
  reported **42** input tokens for a request that actually used **18042** —
  understating usage by most of the prompt on exactly the requests the caching
  was added to make cheap. The creation-vs-read split is not lost; it still
  travels per attempt in `rawUsage`/`usageByAttempt[]`.
- **The `provider` enum is derived from the registry, never written out.**
  `build_scripts/ai/schemas.js` builds it from `allProviderNames()` rather than
  listing names. `providers.js` promises that adding a provider is "a require
  plus a line in `REGISTRY`; nothing downstream of here mentions a provider by
  name" — and a second hardcoded list breaks that quietly: `capabilities` would
  advertise the new provider and the browser's picker would send its name, but
  this schema would reject the request as malformed before `resolveProvider`
  ever ran. The symptom would look like a client bug rather than a missed
  registration. Safe to import: no provider module requires `schemas.js` back,
  so there is no cycle.
- **Routes**: `GET /api/ai/capabilities` (per-provider `providers`, `models`,
  `providerLabels` and `defaultProvider`, plus grounding files and page count),
  `GET /api/ai/models` (queried live, since model lineups move and a hardcoded
  id becomes a 404 nobody notices), and `POST /api/ai/generate`
  (`{task, prompt, page?, provider?}`, Zod-validated). `capabilities` reports
  every **registered** provider including the unconfigured ones (`false`/`null`),
  so the panel can say "this server has no Gemini key" as distinct from "Gemini
  does not exist here" — those want different copy. `models` is settled per
  provider rather than awaited together, so one bad key does not blank the
  other's list on the very endpoint a reviewer uses to find a working model id.
- **Env**: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (default `claude-opus-5`),
  `AI_EFFORT` (default `high`), and `ANTHROPIC_BASE_URL` (only used to point the
  test suite at a stub); `GEMINI_API_KEY`, `GEMINI_MODEL` (default
  `gemini-2.5-pro`), `GEMINI_MAX_ATTEMPTS` (default 2), `GEMINI_TIMEOUT_MS`
  (default 150s), and `GEMINI_BASE_URL` (test stub only). Put them in
  `.env.local`, which is gitignored and must stay that way.
- **Gemini specifics a naive port gets wrong.** Use `responseJsonSchema`, **not**
  `responseSchema`: the latter takes a narrow OpenAPI 3.0 subset, and the wider
  one is what lets `PAGE_OUTPUT_SCHEMA` be shared byte-for-byte with the Claude
  path rather than forked into a second copy `tests/ai-assist-schema.test.js`
  would then have to guard twice. Check `promptFeedback.blockReason` **and**
  `candidates[0].finishReason` — the first is set when the _input_ was blocked
  and no candidate exists at all, so checking only the second makes every
  prompt-level block surface as the generic "returned no text content" and read
  to a reviewer as an outage rather than a refusal. Both are checked **before**
  touching content, for the same reason the Claude path checks `stop_reason`
  first: on a block the candidate carries no parts, and reaching for the text
  throws a confusing `TypeError` over the real cause. `finishMessage` looks like
  the refusal explanation and is empty on every request this tool makes — it is
  Vertex-only and the SDK's response converter drops it on the Gemini Developer
  API path (verified against a stub, not assumed) — so the explanation is built
  from the **blocked** `safetyRatings` entries, which do survive and name the
  category that actually stopped it. `httpOptions.retryOptions.attempts`
  defaults to **5** and is pinned to 2: it composes exactly as badly as the
  Anthropic SDK default did, since two validation attempts times five retries is
  up to ten upstream calls for one click on a provider already failing. Note the
  off-by-one — Google counts the original request in `attempts`, Anthropic's
  `maxRetries` does not. There is no `cache_control` equivalent and `prompts.js`
  needs no change: Gemini caches implicitly on a prefix match, which is precisely
  what that file's byte-stability rule already guarantees; there is simply no
  breakpoint to place. API-key auth against the Gemini Developer API only —
  `@google/genai` also speaks to Vertex AI, but that means service-account
  credentials, a project id, and a region, a different credential story than the
  single `GEMINI_API_KEY` the rest of this feature's env handling assumes.
- **Every input is bounded, and the bound is enforced while reading.** `prompt`
  caps at 8000 characters, but `page` is serialized into the provider prompt
  just the same — so it carries its own limits (96 KB serialized, 12 levels
  deep). The body itself goes through `readBodyWithLimit()`, which streams
  `req.body` and stops at the first byte past 128 KB. `await req.text()` is the
  wrong tool: it buffers the whole payload before anything can measure it, so a
  chunked request (or one that simply lies in Content-Length) allocates
  whatever it likes and a 413 afterwards does not give the memory back. The
  Content-Length pre-check stays as a cheap first pass for the honest case. The
  count is in **bytes, not characters** — comparing `String#length` (UTF-16 code
  units) against a byte limit lets multi-byte UTF-8 through at roughly three
  times the cap. Depth is measured iteratively, never recursively: a recursive
  walk over attacker-supplied nesting is itself the denial of service it is
  meant to detect.
- **Past the cap it stops accumulating but keeps draining.** Cancelling the
  request-body reader is the obvious move and it is wrong: the client is still
  sending, so the connection is left framed mid-request and its _next_ request
  is read as garbage — Bun answers that with an empty-bodied protocol-level 400. A real client would see a 413 followed by an inexplicable 400 on a
  perfectly valid follow-up. It first showed up as a flaky unit-test failure in
  whichever test happened to run next. Dropping the accumulated text is what
  actually bounds memory; draining the rest costs only bandwidth the sender is
  transmitting anyway. `DRAIN_LIMIT_MULTIPLIER` (8×) caps even that, trading
  the connection away only for a sender who ignores the 413 entirely. The
  regression test trickles chunks on a timer — enqueuing them all up front lets
  the client finish before the server reads, so the bug hides.
- **The `page` cap measures the string that is actually sent.**
  `serializePageForPrompt()` in `build_scripts/ai/schemas.js` is used by both
  the size refinement and `buildContentUserPrompt`. They used to differ — the
  cap measured compact `JSON.stringify(page)` while the prompt sent the
  pretty-printed form — so indentation was free and an object of many small
  nested entries could measure ~100 KB and arrive upstream ~4x larger, past the
  very limit meant to bound tokenization. Measuring one string and sending
  another is the bug; one shared function is the fix. Real pages expand only
  ~1.2x, so the tighter measurement rejects nothing the tool itself sends.
- **Cancellation is decided by signal state, not by the error's shape.**
  Upstream, the SDK client sets `maxRetries: 1` and a 150s per-call timeout, and
  the route combines `req.signal` with
  `AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS)` (default 240s) — otherwise two
  validation attempts times the SDK's default two retries times its ~10-minute
  default timeout leaves one click able to hold a request open far longer than
  anyone waits. `aiErrorResponse` then takes **both signals** and maps
  `client.aborted` → **499** and `timeout.aborted` → **504**, so the log answers
  "who gave up first?" rather than collapsing both into one code. Matching on
  the error instead does not work and was a real bug: the SDK throws
  `APIUserAbortError` / `APIConnectionTimeoutError`, which inherit `name`
  `"Error"` and carry no `status`, so a `name === 'AbortError'` test never fired
  and every cancelled generation was logged as a 500. `AbortSignal.timeout()`
  also reports `"TimeoutError"`, not `"AbortError"`. Asking the signal is also
  provider-agnostic, which matters the moment a second provider lands.
  `tests/ai-assist-server.test.js` pins the 504 path against a deliberately slow
  stub — the 499 path is not observable from a test, since the client that
  aborts is the one that cannot read the answer.
- **The fallback arm matches `constructor.name`, never `instanceof`, and splits
  504 out of it.** The fallback is not a safety net for exotic cases; it is a
  routine path. The SDK enforces its own per-call `ANTHROPIC_TIMEOUT_MS` inside
  `AI_REQUEST_TIMEOUT_MS`, so any configuration where it gives up first — a
  short per-call timeout, or the explicitly supported `ANTHROPIC_MAX_RETRIES=0`
  removing the retries that would otherwise carry the call past the route's
  budget — throws `APIConnectionTimeoutError` with **neither** signal aborted.
  That arm was dead for a second reason beyond the `name` problem above:
  `@anthropic-ai/sdk` publishes separate `require` (`index.js`) and `import`
  (`index.mjs`) builds, and `server.ts` imported the SDK while
  `build_scripts/ai/provider-anthropic.js` requires it — the classic dual
  package hazard. The two halves held different objects for the same class, so
  every `error instanceof Anthropic.*` compared against a constructor the
  thrown error had never been built from. Measured before the fix, an SDK
  timeout came back **500** — not even the 499 the code reads as.
  `constructor.name` is a single string on a single object, survives that
  boundary, and removes the need for the SDK import in `server.ts` at all. The
  two errors then split like the signal branches do: `APIUserAbortError` → 499,
  `APIConnectionTimeoutError` → **504**, since a provider that ran out of time
  is not a reviewer who walked away, and folding them together hides a slow
  upstream behind a status that reads as "nobody was listening".
- **Gemini's own timeout is normalized at the provider, because the route
  cannot recognize it.** The trick that works for Anthropic does not transfer.
  `@google/genai` implements `httpOptions.timeout` as a bare
  `abortController.abort()` with no reason, and `abort()` with no reason
  rejects with a `DOMException` whose `name` is `"AbortError"` — the exact
  shape a reviewer pressing Cancel produces, and its `constructor.name` is
  `"DOMException"`, so neither the name check nor the constructor check can
  separate them. The result was a Gemini request that ran out of time telling
  the reviewer **499 "Generation was cancelled."** — the same class of
  misreporting the `constructor.name` fix above was written to end, reappearing
  through a second provider. The one thing that still distinguishes the two is
  whether the **caller's** signal aborted, and that is in scope only inside the
  provider: `classifyAbort()` in `provider-gemini.js` raises a
  `ProviderTimeoutError` when the SDK aborted and the caller's signal did not,
  and rethrows the original untouched when it did, so a real cancellation still
  reaches the signal branches that own 499/504. `ProviderTimeoutError` lives in
  `errors.js` for exactly the reason `RefusalError` does — it is a concept no
  single provider owns, and normalizing it there keeps `aiErrorResponse` a
  single `instanceof` rather than a per-provider branch that rots. Split out as
  a pure function so it is testable without an SDK client or a real 150s wait.
- **Numeric env tunables are range-checked, not merely parsed.**
  `numberFromEnv` (`build_scripts/ai/env.js`) rejects NaN, Infinity, negatives,
  fractions, and anything outside `[min, max]` (default max
  `Number.MAX_SAFE_INTEGER`), warning and falling back rather than throwing.
  `Number.isFinite` is **not** a sufficient test: `AI_REQUEST_TIMEOUT_MS=1e20`
  is finite, and `AbortSignal.timeout()` rejects it outright — that call sits
  _outside_ the generate route's `try`, so an accepted-but-unusable value is an
  unmapped 500 on every generation rather than an over-generous budget, which
  is the exact failure this helper exists to prevent. Both timeouts additionally
  cap at one hour and `ANTHROPIC_MAX_RETRIES` at 10: a reviewer is watching a
  spinner, so larger values are typos, and a retry count in the thousands is not
  a slow request but one that never returns.
- **The retry carries the rejected draft, not just the failures.** Each API
  call is stateless, so "fix these and change nothing else" is only followable
  if the thing to change travels with the instruction; without it the retry
  regenerates from scratch and loses whatever the first attempt got right.
  Usage is summed across attempts for the same reason it matters at all —
  reporting only the last call understates exactly the requests that cost most.
- **The draft is filed under a sentinel key twice, under two different
  sentinels.** The link checks in `data-checks.js` take one `pages` object and
  use it both for what to walk and for which targets resolve, so filing the
  draft under `__generated__` made that string a resolvable target — a card
  pointing at it passed every check while being inert in the downloaded module.
  Running each check under `__generated__` and `__generated_probe__` and
  unioning the broken targets closes that without duplicating any traversal: a
  link to either sentinel resolves in one pass and breaks in the other.
- **Validation is the point of the feature.** `build_scripts/ai/validate-output.js`
  runs a generated page through `build_scripts/schema.js`, the
  `build_scripts/data-checks.js` invariants (link targets resolved against the
  real page-key universe, lists of 3+ using bullets, unsafe URL schemes, the
  Agency page staying inside Article 11), and `js/plain-language.js`'s
  mandates. **Neither this nor CI contains the other, so a passing draft does
  not mean "this would pass CI".** It is tighter on content: `validate.js`
  never calls `analyzePlainLanguage()`, and the only CI-side plain-language
  gate is a set of budgets in `tests/plain-language.test.js` — at most 15
  mandatory failures corpus-wide, 3 per page, and any one rule failing at most
  8 pages — so authored copy can carry a
  mandate failure that would get a generated draft rejected. It is looser on
  wiring, because it only ever sees one page object: dropping a passing draft
  into `pages/` still needs the `import` in `js/page-data.js` and its
  `[pageKey, menuLabel]` entry, which `bun run validate` checks and this does
  not. On failure the specific issues are named
  back to the model for **exactly one** retry; a bare "try again" reproduces the
  same violation. Results always return 200 with their issues attached even
  when invalid, because a draft failing one rule is still useful to a reviewer
  who can see which rule.
- **The system prompt must stay byte-stable.** `build_scripts/ai/prompts.js`
  inlines the vendored `docs/source/sfgov-style/` corpus and carries a
  `cache_control` breakpoint. Caching is a prefix match, so anything variable
  in it — a timestamp, an unsorted page-key list — invalidates the cache on
  every call. Request-specific material goes in the user turn.
- **Never writes anything.** No filesystem write path, no review-state write,
  no `pages/*.js` mutation. Standards manual §1.11 forbids automated approval,
  and SF.gov's published AI guidelines require disclosing generative-AI use, so
  every successful `generate` result carries a `disclosure` string. Scoped to
  that response shape only — `capabilities` advertises the requirement as
  `disclosureRequired: true`, `models` returns bare ids, and errors carry
  none, so a client must not use the field's presence as its test for whether
  a payload holds generated content. Both browser export paths do carry it:
  _Download pages module_ and _Copy pages module_ emit the same
  `buildPageModuleSource()` output, disclosure comment included.
- **Tests**: `tests/ai-assist-server.test.js` spawns `server.ts` with
  `ANTHROPIC_BASE_URL` pointed at a stub Anthropic endpoint, so the gates, the
  retry loop, and the error mapping are covered with no API key and CI never
  makes a paid call. `tests/ai-assist-schema.test.js` guards the hand-authored
  structured-output JSON Schema against drifting from the Zod page schema.
- **Netlify** (`build:netlify`) has no server runtime, so the static deploy
  simply has no AI — the same way it has no sync.

### Build outputs

- **`vite build --mode singlefile`** (`bun run build:singlefile`) inlines
  every script and stylesheet into one self-contained
  `dist-singlefile/index.html`, via `vite-plugin-singlefile`. It replaced the
  hand-rolled `build_scripts/build-single-file.js`, which concatenated
  `index.html`'s tags in document order — an approach that only worked while
  there was no bundler. The output, plus `dist/` and
  `data/page_inventory.{json,csv}`, is a gitignored generated file —
  **never hand-edit it**; edit sources and re-run `bun run build`.
- **`build_scripts/extract-pages.js`** (first half of `bun run export`)
  regenerates `data/page_inventory.{json,csv}` from page data. `data/` is
  absent on a fresh clone (gitignored); this script creates it. Dev/serve
  never touches `data/` — only build/export does.
- **`build_scripts/sync-tracking-sheet.js`** (second half of `bun run export`,
  also `bun run sync-tracking`) regenerates the Google Sheets–ready tracking
  CSVs under `review/` from current page data.
  **`build_scripts/push-tracking-sheet.js`** (`bun run push-tracking`) does a
  three-way merge against the live Master Control workbook (IDs and tab gids
  in `build_scripts/sheet-config.json`) and optionally pushes via the Sheets
  API. It needs a Google service-account key, which is gitignored and must
  stay that way — never commit `*-service-account*.json` or `.env.local`.
- **`bun run build:netlify`** (driven by `netlify.toml`) runs `validate` →
  `build:app` (the real Vite production build into `dist/`) →
  `build_scripts/copy-workshop-form.js`. That last script is the surviving
  half of the old `build-netlify-dist.js`: everything it used to copy by hand
  (`index.html`, `css/`, `js/`, `pages/`, the `@sfgov/design-system` CSS) is
  now bundler output, but the workshop form still has to be copied to
  `dist/forms/mosquito-workshop-request`, since that Vite sub-app is built
  with `base: '/forms/mosquito-workshop-request/'`. **That copy does not run
  the sub-app's Vite build** — it copies whatever is checked into the
  committed `forms/mosquito-workshop-request/dist`, so after editing
  `forms/mosquito-workshop-request/src` you must run
  `bun run build:workshop-form` and commit the result, or the deploy ships
  stale form assets. The script parses the committed HTML's asset references
  and fails loudly when any are missing, because a deploy once shipped a form
  shell that loaded its CSS and never hydrated. Note the gitignore subtlety:
  the root bundle is ignored as `/dist/`, anchored on purpose so it doesn't
  also swallow that sub-app's committed `dist/`.
- `server.ts` mirrors the same security headers (`X-Content-Type-Options`,
  `X-Frame-Options`, etc.) that `netlify.toml` sets for the deployed site.

### Other directories

- **`forms/mosquito-workshop-request/`** — an independent Vite app (own
  `package.json`, `vite.config.js`, `src/main.js`) for one embedded form. Not
  wired into the main Bun dev server; built separately via
  `bun run build:workshop-form` or the Netlify build.
- **`review/`** — reference/output for the manager review process
  (`manager_review_packet.md`, `manager_decision_log.csv`,
  `page_approval_checklist.csv`, `mockup_tracking_sheet.csv`), distinct from
  the in-browser `localStorage` review state.
- **`docs/`** — `wagtail-content-mapping.md` (page type → Karl content type)
  plus dated research/audit notes.
- **`docs/source/hhvc-policy/`** — source policy documents (PDFs and their
  markdown extracts) that page copy is based on; not code.
- **`docs/superpowers/plans/` and `docs/superpowers/specs/`** — planning and
  design docs from prior work sessions; useful background, not standing
  instructions.
- **`.playwright-mcp/`** — scratch console logs/snapshots from prior
  Playwright MCP sessions; not part of the source.

## Code style & idioms

### Formatting (a hard CI gate)

Prettier is the **only** linter (`.prettierrc.json`): **no semicolons**,
single quotes, 2-space indentation, `printWidth: 100`, ES5 trailing commas.
Code must be ASI-safe and semicolon-free. Run `bun run format` before
committing; `bun run format:check` is the lint step and CI fails on it.
`.prettierignore` excludes `data/`, `node_modules/`, `dist/`, `server.ts`,
the generated single-file HTML exports, and the reference/planning dirs
(`docs/source/`, `docs/superpowers/`, `review/`, `.playwright-mcp/`).

### JavaScript

- **This is plain browser JS — not TypeScript — but it IS bundled, and
  `js/*.js` ARE ES modules.** Use `import`/`export` with explicit relative
  specifiers including the `.js` extension (`import { escapeHtml } from
'./utils.js'`). Vite builds it; `server.ts` is the one TypeScript file, and
  it's Prettier-excluded. (Older notes in this repo describing "no build step,
  no ES modules" predate the Vite migration.)
- **File naming:** lowercase — single words for the core modules (`app.js`,
  `state.js`, `utils.js`), hyphenated for multi-word ones
  (`review-queue-state.js`, `page-render.js`); never camelCase. Match sibling
  files.
- **Two deliberate module patterns:** (1) plain modules for the core files —
  bare `const`/`function` declarations plus an `export { … }` block at the
  bottom, and a `window.X = X` line for the handful other code reaches
  through `window` (see the load-order section); (2) **named IIFEs with a
  leading semicolon** —
  `;(function mountX(){…})()` — for newer stateful subsystems (the leading `;`
  is required because there are no statement-terminating semicolons). Expose
  via `window.<Namespace>` with the idempotent `window.X = window.X || {}`
  idiom.
- **Naming:** `camelCase` for JS identifiers, `UPPER_SNAKE_CASE` for module
  constants, `snake_case` for serialized/CSV data fields (`review_date`,
  `local_dirty`, `synced_at`). That camelCase-code / snake_case-data boundary
  is firm.
- **Defensive by default:** run every value that reaches `innerHTML` through
  `escapeHtml`; use optional chaining + `?? ''` coercion and guard-clause
  early returns; guard test/SSR contexts with a
  `typeof window === 'undefined'` early return; `csvEscape` includes
  spreadsheet formula-injection protection (`build_scripts/csv.js` preserves
  the same neutralization on the Node side). Prefer reusing `js/utils.js`
  helpers over inlining new logic.
- **State:** in-memory module singletons + versioned `localStorage` updated via
  functional updater callbacks (`updateLocalState((s) => { …; return s })`) +
  `HHVC_DATA`/`HHVC_PAGES` globals; `ORIGINAL_DATA` is a deep clone for reset.

### Comment & documentation voice — the most distinctive trait

Write **detailed, explanatory** comments and docs, not terse ones (the
author's stated preference: verbose, comment-heavy, explain the reasoning).
Every module opens with a header block stating its role **and its load-order
dependency**. Functions carry full JSDoc (`@param`/`@returns`). Comments
justify the _why_ — product rationale, trade-offs, and exact WCAG contrast
math in CSS — not restatements of the code. Prose docs use plain-English
framing with `**Bold label:**` bullets that state a non-obvious fact _and why
it matters_, and annotate config inline (e.g. the `"// script": "description"`
keys in `package.json`, and the explanatory comments throughout `.gitignore`
and `ci.yml`). Match this voice.

### CSS

Design-token-first: raw `--sfds-*` tokens (from the SF.gov/Karl design guide)
→ a semantic `--brand-*`/`--surface-*`/`--text-*` layer with baked-in
`var(fallback)` values, so reviewers retheme by touching tokens only.
Hand-authored, no preprocessor. Boxed section-banner comments; justify
color/accessibility choices in-comment with the contrast math. `!important` is
used liberally **only** in the self-aware override layer
(`css/ux-improvements.css`). Dark mode via
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
`tests/helpers/load-scripts.js` harness evaluated the classic `<script>` files
into a shared context, which ES modules made impossible. `describe` blocks are named after the unit under
test; `test` names are **behavioral verb sentences** ("escapes all five HTML
special characters"). Prefer exact-string assertions over loose matching. The
XSS/escaping surface (`page-render.test.js`) is exhaustively covered — one
assertion per render function. Use `test.todo` (with a reasoning comment) to
document a known-but-unfixed bug rather than asserting wrong behavior. Tests
that stub globals must restore them, or they pollute sibling test files.

## Editing rules (quick reference)

- Public page content → `pages/*.js`.
- Core render/state → `js/state.js`, `js/page-render.js`, `js/ui-controls.js`,
  `js/editor-panel.js`, `js/app.js`.
- Review/UX layers → `js/ux-improvements.js`, `js/review-queue.js`,
  `js/dashboard-guidance.js`, `js/keyboard-shortcuts.js`,
  `js/manager-review-export.js`, `css/ux-improvements.css`.
- Shared merge/history logic → `js/review-merge.js` (loaded both as a browser
  `<script>` and imported directly by `server.ts` — the only place a `history`
  entry should ever be constructed). Optional sync backend → `server.ts` (API
  routes) and `js/review-state-sync.js` (client pull/push + settings UI).
- Styles → `css/styles.css`; design tokens → `css/theme.css`.
- Any new file under `pages/` needs an `import` in `js/page-data.js` (enforced
  by `build_scripts/page-import-checks.js`, so `bun run validate` fails without
  it) plus an `order` entry. A new `js/` module is imported by whoever needs it,
  or added to `js/main.js` if it is a self-mounting IIFE. **`index.html` has
  exactly one `<script>` tag** — do not add tags to it.
- After editing `pages/*.js` or `js/page-data.js`, run `bun run validate`
  **and** `bun run test`. After touching the import/export round-trip,
  manually verify it (export → re-import → decisions survive).
- Review exports (`review/*.csv`, saved local-review CSV/JSON) are for
  manager decisions only — never treat them as automatic publication approval.

## Commits & pull requests

- **Imperative mood.** Prefer **Conventional-Commits prefixes** for code
  changes (`fix:`, `feat:`, `style:`, `content:`); keep the subject ≤ ~72
  chars.
- **Bodies scale with complexity:** a one-liner for CSV/doc refreshes; for
  behavior/layout changes, a problem statement + a dash-bulleted list of
  changes + an explicit **verification line** (e.g. "Verified headless at
  1600px and 850px…"). AI-assisted commits carry `Co-Authored-By` and
  `Claude-Session` trailers.
- **Keep dashboard-UX changes and policy-copy changes in separate PRs** —
  reduces merge conflicts and keeps review focused.
- **Never hand-edit generated files** (single-file HTML exports,
  `data/page_inventory.*`) — edit sources and rebuild.

## Karl CMS

Login URL for the Karl (Wagtail-based) CMS admin:
`https://api.sf.gov/sso/login?next=/admin/`. Keep user-specific credentials
and private MCP config out of the repo (in `~/.codex/config.toml` or
equivalent).

## Session pitfalls to avoid

- **Establish the repo root before guessing paths.** Run `pwd` (or use the
  working directory Claude Code reports) rather than assuming one — the
  checkout path differs between the author's local machine and cloud/CI
  sandboxes. Automated review-style invocations have repeatedly wasted a turn
  on a failed `Read` against a guessed path before self-correcting via
  `Glob`/`pwd`.
- **`node_modules/` may be absent on a fresh clone or sandbox.** `bun install`
  is required before `dev`, `validate`, `test`, or `build:netlify` — the first
  three need `zod`/`fast-glob`/`papaparse`, and `index.html` links
  `@sfgov/design-system` CSS straight out of `node_modules`.
- **Land brainstorming/exploration sessions on a decision.** Open-ended
  design sessions (e.g. via `superpowers:brainstorming`) have previously
  ended mid-flow with only disposable prototypes left in
  `.superpowers/brainstorm/` and no spec, decision, or concluding direction.
  Before ending this kind of session, either commit to a documented
  decision/next step or explicitly say what's unresolved so it isn't
  mistaken for finished work.
- **Verify and close out delegated work yourself before calling it done.**
  When using subagent-driven-development or worktrees, a subagent reporting
  "done" is not sufficient — confirm and merge the result in the parent
  session. This matters especially near a session usage-limit boundary:
  don't let the session end assuming a subagent's self-report was the final
  verification.

## Cross-tool canon

`AGENTS.md` is the tool-agnostic source of truth. This file mirrors the same
facts plus the Claude Code–specific notes above; `.github/copilot-instructions.md`
is Copilot's mirror. Keep the three in sync, and if they ever disagree, reconcile
toward `AGENTS.md`.

**The full mirror inventory lives in `AGENTS.md`'s own "Cross-tool canon"
section** — including the Cursor, Windsurf, Codex, and skill files, which are
deliberately **pointers** carrying no counts, no file inventories, and no
architecture summaries. Every one of them previously restated a summary and every
one of those summaries rotted into instructions that were actively wrong (see
that section for what they were still claiming). Do not "helpfully" re-expand
one; add the fact to `AGENTS.md` instead.
