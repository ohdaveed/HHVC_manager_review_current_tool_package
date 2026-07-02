# HHVC policy-source content review and rewrite design

## Goal

Improve HHVC mockup page content by reviewing Google Drive source/legal/policy documents and
turning that review into:

1. a policy-backed content audit matrix, and
2. a rewrite-ready spec for mockup page copy updates.

The first delivery covers the Topic page plus all Transaction pages. Information pages follow in
the next phase.

## Source-of-truth decision

The primary authority for this work is source/legal/policy documentation, not manager comments or
review-export spreadsheets. Google Drive is assumed to contain the authoritative materials, but
those documents are not directly wired into the repo today. The workflow therefore assumes manual
export or manual referencing of Drive documents before implementation begins.

## In-scope pages

### Phase 1

- `pestsTopic`
- `ratsReport`
- `cockroachesReport`
- `bedBugsReport`
- `mosquitoesReport`
- `vegetationReport`
- `moldReport`
- `payFee`

### Phase 2

- `scopeInfo`
- `ownerGuidance`
- `afterReport`
- `tenantRights`
- `ratsPrevent`
- `cockroachesPrevent`
- `mosquitoesPrevent`
- `reduceMoisture`
- `bedBugsInfo`

## Working approach

Use a policy-evidence-first workflow before any copy rewrite.

### Pass 1: claim extraction

For each in-scope page, extract policy-relevant claims from:

- page summaries,
- body paragraphs,
- step text,
- card descriptions,
- callouts,
- CTA labels where they imply policy or process.

Claims should be grouped by policy topic, such as:

- HHVC scope,
- reporting threshold,
- tenant notice timing,
- landlord/property-owner responsibility,
- inspection process,
- enforcement pathway,
- anti-retaliation rights,
- fee/payment requirements,
- required documentation,
- official referrals or exclusions.

### Pass 2: policy evidence mapping

For each claim, attach source evidence from exported Drive documents and assign one status:

- `verified` — current mockup text matches source
- `conflict` — current mockup text disagrees with source
- `missing_source` — no source was found to support the claim
- `editorial_only` — policy is fine; only clarity/readability needs work

No rewrite can proceed without an evidence row.

### Pass 3: rewrite directives

Each audited claim gets a directive:

- `verified` -> keep or simplify wording
- `conflict` -> rewrite to match source
- `missing_source` -> block and flag for stakeholder input
- `editorial_only` -> improve readability without changing meaning

### Pass 4: copy production

Create exact replacement copy by page field, tied back to audit evidence. This output must be
ready for direct implementation in `pages/*.js`.

## Artifacts

### 1. Policy content audit matrix

Primary output path:

- `docs/superpowers/specs/YYYY-MM-DD-hhvc-policy-content-audit-matrix.md`

Optional companion:

- CSV version if sorting/filtering becomes useful during review

Each row should include:

- `page_key`
- `page_field`
- `claim_text_current`
- `policy_topic`
- `source_doc_id`
- `source_locator`
- `status`
- `risk_level`
- `rewrite_directive`
- `owner_note`

`page_field` should point to the actual content location, for example:

- `summary`
- `sections[1].paragraphs[0]`
- `sections[2].cards[1].text`
- `sections[0].steps[2].callout.text`

### 2. Rewrite-ready spec

Primary output path:

- `docs/superpowers/specs/YYYY-MM-DD-hhvc-policy-aligned-copy-rewrite-spec.md`

Per page, this spec should include:

- target fields to change,
- exact replacement copy,
- source-backed rationale,
- unresolved blockers,
- acceptance checks for implementation.

## Workflow architecture

The review is intentionally two-stage:

```text
source docs -> claim audit matrix -> rewrite directives -> rewrite-ready spec -> implementation
```

This prevents legal or policy-sensitive changes from being made on intuition alone and gives
managers a traceable approval path from source document to final copy.

## Acceptance criteria

The design phase is complete when:

1. every policy-relevant claim in Phase 1 pages has an evidence status,
2. no proposed rewrite introduces unverified facts,
3. cross-page rules are normalized with explicit source backing,
4. the rewrite spec is implementation-ready at the field level.

## Cross-page normalization targets

The audit should pay special attention to repeated wording patterns that often drift across pages:

- agency naming (`HHVC`, `Environmental Health`, `DPH`, `SFDPH`)
- reporting thresholds and timing windows
- landlord vs property owner or manager terminology
- inspection/process wording
- enforcement and anti-retaliation language
- scope boundaries for Article 11 / HHVC issues
- fee/payment statements on `payFee`

These repeated rules should be normalized only when source documentation supports the change.

## Highest-risk Phase 1 pages

The first review pass should prioritize:

- `payFee` — fee amounts, due dates, requirements, and publication risk
- `bedBugsReport` — legal/process sensitivity and linked rules
- `pestsTopic` — scope framing and routing language
- all report pages where 72-hour thresholds, enforcement, or tenant-rights language must stay
  consistent

## Explicit non-goals

- Do not directly edit `pages/*.js` during the design phase.
- Do not infer or invent policy facts that are absent from source documents.
- Do not treat manager-review CSV exports as the legal source of truth.
- Do not expand scope to Information pages until the Phase 1 audit/rewrite workflow is validated.
- Do not replace the existing review tool workflow; this design feeds it with better content inputs.

## Planned user workflow

1. Identify the Drive docs that matter for the current phase.
2. Export or otherwise surface them for review.
3. Build the Phase 1 audit matrix.
4. Review the matrix for conflicts, gaps, and blocked claims.
5. Produce the rewrite-ready spec for the Topic + Transaction pages.
6. After approval, create the implementation plan for repo changes.

## Risks and mitigations

### Risk: source documents conflict with each other

Mitigation: record conflicting citations explicitly in the audit matrix and block rewrite decisions
until the owner resolves the conflict.

### Risk: source documents are incomplete

Mitigation: mark the claim `missing_source`, avoid fabricated text, and treat the affected field as
blocked.

### Risk: copy rewrites change legal meaning while trying to simplify reading level

Mitigation: preserve policy meaning first, then simplify wording within the evidence-backed boundary.

### Risk: page-by-page work misses repeated inconsistencies

Mitigation: maintain a cross-page normalization section in the audit and apply shared rules across
all Phase 1 pages before writing the rewrite spec.
