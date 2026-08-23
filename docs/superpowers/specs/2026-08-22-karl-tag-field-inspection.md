# Karl tags as developer inspection chips — design spec

**Date:** 2026-08-22
**Status:** approved for the Phase 1 slice only (see Scope below)
**Plan:** `docs/superpowers/plans/2026-08-22-karl-tag-field-inspection.md`

## The request

Make Karl tags intuitive for editors and content reviewers translating mockups
into Wagtail. The tags should function like **developer inspection chips**
rather than flat text boxes, showing four data points:

1. **Exact Wagtail panel navigation path** — `Content Tab → what_to_do →
   Section → section_specifics → Button link`
2. **Block type and raw field name** — `Block: Section specifics (Text) |
   Field: text`
3. **Inheritance and link-shape rules** — bare page chooser vs. page chooser
   with summary vs. authored link text plus external URL
4. **Validation constraints and Draftail rich-text rules** — `Required`,
   `Draftail: Bold, H3, Bullets (No H2)`, `Max 110 chars`

Plus: semantic colour tiers per component category, a one-click copy button, a
citizen-preview / blueprint dual view mode, and a click-to-open sidebar drawer
carrying a Help Center link, a character counter, and a raw Wagtail JSON
snippet.

## What this repo already ships

The brief was written against a mental model of the tag as a flat string. It is
not one. `karlTag()` in `js/mockup/page-render.js` already emits a disclosure
button wrapping a `<mark class="karl-tag">`, with an expandable
`.karl-guide-panel` built by `renderKarlGuidePanel()` in
`js/mockup/karl-tag-meta.js`, fed by `guideForContext()` in
`js/karl/karl-guide-registry.js`, which resolves against the test-guarded panel
inventory in `js/karl/karl-blocks.js`.

Measured against the brief's four data points:

- **Item 1 (navigation path) — shipped.** `breadcrumbFor()` builds
  `Content → What to Do → Section specifics → Button link` from the inventory,
  walking `subPanelOf` and disambiguating repeated UI labels. It is displayed on
  the panel's `Path:` row.
- **Item 2 (raw field name) — MISSING.** The path is UI labels only. The raw
  Wagtail name (`section_specifics`) and the block-type chooser contents are on
  the panel object `resolvePath()` fetches and then discards.
- **Item 3 (inheritance and link shapes) — shipped.** `LINK_SHAPES` carries all
  five shapes with their descriptions, rendered on the `Link shape:` row and
  folded into the numbered steps. `INHERIT_BADGE_TEXT` in
  `js/mockup/page-render.js` carries the three inheritance phrasings, and
  `guideForContext()` stamps `status: 'inherited'`.
- **Item 4 (validation constraints) — MISSING.** `required`, `repeatable`,
  `requiredDoc`, `repeatableDoc` and `blockTypesDoc` are transcribed per panel
  and gated by `tests/karl-blocks.test.js`, and none of them reaches the screen.

Also already shipped, from the brief's feature list: the **copy button**
(delegated `[data-karl-copy]` handler in `js/karl/karl-guide.js`, with a
hardened `execCommand` fallback that toasts only on a copy that actually
happened), and **citizen preview mode** (the `#tagToggle` switch in the canvas
toolbar, persisted as `state.ui.show_karl_tags`, driving
`body.hide-karl-tags`).

So the genuinely missing content is **items 2 and 4**, and both are sitting in
data one function call away from where they need to render.

## Scope

The brief spans four subsystems. **This spec approves one of them.**

| # | Subsystem | Disposition |
| - | --------- | ----------- |
| 1 | Field-metadata surfacing (items 2 and 4) | **In scope — this spec** |
| 2 | Five-way semantic colour taxonomy | **Blocked on a decision** — see below |
| 3 | Blueprint mode with dotted block outlines | **Deferred** — no existing surface |
| 4 | Sidebar drawer, JSON snippet, character counter | **Rejected** — see below |

Each subsystem produces working software on its own, which is why they split
cleanly. A reviewer can approve Phase 1 without approving the other three.

## In scope: what Phase 1 builds

Three additive rows on the existing guide panel, all fed from
`js/karl/karl-blocks.js`:

```text
Path:   Content → What to Do → Section specifics
Field:  section_specifics — "Section specifics"
Rules:  Required: not recorded · Repeatable · chooser: Address | Callout |
        Document | Email | Button link | Phone number | Text
```

Plus a **guidance** row, rendered visually distinct from the Rules row, for the
one style rule this repo's record actually supports (see "Guidance is not
schema" below).

### The rules row renders the doc's own words, not the booleans

`section_specifics` carries `required: false` **and**
`requiredDoc: 'not recorded'`. Those are different claims. The boolean is this
repo's coercion of an absent measurement into a default; the string is what the
field map actually says. Rendering "Optional" would tell a reviewer that the
form was measured and found to permit an empty value, which nobody measured.

**The rules row therefore renders `requiredDoc` and `repeatableDoc` verbatim.**
This is the same posture as `resolvePath()` returning `''` rather than guessing,
and as `js/karl/karl-transcript.js` emitting `FLAG` rather than a guessed
instruction: the failure mode this feature keeps producing is not a wrong
answer, it is an answer indistinguishable from a measured one.

### Guidance is not schema

The brief's example constraint — `Max 25 chars` on a button — is recorded in
`docs/karl-export-field-map.md` as **obsolete**. Register entry `O14`: the live
`Button link` text field carries `maxlength="255"`, measured 2026-08-15 on a
Transaction `section_specifics` block; the "25 characters" is Karl Help Center
*style guidance*, not a schema limit. Entry `U19` records ten mockup labels
shortened on that guidance rather than on a constraint.

Rendering 25 as a constraint would ship a measured-looking falsehood into the
one panel whose job is separating measured destinations from chosen ones.

So: guidance renders in its own row, worded as guidance, naming the real schema
value beside it. A test asserts the 25 never appears in the schema row.

### Help Center link

One link to the Karl Help Center, **in the Help-tab legend, not in every
panel.** The RAG corpus deliberately separates the `karl` category (the CMS as
measured) from `karl-gitbook` (the CMS as documented) because the two have
disagreed four times over and the measurement wins. A doc link sitting inside
the panel, beside a resolved path, reads as authority over that path. In the
legend it reads as what it is — background reference, where the legend already
lives after the UX review moved it there.

## Blocked: the colour taxonomy

The brief proposes five categories (Metadata, StreamField Blocks, Actions/CTAs,
Callouts, Inherited/Link Pickers). This repo has four kinds (`meta`, `body`,
`placement`, `editor`) in `KARL_TAG_KINDS`.

**These are different axes, and the change is a renderer-wide semantics change
wearing a styling change's clothes.** `guideForContext()` computes
`role = context.role || context.component || kind`. A new kind name with no row
in `ROLE_PANELS`/`ROLE_ALIASES` resolves to `''` and reports as "Mockup only" —
so re-routing the 35+ `karlTag()` call sites onto a five-way taxonomy would
silently strip the measured path off every callout and button tag.

Blast radius if it proceeds: `renderKarlTagLegend()` iterates the table; two
`!important` blocks per kind in `css/ux-improvements.css`;
`tests/karl-tag-meta.test.js`; `tests/theme-contrast.test.js` (each new token
pair needs measured WCAG ratios and within-mode ΔE, light and dark); and the
four kinds are stated in all three instruction mirrors, gated by
`tests/mirror-consistency.test.js`.

**Decision needed from the reviewer** before this is planned: either the five
categories become a *second* attribute rendered alongside the existing kind
(additive, no call-site churn), or the four kinds are replaced and every call
site is re-audited against `ROLE_PANELS`. The first is cheap; the second is a
project.

## Deferred: blueprint mode

Dotted perimeter outlines showing block boundaries, as a mode distinct from
citizen preview. There is no existing surface for it and it is independent of
everything above. Worth doing; not now.

## Rejected, with reasons

- **Raw Wagtail JSON snippet.** Nothing in this repo has ever measured a
  StreamField serialization. `karl-blocks.js` is a panel inventory, not a schema
  dump. Emitting JSON means inventing a shape and stamping it with the badge
  that means *measured*.
- **Generic character counter.** The record holds exactly two caps: the cost
  description at 120 characters, and Button link text at `maxlength="255"`. A
  counter on every field implies caps that were never measured, on every field
  that has none.
- **Sidebar drawer.** The panel is already an inline disclosure with Escape
  handling and focus return to the trigger. A drawer means the workspace, and
  `WORKSPACE_TABS`, the tab markup in `index.html` and the `1`–`3` cases in
  `js/review/keyboard-shortcuts.js` must change together — for a strip that was
  deliberately cut from six tabs to three.
- **Block-level markup (`<div>`, `<p>`, `<ol>`, `<h4>`) inside the panel**, as
  the brief's code blueprint uses. The panel renders inside
  `<span class="karl-guide">`, which sits wherever its tag sits — inside an
  `<h3>`, an `<li>`, a table cell, a paragraph. A block-level start tag closes
  an open paragraph, so the panel escapes the positioned ancestor it is anchored
  to and reopens elsewhere on the page, silently restructuring the mockup under
  review. Three call sites hit exactly that. **Phrasing content only.**
- **Inline `onclick` clipboard handler.** A delegated `[data-karl-copy]` handler
  already exists, with a secure-context check and an `execCommand` fallback that
  checks the return value — because `execCommand` reports failure by returning
  false rather than throwing, and an ignored return toasts "copied" over an
  empty clipboard while the reviewer pastes stale text into Karl.
- **Hardcoded hex literals in CSS.** Every dark-mode contrast bug this repo has
  had came from a literal sitting where a token belonged. Semantic tokens only.
- **`js/app.js` as the edit target.** That path does not exist. `karlTag()` is
  in `js/mockup/page-render.js`; the core bootstrap is `js/core/app.js`.

## Global constraints

Copied here so the plan's tasks inherit them:

- **Phrasing content only** inside `renderKarlGuidePanel()`. No `<div>`, `<p>`,
  `<ol>`, `<ul>`, `<h1>`–`<h6>`. Use `<span>`, `<strong>`, `<code>`, `<button>`,
  and ARIA roles for semantics.
- **Every interpolated value goes through `escapeHtml`.**
- **CSS takes semantic tokens** (`--ds-*`, `--surface-*`, `--text-*`,
  `--sfds-*`). No hex literals, no new `--sfds-` prefixed names.
- **Prettier formatting is a CI gate**: no semicolons, single quotes, 2-space
  indent, `printWidth: 100`, ES5 trailing commas. Code must be ASI-safe.
- **`js/karl/karl-blocks.js` is the mapping authority.** Do not restate a
  required/repeatable/block-type fact anywhere else; read it from the inventory.
- **A new `tests/*.test.js` file is invisible to CI** until it is named in
  `package.json`'s `test` script, which is spelled out explicitly rather than
  globbed. Extend `tests/karl-guide.test.js`, which is already named.
- **A new `tests/e2e/*.spec.js` file IS auto-discovered** —
  `playwright.config.js` sets `testDir: './tests/e2e'`.
- **`bun run validate` and `bun run test` after any change under `js/karl/`** —
  `findUnmappedSections` gates on validate.

## Verification

- `bun run format:check && bun run lint:js && bun run validate && bun run test`
- `bun run test:e2e` for the DOM assertions
- Live browser check: open a Transaction page (`payFee`), expand a step's Karl
  guide, confirm the Field and Rules rows render and that the panel has not
  escaped its paragraph (the mockup layout is unchanged with tags on and off).
