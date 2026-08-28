# Documentation cleanup, then a Svelte + Supabase porting brief

Six PRs, landed in order. Full reasoning and evidence live in the session plan; this file is
the checklist and the handoff. **`resume from PLAN.md` has to be enough on its own** — record
blockers and decisions here, not only in chat.

## Status — reconciled 2026-08-28

**The stack this file was written around has fully landed, and nothing is open.** `main` is at
`d1e85d3`, the working tree is clean, there are no open PRs, and no remote branch other than
`main` survives. The last several runs on `main` are green.

This file had gone stale: it was last committed on 2026-08-25 (#212) and its top half still
described #206 and #207 as open PRs, while eighteen further commits landed on `main` behind
its back. Everything below this heading has been re-derived from the repository rather than
carried forward, so a reader can trust the boxes again.

**What remains is the documentation programme itself** — PR 1b through PR 6 below. None of it
is blocked, none of it depends on anything unmerged, and the items can be taken in any order.

## Why

A documentation audit found that a large share of this repo's docs are confidently wrong, and
the wrongness clusters in the files a newcomer opens first. Separately, the Svelte + Supabase
rebuild in the sibling `hhvc-manager-review-svelte` repository is already ~41 commits in and
has dropped several contracts this repo treats as load-bearing. (Named as a repository rather
than as a checkout path: the absolute path this line used to carry was one developer's
machine, and it is wrong for everyone else reading the file.)

## Record — how the stack landed

The three-deep stack is history now, kept here because the merge hazard it carried will recur
the next time two PRs touch `docs/karl-export-field-map.md`.

| PR   | Head                                     | Landed                      |
| ---- | ---------------------------------------- | --------------------------- |
| #204 | `feat/karl-tag-field-inspection`         | merged 2026-08-24, squashed |
| #206 | `content/article11-spotlight-button-cap` | merged 2026-08-24, squashed |
| #207 | `docs/correct-stale-claims`              | merged 2026-08-25, squashed |

**The hazard, for next time.** The repo squash-merges, so when the base PR of a stack lands,
`main` gains one new commit carrying its changes while the child branch still holds the
original as an ancestor — Git then sees the same edit arriving from two unrelated commits. The
collision site here was exactly one file: #206 rewrote three register rows in
`docs/karl-export-field-map.md` (`U19`, `U24`, `O14`) while #207 added the chooser/field-map
delta and shifted all 99 `docLine` citations in `js/karl/karl-blocks.js` by +33. The
resolution that works is **keep both halves** — they edit different rows, and the apparent
conflict is a squash artifact rather than a disagreement. The check that proves the merge
derived the right tree rather than a plausible one is `bun run test`, since
`tests/karl-blocks.test.js` re-parses the field map against every `docLine` and
`tests/doc-counts.test.js` reads the counts back out.

**The open decision recorded here was taken, and it went the recommended way:** #207 landed
as-is with three of its fourteen items done, rather than being held open to accumulate scope.
Its eleven leftovers are renumbered below as **PR 1b**, exactly as this file said they must be
— leaving them under a heading whose PR has merged would make the checklist lie about what
shipped.

## Deploy verification — done at `d1e85d3` on 2026-08-28

`main` is connected to Railway, so each merge redeploys production. Every line below was
observed rather than inferred, and each names the commit it was observed against — a
verification that does not name its commit stops being evidence the next time `main` moves.

- [x] The merged SHA was read from the remote rather than local `HEAD`: `origin/main` is
      `d1e85d3`, and CI is green on it.
- [x] <https://web-production-9bb3b.up.railway.app> answers **200**, and `/api/review-state`
      answers **401** — authorization configured, which is the healthy state for that route
      (a 501 there would mean the variables were lost).
- [x] **The deploy is serving that commit, read out of Railway rather than assumed:**
      deployment `3dd51a87` reports `SUCCESS` against
      `d1e85d34e3ee9d8b880207003b8dc754afbdcb78`.
- [x] **Loaded headlessly, console clean** — 2 console entries, 0 errors and 0 warnings.
- [x] **The on-screen spot-check of what the stack changed.** On `?page=article11Guide`: the
      Spotlight button renders "View Article 11 ↗", which is #206's 25-character cap, and the
      Karl guide panels render their Field and Rules rows — including the Guidance row that
      states the Help Center's 25-character rule (E3) beside the field's measured
      `maxlength="255"` (E1), which is #204's half.

## PR 1 — Correct stale claims in place (merged as #207)

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
      **this supersedes PR 4's narrower "Topic is the one absent type" framing.**
      Side effect: all 99 `docLine` citations in `js/karl/karl-blocks.js` shifted.
- [x] `docs/codebase/` — SQLite→Postgres drift (`storage.js` owns the driver seam; there is no
      `server.ts` `getDb()`).
- [x] `docs/codebase/` — "no UI framework" vs the live React 19 + MUI islands.
- [x] `docs/codebase/` — lint gates: CI runs seven steps, not Prettier alone.
- [x] `docs/codebase/` — counts: 59 unit test files, 26 e2e specs, 11 stylesheets, 7 CI jobs.
- [x] `docs/codebase/CONCERNS.md` §1 — regenerate; its top-ranked risk is itself the stalest
      thing in the file.

## PR 1b — The eleven corrections #207 did not carry

Re-verified against the tree on 2026-08-28; every one of these is still open.

- [ ] `README.md` — regenerate the file tree, add the missing scripts, fix the render pointer,
      resolve the `dev`/`start` contradiction. Leave the counts alone. **Two notes from the
      re-check:** Railway is already named (`README.md:169`), so that half of the item is done;
      the render pointer is not — `README.md:287` still sends a reader to `js/core/app.js` for
      render behaviour, which has lived in `js/mockup/page-render.js` since the module split.
- [ ] `review/manager_review_packet.md` — rewrite against the real 29-page set. Still opens
      "HHVC Manager Review Packet — 19-Page Agency IA" and repeats the figure in its summary.
- [ ] `review/demo-run-of-show.md`, `demo-readiness-notes.md` — counts; several need
      re-measuring rather than renumbering.
- [ ] `docs/source/hhvc-policy/README.md` — 35 files missing from the inventory; add the
      RAG-corpus line.
- [ ] `docs/agents/domain.md` — drop the `src/` line. **There are two**, at lines 9 and 23.
- [ ] Seven stale "19 pages" code comments. Confirmed still seven:
      `js/review/keyboard-shortcuts.js:256`, `js/review/ux-improvements-state-sync.js:774`,
      `js/standards/plain-language.js:1162` and `:1199`, `js/standards/reading-level.js:14`,
      `js/sync/review-state-sync.js:870`, `tests/e2e/workspace-panels.spec.js:5`.

## PR 2 — Archive dead records

- [ ] `.prettierignore` gets `archive/` **first**, or `format:check` goes red. **Still absent
      from that file, and the directory now exists for unrelated reasons** — `7d66723` created
      `archive/` for the consolidation-proposal pages and #239 added the merge-train record —
      so this item is now a live risk rather than a hypothetical one.
- [ ] Move the safe set (superpowers plans+prompts, chapter drafts, dated audits, draft copy).
- [ ] Move the four needing referrer updates, each in the same commit as its referrer.
- [ ] Lift the FY26-27 fee fact out of `docs/AGENT_COORDINATION.md` before archiving it.
- [ ] Update `docs-file-set.js`, `knowledge-sources.js` comments, and the canon.

## PR 3 — Porting brief and manifest

Neither file exists yet.

- [ ] `docs/agents/porting-brief.md` — reading list plus the gap register.
- [ ] `docs/agents/porting-manifest.json` — with `rebuild_status` per Tier 1 entry.

## PR 4 — Reconcile against the Karl content-type chooser

- [x] ~~Topic is not editor-creatable; say so beside the Agency constraint.~~
      **Struck 2026-08-24 — this item was wrong and acting on it would undo
      `43affc7`.** Topic IS offered: the live "Create a page" chooser was
      measured at E1 listing all 17 types, and `docs/wagtail-content-mapping.md:32-35`
      corroborates it for Topic specifically. What is true is narrower — Topic
      has no Help Center guidance page, which is a documentation gap and not a
      permission. The Agency constraint is a genuine permission and stands,
      because the Help Center states it directly rather than it being inferred
      from an absence.
- [ ] Help Center vs admin labels — **re-derive under the reversed precedence.**
- [ ] Re-decide `U3`/`U21` against the chooser's heuristics; recommend, do not retype.

## PR 5 — `CONTEXT.md` and `docs/adr/`

Neither exists yet, so a session picking this up starts from nothing.

- [ ] `CONTEXT.md` glossary, leading with the four term collisions.
- [ ] 12–20 ADRs plus a README naming what deliberately has none.

## PR 6 — Correct the superseded corpus doc

- [ ] Inline per-section corrections in
      `docs/source/hhvc-policy/karl-content-type-field-reference.md`.
- [ ] Local re-ingest only. **Stop and ask before writing to the Railway store.**

## Not in this programme, but open

Five issues sit on the tracker and none of them belong to the PRs above. Recorded here so a
session resuming from this file does not mistake the checklist for the whole backlog.

- **#221** `chore: add .gitattributes — CRLF churn is masking real diffs` (`ready-for-agent`)
- **#220** `test: axe suite has documented blind spots that let contrast failures ship`
  (`ready-for-agent`)
- **#216** `a11y: no skip link anywhere (WCAG 2.4.1 Bypass Blocks)` (`ready-for-agent`)
- **#199** `ai-rewrite's plain-string list has not tracked the widened data-rewrite-field
surface` (`needs-triage`)
- **#196** `measure-window-graph: a multiline expression-bodied arrow is closed before its
body` (`needs-triage`)
