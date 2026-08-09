# Karl card inheritance — what a page-picker card actually renders

**Verified 2026-08-08 against live SF.gov and the Karl editor help center.**
This settles a question the mockup had been guessing at, and the answer is not
uniform across components — which is the whole point of writing it down.

## The short version

A card in this mockup that points at another page (`card.target`) is, in Karl,
usually not an authored card at all. It is a **page picker**: the editor chooses
a destination and Karl renders that destination's own fields. So any title or
description typed into such a card is copy a reviewer will approve and a
visitor will never see.

But **which** fields Karl renders depends on the component, and there are two
different behaviours:

| Karl component | Renders destination Title | Renders destination Description |
| --- | --- | --- |
| **Related** (right panel / bottom of page) | Yes | **No** |
| **Agency → Services subsection** | Yes | Yes |
| **Agency → Resources subsection** | Yes | Yes |
| **Resource Collection → Resource section** | Yes | **No** |

## Related renders a title and a link. Nothing else.

**The live evidence:** <https://www.sf.gov/pay-your-annual-healthy-housing-fee-apartment-buildings>
(`<meta type="sf.Transaction">`), scraped 2026-08-08. Its Related section
contains exactly two entries:

```
## Related
[Report a health nuisance or hazards]
[Keeping your building free of vermin]
```

Checked at the DOM level, not just in flattened markdown: every entry's
container element holds the link text and no other text node. "Keeping your
building free of vermin" is an Information page that certainly has a
description of its own, and it does not appear.

**The editor docs contradict each other on this, and one of them is wrong.**
Anyone re-deriving this will hit the same conflict, so both readings are
recorded here:

- The **Related component** page says: "These pages will appear at the bottom
  of your page with a **title and link**." — correct.
- The **Transaction content type** page says: "The **title and description** of
  these pages will appear in the bar on the right side." — contradicted by the
  live Transaction page above. Do not trust this sentence.
- The **Information → Related** page is a stub that redirects to the component
  page, so Information inherits the correct "title and link" description.
- **Relational content** says tagging keeps "the link, title, and description"
  up to date. That is about what Karl *tracks*, not about what the Related
  panel *renders* — it is not evidence for a description appearing.

**Why the conflict is easy to fall for:** the Transaction page's wording is
more specific (it names the right-side bar), so it reads as the more
authoritative source. It is not. Prefer the live page over any doc sentence.

## Agency Services and Resources subsections render title AND description

Established earlier (repo commit `61b2e8e`) against the live Environmental
Health Agency page, whose card text is verbatim each destination's summary. A
subsection entry is only "add an SF.gov page or External link" — no label
field, no description field.

## Resource Collection "Resource section" renders title only — like Related

**Checked 2026-08-08 across three live `sf.ResourceCollection` pages**
(`vacancy-notice-local-agency-formation-commission`,
`best-communication-practice-guidelines`, `2025-exceptions-order-layoff`). No
Resource-section entry on any of them rendered an inherited description.

**The control that makes this decisive** rather than merely suggestive: the
vacancy-notice page has a standalone entry linking to the internal page
`bos-boards-commissions-and-task-forces-application-instruction`. That
destination has a title ("Application Instructions") AND a description ("San
Francisco is a diverse city with a wide range of people and issues affecting
it."). The rendered entry showed the title and nothing else. So the absence is
Karl declining to render a description, not a destination that had none to
give.

The first two pages could not settle it and are recorded so nobody re-runs
them expecting an answer: `2025-exceptions-order-layoff` holds only PDF
documents, whose in-entry "Published <date>" is Document metadata rather than
an inherited page description; `best-communication-practice-guidelines` has a
single internal page link that could not be distinguished from an inline
rich-text link in the body.

**This was assumed the other way first, and the assumption was chosen for
being conservative.** Grouping Resource section with the Agency subsections
kept card text visible rather than deleting it, which felt like the safe
default. It was the expensive one: it left 19 cards of dead copy in the mockup
and framed them as editorial decisions a reviewer would spend judgement on.
"Conservative" is not the same as "correct", and for this tool the safe default
is whatever matches what Karl publishes.

## What this means for the mockup

- **A Related card must carry a title and no text.** A blank `text` on a
  Related card is correct, not an omission to be filled in. Of the 22 pages,
  49 Related cards were already blank and are right as they stand.
- **A Related card carrying text is showing dead copy** — reviewer-facing
  words that cannot render. Twelve such cards existed on 2026-08-08, on
  `ipmEducation`, `recordsHub`, `mosquitoWorkshop`, and `ownerHub`.
- **Card titles still matter everywhere.** Both components render the
  destination's Title, so a card title differing from its destination is wrong
  in Related and in subsections alike. Repo commits `845ba34` (7 cards) and
  `09a74b7` (22 cards) synced all of them; `bun run audit-cards` reports zero
  title mismatches.
- **`build_scripts/audit-card-inheritance.js` classifies three ways**
  (`authored` / `title-only` / `inherits`). The split landed in `7b8ddca` with
  12 dead Related descriptions deleted; `resource section` moved into
  `TITLE_ONLY` afterwards, with 20 more deleted.
- **It was 20, not the 19 predicted, and the extra one is the interesting
  case.** Reclassifying changes the question asked of a Resource-section card
  from "does its text equal the destination summary?" to "does it have text at
  all?" One card's text already matched its summary verbatim, so the old rule
  scored it as PASSING — while the text renders nowhere and should not exist.
  The wrong classification was not merely over-reporting; it was also silently
  blessing a card it should have flagged.
- **Only 12 genuine editorial decisions remain**, all in the Agency page's
  Services and Resources subsections — the one component confirmed to render a
  description.
- **Inline page links inside rich text are a third case and are authored.**
  `health-code-article-11`'s cards sit in a Title-and-text block with
  `karl: 'Report Content -> inline page link.'`. In Wagtail rich text the
  editor writes the link text, so those must not be synced to anything.

## Two live-copy discrepancies found in passing

Both concern `payFee` and are recorded here because they were observed on the
live page rather than inferred:

- **Live title casing is lowercase:** "Pay your annual healthy housing fee for
  apartment buildings". The mockup uses "Healthy Housing" capitalised. SF.gov
  house style is sentence case, so the live page is likely right.
- **Live description differs:** "You need to pay this annual fee if you own an
  apartment building with 3 or more rental units." The mockup's `payFee`
  summary is "Pay your annual Healthy Housing fee if you own an apartment
  building with 3 or more rental units".

## External entries in a subsection DO render a description (verified 2026-08-09)

The work above checked only entries pointing at an SF.gov page, and left open
what a Services/Resources subsection does with an entry pointing at an
**external link** — there is no destination page to inherit from, so the
description had to come from somewhere else or not at all. That gap is now
closed, and the answer is that **an external entry carries and renders its own
authored description.**

- **Method: a census, not a spot check.** All 332 `departments--*` URLs were
  taken from `sf.gov/sitemap.xml`, fetched, and every `data-testid="tile-link"`
  and `"quick-link"` anchor was matched to its own closing `</a>` so each
  entry's description could be attributed to that entry rather than to the one
  beside it. 103 of those pages carry at least one entry whose `href` leaves
  `sf.gov`. This is a DOM-level check of rendered output, the same standard the
  2026-08-08 findings were held to — not a reading of the editor docs, which
  have already been wrong once here (see the Related-panel note above).
- **The result: 333 of 363 true off-domain entries render a
  `tile-description`.** The 30 that do not are consistent with an editor
  leaving the field blank, which is the same shape as the 90 SF.gov entries
  rendering none because their destination page has no summary. Examples span
  many departments and hosts, so this is not one team's local habit:
  `sfgov.org/adultprobation/contact` ("Contact us for any questions…"),
  `baywoof.org/commission-tails` ("Columns authored by members of the
  Council."), `sfplanninggis.org/pim`, `capropeforms.org`, a YouTube channel
  ("Explore our informative tutorials and presentations."),
  `sfmta.com/maps/san-francisco-bike-network-map`, and `app.box.com`.
- **`api.sf.gov` and `media.api.sf.gov` were counted separately and excluded
  from that figure**, and the distinction is the one thing a naive sweep gets
  wrong. Those hosts are SF.gov's own document store, so an entry pointing at
  one is a **Document Picker** upload whose title and description come from the
  Document object — a third mechanism, neither page inheritance nor an authored
  external link. Folding them in would have inflated the count with evidence
  for a different question. Counted on their own they run 69 with a description
  to 29 without.
- **What this means for the mockup:** the six external entries in
  `pestsTopic`'s Services/Resources subsections are **not** dead data. Their
  `text` is the field Karl publishes, `js/page-render.js` is already correct to
  print it, and it must not be deleted. That is the opposite of the conclusion
  reached for external entries in a **title-only** component (a Related panel,
  a Resource section), which renders no description for any entry — the
  difference being a fact about the component, which is why the two cases
  needed separate evidence rather than one inference from the other.

## Re-ingesting

This file is corpus content. It is not retrievable by the `compliance-audit`
task until `bun run ingest` runs, which rebuilds the whole `knowledge_chunks`
table and needs a real (billed) `GEMINI_API_KEY`. Editing it without
re-ingesting leaves the old text in the database.
