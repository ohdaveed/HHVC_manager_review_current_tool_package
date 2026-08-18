---
name: hhvc-inline-content-editing
description: 'HHVC repo: click-to-edit on the rendered mockup — the EDITABLE_FIELD_SHAPES scope list and its four value kinds, why cards carry no data-rewrite-field, why a stamped-but-unlisted path silently loses edits, section_edits being derived not accumulated, the reapply/re-render infinite-loop guard, and the CSV round-trip limitation. Load before editing js/inline-content-edit*.js.'
---

<!-- Extracted from CLAUDE.md/AGENTS.md on 2026-08-13. AGENTS.md remains the
     canonical copy of this content; see "Cross-tool canon" there. -->

### Inline content editing (`js/inline-content-edit*.js`)

Click-to-edit directly on the rendered mockup — every text field a reviewer
can see except cards: the title, summary and primary CTA, a section heading,
paragraph, bullet, table cell or callout, a step's title, text, bullets and
callout, and the What-to-know, Spotlight and Contact blocks — with the mockup
re-rendering immediately and the edit persisting through the same
browser-first `localStorage` review-state model every other field in this
tool uses. `pages/*.js` is never touched; this is a review aid, same as
every other review/UX layer. Three files, mirroring the AI-assist split:
`js/editing/inline-content-edit-render.js` (widget markup — inputs, textareas,
add/remove/reset controls, the Edited badge), `js/editing/inline-content-edit-data.js`
(pure `section_edits` diff/reapply, no DOM, dual-exported like
`js/review-merge.js`), and `js/editing/inline-content-edit.js` (the orchestrator —
delegated click handling, the open/commit/cancel widget lifecycle, and
wiring into the existing autosave path).

- **Scope is one list, in one place: `EDITABLE_FIELD_SHAPES` in
  `js/editing/inline-content-edit-data.js`.** It covers a page's title, summary and
  primary CTA; a section's heading, paragraphs, bullets, table and callout; a
  step's title, text, bullets and callout; and the page-level `whatToKnow`,
  `spotlight` and `contact` blocks. Each entry declares the value shape its
  stored `section_edits` entry takes — `string`, `textArray`, `stringArray` or
  `table` — and `tests/inline-content-edit-data.test.js` asserts the whole list
  by value, so widening scope is a deliberate edit to a list rather than a
  regex loosened in passing. Add/remove is still supported on exactly two
  fields — section `paragraphs` and `bullets` — and only of individual items,
  never whole sections/cards/steps, and never reordering.
- **A field stamped `data-rewrite-field` but absent from that list is the worst
  state to be in, and it was live.** `js/page-render.js` has stamped
  `sections.N.steps.M.text.K` since the AI-rewrite work, while
  `computeSectionEdits` only ever diffed `heading`/`paragraphs`/`bullets` — so
  a step paragraph opened an editor, accepted the edit, re-rendered with it,
  and lost it on the next load, with nothing erroring and no test failing.
  Whenever a renderer starts stamping a new path, the same path has to enter
  `EDITABLE_FIELD_SHAPES`, or the affordance is a promise the storage layer
  does not keep.
- **Two kinds exist only because of how their renderer prints them.** A
  `stringArray` item (a contact phone number) and a `table` cell are escaped
  and printed directly, so the tagged
  `{text, unverified, unverifiedReason}` object every body-copy item commits
  would render as the literal "[object Object]" there. Conversely
  `spotlight.paragraphs` renders through `paragraphList()`, so it takes the
  tagged form and shows the Unverified pill like any other body copy — even
  though `build_scripts/schema.js` types the AUTHORED field as `string[]`,
  which constrains `pages/*.js`, not a reviewer's stored edit.
- **A committed item is merged into what was there, never substituted for
  it.** A `whatToKnow` entry is `{label, text}`, and `renderWhatToKnow()`
  prints that label as the entry's own H3 subheading. Writing the tagged object
  wholesale deleted the label — the heading vanished from the mockup the moment
  a reviewer edited the paragraph under it. `writeScalarValue` spreads the
  existing object, and it is now the ONLY write path: `EditorSession.commit()`
  used to call `setByPath` directly for item field types, which is exactly how
  it bypassed the merge.
- **Editable only where there is a field to write back to.**
  `resolveWhatToKnow()`/`resolveContact()` synthesize a default box for a
  Transaction or Information page that authored none, and that copy lives in
  the renderer rather than on the page object — so those two renderers stamp
  their paths only when the data really came from `page.whatToKnow`/
  `page.contact`. An edit to a synthesized box would address a parent that does
  not exist, `setByPath` would find nothing to write into, and the reviewer's
  change would vanish on the next load.
- **Three markup details are load-bearing, because `EditorSession.open()`
  mounts by replacing its target with a `<div>` holder.** A table cell's path
  sits on a `<span>` inside the `<td>`, never on the `<td>` (replacing the cell
  tears the row apart); contact entries render one `<p>` each rather than one
  `<p>` of `<br>`-separated values (a `<div>` inside a `<p>` is invalid, and an
  entry needs its own element to carry its own path); and a callout's body is
  wrapped in a `<span>` inside the `<aside>` rather than promoted to a `<p>`,
  which would add block spacing the callout never had.
- **`markdownText` is the field type that splits "commits a plain string" from
  "carries markdown".** A callout body and a table cell are bare strings in the
  schema but go through `formatMarkdown()` on the page, so editing them as
  plain text would show the reviewer raw `[label](target)` source and drop the
  link tool from the toolbar; editing them as items would commit the tagged
  object their renderers cannot print.
- **Card descriptions carry no `data-rewrite-field`, and cards' absence from
  that scope list is load-bearing rather than incidental — it must stay true.**
  An inheriting card's description IS the destination page's `summary` (see
  "Card descriptions are inherited, not printed"), so the editable text lives on
  a different page entirely. An inline edit here would address the card's own
  `text` — the field that renders nowhere — and would appear to work, autosave,
  and then vanish on the next paint, because the paint reads the destination's
  summary. A `title-only` card has no description to edit at all. The summary a
  reviewer actually wants to change is already inline-editable where it lives,
  so keep cards out of scope; the missing attribute is the whole enforcement —
  do not "complete" the feature by adding it. The decision is restated at its
  site in `js/page-render.js`, immediately above `renderCards`.
- **Every renderer that builds its own heading has to stamp
  `data-rewrite-field` itself, and five of them silently did not.** Only
  `renderSection()` reads `__sectionIndex`, so any section shape rendered
  through a different function — `renderSpotlightSection()`,
  `renderTopFacts()`, `renderCustomSection()` (a `flat` Supporting section),
  `renderServiceGroup()` (a Services/Resources H3 sub-group) and
  `renderAccordionSection()` — produced a heading with no click-to-edit
  affordance at all. Nothing errored and no test failed: the section rendered
  correctly, it just quietly could not be edited, on Topic, Agency, Campaign
  and Transaction pages alike. That is the failure mode to watch for when
  adding a sixth heading renderer; `tests/page-render.test.js`'s
  `data-rewrite-field annotation` block now pins one case per renderer.
- **The accordion's toggle and heading are separate sibling elements, and
  that is a deliberate deviation from the standard ARIA accordion pattern.**
  The heading text used to sit inside the `<button data-accordion-toggle>`
  itself, which made it the one heading that could not simply be annotated in
  place: `EditorSession.open()` mounts the editor via
  `target.replaceWith(holder)` and that holder is a `<div>`, so annotating it
  there would have dropped a block-level Editor.js instance inside a native
  button (invalid content model, unreliable focus/caret) **and** handed one
  click to two listeners — the document-level toggle in `js/page-render.js`
  and the `#mockPage` editor handler, neither of which calls
  `stopPropagation()`. The panel would open while the heading flipped into an
  edit box. So a chevron button owns the toggle and a sibling `<h3>` owns the
  text. Two consequences worth keeping: the chevron is sized 44x44 in
  `css/styles.css` because it is now the only way to expand the panel (the old
  trigger spanned the whole row, so target size was never a question), and its
  accessible name is restated with `aria-label` since it has no text of its
  own — the old button took its name from the heading text it contained.
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
  (`js/editing/inline-content-edit-data.js`) recomputes it from scratch on every
  autosave by diffing the live page object's `heading`/`paragraphs`/`bullets`
  against `window.ORIGINAL_DATA`, the same "read live state fresh every
  save" approach `edited_title` has always used — not an accumulated diff
  that a delete or a manual reset would have to separately reconcile. This is
  what makes "reset to original" correct by construction: once a field
  matches `ORIGINAL_DATA` again, the next `computeSectionEdits()` call simply
  omits its path from the map, with no deletion logic required anywhere.
- **Reapply reports rather than renders, and the caller owns the one
  follow-up paint.** `applyContentEditsToPageData()` — called once, from
  `applySavedPageState()` in `js/ux-improvements-state-sync.js`, alongside
  the pre-existing `updateMockupTextFromSavedState()` call — replays
  `section_edits` back onto the in-memory page object on every
  load/navigation/sync-pull/conflict-resolution path (all of which already
  funnel through that one function). It deliberately does NOT touch
  `edited_title`/`edited_summary`/`primary_cta` — those are
  `updateMockupTextFromSavedState()`'s job, and reapplying them twice would
  race two functions writing the same fields on every load. It also does not
  re-render: staying DOM-free is why it's dual-exported and Bun-importable
  with no browser, same as `js/review-merge.js`, so it returns a boolean —
  whether it actually wrote a path via `setByPath` — rather than reaching for
  `window.renderPage` itself. **That boolean exists because the obvious
  alternative (re-render unconditionally whenever reapply runs) is a live
  infinite loop, not a hypothetical one.** `window.renderPage` is already
  `js/ux-improvements.js`'s wrapper by the time `applySavedPageState` can
  run, so a follow-up render re-enters that wrapper, which schedules its own
  deferred `applySavedPageState` call for the same page — which would see
  the same still-true "wrote something" signal and trigger a second render,
  forever (disabling the guard that prevents this produced 17 renders before
  a test's own teardown interrupted it). The fix is the boolean plus a
  `refreshInFlightForKey` re-entrancy guard in
  `js/ux-improvements-state-sync.js`: at most one follow-up render per
  reapply, and the guard clears at the top of the very next
  `applySavedPageState` call for that key rather than immediately after the
  synchronous `renderPage()` call returns, since the reapply it's guarding
  against happens asynchronously (a View Transition or `setTimeout(0)`). The
  original design spec's persistence section did not anticipate this render
  lag at all — it assumed reapplying the data was sufficient — so this
  mechanism is a real fix discovered during implementation, not a restatement
  of the design.
- **No history entry per edit, same rule as every other keystroke-level
  field.** Every commit — a scalar edit, an add, a remove, a reset — folds
  into the existing debounced autosave (`saveCurrentPageToLocalStorage`),
  never `mergeReviewRecord`. The mockup re-renders immediately regardless;
  only the _recorded review round_ stays untouched.
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
- **Clicking a link inside an editable field opens the editor, and never
  navigates.** A `[data-rewrite-field]` element can contain a real
  navigating `<a href>` — the hero CTA when it renders as a link rather than
  an internal-target `<button>`, and any inline citation link
  `formatMarkdown()` turns a `[label](https://...)` markdown reference into,
  directly inside the paragraph/bullet text it belongs to. Without a guard,
  a click on either kind of link both opened the field's editor (the
  delegated click bubbling to the ancestor `[data-rewrite-field]`) **and**
  navigated in a new tab at once. `handleMockPageClick()` calls
  `event.preventDefault()` whenever the click target is inside a
  navigating anchor, scoped to that condition rather than a blanket
  `preventDefault()` on every click (which could interfere with normal
  focus/selection once the editor widget itself is open) — editing takes
  priority over leaving the review tool while the reviewer is trying to
  edit the very field the link sits in.
- **Per-field "Reset to original" is new, not a mirror of an existing
  pattern.** The only prior precedent is `restorePageContentFromOriginal()`
  (`js/sync/review-state-sync.js`), and it's whole-page (title, summary, SEO
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
  reconstructable history the review state doesn't have. **Undo is scoped to
  the page it happened on, not carried across navigation:** the undo callback
  resolves "which page" via `getCurrentKey()` at click time, and no-ops if
  the reviewer has since navigated away — restoring onto the captured page
  object but persisting under whatever page is now current would silently
  corrupt that other page's save, and navigating back later would reapply
  the original page's still-stale saved `section_edits`, silently
  re-removing the item the reviewer thought they'd undone.
- **Emptying a list doesn't strand it.** `decorateListControls()` originally
  discovered "+ Add" anchor points only by walking already-rendered list
  items, so a `paragraphs`/`bullets` array reduced to zero items (via remove,
  or authored empty) rendered nothing and never regained an add control — a
  one-way door. It now also walks the live page's section arrays directly,
  anchoring the control to the section's heading (always present, per the
  schema) when there are no items left to anchor near.
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
