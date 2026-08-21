---
name: ship
description: Rebase, test, commit, push, open PR, watch CI, merge, verify deploy
disable-model-invocation: true
allowed-tools: Read Grep Glob Bash(git fetch *) Bash(git status *) Bash(git log *) Bash(git diff *) Bash(git rev-list *) Bash(git branch --show-current) Bash(gh pr view *) Bash(gh pr checks *) Bash(gh pr diff *) Bash(bun run test) Bash(bun run validate) Bash(bun run format:check) Bash(bun run lint:docs) mcp__plugin_playwright_playwright__browser_navigate mcp__plugin_playwright_playwright__browser_console_messages mcp__plugin_playwright_playwright__browser_evaluate mcp__plugin_playwright_playwright__browser_close
---

**Read the frontmatter as it actually behaves.** `allowed-tools` is a
PRE-APPROVAL — tools listed there run without a permission prompt — not a
sandbox. It cannot deny anything. So the list above holds only read-only
inspection: fetch, status, log, diff, rev-list, the read-only `gh pr`
subcommands, the test and lint scripts, and the four browser tools step 7
needs. Every mutating command in this workflow — `git commit`, `git push`,
`git rebase`, `git branch -D`, `gh pr create`, `gh pr merge` — is deliberately
absent, so each one stops for permission at the moment it runs. That, plus
`disable-model-invocation: true` (this skill runs only when a human types
`/ship`), is what bounds it. Do not "tidy up" by widening these to
`Bash(git *)` / `Bash(gh *)`: that pre-approves the merge, which is the deploy.

1. Refuse to run from `main`. Check `git branch --show-current`; if it is the
   default branch, stop and ask for a feature branch. Step 4 would otherwise
   push `HEAD` straight to `origin/main` — deploying with no PR if the
   credentials can bypass branch protection, and failing at `gh pr create`
   (which defaults head to the current branch and base to the default branch)
   if they cannot.
2. `git fetch origin`. Rebase only if main actually moved — check
   `git rev-list --count HEAD..origin/main` first, and use
   `git rebase --autostash origin/main` so uncommitted work in the tree does not
   abort it. Never rebase once the PR is open: that rewrites pushed commits and
   forces a force-push into a live review.
3. Run the test suite; stop and report if red.
4. Commit with a conventional-commit message, carrying the `Co-Authored-By`
   and `Claude-Session` trailers this repo requires of AI-assisted commits.
5. `git push -u origin HEAD` then `gh pr create --fill`
6. `gh pr checks --watch`, then clear every review thread. This repo's `main`
   requires conversation resolution, so one unanswered bot comment blocks the
   merge with all checks green.
7. Confirm with the user first. Then re-fetch and prove the REMOTE head carries
   every local commit — `git rev-list --count @{upstream}..HEAD` must be 0.
   Comparing `origin/main...HEAD` does not test this: it measures local `HEAD`
   against the base branch, so a review fix committed but not pushed still
   reads as an ordinary `0 N` while `gh pr merge` merges the stale remote head
   and silently drops the fix. Then `gh pr merge --squash --delete-branch`.
   **The merge is the deploy** — Railway is connected to `main`, so a branch
   push builds nothing and steps 8 and 9 are unreachable without this.
8. Verify the artifact rather than the pipeline: load the live Railway URL
   headlessly, assert zero console errors, and confirm the deployed commit
   matches a freshly fetched `origin/main` — not local `HEAD`, which is a
   different commit after a squash merge. A `curl` status code can come from
   the previous deployment and cannot see the console.
9. Switch to `main` and pull. `--delete-branch` in step 7 already removed both
   copies; if one survived, delete it by name with `git branch -D <branch>` —
   a squash merge leaves it unmerged in git's view, so `-d` refuses.
