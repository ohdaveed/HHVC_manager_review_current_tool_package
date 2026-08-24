# Documentation cleanup, then a Svelte + Supabase porting brief

Six PRs, landed in order. Full reasoning and evidence live in the session plan; this file is
the checklist and the handoff. **`resume from PLAN.md` has to be enough on its own** — record
blockers and decisions here, not only in chat.

## Why

A documentation audit found that a large share of this repo's docs are confidently wrong, and
the wrongness clusters in the files a newcomer opens first. Separately, the Svelte + Supabase
rebuild at `/home/ohdaveed/hhvc-manager-review-svelte` is already ~41 commits in and has
dropped several contracts this repo treats as load-bearing.

## Branching note

This work is the third branch in an existing stack. **Updated 2026-08-24** — the table below
described a stack that no longer exists: #204 has merged and #206 was retargeted at `main`.

| PR   | Head                                     | Base                                     | State                                     |
| ---- | ---------------------------------------- | ---------------------------------------- | ----------------------------------------- |
| #204 | `feat/karl-tag-field-inspection`         | `main`                                   | **merged** 2026-08-24 01:08 UTC, squashed |
| #206 | `content/article11-spotlight-button-cap` | `main`                                   | open, checks green, `BEHIND`              |
| this | `docs/correct-stale-claims`              | `content/article11-spotlight-button-cap` | open, checks green, `BEHIND`              |

It has to stack there rather than branch from `main`, because several corrections depend on
the 2026-08-23 precedence reversal (`dec5fbd`, `0fc3802`) that lives in #204/#206. Branching
from `main` would produce corrections that contradict the tree they land in. That reasoning
still holds for the CONTENT of #206; #204's half of it is now in `main` directly.

An earlier draft of this file called those 26 commits "unpushed" and flagged it as a
Definition-of-Done violation. That was wrong: they are pushed, with open PRs. They are
**unmerged to `main`**, which is what a review stack normally looks like.

## Merge sequence — landing the open stack

Two PRs are open and both are green. They cannot merge together: #207 sits on #206's branch,
so GitHub blocks it until #206 lands. `main` has also moved under both (#208, lefthook), so
each is `BEHIND` and needs `main` merged in before it can go.

**Merge `main` in; never rebase.** Both PRs are open with review history on them, and a rebase
of pushed commits is a force-push into a live review — gated by the global rules, and pointless
here since the repo squash-merges anyway and linear branch history buys nothing.

### The hazard this stack has, stated before it bites

**The repo squash-merges** — every commit on `main` has a single parent and a `(#NNN)` suffix,
and `git merge-base --is-ancestor de33446 origin/main` reports NO. So when #206 lands, `main`
gains **one** commit carrying its changes, while #207's branch still holds `c808fa7`, the
original, as an ancestor. Git then sees the same edit arriving from two unrelated commits.

**The collision site is exactly one file:** `docs/karl-export-field-map.md` is the only path
both PRs touch (`comm -12` over the two net diffs). #206 rewrites three register rows there
(`U19`, `U24`, `O14`); #207 adds the chooser/field-map delta and shifted all 99 `docLine`
citations in `js/karl/karl-blocks.js` by +16. A careless conflict resolution that drops #207's
line shift leaves `tests/karl-blocks.test.js` red, and one that drops #206's `U24` closure
reopens a register entry against a page that no longer violates it.

### Step 1 — Land #206 (`content/article11-spotlight-button-cap` → `main`)

- [ ] `git fetch origin && git checkout content/article11-spotlight-button-cap`
- [ ] `git merge origin/main` — expect clean; #208 touched lefthook config, which #206 does not
- [ ] `bun run validate && bun run test && bun run format:check && bun run lint:docs`
- [ ] Push, `gh pr checks 206 --watch`, confirm all six required contexts pass
- [ ] Merge #206. **Squash**, matching every other merge on `main`
- [ ] Delete the merged branch

### Step 2 — Re-point and repair #207 (`docs/correct-stale-claims`)

- [ ] Confirm GitHub retargeted #207's base to `main` when #206's branch was deleted; if it
      did not, set it with `gh pr edit 207 --base main`
- [ ] `git checkout docs/correct-stale-claims && git merge origin/main`
- [ ] **Resolve the `docs/karl-export-field-map.md` conflict by keeping both halves** — #206's
      three register rows AND #207's chooser delta. They edit different rows; there is no real
      disagreement, only a squash artifact. `pages/health-code-article-11.js` may also conflict
      spuriously: take `main`'s side, which already has the shortened label
- [ ] **Verify the merge derived the right tree rather than a plausible one.** The check that
      actually proves it: `bun run test` green, since `tests/karl-blocks.test.js` parses the
      field map and re-checks every `docLine`, and `tests/doc-counts.test.js` reads the counts
      back out. A merge that silently dropped either side goes red there
- [ ] Push, `gh pr checks 207 --watch`, merge (squash), delete branch

### Step 3 — Verify the deploy, not the pipeline

`main` is connected to Railway, so each merge redeploys production.

- [ ] After the last merge: `git fetch origin && git log --oneline -1 origin/main` — read the
      merged SHA from the remote, not local `HEAD`, which is a different commit after a squash
- [ ] Load <https://web-production-9bb3b.up.railway.app> headlessly; assert 200, a clean
      console, and the deployed commit matching that SHA
- [ ] Spot-check the two things this stack actually changed on screen: the Article 11 Spotlight
      button reads "View Article 11", and a Karl guide panel shows its Field and Rules rows

### Decision required before Step 2

**#207 is PR 1 of the six-PR programme below, and it is 3 of 14 items done.** Merging it lands
three real corrections and leaves eleven ticked-nowhere. Two ways to go, and this is a call for
whoever picks the work up:

- **Land it as-is (recommended).** The three corrections are each independently right, CI is
  green, and the remaining eleven are additive rather than dependent. Holding a green PR open
  to accumulate scope is what produced a three-deep stack in the first place, and every day it
  waits is another day `main` moves under it.
- **Finish PR 1 first.** Defensible if the eleven remaining items are meant to read as one
  coherent documentation pass. Costs another `main`-merge cycle and keeps #207 conflict-exposed
  for longer.

If landing as-is: renumber the leftovers into a new **PR 1b** below rather than leaving them
under a heading whose PR has merged, or the checklist starts lying about what shipped.

## PR 1 — Correct stale claims in place

- [x] `build_scripts/ai/prompts.js` — the missed propagation site. It still told the model
      "where it conflicts with `karl`, the measurement wins"; `docs/karl-export-field-map.md`
      reversed that on 2026-08-23 so the Help Center governs. Commit `0fc3802` claimed to
      propagate the reversal to every site that states it and did not touch this one.
      Fixed in `877cc55`, along with the three docs that described the prompt's old behaviour.
- [x] `AGENTS.md` + `js/core/page-registry-data.js` — page `type` is a **closed enum**
      (`z.enum(PAGE_TYPES)`, eight values), not "a free-form string, only `min(1)` checked".
      The registry used the same false premise as its written rationale for the five-type
      picker; the narrowing is right, the stated reason was not. Fixed in `d73890f`.
- [x] `docs/karl-export-field-map.md` — the chooser/field-map delta, computed both ways:
      chooser 14, field map 17, nothing in the chooser unaccounted for, and `Topic` / `Form` /
      `Document Collection Search` present here but not offered there. Landed in `d73890f`;
      **this supersedes PR 4a's narrower "Topic is the one absent type" framing.**
      Side effect: all 99 `docLine` citations in `js/karl/karl-blocks.js` shifted +16.
- [ ] `docs/codebase/` — SQLite→Postgres drift (`storage.js` owns the driver seam; there is no
      `server.ts` `getDb()`).
- [ ] `docs/codebase/` — "no UI framework" vs the live React 19 + MUI islands.
- [ ] `docs/codebase/` — lint gates: CI runs seven steps, not Prettier alone.
- [ ] `docs/codebase/` — counts: 59 unit test files, 26 e2e specs, 11 stylesheets, 7 CI jobs.
- [ ] `docs/codebase/CONCERNS.md` §1 — regenerate; its top-ranked risk is itself the stalest
      thing in the file.
- [ ] `README.md` — regenerate the file tree, add the missing scripts, fix the render pointer,
      resolve the `dev`/`start` contradiction, name Railway. Leave the counts alone.
- [ ] `review/manager_review_packet.md` — rewrite against the real 29-page set.
- [ ] `review/demo-run-of-show.md`, `demo-readiness-notes.md` — counts; several need
      re-measuring rather than renumbering.
- [ ] `docs/source/hhvc-policy/README.md` — 35 files missing from the inventory; add the
      RAG-corpus line.
- [ ] `docs/agents/domain.md` — drop the `src/` line.
- [ ] Seven stale "19 pages" code comments.

## PR 2 — Archive dead records

- [ ] `.prettierignore` gets `archive/` **first**, or `format:check` goes red.
- [ ] Move the safe set (superpowers plans+prompts, chapter drafts, dated audits, draft copy).
- [ ] Move the four needing referrer updates, each in the same commit as its referrer.
- [ ] Lift the FY26-27 fee fact out of `docs/AGENT_COORDINATION.md` before archiving it.
- [ ] Update `docs-file-set.js`, `knowledge-sources.js` comments, and the canon.

## PR 3 — Porting brief and manifest

- [ ] `docs/agents/porting-brief.md` — reading list plus the gap register.
- [ ] `docs/agents/porting-manifest.json` — with `rebuild_status` per Tier 1 entry.

## PR 4 — Reconcile against the Karl content-type chooser

- [ ] Topic is not editor-creatable; say so beside the Agency constraint.
- [ ] Help Center vs admin labels — **re-derive under the reversed precedence.**
- [ ] Re-decide `U3`/`U21` against the chooser's heuristics; recommend, do not retype.

## PR 5 — `CONTEXT.md` and `docs/adr/`

- [ ] `CONTEXT.md` glossary, leading with the four term collisions.
- [ ] 12–20 ADRs plus a README naming what deliberately has none.

## PR 6 — Correct the superseded corpus doc

- [ ] Inline per-section corrections in
      `docs/source/hhvc-policy/karl-content-type-field-reference.md`.
- [ ] Local re-ingest only. **Stop and ask before writing to the Railway store.**
