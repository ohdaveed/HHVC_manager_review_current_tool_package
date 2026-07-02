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

**Sources ingested 2026-07-02:** `docs/source/hhvc-policy/2026-07-02-violation-pages-master-content.md`, `docs/source/hhvc-policy/2026-07-02-ipm-pests-raccoons.pdf` (supplementary only).

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

### Blocked fields

- Target field path: `sections[3].cards[2].text`
  - Current text (exact): Pay the program fee for residential buildings with 3 or more units.
  - Block reason: missing source
  - Required source: Healthy Housing fee authority

### Acceptance checks

- Copy stays within current page structure.
- No unsupported legal/process claims were added.
- Related-card routing still points to existing page keys.

## page_key: ratsReport

### Approved field changes

- `sections[1].paragraphs[3]`
  - Current: If HHVC finds a violation, the City may require the property owner or responsible party to correct it.
  - Replace with: Violations must be corrected and may require follow-up inspection.
  - Source: violation-master — Rodents > What Happens Next
  - Reason: Align enforcement closing sentence to master template; removes unsupported HHVC/City/responsible-party phrasing.

### Blocked fields

- Target field path: `sections[0].steps[1].title`
  - Current text (exact): If you rent, give 72 hours when possible
  - Block reason: missing source
  - Required source: tenant-notice / 72-hour guidance

- Target field path: `sections[1].callout.text`
  - Current text (exact): Tenants have rights to safe and habitable housing. A property owner or manager cannot retaliate because a tenant reports housing conditions to the City.
  - Block reason: missing source
  - Required source: anti-retaliation / tenant-rights authority

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

- `sections[1].paragraphs[3]`
  - Current: If HHVC finds a violation, the City may require the property owner or responsible party to correct it.
  - Replace with: Violations must be corrected and may require follow-up inspection.
  - Source: violation-master — Rodents > What Happens Next (template)
  - Reason: Cross-page enforcement parity with master template.

### Blocked fields

- Target field path: `sections[1].callout.text`
  - Current text (exact): Tenants have rights to safe and habitable housing. A property owner or manager cannot retaliate because a tenant reports housing conditions to the City.
  - Block reason: missing source
  - Required source: anti-retaliation / tenant-rights authority

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

- `sections[1].paragraphs[3]`
  - Current: If HHVC finds a violation, the City may require the property owner or responsible party to correct it.
  - Replace with: Violations must be corrected and may require follow-up inspection.
  - Source: violation-master — Rodents > What Happens Next (template)
  - Reason: Cross-page enforcement parity with master template.

### Blocked fields

- Target field path: `sections[2].paragraphs[0]`
  - Current text (exact): For detailed bed bug prevention and control rules, see the bed bug rules and prevention page.
  - Block reason: missing source
  - Required source: bed bug Director's Rules source

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

- `sections[1].paragraphs[2]`
  - Current: If HHVC finds a violation, the City may require the property owner or responsible party to correct it.
  - Replace with: Violations must be corrected and may require follow-up inspection.
  - Source: violation-master — Rodents > What Happens Next (template)
  - Reason: Cross-page enforcement parity with master template.

### Blocked fields

- Target field path: `sections[1].callout.text`
  - Current text (exact): Tenants have rights to safe and habitable housing. A property owner or manager cannot retaliate because a tenant reports housing conditions to the City.
  - Block reason: missing source
  - Required source: anti-retaliation / tenant-rights authority

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

### Blocked fields

- Target field path: `sections[0].steps[1].text[1]`
  - Current text (exact): If they do not respond or start fixing it within 72 hours, submit your report right away so it can be assigned for review.
  - Block reason: missing source
  - Required source: tenant-notice / 72-hour guidance

- Target field path: `sections[1].cards[3].text`
  - Current text (exact): Find help if you are worried about retaliation. HHVC does not share the reporter’s identity with the property owner or manager.
  - Block reason: missing source
  - Required source: anti-retaliation / privacy authority

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

### Acceptance checks

- Copy stays within current page structure.
- No unsupported legal/process claims were added.
- Related-card routing still points to existing page keys.

## page_key: payFee

### Approved field changes

- No approved field changes.

### Blocked fields

- Target field path: `summary`
  - Current text (exact): Pay or learn about the Healthy Housing program fee for some San Francisco residential buildings.
  - Block reason: missing source
  - Required source: Healthy Housing fee authority

- Target field path: `sections[0].paragraphs[1]`
  - Current text (exact): Use the payment route listed on your notice when one is provided.
  - Block reason: missing source
  - Required source: payment guidance

- Target field path: `sections[1].paragraphs[1]`
  - Current text (exact): A building with 3 units is exempt if one unit is occupied by the owner.
  - Block reason: missing source
  - Required source: Healthy Housing fee exemption rules

### Acceptance checks

- Copy stays within current page structure.
- No unsupported legal/process claims were added.
- Related-card routing still points to existing page keys.
