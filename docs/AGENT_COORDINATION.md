# Agent Coordination

Snapshot of active worktrees for this repo, kept so concurrent Claude Code
sessions don't duplicate each other's work. Update this file (and commit on
`main`) when you claim or finish a task in a worktree. Check the latest
committed version (`git show main:docs/AGENT_COORDINATION.md`) before
starting new work if your own worktree's copy looks stale.

## Worktrees (as of 2026-07-06)

| Path | Branch | Owner task | Status |
|---|---|---|---|
| `/home/ohdaveed/HHVC_manager_review_current_tool_package` | `main` | Coordination home | Clean |
| `/home/ohdaveed/HHVC_manager_review_current_tool_package_2` | `schema-gaps-refactor-2` | Schema-gap fixes across `pages/*.js` | **In progress, uncommitted** — 34 modified `pages/*.js` files + `build_scripts/schema.js`, produced via `fix_all.js`, `fix_buttons.js`, `fix_commas.js`, `fix_inline_cards.js`, `fix_lists.js`, `strip_cards.js` (untracked helper scripts in that worktree) |
| `.claude/worktrees/hhvc-citation-fix` | `worktree-hhvc-citation-fix` | Citation fix | No substantive changes yet (only `.claude/settings.local.json` diff) |
| `.claude/worktrees/schema-gaps-safe` | `worktree-schema-gaps-safe` | SFDPH-policy/citation accuracy audit: verifying `pages/*.js` and `docs/` claims trace to real agency source docs (`docs/source/hhvc-policy/`), not to the AI-generated `notebooklm/*.md` / `hhvc_chapter_drafts/*.md` content | **In progress** — 1 commit so far (`b7a88e1`: payFee reinspection rate corrected to program-staff-confirmed $256/$234, superseding a stale $251/$229 figure). Remaining known findings not yet committed: `pages/pay-healthy-housing-fee.js` still has a karl note miscrediting "Master Guidelines Chapter 8.3" (nonexistent section) instead of Health Code Sec. 609(d)-(e); `pages/respond-to-notice-of-violation.js` still has the old $251/$229 rate; `pages/bed-bug-rules-prevention.js` has an unverified "45-day DPH re-inspection" claim not supported by the real bed bug Director's Rules doc; `pages/property-owner-responsibilities.js` has a stray citation to a nonexistent "CLAUDE.md 7.5" section. **Possible overlap with `hhvc-citation-fix`** — that worktree's stated task ("Citation fix") sounds like the same scope as this one. Whoever picks up either worktree next should check both before duplicating work. |

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
- **Note (2026-07-06, schema-gaps-safe session):** file edits in this
  worktree were observed to silently revert between tool calls at least
  once this session (an Edit-tool-reported success did not persist to
  disk/git). Cause unconfirmed — possibly related to concurrent access.
  If you see an edit you made disappear, re-verify with `git status`/`grep`
  before assuming it's a mistake on your end, and consider committing
  small batches immediately rather than making many edits before a single
  commit.
