# Karl Tag Category Encoding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Colour each Karl tag by what kind of CMS thing it points at — metadata, a StreamField block, an action, a callout, an inherited link picker, or an editor-only note — without touching the `kind` value that Karl field resolution depends on.

**Architecture:** A new pure classifier, `js/mockup/karl-category.js`, derives a category from signals already in scope at `karlTag()` (`kind`, `context.role`, `context.linkShape`, `inheritanceFact`) and returns one of six strings. `karlTag()` emits it as a **new** `data-category` attribute beside the existing `data-kind`, which is neither renamed nor re-read. Colour then moves from `[data-kind]` to `[data-category]` in `css/ux-improvements.css` — the one file that owns tag colour — while the kind survives as the word already printed in `.karl-tag-kind`.

**Tech Stack:** Plain browser ES modules (bundled by Vite 8), Bun test with happy-dom, Playwright, hand-authored CSS with semantic design tokens.

**Spec:** `docs/superpowers/specs/2026-08-22-karl-tag-field-inspection.md` — subsystem 2, and specifically its "Ruled 2026-08-23" section, which carries the measurement behind every decision below.

## Scope

This plan implements **subsystem 2 only** of the four in that spec. Subsystem 1 (field-metadata surfacing) shipped on branch `feat/karl-tag-field-inspection`. Subsystem 3 (blueprint mode) stays deferred. Subsystem 4 (drawer, JSON snippet, character counter) stays rejected. Nothing here re-opens them.

**This plan starts from a tree where subsystem 1 has merged.** It reads `guide.field` and the `.karl-guide-*` rows that plan produced. Do not start it on a tree without them.

## Global Constraints

Every task's requirements implicitly include these.

- **`kind` is untouchable.** Do not rename a kind, do not change the string any `karlTag()` call passes as `kind`, and do not alter `guideForContext()`'s `role = context.role || context.component || kind` line. 14 of the 34 `karlTag()` call sites pass a bare kind literal with no `context.role`, so their kind IS their role; changing it resolves those to `''` and reports "Mockup only". Any diff touching those is a failed task.
- **Category is derived, never authored at a call site.** No `karlTag()` call gains a `category:` option. If a tag lands in the wrong bucket, fix the classifier's rules, not the call.
- **Colour is never the only encoding.** Each tag keeps the kind word in `.karl-tag-kind`. A category that is distinguishable only by fill is a failed task.
- **CSS: semantic tokens only, no hex literals** outside the token declarations in `css/theme.css` / `css/styles.css` themselves. No new `--sfds-`-prefixed name — `tests/sfds-tokens.test.js` fails on that prefix outside `css/sfds.css`.
- **Tag colour lives in `css/ux-improvements.css` and nowhere else.** `css/styles.css` carries a boxed comment forbidding restoration of per-kind colour there, because a previous split rendered a merge neither block described. Read that comment before touching either file.
- Prettier gate: no semicolons, single quotes, 2-space indentation, `printWidth: 100`, ES5 trailing commas, ASI-safe.
- **Do not create a new `tests/*.test.js` file without adding it to `package.json`'s `test` script**, which is spelled out explicitly rather than globbed. A new unit-test file is invisible to CI until named there. This plan creates one and Task 1 registers it in the same commit.
- A new `tests/e2e/*.spec.js` IS auto-discovered — `playwright.config.js` sets `testDir: './tests/e2e'`.
- Run `bun run validate` as well as `bun run test` after touching anything under `js/`.
- Comment voice: verbose and explanatory. JSDoc on every function; comments justify the WHY, never restate the code.

## File Structure

| File | Responsibility | Task |
| ---- | -------------- | ---- |
| `js/mockup/karl-category.js` | **New.** The six category names and the pure classifier. Imports nothing, reads no global. | 1 |
| `tests/karl-category.test.js` | **New.** Classifier unit tests, including every precedence collision. Registered in `package.json`. | 1 |
| `package.json` | Add the new test file to the `test` script | 1 |
| `js/mockup/page-render.js` | `karlTag()` emits `data-category` beside `data-kind` | 2 |
| `css/styles.css` | Declare the one new `--legacy-teal-*` token triple on `:root` | 3 |
| `css/theme.css` | Dark-mode override for that triple | 3 |
| `tests/theme-contrast.test.js` | Measured WCAG + within-mode ΔE for the new pair | 3 |
| `css/ux-improvements.css` | Move tag colour from `[data-kind]` to `[data-category]`; six blocks | 4 |
| `js/mockup/karl-tag-meta.js` | Legend renders categories rather than kinds | 4 |
| `tests/karl-guide.test.js` | Legend assertions | 4 |
| `tests/e2e/karl-category.spec.js` | **New.** Real-browser proof, incl. dark mode | 5 |
| `AGENTS.md`, `CLAUDE.md` | Mirror the encoding rule | 5 |

---

### Task 1: The category classifier

A pure module with no imports and no globals, so it can be reasoned about and tested on its own before anything renders it.

**Files:**
- Create: `js/mockup/karl-category.js`
- Create: `tests/karl-category.test.js`
- Modify: `package.json` (the `test` script)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `KARL_CATEGORIES` — an object keyed by category id, each `{ label, hint }`. Ids: `metadata`, `block`, `action`, `callout`, `inherited`, `editor`.
  - `karlCategory({ kind, role, linkShape, inheritanceFact }) => string` — always one of those six ids, never `undefined`.

- [x] **Step 1: Write the failing test**

Create `tests/karl-category.test.js`:

```js
// The Karl tag CATEGORY: what kind of CMS thing a tag points at, which is a
// different question from the tag's `kind`.
//
// **Why this is a separate axis rather than a rename.** `guideForContext()`
// computes `role = context.role || context.component || kind`, and 14 of the 34
// karlTag() call sites pass a bare kind literal with no role — so for those,
// the kind string IS the role that resolves a Karl field path. Renaming kinds
// to carry semantic categories would silently resolve those to '' and report
// "Mockup only", which is the confidently-wrong answer this whole subsystem
// exists to prevent. So the category is DERIVED from signals already in scope
// and the kind is left alone.
import { describe, test, expect } from 'bun:test'
import { KARL_CATEGORIES, karlCategory } from '../js/mockup/karl-category.js'

describe('karlCategory', () => {
  test('page metadata is metadata', () => {
    expect(karlCategory({ kind: 'meta' })).toBe('metadata')
    expect(karlCategory({ kind: 'body', role: 'title' })).toBe('metadata')
    expect(karlCategory({ kind: 'body', role: 'description' })).toBe('metadata')
  })

  test('an editor-only QA note is its own category', () => {
    expect(karlCategory({ kind: 'editor' })).toBe('editor')
  })

  test('a button link is an action', () => {
    expect(karlCategory({ kind: 'placement', linkShape: 'button-link' })).toBe('action')
  })

  test('a callout is a callout', () => {
    expect(karlCategory({ kind: 'body', role: 'callout' })).toBe('callout')
  })

  test('a page picker is inherited', () => {
    expect(karlCategory({ kind: 'placement', linkShape: 'page-reference' })).toBe('inherited')
    expect(karlCategory({ kind: 'placement', linkShape: 'resources-list' })).toBe('inherited')
    expect(karlCategory({ kind: 'placement', linkShape: 'campaign-related' })).toBe('inherited')
  })

  test('a card whose text is inherited is inherited even with no link shape', () => {
    expect(karlCategory({ kind: 'placement', inheritanceFact: 'title-and-text' })).toBe('inherited')
    expect(karlCategory({ kind: 'placement', inheritanceFact: 'title' })).toBe('inherited')
  })

  test('ordinary body content is a StreamField block', () => {
    expect(karlCategory({ kind: 'body' })).toBe('block')
    expect(karlCategory({ kind: 'body', role: 'what-to-do' })).toBe('block')
  })

  // PRECEDENCE. These combinations occur together in the real corpus, so the
  // order is a decision rather than an accident, and each collision is pinned
  // here so a later reader cannot reorder the branches without a test going
  // red. Same reasoning as guideStatusLabel() checking `inferred` before the
  // evidence line.
  describe('precedence when several signals are present at once', () => {
    test('editor-only beats every other signal, because it must never read as publishable', () => {
      expect(karlCategory({ kind: 'editor', linkShape: 'button-link', role: 'callout' })).toBe(
        'editor'
      )
    })

    test('a Spotlight CTA is an action, not a block — link shape beats role', () => {
      expect(
        karlCategory({ kind: 'placement', role: 'spotlight', linkShape: 'button-link' })
      ).toBe('action')
    })

    test('an inheriting card that also has a link shape is inherited, not an action', () => {
      expect(
        karlCategory({
          kind: 'placement',
          linkShape: 'page-reference',
          inheritanceFact: 'title-and-text',
        })
      ).toBe('inherited')
    })

    test('metadata beats a link shape, since a title is not a link picker', () => {
      expect(karlCategory({ kind: 'meta', linkShape: 'page-reference' })).toBe('metadata')
    })
  })

  // The classifier must have no silent seventh bucket. An unrecognized
  // combination lands in `block`, the named default, rather than in undefined —
  // an undefined category renders as a tag with NO fill, which reads as a
  // styling bug rather than as an unclassified tag.
  describe('total function', () => {
    test('every input returns a declared category, never undefined', () => {
      const inputs = [
        {},
        { kind: 'nonsense' },
        { kind: undefined, role: undefined },
        { kind: 'placement', linkShape: 'not-a-shape' },
        { kind: 'body', role: 'not-a-role' },
        { kind: null, role: null, linkShape: null, inheritanceFact: null },
      ]
      for (const input of inputs) {
        const category = karlCategory(input)
        expect(Object.keys(KARL_CATEGORIES)).toContain(category)
      }
    })

    test('an unrecognized input lands in the named default', () => {
      expect(karlCategory({})).toBe('block')
    })
  })

  test('every category declares a label and a hint for the legend', () => {
    for (const [id, meta] of Object.entries(KARL_CATEGORIES)) {
      expect(typeof meta.label).toBe('string')
      expect(meta.label.length).toBeGreaterThan(0)
      expect(typeof meta.hint).toBe('string')
      expect(meta.hint.length).toBeGreaterThan(0)
      expect(id).toBe(id.toLowerCase())
    }
  })

  test('there are exactly six categories', () => {
    // Five from the brief plus `editor`, which the brief's five do not cover:
    // a QA note is not a Karl field at all and must stay visually distinct
    // from anything publishable.
    expect(Object.keys(KARL_CATEGORIES).sort()).toEqual([
      'action',
      'block',
      'callout',
      'editor',
      'inherited',
      'metadata',
    ])
  })
})
```

- [x] **Step 2: Register the test file, then run it to verify it fails**

`package.json`'s `test` script names each test file explicitly rather than globbing, so add `tests/karl-category.test.js` to it. Put it next to `tests/karl-tag-meta.test.js` so the Karl files stay together.

Run: `bun test tests/karl-category.test.js`
Expected: FAIL — `Cannot find module '../js/mockup/karl-category.js'`.

- [x] **Step 3: Write the implementation**

Create `js/mockup/karl-category.js`:

```js
/* What kind of CMS thing a Karl tag points at, as a SECOND axis beside the
   tag's `kind`.

   **Why this is derived rather than authored, and why `kind` is not renamed.**
   js/karl/karl-guide-registry.js computes `role = context.role ||
   context.component || kind`, and 14 of the 34 karlTag() call sites in
   js/mockup/page-render.js pass a bare kind literal with no role — so for those
   sites the kind string IS the role that resolves a Karl field path. Renaming
   the kinds to carry semantic categories would change `role` for all 14, and
   any new name absent from ROLE_PANELS/ROLE_ALIASES resolves to '' and reports
   "Mockup only". That is a confident wrong answer about where an editor should
   paste approved copy, which is the failure this whole subsystem exists to
   prevent. So the category reads signals that are ALREADY in scope at
   karlTag(), and nothing that feeds role resolution is touched.

   **Colour follows the category; the kind keeps its word.** The two cannot both
   own the chip's fill. They do not need to: every tag already prints its kind
   in words inside `.karl-tag-kind`, so the kind survives as a text encoding
   while the category takes the colour — which also keeps the encoding readable
   without colour.

   Imports nothing and reads no global, so it has no load-order dependency and
   can be tested without a DOM. */

/**
 * The six categories, in the order the legend lists them.
 *
 * Six rather than the brief's five: `editor` covers QA notes, which are not
 * Karl fields at all and must never read as publishable content.
 */
const KARL_CATEGORIES = {
  metadata: {
    label: 'Metadata',
    hint: 'Page title, description, slug, and search fields',
  },
  block: {
    label: 'StreamField',
    hint: 'Body content blocks — the default when nothing more specific applies',
  },
  action: {
    label: 'Action',
    hint: 'Button links and calls to action',
  },
  callout: {
    label: 'Callout',
    hint: 'Callouts and things-to-know panels',
  },
  inherited: {
    label: 'Link picker',
    hint: 'Page choosers — Karl publishes the destination page’s own words',
  },
  editor: {
    label: 'Editor only',
    hint: 'QA notes — do not publish',
  },
}

// Roles that name page metadata rather than body content. Kept as a set rather
// than a regex so adding one is a data edit with an obvious diff.
const METADATA_ROLES = new Set([
  'title',
  'description',
  'slug',
  'seoTitle',
  'metaDescription',
])

// Link shapes that are page CHOOSERS — the destination page supplies the
// words. `button-link` is deliberately absent: it takes authored link text and
// is an action, not an inherited value.
const PICKER_SHAPES = new Set(['page-reference', 'resources-list', 'campaign-related'])

/**
 * Classify one Karl tag.
 *
 * **The branch order is the contract, not an implementation detail**, because
 * these signals co-occur in the real corpus: a Spotlight CTA carries both
 * `role: 'spotlight'` and `linkShape: 'button-link'`, and an inheriting card
 * carries both an `inheritanceFact` and a `linkShape`. Every collision is
 * pinned in tests/karl-category.test.js, so reordering these branches goes red.
 *
 * Total by construction: an unrecognized combination returns `block`, the named
 * default. Returning undefined would render a tag with no fill at all, which
 * reads as a styling bug rather than as an unclassified tag.
 *
 * @param {{kind?: string, role?: string, linkShape?: string,
 *   inheritanceFact?: string}} signals Everything karlTag() has in scope.
 * @returns {string} One of the KARL_CATEGORIES keys.
 */
function karlCategory({ kind, role, linkShape, inheritanceFact } = {}) {
  // First, and unconditionally: an editor-only note must never be coloured as
  // anything publishable, whatever else it happens to carry.
  if (kind === 'editor') return 'editor'
  if (kind === 'meta' || METADATA_ROLES.has(role)) return 'metadata'
  // Inheritance before link shape: an inheriting card usually carries both, and
  // "Karl supplies these words" is the more important fact for a reviewer than
  // "this is a link".
  if (inheritanceFact) return 'inherited'
  if (PICKER_SHAPES.has(linkShape)) return 'inherited'
  // Link shape before role: a Spotlight CTA is an action that happens to live
  // in a spotlight, not a spotlight that happens to be clickable.
  if (linkShape === 'button-link') return 'action'
  if (role === 'callout' || role === 'what-to-know') return 'callout'
  return 'block'
}

export { KARL_CATEGORIES, karlCategory }
```

- [x] **Step 4: Run the tests to verify they pass**

Run: `bun test tests/karl-category.test.js && bun run test && bun run validate`
Expected: PASS. The full suite must still be green — this task adds a module nothing imports yet, so nothing else can move.

- [x] **Step 5: Commit**

```bash
git add js/mockup/karl-category.js tests/karl-category.test.js package.json
git commit -m "feat: add the Karl tag category classifier"
```

---

### Task 2: Emit the category, changing nothing else

**Files:**
- Modify: `js/mockup/page-render.js` (`karlTag`, and its import block)
- Test: `tests/karl-guide.test.js`

**Interfaces:**
- Consumes: `karlCategory` from `js/mockup/karl-category.js` (Task 1).
- Produces: every `.karl-tag` element carries `data-category="<id>"` in addition to its existing `data-kind`.

- [x] **Step 1: Write the failing test**

Append to `tests/karl-guide.test.js`. Import `karlTag` from `js/mockup/page-render.js` if it is not already imported there.

```js
describe('a Karl tag carries its category alongside its kind', () => {
  test('the kind attribute is unchanged and the category is added', () => {
    const html = karlTag('Body section', 'body')
    expect(html).toContain('data-kind="body"')
    expect(html).toContain('data-category="block"')
  })

  test('an editor note is categorised editor and still kinded editor', () => {
    const html = karlTag('Editor-only QA note / Do not publish', 'editor')
    expect(html).toContain('data-kind="editor"')
    expect(html).toContain('data-category="editor"')
  })

  test('a button link tag is categorised as an action', () => {
    const html = karlTag('Step action', 'placement', {
      context: { role: 'what-to-do', linkShape: 'button-link' },
    })
    expect(html).toContain('data-category="action"')
    expect(html).toContain('data-kind="placement"')
  })

  test('an inheriting card tag is categorised as a link picker', () => {
    const html = karlTag('Linked page item', 'placement', {
      inheritanceFact: 'title-and-text',
    })
    expect(html).toContain('data-category="inherited"')
  })

  // The whole reason the category is a separate attribute. If a future edit
  // ever routes the category into `kind`, Karl field resolution changes for the
  // 14 call sites that pass no explicit role — and this goes red first.
  test('the category never replaces the kind for any of the four kinds', () => {
    for (const kind of ['meta', 'body', 'placement', 'editor']) {
      const html = karlTag('Some note', kind)
      expect(html).toContain(`data-kind="${kind}"`)
    }
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `bun test tests/karl-guide.test.js`
Expected: FAIL — `Expected to contain "data-category="block""`. The `data-kind` assertions should already pass; that is the point, they pin what must not move.

- [x] **Step 3: Write the implementation**

In `js/mockup/page-render.js`, add to the imports:

```js
import { karlCategory } from './karl-category.js'
```

Inside `karlTag`, after the existing `const guide = normalizeKarlGuide({...})` block, add:

```js
  // Derived, never passed in: a call site that could choose its own category
  // could put a publishable colour on an editor note. See js/mockup/karl-category.js
  // for why this reads the signals rather than renaming `kind`.
  const category = karlCategory({
    kind,
    role: opts.context?.role,
    linkShape: opts.context?.linkShape,
    inheritanceFact: opts.inheritanceFact,
  })
```

Then in the returned template, on the `<mark class="karl-tag" ...>` element only, add the attribute immediately after the existing `data-kind`:

```
data-kind="${escapeHtml(kind)}" data-category="${escapeHtml(category)}"
```

Change nothing else in the template.

- [x] **Step 4: Run tests to verify they pass**

Run: `bun test tests/karl-guide.test.js && bun run test && bun run validate`
Expected: PASS.

**The page-render snapshot will change** — every tag gains an attribute. Inspect the snapshot diff before accepting it and confirm it is purely additive: the only difference on each line should be an inserted `data-category="…"`. If anything else moved, stop and report it rather than accepting the snapshot.

- [x] **Step 5: Commit**

```bash
git add js/mockup/page-render.js tests/karl-guide.test.js tests/__snapshots__/page-render.test.js.snap
git commit -m "feat: emit a derived category on every Karl tag"
```

---

### Task 3: One new token triple, with measured contrast

Five `--legacy-*` colour families exist; six categories need six. This adds the sixth.

**Files:**
- Modify: `css/styles.css` (the `:root` token block at the top)
- Modify: `css/theme.css` (the dark-mode block, and the `.browser-shell` re-pin if that scope declares the sibling families)
- Test: `tests/theme-contrast.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `--legacy-teal-bg`, `--legacy-teal-border`, `--legacy-teal-text`, declared in every scope its sibling families are declared in.

- [ ] **Step 1: Find the sibling families and match their scopes exactly**

Run:

```bash
grep -n -- "--legacy-purple-bg\|--legacy-purple-border\|--legacy-purple-text" css/styles.css css/theme.css
```

`--legacy-teal-*` must be declared in **every scope** those appear in, and no others. A token declared in only some scopes resolves to nothing in the rest, and a `var()` that resolves to nothing silently drops the declaration — the exact failure that shipped a serious dark-mode contrast violation on the sibling branch.

- [ ] **Step 2: Write the failing test**

Add to `tests/theme-contrast.test.js`, following the file's existing structure — it reads `css/theme.css` in three named scopes and measures WCAG ratios and CIE76 ΔE **within** a mode, never across. Match how the existing pairs are declared and asserted; do not invent a second measurement style.

Assert, for both light and dark:
- `--legacy-teal-text` on `--legacy-teal-bg` clears **4.5:1** (it carries the label text).
- `--legacy-teal-border` on `--legacy-teal-bg` clears **3:1** (a non-text boundary).
- `--legacy-teal-bg` is separated from each of the five sibling category backgrounds by a CIE76 ΔE the file's existing sibling assertions use — measured within the same mode only.

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test tests/theme-contrast.test.js`
Expected: FAIL — the token is undeclared, so the parsed value is missing.

- [ ] **Step 4: Declare the tokens and iterate until the ratios pass**

Pick real values and measure; do not copy a hex from the brief's table. The brief proposes `#0E7490` / `#CFFAFE`, which is a starting point and not a measurement — the test is the authority. Give each declaration an inline comment carrying its measured ratio, matching how the sibling families and `--legacy-action-blue` are annotated in this repo.

Run: `bun test tests/theme-contrast.test.js`
Expected: PASS in both modes.

- [ ] **Step 5: Commit**

```bash
git add css/styles.css css/theme.css tests/theme-contrast.test.js
git commit -m "feat: add the teal token family for the link-picker tag category"
```

---

### Task 4: Move colour from kind to category

**Files:**
- Modify: `css/ux-improvements.css` (the `[data-kind]` colour blocks, around lines 1022–1110)
- Modify: `js/mockup/karl-tag-meta.js` (`renderKarlTagLegend`)
- Test: `tests/karl-guide.test.js`

**Interfaces:**
- Consumes: `data-category` (Task 2), the teal tokens (Task 3), `KARL_CATEGORIES` (Task 1).
- Produces: `.karl-tag[data-category='…']` colour rules; a legend keyed by category.

- [ ] **Step 1: Read what is there now, and why it is written that way**

Read `css/ux-improvements.css` around lines 1022–1145 and the boxed comment in `css/styles.css` near line 1803. Two facts you must preserve:
- The `!important` flags are load-bearing here. This is the self-aware override layer, and the base `.karl-tag` rules it overrides are in `css/styles.css`.
- Per-kind colour must NOT be restored in `css/styles.css`. That boxed comment records a merge of two files in which neither block described what actually rendered.

- [ ] **Step 2: Write the failing test**

Append to `tests/karl-guide.test.js`:

```js
describe('the legend explains categories, and never colour alone', () => {
  test('the full legend lists every category by name', () => {
    const html = renderKarlTagLegend('full')
    for (const meta of Object.values(KARL_CATEGORIES)) {
      expect(html).toContain(meta.label)
    }
  })

  test('each legend swatch is keyed by category, not by kind', () => {
    const html = renderKarlTagLegend('full')
    for (const id of Object.keys(KARL_CATEGORIES)) {
      expect(html).toContain(`data-category="${id}"`)
    }
  })

  // The tags themselves still print their kind in words. That is what keeps the
  // encoding readable without colour, and it is why moving colour to the
  // category costs nothing in accessibility terms.
  test('a tag still names its kind in words', () => {
    expect(karlTag('Body section', 'body')).toContain('Body')
    expect(karlTag('Editor note', 'editor')).toContain('Editor only')
  })
})
```

Import `KARL_CATEGORIES` into the test file.

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test tests/karl-guide.test.js`
Expected: FAIL — the legend still iterates `KARL_TAG_KINDS`.

- [ ] **Step 4: Rewrite the colour blocks and the legend**

In `css/ux-improvements.css`, replace the four `.karl-tag[data-kind='…']` colour blocks and their four `.karl-tag[data-kind='…'] .karl-tag-kind` blocks with six `[data-category='…']` equivalents, keeping the `!important` flags and the shared base block. Mapping:

| Category | Family |
| -------- | ------ |
| `metadata` | `--legacy-info-light` / `--legacy-info-border` / `--legacy-info-dark` |
| `block` | `--legacy-purple-bg` / `--legacy-purple-border` / `--legacy-purple-text` |
| `action` | `--legacy-success-bg` / `--legacy-success-border` / `--legacy-success-text` |
| `callout` | `--legacy-warning-bg` / `--legacy-warning-border` / `--legacy-warning-text` |
| `inherited` | `--legacy-teal-bg` / `--legacy-teal-border` / `--legacy-teal-text` |
| `editor` | `--legacy-danger-bg` / `--legacy-danger-border` / `--legacy-danger-text` |

Carry the existing WCAG comment forward, and add one explaining why `editor` moved from green to red: an editor-only note says *do not publish*, and green is the one colour that reads as approval.

Also update the dark-mode `.karl-tag.karl-tag-legend-swatch[data-kind]` selector near line 1141 to key on `data-category`, keeping its specificity note intact.

In `js/mockup/karl-tag-meta.js`, change `renderKarlTagLegend` to iterate `KARL_CATEGORIES` and emit `data-category` on each swatch. Import `KARL_CATEGORIES` from `./karl-category.js`. Leave `KARL_TAG_KINDS` in place — `karlKindMeta()` still supplies the word each tag prints.

- [ ] **Step 5: Run everything**

Run: `bun run test && bun run validate && bun run format && bun run format:check && bun run lint:js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add css/ux-improvements.css js/mockup/karl-tag-meta.js tests/karl-guide.test.js
git commit -m "feat: colour Karl tags by category and key the legend to it"
```

---

### Task 5: Prove it in a browser, then mirror the rule

**Files:**
- Create: `tests/e2e/karl-category.spec.js`
- Modify: `AGENTS.md`, `CLAUDE.md`

**Interfaces:**
- Consumes: `gotoFresh`, `selectPage` from `tests/e2e/helpers.js`.
- Produces: nothing.

**Read the existing suite's conventions before writing** — these bit the sibling plan four times:
- Specs use **CommonJS**: `const { test, expect } = require('@playwright/test')` and `const { gotoFresh, selectPage } = require('./helpers')`. `helpers.js` ends in `module.exports`; there are no ESM exports.
- `gotoFresh(page, path)` takes a **path**, not a page key. Navigate with `await gotoFresh(page)` then `await selectPage(page, 'payFee')`.
- `#tagToggle` is a visually hidden checkbox — click its `.karl-switch` label rather than calling `.check()`/`.uncheck()` on the input.

- [ ] **Step 1: Write the spec**

Create `tests/e2e/karl-category.spec.js` asserting, on a real page:
- A step tag carries both `data-kind` and `data-category`, and its `data-kind` is still one of the four original kinds.
- Tags of at least two different categories are present on one page, and their computed `background-color` values differ — read via `getComputedStyle`, since the whole point is a visible distinction.
- The kind word is still rendered inside each tag, so the encoding survives without colour.
- **In dark mode** (`page.emulateMedia({ colorScheme: 'dark' })`), every category's tag still renders and the legend's Help-tab panel passes the axe check the suite already uses. Reuse `accessibility.spec.js`'s existing helper rather than writing a second axe harness.

- [ ] **Step 2: Run it, and the full suite**

Run: `bunx playwright test karl-category.spec.js`, then `bun run test:e2e`.
Expected: PASS. If an assertion misses, debug the source — do not relax it.

- [ ] **Step 3: Mirror the rule into the two full instruction files**

Add to `AGENTS.md` and `CLAUDE.md`, in each file's own voice, the fact a future session most needs and cannot recover from the code alone: **Karl tags carry two axes — `kind` feeds Karl field resolution and must never be renamed, while `data-category` carries colour only.** State the reason: 14 of the 34 `karlTag()` call sites pass a bare kind literal with no `context.role`, so their kind IS their role.

Do **not** add this to `.github/copilot-instructions.md`. That file is a 167-line pointer carrying no per-subsystem inventories, and the canon's own rule is that pointer files which restated summaries rotted into instructions that were actively wrong. Add no numeric claim beyond the two above — `tests/doc-counts.test.js` and `tests/doc-claims.test.js` scan these files for number-anchored claims and check them against the filesystem, so any count you write must be true and re-derivable.

- [ ] **Step 4: Run the doc gates**

Run: `bun run lint:docs && bun test tests/mirror-consistency.test.js tests/doc-counts.test.js tests/doc-claims.test.js && bun run test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/karl-category.spec.js AGENTS.md CLAUDE.md
git commit -m "test: prove Karl tag categories render and document the two-axis rule"
```

---

## Definition of Done

- [ ] `bun run format:check && bun run lint:js && bun run validate && bun run test` green, output shown
- [ ] `bun run test:e2e` green, output shown — including `accessibility.spec.js` at full pass in dark mode
- [ ] Verified in a real browser at both colour schemes: open `payFee`, confirm the six categories are distinguishable and that each tag still names its kind in words
- [ ] `git diff` confirms **no `karlTag()` call site changed its `kind` argument** and `guideForContext()`'s `role` line is untouched
- [ ] Committed on a branch, pushed, PR opened, CI green

## Self-review notes

- **Spec coverage:** the brief's five categories map to `metadata`/`block`/`action`/`callout`/`inherited`; `editor` is the sixth the brief omits, justified in Task 1's comment and the spec's ruling. The brief's proposed hex values are deliberately not adopted — Task 3 makes the contrast test the authority, since the brief's palette was never measured against this repo's dark surfaces.
- **Known open question, deliberately left to Task 3:** whether `--legacy-danger-*` reads acceptably for `editor` in dark mode. The contrast test answers it; if the ΔE against `--legacy-warning-*` is too small, the fallback is to keep `editor` on `success` and give `action` the teal, moving the new family to a different slot. Task 3's measurement decides, not a preference.
