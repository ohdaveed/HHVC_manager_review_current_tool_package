---
name: ship
description: Rebase, test, commit, push, open PR, watch CI, merge, verify deploy
disable-model-invocation: true
allowed-tools: Read Grep Glob Bash(git fetch *) Bash(git status *) Bash(git log *) Bash(git diff *) Bash(git rev-list *) Bash(git branch --show-current) Bash(gh pr view *) Bash(gh pr checks *) Bash(gh pr diff *) Bash(bun run test) Bash(bun run validate) Bash(bun run format:check) Bash(bun run lint:docs) Bash(bun run check:revert) Bash(bun run lint:dead-code:ci) Bash(bun run lint:architecture) Bash(bun run lint:js) mcp__plugin_playwright_playwright__browser_navigate mcp__plugin_playwright_playwright__browser_console_messages mcp__plugin_playwright_playwright__browser_evaluate mcp__plugin_playwright_playwright__browser_close
---

**Read the frontmatter as it actually behaves.** `allowed-tools` is a
PRE-APPROVAL — tools listed there run without a permission prompt — not a
sandbox. It cannot deny anything. So the list above holds only read-only
inspection: fetch, status, log, diff, rev-list, the read-only `gh pr`
subcommands, the five gate scripts, and the four browser tools step 8 needs.
Every mutating command in this workflow — `git commit`, `git push`,
`git rebase`, `git branch -D`, `gh pr create`, `gh pr merge` — is deliberately
absent, which means this skill does not pre-approve them. **It does not mean
they will stop and ask.** Whether they prompt is decided entirely by the
session's own permission configuration: a session already holding a broad
`Bash(git *)` allow rule, or running with permission checks bypassed, runs them
without a word. The only real enforcement is a deny rule or a hook, in settings
the caller controls, not in this file. What this frontmatter genuinely buys is
narrower: it declines to hand out a pre-approval, and
`disable-model-invocation: true` means the skill runs only when a human types
`/ship`. Do not "tidy up" by widening these to `Bash(git *)` / `Bash(gh *)`:
that pre-approves the merge, which is the deploy.

1. Refuse to run from `main`. Check `git branch --show-current`; if it is the
   default branch, stop and ask for a feature branch. Step 5 would otherwise
   push `HEAD` straight to `origin/main` — deploying with no PR if the
   credentials can bypass branch protection, and failing at `gh pr create`
   (which defaults head to the current branch and base to the default branch)
   if they cannot.
2. `git fetch origin`. Rebase only if main actually moved — check
   `git rev-list --count HEAD..origin/main` first, and use
   `git rebase --autostash origin/main` so uncommitted work in the tree does not
   abort it. Never rebase once the PR is open: that rewrites pushed commits and
   forces a force-push into a live review.
3. `bun install --frozen-lockfile` first — on a fresh checkout the first gate
   otherwise fails for a missing Prettier rather than for anything you changed.
   Then run what CI's `checks` job runs, minus `check:revert`, which belongs in
   step 4: `format:check`, `validate`, `lint:docs`, `lint:dead-code:ci`,
   `lint:architecture`, `lint:js`, `build:railway`, `test`, `build:singlefile`.
   The `e2e` job additionally runs `test:e2e` behind a Chromium install; run it
   locally when the change touches the UI, and otherwise let CI cover it. Stop
   and report on the first failure. Derive this list from `.github/workflows/
ci.yml` rather than trusting it here — a copy of a list is free to drift
   from the list, and this one already did once, claiming completeness at five
   of eleven steps.
4. Commit with a conventional-commit message carrying the `Co-Authored-By` and
   `Claude-Session` trailers this repo requires of AI-assisted commits, then
   read it back with `git log -1 --format=%B` and confirm both are present. An
   instruction to include a trailer is not evidence that one was written.
   Then run `bun run check:revert` — HERE, not in step 3. It compares two
   REVISIONS (`origin/main` against `HEAD`) and reads neither the index nor the
   working tree, so run before the commit it inspects the previous commit and
   passes while the restoring change sits unexamined in the tree.
5. `git push -u origin HEAD` then `gh pr create --fill`. If step 2 rebased a
   branch that had already been pushed, this plain push is rejected as
   non-fast-forward and the run stops before a PR exists — capture the remote
   OID beforehand and push with `--force-with-lease=<ref>:<oid>`, which refuses
   if anyone else moved the ref meanwhile.
6. `gh pr checks --watch`, then clear every review thread. This repo's `main`
   requires conversation resolution, so one unanswered bot comment blocks the
   merge with all checks green.

   **If you poll instead of using `--watch`, wait for the required checks to be
   PRESENT and finished — not merely for nothing to be pending.** GitHub takes
   a few seconds to create a run's checks after a push, and during that window
   the pending set is EMPTY, so the obvious loop

   ```sh
   # WRONG: exits instantly while the checks do not yet exist
   until [ -z "$(gh pr checks N --json name,bucket --jq '.[]|select(.bucket=="pending")')" ]; do sleep 20; done
   ```

   returns at once and reports the PREVIOUS run's result, or nothing at all, as
   success. Count what finished instead of looking for an absence:

   ```sh
   # The required checks are whatever branch protection says they are. Do not
   # write the job names here: that is a second inventory, and a renamed job
   # would leave this polling forever against an already-green PR.
   REQUIRED=$(gh api repos/{owner}/{repo}/branches/main/protection \
     --jq '.required_status_checks.contexts[]')
   want=$(printf '%s\n' "$REQUIRED" | grep -c .)

   # `gh pr checks --jq` accepts no --arg, and jq is not a dependency here, so
   # bun does the filtering.
   count() { gh pr checks "$1" --json name,bucket | REQ="$REQUIRED" MODE="$2" bun -e '
     let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
       const req=(process.env.REQ||"").split("\n").filter(Boolean)
       let j=[]; try{ j=JSON.parse(s) }catch{}
       const mine=j.filter(c=>req.includes(c.name))
       console.log(process.env.MODE==="settled"
         ? mine.filter(c=>c.bucket!=="pending").length
         : mine.filter(c=>c.bucket!=="pass").length)
     })'; }

   until [ "$(count N settled)" = "$want" ]; do sleep 20; done   # exist AND settled
   [ "$(count N notpass)" = "0" ] || { echo "CI is not green"; exit 1; }
   ```

   **Neither half is optional.** The loop exists because waiting for an ABSENCE
   of pending checks returns instantly in the seconds before GitHub creates
   them, reporting a stale or missing result as success — which happened twice
   while this skill was being written. The pass check exists because
   `gh pr checks --help` defines `bucket` as `pass`, `fail`, `pending`,
   `skipping` or `cancel`, so waiting only for `!= "pending"` exits just as
   happily on a FAILED, cancelled or skipped job, and swallows `gh`'s own
   non-zero exit inside the substitution — the very signal `--watch` would have
   given you. Keep only the loop and you have traded "merges too early" for
   "merges on red", which is worse. `gh pr checks` also exits non-zero with
   `no checks reported on the '<branch>' branch` inside that creation window, so
   tolerate that rather than reading it as failure.

   Trading one silent wrong answer for another is the trap this whole step
   exists to name.

   `gh pr checks` also exits non-zero with `no checks reported on the '<branch>'
branch` inside that window, so tolerate that rather than reading it as a
   failure. This is not hypothetical: the loop above silently reported nothing
   twice while writing this skill, and both times the run it was meant to watch
   had not started.

7. Confirm with the user first. Then prove three things, in this order, because
   each catches a different way the merge ships something you did not inspect:
   - `git status --porcelain` is empty. Clearing a review thread often leaves an
     unstaged or staged fix, and a revision-only check cannot see one — it is
     not a commit yet, so every count reads 0 while the fix stays behind.
   - `git rev-list --count @{upstream}..HEAD` is 0, so the remote head carries
     every local commit. Comparing `origin/main...HEAD` does not test this: it
     measures local `HEAD` against the base branch, so an unpushed commit still
     reads as an ordinary `0 N`.
   - The head GitHub holds equals the head you inspected. Read it fresh —
     `gh pr view --json headRefOid` — and require it to equal
     `git rev-parse HEAD`, then pass that same SHA to
     `gh pr merge --squash --delete-branch --match-head-commit <sha>`. The
     revision counts cannot substitute for this: if another actor pushed after
     your last fetch, the remote-TRACKING ref still points at your inspected
     commit, so `@{upstream}..HEAD` reads 0 while the PR head has moved on.
     Only asking GitHub what it currently holds detects that, and
     `--match-head-commit` then makes the merge fail rather than silently
     shipping the newer commit.
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
