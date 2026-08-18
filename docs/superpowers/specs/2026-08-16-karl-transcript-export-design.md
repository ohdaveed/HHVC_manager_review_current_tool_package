# Karl transcript export — design

**Date:** 2026-08-16
**Status:** approved design, not yet implemented
**Supersedes:** items 1–3 of the rebuild-adoption plan (see "How this replaces the earlier plan")

## Why

The tool is being kept as a longer-lived SF.gov content-review instrument rather
than retired when HHVC manager review finishes. The first capability it has to
carry and cannot today is a **round-trip to Karl** — approved copy reaching the
CMS instead of dead-ending in a review CSV.

That round-trip is scoped deliberately at its second-smallest rung: a
**paste-ready transcript per page**, listing field by field what an editor types
into Karl, in the order Karl's own form presents. A human performs every
keystroke. There are no API writes, no credentials in the tool, and no
publishing path.

That scope matters for more than effort. The standing rule in `AGENTS.md` — the
review layers must never write back to `pages/*.js` or publish content, and
exports are never automatic publication approval — **survives intact**. A
transcript is an export. It changes what the export contains, not what it
authorizes.

## What makes this tractable

Two facts, both measured rather than assumed:

**1. The mapping already exists, per content type, in parseable tables.**
`docs/karl-export-field-map.md` carries one table per type in use, and its
columns are exactly the exporter's inputs — UI label, raw Wagtail name,
required, repeatable, block types, and a **Mockup source** column already naming
the mockup path:

| Panel (UI label)         | Raw name                 | Repeatable | Mockup source                                   |
| ------------------------ | ------------------------ | ---------- | ----------------------------------------------- |
| What to Do               | `what_to_do`             | repeatable | `sections[].steps[]`                            |
| ↳ Section specifics      | `section_specifics`      | repeatable | `step.text[]`/`bullets[]` → `Text`              |
| Accordion title and text | `supporting_information` | repeatable | `section` with `component: 'supporting'`        |

The 279 free-prose `karl` notes on the page data are therefore **not** the
primary source. They stay as per-section rationale and exception flags.

**2. The two address spaces already agree.** `EDITABLE_FIELD_SHAPES` in
`js/inline-content-edit-data.js` keys the reviewer's edit overlay by dotted
paths (`whatToKnow.cost`, `sections.0.steps.0.text`) — the same vocabulary the
field map's Mockup source column writes. No new addressing scheme is needed.
The export is a join over an address space both sides already use.

## Architecture

Everything new follows the repo's dual-export idiom (`window.X` plus
`module.exports`, no DOM dependency) so Node and the browser share exactly one
implementation, for the same reason `js/review-merge.js` and
`js/standards/plain-language.js` do.

### New files

- **`build_scripts/karl-blocks.js`** — the eight in-use types' panel
  inventories, transcribed from the field map. One row per panel:
  `{ uiLabel, rawName, order, required, repeatable, blockTypes[], source, docLine }`.

  The field map's **footnotes become explicit flags**, because they are half the
  mapping and none of them are in the tables: `calloutHasNoTitle: true`,
  `costDescriptionMaxChars: 120`, `bulletsFoldIntoText: true`. `docLine` cites
  the field map row each entry came from.

- **`build_scripts/karl-transcript.js`** — pure:
  `(page, reviewRecord, blocks) → transcript`. No filesystem, no DOM. Every
  judgement call about what an editor is told lives here, and only here.

- **`build_scripts/export-karl-transcript.js`** — thin CLI, wired as
  `bun run export:karl`. Writes `review/karl-transcripts/<pageKey>.md`.

- **A workspace button** rendering the same transcript for the open page,
  reading `window.karlTranscript`.

### Changed files

- **`build_scripts/schema.js`** — `type` narrows from open `z.string()` to a
  union of the eight values in use (`Transaction`, `Information`,
  `Resource Collection`, `Campaign`, `Topic`, `Agency`, `About us`, `Report`).
  This was a nice-to-have in the earlier plan and is now a **requirement**: the
  panel inventory is keyed on `type`, so a typo'd value would silently produce
  an empty transcript rather than an error.

- **`build_scripts/data-checks.js`** — one new pure function,
  `findUnmappedSections`, joining the existing family (`findBrokenInlineLinks`,
  `findUnsafeUrls`, `findListFormatViolations`, `findExternalAssetUrls`).

- **`package.json`** — the `export:karl` script, and every new test file named
  in the `test` script.

## Data flow

`build_scripts/load-pages.js` loads the corpus → select the panel inventory by
`page.type` → walk panels in Karl's own form order → resolve each panel's
`source` path → apply the reviewer overlay → classify → emit.

**Overlay precedence is the point of the feature:** `section_edits[path]` if the
reviewer edited it, else `edited_title` / `edited_summary`, else the original
`pages/*.js` value. An editor must be typing approved copy, never the draft it
superseded.

### Four outcomes, kept distinct

Every panel resolves to exactly one. Keeping them separate is what makes the
transcript safe to follow.

- **TYPE** — an authored value the editor types.
- **CHOOSE** — a page-chooser reference. The editor picks a page and types
  nothing.
- **UNMAPPED** — no documented Karl destination. Emitted loudly, never guessed.
- **FLAG** — a value with a known problem to resolve before saving.

### Hard cases

Each is already settled somewhere in the repo; none is being re-decided here.

1. **Card inheritance decides TYPE vs CHOOSE.** `inherits` and `title-only`
   cards are pickers, so the transcript says *choose page X* and never *type
   this description*. Emitting a description for a picker is the exact defect
   `js/card-inheritance.js` exists to prevent — and here it would become an
   instruction a human executes. The classifier is reused, never re-derived.
2. **External-URL entries inside an inheriting subsection stay TYPE.** They
   carry their own authored description, settled by the 332-page census of
   `departments--*` pages. The classifier already handles it.
3. **Bullets fold into the `Text` block's rich text**, not a separate block.
   `paragraphs` and `bullets` merge into one value in document order.
4. **Inline `[label](pageKey)` links cannot be pasted.** Karl has five distinct
   link representations and an internal link is a chooser, so any paragraph
   containing one emits its links separately with the representation named.
   Otherwise the editor pastes a dead literal.
5. **`callout.title` has no home on Transaction (`U2`)** — FLAG, never silent
   folding. Folding it into the rich text as a bolded lead-in is a content
   judgement, and this tool does not make those.
6. **A section-level `button` outside any step (`U1`, 8 sections)** — UNMAPPED.
   Transaction's only `Button link` slot sits inside a `what_to_do` Section.
7. **`cost` description caps at 120 characters** — FLAG carrying the measured
   length when over.
8. **Approval is per page, not per field.** The review record has `decision` and
   no field-level approval, so the transcript prints the page's decision at the
   top and marks a not-Approved page throughout rather than exporting it as
   though it were signed off.

### Output

One markdown file per page under `review/karl-transcripts/`, headed by the Karl
navigation path (`New: Transaction → Content`) and the page's review decision,
then one section per panel in form order, each tagged TYPE / CHOOSE / UNMAPPED /
FLAG.

## Validation and error handling

**The drift guard is the load-bearing test.** `karl-blocks.js` is transcribed
from a 930-line prose document that keeps changing, and silent drift means an
editor is told to type into a field that no longer exists.
`tests/karl-blocks.test.js` parses the field map's per-type tables and asserts
every panel row still matches on `uiLabel`, `rawName`, `repeatable` and
`source`.

Parsing the document **in a test** is correct even though parsing it **in the
exporter** was rejected: a test that goes red on drift is a different thing from
a runtime that silently loses the footnotes.

**`bun run validate` gains a ratchet.** `findUnmappedSections` requires every
section to resolve to a panel or to be covered by a known exception. A *known*
unmapped section passes; a *new* one fails. That stops content being authored
with no Karl destination — the thing this tool exists to catch, now enforced
rather than noticed.

**The known exceptions are encoded as rules, not as a list of page keys.**
`karl-blocks.js` carries an `UNRESOLVED` table — one entry per register ID,
each naming the register ID, the shape it matches (for `U1`: a section carrying
`button`/`buttonUrl` outside any step, on a `Transaction`), and the field map
line documenting it. A path allowlist was rejected: it would let a *newly
authored* section inherit an old exemption just by landing at the same index,
which is exactly the case the ratchet exists to catch. Closing a register entry
upstream therefore means deleting its rule here, and the sections it covered
fail until they are mapped.

**Error handling:**

- Unknown page `type` → hard failure at validate. The schema union already
  prevents it; this is defence in depth.
- Missing overlay path → falls back to the original value, never throws.
- Page with no review record → transcript still generates, marked *no review
  recorded*.
- **The exporter never partially writes.** Build every transcript in memory and
  write only if all pages succeeded; a half-written directory is worse than
  none, because an editor cannot tell which files are stale.

## Testing

- **`tests/karl-blocks.test.js`** — the doc-drift guard above.
- **`tests/karl-transcript.test.js`** — pure units over **hand-built pages, not
  the real corpus**, for the reason `tests/card-inheritance.test.js` gives:
  driving from real content means a legitimately added page fails the suite.
  Covers each of the four outcomes, overlay precedence, a `title-only` card
  never emitting a description, bullets folding into the paragraph value, an
  inline link surfacing separately, and the 120-character cost flag.
- **Mutation-proven:** deliberately break the classifier reuse so `title-only`
  cards emit descriptions, and confirm the suite goes red. The card-inheritance
  suite was proven this way against three deliberate breakages.
- One e2e spec for the workspace button, following `tests/e2e/` conventions.
- **Every new test file is named in `package.json`'s `test` script.** It is an
  explicit list, not a glob, so an unlisted file passes locally and covers
  nothing in CI.

## Out of scope, deliberately

No API writes, no credentials, no publishing, no Wagtail draft creation. Those
are the next two rungs and each is a larger commitment; this rung is the one
that keeps approval exactly where it is today.

Also out of scope: **iframe isolation of `#mockPage`**. It was the strongest
idea in the rebuild proposal and does nothing for a CMS payload. It stays
available as separate work if the goal changes.

## How this replaces the earlier plan

The rebuild-adoption plan had three items. This design retires all three:

- **Item 1 — Hono middleware in `server.ts`:** attempted, measured against
  hono@4.13.2's installed source, and rejected. `body-limit` abandons the reader
  with no drain (reintroducing two fixed keep-alive framing bugs), `cors` never
  rejects a disallowed origin, and `secure-headers` disagrees with
  `netlify.toml` on three headers. Recorded in `server.ts` (commit `03809d8`).
- **Item 2 — schema-inferred page types:** absorbed here, promoted from
  optional to required, and narrowed to the one change that pays — the `type`
  union. The broader JSDoc/`checkJs` question is left open; it is not needed for
  this feature.
- **Item 3 — iframe isolation:** dropped from this plan, as above.
