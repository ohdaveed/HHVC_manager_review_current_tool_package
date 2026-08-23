# Karl Tag Field Inspection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the raw Wagtail field name and the measured required/repeatable/block-type facts on the existing Karl guide panel, so a reviewer translating a mockup into Karl can see *which field* they are typing into, not just which screen.

**Architecture:** `resolvePath()` in `js/karl/karl-guide-registry.js` already fetches the `karl-blocks.js` panel object and keeps only its breadcrumb string. Split that into a `resolveFieldRef()` that returns the reference and a thin `resolvePath()` that formats it, attach the panel's own metadata to the guide object in `guideForContext()`, and render it as new phrasing-content rows in `renderKarlGuidePanel()`. No new data is authored anywhere: every value shown is already transcribed in `js/karl/karl-blocks.js` and gated against `docs/karl-export-field-map.md` by `tests/karl-blocks.test.js`.

**Tech Stack:** Plain browser ES modules (bundled by Vite 8), Bun test with happy-dom, Playwright, hand-authored CSS with semantic design tokens.

**Spec:** `docs/superpowers/specs/2026-08-22-karl-tag-field-inspection.md`

## Scope

**The brief this plan implements spans four subsystems, and this plan takes one.** The spec's Scope table records why:

- **In scope (this plan):** field-metadata surfacing — the brief's items 2 and 4.
- **Blocked on a reviewer decision:** the five-way semantic colour taxonomy. It re-routes `role` resolution for 35+ call sites and would silently strip the measured path off every callout and button tag. Not planned until the reviewer picks additive-attribute or full-replacement.
- **Deferred:** blueprint mode with dotted block outlines.
- **Rejected:** the sidebar drawer, the raw Wagtail JSON snippet, and the generic character counter. Reasons are in the spec.

The brief's items 1 (navigation path) and 3 (inheritance and link shapes) are **already shipped** — `breadcrumbFor()`, `LINK_SHAPES`, `INHERIT_BADGE_TEXT`, and `status: 'inherited'`. No task touches them.

## Global Constraints

Every task's requirements implicitly include these.

- **Phrasing content only** inside `renderKarlGuidePanel()`. No `<div>`, `<p>`, `<ol>`, `<ul>`, `<h1>`–`<h6>`. Use `<span>`, `<strong>`, `<code>`, `<button>`, and ARIA roles (`role="list"`, `role="listitem"`, `role="heading" aria-level="4"`) for semantics. The panel renders inside a `<span>` that can sit inside a `<p>`; a block-level start tag closes that paragraph and the panel escapes the ancestor it is positioned against.
- **Every interpolated value passes through `escapeHtml`** from `js/core/utils.js`.
- **CSS uses semantic tokens only** — `--ds-*`, `--surface-*`, `--text-*`, `--sfds-*`. No hex literals. Do not author a new `--sfds-`-prefixed name: `tests/sfds-tokens.test.js` fails when any file under `css/` or `js/` introduces that prefix outside `css/sfds.css`.
- **Prettier is a CI gate:** no semicolons, single quotes, 2-space indent, `printWidth: 100`, ES5 trailing commas, ASI-safe.
- **`js/karl/karl-blocks.js` is the mapping authority.** Never restate a required/repeatable/block-type fact; read it from the inventory.
- **Do not add a new unit-test file.** A new `tests/*.test.js` is invisible to CI until named in `package.json`'s `test` script. Extend `tests/karl-guide.test.js`, which is already named there.
- **A new `tests/e2e/*.spec.js` IS auto-discovered** — `playwright.config.js` sets `testDir: './tests/e2e'`.
- **Never change the type of `guide.path`.** `build_scripts/schema.js` rejects the `unresolvedId` + `path` combination and `tests/karl-guide.test.js` asserts the current shape. Widen the guide object additively.
- **Run `bun run validate` as well as `bun run test`** after touching anything under `js/karl/` — `findUnmappedSections` gates on validate.
- Commands assume `bun install` has run and `export PATH="$HOME/.bun/bin:$PATH"`.

## File Structure

| File | Responsibility | Task |
| ---- | -------------- | ---- |
| `js/karl/karl-guide-registry.js` | Split path resolution into a ref resolver plus a formatter; attach field metadata to the guide object | 1, 4 |
| `js/mockup/karl-tag-meta.js` | Render the Field, Rules and Guidance rows as phrasing content | 2, 3, 4 |
| `css/karl-guide.css` | Style the three new rows with semantic tokens | 2, 3, 4 |
| `js/review/dashboard-guidance.js` | (read only — confirms where the legend mounts) | 5 |
| `tests/karl-guide.test.js` | Unit assertions for resolution, metadata attachment, markup and honesty rules | 1–5 |
| `tests/e2e/karl-guide.spec.js` | New spec: the rows render in a real browser on a real page | 6 |
| `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md` | Mirror the `tests/karl-guide.test.js` description | 7 |

---

### Task 1: Return the panel reference from path resolution

Split `resolvePath()` so the panel object it already looks up survives the call. Pure refactor plus one new export — no rendering changes, no behaviour change to `resolvePath()`.

**Files:**

- Modify: `js/karl/karl-guide-registry.js` (the `resolvePath` function, ~line 320, and the `export` block at the bottom)
- Test: `tests/karl-guide.test.js`

**Interfaces:**

- Consumes: `breadcrumbFor`, `panelByRawName`, `PROMOTE_PANEL` from `js/karl/karl-blocks.js` (already imported at the top of the file).
- Produces:
  - `resolveFieldRef(pageType: string, role: string, context: object) => FieldRef | null`
  - `FieldRef` is one of:
    - `{ kind: 'panel', karlType: string, rawName: string, within: string | undefined }`
    - `{ kind: 'promote', field: { label: string, rawName: string, path: string, required: boolean } }`
  - `resolvePath(pageType, role, context) => string` — unchanged signature and unchanged return values, now implemented over `resolveFieldRef`.

- [ ] **Step 1: Write the failing test**

Append to `tests/karl-guide.test.js`:

```js
describe('field references survive path resolution', () => {
  test('a Transaction step resolves to the Section specifics panel', () => {
    const ref = resolveFieldRef('transaction', 'what-to-do', {})
    expect(ref).toEqual({
      kind: 'panel',
      karlType: 'Transaction',
      rawName: 'section_specifics',
      within: undefined,
    })
  })

  test('a Spotlight CTA carries the nested Button link as its within', () => {
    const ref = resolveFieldRef('campaign', 'spotlight', { linkShape: 'button-link' })
    expect(ref).toEqual({
      kind: 'panel',
      karlType: 'Campaign',
      rawName: 'spotlight_1',
      within: 'Button link',
    })
  })

  test('a Promote field resolves to a promote ref, not a panel ref', () => {
    const ref = resolveFieldRef('transaction', 'seoTitle', {})
    expect(ref?.kind).toBe('promote')
    expect(ref?.field.rawName).toBe('seo_title')
  })

  test('an unresolved context has no reference at all', () => {
    expect(resolveFieldRef('transaction', 'content', { unresolvedId: 'U1' })).toBe(null)
  })

  // Path parity goes through guideFor(), the helper the rest of this file
  // already uses, because resolvePath is NOT exported — the existing suite
  // reaches it only through guideForContext, and widening the module's public
  // surface to let a test call it directly would make the refactor bigger than
  // the feature.
  test('the formatted path is exactly what it was before', () => {
    expect(guideFor('Transaction', 'what-to-do').path).toBe(
      'Content → What to Do → Section specifics'
    )
    expect(guideFor('Campaign', 'spotlight', { linkShape: 'button-link' }).path).toBe(
      'Content → Spotlight 1 → Button link'
    )
    expect(guideFor('Transaction', 'content', { unresolvedId: 'U1' }).path).toBe('')
  })
})
```

Add `resolveFieldRef` to the existing import from `js/karl/karl-guide-registry.js` at the top of the test file — that line currently reads `import { BUTTON_HOSTS, ROLE_PANELS, guideForContext } from '../js/karl/karl-guide-registry.js'`. Leave `resolvePath` unexported.

If the two `.path` values above do not match what the tree actually produces, **stop and read `breadcrumbFor` rather than editing the expectation** — a changed breadcrumb before the refactor means something else moved, and this test's job is to pin the pre-refactor behaviour.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/karl-guide.test.js`
Expected: FAIL — `resolveFieldRef is not a function`. The `resolvePath` assertions in the same block should pass, which is the point: they pin current behaviour before the refactor.

- [ ] **Step 3: Write the implementation**

Replace the body of `resolvePath` in `js/karl/karl-guide-registry.js` with a formatter over a new resolver. Keep `resolvePath`'s JSDoc block where it is and add the new function above it:

```js
/**
 * Resolve WHICH Karl field a tag belongs to, as a reference rather than a
 * formatted string.
 *
 * resolvePath() used to do this lookup and keep only the breadcrumb, throwing
 * away the panel object — which carries the raw Wagtail name, the
 * required/repeatable wording and the block-type chooser contents that
 * js/karl/karl-blocks.js transcribes from the field map. The guide panel needs
 * those, and re-deriving them at the call site would be a second lookup free to
 * disagree with this one.
 *
 * Returns null for exactly the cases resolvePath() returns '' for: an
 * unresolved context, an unknown page type, and a role naming no panel. That
 * parity is asserted in tests/karl-guide.test.js and is what lets resolvePath()
 * be a pure formatter over this function.
 *
 * @param {string} pageType normalizePageType() output, e.g. 'about-us'.
 * @param {string} role Section/field role, or the tag kind when the call site
 *   supplied no role.
 * @param {{unresolvedId?: string, linkShape?: string}} context Guide context.
 * @returns {{kind: 'panel', karlType: string, rawName: string, within: string|undefined}
 *   |{kind: 'promote', field: object}|null} The reference, or null when none is recorded.
 */
function resolveFieldRef(pageType, role, context) {
  if (context.unresolvedId) return null
  const karlType = PAGE_TYPE_LABELS[pageType]
  if (!karlType) return null
  const panelRef = (ref) =>
    ref ? { kind: 'panel', karlType, rawName: ref.rawName, within: ref.within } : null

  if (META_PANELS[role]) return panelRef(META_PANELS[role])
  const promote = PROMOTE_PANEL.fields.find((field) => field.path === role)
  if (promote) return { kind: 'promote', field: promote }

  if (context.linkShape === 'button-link') return panelRef(BUTTON_HOSTS[`${pageType}.${role}`])
  if (context.linkShape === 'campaign-related') return panelRef(ROLE_PANELS.campaign.related)

  const roles = ROLE_PANELS[pageType]
  if (context.linkShape === 'page-reference') {
    if (role === 'related') return panelRef(roles?.related)
    return panelRef(roles?.[ROLE_ALIASES[role] || role])
  }
  if (role === 'image') {
    return pageType === 'information'
      ? panelRef({ rawName: 'information_section', within: 'Image' })
      : null
  }
  if (NON_FIELD_ROLES.has(role)) return null
  return panelRef(roles?.[ROLE_ALIASES[role] || role])
}
```

Then reduce `resolvePath` to:

```js
function resolvePath(pageType, role, context) {
  const ref = resolveFieldRef(pageType, role, context)
  if (!ref) return ''
  if (ref.kind === 'promote') return `${PROMOTE_PANEL.uiLabel} → ${ref.field.label}`
  return breadcrumbFor(ref.karlType, panelByRawName(ref.karlType, ref.rawName), ref.within)
}
```

Leave `resolvePath`'s existing JSDoc in place — its "never guesses" paragraph still describes the behaviour and is cited by other comments. Add one line to it: `Implemented over resolveFieldRef(); see that function for the reference shape.`

Add `resolveFieldRef` to the `export { … }` block at the bottom. That block lists constants first, then functions alphabetically (`guideForContext`, `linkShapeMeta`, `normalizePageType`, `pageTypeLabel`, `unresolvedDescription`), so it goes between `pageTypeLabel` and `unresolvedDescription`. `resolvePath` stays unexported.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/karl-guide.test.js && bun run validate`
Expected: PASS — every new assertion, and every pre-existing `resolvePath` assertion in the file (the `resolvePath never guesses`, `Contact us exists on three types`, `components that own a Karl panel`, and `a Button link belongs to its host block` describe blocks all exercise it).

- [ ] **Step 5: Commit**

```bash
git add js/karl/karl-guide-registry.js tests/karl-guide.test.js
git commit -m "refactor: return the Karl panel reference from path resolution"
```

---

### Task 2: Attach the field metadata to the guide object

Widen the object `guideForContext()` returns with a `field` property carrying the panel's own transcribed facts. Still no rendering.

**Files:**

- Modify: `js/karl/karl-guide-registry.js` (`guideForContext`, plus a new `fieldMetaFor` helper and the export block)
- Test: `tests/karl-guide.test.js`

**Interfaces:**

- Consumes: `resolveFieldRef` from Task 1; `panelByRawName` from `js/karl/karl-blocks.js`.
- Produces:
  - `fieldMetaFor(ref: FieldRef | null) => FieldMeta | undefined`
  - `FieldMeta` = `{ rawName: string, uiLabel: string, required: string, repeatable: string, blockTypes: string }` — every value a display string, never a boolean.
  - `guideForContext()` gains `guide.field: FieldMeta | undefined`. Absent, not `null`, when there is no reference — matching how `guide.values` is already omitted when empty.

- [ ] **Step 1: Write the failing test**

Append to `tests/karl-guide.test.js`:

```js
describe('the guide carries the field the path leads to', () => {
  test('a Transaction step guide names the raw Wagtail field', () => {
    const guide = guideForContext({
      page: { type: 'Transaction' },
      context: { role: 'what-to-do' },
    })
    expect(guide.field.rawName).toBe('section_specifics')
    expect(guide.field.uiLabel).toBe('Section specifics')
  })

  // The inventory records required:false AND requiredDoc:'not recorded' for this
  // panel, and they are different claims: the boolean is this repo coercing an
  // absent measurement into a default, the string is what the field map says.
  // Rendering "Optional" would report a measurement nobody took.
  test("required and repeatable render the doc's own words, never the booleans", () => {
    const guide = guideForContext({
      page: { type: 'Transaction' },
      context: { role: 'what-to-do' },
    })
    expect(guide.field.required).toBe('not recorded')
    expect(guide.field.repeatable).toBe('repeatable')
    expect(guide.field.required).not.toBe('Optional')
    expect(typeof guide.field.required).toBe('string')
    expect(typeof guide.field.repeatable).toBe('string')
  })

  test('the block-type chooser contents come through verbatim', () => {
    const guide = guideForContext({
      page: { type: 'Transaction' },
      context: { role: 'what-to-do' },
    })
    expect(guide.field.blockTypes).toBe(
      'chooser: Address | Callout | Document | Email | Button link | Phone number | Text'
    )
  })

  test('a Promote field carries its own label and raw name', () => {
    const meta = fieldMetaFor(resolveFieldRef('transaction', 'seoTitle', {}))
    expect(meta.rawName).toBe('seo_title')
    expect(meta.uiLabel).toBe('Title tag')
  })

  // The whole point of resolvePath() returning '' is that an unrecorded
  // destination stays visibly unrecorded. A field block appearing without one
  // would put a confident field name under a "Mockup only" badge.
  test('a guide with no path carries no field at all', () => {
    const guide = guideForContext({
      page: { type: 'Information' },
      context: { role: 'contact' },
    })
    expect(guide.path).toBe('')
    expect(guide.field).toBeUndefined()
  })

  test('an unresolved guide carries no field either', () => {
    const guide = guideForContext({
      page: { type: 'Transaction' },
      context: { role: 'content', unresolvedId: 'U1' },
    })
    expect(guide.field).toBeUndefined()
  })

  // An authored guide.path is not second-guessed elsewhere in this function,
  // and a derived field block under it would claim a destination the author
  // did not name.
  test('an explicitly authored path carries no derived field', () => {
    const guide = guideForContext({
      page: { type: 'Transaction' },
      context: { role: 'what-to-do' },
      guide: { path: 'Content → Somewhere the author chose' },
    })
    expect(guide.path).toBe('Content → Somewhere the author chose')
    expect(guide.field).toBeUndefined()
  })
})
```

Add `fieldMetaFor` to the test file's import list.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/karl-guide.test.js`
Expected: FAIL — `fieldMetaFor is not a function`, and `guide.field` is undefined where a value is expected.

- [ ] **Step 3: Write the implementation**

Add to `js/karl/karl-guide-registry.js`, directly below `resolveFieldRef`:

```js
/**
 * The display facts for one field reference: raw Wagtail name, UI label, and
 * the required/repeatable/block-type wording the field map records.
 *
 * **Every value is a string, and the `*Doc` strings are preferred over the
 * booleans beside them.** js/karl/karl-blocks.js carries both — `required:
 * false` alongside `requiredDoc: 'not recorded'` — and they make different
 * claims. The boolean is this repo's coercion of an absent measurement into a
 * default; the string is what docs/karl-export-field-map.md actually says.
 * Rendering "Optional" from the boolean would tell a reviewer the live form was
 * measured and found to permit an empty value, which nobody measured. Same
 * posture as resolvePath() returning '' rather than guessing.
 *
 * @param {object|null} ref A resolveFieldRef() result.
 * @returns {{rawName: string, uiLabel: string, required: string, repeatable: string,
 *   blockTypes: string}|undefined} Undefined when there is nothing to show.
 */
function fieldMetaFor(ref) {
  if (!ref) return undefined
  if (ref.kind === 'promote') {
    return {
      rawName: ref.field.rawName,
      uiLabel: ref.field.label,
      required: ref.field.required ? 'yes' : 'not recorded',
      repeatable: 'single',
      blockTypes: '',
    }
  }
  const panel = panelByRawName(ref.karlType, ref.rawName)
  if (!panel) return undefined
  return {
    rawName: panel.rawName,
    uiLabel: panel.uiLabel,
    required: panel.requiredDoc || 'not recorded',
    repeatable: panel.repeatableDoc || '',
    blockTypes: panel.blockTypesDoc || '',
  }
}
```

In `guideForContext`, the existing lines read:

```js
  const path = isUnresolved ? '' : explicit.path || resolvePath(pageType, role, guideContext)
  // Only a DERIVED path can be inferred. An explicitly authored `guide.path`
  // carries its own evidence and status and is not second-guessed here.
  const inferred = !explicit.path && Boolean(path) && isInferredPath(pageType, role)
```

Replace them with:

```js
  // The reference is resolved once and the path formatted from it, so the field
  // block below cannot name a different destination than the breadcrumb does.
  const ref = isUnresolved || explicit.path ? null : resolveFieldRef(pageType, role, guideContext)
  const path = isUnresolved ? '' : explicit.path || resolvePath(pageType, role, guideContext)
  // Only a DERIVED path can be inferred. An explicitly authored `guide.path`
  // carries its own evidence and status and is not second-guessed here — and
  // for the same reason it carries no derived field block, which would claim a
  // destination the author did not name.
  const inferred = !explicit.path && Boolean(path) && isInferredPath(pageType, role)
```

Then in the `result` object literal, add one property after `evidence`:

```js
    field: explicit.field || fieldMetaFor(ref),
```

Add `fieldMetaFor` to the export block, in the alphabetical function group — before `guideForContext`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/karl-guide.test.js && bun run validate`
Expected: PASS, all assertions.

- [ ] **Step 5: Commit**

```bash
git add js/karl/karl-guide-registry.js tests/karl-guide.test.js
git commit -m "feat: carry the resolved Karl field's own facts on the guide object"
```

---

### Task 3: Render the Field and Rules rows

Two new rows on the guide panel, both phrasing content, both fed only from `guide.field`.

**Files:**

- Modify: `js/mockup/karl-tag-meta.js` (`renderKarlGuidePanel`)
- Modify: `css/karl-guide.css`
- Test: `tests/karl-guide.test.js`

**Interfaces:**

- Consumes: `guide.field` from Task 2 (`{ rawName, uiLabel, required, repeatable, blockTypes }`, or undefined).
- Produces: markup carrying `.karl-guide-field` and `.karl-guide-rules`, rendered between the existing `.karl-guide-path` row and the `.karl-guide-link-shape` row.

- [ ] **Step 1: Write the failing test**

Append to `tests/karl-guide.test.js`:

```js
describe('the guide panel shows the field, not just the screen', () => {
  const transactionStep = () =>
    renderKarlGuidePanel(
      guideForContext({ page: { type: 'Transaction' }, context: { role: 'what-to-do' } }),
      'panel-1'
    )

  test('the raw Wagtail field name renders in a code element', () => {
    expect(transactionStep()).toContain('<code>section_specifics</code>')
  })

  test('the UI label renders beside it', () => {
    expect(transactionStep()).toContain('Section specifics')
  })

  test("the rules row prints the doc's required and repeatable wording", () => {
    const html = transactionStep()
    expect(html).toContain('not recorded')
    expect(html).toContain('repeatable')
  })

  test('the block-type chooser renders', () => {
    expect(transactionStep()).toContain('Button link | Phone number | Text')
  })

  // Same invariant the existing "the guide panel is phrasing content" block
  // asserts for the rest of the panel, restated for the new rows: the panel
  // renders inside a <span> that can sit inside a <p>, and a block-level start
  // tag closes that paragraph, so the panel escapes the ancestor it is
  // positioned against and reopens elsewhere on the page.
  test('the new rows emit no block-level element', () => {
    const html = transactionStep()
    expect(html).not.toMatch(/<(div|p|ul|ol|li|h[1-6])[\s>]/)
  })

  test('a guide with no field renders no field row at all', () => {
    const html = renderKarlGuidePanel(
      guideForContext({ page: { type: 'Information' }, context: { role: 'contact' } }),
      'panel-2'
    )
    expect(html).not.toContain('karl-guide-field')
    expect(html).not.toContain('karl-guide-rules')
  })

  test('field values are escaped', () => {
    const html = renderKarlGuidePanel(
      {
        path: 'Content',
        steps: [],
        field: {
          rawName: '<script>x</script>',
          uiLabel: 'a"b',
          required: 'yes',
          repeatable: 'single',
          blockTypes: '',
        },
      },
      'panel-3'
    )
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('a&quot;b')
  })
})
```

Add `renderKarlGuidePanel` to the test file's import from `js/mockup/karl-tag-meta.js` if it is not already imported (the existing "the guide panel is phrasing content" block already uses it — reuse that import).

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/karl-guide.test.js`
Expected: FAIL — `Expected to contain "<code>section_specifics</code>"`.

- [ ] **Step 3: Write the implementation**

In `js/mockup/karl-tag-meta.js`, add a helper directly above `renderKarlGuidePanel`:

```js
/* The Field and Rules rows, built only from `guide.field` — which
   js/karl/karl-guide-registry.js populates from js/karl/karl-blocks.js, the
   transcribed inventory tests/karl-blocks.test.js guards against
   docs/karl-export-field-map.md. Nothing here restates a Karl fact; a wrong
   value has to be wrong in the inventory first, where CI can see it.

   Two rows rather than one because they answer different questions. Field
   answers "what am I typing into", and the raw Wagtail name is the half a UI
   breadcrumb cannot give — an editor comparing the mockup against an export, or
   reading a colleague's note, has the raw name and not the label. Rules answers
   "what will the form let me do", and it prints the field map's own words:
   `not recorded` is a real answer there and is NOT the same claim as
   `Optional`. See fieldMetaFor()'s header for why that distinction is the whole
   point.

   Phrasing content only, like the rest of this panel. */
function renderKarlGuideField(field) {
  if (!field) return ''
  const rules = [
    field.required ? `Required: ${field.required}` : '',
    field.repeatable || '',
    field.blockTypes || '',
  ].filter(Boolean)
  const rulesRow = rules.length
    ? `<span class="karl-guide-rules"><strong>Rules:</strong> ${rules
        .map((rule) => `<span class="karl-guide-rule">${escapeHtml(rule)}</span>`)
        .join('<span class="karl-guide-rule-sep" aria-hidden="true">·</span>')}</span>`
    : ''
  return `<span class="karl-guide-field"><strong>Field:</strong> <code>${escapeHtml(field.rawName)}</code><span class="karl-guide-field-label">${escapeHtml(field.uiLabel)}</span></span>${rulesRow}`
}
```

Then in `renderKarlGuidePanel`'s returned template, insert the call immediately after the existing path row and before the link-shape row. The current fragment reads:

```js
${guide.path ? `<span class="karl-guide-path"><strong>Path:</strong> <span>${escapeHtml(guide.path)}</span></span>` : ''}${guide.linkShape ?
```

Change it to:

```js
${guide.path ? `<span class="karl-guide-path"><strong>Path:</strong> <span>${escapeHtml(guide.path)}</span></span>` : ''}${renderKarlGuideField(guide.field)}${guide.linkShape ?
```

- [ ] **Step 4: Add the styles**

Append to `css/karl-guide.css`, beside the existing `.karl-guide-path` rule (keep them adjacent — one selector, one file):

```css
/* Field and Rules rows. Both are inline-level by construction: the panel is a
   <span> subtree, so `display: block` here would be a layout claim on a
   phrasing element, not a structural one, and it is what makes each row its own
   line without introducing a block-level TAG. */
.karl-guide-field,
.karl-guide-rules {
  display: block;
  margin-top: var(--ds-space-1);
  font-size: var(--ds-text-micro);
  color: var(--text-secondary);
}
.karl-guide-field code {
  padding: 0 var(--ds-space-1);
  border-radius: 3px;
  background: var(--surface-sunken);
  color: var(--text-primary);
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
}
.karl-guide-field-label {
  margin-left: var(--ds-space-1);
  font-style: italic;
}
.karl-guide-rule-sep {
  margin: 0 var(--ds-space-1);
  color: var(--text-tertiary);
}
```

Before writing these, confirm each token name exists in `css/theme.css` — grep for `--ds-space-1`, `--ds-text-micro`, `--text-secondary`, `--text-tertiary`, `--text-primary`, `--surface-sunken`, `--font-mono`. **If a name does not exist, use the nearest one that does rather than authoring a new token**, and do not fall back to a hex literal. `--font-mono` is written with an inline fallback stack because it may not be declared.

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test tests/karl-guide.test.js && bun run format && bun run format:check && bun run lint:js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add js/mockup/karl-tag-meta.js css/karl-guide.css tests/karl-guide.test.js
git commit -m "feat: show the raw Karl field name and its form rules on the guide panel"
```

---

### Task 4: Render style guidance as guidance, never as schema

The one place a measured-looking falsehood can enter: `docs/karl-export-field-map.md`'s obsolete register `O14` records the live Button link text field at `maxlength="255"`, with the Help Center's "25 characters" as *style guidance*. Both belong on the panel; they must not look like the same kind of claim.

**Files:**

- Modify: `js/karl/karl-guide-registry.js` (new `FIELD_GUIDANCE` table, `guideForContext`, export block)
- Modify: `js/mockup/karl-tag-meta.js` (`renderKarlGuidePanel`)
- Modify: `css/karl-guide.css`
- Test: `tests/karl-guide.test.js`

**Interfaces:**

- Consumes: `guide.field` (Task 2), `context.linkShape`.
- Produces: `guide.guidance: {text: string, schema: string} | undefined`, rendered as `.karl-guide-guidance`.

- [ ] **Step 1: Write the failing test**

Append to `tests/karl-guide.test.js`:

```js
describe('style guidance is never dressed as a schema constraint', () => {
  const buttonGuide = () =>
    guideForContext({
      page: { type: 'Transaction' },
      context: { role: 'what-to-do', linkShape: 'button-link' },
    })

  test('a Button link carries the Help Center length guidance', () => {
    expect(buttonGuide().guidance.text).toContain('25')
  })

  test('it names the measured schema value beside it', () => {
    expect(buttonGuide().guidance.schema).toContain('255')
  })

  // O14 in docs/karl-export-field-map.md: the live field was measured at
  // maxlength="255" on 2026-08-15, and the 25 is Help Center style advice. U19
  // records ten mockup labels shortened on that advice rather than on a
  // constraint. Printing 25 in the Rules row would put a measured-looking
  // falsehood in the one panel whose job is separating measured destinations
  // from chosen ones.
  test('the 25 never appears in the rules row', () => {
    const html = renderKarlGuidePanel(buttonGuide(), 'panel-4')
    const rules = html.slice(html.indexOf('karl-guide-rules'), html.indexOf('karl-guide-guidance'))
    expect(rules).not.toContain('25')
  })

  test('the guidance row is labelled as guidance in words, not by colour alone', () => {
    const html = renderKarlGuidePanel(buttonGuide(), 'panel-5')
    expect(html).toContain('karl-guide-guidance')
    expect(html).toMatch(/Guidance/)
  })

  test('a field with no recorded guidance renders no guidance row', () => {
    const html = renderKarlGuidePanel(
      guideForContext({ page: { type: 'Transaction' }, context: { role: 'what-to-do' } }),
      'panel-6'
    )
    expect(html).not.toContain('karl-guide-guidance')
  })

  test('the guidance row emits no block-level element', () => {
    expect(renderKarlGuidePanel(buttonGuide(), 'panel-7')).not.toMatch(/<(div|p|ul|ol|li|h[1-6])[\s>]/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/karl-guide.test.js`
Expected: FAIL — `Cannot read properties of undefined (reading 'text')`.

- [ ] **Step 3: Write the implementation**

Add to `js/karl/karl-guide-registry.js`, directly below the `UNRESOLVED` table (same discipline, so the two read together):

```js
/* Style advice this repo's record actually supports, keyed by link shape.

   **Guidance and schema are different claims and this table keeps them apart
   in the data, not just in the CSS.** docs/karl-export-field-map.md's obsolete
   register entry O14 records the live `Button link` text field at
   `maxlength="255"`, measured 2026-08-15 on a Transaction `section_specifics`
   block, and records the Help Center's "can only be 25 characters" as style
   guidance rather than a schema limit. U19 records ten mockup labels shortened
   on that guidance — on advice, not on constraint.

   Printing 25 as a limit would be a measured-looking falsehood in the one panel
   whose whole job is separating a measured destination from a chosen one, which
   is the same failure guideStatusLabel() checks `inferred` before the evidence
   line to avoid.

   **One entry, and add another only when the field map records one** — exactly
   the rule stated on UNRESOLVED above. This is a display string, not a second
   record of a measurement. */
const FIELD_GUIDANCE = {
  'button-link': {
    text: 'Aim for about 25 characters of link text — Karl Help Center style guidance.',
    schema: 'The field itself accepts 255 (measured 2026-08-15).',
  },
}
```

In `guideForContext`'s `result` object, add one property after `field`:

```js
    guidance: explicit.guidance || FIELD_GUIDANCE[guideContext.linkShape],
```

Export `FIELD_GUIDANCE` in the constants group of the export block, after `BUTTON_HOSTS`.

In `js/mockup/karl-tag-meta.js`, add below `renderKarlGuideField`:

```js
/* The guidance row. Separated from Rules by its own label word and its own
   class — never by colour alone, since colour is not an encoding a reviewer can
   read out loud, and this distinction is the one that decides whether a
   reviewer treats a number as something the form will enforce. */
function renderKarlGuideGuidance(guidance) {
  if (!guidance?.text) return ''
  const schema = guidance.schema
    ? `<span class="karl-guide-guidance-schema">${escapeHtml(guidance.schema)}</span>`
    : ''
  return `<span class="karl-guide-guidance"><strong>Guidance:</strong> ${escapeHtml(guidance.text)}${schema}</span>`
}
```

Insert `${renderKarlGuideGuidance(guide.guidance)}` in `renderKarlGuidePanel`'s template immediately after `${renderKarlGuideField(guide.field)}` and before the link-shape row.

Append to `css/karl-guide.css`, beside the Task 3 rules:

```css
/* Guidance reads as advice, Rules read as measurement. The separation is
   carried by the label word first — the class only reinforces it, because a
   reviewer reading the panel aloud or with colour vision differences still has
   to get the distinction. */
.karl-guide-guidance {
  display: block;
  margin-top: var(--ds-space-1);
  font-size: var(--ds-text-micro);
  font-style: italic;
  color: var(--text-tertiary);
}
.karl-guide-guidance-schema {
  margin-left: var(--ds-space-1);
  font-style: normal;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/karl-guide.test.js && bun run validate && bun run format && bun run format:check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/karl/karl-guide-registry.js js/mockup/karl-tag-meta.js css/karl-guide.css tests/karl-guide.test.js
git commit -m "feat: separate Karl style guidance from measured schema on the guide panel"
```

---

### Task 5: Link the Karl Help Center from the legend, not from every panel

**Files:**

- Modify: `js/mockup/karl-tag-meta.js` (`renderKarlTagLegend`, the `notes` block)
- Test: `tests/karl-guide.test.js`

**Interfaces:**

- Consumes: nothing new.
- Produces: one `<a>` inside the full-variant legend notes list.

Why the legend and not the panel: the RAG corpus separates the `karl` category (the CMS as measured) from `karl-gitbook` (the CMS as documented) *because the two have disagreed four times and the measurement wins*. A doc link sitting inside a panel, beside a resolved path, reads as authority over that path. In the legend it reads as background reference — which is where the UX review already moved this legend.

- [ ] **Step 1: Write the failing test**

Append to `tests/karl-guide.test.js`:

```js
describe('the Help Center is background reference, not panel authority', () => {
  test('the full legend links to the Karl Help Center', () => {
    const html = renderKarlTagLegend('full')
    expect(html).toContain('sfdigitalservices.gitbook.io')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('target="_blank"')
  })

  test('the link says the measured path wins', () => {
    expect(renderKarlTagLegend('full')).toMatch(/measured/i)
  })

  test('the compact legend stays a colour key with no prose', () => {
    expect(renderKarlTagLegend('compact')).not.toContain('gitbook.io')
  })

  test('no guide panel carries the link', () => {
    const html = renderKarlGuidePanel(
      guideForContext({ page: { type: 'Transaction' }, context: { role: 'what-to-do' } }),
      'panel-8'
    )
    expect(html).not.toContain('gitbook.io')
  })
})
```

Add `renderKarlTagLegend` to the test file's import from `js/mockup/karl-tag-meta.js`.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/karl-guide.test.js`
Expected: FAIL — `Expected to contain "sfdigitalservices.gitbook.io"`.

- [ ] **Step 3: Write the implementation**

In `renderKarlTagLegend`'s `notes` template, add one `<li>` at the end of `.karl-tag-legend-notes-list`, after the existing "Audience, reading targets…" item:

```html
            <li>The <a href="https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/sf.gov-and-karl-foundations/sf.gov-concepts-and-structure/content-types" target="_blank" rel="noopener noreferrer">Karl Help Center<span aria-hidden="true"> ↗</span></a> documents the CMS; where it disagrees with a tag's measured path, the measured path is what the live form does.</li>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/karl-guide.test.js && bun run format && bun run format:check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/mockup/karl-tag-meta.js tests/karl-guide.test.js
git commit -m "docs: link the Karl Help Center from the tag legend, with the precedence rule"
```

---

### Task 6: Prove the rows render in a real browser

Unit tests assert the markup string. They cannot prove the panel opens, stays inside its ancestor, or that a real page produces a field reference at all.

**Files:**

- Create: `tests/e2e/karl-guide.spec.js`
- Read: `tests/e2e/helpers.js` (for `gotoFresh`)

**Interfaces:**

- Consumes: `gotoFresh` from `tests/e2e/helpers.js`. Read that file first and match how the sibling specs call it — do not invent a signature.
- Produces: nothing other tasks consume.

`payFee` is a Transaction page with five steps. A step tag passes `context: { role: 'what-to-do' }`, which aliases to `content`, which resolves to `section_specifics`. That chain is what these assertions exercise end to end.

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/karl-guide.spec.js`:

```js
// The Karl guide panel's field metadata, driven in a real browser.
//
// The unit tests in tests/karl-guide.test.js assert the markup string. What they
// cannot assert is that a REAL page produces a field reference at all — the
// chain runs page type -> role -> ROLE_ALIASES -> ROLE_PANELS -> the karl-blocks
// inventory, and a break anywhere in it renders a panel that is merely emptier,
// with nothing thrown and no assertion failed.
//
// payFee is a Transaction page with five steps. A step tag carries
// `role: 'what-to-do'`, which aliases to `content`, which resolves to
// `section_specifics`.
import { test, expect } from '@playwright/test'
import { gotoFresh } from './helpers.js'

test.describe('Karl guide field metadata', () => {
  test('a step tag names the raw Wagtail field it lands in', async ({ page }) => {
    await gotoFresh(page, 'payFee')
    const guide = page.locator('.karl-guide').filter({ hasText: 'Step' }).first()
    await guide.locator('.karl-guide-trigger').click()
    const panel = guide.locator('.karl-guide-panel')
    await expect(panel).toBeVisible()
    await expect(panel.locator('.karl-guide-path')).toContainText('Section specifics')
    await expect(panel.locator('.karl-guide-field code')).toHaveText('section_specifics')
  })

  test('the rules row reports the field map wording rather than a guess', async ({ page }) => {
    await gotoFresh(page, 'payFee')
    const guide = page.locator('.karl-guide').filter({ hasText: 'Step' }).first()
    await guide.locator('.karl-guide-trigger').click()
    const rules = guide.locator('.karl-guide-rules')
    await expect(rules).toContainText('not recorded')
    await expect(rules).not.toContainText('Optional')
  })

  // The panel is absolutely positioned against `.karl-guide`. A block-level tag
  // inside it closes an enclosing paragraph, and the panel then anchors to some
  // other element — which does not throw and does not fail a string assertion.
  // Measuring containment in the live layout is the only check that sees it.
  test('the open panel stays inside the guide it belongs to', async ({ page }) => {
    await gotoFresh(page, 'payFee')
    const guide = page.locator('.karl-guide').filter({ hasText: 'Step' }).first()
    await guide.locator('.karl-guide-trigger').click()
    const contained = await guide.evaluate((el) => {
      const panel = el.querySelector('.karl-guide-panel')
      return Boolean(panel) && el.contains(panel)
    })
    expect(contained).toBe(true)
  })

  test('hiding Karl tags hides the guide with them', async ({ page }) => {
    await gotoFresh(page, 'payFee')
    await page.locator('#tagToggle').uncheck()
    await expect(page.locator('.karl-guide').first()).toBeHidden()
  })
})
```

- [ ] **Step 2: Run the spec to verify it fails**

Run: `bun run test:e2e -- karl-guide.spec.js`
(In a sandbox with a pre-installed Chromium: `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium bun run test:e2e -- karl-guide.spec.js`)

Expected on a tree without Tasks 1–4: FAIL on `.karl-guide-field code`. On a tree with them: it should pass, which is the confirmation the chain is intact. If the `hasText: 'Step'` filter matches nothing, open `payFee` in the browser, read the actual step tag text, and narrow the locator to it — **do not** relax the assertion to make it green.

- [ ] **Step 3: Fix whatever the run reveals**

No implementation code is planned for this task. If the spec fails against a tree that has Tasks 1–4 committed, that is a real defect in the chain — debug it, fix the source, and note what broke in the commit body.

- [ ] **Step 4: Run the full e2e suite**

Run: `bun run test:e2e`
Expected: PASS. Confirm no sibling spec regressed — the new rows change the panel's height, and `workspace-panels.spec.js` and `accessibility.spec.js` both measure live layout.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/karl-guide.spec.js
git commit -m "test: prove the Karl guide field rows render on a real Transaction page"
```

---

### Task 7: Update the three instruction mirrors

`tests/mirror-consistency.test.js` gates that `AGENTS.md`, `CLAUDE.md` and `.github/copilot-instructions.md` state the same facts, and `tests/skill-consistency.test.js` gates the eleven `hhvc-*` skill extracts against `AGENTS.md`. The `tests/karl-guide.test.js` description in those files now understates what the file asserts.

**Files:**

- Modify: `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md` — the `karl-guide` entry in each file's test inventory
- Test: `bun run test` (the mirror and doc-count gates)

**Interfaces:**

- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Find the three descriptions**

Run:

```bash
grep -n "karl-guide" AGENTS.md CLAUDE.md .github/copilot-instructions.md
```

Read the surrounding sentence in each. The wording differs between files by design — these are mirrors of the same **facts**, not the same bytes.

- [ ] **Step 2: Extend each description**

Add to each, in that file's own voice, the two facts a later reader needs and cannot recover from the code alone:

1. The panel now names the **raw Wagtail field** and its form rules, read from `js/karl/karl-blocks.js` rather than restated — so a wrong value has to be wrong in the guarded inventory first.
2. **The rules row prints `requiredDoc`/`repeatableDoc`, never the booleans beside them.** `not recorded` is a real answer and is not the same claim as `Optional`; rendering the boolean would report a measurement nobody took. Style guidance renders in a separate row that names the measured schema value beside it, because `O14` records the Button link "25 characters" as Help Center advice against a live `maxlength="255"`.

Do not add a count of any kind — `tests/doc-counts.test.js` and `tests/doc-claims.test.js` scan these files for number-anchored claims and check them against the filesystem.

- [ ] **Step 3: Run the gates**

Run: `bun run lint:docs && bun test tests/mirror-consistency.test.js tests/skill-consistency.test.js tests/doc-counts.test.js tests/doc-claims.test.js`
Expected: PASS. A mirror-consistency failure names the missing fact and the file missing it.

- [ ] **Step 4: Run everything**

Run: `bun run format:check && bun run lint:js && bun run validate && bun run test`
Expected: PASS, all 58 unit files.

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md CLAUDE.md .github/copilot-instructions.md
git commit -m "docs: mirror the Karl guide field-metadata rules into all three instruction files"
```

---

## Definition of Done

Per this repo's `CLAUDE.md`, not merely "code written":

- [ ] `bun run format:check && bun run lint:js && bun run validate && bun run test` all green, output shown
- [ ] `bun run test:e2e` green, output shown
- [ ] Verified in a real browser: `bun run dev`, open `payFee`, expand a step's Karl guide, confirm the Path / Field / Rules rows read correctly and that the mockup layout is byte-identical with tags toggled on and off (the panel escaping its ancestor is a layout bug, not a test failure)
- [ ] Committed on a branch, pushed, PR opened, CI green
- [ ] The three blocked/deferred/rejected subsystems restated in the PR body, so the reviewer knows what this does **not** do

## Follow-ups this plan deliberately leaves open

- **The colour taxonomy decision.** The reviewer picks: five categories as a second attribute alongside the existing four kinds (additive, no call-site churn), or a replacement that re-audits every `karlTag()` call site against `ROLE_PANELS`. Spec has the blast radius.
- **Blueprint mode** with dotted block outlines.
- **`FIELD_GUIDANCE` has one entry.** Add another only when `docs/karl-export-field-map.md` records one — same rule as `UNRESOLVED`.
