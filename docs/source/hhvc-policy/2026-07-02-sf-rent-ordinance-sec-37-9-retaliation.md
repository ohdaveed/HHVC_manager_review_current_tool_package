# SF Rent Ordinance Sec. 37.9(d) — Retaliation

- **Source title:** Sec. 37.9 - Evictions (subsection d — retaliation)
- **Authority:** San Francisco Administrative Code / Rent Ordinance
- **Original URL:** https://www.sf.gov/information--sec-379-evictions
- **Export date:** 2026-07-02
- **Phase used:** Phase 1 anti-retaliation callouts on report Transaction pages

---

## Sec. 37.9(d) — Retaliation (extract)

> No landlord may cause a tenant to quit involuntarily or threaten to bring any action to recover possession, or decrease any services, or increase the rent, or take any other action where the landlord's dominant motive is retaliation for the tenant's exercise of any rights under the law. Such retaliation shall be a defense to any action to recover possession. In an action to recover possession of a rental unit, proof of the exercise by the tenant of rights under the law within six months prior to the alleged act of retaliation shall create a rebuttable presumption that the landlord's act was retaliatory.

## Audit relevance

### Supports (Phase 1 mockup copy — keep current)

- **Report-page callout:** *"A property owner or manager cannot retaliate because a tenant reports housing conditions to the City."*
  - Reporting housing conditions to the City is exercise of rights under the law; ordinance prohibits retaliatory acts (eviction threats, service cuts, rent increases, etc.) with retaliatory dominant motive.

- **Related-card routing:** *"Find help if you are worried about retaliation."*
  - Educational routing to `tenantRights`; consistent with ordinance retaliation protections and tenant support resources.

### Mockup fields covered

| page_key | Field path |
| --- | --- |
| `ratsReport` | `sections[1].callout.text` (anti-retaliation); related card *Tenant rights and reporting* (retaliation intro) |
| `cockroachesReport` | same pattern |
| `bedBugsReport` | same pattern |
| `mosquitoesReport` | same pattern |
| `vegetationReport` | same pattern |
| `moldReport` | same pattern |

### Notes

- Ordinance uses **landlord**; mockup uses **property owner or manager** — plain-language equivalent for HHVC audience.
- Ordinance frames retaliation as a **defense in eviction actions**; mockup uses simpler preventive reassurance appropriate for Grade 5–6 report pages.
- Rent Board does not adjudicate retaliation claims directly; tenants may need Rent Board, legal aid, or court — `tenantRights` page handles routing.

## Does not cover

- Healthy Housing **fee** payment URL for live `payFee` button — still need confirmed online payment link (`buttonTarget`)
