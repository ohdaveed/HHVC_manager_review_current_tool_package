---
name: stacked-branch-coordination
description: 'Coordinate multi-PR branch stacks with integrated progress tracking across PLAN.md, GitHub, CI, and live dashboards. Use this skill when working on multiple dependent feature branches that must merge in sequence, or when coordinating a pull-request series where one PR depends on another.'
trigger: 'Use this skill when working on multiple dependent feature branches that must merge in sequence, or when coordinating a pull-request series where one PR depends on another.'
author: arrizon.david
source_sessions:
  - arrizon.david_arrizon.david's Organization_default_047e7634-ee21-4523-ad80-707ccb65d194
contributors:
  - arrizon.david
version: 1
created_by_agent: claude_code
created_at: 2026-08-24T04:02:24.227Z
updated_at: 2026-08-24T04:02:24.227Z
---

## Stacked Branch Coordination

When working on a feature that requires multiple PRs stacking on each other (e.g., PR A → PR B → PR C, where B depends on A and C depends on B), coordinate progress across three tracking surfaces and manage merge sequencing carefully.

### Three tracking layers, three jobs

**PLAN.md** (repo root, committed and pushed):

- The **handoff record** — if this session ends abruptly, "resume from PLAN.md" is meant to be enough on its own
- Checklist of deliverables per PR, with boxes ticked as work lands
- The branch-stack table showing which PR sits on which base and why
- Any blockers or decisions made that the next session should know

**GitHub PRs**:

- Live diffs and CI results
- Review feedback and blocking conditions
- Squash vs. merge decisions (based on open reviews — if a PR is under active review, merge rather than rebase to avoid force-pushing into the review thread)

**Artifact dashboard** (updated as work lands):

- Live view of progress: what's landed, what's queued, why each PR stacks where it does
- CI grid showing status at a glance
- Key finding per PR (the discovery that drove it)

### Sequencing merges

A stacked PR series cannot merge all at once. Commit order matters when PRs depend on each other:

1. **Base branch first.** If PR B sits on PR A, then A must merge before B can. GitHub blocks merging B until A is merged.
2. **Merge blocks.** A PR may be `CLEAN` and `MERGEABLE` but still `BLOCKED` if it requires an approving review. If you cannot approve your own PR (the account opened it), seek approval or find another path.
3. **Refresh targets after each merge.** Once the base PR merges, the dependent PR's target may automatically update. Verify it is correct.

### Resolving merge conflicts

When a base PR merges and a dependent PR picks up conflicts:

**Do not rebase into a live review.** Force-pushing over a PR that's under review breaks the review thread. Instead:

1. **Derive the correct tree independently.** Check out a fresh branch from the new base, cherry-pick the PR's unique commits.
2. **Verify byte-for-byte.** (`git diff` empty = correct merge.)
3. **Merge rather than rebase,** preserving the original commits and review context.

### Decision trees when blocked

If a PR cannot merge, the block is usually one of:

1. **Needs approving review** — seek approval, escalate, or consider merging base PRs first to unblock downstream.
2. **Failing CI** — fix the failure, push, and watch CI re-run.
3. **Unresolved review comments** — distinguish blocking (must fix before merge) from informational (can land with a reply).

When stuck, offer three paths:

- **(a)** Unlock the immediate constraint (e.g., seek approval).
- **(b)** Take a different angle (e.g., merge a different branch first).
- **(c)** Gather more information (e.g., read review threads to know which comments are outstanding).

### Handoff best practices

- **Tick boxes in PLAN.md as work lands,** not at the end. Each push completing a task should tick its box and push PLAN.md.
- **Keep the artifact dashboard in sync.** Republish whenever a PR lands, CI results change, or a blocker resolves.
- **State branch names and merge bases explicitly** in PLAN.md and PR descriptions. A reader should reconstruct the stack from PLAN.md without asking.
- **Never leave commits unpushed.** Stacked branches add complexity; unpushed commits add risk.
