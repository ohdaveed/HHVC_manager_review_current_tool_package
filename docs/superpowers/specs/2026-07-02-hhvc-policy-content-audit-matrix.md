# HHVC policy content audit matrix

## Phase 1 pages

- `pestsTopic`
- `ratsReport`
- `cockroachesReport`
- `bedBugsReport`
- `mosquitoesReport`
- `vegetationReport`
- `moldReport`
- `payFee`

## Status legend

- `verified`
- `conflict`
- `missing_source`
- `editorial_only`

## Risk legend

- `high`
- `medium`
- `low`

| page_key | page_field | claim_text_current | policy_topic | source_doc_id | source_locator | status | risk_level | rewrite_directive | owner_note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| pestsTopic | summary | Get help with pests, mold, garbage, and other housing health problems. | scope | violation-master | Intro + PESTS/SANITATION/STRUCTURAL sections | verified | medium | Keep summary; listed issue families match Article 11 categories in master. | Topic summary sets the boundary for all downstream routing. |
| pestsTopic | sections[0].paragraphs[0] | Use this page to report or prevent problems that Healthy Housing and Vector Control may review under Article 11. | scope | violation-master | Intro: "Article 11 violation category" | verified | high | Keep Article 11 / HHVC framing; confirmed by master intro. | Core legal framing statement. |
| pestsTopic | sections[3].cards[2].text | Pay the program fee for residential buildings with 3 or more units. | fee/payment |  |  | missing_source | high | Do not keep unless fee-page authority confirms this framing. | Routes users into `payFee`. |
| ratsReport | sections[0].steps[1].title | If you rent, give 72 hours when possible | tenant notice timing | program-manager-72-hour | Stakeholder attestation — tenant notice before 311 | verified | high | Keep current; program manager confirms 72-hour gate. | Must align across report pages. |
| ratsReport | sections[0].steps[1].text[1] | If they do not respond or start fixing it within 72 hours, submit your report right away so it can be assigned for review. | tenant notice timing | program-manager-72-hour | Stakeholder attestation — tenant notice before 311 | verified | high | Keep current; program manager confirms 72-hour gate. | Step 2 body text; align across report pages. |
| ratsReport | sections[1].paragraphs[3] | Violations must be corrected and may require follow-up inspection. | enforcement pathway | violation-master | Rodents > What Happens Next | verified | high | Implemented; aligned to master template. | Cross-page enforcement parity. |
| ratsReport | sections[1].callout.text | Tenants have rights to safe and habitable housing. A property owner or manager cannot retaliate because a tenant reports housing conditions to the City. | anti-retaliation | sf-gov-housing-discrimination (reviewed) | Page covers discrimination/HRC only — not retaliation for 311 reporting | missing_source | high | Still blocked; need retaliation-for-reporting authority (e.g. Rent Ordinance Sec. 37.9(d) or program manager). | High-risk legal reassurance. |
| cockroachesReport | summary | Report an active cockroach problem in San Francisco. | scope | violation-master; ipm-cockroaches-7467 | Cockroaches (Sec 581(b)(8)) + IPM signs | verified | medium | Keep scope; cockroaches confirmed as Article 11 category. | Cockroach summary defines routing for cockroach issues. |
| cockroachesReport | sections[0].steps[1] | If you rent, give 72 hours when possible (+ Step 2 body) | tenant notice timing | program-manager-72-hour | Stakeholder attestation — tenant notice before 311 | verified | high | Keep current; program manager confirms 72-hour gate. | Same Step 2 pattern as ratsReport. |
| cockroachesReport | sections[1].paragraphs[3] | Violations must be corrected and may require follow-up inspection. | enforcement pathway | violation-master | Rodents > What Happens Next (template) | verified | high | Implemented; aligned to master template. | High-risk enforcement statement for parity across report pages. |
| cockroachesReport | sections[1].callout.text | Tenants have rights to safe and habitable housing. A property owner or manager cannot retaliate because a tenant reports housing conditions to the City. | anti-retaliation | sf-gov-housing-discrimination (reviewed) | Page covers discrimination/HRC only — not retaliation for 311 reporting | missing_source | high | Still blocked; need retaliation-for-reporting authority. | High-risk legal reassurance. |
| bedBugsReport | summary | Report an active bed bug problem in San Francisco rental housing. | scope | violation-master; ipm-bed-bugs-7454 | Bed Bugs (Sec 581(b)(8)) + IPM signs | verified | medium | Keep scope; bed bugs confirmed as Article 11 category. | Bed-bug reporting summary for bedBugsReport route. |
| bedBugsReport | sections[1].paragraphs[3] | Violations must be corrected and may require follow-up inspection. | enforcement pathway | violation-master | Rodents > What Happens Next (template) | verified | high | Implemented; aligned to master template. | High-risk enforcement statement for parity across report pages. |
| bedBugsReport | sections[0].steps[1] | If you rent, give 72 hours when possible (+ Step 2 body) | tenant notice timing | program-manager-72-hour | Stakeholder attestation — tenant notice before 311 | verified | high | Keep current; program manager confirms 72-hour gate. | Distinct from Director's Rules two-working-day owner investigation. |
| mosquitoesReport | summary | Report mosquitoes or standing water in San Francisco. | scope | violation-master; ipm-mosquitoes-7451 | Mosquitoes (Sec 581(b)(8)) + standing water IPM | verified | medium | Keep scope; mosquitoes and standing water confirmed. | Mosquito/standing-water summary defines routing for mosquitoesReport. |
| bedBugsReport | sections[2].paragraphs[0] | For detailed bed bug prevention and control rules, see the bed bug rules and prevention page. | bed bug rules | bed-bug-directors-rules-tenant-guidelines | Source cites Director's Rules; routes to bedBugsInfo | verified | high | Keep pointer; bedBugsInfo hosts Director's Rules reference. | Bed-bug-specific rules pointer. |
| mosquitoesReport | sections[0].steps[1] | If you rent, give 72 hours when possible (+ Step 2 body) | tenant notice timing | program-manager-72-hour | Stakeholder attestation — tenant notice before 311 | verified | high | Keep current; program manager confirms 72-hour gate. | Same Step 2 pattern as ratsReport. |
| mosquitoesReport | sections[1].paragraphs[2] | Violations must be corrected and may require follow-up inspection. | enforcement pathway | violation-master | Rodents > What Happens Next (template) | verified | high | Implemented; aligned to master template. | High-risk enforcement statement for parity across report pages. |
| mosquitoesReport | sections[1].callout.text | Tenants have rights to safe and habitable housing. A property owner or manager cannot retaliate because a tenant reports housing conditions to the City. | anti-retaliation | sf-gov-housing-discrimination (reviewed) | Page covers discrimination/HRC only — not retaliation for 311 reporting | missing_source | high | Still blocked; need retaliation-for-reporting authority. | High-risk legal reassurance. |
| vegetationReport | summary | Report garbage, clutter, or overgrown plants that may attract pests or vectors. | scope | violation-master; vegetation-overgrowth-notice | Overgrown Vegetation (master) + Sec. 581 notice | verified | medium | Keep summary; scope and pest/vector rationale confirmed. | Garbage/clutter summary defines routing for vegetationReport. |
| vegetationReport | sections[0].steps[1].title | If you rent, give 72 hours when possible | tenant notice timing | program-manager-72-hour | Stakeholder attestation — tenant notice before 311 | verified | high | Keep current; program manager confirms 72-hour gate. | Step 2 title; align across report pages. |
| vegetationReport | sections[0].steps[1].text[1] | If they do not respond or start fixing it within 72 hours, submit your report right away so it can be assigned for review. | tenant notice timing | program-manager-72-hour | Stakeholder attestation — tenant notice before 311 | verified | high | Keep current; program manager confirms 72-hour gate. | Step 2 body text; align across report pages. |
| vegetationReport | sections[1].cards[3].text | Find help if you are worried about retaliation. HHVC does not share the reporter’s identity with the property owner or manager. | anti-retaliation / privacy | sf-gov-housing-discrimination (reviewed) | Discrimination page does not cover retaliation-for-reporting or HHVC privacy | missing_source | high | Still blocked; retaliation needs reporting-specific authority; privacy needs Environmental Health 311 source. | Legal reassurance and privacy statement. |
| moldReport | summary | Report mold or moisture caused by humidity, condensation, or poor ventilation. | scope | violation-master | Mold Growth (Sec 581(b)(6)) | verified | medium | Keep scope; mold growth listed as Article 11 violation category. | Mold reporting summary defines routing for moldReport. |
| moldReport | sections[1].paragraphs[0] | Environmental Health may act when mold is growing on walls or ceilings and the affected area totals at least 10 square feet. | mold threshold / review scope | mold-moisture-guidance | SFDPH action threshold paragraph | verified | high | Implemented; aligned to SFDPH 10 sq ft walls/ceiling threshold. | High-risk threshold/scoping statement. |
| moldReport | sections[0].steps[1] | If you rent, give 72 hours when possible (+ Step 2 body) | tenant notice timing | program-manager-72-hour | Stakeholder attestation — tenant notice before 311 | verified | high | Keep current; program manager confirms 72-hour gate. | Same Step 2 pattern as ratsReport. |
| moldReport | sections[2].paragraphs[3] | Violations must be corrected and may require follow-up inspection. | enforcement pathway | violation-master | Rodents > What Happens Next (template) | verified | high | Implemented; aligned to master template. | High-risk enforcement statement for parity across report pages. |
| payFee | summary | Pay or learn about the Healthy Housing program fee for some San Francisco residential buildings. | fee/payment |  |  | missing_source | medium | Confirm this fee-summary phrasing matches confirmed fee authority before revising. | Routes users into payFee payment instructions. |
| payFee | sections[0].paragraphs[1] | Use the payment route listed on your notice when one is provided. | payment process |  |  | missing_source | high | Verify the payment-route instruction against approved payment guidance before revising. | Process instruction should match notice guidance. |
| payFee | sections[1].paragraphs[1] | A building with 3 units is exempt if one unit is occupied by the owner. | fee exemption rule |  |  | missing_source | high | Verify the exemption rule against approved Healthy Housing fee authority before revising. | Legal/fee exemption framing. |

## Supplementary reference (not used for Phase 1 audit rows)

| source_doc_id | title | note |
| --- | --- | --- |
| ipm-raccoons-74116 | UC IPM Pest Notes: Raccoons | No raccoon page in Phase 1 mockups; IPM education only |
| ipm-rats-74106 | UC IPM Pest Notes: Rats | Supports future `ratsPrevent` IPM content; not Phase 1 legal/process authority |
| ipm-house-mouse-7483 | UC IPM Pest Notes: House Mouse | Supports future `ratsPrevent` IPM content; not Phase 1 legal/process authority |
| vegetation-overgrowth-notice | SFDPH Vegetation Overgrowth Notice | Confirms Sec. 581 overgrowth scope and pest/vector shelter rationale for `vegetationReport` |
| mold-tenants-landlords-guidance | SFDPH Mold Guidance for Tenants and Landlords | Full mold IPM/responsibility guidance; companion to mold-moisture-guidance short form |
| ipm-mosquitoes-7451 | UC IPM Pest Notes: Mosquitoes | Supports future `mosquitoesPrevent` IPM content; standing water/breeding site rationale |
| ipm-flies-7457 | UC IPM Pest Notes: Flies | Aligns with violation-master Flies category; no Phase 1 mockup page |
| ipm-yellowjackets-7450 | UC IPM Pest Notes: Yellowjackets | Supplementary stinging-insect IPM; not in Phase 1 mockups |
| ipm-bed-bugs-7454 | UC IPM Pest Notes: Bed Bugs | IPM education only; does not satisfy Director's Rules requirement |
| ipm-cockroaches-7467 | UC IPM Pest Notes: Cockroaches | Supports future `cockroachesPrevent` IPM content |
| ipm-fleas-7419 | UC IPM Pest Notes: Fleas | Supplementary IPM; not in Phase 1 mockups or violation-master categories |
| ipm-itching-infestation-7443 | UC IPM Pest Notes: Itching and Infestation | Medical/education reference; not HHVC policy |
| ipm-lyme-disease-7485 | UC IPM Pest Notes: Lyme Disease in California | Tick/Lyme education; not in Phase 1 mockups |
| bed-bug-directors-rules-tenant-guidelines | SFDPH Bed Bug Director's Rules — Tenant Guidelines | Phase 1 authority for bed bug rules pointer on `bedBugsReport` |
| program-manager-72-hour | HHVC Program Manager — 72-hour tenant notice before 311 | Operational authority for Step 2 on all report Transaction pages |
| sf-gov-housing-discrimination | SF.gov — Get help for discrimination in housing | Fair-housing/HRC referral only; does not verify report-page anti-retaliation or privacy claims |
