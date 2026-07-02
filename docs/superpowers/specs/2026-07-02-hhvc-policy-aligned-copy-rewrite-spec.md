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

## page_key: pestsTopic

### Approved field changes

- No approved field changes. Audit rows for this page are currently blocked pending source evidence.

### Blocked fields

- Target field path: `summary`
  - Current text (exact): Get help with pests, mold, garbage, and other housing health problems.
  - Block reason: missing source
  - Required source: not found in provided exports

- Target field path: `sections[0].paragraphs[0]`
  - Current text (exact): Use this page to report or prevent problems that Healthy Housing and Vector Control may review under Article 11.
  - Block reason: missing source
  - Required source: not found in provided exports

- Target field path: `sections[3].cards[2].text`
  - Current text (exact): Pay the program fee for residential buildings with 3 or more units.
  - Block reason: missing source
  - Required source: not found in provided exports

### Acceptance checks

- Copy stays within current page structure.
- No unsupported legal/process claims were added.
- Related-card routing still points to existing page keys.

## page_key: ratsReport

### Approved field changes

- No approved field changes. Audit rows for this page are currently blocked pending source evidence.

### Blocked fields

- Target field path: `sections[0].steps[1].title`
  - Current text (exact): If you rent, give 72 hours when possible
  - Block reason: missing source
  - Required source: not found in provided exports

- Target field path: `sections[1].paragraphs[3]`
  - Current text (exact): If HHVC finds a violation, the City may require the property owner or responsible party to correct it.
  - Block reason: missing source
  - Required source: not found in provided exports

- Target field path: `sections[1].callout.text`
  - Current text (exact): Tenants have rights to safe and habitable housing. A property owner or manager cannot retaliate because a tenant reports housing conditions to the City.
  - Block reason: missing source
  - Required source: not found in provided exports

### Acceptance checks

- Copy stays within current page structure.
- No unsupported legal/process claims were added.
- Related-card routing still points to existing page keys.

## page_key: cockroachesReport

### Approved field changes

- No approved field changes. Audit rows for this page are currently blocked pending source evidence.

### Blocked fields

- Target field path: `summary`
  - Current text (exact): Report an active cockroach problem in San Francisco.
  - Block reason: missing source
  - Required source: not found in provided exports

- Target field path: `sections[1].paragraphs[3]`
  - Current text (exact): If HHVC finds a violation, the City may require the property owner or responsible party to correct it.
  - Block reason: missing source
  - Required source: not found in provided exports

- Target field path: `sections[1].callout.text`
  - Current text (exact): Tenants have rights to safe and habitable housing. A property owner or manager cannot retaliate because a tenant reports housing conditions to the City.
  - Block reason: missing source
  - Required source: not found in provided exports

### Acceptance checks

- Copy stays within current page structure.
- No unsupported legal/process claims were added.
- Related-card routing still points to existing page keys.

## page_key: bedBugsReport

### Approved field changes

- No approved field changes. Audit rows for this page are currently blocked pending source evidence.

### Blocked fields

- Target field path: `summary`
  - Current text (exact): Report an active bed bug problem in San Francisco rental housing.
  - Block reason: missing source
  - Required source: not found in provided exports

- Target field path: `sections[1].paragraphs[3]`
  - Current text (exact): If HHVC finds a violation, the City may require the property owner or responsible party to correct it.
  - Block reason: missing source
  - Required source: not found in provided exports

- Target field path: `sections[2].paragraphs[0]`
  - Current text (exact): For detailed bed bug prevention and control rules, see the bed bug rules and prevention page.
  - Block reason: missing source
  - Required source: not found in provided exports

### Acceptance checks

- Copy stays within current page structure.
- No unsupported legal/process claims were added.
- Related-card routing still points to existing page keys.

## page_key: mosquitoesReport

### Approved field changes

- No approved field changes. Audit rows for this page are currently blocked pending source evidence.

### Blocked fields

- Target field path: `summary`
  - Current text (exact): Report mosquitoes or standing water in San Francisco.
  - Block reason: missing source
  - Required source: not found in provided exports

- Target field path: `sections[1].paragraphs[2]`
  - Current text (exact): If HHVC finds a violation, the City may require the property owner or responsible party to correct it.
  - Block reason: missing source
  - Required source: not found in provided exports

- Target field path: `sections[1].callout.text`
  - Current text (exact): Tenants have rights to safe and habitable housing. A property owner or manager cannot retaliate because a tenant reports housing conditions to the City.
  - Block reason: missing source
  - Required source: not found in provided exports

### Acceptance checks

- Copy stays within current page structure.
- No unsupported legal/process claims were added.
- Related-card routing still points to existing page keys.

## page_key: vegetationReport

### Approved field changes

- No approved field changes. Audit rows for this page are currently blocked pending source evidence.

### Blocked fields

- Target field path: `summary`
  - Current text (exact): Report garbage, clutter, or overgrown plants that may attract pests or vectors.
  - Block reason: missing source
  - Required source: not found in provided exports

- Target field path: `sections[0].steps[1].text[1]`
  - Current text (exact): If they do not respond or start fixing it within 72 hours, submit your report right away so it can be assigned for review.
  - Block reason: missing source
  - Required source: not found in provided exports

- Target field path: `sections[1].cards[3].text`
  - Current text (exact): Find help if you are worried about retaliation. HHVC does not share the reporter’s identity with the property owner or manager.
  - Block reason: missing source
  - Required source: not found in provided exports

### Acceptance checks

- Copy stays within current page structure.
- No unsupported legal/process claims were added.
- Related-card routing still points to existing page keys.

## page_key: moldReport

### Approved field changes

- No approved field changes. Audit rows for this page are currently blocked pending source evidence.

### Blocked fields

- Target field path: `summary`
  - Current text (exact): Report mold or moisture caused by humidity, condensation, or poor ventilation.
  - Block reason: missing source
  - Required source: not found in provided exports

- Target field path: `sections[2].paragraphs[3]`
  - Current text (exact): If HHVC finds a violation, the City may require the property owner or responsible party to correct it.
  - Block reason: missing source
  - Required source: not found in provided exports

- Target field path: `sections[1].paragraphs[0]`
  - Current text (exact): HHVC may review mold when the affected area is about 10 square feet or more and may be linked to humidity, condensation, or poor ventilation.
  - Block reason: missing source
  - Required source: not found in provided exports

### Acceptance checks

- Copy stays within current page structure.
- No unsupported legal/process claims were added.
- Related-card routing still points to existing page keys.

## page_key: payFee

### Approved field changes

- No approved field changes. Audit rows for this page are currently blocked pending source evidence.

### Blocked fields

- Target field path: `summary`
  - Current text (exact): Pay or learn about the Healthy Housing program fee for some San Francisco residential buildings.
  - Block reason: missing source
  - Required source: not found in provided exports

- Target field path: `sections[0].paragraphs[1]`
  - Current text (exact): Use the payment route listed on your notice when one is provided.
  - Block reason: missing source
  - Required source: not found in provided exports

- Target field path: `sections[1].paragraphs[1]`
  - Current text (exact): A building with 3 units is exempt if one unit is occupied by the owner.
  - Block reason: missing source
  - Required source: not found in provided exports

### Acceptance checks

- Copy stays within current page structure.
- No unsupported legal/process claims were added.
- Related-card routing still points to existing page keys.
