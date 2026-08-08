# Selection-driven AI rewrite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a reviewer highlight body copy in the mockup, click a floating button, and apply an AI rewrite in place — reviewed before it lands and flagged unverified once applied.

**Architecture:** `js/page-render.js` gains `data-rewrite-field` dot-path attributes on paragraphs, bullets and step text. A new self-mounting IIFE pair (`js/ai-rewrite.js` orchestrator + `js/ai-rewrite-render.js` view) watches selections inside `#mockPage`, resolves the containing field's path, and calls a new `rewrite-field` task on the existing `/api/ai/generate` route. Apply writes the whole field back into in-memory page data via `setByPath`.

**Tech Stack:** Plain browser ES modules (no framework), Bun + `bun:test`, Zod on the server, Playwright for E2E, Prettier as the only linter.

## Global Constraints

Copied verbatim from the spec and this repo's CLAUDE.md — every task's requirements implicitly include these:

- **No semicolons.** Prettier config: single quotes, 2-space indent, `printWidth: 100`, ES5 trailing commas. Code must be ASI-safe. `bun run format` before every commit; `bun run format:check` is the CI lint gate.
- **`server.ts` is Prettier-excluded** — do not reformat it; match its existing double-quote style when editing it.
- **Never writes to `pages/*.js` on disk.** Apply mutates in-memory `pageData` only.
- **Everything reaching `innerHTML` goes through `escapeHtml`.** Model output is text nobody in this repo wrote.
- **New IIFE modules use the leading-semicolon form** `;(function mountX(){…})()` and expose via `window.X = window.X || {}`.
- **`camelCase` for JS identifiers, `snake_case` for serialized data fields.**
- **Every module opens with a header block** stating its role and its load-order dependency. Functions carry full JSDoc (`@param`/`@returns`). Comments justify the *why*.
- **New test files must be added to `package.json`'s explicit `test` script list** — this repo enumerates tests rather than globbing, so an unlisted file covers nothing in CI.
- **Scope is paragraphs, bullets, and step text only.** Cards, tables, callouts, `whatToKnow` and spotlight are explicitly out of scope for v1 and must emit no `data-rewrite-field`.

---

### Task 1: `getByPath` / `setByPath` path helpers

**Files:**
- Modify: `js/utils.js` (add two functions; add both to the `export {` block at line 814 and to the `window.utils` object)
- Test: `tests/utils.test.js` (existing, extended)

**Interfaces:**
- Consumes: nothing
- Produces: `getByPath(root: object, path: string): unknown` — returns `undefined` for any unresolvable path. `setByPath(root: object, path: string, value: unknown): boolean` — returns `false` and writes nothing if any intermediate segment is missing; **never creates intermediate objects.**

- [ ] **Step 1: Write the failing tests**

Append to `tests/utils.test.js`:

```js
describe('getByPath', () => {
  const page = {
    sections: [{ paragraphs: ['first', { text: 'second' }], steps: [{ text: ['step text'] }] }],
  }

  test('resolves a nested array index to its value', () => {
    expect(getByPath(page, 'sections.0.paragraphs.0')).toBe('first')
  })

  test('resolves a path ending at an object item', () => {
    expect(getByPath(page, 'sections.0.paragraphs.1')).toEqual({ text: 'second' })
  })

  test('resolves through a step text array', () => {
    expect(getByPath(page, 'sections.0.steps.0.text.0')).toBe('step text')
  })

  test('returns undefined for a missing intermediate segment', () => {
    expect(getByPath(page, 'sections.9.paragraphs.0')).toBeUndefined()
  })

  test('returns undefined for an empty path', () => {
    expect(getByPath(page, '')).toBeUndefined()
  })
})

describe('setByPath', () => {
  test('writes a value at a resolvable path and reports success', () => {
    const page = { sections: [{ paragraphs: ['old'] }] }
    expect(setByPath(page, 'sections.0.paragraphs.0', 'new')).toBe(true)
    expect(page.sections[0].paragraphs[0]).toBe('new')
  })

  test('refuses an unresolvable path without creating intermediates', () => {
    const page = { sections: [] }
    expect(setByPath(page, 'sections.0.paragraphs.0', 'new')).toBe(false)
    expect(page.sections[0]).toBeUndefined()
  })

  test('returns false for an empty path', () => {
    const page = { sections: [] }
    expect(setByPath(page, '', 'new')).toBe(false)
  })
})
```

Add `getByPath` and `setByPath` to the existing import from `../js/utils.js` at the top of the file.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test tests/utils.test.js`
Expected: FAIL — `getByPath is not a function`.

- [ ] **Step 3: Implement both helpers in `js/utils.js`**

Add near the other cross-cutting helpers:

```js
/**
 * Resolve a dot-path against an object, e.g. 'sections.2.paragraphs.1'.
 *
 * Deliberately total: any unresolvable segment yields `undefined` rather than
 * throwing, because callers resolve paths that came out of the DOM, where a
 * stale attribute after a re-render is a normal race rather than a bug.
 * @param {object} root
 * @param {string} path
 * @returns {unknown}
 */
function getByPath(root, path) {
  if (!root || typeof path !== 'string' || !path) return undefined
  let current = root
  for (const key of path.split('.')) {
    if (current === null || typeof current !== 'object') return undefined
    current = current[key]
  }
  return current
}

/**
 * Write a value at a dot-path, but only where the whole path already resolves.
 *
 * Never creates intermediate objects. Auto-vivifying `sections.9.paragraphs.0`
 * on a page with three sections would silently invent page structure that no
 * schema validated and no reviewer authored — a wrong write is worse here than
 * a refused one, so a missing segment is a reported failure the caller can
 * surface instead.
 * @param {object} root
 * @param {string} path
 * @param {unknown} value
 * @returns {boolean} True when the write happened.
 */
function setByPath(root, path, value) {
  if (!root || typeof path !== 'string' || !path) return false
  const keys = path.split('.')
  const last = keys.pop()
  let current = root
  for (const key of keys) {
    if (current === null || typeof current !== 'object') return false
    current = current[key]
  }
  if (current === null || typeof current !== 'object') return false
  current[last] = value
  return true
}
```

Add `getByPath,` and `setByPath,` to the `export {` block and to the `window.utils` assignment object.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test tests/utils.test.js`
Expected: PASS.

- [ ] **Step 5: Format and commit**

```bash
bun run format
git add js/utils.js tests/utils.test.js
git commit -m "feat: add getByPath/setByPath page-data path helpers"
```

---

### Task 2: `data-rewrite-field` annotation in the renderer

**Files:**
- Modify: `js/page-render.js` — `partitionSections()` (line 137), `paragraphList()` (62), `bulletList()` (79), `renderSteps()` (292), `renderSectionInner()` (401-406)
- Test: `tests/page-render.test.js` (existing, extended)

**Interfaces:**
- Consumes: nothing
- Produces: DOM attribute `data-rewrite-field="sections.<i>.paragraphs.<j>"` on `<p>`, `sections.<i>.bullets.<j>` on `<li>`, `sections.<i>.steps.<j>.text.<k>` and `sections.<i>.steps.<j>.bullets.<k>` inside steps. `<i>` is the index in the **original** `page.sections` array.

**Why this task is delicate:** `partitionSections()` redistributes sections into seven role buckets rendered in a fixed layout order, so the index in rendered order is *not* the index in `page.sections`. A path built from render order applies rewrites to the wrong section, silently. The original index is captured during the partition loop onto a render-time shallow copy (`__sectionIndex`), which survives the `{ ...s, component: 'resources' }` spreads at lines 550 and 589.

- [ ] **Step 1: Write the failing tests**

Append to `tests/page-render.test.js`:

```js
describe('data-rewrite-field annotation', () => {
  test('annotates section paragraphs with their source index', () => {
    const html = paragraphList(['one', 'two'], 'sections.0.paragraphs')
    expect(html).toContain('data-rewrite-field="sections.0.paragraphs.0"')
    expect(html).toContain('data-rewrite-field="sections.0.paragraphs.1"')
  })

  test('annotates bullets with their source index', () => {
    const html = bulletList(['a', 'b'], 'sections.3.bullets')
    expect(html).toContain('data-rewrite-field="sections.3.bullets.0"')
    expect(html).toContain('data-rewrite-field="sections.3.bullets.1"')
  })

  test('annotates step text and step bullets under the step index', () => {
    const html = renderSteps([{ title: 'Step', text: ['t'], bullets: ['b'] }], 'sections.1.steps')
    expect(html).toContain('data-rewrite-field="sections.1.steps.0.text.0"')
    expect(html).toContain('data-rewrite-field="sections.1.steps.0.bullets.0"')
  })

  test('emits no attribute when no path prefix is passed', () => {
    expect(paragraphList(['one'])).not.toContain('data-rewrite-field')
    expect(bulletList(['one'])).not.toContain('data-rewrite-field')
    expect(renderSteps([{ title: 'S', text: ['t'] }])).not.toContain('data-rewrite-field')
  })

  // The regression this whole addressing scheme exists to prevent. 'related'
  // sections are rendered LAST regardless of source order, so a path built
  // from render order would point at the wrong section entirely.
  test('uses the original page.sections index, not the rendered order', () => {
    const page = {
      slug: 'x',
      type: 'Information',
      title: 'X',
      summary: 'S',
      audience: ['a'],
      reading: 'Grade 6',
      sections: [
        { heading: 'Related things', component: 'related', karl: 'k', cards: [] },
        { heading: 'Body', karl: 'k', paragraphs: ['body copy'] },
      ],
    }
    const html = renderPageMain(page)
    // The body section is index 1 in source even though it renders before the
    // related section.
    expect(html).toContain('data-rewrite-field="sections.1.paragraphs.0"')
    expect(html).not.toContain('data-rewrite-field="sections.0.paragraphs.0"')
  })
})
```

Ensure `paragraphList`, `bulletList`, `renderSteps` and `renderPageMain` are imported at the top of the file (add any that are missing to the existing import).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test tests/page-render.test.js`
Expected: FAIL — no `data-rewrite-field` in output.

- [ ] **Step 3: Thread the path prefix through the renderers**

In `js/page-render.js`, replace `paragraphList` (line 62):

```js
/**
 * @param {Array<string|object>} paragraphs
 * @param {string} [pathPrefix] Dot-path of the array, e.g. 'sections.2.paragraphs'.
 *   Omitted at call sites that are out of the AI-rewrite scope, which is how
 *   that scope boundary is expressed — the renderer itself has no opinion.
 * @returns {string}
 */
function paragraphList(paragraphs = [], pathPrefix = '') {
  return paragraphs
    .map((p, index) => {
      const item = normalizeTextItem(p)
      const attr = pathPrefix
        ? ` data-rewrite-field="${escapeHtml(`${pathPrefix}.${index}`)}"`
        : ''
      return `<p${attr}>${formatMarkdown(item.text)}${item.unverified ? unverifiedPill(item.unverifiedReason) : ''}</p>`
    })
    .join('')
}
```

Replace `bulletList` (line 79):

```js
/**
 * @param {Array<string|object>} bullets
 * @param {string} [pathPrefix] Dot-path of the array, e.g. 'sections.2.bullets'.
 * @returns {string}
 */
function bulletList(bullets = [], pathPrefix = '') {
  if (!bullets.length) return ''
  return `<ul>${bullets
    .map((b, index) => {
      const item = normalizeTextItem(b)
      const attr = pathPrefix
        ? ` data-rewrite-field="${escapeHtml(`${pathPrefix}.${index}`)}"`
        : ''
      return `<li${attr}>${formatMarkdown(item.text)}${item.unverified ? unverifiedPill(item.unverifiedReason) : ''}</li>`
    })
    .join('')}</ul>`
}
```

In `renderSteps` (line 292), change the signature to `function renderSteps(steps = [], pathPrefix = '')`, make the `.map` callback take `(s, index)`, and replace the two inner calls in the template literal:

```js
${paragraphList(s.text || [], pathPrefix ? `${pathPrefix}.${index}.text` : '')}${bulletList(s.bullets || [], pathPrefix ? `${pathPrefix}.${index}.bullets` : '')}
```

- [ ] **Step 4: Capture the original section index and use it**

In `partitionSections` (line 137), replace the loop body so each bucket receives a render-time shallow copy carrying its source index:

```js
  for (const [index, section] of (page.sections || []).entries()) {
    // The ORIGINAL index, attached to a copy rather than to page data. Buckets
    // are rendered in a fixed layout order that is not source order, so this is
    // the only surviving link back to where the section actually lives.
    const withIndex = { ...section, __sectionIndex: index }
    const role = inferSectionRole(section, pageType)
    if (role === 'related') related.push(withIndex)
    else if (role === 'services') services.push(withIndex)
    else if (role === 'resources') resources.push(withIndex)
    else if (role === 'intro') intro.push(withIndex)
    else if (role === 'what-to-do') whatToDo.push(withIndex)
    else if (role === 'supporting') supporting.push(withIndex)
    else body.push(withIndex)
  }
```

In `renderSectionInner` (line 401), derive the base path and pass it down. Replace lines 403-405:

```js
  const base =
    typeof section.__sectionIndex === 'number' ? `sections.${section.__sectionIndex}` : ''
  inner += paragraphList(section.paragraphs || [], base ? `${base}.paragraphs` : '')
  inner += section.steps ? renderSteps(section.steps, base ? `${base}.steps` : '') : ''
  inner += bulletList(section.bullets || [], base ? `${base}.bullets` : '')
```

Leave `renderTextItems`, the `whatToKnow` call at line 362, and the spotlight call at line 467 untouched — they pass no prefix and stay out of scope.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun test tests/page-render.test.js && bun run validate`
Expected: PASS, and validate reports its usual page count with no new failures.

- [ ] **Step 6: Format and commit**

```bash
bun run format
git add js/page-render.js tests/page-render.test.js
git commit -m "feat: annotate rewritable text fields with source dot-paths"
```

---

### Task 3: Request/response schemas for the `rewrite-field` task

**Files:**
- Modify: `build_scripts/ai/schemas.js` (add `REWRITE_OUTPUT_SCHEMA`; convert `generateRequestSchema` at line 263 to a discriminated union; export both)
- Test: `tests/ai-assist-schema.test.js` (existing, extended)

**Interfaces:**
- Consumes: nothing
- Produces: `REWRITE_OUTPUT_SCHEMA` (JSON Schema object with a single required `rewrittenText` string). `generateRequestSchema` becomes `z.discriminatedUnion('task', [...])` with a `content` branch (unchanged fields) and a `rewrite-field` branch (`fieldText` required, `instruction` optional, no `prompt`).

- [ ] **Step 1: Write the failing tests**

Append to `tests/ai-assist-schema.test.js`:

```js
describe('generateRequestSchema task branches', () => {
  test('still rejects a content request with no prompt', () => {
    const result = generateRequestSchema.safeParse({ task: 'content' })
    expect(result.success).toBe(false)
  })

  test('accepts a rewrite-field request with fieldText and no prompt', () => {
    const result = generateRequestSchema.safeParse({
      task: 'rewrite-field',
      fieldText: 'Some copy to improve.',
    })
    expect(result.success).toBe(true)
  })

  test('rejects a rewrite-field request with no fieldText', () => {
    const result = generateRequestSchema.safeParse({ task: 'rewrite-field' })
    expect(result.success).toBe(false)
  })

  test('accepts an optional instruction on rewrite-field', () => {
    const result = generateRequestSchema.safeParse({
      task: 'rewrite-field',
      fieldText: 'Some copy.',
      instruction: 'Make it shorter.',
    })
    expect(result.success).toBe(true)
  })

  test('rejects an unknown task', () => {
    const result = generateRequestSchema.safeParse({ task: 'audit', fieldText: 'x' })
    expect(result.success).toBe(false)
  })
})

describe('REWRITE_OUTPUT_SCHEMA', () => {
  test('requires a rewrittenText string and forbids extra properties', () => {
    expect(REWRITE_OUTPUT_SCHEMA.required).toEqual(['rewrittenText'])
    expect(REWRITE_OUTPUT_SCHEMA.additionalProperties).toBe(false)
    expect(REWRITE_OUTPUT_SCHEMA.properties.rewrittenText.type).toBe('string')
  })
})
```

Add `REWRITE_OUTPUT_SCHEMA` to the existing `require('../build_scripts/ai/schemas.js')` destructure at the top of the file.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test tests/ai-assist-schema.test.js`
Expected: FAIL — `REWRITE_OUTPUT_SCHEMA` undefined and the rewrite branch rejected.

- [ ] **Step 3: Implement the schemas**

In `build_scripts/ai/schemas.js`, add beside `PAGE_OUTPUT_SCHEMA`:

```js
/**
 * The `rewrite-field` task's output: one replacement string, nothing else.
 *
 * Deliberately minimal. The field's identity (which paragraph, which section)
 * is the browser's to track — the model is handed text and asked for text, so
 * it has no opportunity to relocate a rewrite onto a different field.
 */
const REWRITE_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['rewrittenText'],
  properties: {
    rewrittenText: {
      type: 'string',
      description: 'The rewritten field text, plain prose, markdown links preserved.',
    },
  },
}
```

Replace `generateRequestSchema` (line 263):

```js
// A discriminated union rather than one object with optional fields. The two
// tasks genuinely differ: `content` cannot work without a prompt and
// `rewrite-field` has no use for one. Expressing that as a single shape would
// mean making `prompt` optional for both, which silently drops the guarantee
// that a content request always carries an instruction.
const generateRequestSchema = z.discriminatedUnion('task', [
  z.object({
    task: z.literal('content'),
    provider: z.enum(allProviderNames()).optional(),
    prompt: z.string().min(1).max(8000),
    page: groundingPageSchema.optional(),
  }),
  z.object({
    task: z.literal('rewrite-field'),
    provider: z.enum(allProviderNames()).optional(),
    // The whole field, not the selected substring — see the design spec for why
    // substring splicing is not viable against markdown-rendered copy.
    fieldText: z.string().min(1).max(8000),
    instruction: z.string().max(2000).optional(),
    page: groundingPageSchema.optional(),
  }),
])
```

Add `REWRITE_OUTPUT_SCHEMA,` to `module.exports`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test tests/ai-assist-schema.test.js`
Expected: PASS.

- [ ] **Step 5: Format and commit**

```bash
bun run format
git add build_scripts/ai/schemas.js tests/ai-assist-schema.test.js
git commit -m "feat: add rewrite-field request and output schemas"
```

---

### Task 4: Rewrite prompt and validator

**Files:**
- Modify: `build_scripts/ai/prompts.js` (add `buildRewriteSystemPrompt`, `buildRewriteUserPrompt`; export both)
- Modify: `build_scripts/ai/validate-output.js` (add `validateRewrite`; export it)
- Test: `tests/ai-assist-validate-rewrite.test.js` (new — add to `package.json`'s `test` list)

**Interfaces:**
- Consumes: `loadStyleCorpus()` and `serializePageForPrompt()` (the latter from `./schemas`)
- Produces: `buildRewriteSystemPrompt(): {system: string, groundedBy: string[]}`; `buildRewriteUserPrompt({fieldText, instruction, page, issues, previousDraft}): string`; `validateRewrite(result: object, fieldText: string): {valid: boolean, issues: string[], schemaValid: boolean}`

- [ ] **Step 1: Write the failing tests**

Create `tests/ai-assist-validate-rewrite.test.js`:

```js
import { describe, test, expect } from 'bun:test'

const { validateRewrite } = require('../build_scripts/ai/validate-output.js')

describe('validateRewrite', () => {
  test('accepts plain prose that preserves every link target', () => {
    const result = validateRewrite(
      { rewrittenText: 'Call us at 415-555-1212 or see [our guide](pestsTopic).' },
      'Reach out on 415-555-1212 or read [the guide](pestsTopic).'
    )
    expect(result.valid).toBe(true)
    expect(result.issues).toEqual([])
  })

  test('rejects an empty rewrite', () => {
    const result = validateRewrite({ rewrittenText: '   ' }, 'Original copy.')
    expect(result.valid).toBe(false)
    expect(result.schemaValid).toBe(false)
  })

  test('rejects a missing rewrittenText field', () => {
    const result = validateRewrite({}, 'Original copy.')
    expect(result.valid).toBe(false)
    expect(result.schemaValid).toBe(false)
  })

  test('rejects introduced HTML tags', () => {
    const result = validateRewrite({ rewrittenText: 'Call <strong>now</strong>.' }, 'Call now.')
    expect(result.valid).toBe(false)
    expect(result.issues.join(' ')).toContain('HTML')
  })

  test('names a dropped link target so the retry can restore it', () => {
    const result = validateRewrite(
      { rewrittenText: 'See the guide.' },
      'See [the guide](pestsTopic).'
    )
    expect(result.valid).toBe(false)
    expect(result.issues.join(' ')).toContain('pestsTopic')
  })

  test('allows reworded link labels as long as the target survives', () => {
    const result = validateRewrite(
      { rewrittenText: 'Read [pest control basics](pestsTopic).' },
      'See [the guide](pestsTopic).'
    )
    expect(result.valid).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test tests/ai-assist-validate-rewrite.test.js`
Expected: FAIL — `validateRewrite is not a function`.

- [ ] **Step 3: Implement `validateRewrite`**

In `build_scripts/ai/validate-output.js`:

```js
/**
 * Validate a `rewrite-field` result against the text it was asked to rewrite.
 *
 * Narrow by design — this is prose, so there is no schema to check beyond "is
 * it a non-empty string". The two real checks are the ones a reviewer would
 * otherwise have to catch by eye: HTML sneaking into a field that is rendered
 * through formatMarkdown (which escapes it, so it would surface as visible
 * angle brackets), and a dropped [label](target) link, which silently breaks
 * navigation the page previously had.
 * @param {object} result The model's parsed output.
 * @param {string} fieldText The original field text.
 * @returns {{valid: boolean, issues: string[], schemaValid: boolean}}
 */
function validateRewrite(result, fieldText) {
  const text = result?.rewrittenText
  if (typeof text !== 'string' || !text.trim()) {
    return {
      valid: false,
      issues: ['rewrittenText must be a non-empty string.'],
      schemaValid: false,
    }
  }

  const issues = []
  if (/<[a-z][\s\S]*?>/i.test(text)) {
    issues.push('rewrittenText must be plain prose with no HTML tags.')
  }

  // Targets, not whole links: rewording the visible label is the point of the
  // feature, but changing where a link goes is a content regression.
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g
  const originalTargets = [...String(fieldText).matchAll(linkPattern)].map((match) => match[2])
  const rewrittenTargets = new Set([...text.matchAll(linkPattern)].map((match) => match[2]))
  for (const target of originalTargets) {
    if (!rewrittenTargets.has(target)) {
      issues.push(`The link target "${target}" was dropped. Keep every [label](target) link.`)
    }
  }

  return { valid: issues.length === 0, issues, schemaValid: true }
}
```

Add `validateRewrite,` to `module.exports`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test tests/ai-assist-validate-rewrite.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Add the prompt builders**

In `build_scripts/ai/prompts.js`, add and export:

```js
/**
 * The `rewrite-field` system prompt.
 *
 * Reuses the same vendored style corpus the content prompt inlines, and stays
 * byte-stable for the same reason: caching is a prefix match, so anything
 * request-specific belongs in the user turn. The standing instruction lives
 * here rather than in the browser so the standard cannot drift between what
 * the panel sends and what js/plain-language.js scores.
 * @returns {{system: string, groundedBy: string[]}}
 */
function buildRewriteSystemPrompt() {
  const corpus = loadStyleCorpus()
  const system = `You rewrite one field of body copy for a San Francisco government web page.

Return ONLY the rewritten text for that one field. Do not add a heading, do not
explain your changes, do not return more than the one field you were given.

<house_rules>
- Plain language at roughly a Grade 6 reading level. Tenant-facing, empathetic.
- Preserve the meaning. Never introduce a fact, number, phone number, deadline,
  or obligation that is not in the original text.
- Preserve every [label](target) markdown link. You may reword the label; never
  change or drop the target.
- Plain prose only. No HTML tags.
- Active voice. Address the reader as "you"; call the department "we".
- No contractions. Write "do not", not "don't".
- Never use the word "shall". Use "must" for obligations, "should" for
  recommendations, "may" for options, "will" for what the City will do.
- No dashes, no ellipses, no "&", no "i.e." / "e.g." / "etc.", no "please".
- Everyday words: "help" not "assistance", "need" not "require", "start" not
  "commence", "stop" not "cease", "to" not "in order to".
- Write out dates as "January 28, 2026". Format phone numbers as 415-555-1212.
</house_rules>

<reference_material>
${corpus.text}
</reference_material>`

  return { system, groundedBy: corpus.files }
}

/**
 * Build the user turn for a rewrite request.
 * @param {object} options
 * @param {string} options.fieldText The whole field being rewritten.
 * @param {string} [options.instruction] The reviewer's optional steer.
 * @param {object} [options.page] The page open in the mockup, as context.
 * @param {string[]} [options.issues] Validation failures from a previous attempt.
 * @param {string} [options.previousDraft] The rewrite those failures came from.
 * @returns {string}
 */
function buildRewriteUserPrompt({ fieldText, instruction, page, issues, previousDraft }) {
  const parts = []
  if (page) {
    parts.push(
      `<page_context>\nThis field appears on the following page. Use it for context only; rewrite the field alone.\n\n${serializePageForPrompt(page)}\n</page_context>`
    )
  }
  parts.push(`<field_to_rewrite>\n${fieldText}\n</field_to_rewrite>`)
  parts.push(
    instruction
      ? `<instruction>\n${instruction}\n</instruction>`
      : `<instruction>\nTighten this up and bring it in line with the house rules. Keep every fact.\n</instruction>`
  )
  // The rejected draft travels with the failures. Each call is stateless, so
  // "fix these and change nothing else" is only followable if the thing to fix
  // is in the turn — without it the retry regenerates from scratch and loses
  // whatever the first attempt got right.
  if (issues?.length && previousDraft) {
    parts.push(
      `<previous_attempt>\n${previousDraft}\n</previous_attempt>\n<failures>\n${issues.map((issue) => `- ${issue}`).join('\n')}\n</failures>\nFix exactly these failures. Change nothing else.`
    )
  }
  return parts.join('\n\n')
}
```

If `serializePageForPrompt` is not already required at the top of `prompts.js`, add it to the existing `require('./schemas')` destructure. Add both new functions to `module.exports`.

- [ ] **Step 6: Register the new test file and run the suite**

In `package.json`, append ` tests/ai-assist-validate-rewrite.test.js` to the end of the `"test"` script's file list.

Run: `bun run test`
Expected: PASS, total count increased by 6.

- [ ] **Step 7: Format and commit**

```bash
bun run format
git add build_scripts/ai/prompts.js build_scripts/ai/validate-output.js tests/ai-assist-validate-rewrite.test.js package.json
git commit -m "feat: add rewrite prompt builders and output validator"
```

---

### Task 5: `generateRewrite()` and route dispatch

**Files:**
- Modify: `build_scripts/ai/index.js` (add `generateRewrite`; add `'rewrite-field'` to `getCapabilities().tasks`; export `generateRewrite`)
- Modify: `server.ts` — the import at line 12 and the `generateContent` call at line 1047
- Test: `tests/ai-assist-server.test.js` (existing, extended)

**Interfaces:**
- Consumes: `buildRewriteSystemPrompt`, `buildRewriteUserPrompt` (Task 4), `validateRewrite` (Task 4), `REWRITE_OUTPUT_SCHEMA` (Task 3), and the existing `resolveProvider` / `addUsage` / `MAX_ATTEMPTS` / `DISCLOSURE` in this file.
- Produces: `generateRewrite({fieldText, instruction, page, provider, signal}): Promise<{task: 'rewrite-field', provider, model, attempts, valid, issues, result: {rewrittenText}, usage, usageByAttempt, groundedBy, disclosure}>`

**Read first:** this task extends `tests/ai-assist-server.test.js`'s existing stub-provider harness. Read that file before writing, and match its actual helpers rather than the illustrative names below.

- [ ] **Step 1: Write the failing tests**

Add to `tests/ai-assist-server.test.js`, following the existing stub-provider `describe` blocks:

```js
describe('POST /api/ai/generate — rewrite-field task', () => {
  test('returns a rewritten field and the mandatory disclosure', async () => {
    const response = await postGenerate({
      task: 'rewrite-field',
      fieldText: 'You must report the issue to [us](pestsTopic).',
    })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.task).toBe('rewrite-field')
    expect(typeof body.result.rewrittenText).toBe('string')
    expect(body.disclosure).toContain('AI-assisted')
    expect(body.valid).toBe(true)
  })

  test('retries once and reports the issue when the stub drops a link target', async () => {
    const response = await postGenerate({
      task: 'rewrite-field',
      fieldText: 'See [the guide](pestsTopic).',
      instruction: 'DROP_LINK',
    })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.attempts).toBe(2)
    expect(body.valid).toBe(false)
    expect(body.issues.join(' ')).toContain('pestsTopic')
  })

  test('rejects a rewrite-field request with no fieldText', async () => {
    const response = await postGenerate({ task: 'rewrite-field' })
    expect(response.status).toBe(400)
  })
})
```

Extend the file's stub provider endpoint so a request whose user turn contains `DROP_LINK` returns `{rewrittenText: 'See the guide.'}` (target dropped) on **both** attempts, and any other rewrite request returns `{rewrittenText: 'Report the issue to [us](pestsTopic).'}`. Reuse the file's existing request helper; if it has none, add a local `postGenerate(body)` that POSTs JSON with the test bearer token.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test tests/ai-assist-server.test.js`
Expected: FAIL — the route rejects `task: 'rewrite-field'`.

- [ ] **Step 3: Implement `generateRewrite`**

In `build_scripts/ai/index.js`, extend the requires at the top:

```js
const {
  buildContentSystemPrompt,
  buildContentUserPrompt,
  buildRewriteSystemPrompt,
  buildRewriteUserPrompt,
  loadStyleCorpus,
} = require('./prompts')
const { PAGE_OUTPUT_SCHEMA, REWRITE_OUTPUT_SCHEMA } = require('./schemas')
const { validateGeneratedPage, validateRewrite } = require('./validate-output')
```

Add the function beside `generateContent`:

```js
/**
 * Rewrite one field of body copy, validate it, and retry once with the
 * failures named.
 *
 * A sibling of generateContent rather than a generalization of it. The two
 * tasks share only the retry/usage/disclosure shape, and folding them into one
 * dispatcher would put the page-draft path — the one with real users and real
 * coverage today — at risk for no gain. If the separate compliance-audit design
 * lands, its TASKS registry absorbs both cleanly.
 * @param {object} options
 * @param {string} options.fieldText The whole field to rewrite.
 * @param {string} [options.instruction] The reviewer's optional steer.
 * @param {object} [options.page] The page open in the mockup, as context.
 * @param {string} [options.provider]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<object>}
 */
async function generateRewrite({ fieldText, instruction, page, provider, signal }) {
  const selected = resolveProvider(provider)
  const { system, groundedBy } = buildRewriteSystemPrompt()

  let issues = []
  let generated = null
  let attempts = 0
  const usage = {}
  const usageByAttempt = []

  while (attempts < MAX_ATTEMPTS) {
    const previousDraft = generated ? generated.object?.rewrittenText : undefined
    attempts += 1
    const userPrompt = buildRewriteUserPrompt({
      fieldText,
      instruction,
      page,
      issues: attempts > 1 ? issues : undefined,
      previousDraft: attempts > 1 ? previousDraft : undefined,
    })

    generated = await selected.generateObject({
      system,
      userPrompt,
      jsonSchema: REWRITE_OUTPUT_SCHEMA,
      signal,
    })
    addUsage(usage, generated.usage)
    usageByAttempt.push(generated.rawUsage || {})

    const validation = validateRewrite(generated.object, fieldText)
    issues = validation.issues
    if (validation.valid) break
  }

  return {
    task: 'rewrite-field',
    provider: selected.name,
    model: generated.model,
    attempts,
    valid: issues.length === 0,
    issues,
    result: generated.object,
    usage,
    usageByAttempt,
    groundedBy,
    disclosure: DISCLOSURE,
  }
}
```

Change `getCapabilities()`'s `tasks: ['content'],` to `tasks: ['content', 'rewrite-field'],` and add `generateRewrite,` to `module.exports`.

- [ ] **Step 4: Dispatch in `server.ts`**

Extend the import at line 12:

```ts
import { generateContent, generateRewrite, getCapabilities, listModels } from "./build_scripts/ai/index.js"
```

Replace line 1047:

```ts
      // Dispatch on the validated task. The discriminated request schema has
      // already guaranteed each branch carries the fields its generator needs.
      const result =
        parsed.data.task === "rewrite-field"
          ? await generateRewrite({ ...parsed.data, signal })
          : await generateContent({ ...parsed.data, signal })
```

`server.ts` is Prettier-excluded — match its double-quote style and do not reformat the file.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun test tests/ai-assist-server.test.js`
Expected: PASS.

- [ ] **Step 6: Format and commit**

```bash
bun run format
git add build_scripts/ai/index.js server.ts tests/ai-assist-server.test.js
git commit -m "feat: add generateRewrite and dispatch the rewrite-field task"
```

---

### Task 6: Client support for the rewrite task

**Files:**
- Modify: `js/ai-assist-client.js` — `generate()` at line 169

**Interfaces:**
- Consumes: nothing new
- Produces: `generate({task, prompt, fieldText, instruction, page, provider, signal})` — sends `fieldText`/`instruction` instead of `prompt` when `task === 'rewrite-field'`. Return shape unchanged: `{ok, result?, error?, status?}`.

- [ ] **Step 1: Update the request body and JSDoc**

Replace the body construction inside `generate()`:

```js
        body: JSON.stringify({
          task,
          // The request schema is a discriminated union: `content` carries a
          // prompt, `rewrite-field` carries the field text instead. Sending an
          // empty `prompt` on a rewrite would fail min(1) exactly as a missing
          // one does, so the branch omits it rather than blanking it.
          ...(task === 'rewrite-field'
            ? { fieldText, ...(instruction ? { instruction } : {}) }
            : { prompt }),
          ...(page ? { page } : {}),
          ...(provider ? { provider } : {}),
        }),
```

Change the signature to `async function generate({ task, prompt, fieldText, instruction, page, provider, signal })` and extend the JSDoc `@param` line to document `fieldText` and `instruction`.

- [ ] **Step 2: Verify nothing regressed**

Run: `bun run test`
Expected: PASS, same count as after Task 5.

- [ ] **Step 3: Format and commit**

```bash
bun run format
git add js/ai-assist-client.js
git commit -m "feat: send rewrite-field request bodies from the AI client"
```

---

### Task 7: Floating button and popover view — `js/ai-rewrite-render.js`

**Files:**
- Create: `js/ai-rewrite-render.js`
- Create: `css/ai-rewrite.css`
- Modify: `js/main.js` (CSS import after line 49 `css/review-ops.css`, before line 50 `css/theme.css`; module import after line 124 `./ai-assist.js`)

**Interfaces:**
- Consumes: `escapeHtml` from `window.utils`
- Produces: `window.AiRewrite.render` = `{ state, showButton(rect), hideButton(), openPopover(rect), closePopover(), renderPopover() }`. `state` = `{fieldPath: '', fieldText: '', instruction: '', busy: false, error: '', result: null, applied: false, previousValue: undefined}`.

- [ ] **Step 1: Create the stylesheet**

Create `css/ai-rewrite.css`. Semantic tokens only — never a literal colour, per this repo's token rule:

```css
/* AI rewrite: the floating selection button and its popover.
   Its own sheet rather than an extension of css/ai-assist.css, per the
   "a selector should be declared in exactly one file" rule. */

.ai-rewrite-button {
  position: fixed;
  z-index: 60;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.7rem;
  font-size: var(--text-sm, 0.875rem);
  background: var(--brand-primary);
  color: var(--surface-on-brand, #fff);
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-sm, 4px);
  cursor: pointer;
  box-shadow: var(--shadow-sm, 0 1px 3px rgb(0 0 0 / 0.2));
}

.ai-rewrite-button[hidden] {
  display: none;
}

.ai-rewrite-popover {
  position: fixed;
  z-index: 61;
  width: min(30rem, calc(100vw - 2rem));
  max-height: 70vh;
  overflow-y: auto;
  padding: 1rem;
  background: var(--surface-raised);
  color: var(--text-primary);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md, 6px);
  box-shadow: var(--shadow-md, 0 4px 12px rgb(0 0 0 / 0.25));
}

/* Paired with the [hidden] attribute. A class selector outranks the UA
   stylesheet's [hidden] { display: none }, which is where that attribute's
   entire effect lives — without this rule, hiding the popover appears to do
   nothing. Same trap as .review-workspace[hidden]. */
.ai-rewrite-popover[hidden] {
  display: none;
}

.ai-rewrite-field-text,
.ai-rewrite-suggestion {
  padding: 0.6rem;
  border-radius: var(--radius-sm, 4px);
  background: var(--surface-sunken);
  white-space: pre-wrap;
}

.ai-rewrite-instruction {
  width: 100%;
  padding: 0.4rem;
  margin-top: 0.25rem;
}

.ai-rewrite-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
}
```

- [ ] **Step 2: Create the view module**

Create `js/ai-rewrite-render.js`:

```js
/* AI rewrite: view layer. Owns the floating button, the popover markup, and
   their positioning. Holds no request logic and talks to no network — the
   orchestrator in js/ai-rewrite.js drives every state change here.

   Loads after js/utils.js (needs escapeHtml) and before js/ai-rewrite.js,
   which reads window.AiRewrite.render at mount time. */
;(function mountAiRewriteRender() {
  if (typeof window === 'undefined') return

  const escapeHtml = window.utils?.escapeHtml
  if (typeof escapeHtml !== 'function') return

  window.AiRewrite = window.AiRewrite || {}

  /** Panel state. Mirrors js/ai-assist-render.js's `state` convention. */
  const state = {
    fieldPath: '',
    fieldText: '',
    instruction: '',
    busy: false,
    error: '',
    result: null,
    applied: false,
    previousValue: undefined,
  }

  let buttonEl = null
  let popoverEl = null

  /** @returns {HTMLElement} */
  function ensureButton() {
    if (buttonEl) return buttonEl
    buttonEl = document.createElement('button')
    buttonEl.type = 'button'
    buttonEl.id = 'aiRewriteButton'
    buttonEl.className = 'ai-rewrite-button'
    buttonEl.hidden = true
    buttonEl.textContent = 'AI rewrite'
    document.body.appendChild(buttonEl)
    return buttonEl
  }

  /** @returns {HTMLElement} */
  function ensurePopover() {
    if (popoverEl) return popoverEl
    popoverEl = document.createElement('div')
    popoverEl.id = 'aiRewritePopover'
    popoverEl.className = 'ai-rewrite-popover'
    popoverEl.setAttribute('role', 'dialog')
    popoverEl.setAttribute('aria-label', 'AI rewrite')
    popoverEl.hidden = true
    document.body.appendChild(popoverEl)
    return popoverEl
  }

  /**
   * Place an element under a selection rect, clamped into the viewport.
   * @param {HTMLElement} el
   * @param {DOMRect} rect
   * @returns {void}
   */
  function position(el, rect) {
    el.style.top = `${Math.min(rect.bottom + 8, window.innerHeight - 40)}px`
    el.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - el.offsetWidth - 8))}px`
  }

  /**
   * @param {DOMRect} rect
   * @returns {void}
   */
  function showButton(rect) {
    const el = ensureButton()
    el.hidden = false
    position(el, rect)
  }

  /** @returns {void} */
  function hideButton() {
    if (buttonEl) buttonEl.hidden = true
  }

  /** @returns {void} */
  function closePopover() {
    if (popoverEl) popoverEl.hidden = true
  }

  /**
   * Redraw the popover from state.
   *
   * Everything interpolated here is escaped: state.fieldText comes from page
   * data and state.result from the model, which is text nobody in this repo
   * wrote.
   * @returns {void}
   */
  function renderPopover() {
    const el = ensurePopover()
    const suggestion = state.result?.rewrittenText || ''
    el.innerHTML = `
      <h3 class="ai-rewrite-title">Rewrite this text</h3>
      <p class="ai-rewrite-scope-note">The whole paragraph or bullet below is replaced, not only what you highlighted.</p>
      <div class="ai-rewrite-field-text">${escapeHtml(state.fieldText)}</div>
      ${
        state.result
          ? `<h4>Suggestion</h4><div class="ai-rewrite-suggestion">${escapeHtml(suggestion)}</div>`
          : `<label class="ai-rewrite-instruction-label" for="aiRewriteInstruction">Instruction (optional)</label>
             <input id="aiRewriteInstruction" class="ai-rewrite-instruction" type="text" value="${escapeHtml(state.instruction)}" placeholder="Leave empty to apply our content standards" />`
      }
      ${state.error ? `<p class="ai-rewrite-error" role="alert">${escapeHtml(state.error)}</p>` : ''}
      <div class="ai-rewrite-actions">
        ${
          state.applied
            ? `<button type="button" id="aiRewriteUndo">Undo</button>
               <button type="button" id="aiRewriteClose">Close</button>`
            : state.result
              ? `<button type="button" id="aiRewriteApply">Apply</button>
                 <button type="button" id="aiRewriteDiscard">Discard</button>`
              : state.busy
                ? `<button type="button" id="aiRewriteCancel">Cancel</button>`
                : `<button type="button" id="aiRewriteRun">Rewrite</button>
                   <button type="button" id="aiRewriteClose">Close</button>`
        }
      </div>
      ${state.busy ? '<p class="ai-rewrite-status">Rewriting…</p>' : ''}
    `
    el.hidden = false
  }

  /**
   * @param {DOMRect} rect
   * @returns {void}
   */
  function openPopover(rect) {
    renderPopover()
    position(ensurePopover(), rect)
  }

  window.AiRewrite.render = {
    state,
    showButton,
    hideButton,
    openPopover,
    closePopover,
    renderPopover,
  }
})()
```

- [ ] **Step 3: Wire both files into `js/main.js`**

Add after line 49 (`import './../css/review-ops.css'`), keeping `css/theme.css` last:

```js
import './../css/ai-rewrite.css'
```

Add after line 124 (`import './ai-assist.js'`):

```js
import './ai-rewrite-render.js'
```

The `./ai-rewrite.js` import is added in Task 8, when that file exists.

- [ ] **Step 4: Verify the build still succeeds**

Run: `bun run build:app`
Expected: Vite build completes with no unresolved-import errors.

- [ ] **Step 5: Format and commit**

```bash
bun run format
git add js/ai-rewrite-render.js css/ai-rewrite.css js/main.js
git commit -m "feat: add the AI rewrite button and popover view layer"
```

---

### Task 8: Orchestrator — `js/ai-rewrite.js`

**Files:**
- Create: `js/ai-rewrite.js`
- Modify: `js/main.js` (add `import './ai-rewrite.js'` immediately after the `./ai-rewrite-render.js` import from Task 7)

**Interfaces:**
- Consumes: `window.AiRewrite.render` (Task 7), `window.AiAssist.client.generate`/`isConfigured`/`fetchCapabilities` (Task 6), `window.utils.getByPath`/`setByPath`/`debounce`/`getCurrentKey` (Task 1), `window.renderPage`, `window.showToast`
- Produces: `window.aiRewrite` = `{ handleSelection, runRewrite, applyResult, undoApply }`

- [ ] **Step 1: Create the orchestrator**

Create `js/ai-rewrite.js`:

```js
/* AI rewrite: orchestrator. Watches text selections inside the mockup,
   resolves the containing field's dot-path, runs the rewrite request, and
   applies the result back into in-memory page data.

   Loads after js/ai-rewrite-render.js (reads window.AiRewrite.render) and
   after js/ai-assist-client.js (reuses its configured generate()). Never
   writes to pages/*.js — this is a review aid, not a publishing tool. */
;(function mountAiRewrite() {
  if (typeof window === 'undefined') return
  if (!window.AiRewrite?.render || !window.AiAssist?.client) return

  const render = window.AiRewrite.render
  const client = window.AiAssist.client
  const state = render.state

  /** In-flight rewrite, so Cancel has something to abort. */
  let controller = null
  /** The rect the button/popover are anchored to. */
  let anchorRect = null
  /** Whether this deployment has an AI backend at all. */
  let available = false

  /** @returns {object|null} */
  function getCurrentPage() {
    const key = window.utils?.getCurrentKey?.()
    return (window.HHVC_DATA?.pages || {})[key] || null
  }

  /**
   * Resolve the selection to the rewritable field containing its start.
   *
   * The selection's START decides, so a drag that runs past the end of a
   * paragraph still has one unambiguous target rather than none. The popover
   * shows the whole field, so what is about to change stays visible.
   * @returns {{path: string, rect: DOMRect}|null}
   */
  function resolveSelection() {
    const selection = window.getSelection?.()
    if (!selection || selection.isCollapsed || !selection.rangeCount) return null
    const node = selection.anchorNode
    if (!node) return null
    const el = node.nodeType === 1 ? node : node.parentElement
    const field = el?.closest?.('[data-rewrite-field]')
    if (!field || !field.closest('#mockPage')) return null
    const path = field.getAttribute('data-rewrite-field') || ''
    if (!path) return null
    return { path, rect: selection.getRangeAt(0).getBoundingClientRect() }
  }

  /** @returns {void} */
  function handleSelection() {
    if (!available) return
    const resolved = resolveSelection()
    if (!resolved) {
      render.hideButton()
      return
    }
    anchorRect = resolved.rect
    state.fieldPath = resolved.path
    render.showButton(resolved.rect)
  }

  /**
   * Read the field's CURRENT text from page data, never from the DOM.
   *
   * formatMarkdown() escapes HTML and rewrites [label](target) into elements,
   * so textContent is rendered output — feeding it back would hand the model
   * post-render text and drop the markdown on apply.
   * @returns {string}
   */
  function readFieldText() {
    const page = getCurrentPage()
    const value = window.utils.getByPath(page, state.fieldPath)
    if (typeof value === 'string') return value
    return typeof value?.text === 'string' ? value.text : ''
  }

  /** @returns {void} */
  function openForCurrentField() {
    state.fieldText = readFieldText()
    state.instruction = ''
    state.result = null
    state.error = ''
    state.applied = false
    state.previousValue = undefined
    if (!state.fieldText) {
      state.error = 'Could not read that field. Try re-selecting the text.'
    }
    render.hideButton()
    render.openPopover(anchorRect)
  }

  /** @returns {Promise<void>} */
  async function runRewrite() {
    if (state.busy) return
    const input = document.getElementById('aiRewriteInstruction')
    if (input) state.instruction = input.value || ''

    controller = new AbortController()
    state.busy = true
    state.error = ''
    render.renderPopover()

    const response = await client.generate({
      task: 'rewrite-field',
      fieldText: state.fieldText,
      instruction: state.instruction.trim() || undefined,
      page: getCurrentPage() || undefined,
      signal: controller.signal,
    })

    state.busy = false
    controller = null

    if (!response.ok) {
      state.error = response.error
      render.renderPopover()
      return
    }
    state.result = response.result.result
    // A draft that failed validation is still shown — the reviewer can see
    // which rule it broke and decide — matching how the content panel treats
    // an invalid page draft rather than hiding it.
    if (!response.result.valid) {
      state.error = `Check before applying: ${response.result.issues.join(' ')}`
    }
    render.renderPopover()
  }

  /**
   * Write the rewrite into in-memory page data.
   *
   * Written as the object form the text arrays already accept, flagged
   * unverified so the mockup renders the existing pill — an AI-touched line
   * must be visually distinguishable from human-authored copy without opening
   * anything.
   * @returns {void}
   */
  function applyResult() {
    const page = getCurrentPage()
    const text = state.result?.rewrittenText
    if (!page || !text) return

    state.previousValue = window.utils.getByPath(page, state.fieldPath)
    const wrote = window.utils.setByPath(page, state.fieldPath, {
      text,
      unverified: true,
      unverifiedReason: 'AI-rewritten draft — verify before publishing',
    })
    if (!wrote) {
      state.error = 'That field is no longer on the page. Nothing was changed.'
      render.renderPopover()
      return
    }
    state.applied = true
    window.renderPage?.(window.utils?.getCurrentKey?.())
    render.renderPopover()
    window.showToast?.('Rewrite applied. Nothing was written to the repository.', 'success')
  }

  /**
   * Restore the pre-apply value. One step, consumed on use — a stack would
   * imply a history this state cannot reconstruct.
   * @returns {void}
   */
  function undoApply() {
    const page = getCurrentPage()
    if (!page || state.previousValue === undefined) return
    window.utils.setByPath(page, state.fieldPath, state.previousValue)
    state.previousValue = undefined
    state.applied = false
    state.result = null
    window.renderPage?.(window.utils?.getCurrentKey?.())
    render.closePopover()
    window.showToast?.('Rewrite undone.', 'success')
  }

  /**
   * One delegated listener, bound at init — the button and popover are created
   * lazily and re-rendered often, so per-element binding would have to be
   * redone after every render.
   * @param {Event} event
   * @returns {void}
   */
  function handleClick(event) {
    const target = event.target
    if (!(target instanceof Element)) return
    if (target.closest('#aiRewriteButton')) return openForCurrentField()
    if (target.closest('#aiRewriteRun')) return void runRewrite()
    if (target.closest('#aiRewriteCancel')) return controller?.abort()
    if (target.closest('#aiRewriteApply')) return applyResult()
    if (target.closest('#aiRewriteUndo')) return undoApply()
    if (target.closest('#aiRewriteDiscard') || target.closest('#aiRewriteClose')) {
      state.result = null
      state.error = ''
      return render.closePopover()
    }
    return undefined
  }

  /**
   * Ask the server what it supports once, at init.
   *
   * The button never appears on a deployment with no AI backend — a Netlify
   * build has no runtime for /api/ai/*, and an affordance that always fails is
   * worse than no affordance.
   * @returns {Promise<void>}
   */
  async function checkAvailability() {
    if (!client.isConfigured()) return
    const result = await client.fetchCapabilities()
    available = Boolean(result.ok && result.capabilities?.tasks?.includes('rewrite-field'))
  }

  /** @returns {void} */
  function init() {
    document.addEventListener('selectionchange', window.utils.debounce(handleSelection, 150))
    document.addEventListener('click', handleClick)
    checkAvailability()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }

  window.aiRewrite = { handleSelection, runRewrite, applyResult, undoApply }
})()
```

- [ ] **Step 2: Add the import to `js/main.js`**

Immediately after `import './ai-rewrite-render.js'`:

```js
import './ai-rewrite.js'
```

- [ ] **Step 3: Verify the build and full suite**

Run: `bun run build:app && bun run test`
Expected: build succeeds; all unit tests pass.

- [ ] **Step 4: Format and commit**

```bash
bun run format
git add js/ai-rewrite.js js/main.js
git commit -m "feat: wire the selection-driven AI rewrite orchestrator"
```

---

### Task 9: End-to-end coverage

**Files:**
- Create: `tests/e2e/ai-rewrite.spec.js`

**Interfaces:**
- Consumes: `gotoFresh()` from `tests/e2e/helpers.js`; the stub pattern in `tests/e2e/ai-assist.spec.js`
- Produces: nothing consumed by later tasks

**Read first:** `tests/e2e/ai-assist.spec.js`, and reuse its exact mechanism for configuring the AI endpoint and stubbing `/api/ai/*` rather than inventing a second approach. If it diverges from the sketch below, follow that file and adjust this spec — do not change application code to fit this plan.

- [ ] **Step 1: Write the spec**

Create `tests/e2e/ai-rewrite.spec.js`:

```js
import { test, expect } from '@playwright/test'
import { gotoFresh } from './helpers.js'

/** Stub capabilities + generate so no key and no paid call are involved. */
async function stubAiRoutes(page, { rewrittenText = 'Report the problem to us.' } = {}) {
  await page.route('**/api/ai/capabilities', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        providers: { anthropic: true },
        models: { anthropic: 'stub-model' },
        providerLabels: { anthropic: 'Claude' },
        defaultProvider: 'anthropic',
        tasks: ['content', 'rewrite-field'],
        groundedBy: [],
        pageCount: 20,
        disclosureRequired: true,
      }),
    })
  )
  await page.route('**/api/ai/generate', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        task: 'rewrite-field',
        provider: 'anthropic',
        model: 'stub-model',
        attempts: 1,
        valid: true,
        issues: [],
        result: { rewrittenText },
        usage: {},
        usageByAttempt: [],
        groundedBy: [],
        disclosure: 'AI-assisted draft. Not reviewed, not approved.',
      }),
    })
  )
}

/** Configure the AI endpoint the same way the assist panel's specs do. */
async function configureAi(page) {
  await page.evaluate(() => {
    window.AiAssist.client.writeConfig({ apiUrl: window.location.origin, apiToken: 'stub' })
  })
  await page.reload()
  await page.waitForFunction(() => Boolean(window.aiRewrite))
}

/** Select the full text of the first annotated field in the mockup. */
async function selectFirstRewritableField(page) {
  return page.evaluate(() => {
    const field = document.querySelector('#mockPage [data-rewrite-field]')
    const range = document.createRange()
    range.selectNodeContents(field)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
    return field.getAttribute('data-rewrite-field')
  })
}

test.describe('AI rewrite', () => {
  test('shows no rewrite button when the AI backend is not configured', async ({ page }) => {
    await gotoFresh(page)
    await selectFirstRewritableField(page)
    await expect(page.locator('#aiRewriteButton')).toBeHidden()
  })

  test('offers a rewrite, applies it, and flags the copy unverified', async ({ page }) => {
    await stubAiRoutes(page)
    await gotoFresh(page)
    await configureAi(page)

    const path = await selectFirstRewritableField(page)
    await expect(page.locator('#aiRewriteButton')).toBeVisible()

    await page.click('#aiRewriteButton')
    // The popover shows the WHOLE field, which is what apply will replace.
    await expect(page.locator('.ai-rewrite-field-text')).not.toBeEmpty()

    await page.click('#aiRewriteRun')
    await expect(page.locator('.ai-rewrite-suggestion')).toHaveText('Report the problem to us.')

    await page.click('#aiRewriteApply')
    await expect(page.locator('#mockPage')).toContainText('Report the problem to us.')
    await expect(page.locator('#mockPage .unverified-pill').first()).toBeVisible()

    // The in-memory page data carries the flag, not just the rendered pill.
    const applied = await page.evaluate((fieldPath) => {
      const key = window.utils.getCurrentKey()
      return window.utils.getByPath(window.HHVC_DATA.pages[key], fieldPath)
    }, path)
    expect(applied.unverified).toBe(true)
  })

  test('discard leaves the mockup copy untouched', async ({ page }) => {
    await stubAiRoutes(page)
    await gotoFresh(page)
    await configureAi(page)

    await selectFirstRewritableField(page)
    await page.click('#aiRewriteButton')
    const before = await page.locator('#mockPage').innerText()

    await page.click('#aiRewriteRun')
    await page.click('#aiRewriteDiscard')

    await expect(page.locator('#aiRewritePopover')).toBeHidden()
    expect(await page.locator('#mockPage').innerText()).toBe(before)
  })
})
```

- [ ] **Step 2: Run the spec**

Run: `bun run test:e2e -- tests/e2e/ai-rewrite.spec.js`
(In a sandbox with a pre-installed browser: `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium bun run test:e2e -- tests/e2e/ai-rewrite.spec.js`)
Expected: 3 passed.

- [ ] **Step 3: Format and commit**

```bash
bun run format
git add tests/e2e/ai-rewrite.spec.js
git commit -m "test: cover the selection-driven AI rewrite end to end"
```

---

### Task 10: Documentation

**Files:**
- Modify: `CLAUDE.md` (new "AI rewrite (optional)" section after the "AI assist backend (optional)" section; add `css/ai-rewrite.css` to the stylesheet table; correct "seven stylesheets" to eight)
- Modify: `AGENTS.md` (the same section and table change, per the cross-tool-canon rule)
- Modify: `tests/doc-counts.test.js` only if it asserts a count this work changes

**Interfaces:**
- Consumes: nothing
- Produces: nothing

- [ ] **Step 1: Write the CLAUDE.md section**

Add after the AI assist backend section, matching the surrounding voice (`**Bold label:**` bullets stating a non-obvious fact and why it matters):

```markdown
### AI rewrite (optional)

A floating button that appears when a reviewer selects body copy in the mockup,
offering an AI rewrite of the containing field. Same posture as the rest of the
AI surface: additive, invisible unless `/api/ai/*` is configured, and it never
writes to `pages/*.js`.

- **The selection picks the field, not the substring.** `formatMarkdown()`
  escapes HTML and rewrites `[label](target)` into elements, so a DOM offset
  does not map back to an offset in the source string, and a selection spanning
  two elements has no coherent splice. The whole containing paragraph/bullet is
  sent and replaced; the popover shows it in full so the scope of the change is
  visible before the request, not after.
- **`data-rewrite-field` paths use the ORIGINAL `page.sections` index.**
  `partitionSections()` redistributes sections into seven role buckets rendered
  in a fixed layout order, so render order is not source order. The index is
  captured onto a render-time shallow copy (`__sectionIndex`) during that loop;
  a path built from render order rewrites the wrong section, silently.
- **Annotation is opt-in per call site.** `paragraphList`/`bulletList`/
  `renderSteps` emit nothing without a path prefix, which is how the v1 scope
  boundary (paragraphs, bullets, step text — not cards, tables, callouts,
  `whatToKnow`, or spotlight) is expressed. Extending scope is passing a prefix
  at one more call site.
- **An applied rewrite is flagged `unverified: true`** with the reason
  "AI-rewritten draft — verify before publishing", reusing the schema's existing
  pill rather than a new AI-specific flag, so AI-touched copy is visually
  distinguishable from human-authored copy in the mockup itself.
- **`generateRewrite()` is a sibling of `generateContent()`, not a
  generalization of it.** `generateRequestSchema` is a discriminated union on
  `task` because the branches genuinely differ — `content` requires `prompt`,
  `rewrite-field` requires `fieldText` and has none. Folding the two into one
  dispatcher would put the page-draft path at risk for no gain.
- **The validator checks link targets, not whole links.** Rewording a link's
  visible label is the point; changing or dropping its target is a content
  regression, so a dropped target fails validation and is named back to the
  model for the existing one-retry loop.
```

- [ ] **Step 2: Update the stylesheet table in both files**

Add a row after the `css/ai-assist.css` row in `CLAUDE.md` and `AGENTS.md`:

```markdown
| `css/ai-rewrite.css`      | the floating selection button and the rewrite popover                                          |
```

Update the sentence introducing the table from "seven stylesheets" to "eight stylesheets". `css/theme.css` must remain documented as last.

- [ ] **Step 3: Mirror the section into AGENTS.md**

Copy the same section into `AGENTS.md`. Per the cross-tool-canon rule, `.github/copilot-instructions.md` stays a pointer — add nothing there.

- [ ] **Step 4: Run the full gate**

Run: `bun run format:check && bun run validate && bun run test`
Expected: all pass. If `tests/doc-counts.test.js` fails on a stylesheet or test-file count, update the count it reads — that test exists to catch exactly this drift.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md AGENTS.md tests/doc-counts.test.js
git commit -m "docs: document the selection-driven AI rewrite"
```

---

## Self-Review

**Spec coverage:** Every spec section maps to a task — field addressing and the two renderer traps (Task 2), whole-field rationale (encoded in Tasks 2/8, documented in Task 10), selection detection and button gating (Task 8), popover (Task 7), backend task and discriminated union (Tasks 3-5), client (Task 6), apply/unverified/undo (Task 8), error handling (Task 8, reusing the existing client's abort and error shapes), the full testing list (Tasks 1-5, 9), and docs (Task 10).

**Type consistency:** `getByPath`/`setByPath` signatures are identical in Tasks 1, 8 and 9. `validateRewrite(result, fieldText)` matches between Tasks 4 and 5. `REWRITE_OUTPUT_SCHEMA` and the `rewrite-field` request branch match between Tasks 3, 5 and 6. `state.fieldPath`/`fieldText`/`result.rewrittenText` match between Tasks 7 and 8. The `tasks: ['content', 'rewrite-field']` capability set in Task 5 is what Task 8's `checkAvailability()` and Task 9's stub both read.

**Known deviations to expect at execution time:** Tasks 5 and 9 depend on details of existing test files (`tests/ai-assist-server.test.js`'s stub harness, `tests/e2e/ai-assist.spec.js`'s endpoint-config mechanism) that must be read before writing against them. Both tasks say so explicitly — match the existing file rather than changing application code to fit the plan.
