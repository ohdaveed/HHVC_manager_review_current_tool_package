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

This work stacks on `content/article11-spotlight-button-cap`, **not** on `origin/main`. That
branch carries 22 unpushed commits including the 2026-08-23 precedence reversal
(`dec5fbd`, `0fc3802`), which several of these corrections depend on. Branching from
`origin/main` would produce corrections that contradict the tree they land in.

**Open question for the maintainer:** those 22 commits have been sitting unpushed. The repo's
own Definition of Done says never to leave commits unpushed on a local branch.

## PR 1 — Correct stale claims in place

- [ ] `build_scripts/ai/prompts.js` — the missed propagation site. It still tells the model
      "where it conflicts with `karl`, the measurement wins"; `docs/karl-export-field-map.md`
      reversed that on 2026-08-23 so the Help Center governs. Commit `0fc3802` claimed to
      propagate the reversal to every site that states it and did not touch this one.
- [ ] `AGENTS.md` + both mirrors — page `type` is a **closed enum**
      (`build_scripts/schema.js`), not "a free-form string, only `min(1)` checked".
- [ ] `js/core/page-registry-data.js` — same false premise used as the written rationale for
      the five-type picker. The narrowing is right; the stated reason is not.
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
