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

| Path                                                        | Branch                       | Owner task                                                 | Status                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/home/ohdaveed/HHVC_manager_review_current_tool_package`   | `main`                       | Coordination home + full source-of-truth audit (see below) | Clean — the `schema-gaps-refactor` duplicate fixes were discarded and this checkout switched back to `main`                                                                                                                                                                                                                                                    |
| `/home/ohdaveed/HHVC_manager_review_current_tool_package_2` | `schema-gaps-refactor-2`     | Schema-gap fixes across `pages/*.js`                       | **Done and merged into `main`** — converted `steps[]` sequences and per-page buttons (no confirmed home in the real Information-page schema) into numbered `bullets[]` and inline markdown links, across ~34 pages. Committed on the branch first (throwaway `fix_*.js` scripts + a stray PDF deleted, not committed), then merged into `main`. Conflicted with `hhvc-citation-fix`'s content in 8 `report-*.js` files — 7 were pure restructuring (no factual difference, took the restructured side); `report-bed-bugs.js` needed a hand merge to keep the corrected "two working days" timeline (not the older 72h/5-day figure this branch still had) while applying the restructuring. `bun run validate` passes and 3 pages spot-checked live in-browser (mite-information, report-bed-bugs, respond-to-notice-of-violation) render correctly post-merge. |
| `.claude/worktrees/hhvc-citation-fix`                       | `worktree-hhvc-citation-fix` | Citation fix                                               | **Done and merged into `main`** — Article 11/11A statutory citations added to pigeon report/info pages + 6 sibling report pages, `cardSchema.text` made optional + `renderCards()` fixed to match, and a bed-bug abatement timeline correction (72h/5-day → two working days, matching the primary source). Merged clean, `bun run validate` passes on `main`. |
| `.claude/worktrees/schema-gaps-safe`                        | `worktree-schema-gaps-safe`  | SFDPH-policy/citation accuracy audit                       | **Done and merged into `main`** (verified: `main` now contains the FY26-27 fee schedule doc and $256/$234 rates directly). All known findings from this task resolved.                                                                                                                                                                                         |

## NEW: full source-of-truth audit — `docs/source-of-truth-audit-2026-07-06.md`

All 39 `pages/*.js` files have now been read in full and cross-referenced
against every doc in `docs/source/hhvc-policy/` (extends `schema-gaps-
safe`'s ~5-page citation audit to full coverage). **Do not re-run this
audit** — read the doc instead. Highlights (full detail + line numbers in
the doc):

- **8 pages** carry an uncited "DBI under the San Francisco Housing Code
  (2025)" routing claim with zero support in any tier-1 source doc:
  `hhvc-inspection-scope.js`, `keep-rats-and-mice-out.js`,
  `prevent-cockroaches.js`, `prevent-mosquitoes.js`, `reduce-indoor-
moisture.js`, `report-mold-humidity-condensation.js`,
  `what-happens-after-report.js`.
- **3 pages** (`mosquito-control-program.js`, `mosquito-education-
workshop.js`, `prevent-mosquitoes.js`) cite phone number
  `415-252-3806`, which doesn't exist in any source doc — the real DPH
  number is `415-252-3800`.
- `integrated-pest-management-property-managers.js` generalizes bed-bug-
  only Director's Rules (72hr/two-working-day window, 2-year
  recordkeeping, adjacent-unit inspection) into a blanket "any pest"
  policy.
- Tree/branch clearance distance disagrees with the source (6 ft) and with
  itself across pages (3 ft / 4 ft / 4 ft in three different files).
- `bed-bug-rules-prevention.js` has a wrong statute (Article 11A vs. the
  correct 11), a fabricated 12-inch furniture-clearance rule, and an
  invented verbatim trilingual warning-label quote.
- `what-happens-after-report.js` asserts an unsourced 48–72hr sewage
  window, an unsourced 30-day "all other violations" window (conflated
  with the unrelated fee late-payment deadline), and an unsourced
  Director's Hearing/attorneys'-fees enforcement mechanism.

This audit is find-only — no `pages/*.js` edits were made. Whoever picks
up fixing any of these should check the doc for the full finding first
(confidence level + exact source citation) rather than re-deriving it.

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
