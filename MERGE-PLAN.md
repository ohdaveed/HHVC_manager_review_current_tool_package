# Merge train — integrating nine outstanding branches

Tracking file for the merge of every open branch in this repo onto `main`,
started 2026-08-26. **This file lives on `chore/merge-train`, not on `main` and
not on any branch under review** — putting it on a PR branch would change that
PR's contents and cost it a CI re-run. While working on another branch, read it
with `git show chore/merge-train:MERGE-PLAN.md`.

**Why not `PLAN.md`.** That name was already taken by a live handoff for the
documentation-cleanup and Svelte porting work, last updated 2026-08-24. This
file was first written straight over it; the original is restored and this one
took a distinct name. Two concurrent efforts cannot share one checklist.

`resume from PLAN.md` has to be enough on its own: blockers, decisions and
anything deliberately skipped go in this file, not only in chat.

## Standing constraints

- **Every merge to `main` is a production Railway deploy** (service `web`,
  connected to `main`). Nine branches is up to eight deploys.
  **DECIDED 2026-08-26 — pause, batch, resume.** Autodeploy is turned off before
  the first merge, the train runs, then it is turned back on and ONE deploy
  carries everything. Mechanism: Railway Service Settings' own
  **Disable automatic deployments** toggle
  (<https://docs.railway.com/deployments/github-autodeploys>), not a watch-path
  trick and not disconnecting the source — it is single-purpose, reverses with
  **Enable**, and leaves the repo connection and the 11 service variables
  untouched. Service `web`, id `f111c8e4-0107-4220-908f-f36f35fb8a50`,
  environment `production`, builder RAILPACK, build `bun run build:railway`,
  start `bun run serve`.
  **Resuming does not deploy by itself.** Re-enabling autodeploy waits for the
  next push, and per Railway's own troubleshooting an empty commit will not
  trigger one where watch paths are set — so the resume step is Enable, then
  **Deploy Latest Commit** from the command palette, then verify.
  Verify the live artifact at the end per the repo's Definition of Done — status
  code, deployed commit against the merged SHA, clean console — not the pipeline
  that built it.
- **The train is strictly serial, and that is measured rather than assumed.**
  `main` sets `strict: true` (a branch must be up to date before merging) and
  `enforce_admins: true` (nobody bypasses it). So every merge stales every other
  open PR: each one then needs `origin/main` merged in, pushed, and a **full CI
  cycle** before it can land. Eight merges is eight serial cycles, not one. There
  is no parallel path, and no admin override.
- **Land everything by SQUASH merge.** `linear: true` disallows merge commits on
  `main`. Merging `origin/main` _into_ a feature branch stays fine — the squash
  flattens it on the way in — but "Create a merge commit" is not available.
- **Resolve every review thread before merging, on every PR.**
  `required_conversation_resolution` is enabled. This is the measured cause of
  #230 sitting `MERGEABLE/BLOCKED` with all seven required contexts green and
  `reviewDecision` empty, and it explains all six stuck PRs at once.
  Thread resolution needs GraphQL, which the local hook blocks and this session
  cannot route around — so it is a user action, in the PR UI or via
  `gh api graphql`, once per PR.
- **No human approval is required** (`required_pull_request_reviews: null`), so
  there is no reviewer bottleneck — only the thread-resolution one above.
- **Never rebase a pushed PR branch.** Merge `origin/main` in instead; a rebase
  over pushed work is a force-push into a live review and is separately gated.
- **`mirror-consistency` and `skill-consistency` fail on merges git resolves
  cleanly.** Two branches editing _different_ sections of `AGENTS.md` /
  `CLAUDE.md` / `.github/copilot-instructions.md` auto-merge with no conflict
  markers and still go red, because those gates compare shared facts and a short
  byte-identical list rather than diffing. A green PR run is not evidence about
  the post-merge tree.
- **Definition of Done here is push + PR + green CI**, not a local merge. Three
  branches currently have no PR at all.

## PREP DONE 2026-08-26 ~17:00Z — every branch staged during the outage

Category-1 work, done while Actions could not schedule runs. **Merge order and
decisions are unchanged**; this only removes the work each cycle would have
discovered.

- **Dry-run merged every branch against `origin/main`** with
  `git merge-tree --write-tree`, which reports conflicts without touching the
  working tree. Five clean, two conflicting: `docs/add-skills` (all three
  mirrors, `package.json`, `tests/skill-consistency.test.js`) and #223
  (`ci.yml` plus two mirrors — deferred anyway).
- **#231 opened** for `docs/skill-coordination-fixes`, with the starship files
  dropped per the decision above. The branch now adds only
  `multi-session-git-coordination/SKILL.md`.
- **Four PR branches brought up to date** and pushed — #224, #225, #222, #213.
  Each merged `origin/main` cleanly (never rebased: they are pushed).
- **Gates run LOCALLY on each**, since CI could not: `format:check`,
  `lint:docs`, `lint:js`, `validate` and the full `bun run test`.
  All green — 2268–2275 pass, 0 fail, across 60 files. Note this is evidence the
  branches are ready, NOT a substitute for the required contexts: branch
  protection is satisfied only by the seven GitHub jobs, and `test:e2e` was not
  run locally.
- **Still outstanding:** `docs/add-skills` (conflict, no PR yet),
  `chore/refresh-skills-lock` (no PR, supersession unverified), and thread
  resolution on #213/#222/#224/#225/#231.

**Actions began scheduling again at 16:57Z** — a run for `f56b208` on #230 went
`in_progress` about 7 minutes after the push, consistent with a draining
backlog rather than full recovery. The incident was still `investigating` at
16:49Z.

## ⚠ LIVE STATE — Railway autodeploy is OFF

**Turned off by the user on 2026-08-26, before the first merge.** Reported in
chat rather than read back from the API — the Railway MCP surface here exposes
`get_service_config` (source, builder, commands, variable count) but no
autodeploy flag, so this line is a record of what was done, not a verification
of it. Confirm in the dashboard before trusting it.

**THIS MUST BE UNDONE AT THE END OF THE TRAIN.** A repo whose `main` silently
stops deploying looks identical to one that is merely quiet, and the failure is
discovered by a reviewer opening a stale URL. The resume step is not just the
toggle:

1. Service `web` → Settings → **Enable** automatic deployments.
2. **Deploy Latest Commit** from the command palette (⌘K) — enabling alone waits
   for the next push, and per Railway's troubleshooting an empty commit will not
   trigger one where watch paths are set.
3. Verify the live artifact: <https://web-production-9bb3b.up.railway.app> —
   status code, deployed commit against `origin/main` re-fetched (not local
   `HEAD`, which differs after a squash merge), console clean.

Harmless while it stays off during the GitHub Actions outage below: nothing can
merge, so nothing would deploy regardless.

## BLOCKED 2026-08-26 ~16:40Z — GitHub Actions major outage

**The whole train is stalled on GitHub, not on this repo.** `81a0331` was pushed
to `chore/doppler-template` at 16:36Z and GitHub created **no workflow run object
at all** for it — not queued, not skipped, absent. Ruled out in order:

- The `CI` workflow is `active` (`gh workflow list`).
- `ci.yml`'s trigger is `pull_request: types: [opened, synchronize, reopened,
ready_for_review]`, so a push to a PR branch is covered. The first suspicion —
  a missing `synchronize` — was wrong.
- GitHub knows the PR head is `81a0331` with 2 commits, so the push landed.
- <https://www.githubstatus.com/api/v2/components.json> reports **Actions:
  `major_outage`** while Webhooks, Git Operations, API Requests and Pull
  Requests are all `operational` (page updated 16:14:16Z). That asymmetry is
  exactly the observed behaviour.

**Consequence:** with `strict: true`, nothing merges without fresh green required
contexts, and no context can report while Actions is down. Re-triggering,
reopening the PR, or pushing empty commits achieves nothing during the outage.

**On recovery:** re-trigger CI for `81a0331` (an empty commit or a close/reopen
of #230), confirm the seven required contexts report, then resume at step 1. The
three review threads on #230 are already resolved, so nothing else gates it.

**Not urgent until then:** turning Railway autodeploy off. It only needs to
happen before the first merge, and no merge is possible yet.

## Board as measured 2026-08-26

| Branch                                      | PR           | ahead/behind `main` | Hub files                                                      |
| ------------------------------------------- | ------------ | ------------------- | -------------------------------------------------------------- |
| `chore/doppler-template`                    | #230         | 1/0                 | — (one new file)                                               |
| `a11y/mockup-body-axe-gate`                 | #225         | 1/3                 | —                                                              |
| `a11y/focus-ring-contrast`                  | #224         | 2/3                 | —                                                              |
| `docs/add-skills` (worktree)                | none         | 3/11                | all three mirrors, `skill-consistency.test.js`, `package.json` |
| `fix/ai-disclosure-citation`                | #222         | 3/3                 | `AGENTS.md`                                                    |
| `chore/track-claude-skills`                 | #213         | 3/4                 | `.gitignore`, `.claude/settings.json`                          |
| `docs/skill-coordination-fixes`             | none         | 1/0                 | —                                                              |
| `chore/refresh-skills-lock`                 | none         | 1/10                | `skills-lock.json`                                             |
| `claude/content-pages-ui-management-hv6fcy` | #223 (draft) | 1/3                 | `AGENTS.md`, `CLAUDE.md`, **`ci.yml`**                         |

## Step 0 — unblock branch protection

- [x] **Read `main`'s required status contexts.** `gh api` is blocked by a local
      PreToolUse hook and this session has no sandbox tool, so the user ran it.
      Result, 2026-08-26 — exactly the seven job names `ci.yml` defines, matching
      `CLAUDE.md`'s prescribed list with nothing extra and nothing missing:
      `Playwright end-to-end tests`, `Format, validate, lint`,
      `Unit tests (bun test)`, `Docs-only checks`, `Build railway bundle`,
      `Build single-file export`, `Detect changed files`.
      **This refutes both candidate causes below.** There is no context that no
      job produces, and `codecov/project` is not required. All seven reported
      SUCCESS or SKIPPED on #230, so the block is not a status check at all.
- [x] **Diagnose why #230 is `MERGEABLE/BLOCKED`.** Measured on 2026-08-26: every
      context green (`Format, validate, lint`, `Unit tests (bun test)`,
      `Playwright end-to-end tests`, `Build railway bundle`,
      `Build single-file export`, `Detect changed files`, `Docs-only checks`
      skipped, GitGuardian, `codecov/patch`, `codecov/bundles`,
      `netlify/hhvc/deploy-preview`), `behind=0`, no blocking review (only two
      `COMMENTED` bot reviews), `reviewDecision` empty. Six PRs open and unmerged
      says this is protection-wide rather than one PR. Two candidates:
      (a) a required context no job produces — the failure mode `CLAUDE.md`
      records after the `checks` job split, which sits permanently pending;
      (b) `codecov/project` required but never posted (`codecov/patch` and
      `codecov/bundles` post, `codecov/project` is absent from the rollup).
- [x] **Find the non-status cause.** With every required context satisfied,
      `MERGEABLE/BLOCKED` has to come from a protection setting that is not a
      status check. Ranked by fit with what is already measured: 1. **Required conversation resolution.** #230 carries two `COMMENTED` bot
      reviews (`qodo-code-review`, `chatgpt-codex-connector`) plus a CodeRabbit
      check. Unresolved inline threads block the merge while leaving
      `reviewDecision` empty and every check green — which is exactly the
      signature observed, and it would equally explain the other five PRs. 2. **A repository ruleset.** Rulesets are evaluated on top of classic
      branch protection and do not appear in the `/protection` payload, so a
      rule added there is invisible to the read above. 3. **Required signatures / linear history / restricted pushes.** Cheap to
      rule out in the same call.
      **ANSWERED 2026-08-26.** Measured:
      `conversation.enabled: true`, `linear.enabled: true`, `strict: true`,
      `enforce_admins.enabled: true`, `reviews: null`, `restricted: false`,
      `signatures.enabled: false`. Cause 1 confirmed; no ruleset lookup needed.
      Corroborating: `qodo-code-review`'s COMMENTED review on #230 has a
      **zero-length body**, so its content is inline thread comments rather than
      a summary — an unresolved thread is present to block on.
- [ ] **Resolve #230's review threads** (`qodo-code-review`, and
      `chatgpt-codex-connector` if it opened any). Needs GraphQL, which the local
      hook blocks and this session cannot route around, so it is a user action:
      the "Resolve conversation" control on each thread in the PR UI. Then
      confirm `gh pr view 230 --json mergeStateStatus` reads `CLEAN`.

## Pre-flight — the working tree has a dirty state with no home

- [ ] **`skills-lock.json` carries 12 uncommitted insertions.** Measured: they do
      _not_ belong to `chore/refresh-skills-lock` — that branch's copy of the file
      is identical to `HEAD`'s, so this is separate work registering the newly
      mined skills. Decide its home before any checkout.
- [ ] **Six untracked `.claude/skills/` directories exist in no branch and no PR**
      — `ci-e2e-shard-optimization`, `codecov-ci-integration-hhvc`,
      `infrastructure-by-measurement`, `neon`, `neon-postgres`,
      `windows-terminal-claude-dev-setup`. A `git clean` destroys them. Their
      tracking status is decided by #213's `.gitignore` change, so they sequence
      with step 5.
- [ ] **`git worktree list` checked** — one worktree exists,
      `.claude/worktrees/docs+add-skills` on `docs/add-skills`. Never deploy from
      a worktree; `railway up` uploads the directory it runs in.

## Merge order

Ordered by hub-file contention, lowest first, so the mirror and skill gates meet
one change at a time.

- [ ] **1. #230 `chore/doppler-template` — NO LONGER FREE. All three findings
      FIXED in `81a0331`; awaiting thread resolution and a green CI run.** Its three
      unresolved threads are substantive review findings, all verified against
      the tree on 2026-08-26 rather than taken on the bots' word. It still goes
      first (`behind=0`, and `strict: true` would stale it behind anything else),
      but it needs a fix commit before it lands. - **1a. `docs/codebase/STACK.md` is now stale — CONFIRMED, one line.**
      Line 70 reads ``No `.env.example` / `.env.template` in repo ([TODO] if
one should be added)`` and line 69's config-source inventory omits the
      new file. `doppler-template.yaml` is not literally either of those names,
      but it answers that TODO and belongs in that inventory. - **1b. AI routes do not fail closed on a dev machine — CONFIRMED, P2.**
      `doppler-template.yaml:56` promises that without a key `/api/ai/*`
      answers 501. `build_scripts/ai/provider-anthropic.js`'s
      `hasOAuthProfile()` reads `~/.config/anthropic/credentials` and its own
      header records that the SDK resolves
      `ANTHROPIC_API_KEY` → `ANTHROPIC_AUTH_TOKEN` → the active profile, so an
      `ant auth login` profile satisfies the provider gate with
      `ANTHROPIC_API_KEY` empty. The template leaves `REVIEW_API_TOKEN: ''`,
      which does hold the first gate at 501 — but the moment a developer fills
      it, that legacy value is a broad principal carrying `ai:generate`
      (`CLAUDE.md`, Optional API access hardening), both gates pass, and the
      dev server can make billed requests. Fix by provisioning a dev principal
      through `REVIEW_API_PRINCIPALS` without `ai:generate`, or by pinning
      `ANTHROPIC_CONFIG_DIR` to isolate profile discovery — not by softening
      the comment. - **1c. `dev_personal` may not be a personal config — UNVERIFIED, P1.**
      The reviewer's claim is that importing a template that lists
      `dev_personal` by slug creates an ordinary branch config rather than a
      user-owned personal one, so Development access cascades to it and the
      isolation asserted at `doppler-template.yaml:33-37` does not hold. That
      is a claim about **Doppler's import semantics**, which nothing in this
      repo can settle; it needs checking against Doppler's own documentation
      or a test import before the thread is resolved either way.
      **ANSWERED 2026-08-26 — the reviewer was right.** Doppler's own docs
      (<https://docs.doppler.com/docs/branch-configs>) state that Personal
      Configs are a FEATURE a project Admin enables per environment, after which
      Doppler creates one `dev_personal` branch per user that only that user can
      access. Listing the slug creates an ordinary shared branch config instead.
      The slug is removed and the comment now records why.
- [ ] **2. #225 `a11y/mockup-body-axe-gate`.** Zero mirror contact. Merge
      `origin/main` in, re-run CI, merge.
- [ ] **3. #224 `a11y/focus-ring-contrast`.** Same. Merge `origin/main` in,
      re-run CI, merge.
- [ ] **4. `docs/add-skills` — open a PR first.** Lands _before_ the other
      `AGENTS.md` branches on purpose: it changes the gate itself
      (`tests/skill-consistency.test.js` plus `package.json`'s enumerated test
      list) and touches all three mirrors, so landing it last would make the
      stricter gate meet several branches' worth of unvalidated skill text in one
      merge. `behind=11` — merge `origin/main` in and expect real work.
- [ ] **5. #222 `fix/ai-disclosure-citation`.** Re-merge `origin/main` after
      step 4; `skill-consistency` is what would catch a mismatch between
      `AGENTS.md` and `.claude/skills/hhvc-ai-assist-backend/SKILL.md`. Check
      whether the `AGENTS.md` section it edits is on the byte-identical list.
- [ ] **6 and 7 are NOT independent — decide the contradiction before either
      lands.** Measured 2026-08-26: #213's only `.gitignore` change is a rule
      ignoring `.claude/skills/starship-prompt-rendering-diagnostics`, whose
      stated reason is that tracking it would enrol it in `lint:docs`, since that
      tool derives its file list from `git ls-files` and a machine-local WSL2
      prompt note would become a CI gate on a repo it says nothing about.
      `docs/skill-coordination-fixes` **adds that exact path as a tracked file**
      (neither it nor `multi-session-git-coordination` is tracked on `main`
      today). The two branches decide the opposite thing about one path.
      Git merges them cleanly in either order, because they touch different
      files — and the result is wrong either way: a `.gitignore` rule cannot
      untrack a tracked file, so the skill ends up tracked, the ignore rule
      inert and misleading, and the SKILL.md enrolled in `lint:docs`, which is
      precisely what #213's comment says it was preventing.
      **DECIDED 2026-08-26 — the starship files give way.**
      `docs/skill-coordination-fixes` drops
      `.claude/skills/starship-prompt-rendering-diagnostics/SKILL.md` and
      `check-prompt.sh`, and #213 keeps its ignore rule intact. That branch then
      lands only `.claude/skills/multi-session-git-coordination/SKILL.md`, which
      is genuinely about working in this repo rather than about the author's
      terminal. Remove them with a NEW commit on that branch, not a rebase or an
      amend — the branch has no upstream, but a plain commit needs no
      destructive-git approval and the removal is worth having in the history
      with its reason attached.
- [ ] **6. #213 `chore/track-claude-skills`.** Also carries
      `.claude/settings.json` and three tracked skill files, so it sequences with
      the pre-flight cleanup above — resolve the six untracked dirs in the same
      pass.
- [ ] **7. `docs/skill-coordination-fixes` — open a PR.** `behind=0`, ahead 1,
      three skill files, no mirror contact. Cheap once the contradiction above is
      resolved.
- [ ] **8. `chore/refresh-skills-lock` — verify it still means anything first.**
      `behind=10`, single file, no PR, and its `skills-lock.json` matches `HEAD`'s.
      Likely superseded by the uncommitted change noted in pre-flight; if so,
      delete the branch rather than spending a PR on it.

## Deliberately deferred

- **#223 `claude/content-pages-ui-management-hv6fcy` (draft) is NOT in this
  train.** It rewrites `.github/workflows/ci.yml` and adds
  `.github/actions/setup-bun/action.yml`, so it can rename required status
  contexts again — and protection has to change in the same breath or every PR
  goes permanently pending. A CI-graph change does not belong in the middle of a
  merge train.
  **Open risk to check before it leaves draft:** it edits `AGENTS.md` and
  `CLAUDE.md` but **not** `.github/copilot-instructions.md`.
  The byte-identical half of that risk is now **cleared by measurement**:
  `IDENTICAL_SECTIONS` in `tests/mirror-consistency.test.js` is one heading long
  — `Security Reviews` — and neither #223 nor #222 touches it (`git diff` over
  `AGENTS.md` returns zero matching lines for both).
  The shared-facts half is **not** cleared and is the live risk: #223 rewrites
  `ci.yml`, and `tests/ci-workflow.test.js` asserts that the job-name list in
  the workflow is exactly the list transcribed into all three mirrors — so a
  renamed job that updates two mirrors and not the third goes red on merge,
  and branch protection's required contexts have to move with it.

## Closing out

- [ ] **Verify the live Railway artifact once at the end** —
      <https://web-production-9bb3b.up.railway.app>: status code, deployed commit
      against the merged SHA re-read from `origin/main` (not local `HEAD`, which
      is a different commit after a squash merge), console clean.
- [ ] **RE-ENABLE Railway autodeploy** (see the LIVE STATE section at the top),
      then **Deploy Latest Commit**, then verify. Turned off 2026-08-26.
- [ ] **Delete every merged branch**, locally and on `origin`.
- [ ] **Decide this file's own fate** — merge it, or delete `chore/merge-train`
      once the train is done.
