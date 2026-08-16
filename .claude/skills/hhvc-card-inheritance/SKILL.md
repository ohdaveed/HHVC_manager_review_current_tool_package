---
name: hhvc-card-inheritance
description: 'HHVC repo: why a card description is inherited from its destination page rather than printed from `card.text` — the three buckets (`inherits`/`title-only`/`authored`) and why they key on the section `karl` note rather than `section.component`, why `js/card-inheritance.js` is dual-exported, why `bun run audit-cards` is a report rather than a CI gate, and the sf.gov census that settled external-URL entries. Load before editing js/page-render.js`s card rendering, js/card-inheritance.js, or build_scripts/audit-card-inheritance.js.'
---

<!-- Extracted from CLAUDE.md/AGENTS.md on 2026-08-15. AGENTS.md remains the
     canonical copy of this content; see "Cross-tool canon" there. -->

# Card descriptions are inherited, not printed

A Karl Services/Resources subsection entry — and a Related-panel entry, and a
Resource Collection's Resource-section entry — is only a page picker: "add an
SF.gov page or External link". It carries no label field, so its title always
publishes as the **destination** page's own title; only the Agency
Services/Resources subsection also lacks a description field, so only that
bucket additionally publishes the destination's summary — a Related panel and
a Resource Collection's Resource section render a title and a link and
**nothing else** (see the three-bucket breakdown below). A card in
`pages/*.js` carrying its own `text` was therefore showing reviewers copy that
can never appear on SF.gov, which matters more here than in
most codebases because approving that copy is the entire point of the tool —
and the inline-content-editing feature then made those dead fields
click-to-edit.

`js/page-render.js` therefore resolves **every** card description through one
helper, `cardDescription(section, card)`, instead of printing `card.text`.
Syncing the two duplicated strings was the other option and was rejected: they
drift again on the next edit to either side, whereas inheritance leaves them
unable to disagree at all. An empty resolved description renders no element,
not an empty one — a blank `<p>` still occupies its row and reads as copy that
failed to load.

- **There are three buckets, and they key on the section's `karl` note — NOT
  on `section.component`.** `inherits` (an Agency Services/Resources
  subsection) renders the destination's title AND summary. `title-only` (a
  Related panel, a Resource Collection's Resource section) renders a title and
  a link and **nothing else**, each verified separately at DOM level against
  live pages on 2026-08-08 — the editor help center contradicts itself on this,
  so do not re-widen it from the docs alone. `authored` (a Table block, a
  Title-and-text block) writes its own words and is left untouched. The first
  version of the classifier keyed on `component` and would have corrupted table
  blocks and title-and-text blocks: 74 of its 98 findings sat in sections
  carrying no `component` at all, and those were not one kind of thing
  (`article11Guide`'s "Mold and lead hazards" is a table). The `karl` note
  names the Karl block a section maps to, so it is the real authority. That
  history is written up in `build_scripts/audit-card-inheritance.js`'s header;
  read it there rather than re-deriving it.
- **`js/card-inheritance.js` is dual-exported for the same reason
  `js/review-merge.js` is.** `js/page-render.js` reads it off
  `window.cardInheritance` (side-effect-importing the file so the module graph
  guarantees it) and `build_scripts/audit-card-inheritance.js` `require`s it,
  so the browser renderer and the Node audit share exactly one classifier and
  cannot come to disagree about what inherits. A second copy of those regexes
  would let the mockup show one thing while the audit asserted another, and the
  drift would stay invisible until a reviewer approved copy that cannot ship.
- **`bun run audit-cards` is a report, not a CI gate**, and exits 0 even with
  findings on purpose. A title mismatch is safe to sync mechanically; a
  description is a content judgement per card, and the right direction of the
  fix is sometimes the destination page rather than the card.
- **An external-URL entry inside an inheriting subsection keeps its own
  authored text — measured, not assumed.** There is no destination page to
  inherit from, so this was an open question the audit reported and refused to
  assert on. It was settled on 2026-08-09 by a census of all 332
  `departments--*` pages in `sf.gov/sitemap.xml`: **333 of the 363** entries
  whose `href` leaves sf.gov render a description of their own (the 30 that do
  not match the shape of an editor leaving the field blank, the same way 90
  SF.gov entries render none because their destination has no summary). An
  external entry therefore HAS a description field, authored on the entry
  rather than inherited, and `js/page-render.js` printing `card.text` for one
  is correct — so the audit counts them and reports no finding. **Two details
  of that census are load-bearing, because a repeat that misses either gets a
  different answer.** `api.sf.gov`/`media.api.sf.gov` hosts were counted
  separately (69 with a description to 29 without): those are SF.gov's own
  document store, so such an entry is a **Document Picker** upload reading its
  text off the Document object — a third mechanism, and folding it in answers a
  different question with the same number. And each anchor was matched to its
  own closing `</a>` before its description was read, since attributing a
  neighbour's description to an entry is how a sweep like this quietly confirms
  whatever it set out to find. External entries in a `title-only` section are
  the opposite case and needed their own evidence: that component renders no
  description for **any** entry, which is a fact about the component rather
  than about the destination, so those report as dead text and were deleted.
  Full write-up in
  `docs/source/hhvc-policy/2026-08-08-karl-card-inheritance-verification.md`.
