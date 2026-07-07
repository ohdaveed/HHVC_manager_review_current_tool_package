# Design: Split ux-improvements.js, review-queue.js, interactive-sitemap.js into smaller modules

## Problem

`js/ux-improvements.js`, `js/review-queue.js`, and `js/interactive-sitemap.js` are each
~1000-1067 lines: a single IIFE per file containing 30-40 flat function declarations
covering 5-8 distinct concerns (local-storage state, DOM sync, rendering, CSV/JSON
export-import, event wiring). This makes them hard to navigate and risky to edit — a
change to one concern requires scrolling past unrelated ones, and the files are large
enough that holding the whole thing in context (human or LLM) is difficult.

`js/interactive-sitemap.js` additionally embeds a ~430-line CSS-in-JS template string
inside `injectStyles()`, which is CSS living in a JS string instead of a stylesheet.

## Goals

- Each of the three files shrinks to a set of files in the ~150-350 line range, each with
  a single responsibility.
- No behavior change: identical localStorage schema, identical CSV/JSON export shapes,
  identical rendered DOM output.

## Non-goals

- Not consolidating the superficially-similar "sync saved state into the DOM" logic that
  lives separately in `ux-improvements.js` (syncs the editor sidebar) and
  `review-queue.js` (syncs queue-table rows) — they serve different UI surfaces; merging
  them is a separate, riskier decision out of scope here.
- Not changing the public `localStorage` key/shape (`hhvcManagerReviewState:v1`) or the
  CSV/JSON export/import formats.
- Not changing script *order* validation for `pages/*.js` — that check is untouched, only
  extended with a parallel check for `js/*.js`.

## Architecture pattern

The codebase already has precedent for this: `js/utils.js` exposes `window.utils`, and
`js/ux-improvements.js` already exposes `window.reviewState` specifically so
`js/review-queue.js` (which loads after it) can consume it. This design extends that same
pattern:

- Each new split-out file is its own small IIFE, guarded the same way current files are
  (early-return if `window.HHVC_DATA` is invalid), that attaches its functions to a
  `window.<ModuleName>` namespace object (e.g. `window.ReviewUx`, `window.ReviewQueue`,
  `window.InteractiveSitemap`).
- The original filename for each module (`js/ux-improvements.js`, `js/review-queue.js`,
  `js/interactive-sitemap.js`) becomes a thin **orchestrator** that loads *last* among its
  module's files and does only: final wiring/event listeners, and `init()`. This mirrors
  the existing pattern where `js/app.js` is the thin orchestrator on top of
  `js/state.js` + `js/ui-controls.js` + `js/editor-panel.js` + `js/page-render.js`.
- Mutable state currently shared via closure (e.g. `ux-improvements.js`'s
  `isRestoringState` flag) moves onto the shared namespace object as a plain property,
  since separate IIFEs can't share a closure variable directly.
- These new namespaces (`ReviewUx`, `ReviewQueue`, `InteractiveSitemap`) are internal
  wiring for that module, not a public API — same convention as `pageData`/
  `currentPageKey` being technically-global-but-conventionally-internal to `js/state.js`.

## File breakdown

### Shared (new)

| File | Contents | ~Lines |
|---|---|---|
| `js/review-state-store.js` | `getEmptyState`, `readLocalState`, `writeLocalState`, `updateLocalState` — relocated verbatim from `ux-improvements.js`. Still exposes `window.reviewState` under the exact same shape, so `review-queue.js` needs no changes to how it consumes it. | ~110 |

### `ux-improvements.js` → 4 files

| File | Contents | ~Lines |
|---|---|---|
| `js/ux-improvements-state-sync.js` | `getCurrentPage`, `getSeoTitle`, `getMetaDescription`, `getRuleResultsFor`, `getRuleResults`, `renderPageChecksPanel`, `collectCurrentPageReviewState`, `saveCurrentPageToLocalStorage`, `clearReviewFieldsForNewPage`, `updateMockupTextFromSavedState`, `applySavedPageState`, `applySavedUiPreferences`, `updateLocalStorageStatus` | ~300 |
| `js/ux-improvements-workspace.js` | `renderStickyBar`, `setWorkspaceTab`, `setWorkspaceOpen`, `toggleWorkspace`, `maybeShowWorkspaceOnboarding`, `handleStickyBarClick`, `initWorkspaceTabs`, `updateDecisionQuickActions`, `initDecisionQuickActions`, `applyDecisionToCurrentPage` | ~250 |
| `js/ux-improvements-export.js` | `getCurrentReviewSummaryLines`, `buildReviewSummary`, `copyText`, `mountCopySummaryButton`, `exportSavedLocalReviewsCsv`, `exportReviewStateBackup`, `importReviewStateBackup`, `mountBackupControls`, `clearSavedLocalReviews`, `mountLocalStorageControls` | ~350 |
| `js/ux-improvements.js` (orchestrator, remaining) | `refreshUx`, `persistAndRefresh`, `attachRefreshListeners`, `wrapRenderPage`, `restoreInitialPage`, `init`, top-level constants/guard | ~150 |

### `review-queue.js` → 5 files

| File | Contents | ~Lines |
|---|---|---|
| `js/review-queue-state.js` | `toast`, `actionLabel`, `actionToastTone`, `buildActionPatch`, sidebar sync (`getSidebarReviewerName/Date`, `updateLocalReviewForPage`, `syncSidebarForKey`, `dispatchReviewFieldChange`), queue UI state persistence, the `state` object | ~300 |
| `js/review-queue-rows.js` | Row computation/filter/sort/select business logic (`getQueueRows`, `getQueueStats`, `compareRows`, `getVisibleRows`, selection helpers, `applyQueueAction`, navigation helpers) | ~300 |
| `js/review-queue-render.js` | All rendering (`renderQueueStats`, `renderBulkBar`, `renderReviewQueue`, focus-preservation helpers) | ~350 |
| `js/review-queue-import.js` | `importReviewsFromCsvText`, `importReviewsFromCsvFile` — isolated on its own since this is the exact regression-prone area CLAUDE.md flags (a prior bug here wiped saved reviews on import); keeping it small and separate makes future changes here easier to review/test in isolation | ~110 |
| `js/review-queue.js` (orchestrator, remaining) | Event handlers (`handleQueueClick/Input/Change`), `focusQueueSearch`, `init` | ~150 |

### `interactive-sitemap.js` → CSS extraction + 2 files

| File | Contents | ~Lines |
|---|---|---|
| `css/interactive-sitemap.css` (new stylesheet) | The entire CSS-in-JS template string from `injectStyles()`, moved verbatim into a real stylesheet, linked via `<link>` in `index.html`. The `injectStyles()` function and its style-injection mechanism are removed entirely. | ~430 |
| `js/interactive-sitemap-data.js` | Graph-building/query layer (`buildLinkGraph`, `getPageRows`, `buildDiagramGroups`, `getFilteredRows`, etc.) | ~200 |
| `js/interactive-sitemap-render.js` | All rendering (`renderLegend`, `renderSearchAndFilters`, `renderDiagram`, `renderDetail`, `mountPanel`, `rerender`) | ~300 |
| `js/interactive-sitemap.js` (orchestrator, remaining) | Interaction handlers (`handleClick`, `handleKeydown`, `openPageByKey`), lifecycle (`wrapRenderPageForSitemap`, `ensureSitemapRendered`, `init`, `teardown`) | ~250 |

11 new files total (10 JS + 1 CSS), each well under 400 lines; the three original
filenames continue to exist as thin orchestrators.

## `index.html` changes

- Add `<link rel="stylesheet" href="css/interactive-sitemap.css">` alongside the existing
  `css/styles.css` / `css/theme.css` links.
- Insert the 10 new `<script>` tags in dependency order, with each module's orchestrator
  file loading *last* within its group:

```
js/review-state-validation.js
js/reading-level.js
js/review-state-store.js            <- new (shared)
js/ux-improvements-state-sync.js    <- new
js/ux-improvements-workspace.js     <- new
js/ux-improvements-export.js        <- new
js/ux-improvements.js               (orchestrator)
js/vendor/fuse.js
js/review-queue-state.js            <- new
js/review-queue-rows.js             <- new
js/review-queue-render.js           <- new
js/review-queue-import.js           <- new
js/review-queue.js                  (orchestrator)
js/dashboard-guidance.js
js/interactive-sitemap-data.js      <- new
js/interactive-sitemap-render.js    <- new
js/interactive-sitemap.js           (orchestrator)
js/keyboard-shortcuts.js
```

## `build_scripts/index-html-checks.js` generalization

Widen `findPageScriptTags`/`findScriptTagDrift` (or add sibling functions) to also diff
`js/*.js` files on disk against `<script src="js/...">` tags in `index.html`, matching the
existing `pages/*.js` membership-only check (order isn't verified there either — the
manual ordering above only needs to be gotten right once, same as every other file in
`js/` today). `tests/index-html-checks.test.js` gets matching new test cases. Excludes
`js/vendor/*.js` (third-party, not part of this drift check).

## Verification plan

All of the following must pass before any part of this refactor is called done:

1. `bun run format` — new files follow the same Prettier style.
2. `bun run validate` — schema + index.html drift checks, including the newly-generalized
   `js/*.js` check.
3. `bun run test` — existing unit suite must pass unchanged.
4. `bun run test:e2e` — Playwright suite.
5. **Manual CSV/JSON round-trip check**: export a review snapshot, re-import it, confirm
   existing decisions/notes survive — specifically exercising the new
   `js/review-queue-import.js` split.
6. **Manual visual check** of the interactive sitemap panel in a browser after the CSS
   extraction, since removing `injectStyles()` changes *how* styles land on the page even
   though the CSS content itself is unchanged.

## Risks & mitigations

- **Wrong script order breaks a namespace reference at load time.** Mitigation: this
  fails fast and loudly (console error), same as today's `js/state.js` guard. Load the app
  in a browser and confirm a clean console after each module's split.
- **Shared mutable flags (e.g. `isRestoringState`) get out of sync across files.**
  Mitigation: single source of truth on the shared namespace object, no per-file copies.
- **CSV import regression** (CLAUDE.md flags this file as having previously wiped saved
  reviews on import). Mitigation: isolated into its own single-purpose file, plus the
  manual round-trip check above.

## Rollout order

Implemented incrementally, running the full verification pass after each module:

1. `interactive-sitemap.js` (CSS extraction is lowest-risk, done first)
2. `ux-improvements.js`
3. `review-queue.js`
