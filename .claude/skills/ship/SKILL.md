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
subcommands, the eight gate scripts, and the four browser tools step 8 needs.
**Step 6's poll loop is deliberately not pre-approved, and that costs a
prompt.** `Bash(gh api *)` and `Bash(bun -e *)` were listed here briefly so the
loop could run unattended. They were removed: a pre-approval is matched as a
PREFIX, so `gh api *` covers `-X DELETE` just as well as a GET — `gh api`'s
`--method` defaults to GET but its field flags switch a request to POST on
their own — and `bun -e *` is arbitrary JavaScript, free to write files or
spawn processes. Two patterns that broad would have pre-approved more mutation
than every command in the paragraph below, which this skill withholds on
purpose. The loop's `mktemp` and `rm -f` are absent for the identical reason:
`Bash(rm -f *)` pre-approves far more than one temp file. One prompt per run is
the cheaper side of that trade, and it is the same trade in all three cases.
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
   merge with all checks green. **`--watch` does not escape the race
   described below.** Started inside the creation window it attaches to the
   PREVIOUS run's checks and reports green for work it never saw — the same
   stale read the loop below exists to prevent, just with a spinner. Let the
   push register its checks before running it, or poll.

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
   PR=<the pull request number>
   SHA=$(git rev-parse HEAD)

   # Bind to the commit you pushed. `gh pr checks` describes whatever the PR
   # points at RIGHT NOW, which in the seconds after a push is still the
   # previous run -- measured below at t+3s: eight checks, every one green.
   # Requiring a run for THIS sha, and requiring it to be finished, closes
   # both that and the half-created run underneath it. Existence alone is not
   # enough: jobs become checks as they START, so a run mid-creation reports a
   # SUBSET, and a subset that happens to be all green reads as a pass.
   # Actions-only, so it is a floor rather than a census -- and today the
   # floor carries it: both required contexts are ci.yml jobs, so a completed
   # ci.yml run means every required check exists. Add a required check from
   # another provider and that stops being true, in a way `probe` cannot
   # cover for you. `--required` reports the checks that EXIST, so one not yet
   # created is ABSENT rather than pending, and the all-green subset left
   # behind reads as a pass -- the same stale-subset bug this binding closes,
   # moved one level up. Gate that provider here too rather than trusting
   # `probe` to notice a check it was never shown.
   # Scope to the GATING workflow, not every run for the sha. Filtering on
   # head_sha alone also catches `link-check.yml`, which this repo makes
   # non-gating on purpose so a third-party outage cannot block a merge; a
   # manual dispatch of it against the branch would hold `sha_state` at
   # `running` and time the loop out with CI already green.
   sha_state() {
     gh api "repos/{owner}/{repo}/actions/workflows/ci.yml/runs?head_sha=$SHA" \
       --jq 'if .total_count==0 then "none"
             elif ([.workflow_runs[]|select(.status!="completed")]|length)>0
             then "running" else "done" end' 2>/dev/null
   }

   # `--required` asks the SERVER which checks are required, so this needs no
   # Administration permission. Reading branch protection does -- a
   # collaborator who can push and merge still gets 403 there and would abort
   # every time -- and it returns `required_status_checks.contexts`, which
   # GitHub has put a closing-down notice on. The trade is that a
   # server-filtered list cannot tell you what is MISSING, and `[].every()` is
   # true, so an empty answer must be caught by hand rather than counted.
   probe() {
     errf=$(mktemp)
     out=$(gh pr checks "$PR" --required --json name,bucket 2>"$errf"); rc=$?
     msg=$(cat "$errf")
     # Silence the cleanup. probe() is read through `$(...)`, so ANY other
     # command that writes to stdout here lands in the verdict: an
     # interactive `alias rm='rm -v'` prepends `removed '/tmp/...'` and the
     # case below falls through to the abort. Measured, not hypothetical.
     rm -f "$errf" >/dev/null 2>&1
     # Do not `|| return 1` on rc alone. The creation window exits non-zero
     # with `no checks reported on the '<branch>' branch`, which is a "not
     # yet". An expired token or a 5xx is NOT, and must never masquerade as
     # slow CI -- that would trade a false green for a silent 30-minute hang.
     if [ "$rc" -ne 0 ]; then
       case "$msg" in
         *"no checks reported"*) echo wait ;;
         *) echo error ;;
       esac
       return
     fi
     printf '%s' "$out" | bun -e '
       let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
         let j
         try { j=JSON.parse(s) } catch { console.log("error"); return }
         if (!Array.isArray(j)) { console.log("error"); return }
         if (j.length===0) { console.log("wait"); return } // [].every() is true
         if (j.some(c=>c.bucket==="pending")) { console.log("wait"); return }
         // `skipping` is GitHub's NEUTRAL, which branch protection does not
         // block on -- treating it as failure aborts a PR the merge button
         // would take. `cancel` is NOT in that set: a cancelled run never
         // reported, so it has proved nothing.
         const ok=c=>c.bucket==="pass"||c.bucket==="skipping"
         console.log(j.every(ok) ? "pass" : "fail")
       })'
   }

   # Bounded, so "tolerate the creation window" cannot become "hang forever on
   # a PR whose CI never triggered". Expiry aborts; it never falls through.
   deadline=$(( $(date +%s) + 1800 ))
   while :; do
     case "$(sha_state)" in
       none|running) v=wait ;;   # no finished run for the commit you pushed
       done) v=$(probe) ;;
       *) v=error ;;             # unreadable count is not a slow run
     esac
     case "$v" in
       pass) echo "CI green on $SHA"; break ;;
       fail) echo "ABORT: a required check did not pass"; exit 1 ;;
       wait) [ "$(date +%s)" -lt "$deadline" ] \
               || { echo "ABORT: timed out waiting on required checks"; exit 1; }
             sleep 20 ;;
       # error, or an empty line because bun itself could not run.
       *)    echo "ABORT: cannot read check status"; exit 1 ;;
     esac
   done
   ```

   **Every way this step has reported a false green, and what closes each.**
   The list grew by one each time the loop was actually run rather than read,
   which is the argument for running it.

   - **Waiting for an ABSENCE of pending checks.** Returns instantly in the
     seconds before GitHub creates them, reporting a stale or missing result
     as success. Closed by asking what FINISHED, never what is absent.
   - **Accepting any bucket that is not `pending`.** `gh pr checks --help`
     defines `bucket` as `pass`, `fail`, `pending`, `skipping` or `cancel`, so
     `!= "pending"` exits just as happily on a FAILED job. Closed by naming the
     acceptable buckets — `pass` and `skipping`, the latter because it is
     GitHub's NEUTRAL and branch protection does not block on it, so scoring
     it as failure aborts a PR the merge button would take. `cancel` stays a
     failure: a cancelled run never reported, so it proved nothing.
   - **Letting a `gh` failure read as zero checks.** Expired auth or a
     transient 5xx leaves the required list empty and every count at zero, and
     zero compares equal to zero, which reads GREEN. Closed by giving an
     unreadable answer its own outcome — a read failure that merely slept
     would spend the whole deadline impersonating slow CI.
   - **Then over-correcting that into an abort.** Treating every non-zero `gh`
     exit as fatal kills a healthy run, because the creation window exits
     non-zero with `no checks reported on the '<branch>' branch` — a "not yet".
     Closed by matching the message rather than the code. Note `--json`
     changes what you are guarding: `gh help exit-codes` documents 8 for
     PENDING, and measured on gh 2.97.0 against a genuinely pending check,
     `gh pr checks <n>` exited 8 while the same PR with
     `--json name,bucket` exited 0 in the same second.
   - **Letting anything else write to stdout.** `probe` is consumed as
     `$(probe)`, so its stdout must carry the verdict and nothing else. On the
     machine this was written on `rm` is aliased to `rm -v`, and the cleanup
     line printed `removed '/tmp/tmp.42FSr6UGYe'` ahead of a perfectly good
     `wait`; the `case` matched nothing and aborted a healthy run. It failed
     closed, so it cost a re-run rather than a bad merge. An interactive
     shell's aliases are part of the environment the snippet runs in.
   - **Reading a SUBSET as the whole.** `--required` is what keeps this
     runnable without Administration permission, but a server-filtered list
     cannot say what is missing, and `[].every()` is `true`. A run whose
     second job has not started yet reports one green check and reads as a
     pass. Closed by the `sha_state` precondition, not by counting.

   **One residual this loop does NOT close, stated rather than papered over.**
   `--required` cannot emit a row for a required context that produced no
   check at all — a job renamed in `ci.yml` before branch protection was
   updated to match, say. `sha_state` does not catch it either: it proves the
   gating run finished, not that every required context exists. So a non-empty
   all-pass subset reads `pass` while GitHub still refuses the merge. Closing
   it needs the complete required-context inventory, which is the
   Administration-only endpoint this loop dropped on purpose. What the loop
   reports is therefore "every required check that EXISTS has passed", which is
   not the same sentence as "GitHub will let you merge" — step 7 reads the
   merge box, and step 6 prefers `--watch`, for exactly this gap.

   **Both of the first two were measured on this repo, 2026-08-21**, polling
   `gh pr checks --json name,bucket` every three seconds across a push to an
   open PR. At t+3s it returned the PREVIOUS run's eight checks, every one of
   them `pass`. At t+6s it exited 1 with an empty body and
   `no checks reported`. From t+9s the new run's checks appeared. Both
   failures sit in that trace three seconds apart, and the window was ONE poll
   wide — which is why it is missed by hand, and why it has to be handled by
   shape rather than caught by luck.

   The two halves pull against each other: tightening the guard until no read
   error can read green is exactly what makes a pending check look like a
   broken one. Trading one silent wrong answer for another is the trap this
   whole step exists to name. What settles it is classifying instead of
   counting — `pass`, `fail`, "no verdict yet" and "no trustworthy answer" are
   four outcomes, not two — plus binding the question to the commit you
   actually pushed, so a green belonging to someone else's commit cannot be
   mistaken for yours.

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
