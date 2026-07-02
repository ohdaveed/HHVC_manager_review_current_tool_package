# HHVC Program Manager — Reporter / Complainant Privacy

- **Source title:** Program manager operational guidance — complainant identity not shared with property owner
- **Authority:** HHVC program manager (stakeholder attestation)
- **Attestation date:** 2026-07-02
- **Phase used:** Phase 1 (all `*Report` Transaction pages with reporter privacy language)
- **Format:** stakeholder intake note (no Drive export)

---

## Confirmed policy

HHVC **does not share the complainant's identity** with the property owner or manager.

Mockup copy uses equivalent wording: *"HHVC does not share the reporter's identity with the property owner or manager."*

## Mockup fields covered (Phase 1)

Privacy sentence appears on all six report Transaction pages:

| page_key | Field paths |
| --- | --- |
| `ratsReport` | `sections[0].steps[2].callout.text`; related card *Tenant rights and reporting* |
| `cockroachesReport` | `sections[0].steps[2].callout.text`; related card *Tenant rights and reporting* |
| `bedBugsReport` | `sections[0].steps[2].callout.text`; related card *Tenant rights and reporting* |
| `mosquitoesReport` | `sections[0].steps[2].callout.text`; related card *Tenant rights and reporting* |
| `vegetationReport` | `sections[0].steps[2].callout.text`; related card *Tenant rights and reporting* |
| `moldReport` | `sections[0].steps[2].callout.text`; related card *Tenant rights and reporting* |

## Distinction from SF.gov Environmental Health page

The official [Report a health nuisance or hazards](https://www.sf.gov/report-health-nuisance-or-hazards) page states: *"Complaints are public records. Your name is usually not shared for complaints about environmental health."*

Program manager attestation uses stronger operational wording (*does not share*) consistent with existing mockup copy. No copy change required for Phase 1.

## Not covered by this attestation

- Anti-retaliation claims (*"cannot retaliate because a tenant reports housing conditions to the City"*)
- Combined related-card intro (*"Find help if you are worried about retaliation"*) — still needs separate authority
