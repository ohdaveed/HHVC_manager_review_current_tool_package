# Module Coherence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `window.<Namespace>` handshake between the 31 self-mounting IIFEs with real imports, so `js/main.js`'s hand-maintained load order becomes something the module graph enforces rather than something a comment asks you to preserve.

**Architecture:** Invert the one dependency that creates the tangle — a post-render hook registry replaces the `window.renderPage` monkey-patch — then convert file by file, deleting presence guards as the imports that make them unreachable land. Cycles are broken, never translated: `no-circular` stays at `error` for the whole plan.

**Tech Stack:** Bun (test runner, CLI), Vite 8, dependency-cruiser, oxlint, Prettier, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-17-cohesive-consolidation-design.md` §2, as amended 2026-08-19.
**Measurement:** `docs/superpowers/specs/2026-08-19-module-coherence-measurement.md` — every count in this plan comes from there. Re-derive rather than trusting a restatement.

## Global Constraints

- **Prettier is a CI gate.** No semicolons, single quotes, 2-space indent, `printWidth: 100`, ES5 trailing commas, ASI-safe. Run `bun run format` before every commit.
- **`no-circular` stays at `severity: 'error'` for the entire plan.** It passes today and must pass after every commit. A conversion step that cannot land cycle-free is a step whose value reads have not been inverted yet.
- **The eight dual-export base modules keep `module.exports` AND gain nothing that makes them async.** `utils`, `card-inheritance`, `karl-blocks`, `review-merge`, `plain-language`, `review-insights-data`, `review-ops-data`, `page-registry-data` are pinned by `base-modules-import-nothing` to zero imports. They are consumed, never converted.
- **A module that is named-imported must declare ESM exports.** `tests/esm-named-exports.test.js` enforces this. A dual-export module gaining an ESM importer needs an `export {}` block — this is exactly the bug that broke `bun run dev`.
- **The IIFE pattern stays.** `;(function mountX(){…})()` is the repo's mandated style for stateful subsystems. What changes is how they reach each other, not how they mount.
- **`typeof window === 'undefined'` guards stay.** Environment guards are mandated by the code style; only *presence* guards (`!window.X?.y`) are deleted.
- **No behavior changes.** The rendered mockup, the review workflow and the persisted state shape are identical before and after. `hhvcManagerReviewState:v1` is untouched.
- **Gates, every PR:** `format:check`, `lint:js`, `lint:architecture`, `lint:dead-code:ci`, `lint:docs`, `validate`, `test`, `build:netlify`, `test:e2e`. Run long ones in the FOREGROUND, one at a time, never chained with `&&` — a chained run stalled an agent's watchdog in the previous plan.
- **Environment:** `mv`/`cp` are aliased to interactive mode — use `\mv -f`/`\cp -f`. Stage explicit paths; `git add -A` misbehaves where `node_modules` is a symlink. Never `git checkout` to revert a mutation test — it restores staged content and silently discards work.

## A note on the line numbers below

They were derived against `main` @ `1ba718e`. **Verify each before editing.** An earlier draft of this plan cited numbers taken from comment-stripped source — off by the length of every comment block above them, which in this repo is substantial. If a cited line does not hold what this plan says, trust the file and report the discrepancy.

## What measurement established

Read these four facts before writing any code; three of them contradict what the spec originally assumed.

1. **The cycles are a policy problem, not a runtime one.** Edges split 78 mount-time / 120 call-time, and the mount-time edges form **zero cycles**. ES modules resolve call-time cycles through function hoisting. What makes a cycle fatal here is `no-circular`, not the browser.
2. **42 of 58 files are already acyclic** and convert with no design decision attached. There is exactly one strongly connected component, of 16 files.
3. **`window.renderPage` causes 24 of the intra-SCC edges** — nearly double the next contributor. Task 1 removes it, which is why Task 1 is first.
4. **36 value reads execute at import time**, and 12 are the single pattern `const DATA = window.HHVC_DATA` — one of 24 capture sites for that object tree-wide. That substitution is the highest-leverage edit in the plan.

---

### Task 1: The post-render hook registry

**Files:**
- Modify: `js/mockup/page-render.js`, `js/review/ux-improvements.js`, `js/core/app.js`
- Test: `tests/page-render-hooks.test.js` (create)

**Interfaces:**
- Produces: `onAfterRender(fn) -> () => void` exported from `js/mockup/page-render.js`. Registers `fn` to run after every `renderPage()` completes, and returns an unsubscribe function. Hooks run in registration order, each wrapped so one throwing does not prevent the next.
- Consumes: nothing from later tasks.

**Why this is first.** `js/review/ux-improvements.js` monkey-patches `window.renderPage` — guard at **line 137**, reassignment at **142**, `__uxWrapped` stamp at **187**. That patch is why `renderPage` must live on `window`, and `window.renderPage` is responsible for 24 of the 16-file SCC's edges. Inverting it — `page-render.js` calling hooks it knows nothing about, instead of subscribers reaching in to wrap it — is what lets every later task land cycle-free.

- [ ] **Step 1: Write the failing test**

Create `tests/page-render-hooks.test.js`:

```js
/**
 * The post-render hook registry.
 *
 * **Why this replaced a monkey-patch.** js/review/ux-improvements.js used to
 * reassign window.renderPage to a wrapper that called the original and then
 * refreshed. That worked, and it forced renderPage onto the global — which
 * measurement showed was responsible for 24 of the 24-plus edges binding the
 * one 16-file dependency cycle in this codebase. A registry inverts it:
 * page-render.js calls back into code it does not import, and every subscriber
 * depends on page-render rather than the reverse.
 *
 * A registry rather than a custom event, deliberately. An event name is a
 * string, so a typo unsubscribes silently and nothing fails — and silent
 * under-coverage is the failure this repo has now hit four separate times.
 */
import { describe, expect, test } from 'bun:test'
import { onAfterRender, runAfterRenderHooks } from '../js/mockup/page-render.js'

describe('onAfterRender', () => {
  test('runs a registered hook with the page key that was rendered', () => {
    const seen = []
    const off = onAfterRender((key) => seen.push(key))
    runAfterRenderHooks('pestsTopic')
    off()
    expect(seen).toEqual(['pestsTopic'])
  })

  test('runs hooks in registration order', () => {
    const order = []
    const a = onAfterRender(() => order.push('a'))
    const b = onAfterRender(() => order.push('b'))
    runAfterRenderHooks('pestsTopic')
    a()
    b()
    expect(order).toEqual(['a', 'b'])
  })

  test('a throwing hook does not prevent the next one', () => {
    const seen = []
    const a = onAfterRender(() => {
      throw new Error('hook blew up')
    })
    const b = onAfterRender(() => seen.push('b ran'))
    runAfterRenderHooks('pestsTopic')
    a()
    b()
    expect(seen).toEqual(['b ran'])
  })

  test('the unsubscribe function stops that hook and leaves others', () => {
    const seen = []
    const off = onAfterRender(() => seen.push('gone'))
    const keep = onAfterRender(() => seen.push('kept'))
    off()
    runAfterRenderHooks('pestsTopic')
    keep()
    expect(seen).toEqual(['kept'])
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```bash
bun test tests/page-render-hooks.test.js
```

Expected: FAIL — `onAfterRender` is not exported by `js/mockup/page-render.js`.

- [ ] **Step 3: Implement the registry**

In `js/mockup/page-render.js`, near the top-level declarations:

```js
/* Post-render subscribers, in registration order.
 *
 * This exists so nothing has to monkey-patch renderPage. A subscriber that
 * needs to run after navigation registers here; page-render calls it and never
 * learns who it was. The dependency therefore points from the subscriber to
 * this module, which is what keeps the import graph acyclic. */
const afterRenderHooks = []

/**
 * Register a callback to run after every renderPage() completes.
 *
 * @param {(pageKey: string) => void} fn called with the key just rendered
 * @returns {() => void} unsubscribe; calling it twice is harmless
 */
function onAfterRender(fn) {
  if (typeof fn !== 'function') return () => {}
  afterRenderHooks.push(fn)
  return () => {
    const at = afterRenderHooks.indexOf(fn)
    if (at !== -1) afterRenderHooks.splice(at, 1)
  }
}

/**
 * Run every registered hook. A hook that throws is reported and skipped, so one
 * broken subscriber cannot stop the others or abort the render that called it.
 *
 * @param {string} pageKey the key that was just rendered
 */
function runAfterRenderHooks(pageKey) {
  for (const fn of [...afterRenderHooks]) {
    try {
      fn(pageKey)
    } catch (error) {
      console.error('after-render hook failed', error)
    }
  }
}
```

Call `runAfterRenderHooks(pageKey)` as the last statement of `renderPage()`, and add both names to the file's `export { … }` block.

- [ ] **Step 4: Run the test**

```bash
bun test tests/page-render-hooks.test.js
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Convert `ux-improvements.js` from monkey-patch to subscriber**

The wrapper spans `js/review/ux-improvements.js:137-187` — guard, reassignment, `__uxWrapped` stamp. Note that **line 251** separately *calls* `window.renderPage` to restore the saved page; that is a plain call and becomes a plain import, not part of the wrapper. Replace the wrapper with a registration:

```js
import { onAfterRender } from '../mockup/page-render.js'
```

and, where the wrapper was installed, `onAfterRender(() => refreshUx())` — keeping whatever the wrapper did after calling through. **Delete the `__uxWrapped` guard entirely**; it existed only to make double-wrapping idempotent, and a registry has no such hazard.

- [ ] **Step 6: Register the test and update the documented count**

Add `tests/page-render-hooks.test.js` to `package.json`'s explicit `test` list (51 → 52) and update the count in `AGENTS.md`, `CLAUDE.md` and `.github/copilot-instructions.md`. `tests/doc-counts.test.js` enforces this.

- [ ] **Step 7: Prove the tangle shrank**

```bash
bun run lint:architecture
```

Must PASS. Then confirm the behaviour survives — this is the render path, so a unit test is not enough:

```bash
bun run build:netlify
bun run test:e2e
```

`tests/e2e/review-workflow.spec.js` navigates between pages and asserts saved fields restore; that is the path the decorator served.

- [ ] **Step 8: Commit**

```bash
git add js/mockup/page-render.js js/review/ux-improvements.js js/core/app.js \
        tests/page-render-hooks.test.js package.json \
        AGENTS.md CLAUDE.md .github/copilot-instructions.md
git commit -m "refactor: replace the renderPage monkey-patch with a hook registry

js/review/ux-improvements.js reassigned window.renderPage to a wrapper, which
is why renderPage had to live on the global. Measurement found it responsible
for 24 of the edges binding this codebase's single 16-file dependency cycle —
nearly double the next contributor.

page-render.js now exports onAfterRender(fn) and calls its subscribers without
knowing who they are, so the dependency points from subscriber to renderer and
the cycle does not form. A registry rather than an event because an event name
is a string and a typo fails silently."
```

---

### Task 2: A ratchet that stops the tangle regrowing

**Files:**
- Create: `tests/window-coupling.test.js`
- Modify: `package.json`, the three mirror docs

**Interfaces:**
- Consumes: nothing.
- Produces: a committed baseline count that every later task lowers.

**Why now.** This plan removes cross-module `window.<Namespace>` reads over many commits. Without a ratchet, a later task can add one back while lowering the total, and nothing notices. The baseline is measured at the start and only ever decreases.

- [ ] **Step 1: Write the ratchet**

Create `tests/window-coupling.test.js`. It counts cross-module `window.<Namespace>` reads — a read of a namespace some *other* `js/` file assigns — and asserts the count is at or below a committed ceiling. Give it the repo's explanatory comment voice: state that the ceiling only ever moves down, that lowering it is the point of this plan, and that a raised ceiling in a diff is a review finding rather than a fix.

- [ ] **Step 2: Measure the true baseline and pin it**

```bash
bun test tests/window-coupling.test.js
```

Set the ceiling to whatever it currently reports. Do not round it up "for headroom" — headroom is what lets a regression hide.

- [ ] **Step 3: Prove it can fail**

Add a throwaway `window.reviewState` read to a file that has none, run the test, confirm it FAILS naming the file. Remove it with `head -n -2`, confirm PASS. Record both outputs.

- [ ] **Step 4: Register, document, commit**

Add to `package.json`'s `test` list (52 → 53), update the three mirror counts, run the full gate set, commit.

---

### Task 3: Convert the acyclic files — `sync`, `ai`, `standards`, `karl`

**Files:** every `js/sync/`, `js/ai/`, `js/standards/` and `js/karl/` module that reads a namespace another file publishes.

**Interfaces:**
- Consumes: `onAfterRender` from Task 1; the ratchet from Task 2.
- Produces: nothing later tasks import.

**These folders are outside the SCC**, so every conversion here lands cycle-free by construction. Apply the three classes from the spec:

- **Presence guards → delete.** `js/ai/ai-assist.js:12` (`!window.AiAssist?.client || !window.AiAssist?.render`) and `js/ai/ai-rewrite.js:10` are unreachable once the imports exist. **Keep** `typeof window === 'undefined'` guards and keep any condition testing *data validity* rather than *module presence* — `js/sync/review-state-sync.js`'s `!window.HHVC_DATA?.pages?.[key]` is a real runtime state and stays.
- **Function reads → imports.** Safe even inside a cycle; ES modules hoist function bindings.
- **Value reads → imports of the same binding.** `js/ai/ai-assist.js` captures `window.AiAssist.client` and `.render` at mount; both become named imports.

**A trap specific to these folders:** `js/karl/karl-blocks.js` and `js/standards/plain-language.js` are pinned base modules. Consumers import *from* them; they import nothing. If a step seems to need an import inside one, the step is wrong — stop and report BLOCKED.

- [ ] **Step 1: Convert one file, run `lint:architecture`, repeat**

Do not batch the whole folder before checking. `no-circular` is the fastest signal available and it costs seconds.

- [ ] **Step 2: After each file, confirm every named import has a real ESM export**

```bash
bun test tests/esm-named-exports.test.js
```

A dual-export module gaining its first ESM importer needs an `export {}` block. This is the exact defect that broke `bun run dev`.

- [ ] **Step 3: Lower the ratchet ceiling to the new measured count, and commit**

Run the full gate set plus `bun run test:e2e` (the AI panels are driven through the real UI, where a load failure reads as a dead panel rather than a test failure).

---

### Task 4: Convert the acyclic files — `mockup`, `editing`, `core`

**Files:** the remaining non-SCC modules in `js/mockup/`, `js/editing/`, `js/core/`.

Same three classes and same one-file-at-a-time rhythm as Task 3.

**Two constraints specific to `core`:**

- **`js/core/state.js` must keep its side-effect import of `page-registry.js`.** `.dependency-cruiser.cjs`'s `state-applies-the-page-registry` is a `required` rule guarding it, and dropping it makes `ORIGINAL_DATA` clone the wrong page set — surfacing much later as a field reset restoring a deleted page.
- **`window.HHVC_DATA` is the highest-leverage substitution in the plan.** **24 sites capture it into a local**, across 46 mentions; 12 of those captures run at import time. `js/core/page-data.js` builds the object, so the replacement is a named import of the same object — **not a copy.** `js/core/page-registry.js` mutates `order` and `pages` in place, and every importer must observe those mutations, so the export must be the same reference and nothing may reassign it.

- [ ] **Step 1: Convert `window.HHVC_DATA` first and prove mutation is still visible**

Before converting anything else in `core`, add a test asserting that a page added through `applyRegistryToData()` is visible to a module that imported the data object — that is the property in-place mutation provides and a copy would silently break.

- [ ] **Step 2–4: Convert, ratchet, gate**

As Task 3, then the full gate set plus `test:e2e` and `build:singlefile`.

---

### Task 5: Convert the remaining SCC

**Files:** the 12 files still mutually entangled after Task 1 removed `window.renderPage` — `ai/ai-assist.js`, `core/page-registry-ui.js`, `core/page-registry.js`, `editing/inline-content-edit-link-tool.js`, `editing/inline-content-edit.js`, `review/dashboard-guidance.js`, `review/keyboard-shortcuts.js`, `review/review-ops.js`, `review/ux-improvements-export.js`, `review/ux-improvements-state-sync.js`, `review/ux-improvements-workspace.js`, `sync/review-state-sync.js`.

**This is the task that needs judgment**, and the only one where converting a read is not automatically the right move. `window.ReviewUx` accounts for 15 intra-SCC edges — the largest remaining. Its three publishers (`ux-improvements-export`, `ux-improvements-state-sync`, `ux-improvements-workspace`) assemble one namespace that `ux-improvements` then consumes, while those same three read back through it.

- [ ] **Step 1: Re-measure the SCC before touching it**

Tasks 1, 3 and 4 have changed the graph. Re-run the SCC analysis from the measurement document and work from the current membership, not this list.

- [ ] **Step 2: For each remaining edge, choose one of three and record which**

- **Invert it** — the reader becomes the thing depended upon, as Task 1 did for `renderPage`.
- **Import it** — safe when it does not close a cycle.
- **Leave it on `window` and document why** — a genuine mutual dependency between peer modules. Each survivor needs a one-line comment saying which of the three it is and why, so the next reader does not have to re-derive it.

- [ ] **Step 3: `no-circular` must pass after every single file**

If it cannot, the edge needs inverting rather than importing. That is the signal, and it is the whole reason the rule stays at `error` through this plan.

---

### Task 6: Dismantle `js/main.js`'s hand-maintained order

**Files:** `js/main.js`, `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, `docs/codebase/ARCHITECTURE.md`

**Only after Tasks 1–5.** `js/main.js` lists ~60 side-effect imports in an order that comments explain as load-bearing. Once the graph enforces the order, most of those comments describe a constraint that no longer exists.

- [ ] **Step 1: Establish what is still load-bearing**

Reorder `js/main.js`'s imports into a deliberately *wrong* order — reverse the IIFE block — and run `bun run test:e2e`. Whatever still breaks is a real remaining ordering constraint and must keep its comment. Whatever survives was being ordered by the graph all along. Record the result; then restore.

- [ ] **Step 2: Delete only the comments the experiment disproved**

Leave every comment describing a constraint that still holds. A comment that is merely *now redundant* is different from one that is *wrong*, and only the second class is a defect.

- [ ] **Step 3: Update the three mirrors and `docs/codebase/ARCHITECTURE.md`**

The load-order section is currently correct and becomes wrong at this task and no earlier. Rewrite it to describe what the graph enforces and what, if anything, still depends on listed position.

- [ ] **Step 4: Full gate set, `test:e2e`, `build:singlefile`, commit**

---

## What this plan does not do

- **No CSS changes.** The 31 `--legacy-*` tokens are spec §3.
- **No backend behavior changes.** Fixtures and keys are spec §4.
- **No change to the persisted state shape.** `hhvcManagerReviewState:v1` is untouched.
- **No removal of the IIFE pattern.** It is the mandated style; only the handshake between IIFEs changes.
- **No new dependencies.**
