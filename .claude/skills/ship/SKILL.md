---
name: ship
description: Rebase, test, commit, push, open PR, watch CI, verify deploy
---

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
6. After merge, verify the artifact rather than the pipeline: load the live
   Railway URL headlessly, assert zero console errors, and confirm the deployed
   commit matches a freshly fetched `origin/main`. A `curl` status code can come
   from the previous deployment and cannot see the console.
7. Switch to `main` and pull, then delete the branch by name with
   `git branch -D <branch>` — a squash merge leaves it unmerged in git's view,
   so `-d` refuses. `gh pr merge --squash --delete-branch` does both sides.
