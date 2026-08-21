# PLAN.md — Land `impl/module-coherence`

**Goal:** get Task 1 of the module-coherence conversion off a WIP branch and
onto `main`, deployed and verified. Tasks 2–6 are explicitly **out of scope** —
they stay planned in `docs/superpowers/plans/2026-08-19-module-coherence.md`
and are a separate branch after this lands.

**Branch:** `impl/module-coherence`, currently `451e20b`, pushed, 15 behind
`origin/main`. Two commits of real work:

- `d71ff26` — the post-render hook registry, replacing the
  `window.renderPage` monkey-patch.
- `451e20b` — the before-render channel, fixing the review-data-loss
  regression `d71ff26` shipped, and collapsing the duplicate suppression
  mechanism.

**State at the time of writing:** every gate green — `test` 1949/0,
`test:e2e` 190 passed, `format:check`, `lint:js`, `lint:docs`,
`lint:architecture`, `lint:dead-code:ci`, `validate`, `build:singlefile`.

---

## The one open question this plan has to answer first

Task 1's whole justification is a number: `window.renderPage` was measured
responsible for **24 of the edges** binding the one 16-file strongly-connected
component in the window graph
(`docs/superpowers/specs/2026-08-19-module-coherence-measurement.md`). Step 7
of the task plan, "Prove the tangle shrank", has never been run.

**There is reason to expect it shrank far less than the framing implies, and
that must be established before a PR description repeats the 24 figure.**
Task 1 deleted the _wrapper_ — `ux-improvements.js` no longer reassigns
`window.renderPage`. It did **not** delete the ~15 `window.renderPage?.(key)`
call sites, and `window.renderPage` is still referenced in **17 files**, which
is the same seventeen the measurement doc counted. The assignment
`window.renderPage = renderPage` is still in `js/mockup/page-render.js` and is
still load-bearing for `js/editing/inline-content-edit.js`'s own wrapper.

Two further facts that make this a real task rather than a formality:

- **`lint:architecture` cannot answer it.** dependency-cruiser follows static
  imports only, where `window.*` is invisible; it passes on `main` too. In the
  import graph Task 1 _adds_ an edge (`ux-improvements.js` → `page-render.js`).
- **The measurement script is not in the tree.** The doc says every number was
  "derived by script", but no such script is committed under `build_scripts/`.
  It has to be rebuilt to re-measure, and rebuilding it is the honest way to
  make the claim checkable by someone else later.

## Tasks

- [ ] **1. Rebuild the window-graph measurement as a committed script.**
      Write `build_scripts/measure-window-graph.js` (CommonJS, like everything
      else under `build_scripts/`): scan tracked `js/**/*.js` for
      `window.<name>` reads and writes, build the graph the measurement doc
      describes, and report SCCs plus per-namespace edge counts. Done means it
      reproduces the doc's published baseline numbers when run against
      `d71ff26~1` — if it cannot, say so in the file rather than tuning it
      until it agrees.

- [ ] **2. Measure `main` and this branch, and write down both numbers.**
      Run the script at `origin/main` and at `451e20b`. Record SCC size and
      the `window.renderPage` edge count for each. This is the Step 7 evidence.

- [ ] **3. Decide, on the evidence, what this PR claims.** Three outcomes,
      all acceptable; pick by the numbers, not by what was hoped for: - The tangle shrank materially → tick Step 7, PR claims it, cite the
      script. - It shrank slightly or not at all → the PR claims what actually
      changed (a monkey-patch replaced by a registry, plus a data-loss fix)
      and Step 7 is amended to record the negative result. **A negative
      result is not a reason to withhold the branch** — the data-loss fix in
      `451e20b` stands on its own. - The script says the premise was wrong → stop, record it in the
      measurement doc, and raise it before Tasks 2–6 are built on it.

- [ ] **4. Sync with `origin/main`.** Currently 15 behind. **Merge, do not
      rebase** — the branch is pushed, and rebasing a pushed branch is a
      force-push needing separate approval under the repo's destructive-git
      rule. Re-run the full gate set after the merge, not before.

- [ ] **5. Open the PR.** Title and body per the repo's commit conventions:
      problem statement, dash-bulleted changes, explicit verification line.
      Must state plainly that `d71ff26` shipped a bug that `451e20b` fixes, so
      a reviewer reading the two commits in order is not misled by the first
      one's rationale. Link the Step 7 numbers from task 2.

- [ ] **6. CI green.** `gh pr checks --watch`. All six gating contexts must
      pass — `Format, validate, lint`, `Unit tests (bun test)`,
      `Playwright end-to-end tests`, `Docs-only checks`,
      `Build railway bundle`, `Build single-file export`. A skipped required
      job reads as passing, so confirm each actually ran.

- [ ] **7. Merge to `main`. The merge is the deploy.** Railway is connected to
      `main`; a branch push builds nothing. Before merging, re-fetch and
      confirm the remote head includes every local commit — a stale head has
      silently dropped commits here before.

- [ ] **8. Verify the live artifact, not the pipeline.** Load
      <https://web-production-9bb3b.up.railway.app> headlessly: assert HTTP
      200, zero console errors, and that the deployed commit matches the
      merged SHA read from a re-fetched `origin/main` (not local `HEAD`,
      which differs after a squash merge). A green build has shipped
      alongside a 502 here before.

- [ ] **9. Exercise the actual changed path on the live deploy.** The whole
      branch is the render lifecycle, and the bug that shipped in `d71ff26`
      was invisible to 188 green e2e specs. Navigate between two pages, and
      separately type into the SEO field and navigate _inside_ the 300ms
      debounce, then confirm the edit persisted under the page it was typed
      on. This is the one check that a passing CI run does not stand in for.

- [ ] **10. Clean up.** Delete the merged branch locally and on origin,
      remove the `~/hhvc-module-coherence` worktree, and delete this
      `PLAN.md` in the same commit that finishes the work — a completed plan
      left at the repo root is the stale-record defect this repo treats as a
      bug.

## Decisions and things deliberately not done

- **Tasks 2–6 are not in this plan.** Task 1 is independently shippable and
  carries a data-loss fix; holding it behind five more conversions delays that
  fix for no benefit.
- **`pr169-fixes` is untouched here.** Separate orphaned branch, separate
  decision.
- **No rebase.** See task 4.
- **The 24-edge figure is not repeated as fact anywhere** — in the PR, the
  commit messages, or the docs — until task 2 produces a number.

## Blockers

None known. The one risk is task 3's second outcome: the measurement may show
Task 1 barely moved the window graph. That changes what the PR claims. It does
not change whether the branch should land.
