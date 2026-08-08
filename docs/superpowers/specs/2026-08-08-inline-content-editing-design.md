# Design: manual inline content editing on the mockups

## Problem

A reviewer can only edit SEO metadata today — title/meta description/slug, via the sidebar
editor panel (`js/editor-panel.js`). Everything else a reviewer might want to fix while
looking at a mockup — the page title, the summary, the CTA label, a section heading, a
paragraph, a bullet — can only be changed by leaving the tool, hand-editing the matching
`pages/*.js` source file, and reloading. For a manager doing a fast pass across 22 pages,
that round trip (find the file, find the field inside a large object literal, edit, save,
tab back, reload, re-navigate to the page) is disproportionate to fixing one sentence.

This design adds direct, in-place editing on the rendered mockup: click a field, it becomes
editable, edit it, the mockup re-renders immediately. Same posture as every other
review/UX-layer feature in this tool: entirely a review aid, persisted through the existing
browser-first `localStorage` review-state model (with the optional sync backend layered on
top exactly as it is for every other field), and `pages/*.js` is never touched.

## Goals

- Click any in-scope field on the mockup — title, summary, CTA label, a section heading, a
  paragraph, a bullet — and edit it in place, with the mockup reflecting the change
  immediately (no save-then-reload step).
- Add or remove individual paragraphs and bullets within an existing section.
- Edits are visibly distinguishable from source-authored copy, reusing the schema's existing
  `unverified`/`unverifiedReason` mechanism where it already applies (paragraphs, bullets),
  and a small CSS-only "Edited" badge where it doesn't (title, summary, heading, CTA — none
  of which support the object form `unverified` flags today).
- Edits persist through the same `localStorage` review-state path, round-trip through JSON
  backup export/import, and (where a sync backend is configured) push/pull like every other
  field.
- Build on the field-addressing infrastructure the in-flight AI-rewrite-selection feature
  (`docs/superpowers/specs/2026-08-07-ai-rewrite-selection-design.md`, branch
  `feat/ai-rewrite-clean`, PR #100) already put on `main` — `data-rewrite-field` dot-paths in
  `js/page-render.js`, `getByPath`/`setByPath` in `js/utils.js` — rather than building a
  second, parallel way to address the same fields.

## Non-goals

- **Not editing `pages/*.js` source files.** Every review/UX layer in this tool is bound by
  this rule; this feature is not the exception. Getting an edit into the repository is still
  a human writing it into `pages/*.js` by hand.
- **Not covering every text-bearing field.** In scope: page title, summary, CTA label,
  section heading, section paragraphs, section bullets. Out of scope: cards (label and
  target), callouts, table cells, step text/bullets, `whatToKnow` items, contact info. All of
  those stay hand-edited in source, same as today. This mirrors the AI-rewrite-selection
  design's own v1 boundary (which additionally excludes title/summary/CTA/heading, on the
  grounds that dedicated sidebar inputs already existed for title/summary/CTA — this design
  is what actually wires those inputs up, and extends the boundary to headings).
- **Not section/card/step add, remove, or reorder.** Only two array-shaped fields —
  section `paragraphs` and section `bullets` — support add/remove, and only of individual
  items. The set of sections on a page, their order, and their structural fields (`kind`,
  `component`, `open`, etc.) are fixed.
- **Not AI-assisted.** This is manual typing only. The AI-rewrite-selection feature is a
  separate, later-triggered affordance (select text → AI rewrite → apply) that will share
  this design's addressing and persistence surface once it lands, but nothing here calls the
  AI backend.
- **Not a rewrite/edit history UI.** One level of undo on delete (a toast affordance,
  matching `js/review-queue-undo.js`'s precedent), plus a per-field "reset to original"
  control (matching the SEO panel's existing per-field reset). No multi-step undo stack.
- **Not real-time collaborative editing.** Two browsers editing the same page's content
  concurrently is subject to the same last-write-wins-per-field behavior every other
  continuous edit in this tool already has (see "Persistence" below) — no new conflict UI.

## Architecture

### Field addressing: reused, not reinvented

`js/page-render.js` already emits a `data-rewrite-field` attribute carrying a dot-path rooted
at the page object, on every paragraph, bullet, and step-text item, via `paragraphList()` and
`bulletList()`'s optional `pathPrefix` parameter (added for the in-flight AI-rewrite-selection
feature, already merged to `main`):

```
sections.2.paragraphs.1          a paragraph in the third section
sections.2.bullets.0             a bullet in the same section
```

The path uses each section's **original** `page.sections` index, captured onto a
`__sectionIndex` property during `partitionSections()`'s reordering walk — not its position in
the rendered layout, which is reshuffled into role buckets (`intro`, `services`, `resources`,
`related`, `whatToDo`, `supporting`, `body`). Addressing by render position would silently
target the wrong section on any page where a role bucket reorders things, which is most
multi-section pages. This design does not change that mechanism; it adds two more call sites
to it and adds two page-level fields that use a different, already-existing persistence path:

- **Section headings.** `renderSection()` (the wrapper around `renderSectionInner()`) gains
  `data-rewrite-field="sections.N.heading"` on the `<h2>`, using the same `__sectionIndex`
  already available on the section object it receives. Headings were out of scope for
  AI-rewrite-selection (selection-driven rewriting of a heading is an odd interaction — you
  select the whole thing or nothing) but are natural to click-to-edit.
- **Title, summary, CTA label.** These are page-level, not inside `sections[]`, so a
  `sections.N....` path doesn't apply. They also already have dedicated (currently unused —
  see "Persistence" below) schema fields and helper functions:
  `page.title`/`page.summary` are read directly, `getPrimaryCta(page)`/`setPrimaryCta(page,
  label)` already exist in `js/utils.js`. `renderHero()` gains `data-rewrite-field="title"`,
  `"summary"`, `"primaryCta"` on the corresponding elements purely as click targets; the
  actual read/write goes through the dedicated helpers, not through `getByPath`/`setByPath`,
  because a generic path-based accessor would just be a second way to reach fields that
  already have one.

`getByPath(root, path)` / `setByPath(root, path, value)` (`js/utils.js`) resolve/write a
dot-path against the in-memory page object. Both already exist, already guard against
prototype-pollution path segments (`__proto__`, `prototype`, `constructor`), and already have
unit tests (`tests/utils.test.js`). `setByPath` never creates intermediate structure — it
requires every segment up to the last to already resolve — which this design relies on: an
edit can only ever land on a path the page schema already describes, never invent new shape.

### Interaction: click-to-edit, not select-to-act

A new self-mounting module, `js/inline-content-edit.js` (orchestrator: click handling, edit
lifecycle, save/cancel/undo) plus `js/inline-content-edit-render.js` (the editing-widget
markup — swapped-in `<input>`/`<textarea>`, the add/remove/reset controls), matching the
existing `ai-assist`/`ai-rewrite`/`review-queue` split of "orchestrator IIFE + sibling render
module" this codebase already uses for stateful subsystems. Both attach to an internal
`window.InlineEdit` namespace; the orchestrator publishes its public surface on
`window.inlineEdit`. Unlike AI rewrite, this needs no backend and no capability check — the
affordance is present whenever the page has loaded.

A delegated click listener on `#mockPage` walks up from the click target for the nearest
`[data-rewrite-field]` ancestor:

- **Scalar target** (title, summary, heading, one paragraph, one bullet, CTA label): the
  element is replaced with an `<input>` (title, heading, CTA — single-line fields) or a
  `<textarea>` (summary, a paragraph, a bullet — fields that can run long), pre-filled from
  `getByPath()` or the dedicated getter. **Enter** commits an `<input>`; **blur** commits a
  `<textarea>` (Enter would fight normal multi-line editing); **Escape** cancels and restores
  the pre-edit text without saving. A commit calls `setByPath()` (or `setPrimaryCta()` /
  direct `page.title =`/`page.summary =` assignment), triggers `window.renderPage`, and saves
  (see "Persistence").
- **List target's container** (the `<ul>` for bullets, or the run of `<p>` for paragraphs): an
  **"+ Add"** control appended after the last item creates a new empty item, already open in
  edit mode, at the next index. A small **"×"** control per item removes it immediately (no
  confirm dialog — a toast with a one-step **Undo**, matching `js/review-queue-undo.js`'s
  precedent, covers the accidental-click case without a modal interrupting the editing flow).
  Both operations get the containing array via `getByPath(page, containerPath)`, mutate it
  directly (`.push()`/`.splice()`), re-render, and save the whole resulting array (see below).

### Edited-field visibility

- **Paragraphs and bullets** already accept the object form `{text, unverified,
  unverifiedReason}` (`normalizeTextItem()` in `js/page-render.js` handles string-or-object
  today, and the AI-rewrite-selection design uses exactly this mechanism for its Apply step).
  A manual edit is stored the same way: `{text: <new text>, unverified: true,
  unverifiedReason: 'Manually edited during review'}`. This renders the existing "Unverified"
  pill with no renderer change, and gives a reviewer scanning the page later one consistent
  signal for "this text differs from what was authored" regardless of whether AI or a human
  changed it.
- **Title, summary, heading, CTA** have no `unverified` slot in the schema (they're plain
  strings, not text-bearing array items). These get a small CSS-only "Edited" badge —
  `css/inline-content-edit.css` (a ninth stylesheet, imported in `js/main.js` before
  `css/theme.css`, which must stay last per the existing seven-stylesheet ordering rule) —
  shown next to the field whenever its current value differs from `ORIGINAL_DATA`.
- **Reset to original**: a small control on any field currently showing the edited/badge
  state, restoring the `ORIGINAL_DATA` value and clearing the corresponding entry from
  `section_edits` (or the dedicated field) — mirroring the SEO panel's existing per-field
  reset pattern.

## Persistence: closing a real gap, not just adding a field

`REVIEW_RECORD_FIELDS` (`js/utils.js`) already lists `edited_title` and `edited_summary`,
and the review-record schema (`build_scripts/review-state-schema.js`) already has
`primary_cta`/`edited_title`/`edited_summary` slots. `updateMockupTextFromSavedState`
(`js/ux-improvements-state-sync.js`) already reads them back and reapplies them onto the
in-memory page object on load. **Nothing currently writes them** — there is no UI today that
sets `edited_title`, `edited_summary`, or `primary_cta` on a review record. This design
supplies that missing write path, rather than inventing a new mechanism next to an unused one.

For section-level content, no persistence field exists at all yet. This design adds one:

- **`section_edits`**, a new field on the review record: a flat map from field path to
  **current full value** — `{ "sections.2.heading": "New heading", "sections.2.paragraphs":
  ["p1", "p2"], "sections.2.bullets": [{text: "b1"}, {text: "b2", unverified: true, ...}] }`.
  Keyed at the **array/scalar field level, not the individual item level.** Editing, adding,
  or removing one bullet always writes the entire resulting `bullets` array under
  `sections.2.bullets`, never a single index. This is a deliberate simplification: per-item
  keys (`sections.2.bullets.0`, `sections.2.bullets.1`, ...) break the moment an item is
  removed, because every later index shifts — the map would either go stale (referencing an
  index that now holds different content) or need renumbering logic on every delete. Whole-
  field values sidestep that entirely, and match how every other continuous edit in this tool
  already works: `edited_title` is the whole new title, not a diff against the old one.
- Both `edited_title`/`edited_summary`/`primary_cta` (now actually written) and the new
  `section_edits` are added to `REVIEW_RECORD_FIELDS`, `build_scripts/review-state-schema.js`,
  and `js/review-state-validation.js` (the browser-side mirror that must stay in step with the
  Zod schema per the existing pinned-drift test).
- **`mergeReviewRecord`'s merge is shallow at the top level** (`{...source, ...patch}`) — a
  patch carrying `section_edits` replaces the *whole* map, not a per-path merge inside it.
  This is consistent with how `mergeReviewRecord` already treats every other field, and it's
  why every write of `section_edits` sends the complete, current map (read the existing saved
  record, apply the new edit on top in memory, save the whole thing) rather than a partial
  patch — exactly the pattern `edited_title` already uses.
- **JSON backup export/import only.** `primary_cta`/`edited_title`/`edited_summary` are
  strings and already fit the flat CSV row model the same way `notes`/`decision` do — CSV
  export/import (`js/manager-review-export.js`, `js/review-queue-import.js`) starts actually
  carrying non-empty values for them once this ships. `section_edits` is a nested object and
  does not fit a flat CSV row; it round-trips through the JSON backup path
  (`js/ux-improvements-export.js`'s `importReviewStateBackup`) only. A CSV export/import
  cycle preserves title/summary/CTA edits but silently drops section-level edits — a real,
  worth-documenting limitation, not an oversight, and it needs a line in CLAUDE.md's export
  section saying so explicitly.
- **Continuous autosave, no history entry** — the same rule `saveCurrentPageToLocalStorage`
  already applies to every keystroke-level field: these edits are folded into the existing
  debounced autosave path, carrying `history[]` forward untouched rather than routing through
  `mergeReviewRecord` on every keystroke. (Compare: the AI-rewrite-selection design's Apply
  step also states it "persists through the same autosave path" — this design is what
  actually makes that true for section-level content, since no such path exists yet for
  anything beyond the three page-level fields.)
- **Reapply on load**: a new `applyContentEditsToPageData(page, savedRecord)` function
  (sibling to, and called alongside, the existing `updateMockupTextFromSavedState`) replays
  `savedRecord.section_edits` onto `pageData[pageKey]` via `setByPath()` for each entry, and
  applies `edited_title`/`edited_summary`/`primary_cta` the same way
  `updateMockupTextFromSavedState` already (would, once wired) apply them. Called at initial
  page load, after a sync pull, and after conflict resolution — the same call sites
  `updateMockupTextFromSavedState` already has.

## Coordination with `feat/ai-rewrite-clean` / PR #100

No direct file conflicts are expected: that branch's new files (`js/ai-rewrite.js`,
`js/ai-rewrite-render.js`, `css/ai-rewrite.css`) don't exist on `main` yet. The shared surface
is:

- `js/page-render.js` — both efforts add `data-rewrite-field` to more call sites (headings,
  title/summary/CTA here; nothing new on the AI-rewrite side). Additive, low collision risk,
  but worth a heads-up to whoever's driving PR #100 before this lands, since a rebase touching
  the same functions is easier to reason about coordinated than discovered after the fact.
- `js/utils.js` — this design adds `section_edits` to `REVIEW_RECORD_FIELDS` and wires the
  `edited_title`/`edited_summary`/`primary_cta` write path. The AI-rewrite-selection design's
  own "Apply" step currently has no persistence plan beyond "the same autosave path" — once
  `section_edits` exists, that feature's Apply should write into it too (a paragraph/bullet
  rewrite is exactly the same shape of edit as a manual one), rather than the two features
  ending up with two different persistence mechanisms for the same field types. Flagging this
  explicitly in this design's PR description, so PR #100 can adopt `section_edits` instead of
  inventing its own.

## Testing

- `tests/page-render.test.js` (existing, extended) — `data-rewrite-field` on section headings
  and on title/summary/CTA in the hero; the original-`__sectionIndex` regression check
  extended to headings; escaping assertions for the new attribute, matching the file's
  one-assertion-per-render-function convention.
- `tests/utils.test.js` — no changes expected to `getByPath`/`setByPath` themselves; add
  coverage if any new path shape (e.g. a top-level `"title"`/`"summary"`) is exercised through
  them (it currently is not — those two go through direct assignment, not `setByPath`).
- `build_scripts/review-state-schema.js` / `js/review-state-validation.js` tests — the new
  `section_edits` shape (valid map, invalid path-key rejected the same way the two schemas
  already reject other malformed fields), and that both files' accepted shapes stay in step
  (the existing `decision-vocabulary`-style drift guard is the model to follow).
- New `tests/inline-content-edit.test.js` — `applyContentEditsToPageData()` against a
  synthetic saved record: applies `section_edits` paths via `setByPath`, applies
  `edited_title`/`edited_summary`/`primary_cta`, no-ops cleanly on an empty/absent record,
  never throws on a stale path that no longer resolves (mirroring `getByPath`'s existing
  "total function" contract). Pure logic, no DOM, no browser needed.
- New `tests/e2e/inline-content-edit.spec.js` — click a paragraph and edit it, confirm the
  mockup updates immediately and the Unverified pill appears; add a bullet; remove a bullet
  and confirm the one-step Undo restores it; edit the title/summary/CTA/a heading and confirm
  the "Edited" badge appears and "Reset to original" clears it; reload the page and confirm
  every edit persisted; export a JSON backup, clear local reviews, import it back, and confirm
  every edit survives — the mandatory merge-not-wipe verification this repo requires for any
  change touching the import/export round trip, per CLAUDE.md's "Local persistence" section.
- Both new test files must be named explicitly in `package.json`'s `test` script list (this
  repo enumerates rather than globs) or they run only by hand and cover nothing in CI.

## Docs

- New CLAUDE.md section, "Inline content editing," alongside "AI rewrite (optional)" (once
  that lands) and in the same voice: what's editable, what isn't, the whole-field/original-
  index constraints inherited from the shared addressing scheme, the CSV-drops-section-edits
  limitation stated plainly, and the "closes the unused edited_title/edited_summary/
  primary_cta gap" framing so a future reader doesn't wonder why those fields exist unwritten.
- AGENTS.md gets the same section per this repo's cross-tool-canon rule;
  `.github/copilot-instructions.md` stays a pointer with no new summary.
- The stylesheet table in both files gains a row for `css/inline-content-edit.css` (or a
  ninth/tenth row alongside `css/ai-rewrite.css` if that has landed by the time this does),
  imported before `css/theme.css`.
