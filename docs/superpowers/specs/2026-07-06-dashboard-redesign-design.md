# Reviewer dashboard redesign — design spec

## Problem

The reviewer UI (sidebar + sticky review bar + four-tab workspace panel) has grown by
accretion across several past changes and now shows overlapping status/decision
information in four different formats at once:

- The sidebar's decision `<select>` + quick-action chips + review fields
- The sticky review bar's decision chip + checks-passed chip + progress chip
- The Checks tab's 8 metric cards + separate 9-rule pass/fail list + an all-pages
  portfolio grid (itself a second full-site page list)
- The Queue tab's filterable page list with its own per-row bulk actions

There are also five different ways to pick a page (dropdown, sidebar quick-search,
sticky-bar Prev/Next, Queue tab list, Sitemap tab), and two static reference blocks
(Applied rules, Reading targets) sit in the sidebar alongside live editing fields even
though they never change per page. The result is visual clutter and duplicated
navigation/status surfaces that make the tool feel overwhelming rather than a focused
per-page review loop.

## Goal

Redesign the content, components, and information display of the reviewer dashboard so
each panel has exactly one job, without changing the existing visual style (SFDS tokens,
`css/styles.css`, `css/ux-improvements.css`), the underlying page content, Karl tag data,
or the export/import round-trip logic.

## Primary workflow this optimizes for

Reviewers work through pages sequentially, one at a time: open a page, read it, make a
decision, leave notes, move to the next. Site-wide triage (scanning everything at once)
is a secondary, occasional need — not the default view.

## Architecture

Same three zones as today (sidebar / sticky bar / mockup canvas / workspace panel), but:

- **Sidebar** drops from 7 sections to 5, and becomes exclusively about the *current
  page* — editing fields and the review decision. No site-wide or static-reference
  content remains in it.
- **Sticky bar** shows only what a manager needs "at a glance" without clicking
  anything: decision status, overall site progress, and page navigation. It no longer
  shows a checks-passed count (that's one click away, in the Checks tab).
- **Workspace panel** keeps its four tabs, but two of them absorb what used to be
  duplicated across Queue/Checks: **Overview** (new) is the single site-wide table;
  **Checks** becomes purely about the currently open page.

## Sidebar (4 accordion sections + Karl tags in mockup chrome)

In this order, using the existing `<details>` accordion pattern (no change to that
mechanism — see `docs/superpowers/specs/2026-07-01-sidebar-accordion-design.md`):

1. **Page mockup** _(open by default)_ — page `<select>` + URL slug preview (unchanged)
2. **Live content editor** _(collapsed)_ — title / summary / CTA fields (unchanged)
3. **Search metadata** _(collapsed)_ — SEO title / meta description + search preview
   (unchanged)
4. **Manager review** _(open by default)_ — reviewer name, review date, decision select,
   notes, risks/blockers, **owner** (see below), quick-action decision chips, and the
   existing export/import/backup buttons

**Karl CMS tags** remain in the **mockup browser chrome** (above `#mockPage`), not in a
sidebar accordion. The toggle, legend, and help copy sit in `karl-page-tags-banner` so
tags stay visually tied to the page preview.

Removed from the sidebar entirely:

- **Applied rules** (the static 9-item content-standards list) — moves into the Help tab
- **Reading targets** (the static reference table) — moves into the Help tab
- The quick-search page filter input — removed as a navigation path (see Navigation
  below); its filtering logic is deleted, not hidden

### Owner auto-fill

`owner` becomes a second globally auto-filled field alongside the existing `reviewer`
auto-fill (`state.globals.reviewer`). It defaults to `"David"` for every page and is
still editable per page if a reviewer ever needs to override it — it is a convenience
default, not a hardcoded constant, and uses the same auto-fill mechanism already in
place for `reviewer`.

## Sticky review bar

Single row, decision-status anchored on the left:

`[Decision badge] [Page title]` ................ `[12/30 reviewed] [‹ Prev] [Next ›] [Workspace ▾]`

- Decision badge and page title on the left
- Site-wide progress ("N/M reviewed"), Prev/Next navigation, and the Workspace
  open/close toggle on the right
- The "Next needs review" jump button is removed from the sticky bar — that action
  moves into the Overview tab, where it belongs next to the rest of the site-wide
  triage view
- The checks-passed chip is removed from the sticky bar (moved to the Checks tab only)

## Navigation

Three ways to move between pages, down from five:

1. The sidebar's page dropdown (unchanged)
2. Sticky-bar Prev/Next (sequential flow)
3. The Sitemap tab (click a node to open that page)

Removed as navigation paths: the sidebar quick-search filter, and the Queue tab's page
list (its list functionality is absorbed into the new Overview tab, but Overview is a
triage/bulk-action surface, not treated as a "way to pick a page" in the same sense as
the three above — opening a page from an Overview row is still possible via its row's
"Open" action, same as clicking a Sitemap node).

## Workspace panel tabs

### Overview (new — replaces Queue tab + Checks tab's portfolio grid)

A single dense table, one row per page, replacing both the old Queue list and the old
Checks-tab portfolio grid (previously two separate full-site page lists). This keeps the
Queue tab's existing information richness and controls — the stats/KPI bar (visible,
blocked, unassigned, stale counts), the search box, the sort dropdown, the decision
filter buttons, and the select-all + bulk-action bar — just reformatted as table rows
instead of cards. Columns: **Page** (title + type + page key), **Checks** (x/9 — new,
merged in from the old portfolio grid), **Decision**, **Owner** (defaults to "David" —
see Owner auto-fill below), **Last updated** (staleness-flagged, from the old Queue
list), **Actions** (inline Approve / Revise / Blocked / Needs review / Approve w/ edits
buttons, same as today's per-row Queue actions, plus "Open" to navigate to the page in
the mockup canvas). Row-level detail that doesn't fit a column (reviewer name, notes
present, blockers logged) stays as a compact secondary line under the page title, as it
does in the Queue tab today. This tab is the one place to triage the whole site.

### Page checks (per-page only; tab label "Page checks")

Shows only the currently open page's own compliance state. The previous 8 metric cards
(page type, reading level, CTA, SEO character counts, related-links count, etc.) and the
separate 9-rule pass/fail list merge into **one compact checklist**: each of the 9 rule
items shows its live value and pass/fail status inline (e.g. "SEO title: 54/60 chars ✓",
"Primary CTA: missing ✗"). The one metric with no corresponding pass/fail rule — "Page
key" — is kept as a plain informational line at the top of the list (no check icon,
since it's not a compliance rule), rather than dropped, since it's useful for confirming
which page object is loaded. No site-wide content remains in this tab — that's now
exclusively in Overview.

### Sitemap (unchanged)

Same hub-tree link graph, lazy-rendered on tab open, still usable as a navigation path.

### Help (unchanged content + new reference material)

Keeps its existing 7 guidance cards, and gains the two reference blocks moved out of the
sidebar: the Applied rules content-standards list and the Reading targets table.

## State / persistence changes

**The localStorage key stays `hhvcManagerReviewState:v1` — no version bump.** An earlier
draft of this spec proposed bumping to `v2`, which would have made every reviewer's
saved decisions and notes invisible on first load (`readLocalState` treats any version
mismatch as empty state — see `js/ux-improvements.js:135-152`), silently wiping
in-progress review work the moment they touched a field. That's exactly the class of
regression the CLAUDE.md import/export warning exists to prevent, so it's ruled out.
None of the changes below need a version bump — each is already absorbed by existing
fallback logic without any migration code:

- `state.ui.workspace_tab` enum renames `queue` → `overview` (valid values become
  `overview | checks | sitemap | help`). An old persisted value of `"queue"` is not in
  the new `WORKSPACE_TABS` list, so `setWorkspaceTab`'s existing
  `if (!WORKSPACE_TABS.includes(tabId)) tabId = 'overview'` guard coerces it
  automatically — no dedicated migration needed.
- `state.ui.review_queue` (`{filter, query, sort}`) and `state.ui.checks_failing_only`
  are superseded by a new `state.ui.overview` bucket (`{filter, query, sort}`) driving
  the Overview table. The old keys are simply never read again by the new code —
  harmless unused entries in the persisted JSON, not migrated or deleted.
- `state.globals.owner` — new field, auto-fills `"David"` the same way
  `state.globals.reviewer` already auto-fills across pages, via the existing
  `state.globals || {}` fallback in `readLocalState` (an unset `owner` key is simply
  `undefined`, which the auto-fill logic treats as "use the default").
- No persisted state remains for the removed sidebar quick-search filter — it was never
  persisted (its filtering was in-memory only), so there's nothing to clean up.
- `state.pages` (every reviewer's saved per-page decisions, notes, edited copy) and
  `state.globals.reviewer` are completely unchanged in shape and are preserved as-is.

## Non-goals (explicitly out of scope)

- No changes to page content (`pages/*.js`), Karl tag data or its rendering logic in
  `js/page-render.js`, or the export/import CSV-JSON round-trip logic in
  `js/manager-review-export.js` / `js/review-queue.js`
- No changes to the CSS design tokens or visual style (SFDS tokens, `css/styles.css`,
  `css/theme.css`) — only structural/markup reorganization within the existing style
- No changes to `js/interactive-sitemap.js`'s rendering internals — only its role as a
  navigation path is confirmed, not its internal diagram logic
- No new dependencies, no build step changes
- No changes to `manager-review-single-file.html` / `single-file-export-current-source.html`
  source — these remain generated by `build_scripts/build-single-file.js` after the change

## Testing / verification

- `bun run validate` must still pass (schema + business-invariant checks are unaffected
  by this UI-only change, but re-run to confirm)
- Manual browser check per the CLAUDE.md import/export warning: with an existing saved
  review already in localStorage (pre-redesign shape), load the redesigned tool and
  confirm that review's decision/notes still appear — this is the regression check for
  *not* bumping the storage key. Then export a snapshot, reload, re-import it, and
  confirm the round-trip still preserves decisions/notes
- Manual check: sidebar shows only the 5 sections listed above; Applied rules and
  Reading targets appear in Help instead
- Manual check: sticky bar matches the single-row decision-first layout; no
  checks-passed chip or "Next needs review" button remains there
- Manual check: Overview tab shows one merged table (not two separate lists elsewhere);
  Checks tab shows only the current page's compact checklist
- Manual check: quick-search input is gone from the sidebar; dropdown, Prev/Next, and
  Sitemap still navigate correctly
- Re-run `node build_scripts/build-single-file.js` after implementation so both
  single-file exports reflect the new markup
