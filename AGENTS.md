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
(Healthy Housing and Vector Control) section of SF.gov. `index.html` loads plain
`<script>` tags directly, and `server.ts` serves the mockup. **Bun** powers the
dev server, the CLI scripts (validate/export/build), and the test runner — not a
bundler or framework. Reviewer state lives in the browser's `localStorage` by
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
`index.html` links `node_modules/@sfgov/design-system` CSS directly.

## Commands

```bash
bun install                 # install deps (required before first `dev`)
bun run dev                  # dev server with --watch at http://127.0.0.1:8080
bun run start                # dev server without --watch
bun run validate             # Zod-validate pages/*.js + js/page-data.js (schema + invariants)
bun run test                  # Bun test runner over the 9 unit-test files in tests/
bun run test:e2e              # Playwright end-to-end tests (starts static server on :8080)
bun run export                # regenerate data/page_inventory.{json,csv} + local tracking sheet
bun run sync-tracking         # regenerate the local mockup tracking CSVs
bun run push-tracking         # push page review status to the Google Sheets tracker
bun run build                 # validate -> export -> build:workshop-form -> build-single-file.js
bun run build:workshop-form   # bun install + vite build inside forms/mosquito-workshop-request
bun run build:netlify         # validate.js -> build-netlify-dist.js (assembles dist/ for Netlify)
bun run format                # prettier --write on everything
bun run format:check          # prettier --check — THIS IS THE LINT STEP (no ESLint/tsc)
bun run vendor:browser        # rebuild js/vendor/{fuse,defu}.js IIFE bundles from node_modules
```

`HOST=0.0.0.0 bun run dev` / `PORT=3000 bun run dev` override the dev server bind.
`start-dev.sh` kills any stale listener on the port before starting.

**There IS a real test suite** (a common stale claim in older docs is that there
isn't). `bun run test` runs ten Bun unit-test files under `tests/` — `utils`,
`data-validation`, `page-render`, `csv`, `review-state-schema`, `reading-level`,
`index-html-checks`, `review-merge`, `review-api-server` (which spawns
`server.ts` as a subprocess against a temp SQLite DB), and `review-state-sync`
— plus `bun run test:e2e`
(Playwright, in `tests/e2e/`:
nine spec files — eight UI-driven ones covering navigation, editor panel,
review workflow, review queue, import/export, keyboard shortcuts,
sitemap/workspace, and accessibility, plus the original `review-import-export`
API-level round-trip — sharing plain helper functions in
`tests/e2e/helpers.js`, no fixture framework). In a sandbox with a
pre-installed Chromium, point Playwright at it instead of downloading:
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium bun run test:e2e`.
`bun run validate` is a **complementary, not redundant** check: it loads every
`pages/*.js` plus `js/page-data.js` into a Node VM and Zod-validates
fields/shapes, plus a few business invariants (below). It always validates the
full page set — you can't validate a single page file in isolation. **Run `bun
run validate` and `bun run test` after editing anything under `pages/` or
`js/page-data.js`.**

## Architecture

### Data-driven rendering, no framework

Each file in `pages/*.js` assigns a page object onto the global
`window.HHVC_PAGES['<pageKey>']`. `js/page-data.js` then builds
`window.HHVC_DATA = { pages, order }`, where `order` is the array of
`[pageKey, menuLabel]` pairs driving navigation/menu order.

**Script load order in `index.html` matters.** These are classic `<script>` tags
sharing one global lexical scope (not ES modules), so `const`/`let` declared in an
earlier file are visible to files loaded after it. `js/state.js` throws
immediately if `window.HHVC_DATA` is missing — that throw ("Check script order in
index.html") is the fast signal that the order broke. All `pages/*.js` must load
before `js/page-data.js`, which loads before the core (`state` → `ui-controls` →
`editor-panel` → `page-render` → `app`) and the additive review/UX layers.

When adding a new page file: add its `<script>` tag in the `pages/*.js` block of
`index.html`, **before** `js/page-data.js`, and add a `[pageKey, menuLabel]` entry
to the `order` array in `js/page-data.js`. Node-side scripts
(`build_scripts/`, `tests/`) discover `pages/*.js` dynamically via
`build_scripts/load-pages.js` — only `index.html`'s `<script>` tags need a manual
entry. If you forget the tag (or leave a stale one after deleting a page),
`bun run validate` catches it: `build_scripts/index-html-checks.js` diffs
`pages/*.js` on disk against the `<script src="pages/...">` tags and fails on
drift in either direction. Tag _order_ isn't checked (page modules are
independent); only set membership matters.

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
- **`js/manager-review-export.js`** — manager review CSV/JSON snapshot;
  monkey-patches `renderPage` to refresh the review label after render (handles
  `renderPage` returning a Promise under View Transitions).

### Review/UX layers are additive, on top of the core

`js/ux-improvements.js`, `js/review-queue.js`, `js/dashboard-guidance.js`,
`js/interactive-sitemap.js`, and `js/keyboard-shortcuts.js` are self-contained
IIFEs that read `window.HHVC_DATA` and `localStorage`. Some write edited
title/summary/CTA/SEO fields back onto the **in-memory** `pageData` objects when
restoring saved edits — but **must never write back to the `pages/*.js` source
files or publish content.** They are review aids only, not publishing tools.

`js/ux-improvements.js`, `js/review-queue.js`, and `js/interactive-sitemap.js` are
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
- **`window.InteractiveSitemap`** ← `js/interactive-sitemap-data.js` and
  `js/interactive-sitemap-render.js`; its styles live in
  `css/interactive-sitemap.css`.

### Page object shape and validation rules

See `build_scripts/validate.js` for the enforced Zod schema. A page has `slug`,
`type` (a free-form string, only `min(1)` checked — values in use are `Agency`,
`Transaction`, `Information`, `Resource Collection`, `Campaign`, and `Report`,
matching Karl content-type names; see `docs/wagtail-content-mapping.md`), `title`,
`summary`, `audience[]`,
`reading` (grade-level string), and `sections[]`. For Karl editor field mapping by
content type, see `docs/source/hhvc-policy/karl-content-type-field-reference.md`.
Sections carry `cards[]`, `bullets[]`, `paragraphs[]`, `table[][]`, a `callout`, a
`button`/`buttonUrl`/`buttonTarget`/`buttonStyle`, and/or `steps[]`; steps carry
`text[]`, `callout`, and `button`/`buttonTarget`/`buttonUrl`. `js/page-render.js`
also renders a `bullets[]` array on steps even though `stepSchema` doesn't declare
it — rendered but unvalidated. Optional SEO/review fields: `seoTitle`,
`metaDescription`, `primaryCta`, `editorNote`. A newer schema addition —
`unverified: true` + `unverifiedReason` on text items — flags claims needing SME
confirmation, rendered as an "Unverified" pill.

Beyond schema shape, `validate.js` enforces business invariants:

- The `pestsTopic` key must exist and be **first** in `order`. This is now the
  HHVC **Agency page** ("Healthy Housing and Vector Control") — the key name is
  retained from the Topic-page era for invariant/test/review-state stability.
- The bare `agency` key must **not** be present (nobody should "fix" the key name
  and break that stability).
- Every `card.target` must resolve to a real page key, and every inline markdown
  link `[label](pageKey)` in paragraphs/bullets/step text must resolve to a real
  page key, an `http(s)` URL, or the inert `#` sentinel.
- The Agency page's content must not contain banned out-of-scope terms
  (`plumbing`, `dbi`, `roof leak`, `sewer`, `permit issue`, `construction
defect`) — HHVC scope is Article 11 only.

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
  `page_key`; the server never wholesale-replaces the table.
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
- **That binding starts at _request_ time.** `pullFromServer` and
  `pushPage` capture `readConfig().apiUrl` before calling `apiFetch` and
  re-check it (`assertEndpointUnchanged()`) before touching state, so a
  response that outlived its configuration is rejected rather than applied.
  Reading the endpoint in the `.then()` instead is the bug it fixes: a pull
  from X landing after the reviewer saved Y gets labelled `Y`, passes
  `resolveConflict`'s guard, and writes X's revision into `synced_at`
  under Y.
- Switching the sync server URL (`writeConfig`) clears every local page's
  `synced_at`, since a baseline only means something relative to the
  deployment that issued it. There is deliberately **no "both non-empty"
  guard** on that comparison: clearing settings then pointing at a different
  server is two transitions (`X` → `''` → `Y`), and requiring both sides to
  be non-empty would skip the clear on both, carrying `X`'s baselines to `Y`.
- **Deployment**: run `server.ts` (`bun run start`) with a persistent volume
  mounted, `DATA_DB_PATH` pointed at it, and `REVIEW_API_TOKEN` set to a
  generated secret (never committed). Local dev and Netlify's static-only
  deploy (`build:netlify`, no server runtime for these routes) are unaffected
  either way.
- **Tests**: `tests/review-merge.test.js` (unit) and
  `tests/review-api-server.test.js` (spawns `server.ts` against a temp SQLite
  DB, exercises auth/merge/isolation over real HTTP).

### Build outputs

- **`build_scripts/build-single-file.js`** inlines `index.html`'s local
  stylesheets and scripts (in document order) into
  `manager-review-single-file.html` and `single-file-export-current-source.html` —
  **gitignored generated files; never hand-edit.** Edit sources, re-run `bun run build`.
- **`build_scripts/extract-pages.js`** (`bun run export`) regenerates
  `data/page_inventory.{json,csv}`. `data/` is absent on a fresh clone
  (gitignored); this script creates it. Dev/serve never touches `data/`.
- **`build_scripts/build-netlify-dist.js`** (`bun run build:netlify`, driven by
  `netlify.toml`) assembles `dist/` with only runtime files. It does **not** run
  the Vite build — it copies whatever is checked into
  `forms/mosquito-workshop-request/dist`, so rebuild that form first
  (`bun run build:workshop-form`) after editing its `src` or Netlify ships stale
  assets.
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

- **This is plain browser JS — not TypeScript, no build step, no ES modules or
  `import`/`export` in `js/*.js`.** (Auto-generated skill files that call this a
  "TypeScript repo" or prescribe relative imports / named ES-module exports are
  wrong — ignore them.)
- **File naming:** lowercase — single words for the core modules (`app.js`,
  `state.js`, `utils.js`), hyphenated for multi-word ones
  (`review-queue-state.js`, `page-render.js`); never camelCase. Match sibling
  files.
- **Two deliberate module patterns:** (1) bare `const`/`function` at file top for
  the core scripts that share one global lexical scope via ordered `<script>`
  tags; (2) **named IIFEs with a leading semicolon** — `;(function mountX(){…})()`
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
`clamp()`. Edit base styles in `css/styles.css`; `css/theme.css` holds the
SFDS-token overrides layered under the `@sfgov/design-system` stylesheets.

### Tests

Bun test: `const { describe, test, expect } = require('bun:test')`. A
`tests/helpers/load-scripts.js` harness evaluates the classic `<script>` files and
returns a context object. `describe` blocks are named after the unit under test;
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
  `js/dashboard-guidance.js`, `js/interactive-sitemap.js`,
  `js/keyboard-shortcuts.js`, `js/manager-review-export.js`,
  `css/ux-improvements.css`.
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
