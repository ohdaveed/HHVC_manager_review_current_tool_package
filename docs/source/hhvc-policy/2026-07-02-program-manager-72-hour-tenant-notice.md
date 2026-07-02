# HHVC Program Manager — 72-Hour Tenant Notice Before 311

- **Source title:** Program manager operational guidance — tenant notice before 311 reporting
- **Authority:** HHVC program manager (stakeholder attestation)
- **Attestation date:** 2026-07-02
- **Phase used:** Phase 1 (all `*Report` Transaction pages with Step 2 tenant notice)
- **Format:** stakeholder intake note (no Drive export)

---

## Confirmed policy

When a tenant rents the affected unit, they should **notify the property owner or manager first** and **wait 72 hours when possible** before submitting a 311 report to the City.

If the owner or manager does not respond or start fixing the problem within 72 hours, the tenant should submit the report right away so it can be assigned for review.

Tenants should **not wait 72 hours** when there is an urgent health or safety concern.

## Mockup fields covered

Applies consistently to Step 2 on these Transaction pages:

- `ratsReport` — `sections[0].steps[1]`
- `cockroachesReport` — `sections[0].steps[1]`
- `bedBugsReport` — `sections[0].steps[1]`
- `mosquitoesReport` — `sections[0].steps[1]`
- `vegetationReport` — `sections[0].steps[1]`
- `moldReport` — `sections[0].steps[1]`

## Distinction from other timelines

This rule governs **when a tenant may call 311** after notifying the owner. It is separate from:

- **SFDPH bed bug Director's Rules** — owner must contract a PCO to investigate within **two working days** of a tenant bed bug complaint (`2026-07-02-bed-bug-directors-rules-tenant-guidelines.md`)
- **Imminent hazard timelines** on `afterReport` (48–72 hours for urgent hazards)

No conflict: the 72-hour tenant-notice gate and owner investigation deadlines address different actors and steps in the process.
