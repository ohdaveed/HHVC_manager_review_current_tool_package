# Source-of-truth audit — 2026-07-06

Full-coverage audit of all 39 `pages/*.js` files against the real agency
source documents (`docs/source/hhvc-policy/*.md`), run on `main` after the
`docs/AGENT_COORDINATION.md` reconciliation the same day. Extends the
`schema-gaps-safe` worktree's citation audit (which covered ~5 pages) to
the full page set.

**Trust hierarchy used:** `docs/source/hhvc-policy/*.md` (real agency PDFs/
statutes, tier 1) > citations in `pages/*.js` should point there >
`notebooklm/*.md` and `hhvc_chapter_drafts/*.md` (AI-generated drafts, tier
3 — uncorroborated claims from these are flagged as suspect, not treated
as fact).

Findings already fixed on the unmerged `worktree-schema-gaps-safe` /
`worktree-hhvc-citation-fix` branches (fee-rate figures, Master Guidelines
8.3 mis-citation, CLAUDE.md 7.5 stray citation, bed-bug 45-day flag,
Article 11/11A citations on `report-*.js`, bed-bug abatement timeline) are
**excluded below** — see `docs/AGENT_COORDINATION.md`'s "RESOLVED" section.
This doc only covers **new** findings.

## Cross-cutting patterns (highest priority — affect multiple pages)

### 1. "DBI under the San Francisco Housing Code (2025)" citation has zero tier-1 support — 8 files

No file in `docs/source/hhvc-policy/` mentions "Housing Code," "DBI," or
"Department of Building Inspection" (verified by grep across all ~35
files). The routing rule may be real (DBI-vs-HHVC split for structural
defects looks intentional — see commit `f73740a` "Fix DBI routing
violations"), but the specific statutory citation traces only to
`notebooklm/hhvc-inspection-scope.md`, `notebooklm/hhvc-standards-manual.md`,
and `hhvc_chapter_drafts/hhvc-manual-chapter-{1,4,8}.md` (tier 3). Same
sentence, same origin commit, appears in:

- `pages/hhvc-inspection-scope.js` (~line 81)
- `pages/keep-rats-and-mice-out.js` (~line 74)
- `pages/prevent-cockroaches.js` (~line 53)
- `pages/prevent-mosquitoes.js` (~line 43)
- `pages/reduce-indoor-moisture.js` (~lines 108–115)
- `pages/report-mold-humidity-condensation.js` (~line 85)
- `pages/what-happens-after-report.js` (~line 38)

**Action needed:** either source a real Housing Code citation, or soften
to "may be routed to DBI" without the fabricated "(2025)" edition tag.

### 2. Invented phone number `415-252-3806` — 3 files

`pages/mosquito-control-program.js` (~line 35), `pages/mosquito-education-
workshop.js` (~lines 101, 107), `pages/prevent-mosquitoes.js` (~line 84).
This number appears nowhere in any tier-1/2/3 source doc. The real,
tier-1-confirmed DPH number is **415-252-3800** (`2026-07-02-bed-bug-
directors-rules-tenant-guidelines.md:16`, `2026-07-02-sf-gov-pay-healthy-
housing-fee.md:53`). Reads as a digit-swap of the real number. Self-flagged
via an existing `editorNote` ("verify phone numbers") but presented as a
working number in body copy.

### 3. Bed-bug-specific Director's Rules generalized to all pests

`pages/integrated-pest-management-property-managers.js` frames a
bed-bug-only rule set as a general "vector" policy:
- Line 90: "Investigate any tenant reports of pest activity within 72
  hours" — the real tier-1 rule is **two working days**, and it's
  bed-bug-specific (PCO investigation), not a general 72-hour rule for any
  pest.
- Line 91: "Recordkeeping ... for at least 2 years" — tier-1 only supports
  2-year retention for bed bug Complaint Response Logs specifically.
- Line 166: "the PCO must inspect all adjacent units" on any infestation —
  again bed-bug-specific in the source, generalized here.

### 4. Tree/branch clearance distance — three different numbers, none matching source

Tier-1 (`2026-07-02-ipm-pests-rats.md`) says overhanging limbs should be
removed **within 6 feet** of roofs. Pages disagree with the source *and*
each other:
- `pages/integrated-pest-management-property-managers.js` line 136: "3 feet"
- `pages/keep-rats-and-mice-out.js` line 61 / `pages/prevent-overgrown-
  vegetation.js` line 36: "4 feet"
- Source: 6 feet

## Page-specific findings

### `pages/bed-bug-rules-prevention.js`
- Line 67: cites "Health Code **Article 11A**" — the master violation-
  category doc places bed bugs under **Article 11**, not 11A. (High)
- Line 85: "tenants must report... within two working days" — source
  (line 495–497) says tenants must report "promptly," no numeric deadline;
  "two working days" is the **owner's** duty, misapplied here to tenants.
  (High)
- Line 89: "Move all furniture at least 12 inches away from walls" — no
  tier-1 doc specifies any furniture-clearance distance. Fabricated. (High)
- Line 101: invented verbatim trilingual label quote ("INFESTED MATERIAL —
  DO NOT TAKE" / "CHINCHES DE CAMA" / "床蝨") — source only says DPH
  provides "Trilingual Guidelines" by name, not this exact text. (High)
- Line 73: "the landlord must provide a written history" stated
  unconditionally — source (Owner 1.11) conditions this "at the request of
  a prospective tenant." (Medium)

### `pages/ground-wasp-information.js`
- Lines 62–72: dual-track referral procedure (city property → sister
  agency; private property → licensed PCO) traces only to
  `notebooklm/hhvc-ipm-reference-materials.md`, which itself cites an
  apparently-fabricated "Article 11, Section 581" for wasps. `docs/source/
  hhvc-policy/README.md` explicitly says yellowjacket/wasp guidance is
  "Not an Article 11 violation category." Page's own `editorNote` flags
  this as unverified, but body text/cards state it as settled fact. (High)

### `pages/mite-information.js`
- The entire "tropical rat mite scatter after rodenticide → bite spike"
  narrative (paragraphs, callout, all 3 steps) traces only to
  `notebooklm/disease-risk-reference-sheet.md` and `notebooklm/hhvc-ipm-
  reference-materials.md` — which itself hedges ("verify the order-of-
  operations warning"). Presented as settled fact on the page. (High)

### `pages/pigeon-information.js`
- Line ~22: "histoplasmosis or psittacosis" from pigeon dust — zero tier-1
  hits; source is tier-3, and that tier-3 doc itself flags the claim as
  needing verification. (High)
- Line ~83: "HHVC may collect the bird and test it" for West Nile — no
  tier-1 corroboration of this as an HHVC service. (Medium)
- Line 15 `editorNote` ("verify HHVC scope for bird complaints") is stale —
  scope is already confirmed (Sec. 581(b)(7)); doesn't cover the disease
  claim gap above.

### `pages/keep-rats-and-mice-out.js`
- Line 93: "Space rat traps 15 to 30 feet apart" — tier-1 says **10 to 20
  feet** (source line 610). (Medium)
- Line 74: DBI/Housing Code citation — see cross-cutting #1.
- Line 61: 4-foot clearance — see cross-cutting #4.

### `pages/what-happens-after-report.js`
- Line 93: "Sewage Backups (48 to 72 hours)" special window — no tier-1
  doc mentions sewage or this window; traces only to `hhvc_chapter_drafts/
  hhvc-manual-chapter-8 (1).md` and `notebooklm/mockup-remediation-
  playbook.md`. (High)
- Line 94: "All Other Violations (30 days)" generic correction window — no
  tier-1 doc establishes this; the only tier-1 "30 days" figures govern the
  **fee late-payment deadline**, a different thing. Traces to
  `notebooklm/master-guidelines.md` and `notebooklm/compliance-
  standards.csv` (which itself cites "SF Building Code Sec. 102A.4," not
  Health Code Article 11). (Medium-high)
- Line 99: "citations, civil liabilities, or a Director's Hearing to
  recover attorneys' fees and administrative abatement costs" — no tier-1
  corroboration for this enforcement mechanism. (High)
- Line 98: "1.5% **compounded monthly** interest" — tier-1 says interest
  "accrues at 1.5% per month," not "compounded." Also disagrees with the
  parallel sentence in `respond-to-notice-of-violation.js` ("1.5%
  interest," no "compounded"). (Medium)
- Line 38: DBI/Housing Code citation — see cross-cutting #1.

### `pages/respond-to-notice-of-violation.js`
- Line 29: "citations, administrative fines, or a Director's Hearing" —
  same unsupported enforcement-mechanism claim as above, distinct from the
  already-tracked fee-rate issue in the same sentence. (High)

### `pages/reduce-indoor-moisture.js`
- Lines ~130–136: "HHVC does not accept third-party mold test kit
  results... cannot be independently verified" presented as settled
  policy. The only source, `notebooklm/reduce-indoor-moisture.md`, says the
  **opposite kind of thing** — it's an internal drafting caution ("don't
  write about third-party kits without programmatic review"), not a
  confirmed policy. The page converted a "needs review" flag into an
  assertive claim. (High)
- Lines 108–115: DBI/Housing Code citation — see cross-cutting #1.

### `pages/report-mold-humidity-condensation.js`
- Line 58: "HHVC does not accept or use third-party mold kits for review"
  — same unconfirmed-operational-claim issue as `reduce-indoor-
  moisture.js` above. (Low — plausible but unverified)
- Line 85: DBI/Housing Code citation — see cross-cutting #1.

### `pages/report-garbage-clutter.js` / `pages/report-pigeons.js`
- Both reuse the 72-hour-tenant-notice sentence and reporter-privacy
  language, but `2026-07-02-program-manager-72-hour-tenant-notice.md`
  explicitly scopes that rule to six named pages (rats, cockroaches, bed
  bugs, mosquitoes, vegetation, mold) — `garbageReport`/`pigeonsReport`
  aren't listed. Likely these pages were added after the attestation doc
  was written, not a wrong fact — but the attestation doc should be
  updated to cover them explicitly before publication. (Low)

### Minor / low-confidence (optional cleanup)
- `pages/prevent-cockroaches.js` line 22: "salmonella and E. coli" slightly
  conflates two cockroach species' distinct source findings (Salmonella +
  Shigella for American; coliform bacteria for German). Not a fabrication.
- `pages/report-bed-bugs.js` / `pages/report-cockroaches.js`: "a few
  weekdays" 311-routing time has no source anywhere in the repo, but is
  low-risk boilerplate.
- `pages/fly-information.js` line 50: reuses the 72-hour-notice language
  outside its confirmed 6-page scope (same pattern as garbage/pigeons
  above).
- `pages/agency-service-grouping.js` line 71: "HHVC may collect and test
  the bird" for West Nile — no tier-1 doc, low confidence, plausible.

## Clean (no new issues found)

`pages/find-district-inspector.js`, `pages/lookup-building-records.js`,
`pages/lookup-complaints-inspections.js`, `pages/lookup-residential-hotel-
records.js`, `pages/lookup-residential-violations.js`,
`pages/prevent-problems.js`, `pages/public-records-request.js`,
`pages/raccoon-information.js`, `pages/report-a-problem.js`,
`pages/report-dead-bird.js`, `pages/report-mosquitoes.js`,
`pages/report-overgrown-vegetation.js`, `pages/report-rats-or-mice.js`,
`pages/tenant-rights-reporting.js`, `pages/agency-service-grouping.js`
(beyond the one low-confidence item above).

## Not covered by this audit

`pages/property-owner-responsibilities.js` and `pages/pay-healthy-housing-
fee.js` were re-checked only for issues *outside* the already-tracked
fee-rate/citation fixes pending merge from `worktree-schema-gaps-safe`; no
new issues found beyond what's already tracked there.
