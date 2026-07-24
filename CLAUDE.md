# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, no-framework mockup tool for manager review of a redesigned HHVC
(Healthy Housing and Vector Control) section of SF.gov. `index.html` loads
plain `<script>` tags directly, and `server.ts` serves the mockup. Bun is
used for the dev server and CLI scripts (validate/export/build), not for a
bundler or framework. Reviewer state lives in the browser's `localStorage`
by default, and the tool works fully offline with no server at all beyond
serving static files — **no backend/database/external service is required.**
`server.ts` also hosts an **optional** review-state sync backend (Bun +
SQLite, see "Review-state sync backend" below) that reviewers can opt into
per-browser to sync decisions across machines; it's off unless deployed and
configured, and every other part of the tool is unaffected if it's never
used.

A separate Vite sub-app lives at `forms/mosquito-workshop-request/` (a real
build step, built independently — see Build outputs below).

## Commands

```bash
bun install                # install deps (required before first `dev` — index.html
                            # links node_modules/@sfgov/design-system CSS directly)
bun run dev                 # dev server with --watch at http://127.0.0.1:8080
bun run start               # dev server without --watch
bun run validate            # Zod-validate pages/*.js + js/page-data.js
bun run export              # regenerate data/page_inventory.{json,csv}
bun run build                # validate -> export -> build:workshop-form -> build-single-file.js
bun run build:workshop-form  # npm install + vite build inside forms/mosquito-workshop-request
bun run build:netlify        # validate.js -> build-netlify-dist.js (assembles dist/ for Netlify)
bun run format               # prettier --write on **/*.{js,ts,json,md,css,html}
bun run format:check         # prettier --check (this is the lint step; no ESLint/tsc)
bun run test                  # bun test over tests/*.test.js (utils, data-validation, page-render,
                              # csv, review-state-schema, reading-level, index-html-checks,
                              # review-merge, review-api-server)
bun run test:e2e              # playwright test
```

`HOST=0.0.0.0 bun run dev` / `PORT=3000 bun run dev` override the dev server bind.
`start-dev.sh` kills any stale listener on the port before starting.

`tests/` holds a real unit-test suite (9 files, run via `bun run test`) plus
an `e2e/` subfolder driven by `bun run test:e2e` — nine Playwright spec files
(eight UI-driven: navigation, editor panel, review workflow, review queue,
import/export, keyboard shortcuts, sitemap/workspace, and accessibility, plus
the original API-level `review-import-export` round-trip) sharing plain helper
functions in `tests/e2e/helpers.js`. In a sandbox with a pre-installed
Chromium, run
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium bun run test:e2e`
instead of downloading browsers. Beyond that, `bun run
validate` (`build_scripts/validate.js`) is a second, complementary check:
it loads every `pages/*.js` file plus `js/page-data.js` into a Node VM
context and Zod-validates required fields/shapes, plus a few hardcoded
invariants (see below). It always validates the full page set — there's no
way to validate a single page file in isolation. Run both after editing
anything under `pages/` or `js/page-data.js`.

## Architecture

### Data-driven rendering, no framework

Each file in `pages/*.js` assigns a page object onto the global
`window.HHVC_PAGES['<pageKey>']`. `js/page-data.js` then builds
`window.HHVC_DATA = { pages, order }`, where `order` is the array of
`[pageKey, menuLabel]` pairs driving navigation/menu order.

**Script load order in `index.html` matters** — these are classic `<script>`
tags sharing one global lexical scope (not ES modules), so `const`/`let`
declared in an earlier file are visible to files loaded after it:

```
js/utils.js → pages/*.js (each page) → js/page-data.js → js/state.js →
js/ui-controls.js → js/editor-panel.js → js/page-render.js → js/app.js →
js/manager-review-export.js → js/review-state-validation.js →
js/reading-level.js → js/review-state-store.js → js/review-merge.js →
js/review-state-sync.js → js/ux-improvements-state-sync.js → js/ux-improvements-workspace.js →
js/ux-improvements-export.js → js/ux-improvements.js →
js/review-queue-state.js → js/review-queue-rows.js →
js/review-queue-render.js → js/review-queue-import.js → js/review-queue.js →
js/dashboard-guidance.js → js/interactive-sitemap-data.js →
js/interactive-sitemap-render.js → js/interactive-sitemap.js →
js/keyboard-shortcuts.js
```

When adding a new page file: add its `<script>` tag in the `pages/*.js`
block of `index.html`, before `js/page-data.js`; add a `[pageKey, menuLabel]`
entry to the `order` array in `js/page-data.js` so it appears in navigation.
Node-side scripts (`build_scripts/validate.js`, `build_scripts/extract-pages.js`,
and `tests/`) no longer hardcode their own page-file lists — they all
discover `pages/*.js` dynamically via `build_scripts/load-pages.js` (glob +
sort, with `js/page-data.js` always loaded last). Only `index.html`'s
`<script>` tags still need a manual entry per new page; there's no
independent list left to fall out of sync in the build scripts themselves.
If you do forget the `<script>` tag (or leave a stale one after deleting a
page file), `bun run validate` now catches it: it diffs `pages/*.js` on disk
against the `<script src="pages/...">` tags in `index.html`
(`build_scripts/index-html-checks.js`) and fails loudly on either direction
of drift, since the browser has no way to glob its own script tags at
runtime the way the Node build scripts can. Tag _order_ isn't checked —
page modules are independent (each only writes into `window.HHVC_PAGES`),
so only set membership matters.

### Core module split (formerly one `app.js`)

- **`js/utils.js`** — shared helpers (`escapeHtml`, `getPrimaryCta`,
  `setPrimaryCta`, `today`, `csvEscape`, `toCsv`, `downloadFile`, `debounce`,
  `throttle`), exposed as `window.utils` and as bare top-level functions.
  Loads first; add new cross-cutting helpers here rather than duplicating logic.
- **`js/state.js`** — core state: `DATA`/`ORIGINAL_DATA` (a deep clone used
  for field-reset), `pageData`, `pageOrder`, `currentPageKey`. Throws if
  `window.HHVC_DATA` didn't load, which is the fast signal that script order
  in `index.html` broke.
- **`js/ui-controls.js`** — toasts, sidebar collapse/scroll persistence, the
  page-picker `<select>`, and the review checklist.
- **`js/editor-panel.js`** — SEO/editor panel: syncing input fields with the
  current page, dirty-state indicators, search-result preview, per-field reset.
- **`js/page-render.js`** — turns `pages/*.js` page objects into the `#mockPage`
  HTML, including `karlTag()` for Karl CMS placement annotations.
- **`js/app.js`** — bootstraps DOM event listeners (`init()`) and kicks off
  the first `renderPage('pestsTopic')`.
- **`js/manager-review-export.js`** — manager review CSV/JSON export
  snapshot; monkey-patches `renderPage` to refresh the review page label
  after render (handles the case where `renderPage` returns a Promise under
  View Transitions).

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
edits) do write edited title/summary/CTA/SEO fields back onto the in-memory
`pageData` objects — but **must never write back to the `pages/*.js` source
files or publish content**; they are review aids only, not publishing tools.

`js/ux-improvements.js`, `js/review-queue.js`, and `js/interactive-sitemap.js`
are now thin orchestrators (event wiring + `init()` + public API assembly)
over sibling files that do the actual work, mirroring the existing
`window.utils`/`window.reviewState` pattern — each sibling attaches its
functions to an internal `window.<Namespace>` object (implementation detail,
never referenced from `pages/*.js` or outside its own module's files):

- `window.ReviewUx` (`js/ux-improvements.js`'s orchestrator) —
  `js/review-state-store.js` (shared `window.reviewState` read/write/update,
  also consumed directly by `js/review-queue*.js`), `js/ux-improvements-state-sync.js`
  (per-page field sync/dirty-state), `js/ux-improvements-workspace.js`
  (sticky bar, workspace tabs, Karl scorecard), and
  `js/ux-improvements-export.js` (review summary copy, CSV/JSON backup
  export/import, clear-local-reviews).
- `window.ReviewQueueInternal` (`js/review-queue.js`'s orchestrator) —
  `js/review-queue-state.js` (shared state + UI-persistence helpers),
  `js/review-queue-rows.js` (row building, filter/sort/selection, bulk
  actions), `js/review-queue-render.js` (table/stats/bulk-bar rendering),
  and `js/review-queue-import.js` (CSV import — kept isolated as the
  highest-regression-risk area; see "Local persistence" below).
- `window.InteractiveSitemap` (`js/interactive-sitemap.js`'s orchestrator) —
  `js/interactive-sitemap-data.js` (graph/data building from `HHVC_DATA`)
  and `js/interactive-sitemap-render.js` (DOM rendering, search/filter
  UI). Its injected styles now live in `css/interactive-sitemap.css`
  instead of a runtime `injectStyles()` call.

### Page object shape and validation rules

See `build_scripts/validate.js` for the enforced Zod schema: `slug`, `type`
(a free-form string — only `min(1)` is checked, not an enum; values in use
across `pages/*.js` are `Agency`, `Transaction`, `Information`,
`Resource Collection`, `Campaign`, and `Report`, matching Karl's real
content-type names — see
`docs/wagtail-content-mapping.md`). `title`, `summary`, `audience[]`, `reading`
(grade-level string), and `sections[]`. For Karl editor field mapping by
content type, see `docs/source/hhvc-policy/karl-content-type-field-reference.md`.
Sections carry `cards[]`,
`bullets[]`, `paragraphs[]`, `table[][]`, a `callout`, a
`button`/`buttonUrl`/`buttonTarget`/`buttonStyle`, and/or `steps[]`; steps
carry `text[]`, `callout`, and `button`/`buttonTarget`/`buttonUrl` (the
primary CTA). `js/page-render.js` also renders a `bullets[]` array on
steps even though `stepSchema` doesn't declare it — that field is rendered
but unvalidated. Optional SEO/review fields: `seoTitle`, `metaDescription`,
`primaryCta`, `editorNote`.

Beyond schema shape, `validate.js` enforces business invariants:

- The `pestsTopic` key must exist and must be first in `order`. This is now
  the HHVC **Agency page** ("Healthy Housing and Vector Control") — the key
  name is retained from the Topic-page era for invariant/test/review-state
  stability (`validate.js` only checks the key and ordering, not its `type`
  or content).
- The bare `agency` key must **not** be present (nobody should "fix" the key
  name and break that stability).
- Every `card.target` must resolve to a real page key, and every inline
  markdown link `[label](pageKey)` in paragraphs/bullets/step text must
  resolve to a real page key, an `http(s)` URL, or the inert `#` sentinel
  (`findBrokenInlineLinks` in `build_scripts/data-checks.js`).
- The Agency page's content must not contain banned out-of-scope terms
  (`plumbing`, `dbi`, `roof leak`, `sewer`, `permit issue`,
  `construction defect`) — HHVC scope is Article 11 only.

**`karl` fields are first-class content, not comments** — every card, step,
section, and callout can carry a `karl` string, a placement/rationale note
surfaced to reviewers via `karlTag()` in `js/page-render.js`. Keep these
accurate when editing page copy.

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
history entry is constructed in exactly one place —
`mergeReviewRecord()` in `js/review-merge.js` — and only at discrete
round-boundary events: queue bulk actions/keyboard shortcuts
(`updateLocalReviewForPage` in `js/review-queue-state.js`), CSV/JSON backup
import (`importReviewStateBackup` in `js/ux-improvements-export.js`),
server sync (`server.ts`'s `putReviewPage`), and a **decision change made
from the sidebar** (the `<select>` or a quick-action chip). The continuous
per-keystroke/blur autosave (`saveCurrentPageToLocalStorage` in
`js/ux-improvements-state-sync.js`) deliberately does **not** go through
`mergeReviewRecord` and does **not** append a history entry — it just keeps
the working snapshot fresh, carrying the existing `history` array forward
untouched. Routing autosave through the merge/history path would flood
`history` with one entry per debounced keystroke.

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
backend uses. Any change to the import/export round-trip, or to
`js/review-merge.js`, must be manually verified before being called done:
export a snapshot, re-import it, and confirm existing decisions/notes are
still present rather than wiped. `tests/e2e/review-import-export.spec.js`
and `tests/e2e/import-export.spec.js` cover this as regression guards.

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
  import path relies on.
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
  there would turn `false` into the truthy string `'false'`.
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
  controls render a button pair per conflicted page.
- Switching the configured sync server URL (`writeConfig`) clears every
  local page's `synced_at`, since a baseline is only meaningful relative to
  the deployment that issued it. The comparison has **no "both non-empty"
  guard on purpose** — clearing the settings and then pointing at a
  different server is two transitions (`X` → `''` → `Y`), and requiring both
  sides to be non-empty would skip the clear on both, carrying `X`'s
  baselines all the way to `Y`.
- **Deployment (e.g. Railway)**: run `server.ts` (`bun run start`) with a
  persistent volume mounted, `DATA_DB_PATH` pointed at that volume, and
  `REVIEW_API_TOKEN` set to a generated secret — none of this is committed.
  Local `bun run dev`/`bun run start` keep working fully offline with sync
  simply disabled when unconfigured; Netlify's static-only deploy
  (`build:netlify`) has no server runtime for these routes and stays a
  read-only/no-sync deployment target.
- **Tests**: `tests/review-merge.test.js` (unit tests for
  `mergeReviewRecord`) and `tests/review-api-server.test.js` (spawns
  `server.ts` as a subprocess with a temp SQLite DB and exercises auth,
  merge-not-wipe, and per-page isolation over real HTTP).

### Build outputs

- **`build_scripts/build-single-file.js`** inlines `index.html`'s local
  stylesheets and scripts (in document order) into
  `manager-review-single-file.html` and `single-file-export-current-source.html`.
  These, plus `data/page_inventory.{json,csv}`, are gitignored generated
  files — **never hand-edit them**; edit sources and re-run `bun run build`.
- **`build_scripts/extract-pages.js`** (`bun run export`) regenerates
  `data/page_inventory.{json,csv}` from page data. `data/` is absent on a
  fresh clone (gitignored); this script creates it. Dev/serve never touches
  `data/` — only build/export does.
- **`build_scripts/build-netlify-dist.js`** (`bun run build:netlify`, driven
  by `netlify.toml`) assembles `dist/` with only runtime files: `index.html`,
  `css/`, `js/`, `pages/`, the three `@sfgov/design-system` CSS files
  (referenced by `index.html` via `node_modules` paths, so `npm install`/`bun
install` must run first), and `forms/mosquito-workshop-request/dist`
  (copied to that same path under `dist/`, since that Vite sub-app is built
  with `base: '/forms/mosquito-workshop-request/'`). **`build:netlify` does
  not run the Vite build** — it only copies whatever is already checked into
  the committed `forms/mosquito-workshop-request/dist` directory, so after
  editing `forms/mosquito-workshop-request/src` you must rebuild it first
  (`bun run build:workshop-form`) or a Netlify deploy will ship stale form
  assets.
- `server.ts` mirrors the same security headers (`X-Content-Type-Options`,
  `X-Frame-Options`, etc.) that `netlify.toml` sets for the deployed site.

### Other directories

- **`forms/mosquito-workshop-request/`** — an independent Vite app (own
  `package.json`, `vite.config.js`, `src/main.js`) for one embedded form. Not
  wired into the main Bun dev server; built separately via
  `bun run build:workshop-form` or the Netlify build.
- **`review/`** — reference/output for the manager review process
  (`manager_review_packet.md`, `manager_decision_log.csv`,
  `page_approval_checklist.csv`), distinct from the in-browser
  `localStorage` review state.
- **`docs/source/hhvc-policy/`** — source policy documents (PDFs and their
  markdown extracts) that page copy is based on; not code.
- **`docs/superpowers/plans/` and `docs/superpowers/specs/`** — planning and
  design docs from prior work sessions; useful background, not standing
  instructions.
- **`.playwright-mcp/`** — scratch console logs/snapshots from prior
  Playwright MCP sessions; not part of the source.

## Editing rules

- Edit public page content in `pages/*.js`.
- Edit core render/state behavior in `js/state.js`, `js/page-render.js`,
  `js/ui-controls.js`, `js/editor-panel.js`, and `js/app.js`.
- Edit review/UX layers in `js/ux-improvements.js`, `js/review-queue.js`,
  `js/dashboard-guidance.js`, `js/interactive-sitemap.js`,
  `js/keyboard-shortcuts.js`, `js/manager-review-export.js`, and
  `css/ux-improvements.css`.
- Edit the shared merge/history logic in `js/review-merge.js` (loaded both as
  a browser `<script>` and imported directly by `server.ts`) — it's the only
  place a `history` entry should ever be constructed; edit the optional sync
  backend in `server.ts` (API routes) and `js/review-state-sync.js` (client
  pull/push + settings UI).
- Edit styles in `css/styles.css`; `css/theme.css` holds SFDS design-token
  overrides layered under the `@sfgov/design-system` stylesheets.
- Review exports (`review/*.csv`, saved local-review CSV/JSON) are for
  manager decisions only — never treat them as automatic publication approval.

## Session pitfalls to avoid

- **State the repo root before guessing paths.** This repo's absolute path
  is `/home/ohdaveed/HHVC_manager_review_current_tool_package`. Automated
  review/CI-style invocations in particular have repeatedly started by
  guessing a wrong path (e.g. `/home/user/...`) and failing a `Read` before
  self-correcting via `Glob`/`pwd` — check `pwd` or use the path above
  directly instead of guessing.
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

## Code style

Enforced by Prettier (`.prettierrc.json`): no semicolons, single quotes,
2-space indentation, 100-character print width, ES5 trailing commas. Run
`bun run format` before committing. `.prettierignore` excludes `data/`,
`server.ts`, and the generated single-file HTML exports.

## Cross-tool canon

`AGENTS.md` is the tool-agnostic source of truth shared with Cursor, Copilot,
Codex, Windsurf, Aider, and other assistants. It mirrors the facts above plus the
JS/CSS idioms, comment voice, test conventions, and commit/PR preferences. Keep
the two in sync; if they ever disagree, reconcile toward `AGENTS.md`.
