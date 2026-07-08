# Content-Confidence Markers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a schema-driven "Unverified" pill that can be attached to an individual bullet, paragraph, step-text item, or card, rendered inline by `js/page-render.js`, and use it to replace the ad-hoc inline-text convention already live in `pages/bed-bug-rules-prevention.js`.

**Architecture:** `build_scripts/schema.js` gains an `unverified`/`unverifiedReason` pair on `cardSchema` and a union type (`string | {text, unverified, unverifiedReason}`) on `sectionSchema.bullets`/`.paragraphs` and `stepSchema.bullets`/`.text`. `js/page-render.js` gains two small shared helpers (`normalizeTextItem`, `unverifiedPill`) that every bullet/paragraph/card renderer routes through. `css/styles.css` gets one new `.unverified-pill` class reusing the existing `--sfds-warning-*` tokens. `build_scripts/data-checks.js` gets a pure `countUnverifiedClaims` function surfaced as a one-line summary count in `bun run validate`'s output.

**Tech Stack:** Zod (schema), plain template-literal HTML rendering (no framework), Bun test runner, Prettier.

**Source spec:** `.claude/worktrees/content-confidence/docs/superpowers/specs/2026-07-06-content-confidence-design.md` (approved; not yet merged to `main` — this plan implements it directly against `main`'s current file layout, which already differs from the spec's assumptions in two places noted in Tasks 2 and 3 below).

## Global Constraints

- No semicolons, single quotes, 2-space indentation, 100-character print width, ES5 trailing commas (enforced by `bun run format:check`, per `.prettierrc.json`).
- Callouts and table cells are explicitly out of scope for this pass — do not add `unverified` handling to `renderCallout` or `renderTable`.
- No confidence spectrum — this is a single boolean `unverified` flag, not multiple tiers.
- Never touch the generated files `manager-review-single-file.html`, `single-file-export-current-source.html`, or `data/page_inventory.*` — they're rebuilt by `bun run build`, not hand-edited.
- Run `bun run format:check` and the affected `bun test` files after every task; run `bun run validate` after every task that touches `build_scripts/schema.js`, `build_scripts/data-checks.js`, `build_scripts/validate.js`, or `pages/*.js`.

---

### Task 1: Schema — add `unverified`/`unverifiedReason` fields

**Files:**
- Modify: `build_scripts/schema.js`
- Test: `tests/data-validation.test.js`

**Interfaces:**
- Produces: `unverifiedItemSchema` (Zod schema: `{ text: string (min 1), unverified?: boolean, unverifiedReason?: string }`), used by Task 6's migrated page content and validated automatically by `dataSchema`. `cardSchema` gains optional `unverified`/`unverifiedReason` fields.

- [ ] **Step 1: Write the failing tests**

Add this `describe` block at the end of `tests/data-validation.test.js` (after the existing `findListFormatViolations` block, before the final closing — i.e. append as a new top-level `describe`):

```js
describe('content-confidence fields', () => {
  test('accepts a card with unverified and unverifiedReason', () => {
    const data = validData({
      sections: [
        {
          heading: 'Intro',
          karl: 'Body section',
          cards: [
            {
              title: 'Card',
              text: 'Text',
              unverified: true,
              unverifiedReason: 'SME placeholder',
            },
          ],
        },
      ],
    })
    expect(dataSchema.safeParse(data).success).toBe(true)
  })

  test('accepts a mix of plain strings and unverified objects in bullets', () => {
    const data = validData({
      sections: [
        {
          heading: 'Intro',
          karl: 'Body section',
          bullets: [
            'Plain bullet',
            { text: 'Flagged bullet', unverified: true, unverifiedReason: 'Confirm with SME' },
          ],
        },
      ],
    })
    expect(dataSchema.safeParse(data).success).toBe(true)
  })

  test('accepts a mix of plain strings and unverified objects in paragraphs', () => {
    const data = validData({
      sections: [
        {
          heading: 'Intro',
          karl: 'Body section',
          paragraphs: ['Plain paragraph', { text: 'Flagged paragraph', unverified: true }],
        },
      ],
    })
    expect(dataSchema.safeParse(data).success).toBe(true)
  })

  test('accepts unverified objects in step text and bullets', () => {
    const data = validData({
      sections: [
        {
          heading: 'Intro',
          karl: 'Body section',
          steps: [
            {
              title: 'Step',
              text: [{ text: 'Flagged step text', unverified: true }],
              bullets: [{ text: 'Flagged step bullet', unverified: true }],
            },
          ],
        },
      ],
    })
    expect(dataSchema.safeParse(data).success).toBe(true)
  })

  test('rejects an unverified item with empty text', () => {
    const data = validData({
      sections: [
        {
          heading: 'Intro',
          karl: 'Body section',
          bullets: [{ text: '', unverified: true }],
        },
      ],
    })
    expect(dataSchema.safeParse(data).success).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test tests/data-validation.test.js`
Expected: the 5 new tests FAIL (cards/bullets/paragraphs/steps reject the new object shape because `cardSchema`/`sectionSchema`/`stepSchema` don't accept it yet; the "rejects empty text" test may pass vacuously or fail depending on how Zod treats the unknown `unverified` key — don't worry about which ones fail, just confirm at least the acceptance tests fail).

- [ ] **Step 3: Implement the schema changes**

In `build_scripts/schema.js`, replace the `cardSchema` declaration:

```js
const cardSchema = z.object({
  title: z.string().min(1),
  text: z.string().min(1).optional(),
  target: z.string().optional(),
  url: z.string().optional(),
  karl: z.string().optional(),
  fileType: z.string().optional(),
  unverified: z.boolean().optional(),
  unverifiedReason: z.string().optional(),
})
```

Immediately after `calloutSchema` and before `stepSchema`, add:

```js
const unverifiedItemSchema = z.object({
  text: z.string().min(1),
  unverified: z.boolean().optional(),
  unverifiedReason: z.string().optional(),
})
```

Replace the `stepSchema` declaration's `text`/`bullets` lines:

```js
const stepSchema = z.object({
  title: z.string().min(1),
  text: z.array(z.union([z.string(), unverifiedItemSchema])).optional(),
  bullets: z.array(z.union([z.string(), unverifiedItemSchema])).optional(),
  button: z.string().optional(),
  buttonTarget: z.string().optional(),
  buttonUrl: z.string().optional(),
  karl: z.string().optional(),
  callout: calloutSchema.optional(),
})
```

Replace the `sectionSchema` declaration's `paragraphs`/`bullets` lines:

```js
const sectionSchema = z.object({
  heading: z.string().min(1),
  kind: z.string().optional(),
  component: sectionComponentSchema.optional(),
  karl: z.string().min(1),
  paragraphs: z.array(z.union([z.string(), unverifiedItemSchema])).optional(),
  steps: z.array(stepSchema).optional(),
  bullets: z.array(z.union([z.string(), unverifiedItemSchema])).optional(),
  table: z.array(z.array(z.string())).optional(),
  cards: z.array(cardSchema).optional(),
  image: imageSchema.optional(),
  button: z.string().optional(),
  buttonTarget: z.string().optional(),
  buttonUrl: z.string().optional(),
  buttonStyle: z.string().optional(),
  callout: calloutSchema.optional(),
})
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test tests/data-validation.test.js`
Expected: PASS, all tests including the 5 new ones.

- [ ] **Step 5: Full validate + format check**

Run: `bun run validate`
Expected: `validated 39 pages` (still the old message — Task 5 changes this) with no errors, since existing `pages/*.js` content is all plain strings and still matches the union's `z.string()` branch.

Run: `bun run format:check`
Expected: clean (no output, exit 0). If it reports `build_scripts/schema.js`, run `bun run format` and re-check.

- [ ] **Step 6: Commit**

```bash
git add build_scripts/schema.js tests/data-validation.test.js
git commit -m "feat: add unverified/unverifiedReason fields to card, bullet, and paragraph schemas"
```

---

### Task 2: Rendering — shared normalize/pill helpers wired into `paragraphList`/`bulletList`

**Files:**
- Modify: `js/page-render.js`
- Test: `tests/page-render.test.js`

**Interfaces:**
- Consumes: nothing new (uses `escapeHtml` from `js/utils.js`, already loaded before `js/page-render.js`).
- Produces: `normalizeTextItem(item) -> {text: string, unverified: boolean, unverifiedReason: string}` and `unverifiedPill(reason) -> string` (HTML). Task 3's card renderers consume `unverifiedPill` directly.

Note: the source spec assumed every bullet/paragraph render site needed its own change. In the current `main` codebase, `section.bullets`/`.paragraphs` (`js/page-render.js:326,328`) and `step.text`/`.bullets` (`js/page-render.js:189,244`) all already route through the single shared `paragraphList()`/`bulletList()` functions, so changing those two functions covers every text-list render site in one place — no other call site needs touching.

- [ ] **Step 1: Write the failing tests**

Add these tests to `tests/page-render.test.js`, inside the existing `describe('page-render.js escaping', ...)` block (anywhere after the `ctx`/`PAYLOAD` setup, e.g. right after the existing `'paragraphList escapes every paragraph'` test):

```js
  test('paragraphList renders an unverified pill after a flagged paragraph', () => {
    const html = ctx.paragraphList([
      { text: 'Flagged claim', unverified: true, unverifiedReason: 'Confirm with SME' },
    ])
    expect(html).toBe(
      '<p>Flagged claim<span class="unverified-pill" title="Confirm with SME"><span aria-hidden="true">⚠</span> Unverified</span></p>'
    )
  })

  test('paragraphList leaves a plain string paragraph unchanged', () => {
    expect(ctx.paragraphList(['Plain claim'])).toBe('<p>Plain claim</p>')
  })

  test('bulletList renders an unverified pill after a flagged bullet', () => {
    const html = ctx.bulletList([{ text: 'Flagged claim', unverified: true }])
    expect(html).toContain('<li>Flagged claim<span class="unverified-pill">')
  })

  test('bulletList omits the title attribute when there is no unverifiedReason', () => {
    const html = ctx.bulletList([{ text: 'Flagged claim', unverified: true }])
    expect(html).not.toContain('title=')
  })

  test('bulletList escapes the unverifiedReason tooltip', () => {
    const html = ctx.bulletList([
      { text: 'Flagged claim', unverified: true, unverifiedReason: PAYLOAD },
    ])
    assertEscaped(html)
  })

  test('bulletList handles a mix of plain strings and unverified objects', () => {
    const html = ctx.bulletList(['Plain', { text: 'Flagged', unverified: true }])
    expect(html).toContain('<li>Plain</li>')
    expect(html).toContain('<li>Flagged<span class="unverified-pill">')
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test tests/page-render.test.js`
Expected: FAIL with errors like `expected '<p>Flagged claim</p>' ... [Object object] not rendered` or similar — `paragraphList`/`bulletList` currently call `formatMarkdown(p)` directly on the raw array item, which produces `''` for a non-string object.

- [ ] **Step 3: Implement `normalizeTextItem`, `unverifiedPill`, and update `paragraphList`/`bulletList`**

In `js/page-render.js`, insert these two functions immediately before `function formatMarkdown(text) {` (currently line 22):

```js
function normalizeTextItem(item) {
  if (typeof item === 'string') return { text: item, unverified: false, unverifiedReason: '' }
  return {
    text: item.text,
    unverified: Boolean(item.unverified),
    unverifiedReason: item.unverifiedReason || '',
  }
}
function unverifiedPill(reason) {
  return `<span class="unverified-pill"${reason ? ` title="${escapeHtml(reason)}"` : ''}><span aria-hidden="true">⚠</span> Unverified</span>`
}
```

Replace `function paragraphList(paragraphs = []) {` through its closing `}` (currently lines 28-30):

```js
function paragraphList(paragraphs = []) {
  return paragraphs
    .map((p) => {
      const item = normalizeTextItem(p)
      return `<p>${formatMarkdown(item.text)}${item.unverified ? unverifiedPill(item.unverifiedReason) : ''}</p>`
    })
    .join('')
}
```

Replace `function bulletList(bullets = []) {` through its closing `}` (currently lines 40-43):

```js
function bulletList(bullets = []) {
  if (!bullets.length) return ''
  return `<ul>${bullets
    .map((b) => {
      const item = normalizeTextItem(b)
      return `<li>${formatMarkdown(item.text)}${item.unverified ? unverifiedPill(item.unverifiedReason) : ''}</li>`
    })
    .join('')}</ul>`
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test tests/page-render.test.js`
Expected: PASS, all tests including the 6 new ones.

- [ ] **Step 5: Full test suite + format check**

Run: `bun test tests/utils.test.js tests/data-validation.test.js tests/page-render.test.js tests/csv.test.js tests/review-state-schema.test.js tests/reading-level.test.js tests/index-html-checks.test.js`
Expected: PASS (0 fail).

Run: `bun run format:check`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add js/page-render.js tests/page-render.test.js
git commit -m "feat: render unverified pill inline via normalizeTextItem in paragraphList/bulletList"
```

---

### Task 3: Rendering — card renderers append the unverified pill

**Files:**
- Modify: `js/page-render.js`
- Test: `tests/page-render.test.js`

**Interfaces:**
- Consumes: `unverifiedPill(reason) -> string` from Task 2.

Note: the source spec described "card rendering" as one place. `main` currently has **four** card-list renderers that each independently render `card.text`: `renderCards`, `renderServiceTiles`, `renderResourcesList`, and `renderRelatedList`. Since `cardSchema` (shared by all four) now allows `unverified`/`unverifiedReason` on any card regardless of which list it renders in, all four need the same treatment — otherwise a flagged card in, say, a resources list would validate but silently render with no pill.

- [ ] **Step 1: Write the failing tests**

Add these tests to `tests/page-render.test.js`, after the existing `'renderCards escapes title, text, and url for every card'` test:

```js
  test('renderCards appends an unverified pill when card.unverified is true', () => {
    const html = ctx.renderCards([{ title: 'Card', text: 'Claim', unverified: true }])
    expect(html).toContain('<p>Claim<span class="unverified-pill">')
  })

  test('renderCards omits the pill when card.unverified is not set', () => {
    const html = ctx.renderCards([{ title: 'Card', text: 'Claim' }])
    expect(html).not.toContain('unverified-pill')
  })

  test('renderServiceTiles appends an unverified pill when card.unverified is true', () => {
    const html = ctx.renderServiceTiles([{ title: 'Tile', text: 'Claim', unverified: true }])
    expect(html).toContain('<span class="service-tile-text">Claim<span class="unverified-pill">')
  })

  test('renderResourcesList appends an unverified pill when card.unverified is true', () => {
    const html = ctx.renderResourcesList([{ title: 'Resource', text: 'Claim', unverified: true }])
    expect(html).toContain('<p>Claim<span class="unverified-pill">')
  })

  test('renderRelatedList appends an unverified pill when card.unverified is true', () => {
    const html = ctx.renderRelatedList([{ title: 'Related', text: 'Claim', unverified: true }])
    expect(html).toContain('<p>Claim<span class="unverified-pill">')
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test tests/page-render.test.js`
Expected: the 4 new "appends an unverified pill" tests FAIL (no pill in current output); the "omits the pill" test passes already.

- [ ] **Step 3: Wire the pill into all four card renderers**

In `js/page-render.js`, inside `renderCards`, change the return line's card-text fragment. Find:

```js
      return `<article class="card">${karlTag(c.karl || 'Linked page item: title + description + link. Use Related section, body link, Resource Collection item, or Agency page link section as appropriate.', 'placement')}<h3><a href="${href}"${attr}>${escapeHtml(c.title)}${externalMark}</a></h3>${c.text ? `<p>${escapeHtml(c.text)}</p>` : ''}</article>`
```

Replace with:

```js
      return `<article class="card">${karlTag(c.karl || 'Linked page item: title + description + link. Use Related section, body link, Resource Collection item, or Agency page link section as appropriate.', 'placement')}<h3><a href="${href}"${attr}>${escapeHtml(c.title)}${externalMark}</a></h3>${c.text ? `<p>${escapeHtml(c.text)}${c.unverified ? unverifiedPill(c.unverifiedReason) : ''}</p>` : ''}</article>`
```

Inside `renderServiceTiles`, find:

```js
      return `<a class="service-tile" href="${href}"${attr}>${karlTag(c.karl || 'Topic page service item', 'placement')}<span class="service-tile-title">${escapeHtml(c.title)}${externalMark}</span><span class="service-tile-text">${escapeHtml(c.text)}</span></a>`
```

Replace with:

```js
      return `<a class="service-tile" href="${href}"${attr}>${karlTag(c.karl || 'Topic page service item', 'placement')}<span class="service-tile-title">${escapeHtml(c.title)}${externalMark}</span><span class="service-tile-text">${escapeHtml(c.text)}${c.unverified ? unverifiedPill(c.unverifiedReason) : ''}</span></a>`
```

Inside `renderResourcesList`, find:

```js
      return `<li>${karlTag(c.karl || 'Resources section link', 'placement')}<a href="${href}"${attr}>${escapeHtml(c.title)}${externalMark}</a>${fileBadge}<p>${escapeHtml(c.text)}</p></li>`
```

Replace with:

```js
      return `<li>${karlTag(c.karl || 'Resources section link', 'placement')}<a href="${href}"${attr}>${escapeHtml(c.title)}${externalMark}</a>${fileBadge}<p>${escapeHtml(c.text)}${c.unverified ? unverifiedPill(c.unverifiedReason) : ''}</p></li>`
```

Inside `renderRelatedList`, find:

```js
      return `<li>${karlTag(c.karl || 'Related section: right-panel linked page', 'placement')}<a href="${href}"${attr}>${escapeHtml(c.title)}${externalMark}</a><p>${escapeHtml(c.text)}</p></li>`
```

Replace with:

```js
      return `<li>${karlTag(c.karl || 'Related section: right-panel linked page', 'placement')}<a href="${href}"${attr}>${escapeHtml(c.title)}${externalMark}</a><p>${escapeHtml(c.text)}${c.unverified ? unverifiedPill(c.unverifiedReason) : ''}</p></li>`
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test tests/page-render.test.js`
Expected: PASS, all tests including the 5 new ones.

- [ ] **Step 5: Full test suite + format check**

Run: `bun test tests/utils.test.js tests/data-validation.test.js tests/page-render.test.js tests/csv.test.js tests/review-state-schema.test.js tests/reading-level.test.js tests/index-html-checks.test.js`
Expected: PASS (0 fail).

Run: `bun run format:check`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add js/page-render.js tests/page-render.test.js
git commit -m "feat: append unverified pill to all four card renderers"
```

---

### Task 4: CSS — `.unverified-pill` styling and Karl-tag-toggle integration

**Files:**
- Modify: `css/styles.css`

**Interfaces:**
- Consumes: the `class="unverified-pill"` markup produced by Task 2/3's `unverifiedPill()` helper.
- Consumes: existing tokens `--sfds-warning-bg`, `--sfds-warning-text`, `--sfds-warning-border` (already defined at `css/styles.css:20-22` and used by `.callout--warning` at line 840-842 — no new tokens needed).

Note: the source spec described "two existing `body.hide-karl-tags` hidden-selector lists." Confirmed on `main`: they are at `css/styles.css:1180-1183` and `css/styles.css:1437-1441`. Both need the new selector.

- [ ] **Step 1: Add the `.unverified-pill` rule**

In `css/styles.css`, find this block (currently around line 1175-1179):

```css
.karl-tag[data-kind='editor'] {
  background: var(--sfds-success-bg);
  color: var(--sfds-success-text);
  border-color: var(--sfds-success-border);
}
```

Insert this new rule immediately after it, before the `body.hide-karl-tags` block:

```css
.unverified-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  margin-left: 0.4rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: var(--sfds-warning-bg);
  color: var(--sfds-warning-text);
  border: 1px solid var(--sfds-warning-border);
  font-size: 0.68rem;
  font-weight: 700;
  vertical-align: middle;
}
```

- [ ] **Step 2: Add `.unverified-pill` to both `hide-karl-tags` selector lists**

Find (currently `css/styles.css:1180-1183`):

```css
body.hide-karl-tags .karl-tag,
body.hide-karl-tags .cms-help,
body.hide-karl-tags .karl-tag-legend,
body.hide-karl-tags .editor-qa {
  display: none !important;
}
```

This exact 4-selector block appears **twice** in the file (the first occurrence has these 4 selectors; the second, later occurrence has 5 — see next). For this first occurrence, replace with:

```css
body.hide-karl-tags .karl-tag,
body.hide-karl-tags .cms-help,
body.hide-karl-tags .karl-tag-legend,
body.hide-karl-tags .editor-qa,
body.hide-karl-tags .unverified-pill {
  display: none !important;
}
```

Find the second occurrence (currently `css/styles.css:1437-1441`):

```css
body.hide-karl-tags .karl-tag,
body.hide-karl-tags .cms-help,
body.hide-karl-tags .karl-help-nested,
body.hide-karl-tags .karl-tag-legend,
body.hide-karl-tags .editor-qa {
  display: none !important;
}
```

Replace with:

```css
body.hide-karl-tags .karl-tag,
body.hide-karl-tags .cms-help,
body.hide-karl-tags .karl-help-nested,
body.hide-karl-tags .karl-tag-legend,
body.hide-karl-tags .editor-qa,
body.hide-karl-tags .unverified-pill {
  display: none !important;
}
```

(Use the surrounding context — the first block is followed by `.karl-tag-legend {`, the second is preceded by `.karl-help-nested .cms-help {` — to target each occurrence individually, since the two blocks are textually different from each other even though both need the same one-line addition.)

- [ ] **Step 3: Format check**

Run: `bun run format:check`
Expected: clean. If it reports `css/styles.css`, run `bun run format` and re-check.

- [ ] **Step 4: Commit**

```bash
git add css/styles.css
git commit -m "style: add .unverified-pill class, hidden alongside Karl tags"
```

---

### Task 5: Validation — unverified-claim count in `bun run validate` output

**Files:**
- Modify: `build_scripts/data-checks.js`
- Modify: `build_scripts/validate.js`
- Test: `tests/data-validation.test.js`

**Interfaces:**
- Produces: `countUnverifiedClaims(pages) -> number`, consumed by `build_scripts/validate.js`'s final `console.log`.

- [ ] **Step 1: Write the failing tests**

Add this `describe` block to `tests/data-validation.test.js`, after the `content-confidence fields` block added in Task 1, and add `countUnverifiedClaims` to the existing `require('../build_scripts/data-checks')` destructure at the top of the file:

```js
const {
  findMissingOrderKeys,
  findBrokenCardTargets,
  findBrokenButtonTargets,
  isTopicPageFirst,
  findBannedTerms,
  findListFormatViolations,
  countUnverifiedClaims,
} = require('../build_scripts/data-checks')
```

```js
describe('countUnverifiedClaims', () => {
  test('zero when nothing is flagged', () => {
    const pages = { a: { sections: [{ bullets: ['Plain'], paragraphs: ['Plain'] }] } }
    expect(countUnverifiedClaims(pages)).toBe(0)
  })

  test('counts flagged bullets, paragraphs, step text/bullets, and cards', () => {
    const pages = {
      a: {
        sections: [
          {
            bullets: ['Plain', { text: 'Flagged', unverified: true }],
            paragraphs: [{ text: 'Flagged', unverified: true }],
            cards: [
              { title: 'Card', unverified: true },
              { title: 'Card 2' },
            ],
            steps: [
              {
                text: [{ text: 'Flagged', unverified: true }],
                bullets: [{ text: 'Flagged', unverified: true }],
              },
            ],
          },
        ],
      },
    }
    expect(countUnverifiedClaims(pages)).toBe(5)
  })

  test('does not count an object item with unverified: false', () => {
    const pages = { a: { sections: [{ bullets: [{ text: 'Not flagged', unverified: false }] }] } }
    expect(countUnverifiedClaims(pages)).toBe(0)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test tests/data-validation.test.js`
Expected: FAIL with `countUnverifiedClaims is not a function` (or `undefined`).

- [ ] **Step 3: Implement `countUnverifiedClaims` in `build_scripts/data-checks.js`**

Add this function after `findListFormatViolations` and before `module.exports`:

```js
/**
 * Count bullets, paragraphs, step text/bullets, and cards flagged
 * `unverified: true` across every page. Used for the validate.js summary line.
 * @param {Record<string, object>} pages
 * @returns {number}
 */
function countUnverifiedClaims(pages) {
  function countFlagged(items) {
    return (items || []).filter((item) => item && typeof item === 'object' && item.unverified)
      .length
  }

  let count = 0
  for (const page of Object.values(pages)) {
    for (const section of page.sections || []) {
      count += countFlagged(section.paragraphs)
      count += countFlagged(section.bullets)
      count += (section.cards || []).filter((card) => card.unverified).length
      for (const step of section.steps || []) {
        count += countFlagged(step.text)
        count += countFlagged(step.bullets)
      }
    }
  }
  return count
}
```

Update `module.exports` to include it:

```js
module.exports = {
  findMissingOrderKeys,
  findBrokenCardTargets,
  findBrokenButtonTargets,
  isTopicPageFirst,
  findBannedTerms,
  findListFormatViolations,
  countUnverifiedClaims,
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test tests/data-validation.test.js`
Expected: PASS, all tests including the 3 new ones.

- [ ] **Step 5: Wire the count into `build_scripts/validate.js`**

In `build_scripts/validate.js`, update the `require('./data-checks')` destructure:

```js
const {
  findMissingOrderKeys,
  findBrokenCardTargets,
  findBrokenButtonTargets,
  isTopicPageFirst,
  findBannedTerms,
  findListFormatViolations,
  countUnverifiedClaims,
} = require('./data-checks')
```

Replace the final line of the file:

```js
console.log('validated', Object.keys(parsed.data.pages).length, 'pages')
```

with:

```js
const unverifiedCount = countUnverifiedClaims(parsed.data.pages)
console.log(
  'validated',
  Object.keys(parsed.data.pages).length,
  'pages,',
  unverifiedCount,
  'unverified claims flagged'
)
```

- [ ] **Step 6: Run validate to confirm the new output**

Run: `bun run validate`
Expected: `validated 39 pages, 0 unverified claims flagged` (0, since Task 6's migration hasn't landed yet).

- [ ] **Step 7: Format check**

Run: `bun run format:check`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add build_scripts/data-checks.js build_scripts/validate.js tests/data-validation.test.js
git commit -m "feat: report unverified-claim count in validate.js summary output"
```

---

### Task 6: Migrate existing ad-hoc unverified content to the schema

**Files:**
- Modify: `pages/bed-bug-rules-prevention.js`
- Modify: `pages/mosquito-education-workshop.js`

**Interfaces:**
- Consumes: `unverifiedItemSchema` shape from Task 1 (`{text, unverified, unverifiedReason}`), the rendering path from Tasks 2-3, and `countUnverifiedClaims` from Task 5 (this task's payoff: the validate summary count goes from 0 to 3).

- [ ] **Step 1: Convert the DPH re-inspection bullet in `pages/bed-bug-rules-prevention.js`**

Find this bullet (currently line 114, inside the `'Eradication and abatement timeline'` section's `bullets` array):

```js
        'DPH Re-inspection (unverified -- confirm before publication): DPH will conduct a final re-inspection within 45 days of the last treatment to verify the closure of a Notice of Violation.',
```

Replace with:

```js
        {
          text: 'DPH will conduct a final re-inspection within 45 days of the last treatment to verify the closure of a Notice of Violation.',
          unverified: true,
          unverifiedReason:
            "No 45-day final-re-inspection provision found in the SFDPH bed bug Director's Rules source doc or any other source in this repo.",
        },
```

- [ ] **Step 2: Convert the two SME-placeholder bullets in `pages/mosquito-education-workshop.js`**

Find these two bullets (currently lines 107-108, inside the `'Questions before you apply'` section's `bullets` array):

```js
        'Fits groups up to about 60 students per session; larger groups can be split into multiple sessions',
        'Request at least 3 weeks before your event date to allow time for scheduling, setup, and equipment transport',
```

Replace with:

```js
        {
          text: 'Fits groups up to about 60 students per session; larger groups can be split into multiple sessions',
          unverified: true,
          unverifiedReason:
            'SME placeholder — capacity is illustrative example content for mockup review; confirm actual value with HHVC before publication (see page editorNote).',
        },
        {
          text: 'Request at least 3 weeks before your event date to allow time for scheduling, setup, and equipment transport',
          unverified: true,
          unverifiedReason:
            'SME placeholder — lead time is illustrative example content for mockup review; confirm actual value with HHVC before publication (see page editorNote).',
        },
```

- [ ] **Step 3: Validate**

Run: `bun run validate`
Expected: `validated 39 pages, 3 unverified claims flagged` (0 → 3: one from `bed-bug-rules-prevention.js`, two from `mosquito-education-workshop.js`).

- [ ] **Step 4: Format check**

Run: `bun run format:check`
Expected: clean. If it reports either page file, run `bun run format` and re-check.

- [ ] **Step 5: Commit**

```bash
git add pages/bed-bug-rules-prevention.js pages/mosquito-education-workshop.js
git commit -m "content: migrate ad-hoc unverified bullets to the unverified/unverifiedReason schema"
```

---

### Task 7: Full regression pass and live manual verification

**Files:** none (verification only)

**Interfaces:** none — this task is a checkpoint, consuming the full output of Tasks 1-6.

- [ ] **Step 1: Run the complete automated verification suite**

Run: `bun run format:check`
Expected: clean.

Run: `bun run validate`
Expected: `validated 39 pages, 3 unverified claims flagged`.

Run: `bun test tests/utils.test.js tests/data-validation.test.js tests/page-render.test.js tests/csv.test.js tests/review-state-schema.test.js tests/reading-level.test.js tests/index-html-checks.test.js`
Expected: PASS, 0 fail.

- [ ] **Step 2: Start the dev server**

Run: `bun run dev` (in the background, or in a separate terminal — it serves at `http://127.0.0.1:8080`)

- [ ] **Step 3: Manual live-render check on `bed-bug-rules-prevention.js`**

Using Playwright (or the browser directly): navigate to the page (use the sidebar page picker or `data-render-target` navigation from the mockup — this page has no direct URL route, it's selected via the in-app page picker/sitemap), find the "Eradication and abatement timeline" section, and confirm:
- The "DPH will conduct a final re-inspection..." bullet shows an inline `⚠ Unverified` pill immediately after the bullet text.
- Hovering the pill shows the tooltip text (the `unverifiedReason`) via the native `title` attribute.
- Toggling "hide Karl tags" (the workspace control that sets `body.hide-karl-tags`) also hides this pill.

- [ ] **Step 4: Manual live-render check on `mosquito-education-workshop.js`**

Navigate to the page, find the "Questions before you apply" section, and confirm both the "up to about 60 students" and "at least 3 weeks before" bullets show the pill with the correct tooltip text, and both hide under "hide Karl tags" the same way.

- [ ] **Step 5: Confirm no regressions on an unflagged page**

Navigate to any page with plain-string bullets/paragraphs/cards (e.g. the Topic page, `pestsTopic`) and confirm nothing changed visually — no stray pills, no rendering errors in the browser console.

- [ ] **Step 6: No commit needed**

This is a verification checkpoint. If any check in Steps 1-5 fails, fix forward with a new commit before considering the feature done.
