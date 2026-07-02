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
| pestsTopic | summary | Get help with pests, mold, garbage, and other housing health problems. | scope |  |  | missing_source | medium | Confirm that all listed issue types are within HHVC / Article 11 scope before revising. | Topic summary sets the boundary for all downstream routing. |
| pestsTopic | sections[0].paragraphs[0] | Use this page to report or prevent problems that Healthy Housing and Vector Control may review under Article 11. | scope |  |  | missing_source | high | Verify Article 11 framing and HHVC program naming. | Core legal framing statement. |
| pestsTopic | sections[3].cards[2].text | Pay the program fee for residential buildings with 3 or more units. | fee/payment |  |  | missing_source | high | Do not keep unless fee-page authority confirms this framing. | Routes users into `payFee`. |
| ratsReport | sections[0].steps[1].title | If you rent, give 72 hours when possible | tenant notice timing |  |  | missing_source | high | Verify the 72-hour notice rule and when it applies. | Must align across report pages. |
| ratsReport | sections[1].paragraphs[3] | If HHVC finds a violation, the City may require the property owner or responsible party to correct it. | enforcement pathway |  |  | missing_source | high | Confirm enforcement wording and responsible-party language. | Cross-page enforcement parity. |
| ratsReport | sections[1].callout.text | Tenants have rights to safe and habitable housing. A property owner or manager cannot retaliate because a tenant reports housing conditions to the City. | anti-retaliation |  |  | missing_source | high | Verify tenant-rights wording before simplification. | High-risk legal reassurance. |
| cockroachesReport | summary | Report an active cockroach problem in San Francisco. | scope |  |  | missing_source | medium | Confirm this pest-specific scope claim is within HHVC / Article 11 scope before revising. | Cockroach summary defines routing for cockroach issues. |
| cockroachesReport | sections[1].paragraphs[3] | If HHVC finds a violation, the City may require the property owner or responsible party to correct it. | enforcement pathway |  |  | missing_source | high | Confirm enforcement wording and responsible-party language against approved policy before revising. | High-risk enforcement statement for parity across report pages. |
| cockroachesReport | sections[1].callout.text | Tenants have rights to safe and habitable housing. A property owner or manager cannot retaliate because a tenant reports housing conditions to the City. | anti-retaliation |  |  | missing_source | high | Verify tenant-rights and anti-retaliation wording against approved policy before revising. | High-risk legal reassurance. |
| bedBugsReport | summary | Report an active bed bug problem in San Francisco rental housing. | scope |  |  | missing_source | medium | Confirm this bed-bug scope claim is within HHVC / Article 11 scope before revising. | Bed-bug reporting summary for bedBugsReport route. |
| bedBugsReport | sections[1].paragraphs[3] | If HHVC finds a violation, the City may require the property owner or responsible party to correct it. | enforcement pathway |  |  | missing_source | high | Confirm enforcement wording and responsible-party language against approved policy before revising. | High-risk enforcement statement for parity across report pages. |
| bedBugsReport | sections[2].paragraphs[0] | For detailed bed bug prevention and control rules, see the bed bug rules and prevention page. | bed bug rules |  |  | missing_source | high | Verify bed bug rules routing and reference wording against approved Director's Rules source before revising. | Bed-bug-specific rules pointer. |
| mosquitoesReport | summary | Report mosquitoes or standing water in San Francisco. | scope |  |  | missing_source | medium | Confirm this vector-specific scope claim is within HHVC / Article 11 scope before revising. | Mosquito/standing-water summary defines routing for mosquitoesReport. |
| mosquitoesReport | sections[1].paragraphs[2] | If HHVC finds a violation, the City may require the property owner or responsible party to correct it. | enforcement pathway |  |  | missing_source | high | Confirm enforcement wording and responsible-party language against approved policy before revising. | High-risk enforcement statement for parity across report pages. |
| mosquitoesReport | sections[1].callout.text | Tenants have rights to safe and habitable housing. A property owner or manager cannot retaliate because a tenant reports housing conditions to the City. | anti-retaliation |  |  | missing_source | high | Verify tenant-rights and anti-retaliation wording against approved policy before revising. | High-risk legal reassurance. |
| vegetationReport | summary | Report garbage, clutter, or overgrown plants that may attract pests or vectors. | scope |  |  | missing_source | medium | Confirm this vegetation/garbage scope claim is within HHVC / Article 11 scope before revising. | Garbage/clutter summary defines routing for vegetationReport. |
| vegetationReport | sections[0].steps[1].text[1] | If they do not respond or start fixing it within 72 hours, submit your report right away so it can be assigned for review. | tenant notice timing |  |  | missing_source | high | Verify the 72-hour notice wording and assignment timing against approved policy before revising. | High-impact timeline language; align across report pages. |
| vegetationReport | sections[1].cards[3].text | Find help if you are worried about retaliation. HHVC does not share the reporter’s identity with the property owner or manager. | anti-retaliation |  |  | missing_source | high | Verify privacy/anti-retaliation wording against approved policy before revising. | Legal reassurance and privacy statement. |
| moldReport | summary | Report mold or moisture caused by humidity, condensation, or poor ventilation. | scope |  |  | missing_source | medium | Confirm this mold/moisture scope claim is within HHVC / Article 11 scope before revising. | Mold reporting summary defines routing for moldReport. |
| moldReport | sections[2].paragraphs[3] | If HHVC finds a violation, the City may require the property owner or responsible party to correct it. | enforcement pathway |  |  | missing_source | high | Confirm enforcement wording and responsible-party language against approved policy before revising. | High-risk enforcement statement for parity across report pages. |
| moldReport | sections[1].paragraphs[0] | HHVC may review mold when the affected area is about 10 square feet or more and may be linked to humidity, condensation, or poor ventilation. | mold threshold / review scope |  |  | missing_source | high | Verify mold threshold and scope language against approved policy before revising. | High-risk threshold/scoping statement. |
| payFee | summary | Pay or learn about the Healthy Housing program fee for some San Francisco residential buildings. | fee/payment |  |  | missing_source | medium | Confirm this fee-summary phrasing matches confirmed fee authority before revising. | Routes users into payFee payment instructions. |
| payFee | sections[0].paragraphs[1] | Use the payment route listed on your notice when one is provided. | payment process |  |  | missing_source | high | Verify the payment-route instruction against approved payment guidance before revising. | Process instruction should match notice guidance. |
| payFee | sections[1].paragraphs[1] | A building with 3 units is exempt if one unit is occupied by the owner. | fee exemption rule |  |  | missing_source | high | Verify the exemption rule against approved Healthy Housing fee authority before revising. | Legal/fee exemption framing. |
