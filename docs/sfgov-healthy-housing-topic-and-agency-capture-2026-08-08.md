# SF.gov capture: "Healthy housing conditions" Topic + the real Agency template

Firecrawl capture of the live SF.gov Topic page the HHVC mockup landing page is
a redesign of, taken to answer one question: **what should
`pages/agency-service-grouping.js` (`pestsTopic`) look like, given what SF.gov
actually publishes?**

A second page was captured that was not asked for, and it is the reason this
note reaches a different conclusion than the requested comparison would have.
See "The requested comparison is cross-template" below.

## Source

- URLs:
  - `https://www.sf.gov/topics--healthy-housing-conditions` — content type
    **Topic**, 6,072 chars of markdown
  - `https://www.sf.gov/departments--department-public-health--environmental-health`
    — content type **Agency**, 5,301 chars of markdown
- Captured: 2026-08-08, both HTTP 200
- Tool: `firecrawl scrape --only-main-content`
- Artifacts: `.firecrawl/sfgov-healthy-housing-conditions.md`,
  `.firecrawl/sfgov-environmental-health-dept.md` — **gitignored**, not
  committed; re-run the commands in "Rerun inputs" to regenerate.
- The Agency scrape failed once with `ERR_TUNNEL_CONNECTION_FAILED` (a Firecrawl
  proxy error, not a site error) and succeeded on retry with `--wait-for 3000`.
  Worth knowing before concluding the page is gone.

## The requested comparison is cross-template

`topics--healthy-housing-conditions` is a **Topic**. The mockup is an
**Agency** (`type: 'Agency'` in `pages/agency-service-grouping.js`). These are
different Karl content types with different fields, so "redesign the Agency page
to match this Topic page" is not a comparison that can be made directly — a
Topic's field set is not available to an Agency and vice versa.

The Environmental Health page was captured because it is a real, live page of
the **same** content type as the mockup, and it is the parent the Topic page
sits under. It is the correct comparator for template questions. The Topic page
remains the correct comparator for **content** questions — which services and
resources exist, and how they are worded.

Reading only the Topic page produces plausible, confident, wrong advice about
the Agency template. That is the whole reason this section is first.

## The live Agency template, as actually rendered

Environmental Health, in document order:

```
Agency                                    ← content-type label
# Environmental Health                    ← H1
"We help San Franciscans live and work    ← one-sentence mission summary
 safely by ..."
[3 cards, NO heading]                     ← Highlights, directly under summary
## Calendar                               ← UPCOMING / PAST
## Come to the Permit Center              ← Spotlight: H2 + paragraph + one CTA
## Resources
### Programs and services by topic        ← ONE subsection, ~12 cards, flat
## About                                  ← one paragraph
## Contact information                    ← Address / Phone / Email /
                                            Request public records
```

## The finding that gates everything else

**Every Resources section in the mockup assumes repeatable subsections, and the
live Agency page shows exactly one.**

The mockup's karl notes say, in order: "Use one Resources subsection titled 'If
you rent'", "Use a **second** Resources subsection", "Use a **third** Resources
subsection", "Use a **final** Resources subsection". The entire audience-based
information architecture — the mockup's central design thesis — rests on that
field being repeatable.

Evidence for repeatable subsections comes from the **Topic** page, which has
three under Services (General housing issues / Lead poisoning issues / More
services) and three under Resources (General housing health information / Lead
poisoning resources / Health codes). That is the wrong content type to
generalize from, and it is the generalization the mockup currently makes
silently — it is not recorded anywhere as an open question, unlike the two
questions the `article11Compliance` page's editorNote does flag.

If the Agency Resources field is **not** repeatable, the four grouped sections
collapse into one undifferentiated grid, which is precisely the failure the
redesign exists to prevent.

**RESOLVED — it is repeatable, and the IA is buildable as designed.** The Karl
editor docs say so directly for both fields: _"You can create more subsections"_
([Resources on an Agency page]) and _"You can create multiple subsections"_
([Services on an Agency page]). Both section headings are renameable as well —
Services is "Section title 1", Resources is "Section title 2" — so the mockup's
custom band titles are legitimate. No fallback needed.

## Answers from the Karl editor docs

Checked against
`https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/`.

- **Cards have no author-set title or description, and this is the finding with
  the widest blast radius.** A subsection entry is only "add an SF.gov page or
  External link" — no label field, no description field. The card renders the
  **destination page's** own Title and Description. Confirmed against the live
  Environmental Health Agency page, whose card text is verbatim each
  destination's summary. Every `title`/`text` pair on every card in
  `agency-service-grouping.js` is therefore a copy of its destination, not
  authored copy, and editing one changes nothing in Karl. The page-level
  editorNote now says this. **Unswept:** the same pattern almost certainly
  affects card text on the other 21 pages, which nobody has checked.
- **Highlights takes exactly 2 or 3 entries — "no more or less" — and each
  REQUIRES an image** of at least 350x200, plus a link title (~40 chars, 50
  max), a screenreader ARIA label, and a description (80-100 ideal, 120 max).
  Adopting Highlights is not "fill an empty field": on this tool an image means
  another inline WebP data URI, for the single-file build reason documented in
  CLAUDE.md.
- **Agency allows up to 2 Spotlights.** Both are currently unused, so the 311
  route can have one without displacing anything.
- **Callout is supported on Transaction, Information and Data story only — not
  Agency.** `article11Compliance` is an Information page, so it is available
  there. **No "checklist block" exists anywhere in the docs**, which settles
  that page's open question #1: the bulleted list is the correct fit, not a
  stopgap. Whether a callout supports lists internally is still unstated; it is
  inserted from the text-section menu and text sections do support bulleted
  lists, so probably, but unconfirmed.
- **Accordions have no documented open-by-default flag, and the guidance is
  stronger than the workaround anyway:** _"Do not use an accordion for content
  that all users need to see."_ So the mockup-only `open: true` on the
  while-you-wait rodent tips is pointing at the wrong fix — the content should
  not be in an accordion at all. (Campaign guidance also caps accordions at
  about 5.)
- **Cost has a free-text "cost description" field** for restrictions and
  eligibility alongside the cost-type selector, so the $103-$808+ tiering has a
  home regardless. The selector's own options are only legible in a screenshot,
  so whether a "varies by unit count" type exists is still unconfirmed.
- **Still unanswered:** whether a Karl page exists for the complaint forms and
  vermin log template. That needs a page lookup in Karl itself, not the docs.
- **Also learned:** the docs carry the authoritative Agency field inventory
  ("How an Agency page works"), and the mockup's editorNote was missing four
  real fields — Quick links, Call to action, Public records, Topics. Corrected.
  And _"Digital and Data Services must create Agency pages for you"_ — this
  page cannot be self-served.

## Where the live content should change the mockup

- **Highlights is empty by deliberate choice, and that choice should be
  revisited.** The page-level editorNote lists Highlights among the Agency
  fields "intentionally left empty in this mockup." But Highlights is the live
  Agency template's most prominent element — three cards above everything except
  the summary. The mockup instead opens with a five-card Services section. The
  top three tenant tasks belong in Highlights; that field is the template's own
  answer to "what does a visitor do first."
- **No Spotlight, where the live page spends its one Spotlight on its single
  most important route.** "Come to the Permit Center" is an H2 + paragraph +
  one CTA. The mockup's equivalent — report a housing health issue via 311 —
  is currently one card among five in the Services grid.
- **Summary voice diverges from observed house style.** Live Agency: _"We help
  San Franciscans live and work safely by ..."_. Live Topic: _"We help keep San
  Francisco housing healthy by protecting residents from vermin and lead
  poisoning."_ Mockup: _"Report a housing health issue, get help with pests, or
  find the right next step for your building."_ Both live pages open
  mission-first; the mockup opens task-first. **No documented rule was found
  either way** — not in `notebooklm/hhvc-standards-manual.md`, not in the
  vendored `docs/source/sfgov-style/` corpus. So this is an observed
  two-of-two convention, not a mandate, and it deserves a deliberate decision
  rather than being left as drift.
- **Two live services have no door on the mockup.** "Report a residential
  building concern" is the live Topic's _first_ service and the one covering
  single room occupancy (SRO) hotels; "Get help with vermin in your building"
  is the tenant self-help route. The mockup's reporting paths are all
  condition-specific — rodents, insects, filth — so a visitor who cannot
  classify their own problem has no general door except 311.

## Already settled — do not re-open

The mockup's editorNote explicitly places lead safety, water service, noise,
asbestos, and structural construction outside HHVC / Article 11 scope, referring
them to Citywide services instead of duplicating them. That covers roughly 40%
of the live Topic page — all of "Lead poisoning issues" and all of "Lead
poisoning resources" — and the exclusion is correct for an Agency page scoped to
Article 11, even though the Topic page's own summary names lead poisoning as
half its remit. The Topic page and the Agency page have different jobs.

Two live resources are covered **better** than live, not missing: "Search
residential violations" and "Search hotel violations" link straight to raw
`xnet.sfdph.org` ORDS applications. The mockups wrap the same records behind
four explainer pages (`lookup-residential-violations.js`,
`lookup-residential-hotel-records.js`, `lookup-building-records.js`,
`lookup-complaints-inspections.js`).

## Live Topic inventory, for reference

Services — **General housing issues:** report a residential building concern ·
report low water pressure or loss of water service · get help with vermin in
your building · pay your annual healthy housing fee · report a noise problem ·
report unsafe construction work involving asbestos. **Lead poisoning issues:**
stop construction work spreading lead paint dust · prevent lead poisoning in
young children · report damaged paint (residents older than 6) · invite your
landlord to fix lead dangers · apply to fix leaded paint and soil. **More
services:** get lead training and certification · sign up to do lead-related
inspection or construction.

Resources — **General housing health information:** keeping your building free
of vermin · healthy housing inspection programs · search residential violations
· search hotel violations · healthy housing and vermin information ·
environmental health impacts of housing insecurity · learn about asthma
(third-party, lungsrus.org). **Lead poisoning resources:** resources and
information for preventing lead poisoning · Fix Lead SF for property owners.
**Health codes:** Articles 1, 2, and 11 on municode.

Partner agencies: Department of Public Health · Environmental Health.

## Recommended sequence

1. ~~Resolve the repeatable-Resources-subsection question.~~ **Done — yes.**
   Keep the audience grouping: it is the mockup's genuine value-add and it beats
   the live Topic page's subject grouping for a single-agency landing page.
2. **Sweep card `title`/`text` across the other 21 pages.** Now that cards are
   known to inherit from their destination, any card whose text differs from its
   destination page's Description is showing reviewers copy that will never
   render. Only `agency-service-grouping.js` has been checked.
3. Decide on Spotlight (2 available, both unused) and Highlights (2 or 3
   entries, each needing an image — cost it before committing). Settle the
   summary voice.
4. Independent of the schema answer: add doors for the two missing services.
   **Done — and only one was an add.** "Report a residential building concern"
   was genuinely absent and is now an external referral under "Need another
   City housing service?", not under Services: it spans structural and
   habitability problems well past Article 11, so the HHVC page should offer
   the door without appearing to own it. The vermin self-help route was **not**
   missing — `verminResources` was already on the page, filed last under "Look
   up records and rules", which is not where a tenant looking for self-help
   would ever look. Live sf.gov files the same content under Services (General
   housing issues), so it moved there and was retitled task-first: "Get help
   with pests in your building". It was moved rather than copied; a second
   printing is what this tool has spent its UX review budget removing.
   Note the follow-on flag: that card's title no longer matches its
   destination page title, which Digital Services needs to confirm a Services
   card may do.

## Rerun inputs

```
firecrawl scrape "https://www.sf.gov/topics--healthy-housing-conditions" \
  --only-main-content -o .firecrawl/sfgov-healthy-housing-conditions.md

firecrawl scrape "https://www.sf.gov/departments--department-public-health--environmental-health" \
  --only-main-content --wait-for 3000 -o .firecrawl/sfgov-environmental-health-dept.md
```
