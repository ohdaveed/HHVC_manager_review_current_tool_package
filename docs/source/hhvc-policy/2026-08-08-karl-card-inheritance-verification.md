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
| **Resource Collection → Resource section** | Yes | Yes (assumed, see below) |

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

**Resource Collection "Resource section" is grouped with these but was not
separately verified.** It behaves like a Resources subsection and is treated
as title-and-description, which is the conservative assumption for the mockup
(it keeps card text visible rather than deleting it). If it ever matters, it
needs its own live check.

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
- **`build_scripts/audit-card-inheritance.js` classifies two ways and needs
  three.** Its `INHERITS` pattern lumps Related in with the subsections and
  then asks whether the card text equals the destination summary. For Related
  the correct assertion is the opposite: the card text must be **empty**. Until
  that split exists, the audit over-reports Related blanks as findings.
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

## Re-ingesting

This file is corpus content. It is not retrievable by the `compliance-audit`
task until `bun run ingest` runs, which rebuilds the whole `knowledge_chunks`
table and needs a real (billed) `GEMINI_API_KEY`. Editing it without
re-ingesting leaves the old text in the database.
