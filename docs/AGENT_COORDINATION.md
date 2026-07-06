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
| `.claude/worktrees/hhvc-citation-fix` | `worktree-hhvc-citation-fix` | Citation fix | **Done, committed** — Article 11/11A statutory citations added to pigeon report/info pages + 6 sibling report pages, `cardSchema.text` made optional + `renderCards()` fixed to match, and a bed-bug abatement timeline correction (72h/5-day → two working days, matching the primary source). Not merged to main yet. |
| `.claude/worktrees/schema-gaps-safe` | `worktree-schema-gaps-safe` | Workspace/dashboard UX: discoverability + visible Karl compliance score | **Claiming now** — first-run nudge to reveal the review workspace panel, plus rendering the aggregate Checks-tab pass/warn count that currently only exists for the clipboard-copy summary. Content-only, no `pages/*.js` schema changes expected — should not conflict with `schema-gaps-refactor-2`. |

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
