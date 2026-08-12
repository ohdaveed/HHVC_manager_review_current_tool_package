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

The repo currently holds **22 pages** under `pages/`. If `bun` isn't on
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
bun run test                  # bun test over the 34 unit-test files in tests/ (1,397 tests)
bun run test:e2e              # playwright test (161 specs across 19 files in tests/e2e/)
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
global lexical scope — is gone, along with the `js/vendor/` IIFE bundles.
Third-party libraries are imported from npm and tree-shaken. `server.ts` still
owns the optional sync API and now serves `dist/` rather than the repo root
(override with `STATIC_ROOT`).

**There IS a real test suite** (older docs sometimes claim otherwise — they're
wrong). `bun run test` runs 34 Bun unit-test files under `tests/`: `utils`,
`data-validation`, `page-render`, `csv`, `review-state-schema`, `reading-level`,
`plain-language`, `page-import-checks`, `mockup-image-export`,
`review-insights-data`, `review-insights-charts`, `review-insights-render`,
`review-ops-data`, `knowledge-chunking`, `knowledge-search`,
`validate-compliance-audit`, `review-merge`, `review-state-sync`,
`ai-assist-schema`, `ai-assist-env` — self-explanatory by name — plus a handful
whose non-obvious "why" is worth keeping:
`card-inheritance` (the shared `inherits`/`title-only`/`authored` classifier
plus the audit built on it — `authored` must beat everything so a Table block
is never blanked, and `title-only` must beat `inherits` since Related notes
also contain the phrase "page chooser"; mutation-proven against three
deliberate breakages, and driven with hand-built pages rather than the real
corpus so a legitimately added card never fails the suite),
`csv-edited-fields-roundtrip` (mounts the REAL export/import IIFEs rather than
stubbing the merge, since only that proves the export and import field-name
enumerations actually agree), `decision-vocabulary` (pins the two
module-boundary restatements of the decision list against the canonical table
in `js/utils.js`), `doc-counts` (reads the counts back out of these docs and
compares them to the filesystem — this very list is what it checks),
`inline-content-edit-data` (pure `section_edits` diff/reapply logic against
`ORIGINAL_DATA`, no DOM, dual-exported like `review-merge`),
`inline-content-edit-adapter` (the pure markdown/HTML serialization boundary
between stored page-value strings and `@editorjs/editorjs`'s block-JSON
`OutputData`, dual-exported the same way; its fixed-point round-trip test
sweeps every string in the real page corpus, not a handful of hand-picked
cases, since a non-idempotent adapter would silently corrupt content on a
no-op open/close with no schema violation to catch it),
`inline-content-edit-refresh` (the re-entrancy guard around the follow-up
render a reapplied section edit triggers — `js/ux-improvements-state-sync.js`'s
`refreshInFlightForKey` guard), `inline-content-edit` (the click-to-edit
orchestrator, driven with real DOM events against real happy-dom, since it
exercises actual `Element.replaceWith()` and focus/selection behavior),
`inline-content-edit-roundtrip` (add/remove/reset verified through the REAL
save/reapply path rather than the counting stubs the sibling file uses, proving
a `section_edits` round trip and that reset drops a field from the next
recompute), `page-registry-data` (pins `REQUIRED_PAGE_FIELDS` against the real
schema so a mismatched required field fails here rather than shipping; asserts
a malformed registry entry is **dropped rather than thrown on**, since a throw
at the root of the module graph strands the reviewer with no UI to fix it; its
prototype-pollution case uses `Object.defineProperty` rather than an object
literal, whose `__proto__:` key would set the prototype instead of creating an
own property and pass while proving nothing), `review-api-server` (spawns
`server.ts` as a subprocess against a temp SQLite DB, over real HTTP),
`ai-assist-providers` (varies provider API keys directly, which a spawned
server subprocess structurally cannot), `ai-assist-server` (spawns `server.ts`
against stub Anthropic **and** Gemini endpoints, so both AI paths are covered
with no key and no paid call), and `ai-assist-validate-rewrite` (that a
rewrite preserves every link's TARGET while its label stays free to change,
and introduces no HTML into copy rendered through `formatMarkdown`).
**That list is spelled out explicitly in `package.json`'s `test` script rather
than globbed**, so a newly added `tests/*.test.js` runs only once it is named
there; until then it passes locally when invoked by hand and covers nothing in
CI. `tests/helpers/browser-env.js`, preloaded via `bunfig.toml`, registers a
**happy-dom** global environment before the loader runs (the module graph does
real work at import time), restores Bun's native `fetch`/`Request`/`Response`
afterwards since happy-dom's HTTP client breaks `review-api-server`'s real
requests, and redefines `window`/`document`/`localStorage` as writable so
`review-state-sync`'s tests can still stub them.

`bun run test:e2e` drives Playwright over `tests/e2e/` — nineteen spec files
(161 specs), all UI-driven: navigation, editor panel, review workflow, review
queue, review-queue undo, stored review data, import/export, keyboard
shortcuts, workspace panels, accessibility, AI assist, AI rewrite, mockup PNG
export, Overview insight cards, adding and deleting page mockups, and
workshop-form submission handling, sharing plain helper functions in
`tests/e2e/helpers.js` (no fixture framework). A fourteenth file,
`review-import-export.spec.js`, was deleted rather than repaired: its
round-trip tests hand-rolled the merge inside `page.evaluate()` instead of
calling `importReviewStateBackup()`, so it stayed green against the wholesale
replace that once destroyed reviews, and its other two tests duplicated
existing coverage. `import-export.spec.js` is the real coverage.
**`gotoFresh()` waits on `window.reviewKeyboardShortcuts.ready`**, not just the
sticky bar — the bar mounts early, so waiting on it alone let a test press a
global shortcut before `js/keyboard-shortcuts.js` had attached its `keydown`
listener. Playwright's `webServer` block starts `bun run start` on `:8080`
itself. In a sandbox with a pre-installed Chromium, point Playwright at it
instead of downloading:

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

**Load order lives in `js/main.js`, not `index.html`.** `index.html` has exactly
one script tag — `<script type="module" src="/js/main.js">` — and `js/main.js` is
the root of the module graph: CSS, then the three third-party libraries, then the
core modules, then the review/UX layers. The old model (~47 classic `<script>`
tags sharing one global lexical scope) and the committed `js/vendor/` IIFE
bundles are both gone; Fuse.js, defu and papaparse are npm imports now.

Order is enforced two ways. **Core modules enforce it themselves** — a module
that needs `escapeHtml` imports it, and `js/state.js` imports
`js/page-registry.js`, which imports `js/page-data.js` first, which imports all
22 `pages/*.js`, so `window.HHVC_DATA` is always populated before anything reads
it — and the reviewer's added/deleted pages are applied before `ORIGINAL_DATA` is
cloned. **The self-mounting IIFE subsystems still depend on
listed order** — `js/ux-improvements*.js`, `js/review-queue*.js`,
`js/dashboard-guidance.js` and
`js/keyboard-shortcuts.js` reach each other through `window.<Namespace>`
objects rather than imports, so their sequence in `js/main.js` is load-bearing
and hand-reviewed.

Note that "no imports" would be too strong, and used to be written that way:
only `js/review-queue*.js` takes none. The others do import — `js/utils.js`
helpers, and four imports in `js/dashboard-guidance.js` — so the module graph
already orders them against the _core_. What it cannot order is the part that
matters here: a `window.<Namespace>` a sibling IIFE assigns at mount time is
invisible to the graph, so that edge is still enforced only by this list.

A few functions are deliberately republished onto `window`, because callers
depend on the implicit globals the old shared scope provided: `window.renderPage`
(`js/ux-improvements.js` wraps it to refresh after navigation — the decorator
only forms if the original is on `window`; it is the last of three, the other
two having been the deleted `js/interactive-sitemap.js` and
`js/manager-review-export.js`, whose decorator went with the sidebar label it
refreshed), `window.toggleSidebar` (an inline
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

### Card descriptions are inherited, not printed

A Karl Services/Resources subsection entry — and a Related-panel entry, and a
Resource Collection's Resource-section entry — is only a page picker: "add an
SF.gov page or External link". It carries no label field, so its title always
publishes as the **destination** page's own title; only the Agency
Services/Resources subsection also lacks a description field, so only that
bucket additionally publishes the destination's summary — a Related panel and
a Resource Collection's Resource section render a title and a link and
**nothing else** (see the three-bucket breakdown below). A card in
`pages/*.js` carrying its own `text` was therefore showing reviewers copy that
can never appear on SF.gov, which matters more here than in
most codebases because approving that copy is the entire point of the tool —
and the inline-content-editing feature then made those dead fields
click-to-edit.

`js/page-render.js` therefore resolves **every** card description through one
helper, `cardDescription(section, card)`, instead of printing `card.text`.
Syncing the two duplicated strings was the other option and was rejected: they
drift again on the next edit to either side, whereas inheritance leaves them
unable to disagree at all. An empty resolved description renders no element,
not an empty one — a blank `<p>` still occupies its row and reads as copy that
failed to load.

- **There are three buckets, and they key on the section's `karl` note — NOT
  on `section.component`.** `inherits` (an Agency Services/Resources
  subsection) renders the destination's title AND summary. `title-only` (a
  Related panel, a Resource Collection's Resource section) renders a title and
  a link and **nothing else**, each verified separately at DOM level against
  live pages on 2026-08-08 — the editor help center contradicts itself on this,
  so do not re-widen it from the docs alone. `authored` (a Table block, a
  Title-and-text block) writes its own words and is left untouched. The first
  version of the classifier keyed on `component` and would have corrupted table
  blocks and title-and-text blocks: 74 of its 98 findings sat in sections
  carrying no `component` at all, and those were not one kind of thing
  (`article11Guide`'s "Mold and lead hazards" is a table). The `karl` note
  names the Karl block a section maps to, so it is the real authority. That
  history is written up in `build_scripts/audit-card-inheritance.js`'s header;
  read it there rather than re-deriving it.
- **`js/card-inheritance.js` is dual-exported for the same reason
  `js/review-merge.js` is.** `js/page-render.js` reads it off
  `window.cardInheritance` (side-effect-importing the file so the module graph
  guarantees it) and `build_scripts/audit-card-inheritance.js` `require`s it,
  so the browser renderer and the Node audit share exactly one classifier and
  cannot come to disagree about what inherits. A second copy of those regexes
  would let the mockup show one thing while the audit asserted another, and the
  drift would stay invisible until a reviewer approved copy that cannot ship.
- **`bun run audit-cards` is a report, not a CI gate**, and exits 0 even with
  findings on purpose. A title mismatch is safe to sync mechanically; a
  description is a content judgement per card, and the right direction of the
  fix is sometimes the destination page rather than the card.
- **An external-URL entry inside an inheriting subsection keeps its own
  authored text — measured, not assumed.** There is no destination page to
  inherit from, so this was an open question the audit reported and refused to
  assert on. It was settled on 2026-08-09 by a census of all 332
  `departments--*` pages in `sf.gov/sitemap.xml`: **333 of the 363** entries
  whose `href` leaves sf.gov render a description of their own (the 30 that do
  not match the shape of an editor leaving the field blank, the same way 90
  SF.gov entries render none because their destination has no summary). An
  external entry therefore HAS a description field, authored on the entry
  rather than inherited, and `js/page-render.js` printing `card.text` for one
  is correct — so the audit counts them and reports no finding. **Two details
  of that census are load-bearing, because a repeat that misses either gets a
  different answer.** `api.sf.gov`/`media.api.sf.gov` hosts were counted
  separately (69 with a description to 29 without): those are SF.gov's own
  document store, so such an entry is a **Document Picker** upload reading its
  text off the Document object — a third mechanism, and folding it in answers a
  different question with the same number. And each anchor was matched to its
  own closing `</a>` before its description was read, since attributing a
  neighbour's description to an entry is how a sweep like this quietly confirms
  whatever it set out to find. External entries in a `title-only` section are
  the opposite case and needed their own evidence: that component renders no
  description for **any** entry, which is a fact about the component rather
  than about the destination, so those report as dead text and were deleted.
  Full write-up in
  `docs/source/hhvc-policy/2026-08-08-karl-card-inheritance-verification.md`.

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
- **`js/page-registry-data.js`** — pure validation for a page a reviewer
  authored in the browser, plus `applyRegistryToData()`, the only function that
  mutates `order`/`pages` for the add/delete feature. Dual-exported and
  import-free; it is evaluated far earlier than the other dual-export modules
  (through `js/page-registry.js`, before `js/state.js`), so unlike
  `js/inline-content-edit-data.js` it must not resolve anything off `window` at
  module scope — `js/utils.js` is not guaranteed to have run yet.
- **`js/page-registry.js`** — applies that registry onto `window.HHVC_DATA` and
  publishes `window.pageRegistry`. Must run before `js/state.js`'s
  `ORIGINAL_DATA` clone; see "Adding and deleting pages" below.
- **`js/card-inheritance.js`** — the shared classifier deciding whether a
  section's cards publish the destination page's title and summary
  (`inherits`), its title alone (`title-only`), or their own authored words
  (`authored`). It imports nothing and reads no global, so it has no load-order
  dependency of its own — it must simply be evaluated before anything calls
  `window.cardInheritance`, which `js/page-render.js`'s own import of it
  enforces. Dual-exported (`window.cardInheritance` plus `module.exports`)
  exactly like `js/review-merge.js`, and for the same reason: see "Card
  descriptions are inherited, not printed" above — the browser renderer and the
  Node audit must share one classifier rather than two copies free to drift.
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
  grades on average across the 22 pages, always in the direction of "easier
  than it is", so nine pages reported hitting a reading target they miss. The
  Node copy is deleted; `tests/reading-level.test.js` now imports this one.
- **`js/review-state-validation.js`** — browser-side validation of the
  `hhvcManagerReviewState:v1` blob, mirroring
  `build_scripts/review-state-schema.js`'s Zod rules without shipping Zod to
  the browser. Keep the two in step when the persisted shape changes.

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

- **Three lazily-mounted panels publish a mount hook rather than rendering at
  init:** `window.__mountAiAssistOnTabOpen`, `window.__mountReviewOpsOnTabOpen`
  and `window.__mountPageRegistryOnTabOpen`.
  All three are collapsed `<details>` at the end of the Help panel now rather
  than tabs of their own, so `setWorkspaceTab` calls **all three** when Help
  opens — a
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
**Sitemap** was removed outright (a fourth way to navigate 22 pages, drawing a
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
- **`severity: 'warning'`** are advisory, run to ~115 across the 22 pages, and
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

### Inline content editing (`js/inline-content-edit*.js`)

Click-to-edit directly on the rendered mockup — title, summary, primary CTA
label, a section heading, a paragraph, a bullet — with the mockup
re-rendering immediately and the edit persisting through the same
browser-first `localStorage` review-state model every other field in this
tool uses. `pages/*.js` is never touched; this is a review aid, same as
every other review/UX layer. Three files, mirroring the AI-assist split:
`js/inline-content-edit-render.js` (widget markup — inputs, textareas,
add/remove/reset controls, the Edited badge), `js/inline-content-edit-data.js`
(pure `section_edits` diff/reapply, no DOM, dual-exported like
`js/review-merge.js`), and `js/inline-content-edit.js` (the orchestrator —
delegated click handling, the open/commit/cancel widget lifecycle, and
wiring into the existing autosave path).

- **Scope is deliberately narrow.** Title, summary, primary CTA, section
  heading, section paragraphs, section bullets — that's it. Cards, callouts,
  table cells, step text/bullets, `whatToKnow` items, and contact info stay
  hand-edited in source. Add/remove is supported on exactly two fields —
  section `paragraphs` and `bullets` — and only of individual items, never
  whole sections/cards/steps, and never reordering.
- **Card descriptions carry no `data-rewrite-field`, and cards being listed
  out of scope above is load-bearing rather than incidental — it must stay
  true.** That attribute is what turns an element into a click-to-edit field
  whose keystrokes are written back onto the addressed path of the **current**
  page's object. For an inheriting card the description on screen is the
  **destination** page's `summary` (see "Card descriptions are inherited, not
  printed"), so the path here would address the card's own `text` — precisely
  the field the inheritance change exists to prove renders nowhere. The edit
  would appear to work, autosave, and then vanish on the next paint, because
  the paint reads the destination's summary. A `title-only` card has no
  description to edit at all. The text a reviewer actually wants to change
  lives on the destination page, where inline editing already reaches it, so
  the absent attribute is the whole enforcement — do not "complete" the
  feature by adding it. The decision is restated at its site in
  `js/page-render.js`, immediately above `renderCards`.
- **Addressing is reused, not reinvented.** `js/page-render.js` already
  emits `data-rewrite-field="sections.N.paragraphs.M"`-style dot-path
  attributes (added for the in-flight AI-rewrite-selection feature) via
  `paragraphList()`/`bulletList()`'s `pathPrefix` parameter, plus
  `data-rewrite-field="sections.N.heading"` on section `<h2>`s and
  `"title"`/`"summary"`/`"primaryCta"` on the hero's elements, both added by
  this feature. The path always uses each section's **original**
  `page.sections` index (`__sectionIndex`, stamped by `partitionSections()`),
  never its position in the reshuffled render layout — see the
  "Field addressing" section of
  `docs/superpowers/specs/2026-08-08-inline-content-editing-design.md` for
  why render-position addressing would silently target the wrong section.
  Every write goes through the existing guarded `getByPath`/`setByPath`
  (`js/utils.js`) — never a hand-rolled path walker — except title, summary,
  and CTA, which are page-level (not inside `sections[]`) and already have
  dedicated accessors (`getPrimaryCta`/`setPrimaryCta`, direct
  `page.title =`/`page.summary =`).
- **Array edits are always a whole-field replace, never a per-index
  patch.** Adding or removing one bullet writes the entire resulting array
  under `sections.N.bullets`, never a single index — a delete shifts every
  later index, so a per-item key would either go stale or need renumbering
  logic on every removal. This mirrors how `edited_title` has always been
  the whole new title, never a diff.
- **`edited_title`/`edited_summary`/`primary_cta` were unused fields before
  this feature, not new ones.** `REVIEW_RECORD_FIELDS` and the review-record
  schema already had all three slots, and
  `collectCurrentPageReviewState()`/`updateMockupTextFromSavedState()`
  (`js/ux-improvements-state-sync.js`) already wrote and reapplied them —
  there was simply no UI that ever changed `page.title`/`page.summary`/the
  CTA to give them a non-empty value. This feature is that UI; it added no
  new persistence code for these three fields, only the click-to-edit
  interaction that mutates the in-memory page object the existing autosave
  already reads from.
- **`section_edits` is new, and it's derived, not accumulated.** A flat map
  on the review record, `field path -> current full value` (e.g.
  `{"sections.2.bullets": [...]}`). `computeSectionEdits()`
  (`js/inline-content-edit-data.js`) recomputes it from scratch on every
  autosave by diffing the live page object's `heading`/`paragraphs`/`bullets`
  against `window.ORIGINAL_DATA`, the same "read live state fresh every
  save" approach `edited_title` has always used — not an accumulated diff
  that a delete or a manual reset would have to separately reconcile. This is
  what makes "reset to original" correct by construction: once a field
  matches `ORIGINAL_DATA` again, the next `computeSectionEdits()` call simply
  omits its path from the map, with no deletion logic required anywhere.
- **Reapply reports rather than renders, and the caller owns the one
  follow-up paint.** `applyContentEditsToPageData()` — called once, from
  `applySavedPageState()` in `js/ux-improvements-state-sync.js`, alongside
  the pre-existing `updateMockupTextFromSavedState()` call — replays
  `section_edits` back onto the in-memory page object on every
  load/navigation/sync-pull/conflict-resolution path (all of which already
  funnel through that one function). It deliberately does NOT touch
  `edited_title`/`edited_summary`/`primary_cta` — those are
  `updateMockupTextFromSavedState()`'s job, and reapplying them twice would
  race two functions writing the same fields on every load. It also does not
  re-render: staying DOM-free is why it's dual-exported and Bun-importable
  with no browser, same as `js/review-merge.js`, so it returns a boolean —
  whether it actually wrote a path via `setByPath` — rather than reaching for
  `window.renderPage` itself. **That boolean exists because the obvious
  alternative (re-render unconditionally whenever reapply runs) is a live
  infinite loop, not a hypothetical one.** `window.renderPage` is already
  `js/ux-improvements.js`'s wrapper by the time `applySavedPageState` can
  run, so a follow-up render re-enters that wrapper, which schedules its own
  deferred `applySavedPageState` call for the same page — which would see
  the same still-true "wrote something" signal and trigger a second render,
  forever (disabling the guard that prevents this produced 17 renders before
  a test's own teardown interrupted it). The fix is the boolean plus a
  `refreshInFlightForKey` re-entrancy guard in
  `js/ux-improvements-state-sync.js`: at most one follow-up render per
  reapply, and the guard clears at the top of the very next
  `applySavedPageState` call for that key rather than immediately after the
  synchronous `renderPage()` call returns, since the reapply it's guarding
  against happens asynchronously (a View Transition or `setTimeout(0)`). The
  original design spec's persistence section did not anticipate this render
  lag at all — it assumed reapplying the data was sufficient — so this
  mechanism is a real fix discovered during implementation, not a restatement
  of the design.
- **No history entry per edit, same rule as every other keystroke-level
  field.** Every commit — a scalar edit, an add, a remove, a reset — folds
  into the existing debounced autosave (`saveCurrentPageToLocalStorage`),
  never `mergeReviewRecord`. The mockup re-renders immediately regardless;
  only the _recorded review round_ stays untouched.
- **Edited-field visibility uses two different mechanisms, deliberately.**
  A manually edited paragraph or bullet is stored as
  `{text, unverified: true, unverifiedReason: 'Manually edited during
review'}` — the existing object form `normalizeTextItem()` already handles,
  rendering the existing Unverified pill with zero renderer changes. Title,
  summary, heading, and CTA have no such schema slot (they're plain strings),
  so they get a separate CSS-only "Edited" badge
  (`css/inline-content-edit.css`) instead, applied as post-render DOM
  decoration by comparing the live value against `window.ORIGINAL_DATA` —
  never threaded into `renderHero()`/`renderSection()` as a parameter, which
  would put a reviewer-only annotation inside the escaping-audited render
  functions the AI-assist preview path also depends on staying pure.
- **Clicking a link inside an editable field opens the editor, and never
  navigates.** A `[data-rewrite-field]` element can contain a real
  navigating `<a href>` — the hero CTA when it renders as a link rather than
  an internal-target `<button>`, and any inline citation link
  `formatMarkdown()` turns a `[label](https://...)` markdown reference into,
  directly inside the paragraph/bullet text it belongs to. Without a guard,
  a click on either kind of link both opened the field's editor (the
  delegated click bubbling to the ancestor `[data-rewrite-field]`) **and**
  navigated in a new tab at once. `handleMockPageClick()` calls
  `event.preventDefault()` whenever the click target is inside a
  navigating anchor, scoped to that condition rather than a blanket
  `preventDefault()` on every click (which could interfere with normal
  focus/selection once the editor widget itself is open) — editing takes
  priority over leaving the review tool while the reviewer is trying to
  edit the very field the link sits in.
- **Per-field "Reset to original" is new, not a mirror of an existing
  pattern.** The only prior precedent is `restorePageContentFromOriginal()`
  (`js/review-state-sync.js`), and it's whole-page (title, summary, SEO
  fields, CTA all at once, via direct assignment) — there was no per-field
  reset anywhere in the tool before this feature. This feature's version is
  scoped to one field via `getByPath`(`ORIGINAL_DATA`)/`setByPath`, modeled
  on that function's shape but not calling it.
- **One-step undo on delete, mirroring `js/review-queue-undo.js`'s
  precedent** — not a confirm dialog, since that would interrupt the editing
  flow for what is usually an accidental click. Deleting a paragraph or
  bullet shows a toast with an Undo affordance; pressing it re-inserts the
  removed item at its original index and re-persists. One level, consumed on
  use — same reasoning as the queue's own undo: a stack would imply a
  reconstructable history the review state doesn't have. **Undo is scoped to
  the page it happened on, not carried across navigation:** the undo callback
  resolves "which page" via `getCurrentKey()` at click time, and no-ops if
  the reviewer has since navigated away — restoring onto the captured page
  object but persisting under whatever page is now current would silently
  corrupt that other page's save, and navigating back later would reapply
  the original page's still-stale saved `section_edits`, silently
  re-removing the item the reviewer thought they'd undone.
- **Emptying a list doesn't strand it.** `decorateListControls()` originally
  discovered "+ Add" anchor points only by walking already-rendered list
  items, so a `paragraphs`/`bullets` array reduced to zero items (via remove,
  or authored empty) rendered nothing and never regained an add control — a
  one-way door. It now also walks the live page's section arrays directly,
  anchoring the control to the section's heading (always present, per the
  schema) when there are no items left to anchor near.
- **CSV carries `edited_title`/`edited_summary`/`primary_cta`; it does NOT
  carry `section_edits`.** This is a real, documented limitation, not an
  oversight: the three page-level fields are flat strings and fit the
  existing CSV row model the same way `notes`/`decision` do
  (`js/manager-review-export.js`'s `MANAGER_REVIEW_RECORD_FIELDS`,
  `js/ux-improvements-export.js`'s `exportSavedLocalReviewsCsv`, and
  `js/review-queue-import.js`'s CSV import field list all carry them).
  `section_edits` is a nested object keyed by dot-path and does not fit a
  flat CSV row — it round-trips through the JSON backup path
  (`importReviewStateBackup` in `js/ux-improvements-export.js`) only, for
  free, since that path already merges through `mergeReviewRecord` with
  whatever fields a saved record happens to carry. **A CSV export/import
  cycle therefore preserves title/summary/CTA edits but silently drops
  section-level (heading/paragraph/bullet) edits.** Choose the JSON backup
  format when section-level edits matter to the round trip.
- **No AI, no backend, no capability gating.** Unlike AI assist and the sync
  backend, this feature has no `server.ts` dependency and needs no
  configuration — the click-to-edit affordance is present on every deploy,
  including the static Netlify build, the moment the page has loaded.

### Adding and deleting pages (`js/page-registry*.js`)

A reviewer can create a page mockup and delete an existing one from the browser.
Same posture as every other layer here: `pages/*.js` is never written, no backend
is involved, and it works on the static Netlify build. Three files, mirroring the
inline-content-edit split — `js/page-registry-data.js` (pure validation and the
in-place mutation, dual-exported like `js/review-merge.js`),
`js/page-registry.js` (the bootstrap plus the runtime add/delete/restore API on
`window.pageRegistry`), and `js/page-registry-ui.js` (the sidebar controls and
the Help list). No new stylesheet: the sidebar chrome lives in
`css/ux-improvements.css` and the Help list in `css/dashboard.css`, split by
surface so each selector is still declared in exactly one file.

- **`js/page-registry.js` runs BEFORE `js/state.js`, and that is the load-order
  fact the whole feature rests on.** `js/state.js` imports it in place of
  `js/page-data.js` (which it imports first itself), so the module graph enforces
  the order rather than `js/main.js` doing it by convention. `ORIGINAL_DATA` is a
  one-time deep clone taken in `js/state.js`, and `computeSectionEdits()` returns
  `{}` when a page has no entry in it — so a page added after that clone would
  accept an inline paragraph edit, autosave it, and silently lose it on the next
  load. Applying the registry first puts added pages inside the clone for free;
  a page added mid-session gets `window.ORIGINAL_DATA.pages[key]` seeded
  explicitly, from a **deep clone**, because an alias would make every later
  diff come back clean. Running early also means `js/app.js`'s import-time
  `init()` resolves a `?page=` deep link to an added page instead of toasting
  "not a page in this mockup".
- **Storage is `state.globals.page_registry`, as keyed objects rather than
  arrays.** `globals` is the one slot both review-state validators copy through
  untouched (a shallow spread in `js/review-state-validation.js`,
  `.passthrough()` in `build_scripts/review-state-schema.js`), so the feature
  needs no validator change and **no storage-version bump** — a bump makes
  `readLocalState()` discard every reviewer's local state. Not `state.pages[key]`:
  `sanitizeReviewRecord` drops anything outside its closed field whitelist, so a
  page object stored there would vanish on the next read. Keyed maps rather than
  arrays because merging two of them is a spread that unions keys, where two
  arrays would concatenate and duplicate every entry on the first import.
- **The corollary is that nothing upstream validates the blob**, so
  `applyRegistryToData()` re-validates every entry itself and **drops what fails
  rather than throwing**. This is not defensive habit: the function runs at the
  root of the module graph, so a throw takes every later module with it and
  leaves the reviewer looking at `index.html`'s static "Loading…" placeholder —
  with no UI left to remove the entry that broke it. Recovery is the sidebar's
  **Clear saved reviews** button, which is why that button now clears the
  registry and reloads (see below).
- **Delete means hide, and it is reversible.** Uniform across both kinds of page:
  an added page keeps its object in `registry.added`, an authored one comes back
  from its own source module on the next load. The review record is never
  touched, which is what makes Restore worth having. `pestsTopic` is refused
  outright — `bun run validate` requires it to exist and be first, and it is the
  fallback key in `resolvePageKey`, `getCurrentKey`, `js/state.js`, `js/app.js`
  and the hardcoded parent link on every other page. Emptying `order` is refused
  too.
- **A hidden page leaves `order` AND `HHVC_PAGES`.** Leaving it in `pages` is the
  subtler bug: with no `<option>` in the picker, `getCurrentKey()` falls back to
  `'pestsTopic'`, so every later review write for that page is filed under the
  wrong key. Removing it also makes the queue's selection paths self-heal, since
  `getSelectedKeys`/`pruneSelection`/`toggleSelected`/`getActionTargets` all
  already gate on `DATA.pages[key]`. Restore splices the stashed `[key, label]`
  tuple back at its **original index** — `order` is the reviewer's reading order
  and drives `j`/`k` navigation, the queue, the picker and batch PNG export, so
  appending would silently permute the site.
- **Deleting the page on screen needs an explicit sequence, and the failure it
  avoids is review-data loss.** `reviewFormPageKey` (`js/ux-improvements.js`)
  stays pinned to the deleted key until the follow-up navigation settles, so an
  autosave landing in that window calls `collectCurrentPageReviewState(key)`
  where `DATA.pages[key] || {}` makes `page_title`, `edited_title`,
  `edited_summary` and `section_edits` all resolve empty — rewriting the record
  with exactly the content Restore exists to bring back, blanked. So
  `deletePage()` flushes first (via the newly published
  `window.ReviewUx.flushPendingPersist`), then mutates, then rebuilds the picker,
  then navigates through the **wrapped** `window.renderPage`. Flushing rather
  than discarding: those keystrokes are real edits to the page being deleted, and
  at flush time that page still exists, so the save is well formed — and it
  leaves `pendingPersist` false, making the wrapper's own pre-navigation flush a
  no-op instead of a second write.
- **It also consumes the queue's one-step undo.** `undoLastAction` is the only
  queue path that does NOT filter on `DATA.pages`, so a snapshot taken before a
  delete would still offer "Undo Approved · N pages" and then write a record for
  a page that is gone, with a count that is a lie.
- **The delete confirmation counts inbound links, because the consequence is
  otherwise invisible.** Once `pageData[card.target]` stops resolving,
  `cardDescription()` falls through to `return card.text ?? ''` — so every
  inheriting card pointing at the deleted page starts printing the authored text
  that the whole card-inheritance change exists to prove can never publish.
  Nothing errors; a plausible paragraph simply appears on a page the reviewer was
  not looking at. `cardTitle()` reverts to the stale authored title the same way,
  and clicking such a card raises a red "Unknown page key" banner that reads as
  corruption for a state the reviewer created on purpose. `countInboundLinks()`
  counts `card.target` and section/step `buttonTarget` references and the dialog
  names them.
- **`js/review-ops.js`'s `siteKeys()` counts a deleted page as still known.** Its
  record is not orphaned — it is what Restore returns — so listing it under
  "Records for pages that no longer exist" would put a delete button in front of
  a review one click from recovery. The widening is skipped when the key set is
  empty, because empty means page data has not loaded and
  `findOrphanedRecords()` reads that as "report nothing"; adding keys to an empty
  set would defeat that guard.
- **The import path applies the registry BEFORE its `entries` filter.** That
  filter requires `DATA.pages[key]`, so otherwise every imported review record
  belonging to an added page is dropped silently and the reviewer is told
  "imported N reviews" with no pages to show. The apply persists through its own
  `reviewState.update`, which is what keeps the existing `reviewer`/`owner`
  `globals` allowlist safe to leave alone: `updateLocalState` re-reads state, so
  the `...state.globals` spread carries the merged registry forward. Local wins
  on a key collision. The "no reviews matching the current page list" early
  return is also relaxed, since a backup can legitimately carry pages and no
  matching reviews.
- **Clear saved reviews now reloads.** It removes the storage key, and
  `js/page-registry.js` has already mutated `window.HHVC_DATA` from that key —
  so without a reload the added pages stay in `order` and the picker while the
  registry explaining them is gone, leaving the Help list empty and Restore
  impossible, and the added pages vanishing silently on the next load. The reload
  is what un-mutates `HHVC_DATA`, and it is also what makes this button the
  recovery path for an unusable registry.
- **No undo toast, deliberately.** `showToast` self-dismisses after 4s and its own
  docblock argues that anything needing longer belongs in a persistent control —
  which is why the queue's undo sits in the bulk bar. The Help list's Restore
  **is** that control, and a second printing of the same affordance is what the
  UX-review notes above say to resist.
- **The new-page form asks only for the six fields the schema requires**, plus
  the key and an optional slug. Everything else is filled in afterwards with the
  click-to-edit inline editing that already exists; duplicating that here would
  be a second, worse editor. The starter section carries a non-empty `karl` note
  saying no Karl block has been chosen — required on every section by
  `build_scripts/schema.js`, and the one section field that is optional on cards,
  callouts and images, so it is exactly the one a generated section forgets. It
  also carries `open: true`, because a Transaction page renders its body sections
  as accordions and a brand-new page whose only content is collapsed reads as an
  empty page.
- **`type` is constrained to the five the picker groups by**, which is
  deliberately narrower than `build_scripts/schema.js` (bare `min(1)`). Authored
  pages legitimately use `Agency` and `Report` and land in the Information
  optgroup; a reviewer choosing from a `<select>` should not be able to create
  that mismatch by accident.
- **A page key is constrained to `/^[A-Za-z][A-Za-z0-9]*$/` and rejects
  `__proto__`/`prototype`/`constructor`.** The key becomes an object property on
  `window.HHVC_PAGES`, an `<option>` value and a `?page=` parameter.
  `js/ui-controls.js:128` also now escapes it — that was the one place in the
  codebase interpolating a page key into `innerHTML` raw, safe only while every
  key was hardcoded in a source file.
- **Uniqueness is checked against `HHVC_DELETED_PAGE_ALIASES` too.** An added key
  shadowing a retired one is harmless to `resolvePageKey` (it checks `pageData`
  first), but it silently redirects a legacy shared link to content its author
  never wrote — worse than the consolidation redirect it replaced.
- **A deleted page KEEPS its `ORIGINAL_DATA` snapshot, and restore never
  re-seeds one that exists.** This is the sharpest edge in the feature and it was
  wrong first time round. Restore used to re-seed the pristine snapshot from the
  stashed page object — which for a mid-session delete is the _already edited_
  live object. That makes "original" equal "edited", so `computeSectionEdits()`
  finds no difference, the next autosave recomputes `section_edits` as empty, and
  every heading, paragraph and bullet edit the reviewer made is dropped from
  storage. "Reset to original" resets to the edit. Nothing errors at any point.
  So `deletePage()` leaves the snapshot alone (a snapshot for a temporarily
  absent page costs nothing) and `seedOriginalDataIfMissing()` only ever fills a
  gap — the gap being a page hidden in an _earlier_ session, whose stashed copy
  is pristine because no edits had been applied when the boot-time hide captured
  it. Only `removeAddedPage()` drops a snapshot, because only there is the page
  gone for good. Mutation-proven by
  `tests/e2e/page-registry.spec.js`'s "an inline edit survives delete and restore
  of the same page", which was confirmed to fail against the overwrite.
- **Restore positions against a canonical key sequence, not a remembered
  index.** The index recorded at hide time is measured against an order that
  earlier hides have already shortened, so two hides can record the _same_
  number: delete B then C from `[A,B,C,D]` and both stash index 1. Restoring them
  yields `[A,C,B,D]` — the reviewer's reading order silently permuted, which is
  what drives `j`/`k`, the queue, the picker and batch PNG export.
  `restoreOrderIndex()` instead inserts before the first canonical successor
  currently present, which is order-independent; `applyRegistryToData()` learns
  that sequence between its add and hide passes so it describes the whole site
  rather than what is left of it.
- **The JSON import admits a key the registry knows, not just one in
  `DATA.pages`.** `applyImportedRegistry()` runs first and removes the backup's
  deleted pages, so a presence-only filter drops exactly the reviews a reviewer
  deleted a page _without_ losing — and restoring it afterwards hands back the
  mockup with no review attached. `window.pageRegistry.knownKeys()` is what
  widens the filter.
- **An import that deletes the open page has to navigate, not just repaint the
  picker.** Otherwise `#mockPage` still shows the deleted page while
  `#pageSelect` has moved on, and the import's own
  `applySavedPageState(getCurrentKey())` patches that stale DOM and files later
  edits under the replacement key — the same mismatch `deletePage()` guards,
  reached through import instead of a button.
- **`restorePage()` clears the persisted `hidden` flag last.** Clearing it first
  means a restore that cannot materialise the page returns an error having
  already recorded the page as not hidden: the row disappears from the Help
  list while the page is still absent from the mockup, leaving the reviewer no
  control for it at all. The one exception is the no-stash branch, which must
  clear the flag before `applySavedRegistry()` because that reads the persisted
  registry — and it puts the flag back if the page still fails to appear.
- **A page key may not be any name inherited from `Object.prototype`, and
  presence checks use `hasOwn`.** `toString`, `valueOf` and `hasOwnProperty` all
  satisfy the key pattern and are invisible to `Object.keys()`, so the collision
  check called them free — and then `data.pages.toString` resolved to the
  inherited _function_, which is truthy, so the "already present, skip" branch
  fired, the page was never inserted, and `addPage()` reported success and asked
  `renderPage()` to display a function. Measured, not theorised. The unsafe-key
  set is derived from `Object.getOwnPropertyNames(Object.prototype)` rather than
  written out so it cannot fall behind the runtime.
- **Restore leaves the picker on the page actually being shown.** Selecting the
  restored key without rendering it is `deletePage()`'s mismatch pointing the
  other way: `getCurrentKey()` returns the restored key while `#mockPage` still
  shows the previous page, so the next note is filed under the restored page —
  and the reviewer cannot navigate to it, because the picker already claims it is
  current. Restoring from a panel in Help should not yank the mockup either.
- **`exportSavedLocalReviewsCsv()` iterates `order` PLUS the registry's known
  keys.** A deleted page keeps its review — that is what Restore hands back — but
  it leaves `order`, so iterating `order` alone silently dropped those reviews
  from the CSV. Its page metadata falls back to the record's own
  `page_title`/`page_type`/`url_slug` rather than `{}`, which would have made
  `defaultSeoTitle()` emit the literal "undefined | San Francisco".
- **An added key that is really an authored page is refused, not adopted.** An old
  backup can carry `added.foo` for a key that has since shipped in `pages/*.js`.
  `applyRegistryToData()` reports it in `collided` rather than passing over it,
  because the same "a page already occupies this key" condition also covers a
  harmless idempotent re-apply — only the caller can tell them apart, which is why
  `js/page-registry.js` captures the authored-key set from `DATA.pages` BEFORE the
  registry has ever run. Without that distinction the Help panel presents an
  authored page as reviewer-created and Remove deletes it from the live mockup, so
  `listAdded()` filters authored keys out and `removeAddedPage()` refuses them.
- **`updateRegistry()` verifies the write by re-reading it.** `reviewState.update()`
  cannot fail loudly: `writeLocalState()` catches the `setItem` exception itself
  (storage disabled or quota exhausted), shows the global error banner, and
  returns normally. A caller trusting it would mutate live page data, report
  success and toast "Added" for a page that is gone on the next reload — so
  `addPage()`/`deletePage()` abort before touching anything when the write did not
  land.
- **`isValidPageObject()` checks the optional structure too, not just the required
  six.** `sections: {}` satisfied every required-field rule, and
  `partitionSections()` does `(page.sections || []).entries()` — a plain object is
  truthy, so the `|| []` never fires and `.entries` is undefined. That is a
  TypeError at render time, reachable at startup from a saved `last_page_key` or a
  `?page=` deep link, which is precisely the fatal-throw-on-the-boot-path the
  drop-don't-throw posture exists to avoid. The added checks match
  `build_scripts/schema.js` exactly (a section requires `heading` and `karl`
  there), so they cannot reject a page CI would accept.
- **The delete confirmation counts INLINE markdown links too, not just cards and
  buttons.** `formatMarkdown()` turns `[label](pageKey)` into a real
  `data-render-target` navigation control, so a page can be linked to entirely
  through prose — and counting only structured targets reported "nothing links
  here" for exactly those pages, which is the dialog failing at the one job it
  has. `countInboundLinks()` scans paragraphs, bullets, table cells, callouts and
  step text, in both the bare-string and `{text}` forms.
- **`restorePage()` rolls the live restore back when the persist fails.**
  Reporting success while the stored registry still says "hidden" is the worst
  available outcome: the page is in the mockup now and gone again after a reload,
  with the reviewer told it was restored. Leaving it deleted is at least the state
  that survives, so a failed write undoes the `order`/`pages` mutation, puts the
  stash entry back, and returns the storage-failure message.
- **`isValidPageObject()` validates the ARRAY-typed section fields too.** The
  section guard originally stopped at `heading`/`karl`, so `paragraphs: {}` still
  passed and `paragraphList()` mapped over it — the same render-time throw a
  non-array `sections` caused, one level deeper. `SECTION_ARRAY_FIELDS` names the
  five (`paragraphs`, `bullets`, `cards`, `table`, `steps`); all five are arrays
  in `build_scripts/schema.js`, so requiring it rejects nothing CI accepts.
- **Limitations, documented rather than fixed.** An added page travels in the
  **JSON backup only**; CSV has no column for a page object, mirroring the
  existing `section_edits` limitation. Sync is subtler: `pushAllPages` iterates
  `Object.keys(state.pages)` unfiltered, so an added or deleted page's review
  **record does get pushed**, but `pullFromServer` skips keys with no live page
  and `server.ts` always returns `globals: {}` — so the **registry itself never
  syncs**, and the receiving browser gets a record with no page to attach it to.
  `bun run validate` never sees any of this; the browser-side check stands in
  for it. Not in v1: emitting a committable `pages/<key>.js` source module (the
  AI-assist panel's `buildPageModuleSource()` is the thing to model it on), and
  reordering `order` from the UI.

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
any of these modules, or to `js/review-merge.js`, must be verified against the
round trip itself before being called done:** export a snapshot, re-import it,
and confirm existing decisions/notes are still present rather than wiped.

**Two e2e specs cover this, and the split between them is the interesting
part.** Both drive the real UI (export button clicks, file-input imports),
because `review-import-export.spec.js` — once described here as the API-level
half — was deleted for not doing so: it hand-rolled the merge inside
`page.evaluate` instead of calling `importReviewStateBackup()`, so it stayed
green against the wholesale replace that destroyed reviews once already.

- **`tests/e2e/import-export.spec.js`** — both directions end to end, asserting
  `history.at(-1).updated_by === 'import'`, which is what proves merge rather
  than wipe. Its merge tests seed state through `seedState()` (a direct
  `localStorage` write, so the export path never runs), and its round-trip test
  clears state before re-importing, so nothing is left for a wipe to destroy.
- **`tests/e2e/merge-verification.spec.js`** — the shape that misses, and the
  one the warning is actually about: re-importing an **older snapshot on top of
  live state that has moved on**. A page reviewed after the export is absent
  from the file, so a wholesale replace drops it. Everything routes through the
  sidebar fields and the real buttons; nothing touches review state directly.

Nothing can unit-test this path today: both modules are browser-only, with no
`module.exports` to import from Bun. **A green CI run is evidence for those two
scenarios and nothing else on this path** — anything a change puts at risk
outside them is still yours to verify by hand.

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
- **Auth**: see [Optional API access hardening](#optional-api-access-hardening).
  The legacy token remains broad for compatibility; production deployments
  should use per-token principals and grant only `review:read`/`review:write`
  to sync reviewers.
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
  mounted, `DATA_DB_PATH` pointed at it, and either a generated
  `REVIEW_API_TOKEN` or the documented `REVIEW_API_PRINCIPALS` secret
  configuration (never committed). Apply the reverse-proxy/identity-aware edge
  control described above for public or replicated deployments. Local dev and
  Netlify's static-only deploy (`build:netlify`, no server runtime for these
  routes) are unaffected either way.
- **Tests**: `tests/review-merge.test.js` (unit) and
  `tests/review-api-server.test.js` (spawns `server.ts` against a temp SQLite
  DB, exercises auth/merge/isolation over real HTTP).

### AI assist backend (optional)

`server.ts` also hosts an optional content-drafting API under `/api/ai/*`,
backed by `build_scripts/ai/`. Same posture as the sync backend: additive, off
by default, failing closed.

- **Two independent gates.** The shared optional API authorization
  configuration described above (legacy `REVIEW_API_TOKEN` or
  `REVIEW_API_PRINCIPALS`) decides whether the API exists; no configuration
  makes every actual `/api/ai/*` route 501. A CORS `OPTIONS` preflight remains
  unauthenticated because browsers cannot attach the bearer header to it, but
  it must pass the exact-origin policy and grants no role. `ai:generate` is
  required for every AI route. `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` decides
  whether generation works; unset makes `generate` and `models` 501 while
  `capabilities` still answers. That asymmetry is deliberate — `capabilities`
  is the browser's discovery endpoint, and a 501 there cannot be told apart
  from "no server at all".
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
  that back. The Content-Length pre-check stays as a cheap first pass, but **it
  triggers at the DRAIN limit (8× the cap), not at the cap** — answering from it
  means never touching `req.body`, leaving the client's payload unread in the
  socket and corrupting the very next request on that keep-alive connection.
  That is the same failure the drain branch below prevents, reached from the
  other direction; it surfaced as a 431 (Bun reading leftover body bytes as a
  header block) on whichever test ran next, and it is why the pre-check must
  stop short of the range `readBodyWithLimit` handles cleanly. Between the cap
  and the drain limit, falling through costs one drain and returns the identical
  413 with the connection intact. The count
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

  **One test in that file carries a bounded retry and a 20s budget, and both are
  load-bearing** (fixed on `main` in #106). The Content-Length pre-check answers
  413 with `Connection: close` while the client's declared body is still
  unsent — correct, since the socket genuinely cannot be reused — but Bun's
  `fetch` returns that socket to its keep-alive pool anyway, and the next
  same-origin request that draws it **stalls rather than erroring**. That is why
  a catch matching only `ECONNRESET` never fired: there is no error to catch, so
  the request never settled, the test burned its whole default 5s budget, and
  bun tore down the spawned server — cascading `ConnectionRefused` into the other
  21 tests in the file. One root cause, 21 collateral failures, and the whole
  thing read as a dead server for four consecutive red runs on `main`.

  It was never a dead server. Measured against the same wedged process: a raw
  socket gets `HTTP/1.1 413` with `Connection: close` and the server serves the
  next connection normally, and a request to the `localhost` spelling (a
  different pool key, same server) answers 200 immediately. So the fix belongs on
  the client side of the test — `AbortSignal.timeout()` bounds the poisoned
  attempt, the catch matches a hang as well as a reset, and the test's own budget
  has to exceed that timeout or it dies mid-retry and still looks like a server
  failure. Do not restore the default 5s budget, and do not narrow the catch back
  to `ECONNRESET`.

### RAG knowledge base (optional)

`compliance-audit` is a second `/api/ai/generate` task alongside `content`: a
grounded compliance audit of the open page, citing this repo's own
`docs/source/` corpus instead of the model's unaided judgment. Same posture as
the rest of the AI backend — additive, off unless configured, fails closed,
never writes anything, and every result carries the same `disclosure` string.

- **Corpus is `docs/source/**/*.md`, `README.md` excluded, publication status
  not filtered.** `build_scripts/ingest-knowledge.js` globs the whole tree
  except folder-index `README.md` files — including the one file named
  `DRAFT-NOT-FOR-PUBLICATION`, on an explicit reviewer decision. The
  alternative was the ingestion script silently deciding what counts as
  citable, which is the failure mode this feature exists to avoid.
- **One new table, same database as `review_pages`.** `knowledge_chunks`
  lives in the same `DATA_DB_PATH` SQLite file — one connection, one volume —
  rather than a second DB to configure. `build_scripts/knowledge-schema.js` is
  the single table definition shared by the write path
  (`build_scripts/ingest-knowledge.js`) and the read path
  (`build_scripts/ai/knowledge-retrieval.js`), so the two processes cannot
  disagree on the schema, and ingestion never assumes the server ran first.
- **Chunking splits on headings, then on size.**
  `build_scripts/knowledge-chunking.js` splits on `##`/`###` headings, then
  sub-splits anything over 500 words at paragraph boundaries with a 50-word
  overlap, and prefixes every chunk with its heading path before embedding —
  so a boundary fact keeps its context and a chunk carries its own section
  location with no join back to the source file needed.
- **Embeddings are Gemini-only** — Anthropic has no embeddings API — so
  `compliance-audit` needs `GEMINI_API_KEY` even on a deployment generating
  with Claude. Default model `gemini-embedding-001`, overridable via
  `GEMINI_EMBEDDING_MODEL`. (Was `text-embedding-004` until a real `bun run
ingest` run 404'd on it — retired; verify against `client.models.list()`
  filtered to `embedContent` support, not a doc example, before trusting any
  hardcoded id here again.)
- **Retrieval is brute-force cosine similarity in JS, not a vector-index
  extension.** `build_scripts/knowledge-search.js` ranks the full corpus
  (~150-200 chunks) by cosine similarity in microseconds at this size; a
  loadable extension like `sqlite-vec` would buy nothing here and adds a
  native-binary deployment risk against Railway for no benefit. Dual-exported
  like `js/review-merge.js`, so ranking is tested against synthetic embeddings
  with no live Gemini call and no live DB.
- **Re-ingestion is idempotent per file, and always full.** `bun run ingest`
  deletes and reinserts each file's rows in one transaction, reprocessing
  every file on every run rather than diffing — so a re-run after editing
  `docs/source/` or changing `GEMINI_EMBEDDING_MODEL` is always safe, and no
  stale mix of two embedding models can accumulate. Manual, like
  `bun run export` — not part of `bun run build`, since it needs a real
  (billed) Gemini call CI must not make.
- **`GET /api/ai/capabilities` reports `knowledgeBase: {ready, chunkCount}`**
  so the browser can distinguish "no Gemini key" from "key present, nobody's
  run `bun run ingest` yet" — different states, different copy.
- **Citations are checked against the retrieved set, not accepted as free
  text.** Findings cite chunk ids (`${source_file}#${chunk_index}`), not a
  restated source/heading — the failure mode this guards against is a
  plausible-sounding citation that was never actually retrieved.
  `build_scripts/ai/validate-compliance-audit.js`'s `findInvalidCitations()`
  checks every cited id against what was retrieved for that request, and
  rejects an empty `citedChunkIds` too. A bad citation triggers one retry
  naming the specific finding and id; a finding still bad after that retry is
  returned anyway (same "always resolves with the draft" rule as `content`)
  but flagged `valid: false` with the bad id in `issues`. The
  `source_file`/`heading_path` shown to a reviewer is resolved server-side
  from the matched row, never echoed from the model.
- **The route gates on knowledge-base readiness separately from the generic
  no-provider gate.** `hasConfiguredProvider()` still gates first, same as
  `content`; past that, `compliance-audit` checks Gemini-configured **and**
  `knowledge_chunks` non-empty, answering 501 with which half is missing.
  `generateComplianceAudit()` (`build_scripts/ai/compliance-audit.js`) is a
  sibling to `generateContent()`, not a generalization of it — its own retry
  loop, rather than bending the existing task's machinery to fit a second,
  structurally different validator.
- **Never writes anything**, same as `content` — no filesystem, no
  review-state write, no `pages/*.js` mutation, and every successful audit
  carries the same `disclosure` string for the same §1.11/AI-disclosure
  reasons.
- Full design rationale, including what was deliberately left out (a
  corpus-wide embedding-model table, a task-dispatching registry refactor of
  `generateContent()`), is in
  `docs/superpowers/specs/2026-08-07-rag-knowledge-base-design.md`.

### AI rewrite (optional)

A floating button that appears when a reviewer selects body copy in the mockup,
offering an AI rewrite of the containing field. `js/ai-rewrite.js` is the
orchestrator (selection, request lifecycle, apply/undo), `js/ai-rewrite-render.js`
the view (button, popover, positioning), and both ride the existing
`window.AiAssist.client`. Same posture as the rest of the AI surface: additive,
invisible unless `/api/ai/*` is configured, and it never writes to `pages/*.js`.

- **The selection picks the FIELD, not the substring.** `formatMarkdown()`
  escapes HTML and rewrites `[label](target)` into elements, so a DOM offset
  does not map back to an offset in the source markdown, and a selection
  spanning two elements has no coherent splice. The whole containing
  paragraph/bullet is sent and replaced; the popover shows it in full so the
  scope of the change is visible before the request, not after. The field text
  is read from page data via `getByPath`, never from `textContent` — the latter
  is rendered output.
- **`data-rewrite-field` paths use the ORIGINAL `page.sections` index.**
  `partitionSections()` redistributes sections into seven role buckets rendered
  in a fixed layout order, so render order is not source order. The index is
  captured onto a render-time shallow copy (`__sectionIndex`) inside that loop;
  a path built from render order rewrites the wrong section, silently. The
  regression test for this is mutation-proven — it was confirmed to FAIL against
  a deliberately render-order-broken renderer, because its first version's
  negative assertion passed trivially and proved nothing.
- **Annotation is opt-in per call site.** `paragraphList`/`bulletList`/
  `renderSteps` emit nothing without a path prefix, which is how the v1 scope
  (paragraphs, bullets, step text — not cards, tables, callouts, `whatToKnow`
  or spotlight) is expressed. Widening it is passing a prefix at one more call
  site, not editing the renderers.
- **`getByPath`/`setByPath` reject `__proto__`/`prototype`/`constructor`.**
  Without that, `setByPath(obj, '__proto__.x', v)` walked onto `Object.prototype`
  and wrote through it, polluting every plain object in the app — confirmed by
  exploit probe. These take paths straight from DOM attributes, which devtools
  can edit, so this is not hypothetical. `setByPath` also never creates
  intermediate objects: it returns `false` rather than inventing page structure
  no schema validated.
- **An applied rewrite is flagged `unverified: true`** with the reason
  "AI-rewritten draft — verify before publishing", reusing the schema's existing
  pill rather than a new AI-specific flag, so AI-touched copy is distinguishable
  from human-authored copy at a glance in the mockup itself. Undo is one step
  and consumed on use, matching `js/review-queue-undo.js`.
- **The popover's position is clamped unconditionally.** Anchoring below the
  selection (and flipping above) is a preference, not a guarantee: the mockup
  runs ~8,800px, so a selection below the fold yields a `rect` outside the
  viewport and BOTH anchors land off screen. An earlier version relied on
  `max-height: 70vh` plus internal scrolling, which bounds how tall the popover
  is and not where it sits — the Rewrite/Apply buttons rendered unclickable,
  reported by Playwright as simultaneously "visible, enabled and stable" and
  "outside of the viewport".
- **`generateRewrite()` is a SIBLING of `generateContent()`, not a
  generalization of it.** `generateRequestSchema` is a discriminated union on
  `task` because the branches genuinely differ — `content` requires `prompt`,
  `rewrite-field` requires `fieldText` and declares none. Folding the two into
  one dispatcher would risk the page-draft path for no gain. Note Zod's
  `z.object` STRIPS unknown keys rather than rejecting, so a stray `prompt` on a
  rewrite request is dropped, not a 400.
- **The validator checks link TARGETS, not whole links.** Rewording a link's
  visible label is the point of the feature; changing or dropping its target is
  a content regression nothing else would catch, so every dropped target is
  named back to the model for the existing one-retry loop.
- **`tests/e2e/ai-rewrite.spec.js` is the only layer that can cover this.**
  Both modules are browser-only IIFEs with no `module.exports`, so there is no
  unit layer beneath the e2e spec — the same structural gap the CSV/JSON import
  round-trip has.

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

**The nine stylesheets, in `js/main.js` import order** (`css/theme.css` MUST
stay last — it is the semantic token layer, and its dark-mode block overrides
the `--sfds-*` primitives `css/styles.css` declares on `:root`):

| File                          | Owns                                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| `css/styles.css`              | the mockup itself, plus the raw `--sfds-*` primitives                                          |
| `css/ux-improvements.css`     | the review layer's own chrome — the designated `!important` override sheet                     |
| `css/ai-assist.css`           | the AI assist panel                                                                            |
| `css/dashboard.css`           | the `.ds-*` primitives and the workspace shell, tabs, KPI tiles, progress bar and status chips |
| `css/review-insights.css`     | the Overview cards and the failing-checks ranking                                              |
| `css/review-ops.css`          | the stored-review-data panel                                                                   |
| `css/ai-rewrite.css`          | the floating selection button and the rewrite popover                                          |
| `css/inline-content-edit.css` | the inline click-to-edit widgets, Edited badge, add/remove/reset controls                      |
| `css/theme.css`               | **the semantic token layer** — surfaces, type scale, status/decision colours, dark mode        |

Retheming should mean editing `css/theme.css` only. A component rule that needs
a colour, a size step or a radius takes a semantic token; it should not reach
for a raw `--sfds-*` value, and it must never hardcode a literal — every
dark-mode contrast bug this repo has had came from a literal sitting where a
token belonged.

**The mockup's own type scale is the documented exception to that rule.**
`h1`–`h4` in `css/styles.css` carry literal sizes (`clamp(2.2rem, 4vw, 4rem)`,
`clamp(1.6rem, 2.6vw, 2.25rem)`, `1.25rem`) rather than tokens, and should stay
that way: they mirror what SF.gov actually renders, so they describe the page
under review rather than this tool's chrome. A retunable token would let a
reviewer change the apparent size of the thing they are being asked to judge —
the same argument that docks the workspace at 1700px instead of squeezing the
mockup. Tool chrome has its own scale in `css/theme.css` (`--ds-text-panel`,
`--ds-text-card`, `--ds-text-label`, `--ds-text-micro`) and should use it. Note
those are named `--ds-text-*`, not `--*-size-*`; grepping for "size" or "scale"
misses them and makes the type scale look absent when it is not.

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
- Adding/deleting page mockups → `js/page-registry-data.js` (pure validation +
  the in-place `order`/`pages` mutation), `js/page-registry.js` (the bootstrap,
  which MUST stay imported by `js/state.js` so it runs before the `ORIGINAL_DATA`
  clone), `js/page-registry-ui.js`.
- RAG knowledge base → `build_scripts/knowledge-chunking.js`,
  `build_scripts/knowledge-search.js`, `build_scripts/knowledge-schema.js`,
  `build_scripts/ingest-knowledge.js`, `build_scripts/ai/knowledge-retrieval.js`,
  `build_scripts/ai/compliance-audit.js`, and
  `build_scripts/ai/validate-compliance-audit.js`.
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

## Agent skills

### Issue tracker

GitHub Issues via the `gh` CLI (`origin` is
`github.com/ohdaveed/HHVC_manager_review_current_tool_package`). See
`docs/agents/issue-tracker.md`.

### Domain docs

Single-context — one `CONTEXT.md` + `docs/adr/` at the repo root (neither
exists yet; created lazily by `/domain-modeling`). See
`docs/agents/domain.md`.

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
