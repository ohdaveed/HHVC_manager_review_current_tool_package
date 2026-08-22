# Cohesive consolidation of the HHVC manager-review tool

**Date:** 2026-08-17
**Status:** Design approved, implementation plan pending
**Supersedes:** nothing. Complements
`docs/superpowers/specs/2026-08-14-sfds-design-consistency-design.md`, whose
token work this design finishes.

## Why this exists

The tool works and is deployed, but it reads as three generations of decisions
layered on top of one another with one migration left unfinished in each. That
is not a metaphor — it is measurable, and every number below was taken from the
current tree rather than estimated:

| Axis | Generation 1 | Generation 2 | Measured state |
| --- | --- | --- | --- |
| Modules | one shared global scope, then `window.<Namespace>` | the Vite ES-module import graph | landed for the core, never finished for the 31 self-mounting IIFEs |
| CSS | hand-authored `--legacy-*` palette | `--sfds-*` primitives plus a semantic layer | 31 legacy tokens still defined and 155 uses still live |
| Docs | `AGENTS.md` as single canon | mirrors plus 11 extracted skills | three mirrored files kept in step by hand |

**The module axis is the one that costs something today.** The IIFE *pattern* is
deliberate and stays — the repo's code style mandates it for stateful
subsystems. The defect is narrower: those IIFEs reach each other through
`window.<Namespace>` rather than through imports, so `js/main.js`'s listed order
is load-bearing and hand-reviewed instead of enforced by the graph.

**A dependency census found 50 cycles in that global graph.** They are invisible
to every tool the repo runs. `.dependency-cruiser.cjs` has `no-circular` at
`severity: 'error'` and it passes — because the cruiser can only see `import`
edges, and these edges are property reads on `window`. Twenty-five of the 31
IIFEs read a sibling namespace in the mount body, which executes at module
evaluation time. That is the real coupling, and it is the reason a comment in
`js/main.js` has to do a job the module system is supposed to do.

## Audience, and what it settles

Two readers, and they pull in the same direction:

- **A portfolio reviewer**, who opens the repo and the deploy cold. Cohesion
  means legible structure, a working demo with no configuration, and no panel
  that renders empty.
- **The HHVC manager**, who will approve the 29 drafted pages. The review
  workflow is real and has to keep working through every step.

**All four optional backends stay and are made visibly work.** Review-state
sync, AI assist, AI rewrite and the RAG compliance audit are the breadth that
earns the portfolio reading, and cutting them would be the wrong trade for both
readers. The cost is a demo path that does not depend on a live paid provider —
see the backends section.

**The live deploy is at 0 of 29 reviewed.** No reviewer has recorded a decision,
so there is no `localStorage` state to migrate and the persistence-shape hazards
are as cheap as they will ever be. That window closes the day the manager
starts.

## What was already tried

A from-scratch rewrite exists and stalled. It is preserved as the tag
`ref/rebuild-scaffold` (`bed4ab9`), an orphan commit carrying 34 files under
`hhvc-rebuild/` — a TypeScript and React scaffold with `src/content/schema.ts`,
`server/`, `review/store.ts`, and **2 of the 29 pages**. It carries no Karl
transcript export, no plain-language scoring, and no RAG.

That is the argument against rewriting: the framework was never the hard part.
The content, the eight Karl content-type mappings, the measured design
decisions and the 71 test files are the work, and none of them travel with a new
scaffold. **This design consolidates in place.** Git history, every page, every
test and every recorded measurement survive.

## Approach

**Move the files, then convert the coupling, breaking cycles as you go.**

Sequencing matters and runs against instinct. Only 14 files currently carry an
`export {}` block, so the import-specifier surface is small right now and large
after the conversion. Moving files first is therefore a one-time cost;
converting first would rewrite every specifier twice. A path change does not
disturb `js/main.js`'s listed order, so the hand-enforced load order survives the
move untouched and is dismantled deliberately in the step after.

**Cycles are broken, not translated.** The rejected alternative was to convert
mechanically, downgrade `no-circular` to a warning with a 50-cycle baseline, and
reduce over time. It reaches "all imports" fastest and it weakens a gate that
currently passes, which is the wrong direction for an artifact whose point is
that it reads as considered.

## 1. File structure

`js/` is 55 flat files spanning core rendering, review workflow, Karl export,
inline editing, AI and insights. Group by feature so the architecture is
visible from the tree:

```
js/
  main.js          entry — stays at this path, the one <script> in index.html
  core/            utils, state, app, page-data, page-registry*, card-inheritance,
                   third-party-globals
  mockup/          page-render, karl-tag-meta, mockup-image-export,
                   inline-link-target
  review/          review-queue*, review-merge, review-state-store,
                   review-state-validation, review-insights*, review-ops*,
                   manager-review-export, ux-improvements*, dashboard-guidance,
                   keyboard-shortcuts, ui-controls, editor-panel
  karl/            karl-blocks, karl-transcript*, karl-guide*
  editing/         inline-content-edit*
  standards/       plain-language, reading-level
  ai/              ai-assist*, ai-rewrite*
  sync/            review-state-sync
  react/           unchanged
```

**Nine folders, each matching an existing skill.** `hhvc-review-insights` maps
onto `js/review/`, `hhvc-card-inheritance` onto `js/core/`, `hhvc-react-islands`
onto `js/react/`. The grouping is not invented for this design; it is the
boundary the documentation already draws.

**Pure moves.** No file content changes in this step beyond import specifiers
and the config paths listed in the verification section. `js/main.js` keeps its
listed order verbatim, including the comments explaining why each position is
load-bearing — those comments become wrong only in the step that makes them
unnecessary.

## 2. Module coherence

### The carve-out comes first

Eight modules are pinned by `.dependency-cruiser.cjs`'s
`base-modules-import-nothing` rule to importing nothing at all: `utils`,
`card-inheritance`, `karl-blocks`, `review-merge`, `plain-language`,
`review-insights-data`, `review-ops-data`, `page-registry-data`.

**That rule is load-bearing and not a tidiness preference.**
`build_scripts/data-checks.js` `require()`s `js/utils.js` across the CJS/ESM
boundary, and Bun 1.3.14 rejects `require()` of an *async* module. One import
that introduces a deferring `await` anywhere in that graph breaks
`bun run validate` with a TypeError naming neither file.
`tests/data-validation.test.js` guards it in a subprocess, because two
in-process versions both passed against a deliberately broken `js/utils.js`.

**These eight are not converted.** Consumers import from them; they import
nothing. Any step that appears to require adding an import to one of them is a
signal the step is wrong.

### The three classes

Every remaining `window.<Namespace>` read falls into one of three kinds, and
only the third is difficult:

- **Load-order conditions are deleted; the guards around them are not.** A
  mount-body guard is usually multi-condition and mixes three kinds, and only
  the first is deletable:

  | Condition | Kind | Fate |
  | --- | --- | --- |
  | `!window.reviewState`, `!window.ReviewQueueInternal?.rows`, `!window.InlineEdit?.render` | is the sibling module loaded | **delete** — the import guarantees it |
  | `!hasValidPageData(DATA)`, `!DATA.pages`, `!DATA.order` | is the data usable | **keep** — a reviewer with no page data loaded is a real runtime state |
  | `typeof window === 'undefined'` | environment | **keep** — the code style mandates it for test and SSR contexts |

  Deleting the load-order conditions is precisely the act that moves enforcement
  from a comment into the module graph. Deleting a whole guard because its first
  condition is deletable removes a runtime bailout and the mount throws instead
  of returning — `js/ux-improvements-export.js` and `js/review-queue.js` both
  have guards where the two kinds sit in one `if`.
- **Function reads become imports.** `const { safeUrl } = window.utils` becomes
  a named import. Safe even inside a cycle: ES modules hoist function bindings,
  so a call resolves correctly regardless of evaluation order.
- **State and value reads become accessors.** `const DATA = window.HHVC_DATA`
  and `const state = window.ReviewQueueInternal.state` capture a value at module
  evaluation time. Under a cyclic import that is a temporal-dead-zone throw
  rather than a stale read, so each becomes a call (`getData()`) or an explicit
  `init(deps)` parameter. **This is the class where cycles actually break**, and
  it is roughly five sites.

### Deliberate survivors

Some `window` publishing is the design and stays, documented as such:

- ~~`window.renderPage`~~ — **struck 2026-08-19 after measurement.** This entry
  and this section's own commitment that cycles are "broken, not translated"
  could not both hold. `window.renderPage` is the largest single contributor to
  the one cycle cluster the graph contains, and keeping it guarantees the cycles
  this section exists to remove.

  **The figures this entry originally carried — 24 intra-SCC edges, a 16-file
  cluster shrinking to 12 — are superseded and should not be quoted.** They came
  from a measurement whose script was never committed and does not reproduce;
  see the 2026-08-21 correction in
  `docs/superpowers/specs/2026-08-19-module-coherence-measurement.md`, which
  measures 33 edges in a 25-file SCC and records why the original model is not
  recoverable. Re-derive with `bun build_scripts/measure-window-graph.js` rather
  than restating any number from here. What survives unchanged is the RELATIVE
  claim above: `renderPage` dominates, under either model.

  **Resolution: a render hook registry, with TWO channels.**
  `js/mockup/page-render.js` exports `onBeforeRender(fn)` and
  `onAfterRender(fn)`; `js/review/ux-improvements.js` registers callbacks
  instead of monkey-patching a global. Two channels because the wrapper being
  replaced did work on BOTH sides of its call, and the before-side is not
  optional — it flushes in-progress sidebar edits while the outgoing page's
  values are still in the DOM. Shipping only the after-channel destroyed those
  edits; see `tests/e2e/navigation-flush.spec.js`. Callers plainly
  `import { renderPage }`. This inverts the dependency — `page-render.js` then
  depends on none of its subscribers — which is what actually breaks the
  cluster. A hook registry rather than a custom event because an event name is
  a string: a typo fails silently, and silent under-coverage is the failure
  mode this repo has hit four times already.
- `window.toggleSidebar` — an inline `onclick` in `index.html`.
- `window.ORIGINAL_DATA`, `window.HHVC_PAGES`, `window.HHVC_DATA` — the page
  data contract, read by `js/review-state-sync.js` among others.
- `window.showToast`, `window.updateSearchPreview` — called optionally by layers
  that degrade to silence rather than throw.
- The dual-export modules' `window.<Namespace>` half, which is how the browser
  reads them while Node `require()`s them directly.

### Conversion order

Per-file, and it is forced rather than chosen. Each IIFE is converted only after
every namespace it reads has been converted, so leaf consumers come first and
hubs last. A hub converted early cannot land cycle-free, and `no-circular` at
`error` will stop it:

| Tier | Namespaces read at mount | Files |
| --- | --- | --- |
| Leaves | 0–1 | `manager-review-export`, `ai-rewrite-render`, `review-state-validation`, `review-queue-undo`, `inline-content-edit-render`, `ai-assist-render`, `ai-assist-client`, `dashboard-guidance`, `reading-level`, `plain-language` |
| Middle | 3–4 | `inline-content-edit-link-tool`, `karl-transcript-panel`, `review-queue`, `page-registry-ui`, `ai-rewrite`, `review-queue-import`, `review-state-store`, `review-queue-render`, `review-queue-state`, `review-queue-rows`, `ux-improvements`, `ux-improvements-workspace`, `ai-assist`, `keyboard-shortcuts` |
| Hubs | 5–8 | `inline-content-edit`, `review-ops`, `ux-improvements-state-sync`, `page-registry`, `review-state-sync`, `ux-improvements-export` |

`js/main.js`'s listed order and its explanatory comments are removed
incrementally, each entry as the file it names stops depending on position.

### What measurement changed about this section

Measured 2026-08-19 against the post-move tree
(`docs/superpowers/specs/2026-08-19-module-coherence-measurement.md`). Three
corrections to what this section assumed:

- **The cycles are a policy problem, not a runtime one.** Edges split 78
  mount-time / 120 call-time, and **the mount-time edges form zero cycles** —
  that subgraph is a DAG, which is what `js/main.js`'s hand-maintained order
  has been encoding all along. Every cycle runs through a call-time edge, which
  ES modules resolve correctly through function hoisting. What makes cycles
  fatal here is `no-circular` at `severity: 'error'`, not the browser.
- **Most of the work is not work.** There is exactly **one** strongly connected
  component, of 16 files. The other **42 of 58 convert cleanly** with no design
  decision attached.
- **The hazard count is 36, not "roughly five".** Thirty-six value reads happen
  at import time in the 31 mount bodies, and **12 of them are the single
  pattern `const DATA = window.HHVC_DATA`**. That one substitution is the
  highest-leverage change in the section.

### The invariant

`no-circular` stays at `severity: 'error'` for the whole of this work. It passes
today and must pass after every pull request. A conversion step that cannot land
cycle-free is a step whose state reads have not been converted to accessors yet.

## 3. CSS token migration

Smaller than the raw count suggests. There are **31 distinct `--legacy-*`
tokens**, 90 definitions (60 in `css/theme.css`, 30 in `css/styles.css`), and
155 uses — and the uses are concentrated almost entirely in one file:

| Stylesheet | `var(--legacy-*)` uses |
| --- | --- |
| `css/ux-improvements.css` | 137 |
| `css/ai-assist.css` | 14 |
| `css/karl-guide.css` | 3 |
| `css/dashboard.css` | 1 |

Map each of the 31 onto its semantic `--brand-*` / `--surface-*` / `--text-*`
equivalent, rewrite the 155 uses, then delete the 90 definitions. The deletion
is the step that makes the migration real; leaving the definitions in place
leaves two token systems coexisting.

**`tests/theme-contrast.test.js` is the safety net and must stay green at every
step.** It reads `css/theme.css` in three named scopes and computes WCAG ratios
and CIE76 colour separation from the declared values rather than asserting a
comment. Every dark-mode contrast bug this repo has had came from a literal
sitting where a token belonged, which no comment can catch.

The end state is the one the CSS section of `AGENTS.md` already claims:
retheming means editing `css/theme.css` and nothing else.

## 4. Backends made visibly work

The four optional subsystems all currently fail closed, which is correct
behaviour and a poor demonstration. Each needs a path that survives a cold open.

- **Review-state sync.** Railway already has authorization configured — the
  routes answer 401 rather than 501. What is missing is a demonstrated round
  trip: push a decision from one browser, pull it in another, with the conflict
  path exercised. This one needs no fixture.
- **AI assist, AI rewrite, compliance audit.** Each gets recorded fixture
  responses served behind the same route shape when no provider key is present,
  so the panel renders real output rather than an empty box. A live key upgrades
  the same panel to real generation. **The fixture path must be visibly labelled
  as a fixture in the UI** — a portfolio artifact that presents canned output as
  a live model call is worse than an empty panel, and the labelling is what
  makes the fallback honest rather than a fake.
- **RAG compliance audit.** `bun run ingest` is billed and deliberately absent
  from CI and the build, so a corpus change is not live on a deployment until
  someone runs it. It must be run once against the deployment's store and the
  retrieval verified, or the feature is configured and still empty.

**This is the only section that adds behaviour** rather than consolidating what
exists. It is also the section most likely to be deferred if the work has to be
cut short, because nothing else depends on it.

## 5. Documentation

`AGENTS.md` stays canon at its current size. **Its 201 KB is a regression
record, not bloat** — it documents reversals with the measurements behind them:
card inheritance keyed on `component` first and corrupted Table blocks; two
reading-level implementations disagreed by 1.14 grades in the direction of
"easier than it is"; the 1700px breakpoint was re-measured and deliberately not
lowered. A rewrite discards decisions no test covers.

What changes is what a reader meets first:

- **A real `README.md` front door**: what the tool is, how to run it in 30
  seconds, an architecture diagram matching the nine folders, and an explicit
  pointer to where the canon lives. Today the front door is a 201 KB file.
- **The `CLAUDE.md` mirror shrinks to Claude-specific notes plus a pointer.**
  It is 113 KB loaded into every session, and it is the copy that rots, because
  keeping three mirrored files in step by hand is the failure mode the repo has
  already recorded in its own pointer files. The 11 `hhvc-*` skills continue to
  carry the deep-dives.
- **`docs/codebase/` moves with the restructure.** Seven files —
  `ARCHITECTURE.md`, `STRUCTURE.md`, `CONVENTIONS.md`, `STACK.md`,
  `TESTING.md`, `INTEGRATIONS.md`, `CONCERNS.md` — describe the current layout
  and are silently invalidated by §1. They are linted but nothing checks them
  against the tree, so they rot without failing. Each is either updated in the
  step that invalidates it or folded into the new `README.md`; leaving a
  stale `STRUCTURE.md` next to a restructured `js/` is the exact defect this
  design exists to remove.
- **`README_current_source.md` is resolved.** A second root-level readme whose
  relationship to `README.md` is undocumented. Either it earns a name that says
  what it is, or it merges into the front door.
- **Counts move with the work.** `tests/doc-counts.test.js` reads counts back
  out of the docs and compares them to the filesystem: the named unit-test file
  list against `package.json`'s explicit list, the e2e spec count, the page
  count, and the stylesheet count spelled as a word at least seven times. Any
  file-count change breaks it, so it is part of each step rather than a cleanup
  afterwards.

## 6. Verification

### What a file move actually breaks

The first draft of this section listed nine configuration surfaces from
inspection. A census found most of them are directory-level or comment-only and
survive a `js/`-internal move untouched. **Verified unaffected:** `index.html`
(its one `<script src="/js/main.js">` keeps that path), `vite.config.mjs`,
`.prettierignore`, `bunfig.toml`, `package.json`'s explicit 49-file `test` list
(it names `tests/*.test.js`, and no test file moves in this step), both oxlint
configs, and `knip.jsonc`.

Listing a surface that does not need editing is not a harmless excess of
caution — it sends an implementer to change a file that was already correct.
What actually breaks:

| Surface | Sites | Failure |
| --- | --- | --- |
| `js/` internal relative imports | 70 outside `main.js` (35 side-effect, 35 `from`), plus 52 side-effect imports in `main.js` | build error |
| `build_scripts/load-pages.js:19`, `build_scripts/validate.js:29-30` | 3 hardcoded `'js/page-data.js'` strings | `validate` reports every page missing |
| `.dependency-cruiser.cjs` | all 5 rules are `^js/(...)\.js$` path regexes | rules match nothing and silently stop enforcing |

**The dependency-cruiser case is the one to be careful with**, because it fails
in the direction that looks like success. A rule whose `from` regex matches no
file cannot fire, so the cruise exits 0 while enforcing nothing — the same trap
the config's own comment records for `doNotFollow` versus `exclude`, caught then
by mutation-testing the rule rather than by reading it. Each rewritten regex is
verified the same way: break the invariant on purpose, confirm the rule fires,
restore it.

### Code that references `js/` paths

Five more surfaces, and these are code rather than configuration. They were
missed by the first draft of this section, which counted only config:

| Surface | References | Breaks how |
| --- | --- | --- |
| `tests/*.test.js` | 63 across 32 files, plus 8 to `js/react/theme.js` | a moved module is an unresolved import — the suite fails loudly |
| `build_scripts/**` | 11 `require('../js/…')` calls | `validate`, `export`, `export:karl` and the AI output validator throw |
| `server.ts` | 1 import — `mergeReviewRecord` from `./js/review-merge.js` — plus 8 in comments | the import fails the boot, taking every spawned-server test with it; the comments rot silently |
| `tests/e2e/**` | 57, all prose inside comments | silent — nothing fails, the paths are simply wrong |
| `css/**` | 18 distinct paths, all in banner comments | silent — every sheet's header names the module that builds its markup |

The first three fail loudly and are caught by the gates. **The 83 comment
references are the dangerous ones** — 57 in `tests/e2e/**`, 18 in `css/**`, 8 in
`server.ts` — because nothing checks them: they are the same class of rot as a
stale `docs/codebase/STRUCTURE.md`, and a comment that names a path no longer on
disk is worse than no comment. They are updated in the same step that moves the
file they name.

**These counts were re-verified on 2026-08-18** against the same commit this
plan was written on, so they are a measurement rather than an estimate. Three
were wrong in the first draft and one surface was absent: the internal-import
count read 44 against an actual 70, `main.js` read 51 against 52, the test-file
count read 29 against 32, and `css/**` was not listed at all. Re-count rather
than trusting these if the tree has moved — `grep -rnE "^\s*import .*['\"]\.{1,2}/" js`
is the whole of it.

### Gates

Every pull request runs the full set: `format:check`, `lint:js`,
`lint:architecture`, `lint:docs`, `lint:dead-code:ci`, `validate`,
`build:netlify`, `test`, `test:e2e`.

**One thing CI does not cover.** The CSV and JSON import path has destroyed
reviews once, by replacing saved state wholesale instead of merging. Two e2e
specs cover two scenarios — `import-export.spec.js` proves merge rather than
wipe via `history.at(-1).updated_by === 'import'`, and
`merge-verification.spec.js` covers re-importing an older snapshot onto live
state that has moved on. **A green run is evidence for those two scenarios and
nothing else.** Any step touching `js/review-merge.js`,
`js/review-queue-import.js` or `js/ux-improvements-export.js` is verified by
hand — export a snapshot, re-import it, confirm existing decisions and notes
survive — before it is called done.

### Sequencing

1. **File structure** (§1) — pure moves plus the nine config surfaces
2. **Module coherence** (§2) — guards deleted, functions imported, state reads
   converted to accessors, cycles broken
3. **CSS tokens** (§3) and **backends** (§4) — independent of both above and of
   each other, so they may run in parallel or in either order
4. **Documentation** (§5) — last, describing the end state rather than a
   moving target

Steps 1 and 2 are ordered against each other and must not be swapped. Step 4
must not run early, or it documents an intermediate state and has to be redone.

## Explicit non-goals

- **No rewrite.** See "What was already tried".
- **No framework for the mockup.** `#mockPage` renders through data-driven
  string templates because it has to look like the SF.gov page under review.
  The React islands stay scoped to `#reviewWorkspace`, and
  `mockup-stays-react-free` in `.dependency-cruiser.cjs` keeps them there.
- **No collapse of the dual-export pattern.** Seventeen files carry
  `window.<Namespace>` plus `module.exports` so the browser and the Node audits
  share one implementation. It looks like duplication and is the opposite.
- **No change to the persisted state shape.** `hhvcManagerReviewState:v1` stays
  as it is. The 0-of-29 window makes a change cheap today, but nothing in this
  design needs one, and a version bump would be scope this work has not earned.
- **No new dependencies.** Every tool this design leans on — dependency-cruiser,
  markdownlint, oxlint, Knip, Playwright, Bun test — is already installed and
  already gating.
