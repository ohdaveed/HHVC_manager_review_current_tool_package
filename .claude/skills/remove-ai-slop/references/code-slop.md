# Code slop — detailed patterns

Read this when doing a substantial code cleanup. Each pattern has: how to find it, the evidence that justifies acting, and the trap that makes it easy to get wrong.

## Contents

1. [Orphans](#1-orphans)
2. [Foreign boilerplate](#2-foreign-boilerplate)
3. [Drifted duplicates](#3-drifted-duplicates)
4. [Restated vocabularies](#4-restated-vocabularies)
5. [Split declarations](#5-split-declarations)
6. [Dead abstractions](#6-dead-abstractions)
7. [Stale instructions](#7-stale-instructions)
8. [Fossil comments](#8-fossil-comments)
9. [Invented parallel scales](#9-invented-parallel-scales)
10. [Where slop concentrates](#where-slop-concentrates)

---

## 1. Orphans

Files nothing imports, references, or executes.

**Find:** grep the basename across the entire repo — source, tests, configs, CI, package manifests, docs. `<skill-dir>/scripts/find_unreferenced.py` automates the sweep (the script sits beside this file; your shell starts at the repo root, so give its full path).

**Search hidden and ignored files too.** Agent instructions, CI workflows and editor config live in dot-directories, and `rg` skips those by default — so a file referenced only from `.github/` or `.claude/` looks like an orphan. This is not hypothetical: the scanner above once reported _its own source_ as unreferenced for exactly this reason.

**Evidence:** zero references outside the file itself.

**Common kinds:**

- One-shot migration scripts that already ran. Often hold hardcoded data and a write path into source files, which is a hazard to leave lying around.
- Output from a tool nobody uses anymore.
- A module superseded by a rewrite where the old file was never deleted.

**Traps:**

- Dynamic loading — `import(name)`, `require(variable)`, glob-based test discovery, framework file-based routing. Grep for the _directory_ as well as the filename.
- Entry points are referenced from configs, not code — check `package.json`, `Makefile`, CI workflows, Dockerfiles.
- Something referenced only from documentation may still be a documented public interface.

## 2. Foreign boilerplate

Config or instructions from a tool, template, or generator that contradict the project.

**Find:** read every `.cursor/`, `.windsurfrules`, `.github/copilot-instructions.md`, editor config, and generator output. Cross-check any tool or library they name against the actual dependency list.

**Evidence:** the recommended dependency appears nowhere; or the rule directly contradicts the project's own documented standard.

**Real example.** A rule file instructed agents to build with Tailwind and Flowbite, choose Google Fonts, put `!important` on every property, and avoid blue. The project used a government design system with its own tokens, reserved `!important` for one designated override layer, and was built around a blue brand palette. Neither Tailwind nor Flowbite appeared anywhere in the repo. The file was boilerplate from an unrelated editor extension, and it also directed output into a scratch directory — which is how an orphaned 625-line stylesheet had gotten committed.

**Why this ranks high:** unlike dead code, bad instructions actively produce more slop every time an agent reads them.

## 3. Drifted duplicates

The same helper implemented more than once, with the copies no longer in agreement.

**Find:** grep for distinctive strings from a function body — an error message, a regex, a chained call sequence.

**Evidence:** two or more implementations; a diff showing where they differ.

**Always diff the copies before consolidating.** Divergence is often the real defect:

```js
// js/review/review-ops.js — fallback escapes
function escape(value) {
  const text = String(value ?? '')
  if (window.utils?.escapeHtml) return window.utils.escapeHtml(text)
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;') /* … */
}

// js/review/review-insights.js — fallback returns input UNESCAPED
function escape(value) {
  return window.utils?.escapeHtml
    ? window.utils.escapeHtml(String(value ?? ''))
    : String(value ?? '') // ← fails open
}
```

Written by parallel agents that could not see each other. The second fed externally-supplied strings into `innerHTML`. Consolidating was routine; noticing the divergence was the whole value.

**Traps:**

- Verify the surviving implementation handles every input the others did — null coercion, empty strings, non-string types.
- If one copy exists because a module boundary blocks sharing (CommonJS vs ESM, browser vs server), do not force a merge. Keep both and add a test pinning them together.

## 4. Restated vocabularies

One list of valid values — statuses, roles, event names — written out in many places.

**Find:** grep for a distinctive member of the set and count the definition sites.

**Evidence:** the same set enumerated at N locations, none deriving from another.

**Real example.** A five-value decision vocabulary appeared in eight places: a CSS-class map, a validity set, a slug→label map, a label→slug map, a display order, a chart-colour map, a pre-zeroed tally, and a second validity set. Two were exact inverses maintained by hand in different files. Adding a sixth value meant finding all eight; missing one produced a value that saved but could not be filtered.

**Fix:** one table with a row per member carrying every attribute, and derive the rest:

```js
const DECISIONS = [
  { label: 'Needs review', slug: 'needs-review', chipClass: 'decision-pending' },
  // …
]
const DECISION_LABELS = DECISIONS.map((d) => d.label)
const SLUG_BY_LABEL = Object.fromEntries(DECISIONS.map((d) => [d.label, d.slug]))
const LABEL_BY_SLUG = Object.fromEntries(DECISIONS.map((d) => [d.slug, d.label]))
```

**Traps:**

- Watch for **order dependence**. If one site's order is meaningful (chart series, menu sequence) and another's is not, say which is canonical.
- Superset entries are not duplicates. A map holding all five values _plus_ a sixth non-member entry is a different thing; spread the derived map and add the extra rather than deleting it.
- **Where the constant is declared matters.** In JS, an initializer that runs at module top and references a `const` declared further down hits the temporal dead zone. Move the table above its consumers.

## 5. Split declarations

The same entity configured in two places, each specifying part, so neither describes the result.

**Find:** for any selector, key, or setting, grep for _all_ the places it is set — not just the first.

**Evidence:** two declaration sites for one entity; a merged result that matches neither.

**Real example.** Fourteen CSS selectors were declared in two stylesheets. The later file set only the properties it wanted to change and relied on the earlier one for the rest. What rendered was a merge of both:

- An element had a border neither file's author had chosen to give it.
- A value's `font-weight: 800` lived only in the file that _looked_ superseded — deleting that "old" block would have silently regressed it.
- Hover was styled in one file and focus in the other, so the two states diverged in a way neither author intended.

**Fix:** one owner per entity, with every property that currently survives written out explicitly.

**Trap:** the properties surviving by accident are invisible. Enumerate the effective result — computed styles, merged config dumps — before deleting anything. See [verification](#verification-that-actually-verifies).

## 6. Dead abstractions

A shared base introduced as reusable, then used once or never, while later code rolls its own.

**Find:** grep usages of anything named like a primitive — `base-*`, `ds-*`, `*Mixin`, `Abstract*`.

**Evidence:** definition exists; call sites number zero or one; near-identical bespoke implementations exist elsewhere.

**Real example.** A `.ds-card` class was introduced as a "reusable primitive for surfaces built from here on." Two later features each wrote their own card from scratch. Result: three definitions of the same recipe, three different corner radii, and one of them missing its shadow — so two tabs of the same panel disagreed about what a tile looked like.

**Fix:** either adopt it everywhere or delete it. A primitive nobody uses is worse than none, because it implies a consistency that does not exist.

## 7. Stale instructions

Docs describing an architecture the project has replaced.

**Find:** check every claim in contributor docs against the code. Counts, file lists, build steps, "there is no X".

**Evidence:** the doc's claim versus what the repo actually contains.

**Real examples, all found in one repo:**

- "no bundler, no ES modules" — the project had migrated to Vite.
- "add a `<script>` tag to `index.html`" — the file had exactly one, and the correct step was an import elsewhere.
- "7 unit test files" and "(10 files)" against a real 19.
- "There is no backend" — there were two optional API surfaces.

**Why this ranks above dead code:** an agent following a stale instruction edits the wrong file _with confidence_. Nothing errors.

**Fix, and this is the important part:** correcting the numbers is temporary. Prefer changes that cannot rot:

- Make satellite docs **pointers** to one canonical source rather than restatements. A mirror that repeats a fact drifts from it; a mirror that points at it cannot.
- **Delete counts from places nothing checks.** A comment saying "the 10 test files" has no mechanism to fail.
- Add a **drift test** that reads the documented number and compares it to the filesystem. See the skill's `scripts/find_unreferenced.py` for the reference-sweep half of this idea.

## 8. Fossil comments

Comments describing code that no longer exists.

**Find:** read comments adjacent to changed code; check that named identifiers still exist.

**Evidence:** the comment names something absent, or asserts a constraint the code no longer has.

**Distinguish carefully:**

- ❌ "Tabs are numbered by the 1–9 shortcuts" when only six are bound → stale, fix it.
- ✅ "This ran before X existed, so it must stay ordered before Y" → still true, keep.
- ✅ "Removing this caused `<specific failure>`" → bug archaeology, always keep.

## 9. Invented parallel scales

Several contributors each invent their own version of a scale that never existed.

**Find:** collect all the values used for one visual or semantic role and look for near-duplicates.

**Evidence:** N slightly different values doing the same job, with no shared definition.

**Real example.** A project had a spacing scale but no type scale. Four features invented four heading/hint pairs — `1.05`, `0.82`, `0.95`, `0.88rem` — all at the same weight and colour. The absence of the scale caused the divergence.

**Fix:** define the missing scale, then map each existing value to its nearest step. Report the shifts (e.g. "five unchanged, four move by ≤1.1px") so the user can judge.

---

## Where slop concentrates

Look here first:

- **Parallel agent work.** Branches merged from agents that could not see each other produce the highest duplication rate. Compare the modules each added.
- **Post-migration.** After a build-system or framework change, the old world's scaffolding often survives.
- **Generated and tool-owned directories.** `.cursor/`, `.vscode/`, scaffolding output, agent-instruction files — rarely reviewed, high slop density.
- **The second, third, fourth instruction doc.** The first is maintained; the rest rot.
- **Anything named "utils", "helpers", "common".** Where duplicate implementations converge without merging.

## Verification that actually verifies

For a change claimed to be behavior-preserving, "I was careful" is not verification.

**CSS/layout refactor** — capture computed styles before and after:

```js
// Run against the pre-change build, then the post-change build, and diff.
const props = ['display', 'padding', 'border', 'backgroundColor', 'fontWeight' /* … */]
const out = {}
for (const sel of SELECTORS) {
  const el = document.querySelector(sel)
  if (!el) continue
  const cs = getComputedStyle(el)
  out[sel] = Object.fromEntries(props.map((p) => [p, cs[p]]))
}
console.log(JSON.stringify(out, null, 1))
```

In the real case this produced exactly one difference across fourteen selectors and two colour themes — the single intended fix. No amount of reading would have established that.

**Pure function refactor** — run both over the same inputs and compare.

**Data/config consolidation** — dump the effective merged config before and after and diff.

**Round-trip paths** — if the project documents a manual check (export → re-import → data survives), run it. Those instructions usually exist because the path has broken before.

Two practical notes:

- **Don't disturb a running verification.** Rebuilding, reverting files, or killing servers while a test suite runs produces failures that are artifacts of the interference. If that happens, discard the run and redo it cleanly — a corrupted run is not evidence either way.
- **Capture a baseline before you change anything**, or you will have nothing to diff against.
