# Editor QA block redesign

Date: 2026-07-06
Status: Approved, ready for implementation plan

## Problem

The "Editor QA" block (`js/page-render.js:94`, styled by `.editor-note` in
`css/styles.css:583-595`) renders at the top of every page's body, right
after the hero and before the "Who this page is for" section. Today it's a
single dashed-border box with a small green `Karl:` pill and a flowing
paragraph of freeform notes (page purpose, sourcing, scope caveats, "verify
before publication" asks, and occasional inline "In Karl:" CMS instructions
all mixed together). It looks close enough to real body content that a
reviewer can misread it as page copy, and dense prose makes it hard to
scan for the one thing that actually matters: **is there an open blocker on
this page, or not?**

## Goals

- Make the block visually unmistakable as reviewer-only, non-published
  content.
- Surface publish-readiness at a glance via a color-coded status, without
  requiring the reviewer to read the full note.
- Keep the existing freeform `editorNote` text as supporting detail — no
  attempt to decompose it into multiple structured sub-fields (rejected as
  too fragile: 39 pages of inconsistent prose, high risk of misclassifying
  nuance into rigid buckets).

## Data model change

Add one new optional field to `pageSchema` in `build_scripts/schema.js`:

```js
editorStatus: z.enum(['needs-review', 'blocked', 'placeholder']).optional(),
```

- **Default (field absent): `needs-review`.** Every page in this tool is
  pre-publication mockup content — there is no "fully approved, nothing to
  check" tier. `needs-review` is the floor, not a status a page graduates
  out of by having this field set.
- **`blocked`**: the page cannot move forward without an external
  confirmation (e.g. HHVC/SME sign-off, a still-unconfirmed lookup tool).
  Reserved for notes that explicitly say `BLOCKED` or state the page must
  not publish until something is confirmed.
- **`placeholder`**: the page ships illustrative/example content standing
  in for real content (an "SME placeholder" note), not just an unconfirmed
  detail inside otherwise-real copy.

Only pages needing `blocked` or `placeholder` get the field set explicitly;
every other page (33 of 39) relies on the default and needs no page-file
change.

### Classification (derived from current `editorNote` text)

| Status | Pages | Rule |
|---|---|---|
| `blocked` | `find-district-inspector`, `respond-to-notice-of-violation`, `raccoon-information` | Note contains `BLOCKED` or "do not publish until X signs off" |
| `placeholder` | `lookup-residential-hotel-records`, `mosquito-education-workshop`, `report-dead-bird` | Note contains "SME placeholder" |
| `needs-review` (default, no field set) | The remaining 33 pages | Everything else, including the 13 pages with no `editorNote` at all |

## Visual design

Approved direction: **left accent bar** (Option B from the mockup review).
Replaces `.editor-note` with `.editor-qa` (+ a `qa-<status>` modifier) in
`css/page-render.js` output and `css/styles.css`:

- Container: light background tint, 5px colored left border, rounded
  corners — same position in the DOM as today (first thing in `.page-body`,
  before the audience section).
- Header row: the existing green `Karl:` pill (`karlTag('Editor-only QA
  note / Do not publish', 'editor')`) stays as-is and keeps respecting the
  `body.hide-karl-tags` toggle — it signals CMS placement, a different
  concern from publish-readiness. Next to it, a **new, always-visible**
  status pill (not affected by the Karl-tags toggle) showing icon + label:
  - `needs-review` → amber/warning tokens, icon `⚠`, label "Needs review"
  - `blocked` → red/danger tokens, icon `⛔`, label "Blocked"
  - `placeholder` → purple tokens, icon `◆`, label "Placeholder content"
  (Reuses existing `--sfds-warning-*`, `--sfds-danger-*`, `--sfds-purple-*`
  custom properties already defined in `css/styles.css:15-28` — no new
  color tokens.)
- Body: `<strong>Editor QA:</strong>` + the existing `editorNote` text (or
  today's generic fallback string when absent), unchanged in content.

## Implementation surface

- `build_scripts/schema.js` — add `editorStatus` enum field.
- `pages/find-district-inspector.js`, `pages/respond-to-notice-of-violation.js`,
  `pages/raccoon-information.js` — add `editorStatus: 'blocked'`.
- `pages/lookup-residential-hotel-records.js`, `pages/mosquito-education-workshop.js`,
  `pages/report-dead-bird.js` — add `editorStatus: 'placeholder'`.
- `js/page-render.js` — replace the inline `.editor-note` markup at line 94
  with a new `editorQaBlock(page)` helper that resolves status → label/icon/
  color modifier and renders the accent-bar markup.
- `css/styles.css` — replace `.editor-note`/`.editor-note strong` rules
  (lines 583-595) with `.editor-qa`, `.editor-qa-head`, `.editor-qa-status`,
  and the three `qa-needs-review` / `qa-blocked` / `qa-placeholder` color
  modifiers.
- No changes needed to `build_scripts/extract-pages.js` — it dumps the full
  `HHVC_DATA` object to `data/page_inventory.json`, so `editorStatus` is
  automatically included; the curated CSV column list is intentionally not
  extended (out of scope, not requested).
- No changes needed to `js/ux-improvements.js`'s compliance scorecard —
  `editorStatus` is a display-only signal for this block and is not wired
  into the pass/fail check list or the review-queue filtering (out of
  scope, not requested).

## Testing

- `bun run validate` must pass with the new enum field and the 6 updated
  page files.
- Manual check in the browser: load `pestsTopic` and at least one page from
  each status bucket (`fly-information` for the default, `find-district-inspector`
  for `blocked`, `mosquito-education-workshop` for `placeholder`) and confirm
  the correct color/icon/label renders, and that toggling "show Karl tags"
  off hides the green `Karl:` pill but leaves the new status pill visible.
- `bun run format:check` (Prettier is the project's lint gate).
