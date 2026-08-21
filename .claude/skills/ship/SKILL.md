---
name: ship
description: Rebase, test, commit, push, open PR, watch CI, verify deploy
---

1. `git fetch origin && git rebase origin/main`
2. Run the test suite; stop and report if red.
3. Commit with a conventional-commit message.
4. `git push -u origin HEAD` then `gh pr create --fill`
5. `gh pr checks --watch`
6. After merge, curl the live deploy URL and report status + console errors.
7. `git branch -d` the merged branch.
