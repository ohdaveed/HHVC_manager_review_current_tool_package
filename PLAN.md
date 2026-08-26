# Merge train — integrating nine outstanding branches

Tracking file for the merge of every open branch in this repo onto `main`,
started 2026-08-26. **This file lives on `chore/merge-train`, not on `main` and
not on any branch under review** — putting it on a PR branch would change that
PR's contents and cost it a CI re-run. While working on another branch, read it
with `git show chore/merge-train:PLAN.md`.

`resume from PLAN.md` has to be enough on its own: blockers, decisions and
anything deliberately skipped go in this file, not only in chat.

## Standing constraints

- **Every merge to `main` is a production Railway deploy** (service `web`,
  connected to `main`). Nine branches is up to eight deploys. Verify the live
  artifact at the end per the repo's Definition of Done — status code, deployed
  commit against the merged SHA, clean console — not the pipeline that built it.
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

- [ ] **Read `main`'s required status contexts.** `gh api` is blocked by a local
      PreToolUse hook and this session has no sandbox tool, so the user runs it:
      `! gh api repos/:owner/:repo/branches/main/protection --jq '.required_status_checks.contexts'`
- [ ] **Diagnose why #230 is `MERGEABLE/BLOCKED`.** Measured on 2026-08-26: every
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
- [ ] **Fix protection** to match the seven job names `ci.yml` actually defines,
      per `CLAUDE.md`'s required-contexts list, and confirm #230 flips off
      `BLOCKED`.

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

- [ ] **1. #230 `chore/doppler-template`.** One new file, `behind=0`, green.
      Free, and merging it proves protection is unstuck.
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
- [ ] **Delete every merged branch**, locally and on `origin`.
- [ ] **Decide this file's own fate** — merge it, or delete `chore/merge-train`
      once the train is done.
