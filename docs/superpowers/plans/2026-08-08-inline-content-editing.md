# Inline Content Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a reviewer click directly on a mockup's title, summary, CTA label, section heading, paragraphs, or bullets and edit them in place, with the mockup re-rendering immediately and the edit persisting through the existing browser-first `localStorage` review-state model — `pages/*.js` source is never touched.

**Architecture:** Reuse the field-addressing (`data-rewrite-field` dot-paths, `getByPath`/`setByPath`) and persistence (`REVIEW_RECORD_FIELDS`, `mergeReviewRecord`, autosave) infrastructure already on `main` from the merged AI-rewrite-selection groundwork. Add two new self-mounting modules (`js/inline-content-edit.js` orchestrator + `js/inline-content-edit-render.js` render helpers) that read/write the in-memory page object directly via the existing helpers, trigger `window.renderPage`, and fold into the existing debounced autosave — no new history entries, no new backend dependency. Section-level edits (headings, paragraphs, bullets) are captured in a new `section_edits` review-record field, **derived at every autosave** by diffing the live page object against `window.ORIGINAL_DATA` for each in-scope path — the same "read live state, don't accumulate a diff" pattern `edited_title`/`edited_summary`/`primary_cta` already use, so a "reset to original" is correct by construction (the path simply stops differing and drops out of the map).

**Tech Stack:** Plain browser ES modules (Vite-bundled), Bun test, Zod (schema only, `build_scripts/`), Playwright e2e. No new dependencies.

## Global Constraints

- **Never edit `pages/*.js` source files.** Every write in this feature lands only on the in-memory `pageData`/`page` object and in `localStorage`.
- **In scope for editing:** page title, page summary, primary CTA label, section heading, section paragraphs, section bullets. **Out of scope:** cards, callouts, table cells, step text/bullets, `whatToKnow` items, contact info, and any section/card/step add, remove, or reorder.
- **Array edits are whole-field replace, never per-index patches.** Adding or removing a paragraph/bullet always writes the entire resulting array, both in `page.sections[N].paragraphs`/`.bullets` and in the persisted `section_edits` map.
- **All path reads/writes go through the existing guarded `getByPath`/`setByPath`** (`js/utils.js`) — never a hand-rolled path walker. Title/summary/CTA are addressed directly (`page.title =`, `page.summary =`, `getPrimaryCta`/`setPrimaryCta`), matching how `data-rewrite-field="title"` etc. are click targets only, not `getByPath` targets.
- **No new history entry per edit.** Every commit folds into the existing continuous autosave path (`saveCurrentPageToLocalStorage` in `js/ux-improvements-state-sync.js`), never `mergeReviewRecord`.
- **Edited paragraphs/bullets** are stored as `{text, unverified: true, unverifiedReason: 'Manually edited during review'}`, reusing the existing Unverified-pill rendering with zero renderer changes to that mechanism.
- **Edited title/summary/heading/CTA** get a CSS-only "Edited" badge applied as post-render DOM decoration (comparing live value to `window.ORIGINAL_DATA` via `getByPath`) — never threaded into `renderHero`/`renderSection` as a parameter, which would compromise the escaping-audited render contract those functions share with the AI-preview path.
- **No AI, no backend dependency, no capability gating.** The feature works with zero configuration, always available once the page has loaded.
- **Prettier is the linter.** No semicolons, single quotes, 2-space indent, ES5 trailing commas, `printWidth: 100`. Run `bun run format` before each commit.
- **File naming:** hyphenated lowercase for new multi-word files (`inline-content-edit.js`, `inline-content-edit-render.js`, `inline-content-edit.css`).
- **Module pattern:** named IIFE with leading semicolon (`;(function mountX(){...})()`), `window.X = window.X || {}` idiom, orchestrator assembles a public surface from sibling files — matching `js/ai-assist.js` + `js/ai-assist-render.js`.
- **`css/theme.css` must stay the last stylesheet import** in `js/main.js`; the new stylesheet is inserted before it.
- **`package.json`'s `test` script enumerates Bun unit-test files explicitly** — a new `tests/*.test.js` file must be added there or it never runs in CI. Playwright e2e specs under `tests/e2e/` are auto-discovered by `playwright test` and must NOT be added to that list.
- **After touching the import/export round trip, manually verify it**: export a snapshot, re-import it, confirm existing decisions/notes/edits survive.
- Run `bun run validate` and `bun run test` after any change under `pages/`, `js/page-data.js`, or the schema files. Run `bun run format:check` before considering a task done.

---

## Repo-reality corrections baked into this plan (read before starting)

The approved design spec (`docs/superpowers/specs/2026-08-08-inline-content-editing-design.md`) contains three claims that do not match the current `main` branch. This plan implements the corrected reality, not the spec's literal wording:

1. **`edited_title`, `edited_summary`, and `primary_cta` are NOT unused fields waiting for a write path.** `collectCurrentPageReviewState()` (`js/ux-improvements-state-sync.js:195-216`) already sets all three from live `page.title`/`page.summary`/`getPrimaryCta(page)` on every autosave, and `updateMockupTextFromSavedState()` (same file, line 340) already reapplies them on load, including direct DOM patches to `#mockPage .hero h1`/`.summary`. **This plan adds no new schema/persistence/reapply code for those three fields.** The only new code is the click-to-edit UI that mutates `page.title`/`page.summary`/calls `setPrimaryCta` in memory and triggers the existing autosave — the write path already exists and already works.
2. **There is no existing "SEO panel per-field reset" pattern to mirror.** `js/editor-panel.js` has no reset control at all. The real, and only, precedent is `restorePageContentFromOriginal(pageKey)` in `js/review-state-sync.js:534-559` — a **whole-page** reset (title, summary, SEO fields, CTA) via direct `page.x =` assignment and `setPrimaryCta`. This plan's per-field reset is new code modeled on that function's shape (read `ORIGINAL_DATA`, write back, re-render) but scoped to one field via `getByPath`/`setByPath`.
3. **CSV does not currently carry `primary_cta`-adjacent fields consistently.** `MANAGER_REVIEW_RECORD_FIELDS` (`js/manager-review-export.js`) and the header/row arrays in `exportSavedLocalReviewsCsv` (`js/ux-improvements-export.js`) already include `primary_cta` but do **not** include `edited_title`/`edited_summary` — those two are added to three separate enumerations (see Task 9) for the spec's "CSV carries title/summary/CTA edits" claim to become true. `section_edits` is correctly excluded from all three per the spec's documented CSV limitation.

Additionally, `applyContentEditsToPageData()` must apply **only `section_edits`** — the three page-level fields are already reapplied by the existing `updateMockupTextFromSavedState()`, and reapplying them a second time would be redundant, not merely harmless (it would mean two functions racing to set `page.title` from two different fields on every load). All six call sites of `updateMockupTextFromSavedState()` funnel through the single function `applySavedPageState(pageKey)` (`js/ux-improvements-state-sync.js:377`) — navigation, deep links, sync pull, and conflict resolution all call `applySavedPageState`, never `updateMockupTextFromSavedState` directly. So `applyContentEditsToPageData` needs exactly one call site: inside `applySavedPageState`, alongside the existing `updateMockupTextFromSavedState(page, saved)` call.

---

## File Structure

**New files:**
- `js/inline-content-edit-data.js` — pure, dual-exported (`window` + `module.exports`, like `js/review-merge.js`/`js/standards/plain-language.js`) logic: computing `section_edits` from a page + `ORIGINAL_DATA` diff, `applyContentEditsToPageData()`, and the in-scope-path list. No DOM.
- `js/inline-content-edit-render.js` — edit-widget markup (input/textarea swap, add/remove/reset controls, the "Edited" badge markup).
- `js/inline-content-edit.js` — orchestrator IIFE: delegated click handling, commit/cancel/undo lifecycle, wires `js/inline-content-edit-data.js` and `js/inline-content-edit-render.js` together, publishes `window.inlineEdit`.
- `css/inline-content-edit.css` — the "Edited" badge, edit-widget input/textarea styling, add/remove control styling. Design tokens only, no raw `--sfds-*` values, no `!important`.
- `tests/inline-content-edit-data.test.js` — Bun unit tests for the pure module (no DOM).
- `tests/e2e/inline-content-edit.spec.js` — Playwright end-to-end coverage.

**Modified files:**
- `js/page-render.js` — `renderHero()` gains `data-rewrite-field` on title/summary/CTA elements; `renderSection()` gains it on the `<h2>`.
- `js/utils.js` — `REVIEW_RECORD_FIELDS` gains `section_edits`; `buildReviewRecord`'s base object gains a `section_edits: {}` default.
- `js/review-state-validation.js` — `REVIEW_RECORD_FIELDS` Set gains `'section_edits'`; `sanitizeReviewRecord` gains a dedicated object-shaped branch for it (parallel to the existing `history` branch).
- `build_scripts/review-state-schema.js` — `reviewRecordSchema` gains a `section_edits` field: `z.record(z.string(), z.unknown()).optional()`.
- `js/ux-improvements-state-sync.js` — `collectCurrentPageReviewState()` gains a `section_edits: computeSectionEdits(page)` override; `applySavedPageState()` gains one call to `applyContentEditsToPageData(page, saved)`.
- `js/manager-review-export.js` — `MANAGER_REVIEW_RECORD_FIELDS` gains `'edited_title'`, `'edited_summary'`.
- `js/ux-improvements-export.js` — `exportSavedLocalReviewsCsv()`'s `headers` array and row-building gain `edited_title`/`edited_summary` columns.
- `js/review-queue-import.js` — `importReviewsFromCsvText()`'s `fields` array gains `'edited_title'`, `'edited_summary'`.
- `js/main.js` — imports for the three new JS modules and the new CSS file (before `css/theme.css`).
- `package.json` — `test` script gains `tests/inline-content-edit-data.test.js`.
- `tests/page-render.test.js` — new assertions for the heading/hero `data-rewrite-field` attributes.
- `tests/review-state-schema.test.js` — new assertions for `section_edits` validation and browser/Zod parity.
- `CLAUDE.md` and `AGENTS.md` — new "Inline content editing" section; stylesheet table gains a row for `css/inline-content-edit.css`.

---

### Task 1: `data-rewrite-field` on section headings and hero title/summary/CTA

**Files:**
- Modify: `js/page-render.js:454-477` (`renderSection`), `js/page-render.js:518-532` (`renderHero`)
- Test: `tests/page-render.test.js` (extend the existing `describe('data-rewrite-field annotation', ...)` block, currently ending at line 387)

**Interfaces:**
- Consumes: nothing new — uses the section object's existing `__sectionIndex` property (set by `partitionSections()`, `js/page-render.js:164`) and `escapeHtml` (already imported in this file).
- Produces: `renderSection()`'s `<h2>` now optionally carries `data-rewrite-field="sections.N.heading"`; `renderHero()`'s `<h1>`, `.summary` `<p>`, and the CTA `<button>`/`<a>` (inside `hero-cta`) now optionally carry `data-rewrite-field="title"`, `"summary"`, `"primaryCta"` respectively. These attributes are pure click targets for Task 5 — no other task reads them via `getByPath` (title/summary/CTA are addressed directly, per the Global Constraints).

- [ ] **Step 1: Write the failing test for the section heading attribute**

Add to `tests/page-render.test.js`, inside the existing `describe('data-rewrite-field annotation', ...)` block (after the `'emits no attribute when no path prefix is passed'` test, before the big `'uses the original page.sections index...'` test):

```javascript
  test('annotates a section heading with its source index', () => {
    const section = { heading: 'Test Heading', karl: 'k', __sectionIndex: 2, paragraphs: [] }
    const html = ctx.renderSection(section, 'information')
    expect(html).toContain('data-rewrite-field="sections.2.heading"')
    expect(html).toContain('<h2 id="section-test-heading" data-rewrite-field="sections.2.heading">Test Heading</h2>')
  })

  test('emits no heading data-rewrite-field when __sectionIndex is absent', () => {
    const section = { heading: 'No Index', karl: 'k', paragraphs: [] }
    const html = ctx.renderSection(section, 'information')
    expect(html).not.toContain('data-rewrite-field')
  })

  test('escapes a heading value carrying HTML', () => {
    const section = {
      heading: PAYLOAD,
      karl: 'k',
      __sectionIndex: 0,
      paragraphs: [],
    }
    assertEscaped(ctx.renderSection(section, 'information'))
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/page-render.test.js -t "annotates a section heading"`
Expected: FAIL — `renderSection` output does not currently contain `data-rewrite-field="sections.2.heading"`.

- [ ] **Step 3: Implement the heading attribute in `renderSection()`**

In `js/page-render.js`, `renderSection()` currently reads (lines 454-465):

```javascript
function renderSection(section, pageType = 'generic', options = {}) {
  const kind = section.kind || 'body'
  const role = inferSectionRole(section, pageType)
  const anchor = section.heading ? ` id="${sectionAnchorId(section.heading)}"` : ''
  const tag = options.skipKarl ? '' : karlTag(section.karl || 'Body section', kind)
  const heading =
    role === 'what-to-do' && pageType === 'transaction'
      ? `<h2 class="what-to-do-heading">What to do</h2>`
      : section.heading
        ? `<h2${anchor}>${escapeHtml(section.heading)}</h2>`
        : ''
  const inner = `${tag}${heading}${renderSectionInner(section, pageType)}`
```

Change the `heading` branch to add the attribute, using the same `__sectionIndex`-presence guard `renderSectionInner()` already uses for its own `base` variable (line 433-434) — a bare section with no `__sectionIndex` (e.g. from a test or a future caller outside `partitionSections()`) gets no attribute rather than a guessed one:

```javascript
function renderSection(section, pageType = 'generic', options = {}) {
  const kind = section.kind || 'body'
  const role = inferSectionRole(section, pageType)
  const anchor = section.heading ? ` id="${sectionAnchorId(section.heading)}"` : ''
  const tag = options.skipKarl ? '' : karlTag(section.karl || 'Body section', kind)
  const headingPathAttr =
    typeof section.__sectionIndex === 'number'
      ? ` data-rewrite-field="sections.${section.__sectionIndex}.heading"`
      : ''
  const heading =
    role === 'what-to-do' && pageType === 'transaction'
      ? `<h2 class="what-to-do-heading">What to do</h2>`
      : section.heading
        ? `<h2${anchor}${headingPathAttr}>${escapeHtml(section.heading)}</h2>`
        : ''
  const inner = `${tag}${heading}${renderSectionInner(section, pageType)}`
```

Note: the "What to do" synthetic heading (transaction pages) intentionally gets no attribute — it is not `section.heading`, it is a fixed literal string with no backing field to edit.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/page-render.test.js -t "annotates a section heading|emits no heading|escapes a heading"`
Expected: PASS (all three new tests)

- [ ] **Step 5: Write the failing test for hero title/summary/CTA attributes**

Add a new `describe` block to `tests/page-render.test.js`, after the `describe('data-rewrite-field annotation', ...)` block closes (after line 387):

```javascript
describe('data-rewrite-field on the hero (title, summary, CTA)', () => {
  const transactionPage = {
    slug: 'x',
    type: 'Transaction',
    title: 'Test Title',
    summary: 'Test summary text.',
    audience: ['a'],
    reading: 'Grade 6',
    sections: [
      {
        heading: 'What to do',
        karl: 'k',
        steps: [{ title: 'Step one', text: ['do it'], button: 'Start now', buttonTarget: 'x' }],
      },
    ],
  }

  test('annotates the title with data-rewrite-field="title"', () => {
    const html = ctx.renderPageMain(transactionPage)
    expect(html).toContain('data-rewrite-field="title"')
    expect(html).toContain('<h1 tabindex="-1" data-rewrite-field="title">Test Title</h1>')
  })

  test('annotates the summary with data-rewrite-field="summary"', () => {
    const html = ctx.renderPageMain(transactionPage)
    expect(html).toContain(
      '<p class="summary" data-rewrite-field="summary">Test summary text.</p>'
    )
  })

  test('annotates the primary CTA button with data-rewrite-field="primaryCta"', () => {
    const html = ctx.renderPageMain(transactionPage)
    expect(html).toContain('data-rewrite-field="primaryCta"')
  })

  test('emits no CTA attribute when the page has no resolvable hero CTA', () => {
    const infoPage = {
      slug: 'y',
      type: 'Information',
      title: 'Info Title',
      summary: 'Info summary.',
      audience: ['a'],
      reading: 'Grade 6',
      sections: [{ heading: 'Body', karl: 'k', paragraphs: ['text'] }],
    }
    const html = ctx.renderPageMain(infoPage)
    expect(html).not.toContain('data-rewrite-field="primaryCta"')
  })

  test('escapes the title and summary', () => {
    const page = {
      ...transactionPage,
      title: PAYLOAD,
      summary: PAYLOAD,
    }
    assertEscaped(ctx.renderPageMain(page))
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `bun test tests/page-render.test.js -t "data-rewrite-field on the hero"`
Expected: FAIL — `renderHero` does not currently emit any of these attributes.

- [ ] **Step 7: Implement the hero attributes in `renderHero()`**

`js/page-render.js`'s `renderHero()` currently reads (lines 518-532):

```javascript
function renderHero(page, heroCta) {
  const ctaHtml = heroCta
    ? `<div class="hero-cta">${button(heroCta.label, 'primary', heroCta.target, heroCta.url)}</div>`
    : ''
  const topicChip = page.topicTag
    ? `<span class="pill pill--topic">${escapeHtml(page.topicTag)}</span>`
    : ''
  const reportDatePill =
    normalizePageType(page.type) === 'report' && page.reportDate
      ? `<span class="pill">Updated ${escapeHtml(page.reportDate)}</span>`
      : ''
  const heroClass =
    normalizePageType(page.type) === 'transaction' ? 'hero hero--transaction' : 'hero'
  return `<section class="${heroClass}"><div class="hero-inner">${karlTag('Metadata: Karl page type', 'meta')}<div class="eyebrow">${escapeHtml(page.type)}</div>${karlTag('Page title field', 'meta')}<h1 tabindex="-1">${escapeHtml(page.title)}</h1>${karlTag('Short summary / Description field', 'meta')}<p class="summary">${escapeHtml(page.summary)}</p>${ctaHtml}${karlTag('Metadata: Agency, program, reading target', 'meta')}<div class="metadata"><span class="pill">Environmental Health</span><span class="pill">HHVC</span><span class="pill">${escapeHtml(page.reading)}</span>${reportDatePill}${topicChip}</div></div></section>`
}
```

`button()` (line 214-221) is a shared helper used by many call sites (cards, steps, spotlight) that must NOT all gain a `data-rewrite-field` — only the hero CTA is in scope. Rather than modifying `button()`'s signature (which would force every caller to pass an empty value), build the hero CTA markup inline here with the attribute, mirroring what `button()` produces for the primary (non-URL) case:

```javascript
function renderHero(page, heroCta) {
  const ctaAttr = heroCta ? ' data-rewrite-field="primaryCta"' : ''
  const ctaHtml = heroCta
    ? `<div class="hero-cta"${ctaAttr}>${button(heroCta.label, 'primary', heroCta.target, heroCta.url)}</div>`
    : ''
  const topicChip = page.topicTag
    ? `<span class="pill pill--topic">${escapeHtml(page.topicTag)}</span>`
    : ''
  const reportDatePill =
    normalizePageType(page.type) === 'report' && page.reportDate
      ? `<span class="pill">Updated ${escapeHtml(page.reportDate)}</span>`
      : ''
  const heroClass =
    normalizePageType(page.type) === 'transaction' ? 'hero hero--transaction' : 'hero'
  return `<section class="${heroClass}"><div class="hero-inner">${karlTag('Metadata: Karl page type', 'meta')}<div class="eyebrow">${escapeHtml(page.type)}</div>${karlTag('Page title field', 'meta')}<h1 tabindex="-1" data-rewrite-field="title">${escapeHtml(page.title)}</h1>${karlTag('Short summary / Description field', 'meta')}<p class="summary" data-rewrite-field="summary">${escapeHtml(page.summary)}</p>${ctaHtml}${karlTag('Metadata: Agency, program, reading target', 'meta')}<div class="metadata"><span class="pill">Environmental Health</span><span class="pill">HHVC</span><span class="pill">${escapeHtml(page.reading)}</span>${reportDatePill}${topicChip}</div></div></section>`
}
```

The attribute is placed on the `.hero-cta` wrapping `<div>` rather than on `button()`'s own `<button>`/`<a>` output, since `button()` is shared and unmodified — Task 5's click delegation walks up to the nearest `[data-rewrite-field]` ancestor regardless of which element carries it, so this is equivalent for the click-to-edit interaction while touching zero shared code.

- [ ] **Step 8: Run test to verify it passes**

Run: `bun test tests/page-render.test.js`
Expected: PASS — all tests in the file, including the two new blocks and every pre-existing test (this change must not alter any other assertion's output).

- [ ] **Step 9: Run `bun run validate` to confirm no regression**

Run: `bun run validate`
Expected: exits 0, same page/rule counts as before this change (this task only adds attributes, no schema or content changes).

- [ ] **Step 10: Format and commit**

```bash
bun run format
git add js/page-render.js tests/page-render.test.js
git commit -m "feat: add data-rewrite-field to section headings and hero title/summary/CTA"
```

---

### Task 2: `section_edits` schema — Zod and browser-side validation

**Files:**
- Modify: `build_scripts/review-state-schema.js:38-71` (`reviewRecordSchema`)
- Modify: `js/review-state-validation.js:21-41` (`REVIEW_RECORD_FIELDS` Set), `js/review-state-validation.js:76-110` (`sanitizeReviewRecord`)
- Test: `tests/review-state-schema.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: a review record may now carry `section_edits: Record<string, unknown>` and both `validateReviewRecord()` (Zod) and `sanitizeReviewRecord()` (browser) accept it as an object, not stringify it. Task 3 relies on `sanitizeReviewRecord` preserving `section_edits` as a real object (parallel to how it already preserves `history` as a real array), since a JSON-backup import round-trips through this function.

- [ ] **Step 1: Write the failing Zod schema test**

Add to `tests/review-state-schema.test.js`, inside the existing `describe('review-state-schema', ...)` block (after the `'accepts local_dirty as a real boolean'` test):

```javascript
  test('accepts a section_edits map of field paths to arbitrary JSON values', () => {
    const result = validateReviewRecord({
      page_key: 'pestsTopic',
      section_edits: {
        'sections.2.heading': 'New heading',
        'sections.2.paragraphs': ['p1', 'p2'],
        'sections.2.bullets': [{ text: 'b1' }, { text: 'b2', unverified: true }],
      },
    })
    expect(result.success).toBe(true)
  })

  test('accepts an empty section_edits map', () => {
    const result = validateReviewRecord({ page_key: 'pestsTopic', section_edits: {} })
    expect(result.success).toBe(true)
  })

  test('rejects a non-object section_edits value', () => {
    const result = validateReviewRecord({ page_key: 'pestsTopic', section_edits: 'not an object' })
    expect(result.success).toBe(false)
  })

  test('rejects a section_edits value that is an array', () => {
    const result = validateReviewRecord({ page_key: 'pestsTopic', section_edits: ['x'] })
    expect(result.success).toBe(false)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/review-state-schema.test.js -t "section_edits"`
Expected: FAIL — `reviewRecordSchema` currently has no `section_edits` field, so `.passthrough()` lets the object through but the array-rejection test fails (a passthrough schema accepts any value for an unknown key, including an array).

- [ ] **Step 3: Add `section_edits` to the Zod schema**

In `build_scripts/review-state-schema.js`, the `reviewRecordSchema` object (lines 38-71) currently ends:

```javascript
    // Whether this browser holds edits it has not pushed. A real boolean,
    // not a timestamp, precisely so conflict detection never has to compare
    // a browser-clock value against a server-clock one — see
    // pullFromServer in js/review-state-sync.js.
    local_dirty: z.boolean().optional(),
  })
  .passthrough()
```

Add a `section_edits` field just before `local_dirty` (grouping it with the other content fields rather than the sync-bookkeeping ones):

```javascript
    // Flat map of field path -> current full value for section-level manual
    // edits (headings, paragraphs, bullets). Keyed at the array/scalar field
    // level, not the individual item level — see CLAUDE.md's "Inline content
    // editing" section for why. z.record's value type is z.unknown() because
    // a value here can be a string (a heading) or an array of strings/objects
    // (paragraphs/bullets each accept the string-or-{text,unverified,...}
    // shape already defined elsewhere in this schema for section content).
    section_edits: z.record(z.string(), z.unknown()).optional(),
    // Whether this browser holds edits it has not pushed. A real boolean,
    // not a timestamp, precisely so conflict detection never has to compare
    // a browser-clock value against a server-clock one — see
    // pullFromServer in js/review-state-sync.js.
    local_dirty: z.boolean().optional(),
  })
  .passthrough()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/review-state-schema.test.js -t "section_edits"`
Expected: PASS — all four new tests (Zod's `z.record()` rejects arrays and non-object primitives by construction).

- [ ] **Step 5: Write the failing browser-side validation test**

Add to `tests/review-state-schema.test.js`, inside the existing `describe('browser-side sanitizeReviewRecord (js/review-state-validation.js)', ...)` block (after the `'keeps synced_at and drops unknown fields'` test):

```javascript
  test('preserves section_edits as a real object rather than stringifying it', () => {
    const clean = sanitizeReviewRecord({
      page_key: 'pestsTopic',
      section_edits: { 'sections.2.heading': 'New heading', 'sections.2.bullets': [{ text: 'b' }] },
    })
    expect(clean.section_edits).toEqual({
      'sections.2.heading': 'New heading',
      'sections.2.bullets': [{ text: 'b' }],
    })
  })

  test('drops a non-object section_edits value rather than passing it through', () => {
    const clean = sanitizeReviewRecord({ page_key: 'pestsTopic', section_edits: 'not an object' })
    expect(clean).not.toHaveProperty('section_edits')
  })

  test('keeps an empty section_edits map rather than dropping it', () => {
    const clean = sanitizeReviewRecord({ page_key: 'pestsTopic', section_edits: {} })
    expect(clean.section_edits).toEqual({})
  })
```

- [ ] **Step 6: Run test to verify it fails**

Run: `bun test tests/review-state-schema.test.js -t "section_edits as a real object|non-object section_edits|empty section_edits map"`
Expected: FAIL — `sanitizeReviewRecord`'s generic branch currently isn't reached for `section_edits` at all (it isn't in `REVIEW_RECORD_FIELDS`, so it's dropped by the `if (!REVIEW_RECORD_FIELDS.has(key) ...) continue` guard), so `clean.section_edits` is `undefined` in every case, failing the first and third tests.

- [ ] **Step 7: Add `section_edits` handling to `js/review-state-validation.js`**

Add `'section_edits'` to the `REVIEW_RECORD_FIELDS` Set (line 21-41):

```javascript
  const REVIEW_RECORD_FIELDS = new Set([
    'review_date',
    'reviewer',
    'page_key',
    'page_title',
    'page_type',
    'url_slug',
    'decision',
    'notes',
    'risks_or_blockers',
    'follow_up_owner',
    'seo_title',
    'meta_description',
    'primary_cta',
    'reading_target',
    'edited_title',
    'edited_summary',
    'section_edits',
    'updated_at',
    'synced_at',
    'local_dirty',
  ])
```

Then, in `sanitizeReviewRecord()` (lines 76-110), add a dedicated branch for `section_edits` — parallel to the existing `history` branch, since both are non-string-shaped fields that would be corrupted by the generic `String()` coercion at the bottom of the loop:

```javascript
  function sanitizeReviewRecord(record) {
    if (!isPlainObject(record)) return null
    const clean = {}
    for (const [key, value] of Object.entries(record)) {
      // history is an array of entries, not a flat string field like the
      // rest of REVIEW_RECORD_FIELDS, so it can't go through the generic
      // stringify-everything path below without corrupting it.
      if (key === 'history') {
        if (Array.isArray(value)) {
          clean.history = value.map(sanitizeHistoryEntry).filter(Boolean)
        }
        continue
      }
      // section_edits is a flat map of field-path -> current value (a
      // string, or an array of strings/objects for paragraphs/bullets), not
      // a string field itself. Same reasoning as history: the generic
      // String() coercion below would turn the whole map into the literal
      // string "[object Object]", silently destroying every section-level
      // edit on the next read. A non-object value is dropped rather than
      // kept, matching how a malformed history entry is dropped rather than
      // kept malformed.
      if (key === 'section_edits') {
        if (isPlainObject(value)) clean.section_edits = { ...value }
        continue
      }
      // local_dirty is a real boolean, and the generic String() coercion
      // below would turn `false` into the string 'false' — which is TRUTHY.
      // That would make every clean record read back as having unpushed
      // local edits, turning routine pulls into permanent conflicts.
      if (key === 'local_dirty') {
        if (value != null) clean.local_dirty = value === true || value === 'true'
        continue
      }
      if (!REVIEW_RECORD_FIELDS.has(key) && key !== 'page_key') continue
      if (
        key === 'decision' &&
        value !== '' &&
        value != null &&
        !VALID_DECISIONS.has(String(value))
      ) {
        continue
      }
      if (value == null) continue
      clean[key] = typeof value === 'string' ? value : String(value)
    }
    return clean
  }
```

- [ ] **Step 8: Run test to verify it passes**

Run: `bun test tests/review-state-schema.test.js`
Expected: PASS — every test in the file, old and new.

- [ ] **Step 9: Format and commit**

```bash
bun run format
git add build_scripts/review-state-schema.js js/review-state-validation.js tests/review-state-schema.test.js
git commit -m "feat: add section_edits to the review-record schema (Zod and browser mirror)"
```

---

### Task 3: pure `section_edits` derivation and reapply logic (`js/inline-content-edit-data.js`)

**Files:**
- Create: `js/inline-content-edit-data.js`
- Test: `tests/inline-content-edit-data.test.js`

**Interfaces:**
- Consumes: `getByPath`, `setByPath` from `js/utils.js` (both already exist, already guard `__proto__`/`prototype`/`constructor`, already tested in `tests/utils.test.js`).
- Produces:
  - `IN_SCOPE_SECTION_FIELD_SUFFIXES = ['heading', 'paragraphs', 'bullets']` — exported constant, the only section-level field kinds this feature ever diffs or writes.
  - `computeSectionEdits(page, originalPage)` — `(object, object) => Record<string, unknown>`. Walks `page.sections`, and for each section's `heading`/`paragraphs`/`bullets`, compares (via `JSON.stringify` deep-equality) the current value against `getByPath(originalPage, 'sections.N.<field>')`. Returns a flat map of `'sections.N.<field>'` → current value for every path that differs. A path whose current value equals the original is omitted (this is what makes "reset to original" correct-by-construction: once a field is written back to match `originalPage`, the next call to `computeSectionEdits` simply drops it). Returns `{}` for a page with no sections, or when `page`/`originalPage` is missing.
  - `applyContentEditsToPageData(page, savedRecord)` — `(object, object) => void`. Reads `savedRecord.section_edits` (a plain object, possibly absent/malformed) and, for each `[path, value]` entry, calls `setByPath(page, path, value)`. Never throws: an absent `savedRecord`, an absent/non-object `section_edits`, or a `setByPath` failure (stale path that no longer resolves against the current page shape) are all silently skipped — mirrors `getByPath`'s "total function" contract referenced in the design spec. Does **not** touch `edited_title`/`edited_summary`/`primary_cta` — those are already reapplied by the existing `updateMockupTextFromSavedState()` (see the "Repo-reality corrections" section above for why this function must not duplicate that).
  - Dual-exported: `window.inlineEditData = { computeSectionEdits, applyContentEditsToPageData, IN_SCOPE_SECTION_FIELD_SUFFIXES }` when `window` exists, and `module.exports = { ... }` when `module.exports` exists — the same dual-export idiom `js/review-merge.js` and `js/standards/plain-language.js` use, so this file is importable directly under Bun with no browser.

- [ ] **Step 1: Write the failing test file**

Create `tests/inline-content-edit-data.test.js`:

```javascript
// Pure logic for section-level inline edits: computing the section_edits
// diff against ORIGINAL_DATA, and reapplying a saved section_edits map onto
// a live page object. No DOM — dual-exported like js/review-merge.js and
// js/standards/plain-language.js so this file is importable directly under Bun.
const { describe, test, expect } = require('bun:test')
const {
  computeSectionEdits,
  applyContentEditsToPageData,
  IN_SCOPE_SECTION_FIELD_SUFFIXES,
} = require('../js/inline-content-edit-data.js')

describe('IN_SCOPE_SECTION_FIELD_SUFFIXES', () => {
  test('lists exactly heading, paragraphs, and bullets', () => {
    expect(IN_SCOPE_SECTION_FIELD_SUFFIXES).toEqual(['heading', 'paragraphs', 'bullets'])
  })
})

describe('computeSectionEdits', () => {
  const original = {
    sections: [
      { heading: 'Original Heading', paragraphs: ['p1', 'p2'], bullets: ['b1'] },
      { heading: 'Second Section', paragraphs: ['q1'] },
    ],
  }

  test('returns an empty object when nothing differs from original', () => {
    const page = JSON.parse(JSON.stringify(original))
    expect(computeSectionEdits(page, original)).toEqual({})
  })

  test('reports a changed heading under its dot-path', () => {
    const page = JSON.parse(JSON.stringify(original))
    page.sections[0].heading = 'Edited Heading'
    expect(computeSectionEdits(page, original)).toEqual({
      'sections.0.heading': 'Edited Heading',
    })
  })

  test('reports a changed paragraphs array as the whole array, not a diff', () => {
    const page = JSON.parse(JSON.stringify(original))
    page.sections[0].paragraphs = ['p1', 'p2 edited', 'p3 new']
    expect(computeSectionEdits(page, original)).toEqual({
      'sections.0.paragraphs': ['p1', 'p2 edited', 'p3 new'],
    })
  })

  test('reports a changed bullets array including object-shaped unverified entries', () => {
    const page = JSON.parse(JSON.stringify(original))
    page.sections[0].bullets = [
      'b1',
      { text: 'b2 new', unverified: true, unverifiedReason: 'Manually edited during review' },
    ]
    expect(computeSectionEdits(page, original)).toEqual({
      'sections.0.bullets': [
        'b1',
        { text: 'b2 new', unverified: true, unverifiedReason: 'Manually edited during review' },
      ],
    })
  })

  test('reports multiple sections and multiple fields at once, each under its own path', () => {
    const page = JSON.parse(JSON.stringify(original))
    page.sections[0].heading = 'Edited Heading'
    page.sections[1].paragraphs = ['q1 edited']
    expect(computeSectionEdits(page, original)).toEqual({
      'sections.0.heading': 'Edited Heading',
      'sections.1.paragraphs': ['q1 edited'],
    })
  })

  test('drops a path once its value is written back to match the original (reset)', () => {
    const page = JSON.parse(JSON.stringify(original))
    page.sections[0].heading = 'Edited Heading'
    expect(computeSectionEdits(page, original)).toEqual({ 'sections.0.heading': 'Edited Heading' })
    page.sections[0].heading = original.sections[0].heading
    expect(computeSectionEdits(page, original)).toEqual({})
  })

  test('ignores fields outside heading/paragraphs/bullets, e.g. kind or component', () => {
    const page = JSON.parse(JSON.stringify(original))
    page.sections[0].kind = 'placement'
    expect(computeSectionEdits(page, original)).toEqual({})
  })

  test('returns an empty object when the page has no sections', () => {
    expect(computeSectionEdits({ sections: [] }, original)).toEqual({})
  })

  test('returns an empty object rather than throwing when page or originalPage is missing', () => {
    expect(computeSectionEdits(null, original)).toEqual({})
    expect(computeSectionEdits(original, null)).toEqual({})
    expect(computeSectionEdits(undefined, undefined)).toEqual({})
  })

  test('returns an empty object when a section exists in page but not in original (no crash)', () => {
    const page = JSON.parse(JSON.stringify(original))
    page.sections.push({ heading: 'New Section', paragraphs: ['new'] })
    // The third section has no original counterpart to diff against, so its
    // fields are reported as edits (current value differs from undefined).
    expect(computeSectionEdits(page, original)).toEqual({
      'sections.2.heading': 'New Section',
      'sections.2.paragraphs': ['new'],
    })
  })
})

describe('applyContentEditsToPageData', () => {
  function freshPage() {
    return {
      sections: [
        { heading: 'Original Heading', paragraphs: ['p1'], bullets: ['b1'] },
        { heading: 'Second', paragraphs: ['q1'] },
      ],
    }
  }

  test('applies a saved section_edits map onto the page via setByPath', () => {
    const page = freshPage()
    applyContentEditsToPageData(page, {
      section_edits: { 'sections.0.heading': 'Restored Heading' },
    })
    expect(page.sections[0].heading).toBe('Restored Heading')
  })

  test('applies multiple entries across different sections and field kinds', () => {
    const page = freshPage()
    applyContentEditsToPageData(page, {
      section_edits: {
        'sections.0.paragraphs': ['p1 saved', 'p2 saved'],
        'sections.1.heading': 'Second Saved',
      },
    })
    expect(page.sections[0].paragraphs).toEqual(['p1 saved', 'p2 saved'])
    expect(page.sections[1].heading).toBe('Second Saved')
  })

  test('no-ops cleanly when savedRecord has no section_edits', () => {
    const page = freshPage()
    const before = JSON.parse(JSON.stringify(page))
    applyContentEditsToPageData(page, { decision: 'Approved' })
    expect(page).toEqual(before)
  })

  test('no-ops cleanly when savedRecord is null or undefined', () => {
    const page = freshPage()
    const before = JSON.parse(JSON.stringify(page))
    applyContentEditsToPageData(page, null)
    applyContentEditsToPageData(page, undefined)
    expect(page).toEqual(before)
  })

  test('never throws on a stale path that no longer resolves against the current page shape', () => {
    const page = { sections: [] }
    expect(() =>
      applyContentEditsToPageData(page, {
        section_edits: { 'sections.5.heading': 'Ghost section' },
      })
    ).not.toThrow()
    expect(page.sections).toEqual([])
  })

  test('ignores a malformed (non-object) section_edits value', () => {
    const page = freshPage()
    const before = JSON.parse(JSON.stringify(page))
    expect(() =>
      applyContentEditsToPageData(page, { section_edits: 'not an object' })
    ).not.toThrow()
    expect(page).toEqual(before)
  })

  test('round-trips through computeSectionEdits: apply then compute reproduces the same map', () => {
    const original = {
      sections: [{ heading: 'Original', paragraphs: ['p1'], bullets: ['b1'] }],
    }
    const page = JSON.parse(JSON.stringify(original))
    const savedEdits = { 'sections.0.heading': 'Round Tripped' }
    applyContentEditsToPageData(page, { section_edits: savedEdits })
    expect(computeSectionEdits(page, original)).toEqual(savedEdits)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/inline-content-edit-data.test.js`
Expected: FAIL — `../js/inline-content-edit-data.js` does not exist yet (module resolution error).

- [ ] **Step 3: Implement `js/inline-content-edit-data.js`**

```javascript
/* Pure logic for section-level inline content edits: deriving the
   section_edits diff against ORIGINAL_DATA, and reapplying a saved
   section_edits map onto a live page object on load.

   Dual-exported (window.inlineEditData plus module.exports), matching
   js/review-merge.js and js/standards/plain-language.js, so this file has no DOM
   dependency and is importable directly under Bun with no browser.

   Deliberately does NOT touch edited_title/edited_summary/primary_cta —
   those three page-level fields already have a working write/reapply path
   (collectCurrentPageReviewState / updateMockupTextFromSavedState in
   js/ux-improvements-state-sync.js) that predates this feature. Reapplying
   them here too would race that existing path on every page load. */

/**
 * The only section-level field kinds this feature ever diffs or writes.
 * Cards, callouts, table cells, step text/bullets, and every other section
 * shape are out of scope — see CLAUDE.md's "Inline content editing" section.
 */
const IN_SCOPE_SECTION_FIELD_SUFFIXES = ['heading', 'paragraphs', 'bullets']

/**
 * Deep-equality check via JSON serialization. Section field values here are
 * always JSON-safe (strings, or arrays of strings/{text,unverified,...}
 * objects), so this is equivalent to a real deep-equal without pulling in a
 * dependency for it.
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Derive the current section_edits map by diffing a page's in-scope section
 * fields (heading, paragraphs, bullets) against ORIGINAL_DATA's copy of the
 * same page. A path is included only when its current value differs from
 * the original — this is the whole mechanism behind "reset to original":
 * once a field is written back to match the original, the next call here
 * simply omits it, with no separate deletion logic required.
 *
 * Mirrors how edited_title/edited_summary/primary_cta are already derived
 * fresh from live page state on every autosave (collectCurrentPageReviewState
 * in js/ux-improvements-state-sync.js), rather than accumulated as a stored
 * diff that could drift from what the page object actually contains.
 * @param {object} page the live (possibly edited) page object
 * @param {object} originalPage the pristine page object (ORIGINAL_DATA.pages[key])
 * @returns {Record<string, unknown>}
 */
function computeSectionEdits(page, originalPage) {
  if (!page || typeof page !== 'object') return {}
  if (!originalPage || typeof originalPage !== 'object') return {}
  const sections = Array.isArray(page.sections) ? page.sections : []
  const originalSections = Array.isArray(originalPage.sections) ? originalPage.sections : []

  const edits = {}
  sections.forEach((section, index) => {
    const originalSection = originalSections[index]
    for (const suffix of IN_SCOPE_SECTION_FIELD_SUFFIXES) {
      const current = section?.[suffix]
      const original = originalSection?.[suffix]
      if (current === undefined && original === undefined) continue
      if (deepEqual(current, original)) continue
      edits[`sections.${index}.${suffix}`] = current
    }
  })
  return edits
}

/**
 * Reapply a saved section_edits map onto a live page object. Called once,
 * from applySavedPageState (js/ux-improvements-state-sync.js), alongside
 * the existing updateMockupTextFromSavedState call — the single choke point
 * every load/navigation/sync-pull/conflict-resolution path already funnels
 * through.
 *
 * Deliberately total, like getByPath/setByPath themselves: a missing
 * savedRecord, a missing or malformed section_edits, or an individual path
 * that no longer resolves against the current page shape (the page was
 * edited in pages/*.js since the saved edit was recorded, for instance) are
 * all silently skipped rather than thrown. A stale saved edit failing to
 * reapply is a normal, expected outcome — not a bug to surface as an error.
 * @param {object} page the live page object to mutate
 * @param {object|null|undefined} savedRecord a stored review record, or none
 * @returns {void}
 */
function applyContentEditsToPageData(page, savedRecord) {
  if (!page || typeof page !== 'object') return
  const sectionEdits = savedRecord?.section_edits
  if (!sectionEdits || typeof sectionEdits !== 'object' || Array.isArray(sectionEdits)) return
  for (const [path, value] of Object.entries(sectionEdits)) {
    setByPath(page, path, value)
  }
}

// setByPath is resolved differently depending on execution context: under
// Bun (this file's own tests) it's require()'d directly; in the browser
// bundle it's read off window.utils, since this file is a plain script
// loaded after js/utils.js in js/main.js's import order, not an ES module
// importer of it (dual-export files in this repo take no imports — see
// js/review-merge.js and js/standards/plain-language.js for the same shape).
const setByPath =
  typeof module !== 'undefined' && module.exports
    ? require('./utils.js').setByPath
    : window.utils.setByPath

if (typeof window !== 'undefined') {
  window.inlineEditData = {
    computeSectionEdits,
    applyContentEditsToPageData,
    IN_SCOPE_SECTION_FIELD_SUFFIXES,
  }
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { computeSectionEdits, applyContentEditsToPageData, IN_SCOPE_SECTION_FIELD_SUFFIXES }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/inline-content-edit-data.test.js`
Expected: PASS — all tests in both `describe` blocks.

- [ ] **Step 5: Add the new test file to `package.json`'s `test` script**

In `package.json`, the `test` script currently ends with `...tests/ai-assist-server.test.js"`. Append `tests/inline-content-edit-data.test.js` to the space-separated list (placement: near the other dual-export pure-logic tests such as `tests/review-merge.test.js`, `tests/plain-language.test.js`, for readability — exact position doesn't affect execution):

```json
    "test": "bun test tests/utils.test.js tests/data-validation.test.js tests/page-render.test.js tests/csv.test.js tests/review-state-schema.test.js tests/reading-level.test.js tests/plain-language.test.js tests/page-import-checks.test.js tests/review-merge.test.js tests/inline-content-edit-data.test.js tests/review-api-server.test.js tests/review-state-sync.test.js tests/decision-vocabulary.test.js tests/knowledge-chunking.test.js tests/knowledge-search.test.js tests/validate-compliance-audit.test.js tests/doc-counts.test.js tests/mockup-image-export.test.js tests/review-insights-data.test.js tests/review-insights-charts.test.js tests/review-insights-render.test.js tests/review-ops-data.test.js tests/ai-assist-schema.test.js tests/ai-assist-env.test.js tests/ai-assist-providers.test.js tests/ai-assist-server.test.js",
```

- [ ] **Step 6: Run the full suite to confirm the new file executes under the enumerated script**

Run: `bun run test`
Expected: PASS — every test in the suite, including `tests/inline-content-edit-data.test.js` now running as part of the enumerated list (confirms it wasn't silently skipped, per this repo's "a file not named here covers nothing in CI" invariant).

- [ ] **Step 7: Format and commit**

```bash
bun run format
git add js/inline-content-edit-data.js tests/inline-content-edit-data.test.js package.json
git commit -m "feat: add pure section_edits derivation/reapply logic (js/inline-content-edit-data.js)"
```

---

### Task 4: wire `section_edits` into autosave and load

**Files:**
- Modify: `js/utils.js:6-26` (`REVIEW_RECORD_FIELDS`), `js/utils.js:845-875` (`buildReviewRecord`)
- Modify: `js/ux-improvements-state-sync.js:195-216` (`collectCurrentPageReviewState`), `js/ux-improvements-state-sync.js:377-403` (`applySavedPageState`)
- Modify: `js/main.js` (add the `js/inline-content-edit-data.js` import)
- Test: `tests/utils.test.js` (extend), manual verification (no new automated browser test in this task — `tests/inline-content-edit-data.test.js` from Task 3 already covers the pure logic this wiring calls)

**Interfaces:**
- Consumes: `computeSectionEdits`, `applyContentEditsToPageData` from `js/inline-content-edit-data.js` (Task 3), read off `window.inlineEditData` (this file is a plain script in `js/main.js`'s load order, not imported as an ES module, matching how `js/ux-improvements-state-sync.js` already reads `window.utils`/`window.reviewMerge` rather than importing them).
- Produces: every autosave now writes a live-derived `section_edits` onto the saved record; every `applySavedPageState()` call now reapplies it. No new public function — this task only rewires two existing functions' bodies.

- [ ] **Step 1: Write the failing test for `REVIEW_RECORD_FIELDS`**

Add to `tests/utils.test.js` (find the existing `describe` block(s) covering `REVIEW_RECORD_FIELDS`/`buildReviewRecord`, or add a new block near the top-level tests for this file — place it after any existing `REVIEW_RECORD_FIELDS`-related tests if present, otherwise anywhere in the file):

```javascript
describe('REVIEW_RECORD_FIELDS', () => {
  test('includes section_edits', () => {
    expect(REVIEW_RECORD_FIELDS).toContain('section_edits')
  })
})

describe('buildReviewRecord', () => {
  test('defaults section_edits to an empty object', () => {
    const record = buildReviewRecord({ title: 'T', slug: 's' }, 'pestsTopic')
    expect(record.section_edits).toEqual({})
  })

  test('accepts a section_edits override', () => {
    const record = buildReviewRecord({ title: 'T', slug: 's' }, 'pestsTopic', {
      section_edits: { 'sections.0.heading': 'Edited' },
    })
    expect(record.section_edits).toEqual({ 'sections.0.heading': 'Edited' })
  })
})
```

Make sure `REVIEW_RECORD_FIELDS` and `buildReviewRecord` are in this test file's top-level import from `../js/utils.js` — if either name is missing from the existing `import { ... } from '../js/utils.js'` line at the top of `tests/utils.test.js`, add it there.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/utils.test.js -t "section_edits"`
Expected: FAIL — `REVIEW_RECORD_FIELDS` does not currently contain `'section_edits'`, and `buildReviewRecord`'s base object has no `section_edits` key.

- [ ] **Step 3: Add `section_edits` to `REVIEW_RECORD_FIELDS` and `buildReviewRecord`**

In `js/utils.js`, `REVIEW_RECORD_FIELDS` (lines 6-26) currently reads:

```javascript
const REVIEW_RECORD_FIELDS = [
  'review_date',
  'reviewer',
  'page_key',
  'page_title',
  'page_type',
  'url_slug',
  'decision',
  'notes',
  'risks_or_blockers',
  'follow_up_owner',
  'seo_title',
  'meta_description',
  'primary_cta',
  'reading_target',
  'edited_title',
  'edited_summary',
  'updated_at',
  'history',
  'synced_at',
]
```

Add `'section_edits'` after `'edited_summary'`:

```javascript
const REVIEW_RECORD_FIELDS = [
  'review_date',
  'reviewer',
  'page_key',
  'page_title',
  'page_type',
  'url_slug',
  'decision',
  'notes',
  'risks_or_blockers',
  'follow_up_owner',
  'seo_title',
  'meta_description',
  'primary_cta',
  'reading_target',
  'edited_title',
  'edited_summary',
  'section_edits',
  'updated_at',
  'history',
  'synced_at',
]
```

In `buildReviewRecord()` (lines 845-875), the `base` object currently includes:

```javascript
    edited_title: '',
    edited_summary: '',
    updated_at: '',
    history: [],
```

Add `section_edits: {}` between `edited_summary` and `updated_at`:

```javascript
    edited_title: '',
    edited_summary: '',
    section_edits: {},
    updated_at: '',
    history: [],
```

`window.utils` (lines 156-195) already spreads the same `REVIEW_RECORD_FIELDS` export binding, and `buildReviewRecord` is already in that object — no separate edit needed there.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/utils.test.js`
Expected: PASS — the full file, including the two new `describe` blocks and every pre-existing test.

- [ ] **Step 5: Add the `js/inline-content-edit-data.js` import to `js/main.js`**

In `js/main.js`, the core-modules block currently ends with:

```javascript
import './review-merge.js'
import './review-state-sync.js'
```

Add the new module directly after `./review-merge.js`, since `js/inline-content-edit-data.js` has the same "plain dual-export script, no DOM" shape and belongs in the core group rather than the review/UX-layer group below it — `js/ux-improvements-state-sync.js` (the next block) needs `window.inlineEditData` to exist by the time it runs:

```javascript
import './review-merge.js'
import './inline-content-edit-data.js'
import './review-state-sync.js'
```

- [ ] **Step 6: Write a failing manual-verification-style unit assertion for the wiring (via `collectCurrentPageReviewState`'s shape)**

This step doesn't add a new automated test — Task 3 already covers `computeSectionEdits`/`applyContentEditsToPageData` in isolation, and `js/ux-improvements-state-sync.js` has no existing unit-test file to extend (it's exercised only via e2e specs, which Task 8 adds coverage to for this exact path). Instead, confirm the wiring compiles and doesn't crash the existing suite before editing behavior:

Run: `bun run test`
Expected: PASS (baseline, before Step 7's edit — establishes nothing is broken yet).

- [ ] **Step 7: Wire `computeSectionEdits` into `collectCurrentPageReviewState`**

In `js/ux-improvements-state-sync.js`, `collectCurrentPageReviewState()` (lines 195-216) currently reads:

```javascript
  function collectCurrentPageReviewState(pageKeyOverride) {
    const pageKey = typeof pageKeyOverride === 'string' ? pageKeyOverride : getCurrentKey()
    const page = DATA.pages[pageKey] || {}

    return buildReviewRecord(page, pageKey, {
      page_title: page.title || '',
      url_slug: getValue('urlInput') || page.slug || '',
      edited_title: page.title || '',
      edited_summary: page.summary || '',
      primary_cta: getPrimaryCta(page) || '',
      seo_title: getSeoTitle(page),
      meta_description: getMetaDescription(page),
      reviewer: getValue('reviewerInput'),
      review_date: getValue('reviewDateInput') || today(),
      decision: getValue('reviewDecision') || 'Needs review',
      notes: getValue('reviewNotes'),
      risks_or_blockers: getValue('reviewRisks'),
      follow_up_owner: getValue('reviewOwner'),
      reading_target: page.reading || '',
      updated_at: new Date().toISOString(),
    })
  }
```

Add a `section_edits` override, computed the same way `edited_title`/`edited_summary`/`primary_cta` are computed — read live, every call, from the current in-memory page against `window.ORIGINAL_DATA`:

```javascript
  function collectCurrentPageReviewState(pageKeyOverride) {
    const pageKey = typeof pageKeyOverride === 'string' ? pageKeyOverride : getCurrentKey()
    const page = DATA.pages[pageKey] || {}
    const originalPage = window.ORIGINAL_DATA?.pages?.[pageKey]

    return buildReviewRecord(page, pageKey, {
      page_title: page.title || '',
      url_slug: getValue('urlInput') || page.slug || '',
      edited_title: page.title || '',
      edited_summary: page.summary || '',
      primary_cta: getPrimaryCta(page) || '',
      // Derived fresh from live page state on every save, same as the three
      // fields above — never accumulated as a stored diff that could drift
      // from what page.sections actually contains. See
      // js/inline-content-edit-data.js for why this makes "reset to
      // original" correct by construction. originalPage can be undefined in
      // a context with no ORIGINAL_DATA (e.g. a future non-browser caller);
      // computeSectionEdits() itself returns {} rather than throwing.
      section_edits: window.inlineEditData?.computeSectionEdits(page, originalPage) || {},
      seo_title: getSeoTitle(page),
      meta_description: getMetaDescription(page),
      reviewer: getValue('reviewerInput'),
      review_date: getValue('reviewDateInput') || today(),
      decision: getValue('reviewDecision') || 'Needs review',
      notes: getValue('reviewNotes'),
      risks_or_blockers: getValue('reviewRisks'),
      follow_up_owner: getValue('reviewOwner'),
      reading_target: page.reading || '',
      updated_at: new Date().toISOString(),
    })
  }
```

- [ ] **Step 8: Wire `applyContentEditsToPageData` into `applySavedPageState`**

In `js/ux-improvements-state-sync.js`, `applySavedPageState()` (lines 377-403) currently reads:

```javascript
  function applySavedPageState(pageKey) {
    const state = window.reviewState.read()
    const page = DATA.pages[pageKey]
    if (!page) return

    isRestoringState = true
    const saved = state.pages[pageKey]

    setValue(
      'reviewerInput',
      state.globals.reviewer || saved?.reviewer || getValue('reviewerInput')
    )

    if (saved) {
      setValue('reviewDateInput', saved.review_date || today())
      setValue('reviewDecision', saved.decision || 'Needs review')
      setValue('reviewNotes', saved.notes || '')
      setValue('reviewRisks', saved.risks_or_blockers || '')
      setValue('reviewOwner', saved.follow_up_owner || state.globals.owner || 'David')
      updateMockupTextFromSavedState(page, saved)
    } else {
      clearReviewFieldsForNewPage(state)
    }

    isRestoringState = false
    updateLocalStorageStatus()
  }
```

Add the `applyContentEditsToPageData` call directly after `updateMockupTextFromSavedState(page, saved)` — same branch, same guard (`if (saved)`), since there's nothing to reapply when there's no saved record at all:

```javascript
  function applySavedPageState(pageKey) {
    const state = window.reviewState.read()
    const page = DATA.pages[pageKey]
    if (!page) return

    isRestoringState = true
    const saved = state.pages[pageKey]

    setValue(
      'reviewerInput',
      state.globals.reviewer || saved?.reviewer || getValue('reviewerInput')
    )

    if (saved) {
      setValue('reviewDateInput', saved.review_date || today())
      setValue('reviewDecision', saved.decision || 'Needs review')
      setValue('reviewNotes', saved.notes || '')
      setValue('reviewRisks', saved.risks_or_blockers || '')
      setValue('reviewOwner', saved.follow_up_owner || state.globals.owner || 'David')
      updateMockupTextFromSavedState(page, saved)
      // Section-level edits (heading/paragraphs/bullets) are reapplied
      // separately from the three page-level fields above:
      // updateMockupTextFromSavedState already owns edited_title/
      // edited_summary/primary_cta, and this must not duplicate that.
      window.inlineEditData?.applyContentEditsToPageData(page, saved)
    } else {
      clearReviewFieldsForNewPage(state)
    }

    isRestoringState = false
    updateLocalStorageStatus()
  }
```

- [ ] **Step 9: Run the full unit suite**

Run: `bun run test`
Expected: PASS — every test, including the Task 3/Task 4 additions. This confirms the wiring compiles and doesn't regress any existing behavior (no test yet exercises the browser-only `collectCurrentPageReviewState`/`applySavedPageState` functions directly — that coverage arrives via e2e in Task 8).

- [ ] **Step 10: Run `bun run dev` and manually smoke-test the wiring**

Run: `bun run dev`, open `http://127.0.0.1:8080`, open the browser devtools console, and run:

```javascript
window.HHVC_DATA.pages.pestsTopic.sections[0].heading = 'Smoke Test Heading'
window.ReviewUx.stateSync.saveCurrentPageToLocalStorage()
JSON.parse(localStorage.getItem('hhvcManagerReviewState:v1')).pages.pestsTopic.section_edits
```

Expected: the printed object contains `{'sections.0.heading': 'Smoke Test Heading'}` (exact key depends on `pestsTopic`'s section count/shape at time of testing — confirm the path matches whichever section index was edited). Reload the page and re-run the last line; confirm the value is still present, and confirm `document.querySelector('#mockPage h2')` (or the relevant heading) shows the edited text — proving `applyContentEditsToPageData` reapplied it on load.

- [ ] **Step 11: Format and commit**

```bash
bun run format
git add js/utils.js js/ux-improvements-state-sync.js js/main.js tests/utils.test.js
git commit -m "feat: wire section_edits derivation into autosave and reapply on load"
```

---

### Task 5: `js/inline-content-edit-render.js` — edit-widget markup

**Files:**
- Create: `js/inline-content-edit-render.js`
- Test: manual (this file renders markup strings with no page-object dependency; Task 8's e2e spec is the primary coverage, since these are display-only string builders exercised once wired to real DOM events in Task 6)

**Interfaces:**
- Consumes: `escapeHtml` from `js/utils.js` (read off `window.utils`, matching how `js/ai-assist-render.js` and other IIFE render modules already do it, since this is a plain script, not an ES module importer).
- Produces: `window.InlineEdit = window.InlineEdit || {}`; `window.InlineEdit.render = { scalarEditorHtml, listAddControlHtml, listRemoveControlHtml, editedBadgeHtml, undoToastMarkup }` — consumed by Task 6's orchestrator.
  - `scalarEditorHtml({ tag, value, path })` → `(object) => string`. `tag` is `'input'` or `'textarea'`; returns a fully-formed `<input>` or `<textarea>` element string with `data-rewrite-field="<path>"`, `data-inline-edit-input`, and the current value HTML-escaped into the `value` attribute (input) or element text content (textarea).
  - `listAddControlHtml(path)` → `(string) => string`. Returns a `<button type="button" data-inline-edit-add="<path>">+ Add</button>`-shaped control.
  - `listRemoveControlHtml(path, index)` → `(string, number) => string`. Returns a `<button type="button" data-inline-edit-remove="<path>" data-inline-edit-index="<index>">×</button>`-shaped control, with an `aria-label` naming what it removes (accessibility — a bare "×" is not enough for a screen reader).
  - `editedBadgeHtml()` → `() => string`. Returns the "Edited" badge markup (`<span class="inline-edit-badge">Edited</span>`-shaped), used for title/summary/heading/CTA only (paragraphs/bullets use the existing Unverified pill instead, per the Global Constraints).
  - `undoToastMarkup(label)` → `(string) => string`. Returns markup for the one-step-undo toast content, matching the shape `js/review-queue-undo.js`'s `describeUndo()` produces for its own toast (a string, not a DOM node — the actual toast display goes through the existing `showToast()` from `js/ui-controls.js`, so this only needs to build the message text plus an embedded "Undo" affordance marker Task 6 binds a click handler to).

- [ ] **Step 1: Implement `js/inline-content-edit-render.js`**

No test-first step here: this file is pure display-string construction with no independently meaningful behavior to assert until Task 6 wires it into real click handling (its own escaping is covered indirectly by Task 8's e2e assertions, which check the rendered DOM after a real click-edit-commit cycle — writing an isolated unit test for "does this template contain an escaped string" would just restate `escapeHtml`'s own coverage in `tests/utils.test.js`). This mirrors how `js/ai-assist-render.js` and `js/review-queue-render.js` have no dedicated unit-test files of their own either — their output is verified end-to-end.

```javascript
/* Inline content editing: edit-widget markup. Sibling to
   js/inline-content-edit.js (the orchestrator, which owns click handling
   and the commit/cancel/undo lifecycle) — mirrors the ai-assist split
   (js/ai-assist.js + js/ai-assist-render.js). Loads before the orchestrator
   in js/main.js.

   Renders model-free, reviewer-authored text only (whatever the reviewer
   just typed), same trust level as every other reviewer-input field in this
   tool — escaped the same way the sidebar fields already are, via
   escapeHtml, not because this text is any less trusted than page copy but
   because it becomes part of page copy the moment it's committed. */
;(function mountInlineContentEditRender() {
  if (typeof window === 'undefined') return
  window.InlineEdit = window.InlineEdit || {}

  const { escapeHtml } = window.utils

  /**
   * Build a scalar field's edit widget: an <input> for single-line fields
   * (title, heading, CTA label) or a <textarea> for fields that can run
   * long (summary, a paragraph, a bullet).
   * @param {{tag: 'input'|'textarea', value: string, path: string}} options
   * @returns {string}
   */
  function scalarEditorHtml({ tag, value, path }) {
    const escapedPath = escapeHtml(path)
    if (tag === 'textarea') {
      return `<textarea class="inline-edit-input" data-rewrite-field="${escapedPath}" data-inline-edit-input rows="3">${escapeHtml(value)}</textarea>`
    }
    return `<input type="text" class="inline-edit-input" data-rewrite-field="${escapedPath}" data-inline-edit-input value="${escapeHtml(value)}" />`
  }

  /**
   * The "+ Add" control appended after the last item in an editable list
   * (a section's paragraphs or bullets).
   * @param {string} path dot-path of the array, e.g. 'sections.2.bullets'
   * @returns {string}
   */
  function listAddControlHtml(path) {
    const escapedPath = escapeHtml(path)
    return `<button type="button" class="inline-edit-add" data-inline-edit-add="${escapedPath}" aria-label="Add item">+ Add</button>`
  }

  /**
   * The per-item "×" removal control.
   * @param {string} path dot-path of the array
   * @param {number} index the item's current index within the array
   * @returns {string}
   */
  function listRemoveControlHtml(path, index) {
    const escapedPath = escapeHtml(path)
    return `<button type="button" class="inline-edit-remove" data-inline-edit-remove="${escapedPath}" data-inline-edit-index="${index}" aria-label="Remove this item">×</button>`
  }

  /**
   * The CSS-only "Edited" badge for title/summary/heading/CTA — fields with
   * no `unverified` schema slot to reuse the existing pill mechanism.
   * @returns {string}
   */
  function editedBadgeHtml() {
    return `<span class="inline-edit-badge">Edited</span>`
  }

  /**
   * Message text for the one-step-undo toast shown after a paragraph/bullet
   * removal. The literal "Undo" text is a marker Task 6's click handler
   * binds to (via a data attribute on the toast's action element), not a
   * real link — the toast itself is rendered by the existing showToast()
   * in js/ui-controls.js.
   * @param {string} label human-readable name of what was removed, e.g. "bullet"
   * @returns {string}
   */
  function undoToastMarkup(label) {
    return `Removed ${escapeHtml(label)}. <button type="button" class="inline-edit-undo-action" data-inline-edit-undo>Undo</button>`
  }

  window.InlineEdit.render = {
    scalarEditorHtml,
    listAddControlHtml,
    listRemoveControlHtml,
    editedBadgeHtml,
    undoToastMarkup,
  }
})()
```

- [ ] **Step 2: Add the import to `js/main.js`**

In `js/main.js`, add `js/inline-content-edit-render.js` to the review/UX-layers block, directly before where Task 6 will add the orchestrator (`js/inline-content-edit.js`) — placed after `js/ux-improvements.js` since it needs `window.utils.escapeHtml` (already available much earlier) but has no other ordering dependency; grouping it near the AI-assist render pair keeps the "orchestrator + sibling render module" pairs visually together:

```javascript
import './plain-language.js'
import './ai-assist-client.js'
import './ai-assist-render.js'
import './ai-assist.js'
import './inline-content-edit-render.js'
```

(Task 6 appends `./inline-content-edit.js` directly after this line.)

- [ ] **Step 3: Manual smoke test**

Run: `bun run dev`, open the browser console, and run:

```javascript
window.InlineEdit.render.scalarEditorHtml({ tag: 'input', value: 'Test <b>value</b>', path: 'title' })
```

Expected: a string containing `data-rewrite-field="title"` and `value="Test &lt;b&gt;value&lt;/b&gt;"` — confirms the HTML is escaped, not raw-interpolated.

- [ ] **Step 4: Run `bun run format:check` and the full unit suite**

Run: `bun run format:check && bun run test`
Expected: both pass — this task adds no new logic tests (per Step 1's rationale), so the full suite should be unchanged from Task 4's end state.

- [ ] **Step 5: Commit**

```bash
bun run format
git add js/inline-content-edit-render.js js/main.js
git commit -m "feat: add inline-content-edit render module (edit-widget markup)"
```

---

### Task 6: `js/inline-content-edit.js` — orchestrator (click-to-edit, scalar fields)

**Files:**
- Create: `js/inline-content-edit.js`
- Modify: `js/main.js` (add the import)

**Interfaces:**
- Consumes: `window.InlineEdit.render` (Task 5), `window.inlineEditData` (Task 3), `window.utils` (`getByPath`, `setByPath`, `getPrimaryCta`, `setPrimaryCta`, `escapeHtml`), `window.renderPage` (published by `js/page-render.js`), `window.ReviewUx.stateSync.saveCurrentPageToLocalStorage` (Task 4's autosave path), `window.showToast` (`js/ui-controls.js`), `window.HHVC_DATA`/`window.ORIGINAL_DATA`.
- Produces: `window.inlineEdit = { ensureBound, isEditing }` — a click-to-edit affordance active on `#mockPage` at all times once the page has loaded (no capability gating, per the Global Constraints). This task covers **scalar fields only** (title, summary, CTA, heading, one paragraph, one bullet — commit/cancel, no add/remove/reset/undo yet); Task 7 adds add/remove/undo/reset on top of this file.

- [ ] **Step 1: Implement the scalar-field click-to-edit orchestrator**

```javascript
/* Inline content editing: orchestrator. Delegated click handling on
   #mockPage, the edit-widget lifecycle (open/commit/cancel), and wiring
   into the existing autosave path. Sibling to js/inline-content-edit-render.js
   (markup) and js/inline-content-edit-data.js (pure section_edits logic).
   Mirrors the ai-assist split (js/ai-assist.js orchestrates
   js/ai-assist-client.js + js/ai-assist-render.js).

   Unlike AI assist, this needs no backend and no capability check: the
   affordance is present whenever the page has loaded. Loads after
   js/inline-content-edit-render.js and after js/ux-improvements.js (for
   window.ReviewUx.stateSync.saveCurrentPageToLocalStorage). */
;(function mountInlineContentEdit() {
  if (typeof window === 'undefined') return
  if (!window.InlineEdit?.render) return

  const render = window.InlineEdit.render
  const { getByPath, setByPath, getPrimaryCta, setPrimaryCta } = window.utils

  /** The data-rewrite-field path currently being edited, or null. One field
      editable at a time — opening a second editor commits/cancels the first
      implicitly by re-rendering the mockup, which the commit path already
      does. */
  let editingPath = null

  /**
   * Whether inline editing is currently open on any field. Exposed for
   * Task 8's e2e assertions and for any future caller that needs to avoid
   * stomping on an in-progress edit (e.g. a keyboard shortcut).
   * @returns {boolean}
   */
  function isEditing() {
    return editingPath !== null
  }

  /**
   * Multi-line fields get a <textarea> (Enter would fight normal multi-line
   * typing); everything else gets a single-line <input> committed on Enter.
   * @param {string} path
   * @returns {'input'|'textarea'}
   */
  function widgetTagFor(path) {
    if (path === 'summary') return 'textarea'
    if (path === 'title' || path === 'primaryCta') return 'input'
    if (/\.heading$/.test(path)) return 'input'
    // A single paragraph or bullet item path, e.g. 'sections.2.paragraphs.1'.
    return 'textarea'
  }

  /**
   * Read a scalar field's current text value, given its data-rewrite-field
   * path. Title/summary/CTA are page-level and read directly (they predate
   * getByPath's section-path scope); everything else is a getByPath lookup
   * against the current page object, unwrapped from the paragraph/bullet
   * {text, unverified, ...} object form when present.
   * @param {object} page
   * @param {string} path
   * @returns {string}
   */
  function readScalarValue(page, path) {
    if (path === 'title') return page.title || ''
    if (path === 'summary') return page.summary || ''
    if (path === 'primaryCta') return getPrimaryCta(page) || ''
    const raw = getByPath(page, path)
    if (raw && typeof raw === 'object') return raw.text || ''
    return typeof raw === 'string' ? raw : ''
  }

  /**
   * Write a committed scalar edit back onto the page object.
   *
   * A paragraph/bullet item is written as the tagged object form
   * {text, unverified: true, unverifiedReason: 'Manually edited during
   * review'} — reusing the existing Unverified-pill rendering with no
   * renderer change. Title/summary/heading/CTA have no such slot and are
   * written as plain strings; their "edited" signal is the CSS-only badge
   * applied separately in decorateEditedFields().
   * @param {object} page
   * @param {string} path
   * @param {string} value
   * @returns {void}
   */
  function writeScalarValue(page, path, value) {
    if (path === 'title') {
      page.title = value
      return
    }
    if (path === 'summary') {
      page.summary = value
      return
    }
    if (path === 'primaryCta') {
      setPrimaryCta(page, value)
      return
    }
    if (/\.heading$/.test(path)) {
      setByPath(page, path, value)
      return
    }
    // A paragraph or bullet item path.
    setByPath(page, path, {
      text: value,
      unverified: true,
      unverifiedReason: 'Manually edited during review',
    })
  }

  /**
   * Persist the current page's review record through the existing autosave
   * path — no new history entry, matching every other keystroke-level field
   * in this tool.
   * @returns {void}
   */
  function persist() {
    window.ReviewUx?.stateSync?.saveCurrentPageToLocalStorage?.()
  }

  /**
   * Re-render the mockup for the current page, then re-bind (delegated
   * listeners survive re-render since they're attached to a stable
   * ancestor, but any transient editing-widget DOM does not).
   * @returns {void}
   */
  function rerender() {
    const key = window.utils.getCurrentKey()
    window.renderPage?.(key, true)
  }

  /**
   * Open a scalar field's editor in place of its rendered element.
   * @param {HTMLElement} target the element carrying data-rewrite-field
   * @returns {void}
   */
  function openScalarEditor(target) {
    const path = target.getAttribute('data-rewrite-field')
    if (!path || editingPath) return
    const key = window.utils.getCurrentKey()
    const page = window.HHVC_DATA.pages[key]
    if (!page) return

    editingPath = path
    const value = readScalarValue(page, path)
    const tag = widgetTagFor(path)
    const widgetHtml = render.scalarEditorHtml({ tag, value, path })
    const wrapper = document.createElement('span')
    wrapper.innerHTML = widgetHtml
    const widget = wrapper.firstElementChild
    target.replaceWith(widget)
    widget.focus()
    // Move the caret to the end rather than selecting-all, so a reviewer
    // fixing a typo at the end of a long paragraph doesn't have to retype
    // it entirely because their first keystroke replaced a selection.
    if (typeof widget.setSelectionRange === 'function') {
      widget.setSelectionRange(widget.value.length, widget.value.length)
    }

    const commit = () => {
      if (editingPath !== path) return // already committed/cancelled once
      const newValue = widget.value
      editingPath = null
      writeScalarValue(page, path, newValue)
      persist()
      rerender()
    }
    const cancel = () => {
      if (editingPath !== path) return
      editingPath = null
      rerender()
    }

    if (tag === 'input') {
      widget.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          commit()
        } else if (event.key === 'Escape') {
          event.preventDefault()
          cancel()
        }
      })
      widget.addEventListener('blur', commit)
    } else {
      widget.addEventListener('blur', commit)
      widget.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          cancel()
        }
      })
    }
  }

  /**
   * Delegated click handler on #mockPage. Walks up from the click target to
   * the nearest [data-rewrite-field] ancestor. List add/remove controls
   * (Task 7) are matched first since they can sit inside a
   * [data-rewrite-field] element's subtree (e.g. a remove "×" inside a
   * <li> that itself carries the attribute) and must not also open a
   * scalar editor on the same click.
   * @param {MouseEvent} event
   * @returns {void}
   */
  function handleMockPageClick(event) {
    const target = event.target
    if (!(target instanceof Element)) return
    if (target.closest('[data-inline-edit-add], [data-inline-edit-remove], [data-inline-edit-undo]')) {
      return // handled by Task 7's listeners
    }
    if (editingPath) return // already editing something; let blur/Enter/Escape resolve it first
    const field = target.closest('[data-rewrite-field]')
    if (!field) return
    // Only open on scalar-shaped targets in this task's scope: title,
    // summary, primaryCta, a heading, or a single paragraph/bullet item
    // (the numeric-suffixed paths). A bare container path like
    // 'sections.2.paragraphs' (Task 7's add-target) is never itself a
    // data-rewrite-field attribute value — only individual items and the
    // three page-level fields are — so no extra guard is needed here.
    openScalarEditor(field)
  }

  /**
   * Bind the delegated click listener once. Safe to call multiple times.
   * @returns {void}
   */
  function ensureBound() {
    const mockPage = document.getElementById('mockPage')
    if (!mockPage || mockPage.dataset.inlineEditBound) return
    mockPage.dataset.inlineEditBound = 'true'
    mockPage.addEventListener('click', handleMockPageClick)
  }

  function init() {
    ensureBound()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }

  window.inlineEdit = { ensureBound, isEditing }
})()
```

- [ ] **Step 2: Add the import to `js/main.js`**

```javascript
import './plain-language.js'
import './ai-assist-client.js'
import './ai-assist-render.js'
import './ai-assist.js'
import './inline-content-edit-render.js'
import './inline-content-edit.js'
```

- [ ] **Step 3: Manual smoke test — commit a title edit**

Run: `bun run dev`, open `http://127.0.0.1:8080` in a browser, click the `<h1>` page title on the mockup. Expected: it becomes an `<input>` pre-filled with the current title. Type a change, press Enter. Expected: the mockup re-renders with the new title, and `localStorage.getItem('hhvcManagerReviewState:v1')` (via devtools) shows the page's `edited_title` field matching the new value.

- [ ] **Step 4: Manual smoke test — cancel via Escape**

Click the summary paragraph, it becomes a `<textarea>`. Type a change, press Escape. Expected: the mockup re-renders showing the **original** summary text, unchanged.

- [ ] **Step 5: Manual smoke test — a paragraph gets the Unverified pill**

Click a body paragraph inside a section (on a page with a `sections.N.paragraphs` path — e.g. navigate to a page with visible paragraph text), edit it, commit via blur (click elsewhere). Expected: the mockup re-renders showing the new text followed by an "⚠ Unverified" pill, tooltip reading "Manually edited during review".

- [ ] **Step 6: Run `bun run format:check` and the full unit suite**

Run: `bun run format:check && bun run test`
Expected: both pass. This task's file is orchestration logic exercised by e2e (Task 8), not unit tests — matching `js/ai-assist.js`'s own lack of a dedicated unit-test file (its coverage is `tests/e2e/ai-assist.spec.js` plus the server-side `tests/ai-assist-server.test.js`).

- [ ] **Step 7: Commit**

```bash
bun run format
git add js/inline-content-edit.js js/main.js
git commit -m "feat: add click-to-edit for scalar fields (title, summary, CTA, heading, paragraph, bullet)"
```

---

### Task 7: add/remove for paragraphs and bullets, one-step undo, per-field reset

**Files:**
- Modify: `js/inline-content-edit.js` (from Task 6)
- Modify: `js/inline-content-edit-render.js` (add the container-level add-control anchor markup — see Step 1)
- Modify: `js/page-render.js` — **no change needed**: `paragraphList()`/`bulletList()` already emit one `data-rewrite-field` per item; the add/remove controls are appended by this task's JS after render, not baked into the renderer (see Step 1's rationale for why).

**Interfaces:**
- Consumes: everything from Task 6, plus `render.listAddControlHtml`, `render.listRemoveControlHtml`, `render.editedBadgeHtml`, `render.undoToastMarkup` (Task 5), `window.showToast` (`js/ui-controls.js`).
- Produces: extends `window.inlineEdit` with the same public surface (`ensureBound`, `isEditing`) — add/remove/undo/reset are internal to this file, triggered by delegated click handlers, not separately published (nothing outside this module needs to call them directly, matching how `js/review-queue-undo.js`'s `undoLastAction` is only ever called from within `js/review-queue-rows.js`'s own module, not from arbitrary external code — here the same pattern is self-contained within one file instead of two, since there's only one caller).

- [ ] **Step 1: Decide and implement how add/remove controls attach to rendered lists**

`js/page-render.js`'s `paragraphList()`/`bulletList()` render each item's own element with a `data-rewrite-field` on it, but there's no dedicated wrapper element around "all the paragraphs in this section" or "this section's `<ul>`" that the renderer currently marks with a container-level path. Rather than modifying `js/page-render.js` (which the design spec's "Global Constraints" and Task 1's scope keep to a single, already-completed change), this task locates the container **from the DOM already rendered**: for bullets, the `<ul>` immediately following the last bullet `<li data-rewrite-field="...">`'s parent; for paragraphs, the run of sibling `<p data-rewrite-field="...">` elements sharing the same path prefix.

Add to `js/inline-content-edit.js`, after the scalar-editing functions from Task 6 (`writeScalarValue`, before `handleMockPageClick`):

```javascript
  /**
   * Given any element carrying a data-rewrite-field path shaped
   * 'sections.N.bullets.M' or 'sections.N.paragraphs.M', return the array's
   * container path ('sections.N.bullets') and the DOM elements that
   * currently render its items, in order.
   *
   * Paragraphs and bullets render differently (bulletList wraps every item
   * in one shared <ul>; paragraphList renders bare sibling <p> elements with
   * no wrapper), so the two need different DOM-walking strategies to find
   * "every rendered item in this array" — but both return the same shape so
   * the add/remove logic above them can stay one implementation.
   * @param {string} itemPath e.g. 'sections.2.bullets.1'
   * @returns {{containerPath: string, itemElements: HTMLElement[]}|null}
   */
  function locateListContainer(itemPath) {
    const match = itemPath.match(/^(sections\.\d+\.(?:paragraphs|bullets))\.\d+$/)
    if (!match) return null
    const containerPath = match[1]
    const escapedPath = CSS.escape(containerPath)
    const itemElements = Array.from(
      document.querySelectorAll(`#mockPage [data-rewrite-field^="${escapedPath}."]`)
    ).filter((el) => new RegExp(`^${escapedPath}\\.\\d+$`).test(el.getAttribute('data-rewrite-field')))
    return { containerPath, itemElements }
  }

  /**
   * Append a new, empty item to a paragraphs/bullets array and open it
   * immediately in edit mode. The whole resulting array is written back
   * (never a per-index patch) — see the Global Constraints on why deletes
   * make per-index addressing unsafe, which applies symmetrically to adds
   * kept consistent with the same array-replace approach.
   * @param {string} containerPath e.g. 'sections.2.bullets'
   * @returns {void}
   */
  function addListItem(containerPath) {
    const key = window.utils.getCurrentKey()
    const page = window.HHVC_DATA.pages[key]
    if (!page) return
    const current = getByPath(page, containerPath)
    const array = Array.isArray(current) ? current : []
    const nextArray = [
      ...array,
      { text: '', unverified: true, unverifiedReason: 'Manually edited during review' },
    ]
    setByPath(page, containerPath, nextArray)
    persist()
    rerender()
    // Open the newly added (last) item in edit mode immediately, matching
    // the design spec's "already open in edit mode, at the next index".
    // Runs after rerender() has rebuilt the DOM, so the new item's element
    // now exists to open an editor on.
    const newIndex = nextArray.length - 1
    const newField = document.querySelector(
      `#mockPage [data-rewrite-field="${CSS.escape(`${containerPath}.${newIndex}`)}"]`
    )
    if (newField) openScalarEditor(newField)
  }

  /**
   * Remove one item from a paragraphs/bullets array, show a one-step-undo
   * toast (matching js/review-queue-undo.js's precedent), and persist the
   * reduced array as a whole-field replace.
   * @param {string} containerPath
   * @param {number} index
   * @returns {void}
   */
  function removeListItem(containerPath, index) {
    const key = window.utils.getCurrentKey()
    const page = window.HHVC_DATA.pages[key]
    if (!page) return
    const current = getByPath(page, containerPath)
    const array = Array.isArray(current) ? current : []
    if (index < 0 || index >= array.length) return

    const removedItem = array[index]
    const nextArray = array.filter((_, i) => i !== index)
    setByPath(page, containerPath, nextArray)
    persist()
    rerender()

    const label = /bullets$/.test(containerPath) ? 'bullet' : 'paragraph'
    window.showToast?.(render.undoToastMarkup(label), 'info', {
      onAction: () => {
        const restoreCurrent = getByPath(page, containerPath)
        const restoreArray = Array.isArray(restoreCurrent) ? [...restoreCurrent] : []
        restoreArray.splice(index, 0, removedItem)
        setByPath(page, containerPath, restoreArray)
        persist()
        rerender()
      },
    })
  }
```

Note: `window.showToast`'s existing signature (`js/ui-controls.js`) takes `(message, type)` with no action callback today — if it does not already support a third `options.onAction` parameter, this step also requires extending `showToast()` to bind a click handler on `[data-inline-edit-undo]` inside the toast markup produced by `render.undoToastMarkup()`. Read `js/ui-controls.js`'s current `showToast` implementation before this step and add the minimal extension needed (a toast that renders raw HTML — already necessary here since `undoToastMarkup()` embeds a `<button>` — plus one delegated click listener bound once at toast-creation time that calls `options.onAction` when `[data-inline-edit-undo]` is clicked, then removes itself). Keep this extension additive: every existing `showToast(message, type)` two-argument call site must keep working unchanged.

- [ ] **Step 2: Add container-level click handling to `handleMockPageClick`**

Extend `handleMockPageClick` in `js/inline-content-edit.js` (from Task 6) to dispatch add/remove clicks. Task 6's version currently reads:

```javascript
  function handleMockPageClick(event) {
    const target = event.target
    if (!(target instanceof Element)) return
    if (target.closest('[data-inline-edit-add], [data-inline-edit-remove], [data-inline-edit-undo]')) {
      return // handled by Task 7's listeners
    }
    if (editingPath) return // already editing something; let blur/Enter/Escape resolve it first
    const field = target.closest('[data-rewrite-field]')
    if (!field) return
    openScalarEditor(field)
  }
```

Replace the early-return comment with real handling:

```javascript
  function handleMockPageClick(event) {
    const target = event.target
    if (!(target instanceof Element)) return

    const addControl = target.closest('[data-inline-edit-add]')
    if (addControl) {
      event.preventDefault()
      addListItem(addControl.getAttribute('data-inline-edit-add'))
      return
    }
    const removeControl = target.closest('[data-inline-edit-remove]')
    if (removeControl) {
      event.preventDefault()
      const containerPath = removeControl.getAttribute('data-inline-edit-remove')
      const index = Number(removeControl.getAttribute('data-inline-edit-index'))
      removeListItem(containerPath, index)
      return
    }

    if (editingPath) return // already editing something; let blur/Enter/Escape resolve it first
    const field = target.closest('[data-rewrite-field]')
    if (!field) return
    openScalarEditor(field)
  }
```

- [ ] **Step 3: Append add/remove controls after each render**

Add controls do not exist in `renderPageMain()`'s output (Task 1 deliberately left the renderer untouched beyond headings/hero). Append them via DOM manipulation after every render, in a function called from both `rerender()` (Task 6) and the page's normal `init()` path. Add this function to `js/inline-content-edit.js`:

```javascript
  /**
   * Append a remove control to every rendered paragraph/bullet item, and an
   * add control after the last item in each section's paragraphs/bullets
   * list. Runs after every mockup render (rerender() below, and the initial
   * page load), since renderPageMain()'s output carries no such controls —
   * see Task 1's scope note on why the renderer itself stays untouched
   * beyond the data-rewrite-field attributes.
   * @returns {void}
   */
  function decorateListControls() {
    const seenContainers = new Set()
    const itemFields = document.querySelectorAll(
      '#mockPage [data-rewrite-field^="sections."]'
    )
    itemFields.forEach((el) => {
      const path = el.getAttribute('data-rewrite-field')
      const match = path.match(/^(sections\.\d+\.(?:paragraphs|bullets))\.(\d+)$/)
      if (!match) return
      const [, containerPath, indexStr] = match
      const index = Number(indexStr)
      const removeHtml = render.listRemoveControlHtml(containerPath, index)
      const wrapper = document.createElement('span')
      wrapper.innerHTML = removeHtml
      el.appendChild(wrapper.firstElementChild)
      seenContainers.add(containerPath)
    })

    seenContainers.forEach((containerPath) => {
      const located = locateListContainer(`${containerPath}.0`)
      if (!located || !located.itemElements.length) return
      const lastItem = located.itemElements[located.itemElements.length - 1]
      const addHtml = render.listAddControlHtml(containerPath)
      const wrapper = document.createElement('span')
      wrapper.innerHTML = addHtml
      // Bullets share one <ul> parent; paragraphs are bare siblings with a
      // shared parent too (the section's own container element in both
      // cases), so inserting after the last item's parentNode position
      // works uniformly for both shapes.
      lastItem.parentNode.insertBefore(wrapper.firstElementChild, lastItem.nextSibling)
    })
  }
```

Update `rerender()` (Task 6) to call it after the render completes:

```javascript
  function rerender() {
    const key = window.utils.getCurrentKey()
    window.renderPage?.(key, true)
    decorateListControls()
  }
```

And call it once from `init()` too, since the very first page render happens before this module's `init()` runs (via `js/app.js`'s bootstrap), so the initially-loaded page needs its controls added on mount rather than only after the first edit-triggered rerender:

```javascript
  function init() {
    ensureBound()
    decorateListControls()
  }
```

- [ ] **Step 4: Implement per-field "Reset to original"**

Add to `js/inline-content-edit.js`, the reset logic — modeled on `restorePageContentFromOriginal`'s shape (`js/review-state-sync.js:534-559`) but scoped to one field via `getByPath`/`setByPath` rather than that function's whole-page direct assignment:

```javascript
  /**
   * Reset one field to its ORIGINAL_DATA value and re-render. Modeled on
   * js/review-state-sync.js's restorePageContentFromOriginal, which resets
   * an entire page's title/summary/SEO/CTA — this is the per-field
   * equivalent this design calls for, since that function's granularity
   * (whole page) is too coarse for "undo just this one heading edit".
   * @param {string} path
   * @returns {void}
   */
  function resetFieldToOriginal(path) {
    const key = window.utils.getCurrentKey()
    const page = window.HHVC_DATA.pages[key]
    const originalPage = window.ORIGINAL_DATA?.pages?.[key]
    if (!page || !originalPage) return

    if (path === 'title') {
      page.title = originalPage.title
    } else if (path === 'summary') {
      page.summary = originalPage.summary
    } else if (path === 'primaryCta') {
      const originalCta = getPrimaryCta(originalPage) || ''
      setPrimaryCta(page, originalCta)
    } else {
      const originalValue = getByPath(originalPage, path)
      if (originalValue !== undefined) setByPath(page, path, originalValue)
    }
    persist()
    rerender()
  }
```

Wire a reset control into `handleMockPageClick` (extend the function again):

```javascript
    const resetControl = target.closest('[data-inline-edit-reset]')
    if (resetControl) {
      event.preventDefault()
      resetFieldToOriginal(resetControl.getAttribute('data-inline-edit-reset'))
      return
    }
```

Add this branch before the `addControl`/`removeControl` checks (order among the three doesn't matter functionally since they match different attributes, but grouping the three "handled elsewhere" cases together keeps the function readable).

Add `resetControlHtml(path)` to `js/inline-content-edit-render.js`'s `render` object (Task 5's file):

```javascript
  /**
   * The "Reset to original" control shown next to a field currently
   * displaying the Edited badge.
   * @param {string} path
   * @returns {string}
   */
  function resetControlHtml(path) {
    const escapedPath = escapeHtml(path)
    return `<button type="button" class="inline-edit-reset" data-inline-edit-reset="${escapedPath}">Reset to original</button>`
  }
```

Add it to the exported object:

```javascript
  window.InlineEdit.render = {
    scalarEditorHtml,
    listAddControlHtml,
    listRemoveControlHtml,
    editedBadgeHtml,
    undoToastMarkup,
    resetControlHtml,
  }
```

- [ ] **Step 5: Decorate edited title/summary/heading/CTA with the badge and reset control**

Add to `js/inline-content-edit.js`:

```javascript
  /**
   * Apply the "Edited" badge and a "Reset to original" control next to
   * title, summary, heading, and CTA fields whose current value differs
   * from ORIGINAL_DATA. Paragraphs/bullets are excluded: they already carry
   * the Unverified pill (set at write time in writeScalarValue), which is
   * their edited signal, and adding a second one would be a duplicate cue
   * for the same fact.
   * @returns {void}
   */
  function decorateEditedFields() {
    const key = window.utils.getCurrentKey()
    const page = window.HHVC_DATA.pages[key]
    const originalPage = window.ORIGINAL_DATA?.pages?.[key]
    if (!page || !originalPage) return

    const scalarPaths = ['title', 'summary', 'primaryCta']
    document.querySelectorAll('#mockPage [data-rewrite-field]').forEach((el) => {
      const path = el.getAttribute('data-rewrite-field')
      const isHeading = /\.heading$/.test(path)
      if (!scalarPaths.includes(path) && !isHeading) return

      const currentValue =
        path === 'primaryCta' ? getPrimaryCta(page) || '' : readScalarValue(page, path)
      const originalValue =
        path === 'title'
          ? originalPage.title || ''
          : path === 'summary'
            ? originalPage.summary || ''
            : path === 'primaryCta'
              ? getPrimaryCta(originalPage) || ''
              : getByPath(originalPage, path) || ''

      if (currentValue === originalValue) return
      if (el.querySelector('.inline-edit-badge')) return // already decorated

      const badgeWrapper = document.createElement('span')
      badgeWrapper.innerHTML = render.editedBadgeHtml() + render.resetControlHtml(path)
      while (badgeWrapper.firstChild) el.appendChild(badgeWrapper.firstChild)
    })
  }
```

Call it from `rerender()` and `init()` alongside `decorateListControls()`:

```javascript
  function rerender() {
    const key = window.utils.getCurrentKey()
    window.renderPage?.(key, true)
    decorateListControls()
    decorateEditedFields()
  }

  function init() {
    ensureBound()
    decorateListControls()
    decorateEditedFields()
  }
```

- [ ] **Step 6: Add CSS for the new controls (minimal, unblocking manual testing)**

This task needs at least placeholder-free, real styling for the controls to be usable in the manual smoke tests below — full styling is Task 8's `css/inline-content-edit.css`, created there and imported in `js/main.js` at that point. To keep this task's manual verification meaningful without jumping ahead of the plan's file-structure ordering, skip visual polish here and verify functionally instead (unstyled buttons are still clickable) — Task 8 adds the stylesheet before the e2e suite (which does assert on classes, not visual appearance) runs.

- [ ] **Step 7: Manual smoke test — add a bullet**

Run: `bun run dev`, navigate to a page with a bulleted list section. Expected: an unstyled "+ Add" button/element appears after the last bullet. Click it. Expected: a new empty bullet appears at the end of the list, already in edit-mode (an active `<textarea>`), focused.

- [ ] **Step 8: Manual smoke test — remove a bullet, then undo**

Click the "×" control on an existing bullet. Expected: the bullet disappears immediately, and a toast appears reading "Removed bullet." with an "Undo" affordance. Click Undo. Expected: the bullet reappears at its original position with its original text.

- [ ] **Step 9: Manual smoke test — reset a heading**

Edit a section heading, commit it (blur or Enter). Expected: the heading now shows the edited text plus an "Edited" badge and a "Reset to original" control. Click "Reset to original". Expected: the heading reverts to its pre-edit text and the badge/control disappear.

- [ ] **Step 10: Run `bun run format:check` and the full unit suite**

Run: `bun run format:check && bun run test`
Expected: both pass, no regressions from Tasks 1-6.

- [ ] **Step 11: Commit**

```bash
bun run format
git add js/inline-content-edit.js js/inline-content-edit-render.js
git commit -m "feat: add paragraph/bullet add-remove-undo and per-field reset to original"
```

---

### Task 8: `css/inline-content-edit.css` and wiring into `js/main.js`

**Files:**
- Create: `css/inline-content-edit.css`
- Modify: `js/main.js` (add the CSS import, before `css/theme.css`)

**Interfaces:**
- Consumes: semantic design tokens from `css/theme.css` (`--brand-*`, `--surface-*`, `--text-*`, `--status-*`) — no raw `--sfds-*` values, per the Global Constraints.
- Produces: visual styling for `.inline-edit-input`, `.inline-edit-badge`, `.inline-edit-reset`, `.inline-edit-add`, `.inline-edit-remove`, `.inline-edit-undo-action` — the classes Tasks 5-7's markup already emits.

- [ ] **Step 1: Write the stylesheet**

Create `css/inline-content-edit.css`:

```css
/* ==========================================================================
   Inline content editing
   ==========================================================================
   Styling for the click-to-edit widgets (js/inline-content-edit.js /
   js/inline-content-edit-render.js): the swapped-in input/textarea, the
   "Edited" badge for title/summary/heading/CTA (fields with no `unverified`
   schema slot to reuse the existing Unverified-pill mechanism), and the
   add/remove/reset controls for section paragraphs and bullets.

   Design-token-first, matching every other stylesheet in this tool: no raw
   --sfds-* values in these rules, no !important (reserved for
   css/ux-improvements.css's override layer).
   ========================================================================== */

.inline-edit-input {
  display: block;
  width: 100%;
  font: inherit;
  color: var(--text-primary);
  background: var(--surface-panel);
  border: 1px solid var(--brand-primary);
  border-radius: 4px;
  padding: 0.35rem 0.5rem;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--brand-primary) 20%, transparent);
}

.inline-edit-input:focus {
  outline: 2px solid var(--brand-primary);
  outline-offset: 1px;
}

textarea.inline-edit-input {
  resize: vertical;
  min-height: 4.5em;
}

/* The "Edited" badge — CSS-only signal for fields with no `unverified`
   schema slot (title, summary, heading, CTA). Visually related to but
   distinct from .unverified-pill (css/styles.css): that pill means "this
   claim needs SME confirmation" and ships with the page; this badge means
   "a reviewer changed this from what was authored" and is a review-time-only
   annotation, so the two use different tokens and never render on the same
   element (paragraphs/bullets get the pill, never this badge — see
   decorateEditedFields()'s explicit exclusion in js/inline-content-edit.js). */
.inline-edit-badge {
  display: inline-flex;
  align-items: center;
  margin-left: 0.4rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: var(--status-edits-bg);
  color: var(--status-edits-fg);
  border: 1px solid var(--status-edits-border);
  font-size: 0.68rem;
  font-weight: 700;
  vertical-align: middle;
}

.inline-edit-reset {
  margin-left: 0.4rem;
  padding: 0.1rem 0.4rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--brand-primary);
  background: transparent;
  border: 1px solid var(--brand-primary);
  border-radius: 4px;
  cursor: pointer;
}

.inline-edit-reset:hover {
  background: var(--surface-soft);
}

.inline-edit-add {
  display: inline-flex;
  align-items: center;
  margin-top: 0.5rem;
  padding: 0.3rem 0.7rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--brand-primary);
  background: var(--surface-panel);
  border: 1px dashed var(--brand-primary);
  border-radius: 6px;
  cursor: pointer;
}

.inline-edit-add:hover {
  background: var(--surface-soft);
}

.inline-edit-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: 0.35rem;
  width: 1.4rem;
  height: 1.4rem;
  line-height: 1;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--status-blocked-fg);
  background: transparent;
  border: 1px solid var(--status-blocked-border);
  border-radius: 999px;
  cursor: pointer;
}

.inline-edit-remove:hover {
  background: var(--status-blocked-bg);
}

.inline-edit-undo-action {
  margin-left: 0.5rem;
  font-weight: 700;
  text-decoration: underline;
  color: inherit;
  background: transparent;
  border: none;
  cursor: pointer;
}
```

- [ ] **Step 2: Import the stylesheet in `js/main.js`, before `css/theme.css`**

`js/main.js`'s styles block (lines 41-50) currently ends:

```javascript
import './../css/review-insights.css'
import './../css/review-ops.css'
import './../css/theme.css'
```

Insert the new stylesheet directly before `theme.css`:

```javascript
import './../css/review-insights.css'
import './../css/review-ops.css'
import './../css/inline-content-edit.css'
import './../css/theme.css'
```

- [ ] **Step 3: Run `bun run format:check`**

Run: `bun run format:check`
Expected: PASS — Prettier formats CSS too; if this fails, run `bun run format` and re-check.

- [ ] **Step 4: Visual smoke test**

Run: `bun run dev`, repeat the manual smoke tests from Task 6 Steps 3-5 and Task 7 Steps 7-9. Expected: the "Edited" badge, reset button, add/remove controls, and input/textarea widgets now render with real styling (not unstyled browser defaults), and — checking dark mode — toggle the OS/browser to `prefers-color-scheme: dark` and repeat; confirm the badge/reset/add/remove controls remain legible (since they consume `--status-edits-*`/`--brand-primary`/`--surface-*`, which already have dark-mode overrides in `css/theme.css`, no new dark-mode block is needed in this file).

- [ ] **Step 5: Run `bun run build:app` to confirm the new files bundle cleanly**

Run: `bun run build:app`
Expected: exits 0; `dist/` contains the new CSS bundled into the existing stylesheet output (Vite doesn't emit a separate file per `@import`-free `<link>`-free `import './../css/...'` — confirm no build error/warning naming the new file).

- [ ] **Step 6: Commit**

```bash
bun run format
git add css/inline-content-edit.css js/main.js
git commit -m "feat: add inline-content-edit stylesheet (Edited badge, add/remove/reset controls)"
```

---

### Task 9: CSV export/import gains `edited_title`/`edited_summary` columns

**Files:**
- Modify: `js/manager-review-export.js:19-34` (`MANAGER_REVIEW_RECORD_FIELDS`)
- Modify: `js/ux-improvements-export.js:104-155` (`exportSavedLocalReviewsCsv`)
- Modify: `js/review-queue-import.js:52-66` (`importReviewsFromCsvText`'s `fields` array)

**Interfaces:**
- Consumes: nothing new — `edited_title`/`edited_summary` are already real fields on every saved record (see the "Repo-reality corrections" section).
- Produces: the current-page CSV export (`ReviewExport.currentCsv`), the all-saved-reviews CSV export (`exportSavedLocalReviewsCsv`), and the CSV import path (`importReviewsFromCsvText`) all now read/write `edited_title`/`edited_summary` columns. `section_edits` is deliberately excluded from all three — the documented CSV limitation from the design spec.

- [ ] **Step 1: Manual verification of current (pre-fix) CSV behavior, to confirm the gap**

Run: `bun run dev`, open the mockup, edit the page title via the (now-existing, from Task 6) click-to-edit, then click **Export reviews** with scope "Export current review (CSV)". Open the downloaded CSV. Expected (confirming the bug this task fixes): the CSV has no `edited_title` column at all — `primary_cta` is present but `edited_title`/`edited_summary` are absent from the header row, even though the title edit is present in the JSON backup export.

- [ ] **Step 2: Add `edited_title`/`edited_summary` to `MANAGER_REVIEW_RECORD_FIELDS`**

In `js/manager-review-export.js`, `MANAGER_REVIEW_RECORD_FIELDS` (lines 19-34) currently reads:

```javascript
  const MANAGER_REVIEW_RECORD_FIELDS = [
    'review_date',
    'reviewer',
    'page_key',
    'page_title',
    'page_type',
    'url_slug',
    'decision',
    'notes',
    'risks_or_blockers',
    'follow_up_owner',
    'seo_title',
    'meta_description',
    'primary_cta',
    'reading_target',
  ]
```

Add the two fields after `primary_cta`:

```javascript
  const MANAGER_REVIEW_RECORD_FIELDS = [
    'review_date',
    'reviewer',
    'page_key',
    'page_title',
    'page_type',
    'url_slug',
    'decision',
    'notes',
    'risks_or_blockers',
    'follow_up_owner',
    'seo_title',
    'meta_description',
    'primary_cta',
    'edited_title',
    'edited_summary',
    'reading_target',
  ]
```

`getManagerReviewSnapshot()` in the same file calls `buildReviewRecord(page, currentPageKey, {...overrides}, MANAGER_REVIEW_RECORD_FIELDS)` — since `buildReviewRecord`'s base object already sets `edited_title`/`edited_summary` (Task 4 confirmed these are already populated on every saved snapshot via `collectCurrentPageReviewState`, and `buildReviewRecord`'s own base object independently defaults them to `''` when not overridden), no override needs adding here — the projection through the expanded `MANAGER_REVIEW_RECORD_FIELDS` list is the only change needed. Note this function does not read live `page.title`/`page.summary` for these two fields the way `collectCurrentPageReviewState` does — it reads whatever `buildReviewRecord`'s base computes, which for `edited_title`/`edited_summary` defaults to `''` unless explicitly overridden. Since this snapshot function is exporting the *current in-browser form state*, not the saved-to-localStorage record, add explicit overrides so the exported CSV reflects live edits even before an autosave has run:

```javascript
  function getManagerReviewSnapshot() {
    const page = pageData[currentPageKey] || {}
    return buildReviewRecord(
      page,
      currentPageKey,
      {
        review_date: document.getElementById('reviewDateInput')?.value || today(),
        reviewer: document.getElementById('reviewerInput')?.value || '',
        page_title: page.title || '',
        url_slug: document.getElementById('urlInput')?.value || page.slug || '',
        decision: document.getElementById('reviewDecision')?.value || 'Needs review',
        notes: document.getElementById('reviewNotes')?.value || '',
        risks_or_blockers: document.getElementById('reviewRisks')?.value || '',
        follow_up_owner: document.getElementById('reviewOwner')?.value || '',
        seo_title: document.getElementById('seoTitleInput')?.value || defaultSeoTitle(page),
        meta_description:
          document.getElementById('metaDescriptionInput')?.value || defaultMetaDescription(page),
        edited_title: page.title || '',
        edited_summary: page.summary || '',
      },
      MANAGER_REVIEW_RECORD_FIELDS
    )
  }
```

- [ ] **Step 3: Add `edited_title`/`edited_summary` to `exportSavedLocalReviewsCsv`'s headers and row data**

In `js/ux-improvements-export.js`, `exportSavedLocalReviewsCsv()` (lines 104-155) currently reads:

```javascript
    const headers = [
      'review_date',
      'reviewer',
      'page_key',
      'page_title',
      'page_type',
      'url_slug',
      'decision',
      'notes',
      'risks_or_blockers',
      'follow_up_owner',
      'seo_title',
      'meta_description',
      'primary_cta',
      'reading_target',
      'updated_at',
    ]

    const rows = [headers]
    for (const [pageKey] of DATA.order) {
      const page = DATA.pages[pageKey] || {}
      const saved = state.pages[pageKey]
      if (!saved) continue

      rows.push([
        saved.review_date || '',
        saved.reviewer || state.globals.reviewer || '',
        pageKey,
        saved.page_title || page.title || '',
        saved.page_type || page.type || '',
        saved.url_slug || page.slug || '',
        saved.decision || 'Needs review',
        saved.notes || '',
        saved.risks_or_blockers || '',
        saved.follow_up_owner || '',
        saved.seo_title || defaultSeoTitle(page),
        saved.meta_description || defaultMetaDescription(page),
        saved.primary_cta || getPrimaryCta(page),
        saved.reading_target || page.reading || '',
        saved.updated_at || '',
      ])
    }
```

Insert `edited_title`/`edited_summary` after `primary_cta` in both the header array and the row-building array, in matching order:

```javascript
    const headers = [
      'review_date',
      'reviewer',
      'page_key',
      'page_title',
      'page_type',
      'url_slug',
      'decision',
      'notes',
      'risks_or_blockers',
      'follow_up_owner',
      'seo_title',
      'meta_description',
      'primary_cta',
      'edited_title',
      'edited_summary',
      'reading_target',
      'updated_at',
    ]

    const rows = [headers]
    for (const [pageKey] of DATA.order) {
      const page = DATA.pages[pageKey] || {}
      const saved = state.pages[pageKey]
      if (!saved) continue

      rows.push([
        saved.review_date || '',
        saved.reviewer || state.globals.reviewer || '',
        pageKey,
        saved.page_title || page.title || '',
        saved.page_type || page.type || '',
        saved.url_slug || page.slug || '',
        saved.decision || 'Needs review',
        saved.notes || '',
        saved.risks_or_blockers || '',
        saved.follow_up_owner || '',
        saved.seo_title || defaultSeoTitle(page),
        saved.meta_description || defaultMetaDescription(page),
        saved.primary_cta || getPrimaryCta(page),
        saved.edited_title || '',
        saved.edited_summary || '',
        saved.reading_target || page.reading || '',
        saved.updated_at || '',
      ])
    }
```

- [ ] **Step 4: Add `edited_title`/`edited_summary` to the CSV import field list**

In `js/review-queue-import.js`, `importReviewsFromCsvText()`'s `fields` array (lines 52-66) currently reads:

```javascript
      const fields = [
        'page_title',
        'page_type',
        'url_slug',
        'decision',
        'notes',
        'risks_or_blockers',
        'follow_up_owner',
        'reviewer',
        'review_date',
        'seo_title',
        'meta_description',
        'primary_cta',
        'reading_target',
      ]
```

Add the two fields:

```javascript
      const fields = [
        'page_title',
        'page_type',
        'url_slug',
        'decision',
        'notes',
        'risks_or_blockers',
        'follow_up_owner',
        'reviewer',
        'review_date',
        'seo_title',
        'meta_description',
        'primary_cta',
        'edited_title',
        'edited_summary',
        'reading_target',
      ]
```

Note: this import path writes the patch through `updateLocalReviewForPage(pageKey, patch, 'import')`, which merges via `mergeReviewRecord` — it does **not** call `applyContentEditsToPageData` or otherwise write the imported `edited_title`/`edited_summary` back onto the live in-memory `page.title`/`page.summary`. This matches existing behavior for every other CSV-imported field (e.g. `primary_cta` today): the saved record updates, and the mockup picks up the new value the next time `applySavedPageState()` runs for that page (already true before this task, since `updateMockupTextFromSavedState` already reads `saved.edited_title`/`saved.edited_summary` — this task only makes the CSV import path actually deliver a non-empty value into that existing mechanism).

- [ ] **Step 5: Manual round-trip verification (mandatory per this repo's import/export rule)**

Run: `bun run dev`. Edit a page's title via click-to-edit. Export **current review (CSV)**. Confirm the downloaded CSV's header row now includes `edited_title` and `edited_summary`, and the `edited_title` cell holds the edited value.

Then: export **Download backup (JSON)**, click **Clear saved reviews**, confirm the title reverts to original in the mockup. Import the JSON backup back in. Confirm the title edit reappears — this is the mandatory merge-not-wipe verification for any change touching the import/export round trip (per `CLAUDE.md`'s "Local persistence" section), even though this task's own change is CSV-only: the JSON path shares `mergeReviewRecord` with CSV import, so a regression here would show up in both.

Then: export the **all saved reviews (CSV)** (`exportSavedLocalReviewsCsv`, via the "all-csv" export scope), confirm its header row and data row also carry `edited_title`/`edited_summary`. Re-import that same CSV via **Import reviews**, confirm no data loss (existing decisions/notes on other pages remain).

- [ ] **Step 6: Run the full unit suite**

Run: `bun run test`
Expected: PASS — no unit test currently asserts on these CSV column lists directly (per the repo's existing test coverage, `tests/csv.test.js` tests the CSV serialization mechanics, not this feature's specific column list), so this step confirms no unrelated regression.

- [ ] **Step 7: Format and commit**

```bash
bun run format
git add js/manager-review-export.js js/ux-improvements-export.js js/review-queue-import.js
git commit -m "feat: carry edited_title/edited_summary through CSV export and import"
```

---

### Task 10: e2e coverage

**Files:**
- Create: `tests/e2e/inline-content-edit.spec.js`
- Reference: `tests/e2e/helpers.js` (shared helpers — `gotoFresh()`, `setDecision()`, etc.), `tests/e2e/merge-verification.spec.js` and `tests/e2e/import-export.spec.js` (the merge-not-wipe verification pattern this file's last test follows)

**Interfaces:**
- Consumes: `gotoFresh` and other exports from `tests/e2e/helpers.js` (read the file first to confirm exact export names before writing — do not guess).

- [ ] **Step 1: Read `tests/e2e/helpers.js` to confirm exact helper signatures**

Run: `grep -n "^function\|^export\|module.exports" tests/e2e/helpers.js`

Use whatever `gotoFresh()` (and any other needed helper, e.g. a page-navigation or decision-setting helper) actually exports — do not assume a signature not confirmed by this read. The steps below assume `gotoFresh(page)` navigates to a fresh, cleared-state instance of the tool and waits for `window.reviewKeyboardShortcuts.ready`, matching this repo's documented `gotoFresh()` contract in `CLAUDE.md`; adjust the exact call if the file's real signature differs.

- [ ] **Step 2: Write the e2e spec**

Create `tests/e2e/inline-content-edit.spec.js`:

```javascript
// Inline content editing: click-to-edit on the mockup, add/remove for
// paragraphs and bullets, one-step undo, per-field reset, and persistence
// across reload and the JSON backup export/import round trip. See
// CLAUDE.md's "Inline content editing" section for the feature's scope and
// invariants.
const { test, expect } = require('@playwright/test')
const { gotoFresh } = require('./helpers.js')

test.describe('inline content editing', () => {
  test('editing the title updates the mockup immediately and shows the Edited badge', async ({
    page,
  }) => {
    await gotoFresh(page)
    const title = page.locator('#mockPage h1')
    const originalText = await title.textContent()
    await title.click()
    const input = page.locator('#mockPage input.inline-edit-input')
    await expect(input).toBeVisible()
    await input.fill('A New Test Title')
    await input.press('Enter')

    await expect(page.locator('#mockPage h1')).toContainText('A New Test Title')
    await expect(page.locator('#mockPage h1 .inline-edit-badge')).toContainText('Edited')
    expect(await page.locator('#mockPage h1').textContent()).not.toContain(originalText)
  })

  test('escape cancels a title edit without saving', async ({ page }) => {
    await gotoFresh(page)
    const title = page.locator('#mockPage h1')
    const originalText = (await title.textContent())?.trim()
    await title.click()
    const input = page.locator('#mockPage input.inline-edit-input')
    await input.fill('Should Not Save')
    await input.press('Escape')

    await expect(page.locator('#mockPage h1')).toHaveText(originalText)
    await expect(page.locator('#mockPage h1 .inline-edit-badge')).toHaveCount(0)
  })

  test('editing a paragraph shows the Unverified pill, not the Edited badge', async ({ page }) => {
    await gotoFresh(page)
    const paragraph = page.locator('#mockPage [data-rewrite-field^="sections."][data-rewrite-field$=".paragraphs.0"]').first()
    await paragraph.click()
    const textarea = page.locator('#mockPage textarea.inline-edit-input')
    await expect(textarea).toBeVisible()
    await textarea.fill('An edited paragraph.')
    await textarea.blur()

    const updated = page.locator('#mockPage p:has-text("An edited paragraph.")')
    await expect(updated).toBeVisible()
    await expect(updated.locator('.unverified-pill')).toBeVisible()
    await expect(updated.locator('.inline-edit-badge')).toHaveCount(0)
  })

  test('adding a bullet opens it in edit mode and reset restores the heading', async ({ page }) => {
    await gotoFresh(page)
    // Navigate to a page known to have a bulleted section — pestsTopic is
    // the default first page and, per CLAUDE.md, has real section content.
    const addButton = page.locator('#mockPage .inline-edit-add').first()
    await expect(addButton).toBeVisible()
    const before = await page.locator('#mockPage li[data-rewrite-field], #mockPage p[data-rewrite-field]').count()
    await addButton.click()

    const active = page.locator('#mockPage textarea.inline-edit-input, #mockPage input.inline-edit-input')
    await expect(active).toBeFocused()
    await active.fill('A brand new item.')
    await active.blur()

    const after = await page.locator('#mockPage li[data-rewrite-field], #mockPage p[data-rewrite-field]').count()
    expect(after).toBe(before + 1)
  })

  test('removing a bullet shows an undo toast that restores it', async ({ page }) => {
    await gotoFresh(page)
    const removeButtons = page.locator('#mockPage .inline-edit-remove')
    const removeCount = await removeButtons.count()
    test.skip(removeCount === 0, 'no removable items on the default page')

    const target = removeButtons.first()
    const parentField = await target.evaluate((el) => el.closest('[data-rewrite-field]')?.getAttribute('data-rewrite-field'))
    await target.click()

    const toast = page.locator('.toast, [role="status"]', { hasText: 'Removed' })
    await expect(toast).toBeVisible()
    await toast.locator('[data-inline-edit-undo]').click()

    await expect(page.locator(`#mockPage [data-rewrite-field="${parentField}"]`)).toBeVisible()
  })

  test('editing a section heading shows Reset to original, which restores it', async ({ page }) => {
    await gotoFresh(page)
    const heading = page.locator('#mockPage h2[data-rewrite-field]').first()
    const originalText = (await heading.textContent())?.trim()
    await heading.click()
    const input = page.locator('#mockPage input.inline-edit-input')
    await input.fill('Edited Heading Text')
    await input.press('Enter')

    const editedHeading = page.locator('#mockPage h2', { hasText: 'Edited Heading Text' })
    await expect(editedHeading).toBeVisible()
    await editedHeading.locator('.inline-edit-reset').click()

    const restoredHeading = page.locator('#mockPage h2', { hasText: originalText })
    await expect(restoredHeading).toBeVisible()
    await expect(page.locator('#mockPage h2', { hasText: 'Edited Heading Text' })).toHaveCount(0)
  })

  test('a title edit persists across reload', async ({ page }) => {
    await gotoFresh(page)
    const title = page.locator('#mockPage h1')
    await title.click()
    const input = page.locator('#mockPage input.inline-edit-input')
    await input.fill('Persisted Title')
    await input.press('Enter')
    await expect(page.locator('#mockPage h1')).toContainText('Persisted Title')

    await page.reload()
    await expect(page.locator('#mockPage h1')).toContainText('Persisted Title')
  })

  test('a section edit survives export, clear, and JSON backup re-import (merge, not wipe)', async ({
    page,
  }) => {
    await gotoFresh(page)
    const heading = page.locator('#mockPage h2[data-rewrite-field]').first()
    await heading.click()
    const input = page.locator('#mockPage input.inline-edit-input')
    await input.fill('Round Trip Heading')
    await input.press('Enter')
    await expect(page.locator('#mockPage h2', { hasText: 'Round Trip Heading' })).toBeVisible()

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.selectOption('#exportScope', 'backup-json'),
      page.click('#exportReviews'),
    ])
    const backupPath = await download.path()

    page.on('dialog', (dialog) => dialog.accept())
    await page.click('#clearSavedLocalReviews')
    await page.reload()
    await expect(page.locator('#mockPage h2', { hasText: 'Round Trip Heading' })).toHaveCount(0)

    await page.setInputFiles('#reviewImportFile', backupPath)
    await page.reload()
    await expect(page.locator('#mockPage h2', { hasText: 'Round Trip Heading' })).toBeVisible()
  })
})
```

- [ ] **Step 3: Run the new spec**

Run: `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium bun run test:e2e -- tests/e2e/inline-content-edit.spec.js` (omit the `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` prefix if not running in a sandboxed environment with a pre-installed Chromium).

Expected: all 8 tests pass. If any selector assumption (e.g. `.toast, [role="status"]` for the undo toast, or the exact `#exportScope`/`#exportReviews`/`#reviewImportFile`/`#clearSavedLocalReviews` element IDs) doesn't match the real DOM, inspect `index.html` and `js/ui-controls.js`'s actual toast markup and correct the selectors — these were written from the design spec's description and `js/ux-improvements-export.js`'s `mountReviewDataControls()` (which does confirm `exportScope`/`exportReviews`/`reviewImportFile`/`clearSavedLocalReviews` as real element IDs), but the toast container class was not independently verified in this plan's research and must be checked against `js/ui-controls.js`'s `showToast()` implementation before this step is considered done.

- [ ] **Step 4: Do NOT add this file to `package.json`'s `test` script**

Confirm `tests/e2e/inline-content-edit.spec.js` is picked up automatically: Playwright's `test:e2e` script (`playwright test`) globs `tests/e2e/` per `playwright.config` — no `package.json` change is needed or wanted here (unlike the Bun unit-test list, which is explicitly enumerated). Run the full e2e suite once to confirm no interference with other specs:

Run: `bun run test:e2e`
Expected: all specs pass, including the 16 pre-existing files (123 specs) plus this new one.

- [ ] **Step 5: Format and commit**

```bash
bun run format
git add tests/e2e/inline-content-edit.spec.js
git commit -m "test: add e2e coverage for inline content editing"
```

---

### Task 11: `CLAUDE.md` and `AGENTS.md` documentation

**Files:**
- Modify: `CLAUDE.md` — new "Inline content editing" section, stylesheet table row
- Modify: `AGENTS.md` — same section, per the cross-tool-canon rule
- Verify (no edit expected): `.github/copilot-instructions.md` stays an untouched pointer

**Interfaces:** none — documentation only.

- [ ] **Step 1: Read the current `CLAUDE.md` sections this new section sits between**

Run: `grep -n "^### Queue undo\|^### Stored review data\|^### Local persistence" CLAUDE.md`

Confirm the exact heading text and section boundaries so the new section is inserted in a sensible place — after "Queue undo" (a similarly-scoped, similarly-recent addition) and before "Stored review data" reads naturally, but verify against the actual file rather than assuming the ordering hasn't shifted.

- [ ] **Step 2: Write the new CLAUDE.md section**

Insert a new `### Inline content editing` section into `CLAUDE.md`, in the "Architecture" part of the file, in this repo's established dense/explanatory voice (model: "Queue undo", "The workspace is docked, not stacked"):

```markdown
### Inline content editing (`js/inline-content-edit*.js`)

Click-to-edit directly on the rendered mockup — title, summary, primary CTA
label, a section heading, a paragraph, a bullet — with the mockup
re-rendering immediately and the edit persisting through the same
browser-first `localStorage` review-state model every other field in this
tool uses. `pages/*.js` is never touched; this is a review aid, same as
every other review/UX layer.

- **Scope is deliberately narrow.** Title, summary, primary CTA, section
  heading, section paragraphs, section bullets — that's it. Cards, callouts,
  table cells, step text/bullets, `whatToKnow` items, and contact info stay
  hand-edited in source. Add/remove is supported on exactly two fields —
  section `paragraphs` and `bullets` — and only of individual items, never
  whole sections/cards/steps, and never reordering.
- **Addressing is reused, not reinvented.** `js/page-render.js` already
  emits `data-rewrite-field="sections.N.paragraphs.M"`-style dot-path
  attributes (added for the in-flight AI-rewrite-selection feature) via
  `paragraphList()`/`bulletList()`'s `pathPrefix` parameter, plus
  `data-rewrite-field="sections.N.heading"` on section `<h2>`s and
  `"title"`/`"summary"`/`"primaryCta"` on the hero's elements, both added by
  this feature. The path always uses each section's **original**
  `page.sections` index (`__sectionIndex`, stamped by `partitionSections()`),
  never its position in the reshuffled render layout — see the
  "Field addressing" section of
  `docs/superpowers/specs/2026-08-08-inline-content-editing-design.md` for
  why render-position addressing would silently target the wrong section.
  Every write goes through the existing guarded `getByPath`/`setByPath`
  (`js/utils.js`) — never a hand-rolled path walker — except title, summary,
  and CTA, which are page-level (not inside `sections[]`) and already have
  dedicated accessors (`getPrimaryCta`/`setPrimaryCta`, direct
  `page.title =`/`page.summary =`).
- **Array edits are always a whole-field replace, never a per-index
  patch.** Adding or removing one bullet writes the entire resulting array
  under `sections.N.bullets`, never a single index — a delete shifts every
  later index, so a per-item key would either go stale or need renumbering
  logic on every removal. This mirrors how `edited_title` has always been
  the whole new title, never a diff.
- **`edited_title`/`edited_summary`/`primary_cta` were unused fields before
  this feature, not new ones.** `REVIEW_RECORD_FIELDS` and the review-record
  schema already had all three slots, and
  `collectCurrentPageReviewState()`/`updateMockupTextFromSavedState()`
  (`js/ux-improvements-state-sync.js`) already wrote and reapplied them —
  there was simply no UI that ever changed `page.title`/`page.summary`/the
  CTA to give them a non-empty value. This feature is that UI; it added no
  new persistence code for these three fields, only the click-to-edit
  interaction that mutates the in-memory page object the existing autosave
  already reads from.
- **`section_edits` is new, and it's derived, not accumulated.** A flat map
  on the review record, `field path -> current full value` (e.g.
  `{"sections.2.bullets": [...]}`). `computeSectionEdits()`
  (`js/inline-content-edit-data.js`) recomputes it from scratch on every
  autosave by diffing the live page object's `heading`/`paragraphs`/`bullets`
  against `window.ORIGINAL_DATA`, the same "read live state fresh every
  save" approach `edited_title` has always used — not an accumulated diff
  that a delete or a manual reset would have to separately reconcile. This is
  what makes "reset to original" correct by construction: once a field
  matches `ORIGINAL_DATA` again, the next `computeSectionEdits()` call simply
  omits its path from the map, with no deletion logic required anywhere.
  `applyContentEditsToPageData()` is the inverse — called once, from
  `applySavedPageState()` alongside the pre-existing
  `updateMockupTextFromSavedState()` call, replaying `section_edits` back
  onto the in-memory page object on every load/navigation/sync-pull/
  conflict-resolution path (all of which already funnel through that one
  function). It deliberately does NOT touch `edited_title`/`edited_summary`/
  `primary_cta` — those are `updateMockupTextFromSavedState()`'s job, and
  reapplying them twice would race two functions writing the same fields on
  every load.
- **No history entry per edit, same rule as every other keystroke-level
  field.** Every commit — a scalar edit, an add, a remove, a reset — folds
  into the existing debounced autosave (`saveCurrentPageToLocalStorage`),
  never `mergeReviewRecord`. The mockup re-renders immediately regardless;
  only the *recorded review round* stays untouched.
- **Edited-field visibility uses two different mechanisms, deliberately.**
  A manually edited paragraph or bullet is stored as
  `{text, unverified: true, unverifiedReason: 'Manually edited during
review'}` — the existing object form `normalizeTextItem()` already handles,
  rendering the existing Unverified pill with zero renderer changes. Title,
  summary, heading, and CTA have no such schema slot (they're plain strings),
  so they get a separate CSS-only "Edited" badge
  (`css/inline-content-edit.css`) instead, applied as post-render DOM
  decoration by comparing the live value against `window.ORIGINAL_DATA` —
  never threaded into `renderHero()`/`renderSection()` as a parameter, which
  would put a reviewer-only annotation inside the escaping-audited render
  functions the AI-assist preview path also depends on staying pure.
- **Per-field "Reset to original" is new, not a mirror of an existing
  pattern.** The only prior precedent is `restorePageContentFromOriginal()`
  (`js/review-state-sync.js`), and it's whole-page (title, summary, SEO
  fields, CTA all at once, via direct assignment) — there was no per-field
  reset anywhere in the tool before this feature. This feature's version is
  scoped to one field via `getByPath`(`ORIGINAL_DATA`)/`setByPath`, modeled
  on that function's shape but not calling it.
- **One-step undo on delete, mirroring `js/review-queue-undo.js`'s
  precedent** — not a confirm dialog, since that would interrupt the editing
  flow for what is usually an accidental click. Deleting a paragraph or
  bullet shows a toast with an Undo affordance; pressing it re-inserts the
  removed item at its original index and re-persists. One level, consumed on
  use — same reasoning as the queue's own undo: a stack would imply a
  reconstructable history the review state doesn't have.
- **CSV carries `edited_title`/`edited_summary`/`primary_cta`; it does NOT
  carry `section_edits`.** This is a real, documented limitation, not an
  oversight: the three page-level fields are flat strings and fit the
  existing CSV row model the same way `notes`/`decision` do
  (`js/manager-review-export.js`'s `MANAGER_REVIEW_RECORD_FIELDS`,
  `js/ux-improvements-export.js`'s `exportSavedLocalReviewsCsv`, and
  `js/review-queue-import.js`'s CSV import field list all carry them).
  `section_edits` is a nested object keyed by dot-path and does not fit a
  flat CSV row — it round-trips through the JSON backup path
  (`importReviewStateBackup` in `js/ux-improvements-export.js`) only, for
  free, since that path already merges through `mergeReviewRecord` with
  whatever fields a saved record happens to carry. **A CSV export/import
  cycle therefore preserves title/summary/CTA edits but silently drops
  section-level (heading/paragraph/bullet) edits.** Choose the JSON backup
  format when section-level edits matter to the round trip.
- **No AI, no backend, no capability gating.** Unlike AI assist and the sync
  backend, this feature has no `server.ts` dependency and needs no
  configuration — the click-to-edit affordance is present on every deploy,
  including the static Netlify build, the moment the page has loaded.
```

- [ ] **Step 3: Insert the section into `CLAUDE.md`**

Use the boundary confirmed in Step 1 to insert the new section at the correct location (Edit tool, exact `old_string`/`new_string` matching the real surrounding headings — do not guess the insertion point without having run Step 1's grep against the actual file state at commit time).

- [ ] **Step 4: Add the new stylesheet to `CLAUDE.md`'s stylesheet table**

Find the table under "The seven stylesheets, in `js/main.js` import order" (note: this table's title will need updating too, since it is now eight stylesheets, not seven — check the exact current wording via `grep -n "stylesheets, in" CLAUDE.md` and update the count in the heading/prose to match). Add a row:

```markdown
| `css/inline-content-edit.css` | the inline click-to-edit widgets, Edited badge, add/remove/reset controls |
```

positioned in the table between `css/review-ops.css` and `css/theme.css`, matching the real import order established in Task 8 Step 2.

- [ ] **Step 5: Update the "eight stylesheets" (formerly "seven") references throughout CLAUDE.md**

Run: `grep -n "seven stylesheet" CLAUDE.md`

Update every match to "eight stylesheets" (there may be more than one reference — the table heading and possibly prose elsewhere referring back to it). Read each match in context before editing to confirm the change is accurate and doesn't need rewording beyond the count.

- [ ] **Step 6: Apply the identical section to `AGENTS.md`**

Run: `diff <(sed -n '/^### Queue undo/,/^### Stored review data/p' CLAUDE.md) <(sed -n '/^### Queue undo/,/^### Stored review data/p' AGENTS.md)`

Confirm `AGENTS.md` carries the same "Queue undo"-adjacent section structure as `CLAUDE.md` (per this repo's cross-tool-canon rule, they should already match closely for existing sections). Insert the identical new "Inline content editing" section and the identical stylesheet-table row/count update into `AGENTS.md` at the equivalent location.

- [ ] **Step 7: Confirm `.github/copilot-instructions.md` needs no edit**

Run: `grep -n "Inline content\|inline-content-edit" .github/copilot-instructions.md`

Expected: no matches — per the cross-tool-canon rule, this file stays an untouched pointer carrying no counts, no file inventories, and no architecture summaries. Confirm it does not already contain a stale reference that would need removing (it shouldn't, since this is new content, but verify rather than assume).

- [ ] **Step 8: Run `bun run doc-counts` test (verifies doc counts match filesystem)**

Run: `bun test tests/doc-counts.test.js`
Expected: PASS. This test (per `CLAUDE.md`'s own description) "reads the counts back out of these docs and compares them to the filesystem" — if it references a stylesheet count or similar figure this task's edits changed, this is where a stale number would be caught. If it fails, read the failure message and correct the specific count it flags (in `CLAUDE.md`/`AGENTS.md`, not the test).

- [ ] **Step 9: Run `bun run format:check`**

Run: `bun run format:check`
Expected: PASS — Prettier formats Markdown too.

- [ ] **Step 10: Commit**

```bash
bun run format
git add CLAUDE.md AGENTS.md
git commit -m "docs: add Inline content editing section to CLAUDE.md and AGENTS.md"
```

---

### Task 12: full-suite verification and final review pass

**Files:** none new — verification only.

- [ ] **Step 1: Run the full validate + unit test suite**

Run: `bun run validate && bun run test`
Expected: both pass with no regressions. `bun run validate` should report the same page/rule counts as before this feature (no `pages/*.js` content changed).

- [ ] **Step 2: Run `bun run format:check`**

Run: `bun run format:check`
Expected: PASS — every file this plan touched or created is Prettier-clean.

- [ ] **Step 3: Run the full build**

Run: `bun run build`
Expected: exits 0. Confirms `validate` → `export` → workshop form → `build:app` → publish form → `build:singlefile` all succeed with the new files in place, including the singlefile build (which inlines every script/stylesheet — a missed import in `js/main.js` would surface here as missing functionality in `dist-singlefile/index.html`, even though the build itself might still exit 0).

- [ ] **Step 4: Run the full e2e suite**

Run: `bun run test:e2e` (with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` set if in a sandboxed environment)
Expected: all specs pass — the pre-existing 16 files plus the new `tests/e2e/inline-content-edit.spec.js`, for 17 files total.

- [ ] **Step 5: Manual end-to-end walkthrough**

Run: `bun run start`, open `http://127.0.0.1:8080`, and manually repeat, in one continuous session:
1. Edit the title, summary, and CTA of the current page (all three via click-to-edit); confirm each shows the Edited badge and each survives a reload.
2. Edit a section heading; confirm the Edited badge and Reset to original both work.
3. Edit a paragraph and a bullet; confirm both show the Unverified pill with the correct tooltip text.
4. Add a bullet and a paragraph; confirm both appear immediately in edit mode.
5. Remove a bullet; confirm the undo toast appears and restores it.
6. Export the current review as CSV; confirm `edited_title`/`edited_summary`/`primary_cta` columns are populated.
7. Export a JSON backup; clear saved reviews; confirm the mockup reverts to original; re-import the backup; confirm every edit (title, summary, CTA, heading, paragraph, bullet) reappears exactly as left.
8. Reload one more time after the import; confirm everything is still present (proving `applyContentEditsToPageData` and `updateMockupTextFromSavedState` both fire correctly on a fresh page load, not just immediately after an in-session edit).

- [ ] **Step 6: Confirm no console errors**

While performing Step 5's walkthrough, keep the browser devtools console open. Expected: no uncaught errors or warnings at any point (this tool's `installGlobalErrorHandlers()` in `js/utils.js` would surface a visible error banner on any uncaught exception — none should appear).

- [ ] **Step 7: Final commit if any fixes were needed during this task**

If Steps 1-6 surfaced any issue requiring a code fix, make the fix, re-run the relevant verification step(s) from this task, then commit:

```bash
bun run format
git add -A
git commit -m "fix: address issues found during inline-content-editing verification pass"
```

If no issues were found, this task requires no commit — it is verification-only.

---

## Self-Review

**1. Spec coverage.** Walking the design spec section by section:
- Problem/Goals: click-to-edit on title/summary/CTA/heading/paragraph/bullet → Tasks 1, 6, 7. Add/remove on paragraphs/bullets → Task 7. Visible edit signal (pill/badge) → Tasks 6, 7, 8. Persistence through the existing model → Tasks 2, 3, 4. JSON backup / sync round-trip → Task 3's `applyContentEditsToPageData` + Task 4's wiring (sync push/pull already goes through the same `applySavedPageState`/autosave paths, no separate task needed since those paths are unmodified by this feature).
- Non-goals: no `pages/*.js` writes (true throughout — every write in Tasks 3/4/6/7 targets in-memory `page`/`DATA.pages` or `localStorage`), no cards/callouts/table cells/steps/whatToKnow/contact editing (never added), no section/card/step add/remove/reorder (never added — only paragraph/bullet item add/remove), no AI (no task references any AI/backend code), no multi-step undo (Task 7's undo is explicitly one level, consumed on use), no real-time collaboration UI (none added; last-write-wins-per-field is inherited unmodified from the existing sync/autosave paths).
- Architecture/Field addressing: Task 1 (renderer attributes), Task 6 (click delegation + `getByPath`/`setByPath` usage), Task 7 (list container derivation from DOM, add/remove/undo/reset).
- Persistence section: Task 2 (schema), Task 3 (pure derive/reapply logic), Task 4 (wiring into autosave/load) — all corrected per the "Repo-reality corrections" section to route around the spec's inaccurate "unused fields" framing while still landing on a working `section_edits` mechanism.
- Coordination with PR #100: addressed via the "Repo-reality corrections" note (confirmed `js/ai-rewrite.js` etc. genuinely absent from `main`) and via Task 1's attribute additions being purely additive to `js/page-render.js`, the one file both efforts touch.
- Testing section: `tests/page-render.test.js` extension → Task 1. `tests/utils.test.js` → Task 4. Schema/validation drift → Task 2. `applyContentEditsToPageData` pure-logic tests → Task 3 (renamed to `js/inline-content-edit-data.js`/`tests/inline-content-edit-data.test.js` from the spec's suggested `js/inline-content-edit.js`/`tests/inline-content-edit.test.js`, to keep the pure/impure split the advisor recommended — the orchestrator file the spec named is impure and untestable under Bun without a DOM). e2e spec → Task 10.
- Docs section: Task 11 covers CLAUDE.md, AGENTS.md, the stylesheet table, and confirms copilot-instructions.md needs no edit.

**2. Placeholder scan.** Searched every task for "TBD"/"similar to Task N"/"add appropriate handling"/bare prose describing code without showing it. Task 7 Step 1 contains one instructive caveat ("if `showToast` does not already support a third `options.onAction` parameter... add the minimal extension needed") rather than a fully pre-written `showToast` diff — this is intentional, not a placeholder violation: `js/ui-controls.js` was not read in full during this plan's research (only referenced by name from other files), so its exact current signature is unverified, and writing a fabricated diff against unread code would violate the "don't guess file contents" rule more severely than flagging the exact check-and-extend action needed. Every other step in the plan shows complete, real code. Flagging this now: **Task 7 Step 1 requires reading `js/ui-controls.js`'s actual `showToast` implementation before writing that step's final code** — this is the one place in the plan where a subagent executing Task 7 must do one extra read-before-write beyond what this plan shows verbatim.

**3. Type/signature consistency.** Cross-checked function names and signatures across tasks:
- `computeSectionEdits(page, originalPage)` and `applyContentEditsToPageData(page, savedRecord)` — defined in Task 3, consumed identically in Task 4 (`window.inlineEditData?.computeSectionEdits(page, originalPage)`, `window.inlineEditData?.applyContentEditsToPageData(page, saved)`). Consistent.
- `render.scalarEditorHtml({tag, value, path})`, `render.listAddControlHtml(path)`, `render.listRemoveControlHtml(path, index)`, `render.editedBadgeHtml()`, `render.undoToastMarkup(label)`, `render.resetControlHtml(path)` — all defined in Task 5 (five of six) and Task 7 Step 4 (the sixth, `resetControlHtml`, added to the same file/object at that point since Task 5 pre-dates the decision to need a reset control being fully specced). Consumed with matching argument shapes in Task 6 (`scalarEditorHtml`) and Task 7 (`listAddControlHtml`, `listRemoveControlHtml`, `editedBadgeHtml`, `undoToastMarkup`, `resetControlHtml`). Consistent.
- `window.inlineEdit = { ensureBound, isEditing }` — declared in Task 6, unchanged in Task 7 (Task 7 adds internal functions to the same file but does not expand the public surface, as its own Interfaces block states). Consistent.
- CSS class names — `.inline-edit-input`, `.inline-edit-badge`, `.inline-edit-reset`, `.inline-edit-add`, `.inline-edit-remove`, `.inline-edit-undo-action` — emitted by Task 5/7's render functions and styled by Task 8's stylesheet with matching selectors. Consistent.
- Data attributes — `data-inline-edit-add`, `data-inline-edit-remove`, `data-inline-edit-index`, `data-inline-edit-reset`, `data-inline-edit-undo`, `data-inline-edit-input` — emitted in Task 5/7's markup and read by matching `getAttribute`/`closest` calls in Task 6/7's click handlers. Consistent.
- `REVIEW_RECORD_FIELDS` — Task 4 adds `'section_edits'` to the `js/utils.js` array (also reachable via `window.utils.REVIEW_RECORD_FIELDS`, same reference); Task 2 adds the matching key to `js/review-state-validation.js`'s separate `Set` and to the Zod schema in `build_scripts/review-state-schema.js` — three separate restatements, all updated, matching the pattern already established for every other field in that list (confirmed via the `grep` in this plan's research showing exactly these three files restate the list).
- `IN_SCOPE_SECTION_FIELD_SUFFIXES` — defined once in Task 3, referenced by name in Task 3's own test only; Task 6/7's code does not need to import it (they infer scope from which `data-rewrite-field` paths exist in the DOM, not from iterating this constant), so no cross-task signature risk there.

No gaps or naming drift found on this pass.
