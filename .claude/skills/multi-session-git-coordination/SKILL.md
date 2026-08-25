---
name: multi-session-git-coordination
description: 'Coordinate git operations, tree ownership, and deployment state across multiple concurrent Claude sessions in the same repository. Use this skill when multiple Claude sessions are running concurrently in the same repository and need to coordinate git operations, branch checkouts, or deployment state.'
trigger: 'Use this skill when multiple Claude sessions are running concurrently in the same repository and need to coordinate git operations, branch checkouts, or deployment state.'
author: arrizon.david
source_sessions:
  - arrizon.david_arrizon.david's Organization_default_3ed74575-71c7-48ea-9b3d-6448e3f42cd5
contributors:
  - arrizon.david
version: 1
created_by_agent: claude_code
created_at: 2026-08-25T20:15:00.707Z
updated_at: 2026-08-25T20:15:00.707Z
---

# Multi-Session Git Coordination

When two or more Claude sessions work concurrently in the same repository, sharing a git checkout, they must coordinate to avoid:

- One session's uncommitted work riding into another's commit
- Conflicting branch checkouts stranding the other session mid-task
- Blocking conditions (deployment pauses, required review threads) going unnoticed
- Accidental force-pushes or merges triggered by one session without the other's awareness

## 1. Tree ownership protocol

Before checking out a new branch or touching the index, ask the other session(s):

- "Are you done with the working tree, or still mid-task on `<current-branch>`?"
- Wait for explicit handoff: "The tree is yours" or "I'm still working, I'll notify when done."
- Do not assume a silent lag means consent — idle time is not consent.

When handing back the tree, name the branch you're leaving it on and state whether the index is clean:

- "I'm done at `<branch>` with a clean index, the tree is yours again."
- Or: "I'm done at `<branch>`, but `file1` and `file2` are uncommitted from my work — I'll stash them. The tree is yours."

## 2. Dirty-state visibility

Before you commit or switch branches, run `git status --porcelain` and confirm every line is yours:

- Files from a sibling session's task must not ride into your commit.
- If you find uncommitted files you didn't create, stash them and notify the other session.

**Anti-pattern:** `git commit -a` or `git add .` when sharing the tree. You'll accidentally stage and commit work from the other session.

**Right move:** `git add file1 file2` — explicit paths only.

## 3. Blocking-condition reporting

Silently-failing configurations are the highest-risk case. Surface them unprompted:

- **Deployment pauses** (Railway `watch_patterns`, branch protection, etc.): Even if unverified, report it. "I've set Railway's `watch_patterns` to pause — the next merge to `main` will come back `SKIPPED`, not deployed."
- **Required-conversation-resolution blocks** on PRs: "PR #212 is blocked on review threads. All checks are green, but it won't merge until you resolve them in the UI."
- **Deployment state changes**: "I've cleared the pause — the next push to `main` WILL deploy. That's different from what you approved, confirming before it matters."
- **Unproven configuration changes**: "The un-pause is claimed but not proven end-to-end yet — the first push to `main` is the real test."

The cost of over-reporting is low; the cost of a silent pause is a day lost.

## 4. Merge and deploy coordination

Before merging a PR or pushing to `main`:

- Announce it: "I'm about to merge #212" rather than silently doing it.
- Confirm the other session(s) know what will happen: Does this trigger a deploy? Will it ship multiple commits? Will it change configuration?
- Never use `railway deploy` or similar direct-upload tools when sharing the tree. Those upload the _working directory_, not `main`, and would ship unmerged branch content to production.

## 5. Handoff ceremony

When handing the tree to another session:

- Name the branch: "Left on `docs/codebase-drift` at `cada881`"
- State the index: "Tree is clean" or "Stashed your §1.11 work in `stash@{0}`"
- Make it explicit: "The tree is yours again."

## Example: Stacked-branch coordination

Session A: "Are you done with the tree?"
Session B: "Still on `#207`, give me 5 min."
Session B: "Done at `b1027c5`, tree clean. The tree is yours."
Session A: "Understood. Merging `#207`. Railway paused — `#212` won't deploy until I clear it."
Session A: "Merged. The pause is off, un-proven until the next push. Leaving you on `main`."

## Anti-patterns

- **Assuming silence means yes.** Always ask explicitly.
- **Staging with `-a` or `-A` when sharing the tree.** You will commit the other session's work.
- **Merging without announcing it**, even if it's their call.
- **Silently leaving a deployment pause in place.** It blocks all future merges invisibly.
- **Using `railway deploy` or `git push --force` when sharing the tree.** Those violate the ownership boundary.
- **Resolving PR threads and merging without confirming the peer saw the change.** Stale resolutions can hide rework.
