# HHVC Critical + Cross-Cutting Content Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the one publish-blocking content bug (`pay-healthy-housing-fee.js` leaking internal editorial notes into public copy) and the recurring cross-page inconsistencies identified in the full-site content review (agency naming, vague qualifiers, pronoun breaks, "landlord" terminology drift, Info/Report reporting-threshold mismatches, and duplicated card content).

**Architecture:** This is a static-content data repo — each `pages/*.js` file assigns a plain-object page definition to `window.HHVC_PAGES["<key>"]`. There is no build step required to view changes during editing; `js/page-data.js` merges all page objects into `window.HHVC_DATA` at runtime, and `index.html` loads every `pages/*.js` file as a plain `<script>`. Validation is structural only (`build_scripts/validate.js` walks the merged data via a Node `vm` sandbox and checks for missing link targets, required page ordering, and banned terms) — it does not check prose. There are no automated content/reading-level tests, so each task's "test" step is (a) an exact-text verification via `grep` that the edit landed correctly and (b) a structural validation run.

**Tech Stack:** Plain JavaScript object literals (`pages/*.js`), Node.js (`v24.18.0`, no `package.json`, no npm deps) for `build_scripts/validate.js` and `build_scripts/build-single-file.js`.

## Global Constraints

- Do not fabricate facts: no invented fee amounts, due dates, payment URLs, phone numbers, or legal citations. Where real business data is missing, the fix is to stop it from rendering as if it were real content, not to make up a plausible-sounding replacement.
- Preserve each file's stated `"reading"` grade level — do not introduce new jargon while fixing wording.
- Preserve the existing JSON-like object structure and key ordering conventions already used in each file (`karl` fields carry internal editorial notes and are never shown to end users; `paragraphs`/`bullets`/`steps`/`cards` are the only end-user-visible fields).
- After every file edit, run `node build_scripts/validate.js` from the repo root and confirm it prints `validated 17 pages` with no thrown error before moving to the next task.
- Run `node build_scripts/build-single-file.js` only once, in the final task, after all content tasks are complete (it's a full regeneration of both single-file HTML exports and is slow to diff per-task).

## Explicitly Out of Scope (flagged, not fixed, by this plan)

- `pay-healthy-housing-fee.js`'s actual fee amount, due date, account requirements, payment URL/`buttonTarget`, and help contact are unknown to this plan and must come from Finance/HHVC stakeholders. Task 1 only stops the internal notes from leaking into public copy — it does not invent the missing numbers or links.
- The bed bug Director's Rules PDF (`bed-bug-rules-prevention.js`) links to a personal Google Drive URL rather than an official SF.gov/SFDPH host. No official replacement URL is available, so this plan does not change that URL.
- The two "verify before publication" URLs in `tenant-rights-reporting.js` are unverified; this plan does not touch that file.
- Per-page prose rewrites that aren't part of a repeated cross-page pattern (e.g., the `reduce-indoor-moisture.js` run-on sentence, `what-happens-after-report.js` legal-jargon simplification, "Article 11"/"SRO"/"vector"/"hygrometer" jargon definitions) are deferred to a future plan — this plan covers only the critical blocker and genuinely cross-cutting (multi-file, repeated-pattern) issues.

## File Structure

Files modified (no new files created):

- `pages/pay-healthy-housing-fee.js` — move 3 leaked internal directives from `paragraphs` into `karl`
- `pages/hhvc-inspection-scope.js` — add one clarifying paragraph defining HHVC/Environmental Health/DPH as the same program
- `pages/what-happens-after-report.js` — fix `DPH`→`HHVC` naming, pronoun/vague-qualifier fixes, "landlord"→"property owner or manager"
- `pages/reduce-indoor-moisture.js` — fix `SFDPH`→`HHVC` naming (2 occurrences)
- `pages/report-mold-humidity-condensation.js` — fix `SFDPH`→`HHVC` naming, pronoun/vague-qualifier fixes, "Landlords"→"A property owner or manager"
- `pages/report-bed-bugs.js` — pronoun/vague-qualifier fixes, "Landlords"→"A property owner or manager", replace duplicated Director's Rules card with a pointer card to `bedBugsInfo`
- `pages/report-cockroaches.js` — pronoun/vague-qualifier fixes, "Landlords"→"A property owner or manager"
- `pages/report-rats-or-mice.js` — pronoun/vague-qualifier fixes, "Landlords"→"A property owner or manager"
- `pages/report-mosquitoes.js` — pronoun/vague-qualifier fix, add missing enforcement sentence + anti-retaliation callout (parity with its 4 sibling Transaction pages)
- `pages/prevent-cockroaches.js` — align reporting threshold to "after 72 hours"
- `pages/prevent-mosquitoes.js` — align reporting threshold to "after 72 hours"
- `pages/keep-rats-and-mice-out.js` — align reporting threshold to "after 72 hours"
- `pages/agency-service-grouping.js` — dedupe two conflicting `afterReport` card descriptions and two `bedBugsInfo` card descriptions to one canonical string each

---

### Task 1: Stop internal editorial notes from leaking into `pay-healthy-housing-fee.js` public copy

**Files:**
- Modify: `pages/pay-healthy-housing-fee.js`

**Interfaces:** None (standalone content file, no cross-file dependents for this task).

- [ ] **Step 1: Edit the "Who may need to pay" section**

Change (remove the 3rd paragraph, fold its meaning into `karl`):

```js
    {
      "heading": "Who may need to pay",
      "karl": "Body: Who may need to pay",
      "kind": "body",
      "paragraphs": [
        "Healthy Housing program fees may apply to residential buildings with 3 or more units.",
        "A building with 3 units is exempt if one unit is occupied by the owner.",
        "Fee details, due dates, account requirements, and payment instructions must be verified before publication."
      ]
    },
```

to:

```js
    {
      "heading": "Who may need to pay",
      "karl": "Body: Who may need to pay. BLOCKED — exact fee amount, due dates, account requirements, and payment instructions are not yet confirmed. Do not publish this page live until Finance/HHVC supplies verified values.",
      "kind": "body",
      "paragraphs": [
        "Healthy Housing program fees may apply to residential buildings with 3 or more units.",
        "A building with 3 units is exempt if one unit is occupied by the owner."
      ]
    },
```

- [ ] **Step 2: Edit the "Pay your fee" section**

Change:

```js
    {
      "heading": "Pay your fee",
      "karl": "Body: Pay your fee steps",
      "kind": "body",
      "paragraphs": [
        "Use the approved SF.gov payment or billing route to pay your Healthy Housing fee.",
        "Do not route this page through 311 unless HHVC or SF.gov confirms a support route that uses 311."
      ],
      "button": "Pay your Healthy Housing fee"
    },
```

to:

```js
    {
      "heading": "Pay your fee",
      "karl": "Body: Pay your fee steps. BLOCKED — do not route this page through 311 unless HHVC or SF.gov confirms a support route that uses 311. buttonTarget/URL is pending a confirmed SF.gov payment link; the button is non-functional until one is added.",
      "kind": "body",
      "paragraphs": [
        "Use the approved SF.gov payment or billing route to pay your Healthy Housing fee."
      ],
      "button": "Pay your Healthy Housing fee"
    },
```

- [ ] **Step 3: Edit the "If you need help" section**

Change:

```js
    {
      "heading": "If you need help",
      "karl": "Body: If you need help",
      "kind": "body",
      "paragraphs": [
        "Use the contact or help route listed on the final SF.gov fee page or payment notice.",
        "Do not publish staff-only payment instructions, internal account notes, or unverified fee details."
      ]
    },
```

to:

```js
    {
      "heading": "If you need help",
      "karl": "Body: If you need help. BLOCKED — do not publish staff-only payment instructions, internal account notes, or unverified fee details until confirmed.",
      "kind": "body",
      "paragraphs": [
        "Use the contact or help route listed on the final SF.gov fee page or payment notice."
      ]
    },
```

- [ ] **Step 4: Verify no leaked directive text remains in public fields**

Run: `grep -niI "do not route this page\|do not publish staff-only\|not yet confirmed" pages/pay-healthy-housing-fee.js`
Expected: 3 matches, all on lines containing `"karl":` (not `"paragraphs":` entries). (Corrected during execution: the original pattern used case/wording that didn't match the actual after-text specified in Steps 1-3 above.)

- [ ] **Step 5: Run structural validation**

Run: `node build_scripts/validate.js`
Expected: `validated 17 pages` printed, no thrown error.

- [ ] **Step 6: Commit**

```bash
git add pages/pay-healthy-housing-fee.js
git commit -m "fix: move internal fee-page directives out of public copy into karl notes"
```

---

### Task 2: Define the HHVC / Environmental Health / DPH relationship once, and standardize naming

**Files:**
- Modify: `pages/hhvc-inspection-scope.js`
- Modify: `pages/what-happens-after-report.js`
- Modify: `pages/reduce-indoor-moisture.js`
- Modify: `pages/report-mold-humidity-condensation.js`

**Interfaces:** None (prose-only changes).

- [ ] **Step 1: Add the canonical naming clarifier to `hhvc-inspection-scope.js`**

In the `"Use this page before you report"` section, change:

```js
      "paragraphs": [
        "This page helps you understand whether Healthy Housing and Vector Control may review a pest, vector, or housing health issue.",
        "Tenants, tenant representatives, friends, family members, and employees usually use reporting pages to report active pest or vector problems.",
        "Property owners and managers may use this page to understand HHVC scope before asking for prevention guidance or best-practice assistance."
      ]
```

to:

```js
      "paragraphs": [
        "This page helps you understand whether Healthy Housing and Vector Control may review a pest, vector, or housing health issue.",
        "Healthy Housing and Vector Control (HHVC) is part of the Environmental Health division of the San Francisco Department of Public Health (DPH). You may see any of these names used across this site — they refer to the same program.",
        "Tenants, tenant representatives, friends, family members, and employees usually use reporting pages to report active pest or vector problems.",
        "Property owners and managers may use this page to understand HHVC scope before asking for prevention guidance or best-practice assistance."
      ]
```

- [ ] **Step 2: Standardize `DPH` to `HHVC` in `what-happens-after-report.js`**

In the `"If a problem is found"` section, change:

```js
        "If a property owner does not correct the problem by the deadline, DPH may charge reinspection fees (starting with the third inspection visit for buildings with 3 or more units).",
```

to:

```js
        "If a property owner does not correct the problem by the deadline, HHVC may charge reinspection fees (starting with the third inspection visit for buildings with 3 or more units).",
```

- [ ] **Step 3: Standardize `SFDPH` to `HHVC` in `reduce-indoor-moisture.js`**

In the `"Do not buy third-party mold test kits"` section, change:

```js
        "Do not buy third-party mold test kits for an HHVC complaint.",
        "SFDPH does not accept third-party mold test results as part of a complaint investigation. Private laboratory results cannot be independently verified by the Department. SFDPH inspectors conduct their own on-site visual assessments in response to complaints."
```

to:

```js
        "Do not buy third-party mold test kits for an HHVC complaint.",
        "HHVC does not accept third-party mold test results as part of a complaint investigation. Private laboratory results cannot be independently verified by the Department. HHVC inspectors conduct their own on-site visual assessments in response to complaints."
```

- [ ] **Step 4: Standardize `SFDPH` to `HHVC` in `report-mold-humidity-condensation.js`**

In the mold-kit `callout`, change:

```js
          "callout": {
            "karl": "Body note: Mold kit guidance",
            "text": "Do not buy a mold test kit. SFDPH does not accept or use third-party mold kits for HHVC review."
          },
```

to:

```js
          "callout": {
            "karl": "Body note: Mold kit guidance",
            "text": "Do not buy a mold test kit. HHVC does not accept or use third-party mold kits for review."
          },
```

- [ ] **Step 5: Verify no unstandardized `SFDPH`/bare `DPH` naming remains in these 3 files**

Run: `grep -n "SFDPH\|[^F]DPH" pages/what-happens-after-report.js pages/reduce-indoor-moisture.js pages/report-mold-humidity-condensation.js`
Expected: no matches (all renamed to `HHVC`).

- [ ] **Step 6: Run structural validation**

Run: `node build_scripts/validate.js`
Expected: `validated 17 pages` printed, no thrown error.

- [ ] **Step 7: Commit**

```bash
git add pages/hhvc-inspection-scope.js pages/what-happens-after-report.js pages/reduce-indoor-moisture.js pages/report-mold-humidity-condensation.js
git commit -m "fix: define HHVC/Environmental Health/DPH relationship once, standardize naming to HHVC"
```

---

### Task 3: Fix third-person pronoun breaks and the vague "when appropriate" qualifier (6 files)

These six files each print the same "an inspector may contact **the person who reported** the issue" phrasing right after a second-person ("you") context, plus a vague "when appropriate" qualifier describing no-notice inspections. This task rewrites all six identically (adapted to each file's exact surrounding text).

**Files:**
- Modify: `pages/report-bed-bugs.js`
- Modify: `pages/report-cockroaches.js`
- Modify: `pages/report-rats-or-mice.js`
- Modify: `pages/report-mold-humidity-condensation.js`
- Modify: `pages/report-mosquitoes.js`
- Modify: `pages/what-happens-after-report.js`

- [ ] **Step 1: Fix `report-bed-bugs.js`, `report-cockroaches.js`, `report-rats-or-mice.js`, `report-mold-humidity-condensation.js` (identical "What happens next" paragraph block in all 4)**

In each file's `"What happens next"` section, change:

```js
        "Environmental Health may review the report. If contact information is provided, an inspector may contact the person who reported the issue to ask questions or schedule a visit.",
        "It can take a few days for 311 to route the complaint to Environmental Health and for HHVC to assign it to an inspector. Complaints are processed on weekdays.",
        "If no contact information is provided, an inspection may still occur without notice when appropriate.",
```

to:

```js
        "Environmental Health may review the report. If you gave contact information, an inspector may contact you to ask questions or schedule a visit.",
        "It can take a few days for 311 to route the complaint to Environmental Health and for HHVC to assign it to an inspector. Complaints are processed on weekdays.",
        "If you did not give contact information, an inspection may still happen without notice, for example if the report describes an urgent health or safety risk.",
```

- [ ] **Step 2: Fix `report-mosquitoes.js` "What may happen next" section**

Change:

```js
      "paragraphs": [
        "Environmental Health may review the report. A vector inspector may check for standing water, mosquito breeding sources, or nearby catch basins when appropriate.",
        "If contact information is provided, an inspector may contact the person who reported the issue to ask questions or schedule a visit."
      ]
```

to:

```js
      "paragraphs": [
        "Environmental Health may review the report. A vector inspector may check for standing water, mosquito breeding sources, or nearby catch basins.",
        "If you gave contact information, an inspector may contact you to ask questions or schedule a visit."
      ]
```

- [ ] **Step 3: Fix `what-happens-after-report.js` step texts**

Change the `"An inspector may contact you"` step:

```js
        {
          "title": "An inspector may contact you",
          "text": [
            "If contact information is provided, an inspector may contact the person who reported the problem to ask questions or schedule a visit."
          ],
          "karl": "Body step: Inspector contact"
        },
```

to:

```js
        {
          "title": "An inspector may contact you",
          "text": [
            "If you gave contact information, an inspector may contact you to ask questions or schedule a visit."
          ],
          "karl": "Body step: Inspector contact"
        },
```

Change the `"An inspection may happen"` step:

```js
        {
          "title": "An inspection may happen",
          "text": [
            "If no contact information is provided, an inspection may still occur without notice when appropriate and when areas can be accessed."
          ],
          "karl": "Body step: Inspection expectations"
        }
```

to:

```js
        {
          "title": "An inspection may happen",
          "text": [
            "If you did not give contact information, an inspection may still happen without notice when areas can be accessed, for example if the report describes an urgent health or safety risk."
          ],
          "karl": "Body step: Inspection expectations"
        }
```

- [ ] **Step 4: Verify no remaining instances of the third-person phrase or the fixed vague qualifiers**

Run: `grep -rn "person who reported" pages/`
Expected: no matches.

Run: `grep -rln "without notice when appropriate" pages/`
Expected: no matches.

- [ ] **Step 5: Run structural validation**

Run: `node build_scripts/validate.js`
Expected: `validated 17 pages` printed, no thrown error.

- [ ] **Step 6: Commit**

```bash
git add pages/report-bed-bugs.js pages/report-cockroaches.js pages/report-rats-or-mice.js pages/report-mold-humidity-condensation.js pages/report-mosquitoes.js pages/what-happens-after-report.js
git commit -m "fix: address reader as you consistently, replace vague no-notice-inspection qualifier"
```

---

### Task 4: Standardize "landlord" to "property owner or manager"; give `report-mosquitoes.js` the same tenant-rights parity as its sibling pages

**Files:**
- Modify: `pages/report-bed-bugs.js`
- Modify: `pages/report-cockroaches.js`
- Modify: `pages/report-rats-or-mice.js`
- Modify: `pages/report-mold-humidity-condensation.js`
- Modify: `pages/what-happens-after-report.js`
- Modify: `pages/report-mosquitoes.js`

**Interfaces:** None (prose-only + one additive callout matching an existing sitewide pattern).

- [ ] **Step 1: Fix the anti-retaliation callout in `report-bed-bugs.js`, `report-cockroaches.js`, `report-rats-or-mice.js`, `report-mold-humidity-condensation.js` (identical text in all 4)**

In each file's tenant-rights `callout`, change:

```js
        "text": "Tenants have rights to safe and habitable housing. Landlords cannot retaliate because a tenant reports housing conditions to the City."
```

to:

```js
        "text": "Tenants have rights to safe and habitable housing. A property owner or manager cannot retaliate because a tenant reports housing conditions to the City."
```

- [ ] **Step 2: Fix `what-happens-after-report.js`**

Change:

```js
        "A landlord cannot retaliate because a tenant reports a housing condition to 311 or a health department."
```

to:

```js
        "A property owner or manager cannot retaliate because a tenant reports a housing condition to 311 or a health department."
```

- [ ] **Step 3: Add the missing enforcement sentence + anti-retaliation callout to `report-mosquitoes.js`**

`report-mosquitoes.js` is the only one of the 5 twin Transaction pages missing the enforcement statement and tenant-rights callout its siblings all carry. Change:

```js
    {
      "heading": "What may happen next",
      "karl": "Body: After-report expectations",
      "kind": "body",
      "paragraphs": [
        "Environmental Health may review the report. A vector inspector may check for standing water, mosquito breeding sources, or nearby catch basins.",
        "If you gave contact information, an inspector may contact you to ask questions or schedule a visit."
      ]
    },
```

to:

```js
    {
      "heading": "What may happen next",
      "karl": "Body: After-report expectations, concise enforcement statement, and tenant rights callout — brought to parity with the other 4 report pages.",
      "kind": "body",
      "paragraphs": [
        "Environmental Health may review the report. A vector inspector may check for standing water, mosquito breeding sources, or nearby catch basins.",
        "If you gave contact information, an inspector may contact you to ask questions or schedule a visit.",
        "If HHVC finds a violation, the City may require the property owner or responsible party to correct it."
      ],
      "callout": {
        "karl": "Body note: Tenant rights / anti-retaliation reassurance",
        "text": "Tenants have rights to safe and habitable housing. A property owner or manager cannot retaliate because a tenant reports housing conditions to the City."
      }
    },
```

(Note: this task must run after Task 3's edit to this same paragraph block — the "before" text above already reflects Task 3's fix.)

- [ ] **Step 4: Verify no remaining "landlord" references outside this file's own already-updated text**

Run: `grep -rin "landlord" pages/`
Expected: no matches (all replaced with "property owner or manager").

- [ ] **Step 5: Run structural validation**

Run: `node build_scripts/validate.js`
Expected: `validated 17 pages` printed, no thrown error.

- [ ] **Step 6: Commit**

```bash
git add pages/report-bed-bugs.js pages/report-cockroaches.js pages/report-rats-or-mice.js pages/report-mold-humidity-condensation.js pages/what-happens-after-report.js pages/report-mosquitoes.js
git commit -m "fix: standardize property owner/manager terminology, add missing tenant-rights parity to mosquito report page"
```

---

### Task 5: Align Info-page reporting threshold with the Report-page 72-hour standard

**Files:**
- Modify: `pages/prevent-cockroaches.js`
- Modify: `pages/prevent-mosquitoes.js`
- Modify: `pages/keep-rats-and-mice-out.js`

**Interfaces:** None (prose-only; the corresponding Report pages already state the 72-hour standard explicitly in their own Step 2 — this task only makes the Info pages' summary consistent with it, it does not change any Report page).

- [ ] **Step 1: Edit `prevent-cockroaches.js`, `prevent-mosquitoes.js`, `keep-rats-and-mice-out.js` (identical sentence in all 3)**

In each file's `"When someone should report"` section, change:

```js
        "A tenant, tenant helper, affected resident, or employee can report through 311 if the problem continues, affects a shared area, or the property owner or manager does not respond.",
```

to:

```js
        "A tenant, tenant helper, affected resident, or employee can report through 311 if the problem continues after 72 hours, affects a shared area, or the property owner or manager does not respond.",
```

- [ ] **Step 2: Verify all 3 files now state the 72-hour threshold**

Run: `grep -c "if the problem continues after 72 hours" pages/prevent-cockroaches.js pages/prevent-mosquitoes.js pages/keep-rats-and-mice-out.js`
Expected: `1` for each of the 3 files.

- [ ] **Step 3: Run structural validation**

Run: `node build_scripts/validate.js`
Expected: `validated 17 pages` printed, no thrown error.

- [ ] **Step 4: Commit**

```bash
git add pages/prevent-cockroaches.js pages/prevent-mosquitoes.js pages/keep-rats-and-mice-out.js
git commit -m "fix: align Info-page reporting threshold with the 72-hour standard used on Report pages"
```

---

### Task 6: Dedupe conflicting related-page card descriptions in `agency-service-grouping.js`

**Files:**
- Modify: `pages/agency-service-grouping.js`

**Interfaces:** None (prose-only; card `target` values are unchanged, so `validate.js`'s link-target check is unaffected).

- [ ] **Step 1: Standardize the two `afterReport` card descriptions to the sitewide canonical sentence**

In the `"Know what HHVC can inspect"` cluster, change:

```js
        {
          "title": "What happens after you report",
          "text": "Learn how 311 reports are reviewed and when an inspector may contact you.",
          "target": "afterReport",
          "karl": "Topic page resource item"
        }
```

to:

```js
        {
          "title": "What happens after you report",
          "text": "Learn how reports are reviewed, assigned on weekdays, and when an inspector may contact you.",
          "target": "afterReport",
          "karl": "Topic page resource item"
        }
```

In the `"Tenant rights and help"` cluster, change:

```js
        {
          "title": "What happens after you report",
          "text": "Learn what may happen after your report is sent to Environmental Health.",
          "target": "afterReport",
          "karl": "Topic page resource item"
        }
```

to:

```js
        {
          "title": "What happens after you report",
          "text": "Learn how reports are reviewed, assigned on weekdays, and when an inspector may contact you.",
          "target": "afterReport",
          "karl": "Topic page resource item"
        }
```

- [ ] **Step 2: Standardize the two `bedBugsInfo` card descriptions**

In the `"Prevent pests and housing health problems"` cluster, the card text already reads:

```js
          "text": "Learn about bed bug rules, treatment preparation, and prevention.",
```

Leave this one as-is (it becomes the canonical text). In the `"Tenant rights and help"` cluster, change:

```js
        {
          "title": "Bed bug rules and prevention",
          "text": "Learn about bed bug prevention, treatment preparation, and rules.",
          "target": "bedBugsInfo"
        }
```

to:

```js
        {
          "title": "Bed bug rules and prevention",
          "text": "Learn about bed bug rules, treatment preparation, and prevention.",
          "target": "bedBugsInfo"
        }
```

- [ ] **Step 3: Verify both card pairs now match**

Run: `grep -c "Learn how reports are reviewed, assigned on weekdays, and when an inspector may contact you." pages/agency-service-grouping.js`
Expected: `2`

Run: `grep -c "Learn about bed bug rules, treatment preparation, and prevention." pages/agency-service-grouping.js`
Expected: `2`

- [ ] **Step 4: Run structural validation**

Run: `node build_scripts/validate.js`
Expected: `validated 17 pages` printed, no thrown error.

- [ ] **Step 5: Commit**

```bash
git add pages/agency-service-grouping.js
git commit -m "fix: dedupe conflicting related-page card descriptions on the topic page"
```

---

### Task 7: Replace the duplicated Director's Rules card on `report-bed-bugs.js` with a pointer to the Info page

**Files:**
- Modify: `pages/report-bed-bugs.js`

**Interfaces:**
- Consumes: `bedBugsInfo` page key (defined in `pages/bed-bug-rules-prevention.js`, already a valid `HHVC_PAGES` key — unchanged by this task).

- [ ] **Step 1: Replace the external card with an internal pointer card**

Change:

```js
    {
      "heading": "Bed bug rules",
      "karl": "Body: External reference link to official bed bug Director’s Rules PDF",
      "kind": "placement",
      "paragraphs": [
        "For detailed bed bug prevention and control rules, use the official SFDPH Director’s Rules."
      ],
      "cards": [
        {
          "title": "San Francisco Department of Public Health — Director’s Rules and Regulations for Prevention and Control of Bed Bugs",
          "text": "Reference the Director’s Rules for bed bug prevention, control, owner responsibilities, and treatment preparation standards.",
          "url": "https://drive.google.com/file/d/1PPwhA3IeJ-jl5es0TvbmSAB_J8UjK8LP/view",
          "karl": "Body link or external reference link: official bed bug Director’s Rules PDF"
        }
      ]
    },
```

to:

```js
    {
      "heading": "Bed bug rules",
      "karl": "Body: Pointer to the Info page's own Director's Rules reference, instead of duplicating the external PDF link on both the Report and Info pages.",
      "kind": "placement",
      "paragraphs": [
        "For detailed bed bug prevention and control rules, see the bed bug rules and prevention page."
      ],
      "cards": [
        {
          "title": "Bed bug rules and prevention",
          "text": "Learn about bed bug rules, treatment preparation, and prevention, including the official Director's Rules reference.",
          "target": "bedBugsInfo"
        }
      ]
    },
```

- [ ] **Step 2: Verify the external Google Drive URL no longer appears in this file**

Run: `grep -c "drive.google.com" pages/report-bed-bugs.js`
Expected: `0`

- [ ] **Step 3: Run structural validation**

Run: `node build_scripts/validate.js`
Expected: `validated 17 pages` printed, no thrown error. (This also confirms `bedBugsInfo` resolves as a valid link target.)

- [ ] **Step 4: Commit**

```bash
git add pages/report-bed-bugs.js
git commit -m "fix: link to the bed bug rules Info page instead of duplicating its external reference card"
```

---

### Task 8: Rebuild single-file exports and do a manual visual pass

**Files:**
- Modify (generated, not hand-edited): `manager-review-single-file.html`, `single-file-export-current-source.html`

**Interfaces:** None (build step only).

- [ ] **Step 1: Regenerate both single-file HTML exports**

Run: `node build_scripts/build-single-file.js`
Expected: no error; both `manager-review-single-file.html` and `single-file-export-current-source.html` are rewritten.

- [ ] **Step 2: Run final structural validation over the whole page set**

Run: `node build_scripts/validate.js`
Expected: `validated 17 pages` printed, no thrown error.

- [ ] **Step 3: Manual spot check in a browser**

Open `index.html` (or either regenerated single-file export) locally and visit, at minimum: `pestsTopic` (topic page — check the two deduped related-page clusters), `scopeInfo` (check the new naming-clarifier paragraph), `payFee` (confirm the 3 blocked sections read cleanly with no leftover directive text), and one Report page pair (e.g. `report-bed-bugs.js` + `bed-bug-rules-prevention.js` — confirm the new pointer card navigates correctly and no console errors appear).

- [ ] **Step 4: Commit the regenerated exports**

```bash
git add manager-review-single-file.html single-file-export-current-source.html
git commit -m "chore: regenerate single-file exports after critical + cross-cutting content fixes"
```

---

## Still Open After This Plan

These were identified in the full content review but are intentionally not covered here (see "Explicitly Out of Scope" above) — worth a follow-up plan:

- Real fee data for `pay-healthy-housing-fee.js` (amount, due date, account requirements, payment URL) — requires stakeholder input, not a content edit.
- Official (non–Google Drive) host for the bed bug Director's Rules PDF.
- URL verification for the two external links in `tenant-rights-reporting.js`.
- Per-page prose simplification: `reduce-indoor-moisture.js`'s dense "When to report instead" sentence, `what-happens-after-report.js`'s legal jargon in the enforcement section, and first-use definitions for "Article 11," "SRO," "vector," and "hygrometer" across several pages.
