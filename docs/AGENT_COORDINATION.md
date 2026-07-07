# Agent Coordination

Snapshot of active worktrees for this repo, kept so concurrent Claude Code
sessions don't duplicate each other's work. Update this file (and commit on
`main`) when you claim or finish a task in a worktree. Check the latest
committed version (`git show main:docs/AGENT_COORDINATION.md`) before
starting new work if your own worktree's copy looks stale.

## RESOLVED: reinspection fee rate is $256/inspector, $234/technician

Multiple sessions went back and forth on whether $251/$229 (FY25-26) or
$256/$234 (FY27) was the "correct, non-fabricated" reinspection rate. This
is now settled: **$256/$234 is correct** for the current fiscal year. The
program owner directly confirmed it, and a real SFDPH EHB fee schedule PDF
for FY 2026-27 (rates effective 7/1/26-6/30/27) was obtained and ingested
at `docs/source/hhvc-policy/2026-07-06-dph-ehb-fee-schedule-fy26-27.md`
(+ matching `.pdf`). That document also confirms the apartment-building
fee tiers ($103/$129/$174/$350/$485/$688/$808) and half-hour add-on rates
($128 inspector / $115 technician). The earlier "unsourced FY27 table"
correction note (in `2026-07-06-dph-ehb-fee-schedule-fy25-26.md`) was
itself mistaken — those figures were real future data, not a NotebookLM
fabrication. **If you see $251/$229 anywhere in `pages/*.js`, it's stale
FY25-26 data and should be updated to $256/$234 with a citation to the
fy26-27 doc — do not "fix" $256/$234 back to $251/$229.**

Pages already updated to FY26-27 in `worktree-schema-gaps-safe` (commits
`03ac22d`, `a18ef11`, `700b4a7`, `cb7d3b6`, `ebf7211`, `c0bf810`):
`pay-healthy-housing-fee.js`, `respond-to-notice-of-violation.js`,
`what-happens-after-report.js`, `property-owner-responsibilities.js`.
Also fixed in that batch: a karl note miscrediting an AI-drafted "Master
Guidelines Chapter 8.3" instead of Health Code Sec. 609(d)-(e); a stray
citation to a nonexistent "CLAUDE.md 7.5" section; an unverified "45-day
DPH re-inspection" claim in `bed-bug-rules-prevention.js` (flagged, not
removed — no source found either way).

## Worktrees (as of 2026-07-06)

| Path | Branch | Owner task | Status |
|---|---|---|---|
| `/home/ohdaveed/HHVC_manager_review_current_tool_package` | `schema-gaps-refactor` | Manual/UI sync work, karl-note cleanup | See note below — has uncommitted changes that duplicate `schema-gaps-safe`'s already-committed fixes |
| `/home/ohdaveed/HHVC_manager_review_current_tool_package_2` | `schema-gaps-refactor-2` | Schema-gap fixes across `pages/*.js` | **In progress, uncommitted** — 34 modified `pages/*.js` files + `build_scripts/schema.js`, produced via `fix_all.js`, `fix_buttons.js`, `fix_commas.js`, `fix_inline_cards.js`, `fix_lists.js`, `strip_cards.js` (untracked helper scripts in that worktree) |
| `.claude/worktrees/hhvc-citation-fix` | `worktree-hhvc-citation-fix` | Citation fix | **Done, committed** — Article 11/11A statutory citations added to pigeon report/info pages + 6 sibling report pages, `cardSchema.text` made optional + `renderCards()` fixed to match, and a bed-bug abatement timeline correction (72h/5-day → two working days, matching the primary source). Not merged to main yet. Check the "RESOLVED" section above before doing more fee-citation work in this worktree — it likely overlaps with `schema-gaps-safe`'s completed work. |
| `.claude/worktrees/schema-gaps-safe` | `worktree-schema-gaps-safe` | SFDPH-policy/citation accuracy audit | **Done** — 6 commits (see "RESOLVED" section above), branch pushed to origin. All known findings from this task resolved. |

## KNOWN DUPLICATE: `schema-gaps-refactor` has redundant uncommitted fixes

The main checkout (`/home/ohdaveed/HHVC_manager_review_current_tool_package`,
branch `schema-gaps-refactor`) independently made the same four fixes
`schema-gaps-safe` already committed (see "RESOLVED" section above) —
$251/$229 → $256/$234 in `pay-healthy-housing-fee.js` and
`respond-to-notice-of-violation.js`, the Master Guidelines Chapter 8.3
mis-citation fix, and the bed-bug 45-day-reinspection unverified flag —
plus a near-identical edit to
`docs/source/hhvc-policy/2026-07-06-dph-ehb-fee-schedule-fy25-26.md`. As of
this note these 5 files are uncommitted and not yet reconciled; whoever
picks up that checkout next should diff against `schema-gaps-safe`'s
commits and drop the redundant hunks rather than committing a second copy
of the same fix.

## Rules to avoid duplicate work

- **Do not re-run the `fix_*.js` scratch scripts** in any other worktree —
  that batch of pages/schema fixes is already applied (uncommitted) in
  `schema-gaps-refactor-2`. If you pick up that worktree, review and commit
  those changes rather than regenerating them.
- The `fix_*.js` / `temp.js` files are throwaway migration scripts, not
  part of `build_scripts/` — don't commit them as permanent tooling; delete
  after use.
- Before starting new schema/page-content work, check this table for an
  existing owner.
- **Note (2026-07-06, schema-gaps-safe session):** file edits were
  observed to silently revert between tool calls multiple times this
  session (Edit-tool-reported successes that did not persist to disk/git
  on the first attempt). Confirmed as a cross-session phenomenon — another
  worktree independently logged the same symptom around the same time.
  Cause unconfirmed, possibly related to concurrent access across the
  several active worktrees on this repo. Mitigation that worked: verify
  every edit with a plain `grep`/`git diff` immediately after, and commit
  in small batches rather than making many edits before one commit.
