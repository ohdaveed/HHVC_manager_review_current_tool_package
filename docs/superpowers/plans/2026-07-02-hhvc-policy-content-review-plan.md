# HHVC Policy Content Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit the Topic and Transaction mockup pages against exported Google Drive policy documents, then produce source-backed copy changes and implement them in the page data files without inventing legal or operational facts.

**Architecture:** This work happens in four stages: bring authoritative source documents into the repo, build a page-field audit matrix for the Topic + Transaction pages, turn the audited findings into a rewrite-ready copy spec, and only then update the `pages/*.js` content objects. Validation remains structural through `bun run validate` and `bun run build`; policy accuracy is enforced by the audit matrix and rewrite spec.

**Tech Stack:** Plain JavaScript content objects in `pages/*.js`, Markdown specs in `docs/superpowers/specs/`, Bun scripts from `package.json`, and repo-local exported source documents.

---

## Scope check

This plan covers one coherent subsystem: policy-backed content updates for the existing HHVC mockup pages. It does not redesign the app, change review-tool behavior, or expand into the Information pages until the Topic + Transaction workflow is proven.

## File structure

**Inputs to read during execution**

- `docs/superpowers/specs/2026-07-02-hhvc-policy-content-review-design.md` — approved design
- `pages/agency-service-grouping.js` — Topic page content (`pestsTopic`)
- `pages/report-rats-or-mice.js`
- `pages/report-cockroaches.js`
- `pages/report-bed-bugs.js`
- `pages/report-mosquitoes.js`
- `pages/report-vegetation-garbage.js`
- `pages/report-mold-humidity-condensation.js`
- `pages/pay-healthy-housing-fee.js`
- `build_scripts/validate.js` — structural validation rules
- `README.md` and `review/manager_review_packet.md` — workflow framing only

**Files to create**

- `docs/source/hhvc-policy/README.md` — inventory of exported Drive documents used as authority
- `docs/superpowers/specs/2026-07-02-hhvc-policy-content-audit-matrix.md` — evidence ledger for Topic + Transaction pages
- `docs/superpowers/specs/2026-07-02-hhvc-policy-aligned-copy-rewrite-spec.md` — exact approved rewrites

**Files to modify in implementation phase**

- `pages/agency-service-grouping.js`
- `pages/report-rats-or-mice.js`
- `pages/report-cockroaches.js`
- `pages/report-bed-bugs.js`
- `pages/report-mosquitoes.js`
- `pages/report-vegetation-garbage.js`
- `pages/report-mold-humidity-condensation.js`
- `pages/pay-healthy-housing-fee.js`
- `README.md` only if the content-review workflow needs documentation updates after implementation

**Validation outputs**

- `bun run validate`
- `bun run build`

## Global constraints

- Never invent fee amounts, dates, legal requirements, contacts, or process steps.
- If a source doc is missing or conflicting, record that in the audit matrix and block the rewrite.
- Keep page object structure unchanged; only edit user-visible strings and existing `karl` notes where needed for accuracy.
- Run `bun run validate` after each logical content batch.
- Run `bun run build` only after all approved page edits are complete.

### Task 1: Create the source-document intake area

**Files:**
- Create: `docs/source/hhvc-policy/README.md`

- [ ] **Step 1: Create the source-doc folder**

Run:

```bash
mkdir -p docs/source/hhvc-policy
```

Expected: `docs/source/hhvc-policy` exists.

- [ ] **Step 2: Write the source inventory README**

Create `docs/source/hhvc-policy/README.md` with:

```md
# HHVC policy source inventory

Use this folder for exported Google Drive source/legal/policy documents that govern mockup copy.

## Required metadata per document

- Source title
- Original Drive filename or doc title
- Export date
- Export format (`pdf`, `docx`, `txt`, `md`)
- Reviewer initials
- Phase used (`Phase 1 Topic + Transaction` or later)

## Documents expected for Phase 1

- Article 11 / HHVC scope authority
- Inspection / complaint handling policy
- Tenant-notice / 72-hour guidance
- Anti-retaliation / tenant-rights authority
- Bed bug rules / Director's Rules source
- Fee / payment authority for Healthy Housing program fees

## Naming convention

`YYYY-MM-DD-short-policy-name.ext`

Examples:

- `2026-07-02-article-11-scope.pdf`
- `2026-07-02-bed-bug-directors-rules.pdf`
- `2026-07-02-healthy-housing-fee-guidance.pdf`
```

- [ ] **Step 3: Verify the README was created**

Run:

```bash
test -f docs/source/hhvc-policy/README.md && echo "source inventory ready"
```

Expected output:

```text
source inventory ready
```

- [ ] **Step 4: Commit**

```bash
git add docs/source/hhvc-policy/README.md
git commit -m "docs: add HHVC policy source inventory"
```

### Task 2: Build the Topic + Transaction audit matrix

**Files:**
- Create: `docs/superpowers/specs/2026-07-02-hhvc-policy-content-audit-matrix.md`
- Modify: `pages/agency-service-grouping.js`
- Modify: `pages/report-rats-or-mice.js`
- Modify: `pages/report-cockroaches.js`
- Modify: `pages/report-bed-bugs.js`
- Modify: `pages/report-mosquitoes.js`
- Modify: `pages/report-vegetation-garbage.js`
- Modify: `pages/report-mold-humidity-condensation.js`
- Modify: `pages/pay-healthy-housing-fee.js`

- [ ] **Step 1: Enumerate the Phase 1 page keys**

Write this checklist at the top of `docs/superpowers/specs/2026-07-02-hhvc-policy-content-audit-matrix.md`:

```md
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
```

- [ ] **Step 2: Add the audit table template**

Append this table header:

```md
| page_key | page_field | claim_text_current | policy_topic | source_doc_id | source_locator | status | risk_level | rewrite_directive | owner_note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
```

- [ ] **Step 3: Seed required high-risk rows for `pestsTopic`**

Add these starter rows exactly:

```md
| pestsTopic | summary | Get help with pests, mold, garbage, and other housing health problems. | scope |  |  | missing_source | medium | Confirm that all listed issue types are within HHVC / Article 11 scope before revising. | Topic summary sets the boundary for all downstream routing. |
| pestsTopic | sections[0].paragraphs[0] | Use this page to report or prevent problems that Healthy Housing and Vector Control may review under Article 11. | scope |  |  | missing_source | high | Verify Article 11 framing and HHVC program naming. | Core legal framing statement. |
| pestsTopic | sections[3].cards[2].text | Pay the program fee for residential buildings with 3 or more units. | fee/payment |  |  | missing_source | high | Do not keep unless fee-page authority confirms this framing. | Routes users into `payFee`. |
```

- [ ] **Step 4: Seed required high-risk rows for `ratsReport`**

Add:

```md
| ratsReport | sections[0].steps[1].title | If you rent, give 72 hours when possible | tenant notice timing |  |  | missing_source | high | Verify the 72-hour notice rule and when it applies. | Must align across report pages. |
| ratsReport | sections[1].paragraphs[3] | If HHVC finds a violation, the City may require the property owner or responsible party to correct it. | enforcement pathway |  |  | missing_source | high | Confirm enforcement wording and responsible-party language. | Cross-page enforcement parity. |
| ratsReport | sections[1].callout.text | Tenants have rights to safe and habitable housing. A property owner or manager cannot retaliate because a tenant reports housing conditions to the City. | anti-retaliation |  |  | missing_source | high | Verify tenant-rights wording before simplification. | High-risk legal reassurance. |
```

- [ ] **Step 5: Seed equivalent starter rows for the other six Phase 1 pages**

For each of `cockroachesReport`, `bedBugsReport`, `mosquitoesReport`, `vegetationReport`, `moldReport`, and `payFee`, add at least:

- one row for summary/scope,
- one row for timing/process/enforcement,
- one row for any legal/fee/bed-bug-specific claim.

Use the exact current string from the page file in `claim_text_current`. Do not paraphrase the current claim in the matrix.

- [ ] **Step 6: Verify the matrix contains all eight page keys**

Run:

```bash
for key in pestsTopic ratsReport cockroachesReport bedBugsReport mosquitoesReport vegetationReport moldReport payFee; do
  rg -n "^\\| ${key} \\|" docs/superpowers/specs/2026-07-02-hhvc-policy-content-audit-matrix.md
done
```

Expected: each command prints at least one matching row.

- [ ] **Step 7: Commit**

```bash
git add docs/superpowers/specs/2026-07-02-hhvc-policy-content-audit-matrix.md
git commit -m "docs: add HHVC policy audit matrix"
```

### Task 3: Turn the audit into a rewrite-ready spec

**Files:**
- Create: `docs/superpowers/specs/2026-07-02-hhvc-policy-aligned-copy-rewrite-spec.md`
- Read: `docs/superpowers/specs/2026-07-02-hhvc-policy-content-audit-matrix.md`

- [ ] **Step 1: Write the spec header and scope**

Create `docs/superpowers/specs/2026-07-02-hhvc-policy-aligned-copy-rewrite-spec.md` with:

```md
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
```

- [ ] **Step 2: Add the per-page rewrite section template**

Append this section template once, then duplicate it for each page:

```md
## page_key: pestsTopic

### Approved field changes

- `summary`
  - Current:
  - Replace with:
  - Source:
  - Reason:

### Blocked fields

- `field path`
  - Current:
  - Block reason:
  - Required source:

### Acceptance checks

- Copy stays within current page structure.
- No unsupported legal/process claims were added.
- Related-card routing still points to existing page keys.
```

- [ ] **Step 3: Fill the page sections using the audit matrix**

For each Phase 1 page:

- move `verified` / `conflict` / `editorial_only` rows into “Approved field changes”,
- move `missing_source` rows into “Blocked fields”,
- keep source document identifiers and locators verbatim from the matrix.

- [ ] **Step 4: Verify every page has both an Approved or Blocked subsection**

Run:

```bash
for key in pestsTopic ratsReport cockroachesReport bedBugsReport mosquitoesReport vegetationReport moldReport payFee; do
  rg -n "^## page_key: ${key}$" docs/superpowers/specs/2026-07-02-hhvc-policy-aligned-copy-rewrite-spec.md
done
```

Expected: each page key appears once.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-07-02-hhvc-policy-aligned-copy-rewrite-spec.md
git commit -m "docs: add HHVC policy rewrite spec"
```

### Task 4: Implement approved Phase 1 copy changes in page files

**Files:**
- Modify: `pages/agency-service-grouping.js`
- Modify: `pages/report-rats-or-mice.js`
- Modify: `pages/report-cockroaches.js`
- Modify: `pages/report-bed-bugs.js`
- Modify: `pages/report-mosquitoes.js`
- Modify: `pages/report-vegetation-garbage.js`
- Modify: `pages/report-mold-humidity-condensation.js`
- Modify: `pages/pay-healthy-housing-fee.js`

- [ ] **Step 1: Update only fields approved in the rewrite spec**

For each page file, replace only the strings explicitly listed in `docs/superpowers/specs/2026-07-02-hhvc-policy-aligned-copy-rewrite-spec.md`. Do not add new sections, new cards, or new page keys.

- [ ] **Step 2: Preserve blocked claims as-is or convert them into explicit internal blockers**

For any field still marked blocked:

- leave current public copy untouched if changing it would invent facts, or
- move unverified operational detail into `karl` notes only if the rewrite spec explicitly says to do so.

- [ ] **Step 3: Run structural validation after the page edits**

Run:

```bash
bun run validate
```

Expected output contains:

```text
validated 17 pages
```

- [ ] **Step 4: Spot-check that all referenced page keys still exist**

Run:

```bash
for key in pestsTopic ratsReport cockroachesReport bedBugsReport mosquitoesReport vegetationReport moldReport payFee scopeInfo afterReport tenantRights ratsPrevent cockroachesPrevent mosquitoesPrevent reduceMoisture bedBugsInfo ownerGuidance; do
  rg -n "\\['${key}'\\]|\"${key}\"|'${key}'" pages js/page-data.js
done
```

Expected: every key prints at least one match and no new invalid target names were introduced.

- [ ] **Step 5: Commit**

```bash
git add pages/agency-service-grouping.js pages/report-rats-or-mice.js pages/report-cockroaches.js pages/report-bed-bugs.js pages/report-mosquitoes.js pages/report-vegetation-garbage.js pages/report-mold-humidity-condensation.js pages/pay-healthy-housing-fee.js
git commit -m "feat: align HHVC phase 1 copy with policy sources"
```

### Task 5: Final verification and documentation cleanup

**Files:**
- Modify: `README.md` (only if workflow docs need updating)

- [ ] **Step 1: Rebuild generated outputs**

Run:

```bash
bun run build
```

Expected output includes the validation pass and regenerated exports without errors.

- [ ] **Step 2: Check formatting**

Run:

```bash
bun run format:check
```

Expected output:

```text
All matched files use Prettier code style!
```

- [ ] **Step 3: Update README only if the workflow changed materially**

If implementation introduced a repeatable source-doc intake workflow, add a short section to `README.md` explaining:

- where exported policy documents should go (`docs/source/hhvc-policy/`),
- that Topic + Transaction rewrites must be audit-backed,
- that unverified claims stay blocked.

If no workflow docs changed, skip this step.

- [ ] **Step 4: Run a final audit grep for blocked fee language**

Run:

```bash
rg -n "BLOCKED|missing_source|Do not publish" pages/pay-healthy-housing-fee.js docs/superpowers/specs/2026-07-02-hhvc-policy-content-audit-matrix.md docs/superpowers/specs/2026-07-02-hhvc-policy-aligned-copy-rewrite-spec.md
```

Expected: any still-blocked fee-related content is visible and traceable in either the page file or the docs.

- [ ] **Step 5: Commit**

```bash
git add README.md manager-review-single-file.html single-file-export-current-source.html docs/source/hhvc-policy/README.md docs/superpowers/specs/2026-07-02-hhvc-policy-content-audit-matrix.md docs/superpowers/specs/2026-07-02-hhvc-policy-aligned-copy-rewrite-spec.md
git commit -m "chore: finalize HHVC policy-backed content review workflow"
```

## Self-review

### Spec coverage

The approved design required:

- source-doc authority,
- manual-export intake,
- Phase 1 Topic + Transaction scope,
- audit matrix,
- rewrite-ready spec,
- source-backed field-level implementation,
- blocked handling for missing evidence.

Each requirement is covered by Tasks 1 through 5.

### Placeholder scan

No `TODO`, `TBD`, or “implement later” placeholders remain. Every output file, command, and verification step is named explicitly.

### Type consistency

The plan consistently uses the same artifact names:

- `docs/source/hhvc-policy/README.md`
- `docs/superpowers/specs/2026-07-02-hhvc-policy-content-audit-matrix.md`
- `docs/superpowers/specs/2026-07-02-hhvc-policy-aligned-copy-rewrite-spec.md`

The same Phase 1 page keys are used throughout.
