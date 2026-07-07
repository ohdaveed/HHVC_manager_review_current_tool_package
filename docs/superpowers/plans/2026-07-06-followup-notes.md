# Follow-up notes (deferred during 2026-07-06 text/UX brainstorm)

Two items surfaced this session that are real and actionable but not part of
the idea-3 (workspace discoverability + Karl compliance score) work in
progress. Noting them here so they aren't lost.

## 1. Surface content-confidence into the rendered page, not just karl notes

This was "idea 2" from the same brainstorm, not chosen for the current pass.

`pages/mosquito-education-workshop.js` has unsourced placeholder claims
("up to about 60 students," "at least 3 weeks before") that read as
confirmed facts on the rendered mock page — the caveat that they're
illustrative only lives in `editorNote`, which a reviewer skimming the
rendered page won't see. This is a repo-wide pattern: `karl:` notes carry
rich sourcing/confidence metadata that never reaches the visible surface.

Proposed direction: a lightweight visual marker (e.g. a small "unverified"
pill, distinct from the existing Karl placement tags) driven by an optional
field on bullets/paragraphs/cards, rendered by `js/page-render.js`. Bigger
surface area than idea 3 (touches both `pages/*.js` schema and rendering),
so it deserves its own brainstorm/design pass rather than folding into
idea 3.

## 2. review-queue.js CSV import — RESOLVED 2026-07-06

Flagged in `CLAUDE.md`: "The CSV/JSON import path in `js/review-queue.js`
can destroy existing reviews — a prior regression there replaced the saved
state wholesale instead of merging." Investigated and fixed this session.

**Root cause found was different from what was assumed.** The merge logic
in `updateLocalReviewForPage` (js/review-queue.js) already did a correct
per-key merge (`{...defaults, ...existing, ...patch}`) — it was not
doing a wholesale `Object.assign` replace of saved state. The actual live
bug: `js/review-queue.js:15` destructures `parseCsv` from `window.utils`,
but `parseCsv` was never defined in `js/utils.js` (confirmed via
`git log -S"parseCsv"` — no commit ever added it). Clicking "Import CSV"
threw `TypeError: parseCsv is not a function` immediately, before any
state write — so the feature was completely dead rather than silently
destructive.

**Fix:** added a `parseCsv` implementation to `js/utils.js` (ported from
the existing, working parser in `build_scripts/push-tracking-sheet.js`)
and exposed it on `window.utils`.

**Verified live** (own dev server instance on port 8099 in this worktree,
via Playwright `browser_evaluate` calling `window.reviewQueue.importReviewsFromCsvText`
directly against seeded `localStorage` state):
- Importing a CSV row for one page with a blank `notes` cell does NOT
  wipe the existing notes value (blank cells are excluded from the patch).
- Two other pages not present in the CSV are left completely untouched.
- A quoted field with an embedded comma and escaped quote
  (`"has, a ""quote"" and comma"`) parses correctly.

Remaining suggested follow-up (not done): an actual UI-driven test
(click Import CSV, pick a real file) rather than calling the exposed
function directly, and a regression test/assertion so this can't silently
break again.
