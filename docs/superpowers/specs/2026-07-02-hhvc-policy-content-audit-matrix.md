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
| ratsReport | sections[0].steps[1].title | If you rent, give 72 hours when possible | tenant notice timing |  |  | missing_source | high | Verify the 72-hour notice rule and when it applies. | Must align across report pages. |
| ratsReport | sections[1].paragraphs[3] | If HHVC finds a violation, the City may require the property owner or responsible party to correct it. | enforcement pathway | violation-master | Rodents > What Happens Next | conflict | high | Master says "Violations must be corrected and may require follow-up inspection" without HHVC/City/responsible-party language. Align or add supporting HHVC process source. | Cross-page enforcement parity. |
| ratsReport | sections[1].callout.text | Tenants have rights to safe and habitable housing. A property owner or manager cannot retaliate because a tenant reports housing conditions to the City. | anti-retaliation |  |  | missing_source | high | Verify tenant-rights wording before simplification. | High-risk legal reassurance. |
| cockroachesReport | summary | Report an active cockroach problem in San Francisco. | scope | violation-master | Cockroaches (Sec 581(b)(8)) | verified | medium | Keep scope; cockroaches listed as Article 11 violation category. | Cockroach summary defines routing for cockroach issues. |
| cockroachesReport | sections[1].paragraphs[3] | If HHVC finds a violation, the City may require the property owner or responsible party to correct it. | enforcement pathway | violation-master | Rodents > What Happens Next (template) | conflict | high | Master template enforcement wording differs; cockroaches section lacks explicit What Happens Next. Align to master template or add HHVC process source. | High-risk enforcement statement for parity across report pages. |
| cockroachesReport | sections[1].callout.text | Tenants have rights to safe and habitable housing. A property owner or manager cannot retaliate because a tenant reports housing conditions to the City. | anti-retaliation |  |  | missing_source | high | Verify tenant-rights and anti-retaliation wording against approved policy before revising. | High-risk legal reassurance. |
| bedBugsReport | summary | Report an active bed bug problem in San Francisco rental housing. | scope | violation-master | Bed Bugs (Sec 581(b)(8)) | verified | medium | Keep scope; bed bugs listed as Article 11 violation category. | Bed-bug reporting summary for bedBugsReport route. |
| bedBugsReport | sections[1].paragraphs[3] | If HHVC finds a violation, the City may require the property owner or responsible party to correct it. | enforcement pathway | violation-master | Rodents > What Happens Next (template) | conflict | high | Master template enforcement wording differs; bed bugs section lacks explicit What Happens Next. Align to master template or add HHVC process source. | High-risk enforcement statement for parity across report pages. |
| bedBugsReport | sections[2].paragraphs[0] | For detailed bed bug prevention and control rules, see the bed bug rules and prevention page. | bed bug rules |  |  | missing_source | high | Verify bed bug rules routing and reference wording against approved Director's Rules source before revising. | Bed-bug-specific rules pointer. |
| mosquitoesReport | summary | Report mosquitoes or standing water in San Francisco. | scope | violation-master | Mosquitoes (Sec 581(b)(8)) | verified | medium | Keep scope; mosquitoes listed as Article 11 violation category. | Mosquito/standing-water summary defines routing for mosquitoesReport. |
| mosquitoesReport | sections[1].paragraphs[2] | If HHVC finds a violation, the City may require the property owner or responsible party to correct it. | enforcement pathway | violation-master | Rodents > What Happens Next (template) | conflict | high | Master template enforcement wording differs; mosquitoes section lacks explicit What Happens Next. Align to master template or add HHVC process source. | High-risk enforcement statement for parity across report pages. |
| mosquitoesReport | sections[1].callout.text | Tenants have rights to safe and habitable housing. A property owner or manager cannot retaliate because a tenant reports housing conditions to the City. | anti-retaliation |  |  | missing_source | high | Verify tenant-rights and anti-retaliation wording against approved policy before revising. | High-risk legal reassurance. |
| vegetationReport | summary | Report garbage, clutter, or overgrown plants that may attract pests or vectors. | scope | violation-master | Garbage/Refuse/Debris + Overgrown Vegetation + Excessive Materials | verified | medium | Keep scope; sanitation/vegetation/clutter categories confirmed in master. | Garbage/clutter summary defines routing for vegetationReport. |
| vegetationReport | sections[0].steps[1].text[1] | If they do not respond or start fixing it within 72 hours, submit your report right away so it can be assigned for review. | tenant notice timing |  |  | missing_source | high | Verify the 72-hour notice wording and assignment timing against approved policy before revising. | High-impact timeline language; align across report pages. |
| vegetationReport | sections[1].cards[3].text | Find help if you are worried about retaliation. HHVC does not share the reporter’s identity with the property owner or manager. | anti-retaliation |  |  | missing_source | high | Verify privacy/anti-retaliation wording against approved policy before revising. | Legal reassurance and privacy statement. |
| moldReport | summary | Report mold or moisture caused by humidity, condensation, or poor ventilation. | scope | violation-master | Mold Growth (Sec 581(b)(6)) | verified | medium | Keep scope; mold growth listed as Article 11 violation category. | Mold reporting summary defines routing for moldReport. |
| moldReport | sections[2].paragraphs[3] | If HHVC finds a violation, the City may require the property owner or responsible party to correct it. | enforcement pathway | violation-master | Rodents > What Happens Next (template) | conflict | high | Master template enforcement wording differs; mold section lacks explicit What Happens Next. Align to master template or add HHVC process source. | High-risk enforcement statement for parity across report pages. |
| moldReport | sections[1].paragraphs[0] | HHVC may review mold when the affected area is about 10 square feet or more and may be linked to humidity, condensation, or poor ventilation. | mold threshold / review scope | violation-master | Mold Growth signs: "visible mold" only | conflict | high | Master does not specify 10 sq ft threshold. Remove or replace threshold unless supported by inspection policy source. | High-risk threshold/scoping statement. |
| payFee | summary | Pay or learn about the Healthy Housing program fee for some San Francisco residential buildings. | fee/payment |  |  | missing_source | medium | Confirm this fee-summary phrasing matches confirmed fee authority before revising. | Routes users into payFee payment instructions. |
| payFee | sections[0].paragraphs[1] | Use the payment route listed on your notice when one is provided. | payment process |  |  | missing_source | high | Verify the payment-route instruction against approved payment guidance before revising. | Process instruction should match notice guidance. |
| payFee | sections[1].paragraphs[1] | A building with 3 units is exempt if one unit is occupied by the owner. | fee exemption rule |  |  | missing_source | high | Verify the exemption rule against approved Healthy Housing fee authority before revising. | Legal/fee exemption framing. |

## Supplementary reference (not used for Phase 1 audit rows)

| source_doc_id | title | note |
| --- | --- | --- |
| ipm-raccoons-74116 | UC IPM Pest Notes: Raccoons | No raccoon page in Phase 1 mockups; IPM education only |
