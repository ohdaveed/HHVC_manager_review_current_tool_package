# HHVC Program Manager — Tenant Safe Housing Rights

- **Source title:** Program manager operational guidance — tenant rights to safe housing
- **Authority:** HHVC program manager (stakeholder attestation)
- **Attestation date:** 2026-07-02
- **Phase used:** Phase 1 (`*Report` Transaction pages with tenant-rights callout in *What happens next*)
- **Format:** stakeholder intake note (no Drive export)

---

## Confirmed policy

Tenants **have the right to safe housing**.

Mockup copy uses expanded phrasing: *"Tenants have rights to safe and habitable housing."* Program manager attestation confirms the underlying rights framing; *habitable* is standard housing-rights language and requires no copy change for Phase 1.

## Mockup fields covered (Phase 1)

First sentence of the *What happens next* callout on these Transaction pages:

| page_key | Field path |
| --- | --- |
| `ratsReport` | `sections[1].callout.text` (safe housing rights) |
| `cockroachesReport` | `sections[1].callout.text` (safe housing rights) |
| `bedBugsReport` | `sections[1].callout.text` (safe housing rights) |
| `mosquitoesReport` | `sections[1].callout.text` (safe housing rights) |
| `moldReport` | `sections[1].callout.text` (safe housing rights) |

## Not covered by this attestation

- **Anti-retaliation sentence** in the same callout: *"A property owner or manager cannot retaliate because a tenant reports housing conditions to the City."* — needs separate authority (e.g. Rent Ordinance Sec. 37.9(d) or program manager attestation).
- Related-card intro *"Find help if you are worried about retaliation"* on `vegetationReport` and other pages.

## Distinction from fair-housing discrimination page

The SF.gov [Get help for discrimination in housing](https://www.sf.gov/information--get-help-discrimination-housing) page addresses protected-class discrimination, not general tenant safe-housing rights or retaliation for 311 reporting.
