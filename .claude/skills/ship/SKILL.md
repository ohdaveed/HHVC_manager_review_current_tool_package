---
name: ship
description: Rebase, test, commit, push, open PR, watch CI, merge, verify deploy
allowed-tools: Read Grep Glob Bash(git *) Bash(gh *) Bash(bun *) Bash(bunx *) mcp__plugin_playwright_playwright__browser_navigate mcp__plugin_playwright_playwright__browser_console_messages mcp__plugin_playwright_playwright__browser_evaluate mcp__plugin_playwright_playwright__browser_close
---

**Step 6 merges to `main`, and on this repo the merge is the deploy. Get an
explicit go-ahead before running it** — steps 1-5 are reversible, step 6 is not.
The `allowed-tools` line above is a tool-surface bound, not a stop: it denies
this skill arbitrary shell (no `curl`, no `rm`, no package installs) but it does
not by itself gate the merge, because `gh` is exactly what the merge runs on.

1. `git fetch origin`. Rebase only if main actually moved — check
   `git rev-list --count HEAD..origin/main` first, and use
   `git rebase --autostash origin/main` so uncommitted work in the tree does not
   abort it. Never rebase once the PR is open: that rewrites pushed commits and
   forces a force-push into a live review.
2. Run the test suite; stop and report if red.
3. Commit with a conventional-commit message.
4. `git push -u origin HEAD` then `gh pr create --fill`
5. `gh pr checks --watch`, then clear every review thread. This repo's `main`
   requires conversation resolution, so one unanswered bot comment blocks the
   merge with all checks green.
6. Confirm with the user first. Then re-fetch, check the remote head carries
   every local commit (`git rev-list --left-right --count origin/main...HEAD`),
   and `gh pr merge --squash --delete-branch`. **The merge is the deploy** —
   Railway is connected to `main`, so a branch push builds nothing and steps 7
   and 8 are unreachable without this.
7. Verify the artifact rather than the pipeline: load the live Railway URL
   headlessly, assert zero console errors, and confirm the deployed commit
   matches a freshly fetched `origin/main` — not local `HEAD`, which is a
   different commit after a squash merge. A `curl` status code can come from
   the previous deployment and cannot see the console.
8. Switch to `main` and pull. `--delete-branch` in step 6 already removed both
   copies; if one survived, delete it by name with `git branch -D <branch>` —
   a squash merge leaves it unmerged in git's view, so `-d` refuses.
