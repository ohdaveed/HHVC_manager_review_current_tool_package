# HHVC policy-aligned copy rewrite spec

## Scope

This spec covers only the Topic page and Transaction pages:

- `pestsTopic`
- `ratsReport`
- `cockroachesReport`
- `bedBugsReport`
- `mosquitoesReport`
- `vegetationReport`
- `moldReport`
- `payFee`

Only claims marked `verified`, `conflict`, or `editorial_only` in the audit matrix can produce rewrite instructions. Claims marked `missing_source` stay blocked.

**Sources ingested 2026-07-02:** violation-pages master content; program manager attestations (72-hour notice, reporter privacy, tenant safe housing); SF Rent Ordinance Sec. 37.9(d); SF.gov environmental health 311 page; SF.gov Healthy Housing fee pay page; Health Code Sec. 609; SFDPH EHB fee schedule FY 2024–25; Controller fee certification FY 2025–26; supplementary IPM PDFs.

## page_key: pestsTopic

### Approved field changes

- `summary`
  - Current: Get help with pests, mold, garbage, and other housing health problems.
  - Replace with: *(keep current)*
  - Source: violation-master — Intro + PESTS/SANITATION/STRUCTURAL sections
  - Reason: Issue families match Article 11 categories in master.

- `sections[0].paragraphs[0]`
  - Current: Use this page to report or prevent problems that Healthy Housing and Vector Control may review under Article 11.
  - Replace with: *(keep current)*
  - Source: violation-master — Intro: "Article 11 violation category"
  - Reason: Article 11 / HHVC framing confirmed.

- `sections[3].cards[2].text`
  - Current: Pay the program fee for residential buildings with 3 or more units.
  - Replace with: Pay the annual Healthy Housing fee for apartment buildings with 3 or more rental units.
  - Source: sf-gov-pay-healthy-housing-fee; health-code-609
  - Reason: SF.gov and Health Code 609 base fee on rental units, not total building units.

### Blocked fields

- None.

### Acceptance checks

- Copy stays within current page structure.
- No unsupported legal/process claims were added.
- Related-card routing still points to existing page keys.

## page_key: ratsReport

### Approved field changes

- `sections[0].steps[1].title`
  - Current: If you rent, give 72 hours when possible
  - Replace with: *(keep current)*
  - Source: program-manager-72-hour — stakeholder attestation
  - Reason: Program manager confirms 72-hour tenant notice gate before 311.

- `sections[0].steps[1].text[1]`
  - Current: If they do not respond or start fixing it within 72 hours, submit your report right away so it can be assigned for review.
  - Replace with: *(keep current)*
  - Source: program-manager-72-hour — stakeholder attestation
  - Reason: Program manager confirms 72-hour tenant notice gate before 311.

- `sections[1].paragraphs[3]`
  - Current: If HHVC finds a violation, the City may require the property owner or responsible party to correct it.
  - Replace with: Violations must be corrected and may require follow-up inspection.
  - Source: violation-master — Rodents > What Happens Next
  - Reason: Align enforcement closing sentence to master template; removes unsupported HHVC/City/responsible-party phrasing.

- `sections[0].steps[2].callout.text` (privacy)
  - Current: HHVC does not share the reporter’s identity with the property owner or manager.
  - Replace with: Photos are not required. Describe the location and condition clearly. Reporter identities are only shared with the City Attorney's Office and are not shared in response to public records requests.
  - Source: program-manager-reporter-privacy; sf-gov-report-health-nuisance — PM attestation + 311 public-records note
  - Reason: Program manager confirms sharing limits; SF.gov page confirms public-records context for environmental health complaints.

- `sections[1].callout.text` (safe housing)
  - Current: Tenants have rights to safe and habitable housing.
  - Replace with: *(keep current)*
  - Source: program-manager-tenant-safe-housing — stakeholder attestation
  - Reason: Program manager confirms tenants have rights to safe housing.

- `sections[1].callout.text` (anti-retaliation)
  - Current: A property owner or manager cannot retaliate because a tenant reports housing conditions to the City.
  - Replace with: *(keep current)*
  - Source: sf-rent-ordinance-37-9d — Sec. 37.9(d)
  - Reason: Reporting housing conditions to the City is exercise of rights under the law; ordinance prohibits retaliatory acts.

- `sections[2].cards[3].text` (retaliation intro)
  - Current: Find help if you are worried about retaliation.
  - Replace with: *(keep current)*
  - Source: sf-rent-ordinance-37-9d — Sec. 37.9(d)
  - Reason: Educational routing to tenantRights; consistent with retaliation protections.

### Blocked fields

- None remaining for this page.

### Acceptance checks

- Copy stays within current page structure.
- No unsupported legal/process claims were added.
- Related-card routing still points to existing page keys.

## page_key: cockroachesReport

### Approved field changes

- `summary`
  - Current: Report an active cockroach problem in San Francisco.
  - Replace with: *(keep current)*
  - Source: violation-master — Cockroaches (Sec 581(b)(8))
  - Reason: Scope confirmed.

- `sections[0].steps[1]`
  - Current: If you rent, give 72 hours when possible (+ Step 2 body)
  - Replace with: *(keep current)*
  - Source: program-manager-72-hour — stakeholder attestation
  - Reason: Program manager confirms 72-hour tenant notice gate before 311.

- `sections[1].paragraphs[3]`
  - Current: If HHVC finds a violation, the City may require the property owner or responsible party to correct it.
  - Replace with: Violations must be corrected and may require follow-up inspection.
  - Source: violation-master — Rodents > What Happens Next (template)
  - Reason: Cross-page enforcement parity with master template.

- `sections[0].steps[2].callout.text` (privacy)
  - Current: HHVC does not share the reporter’s identity with the property owner or manager.
  - Replace with: Photos are not required. Describe the location and condition clearly. Reporter identities are only shared with the City Attorney's Office and are not shared in response to public records requests.
  - Source: program-manager-reporter-privacy; sf-gov-report-health-nuisance — PM attestation + 311 public-records note
  - Reason: Program manager confirms sharing limits; SF.gov page confirms public-records context for environmental health complaints.

- `sections[1].callout.text` (safe housing)
  - Current: Tenants have rights to safe and habitable housing.
  - Replace with: *(keep current)*
  - Source: program-manager-tenant-safe-housing — stakeholder attestation
  - Reason: Program manager confirms tenants have rights to safe housing.

- `sections[1].callout.text` (anti-retaliation)
  - Current: A property owner or manager cannot retaliate because a tenant reports housing conditions to the City.
  - Replace with: *(keep current)*
  - Source: sf-rent-ordinance-37-9d — Sec. 37.9(d)
  - Reason: Reporting housing conditions to the City is exercise of rights under the law; ordinance prohibits retaliatory acts.

- `sections[2].cards[3].text` (retaliation intro)
  - Current: Find help if you are worried about retaliation.
  - Replace with: *(keep current)*
  - Source: sf-rent-ordinance-37-9d — Sec. 37.9(d)
  - Reason: Educational routing to tenantRights; consistent with retaliation protections.

### Blocked fields

- None remaining for this page.

### Acceptance checks

- Copy stays within current page structure.
- No unsupported legal/process claims were added.
- Related-card routing still points to existing page keys.

## page_key: bedBugsReport

### Approved field changes

- `summary`
  - Current: Report an active bed bug problem in San Francisco rental housing.
  - Replace with: *(keep current)*
  - Source: violation-master — Bed Bugs (Sec 581(b)(8))
  - Reason: Scope confirmed.

- `sections[0].steps[1]`
  - Current: If you rent, give 72 hours when possible (+ Step 2 body)
  - Replace with: *(keep current)*
  - Source: program-manager-72-hour — stakeholder attestation
  - Reason: Program manager confirms 72-hour tenant notice gate before 311. Distinct from SFDPH bed bug Director's Rules two-working-day owner investigation deadline.

- `sections[1].paragraphs[3]`
  - Current: Violations must be corrected and may require follow-up inspection.
  - Replace with: *(keep current — implemented)*
  - Source: violation-master — Rodents > What Happens Next (template)
  - Reason: Cross-page enforcement parity with master template.

- `sections[2].paragraphs[0]`
  - Current: For detailed bed bug prevention and control rules, see the bed bug rules and prevention page.
  - Replace with: *(keep current)*
  - Source: bed-bug-directors-rules-tenant-guidelines — cites SFDPH Director's Rules; routes to `bedBugsInfo`
  - Reason: Rules pointer confirmed; bedBugsInfo page hosts Director's Rules reference.

- `sections[0].steps[2].callout.text` (privacy)
  - Current: HHVC does not share the reporter’s identity with the property owner or manager.
  - Replace with: Photos are not required. Describe the location and condition clearly. Reporter identities are only shared with the City Attorney's Office and are not shared in response to public records requests.
  - Source: program-manager-reporter-privacy; sf-gov-report-health-nuisance — PM attestation + 311 public-records note
  - Reason: Program manager confirms sharing limits; SF.gov page confirms public-records context for environmental health complaints.

- `sections[1].callout.text` (safe housing)
  - Current: Tenants have rights to safe and habitable housing.
  - Replace with: *(keep current)*
  - Source: program-manager-tenant-safe-housing — stakeholder attestation
  - Reason: Program manager confirms tenants have rights to safe housing.

- `sections[1].callout.text` (anti-retaliation)
  - Current: A property owner or manager cannot retaliate because a tenant reports housing conditions to the City.
  - Replace with: *(keep current)*
  - Source: sf-rent-ordinance-37-9d — Sec. 37.9(d)
  - Reason: Reporting housing conditions to the City is exercise of rights under the law; ordinance prohibits retaliatory acts.

- `sections[3].cards[3].text` (retaliation intro)
  - Current: Find help if you are worried about retaliation.
  - Replace with: *(keep current)*
  - Source: sf-rent-ordinance-37-9d — Sec. 37.9(d)
  - Reason: Educational routing to tenantRights; consistent with retaliation protections.

### Blocked fields

- None remaining for this page.

### Previously blocked (now resolved)

- Target field path: `sections[2].paragraphs[0]` — verified against SFDPH bed bug Director's Rules tenant guidelines.
- Target field path: `sections[0].steps[1]` — verified against program manager 72-hour tenant notice guidance.
- Target field path: `sections[0].steps[2].callout.text` (privacy) — verified against program manager reporter privacy attestation.
- Target field path: `sections[1].callout.text` (safe housing) — verified against program manager tenant safe housing attestation.

### Acceptance checks

- Copy stays within current page structure.
- No unsupported legal/process claims were added.
- Related-card routing still points to existing page keys.

## page_key: mosquitoesReport

### Approved field changes

- `summary`
  - Current: Report mosquitoes or standing water in San Francisco.
  - Replace with: *(keep current)*
  - Source: violation-master — Mosquitoes (Sec 581(b)(8))
  - Reason: Scope confirmed.

- `sections[0].steps[1]`
  - Current: If you rent, give 72 hours when possible (+ Step 2 body)
  - Replace with: *(keep current)*
  - Source: program-manager-72-hour — stakeholder attestation
  - Reason: Program manager confirms 72-hour tenant notice gate before 311.

- `sections[1].paragraphs[2]`
  - Current: If HHVC finds a violation, the City may require the property owner or responsible party to correct it.
  - Replace with: Violations must be corrected and may require follow-up inspection.
  - Source: violation-master — Rodents > What Happens Next (template)
  - Reason: Cross-page enforcement parity with master template.

- `sections[0].steps[2].callout.text` (privacy)
  - Current: HHVC does not share the reporter’s identity with the property owner or manager.
  - Replace with: Photos are not required. Describe the location and condition clearly. Reporter identities are only shared with the City Attorney's Office and are not shared in response to public records requests.
  - Source: program-manager-reporter-privacy; sf-gov-report-health-nuisance — PM attestation + 311 public-records note
  - Reason: Program manager confirms sharing limits; SF.gov page confirms public-records context for environmental health complaints.

- `sections[1].callout.text` (safe housing)
  - Current: Tenants have rights to safe and habitable housing.
  - Replace with: *(keep current)*
  - Source: program-manager-tenant-safe-housing — stakeholder attestation
  - Reason: Program manager confirms tenants have rights to safe housing.

- `sections[1].callout.text` (anti-retaliation)
  - Current: A property owner or manager cannot retaliate because a tenant reports housing conditions to the City.
  - Replace with: *(keep current)*
  - Source: sf-rent-ordinance-37-9d — Sec. 37.9(d)
  - Reason: Reporting housing conditions to the City is exercise of rights under the law; ordinance prohibits retaliatory acts.

- `sections[2].cards[3].text` (retaliation intro)
  - Current: Find help if you are worried about retaliation.
  - Replace with: *(keep current)*
  - Source: sf-rent-ordinance-37-9d — Sec. 37.9(d)
  - Reason: Educational routing to tenantRights; consistent with retaliation protections.

### Blocked fields

- None remaining for this page.

### Acceptance checks

- Copy stays within current page structure.
- No unsupported legal/process claims were added.
- Related-card routing still points to existing page keys.

## page_key: vegetationReport

### Approved field changes

- `summary`
  - Current: Report garbage, clutter, or overgrown plants that may attract pests or vectors.
  - Replace with: *(keep current)*
  - Source: violation-master — Garbage/Refuse/Debris + Overgrown Vegetation + Excessive Materials
  - Reason: Scope confirmed.

- `sections[0].steps[1].title`
  - Current: If you rent, give 72 hours when possible
  - Replace with: *(keep current)*
  - Source: program-manager-72-hour — stakeholder attestation
  - Reason: Program manager confirms 72-hour tenant notice gate before 311.

- `sections[0].steps[1].text[1]`
  - Current: If they do not respond or start fixing it within 72 hours, submit your report right away so it can be assigned for review.
  - Replace with: *(keep current)*
  - Source: program-manager-72-hour — stakeholder attestation
  - Reason: Program manager confirms 72-hour tenant notice gate before 311.

- `sections[0].steps[2].callout.text` (privacy)
  - Current: HHVC does not share the reporter’s identity with the property owner or manager.
  - Replace with: Photos are not required. Describe the location and condition clearly. Reporter identities are only shared with the City Attorney's Office and are not shared in response to public records requests.
  - Source: program-manager-reporter-privacy; sf-gov-report-health-nuisance — PM attestation + 311 public-records note
  - Reason: Program manager confirms sharing limits; SF.gov page confirms public-records context for environmental health complaints.

- `sections[1].cards[3].text` (retaliation intro)
  - Current: Find help if you are worried about retaliation.
  - Replace with: *(keep current)*
  - Source: sf-rent-ordinance-37-9d — Sec. 37.9(d)
  - Reason: Educational routing to tenantRights; consistent with retaliation protections.

- `sections[1].cards[3].text` (privacy)
  - Current: HHVC does not share the reporter’s identity with the property owner or manager.
  - Replace with: Find help if you are worried about retaliation. Reporter identities are only shared with the City Attorney's Office and are not shared in response to public records requests.
  - Source: program-manager-reporter-privacy; sf-gov-report-health-nuisance — PM attestation + 311 public-records note
  - Reason: Privacy and retaliation intro on tenant-rights related card; both verified.

### Blocked fields

- None remaining for this page.

### Acceptance checks

- Copy stays within current page structure.
- No unsupported legal/process claims were added.
- Related-card routing still points to existing page keys.

## page_key: moldReport

### Approved field changes

- `summary`
  - Current: Report mold or moisture caused by humidity, condensation, or poor ventilation.
  - Replace with: *(keep current)*
  - Source: violation-master — Mold Growth (Sec 581(b)(6))
  - Reason: Scope confirmed.

- `sections[0].steps[1]`
  - Current: If you rent, give 72 hours when possible (+ Step 2 body)
  - Replace with: *(keep current)*
  - Source: program-manager-72-hour — stakeholder attestation
  - Reason: Program manager confirms 72-hour tenant notice gate before 311.

- `sections[0].steps[2].callout.text` (privacy)
  - Current: HHVC does not share the reporter’s identity with the property owner or manager.
  - Replace with: Photos are not required. Describe the location and condition clearly. Reporter identities are only shared with the City Attorney's Office and are not shared in response to public records requests.
  - Source: program-manager-reporter-privacy; sf-gov-report-health-nuisance — PM attestation + 311 public-records note
  - Reason: Program manager confirms sharing limits; SF.gov page confirms public-records context for environmental health complaints.

- `sections[1].callout.text` (safe housing)
  - Current: Tenants have rights to safe and habitable housing.
  - Replace with: *(keep current)*
  - Source: program-manager-tenant-safe-housing — stakeholder attestation
  - Reason: Program manager confirms tenants have rights to safe housing.

- `sections[1].callout.text` (anti-retaliation)
  - Current: A property owner or manager cannot retaliate because a tenant reports housing conditions to the City.
  - Replace with: *(keep current)*
  - Source: sf-rent-ordinance-37-9d — Sec. 37.9(d)
  - Reason: Reporting housing conditions to the City is exercise of rights under the law; ordinance prohibits retaliatory acts.

- `sections[2].cards[3].text` (retaliation intro)
  - Current: Find help if you are worried about retaliation.
  - Replace with: *(keep current)*
  - Source: sf-rent-ordinance-37-9d — Sec. 37.9(d)
  - Reason: Educational routing to tenantRights; consistent with retaliation protections.

- `sections[1].paragraphs[0]`
  - Current: HHVC may review mold when the affected area is about 10 square feet or more and may be linked to humidity, condensation, or poor ventilation.
  - Replace with: Environmental Health may act when mold is growing on walls or ceilings and the affected area totals at least 10 square feet.
  - Source: mold-moisture-guidance — SFDPH action threshold paragraph
  - Reason: Source confirms 10 sq ft threshold on walls/ceiling; aligns program naming with SFDPH/Environmental Health.

- `sections[2].paragraphs[3]`
  - Current: Violations must be corrected and may require follow-up inspection.
  - Replace with: *(keep current — implemented)*
  - Source: violation-master — Rodents > What Happens Next (template)
  - Reason: Cross-page enforcement parity with master template.

### Blocked fields

- None remaining for this page.

### Previously blocked (now resolved)

- Target field path: `sections[2].paragraphs[3]` — enforcement wording updated in prior commit.
- Target field path: `sections[1].callout.text` (safe housing) — verified against program manager tenant safe housing attestation.
- Target field path: `sections[1].callout.text` (anti-retaliation) — verified against Rent Ordinance Sec. 37.9(d).

### Acceptance checks

- Copy stays within current page structure.
- No unsupported legal/process claims were added.
- Related-card routing still points to existing page keys.

## page_key: payFee

### Approved field changes

- `title`
  - Current: Pay your Healthy Housing fee for buildings with 3 or more units
  - Replace with: Pay your annual Healthy Housing fee for apartment buildings
  - Source: sf-gov-pay-healthy-housing-fee
  - Reason: Matches SF.gov service title and rental-unit scope.

- `summary`
  - Current: Pay or learn about the Healthy Housing program fee for some San Francisco residential buildings.
  - Replace with: Pay or learn about the annual Healthy Housing program fee for San Francisco apartment buildings with 3 or more rental units.
  - Source: sf-gov-pay-healthy-housing-fee
  - Reason: Aligns summary to SF.gov pay page scope.

- `sections[0].paragraphs[0]`
  - Current: Have your notice, property address, or account information ready before you start.
  - Replace with: Have your invoice, property address, or account information ready before you start.
  - Source: sf-gov-pay-healthy-housing-fee — annual mailed invoice
  - Reason: SF.gov billing is invoice-based.

- `sections[0].paragraphs[1]`
  - Current: Use the payment route listed on your notice when one is provided.
  - Replace with: Use the payment method listed on your annual invoice when one is provided.
  - Source: sf-gov-pay-healthy-housing-fee — payment methods on invoice
  - Reason: Matches SF.gov payment guidance.

- `sections[1].paragraphs[0]`
  - Current: Healthy Housing program fees may apply to residential buildings with 3 or more units.
  - Replace with: You need to pay this fee if you own an apartment building with 3 or more rental units.
  - Source: sf-gov-pay-healthy-housing-fee; health-code-609
  - Reason: Rental-unit applicability confirmed.

- `sections[1].paragraphs[1]`
  - Current: A building with 3 units is exempt if one unit is occupied by the owner.
  - Replace with: If fewer than 3 units are rented during the billing year, you do not need to pay the fee.
  - Source: sf-gov-pay-healthy-housing-fee; health-code-609
  - Reason: Corrects incorrect owner-occupancy exemption; SF.gov uses rented-unit count.

- `sections[1].paragraphs[2]` *(new)*
  - Replace with: Check your invoice for the exact amount. The number of rental units determines your fee.
  - Source: sf-gov-pay-healthy-housing-fee
  - Reason: SF.gov directs owners to invoice for exact amount; fee tiers vary by Controller adjustment.

- `sections[2].paragraphs[0]`
  - Current: Use the approved SF.gov payment or billing route to pay your Healthy Housing fee.
  - Replace with: Pay online, in person at City Hall Room 1401, or by mail using the instructions on your invoice.
  - Source: sf-gov-pay-healthy-housing-fee — Pay online / in-person / by mail
  - Reason: Lists confirmed SF.gov payment routes.

- `sections[3].paragraphs[0]`
  - Current: Use the contact or help route listed on the final SF.gov fee page or payment notice.
  - Replace with: Use the contact information on your invoice or call Environmental Health at 415-252-3800.
  - Source: sf-gov-pay-healthy-housing-fee — Contact us
  - Reason: Confirmed help contact from SF.gov.

- `metaDescription`
  - Replace with: Pay or learn about the annual Healthy Housing fee for San Francisco apartment buildings with 3 or more rental units.
  - Source: sf-gov-pay-healthy-housing-fee
  - Reason: Matches updated page scope.

### Blocked fields

- `sections[2].button` / `buttonTarget` — SF.gov lists "Pay online" but mockup has no confirmed payment URL yet; button remains non-functional until HHVC supplies link.

### Acceptance checks

- Copy stays within current page structure.
- No unsupported legal/process claims were added.
- Related-card routing still points to existing page keys.
