# File Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `js/`'s 55 flat modules into nine feature folders so the architecture is visible from the file tree, with every reference — code, config, and comment — moved with them.

**Architecture:** Pure file moves. No module's contents change except its own import specifiers and the path strings other files use to reach it. `js/main.js` stays at its path and keeps its listed order verbatim, because the order is dismantled in the *next* plan, not this one. A new test converts stale `js/` path references from a silent class into a failing one, and it lands before the first file moves.

**Tech Stack:** Bun (test runner, CLI), Vite 8, dependency-cruiser, oxlint, Prettier, Playwright, markdownlint.

**Spec:** `docs/superpowers/specs/2026-08-17-cohesive-consolidation-design.md` — §1 (File structure) and §6 (Verification). This plan implements §1 only. §2 (module coherence), §3 (CSS tokens), §4 (backends) and §5 (documentation) are separate plans and must not be started here.

## Global Constraints

- **Prettier is a CI gate.** No semicolons, single quotes, 2-space indent, `printWidth: 100`, ES5 trailing commas. All code must be ASI-safe. Run `bun run format` before every commit.
- **`no-circular` in `.dependency-cruiser.cjs` is `severity: 'error'` and passes today.** It must pass after every single commit in this plan.
- **`base-modules-import-nothing` pins 8 modules to zero imports:** `utils`, `card-inheritance`, `karl-blocks`, `review-merge`, `plain-language`, `review-insights-data`, `review-ops-data`, `page-registry-data`. Moving them is fine. Adding an import to any of them is not, at any point, for any reason.
- **No file contents change in this plan** beyond import specifiers, path strings, and the `.dependency-cruiser.cjs` regexes. If a task seems to need a logic change, the task is wrong — stop and report.
- **`js/main.js` does not move** and its import order is not reordered. `index.html`'s single `<script type="module" src="/js/main.js">` therefore never changes.
- **`js/react/` does not move.** It is already a folder.
- **No test file moves.** `package.json`'s explicit `test` script names `tests/*.test.js`, so a `js/`-internal move never touches it. Task 1 adds exactly one entry to that list (taking it from 49 files to 50) and no other task edits `package.json` at all.
- **Verified unaffected, do not edit:** `index.html`, `vite.config.mjs`, `.prettierignore`, `bunfig.toml`, `.oxlintrc.json`, `.oxlintrc.ci.json`, `knip.jsonc`.
- **Full gate set, run before every commit:** `bun run format:check && bun run lint:js && bun run lint:architecture && bun run lint:dead-code:ci && bun run lint:docs && bun run validate && bun run test`. Run `bun run build:netlify` and `bun run test:e2e` at the task boundaries where this plan says so.

## Target layout

| Folder | Files |
| --- | --- |
| `js/` (unmoved) | `main.js` |
| `js/core/` | `app`, `card-inheritance`, `page-data`, `page-registry`, `page-registry-data`, `page-registry-ui`, `state`, `third-party-globals`, `utils` |
| `js/mockup/` | `inline-link-target`, `karl-tag-meta`, `mockup-image-export`, `page-render` |
| `js/review/` | `dashboard-guidance`, `editor-panel`, `keyboard-shortcuts`, `manager-review-export`, `review-insights`, `review-insights-charts`, `review-insights-data`, `review-merge`, `review-ops`, `review-ops-data`, `review-queue`, `review-queue-import`, `review-queue-render`, `review-queue-rows`, `review-queue-state`, `review-queue-undo`, `review-state-store`, `review-state-validation`, `ui-controls`, `ux-improvements`, `ux-improvements-export`, `ux-improvements-state-sync`, `ux-improvements-workspace` |
| `js/karl/` | `karl-blocks`, `karl-guide`, `karl-guide-registry`, `karl-transcript`, `karl-transcript-panel` |
| `js/editing/` | `inline-content-edit`, `inline-content-edit-adapter`, `inline-content-edit-data`, `inline-content-edit-link-tool`, `inline-content-edit-render` |
| `js/standards/` | `plain-language`, `reading-level` |
| `js/ai/` | `ai-assist`, `ai-assist-client`, `ai-assist-render`, `ai-rewrite`, `ai-rewrite-render` |
| `js/sync/` | `review-state-sync` |
| `js/react/` | unchanged — `checks-panel.jsx`, `mount.js`, `theme.js` |

55 files: 1 + 9 + 4 + 23 + 5 + 5 + 2 + 5 + 1, plus the 3 already in `js/react/`.

**Note against the spec:** the spec's §1 tree omits `app.js`. It goes in `js/core/` — it is the bootstrap that calls `renderPage('pestsTopic')`, and it belongs beside `state.js`. Record this in the spec when the documentation plan runs.

**Task order is by blast radius, smallest first.** `js/core/` is last because `utils.js` alone has 19 importers, so every earlier task shrinks the diff of the final one.

---

### Task 1: A gate that makes a stale `js/` path fail

**Files:**
- Create: `tests/module-paths.test.js`
- Modify: `package.json` (add the new test to the explicit `test` list)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing importable. Its output is a gate that every later task depends on.

**Why this is first.** The spec's §6 census found 57 references to `js/*.js` paths sitting in e2e comments and more in the instruction docs. Nothing checks them, so when a file moves they become quietly wrong — the same rot class as a stale `docs/codebase/STRUCTURE.md`. This test converts that silent class into a loud one *before* anything moves, so every later task is protected by it.

- [ ] **Step 1: Write the test**

Create `tests/module-paths.test.js`:

```js
/**
 * Every `js/<something>.js` path this repo mentions must exist on disk.
 *
 * **Why this exists.** Path references live in three places and only one of
 * them fails when it goes wrong. An `import` breaks the build. A
 * `require('../js/utils.js')` throws. But a path named in a COMMENT or in a
 * markdown document is read by people and checked by nothing, so a moved file
 * leaves behind a sentence that confidently points at nowhere. That is worse
 * than no comment: a reader trusts it and loses the time.
 *
 * The check is deliberately dumb — it finds path-shaped strings and asks
 * whether the file is there. It cannot tell a real reference from an example,
 * which is why EXEMPT below exists and why each entry states its reason.
 */
import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'

const root = path.resolve(import.meta.dir, '..')

/**
 * Trees this repo holds but whose path references are not ours to keep current,
 * matched as path prefixes. This is the same set `build_scripts/docs-file-set.js`
 * and `.prettierignore` already exclude, and for the same reason.
 *
 * **`docs/superpowers/` is the one that matters here.** Those are RECORDS of
 * past work — a 2026-07-07 plan naming `js/interactive-sitemap-render.js` is
 * correct, because that file existed on that date. Scanning them found 148
 * additional "broken" references, every one of them a historical document
 * accurately describing a tree that has since changed. Rewriting a record to
 * match the present is how a record stops being one.
 */
const SKIP = /^(\.agents|tools\/oxlint|archive|forms|node_modules|docs\/superpowers|docs\/source|review|\.playwright-mcp)\//

/**
 * Path-shaped strings that are deliberately not real files.
 *
 * Measured, not guessed: with SKIP applied, these three are the ONLY broken
 * references in the tree today, across 1,362 matches in 307 files.
 */
const EXEMPT = new Set([
  // Described in the past tense in AGENTS.md, CLAUDE.md, docs/codebase/
  // CONCERNS.md, js/app.js, js/page-render.js and one e2e spec, as a module
  // that was REMOVED. Each sentence is correct precisely because the file is
  // gone, so making the path resolve would make the prose wrong.
  'js/interactive-sitemap.js',
  // Generic two-file examples in a skill's prose, never real paths.
  'js/a.js',
  'js/b.js',
])

/** Every tracked file that could mention a js/ path. */
function trackedFiles() {
  const out = spawnSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
  if (out.status !== 0) throw new Error('git ls-files failed: ' + out.stderr)
  return out.stdout
    .split('\n')
    .filter(Boolean)
    .filter((f) => /\.(js|jsx|ts|md|json|html)$/.test(f))
    .filter((f) => !SKIP.test(f))
}

describe('js/ path references', () => {
  test('every js/ path mentioned in a tracked file exists on disk', () => {
    const broken = []
    for (const file of trackedFiles()) {
      const abs = path.join(root, file)
      if (!existsSync(abs)) continue
      const source = fs.readFileSync(abs, 'utf8')
      for (const match of source.matchAll(/\bjs\/[a-z0-9/-]+\.jsx?\b/g)) {
        const ref = match[0]
        if (EXEMPT.has(ref)) continue
        if (!existsSync(path.join(root, ref))) broken.push(`${file}: ${ref}`)
      }
    }
    expect(broken).toEqual([])
  })

  test('finds at least one reference, so a broken scan cannot pass silently', () => {
    let found = 0
    for (const file of trackedFiles()) {
      const abs = path.join(root, file)
      if (!existsSync(abs)) continue
      found += [...fs.readFileSync(abs, 'utf8').matchAll(/\bjs\/[a-z0-9/-]+\.jsx?\b/g)].length
    }
    // 1,362 matched at the time this was written. The floor is deliberately
    // far below that — it is a guard against a regex that stopped matching,
    // not an assertion about the count, which legitimately moves.
    expect(found).toBeGreaterThan(1000)
  })
})
```

- [ ] **Step 2: Run it and read the baseline**

```bash
bun test tests/module-paths.test.js
```

Expected: **PASS**. This was measured against the current tree while writing the plan — 1,362 references across 307 files, and exactly three distinct broken paths, all three already in `EXEMPT`.

If it fails, a path reference has gone stale since the plan was written. Read the failure before touching anything: if the named path is a deleted module described in the past tense, add it to `EXEMPT` with a comment saying why. If it is a typo, fix the typo in the referring file. **Do not widen `SKIP` and do not weaken the regex** — both make the failure disappear by making the check smaller, which is the defect this test exists to prevent.

- [ ] **Step 3: Prove the test can fail (mutation test)**

```bash
printf '\n// js/definitely-not-a-real-module.js\n' >> tests/module-paths.test.js
bun test tests/module-paths.test.js
```

Expected: FAIL, naming `tests/module-paths.test.js: js/definitely-not-a-real-module.js`.

This is not ceremony. `AGENTS.md` records that the first version of the `doNotFollow` rule in `.dependency-cruiser.cjs` returned exit 0 with `import 'react'` sitting at the top of `js/page-render.js` — a check that cannot fail is indistinguishable from a check that passes.

The file is new and untracked, so `git checkout` cannot restore it. Remove the
two appended lines instead:

```bash
head -n -2 tests/module-paths.test.js > /tmp/mp.js && mv /tmp/mp.js tests/module-paths.test.js
tail -3 tests/module-paths.test.js
```

Expected: the file ends with the closing `})` of the describe block. Re-run
`bun test tests/module-paths.test.js` and confirm PASS.

- [ ] **Step 4: Register the test in the CI list**

`package.json`'s `test` script names each file explicitly — a test not named there runs only by hand and covers nothing in CI. Add `tests/module-paths.test.js` to the end of the `bun test ...` list.

- [ ] **Step 5: Update the documented test count**

`tests/doc-counts.test.js` reads the unit-test count back out of `AGENTS.md`, `CLAUDE.md` and `.github/copilot-instructions.md` and compares it to the filesystem. The count goes from 49 to 50. Find each place the number is spelled and update it, and add `module-paths` to the test inventory sentence in all three mirrors.

```bash
bun test tests/doc-counts.test.js
```

Expected: PASS.

- [ ] **Step 6: Run the full gate set**

```bash
bun run format && bun run format:check && bun run lint:js && bun run lint:architecture \
  && bun run lint:dead-code:ci && bun run lint:docs && bun run validate && bun run test
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add tests/module-paths.test.js package.json AGENTS.md CLAUDE.md .github/copilot-instructions.md
git commit -m "test: fail on a js/ path reference that names no file

A path in an import breaks the build and a path in a comment breaks nothing,
so a moved module leaves behind sentences that confidently point at nowhere.
57 such references sit in e2e comments alone. This makes them checkable before
the file structure work starts moving things.

Mutation-proven: a deliberately fake path fails the test."
```

---

### Task 2: `js/standards/`

**Files:**
- Move: `js/standards/plain-language.js`, `js/standards/reading-level.js` → `js/standards/`
- Create: `/tmp/hhvc-retarget.mjs` (throwaway migration helper, never committed)
- Modify: `.dependency-cruiser.cjs`, plus every file referencing the two moved modules

**Interfaces:**
- Consumes: the gate from Task 1.
- Produces: `retarget.mjs`, reused verbatim by Tasks 3–10. Its contract: `bun retarget.mjs [--apply] js/old.js=js/new/old.js [...]` rewrites every import specifier, `require()` path, and plain-text path mention across tracked files, and prints a table of every change. Without `--apply` it only prints.

- [ ] **Step 1: Write the migration helper**

Write this to `/tmp/hhvc-retarget.mjs`. A fixed path rather than a session scratchpad because this plan spans many sessions and every later task invokes the same file. It is a one-time tool and **must not be committed** — the repo's scope discipline forbids leaving migration scaffolding behind.

```js
// One-time helper for the file-structure migration. Not committed.
//
// Rewrites three kinds of reference when a module moves:
//   1. relative import/require specifiers, recomputed from the REFERRING
//      file's post-move directory to the TARGET's post-move path
//   2. bare repo-relative path strings ('js/page-data.js' in build_scripts)
//   3. plain-text mentions in comments and markdown
//
// The referring file may itself be moving, which is why both sides resolve
// through the same move map rather than against the working tree.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const apply = process.argv.includes('--apply')
const pairs = process.argv.slice(2).filter((a) => a.includes('='))
if (pairs.length === 0) {
  console.error('usage: bun retarget.mjs [--apply] js/old.js=js/new/old.js ...')
  process.exit(1)
}

/** old repo-relative path -> new repo-relative path */
const moves = new Map(pairs.map((p) => p.split('=')))

/** Where a file lives after this migration step. */
const after = (rel) => moves.get(rel) ?? rel

const tracked = spawnSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
  .stdout.split('\n')
  .filter(Boolean)
  .filter((f) => /\.(js|jsx|ts|md|json|html)$/.test(f))
  .filter((f) => !/^(\.agents|tools\/oxlint|archive|forms|node_modules)\//.test(f))

const changes = []

for (const file of tracked) {
  const abs = path.join(root, file)
  if (!fs.existsSync(abs)) continue
  const original = fs.readFileSync(abs, 'utf8')
  let next = original
  const fromDirAfter = path.dirname(after(file))

  // (1) relative specifiers in import/require
  next = next.replace(
    /(from\s+|import\s+|require\()(['"])(\.\.?\/[^'"]+?)(['"])/g,
    (whole, lead, q1, spec, q2) => {
      const targetOld = path.normalize(path.join(path.dirname(file), spec))
      if (!moves.has(targetOld)) return whole
      let rebuilt = path.relative(fromDirAfter, after(targetOld))
      if (!rebuilt.startsWith('.')) rebuilt = './' + rebuilt
      return `${lead}${q1}${rebuilt}${q2}`
    }
  )

  // (2) + (3) repo-relative path strings, in code and in prose alike.
  //
  // LONGEST FIRST, and this is not cosmetic. 'js/page-registry.js' is a prefix
  // of 'js/page-registry-data.js', so processing the short one first rewrites
  // the long one through the wrong rule and produces
  // 'js/core/page-registry.js-data.js'. Same collision for review-queue vs
  // review-queue-import, review-insights vs review-insights-data, review-ops
  // vs review-ops-data, and every inline-content-edit sibling. Sorting by
  // descending length makes the specific match always win.
  for (const [oldRel, newRel] of [...moves].sort((a, b) => b[0].length - a[0].length)) {
    next = next.split(oldRel).join(newRel)
  }

  if (next !== original) {
    changes.push(file)
    if (apply) fs.writeFileSync(abs, next)
  }
}

console.log(`${apply ? 'REWROTE' : 'WOULD REWRITE'} ${changes.length} files:`)
for (const c of changes) console.log('  ' + c)
```

- [ ] **Step 2: Move the files with git, preserving history**

```bash
mkdir -p js/standards
git mv js/standards/plain-language.js js/standards/plain-language.js
git mv js/standards/reading-level.js js/standards/reading-level.js
```

- [ ] **Step 3: Dry-run the retarget and read the table**

```bash
bun /tmp/hhvc-retarget.mjs \
  js/standards/plain-language.js=js/standards/plain-language.js \
  js/standards/reading-level.js=js/standards/reading-level.js
```

Expected to list, among others: `js/main.js` (two side-effect imports), `js/ux-improvements-state-sync.js`, `build_scripts/ai/validate-output.js`, `tests/plain-language.test.js`, `tests/reading-level.test.js`, `AGENTS.md`, `CLAUDE.md`.

Read the list before applying. If a file you did not expect appears, understand why before continuing.

- [ ] **Step 4: Apply it**

```bash
bun /tmp/hhvc-retarget.mjs --apply \
  js/standards/plain-language.js=js/standards/plain-language.js \
  js/standards/reading-level.js=js/standards/reading-level.js
```

- [ ] **Step 5: Update the dependency-cruiser regex**

`.dependency-cruiser.cjs`'s `base-modules-import-nothing` rule lists `plain-language` in a `^js/(...)\.js$` alternation. `plain-language.js` is now at `js/standards/`, so the regex no longer matches it and **the rule silently stops enforcing** — it will not fail, it will simply check one fewer file.

Change the rule's `from.path` so the alternation reaches the new location. The current value is:

```
'^js/(utils|card-inheritance|karl-blocks|review-merge|plain-language|' +
  'review-insights-data|review-ops-data|page-registry-data)\\.js$'
```

Make it match `js/standards/plain-language.js` as well as the still-unmoved seven.

- [ ] **Step 6: Mutation-test the rewritten rule**

A regex that matches nothing exits 0. Prove the rule still fires:

```bash
printf "\nimport './reading-level.js'\n" >> js/standards/plain-language.js
bun run lint:architecture
```

Expected: FAIL, naming `base-modules-import-nothing` and `js/standards/plain-language.js`.

```bash
git checkout js/standards/plain-language.js
bun run lint:architecture
```

Expected: PASS.

Note: `git checkout` here restores the post-`git mv` staged content, not the pre-move file.

- [ ] **Step 7: Run the full gate set**

```bash
bun run format && bun run format:check && bun run lint:js && bun run lint:architecture \
  && bun run lint:dead-code:ci && bun run lint:docs && bun run validate && bun run test
```

Expected: all pass, including `tests/module-paths.test.js` from Task 1 — that test is the proof the prose references moved too.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: move the content-standards modules to js/standards/

plain-language.js and reading-level.js score page copy against written
standards. Grouping them names what they are.

The base-modules-import-nothing regex in .dependency-cruiser.cjs is updated to
reach the new path and mutation-tested — a path regex that matches nothing
exits 0 while enforcing nothing."
```

---

### Task 3: `js/sync/`

**Files:**
- Move: `js/review-state-sync.js` → `js/sync/`
- Modify: every referring file (via `retarget.mjs`)

**Interfaces:**
- Consumes: `retarget.mjs` from Task 2.
- Produces: nothing new.

- [ ] **Step 1: Move**

```bash
mkdir -p js/sync
git mv js/review-state-sync.js js/sync/review-state-sync.js
```

- [ ] **Step 2: Dry-run**

```bash
bun /tmp/hhvc-retarget.mjs js/review-state-sync.js=js/sync/review-state-sync.js
```

Expect `js/main.js`, `tests/review-state-sync.test.js`, `AGENTS.md`, `CLAUDE.md`, several `.claude/skills/hhvc-review-sync-backend/SKILL.md` mentions, and `server.ts` comments.

- [ ] **Step 3: Apply**

```bash
bun /tmp/hhvc-retarget.mjs --apply js/review-state-sync.js=js/sync/review-state-sync.js
```

- [ ] **Step 4: Run the full gate set**

```bash
bun run format && bun run format:check && bun run lint:js && bun run lint:architecture \
  && bun run lint:dead-code:ci && bun run lint:docs && bun run validate && bun run test
```

Expected: all pass. `tests/review-state-sync.test.js` stubs `window`/`document`/`localStorage`, so a resolution failure surfaces there first.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: move the sync client to js/sync/

js/review-state-sync.js is the browser half of the optional review-state sync
API and the only file in that layer. A folder of one names the seam."
```

---

### Task 4: `js/ai/`

**Files:**
- Move: `js/ai-assist.js`, `js/ai-assist-client.js`, `js/ai-assist-render.js`, `js/ai-rewrite.js`, `js/ai-rewrite-render.js` → `js/ai/`

**Interfaces:**
- Consumes: `retarget.mjs`.
- Produces: nothing new.

- [ ] **Step 1: Move**

```bash
mkdir -p js/ai
for f in ai-assist ai-assist-client ai-assist-render ai-rewrite ai-rewrite-render; do
  git mv "js/$f.js" "js/ai/$f.js"
done
```

- [ ] **Step 2: Dry-run, then apply**

```bash
ARGS="js/ai-assist.js=js/ai/ai-assist.js js/ai-assist-client.js=js/ai/ai-assist-client.js \
js/ai-assist-render.js=js/ai/ai-assist-render.js js/ai-rewrite.js=js/ai/ai-rewrite.js \
js/ai-rewrite-render.js=js/ai/ai-rewrite-render.js"
bun /tmp/hhvc-retarget.mjs $ARGS
bun /tmp/hhvc-retarget.mjs --apply $ARGS
```

- [ ] **Step 3: Run the full gate set plus e2e**

```bash
bun run format && bun run format:check && bun run lint:js && bun run lint:architecture \
  && bun run lint:dead-code:ci && bun run lint:docs && bun run validate && bun run test
bun run build:netlify && bun run test:e2e
```

E2E runs here because `tests/e2e/ai-assist.spec.js` and `tests/e2e/ai-rewrite.spec.js` drive these modules through the real UI, and a module that fails to load produces a passing-looking unit suite and a dead panel.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: move the AI modules to js/ai/

The five AI-assist and AI-rewrite modules are one optional subsystem gated on
server configuration. Grouping them makes the optionality visible in the tree.

Verified with test:e2e as well as the unit gates — these modules are driven
through the real UI, where a load failure reads as a dead panel rather than a
test failure."
```

---

### Task 5: `js/editing/`

**Files:**
- Move: `js/inline-content-edit.js`, `js/inline-content-edit-adapter.js`, `js/inline-content-edit-data.js`, `js/inline-content-edit-link-tool.js`, `js/inline-content-edit-render.js` → `js/editing/`

**Interfaces:**
- Consumes: `retarget.mjs`.
- Produces: nothing new.

**Read first:** the `hhvc-inline-content-editing` skill. This subsystem has a documented trap — a path stamped `data-rewrite-field` by a renderer but missing from `EDITABLE_FIELD_SHAPES` silently loses the reviewer's edit. Nothing in this task touches either list, and if a step appears to require it, the step is wrong.

- [ ] **Step 1: Move**

```bash
mkdir -p js/editing
for f in inline-content-edit inline-content-edit-adapter inline-content-edit-data \
         inline-content-edit-link-tool inline-content-edit-render; do
  git mv "js/$f.js" "js/editing/$f.js"
done
```

- [ ] **Step 2: Dry-run, then apply**

```bash
ARGS="js/inline-content-edit.js=js/editing/inline-content-edit.js \
js/inline-content-edit-adapter.js=js/editing/inline-content-edit-adapter.js \
js/inline-content-edit-data.js=js/editing/inline-content-edit-data.js \
js/inline-content-edit-link-tool.js=js/editing/inline-content-edit-link-tool.js \
js/inline-content-edit-render.js=js/editing/inline-content-edit-render.js"
bun /tmp/hhvc-retarget.mjs $ARGS
bun /tmp/hhvc-retarget.mjs --apply $ARGS
```

Expect a large table: five test files reference these, plus 13 comment mentions in `tests/e2e/inline-content-edit.spec.js` alone.

- [ ] **Step 3: Run the full gate set plus e2e**

```bash
bun run format && bun run format:check && bun run lint:js && bun run lint:architecture \
  && bun run lint:dead-code:ci && bun run lint:docs && bun run validate && bun run test
bun run build:netlify && bun run test:e2e
```

E2E is mandatory here: `tests/e2e/inline-content-edit.spec.js` drives real DOM events against real focus and selection behavior, which no unit test replaces.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: move the inline content editing modules to js/editing/

Five modules implementing click-to-edit on the rendered mockup, including the
pure diff/reapply logic and the markdown/HTML serialization adapter.

Verified with test:e2e — this subsystem's specs drive real DOM events against
real focus and selection behavior."
```

---

### Task 6: `js/karl/`

**Files:**
- Move: `js/karl-blocks.js`, `js/karl-guide.js`, `js/karl-guide-registry.js`, `js/karl-transcript.js`, `js/karl-transcript-panel.js` → `js/karl/`
- Modify: `.dependency-cruiser.cjs` (`karl-blocks` is a pinned base module)

**Interfaces:**
- Consumes: `retarget.mjs`.
- Produces: nothing new.

**Note:** `js/karl-tag-meta.js` does **not** move here. It goes to `js/mockup/` in Task 7, because it is the renderer's tag markup rather than part of the Karl export. Do not "tidy" it into this folder.

- [ ] **Step 1: Move**

```bash
mkdir -p js/karl
for f in karl-blocks karl-guide karl-guide-registry karl-transcript karl-transcript-panel; do
  git mv "js/$f.js" "js/karl/$f.js"
done
```

- [ ] **Step 2: Dry-run, then apply**

```bash
ARGS="js/karl-blocks.js=js/karl/karl-blocks.js js/karl-guide.js=js/karl/karl-guide.js \
js/karl-guide-registry.js=js/karl/karl-guide-registry.js \
js/karl-transcript.js=js/karl/karl-transcript.js \
js/karl-transcript-panel.js=js/karl/karl-transcript-panel.js"
bun /tmp/hhvc-retarget.mjs $ARGS
bun /tmp/hhvc-retarget.mjs --apply $ARGS
```

Expect `build_scripts/validate.js`, `build_scripts/karl-vocabulary.js`, `build_scripts/export-karl-transcript.js`, `build_scripts/data-checks.js` and five test files.

- [ ] **Step 3: Update and mutation-test the dependency-cruiser regex**

`karl-blocks` is in the `base-modules-import-nothing` alternation. Extend the regex to reach `js/karl/karl-blocks.js`, then prove it fires:

```bash
printf "\nimport './karl-guide-registry.js'\n" >> js/karl/karl-blocks.js
bun run lint:architecture
```

Expected: FAIL naming `base-modules-import-nothing`.

```bash
git checkout js/karl/karl-blocks.js && bun run lint:architecture
```

Expected: PASS.

- [ ] **Step 4: Verify the Karl export CLI still runs**

`findUnmappedSections` is a validation gate rather than a report, and the transcript CLI is not covered by the unit suite end to end:

```bash
bun run export:karl
ls review/karl-transcripts/ | head
```

Expected: one markdown file per page, 29 of them.

- [ ] **Step 5: Run the full gate set**

```bash
bun run format && bun run format:check && bun run lint:js && bun run lint:architecture \
  && bun run lint:dead-code:ci && bun run lint:docs && bun run validate && bun run test
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: move the Karl export modules to js/karl/

The transcribed panel inventory, the pure transcript builder, the guide
registry and the panel. js/karl-tag-meta.js deliberately stays out — it is the
renderer's tag markup, and it moves to js/mockup/ with page-render.

karl-blocks is a pinned base module, so its dependency-cruiser regex is updated
and mutation-tested. Verified bun run export:karl still writes 29 transcripts."
```

---

### Task 7: `js/mockup/`

**Files:**
- Move: `js/page-render.js`, `js/karl-tag-meta.js`, `js/mockup-image-export.js`, `js/inline-link-target.js` → `js/mockup/`
- Modify: `.dependency-cruiser.cjs` (`mockup-stays-react-free` names `page-render`)

**Interfaces:**
- Consumes: `retarget.mjs`.
- Produces: nothing new.

- [ ] **Step 1: Move**

```bash
mkdir -p js/mockup
for f in page-render karl-tag-meta mockup-image-export inline-link-target; do
  git mv "js/$f.js" "js/mockup/$f.js"
done
```

- [ ] **Step 2: Dry-run, then apply**

```bash
ARGS="js/page-render.js=js/mockup/page-render.js js/karl-tag-meta.js=js/mockup/karl-tag-meta.js \
js/mockup-image-export.js=js/mockup/mockup-image-export.js \
js/inline-link-target.js=js/mockup/inline-link-target.js"
bun /tmp/hhvc-retarget.mjs $ARGS
bun /tmp/hhvc-retarget.mjs --apply $ARGS
```

- [ ] **Step 3: Update `mockup-stays-react-free` and mutation-test it**

The rule's `from.path` is:

```
'^js/(page-render|state|utils|ui-controls|editor-panel|card-inheritance|page-data)\\.js$'
```

`page-render` is now at `js/mockup/`; `ui-controls` and `editor-panel` move to `js/review/` in Task 9; `state`, `utils`, `card-inheritance` and `page-data` move to `js/core/` in Task 10. Update the regex for `page-render` now and again in each later task, or write it once to cover every eventual location — but whichever you choose, **mutation-test it every time**:

```bash
printf "\nimport 'react'\n" >> js/mockup/page-render.js
bun run lint:architecture
```

Expected: FAIL naming `mockup-stays-react-free`.

```bash
git checkout js/mockup/page-render.js && bun run lint:architecture
```

Expected: PASS.

`AGENTS.md` records that the first version of this rule returned exit 0 with exactly that import in place, because `exclude` had dropped `react` from the graph. The mutation test is the only thing that catches it.

- [ ] **Step 4: Run the full gate set plus e2e**

```bash
bun run format && bun run format:check && bun run lint:js && bun run lint:architecture \
  && bun run lint:dead-code:ci && bun run lint:docs && bun run validate && bun run test
bun run build:netlify && bun run test:e2e
```

E2E here because `tests/e2e/mockup-tokens.spec.js` asserts `document.fonts.check()` against the rendered mockup and `tests/e2e/mockup-image-export.spec.js` drives the PNG export — both exercise `page-render.js` through the browser.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: move the mockup renderer to js/mockup/

page-render.js turns page objects into #mockPage's HTML; karl-tag-meta.js is
its tag markup; mockup-image-export.js exports what it rendered;
inline-link-target.js is the one definition of what an inline link may point at.

mockup-stays-react-free is the rule protecting this boundary, so its regex is
updated and mutation-tested with a real import 'react'."
```

---

### Task 8: `js/review/`, part 1 — queue, insights and ops

**Files:**
- Move into `js/review/`: `review-queue.js`, `review-queue-import.js`, `review-queue-render.js`, `review-queue-rows.js`, `review-queue-state.js`, `review-queue-undo.js`, `review-insights.js`, `review-insights-charts.js`, `review-insights-data.js`, `review-ops.js`, `review-ops-data.js`
- Modify: `.dependency-cruiser.cjs` (`review-insights-data` and `review-ops-data` are pinned base modules)

**Interfaces:**
- Consumes: `retarget.mjs`.
- Produces: nothing new.

**Split from Task 9 on purpose.** `js/review/` takes 23 files, which is too large a diff for one reviewable commit. This half is the queue and the two read-only panels; the next is the state-sync and export layer, where the import/merge hazard lives.

- [ ] **Step 1: Move**

```bash
mkdir -p js/review
for f in review-queue review-queue-import review-queue-render review-queue-rows \
         review-queue-state review-queue-undo review-insights review-insights-charts \
         review-insights-data review-ops review-ops-data; do
  git mv "js/$f.js" "js/review/$f.js"
done
```

- [ ] **Step 2: Dry-run, then apply**

```bash
ARGS=""
for f in review-queue review-queue-import review-queue-render review-queue-rows \
         review-queue-state review-queue-undo review-insights review-insights-charts \
         review-insights-data review-ops review-ops-data; do
  ARGS="$ARGS js/$f.js=js/review/$f.js"
done
bun /tmp/hhvc-retarget.mjs $ARGS
bun /tmp/hhvc-retarget.mjs --apply $ARGS
```

- [ ] **Step 3: Update and mutation-test the base-module regex**

Both `review-insights-data` and `review-ops-data` are pinned to zero imports. Extend the alternation to reach `js/review/`, then:

```bash
printf "\nimport './review-queue-state.js'\n" >> js/review/review-insights-data.js
bun run lint:architecture
```

Expected: FAIL. Restore with `git checkout js/review/review-insights-data.js` and confirm PASS.

- [ ] **Step 4: Confirm the ECharts chunk is still separate**

`js/review/review-insights-charts.js` is the only module importing ECharts, and the import must stay dynamic — ECharts is ~530 KB raw, larger than the rest of the bundle, so a static import would fold it into the main chunk.

```bash
bun run build:app
ls -la dist/assets/ | sort -k5 -n | tail -5
```

Expected: a separate chunk of roughly 500 KB that is not the main entry. If the main entry has grown by that much, the dynamic import was converted to a static one — revert and investigate.

- [ ] **Step 5: Run the full gate set plus e2e**

```bash
bun run format && bun run format:check && bun run lint:js && bun run lint:architecture \
  && bun run lint:dead-code:ci && bun run lint:docs && bun run validate && bun run test
bun run build:netlify && bun run test:e2e
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: move the queue and panel modules to js/review/

The six review-queue modules plus the Overview insight cards and the
stored-review-data panel. The state-sync and export layer follows separately —
23 files is too large a diff to review as one commit.

Verified the ECharts chunk is still emitted separately: its import must stay
dynamic or it folds ~530 KB into the main entry."
```

---

### Task 9: `js/review/`, part 2 — the state, export and workspace layer

**Files:**
- Move into `js/review/`: `ux-improvements.js`, `ux-improvements-export.js`, `ux-improvements-state-sync.js`, `ux-improvements-workspace.js`, `review-merge.js`, `review-state-store.js`, `review-state-validation.js`, `manager-review-export.js`, `ui-controls.js`, `editor-panel.js`, `dashboard-guidance.js`, `keyboard-shortcuts.js`
- Modify: `.dependency-cruiser.cjs` (`review-merge` is a pinned base module; `ui-controls` and `editor-panel` are named in `mockup-stays-react-free`), `server.ts`

**Interfaces:**
- Consumes: `retarget.mjs`.
- Produces: nothing new.

**This is the highest-consequence task in the plan.** `js/review-merge.js` is the only place a `history[]` entry is ever constructed, it is imported directly by `server.ts` as well as by the browser, and the CSV/JSON import path it serves has destroyed reviews once by replacing saved state wholesale instead of merging. A green CI run is evidence for two scenarios on this path and nothing else.

- [ ] **Step 1: Move**

```bash
for f in ux-improvements ux-improvements-export ux-improvements-state-sync \
         ux-improvements-workspace review-merge review-state-store review-state-validation \
         manager-review-export ui-controls editor-panel dashboard-guidance keyboard-shortcuts; do
  git mv "js/$f.js" "js/review/$f.js"
done
```

- [ ] **Step 2: Dry-run, then apply**

```bash
ARGS=""
for f in ux-improvements ux-improvements-export ux-improvements-state-sync \
         ux-improvements-workspace review-merge review-state-store review-state-validation \
         manager-review-export ui-controls editor-panel dashboard-guidance keyboard-shortcuts; do
  ARGS="$ARGS js/$f.js=js/review/$f.js"
done
bun /tmp/hhvc-retarget.mjs $ARGS
bun /tmp/hhvc-retarget.mjs --apply $ARGS
```

- [ ] **Step 3: Confirm `server.ts`'s import was rewritten**

```bash
grep -n "review-merge" server.ts
```

Expected: `import { mergeReviewRecord } from "./js/review/review-merge.js"`.

`server.ts` is excluded from Prettier, so its formatting is unchanged — but it must still parse. If this import is wrong the server fails to boot, which takes `tests/review-api-server.test.js` and `tests/ai-assist-server.test.js` with it, and both report "did not start in time" rather than naming the import.

- [ ] **Step 4: Update and mutation-test both dependency-cruiser rules**

`review-merge` is pinned by `base-modules-import-nothing`; `ui-controls` and `editor-panel` are named in `mockup-stays-react-free`. Update both regexes, then prove each still fires:

```bash
printf "\nimport './review-state-store.js'\n" >> js/review/review-merge.js
bun run lint:architecture   # expect FAIL: base-modules-import-nothing
git checkout js/review/review-merge.js

printf "\nimport 'react'\n" >> js/review/ui-controls.js
bun run lint:architecture   # expect FAIL: mockup-stays-react-free
git checkout js/review/ui-controls.js

bun run lint:architecture   # expect PASS
```

- [ ] **Step 5: Run the full gate set plus e2e**

```bash
bun run format && bun run format:check && bun run lint:js && bun run lint:architecture \
  && bun run lint:dead-code:ci && bun run lint:docs && bun run validate && bun run test
bun run build:netlify && bun run test:e2e
```

- [ ] **Step 6: Hand-verify the import/export round trip**

**Do not skip this and do not substitute the test suite for it.** CI covers two scenarios on this path — `import-export.spec.js` proves merge rather than wipe via `history.at(-1).updated_by === 'import'`, and `merge-verification.spec.js` covers re-importing an older snapshot onto live state that has moved on. Anything else on this path is yours to check by hand.

```bash
bun run dev
```

Then in the browser at `http://127.0.0.1:8080`:

1. Set a decision and a note on two different pages.
2. Click **Export reviews**, scope "all", save the JSON.
3. Set a decision on a *third* page, so live state has moved past the snapshot.
4. Click **Import reviews** and select the file you saved.
5. Confirm all three pages still carry their decisions and notes — the third one especially. If it is gone, the merge became a wholesale replace and this task must be reverted.

Record the result in the commit message.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: move the review state and export layer to js/review/

Twelve modules: the four ux-improvements files, the merge and validation
modules, the export snapshot, and the shared UI controls the editor panel and
keyboard shortcuts sit on.

js/review-merge.js is imported by server.ts as well as the browser, so its
specifier there is rewritten too. Both dependency-cruiser rules naming these
files are updated and each is mutation-tested separately.

Verified by hand: exported a snapshot with two pages decided, decided a third
page, re-imported, and confirmed all three survived. CI covers two scenarios on
this path and this is not one of them."
```

---

### Task 10: `js/core/`

**Files:**
- Move into `js/core/`: `utils.js`, `state.js`, `page-data.js`, `page-registry.js`, `page-registry-data.js`, `page-registry-ui.js`, `card-inheritance.js`, `third-party-globals.js`, `app.js`
- Modify: `.dependency-cruiser.cjs` (four of the five rules name these files), `build_scripts/load-pages.js:19`, `build_scripts/validate.js:29-30`

**Interfaces:**
- Consumes: `retarget.mjs`.
- Produces: the finished nine-folder layout.

**Last on purpose.** `js/utils.js` alone has 19 importers, and every earlier task has already rewritten its own references, so this diff is as small as it can be made.

- [ ] **Step 1: Move**

```bash
mkdir -p js/core
for f in utils state page-data page-registry page-registry-data page-registry-ui \
         card-inheritance third-party-globals app; do
  git mv "js/$f.js" "js/core/$f.js"
done
```

- [ ] **Step 2: Dry-run, then apply**

```bash
ARGS=""
for f in utils state page-data page-registry page-registry-data page-registry-ui \
         card-inheritance third-party-globals app; do
  ARGS="$ARGS js/$f.js=js/core/$f.js"
done
bun /tmp/hhvc-retarget.mjs $ARGS
bun /tmp/hhvc-retarget.mjs --apply $ARGS
```

- [ ] **Step 3: Fix the three hardcoded `js/page-data.js` strings by hand**

`retarget.mjs`'s plain-string pass should catch these, but verify each explicitly — they are the sites that make `bun run validate` report every page as missing rather than failing loudly:

```bash
grep -n "page-data" build_scripts/load-pages.js build_scripts/validate.js
```

Expected: `build_scripts/load-pages.js:19` returning `'js/core/page-data.js'`, and `build_scripts/validate.js:29-30` filtering and reading the same path.

- [ ] **Step 4: Confirm `pages/*.js` import checking still works**

`build_scripts/page-import-checks.js` diffs `pages/*.js` on disk against `js/core/page-data.js`'s import list. Prove it still fires:

`js/core/page-data.js` side-effect-imports every page file; removing one import
leaves that page file on disk with nobody importing it, which is exactly the
silent failure the check exists to catch — the page simply disappears from the
site.

```bash
cp js/core/page-data.js /tmp/page-data-backup.js
grep -v "agency-service-grouping.js" js/core/page-data.js > /tmp/pd.js \
  && mv /tmp/pd.js js/core/page-data.js
bun run validate
```

Expected: FAIL, naming `pages/agency-service-grouping.js` as imported by nothing.

```bash
cp /tmp/page-data-backup.js js/core/page-data.js && bun run validate
```

Expected: PASS.

- [ ] **Step 5: Update and mutation-test every remaining dependency-cruiser rule**

Four rules name files that just moved. Update each, then prove each fires:

```bash
# base-modules-import-nothing (utils, card-inheritance, page-registry-data)
printf "\nimport './state.js'\n" >> js/core/utils.js
bun run lint:architecture   # expect FAIL
git checkout js/core/utils.js

# mockup-stays-react-free (state, utils, card-inheritance, page-data)
printf "\nimport 'react'\n" >> js/core/state.js
bun run lint:architecture   # expect FAIL
git checkout js/core/state.js

# state-applies-the-page-registry (a REQUIRED rule — removing the import must fail)
grep -v "page-registry.js" js/core/state.js > /tmp/s.js && cp js/core/state.js /tmp/state-backup.js && mv /tmp/s.js js/core/state.js
bun run lint:architecture   # expect FAIL naming state-applies-the-page-registry
cp /tmp/state-backup.js js/core/state.js

# pages-enter-through-page-data
printf "\nimport '../../pages/agency-service-grouping.js'\n" >> js/core/app.js
bun run lint:architecture   # expect FAIL
git checkout js/core/app.js

bun run lint:architecture   # expect PASS
```

The third of these matters most. `state-applies-the-page-registry` is a `required` rule rather than a `forbidden` one — it exists because `js/state.js`'s side-effect import of `page-registry.js` looks removable to anything reading it as unused, and dropping it makes `ORIGINAL_DATA` clone the wrong page set. That surfaces much later as a field reset restoring a deleted page.

- [ ] **Step 6: Verify `no-circular` still passes and the graph is genuinely acyclic**

```bash
bun run lint:architecture
```

Expected: PASS. If it fails, a specifier was rewritten to point somewhere unintended — the import graph was acyclic before this plan started and nothing in this plan should have changed an edge, only a path.

- [ ] **Step 7: Run the full gate set plus e2e and the single-file build**

```bash
bun run format && bun run format:check && bun run lint:js && bun run lint:architecture \
  && bun run lint:dead-code:ci && bun run lint:docs && bun run validate && bun run test
bun run build:netlify && bun run test:e2e
bun run build:singlefile && ls -la dist-singlefile/index.html
```

The single-file build is checked here and nowhere else: it inlines every script and stylesheet, so a specifier that resolves under the dev server but not under `--mode singlefile` shows up only in this output.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: move the core modules to js/core/

utils, state, the page data and registry, the card-inheritance classifier, the
third-party globals shim and the bootstrap. Last of the nine folders, because
utils.js alone has 19 importers and every earlier task shrank this diff.

Three hardcoded 'js/page-data.js' strings in load-pages.js and validate.js are
updated — that path is read rather than imported, so it fails by reporting
every page missing rather than by throwing.

All four remaining dependency-cruiser rules are updated and each mutation-tested
separately, including the required state-applies-the-page-registry rule.
Verified build:singlefile as well as build:netlify."
```

---

### Task 11: Documentation and the stale-comment sweep

**Files:**
- Modify: `docs/codebase/STRUCTURE.md`, `docs/codebase/ARCHITECTURE.md`, `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, any `.claude/skills/hhvc-*/SKILL.md` naming a moved path

**Interfaces:**
- Consumes: the finished layout from Task 10.
- Produces: documentation that describes the tree as it now is.

**Why this is a task and not a footnote.** `retarget.mjs` rewrote path *strings* mechanically. It could not rewrite a sentence whose meaning depends on the old flat layout — "`js/` is one flat directory" is now false, and no regex catches that.

- [ ] **Step 1: Confirm the mechanical sweep is complete**

```bash
bun test tests/module-paths.test.js
```

Expected: PASS. This is Task 1's gate doing the job it was built for. A failure here names a path string that survived every earlier task.

- [ ] **Step 2: Find prose that describes the old layout**

```bash
grep -rn "flat directory\|js/\*\.js\|one flat\|55 flat\|113 flat" \
  AGENTS.md CLAUDE.md .github/copilot-instructions.md docs/codebase/ .claude/skills/hhvc-*/SKILL.md
```

Read each hit and rewrite the sentence rather than the path. The load-order section of `AGENTS.md` is the one to read most carefully — it still describes `js/main.js`'s hand-reviewed order, and that description remains **correct** after this plan. The order is dismantled by the module-coherence plan, not this one. Do not describe it as fixed.

- [ ] **Step 3: Update `docs/codebase/STRUCTURE.md` and `ARCHITECTURE.md`**

Replace the flat file listing with the nine folders and one line each on what the folder owns. These two files describe layout directly and are the most wrong right now.

- [ ] **Step 4: Add the folder map to the three mirrors**

`AGENTS.md` is canon; `CLAUDE.md` and `.github/copilot-instructions.md` mirror it. Add the nine-folder table to the "Core module split" section of each, and reconcile toward `AGENTS.md` if they disagree.

- [ ] **Step 5: Record the `app.js` placement in the spec**

The spec's §1 tree omits `app.js`. Add it to `js/core/` there, so the spec and the tree agree for the plans that follow.

- [ ] **Step 6: Run the docs gates**

```bash
bun run lint:docs && bun run check:links && bun test tests/doc-counts.test.js
```

`check:links` is normally a weekly scheduled job rather than a gate, and it is run by hand here because this task edits cross-file anchors between the three mirrors — markdownlint's MD051 validates a fragment only against the file it sits in, so an anchor into another file is unchecked by everything else.

- [ ] **Step 7: Run the full gate set one final time**

```bash
bun run format && bun run format:check && bun run lint:js && bun run lint:architecture \
  && bun run lint:dead-code:ci && bun run lint:docs && bun run validate && bun run test
bun run build:netlify && bun run test:e2e
```

- [ ] **Step 8: Delete the migration helper**

```bash
rm /tmp/hhvc-retarget.mjs
git status --porcelain
```

Expected: clean. `retarget.mjs` was never committed, and the repo's scope discipline forbids leaving migration scaffolding behind.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "docs: describe the nine-folder layout

retarget.mjs rewrote path strings mechanically across the migration. It could
not rewrite sentences whose meaning depended on the flat layout, and
docs/codebase/STRUCTURE.md described a directory that no longer exists.

The load-order section is deliberately unchanged: js/main.js's order is still
hand-reviewed after this plan. It is the module-coherence plan that makes the
graph enforce it."
```

---

## What this plan does not do

Named here because each is a plausible-looking next step that belongs to a different plan:

- **No `window.<Namespace>` conversion.** The 50 cycles, the 25 mount-body guards and `js/main.js`'s load-bearing order all survive this plan untouched. That is the module-coherence plan.
- **No CSS changes.** The 31 `--legacy-*` tokens and their 155 uses are untouched. `js/main.js`'s eleven `./../css/*.css` imports keep their paths and their order.
- **No behavior changes to the optional backends.** No fixtures, no keys, no ingest.
- **No test file moves and no new tests** beyond Task 1's gate.
