# HHVC Program Manager — Reporter / Complainant Privacy

- **Source title:** Program manager operational guidance — complainant identity sharing limits
- **Authority:** HHVC program manager (stakeholder attestation)
- **Supplementary:** `2026-07-02-sf-gov-report-health-nuisance-or-hazards.md` — public records framing
- **Attestation date:** 2026-07-02 (updated with refined sharing limits)
- **Phase used:** Phase 1 (all `*Report` Transaction pages with reporter privacy language)
- **Format:** stakeholder intake note (no Drive export)

---

## Confirmed policy

Reporter identities are **only shared with the City Attorney's Office** and are **not shared in response to public records requests**.

Program manager confirms this operational practice for HHVC / Environmental Health housing complaints. This aligns with the official 311 Environmental Health page note that complaints are public records but reporter names are usually not shared for environmental health complaints — mockup copy uses the program's precise sharing limits.

## Approved mockup copy (privacy sentence)

> Reporter identities are only shared with the City Attorney's Office and are not shared in response to public records requests.

### Step 3 photo callout (full)

> Photos are not required. Describe the location and condition clearly. Reporter identities are only shared with the City Attorney's Office and are not shared in response to public records requests.

### Related card — privacy portion only

Combined card text keeps the retaliation intro (still blocked separately):

> Find help if you are worried about retaliation. Reporter identities are only shared with the City Attorney's Office and are not shared in response to public records requests.

## Mockup fields covered (Phase 1)

| page_key | Field paths |
| --- | --- |
| `ratsReport` | `sections[0].steps[2].callout.text`; related card *Tenant rights and reporting* |
| `cockroachesReport` | `sections[0].steps[2].callout.text`; related card *Tenant rights and reporting* |
| `bedBugsReport` | `sections[0].steps[2].callout.text`; related card *Tenant rights and reporting* |
| `mosquitoesReport` | `sections[0].steps[2].callout.text`; related card *Tenant rights and reporting* |
| `vegetationReport` | `sections[0].steps[2].callout.text`; related card *Tenant rights and reporting* |
| `moldReport` | `sections[0].steps[2].callout.text`; related card *Tenant rights and reporting* |

## Not covered by this attestation

- Anti-retaliation claims — see `2026-07-02-sf-rent-ordinance-sec-37-9-retaliation.md` (Rent Ordinance Sec. 37.9(d))
