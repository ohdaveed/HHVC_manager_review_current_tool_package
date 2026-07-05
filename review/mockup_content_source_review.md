# HHVC Mockup Content & Source Review

**Prepared for:** neutral third-party manager review
**Scope:** all 39 mockup pages currently registered in the HHVC manager-review tool (`js/page-data.js`), as of the current `main` branch (`53ee464`, 2026-07-05)
**Generated from:** `data/page_inventory.json` (regenerated via `bun run export` on 2026-07-05), `docs/superpowers/specs/2026-07-02-hhvc-policy-content-audit-matrix.md`, `docs/source/hhvc-policy/README.md`, `review/mockup_tracking_sheet.csv`, and the `pages/*.js` source files

## 1. What this document is

This tool is a static mockup, not a live SF.gov page. Every page is authored by hand in `pages/*.js` as illustrative copy for manager review; none of it is published or backed by a transactional backend. The purpose of this document is to tell a reviewer, page by page, **what the mockup currently says** and **how much of that content has actually been checked against a real policy, legal, or program source** versus written as plausible-sounding placeholder copy.

This is not a copyediting review and does not judge whether the writing is good. It is a sourcing/provenance audit.

### 1.1 Sourcing confidence tiers used throughout

| Tier | Meaning |
| --- | --- |
| **Tier 1 — Claim-audited** | Individual sentences/claims on the page were checked line-by-line against a specific named source document and marked `verified` in a formal audit matrix (Phase 1, dated 2026-07-02). |
| **Tier 2 — Flagged, not yet audited** | The page was designated "Phase 2" for a future claim-level audit, but no audit matrix rows exist for it yet. Content may be well-aligned with source material by topic, but no claim has been individually checked. |
| **Tier 3 — Not in audit scope** | The page was never entered into the policy-audit process at all. Some Tier 3 pages cite a specific source document in their own `editorNote` (traceable, but still self-reported, not independently audited); most do not cite any source and are illustrative mockup copy written to be policy-plausible. |

Only 8 of the 39 pages (21%) are Tier 1. 9 pages (23%) are Tier 2. The remaining 22 pages (56%) are Tier 3.

**Read literally, this means most of the tool's content — including several pages with specific fee amounts, timelines, and legal-sounding claims — has not been independently verified against a source document.** Where a page's own `editorNote` says so explicitly, this document quotes it; where a page makes a specific claim (dollar figures, deadlines, statutory citations) without any note, that is flagged as unverified rather than assumed correct.

## 2. Source document inventory

All source material lives in `docs/source/hhvc-policy/` (PDFs + extracted `.md`), catalogued in that folder's `README.md`. Categories in use:

- **Primary/legal authority**: `violation-pages-master-content.md` (Article 11 violation categories and page template), `health-code-sec-609-healthy-housing-fee.md` (statutory fee basis), `sf-rent-ordinance-sec-37-9-retaliation.md` (anti-retaliation), `bed-bug-directors-rules-tenant-guidelines` (SFDPH Director's Rules — the only bed bug legal authority; **UC IPM bed bug notes are explicitly documented as not sufficient to satisfy this requirement**).
- **Operational/stakeholder attestations** (not published documents, but recorded stakeholder statements): `program-manager-72-hour-tenant-notice.md`, `program-manager-reporter-privacy.md`, `program-manager-tenant-safe-housing-rights.md`.
- **SF.gov web-extract pages**: `sf-gov-pay-healthy-housing-fee.md`, `sf-gov-report-health-nuisance-or-hazards.md`, `sf-gov-housing-discrimination-help.md`.
- **Fee schedules**: `dph-ehb-fees-fy24-25.md`, `controller-fee-certification-fy25-26.md` — both explicitly marked "supplementary/best-estimate reference only"; page copy is written to point users to their invoice rather than publish a fixed dollar figure.
- **UC ANR/UC IPM Pest Notes** (raccoons, rats, house mouse, mosquitoes, flies, yellowjackets, bed bugs, cockroaches, fleas, itching/infestation, Lyme disease): all explicitly labeled in the README as **"education only," "supplementary," or "does not define HHVC scope"** — none of them are legal or process authorities for HHVC's reporting, fee, timeline, or enforcement claims, even where a mockup page cites one.
- **Mold guidance**: `mold-moisture-guidance.md` (short-form, contains the 10-sq-ft action threshold) and `mold-tenants-landlords-guidance.md` (full SFDPH guidance).
- **Vegetation**: `vegetation-overgrowth-notice.md` (SFDPH Code Enforcement flyer, Sec. 581 authority).

Several pest categories that now have mockup Information pages — **flies, ground wasps, mites, raccoons, pigeons** — have **no dedicated legal/process source document** in the folder at all; where a source exists (yellowjackets/flies UC IPM notes), it is general pest-biology education, not HHVC-specific policy.

## 3. Tier 1 — Phase 1 claim-audited pages (8 pages)

`pestsTopic`, `ratsReport`, `cockroachesReport`, `bedBugsReport`, `mosquitoesReport`, `vegetationReport`, `moldReport`, `payFee` went through a formal, claim-level audit on 2026-07-02 (`docs/superpowers/specs/2026-07-02-hhvc-policy-content-audit-matrix.md`), which checked 51 specific sentences/fields against named source documents and marked every one `verified` (no `conflict` or `missing_source` rows exist in the matrix).

### 3.1 What's actually verified

The claims that survive verbatim in current content, and their sources:

| Claim | Source |
| --- | --- |
| Article 11 / HHVC scope framing on the Topic page | `violation-pages-master-content.md` |
| "72 hours" / "3 days" landlord-notice-before-311 pattern (all 6 report Transaction pages using it) | `program-manager-72-hour-tenant-notice.md` (a stakeholder attestation, not a published policy) |
| "Reporter identities are only shared with the City Attorney's Office and are not shared in response to public records requests" | `program-manager-reporter-privacy.md` + `sf-gov-report-health-nuisance-or-hazards.md` |
| "Tenants have rights to safe and habitable housing" | `program-manager-tenant-safe-housing-rights.md` |
| "A property owner or manager cannot retaliate because a tenant reports housing conditions to the City" | `sf-rent-ordinance-sec-37-9-retaliation.md`, Sec. 37.9(d) |
| Mold review threshold — "growing on walls or ceilings and the affected area totals at least 10 square feet" | `mold-moisture-guidance.md` |
| Fee applicability (3+ rental units), exemption (fewer than 3 units), invoice-based amount, payment method framing | `sf-gov-pay-healthy-housing-fee.md` + `health-code-sec-609-healthy-housing-fee.md` |
| Bed bug rules pointer (routes to `bedBugsInfo` rather than restating rules) | `bed-bug-directors-rules-tenant-guidelines` |

### 3.2 Finding: the audit is partially stale relative to current content

I compared every audited claim's exact text against the page content currently in the tool (`data/page_inventory.json`). The report Transaction pages have all been restructured since the 2026-07-02 audit — `ratsReport`, `cockroachesReport`, `bedBugsReport`, and `mosquitoesReport` were last edited 2026-07-04, and `vegetationReport` on 2026-07-05, per `review/mockup_tracking_sheet.csv` git-log data.

Two concrete, confirmed changes:

1. **The audited enforcement sentence is gone.** The matrix verified the sentence *"Violations must be corrected and may require follow-up inspection."* on `ratsReport`, `cockroachesReport`, `bedBugsReport`, `mosquitoesReport`, and `moldReport`, sourced to `violation-pages-master-content.md`. That exact sentence no longer exists on any of those five pages. It has been replaced by a longer, four-point "How your report is processed" block (review-time estimate, inspector-contact behavior, anonymous-report inspection risk, and a new paraphrase — *"If we find a problem: The City can order the property owner or responsible party to fix the violation"*). This new block overlaps in substance with the **Tier 2, not-yet-audited** `afterReport` page, and none of its four bullets have been through the same claim-level check the old sentence had.
2. **`vegetationReport`'s summary was reworded.** The audited text — *"Report garbage, clutter, or overgrown plants that may attract pests or vectors"* — is now *"Report overgrown plants, weeds, or brush that may attract or shelter pests or vectors,"* reflecting that garbage/clutter reporting was split out into the separate `garbageReport` page. This is a reasonable scope split, but the new wording itself was not re-verified against `vegetation-overgrowth-notice.md`.

Everything else audited (privacy/safe-housing/anti-retaliation callouts, mold threshold, fee claims, bed bug rules pointer) is still present verbatim, just at different structural positions (e.g., moved from `sections[1]` to `sections[2]`) — path drift, not content drift. The 72-hour landlord-notice step is also unchanged, verbatim, at its original position on `cockroachesReport`, `bedBugsReport`, `mosquitoesReport`, and `vegetationReport` ("If you rent, give 72 hours when possible" / "If they do not respond or start fixing it within 72 hours, submit your report right away..."). The one exception is `ratsReport` itself: its equivalent step was rewritten — the title changed to "Notify your landlord before reporting" and the text reformatted into bullets ("Give them 72 hours: If they do not start fixing the problem within 3 days, report it to the City.") — the 72-hour/3-day substance survives, but the audited sentence-level text does not.

**Practical implication for a reviewer:** the "Ready for manager review" / `policy_audit_status: verified` label these 8 pages carry in `review/mockup_tracking_sheet.csv` should not be read as "every sentence on the page today has been checked" — it certifies the 2026-07-02 snapshot, and at least one substantive claim has since been replaced with unaudited text.

## 4. Tier 2 — Flagged for audit, not yet audited (9 pages)

`scopeInfo`, `ownerGuidance`, `afterReport`, `tenantRights`, `ratsPrevent`, `cockroachesPrevent`, `mosquitoesPrevent`, `reduceMoisture`, `bedBugsInfo` are all tagged "Phase 2" in the tracking sheet, but the audit matrix contains zero rows for any of them — `policy_audit_status` is `not_audited` for all nine.

Notable content on these pages:

- **`afterReport`** (unaudited) is where the specific compliance-deadline tiers now live: *sewage backups 48–72 hours*, *all other violations 30 days*, *extensions if the owner contacts the inspector before the deadline*, *bed bug treatment within 2 working days*, *reinspection fees starting at the third visit*, *fines up to $1,000/day*. These are concrete, citable-sounding figures with no source-doc citation on the page itself.
- **`noticeOfViolation`** is Tier 3, not Tier 2 (see §5), but its `editorNote` explicitly cross-references the same fee sequencing and calls out that the dollar amounts are "sourced as illustrative FY24-25 estimates from `docs/source/hhvc-policy/2026-07-02-dph-ehb-fees-fy24-25.md`" and asks HHVC to confirm the sequencing before publication. `afterReport`'s parallel reinspection-fee claim carries no equivalent caveat.
- **`bedBugsInfo`** contains the most legally specific content in the tool outside Phase 1: PCO licensing, 72-hour investigation, adjacent-unit inspection, pre-tenancy disclosure (24 months), mattress encasements, 2-working-day tenant reporting duty, trilingual disposal-bag labeling, and a 28-day/45-day abatement-and-reinspection timeline. Its `editorNote` states the official Director's Rules PDF is the source but flags that the "Tenant guidelines PDF is internal reference" and asks for verification before publication — none of these specific figures have been checked line-by-line the way Phase 1 claims were.
- **`ownerGuidance`** carries a `content_review_flag` in the tracking sheet (*"Use rodent-proof materials as enforceable concept; examples may include steel wool with sealant, hardware cloth, copper mesh, sheet metal, mortar, or concrete"*) and `mockup_status: Blocked pending SME/legal review`. Its "Why it matters" section (Hantavirus, Leptospirosis, cockroach allergens, bird-dropping fungal spores) carries its own separate `editorNote` caveat to verify disease claims with the SFDPH vector program.
- **`ratsPrevent`, `cockroachesPrevent`, `mosquitoesPrevent`, `reduceMoisture`** each open with a "Why it matters" health-harm section (Hantavirus/Leptospirosis/salmonella for rats; asthma/allergens for cockroaches; West Nile virus for mosquitoes; mold/respiratory effects for moisture) that the page's own `editorNote` asks be checked against "current CDC/SFDPH guidance before publication" (three of the four explicitly say this; `reduceMoisture` has no `editorNote` at all despite similar health claims). The step-by-step IPM content (trap spacing, bleach dilution ratios, PPE, humidity percentages) reads as drawn from UC IPM-style guidance but is not tied to a specific source_doc_id anywhere in the page or the audit matrix.
- **`scopeInfo`** and **`tenantRights`** are lower-risk — mostly routing/navigation content (a "what does HHVC inspect" table, retaliation examples, Rent Board links) rather than new factual claims, though `tenantRights`'s external links (`SF Rent Board`, `Get tenant help`) carry a karl note to "verify active URLs before publication."

## 5. Tier 3 — Not in policy-audit scope (22 pages)

These pages were never entered into the audit process. Sub-grouping by function:

### 5.1 Navigation/hub pages (4): `reportHub`, `preventHub`, `recordsHub`, `ownerHub`
All are "Resource collection" type pages whose content is almost entirely cards linking to other pages, plus 1–2 short introductory paragraphs. Low factual-claim surface area; the main review question for these is navigation/IA correctness, not sourcing.

### 5.2 Records/lookup transactions (5): `findRecords`, `findViolations`, `findHotelRecords`, `findInspector`, `publicRecords`
Thin-content "landing pages" whose real function is a primary button to an external tool (`xnet.sfdph.org`, `sfdph.org/dph/EH/ResidentialHotels`, `sanfrancisco.nextrequest.com`). Two of the five self-report as blocked/placeholder:
- **`findHotelRecords`**: `editorNote` calls its external link an "SME placeholder... illustrative interim destination for mockup review; confirm the final xnet lookup entry point with HHVC before publication."
- **`findInspector`**: `editorNote` states a real district-inspector lookup "is still BLOCKED pending HHVC confirmation," so the page's only working CTA is a fallback link to general SF311 contact rather than any inspector-lookup tool — the most conservative treatment of a blocked dependency in the tool (no invented destination, just a real fallback).
`findRecords` and `findViolations` both point to the same external xnet URL and are functionally near-duplicates (`findViolations`'s own `editorNote` suggests "Consider merging... if editors prefer one combined lookup page").

### 5.3 `noticeOfViolation` (1)
Explicitly `BLOCKED` per its own `editorNote` — "confirm NOV templates, tenant-specific orders, appeal windows, and contact routes before publication" — and separately flags that its fee-sequencing detail (no fee on the initial notice or first reinspection; fee starts at the second reinspection/third visit) and the specific per-hour rates cited ($244/hour inspector, $223/hour technician, FY 2024–25) are "illustrative FY24-25 estimates" pending HHVC confirmation.

### 5.4 Additional report Transactions outside Phase 1 (3): `wnvBirdReport`, `pigeonsReport`, `garbageReport`
`pigeonsReport` and `garbageReport` are structurally identical to the Phase 1 report pages (same 311-first step, same 72-hour landlord-notice block, same privacy/retaliation callout, same "How your report is processed" block) but were never independently claim-audited — they inherit the same wording as the Phase 1 pages by copy-paste pattern, not by verification.
`wnvBirdReport` is the most explicitly self-flagged page in the tool: its `editorNote` states the pickup criteria, priority species list, seasonal workflow, and CDPH-to-HHVC routing are "illustrative example content for mockup review; confirm actual current HHVC protocol with SME before publication," and individual body sections repeat "(illustrative — confirm current routing with HHVC before publication)" inline.

### 5.5 Prevention Information pages outside Phase 2 (2): `vegetationInfo`, `garbageInfo`
Both were added alongside their Transaction-page counterparts and both carry an identical caveat pattern in their `editorNote`: "Illustrative mockup content for manager review; verify against current HHVC/DPH [vegetation/sanitation] guidance before publication." No specific source document is cited for either.

### 5.6 Program/outreach Information pages (2): `mosquitoControl`, `mosquitoWorkshop`
`mosquitoControl` is a links-and-contacts page (SFMosquito.org, WestNile.ca.gov, phone numbers) with a note to "verify phone numbers and external URLs before publication," but no factual/legal claims beyond routing.
`mosquitoWorkshop` is heavily self-flagged: "production form URL, intake backend, capacity, service area, lead time, and standards crosswalk below are illustrative example content for mockup review; confirm actual values with HHVC before publication." Specific numbers presented as if real — "up to about 60 students per session," "at least 3 weeks" lead time, a California-standards-alignment claim — are all inside that caveat.

### 5.7 Animal & vector Information pages (5): `raccoonInfo`, `pigeonInfo`, `miteInfo`, `waspInfo`, `flyInfo`
These are the newest pages in the tool (added 2026-07-04/05 per git history) and vary in traceability:
- **`waspInfo`** and **`flyInfo`** are the most transparent Tier 3 pages: each `editorNote` names a specific source file (`docs/source/hhvc-policy/2026-07-02-ipm-pests-yellowjackets.md` and `...-ipm-pests-flies.md`, both UC IPM Pest Notes) and flags that HHVC scope for the pest type still needs verification. This is traceable, self-disclosed sourcing — but it is UC ANR general pest-biology education, not an HHVC-specific policy document, and was never run through the audit-matrix process.
- **`raccoonInfo`** cites a live external CDC link directly in the page body (Baylisascaris/roundworm prevention guidance) and its `editorNote` says latrine-cleanup steps "follow CDC Baylisascaris guidance" but must be SME-verified, and explicitly states wildlife trapping is out of HHVC scope (routes to Animal Care & Control) — a scope boundary worth double-checking since no HHVC source document confirms HHVC's role here at all.
- **`pigeonInfo`** and **`miteInfo`** carry general "verify against SFDPH vector program"/"verify HHVC scope" cautions in their `editorNote`s but do not cite any specific source document — their disease claims (histoplasmosis, psittacosis for pigeon droppings; tropical rat mite bite dynamics) read as general public-health knowledge rather than HHVC or SFDPH-specific guidance.

None of the five have a corresponding Transaction ("report X") page — `waspInfo` and `flyInfo` explicitly note "No dedicated Transaction page exists" and route reports through `garbageReport`/`vegetationReport` instead, which is a scope decision worth a reviewer's attention (is a wasp sighting really best captured as a "garbage or clutter" report?).

## 6. Cross-cutting findings

### 6.1 "Why it matters" health-harm sections are a tool-wide, self-flagged verification gap
Eleven pages open with a "Why it matters" section making specific disease/health claims: `ownerGuidance` (Hantavirus, Leptospirosis), `ratsPrevent` (Hantavirus, Leptospirosis, salmonella), `cockroachesPrevent` (asthma/allergens), `mosquitoesPrevent` (West Nile virus), `reduceMoisture` (mold/respiratory effects), `bedBugsInfo` (skin/emotional harm), `raccoonInfo` (Baylisascaris/roundworm), `pigeonInfo` (histoplasmosis, psittacosis), `miteInfo` (tropical rat mite bites), `waspInfo` (anaphylaxis, multi-sting toxicity), `flyInfo` (bacterial/viral transmission). Every one of the eleven carries an explicit "verify disease-risk specifics with SFDPH vector program before publication" (or equivalent CDC/SFDPH) instruction in that section's own `karl` note — this caveat is real and consistently applied, it just usually lives at the section level rather than the page-level `editorNote`. `reduceMoisture` is the only one of the eleven with no page-level `editorNote` at all (its verify instruction exists only in the section `karl`); `bedBugsInfo` does have a page `editorNote`, but it covers the PDF source, not the health claim, so its verify instruction is likewise section-level only. This is a consistent authoring pattern (health-harm framing added "for depth" across most Information pages), not an isolated gap — a reviewer evaluating medical/scientific accuracy should treat it as one review item across all eleven pages rather than page-by-page.

### 6.2 Self-identified BLOCKED/SME-placeholder pages are undercounted in the tracking sheet
Five pages contain the literal strings `BLOCKED` or `SME placeholder`/`SME-blocked` in their own `editorNote`: `findHotelRecords`, `findInspector`, `noticeOfViolation`, `wnvBirdReport`, `mosquitoWorkshop`. `review/mockup_tracking_sheet.csv`'s `content_review_flag`/`mockup_status` columns, however, only surface **two** blocked pages (`wnvBirdReport` and `ownerGuidance` — the latter for a different, non-BLOCKED reason). This is because that column is populated from a small hand-maintained list (`CONTENT_REVIEW_FLAGS` in `build_scripts/sync-tracking-sheet.js`) rather than derived from the pages' own `editorNote` text. A reviewer relying solely on the tracking sheet's "Blocked" status would miss `findHotelRecords`, `findInspector`, `noticeOfViolation`, and `mosquitoWorkshop`.

### 6.3 Tooling gap: the tracking-sheet generator had a stale, separately-hardcoded file list (fixed)
`build_scripts/sync-tracking-sheet.js` maintains its own `PAGE_FILES` array (independent from the equivalent lists in `build_scripts/validate.js` and `build_scripts/extract-pages.js`, a duplication already called out in this repo's `CLAUDE.md`). As of the initial version of this review, that copy was missing six page files added since it was last updated: `report-a-problem.js`, `prevent-problems.js`, `prevent-overgrown-vegetation.js`, `prevent-garbage-clutter.js`, `ground-wasp-information.js`, `fly-information.js`. As a result, `review/mockup_tracking_sheet.csv` showed blank Title/Type/Slug/Source-file for `reportHub`, `preventHub`, `vegetationInfo`, `garbageInfo`, `waspInfo`, and `flyInfo` — not because those pages lacked content (see §5.1, §5.5, §5.7), but because the sheet-generation script never loaded their source files into its VM context. **This has since been fixed**: `PAGE_FILES` now matches `extract-pages.js`'s complete 39-file list, and a re-run of `bun run sync-tracking` confirms all six rows now populate correctly. `data/page_inventory.json` was never affected (it's generated from the separately-maintained, already-complete `extract-pages.js` list) and was used as this document's source of truth throughout.

### 6.4 Scope enforcement is automated but narrow
`build_scripts/validate.js` enforces that `pestsTopic` (the Topic page) contains none of six banned out-of-scope terms — `plumbing`, `dbi`, `roof leak`, `sewer`, `permit issue`, `construction defect` — reflecting that HHVC's mandate is Article 11 only. This check currently passes (`bun run validate` → "validated 39 pages"). Note the check only scans the Topic page's own text; it does not check the other 38 pages, and it does not validate that routing tables (e.g., `scopeInfo`'s "Problems HHVC may inspect" list, which now includes flies and ground wasps) stay internally consistent with what `pestsTopic` promises — that consistency currently holds by inspection, not by an automated check.

### 6.5 Primary-CTA completeness varies by page, for two different reasons
- Every report Transaction page's "Report through 311" button has no `buttonTarget`/`buttonUrl` at all (by design — this mockup tool does not simulate an actual 311 intake integration).
- `payFee`'s primary button ("Pay your Healthy Housing fee") also has no target, but for a different, tracked reason — its own `karl` note says the URL is "pending confirmed SF.gov online payment link; CTA is non-functional until added." This is a real open item, not a structural mockup omission like the 311 buttons above.

## 7. Full page inventory

| Page key | Title | Type | Tier | Notes |
| --- | --- | --- | --- | --- |
| pestsTopic | Pests and housing problems | Topic page | 1 | Audited; scope/fee framing verified |
| reportHub | Report a problem | Resource collection | 3 | Navigation hub only |
| preventHub | Prevent problems | Resource collection | 3 | Navigation hub only |
| recordsHub | Look up building records | Resource collection | 3 | Navigation hub only |
| findRecords | Find complaints and inspection records | Transaction | 3 | External xnet tool link |
| findViolations | Look up residential health code violations | Transaction | 3 | Near-duplicate of findRecords |
| findHotelRecords | Find residential hotel and shelter records | Transaction | 3 | SME placeholder / illustrative link |
| findInspector | Find your district inspector | Information | 3 | BLOCKED — falls back to real 311 contact |
| publicRecords | Make a public records request | Transaction | 3 | External NextRequest link |
| ownerHub | Property owner responsibilities | Resource collection | 3 | Navigation hub only |
| noticeOfViolation | How to respond to a notice of violation | Information | 3 | BLOCKED; illustrative fee sequencing |
| ratsReport | Report rats or mice | Transaction | 1 | Audited; see §3.2 drift note |
| cockroachesReport | Report cockroaches | Transaction | 1 | Audited; see §3.2 drift note |
| bedBugsReport | Report bed bugs | Transaction | 1 | Audited; see §3.2 drift note |
| bedBugsInfo | Bed bug rules and prevention | Information | 2 | Flagged, unaudited; most legally specific Tier 2 page |
| mosquitoesReport | Report mosquitoes in your home or backyard | Transaction | 1 | Audited; see §3.2 drift note |
| wnvBirdReport | Report a dead bird | Transaction | 3 | Most explicitly self-flagged illustrative page |
| pigeonsReport | Report pigeons | Transaction | 3 | Same template as Phase 1 pages, unaudited |
| garbageReport | Report garbage or clutter | Transaction | 3 | Same template as Phase 1 pages, unaudited |
| vegetationReport | Report overgrown vegetation | Transaction | 1 | Audited; summary reworded since audit, see §3.2 |
| moldReport | Report mold from humidity or condensation | Transaction | 1 | Audited; see §3.2 drift note |
| payFee | Pay your annual Healthy Housing fee | Transaction | 1 | Audited; primary CTA URL still pending |
| scopeInfo | Learn what HHVC can inspect | Information | 2 | Flagged, unaudited; routing/navigation focus |
| ownerGuidance | Integrated pest management for owners/managers | Information | 2 | Flagged, unaudited; content_review_flag + Blocked status |
| afterReport | What happens after you report | Information | 2 | Flagged, unaudited; specific compliance-deadline figures |
| tenantRights | Tenant rights when reporting housing conditions | Information | 2 | Flagged, unaudited; external link URLs need verification |
| ratsPrevent | Keep rats and mice out of your home | Information | 2 | Flagged, unaudited; health-harm claims need verification |
| cockroachesPrevent | Prevent cockroaches | Information | 2 | Flagged, unaudited; health-harm claims need verification |
| mosquitoesPrevent | Prevent mosquitoes | Information | 2 | Flagged, unaudited; health-harm claims need verification |
| vegetationInfo | Prevent overgrown vegetation | Information | 3 | Illustrative, no source cited |
| garbageInfo | Prevent garbage and clutter problems | Information | 3 | Illustrative, no source cited |
| mosquitoControl | Mosquito Control Program | Information | 3 | Links/contacts page; URLs need verification |
| mosquitoWorkshop | Free mosquito education workshop | Information | 3 | Heavily self-flagged illustrative (form, capacity, standards) |
| raccoonInfo | Raccoons and housing health | Information | 3 | Cites CDC directly; HHVC-scope claim unverified |
| pigeonInfo | Pigeons and housing health | Information | 3 | No specific source cited |
| miteInfo | Mites and housing health | Information | 3 | No specific source cited |
| waspInfo | Ground wasps and housing health | Information | 3 | Cites UC IPM Pest Notes 7450 directly |
| flyInfo | Flies and housing health | Information | 3 | Cites UC IPM Pest Notes 7457 directly |
| reduceMoisture | Reduce indoor moisture, condensation, and humidity | Information | 2 | Flagged, unaudited; no editorNote despite health claims |

## 8. Suggested next steps for whoever picks this up

1. Re-run the Phase 1 audit-matrix check against current content for the five pages identified in §3.2, or explicitly re-scope the "How your report is processed" block as a cross-page Phase item alongside `afterReport`.
2. Decide whether `afterReport`'s specific compliance-deadline and fine figures need the same illustrative caveat `noticeOfViolation` already carries for the same numbers.
3. ~~Fix or retire `build_scripts/sync-tracking-sheet.js`'s stale `PAGE_FILES` list (§6.3) so the tracking sheet reflects all 39 pages.~~ Done — `PAGE_FILES` now matches `extract-pages.js`.
4. Consider deriving `content_review_flag` from each page's own `editorNote` text (e.g., a simple `BLOCKED|SME` regex) instead of the hand-maintained `CONTENT_REVIEW_FLAGS` dictionary, so blocked pages can't silently fall out of the tracking sheet (§6.2).
5. Batch the "Why it matters" disease-claim verification (§6.1) as one review pass across all eleven affected pages rather than page-by-page.
