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

The repo currently holds **19 pages** under `pages/`. If `bun` isn't on
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
bun run test                  # bun test over the 15 unit-test files in tests/ (371 tests)
bun run test:e2e              # playwright test (11 specs in tests/e2e/)
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
wrong). `bun run test` runs fifteen Bun unit-test files under `tests/`:
`utils`, `data-validation`, `page-render`, `csv`, `review-state-schema`,
`reading-level`, `plain-language`, `page-import-checks`, `mockup-image-export`,
`review-merge`, `review-api-server` (which spawns `server.ts` as a subprocess
against a temp SQLite DB and exercises auth/merge/isolation over real HTTP),
`review-state-sync`, `ai-assist-schema`, `ai-assist-env`, and `ai-assist-server`
(which spawns `server.ts` against a stub Anthropic endpoint, so the AI routes
are covered without a key or a paid call) — 371 tests at time of writing.
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

`bun run test:e2e` drives Playwright over `tests/e2e/` — eleven spec files:
ten UI-driven (navigation, editor panel, review workflow, review queue,
import/export, keyboard shortcuts, sitemap/workspace, accessibility, AI assist,
PNG export) plus the original API-level `review-import-export` round-trip,
sharing plain helper functions in `tests/e2e/helpers.js` (no fixture framework).
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
  `js/ux-improvements*.js`, `js/review-queue*.js`, `js/interactive-sitemap*.js`,
  `js/dashboard-guidance.js` and `js/keyboard-shortcuts.js` take no imports and
  talk to each other through `window.<Namespace>` objects, so they must run
  after the core modules that create those namespaces. Their sequence in
  `js/main.js` is load-bearing and is still reviewed by hand.

**Some functions are deliberately published onto `window`.** Under the old
shared scope every top-level function was implicitly a `window` property, and
several callers still rely on that rather than importing:

- `window.renderPage` (`js/page-render.js`) — three modules wrap it to refresh
  after navigation (`js/manager-review-export.js`, `js/ux-improvements.js`,
  `js/interactive-sitemap.js`). The decorator chain only forms if the original
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

- **`js/utils.js`** — shared helpers (`escapeHtml`, `getPrimaryCta`,
  `setPrimaryCta`, `today`, `csvEscape`, `toCsv`, `downloadFile`, `debounce`,
  `throttle`), exposed as `window.utils` and as bare top-level functions.
  Loads first; **add new cross-cutting helpers here** rather than duplicating
  logic.
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
  snapshot; monkey-patches `renderPage` to refresh the review page label
  after render (handles the case where `renderPage` returns a Promise under
  View Transitions).
- **`js/reading-level.js`** — browser-safe Flesch-Kincaid grade level for body
  copy, no Node deps. `build_scripts/reading-level.js` is the Node/Bun
  counterpart (backed by `text-readability`) used for parity checks in tests.
- **`js/review-state-validation.js`** — browser-side validation of the
  `hhvcManagerReviewState:v1` blob, mirroring
  `build_scripts/review-state-schema.js`'s Zod rules without shipping Zod to
  the browser. Keep the two in step when the persisted shape changes.

### Review/UX layers are additive, on top of the core

`js/ux-improvements.js` (sticky review bar, workspace tabs, Karl compliance
scorecard), `js/review-queue.js` (cross-page review queue/progress),
`js/dashboard-guidance.js` (consolidates sidebar helper copy into the Help
workspace tab, hiding duplicated sidebar text at runtime without deleting
HTML), `js/interactive-sitemap.js` (clickable sitemap reading from
`HHVC_DATA`, lazy-rendered when the Sitemap tab opens), and
`js/keyboard-shortcuts.js` (global shortcuts, ignored while typing in form
fields) are each self-contained IIFEs that read `window.HHVC_DATA` and
`localStorage`. Some (e.g. `js/ux-improvements.js`, when restoring saved
edits) do write edited title/summary/CTA/SEO fields back onto the **in-memory**
`pageData` objects — but **must never write back to the `pages/*.js` source
files or publish content**; they are review aids only, not publishing tools.

`js/ux-improvements.js`, `js/review-queue.js`, and `js/interactive-sitemap.js`
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
- **`window.InteractiveSitemap`** (`js/interactive-sitemap.js`'s orchestrator)
  ← `js/interactive-sitemap-data.js` (graph/data building from `HHVC_DATA`)
  and `js/interactive-sitemap-render.js` (DOM rendering, search/filter UI).
  Its styles live in `css/interactive-sitemap.css` rather than a runtime
  `injectStyles()` call.

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
  bar, queue, sitemap, and preview. Those are safe because they already use
  `escapeHtml`/`textContent`, and must stay that way.

The workspace tab strip is `['overview', 'checks', 'sitemap', 'assist',
'help']`, numbered left to right by the `1`–`5` shortcuts. The sitemap and AI
panels mount lazily on tab open via `window.__mountInteractiveSitemapOnTabOpen()`
/ `window.__mountAiAssistOnTabOpen()`. **Each also catches an already-open
tab at its own `init()`** (`mountIfTabAlreadyOpen`): `js/ux-improvements.js`
initializes earlier and restores a persisted `workspace_tab` before those
hooks exist, so without the catch-up a reviewer who left Assist or Sitemap
open saw an empty panel until switching tabs and back.

Relatedly, `js/keyboard-shortcuts.js` dispatches `hhvc:shortcuts-ready` and
sets `window.reviewKeyboardShortcuts.ready` **from `init()`, after** the
`keydown` listener is attached. It used to fire at module scope, announcing a
capability that did not exist yet.

### Content-standards scoring

`js/plain-language.js` scores page copy against written standards, not
preferences. Each check carries `severity` plus a `source`/`section` pair and
a ready-to-render `citation`:

- **`severity: 'error'`** are the standards manual's mandates. They join the
  scored rule list behind the Overview tab's "checks passed" ratio, and their
  citation renders on the Checks tab alongside the rule.
- **`severity: 'warning'`** are advisory, run to ~115 across the 19 pages, and
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
`js/page-render.js` goes through `safeUrl()` from `js/utils.js`, which allows
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
crosses the CJS/ESM boundary. **Bun is the only runtime CI exercises** — both
`bun run validate` and `build:netlify` invoke `bun build_scripts/validate.js` —
so the Node ≥22 `require(esm)` path works but is _not_ covered by CI. Anything
relying on Node-specific interop here would go unnoticed.

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
`tests/e2e/review-import-export.spec.js` covers this at the API level and
`tests/e2e/import-export.spec.js` covers it through the real UI (export button
clicks + file-input imports asserting merge-not-wipe).

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
- **Auth**: every `/api/*` request requires `Authorization: Bearer
<REVIEW_API_TOKEN>`; a missing/wrong token gets 401, and an unset
  `REVIEW_API_TOKEN` makes the routes return 501 rather than silently allow
  unauthenticated writes.
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
  `REVIEW_API_TOKEN` set to a generated secret — none of this is committed.
  Local `bun run dev`/`bun run start` keep working fully offline with sync
  simply disabled when unconfigured; Netlify's static-only deploy
  (`build:netlify`) has no server runtime for these routes and stays a
  read-only/no-sync deployment target.
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

- **Two independent gates.** `REVIEW_API_TOKEN` (shared with the sync routes —
  one server secret, not two) decides whether the API exists at all; unset
  makes every `/api/ai/*` route 501 — with one deliberate exception: a CORS
  `OPTIONS` preflight is answered 204 _before_ the token gate, so a
  cross-origin browser client can still preflight an unconfigured server.
  Don't move the gate above the `OPTIONS` branch. `ANTHROPIC_API_KEY` decides whether
  generation is possible; unset makes `generate` and `models` 501 while
  `capabilities` still answers. That asymmetry is deliberate: `capabilities` is
  the discovery endpoint the browser uses for its empty state, and a 501 there
  would leave it unable to tell "no AI key" from "no server at all".
- **The provider gate is checked inside each route, not before routing.**
  Hoisting it would make every unmatched path answer 501 "no provider
  configured" instead of 404 — telling a client a route exists when it does not.
- **Routes**: `GET /api/ai/capabilities` (configured providers, grounding
  files, page count), `GET /api/ai/models` (queried live, since model lineups
  move and a hardcoded id becomes a 404 nobody notices), and
  `POST /api/ai/generate` (`{task, prompt, page?}`, Zod-validated).
- **Env**: `ANTHROPIC_API_KEY` (the gate), `ANTHROPIC_MODEL` (default
  `claude-opus-5`), `AI_EFFORT` (default `high`), and `ANTHROPIC_BASE_URL`
  (only used to point the test suite at a stub). Put them in `.env.local`,
  which is gitignored and must stay that way.
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
the generated single-file HTML exports, `.claude/homunculus/`, and the
reference/planning dirs (`docs/source/`, `docs/superpowers/`, `review/`,
`.playwright-mcp/`).

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
`clamp()`. Edit base styles in `css/styles.css`; `css/theme.css` holds the
SFDS design-token overrides layered under the `@sfgov/design-system`
stylesheets; `css/interactive-sitemap.css` holds the sitemap's styles.

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
  `js/dashboard-guidance.js`, `js/interactive-sitemap.js`,
  `js/keyboard-shortcuts.js`, `js/manager-review-export.js`,
  `css/ux-improvements.css`.
- Shared merge/history logic → `js/review-merge.js` (loaded both as a browser
  `<script>` and imported directly by `server.ts` — the only place a `history`
  entry should ever be constructed). Optional sync backend → `server.ts` (API
  routes) and `js/review-state-sync.js` (client pull/push + settings UI).
- Styles → `css/styles.css`; design tokens → `css/theme.css`.
- Any new file under `pages/` or `js/` needs a matching `<script>` tag in
  `index.html`, or `bun run validate` fails.
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

`AGENTS.md` is the tool-agnostic source of truth shared with Cursor, Copilot,
Codex, Windsurf, Aider, and other assistants; `.github/copilot-instructions.md`
is Copilot's mirror. This file mirrors the same facts plus the Claude
Code–specific notes above. Keep them in sync; if they ever disagree, reconcile
toward `AGENTS.md`.
