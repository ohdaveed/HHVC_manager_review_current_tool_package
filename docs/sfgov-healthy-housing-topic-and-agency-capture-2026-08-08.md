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
redesign exists to prevent. **Verify with Digital Services before building
anything else described here.** Fallback if it is not repeatable: use Services
subsections for the action groups (Get help / If you rent / If you own) and a
single Resources subsection for reference material.

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

1. Resolve the repeatable-Resources-subsection question with Digital Services.
   Everything below is contingent on it.
2. If repeatable — keep the audience grouping. It is the mockup's genuine
   value-add and it beats the live Topic page's subject grouping for a
   single-agency landing page. Then add Highlights and a Spotlight, and settle
   the summary voice.
3. If not repeatable — fall back to the Services-subsection split described
   above.
4. Independent of the schema answer: add doors for the two missing services.

## Rerun inputs

```
firecrawl scrape "https://www.sf.gov/topics--healthy-housing-conditions" \
  --only-main-content -o .firecrawl/sfgov-healthy-housing-conditions.md

firecrawl scrape "https://www.sf.gov/departments--department-public-health--environmental-health" \
  --only-main-content --wait-for 3000 -o .firecrawl/sfgov-environmental-health-dept.md
```
