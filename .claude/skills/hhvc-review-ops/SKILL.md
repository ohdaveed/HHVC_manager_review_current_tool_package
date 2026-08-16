---
name: hhvc-review-ops
description: 'HHVC repo: the stored-review-data diagnostics panel at the end of Help — why it lost its own tab, why orphaned records are a real class, why an empty page-key set must report NO orphans rather than all of them, why `local_dirty`s three states are reported separately, and why pruning re-derives its list at click time. Load before editing js/review-ops*.js or css/review-ops.css.'
---

<!-- Extracted from CLAUDE.md/AGENTS.md on 2026-08-15. AGENTS.md remains the
     canonical copy of this content; see "Cross-tool canon" there. -->

# Stored review data (`js/review-ops*.js`)

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
