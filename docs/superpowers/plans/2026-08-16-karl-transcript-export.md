# Karl Transcript Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a paste-ready, per-page markdown transcript telling a human editor exactly which Karl CMS field to type each piece of approved mockup copy into, in the order Karl's own form presents.

**Architecture:** Two new import-free dual-export modules in `js/` (`karl-blocks.js`, the transcribed per-content-type panel inventory; `karl-transcript.js`, the pure `(page, reviewRecord, blocks) → transcript` builder and its markdown renderer), consumed by a thin Node CLI in `build_scripts/` and by a workspace panel in the browser. A new pure check in `build_scripts/data-checks.js` turns "this content has no Karl destination" from something a reader notices into something `bun run validate` fails on.

**Tech Stack:** Plain browser JS (ES modules for the app, CommonJS for `build_scripts/`), Bun test, Playwright, Zod (schema), Prettier (the lint gate).

**Spec:** `docs/superpowers/specs/2026-08-16-karl-transcript-export-design.md` — read it before Task 1. It carries the *why* for every decision below; this plan carries the *how*.

## Global Constraints

- **Never write to `pages/*.js`, never publish, never call a Karl API.** The transcript is an export. It changes what an export contains, not what it authorizes. (`AGENTS.md`, "Review/UX layers are additive".)
- **Prettier is the only linter CI enforces**: no semicolons, single quotes, 2-space indent, `printWidth: 100`, ES5 trailing commas. Run `bun run format` before every commit; `bun run format:check` is the gate.
- **The two new shared modules live in `js/`, not `build_scripts/`.** `build_scripts/` is CommonJS-only (the Bun 1.3.14 lesson recorded in `AGENTS.md` § CI) and the browser bundle is Vite ESM off `js/main.js`. Every existing dual-export module — `js/review-merge.js`, `js/standards/plain-language.js`, `js/card-inheritance.js`, `js/inline-content-edit-data.js` — sits in `js/`, imports nothing, and resolves siblings off `window.*` in the browser branch. Follow that idiom exactly.
- **The dual-export tail is fixed boilerplate**, copied verbatim from `js/card-inheritance.js`:
  ```js
  if (typeof window !== 'undefined') {
    window.karlBlocks = { /* … */ }
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { /* … */ }
  }
  ```
- **Comment voice:** every module opens with a header block stating its role *and its load-order dependency*. Every function carries JSDoc with `@param`/`@returns`. Comments justify the *why*, never restate the code.
- **Every task that adds a `tests/*.test.js` must, in the same commit:** name the file in `package.json`'s `test` script; add its bare stem in backticks to CLAUDE.md's prose enumeration; and bump the unit-test-file count in **CLAUDE.md, AGENTS.md, and `.github/copilot-instructions.md`**. `tests/doc-counts.test.js` asserts that count in all three files and asserts CLAUDE.md names every stem, so batching the doc work at the end makes each intermediate task's own `bun run test` fail.
- **Naming:** `camelCase` identifiers, `UPPER_SNAKE_CASE` module constants, `snake_case` for serialized data fields. Files under `js/` are lowercase-hyphenated.
- **Run `bun run validate` and `bun run test` after every task.** Both must be green at every commit.
- **Measured baseline, used throughout this plan** (`bun run validate` reports 29 pages; the corpus census run on 2026-08-16 reports 136 sections):
  - Type counts: Transaction 14, Information 6, Resource Collection 3, Campaign 2, Topic 1, Agency 1, About us 1, Report 1.
  - 9 `callout.title` values exist (all become FLAG, `U2`).
  - 8 section-level buttons exist: 5 on Transaction sections (`inspectorLookup.1`, `findRecords.1`, `findHotelRecords.1`, `findViolations.1`, `publicRecords.1`) and 3 inside `component: 'spotlight'` sections (Topic `healthyHousingTopic.0`, Campaign `ipmEducation.4`, `mosquitoWorkshop.4`) which are legitimate Spotlight buttons. Only the 5 are `U1`.
  - After Task 5, `findUnmappedSections` over the real corpus must report **0 findings** — every finding is covered by an `UNRESOLVED` rule.

---

## File Structure

| File | Responsibility |
| ---- | -------------- |
| `js/karl-blocks.js` (new) | The eight in-use content types' panel inventories transcribed from `docs/karl-export-field-map.md`, the field map's footnotes as explicit flags, the navigation paths, and the `UNRESOLVED` shape rules. Data only — no logic beyond tiny predicates. |
| `js/karl-transcript.js` (new) | Pure `(page, reviewRecord, blocks) → transcript` plus `renderTranscriptMarkdown(transcript) → string`. Every judgement about what an editor is told lives here and only here. |
| `js/karl-transcript-panel.js` (new) | The workspace `<details>` panel: a Copy button and a Download button for the open page. Browser-only IIFE. |
| `build_scripts/export-karl-transcript.js` (new) | Thin CLI. Loads the corpus, builds every transcript in memory, writes `review/karl-transcripts/<pageKey>.md` only if all pages succeeded. |
| `build_scripts/schema.js` (modify) | `type` narrows from `z.string().min(1)` to a union of the eight values in use. |
| `build_scripts/data-checks.js` (modify) | Adds `findUnmappedSections`, joining the existing pure-function family. |
| `build_scripts/validate.js` (modify) | Wires the new check as a hard failure. |
| `index.html` (modify) | One new `<details class="review-advanced-group">` inside `#reviewWorkspaceAdvanced`. |
| `js/main.js` (modify) | Imports the three new `js/` modules in the right positions. |
| `package.json` (modify) | The `export:karl` script and the two new test files. |
| `tests/karl-blocks.test.js` (new) | The doc-drift guard: parses the field map's tables and asserts every transcribed row still matches. |
| `tests/karl-transcript.test.js` (new) | Pure units over hand-built pages, never the real corpus. |
| `tests/data-validation.test.js` (modify) | `findUnmappedSections` units + the schema `type` union case. |
| `tests/e2e/karl-transcript.spec.js` (new) | The workspace panel, UI-driven. |

---

## Task 1: Narrow the page `type` to a union

The panel inventory is keyed on `page.type`. A typo'd value would silently select no inventory and produce an empty transcript rather than an error, so the union is a requirement of this feature rather than a nicety.

**Files:**

- Modify: `build_scripts/schema.js:135` (the `type` line inside `pageSchema`)
- Test: `tests/data-validation.test.js`

**Interfaces:**

- Consumes: nothing.
- Produces: `PAGE_TYPES` — a frozen array of the eight strings, exported from `build_scripts/schema.js` so `js/karl-blocks.js`'s test can assert its inventory keys against it.

- [ ] **Step 1: Write the failing test**

Append to `tests/data-validation.test.js` (put it beside the other `pageSchema` describes):

```js
describe('page type union', () => {
  // `type` selects the Karl panel inventory in js/karl-blocks.js. Left open as
  // z.string(), a typo produced an empty transcript rather than an error — the
  // failure mode a generated instruction can least afford, because nothing is
  // visibly missing.
  const base = {
    slug: 'x',
    title: 'X',
    summary: 'S',
    audience: ['Tenants'],
    reading: 'Grade 6',
  }

  test('accepts every type the corpus declares', () => {
    for (const type of PAGE_TYPES) {
      expect(pageSchema.safeParse({ ...base, type }).success).toBe(true)
    }
  })

  test('rejects a type that is not a Karl content type', () => {
    expect(pageSchema.safeParse({ ...base, type: 'Transactoin' }).success).toBe(false)
  })

  test('names exactly the eight types in use', () => {
    expect(PAGE_TYPES).toEqual([
      'Transaction',
      'Information',
      'Resource Collection',
      'Campaign',
      'Topic',
      'Agency',
      'About us',
      'Report',
    ])
  })
})
```

Add `PAGE_TYPES` to that file's existing import from `../build_scripts/schema.js`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test tests/data-validation.test.js`
Expected: FAIL — `PAGE_TYPES` is not exported (`undefined is not iterable`), and the `Transactoin` case reports `true`.

- [ ] **Step 3: Implement**

In `build_scripts/schema.js`, above `pageSchema`:

```js
/**
 * The Karl content types this corpus declares, in descending order of use
 * (Transaction 14 pages, Information 6, Resource Collection 3, Campaign 2, and
 * one page each of Topic, Agency, About us and Report).
 *
 * This is a union rather than an open string because js/karl-blocks.js keys its
 * per-type Karl panel inventory on this value: an unrecognised type selects no
 * inventory, so a typo would export an EMPTY transcript instead of failing —
 * and an empty transcript looks like a page with no content rather than like a
 * bug. Adding a ninth type means capturing its form in
 * docs/karl-export-field-map.md and adding its inventory, in that order.
 */
const PAGE_TYPES = [
  'Transaction',
  'Information',
  'Resource Collection',
  'Campaign',
  'Topic',
  'Agency',
  'About us',
  'Report',
]
```

Change the `type` line in `pageSchema` to:

```js
  type: z.enum(PAGE_TYPES),
```

Add `PAGE_TYPES` to the `module.exports` object at the foot of the file.

- [ ] **Step 4: Run the tests and the validator**

Run: `bun test tests/data-validation.test.js && bun run validate`
Expected: tests PASS; `validate` prints `validated 29 pages, N unverified claims flagged`. If `validate` fails with a `type` issue, a page declares a type outside the union — fix the page, not the union, and say so in the commit.

- [ ] **Step 5: Format and commit**

```bash
bun run format
git add build_scripts/schema.js tests/data-validation.test.js
git commit -m "feat: narrow page type to the eight Karl content types in use"
```

---

## Task 2: The Karl panel inventory and its doc-drift guard

**Files:**

- Create: `js/karl-blocks.js`
- Create: `tests/karl-blocks.test.js`
- Modify: `js/main.js` (import), `package.json` (test list), `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md` (counts + enumeration)

**Interfaces:**

- Consumes: `PAGE_TYPES` from Task 1 (in the test only).
- Produces, on `window.karlBlocks` and `module.exports`:
  - `KARL_PANELS` — `Record<PageType, Panel[]>`, each `Panel` being
    `{ uiLabel: string, rawName: string, order: number, required: boolean, repeatable: boolean, blockTypes: string[], source: Source, docLine: number }`
  - `KARL_NAV` — `Record<PageType, string>`, e.g. `'New: Transaction → Content'`
  - `KARL_FLAGS` — `{ calloutHasNoTitle: true, costDescriptionMaxChars: 120, bulletsFoldIntoText: true, buttonLabelGuidanceChars: 25, buttonLabelMaxChars: 255, spotlightsAllowed: { Agency: 2, Campaign: 2, Report: 1, Topic: 1 } }`
  - `matchesSection(match, section, cardClass)` — `(object, object, string|null) => boolean`
  - `panelsFor(type)` — `(string) => Panel[]` (returns `[]` for an unknown type)
- `Source` is a tagged union, **not a dotted path**. The field map's Mockup source column is a predicate on 6 of the 8 types (`section` with `component: 'supporting'`, `component: 'services'` sections, `section with cards[]`), so a path resolver would cover Transaction's scalars and almost nothing else:
  - `{ kind: 'none' }` — no mockup source (`— (U6)`, `— unused`)
  - `{ kind: 'path', path: 'summary' }` — a dotted page path
  - `{ kind: 'sections', match: Match, field?: string, inferred?: true }` — every section matching `match`; `field` narrows the emission to one field of it (Agency's `services_title` takes the matched section's `heading`)
- `Match` keys, all optional, ANDed together:
  - `component: string | null` — `null` means the section carries no `component` at all
  - `flat: boolean`
  - `has: string[]` — every named field must be truthy
  - `lacks: string[]` — none of the named fields may be truthy
  - `cardClass: 'inherits' | 'title-only' | 'authored'` — the `js/card-inheritance.js` classification of the section

- [ ] **Step 1: Write the failing drift-guard test**

Create `tests/karl-blocks.test.js`:

```js
/*
 * The drift guard. js/karl-blocks.js is transcribed by hand from a 930-line
 * prose document that keeps changing, and silent drift here means an editor is
 * told to type into a field that no longer exists.
 *
 * Parsing the field map IN A TEST is correct even though parsing it in the
 * exporter was rejected: a test that goes red on drift is a different thing
 * from a runtime that silently loses the footnotes the tables do not carry.
 *
 * The parser asserts a minimum row count per type BEFORE asserting row
 * contents. This repo has already been burned by a doc-parsing regex that
 * stopped matching and therefore stopped checking while every remaining
 * assertion passed — see tests/doc-counts.test.js's header for that history.
 */
import { describe, test, expect } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'
import { KARL_PANELS, KARL_NAV, KARL_FLAGS, panelsFor } from '../js/karl-blocks.js'
import { PAGE_TYPES } from '../build_scripts/schema.js'

const FIELD_MAP = fs.readFileSync(
  path.join(import.meta.dir, '..', 'docs', 'karl-export-field-map.md'),
  'utf8'
)

/** Heading each per-type table sits under, and the rows it must contain. */
const TYPE_HEADINGS = {
  Transaction: '## Transaction — E1, full block detail',
  Information: '## Information — E1, full block detail',
  'Resource Collection': '## Resource Collection — E1, full block detail',
  Campaign: '## Campaign — E1, full block detail',
  Topic: '## Topic — E1, full block detail',
  Agency: '## Agency — E1, captured 2026-08-15',
  'About us': '## About us — E1, captured 2026-08-15',
  Report: '## Report — E1, captured 2026-08-15',
}

/** Minimum row counts, measured 2026-08-16. A parser that stops matching
 *  reports zero rows, and these are what turn that into a failure. */
const MIN_ROWS = {
  Transaction: 16,
  Information: 8,
  'Resource Collection': 9,
  Campaign: 13,
  Topic: 6,
  Agency: 24,
  'About us': 4,
  Report: 7,
}

/**
 * Strip the markup the tables carry around labels and raw names: `↳` sub-row
 * markers, backticks, bold `**`, and the `*`/`\*` that marks a required field.
 * Comparing without this reports a difference in punctuation as a difference
 * in the mapping.
 * @param {string} cell
 * @returns {string}
 */
function normalize(cell) {
  return cell
    .replace(/↳/g, '')
    .replace(/\\?\*/g, '')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Pull the first markdown table under a heading, as arrays of normalized cells.
 * @param {string} heading
 * @returns {string[][]}
 */
function tableUnder(heading) {
  const start = FIELD_MAP.indexOf(heading)
  if (start === -1) throw new Error(`field map heading not found: ${heading}`)
  const lines = FIELD_MAP.slice(start).split('\n')
  const rows = []
  let inTable = false
  for (const line of lines) {
    const isRow = line.trimStart().startsWith('|')
    if (!isRow) {
      if (inTable) break
      continue
    }
    inTable = true
    if (/^\s*\|[\s|:-]+\|\s*$/.test(line)) continue // the ---|--- separator
    const cells = line.split('|').slice(1, -1).map(normalize)
    rows.push(cells)
  }
  return rows.slice(1) // drop the header row
}

describe('karl-blocks inventory against docs/karl-export-field-map.md', () => {
  test('covers exactly the eight types the schema declares', () => {
    expect(Object.keys(KARL_PANELS).sort()).toEqual([...PAGE_TYPES].sort())
  })

  test.each(Object.keys(TYPE_HEADINGS))('%s: parser finds the documented rows', (type) => {
    expect(tableUnder(TYPE_HEADINGS[type]).length).toBeGreaterThanOrEqual(MIN_ROWS[type])
  })

  test.each(Object.keys(TYPE_HEADINGS))('%s: every documented panel is transcribed', (type) => {
    const documented = tableUnder(TYPE_HEADINGS[type])
    const panels = panelsFor(type)
    expect(panels.length).toBe(documented.length)
    documented.forEach((row, index) => {
      const panel = panels[index]
      // Column 0 is the UI label, column 1 the raw name, column 3 repeatability.
      // Campaign's Top facts row carries two raw names joined by `+`; the
      // inventory keeps them joined so this compares like for like.
      expect(`${type}[${index}].uiLabel=${panel.uiLabel}`).toBe(
        `${type}[${index}].uiLabel=${row[0]}`
      )
      expect(`${type}[${index}].rawName=${panel.rawName}`).toBe(
        `${type}[${index}].rawName=${row[1]}`
      )
      expect(`${type}[${index}].repeatable=${panel.repeatable}`).toBe(
        `${type}[${index}].repeatable=${/repeatable/i.test(row[3])}`
      )
      expect(panel.order).toBe(index)
    })
  })

  test('every panel cites the field map line it came from', () => {
    const lineCount = FIELD_MAP.split('\n').length
    for (const panels of Object.values(KARL_PANELS)) {
      for (const panel of panels) {
        expect(panel.docLine).toBeGreaterThan(0)
        expect(panel.docLine).toBeLessThanOrEqual(lineCount)
      }
    }
  })

  test('the navigation path matches the documented "New: <Type>" form heading', () => {
    for (const type of PAGE_TYPES) {
      expect(KARL_NAV[type]).toBe(`New: ${type} → Content`)
    }
  })

  test('carries the footnote flags the tables do not', () => {
    // Half the mapping lives in prose under the tables, so these are the part a
    // table-driven transcription silently drops.
    expect(KARL_FLAGS.calloutHasNoTitle).toBe(true)
    expect(KARL_FLAGS.costDescriptionMaxChars).toBe(120)
    expect(KARL_FLAGS.bulletsFoldIntoText).toBe(true)
    expect(KARL_FLAGS.buttonLabelGuidanceChars).toBe(25)
    expect(KARL_FLAGS.buttonLabelMaxChars).toBe(255)
    expect(KARL_FLAGS.spotlightsAllowed).toEqual({ Agency: 2, Campaign: 2, Report: 1, Topic: 1 })
  })
})

describe('matchesSection', () => {
  test('component: null matches only a section carrying no component', () => {
    const { matchesSection } = require('../js/karl-blocks.js')
    expect(matchesSection({ component: null }, { heading: 'H' }, null)).toBe(true)
    expect(matchesSection({ component: null }, { heading: 'H', component: 'body' }, null)).toBe(
      false
    )
  })

  test('has and lacks are ANDed', () => {
    const { matchesSection } = require('../js/karl-blocks.js')
    const section = { heading: 'H', paragraphs: ['p'] }
    expect(matchesSection({ has: ['paragraphs'], lacks: ['cards'] }, section, null)).toBe(true)
    expect(matchesSection({ has: ['paragraphs', 'cards'] }, section, null)).toBe(false)
    expect(matchesSection({ lacks: ['paragraphs'] }, section, null)).toBe(false)
  })

  test('cardClass compares against the classification passed in, never re-derived', () => {
    const { matchesSection } = require('../js/karl-blocks.js')
    const section = { heading: 'H', cards: [{ title: 'T' }] }
    expect(matchesSection({ cardClass: 'title-only' }, section, 'title-only')).toBe(true)
    expect(matchesSection({ cardClass: 'title-only' }, section, 'inherits')).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun test tests/karl-blocks.test.js`
Expected: FAIL — `Cannot find module '../js/karl-blocks.js'`.

- [ ] **Step 3: Write the inventory**

Create `js/karl-blocks.js`. The header block and the machinery are given in full below; the eight inventories are a mechanical transcription of the field map's per-type tables, and the drift test above is what proves the transcription is complete and exact — it asserts row count, `uiLabel`, `rawName`, `repeatable` and `order` for every row of every table. Transcribe from these headings, in table order, one entry per row including rows whose Mockup source is `—`:

| Type | Field map heading | Table starts | Rows |
| ---- | ----------------- | ------------ | ---- |
| Transaction | `## Transaction — E1, full block detail` | line 295 | 16 |
| Information | `## Information — E1, full block detail` | line 346 | 8 |
| Resource Collection | `## Resource Collection — E1, full block detail` | line 377 | 9 |
| Campaign | `## Campaign — E1, full block detail` | line 415 | 13 |
| Topic | `## Topic — E1, full block detail` | line 469 | 6 |
| Agency | `## Agency — E1, captured 2026-08-15` | line 516 | 24 |
| About us | `## About us — E1, captured 2026-08-15` | line 573 | 4 |
| Report | `## Report — E1, captured 2026-08-15` | line 607 | 7 |

`docLine` is the 1-based line number of that row in `docs/karl-export-field-map.md`.

```js
/* The Karl CMS panel inventory: what an editor's form actually contains, per
   content type, in the order the form presents it.

   Transcribed by hand from docs/karl-export-field-map.md — the E1 record of
   each type's live add-page form — rather than parsed from it at runtime.
   Parsing was rejected because half the mapping is in prose FOOTNOTES under the
   tables (Callout has no title field; the cost description caps at 120
   characters; bullets fold into the Text block's rich text rather than
   becoming a block of their own), and a parser that reads only the tables
   loses exactly those and reports success. tests/karl-blocks.test.js parses the
   document instead, so drift goes red in CI without the runtime ever depending
   on the prose staying machine-readable.

   Dual-exported (window.karlBlocks plus module.exports) exactly like
   js/card-inheritance.js and js/review-merge.js: the browser panel and the Node
   CLI must share one inventory rather than two copies free to disagree about
   which field an editor is being sent to.

   Load-order dependency: none of its own — it imports nothing and reads no
   global. It must simply be evaluated before anything calls
   window.karlBlocks, which js/main.js lists it ahead of js/karl-transcript.js
   to guarantee. */

/**
 * A panel's mockup source, as a tagged union rather than a dotted path.
 *
 * The field map's "Mockup source" column is a PREDICATE on six of the eight
 * types — `section` with `component: 'supporting'`, `component: 'services'`
 * sections, `section with cards[]` — and a dotted path on Transaction's
 * scalars only. A path resolver would therefore cover one type and leave the
 * rest silently empty, which is the failure this whole feature exists to stop.
 *
 * - `{ kind: 'none' }` — the panel has no mockup source (`— (U6)`, `— unused`).
 *   It is still transcribed, because an editor filling a required field needs
 *   to be told the value comes from somewhere other than this tool.
 * - `{ kind: 'path', path }` — a dotted page path (`summary`, `whatToKnow.cost`).
 * - `{ kind: 'sections', match, field?, inferred? }` — every section matching
 *   `match`, optionally narrowed to one of its fields.
 *
 * `inferred: true` marks a mapping this repo derived rather than one the field
 * map documents. It exists for exactly one case today — a plain Transaction
 * body section reaching `custom_section` — and the transcript prints it as
 * inferred so an editor verifies rather than trusts it. See the panel's own
 * comment.
 */

/** @typedef {{component?: string|null, flat?: boolean, has?: string[], lacks?: string[], cardClass?: string}} Match */

/**
 * Whether one section satisfies a panel's match predicate. Every declared key
 * must hold; an absent key constrains nothing.
 *
 * `cardClass` is PASSED IN rather than derived here, so this module keeps its
 * "imports nothing, reads no global" property and the classification stays the
 * single one in js/card-inheritance.js. Re-deriving it here would be a second
 * copy of the rule that decides whether a card publishes its own words — the
 * exact drift that classifier exists to prevent.
 *
 * @param {Match} match
 * @param {object} section
 * @param {string|null} cardClass the js/card-inheritance.js classification
 * @returns {boolean}
 */
function matchesSection(match, section, cardClass) {
  if (!match || !section) return false
  if ('component' in match) {
    const actual = section.component ?? null
    if (actual !== match.component) return false
  }
  if ('flat' in match && Boolean(section.flat) !== match.flat) return false
  for (const field of match.has || []) {
    if (!section[field]) return false
  }
  for (const field of match.lacks || []) {
    if (section[field]) return false
  }
  if ('cardClass' in match && cardClass !== match.cardClass) return false
  return true
}

/**
 * The panel inventory for one content type, in the form's own order.
 * Returns an empty array for a type with no inventory rather than throwing —
 * the caller reports "no inventory for type X" as a transcript-level error,
 * which names the problem better than a stack trace would.
 * @param {string} type
 * @returns {object[]}
 */
function panelsFor(type) {
  return KARL_PANELS[type] || []
}
```

Then the flags, the navigation table, and the inventories. The flags:

```js
/**
 * The field map's footnotes, as explicit values. These are half the mapping and
 * none of them are in the tables, so a table-driven transcription drops them
 * silently — which is why they are asserted by name in tests/karl-blocks.test.js
 * rather than left to a reader to notice.
 */
const KARL_FLAGS = {
  // Every Karl Callout — Transaction what_to_do, Transaction section_specifics,
  // Information information_section — is a single rich text field with no title
  // (U2, field map line 829). A mockup callout.title therefore has no home.
  calloutHasNoTitle: true,
  // All five `cost` radio variants end at the same "Cost description" rich text
  // field, capped at 120 characters (field map line 317).
  costDescriptionMaxChars: 120,
  // "Bullets render inside the Text block's rich text, not as a separate block"
  // (field map line 334).
  bulletsFoldIntoText: true,
  // The Help Center's 25-character button rule is real editorial guidance; the
  // live field carries maxlength 255 (O14, field map line 871). Both are worth
  // reporting, and reporting only the schema limit loses the guidance.
  buttonLabelGuidanceChars: 25,
  buttonLabelMaxChars: 255,
  // Rendering/editorial caps, NOT schema ones — the forms accept more (field
  // map lines 264-282). Reported as guidance, never as a hard stop.
  spotlightsAllowed: { Agency: 2, Campaign: 2, Report: 1, Topic: 1 },
}

/**
 * The heading the add-page form carries once it opens, which is the first line
 * of every transcript. The path TO the form is
 * `Karl admin → Pages → [parent] → Add child page → "<Type>"`, or directly
 * `https://api.sf.gov/admin/pages/add/sf/<model>/2/` (field map lines 94-110);
 * everything after the form opens is what an editor actually follows.
 */
const KARL_NAV = {
  Transaction: 'New: Transaction → Content',
  Information: 'New: Information → Content',
  'Resource Collection': 'New: Resource Collection → Content',
  Campaign: 'New: Campaign → Content',
  Topic: 'New: Topic → Content',
  Agency: 'New: Agency → Content',
  'About us': 'New: About us → Content',
  Report: 'New: Report → Content',
}
```

The Transaction inventory, complete, as the worked example every other type follows:

```js
const KARL_PANELS = {
  Transaction: [
    {
      uiLabel: 'Page title',
      rawName: 'title',
      order: 0,
      required: true,
      repeatable: false,
      blockTypes: ['plain text'],
      source: { kind: 'path', path: 'title' },
      docLine: 297,
    },
    {
      uiLabel: 'Description',
      rawName: 'description',
      order: 1,
      required: false,
      repeatable: false,
      blockTypes: ['textarea'],
      source: { kind: 'path', path: 'summary' },
      docLine: 298,
    },
    {
      uiLabel: 'Primary agency',
      rawName: 'primary_agency',
      order: 2,
      required: true,
      repeatable: false,
      blockTypes: ['page chooser → Agency only'],
      // U6: the mockup has no primary_agency field, and this is required, so a
      // Transaction cannot be saved from mockup data alone. Emitted as an
      // explicit "you must supply this by hand" line rather than omitted.
      source: { kind: 'none' },
      docLine: 299,
    },
    {
      uiLabel: 'Cost',
      rawName: 'cost',
      order: 3,
      required: true,
      repeatable: false,
      blockTypes: ['struct, auto-inserted, no chooser'],
      source: { kind: 'path', path: 'whatToKnow.cost' },
      docLine: 300,
    },
    {
      uiLabel: 'Things to Know',
      rawName: 'things_to_know',
      order: 4,
      required: false,
      repeatable: true,
      blockTypes: ['title_and_text'],
      source: { kind: 'path', path: 'whatToKnow.thingsToKnow' },
      docLine: 301,
    },
    {
      uiLabel: 'What to Do',
      rawName: 'what_to_do',
      order: 5,
      required: false,
      repeatable: true,
      blockTypes: ['Callout', 'Section'],
      source: { kind: 'sections', match: { has: ['steps'] } },
      docLine: 302,
    },
    {
      uiLabel: 'Section title',
      rawName: 'section_title',
      order: 6,
      required: false,
      repeatable: false,
      blockTypes: ['plain text'],
      source: { kind: 'none' },
      docLine: 303,
    },
    {
      uiLabel: 'Section specifics',
      rawName: 'section_specifics',
      order: 7,
      required: false,
      repeatable: true,
      blockTypes: [
        'Address',
        'Callout',
        'Document',
        'Email',
        'Button link',
        'Phone number',
        'Text',
      ],
      source: { kind: 'none' },
      docLine: 304,
    },
    {
      uiLabel: 'Special cases',
      rawName: 'special_cases',
      order: 8,
      required: false,
      repeatable: false,
      blockTypes: ['plain text'],
      source: { kind: 'none' },
      docLine: 305,
    },
    {
      uiLabel: 'Accordion title and text',
      rawName: 'supporting_information',
      order: 9,
      required: false,
      repeatable: true,
      blockTypes: ['title_and_text'],
      source: { kind: 'sections', match: { component: 'supporting', flat: false } },
      docLine: 306,
    },
    {
      uiLabel: 'Custom Section',
      rawName: 'custom_section',
      order: 10,
      required: false,
      repeatable: true,
      blockTypes: ['title_and_text'],
      // TWO sources. The first is what the field map documents. The second is
      // INFERRED and covers 19 of Transaction's 47 sections: a plain body
      // section with no `component`, no steps and no cards. Transaction has no
      // generic body stream, and `custom_section` is its only repeatable
      // Title-and-text panel, so this is where such copy has to go — but the
      // field map claims the panel only for supporting/flat sections, so the
      // transcript prints the second as an inferred mapping the editor must
      // verify. Decided 2026-08-16; the alternative was exporting a fifth of
      // the heaviest type's body copy as "no Karl destination".
      source: [
        { kind: 'sections', match: { component: 'supporting', flat: true } },
        {
          kind: 'sections',
          match: { component: null, lacks: ['steps', 'cards'] },
          inferred: true,
        },
      ],
      docLine: 307,
    },
    {
      uiLabel: 'Related',
      rawName: 'related',
      order: 11,
      required: false,
      repeatable: true,
      blockTypes: ['page chooser, unrestricted'],
      source: { kind: 'sections', match: { cardClass: 'title-only' } },
      docLine: 308,
    },
    {
      uiLabel: 'Why is this Transaction Good for the Community?',
      rawName: 'good_for_community',
      order: 12,
      required: false,
      repeatable: true,
      blockTypes: ['Additional info'],
      source: { kind: 'none' },
      docLine: 309,
    },
    {
      uiLabel: 'Contact us',
      rawName: 'get_help',
      order: 13,
      required: false,
      repeatable: true,
      blockTypes: ['Address', 'Email', 'Phone number', 'Additional info'],
      source: { kind: 'path', path: 'contact' },
      docLine: 310,
    },
    {
      uiLabel: 'Partner agencies',
      rawName: 'partner_agencies',
      order: 14,
      required: false,
      repeatable: true,
      blockTypes: ['page chooser → Agency only'],
      source: { kind: 'path', path: 'partnerAgencies' },
      docLine: 311,
    },
    {
      uiLabel: 'Topics',
      rawName: 'topics',
      order: 15,
      required: false,
      repeatable: true,
      blockTypes: ['page chooser → Topic only'],
      source: { kind: 'none' },
      docLine: 312,
    },
    {
      uiLabel: 'Redirect this page to',
      rawName: 'redirect_url',
      order: 16,
      required: false,
      repeatable: false,
      blockTypes: ['plain text, disabled by design'],
      source: { kind: 'none' },
      docLine: 313,
    },
  ],
  // … the seven remaining types, transcribed the same way …
}
```

The seven remaining inventories, with the `source` for every panel that has one (all others are `{ kind: 'none' }`):

- **Information** (8 rows, doc lines 348-355): `title` ← `{path:'title'}`; `description` ← `{path:'summary'}`; `information_section` ← `[{kind:'sections', match:{lacks:['cards','steps']}}, {kind:'sections', match:{cardClass:'authored'}}]`; `partner_agencies` ← `{path:'partnerAgencies'}`; `related` ← `[{kind:'sections', match:{component:'related'}}, {kind:'sections', match:{cardClass:'title-only'}}]`.
- **Resource Collection** (9 rows, doc lines 379-387): `title`, `description` as above; `introductory_text` ← `{kind:'sections', match:{has:['paragraphs']}}`; `body` ← `{kind:'sections', match:{has:['cards']}}`; `topics`/`partner_agencies` ← `{path:'partnerAgencies'}` for the latter.
- **Campaign** (13 rows, doc lines 417-429): `title`; `spotlight_1` ← `{kind:'sections', match:{component:'spotlight'}}`; `spotlight_2` ← `{kind:'none'}` (both mockup spotlight sections feed `spotlight_1`'s emission, which reports the two-slot split as a note); `facts_title` + `fact_items` (one row, `rawName: 'facts_title + fact_items'`) ← `{kind:'sections', match:{component:'top-facts'}}`; `additional_content` ← `{kind:'sections', match:{component:'supporting'}}`; `related_links` ← `[{kind:'sections', match:{component:'related'}}, {kind:'sections', match:{cardClass:'title-only'}}]`; `contact` ← `{path:'contact'}`.
- **Topic** (6 rows, doc lines 471-476): `title`; `description` ← `{path:'summary'}`; `content_fields` ← `[{kind:'sections', match:{component:'services'}}, {kind:'sections', match:{component:'resources'}}, {kind:'sections', match:{component:'spotlight'}}]`; `partner_agencies` ← `{path:'partnerAgencies'}`.
- **Agency** (24 rows, doc lines 518-542): `title`; `description` ← `{path:'summary'}`; `services_title` ← `{kind:'sections', match:{component:'services'}, field:'heading'}`; `services` ← `{kind:'sections', match:{component:'services'}}`; `resources_title` ← `{kind:'sections', match:{component:'resources'}, field:'heading'}`; `resources` ← `{kind:'sections', match:{component:'resources'}}`; `about_description` ← `{kind:'sections', match:{component:'body'}}`; `partner_agencies` ← `{path:'partnerAgencies'}`; `contact` ← `{path:'contact'}`.
- **About us** (4 rows, doc lines 575-578): `title`; `about_info` ← `{kind:'sections', match:{lacks:['cards']}}`; `resources` ← `{kind:'sections', match:{component:'resources'}}`.
- **Report** (7 rows, doc lines 609-615): `title`; `date` ← `{path:'reportDate'}`; `spotlight` ← `{path:'spotlight'}`; `content` ← `{kind:'sections', match:{}}` (every section — `Body` for prose, `Table` for `table[][]`, and cards become inline hyperlinks in the Body per `U15`); `print_version` ← `{path:'printVersionUrl'}`; `partner_agencies` ← `{path:'partnerAgencies'}`.

Foot of the file:

```js
if (typeof window !== 'undefined') {
  window.karlBlocks = { KARL_PANELS, KARL_NAV, KARL_FLAGS, matchesSection, panelsFor }
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { KARL_PANELS, KARL_NAV, KARL_FLAGS, matchesSection, panelsFor }
}
```

- [ ] **Step 4: Run the drift test to verify it passes**

Run: `bun test tests/karl-blocks.test.js`
Expected: PASS. A failure naming a `uiLabel` or `rawName` mismatch is the transcription being wrong; fix the inventory, never the parser. A failure on the row COUNT means a row was skipped — commonly the `↳` sub-rows on Transaction, which are rows like any other.

- [ ] **Step 5: Wire the import**

In `js/main.js`, immediately after `import './card-inheritance.js'` and before `import './page-render.js'`:

```js
// The Karl panel inventory. Import-free and window-published like
// card-inheritance.js above it, so its only ordering requirement is being
// evaluated before js/karl-transcript.js reads window.karlBlocks.
import './karl-blocks.js'
```

- [ ] **Step 6: Update package.json and the three instruction files**

In `package.json`'s `test` script, add `tests/karl-blocks.test.js` at the end of the list.

In `CLAUDE.md`: change `45 unit-test files` to `46` on both lines (44 and 74), and add to the enumeration in the same sentence, after `karl-tag-meta`:

```
`karl-blocks` (the drift guard that parses `docs/karl-export-field-map.md`'s
per-type tables and asserts every transcribed panel row still matches on
`uiLabel`, `rawName` and `repeatable` — the inventory is hand-transcribed from a
930-line prose document, and silent drift means an editor is told to type into a
field that no longer exists; it asserts a MINIMUM row count per type first,
because a doc-parsing regex that stops matching does not fail, it stops checking)
```

In `AGENTS.md`: change `45` to `46` on lines 49 and 69, and mirror the same enumeration entry.

In `.github/copilot-instructions.md`: change `45 unit-test files` to `46` on line 45. Do **not** add an inventory or a summary there — it is a deliberate pointer file, and every summary it has ever carried rotted.

- [ ] **Step 7: Run the full suite**

Run: `bun run format && bun run format:check && bun run validate && bun run test`
Expected: all green. A `doc-counts` failure names exactly which of the three files still states the old number.

- [ ] **Step 8: Commit**

```bash
git add js/karl-blocks.js tests/karl-blocks.test.js js/main.js package.json CLAUDE.md AGENTS.md .github/copilot-instructions.md
git commit -m "feat: transcribe the Karl panel inventory with a doc-drift guard"
```

- [ ] **Step 9: Mutation-prove the guard**

Change `rawName: 'supporting_information'` to `'supporting_info'` in `js/karl-blocks.js`.
Run: `bun test tests/karl-blocks.test.js`
Expected: FAIL, naming `Transaction[9].rawName`.
Revert the change (`git checkout js/karl-blocks.js`) and re-run to confirm green. Do not commit the mutation.

---

## Task 3: The transcript builder

**Files:**

- Create: `js/karl-transcript.js`
- Create: `tests/karl-transcript.test.js`
- Modify: `js/main.js`, `package.json`, `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`

**Interfaces:**

- Consumes: `panelsFor`, `matchesSection`, `KARL_NAV`, `KARL_FLAGS` from Task 2; `classifySection` from `js/card-inheritance.js`; `getByPath` from `js/utils.js`.
- Produces, on `window.karlTranscript` and `module.exports`:
  - `buildTranscript(page, reviewRecord, pages)` → `Transcript`
  - `renderTranscriptMarkdown(transcript)` → `string`
  - `resolveValue(page, reviewRecord, path)` → `{ value: unknown, overlaid: boolean }`
  - `foldTextAndBullets(paragraphs, bullets)` → `string`
  - `extractInlineLinks(text, pages)` → `Array<{label, target, representation}>`
- `Transcript` shape:
  ```js
  {
    pageKey: string,
    type: string,
    navPath: string,
    decision: string,        // 'Needs review' when no record exists
    reviewed: boolean,       // false when there is no review record at all
    approved: boolean,       // decision === 'Approved'
    entries: Entry[],
    consumed: string[],      // every mockup path some entry emitted
    unmapped: Array<{ path: string, shape: string, reason: string }>,
    flags: Array<{ path: string, reason: string }>,
  }
  ```
- `Entry` shape:
  ```js
  {
    uiLabel: string,
    rawName: string,
    docLine: number,
    outcome: 'TYPE' | 'CHOOSE' | 'UNMAPPED' | 'FLAG',
    inferred: boolean,
    fields: Array<{ label: string, value: string }>,
    choices: Array<{ label: string, pageKey: string, slug: string }>,
    links: Array<{ label: string, target: string, representation: string }>,
    notes: string[],
    overlaid: boolean,
  }
  ```

- [ ] **Step 1: Write the failing tests**

Create `tests/karl-transcript.test.js`. Driven with hand-built pages, never the real corpus — for the reason `tests/card-inheritance.test.js` gives: driving from real content means a legitimately added page fails the suite.

```js
/*
 * The transcript builder, over hand-built pages.
 *
 * Deliberately NOT driven from the real corpus: this suite asserts what an
 * editor is told to type, and driving it from pages/*.js would mean a
 * legitimately added page fails the suite while proving nothing about the
 * rules. tests/card-inheritance.test.js is built the same way and for the same
 * reason.
 */
import { describe, test, expect } from 'bun:test'
import {
  buildTranscript,
  renderTranscriptMarkdown,
  resolveValue,
  foldTextAndBullets,
  extractInlineLinks,
} from '../js/karl-transcript.js'

/** A minimal page carrying only what the test under it needs. */
function page(overrides) {
  return {
    slug: 'apply-for-a-thing',
    type: 'Transaction',
    title: 'Apply for a thing',
    summary: 'How to apply.',
    audience: ['Tenants'],
    reading: 'Grade 6',
    sections: [],
    ...overrides,
  }
}

const PAGES = {
  target: { slug: 'target-page', type: 'Information', title: 'Target page', summary: 'Target summary.' },
}

describe('resolveValue — overlay precedence', () => {
  test('a section_edits entry beats the authored value', () => {
    const p = page({ sections: [{ heading: 'Old', karl: 'Custom section' }] })
    const record = { section_edits: { 'sections.0.heading': 'New' } }
    expect(resolveValue(p, record, 'sections.0.heading')).toEqual({ value: 'New', overlaid: true })
  })

  test('edited_title beats the authored title', () => {
    expect(resolveValue(page({}), { edited_title: 'Reviewed title' }, 'title')).toEqual({
      value: 'Reviewed title',
      overlaid: true,
    })
  })

  test('edited_summary beats the authored summary', () => {
    expect(resolveValue(page({}), { edited_summary: 'Reviewed summary.' }, 'summary')).toEqual({
      value: 'Reviewed summary.',
      overlaid: true,
    })
  })

  test('falls back to the authored value with no record at all', () => {
    expect(resolveValue(page({}), null, 'title')).toEqual({
      value: 'Apply for a thing',
      overlaid: false,
    })
  })

  test('a missing path returns undefined rather than throwing', () => {
    expect(() => resolveValue(page({}), null, 'sections.9.steps.4.title')).not.toThrow()
    expect(resolveValue(page({}), null, 'sections.9.steps.4.title').value).toBeUndefined()
  })

  test('an empty-string edit is honoured, not treated as absent', () => {
    // A reviewer clearing a field is a decision. `hasOwnProperty`, not
    // truthiness, is what distinguishes "cleared" from "never edited".
    const p = page({ sections: [{ heading: 'Old', karl: 'Custom section' }] })
    const record = { section_edits: { 'sections.0.heading': '' } }
    expect(resolveValue(p, record, 'sections.0.heading')).toEqual({ value: '', overlaid: true })
  })
})

describe('foldTextAndBullets', () => {
  test('bullets fold into the same rich text value as the paragraphs', () => {
    expect(foldTextAndBullets(['Intro line.'], ['One', 'Two'])).toBe(
      'Intro line.\n\n- One\n- Two'
    )
  })

  test('tagged unverified items contribute their text', () => {
    expect(foldTextAndBullets([{ text: 'Claim.', unverified: true }], [])).toBe('Claim.')
  })

  test('an absent bullets array is not an empty bullet', () => {
    expect(foldTextAndBullets(['Only prose.'], undefined)).toBe('Only prose.')
  })
})

describe('extractInlineLinks', () => {
  test('an internal page key reports the chooser representation', () => {
    expect(extractInlineLinks('See [the target](target).', PAGES)).toEqual([
      {
        label: 'the target',
        target: 'target',
        representation: 'shape 5 — rich text Link tool → Internal link → "Target page"',
      },
    ])
  })

  test('an http URL reports the external representation', () => {
    expect(extractInlineLinks('See [SF](https://sf.gov).', PAGES)).toEqual([
      {
        label: 'SF',
        target: 'https://sf.gov',
        representation: 'shape 5 — rich text Link tool → External link',
      },
    ])
  })

  test('the inert # sentinel reports as a dead link to fix', () => {
    expect(extractInlineLinks('See [nothing](#).', PAGES)[0].representation).toContain(
      'no destination'
    )
  })
})

describe('buildTranscript — the four outcomes', () => {
  test('an authored value is TYPE', () => {
    const t = buildTranscript(page({}), null, PAGES)
    const title = t.entries.find((e) => e.rawName === 'title')
    expect(title.outcome).toBe('TYPE')
    expect(title.fields).toEqual([{ label: 'Page title', value: 'Apply for a thing' }])
  })

  test('a title-only card is CHOOSE and emits NO description', () => {
    // The defect js/card-inheritance.js exists to prevent, here as an
    // instruction a human would execute. A Related entry publishes a title and
    // a link and nothing else.
    const p = page({
      sections: [
        {
          heading: 'Related',
          karl: 'Maps to the Related field (a generic unrestricted "Page" chooser).',
          cards: [{ title: 'Ignored label', text: 'Copy that can never publish.', target: 'target' }],
        },
      ],
    })
    const t = buildTranscript(p, null, PAGES)
    const related = t.entries.find((e) => e.rawName === 'related')
    expect(related.outcome).toBe('CHOOSE')
    expect(related.choices).toEqual([
      { label: 'Target page', pageKey: 'target', slug: 'target-page' },
    ])
    expect(JSON.stringify(related)).not.toContain('Copy that can never publish.')
  })

  test('an inheriting subsection is CHOOSE, and inherits the destination summary', () => {
    const p = page({
      type: 'Agency',
      sections: [
        {
          heading: 'Services',
          component: 'services',
          karl: 'Maps to an Agency services subsection (page chooser).',
          cards: [{ title: 'Anything', target: 'target' }],
        },
      ],
    })
    const t = buildTranscript(p, null, PAGES)
    const services = t.entries.find((e) => e.rawName === 'services')
    expect(services.outcome).toBe('CHOOSE')
    expect(services.notes.join(' ')).toContain('publishes the destination page')
  })

  test('an external-URL entry inside an inheriting subsection stays TYPE', () => {
    // Settled by the 332-page departments--* census: there is no destination
    // page to inherit from, so the description is authored on the entry.
    const p = page({
      type: 'Agency',
      sections: [
        {
          heading: 'Resources',
          component: 'resources',
          karl: 'Maps to an Agency resources subsection (page chooser).',
          cards: [{ title: 'State portal', url: 'https://ca.gov', text: 'Report a dead bird.' }],
        },
      ],
    })
    const t = buildTranscript(p, null, PAGES)
    const resources = t.entries.find((e) => e.rawName === 'resources')
    expect(resources.outcome).toBe('TYPE')
    expect(resources.fields).toContainEqual({ label: 'Description', value: 'Report a dead bird.' })
  })

  test('a section-level button outside a step is UNMAPPED', () => {
    const p = page({
      sections: [
        {
          heading: 'Look it up',
          karl: 'Custom section.',
          paragraphs: ['Prose.'],
          button: 'Search records',
          buttonUrl: 'https://sf.gov/search',
        },
      ],
    })
    const t = buildTranscript(p, null, PAGES)
    expect(t.unmapped).toContainEqual({
      path: 'sections.0.button',
      shape: 'transaction-section-button',
      reason:
        "U1 — Transaction's only Button link slot sits inside a what_to_do Section; this button sits outside any step and has no documented Karl destination.",
    })
  })

  test('a callout title is FLAG, never folded silently', () => {
    const p = page({
      sections: [
        {
          heading: 'Note',
          karl: 'Custom section.',
          paragraphs: ['Prose.'],
          callout: { text: 'Body of the callout.', title: 'Heads up' },
        },
      ],
    })
    const t = buildTranscript(p, null, PAGES)
    expect(t.flags).toContainEqual({
      path: 'sections.0.callout.title',
      reason:
        'U2 — every Karl Callout is a single rich text field with no title. Fold this into the rich text as a bolded lead-in, or get a field added. Folding it is a content judgement this tool does not make.',
    })
  })
})

describe('buildTranscript — the cost cap', () => {
  test('a cost description over 120 characters is FLAG, carrying the measured length', () => {
    const long = 'x'.repeat(121)
    const t = buildTranscript(page({ whatToKnow: { cost: long } }), null, PAGES)
    const cost = t.entries.find((e) => e.rawName === 'cost')
    expect(cost.outcome).toBe('FLAG')
    expect(cost.notes.join(' ')).toContain('121 characters')
    expect(cost.notes.join(' ')).toContain('120')
  })

  test('the cap measures the OVERLAID value, not the original', () => {
    // A reviewer can push a short authored value over the cap, and can pull a
    // long one under it. Measuring the original reports the wrong page both ways.
    const record = { section_edits: { 'whatToKnow.cost': 'y'.repeat(200) } }
    const t = buildTranscript(page({ whatToKnow: { cost: 'Free.' } }), record, PAGES)
    expect(t.entries.find((e) => e.rawName === 'cost').outcome).toBe('FLAG')

    const trimmed = { section_edits: { 'whatToKnow.cost': 'Free.' } }
    const t2 = buildTranscript(page({ whatToKnow: { cost: 'z'.repeat(200) } }), trimmed, PAGES)
    expect(t2.entries.find((e) => e.rawName === 'cost').outcome).toBe('TYPE')
  })
})

describe('buildTranscript — review decision', () => {
  test('a page with no review record is marked, not silently exported', () => {
    const t = buildTranscript(page({}), null, PAGES)
    expect(t.reviewed).toBe(false)
    expect(t.approved).toBe(false)
    expect(renderTranscriptMarkdown(t)).toContain('no review recorded')
  })

  test('a not-Approved page is marked throughout, not only in the header', () => {
    const t = buildTranscript(page({}), { decision: 'Revise and resubmit' }, PAGES)
    const markdown = renderTranscriptMarkdown(t)
    expect(markdown).toContain('Revise and resubmit')
    expect(markdown).toContain('NOT APPROVED')
    // Approval is per page, not per field, so every panel carries the caveat.
    const typeHeadings = markdown.match(/^### .*\[TYPE\]/gm) || []
    expect(typeHeadings.length).toBeGreaterThan(0)
    for (const heading of typeHeadings) expect(heading).toContain('page not approved')
  })

  test('an Approved page carries no caveat', () => {
    const markdown = renderTranscriptMarkdown(
      buildTranscript(page({}), { decision: 'Approved' }, PAGES)
    )
    expect(markdown).not.toContain('NOT APPROVED')
  })
})

describe('buildTranscript — inferred mappings and unknown classification', () => {
  test('a plain Transaction body section reaches custom_section, marked inferred', () => {
    const p = page({
      sections: [{ heading: 'What you need', karl: 'Custom section.', paragraphs: ['Bring ID.'] }],
    })
    const entry = buildTranscript(p, null, PAGES).entries.find(
      (e) => e.rawName === 'custom_section'
    )
    expect(entry.outcome).toBe('TYPE')
    expect(entry.inferred).toBe(true)
    expect(entry.notes.join(' ')).toContain('Inferred mapping')
  })

  test('a card section the classifier cannot place is FLAG, never a guessed TYPE', () => {
    // classifySection returns 'unknown' for most karl notes. Guessing TYPE here
    // would reintroduce the exact defect js/card-inheritance.js prevents — as an
    // instruction a human executes.
    const p = page({
      sections: [
        {
          heading: 'Mystery',
          component: 'supporting',
          karl: 'Maps to supporting_information (Accordions).',
          cards: [{ title: 'A card', text: 'Some words.' }],
        },
      ],
    })
    const t = buildTranscript(p, null, PAGES)
    expect(t.flags.some((f) => f.path === 'sections.0.cards' && /unknown/i.test(f.reason))).toBe(
      true
    )
  })
})

describe('renderTranscriptMarkdown', () => {
  test('heads the file with the Karl navigation path and the page decision', () => {
    const markdown = renderTranscriptMarkdown(
      buildTranscript(page({}), { decision: 'Approved' }, PAGES)
    )
    expect(markdown.split('\n')[0]).toBe('# Apply for a thing — Karl transcript')
    expect(markdown).toContain('New: Transaction → Content')
    expect(markdown).toContain('Decision: Approved')
  })

  test('emits panels in the form’s own order', () => {
    const markdown = renderTranscriptMarkdown(buildTranscript(page({}), null, PAGES))
    expect(markdown.indexOf('`title`')).toBeLessThan(markdown.indexOf('`description`'))
    expect(markdown.indexOf('`description`')).toBeLessThan(markdown.indexOf('`related`'))
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun test tests/karl-transcript.test.js`
Expected: FAIL — `Cannot find module '../js/karl-transcript.js'`.

- [ ] **Step 3: Implement the builder**

Create `js/karl-transcript.js`. Header, then the pieces below.

```js
/* The Karl transcript builder: turning one reviewed mockup page into a
   field-by-field instruction an editor follows in Karl's own form order.

   Pure. It takes a page object, a review record and the page corpus, and
   returns data; it touches no filesystem, no DOM and no global state, so the
   Node CLI (build_scripts/export-karl-transcript.js) and the browser panel
   (js/karl-transcript-panel.js) share exactly one set of judgements about what
   an editor is told. Every such judgement lives here and only here.

   Dual-exported (window.karlTranscript plus module.exports) like
   js/review-merge.js and js/standards/plain-language.js.

   Load-order dependency: reads window.karlBlocks, window.cardInheritance and
   window.utils in the browser branch, so js/main.js must list it after
   js/karl-blocks.js, js/card-inheritance.js and js/utils.js. Under Node it
   require()s all three directly. */

// Resolved the same way js/inline-content-edit-data.js resolves its helpers:
// require() under Node (where these files are CommonJS-compatible), the window
// namespaces in the browser (where this file is a plain script in the bundle
// rather than an ES importer). Dual-export files in this repo take no imports.
const isNode = typeof module !== 'undefined' && module.exports
const { panelsFor, matchesSection, KARL_NAV, KARL_FLAGS } = isNode
  ? require('./karl-blocks.js')
  : window.karlBlocks
const { classifySection } = isNode ? require('./card-inheritance.js') : window.cardInheritance
const { getByPath } = isNode ? require('./utils.js') : window.utils
```

`resolveValue` — the precedence that is the point of the feature:

```js
/**
 * The value an editor should type at `path`: the reviewer's edit if there is
 * one, else the authored value from pages/*.js.
 *
 * `hasOwnProperty` rather than truthiness, because a reviewer clearing a field
 * to the empty string is a decision and must survive as one. Falling back on
 * falsiness would silently resurrect the copy they deleted.
 *
 * edited_title/edited_summary are checked separately because those two live at
 * the top of the review record rather than in section_edits — the split
 * predates inline editing (see js/inline-content-edit-data.js's header).
 *
 * @param {object} page
 * @param {object|null|undefined} reviewRecord
 * @param {string} path a dotted page path
 * @returns {{value: unknown, overlaid: boolean}}
 */
function resolveValue(page, reviewRecord, path) {
  const edits = reviewRecord && reviewRecord.section_edits
  if (edits && Object.prototype.hasOwnProperty.call(edits, path)) {
    return { value: edits[path], overlaid: true }
  }
  if (path === 'title' && reviewRecord && reviewRecord.edited_title) {
    return { value: reviewRecord.edited_title, overlaid: true }
  }
  if (path === 'summary' && reviewRecord && reviewRecord.edited_summary) {
    return { value: reviewRecord.edited_summary, overlaid: true }
  }
  return { value: getByPath(page, path), overlaid: false }
}
```

`foldTextAndBullets` — hard case 3:

```js
/**
 * One rich-text value from a section's paragraphs and bullets.
 *
 * Karl's Text block renders bullets INSIDE its own rich text rather than as a
 * sibling block (field map line 334), so emitting them as two panels would tell
 * an editor to create a block that does not exist. Document order is paragraphs
 * then bullets, matching how js/page-render.js paints them.
 *
 * Items may be plain strings or the tagged {text, unverified} objects the
 * Unverified pill renders; only the text reaches Karl.
 * @param {Array<string|{text: string}>|undefined} paragraphs
 * @param {Array<string|{text: string}>|undefined} bullets
 * @returns {string}
 */
function foldTextAndBullets(paragraphs, bullets) {
  const prose = (paragraphs || []).map(itemText).filter(Boolean)
  const list = (bullets || []).map(itemText).filter(Boolean)
  const parts = []
  if (prose.length) parts.push(prose.join('\n\n'))
  if (list.length) parts.push(list.map((item) => `- ${item}`).join('\n'))
  return parts.join('\n\n')
}

/**
 * The text of one body-copy item, which may be a plain string or the tagged
 * {text, unverified?, unverifiedReason?} object.
 * @param {unknown} item
 * @returns {string}
 */
function itemText(item) {
  if (typeof item === 'string') return item
  if (item && typeof item === 'object' && typeof item.text === 'string') return item.text
  return ''
}
```

`extractInlineLinks` — hard case 4:

```js
/**
 * The inline `[label](target)` links inside one rich-text value, each with the
 * Karl representation an editor must use to recreate it.
 *
 * Karl has five distinct link representations (field map lines 178-184) and an
 * internal link is a chooser, not text — so pasting a markdown link produces a
 * dead literal on the published page. Surfacing them separately is what stops
 * that, and naming the representation is what makes the instruction followable.
 * @param {string} text
 * @param {Record<string, object>} pages the corpus, for resolving a page key
 * @returns {Array<{label: string, target: string, representation: string}>}
 */
function extractInlineLinks(text, pages) {
  const links = []
  for (const match of String(text || '').matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
    const [, label, target] = match
    links.push({ label, target, representation: linkRepresentation(target, pages) })
  }
  return links
}

/**
 * Which of Karl's link shapes a target needs.
 * @param {string} target
 * @param {Record<string, object>} pages
 * @returns {string}
 */
function linkRepresentation(target, pages) {
  if (target === '#') {
    return 'no destination — the mockup uses `#` as an inert sentinel; resolve it before typing'
  }
  if (/^https?:\/\//.test(target)) return 'shape 5 — rich text Link tool → External link'
  const destination = pages && pages[target]
  if (destination) {
    return `shape 5 — rich text Link tool → Internal link → "${destination.title}"`
  }
  return 'unresolved target — neither a page key in this corpus nor an http(s) URL'
}
```

`buildTranscript` — the walk. Structure it as: resolve the inventory, walk panels in `order`, dispatch each panel's `source` (normalizing a single source to a one-element array), record every mockup path an emission consumed, then sweep the page for populated content paths nothing consumed and for the known FLAG classes. The dispatch rules, each already settled elsewhere and none re-decided here:

1. **`{ kind: 'none' }`** — emit an entry with `outcome: 'TYPE'` and a single note naming why there is no mockup value (`U6` for `primary_agency`, "not used by this page" otherwise). Skip entirely when the panel is optional and has no source, so the transcript does not run to 24 empty panels on Agency; keep it when `required` is true, because an editor cannot save without it.
2. **`{ kind: 'path' }`** — `resolveValue`, then emit by value shape: a string becomes one `fields` entry; `whatToKnow.thingsToKnow` becomes one repeated block per item (Title + Text); `contact` and `spotlight` become their sub-streams; `partnerAgencies` becomes `CHOOSE` (a page chooser restricted to Agency pages).
3. **`{ kind: 'sections' }`** — every section matching `match`, in document order, classified once with `classifySection(section)` and passed to `matchesSection`. For each matched section:
   - `cardClass` `inherits` or `title-only` → `CHOOSE`, listing `{label, pageKey, slug}` per card that carries a `target`; for `inherits`, add the note `publishes the destination page's title and summary`; for `title-only`, `publishes the destination page's title and a link, and nothing else`. **Never emit `card.text`** for either.
   - a card carrying `url` and no `target` inside an `inherits` section → `TYPE` with `Title` / `URL` / `Description` fields (the external-entry asymmetry).
   - a card carrying `url` inside a `title-only` section → `TYPE` with `Title` / `URL` only, plus a FLAG if it carries `text`, because that component renders no description for any entry.
   - `cardClass` `unknown` on a card-bearing section → `FLAG` on `sections.N.cards`, reason naming the section's `karl` note and that the classifier could not place it. Never a guessed TYPE or CHOOSE.
   - otherwise → `TYPE`, value `foldTextAndBullets(section.paragraphs, section.bullets)`, with `heading` as the block's Title, `section.table` emitted as a Table block on Report and as a FLAG elsewhere (Report is the only Karl type with tables), and `section.steps` expanded into one `Section` block per step whose `section_specifics` lists `Text`, `Button link` and `Callout` siblings.
   - on Report, a card-bearing section → `TYPE` routed through the inline-link machinery: each card becomes a hyperlink inside the Body rich text (`U15`), with the representation named. Not `CHOOSE` — Report has no page-card block to choose from.
4. After every panel: `sections.N.button`/`buttonUrl` outside a step → push to `unmapped` with `shape: 'transaction-section-button'` (`U1`); `callout.title` (when not the literal `false`) → push to `flags` (`U2`); a resolved `whatToKnow.cost` longer than `KARL_FLAGS.costDescriptionMaxChars` → the `cost` entry's outcome becomes `FLAG`, note carrying the measured length and the cap; a button label longer than `KARL_FLAGS.buttonLabelGuidanceChars` → a note, not a FLAG, since the guidance is not enforced by the form.
5. **Fields with no `EDITABLE_FIELD_SHAPES` entry carry no overlay** — `facts[]`, `partnerAgencies[]`, `contact.*` sub-arrays, `spotlight.button*`. Emit the authored value and add the note `no reviewer overlay is possible for this field — printed as authored`. Implying it was reviewed when the tool cannot record a review of it is the one thing this output must not do.

`renderTranscriptMarkdown` — the output shape, one `###` heading per entry:

```markdown
# Apply for a thing — Karl transcript

**Karl path:** New: Transaction → Content
**Decision:** Approved (reviewed 2026-08-16 by D. Arrizon)
**Page key:** `applyThing` · **Slug:** `apply-for-a-thing`

> Every keystroke below is yours to make. This file is an export, not an
> approval, and nothing here has been written to Karl.

### Page title — `title` [TYPE]

Page title: Apply for a thing

### Custom Section — `custom_section` [TYPE]

⚠ Inferred mapping — the field map documents this panel only for
supporting/flat sections. Verify before saving.

Title: What you will need
Text:
Bring photo ID and your case number.

- Proof of address
- Inspection notice

### Related — `related` [CHOOSE]

Publishes the destination page's title and a link, and nothing else — type no
description.

1. Choose page: "Target page" (`target` → /target-page)

### Section button — `sections[1].button` [UNMAPPED]

U1 — Transaction's only Button link slot sits inside a what_to_do Section.
Value: "Search records" → https://sf.gov/search
```

When `approved` is false, append ` — page not approved` to every `###` heading and put a `**NOT APPROVED — do not publish from this transcript.**` line under the header. When `reviewed` is false, the decision line reads `**Decision:** no review recorded`.

Foot of the file: the standard dual-export block publishing `buildTranscript`, `renderTranscriptMarkdown`, `resolveValue`, `foldTextAndBullets`, `extractInlineLinks` on `window.karlTranscript` and `module.exports`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test tests/karl-transcript.test.js`
Expected: PASS, all cases.

- [ ] **Step 5: Wire the import**

In `js/main.js`, immediately after `import './karl-blocks.js'`:

```js
// Reads window.karlBlocks above it, plus window.cardInheritance and
// window.utils. Pure and DOM-free; the workspace panel is what mounts a UI on
// top of it.
import './karl-transcript.js'
```

`js/card-inheritance.js` already sits above this line and `js/utils.js` is the first core import, so both namespaces exist by the time this evaluates.

- [ ] **Step 6: package.json and the three instruction files**

Add `tests/karl-transcript.test.js` to the `test` script. Bump `46` → `47` in CLAUDE.md (lines 44, 74), AGENTS.md (lines 49, 69) and `.github/copilot-instructions.md` (line 45). Add to CLAUDE.md's enumeration, after the `karl-blocks` entry:

```
`karl-transcript` (the pure builder, driven with hand-built pages rather than
the real corpus — like `card-inheritance`, so a legitimately added page never
fails the suite. It pins overlay precedence including the cleared-to-empty case,
that a `title-only` card emits a page choice and never a description, that
bullets fold into the paragraph value rather than becoming a block, that an
inline `[label](pageKey)` link surfaces separately with its Karl representation
named, and that the 120-character `cost` cap measures the OVERLAID value — a
reviewer can push a short authored value over the cap and pull a long one under
it, so measuring the original reports the wrong page in both directions)
```

- [ ] **Step 7: Full suite**

Run: `bun run format && bun run format:check && bun run validate && bun run test`
Expected: green.

- [ ] **Step 8: Commit**

```bash
git add js/karl-transcript.js tests/karl-transcript.test.js js/main.js package.json CLAUDE.md AGENTS.md .github/copilot-instructions.md
git commit -m "feat: build a paste-ready Karl transcript from a reviewed page"
```

- [ ] **Step 9: Mutation-prove the classifier reuse**

In `js/karl-transcript.js`, make the `title-only` branch emit `card.text` as a `Description` field alongside the choice.
Run: `bun test tests/karl-transcript.test.js`
Expected: FAIL on `a title-only card is CHOOSE and emits NO description`.
Revert (`git checkout js/karl-transcript.js`), re-run, confirm green. Do not commit the mutation.

---

## Task 4: The CLI exporter

**Files:**

- Create: `build_scripts/export-karl-transcript.js`
- Modify: `package.json` (the `export:karl` script)

**Interfaces:**

- Consumes: `buildTranscript`, `renderTranscriptMarkdown` (Task 3); `loadPageData` from `build_scripts/load-pages.js`.
- Produces: `review/karl-transcripts/<pageKey>.md`, one per page.

- [ ] **Step 1: Write the script**

```js
// Write one paste-ready Karl transcript per page into review/karl-transcripts/.
//
// A thin CLI over js/karl-transcript.js — every judgement about what an editor
// is told lives there, so this file only loads the corpus, renders, and writes.
//
// It takes NO review state. The browser holds that in localStorage and this
// process cannot reach it, so a CLI transcript prints the authored copy and
// says so; the workspace panel is the path that carries a reviewer's edits.
// Printing the authored copy while implying it was reviewed is the one outcome
// worth failing to avoid.
const fs = require('fs')
const path = require('path')
const { loadPageData, root } = require('./load-pages')
const { buildTranscript, renderTranscriptMarkdown } = require('../js/karl-transcript.js')

const OUT_DIR = path.join(root, 'review', 'karl-transcripts')

const data = loadPageData()
const pages = data.pages

// Build EVERY transcript before writing ANY of them. A half-written directory
// is worse than none: an editor opening it cannot tell a fresh file from one
// left over from the last run, and the stale one still reads as an instruction.
const rendered = []
const failures = []
for (const [pageKey, page] of Object.entries(pages)) {
  try {
    const transcript = buildTranscript(page, null, pages)
    rendered.push({ pageKey, markdown: renderTranscriptMarkdown(transcript) })
  } catch (error) {
    failures.push(`${pageKey}: ${error.message}`)
  }
}

if (failures.length) {
  console.error('No transcripts written — these pages failed to build:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

fs.mkdirSync(OUT_DIR, { recursive: true })
for (const { pageKey, markdown } of rendered) {
  fs.writeFileSync(path.join(OUT_DIR, `${pageKey}.md`), markdown, 'utf8')
}
console.log('wrote', rendered.length, 'Karl transcripts to review/karl-transcripts/')
```

- [ ] **Step 2: Add the script entry**

In `package.json`, after the `export` pair:

```json
    "// export:karl": "Writes one paste-ready Karl transcript per page into review/karl-transcripts/ — what an editor types, field by field, in Karl's own form order. Builds every page in memory and writes only if all succeeded, so a failure leaves no half-written directory. Reads no review state (that lives in the browser); the workspace panel is the path that carries a reviewer's edits. Manual, not part of the build or CI.",
    "export:karl": "bun build_scripts/export-karl-transcript.js",
```

- [ ] **Step 3: Run it**

Run: `bun run export:karl`
Expected: `wrote 29 Karl transcripts to review/karl-transcripts/`.
Then read one to confirm it is followable:
Run: `head -40 review/karl-transcripts/payFee.md`
Expected: the `# … — Karl transcript` heading, `New: Transaction → Content`, `Decision: no review recorded`, then panels in form order.

- [ ] **Step 4: Confirm the output does not trip the lint gate**

`review/` is listed in `.prettierignore`, so generated markdown there is not formatted or checked. Confirm rather than assume:
Run: `bun run format:check`
Expected: PASS. If it reports files under `review/karl-transcripts/`, add that directory to `.prettierignore` in this commit and re-run.

- [ ] **Step 5: Decide whether the output is committed**

It is generated. Add `review/karl-transcripts/` to `.gitignore` with a comment matching the file's voice:

```gitignore
# Generated by `bun run export:karl` from pages/*.js and the Karl panel
# inventory — never hand-edited, and stale the moment page copy changes. The
# reviewer-facing path is the workspace panel, which renders the same
# transcript with the reviewer's own edits applied; this directory is the
# whole-corpus snapshot for someone working offline from a checkout.
/review/karl-transcripts/
```

- [ ] **Step 6: Commit**

```bash
bun run format
git add build_scripts/export-karl-transcript.js package.json .gitignore
git commit -m "feat: add bun run export:karl, writing one transcript per page"
```

---

## Task 5: The validate ratchet

Content authored with no Karl destination is exactly what this tool exists to catch. Today it is noticed; after this task it fails the build.

**Files:**

- Modify: `js/karl-blocks.js` (the `UNRESOLVED` table)
- Modify: `build_scripts/data-checks.js` (`findUnmappedSections`)
- Modify: `build_scripts/validate.js` (wiring)
- Modify: `tests/data-validation.test.js`
- Modify: `docs/karl-export-field-map.md` (one new register row)

**Interfaces:**

- Consumes: `buildTranscript` (Task 3), `panelsFor`/`matchesSection` (Task 2).
- Produces: `findUnmappedSections(pages, unresolved)` → `Array<{pageKey, path, shape, reason}>`, and `UNRESOLVED` on `window.karlBlocks`/`module.exports`.

- [ ] **Step 1: Measure the real corpus first**

Before writing a single rule, see what the check actually finds. Write a throwaway script (do not commit it):

```js
// scratch: what does the transcript leave unmapped across the real corpus?
const { loadPageData } = require('./build_scripts/load-pages.js')
const { buildTranscript } = require('./js/karl-transcript.js')
const pages = loadPageData().pages
const byShape = {}
for (const [pageKey, page] of Object.entries(pages)) {
  for (const finding of buildTranscript(page, null, pages).unmapped) {
    ;(byShape[finding.shape] ||= []).push(`${pageKey}.${finding.path}`)
  }
}
for (const [shape, where] of Object.entries(byShape)) {
  console.log(where.length, shape, where.slice(0, 6).join(' '))
}
```

Run it. **Expected, measured 2026-08-16:** exactly three shapes —

| Shape | Count | Where |
| ----- | ----- | ----- |
| `transaction-section-button` | 5 | `inspectorLookup.1`, `findRecords.1`, `findHotelRecords.1`, `findViolations.1`, `publicRecords.1` |
| `information-steps` | 1 | `afterReport.0` |
| `topic-related` | 1 | `healthyHousingTopic.4` |
| `agency-subsection-paragraphs` | 3 | `pestsTopic.0`, `pestsTopic.1`, `pestsTopic.2` |

If your run reports a shape not in this table, the transcript's dispatch is placing something differently from the design — fix Task 3 before writing a rule that papers over it. If it reports MORE of a listed shape, page content has changed since the measurement; note the new count in the commit body.

- [ ] **Step 2: Write the failing test**

Append to `tests/data-validation.test.js`:

```js
describe('findUnmappedSections', () => {
  const UNRESOLVED_FIXTURE = [
    {
      id: 'U1',
      shape: 'transaction-section-button',
      docLine: 828,
      reason: 'Section-level buttons outside a step have no documented Karl slot.',
    },
  ]

  test('a known unmapped shape passes', () => {
    const pages = {
      p: {
        slug: 'p',
        type: 'Transaction',
        title: 'P',
        summary: 'S',
        audience: ['T'],
        reading: 'Grade 6',
        sections: [
          { heading: 'H', karl: 'Custom section.', paragraphs: ['x'], button: 'B', buttonUrl: 'https://sf.gov' },
        ],
      },
    }
    expect(findUnmappedSections(pages, UNRESOLVED_FIXTURE)).toEqual([])
  })

  test('an unmapped shape with no rule fails', () => {
    // The ratchet: a NEW class of unmappable content must stop the build, which
    // is the difference between this and the report `bun run audit-cards` is.
    const pages = {
      p: {
        slug: 'p',
        type: 'Transaction',
        title: 'P',
        summary: 'S',
        audience: ['T'],
        reading: 'Grade 6',
        sections: [
          { heading: 'H', karl: 'Custom section.', paragraphs: ['x'], button: 'B', buttonUrl: 'https://sf.gov' },
        ],
      },
    }
    expect(findUnmappedSections(pages, []).map((f) => f.shape)).toEqual([
      'transaction-section-button',
    ])
  })

  test('exemption is by SHAPE, never by page key or index', () => {
    // A path allowlist would let a NEWLY AUTHORED section inherit an old
    // exemption just by landing at the same index — exactly the case this check
    // exists to catch. Two different pages, same shape, both exempt; a
    // different shape at the same path is not.
    const section = { heading: 'H', karl: 'Custom section.', paragraphs: ['x'] }
    const base = { slug: 's', type: 'Transaction', title: 'T', summary: 'S', audience: ['T'], reading: 'Grade 6' }
    const pages = {
      a: { ...base, sections: [{ ...section, button: 'B', buttonUrl: 'https://sf.gov' }] },
      b: { ...base, sections: [{ ...section, button: 'C', buttonUrl: 'https://sf.gov' }] },
    }
    expect(findUnmappedSections(pages, UNRESOLVED_FIXTURE)).toEqual([])
  })

  test('the real corpus is fully covered', () => {
    // The ratchet's resting state. A failure here names content authored with
    // no Karl destination — decide the destination or open a register entry;
    // do not widen a rule to make it green.
    const { loadPageData } = require('../build_scripts/load-pages.js')
    const { UNRESOLVED } = require('../js/karl-blocks.js')
    expect(findUnmappedSections(loadPageData().pages, UNRESOLVED)).toEqual([])
  })
})
```

Add `findUnmappedSections` to that file's import from `../build_scripts/data-checks.js`.

- [ ] **Step 3: Run it to verify it fails**

Run: `bun test tests/data-validation.test.js`
Expected: FAIL — `findUnmappedSections is not a function`.

- [ ] **Step 4: Add the `UNRESOLVED` table to `js/karl-blocks.js`**

```js
/**
 * The unresolved register, as SHAPE RULES rather than as a list of page keys.
 *
 * A path allowlist was rejected: it would let a newly authored section inherit
 * an old exemption just by landing at the same index, which is precisely the
 * case the ratchet exists to catch. Closing a register entry upstream therefore
 * means deleting its rule here, and every section it covered fails until it is
 * mapped — which is the behaviour wanted, since a closed register entry means a
 * destination now exists.
 *
 * `docLine` cites the row in docs/karl-export-field-map.md's "Unresolved
 * register" that documents the decision this rule defers to.
 */
const UNRESOLVED = [
  {
    id: 'U1',
    shape: 'transaction-section-button',
    docLine: 828,
    reason:
      "Section-level buttons outside a step. Transaction's only Button link slot sits inside a what_to_do Section, and Report's only inside the Spotlight. Blocked on a Digital Services decision.",
  },
  {
    id: 'U3',
    shape: 'information-steps',
    docLine: 830,
    reason:
      'Steps on an Information page. Information has no what_to_do-style container. Karl’s Step by step type fits the steps exactly but has no cost and no things_to_know, so retyping would drop whatToKnow entirely. Blocked on a content decision.',
  },
  {
    id: 'U5',
    shape: 'topic-related',
    docLine: 832,
    reason:
      'A Related panel on a Topic page. Topic has no `related` field, confirmed at E1. Either the panel moves into content_fields as a Resources block, or the page drops it. Blocked on a content decision.',
  },
  {
    id: 'U20',
    shape: 'agency-subsection-paragraphs',
    docLine: 833,
    reason:
      "Intro paragraphs on an Agency Services/Resources section. The Subsection carries a single optional Title and a links list — there is no description field, so the paragraph has nowhere to go. Same shape as U4 (Topic Services/Resources), measured separately on Agency. Blocked on the same Digital Services decision.",
  },
]
```

Add `UNRESOLVED` to both export objects. Update `tests/karl-blocks.test.js` with one assertion that every entry carries an `id`, a `shape`, a `reason` and a `docLine` inside the document — and that the shapes are unique, since a duplicate would make one rule dead.

- [ ] **Step 5: Add `findUnmappedSections` to `build_scripts/data-checks.js`**

```js
/**
 * Find page content that resolves to no documented Karl destination and is not
 * covered by a known unresolved-register rule.
 *
 * This is the ratchet the transcript export buys. `bun run audit-cards` is a
 * report because a card's description is a per-card content judgement; this is
 * a gate because "there is nowhere in the CMS for this to go" is a structural
 * fact about the content, and noticing it after a manager approves the copy is
 * too late.
 *
 * Rules match by SHAPE, never by page key or section index — see the UNRESOLVED
 * table in js/karl-blocks.js for why a path allowlist was rejected.
 *
 * @param {Record<string, object>} pages
 * @param {Array<{id: string, shape: string, reason: string}>} unresolved
 * @returns {Array<{pageKey: string, path: string, shape: string, reason: string}>}
 */
function findUnmappedSections(pages, unresolved) {
  const known = new Set((unresolved || []).map((rule) => rule.shape))
  const findings = []
  for (const [pageKey, page] of Object.entries(pages)) {
    for (const finding of buildTranscript(page, null, pages).unmapped) {
      if (known.has(finding.shape)) continue
      findings.push({ pageKey, ...finding })
    }
  }
  return findings
}
```

Add `const { buildTranscript } = require('../js/karl-transcript.js')` beside the existing `js/utils.js` and `js/inline-link-target.js` requires, with a comment noting it is the same CJS-requires-ESM-shaped crossing those two already make and is safe for the same reason: `js/karl-transcript.js` has no top-level await and imports nothing. Export `findUnmappedSections`.

- [ ] **Step 6: Wire it into `build_scripts/validate.js`**

After the `findExternalAssetUrls` block:

```js
const { UNRESOLVED } = require('../js/karl-blocks.js')
const unmapped = findUnmappedSections(parsed.data.pages, UNRESOLVED)
if (unmapped.length) {
  const { pageKey, path, reason } = unmapped[0]
  throw new Error(
    `${pageKey} ${path} has no documented Karl destination: ${reason}\n` +
      'Either map it in js/karl-blocks.js, or open an entry in the unresolved ' +
      'register in docs/karl-export-field-map.md and add its shape rule. Do ' +
      'not widen an existing rule to cover it — a rule is an exemption for one ' +
      'documented open question, not a category.'
  )
}
```

Add `findUnmappedSections` to the destructured `require('./data-checks')`.

- [ ] **Step 7: Add the `U20` register row to the field map**

In `docs/karl-export-field-map.md`'s "Unresolved register" table, after the `U19` row:

```markdown
| `U20` | open     | **Intro paragraphs on an Agency Services/Resources section have nowhere to go.** The Subsection carries a single optional `Title` and a links list — no description field (`U8`, closed, expanded it two levels and found exactly that). Three `pestsTopic` sections carry `paragraphs[]` alongside their `cards[]`, and a direct mapping loses the paragraph. This is `U4`'s shape measured on Agency rather than Topic, and it needs the same answer: accept the loss, or nest the prose in a block that has room for it. | Digital Services decision |
```

Also add a line under the "Mockup fields with no Karl destination" table's `section-level button` row noting the current count is **5 Transaction sections and 0 Report** as re-measured 2026-08-16, superseding the "8 Transaction, 4 Report" figure that row still carries. Dated notes are records; this table is a live claim, so correct it in place.

- [ ] **Step 8: Run everything**

Run: `bun test tests/data-validation.test.js tests/karl-blocks.test.js && bun run validate && bun run test`
Expected: all green, and `validate` still prints `validated 29 pages, …`.

- [ ] **Step 9: Mutation-prove the ratchet**

Delete the `U5` entry from `UNRESOLVED`.
Run: `bun run validate`
Expected: FAIL, naming `healthyHousingTopic sections.4` and the Topic-has-no-related reason.
Restore it and re-run to confirm green.

- [ ] **Step 10: Commit**

```bash
bun run format
git add js/karl-blocks.js build_scripts/data-checks.js build_scripts/validate.js tests/data-validation.test.js tests/karl-blocks.test.js docs/karl-export-field-map.md
git commit -m "feat: fail validate on content with no documented Karl destination"
```

---

## Task 6: The workspace panel

**Files:**

- Create: `js/karl-transcript-panel.js`
- Create: `tests/e2e/karl-transcript.spec.js`
- Modify: `index.html`, `js/main.js`, `css/dashboard.css`, `tests/e2e/workspace-panels.spec.js`, `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`

**Interfaces:**

- Consumes: `window.karlTranscript`, `window.reviewState`, `window.utils` (`downloadFile`, `getCurrentPage`, `getCurrentKey`), `window.showToast`.
- Produces: nothing other modules read. It is a leaf.

- [ ] **Step 1: Add the markup**

In `index.html`, inside `#reviewWorkspaceAdvanced`, after the "Save mockups as images" group:

```html
            <details class="review-advanced-group">
              <summary>Karl transcript for this page</summary>
              <div id="karlTranscriptControls">
                <p class="field-help">
                  What an editor types into Karl for the open page, field by field, in the order
                  Karl's own form presents. It carries this browser's saved edits, so it is the
                  approved copy rather than the draft it superseded. Copying it publishes nothing.
                </p>
              </div>
            </details>
```

Static markup rather than a lazy mount hook: the transcript needs no server, so a fourth `__mountXOnTabOpen` would mean touching `setWorkspaceTab` and the `mountWorkspacePanelIfOpen` catch-up for no benefit. `js/mockup-image-export.js` is the pattern to follow.

- [ ] **Step 2: Update the group-count assertion**

`tests/e2e/workspace-panels.spec.js:108` asserts `toHaveCount(4)`. Change to `5`. That assertion exists because `js/dashboard-guidance.js` re-appends the whole `#reviewWorkspaceAdvanced` block on every Help open and a mistimed mount could duplicate or drop a group — so it must move with the markup, not be relaxed.

- [ ] **Step 3: Write the failing e2e spec**

Create `tests/e2e/karl-transcript.spec.js`, following `tests/e2e/` conventions (plain helpers from `./helpers.js`, no fixture framework):

```js
import { test, expect } from '@playwright/test'
import { gotoFresh, openWorkspace, setWorkspaceTab, openAdvancedGroup, setDecision } from './helpers.js'

test.describe('Karl transcript panel', () => {
  test('renders a transcript for the open page, headed by the Karl path', async ({ page }) => {
    await gotoFresh(page)
    await openWorkspace(page)
    await setWorkspaceTab(page, 'help')
    await openAdvancedGroup(page, 'Karl transcript for this page')
    await page.locator('#karlTranscriptPreviewButton').click()
    const preview = page.locator('#karlTranscriptPreview')
    await expect(preview).toContainText('New: Agency → Content')
    await expect(preview).toContainText('Karl transcript')
  })

  test('carries the reviewer’s saved edits, not the authored draft', async ({ page }) => {
    await gotoFresh(page)
    await page.locator('#seoTitleInput').fill('Reviewed SEO title')
    await setDecision(page, 'Approved')
    await openWorkspace(page)
    await setWorkspaceTab(page, 'help')
    await openAdvancedGroup(page, 'Karl transcript for this page')
    await page.locator('#karlTranscriptPreviewButton').click()
    await expect(page.locator('#karlTranscriptPreview')).toContainText('Decision: Approved')
  })

  test('a not-approved page is marked as such', async ({ page }) => {
    await gotoFresh(page)
    await setDecision(page, 'Blocked')
    await openWorkspace(page)
    await setWorkspaceTab(page, 'help')
    await openAdvancedGroup(page, 'Karl transcript for this page')
    await page.locator('#karlTranscriptPreviewButton').click()
    await expect(page.locator('#karlTranscriptPreview')).toContainText('NOT APPROVED')
  })
})
```

Check `tests/e2e/helpers.js` for the exact exported helper names before writing this — `openAdvancedGroup` is the one at line 128 (`.review-advanced-group:has(> summary:text-is(...))`); use whatever it is actually called there rather than inventing a name.

- [ ] **Step 4: Run it to verify it fails**

Run: `bun run test:e2e -- karl-transcript`
Expected: FAIL — `#karlTranscriptPreviewButton` never appears.

- [ ] **Step 5: Implement the panel**

Create `js/karl-transcript-panel.js` as a named IIFE with the leading semicolon:

```js
/* The Karl transcript panel: a Preview, a Copy and a Download control for the
   open page, in the Help tab's advanced section.

   Static markup in index.html rather than a lazy mount hook — the transcript
   needs no server, so it has none of the "permanently empty on the deployed
   build" problem that demoted AI assist and Tool status into <details> here.
   Follows js/mockup-image-export.js: render at init, into markup that already
   exists.

   Load-order dependency: reads window.karlTranscript, window.reviewState and
   window.utils, so js/main.js must list it after all three. */
;(function mountKarlTranscriptPanel() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const HOST_ID = 'karlTranscriptControls'

  /**
   * The transcript for whatever page is open, with this browser's saved review
   * record applied.
   *
   * The page is resolved from window.utils.getCurrentPage() rather than from
   * #pageSelect.value, which is stale during the initial View Transition — the
   * same reason the React islands take their data as an argument.
   * @returns {string} rendered markdown
   */
  function currentTranscript() {
    const { getCurrentPage, getCurrentKey } = window.utils
    const page = getCurrentPage()
    const pageKey = getCurrentKey()
    const state = window.reviewState && window.reviewState.read()
    const record = state && state.reviews ? state.reviews[pageKey] : null
    const transcript = window.karlTranscript.buildTranscript(page, record, window.HHVC_DATA.pages)
    return window.karlTranscript.renderTranscriptMarkdown(transcript)
  }

  // … render three buttons and a <pre id="karlTranscriptPreview">; wire Copy
  // through the same clipboard fallback js/ux-improvements-export.js uses, and
  // Download through window.utils.downloadFile(`${pageKey}-karl-transcript.md`,
  // markdown, 'text/markdown'). Report both through window.showToast, optional-
  // chained — the toast layer degrades to silence rather than throwing. …
})()
```

Check `window.reviewState.read()`'s actual record shape in `js/review-state-store.js` before writing `currentTranscript` — the key under which per-page records live is what this depends on, and guessing it produces a panel that silently reports every page as unreviewed.

- [ ] **Step 6: Style it**

In `css/dashboard.css`, beside the other advanced-group rules, add a rule for `#karlTranscriptPreview`: a scrollable `max-height`, `overflow: auto`, `white-space: pre-wrap`, monospace, and a `var(--surface-…)` background. Use semantic tokens from `css/theme.css` only — never a literal. Every dark-mode contrast bug this repo has had came from a literal sitting where a token belonged.

- [ ] **Step 7: Import it**

In `js/main.js`, after `import './mockup-image-export.js'`:

```js
// The Karl transcript panel. After the review layers because it reads
// window.reviewState and window.showToast, and after js/karl-transcript.js
// whose builder it renders.
import './karl-transcript-panel.js'
```

- [ ] **Step 8: Run both suites**

Run: `bun run test:e2e -- karl-transcript && bun run test:e2e -- workspace-panels`
Expected: PASS. Then the full gate: `bun run format && bun run format:check && bun run validate && bun run test`.

- [ ] **Step 9: Update the docs**

- CLAUDE.md line 45 and line 192, AGENTS.md line 178, `.github/copilot-instructions.md` line 54: `21`/`twenty-one` spec files → `22`/`twenty-two`.
- CLAUDE.md's e2e enumeration and AGENTS.md's: add `the Karl transcript panel` to the list of what the specs cover.
- Add a short subsection to CLAUDE.md and AGENTS.md — the same text in both, since this is canon rather than a Claude-specific note — under the architecture headings:

```markdown
### Karl transcript export (`js/karl-blocks.js`, `js/karl-transcript.js`)

A paste-ready, per-page instruction listing what an editor types into Karl,
field by field, in the order Karl's own form presents. `bun run export:karl`
writes one markdown file per page; a Help-tab panel renders the same transcript
for the open page with this browser's edits applied. **A human performs every
keystroke** — there are no API writes, no credentials, and no publishing path,
so the standing rule that exports are never publication approval survives
intact.

- **`js/karl-blocks.js` is transcribed from `docs/karl-export-field-map.md`, not
  parsed from it.** Half the mapping is in prose footnotes under the tables —
  Callout has no title field, the cost description caps at 120 characters,
  bullets fold into the Text block's rich text — and a parser reading only the
  tables loses exactly those and reports success. `tests/karl-blocks.test.js`
  parses the document instead, asserting a minimum row count per type BEFORE
  asserting row contents, because a doc-parsing regex that stops matching does
  not fail, it stops checking.
- **A panel's `source` is a tagged union, not a dotted path.** The field map's
  Mockup source column is a predicate on six of the eight types (`section` with
  `component: 'supporting'`, `component: 'services'` sections); a path resolver
  would cover Transaction's scalars and leave the rest silently empty.
- **Card inheritance decides TYPE versus CHOOSE**, through the one
  `js/card-inheritance.js` classifier and never a second copy of its rules. An
  `inherits` or `title-only` card is a picker, so the transcript says *choose
  page X* and never *type this description* — emitting a description for a
  picker is the exact defect that classifier exists to prevent, and here it
  would become an instruction a human executes. A section the classifier returns
  `unknown` for is FLAG, never a guessed TYPE.
- **A plain Transaction body section reaching `custom_section` is an INFERRED
  mapping and prints as one.** Transaction has no generic body stream and
  `custom_section` is its only repeatable Title-and-text panel, but the field map
  claims that panel only for supporting/flat sections. Nineteen sections depend
  on it; the alternative was exporting a fifth of the heaviest type's body copy
  as "no Karl destination".
- **`findUnmappedSections` is a gate, not a report** — unlike `bun run
  audit-cards`. Its exemptions in `karl-blocks.js`'s `UNRESOLVED` table are
  SHAPE rules, never page keys or paths: an allowlist would let a newly authored
  section inherit an old exemption just by landing at the same index, which is
  the case the ratchet exists to catch. Closing a register entry upstream means
  deleting its rule here, and every section it covered fails until it is mapped.
- **Approval is per page, not per field.** The review record has `decision` and
  no field-level approval, so a not-Approved page is marked in the header and on
  every panel rather than exported as though it were signed off.
```

- [ ] **Step 10: Commit**

```bash
bun run format
git add js/karl-transcript-panel.js tests/e2e/karl-transcript.spec.js tests/e2e/workspace-panels.spec.js index.html js/main.js css/dashboard.css CLAUDE.md AGENTS.md .github/copilot-instructions.md
git commit -m "feat: render the Karl transcript for the open page in the workspace"
```

---

## Verification before calling the feature done

Run each and read the output rather than the exit code:

```bash
bun run format:check     # the lint gate
bun run validate         # 29 pages, and the new ratchet green
bun run test             # 47 unit-test files
bun run test:e2e         # 22 spec files
bun run export:karl      # 29 transcripts
bun run build:netlify    # the deploy-integrity check CI runs before `test`
```

Then read one transcript end to end — `review/karl-transcripts/payFee.md` (a Transaction with steps, callouts and a Related panel) and `review/karl-transcripts/article11Guide.md` (the Report, seven tables and a callout with no home) — and ask the question the whole feature turns on: **could someone with the Karl admin open follow this without guessing?** A transcript that passes every test and cannot be followed has failed.
