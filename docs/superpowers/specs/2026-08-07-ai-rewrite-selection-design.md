# Design: selection-driven AI rewrite on the mockups

## Problem

A reviewer reading a mockup can already see that a paragraph is too long, too jargon-heavy,
or off the ~Grade 6 target this tool scores every page against — but there is nothing on the
page to act on it with. The existing AI assist panel (`js/ai-assist.js`, a collapsed section
at the end of the Help tab) generates an entire **new page draft** from a free-text prompt
and hands back a downloadable `pages/*.js` module. That is the right tool for authoring a
page and the wrong one for fixing one sentence: it asks the reviewer to leave the mockup,
describe from memory what they were looking at, and then reconcile a whole generated page
against the one already on screen.

This design adds the missing motion: highlight the text, click a button that appears next to
it, get a rewrite grounded in this repo's own content standards, and apply it in place —
without leaving the page under review.

## Goals

- A reviewer selects text anywhere in the mockup's body copy and gets a one-click rewrite,
  positioned at the selection rather than in a distant panel.
- The rewrite is reviewed before it lands: original and suggestion shown together, applied
  only on an explicit **Apply**, never automatically.
- An applied rewrite is **visibly marked as unverified in the mockup**, using the schema's
  existing `unverified`/`unverifiedReason` mechanism rather than a new AI-specific flag, so a
  reviewer scanning the page later can tell AI-touched copy from human-authored copy.
- Optional steering: an empty instruction box means "bring this in line with our content
  standards"; a filled one means whatever the reviewer typed.
- Same posture as every other AI-touching piece of this tool: entirely additive, invisible
  unless the optional AI backend is configured, and it never writes to `pages/*.js` on disk.

## Non-goals

- **Not editing `pages/*.js` source files.** Apply mutates the in-memory `pageData` object
  only, exactly as the existing sidebar title/summary/CTA editors already do, and persists
  through the same `localStorage` review-state path. Getting an applied rewrite into the
  repository is still a human writing it into `pages/*.js` by hand. Every review/UX layer in
  this tool is bound by this rule and this feature is not the exception.
- **Not splicing the exact selected substring.** Per an explicit design decision, the
  selection identifies *which field* to rewrite; the whole field is sent and the whole field
  is replaced. See "Why whole-field, not substring" below — this is the single most
  consequential simplification in the design.
- **Not covering every text-bearing field in v1.** Paragraphs, bullets, and step text only.
  Cards, table cells, callouts, and `whatToKnow` items are deliberately deferred; the
  title/summary/CTA/SEO fields already have dedicated editable inputs in the sidebar editor
  panel and need no selection affordance at all.
- **Not a general task-dispatch refactor of the AI backend.** This design adds the *minimum*
  dispatch needed for a second task (see "Backend" below) rather than building the full
  `TASKS` registry the separate RAG/compliance-audit design proposes. That design's registry
  subsumes this one cleanly when it lands; neither blocks the other.
- **Not a rewrite history or multi-suggestion UI.** One suggestion at a time, Apply or
  Discard. A reviewer who wants a different result re-runs it.

## Architecture

### Field addressing: the crux of the feature

Nothing in `js/page-render.js` today ties a rendered DOM node back to the page-data field it
came from. Every rewritable text item therefore needs a stable address emitted into the
markup at render time, and the address has to survive two properties of the current renderer
that are easy to get wrong:

- **`formatMarkdown()` means rendered text ≠ source text.** It escapes HTML, converts
  `**bold**` to `<strong>`, and turns `[label](target)` into an `<a>` or a nav `<button>`.
  Reading the selected text back out of the DOM would hand the model rendered output and,
  worse, apply a rewrite that has lost the markdown. **The field's text is always read from
  the page-data object at its path, never from `textContent`.**
- **`partitionSections()` reorders sections.** It walks `page.sections` and redistributes
  each section into one of seven role buckets (`intro`, `services`, `resources`, `related`,
  `whatToDo`, `supporting`, `body`) which are then rendered in a fixed layout order. **A
  section's index in the rendered output is not its index in `page.sections`**, so an address
  computed from render order would apply a rewrite to a different section than the reviewer
  highlighted — silently, and most often on exactly the mixed-role pages where it matters.
  The original index is captured during the partition loop and travels with the section from
  that point on.

The address is a dot-path string in a `data-rewrite-field` attribute, rooted at the page
object and always using the **original** `page.sections` index:

```
sections.2.paragraphs.1          a paragraph in the third section
sections.2.bullets.0             a bullet in the same section
sections.4.steps.1.text.0        a step's paragraph text
sections.4.steps.1.bullets.2     a step's bullet
```

**Annotation is opt-in per call site, not automatic inside the renderers.** `paragraphList()`
and `bulletList()` currently take only an array, and `renderTextItems()` dispatches to one or
the other by length — and it is also used to render `whatToKnow.thingItems`, which is out of
scope here. Each gains an optional path-prefix parameter; a call site that passes nothing
emits no attribute and is simply not rewritable. That keeps the v1 scope boundary in the
call sites rather than in a conditional inside the renderer, and makes adding cards or
callouts later a matter of passing a prefix at one more call site.

A small pure helper — `getByPath(page, path)` / `setByPath(page, path, value)` in
`js/utils.js`, alongside the other cross-cutting helpers — resolves a path against a page
object. Pure functions with no DOM dependency, so they are unit-testable directly.

### Why whole-field, not substring

Given a selection, the feature could rewrite either the exact highlighted characters or the
whole paragraph/bullet containing them. Whole-field wins on three counts, and the reasoning
is worth recording because "just replace what they highlighted" is the more obvious choice:

- **Character offsets into rendered HTML do not map back to source text.** Because of
  `formatMarkdown()`, a selection that visually covers "call **311**" spans a `<strong>` in
  the DOM but sits at different offsets in the source string. Mapping a DOM `Range` back to
  an offset in the pre-render markdown is a parser, not a helper.
- **Selections cross structural boundaries.** A drag that starts in a paragraph and ends in
  the next bullet has no single containing field, and no coherent "replace this" semantics.
  Whole-field addressing gives that case an obvious behaviour: the button appears for the
  field the selection *starts* in, and the popover shows exactly what will be replaced, so
  what the reviewer is about to change is never ambiguous.
- **It matches how this tool already edits.** Title, summary, CTA and the SEO fields are all
  edited as whole values through `getValue`/`setValue`, not spliced. A second, finer-grained
  edit model would be a new concept to hold.

The cost is honest and worth stating: rewriting one sentence of a five-sentence paragraph
means the model sees and may reword all five. The popover mitigates it by showing the full
field text before the request is sent, so the scope of the change is visible before it
happens rather than after.

### Selection detection and the floating button — `js/ai-rewrite.js`

A new self-mounting IIFE subsystem, matching the `ai-assist` / `review-queue` split this
codebase already uses. `js/ai-rewrite.js` is the orchestrator (selection listener, request
lifecycle, apply/discard); `js/ai-rewrite-render.js` owns the floating button and popover
markup and positioning. Both attach to an internal `window.AiRewrite` namespace, and the
orchestrator publishes the public surface on `window.aiRewrite`.

- A `selectionchange` listener (debounced through the existing `debounce` helper in
  `js/utils.js`) reads `window.getSelection()`, ignores collapsed selections, and walks up
  from `anchorNode` for the nearest `[data-rewrite-field]` ancestor inside `#mockPage`.
- Found → position the button off `range.getBoundingClientRect()` and show it. Not found, or
  selection collapsed, or selection outside `#mockPage` → hide it. Selections that begin
  inside a rewritable field and run past its end still resolve to that field, per the
  boundary rule above.
- **The button is not rendered at all unless the AI backend is configured.** It gates on the
  same `capabilities` check the existing panel uses, so a Netlify/static deploy — which has
  no server runtime for `/api/ai/*` — shows no affordance rather than a button that always
  fails. Mirrors how the existing panel handles the same deployment.

### The popover

Opened by the button, positioned against the same rect. Contents:

- The **full text of the containing field**, read-only, so the reviewer sees exactly what
  will be replaced rather than only what they highlighted.
- An **optional instruction** input, empty by default. Empty means the request carries no
  instruction and the server applies its standing one (below).
- **Rewrite** / **Cancel**, then after a response: original and suggestion shown together
  with **Apply** and **Discard**.

Rendering rule inherited from `js/ai-assist-render.js`: model output is text nobody in this
repo wrote, so everything is escaped before it reaches `innerHTML`.

### Backend: a second task on `/api/ai/generate`

`generateContent()` in `build_scripts/ai/index.js` is hardcoded to one task today — it always
builds a content prompt, always sends `PAGE_OUTPUT_SCHEMA`, and always runs
`validateGeneratedPage()`, which expects a whole HHVC page object. A rewrite result would
fail that validator, and `generateRequestSchema` (`task: z.enum(['content'])`, `prompt`
required and non-empty) rejects any other task before the route body runs. So this feature
needs real dispatch, kept as small as it can be:

- **`generateRewrite()`** — a sibling function to `generateContent()`, not a generalization
  of it. Its own prompt builder, its own JSON schema (`REWRITE_OUTPUT_SCHEMA`), its own
  validator. `generateContent()` is left untouched, so the `content` task carries no
  regression risk from this work.
- **`generateRequestSchema` becomes a discriminated union on `task`**, since the two tasks
  genuinely differ in shape: `content` requires `prompt`; `rewrite-field` requires
  `fieldText` and takes an optional `instruction` and the `page` for context. A single object
  schema cannot express "prompt required here, absent there" without making `prompt` optional
  for both and losing the existing guarantee.
- **The standing instruction lives in the system prompt**, not the client. It states the
  house rules this repo already enforces elsewhere — plain language, ~Grade 6, tenant-facing,
  preserve meaning, preserve any markdown links, return prose only. Keeping it server-side
  keeps it byte-stable for prompt caching, per the existing `prompts.js` rule, and means the
  standard cannot drift between what the panel sends and what the checks score.
- **Validation is narrow but real:** non-empty result, no HTML tags introduced, and every
  `[label](target)` link present in the input still present in the output. A rewrite that
  silently drops a link to a real page is a content regression the reviewer would have to
  catch by eye. Failures feed the existing one-retry-with-issues loop the `content` task
  already uses.
- The response carries the same mandatory `disclosure` string every other successful
  generation does, plus the resolved `provider`/`model` so the popover can attribute it.

`js/ai-assist-client.js`'s `generate()` currently always sends `prompt` in the body. It gains
a task-conditional body so `rewrite-field` sends `fieldText`/`instruction` instead — an empty
`prompt` string would fail `min(1)` identically to a missing one.

### Apply

1. `setByPath()` writes the new value at the field's path in the in-memory page data.
2. The value is written as `{text, unverified: true, unverifiedReason: 'AI-rewritten draft —
   verify before publishing'}` — the object form the text-bearing arrays already accept
   (`normalizeTextItem()` handles string-or-object today), so the mockup renders the existing
   "Unverified" pill with that reason as its tooltip, with no renderer change.
3. The page re-renders through `window.renderPage`, and the change persists through the same
   autosave path the sidebar editors use — which deliberately does **not** append a `history[]`
   round, matching how every other continuous edit in this tool behaves.
4. **Undo is one step and consumed on use:** the pre-apply value is kept in memory and the
   popover offers **Undo** immediately after applying, which restores that value and clears
   itself. Navigating to another page drops it — this is a lightweight correction
   affordance, not a general undo stack. The review queue's own one-step undo
   (`js/review-queue-undo.js`) is the precedent for keeping it deliberately shallow rather
   than implying a history the state cannot reconstruct.

### Error handling

Same posture as the existing panel, because the same failure modes apply: request failures
show inline in the popover with a Retry; in-flight requests are abortable via `AbortController`
and Cancel; a 400 (stale provider selection) triggers a capabilities refresh, exactly as
`handleGenerate()` already does. A failed rewrite never mutates page data — Apply is the only
write path, and it only exists once a result has arrived.

## Testing

- **`tests/utils.test.js`** (existing, extended) — `getByPath`/`setByPath` against nested
  section/step paths, including a path that does not resolve (must not throw, must not
  create intermediate objects).
- **`tests/page-render.test.js`** (existing, extended) — `data-rewrite-field` paths are
  emitted on paragraphs, bullets and step text; the path uses the **original**
  `page.sections` index on a page whose sections `partitionSections()` reorders (the
  regression this design's hardest constraint exists to prevent); no attribute is emitted at
  call sites that pass no prefix (e.g. `whatToKnow`). The escaping assertions this file
  already makes per render function extend to the new attribute.
- **`tests/ai-assist-schema.test.js`** (existing, extended) — the discriminated request
  schema: a `content` request without `prompt` still fails, a `rewrite-field` request without
  `fieldText` fails, `REWRITE_OUTPUT_SCHEMA` matches what the validator expects.
- **`tests/ai-assist-server.test.js`** (existing, extended) — a `rewrite-field` describe block
  against the existing stub-provider harness: a normal rewrite, a stub response that drops a
  markdown link (asserts the retry-with-named-issue path fires), and the 501 gate when no
  provider is configured. No API key, no paid call, same as every other AI backend test here.
- **`tests/e2e/ai-rewrite.spec.js`** (new) — UI-driven, mirroring `tests/e2e/ai-assist.spec.js`'s
  stub-server pattern: selecting text in a paragraph reveals the button; the popover shows the
  whole field rather than the selection; Apply mutates the mockup and renders the Unverified
  pill; Discard leaves the copy untouched; no button appears when the backend is unconfigured.
- Both new/extended test files must be named in `package.json`'s explicit `test` script list —
  this repo enumerates its tests rather than globbing, so a file not named there runs only by
  hand and covers nothing in CI.

## Docs

- New CLAUDE.md section, "AI rewrite (optional)", alongside the existing "AI assist backend
  (optional)" section and in the same voice: additive, off unless configured, never writes to
  `pages/*.js`, and the whole-field/original-index constraints recorded as the non-obvious
  facts they are.
- AGENTS.md gets the same section per this repo's cross-tool-canon rule;
  `.github/copilot-instructions.md` stays a pointer with no new summary.
- The seven-stylesheet table in both files gains an eighth row, `css/ai-rewrite.css`. The
  floating button and popover get their own sheet rather than extending `css/ai-assist.css`,
  per this repo's "a selector should be declared in exactly one file" rule and the existing
  one-sheet-per-subsystem pattern (`css/review-insights.css`, `css/review-ops.css`). It is
  imported from `js/main.js` before `css/theme.css`, which must stay last.
