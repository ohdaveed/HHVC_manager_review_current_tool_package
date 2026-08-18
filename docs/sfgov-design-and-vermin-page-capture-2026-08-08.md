# SF.gov design capture + "Keeping your building free of vermin"

Firecrawl capture of the live SF.gov page that the HHVC mockups are a redesign
of, taken to answer two questions: **does this tool's CSS still match SF.gov**,
and **what does the real page actually say**.

## Source

- URL: `https://www.sf.gov/information--keeping-your-building-free-vermin`
- Captured: 2026-08-08, HTTP 200, 25,163 chars of markdown
- Tool: `firecrawl scrape --format branding,images,markdown,links` plus a
  full-page screenshot
- Artifacts: `.firecrawl/sfgov-vermin.json`, `.firecrawl/sfgov-vermin-screenshot.png`
  — **gitignored**, so they are not committed and the screenshot is
  deliberately not embedded below; re-run the command above to regenerate.

## What matched, and what did not

**The colour tokens are already correct.** Three of the scraped values are
byte-identical to the primitives in `css/styles.css`, which is a useful
confirmation that the palette has not drifted since it was transcribed:

| Scraped (live SF.gov)             | Repo primitive       | Value     |
| --------------------------------- | -------------------- | --------- |
| `accent` / `link` / `textPrimary` | `--sfds-action-blue` | `#2a60af` |
| `background`                      | `--sfds-white`       | `#fcfcfc` |
| input `textColor` / `borderColor` | `--sfds-slate-1`     | `#0b0c0c` |

Scraped `primary: #1B519E` and `secondary: #AFCCF7` have no counterpart in
`css/styles.css`. They are most likely header/footer chrome rather than
content-area colours, and nothing in the mockup needs them today.

**The typeface is the one real divergence.** SF.gov serves:

- **Roboto Slab** — a _serif_ — for headings
- **Roboto Flex** for body copy

The mockup uses one system-ui sans stack for both (`--font-sans`, with
`--font-display` and `--font-body` aliased to it in `css/theme.css`). So every
heading in every mockup page is rendering in the wrong genre of typeface
relative to the real site. This is the highest-impact fidelity gap found.

**It is deliberately not fixed here**, because the fix is not free and the
trade-off belongs to a human:

- The tool's central claim is that it works fully offline, and
  `findExternalAssetUrls` fails validation on any off-origin asset. A webfont
  would have to be self-hosted under `public/` — or base64-inlined, since
  `vite build --mode singlefile` must survive being emailed and
  double-clicked, where a relative path 404s.
- Roboto Flex is a variable font; a subset of two families is a real addition
  to a bundle whose initial download is currently ~114 KB gzip.
- Switching the mockup's heading font changes the apparent length and rhythm
  of every page under review, which is the sort of change that should be made
  on purpose rather than as a side effect of a CSS audit.

## Treat the rest of the branding block as unreliable

Firecrawl self-reported `confidence: { colors: 0.9, buttons: 0, overall: 0.45 }`,
and the block contains at least one obvious misread: `fontSizes.body: "10px"`,
which is fine print somewhere on the page rather than body copy. `h1: 46px` and
`h2: 40px` are plausible but were not verified against a computed style, so they
are **not** grounds for changing the mockup's own type scale — which is
deliberately literal for reasons documented in `css/styles.css`.

## Page structure: one page becomes thirteen

The live page is a single omnibus document. Its heading tree is:

```text
Keeping your building free of vermin
├── Building owner responsibilities
│   ├── Preventing vermin  → Rodents / Bed Bugs / Pigeons / Mosquitoes
│   ├── Training staff
│   └── Dealing with vermin
│       ├── Respond to vermin reports        (72-hour investigation window)
│       ├── Get rid of rodents               (IPM, licensed PCO, no poisons)
│       ├── Remove dead animals and waste
│       ├── Trapping mosquitoes
│       └── Tell tenants about pesticide treatments
└── Tenant responsibilities
```

The redesign decomposes that into task-based pages. Thirteen current mockup
pages carry content from this one URL — `property-owner-responsibilities`,
`integrated-pest-management-education`, `integrated-pest-management-property-managers`,
`healthy-housing-vermin-resources`, `mosquito-control-program`,
`report-cockroaches-mosquitoes-insects`, `report-rats-mice-four-legged-problems`,
`report-garbage-filth-vegetation`, `tenant-rights-reporting`,
`what-happens-after-report`, `hhvc-inspection-scope`, `health-code-article-11`,
and `agency-service-grouping`.

That one-to-many split **is** the redesign argument, and it is worth stating to
a reviewer in those terms: the current site asks a tenant with a bed bug problem
to read a page written primarily for property owners.

## Specific facts worth checking the mockups against

These are concrete, citable claims from the live page. They are the kind of
detail a `karl` note or an `unverified` pill should be resolved against — this
capture is evidence of what **sf.gov currently publishes**, not of what HHVC
policy requires, and the two can disagree.

- Property owners have **72 hours** to investigate after a tenant reports
  vermin, and must keep a **written log**.
- Bed bug treatment "can take more than 30 days"; owners must respond to
  complaints by hiring a **licensed pest control operator**.
- Gaps over **¼ inch** around exterior doors and windows must be sealed.
- Stored materials must be elevated **6 inches** from the ground and kept
  **6 inches** from any wall or fence.
- Poisoning, trapping, or shooting **pigeons is not allowed**; check with SFFD
  before installing netting that could block emergency access.
- Rodents: **do not use poisons**; prefer IPM and a service licensed by the
  San Francisco County Agricultural Commissioner.
- Bleach solution for disinfecting: **2 tablespoons per 1 cup of water**.
- California Structural Pest Control Board, licence status: **(916) 561-8704**.
- If a PCO cannot provide proof of SF business licence: **415-252-3862**.

## Findings: those facts checked against the mockups

Each fact above was grepped against the 13 pages, twice — once for the literal
phrasing and again with looser synonyms, because the first pass produced false
negatives on wording alone (a "written log" mandate does not match a page that
says "recordkeeping"). The second pass reclassified two items out of "missing".

**Read the whole section against one caveat: these are deltas from what sf.gov
publishes today, not from Article 11.** The mockups are deliberately scoped to
Article 11, so several absences below are plausibly correct scope decisions —
the pigeon prohibition and the state licensing board are arguably not HHVC's to
state. The two _divergences_ are the findings that stand on their own, because
those actively contradict published guidance rather than omitting it.

### Consistent (4)

| Fact                         | Where                                                                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 72-hour investigation window | `article-11-compliance-for-property-owners.js:40,52,68` — worded identically                                                      |
| Licensed PCO required        | same file `:41,70`, plus `integrated-pest-management-property-managers.js:167` — richer than live (adds adjacent-unit inspection) |
| ¼ inch gap sealing           | `integrated-pest-management-property-managers.js:150` ("larger than 1/4 inch")                                                    |
| Pesticide notice to tenants  | `article-11-compliance-for-property-owners.js:43,71` — stronger than live (written notice, product name, date, safety info)       |

### Divergent — present, but says something different (2, both since fixed)

- **Rodent poisons.** Live SF.gov is flat: "Do not use poisons." The mockup
  (`report-rats-mice-four-legged-problems.js:109`) said "Do not scatter loose
  poison — it can harm children, pets, and wildlife," which permits poison used
  properly. That is softer than published guidance on a child-safety claim.
  **Fixed:** the bullet now reads "Do not use poisons — they can harm children,
  pets, and wildlife," matching the published directive while keeping the reason,
  which live SF.gov omits.
- **6-inch clearance.** Live states two clearances: 6 in. off the ground **and**
  6 in. from any wall or fence. `integrated-pest-management-property-managers.js:153`
  carried only the ground half. The wall/fence gap is what makes rub marks and
  runways visible during an inspection, so the missing half is the load-bearing one.
  **Fixed:** the bullet now states both clearances and says why the wall/fence one
  exists. It sits two bullets below an unrelated 24-inch clear-space line from
  Pest Prevention by Design — those measure different things (a patrol/visibility
  aisle vs. how stored materials are stacked), so do not "reconcile" them into one
  number.

### Absent (5)

- **The written-log mandate.** Live: owners "must keep a written log" of vermin
  signs and reports, with a log-template link. The closest line was
  `integrated-pest-management-property-managers.js:166` ("Use one system to log
  complaints, repairs, sanitation work, and contractor visits"), which is IPM
  best-practice framing rather than a stated obligation. This is the strongest
  genuine gap: it sits in the same paragraph as the 72-hour rule the mockups do
  carry, so the transcription stopped halfway through.
  **Fixed — and it turned out not to be an sf.gov-only claim.** Chasing it back
  found the same requirement in a tier-1 source already vendored here:
  `docs/source/hhvc-policy/2026-07-08-residential-building-owner-operator-guidelines-vector-control.md`,
  item 2 — _"Owner or manager shall investigate reports of pest activity within
  72 hours. All reports of rodents, fleas, flies, bedbugs, spiders, cockroaches,
  wasps, and mosquitoes will be recorded in a logbook made available to the pest
  control professional."_ One sentence, of which the mockups carried the first
  half. So the Article 11 scope caveat above does **not** excuse this one, and
  it lands on `article-11-compliance-for-property-owners.js` where the 72-hour
  half already lives (checklist bullet plus a full bullet carrying the verbatim
  pest list, the give-it-to-the-PCO duty, and the live log-template link). The
  IPM page's line now says the log is required and links across rather than
  restating it.
  **Method note for the remaining items:** this one was classified "absent —
  sf.gov only" on the strength of a grep across `pages/`. The grep was right that
  no page said it; the inference that it was therefore outside Article 11 scope
  was not, and only checking `docs/source/` disproved it. Any remaining item
  below should get the same treatment before it is dismissed as out of scope.
- **Pigeon prohibition.** Poisoning, trapping, or shooting pigeons is not
  allowed. Pigeons appear on six pages, every time as a reportable nuisance and
  never as a restricted action.
- **SFFD check** before installing netting or other structural bird exclusion
  that could block emergency access. No match on any page.
- **Licence-verification path.** No `Agricultural Commissioner`, no
  `Structural Pest Control Board`, and neither phone number. A reader told to
  hire a _licensed_ PCO currently has no way to check that a company is one.
- **Bleach ratio** (2 tbsp to 1 cup). `report-rats-mice-four-legged-problems.js:110`
  says "wet down droppings with a disinfectant" without the dilution.

### One cross-reference worth following

Live SF.gov says bed bug treatment "can take more than 30 days" — absent from
the mockups. Separately, `what-happens-after-report.js:107` already flags its
own generic 30-day correction window as unsourced ("No tier-1 doc establishes a
generic 30-day correction window"). The live page supplies a different, citable
30-day figure, which may be what that flag should be pointed at.

## Rerun inputs

```yaml
workflow: firecrawl-website-design-clone
source_url: https://www.sf.gov/information--keeping-your-building-free-vermin
output: docs/sfgov-design-and-vermin-page-capture-2026-08-08.md
```
