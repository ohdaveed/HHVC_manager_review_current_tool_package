# SFDS Design Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the SF Design System the single visual authority for both of this tool's surfaces — the 29 mockup pages and the review chrome — replacing 30 hand-authored primitives that borrow the SFDS name without its values.

**Architecture:** Three token layers, one file each, each prefixed with its own authority. `css/sfds.css` holds SFDS primitives keyed to SFDS's own published names; `css/theme.css` stays purely semantic and consumes them; `--ext-*` marks the three things SFDS is silent on (dark mode, a sub-14px step, radius). A pinning test asserts both that every `--sfds-*` matches the vendored capture and that no `--sfds-*` exists outside it — the second direction being the one that catches an invented token.

**Tech Stack:** Plain browser JS bundled by Vite 8, hand-authored CSS with custom properties, Bun test, Playwright, React 19 + MUI for the workspace islands only.

**Design spec:** `docs/superpowers/specs/2026-08-14-sfds-design-consistency-design.md`

## Global Constraints

- **Prettier is the only linter CI enforces.** No semicolons, single quotes, 2-space indent, `printWidth: 100`, ES5 trailing commas. Run `bun run format` before every commit; `bun run format:check` is the gate.
- **`docs/superpowers/` is in `.prettierignore`** — this plan and its spec are not formatted by it. `css/`, `js/`, and `tests/` are.
- **`index.html` has exactly one `<script>` tag.** Never add another.
- **Never write to `pages/*.js` from any review or UX layer.** These are review aids, not publishing tools.
- **`css/theme.css` MUST stay last in `js/main.js`'s CSS import order.** Its dark-mode block overrides the primitives, so a primitive declared after it wins and breaks dark mode.
- **After editing `pages/*.js` or `js/page-data.js`, run `bun run validate` AND `bun run test`.** This plan touches neither, but the rule stands if a task drifts.
- **A new `tests/*.test.js` file runs in CI only once it is named explicitly in `package.json`'s `test` script** — it is a list, not a glob. It must ALSO be added to the test inventory in `CLAUDE.md` and `AGENTS.md`, because `tests/doc-counts.test.js` reads that inventory back and compares it to disk.
- **`AGENTS.md` is canon.** A fact goes there first, then into `CLAUDE.md`, then `.github/copilot-instructions.md`.
- **Contrast floors:** 4.5:1 for body text, 3:1 for large text and non-text UI (WCAG 1.4.3 / 1.4.11). Decision-fill colours additionally hold a ΔE floor of 15.
- **SFDS's desktop breakpoint is 768px**, read from `sfds.css@0.0.1`'s own media block. Not 1024, not 1090.
- **Canon resolution rule:** where `design-system.sf.gov`'s inlined theme and `sfds.css@0.0.1` disagree, the theme wins. Where only the package states something, the package is the source.

---

## Corrections to the spec, to be applied in Task 1

Reading the real files while writing this plan turned up three facts the spec states wrongly. Fix the spec in Task 1 rather than propagating them.

1. **There are 30 `--sfds-*` primitives, not 24.** Verified: `grep -ohE '^\s*--sfds-[a-z0-9-]+' css/*.css | sort -u | wc -l` → `30`.
2. **`var(--sfds-*)` is referenced 390 times, and not only from CSS.** `css/styles.css` 208, `css/ux-improvements.css` 137, `css/theme.css` 30, `css/ai-assist.css` 14, `css/dashboard.css` 1 — plus **10 references inside a template literal in `js/dashboard-guidance.js`**, which a CSS-only rename would miss entirely.
3. **Only the 400 weight of each webfont is loaded.** `js/main.js` imports `@fontsource/roboto-flex/latin-400.css` and `@fontsource/roboto-slab/latin-400.css`. The chosen `title` ladder is weight **700** throughout, so without adding the 700 faces every heading renders as browser-synthesised faux bold. The spec does not mention this and it is load-bearing for Phase 2.

A fourth item is an addition rather than a correction, and Task 11 covers it: `css/theme.css` interpolates an eleven-step `--brand-*` ramp in OKLCH, pinned at step 40 to `--sfds-action-blue` (`#2a60af`) and step 10 to `--sfds-action-blue-hover` (`#001d4e`), with a measured contrast ratio in a comment on every step. Repointing the brand to SFDS invalidates all eleven steps and all twenty-two contrast figures.

---

## File Structure

**Phase 1 — foundation**

| Path | Responsibility |
| --- | --- |
| `docs/source/sfds/tokens.json` (create) | The vendored SFDS capture. Single source the pinning test compares against. |
| `docs/source/sfds/README.md` (create) | Provenance: both captures, their dates, their methods, and the three recorded disagreements. |
| `css/sfds.css` (create) | SFDS primitives only, keyed to SFDS's published names. Imported first. |
| `tests/sfds-tokens.test.js` (create) | Pins `css/sfds.css` against `tokens.json`, both directions. |
| `js/main.js` (modify) | Import `css/sfds.css` first; later, the 700 webfont weights. |
| `css/styles.css`, `css/theme.css`, `css/ux-improvements.css`, `css/ai-assist.css`, `css/dashboard.css`, `js/dashboard-guidance.js` (modify) | The `--sfds-*` → `--legacy-*` rename, then the migration off `--legacy-*`. |

**Phase 2 — mockup** modifies `css/styles.css`, `css/theme.css`, `js/main.js`, and adds `tests/e2e/mockup-tokens.spec.js`.

**Phase 3 — chrome** modifies the six chrome stylesheets, `js/react/theme.js`, and adds `tests/theme-contrast.test.js`.

---

# Phase 1 — Foundation (PR1)

**Acceptance criterion for the whole phase: no pixel moves.** That is a criterion, not a description. If a screenshot diff across the width sweep is non-empty, something assumed to be a no-op was not — and finding that here, in the PR that changes nothing, is the entire point of splitting it out.

---

### Task 1: Vendor the SFDS capture

**Files:**
- Create: `docs/source/sfds/tokens.json`
- Create: `docs/source/sfds/README.md`
- Modify: `docs/superpowers/specs/2026-08-14-sfds-design-consistency-design.md`
- Test: `tests/knowledge-sources.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `docs/source/sfds/tokens.json`, a JSON object of shape `{ "base": { "<token-name>": "<css-value>" }, "desktop": { "<token-name>": "<css-value>" } }`, where token names include their leading `--`. Task 3's pinning test reads exactly this shape. Also produces a new RAG corpus category, `sfds`, derived from the folder name.

- [ ] **Step 1: Write the failing test**

Add to the end of `tests/knowledge-sources.test.js`, inside the existing top-level scope:

```js
describe('the sfds category', () => {
  test('files the vendored SFDS capture under its own category', () => {
    const sources = collectKnowledgeSources()
    const sfds = sources.filter((s) => s.category === 'sfds')
    expect(sfds.length).toBe(1)
    expect(sfds[0].path.endsWith('docs/source/sfds/tokens.json')).toBe(false)
  })

  test('excludes the folder README from the corpus', () => {
    const sources = collectKnowledgeSources()
    const readmes = sources.filter((s) => s.path.endsWith('sfds/README.md'))
    expect(readmes.length).toBe(0)
  })
})
```

Note the first assertion: `collectKnowledgeSources()` globs `docs/source/**/*.md`, so `tokens.json` is not a corpus document and the README is excluded by the existing folder-README rule. The category therefore materialises from the third file this task creates. Add that file now as part of the same task — a `docs/source/sfds/disagreements.md` holding the three recorded conflicts, which IS markdown and IS citable.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/knowledge-sources.test.js`
Expected: FAIL — `expect(sfds.length).toBe(1)` receives `0`, because `docs/source/sfds/` does not exist.

- [ ] **Step 3: Create the vendored token capture**

Create `docs/source/sfds/tokens.json`:

```json
{
  "base": {
    "--sfds-color-white": "#ffffff",
    "--sfds-color-black": "#212123",
    "--sfds-color-action": "var(--sfds-color-blue-bright)",
    "--sfds-color-blue-l1": "#edf4f7",
    "--sfds-color-blue-l2": "#a9d6ea",
    "--sfds-color-blue-bright": "#495ed4",
    "--sfds-color-blue-dark": "#0c1464",
    "--sfds-color-green-l1": "#e9f7ec",
    "--sfds-color-green-l2": "#c0e2c5",
    "--sfds-color-green-l3": "#00866a",
    "--sfds-color-green-l4": "#1b674d",
    "--sfds-color-grey-l1": "#f6f6f6",
    "--sfds-color-grey-l2": "#e2e2e2",
    "--sfds-color-grey-l3": "#c2c2c2",
    "--sfds-color-grey-l4": "#a1a1a1",
    "--sfds-color-grey-dark": "#424244",
    "--sfds-color-purple-l1": "#edebf6",
    "--sfds-color-purple-l2": "#cccced",
    "--sfds-color-purple-l3": "#7d61b3",
    "--sfds-color-purple-l4": "#543a89",
    "--sfds-color-red-l1": "#f5e9e5",
    "--sfds-color-red-l2": "#efcabb",
    "--sfds-color-red-l3": "#c55236",
    "--sfds-color-red-l4": "#9b3921",
    "--sfds-color-slate-l1": "#eff3f4",
    "--sfds-color-slate-l2": "#5a7a92",
    "--sfds-color-slate-l3": "#1d4d70",
    "--sfds-color-slate-l4": "#002b48",
    "--sfds-color-yellow-l1": "#f8f1df",
    "--sfds-color-yellow-l2": "#f9e3a3",
    "--sfds-color-yellow-l3": "#f4c435",
    "--sfds-color-yellow-l4": "#e0a81a",

    "--sfds-space-0": "0",
    "--sfds-space-2": "0.125rem",
    "--sfds-space-4": "0.25rem",
    "--sfds-space-8": "0.5rem",
    "--sfds-space-12": "0.75rem",
    "--sfds-space-16": "1rem",
    "--sfds-space-20": "1.25rem",
    "--sfds-space-28": "1.75rem",
    "--sfds-space-40": "2.5rem",
    "--sfds-space-60": "3.75rem",
    "--sfds-space-80": "5rem",
    "--sfds-space-96": "6rem",

    "--sfds-breakpoint-xs": "375px",
    "--sfds-breakpoint-sm": "640px",
    "--sfds-breakpoint-md": "768px",
    "--sfds-breakpoint-lg": "1024px",
    "--sfds-breakpoint-xl": "1280px",

    "--sfds-border-0": "0",
    "--sfds-border-1": "1px",
    "--sfds-border-2": "2px",
    "--sfds-border-3": "3px",

    "--sfds-font-sans": "'Roboto Flex', ui-sans-serif, sans-serif",
    "--sfds-font-slab": "'Roboto Slab', ui-serif, serif",
    "--sfds-font-mono": "'Roboto Mono', ui-monospace, monospace",

    "--sfds-weight-light": "300",
    "--sfds-weight-normal": "400",
    "--sfds-weight-bold": "700",

    "--sfds-text-body": "1rem",
    "--sfds-leading-body": "1.5rem",
    "--sfds-text-small": "0.875rem",
    "--sfds-leading-small": "1.125rem",
    "--sfds-text-big-desc": "1.25rem",
    "--sfds-leading-big-desc": "1.75rem",
    "--sfds-text-title-xs": "1.25rem",
    "--sfds-leading-title-xs": "1.5rem",
    "--sfds-text-title-sm": "1.5rem",
    "--sfds-leading-title-sm": "1.75rem",
    "--sfds-text-title-md": "1.5rem",
    "--sfds-leading-title-md": "1.75rem",
    "--sfds-text-title-lg": "1.75rem",
    "--sfds-leading-title-lg": "2rem",
    "--sfds-text-title-xl": "2rem",
    "--sfds-leading-title-xl": "2.25rem",
    "--sfds-text-display-sm": "2.25rem",
    "--sfds-leading-display-sm": "2.5rem",
    "--sfds-text-display-lg": "2.75rem",
    "--sfds-leading-display-lg": "3rem",
    "--sfds-tracking-title": "-1px",
    "--sfds-tracking-display-lg": "-1px"
  },
  "desktop": {
    "--sfds-text-big-desc": "1.5rem",
    "--sfds-leading-big-desc": "2rem",
    "--sfds-text-title-md": "2rem",
    "--sfds-leading-title-md": "2.25rem",
    "--sfds-text-title-lg": "2.75rem",
    "--sfds-leading-title-lg": "3.25rem",
    "--sfds-text-title-xl": "3.75rem",
    "--sfds-leading-title-xl": "4rem",
    "--sfds-text-display-sm": "3rem",
    "--sfds-leading-display-sm": "3.25rem",
    "--sfds-text-display-lg": "4.5rem",
    "--sfds-leading-display-lg": "4.75rem",
    "--sfds-tracking-display-lg": "-2px"
  }
}
```

- [ ] **Step 4: Write the provenance README**

Create `docs/source/sfds/README.md`:

```markdown
# SF Design System — vendored token capture

`tokens.json` is the SFDS token set this repo builds `css/sfds.css` from.
`tests/sfds-tokens.test.js` pins the CSS against it in both directions, so a
value edited in one place and not the other fails CI rather than drifting.

## Two captures, on 2026-08-14

**The token values** come from the Stitches theme that `design-system.sf.gov`
inlines into its own pages, cross-checked against
`design-system.sf.gov/libraries/color/interface/`, which lists an identical
palette. Structural values the theme does not carry — the 768px desktop
breakpoint and the per-step letter-spacing — come from
`node_modules/@sfgov/design-system/dist/css/sfds.css@0.0.1`.

**A live measurement** of `sf.gov/information--keeping-your-building-free-vermin`
in headless Chromium at 1440x900, reading computed styles rather than scraping.
It is recorded here because it disagrees with SFDS and that disagreement is a
fact about the world, not an error to reconcile: sf.gov paints links `#1b519e`,
body text `#0b0c0c` on `#fcfcfc`, and headings at Slab 46/56 w600 and 40/52
w500. SFDS describes a system sf.gov has not adopted.

## Why this file exists at all

The primitives this capture replaces were hand-authored under an `--sfds-*`
prefix that implied a provenance they did not have, and the wrong action colour
(`#2a60af`) survived because a heuristic scrape asserted it and nothing tested
it. Vendoring the capture and testing against it is the specific fix.

## Recorded disagreements

See `disagreements.md`.
```

- [ ] **Step 5: Write the citable disagreements note**

Create `docs/source/sfds/disagreements.md`:

```markdown
# Where the SFDS sources disagree

Three conflicts were found between the theme `design-system.sf.gov` inlines and
the published `@sfgov/design-system@0.0.1` package. All three resolve toward the
docs-site theme, which is newer and agrees with the typeface sf.gov actually
serves. They are recorded rather than silently resolved, because an unrecorded
discrepancy is how the wrong action colour survived in this repo for as long as
it did.

| Property | Docs-site theme (canon) | Package `sfds.css@0.0.1` |
| --- | --- | --- |
| Body typeface | Roboto Flex | Rubik |
| Title weight | 700 | 600 |
| `bigDesc` at desktop | bold | 400 |

A fourth disagreement is with the world rather than within SFDS: live sf.gov
matches neither source on link colour, background, body text colour, or heading
scale. See `README.md`.
```

- [ ] **Step 6: Correct the three spec errors**

In `docs/superpowers/specs/2026-08-14-sfds-design-consistency-design.md`:

- Replace every occurrence of "24 existing primitives" and "24 primitives" with "30 primitives".
- In the "Delivery" section's PR1 paragraph, replace "The 24 existing primitives are renamed" with "The 30 existing primitives are renamed".
- Add to the "The mockup surface" section, immediately after the table:

```markdown
**Only the 400 weight of each webfont is loaded today.** `js/main.js` imports
`@fontsource/roboto-flex/latin-400.css` and `@fontsource/roboto-slab/latin-400.css`.
The `title` ladder is weight 700 throughout, so the 700 faces have to be added
in the same PR — otherwise every heading renders as browser-synthesised faux
bold, which is a different shape from the real face and would make the whole
type change read as a rendering bug.
```

- Add to the "Architecture" section, after the `--ext-*` list:

```markdown
**The `--brand-*` ramp is downstream of this and must be re-derived.**
`css/theme.css` interpolates eleven brand steps in OKLCH, pinned at step 40 to
the old action blue and step 10 to its hover, with a measured contrast ratio in
a comment on every step. Repointing the brand to SFDS invalidates all eleven
values and all twenty-two figures; re-interpolating and re-measuring them is
Phase 3 work, not a find-and-replace.
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `bun test tests/knowledge-sources.test.js`
Expected: PASS — `sfds` now contributes exactly one markdown document (`disagreements.md`), and the README is excluded.

- [ ] **Step 8: Update the corpus counts the docs record**

The measured corpus figure appears in `AGENTS.md`, `CLAUDE.md`, and `.github/copilot-instructions.md` as "**76 documents, 768 chunks** (`hhvc-policy` 430, `mockup-draft` 233, `karl` 53, `sfgov-live` 28, `sfgov-style` 24)".

Run the ingest to get the true new numbers rather than incrementing by hand:

```bash
bun run build_scripts/ingest-knowledge.js --dry-run 2>&1 | tail -20
```

Expected: a summary line reporting document and chunk totals, including an `sfds` category. Copy the real figures into all three files. Add `sfds` to the category list in `AGENTS.md`'s "What the RAG corpus contains" section with a one-line description: `sfds` (the vendored SF Design System token capture and its recorded disagreements).

- [ ] **Step 9: Verify the full suite still passes**

Run: `bun run test`
Expected: PASS, including `tests/doc-counts.test.js`, which reads those figures back out of the docs.

- [ ] **Step 10: Commit**

```bash
bun run format
git add docs/source/sfds/ docs/superpowers/specs/ tests/knowledge-sources.test.js AGENTS.md CLAUDE.md .github/copilot-instructions.md
git commit -m "docs: vendor the SFDS token capture with its provenance

The primitives this repo calls --sfds-* were hand-authored, and the wrong
action colour survived because a heuristic scrape asserted it and nothing
tested it. Vendoring the real token set is what lets a test pin it.

- Adds docs/source/sfds/{tokens.json,README.md,disagreements.md}, recording
  both captures, their methods, and the three package-vs-theme conflicts.
- Files the folder as a new RAG corpus category and updates the measured
  document and chunk counts in all three instruction files.
- Corrects three spec errors found while reading the real files: there are
  30 primitives not 24, 10 of the 390 references live in a template literal
  in js/dashboard-guidance.js, and only the 400 webfont weight is loaded."
```

---

### Task 2: Rename the 30 primitives to `--legacy-*`

Purely mechanical, and deliberately its own task: it moves no pixel, so it can be reviewed as a rename and nothing else. Doing it before `css/sfds.css` exists means the `--sfds-*` namespace is empty when the real tokens claim it, so Task 3's pinning test is true from its first commit rather than being deferred a PR.

**Files:**
- Modify: `css/styles.css` (30 declarations + 208 references)
- Modify: `css/theme.css` (30 references)
- Modify: `css/ux-improvements.css` (137 references)
- Modify: `css/ai-assist.css` (14 references)
- Modify: `css/dashboard.css` (1 reference)
- Modify: `js/dashboard-guidance.js` (10 references inside a template literal)
- Modify: `js/main.js` (2 prose comments), `tests/e2e/accessibility.spec.js` (2 prose comments)
- Test: `tests/sfds-tokens.test.js`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: a codebase where `--sfds-` does not appear in `css/` or `js/`, and 30 tokens named `--legacy-*` hold their previous values. Task 3 relies on that empty namespace. Tasks 6–11 delete `--legacy-*` names as each is migrated.

- [ ] **Step 1: Write the failing test**

Create `tests/sfds-tokens.test.js`:

```js
/* Pins the SFDS primitive layer against its vendored capture.

   Role: the guard that makes `--sfds-*` mean something. Every value in
   `css/sfds.css` must match `docs/source/sfds/tokens.json`, AND no `--sfds-*`
   name may exist that the capture does not contain. The second direction is
   the one that matters: the first would have passed happily on the codebase
   this replaced, where someone invented `--sfds-action-blue` and gave it a
   value SFDS never published.

   Load-order dependency: none. It reads files off disk and parses text. */

import { describe, test, expect } from 'bun:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..')

/**
 * Every file in the repo that may legitimately mention a design token.
 *
 * @returns {string[]} Absolute paths.
 */
function tokenBearingFiles() {
  const css = readdirSync(join(ROOT, 'css')).map((f) => join(ROOT, 'css', f))
  const js = readdirSync(join(ROOT, 'js'))
    .filter((f) => f.endsWith('.js'))
    .map((f) => join(ROOT, 'js', f))
  return [...css, ...js]
}

describe('the --sfds-* namespace', () => {
  test('is used by no file outside css/sfds.css', () => {
    const offenders = tokenBearingFiles()
      .filter((path) => !path.endsWith('css/sfds.css'))
      .filter((path) => readFileSync(path, 'utf8').includes('--sfds-'))
      .map((path) => path.slice(ROOT.length + 1))
    expect(offenders).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/sfds-tokens.test.js`
Expected: FAIL — `offenders` lists `css/styles.css`, `css/theme.css`, `css/ux-improvements.css`, `css/ai-assist.css`, `css/dashboard.css`, `js/dashboard-guidance.js`, and `js/main.js`.

- [ ] **Step 3: Perform the rename**

The token names contain no substring that collides with anything else in the repo, so a literal string replace is safe. Run:

```bash
cd /home/ohdaveed/HHVC_manager_review_current_tool_package
for f in css/styles.css css/theme.css css/ux-improvements.css css/ai-assist.css css/dashboard.css js/dashboard-guidance.js js/main.js tests/e2e/accessibility.spec.js; do
  perl -pi -e 's/--sfds-/--legacy-/g' "$f"
done
```

- [ ] **Step 4: Verify the rename hit exactly the expected count**

Run:

```bash
grep -rc -- '--legacy-' css/*.css js/dashboard-guidance.js js/main.js tests/e2e/accessibility.spec.js
grep -rn -- '--sfds-' css/ js/ tests/ || echo "no --sfds- remains"
```

Expected: the per-file counts sum to 392 (the 390 `var()` references plus the 30 declarations, less the overlap already counted — the exact per-file numbers are `styles.css` 238, `ux-improvements.css` 137, `theme.css` 30, `ai-assist.css` 14, `dashboard-guidance.js` 10, `dashboard.css` 1, `main.js` 2, `accessibility.spec.js` 2), and the second command prints `no --sfds- remains`.

- [ ] **Step 5: Update the layer comment that names the old prefix**

`css/theme.css` opens with a three-layer description whose first line reads:

```
     1. RAW SFDS PRIMITIVES   — `--sfds-*`, defined in css/styles.css. The
        SF.gov palette. Never referenced directly by component CSS.
```

The rename has just made that false in two ways. Replace those two lines with:

```
     1. LEGACY PRIMITIVES     — `--legacy-*`, defined in css/styles.css. The
        hand-authored palette this tool shipped before adopting SFDS. Every
        one of these is scheduled for migration; a grep for `--legacy-`
        reports how much of the adoption is left. Never referenced directly
        by component CSS.
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `bun test tests/sfds-tokens.test.js`
Expected: PASS.

- [ ] **Step 7: Register the new test file**

In `package.json`, add `tests/sfds-tokens.test.js` to the explicit list in the `test` script. In `AGENTS.md` and `CLAUDE.md`, add it to the test inventory with its "why":

```
`sfds-tokens` (pins `css/sfds.css` against the vendored capture in BOTH
directions — that no declared value drifts, and that no `--sfds-*` name exists
outside the capture; the second is the one that catches an invented token, which
is exactly what `--sfds-action-blue` was),
```

- [ ] **Step 8: Verify nothing rendered differently**

Run: `bun run test && bun run test:e2e`
Expected: PASS. A rename that changed a value would surface as a contrast assertion failure in `tests/e2e/accessibility.spec.js`.

- [ ] **Step 9: Commit**

```bash
bun run format
git add -A
git commit -m "refactor: rename the 30 hand-authored primitives to --legacy-*

The --sfds-* prefix claims a provenance these values do not have: the three
@sfgov/design-system bundles js/main.js imports declare zero custom
properties, so every one of them was hand-authored, and their values match
neither SFDS nor what sf.gov renders.

Renaming them frees the namespace before the real tokens claim it, so the
pinning test can be true from its first commit rather than a PR later. It
also buys a progress meter for free: after this, anything still reading a
--legacy-* name is un-migrated.

- Renames 392 occurrences across five stylesheets, js/dashboard-guidance.js
  (10 references inside an injected template literal a CSS-only sweep would
  have missed), and two prose comments.
- Adds tests/sfds-tokens.test.js asserting the --sfds-* namespace is empty.
- Corrects css/theme.css's layer comment, which named the old prefix.

Verified: no --sfds- remains under css/ or js/; bun run test and
bun run test:e2e both pass, so no value moved."
```

---

### Task 3: Create `css/sfds.css` and pin it

**Files:**
- Create: `css/sfds.css`
- Modify: `js/main.js` (add the import, first among the stylesheets)
- Modify: `tests/sfds-tokens.test.js`
- Modify: `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, `js/react/theme.js` (the "nine stylesheets" count)

**Interfaces:**
- Consumes: `docs/source/sfds/tokens.json` from Task 1, shape `{ base, desktop }`.
- Produces: every token named in that capture, declared on `:root` in `css/sfds.css`, with the `desktop` map redeclared inside `@media (min-width: 768px)`. Tasks 6–12 consume these names.

- [ ] **Step 1: Write the failing test**

Add to `tests/sfds-tokens.test.js`, after the existing `describe`:

```js
/**
 * Parse the custom properties declared in one CSS block.
 *
 * @param {string} block Raw CSS text.
 * @returns {Record<string, string>} Token name (with dashes) to value.
 */
function parseTokens(block) {
  const out = {}
  for (const match of block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    out[match[1]] = match[2].trim()
  }
  return out
}

const source = readFileSync(join(ROOT, 'css/sfds.css'), 'utf8')
const capture = JSON.parse(readFileSync(join(ROOT, 'docs/source/sfds/tokens.json'), 'utf8'))
const desktopBlock = source.slice(source.indexOf('@media (min-width: 768px)'))
const baseBlock = source.slice(0, source.indexOf('@media (min-width: 768px)'))

describe('css/sfds.css against the vendored capture', () => {
  test('declares every base token at the captured value', () => {
    expect(parseTokens(baseBlock)).toEqual(capture.base)
  })

  test('redeclares every desktop token at the captured value', () => {
    expect(parseTokens(desktopBlock)).toEqual(capture.desktop)
  })

  test('declares no token the capture does not contain', () => {
    const declared = Object.keys(parseTokens(source))
    const known = new Set([...Object.keys(capture.base), ...Object.keys(capture.desktop)])
    expect(declared.filter((name) => !known.has(name))).toEqual([])
  })
})
```

The third test is redundant against the first two today, and is kept anyway: the first two use `toEqual` on whole objects, and a future refactor that loosens either one to a per-key check would silently drop the direction that matters.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/sfds-tokens.test.js`
Expected: FAIL — `ENOENT` on `css/sfds.css`.

- [ ] **Step 3: Create the stylesheet**

Create `css/sfds.css`. Its header states its role and why the names look the way they do:

```css
/* SF Design System primitives.

   Role: layer 1 of three. The raw SFDS palette, scales and faces, keyed to
   SFDS's OWN published token names so any line here can be diffed against
   design-system.sf.gov without a translation table. Layer 2 is css/theme.css
   (semantic: what a thing IS); layer 3 is component CSS.

   Load-order dependency: FIRST among this repo's stylesheets in js/main.js.
   Everything downstream reads these; css/theme.css must still be LAST, since
   its dark-mode block redefines what these declare.

   **Why the names mirror SFDS rather than reading naturally.** The layer this
   replaced used invented names — `--sfds-action-blue` holding `#2a60af`, a
   name SFDS never published wrapped around a value SFDS never specified — and
   nothing about the name made that discoverable. A name that matches the
   published token is checkable by eye and, via tests/sfds-tokens.test.js,
   by CI.

   **Never edit a value here by hand.** docs/source/sfds/tokens.json is the
   source; this file restates it and the test pins the two together. */

:root {
  /* ===================================================================
     Colour — design-system.sf.gov/libraries/color/interface/
     =================================================================== */
  --sfds-color-white: #ffffff;
  --sfds-color-black: #212123;
  --sfds-color-action: var(--sfds-color-blue-bright);
  --sfds-color-blue-l1: #edf4f7;
  --sfds-color-blue-l2: #a9d6ea;
  --sfds-color-blue-bright: #495ed4;
  --sfds-color-blue-dark: #0c1464;
  --sfds-color-green-l1: #e9f7ec;
  --sfds-color-green-l2: #c0e2c5;
  --sfds-color-green-l3: #00866a;
  --sfds-color-green-l4: #1b674d;
  --sfds-color-grey-l1: #f6f6f6;
  --sfds-color-grey-l2: #e2e2e2;
  --sfds-color-grey-l3: #c2c2c2;
  --sfds-color-grey-l4: #a1a1a1;
  --sfds-color-grey-dark: #424244;
  --sfds-color-purple-l1: #edebf6;
  --sfds-color-purple-l2: #cccced;
  --sfds-color-purple-l3: #7d61b3;
  --sfds-color-purple-l4: #543a89;
  --sfds-color-red-l1: #f5e9e5;
  --sfds-color-red-l2: #efcabb;
  --sfds-color-red-l3: #c55236;
  --sfds-color-red-l4: #9b3921;
  --sfds-color-slate-l1: #eff3f4;
  --sfds-color-slate-l2: #5a7a92;
  --sfds-color-slate-l3: #1d4d70;
  --sfds-color-slate-l4: #002b48;
  --sfds-color-yellow-l1: #f8f1df;
  --sfds-color-yellow-l2: #f9e3a3;
  --sfds-color-yellow-l3: #f4c435;
  --sfds-color-yellow-l4: #e0a81a;

  /* ===================================================================
     Space — SFDS publishes px; converted at /16 so it scales with the
     user's browser font size, which fixed px quietly breaks (WCAG 1.4.4).
     The step NAMES keep SFDS's px numbering so they stay diffable.
     =================================================================== */
  --sfds-space-0: 0;
  --sfds-space-2: 0.125rem;
  --sfds-space-4: 0.25rem;
  --sfds-space-8: 0.5rem;
  --sfds-space-12: 0.75rem;
  --sfds-space-16: 1rem;
  --sfds-space-20: 1.25rem;
  --sfds-space-28: 1.75rem;
  --sfds-space-40: 2.5rem;
  --sfds-space-60: 3.75rem;
  --sfds-space-80: 5rem;
  --sfds-space-96: 6rem;

  /* Breakpoints and border widths stay px: rem buys nothing at a media
     query (which resolves against the root size regardless) and invites
     rounding error at a hairline. */
  --sfds-breakpoint-xs: 375px;
  --sfds-breakpoint-sm: 640px;
  --sfds-breakpoint-md: 768px;
  --sfds-breakpoint-lg: 1024px;
  --sfds-breakpoint-xl: 1280px;

  --sfds-border-0: 0;
  --sfds-border-1: 1px;
  --sfds-border-2: 2px;
  --sfds-border-3: 3px;

  /* ===================================================================
     Type. The faces are self-hosted via @fontsource — see js/main.js.
     =================================================================== */
  --sfds-font-sans: 'Roboto Flex', ui-sans-serif, sans-serif;
  --sfds-font-slab: 'Roboto Slab', ui-serif, serif;
  --sfds-font-mono: 'Roboto Mono', ui-monospace, monospace;

  --sfds-weight-light: 300;
  --sfds-weight-normal: 400;
  --sfds-weight-bold: 700;

  --sfds-text-body: 1rem;
  --sfds-leading-body: 1.5rem;
  --sfds-text-small: 0.875rem;
  --sfds-leading-small: 1.125rem;
  --sfds-text-big-desc: 1.25rem;
  --sfds-leading-big-desc: 1.75rem;
  --sfds-text-title-xs: 1.25rem;
  --sfds-leading-title-xs: 1.5rem;
  --sfds-text-title-sm: 1.5rem;
  --sfds-leading-title-sm: 1.75rem;
  --sfds-text-title-md: 1.5rem;
  --sfds-leading-title-md: 1.75rem;
  --sfds-text-title-lg: 1.75rem;
  --sfds-leading-title-lg: 2rem;
  --sfds-text-title-xl: 2rem;
  --sfds-leading-title-xl: 2.25rem;
  --sfds-text-display-sm: 2.25rem;
  --sfds-leading-display-sm: 2.5rem;
  --sfds-text-display-lg: 2.75rem;
  --sfds-leading-display-lg: 3rem;
  --sfds-tracking-title: -1px;
  --sfds-tracking-display-lg: -1px;
}

/* SFDS's desktop step, read from sfds.css@0.0.1's own media block. It is 768,
   not 1024 and not the 1090 that file also uses for its layout container —
   getting this wrong shifts every heading on tablet. */
@media (min-width: 768px) {
  :root {
    --sfds-text-big-desc: 1.5rem;
    --sfds-leading-big-desc: 2rem;
    --sfds-text-title-md: 2rem;
    --sfds-leading-title-md: 2.25rem;
    --sfds-text-title-lg: 2.75rem;
    --sfds-leading-title-lg: 3.25rem;
    --sfds-text-title-xl: 3.75rem;
    --sfds-leading-title-xl: 4rem;
    --sfds-text-display-sm: 3rem;
    --sfds-leading-display-sm: 3.25rem;
    --sfds-text-display-lg: 4.5rem;
    --sfds-leading-display-lg: 4.75rem;
    --sfds-tracking-display-lg: -2px;
  }
}
```

- [ ] **Step 4: Import it first**

In `js/main.js`, the stylesheet block currently begins with `import './../css/styles.css'`. Add above that line:

```js
import './../css/sfds.css'
```

Leave `import './../css/theme.css'` last. The two constraints are independent and both load-bearing: primitives first so everything can read them, semantic layer last so its dark block wins.

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun test tests/sfds-tokens.test.js`
Expected: PASS, all four tests.

- [ ] **Step 6: Update the stylesheet count in four places**

Adding a tenth stylesheet falsifies a number stated in prose. Occurrences:

- `AGENTS.md:261` and `AGENTS.md:2319`
- `CLAUDE.md:283` and `CLAUDE.md:1314`
- `js/react/theme.js:125` (inside the `components` comment explaining why `CssBaseline` is absent)

Change "nine stylesheets" to "ten stylesheets" at each, and add a row to the table at `AGENTS.md:2319` / `CLAUDE.md:1314`, **first**, above `css/styles.css`:

```markdown
| `css/sfds.css`                | the SFDS primitives, keyed to SFDS's own published token names                                  |
```

Also update the sentence introducing that table, which currently says `css/theme.css` MUST stay last — add that `css/sfds.css` must stay first, and why.

- [ ] **Step 7: Verify nothing rendered differently**

Run: `bun run format:check && bun run test && bun run test:e2e`
Expected: PASS. `css/sfds.css` declares tokens nothing reads yet, so this is additive by construction.

- [ ] **Step 8: Commit**

```bash
bun run format
git add -A
git commit -m "feat: add the SFDS primitive layer, pinned to its capture

Adds css/sfds.css as layer 1 of three, keyed to SFDS's own published token
names so any line can be diffed against design-system.sf.gov without a
translation table. Nothing reads it yet -- this is the vocabulary the two
following PRs migrate onto.

- Pins every value against docs/source/sfds/tokens.json in both directions,
  including that no --sfds-* name exists outside the capture.
- Imports first in js/main.js; css/theme.css still imports last, since its
  dark-mode block redefines what these declare.
- Updates the 'nine stylesheets' count in AGENTS.md, CLAUDE.md and
  js/react/theme.js's CssBaseline comment.

Verified: format:check, test and test:e2e all pass. Additive by
construction -- no rule consumes these tokens yet."
```

---

### Task 4: Move `--radius` out of the mockup stylesheet

**Files:**
- Modify: `css/theme.css` (add the `--ext-*` block)
- Modify: `css/styles.css` (the `--radius` declaration becomes an alias)
- Modify: `js/react/theme.js`
- Test: `tests/react-theme.test.js` (create)

**Interfaces:**
- Consumes: `--sfds-space-*` from Task 3, for the derived radius steps.
- Produces: `--ext-radius-2`, `--ext-radius-4`, `--ext-radius-8`, `--ext-radius-12`, `--ext-radius-pill`. `js/react/theme.js`'s `TOKEN_FALLBACKS` gains a `'--ext-radius-8': '8px'` entry, and `createWorkspaceTheme()` reads `--ext-radius-8`.

**Why this is not a deletion.** `var(--radius)` is read by **29 rules inside `css/styles.css` itself**, not only by the 17 chrome rules. It is a genuinely shared token today — which is the boundary problem — but that makes removing it a visual change rather than a relocation. So the declaration moves and an alias stays behind. Verify the premise before starting:

```bash
grep -c 'var(--radius)' css/styles.css
```

Expected: `29`.

- [ ] **Step 1: Write the failing test**

Create `tests/react-theme.test.js`:

```js
/* The MUI theme bridge's token contract.

   Role: pins which design tokens js/react/theme.js reads, and that every one
   of them has a fallback. A token read with no fallback resolves to '' in a
   happy-dom test or before the stylesheets apply, and MUI turns an empty
   palette value into a crash rather than a default.

   Load-order dependency: none. */

import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const source = readFileSync(join(import.meta.dir, '..', 'js/react/theme.js'), 'utf8')

describe('js/react/theme.js token reads', () => {
  test('reads the radius from --ext-radius-8, not the mockup stylesheet', () => {
    expect(source).toContain("token(styles, '--ext-radius-8')")
    expect(source).not.toContain("token(styles, '--radius')")
  })

  test('has a fallback for every token it reads', () => {
    const read = [...source.matchAll(/token\(styles, '(--[a-z0-9-]+)'\)/g)].map((m) => m[1])
    const fallbacks = [...source.matchAll(/'(--[a-z0-9-]+)':\s*'/g)].map((m) => m[1])
    expect(read.filter((name) => !fallbacks.includes(name))).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/react-theme.test.js`
Expected: FAIL — the first test, since the file still reads `--radius`.

- [ ] **Step 3: Add the extension radius scale**

In `css/theme.css`, replace the existing radius block:

```css
  /* Radius. --radius (8px, in css/styles.css) remains the default for
     existing components; these name the ends of the range. */
  --ds-radius-sm: 4px;
  --ds-radius-md: 8px;
  --ds-radius-lg: 14px;
  --ds-radius-pill: 999px;
```

with:

```css
  /* ===================================================================
     Radius — an EXTENSION, because SFDS publishes no radius scale
     ===================================================================
     Derived rather than invented: design-system.sf.gov's own utility
     classes use `rounded-4`, i.e. radius is drawn off the shared step
     ladder, so these are that ladder's first four steps plus a pill.
     The `--ext-` prefix is load-bearing — a grep for it answers "what did
     we add that SFDS does not publish?", which nothing could answer about
     the layer this replaced. */
  --ext-radius-2: 2px;
  --ext-radius-4: 4px;
  --ext-radius-8: 8px;
  --ext-radius-12: 12px;
  --ext-radius-pill: 999px;

  /* The previous names, kept as aliases so this task moves no pixel. Phase
     3 repoints their consumers onto the steps above and deletes them. */
  --ds-radius-sm: var(--ext-radius-4);
  --ds-radius-md: var(--ext-radius-8);
  --ds-radius-lg: 14px;
  --ds-radius-pill: var(--ext-radius-pill);
```

`--ds-radius-lg: 14px` keeps its literal deliberately: 14 is not on the SFDS ladder, and snapping it to 12 is a visual change that belongs in Phase 3 with the rest of the sweep, not in a PR whose acceptance criterion is that nothing moves.

- [ ] **Step 4: Alias `--radius` rather than deleting it**

In `css/styles.css`, replace `  --radius: 8px;` with:

```css
  /* Aliased rather than deleted: 29 rules in this file and 17 in the chrome
     stylesheets read it, so removing it is a visual change and not a
     relocation. The declaration now lives in css/theme.css as an --ext-*
     step; Phase 3 repoints the consumers and drops this line. */
  --radius: var(--ext-radius-8);
```

- [ ] **Step 5: Point the MUI theme at the extension token**

In `js/react/theme.js`, in `TOKEN_FALLBACKS`, replace `'--radius': '6px',` with:

```js
  '--ext-radius-8': '8px',
```

The `6px` was wrong as a fallback — the token it stood in for has been `8px` since it was written — and correcting it here removes a silent 2px discrepancy in any happy-dom render.

Then in `createWorkspaceTheme()`, replace:

```js
      borderRadius: parseInt(token(styles, '--radius'), 10) || 6,
```

with:

```js
      borderRadius: parseInt(token(styles, '--ext-radius-8'), 10) || 8,
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `bun test tests/react-theme.test.js`
Expected: PASS, both tests.

- [ ] **Step 7: Register the new test file**

Add `tests/react-theme.test.js` to `package.json`'s `test` list, and to the inventory in `AGENTS.md` and `CLAUDE.md`:

```
`react-theme` (which design tokens the MUI bridge reads, and that each has a
fallback — a token read with no fallback resolves to `''` before the
stylesheets apply, and MUI turns an empty palette value into a crash rather
than a default),
```

- [ ] **Step 8: Verify the phase's acceptance criterion**

Run: `bun run format:check && bun run validate && bun run test && bun run test:e2e`
Expected: PASS.

Then confirm the no-pixel-moves claim directly rather than inferring it from green tests:

```bash
bun run build:netlify
bun run serve &
bun /tmp/claude-1000/-home-ohdaveed-HHVC-manager-review-current-tool-package/81aae018-d9cf-40fc-ae5c-79a3680e7448/scratchpad/measure.mjs
```

Adapt that script's URL to `http://127.0.0.1:8080` and compare the computed styles against the values recorded in `docs/source/sfds/README.md` for the pre-change build. Every value must be identical. If any differs, the rename or the radius relocation was not the no-op it was assumed to be — find it here rather than in Phase 2.

- [ ] **Step 9: Commit and open PR1**

```bash
bun run format
git add -A
git commit -m "refactor: move --radius out of the mockup stylesheet

--radius was declared in css/styles.css and read by 17 chrome rules and the
MUI theme -- chrome depending on a token the mockup owns, which is the same
boundary defect the --sfds-* prefix was. It cannot simply be deleted: 29
rules inside css/styles.css read it too, so removal is a visual change.

- Adds --ext-radius-{2,4,8,12,pill} to css/theme.css, derived from SFDS's
  own step ladder since SFDS publishes no radius scale.
- Leaves --radius behind as an alias so nothing moves; Phase 3 repoints
  consumers and drops it.
- js/react/theme.js reads --ext-radius-8, and its fallback is corrected
  from 6px to 8px -- the token it stood in for has been 8px all along.
- Adds tests/react-theme.test.js pinning which tokens the bridge reads and
  that each has a fallback.

Verified: format:check, validate, test and test:e2e pass, and computed
styles measured against a local production build are identical to the
pre-change values -- which is PR1's acceptance criterion, not a side note."
```

---

# Phase 2 — The mockup adopts SFDS (PR2)

Reviewer-visible. Worth telling reviewers before it lands: 29 pages they have recorded decisions against will look different when reopened.

---

### Task 5: Load the 700 webfont weights

**Files:**
- Modify: `js/main.js`
- Test: `tests/font-loading.test.js` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `@fontsource/roboto-flex/latin-700.css` and `@fontsource/roboto-slab/latin-700.css` in the bundle. Tasks 6–7 depend on the 700 face existing.

**Why this is first and its own task.** The `title` ladder is weight 700 throughout. Only `latin-400` is imported today, so without this every heading renders browser-synthesised faux bold — a different shape from the real face, with different metrics. Shipping the type change on top of that would make a correct change look like a rendering bug.

- [ ] **Step 1: Write the failing test**

Create `tests/font-loading.test.js`:

```js
/* Which webfont faces the bundle actually loads.

   Role: guards a failure that is invisible in code review and subtle in a
   screenshot. The mockup's headings are weight 700; if only the 400 face is
   imported the browser synthesises bold by smearing the 400 outlines, which
   has different metrics and reads as a rendering fault rather than a design.

   Load-order dependency: none. */

import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const main = readFileSync(join(import.meta.dir, '..', 'js/main.js'), 'utf8')

describe('webfont imports in js/main.js', () => {
  test('loads both weights of both SF.gov faces', () => {
    const expected = [
      '@fontsource/roboto-flex/latin-400.css',
      '@fontsource/roboto-flex/latin-700.css',
      '@fontsource/roboto-slab/latin-400.css',
      '@fontsource/roboto-slab/latin-700.css',
    ]
    expect(expected.filter((face) => !main.includes(face))).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/font-loading.test.js`
Expected: FAIL — the two `latin-700.css` entries are missing.

- [ ] **Step 3: Add the imports**

In `js/main.js`, replace the two existing font imports with four, and note why:

```js
// Both weights of both faces. SFDS's title ladder is weight 700 throughout,
// and importing only 400 leaves the browser synthesising bold — different
// metrics, visibly wrong, and easy to mistake for a broken type scale.
import '@fontsource/roboto-flex/latin-400.css'
import '@fontsource/roboto-flex/latin-700.css'
import '@fontsource/roboto-slab/latin-400.css'
import '@fontsource/roboto-slab/latin-700.css'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/font-loading.test.js`
Expected: PASS.

- [ ] **Step 5: Confirm the packages ship those files**

Run:

```bash
ls node_modules/@fontsource/roboto-flex/latin-700.css node_modules/@fontsource/roboto-slab/latin-700.css
```

Expected: both paths listed. If either is absent, `bun add @fontsource/roboto-flex @fontsource/roboto-slab` to pick up a version that includes them, and note the version bump in the commit body.

- [ ] **Step 6: Check the bundle cost**

Run: `bun run build:app`
Expected: a build summary. Record the change in the initial chunk's gzip size — the docs quote ~114 kB, and two more font faces are worth stating rather than absorbing silently.

- [ ] **Step 7: Register the test and commit**

Add `tests/font-loading.test.js` to `package.json`'s `test` list and to the inventories in `AGENTS.md` and `CLAUDE.md`:

```
`font-loading` (that both weights of both SF.gov faces are imported — the
mockup's headings are weight 700, and importing only 400 leaves the browser
synthesising bold, which has different metrics and reads as a rendering fault
rather than a type scale),
```

```bash
bun run format
git add -A
git commit -m "fix: load the 700 weight of both SF.gov typefaces

Only latin-400 was imported for Roboto Flex and Roboto Slab, so every bold
heading in the mockup was browser-synthesised rather than the real face.
The SFDS title ladder this repo is adopting is weight 700 throughout, which
would have made a correct type change look like a rendering fault.

- Adds tests/font-loading.test.js, since neither code review nor a casual
  screenshot catches synthesised bold."
```

---

### Task 6: Repoint the mockup's colours onto SFDS

**Files:**
- Modify: `css/theme.css` (the semantic colour tokens the mockup reads)
- Modify: `css/styles.css` (the `--legacy-*` reads in mockup rules)
- Test: `tests/e2e/mockup-tokens.spec.js` (create)

**Interfaces:**
- Consumes: `--sfds-color-*` from Task 3.
- Produces: `#mockPage` rendering SFDS colours. Task 7 assumes these landed; Task 11 re-derives `--brand-*` on top of them.

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/mockup-tokens.spec.js`:

```js
import { test, expect } from '@playwright/test'
import { gotoFresh } from './helpers.js'

/* The mockup renders SFDS's palette and type ladder.

   These are the first assertions in the suite that read a computed colour or
   size. That is deliberate: a sweep of the suite before this file existed found
   exactly one mention of a hex value and it was a prose comment, which means
   nothing could have caught a palette that moved wrongly. */

test.describe('mockup SFDS tokens', () => {
  test('paints body copy and background in SFDS black on white', async ({ page }) => {
    await gotoFresh(page)
    const body = await page.locator('#mockPage').evaluate((el) => {
      const s = getComputedStyle(el)
      return { color: s.color, background: getComputedStyle(document.body).backgroundColor }
    })
    expect(body.color).toBe('rgb(33, 33, 35)')
  })

  test('paints inline links in the SFDS action colour', async ({ page }) => {
    await gotoFresh(page)
    const link = page.locator('#mockPage a').first()
    await expect(link).toHaveCSS('color', 'rgb(73, 94, 212)')
  })
})
```

`rgb(33, 33, 35)` is `#212123`; `rgb(73, 94, 212)` is `#495ed4`.

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx playwright test tests/e2e/mockup-tokens.spec.js`
Expected: FAIL — colour is `rgb(11, 12, 12)` and the link is `rgb(42, 96, 175)`.

- [ ] **Step 3: Repoint the semantic colour tokens**

In `css/theme.css`, replace the brand and surface aliases that read `--legacy-*`:

```css
  /* Brand (SFDS action blue family) */
  --brand-primary: var(--sfds-color-action);
  --brand-primary-hover: var(--sfds-color-blue-dark);
  --brand-on-primary: var(--sfds-color-white);
```

Then work through the remaining `--legacy-*` reads in `css/theme.css` — there are 30 — mapping each onto its SFDS counterpart:

| `--legacy-*` | SFDS |
| --- | --- |
| `action-blue` | `--sfds-color-action` |
| `action-blue-hover` | `--sfds-color-blue-dark` |
| `slate-1` | `--sfds-color-black` |
| `slate-2` | `--sfds-color-grey-dark` |
| `slate-3` | `--sfds-color-slate-l2` |
| `slate-4` | `--sfds-color-grey-l3` |
| `slate-5` | `--sfds-color-grey-l1` |
| `slate-6` | `--sfds-color-slate-l1` |
| `white` | `--sfds-color-white` |
| `border` | `--sfds-color-grey-l2` |
| `green` | `--sfds-color-green-l4` |
| `info-dark` / `info-light` / `info-border` | `--sfds-color-blue-dark` / `--sfds-color-blue-l1` / `--sfds-color-blue-l2` |
| `success-bg` / `-border` / `-text` | `--sfds-color-green-l1` / `-l2` / `-l4` |
| `warning-bg` / `-border` / `-text` | `--sfds-color-yellow-l1` / `-l3` / `-l4` |
| `danger-bg` / `-border` / `-text` | `--sfds-color-red-l1` / `-l3` / `-l4` |
| `purple-bg` / `-border` / `-text` | `--sfds-color-purple-l1` / `-l2` / `-l4` |
| `accent-light` / `blue-soft-bg` | `--sfds-color-blue-l1` |
| `focus-ring` | `color-mix(in srgb, var(--sfds-color-action) 25%, transparent)` |
| `footer-bg` | `--sfds-color-slate-l4` |

Two of these are judgement rather than lookup and should carry a comment saying so: `slate-2` maps to `grey-dark` rather than a slate because the legacy value `#383939` is a neutral, and `focus-ring` becomes a `color-mix` because SFDS publishes no translucent ring.

- [ ] **Step 4: Sweep the mockup's own `--legacy-*` reads**

`css/styles.css` holds 208 of them. Work file-section by file-section rather than with a blanket substitution — the mapping above is not one-to-one and a global replace would silently collapse `accent-light` and `blue-soft-bg` onto the same token in rules that used them to differentiate two surfaces. After each section, run the e2e spec.

- [ ] **Step 5: Run test to verify it passes**

Run: `bunx playwright test tests/e2e/mockup-tokens.spec.js`
Expected: PASS.

- [ ] **Step 6: Check what is left**

Run: `grep -c -- '--legacy-' css/styles.css css/theme.css`
Expected: `0` for both. Any remainder is an un-migrated rule; migrate it or state in the commit why it stays.

- [ ] **Step 7: Verify and commit**

Run: `bun run format:check && bun run validate && bun run test && bun run test:e2e`
Expected: PASS. Re-run `tests/e2e/accessibility.spec.js` attentively — its contrast assertions were written against the old palette and some will legitimately need new figures. Recompute rather than relax them.

```bash
bun run format
git add -A
git commit -m "feat: repaint the mockup in the SFDS palette

Links move from #2a60af to SFDS's action colour #495ed4, body text from
#0b0c0c to #212123, and the background from #fcfcfc to #ffffff. The three
values replaced were hand-authored under a prefix claiming SFDS provenance;
two of them happened to match live sf.gov, and this deliberately changes
them, because the adopted authority is SFDS rather than sf.gov's current
Drupal theme.

- Maps all 30 --legacy-* names onto SFDS counterparts; two are judgement
  rather than lookup (slate-2 is a neutral, and the focus ring becomes a
  color-mix since SFDS publishes no translucent value) and say so in-file.
- Adds tests/e2e/mockup-tokens.spec.js -- the first assertions in the suite
  that read a computed colour, so a palette that moves wrongly can fail.
- Recomputes the contrast figures in accessibility.spec.js against the new
  palette rather than relaxing them."
```

---

### Task 7: Adopt the SFDS title ladder

**Files:**
- Modify: `css/styles.css:107-129` (the `h1`–`h4` block)
- Modify: `css/theme.css` (`--font-display` scope)
- Test: `tests/e2e/mockup-tokens.spec.js`

**Interfaces:**
- Consumes: `--sfds-text-title-*`, `--sfds-leading-title-*`, `--sfds-tracking-title`, `--sfds-font-slab`, `--sfds-font-sans`, `--sfds-weight-bold` from Task 3; the 700 faces from Task 5.
- Produces: the final mockup type scale. Nothing downstream depends on it.

- [ ] **Step 1: Write the failing test**

Add to `tests/e2e/mockup-tokens.spec.js`:

```js
test.describe('mockup type ladder', () => {
  test('renders the SFDS title steps at desktop width', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await gotoFresh(page)
    const sizes = await page.evaluate(() => {
      const read = (sel) => {
        const el = document.querySelector(sel)
        if (!el) return null
        const s = getComputedStyle(el)
        return { size: s.fontSize, leading: s.lineHeight, weight: s.fontWeight, family: s.fontFamily }
      }
      return { h1: read('#mockPage h1'), h2: read('#mockPage h2'), h3: read('#mockPage h3') }
    })
    expect(sizes.h1.size).toBe('60px')
    expect(sizes.h1.leading).toBe('64px')
    expect(sizes.h1.weight).toBe('700')
    expect(sizes.h2.size).toBe('44px')
    expect(sizes.h2.leading).toBe('52px')
    expect(sizes.h3.size).toBe('20px')
    expect(sizes.h3.leading).toBe('24px')
  })

  test('uses the slab face for h1 and h2 and the sans face for h3', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await gotoFresh(page)
    const faces = await page.evaluate(() => ({
      h1: getComputedStyle(document.querySelector('#mockPage h1')).fontFamily,
      h3: getComputedStyle(document.querySelector('#mockPage h3')).fontFamily,
    }))
    expect(faces.h1).toContain('Roboto Slab')
    expect(faces.h3).toContain('Roboto Flex')
    expect(faces.h3).not.toContain('Roboto Slab')
  })

  test('steps down below the 768px breakpoint', async ({ page }) => {
    await page.setViewportSize({ width: 700, height: 900 })
    await gotoFresh(page)
    const h1 = await page.evaluate(
      () => getComputedStyle(document.querySelector('#mockPage h1')).fontSize
    )
    expect(h1).toBe('32px')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx playwright test tests/e2e/mockup-tokens.spec.js -g "type ladder"`
Expected: FAIL — `h1` is `64px` (the top of the old clamp), and `h3` reports Roboto Slab.

- [ ] **Step 3: Replace the heading block**

In `css/styles.css`, replace lines 107–129 with:

```css
/* Headings follow SFDS's `title` ladder — titleXl, titleLg, titleXs — chosen
   over the `display` ladder after seeing all three rendered at real size. SFDS
   makes its display steps weight 300, which turned the page title thin; the
   weight change read as a larger departure than the pixel sizes did.

   The sizes are tokens now rather than the clamp() literals that stood here,
   and the comment those literals carried — that they mirror what SF.gov
   actually renders — was false when measured: live sf.gov renders h1 at 46/56
   w600, which is on no SFDS step. The tool follows SFDS deliberately, so the
   mockup no longer matches sf.gov's current theme. That is the decision, not a
   drift. */
h1,
h2 {
  color: var(--text-primary);
  font-family: var(--font-display);
  font-weight: var(--sfds-weight-bold);
  letter-spacing: var(--sfds-tracking-title);
  margin-top: 0;
}
h3,
h4 {
  /* SFDS sets `*` to the sans face and live sf.gov renders h3 in Roboto Flex.
     Both authorities agree, and this repo previously disagreed with both by
     applying --font-display to all four levels. */
  color: var(--text-primary);
  font-family: var(--font-body);
  font-weight: var(--sfds-weight-bold);
  margin-top: 0;
}
h1 {
  font-size: var(--sfds-text-title-xl);
  line-height: var(--sfds-leading-title-xl);
  margin-bottom: var(--sfds-space-16);
}
h2 {
  font-size: var(--sfds-text-title-lg);
  line-height: var(--sfds-leading-title-lg);
  margin-bottom: var(--sfds-space-12);
}
h3 {
  font-size: var(--sfds-text-title-xs);
  line-height: var(--sfds-leading-title-xs);
  margin-bottom: var(--sfds-space-8);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx playwright test tests/e2e/mockup-tokens.spec.js`
Expected: PASS, all five tests.

- [ ] **Step 5: Correct the documented type-scale exception**

`AGENTS.md` and `CLAUDE.md` both carry a paragraph beginning "**The mockup's own type scale is the documented exception to that rule.**", justifying the literals because they "mirror what SF.gov actually renders". That is now doubly wrong — the literals are gone, and the claim was false when measured. Replace the paragraph in `AGENTS.md` first, then mirror to `CLAUDE.md`:

```markdown
**The mockup's type scale is SFDS's `title` ladder, and is no longer an
exception.** `h1`–`h3` in `css/styles.css` read `--sfds-text-title-*` like
everything else. The literals that stood here were justified as mirroring what
SF.gov actually renders; measured in a real browser on 2026-08-14, they did not
— live sf.gov renders `h1` at 46/56 w600, which sits on no SFDS step, and the
old `clamp()` topped out at 64px, which sits on neither. The tool follows SFDS
on purpose, so the mockup deliberately no longer matches sf.gov's current
Drupal theme. See `docs/superpowers/specs/2026-08-14-sfds-design-consistency-design.md`.
```

- [ ] **Step 6: Regenerate the mockup PNG export and look at it**

Run: `bunx playwright test tests/e2e/mockup-image-export.spec.js`
Expected: PASS. Then open one exported PNG and confirm the headings render in the real 700 face rather than synthesised bold — the metrics differ enough to see at a glance once you know to look.

- [ ] **Step 7: Verify and commit PR2**

Run: `bun run format:check && bun run validate && bun run test && bun run test:e2e`

```bash
bun run format
git add -A
git commit -m "feat: adopt the SFDS title ladder in the mockup

h1 becomes titleXl (32 -> 60px at the 768px step), h2 titleLg (28 -> 44),
h3 titleXs (20). Chosen over SFDS's display ladder after rendering all three
at real size: display steps are weight 300, and thinning the page title read
as a larger departure than any pixel size did.

- Narrows --font-display from h1-h4 to h1-h2. SFDS sets * to the sans face
  and live sf.gov renders h3 in Roboto Flex; the repo disagreed with both.
- Replaces the clamp() literals and the comment claiming they mirror what
  SF.gov renders, which measurement in a real browser disproved.
- Rewrites the 'documented exception' paragraph in AGENTS.md and CLAUDE.md,
  since the exception no longer exists.

Verified: computed sizes asserted at 1440px and at 700px, either side of
SFDS's 768px breakpoint; PNG export re-rendered and checked for synthesised
bold."
```

---

# Phase 3 — The chrome adopts SFDS (PR3)

Riskiest, so it ships last and alone. Two of its tasks change what a reviewer sees on every panel.

---

### Task 8: Repoint the chrome type scale

**Files:**
- Modify: `css/theme.css` (the `--ds-text-*` block)
- Modify: `css/ux-improvements.css`, `css/dashboard.css`, `css/ai-assist.css`, `css/ai-rewrite.css`, `css/inline-content-edit.css`, `css/review-insights.css`, `css/review-ops.css`
- Test: `tests/e2e/chrome-tokens.spec.js` (create)

**Interfaces:**
- Consumes: `--sfds-text-body`, `--sfds-text-small`, `--sfds-text-title-xs`, `--sfds-leading-*` from Task 3.
- Produces: `--ext-text-2xs: 0.6875rem` and four re-pointed `--ds-text-*` names. Task 10's MUI mapping reads them.

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/chrome-tokens.spec.js`:

```js
import { test, expect } from '@playwright/test'
import { gotoFresh } from './helpers.js'

test.describe('chrome type scale', () => {
  test('resolves the four steps onto SFDS values', async ({ page }) => {
    await page.setViewportSize({ width: 1800, height: 1000 })
    await gotoFresh(page)
    const steps = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement)
      return {
        panel: s.getPropertyValue('--ds-text-panel').trim(),
        card: s.getPropertyValue('--ds-text-card').trim(),
        label: s.getPropertyValue('--ds-text-label').trim(),
        micro: s.getPropertyValue('--ds-text-micro').trim(),
      }
    })
    expect(steps.panel).toBe('1.25rem')
    expect(steps.card).toBe('1rem')
    expect(steps.label).toBe('0.875rem')
    expect(steps.micro).toBe('0.6875rem')
  })

  test('leaves no chrome rule below the SFDS 14px floor except eyebrows', async ({ page }) => {
    await page.setViewportSize({ width: 1800, height: 1000 })
    await gotoFresh(page)
    const small = await page.evaluate(() => {
      const panel = document.querySelector('#reviewWorkspace')
      if (!panel) return []
      return [...panel.querySelectorAll('*')]
        .map((el) => ({
          size: parseFloat(getComputedStyle(el).fontSize),
          transform: getComputedStyle(el).textTransform,
          cls: el.className && String(el.className).slice(0, 40),
        }))
        .filter((r) => r.size < 14 && r.transform !== 'uppercase')
    })
    expect(small).toEqual([])
  })
})
```

The second test encodes the extension's restriction as an assertion rather than a comment: `--ext-text-2xs` exists for uppercase eyebrow labels, so anything below the floor that is not uppercase is a violation. Without it, PR3's sweep has an escape hatch and the floor is decorative.

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx playwright test tests/e2e/chrome-tokens.spec.js`
Expected: FAIL on both — the steps read `1.05rem`/`0.88rem`/`0.78rem`/`0.68rem`, and the second test lists many elements.

- [ ] **Step 3: Repoint the four steps**

In `css/theme.css`, replace the `--ds-text-*` declarations (keeping the explanatory comment above them, which is still accurate about why there are four):

```css
  --ds-text-panel: var(--sfds-text-title-xs); /* 20px — a panel's own heading */
  --ds-text-card: var(--sfds-text-body); /* 16px — a card inside a panel */
  --ds-text-label: var(--sfds-text-small); /* 14px — hints, captions, labels */

  /* An EXTENSION: SFDS's smallest step is `small` at 14px, and an uppercase
     eyebrow at 14px is visually louder than the card heading beneath it.
     Legibility here comes from letter-spacing and weight rather than size,
     which is why one step may sit below a floor that 49 other declarations
     were raised to. It is for uppercase eyebrow labels and nothing else —
     tests/e2e/chrome-tokens.spec.js asserts that, so the restriction is
     enforced rather than merely written down. */
  --ext-text-2xs: 0.6875rem; /* 11px */
  --ds-text-micro: var(--ext-text-2xs);
```

- [ ] **Step 4: Sweep the 55 type literals**

Find them:

```bash
grep -n 'font-size:' css/ux-improvements.css css/dashboard.css css/ai-assist.css css/ai-rewrite.css css/inline-content-edit.css css/review-insights.css css/review-ops.css | grep -v 'var('
```

Replace each with the nearest `--ds-text-*` step. The mapping, from the measured distribution: `0.68` → `micro`; `0.7`–`0.83` → `label`; `0.85`–`0.95` → `card`; `1rem`–`1.05` → `panel`; `1.2` and `1.65` are outliers that should take `--sfds-text-title-sm` and `--sfds-text-title-md` directly and carry a comment saying which element needs a size the chrome scale does not have.

Run the spec after each file rather than at the end — a single file's worth of changes is a reviewable unit and a failure is trivially attributable.

- [ ] **Step 5: Run test to verify it passes**

Run: `bunx playwright test tests/e2e/chrome-tokens.spec.js`
Expected: PASS.

- [ ] **Step 6: Register the test and commit**

Add `tests/e2e/chrome-tokens.spec.js` to the e2e inventory in `AGENTS.md` and `CLAUDE.md` and update the spec-file count (currently "nineteen spec files"; this and `mockup-tokens.spec.js` make twenty-one).

```bash
bun run format
git add -A
git commit -m "feat: repoint the chrome type scale onto SFDS

Three of the four chrome steps land on published SFDS tokens -- panel on
titleXs, card on body, label on small. The fourth, micro, becomes an
explicit --ext-* extension because SFDS's smallest step is 14px and an
uppercase eyebrow at 14px is louder than the heading beneath it.

- Sweeps 55 literal font-size declarations onto the four steps.
- Asserts the extension's restriction rather than documenting it: anything
  in the workspace below 14px that is not uppercase fails the spec, so the
  floor cannot quietly become decorative.

Verified: 49 declarations previously sat below the SFDS floor; the spec now
reports none outside the eyebrow exemption."
```

---

### Task 9: Repoint the chrome spacing scale

**Files:**
- Modify: `css/theme.css` (the `--ds-space-*` block)
- Modify: the seven chrome stylesheets
- Test: `tests/e2e/chrome-tokens.spec.js`

**Interfaces:**
- Consumes: `--sfds-space-*` from Task 3.
- Produces: eight re-pointed `--ds-space-*` names. Task 10's MUI `spacing` factor must agree with them.

- [ ] **Step 1: Write the failing test**

Add to `tests/e2e/chrome-tokens.spec.js`:

```js
test.describe('chrome spacing scale', () => {
  test('resolves every step onto an SFDS value', async ({ page }) => {
    await page.setViewportSize({ width: 1800, height: 1000 })
    await gotoFresh(page)
    const steps = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement)
      return [1, 2, 3, 4, 5, 6, 7, 8].map((n) =>
        s.getPropertyValue(`--ds-space-${n}`).trim()
      )
    })
    expect(steps).toEqual([
      '0.25rem',
      '0.5rem',
      '0.75rem',
      '1rem',
      '1.25rem',
      '1.75rem',
      '2.5rem',
      '3.75rem',
    ])
  })
})
```

Steps 5–8 are where the two ladders diverge: the repo's 24/32/48/64px become SFDS's 20/28/40/60px.

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx playwright test tests/e2e/chrome-tokens.spec.js -g "spacing scale"`
Expected: FAIL — steps 5–8 read `1.5rem`/`2rem`/`3rem`/`4rem`.

- [ ] **Step 3: Repoint the scale**

In `css/theme.css`:

```css
  /* ===================================================================
     Spacing scale — SFDS's ladder, in rem
     ===================================================================
     The two ladders agreed through 16px and diverged above it: this repo
     doubled (24/32/48/64) where SFDS steps 20/28/40/60/80/96. Steps 5-8
     therefore MOVE, which is a visible change to every panel that uses
     them, not a renaming. Expressed in rem so they scale with the user's
     browser font size — a WCAG 1.4.4 requirement fixed px quietly breaks,
     and the reason these are not simply SFDS's px values. */
  --ds-space-1: var(--sfds-space-4); /*  4px */
  --ds-space-2: var(--sfds-space-8); /*  8px */
  --ds-space-3: var(--sfds-space-12); /* 12px */
  --ds-space-4: var(--sfds-space-16); /* 16px */
  --ds-space-5: var(--sfds-space-20); /* 20px, was 24 */
  --ds-space-6: var(--sfds-space-28); /* 28px, was 32 */
  --ds-space-7: var(--sfds-space-40); /* 40px, was 48 */
  --ds-space-8: var(--sfds-space-60); /* 60px, was 64 */
```

- [ ] **Step 4: Sweep the 171 spacing literals**

Find them:

```bash
grep -n -E '(padding|margin|gap)[a-z-]*:' css/ux-improvements.css css/dashboard.css css/ai-assist.css css/ai-rewrite.css css/inline-content-edit.css css/review-insights.css css/review-ops.css | grep -v 'var('
```

Snap each value to the nearest SFDS step, **ties rounding down**. About 59 are exact (`0.25`/`0.5`/`0.75`/`1rem`) and free; the remaining ~112 sit on a de-facto 0.05rem grid and each is a small visual change.

Do this one stylesheet at a time, and after each run the width sweep in `tests/e2e/workspace-panels.spec.js` rather than only the token spec — a spacing change that breaks the layout shows up there and nowhere else.

- [ ] **Step 5: Run test to verify it passes**

Run: `bunx playwright test tests/e2e/chrome-tokens.spec.js`
Expected: PASS.

- [ ] **Step 6: Report what the sweep moved**

Run: `grep -c -E '(padding|margin|gap)[a-z-]*:\s*[0-9]' css/*.css`
Expected: only `css/styles.css` reports a nonzero count, and only for mockup rules that mirror a real SF.gov measurement. Any chrome remainder goes in the commit body with its reason.

- [ ] **Step 7: Commit**

```bash
bun run format
git add -A
git commit -m "feat: repoint the chrome spacing scale onto SFDS

The two ladders agreed through 16px and diverged above it: this repo doubled
(24/32/48/64) where SFDS steps 20/28/40/60. Steps 5-8 therefore move, so
this is a visible change to every panel that uses them.

- Sweeps 171 literal padding/margin/gap declarations onto the eight steps,
  snapping to the nearest SFDS value with ties rounding down. 59 were exact
  and free; ~112 sat on a de-facto 0.05rem grid and each moved slightly.
- Kept in rem rather than SFDS's px, because fixed px spacing breaks WCAG
  1.4.4 text resizing.

Verified per stylesheet against the 1280-1920 width sweep in
workspace-panels.spec.js, which is where a spacing change that breaks the
layout surfaces."
```

---

### Task 10: Give the MUI island the whole scale

**Files:**
- Modify: `js/react/theme.js`
- Test: `tests/react-theme.test.js`

**Interfaces:**
- Consumes: the re-pointed `--ds-text-*` (Task 8) and `--ds-space-*` (Task 9), and `--ext-radius-8` (Task 4).
- Produces: a MUI theme whose type, spacing and radius agree with the string-template panels beside it.

**Why this matters more each release.** `theme.js` maps three typography variants today and leaves `spacing` at MUI's default 8px factor. Ported panels and string-template panels therefore disagree, and the disagreement grows with every port.

- [ ] **Step 1: Write the failing test**

Add to `tests/react-theme.test.js`:

```js
describe('js/react/theme.js scale coverage', () => {
  test('maps a spacing factor rather than inheriting MUI default', () => {
    expect(source).toContain('spacing:')
  })

  test('maps every chrome type step', () => {
    for (const step of ['--ds-text-panel', '--ds-text-card', '--ds-text-label', '--ds-text-micro']) {
      expect(source).toContain(step)
    }
  })

  test('maps the caption and button variants, not only h3/h4/body2', () => {
    for (const variant of ['h5:', 'body1:', 'caption:', 'button:']) {
      expect(source).toContain(variant)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/react-theme.test.js`
Expected: FAIL — no `spacing:` key, and `--ds-text-micro`, `h5:`, `body1:`, `caption:`, `button:` are all absent.

- [ ] **Step 3: Extend the theme**

In `js/react/theme.js`, replace the `typography` block and add `spacing` beside `shape`:

```js
    /* MUI multiplies this factor by the number passed to `theme.spacing(n)`,
       so a factor of 4 makes spacing(1) 4px, spacing(2) 8px, spacing(3) 12px
       — SFDS's own ladder through its dense end, and the same values the
       string-template panels beside the island get from --ds-space-*. The
       default MUI factor is 8, which is why a ported panel and its neighbour
       disagreed, and why the disagreement grew with every port. */
    spacing: 4,
    typography: {
      // Inherit the page's own stack rather than pulling in MUI's Roboto
      // default, which this tool does not load and which would make the
      // workspace read as a different product from the sidebar beside it.
      fontFamily: 'inherit',
      // The four chrome steps in css/theme.css, all four now — h3/h4/body2
      // alone left caption, button and body1 rendering at MUI's own sizes.
      h3: { fontSize: 'var(--ds-text-panel)', fontWeight: 800 },
      h4: { fontSize: 'var(--ds-text-card)', fontWeight: 800 },
      h5: { fontSize: 'var(--ds-text-card)', fontWeight: 700 },
      body1: { fontSize: 'var(--ds-text-card)' },
      body2: { fontSize: 'var(--ds-text-label)' },
      button: { fontSize: 'var(--ds-text-label)', textTransform: 'none' },
      caption: { fontSize: 'var(--ds-text-micro)', textTransform: 'uppercase' },
    },
```

`textTransform: 'none'` on `button` is deliberate: MUI uppercases button labels by default, and nothing else in this tool's chrome does. `caption` carries `uppercase` because `--ds-text-micro` is the eyebrow step and Task 8's spec asserts that anything below 14px is uppercase — a caption rendering at 11px in sentence case would fail it.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/react-theme.test.js`
Expected: PASS.

- [ ] **Step 5: Check the island against its neighbour**

Run: `bunx playwright test tests/e2e/review-workflow.spec.js`
Expected: PASS — that spec asserts on the Checks panel's legacy class names, which are unchanged.

Then look at the Checks tab beside the Overview tab at 1800px and confirm the ported rule list and the string-template advisory section beside it now read at the same sizes. This is the one check in the plan with no assertion behind it, because "these two panels look like one product" is the actual requirement and no computed-style comparison captures it.

- [ ] **Step 6: Commit**

```bash
bun run format
git add -A
git commit -m "feat: map the whole chrome scale into the MUI theme

The island mapped three typography variants and left spacing at MUI's
default 8px factor, so a ported panel and the string-template panel beside
it disagreed -- and the disagreement grew with every port.

- Adds a spacing factor of 4, matching SFDS's ladder through its dense end
  and the values --ds-space-* gives the panels next door.
- Maps h5, body1, button and caption alongside the existing three.
- Turns off MUI's default uppercasing of button labels, which nothing else
  in this chrome does, and uppercases caption, since --ds-text-micro is the
  eyebrow step and the chrome spec requires sub-14px text to be uppercase."
```

---

### Task 11: Re-derive the brand ramp and the dark palette

**Files:**
- Modify: `css/theme.css` (the `--brand-*` ramp, the dark block, `--viz-decision-*`)
- Modify: `css/inline-content-edit.css`, `css/ux-improvements.css` (their small dark blocks)
- Test: `tests/theme-contrast.test.js` (create)

**Interfaces:**
- Consumes: `--sfds-color-*` from Task 3.
- Produces: eleven re-interpolated `--brand-*` steps and an `--ext-dark-*` palette, each with a measured contrast figure.

**Why the ramp cannot survive.** `css/theme.css` interpolates eleven brand steps in OKLCH, pinned at step 40 to `#2a60af` and step 10 to `#001d4e`, with a measured contrast ratio in a comment on every step — twenty-two figures in all, measured against white and against `#0b0c0c`. Task 6 moved the brand to `#495ed4`/`#0c1464` and the body colour to `#212123`, so every step and every figure is now wrong. SFDS publishes no dark palette at all, so the dark side is derived here too.

- [ ] **Step 1: Write the failing test**

Create `tests/theme-contrast.test.js`:

```js
/* Contrast floors for every token pair this tool actually renders.

   Role: SFDS publishes no dark palette and no contrast guarantees for the
   pairings this tool invents, so the floors are enforced here rather than
   assumed. Every dark-mode contrast bug this repo has had came from a literal
   sitting where a token belonged, and none of them failed a test.

   Load-order dependency: none — pure arithmetic over declared values. */

import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const css = readFileSync(join(import.meta.dir, '..', 'css/theme.css'), 'utf8')

/**
 * Relative luminance of an sRGB hex colour, per WCAG 2.1.
 *
 * @param {string} hex Six-digit hex, with or without the leading hash.
 * @returns {number}
 */
function luminance(hex) {
  const v = hex.replace('#', '')
  const channels = [0, 2, 4].map((i) => {
    const c = parseInt(v.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

/**
 * WCAG contrast ratio between two hex colours.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} Between 1 and 21.
 */
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Read one literal hex token value out of css/theme.css.
 *
 * @param {string} name Token name including the leading dashes.
 * @returns {string} Six-digit hex.
 */
function tokenHex(name) {
  const match = css.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, 'i'))
  if (!match) throw new Error(`${name} is not declared as a literal hex in css/theme.css`)
  return match[1]
}

const SFDS_WHITE = '#ffffff'
const SFDS_BLACK = '#212123'

describe('brand ramp contrast', () => {
  test('steps 50 and darker clear 4.5:1 on white, so they are safe for text', () => {
    for (const step of ['--brand-50', '--brand-40', '--brand-30', '--brand-20', '--brand-10']) {
      expect(contrast(tokenHex(step), SFDS_WHITE)).toBeGreaterThanOrEqual(4.5)
    }
  })

  test('step 60 clears the 3:1 non-text bar but not the text bar', () => {
    const ratio = contrast(tokenHex('--brand-60'), SFDS_WHITE)
    expect(ratio).toBeGreaterThanOrEqual(3)
    expect(ratio).toBeLessThan(4.5)
  })

  test('pins step 40 and step 10 to the real SFDS hexes', () => {
    expect(tokenHex('--brand-40').toLowerCase()).toBe('#495ed4')
    expect(tokenHex('--brand-10').toLowerCase()).toBe('#0c1464')
  })
})

describe('decision fills', () => {
  test('every pair separates by at least 15 in CIE76 deltaE', () => {
    const names = [...css.matchAll(/(--viz-decision-[a-z-]+):\s*(#[0-9a-f]{6})/gi)]
    const values = names.map((m) => m[2])
    expect(values.length).toBeGreaterThan(1)
    for (let i = 0; i < values.length; i += 1) {
      for (let j = i + 1; j < values.length; j += 1) {
        expect(deltaE(values[i], values[j])).toBeGreaterThanOrEqual(15)
      }
    }
  })
})

/**
 * CIE76 colour difference between two sRGB hex colours, via CIELAB with a
 * D65 white point.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function deltaE(a, b) {
  const [la, lb] = [lab(a), lab(b)]
  return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2])
}

/**
 * Convert an sRGB hex colour to CIELAB.
 *
 * @param {string} hex
 * @returns {[number, number, number]}
 */
function lab(hex) {
  const v = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(v.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/theme-contrast.test.js`
Expected: FAIL on `pins step 40 and step 10 to the real SFDS hexes` — the ramp still holds `#2a60af` and `#001d4e`.

- [ ] **Step 3: Re-interpolate the ramp**

Pin step 40 to `#495ed4` and step 10 to `#0c1464`, then interpolate the remaining nine in OKLCH so the steps stay perceptually even — the same method the existing comment describes. Use a scratch script rather than eyeballing:

```bash
bun -e "
const {formatHex, oklch, interpolate} = await import('culori')
const scale = interpolate(['#0c1464', '#495ed4'], 'oklch')
for (const [name, t] of [['10',0],['20',0.18],['30',0.36],['40',1]]) console.log(name, formatHex(scale(t)))
"
```

`culori` is not a dependency and must not become one for this — run it with `bunx culori` or compute the values once and paste them in. The ramp is a set of literals in a stylesheet, not runtime code.

Then replace each step's contrast comment with the value the test computes. Recompute against `#ffffff` and `#212123`, the two surfaces these now land on — the old comments measured against `#0b0c0c`, which is no longer the body colour.

- [ ] **Step 4: Derive the dark palette as `--ext-dark-*`**

The dark block in `css/theme.css` is 219 lines and currently redefines the semantic tokens directly. Rename its literals into an `--ext-dark-*` set declared at the top of that block, with a header stating why they exist:

```css
/* SFDS publishes no dark palette — zero prefers-color-scheme rules in either
   shipped bundle — so every value below is this repo's own, derived from SFDS
   hues rather than picked. They carry the --ext- prefix for the same reason the
   radius scale does: a grep must be able to separate what SFDS specifies from
   what we invented. tests/theme-contrast.test.js holds them to 4.5:1 for body
   text and 3:1 for large text and UI. */
```

- [ ] **Step 5: Re-derive the decision fills**

`--viz-decision-*` has a separately chosen dark set — deliberately not a lightened copy of the light one, because the light green lands at 2.96:1 on the dark panel. Re-derive both sets against the new hues and hold them to the ΔE 15 floor the test now enforces. Approved and Needs review are the two most common states and adjacent in the bar, so they are the pair to check first.

- [ ] **Step 6: Run test to verify it passes**

Run: `bun test tests/theme-contrast.test.js`
Expected: PASS, all four tests.

- [ ] **Step 7: Register the test and commit**

Add `tests/theme-contrast.test.js` to `package.json`'s `test` list and to the inventories in `AGENTS.md` and `CLAUDE.md`:

```
`theme-contrast` (WCAG ratios and CIE76 ΔE for every token pair the tool
renders, computed rather than asserted from a comment — SFDS publishes no dark
palette and no guarantees for the pairings this tool invents, and every
dark-mode contrast bug this repo has had came from a literal where a token
belonged and failed no test),
```

```bash
bun run format
git add -A
git commit -m "feat: re-derive the brand ramp and dark palette on SFDS hues

The eleven-step OKLCH brand ramp was pinned to the old action blue and its
hover, with a measured contrast figure on every step -- twenty-two numbers,
all measured against a body colour that is no longer #0b0c0c. Repointing the
brand invalidated the lot.

- Re-interpolates the ramp pinned to SFDS #495ed4 and #0c1464, and
  recomputes every figure against #ffffff and #212123.
- Renames the dark block's literals to --ext-dark-*, since SFDS publishes no
  dark palette and these are this repo's invention.
- Re-derives both --viz-decision-* sets against the new hues.
- Adds tests/theme-contrast.test.js, which computes the ratios and the CIE76
  deltaE rather than trusting a comment. The old figures lived only in
  comments, which is why none of them failed when the palette moved."
```

---

### Task 12: Re-measure the dock breakpoint

**Files:**
- Modify: `css/dashboard.css` (the 1700px media query), if the measurement moves it
- Modify: `tests/e2e/workspace-panels.spec.js`
- Modify: `AGENTS.md`, `CLAUDE.md` (the breakpoint rationale)

**Interfaces:**
- Consumes: everything from Tasks 8–11.
- Produces: a re-measured breakpoint and the two numbers behind it.

**Why it must move or be re-justified.** The 1700px figure is the crossing point of two measured quantities: `.browser-shell` bottoms out near 780px wide and ends around x=1170, while the panel starts at `100vw - 30vw`. Chrome type and spacing both changed in this phase, so the panel's minimum comfortable width changed with them. The docs warn explicitly against lowering the number without re-measuring both; raising it silently is the same error.

- [ ] **Step 1: Measure the panel's new minimum width**

```bash
bun run build:netlify && bun run serve &
```

Then, at each width from 1280 to 1920 in 40px steps, record whether `#reviewWorkspace` overlaps `.browser-shell`:

```js
// Run inside the existing width sweep in tests/e2e/workspace-panels.spec.js
const boxes = await page.evaluate(() => {
  const shell = document.querySelector('.browser-shell')?.getBoundingClientRect()
  const panel = document.querySelector('#reviewWorkspace')?.getBoundingClientRect()
  return shell && panel ? { shellRight: shell.right, panelLeft: panel.left } : null
})
expect(boxes.panelLeft).toBeGreaterThanOrEqual(boxes.shellRight)
```

- [ ] **Step 2: Run the sweep to find the true crossing point**

Run: `bunx playwright test tests/e2e/workspace-panels.spec.js`
Expected: FAIL at some width if the crossing moved; the first failing width is the new breakpoint's floor.

- [ ] **Step 3: Set the breakpoint to the measured value**

Update the media query in `css/dashboard.css` and the assertion's expected threshold together. If the measurement lands back on 1700, say so in the commit — a re-measurement that confirms the existing number is a result, not a no-op.

- [ ] **Step 4: Run the sweep to verify it passes**

Run: `bunx playwright test tests/e2e/workspace-panels.spec.js`
Expected: PASS at every width from 1280 to 1920.

- [ ] **Step 5: Run axe**

Run: `bunx playwright test tests/e2e/accessibility.spec.js`
Expected: PASS. The finding to watch for is the obscured-cell class — "background could not be determined, partially obscured by another element" — which appeared as 57 queue cells the last time this layout was wrong and is invisible in a screenshot taken at scroll position 0.

- [ ] **Step 6: Update the recorded rationale**

`AGENTS.md` and `CLAUDE.md` both carry the paragraph beginning "**The breakpoint is 1700px because that is where three columns actually fit**", with the measured overlap figures at 1440, 1536 and 1600. Replace the numbers with the ones just measured, keeping the structure — including the note that a 14-inch laptop at 1512 CSS px stacks rather than docks, updated if the new breakpoint changes which machines fall on which side.

- [ ] **Step 7: Verify the whole thing and open PR3**

Run: `bun run format:check && bun run validate && bun run test && bun run test:e2e`
Expected: PASS.

```bash
bun run format
git add -A
git commit -m "fix: re-measure the workspace dock breakpoint after the type change

The 1700px figure was the crossing point of two measured quantities, and
raising the chrome type floor to SFDS's 14px moved both. The docs warn
against lowering it without re-measuring; raising it silently would be the
same error.

- Sweeps 1280-1920 in 40px steps asserting the panel never overlaps
  .browser-shell, and sets the media query to the first width that holds.
- Re-runs axe for the obscured-cell finding, which is invisible in a
  screenshot at scroll position 0 and was 57 queue cells last time this
  layout was wrong.
- Updates the recorded overlap figures in AGENTS.md and CLAUDE.md."
```

---

## Self-Review

**Spec coverage.** Every section of the spec maps to a task: the three-layer architecture to Tasks 2–4; provenance and the pinning test to Tasks 1 and 3; the mockup table to Tasks 6–7; the chrome type and space tables to Tasks 8–9; the MUI mapping to Task 10; dark mode and the ΔE floor to Task 11; the dock re-measure and axe to Task 12. Two spec items are covered in places the spec did not anticipate and are called out where they land: the 700 webfont weights (Task 5, absent from the spec) and the `--brand-*` ramp (Task 11, added to the spec in Task 1 Step 6).

**Type consistency.** `--ext-radius-8` is the name used in Task 4's CSS, Task 4's test, and `js/react/theme.js` — not `--ext-radius-4`, which the spec originally specified and which Task 4's header explains would have been an 8px→4px visual change inside a no-pixel-moves PR. `--ext-text-2xs` is spelled identically in Task 8's CSS, Task 8's spec assertion, and Task 10's `caption` variant. `tokens.json`'s `{ base, desktop }` shape is produced in Task 1 and consumed unchanged by Task 3's parser.

**One deliberate gap.** Task 10 Step 5 asks for a human look at the Checks panel beside its neighbour, with no assertion behind it. "These two panels read as one product" is the actual requirement and no computed-style comparison captures it; a fake assertion would be worse than an honest manual step.

---

**Plan complete and saved to `docs/superpowers/plans/2026-08-14-sfds-design-consistency.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
