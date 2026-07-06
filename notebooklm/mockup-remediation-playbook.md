# Solo Editor's Mockup Remediation Playbook: High-Impact Edits Before Your Manager Presentation

This playbook is designed for you to use as a step-by-step workbook to prepare the mockup codebase in your **HHVC Manager Review Tool** (`HHVC_manager_review_current_tool_package`) before presenting to your manager. It focuses strictly on remediating the highest-risk unverified copy and aligning the files with the active **Web Governance and Content Standards Manual**.

---

## Part 1: The Showcase Service Pathway (Mold & Moisture)

To demonstrate the power of the design system, present this end-to-end water-intrusion pathway as your primary "Before & After" proof of concept.

### 1. GH-033: Reduce Indoor Moisture, Condensation, and Humidity (`pages/reduce-indoor-moisture.js`)

- **The Goal**: Establish a single, authoritative public guide that explains the science of condensation in plain language.
- **Active Edits Required**:
  - **Audience Callout**: Ensure the standard Chapter 6 phrase is present near the top: _"This page can help if you are a renter, SRO/residential hotel resident, property owner, manager, or building maintenance worker."_
  - **The Physics of Airflow**: Integrate the explanation of the three physical mechanisms of airflow (removing damp air, warming cold surfaces, and accelerating evaporation) as your best defense.
  - **The Nine Practical Steps**: Confirm all 9 moisture-control tips are fully visible. Do not hide them inside collapsible accordions (prohibited on Information pages). Ensure the following details are exact:
    - Keep relative humidity below 55% (ideally between 40% and 50%) using a hygrometer.
    - Open windows daily for 5 to 15 minutes to "flush" the air.
    - Test exhaust fans using the "toilet-tissue suction check."
    - Pull furniture at least 6 inches away from cold exterior walls to prevent stagnant pockets.
  - **Eradication Boundaries**: Instruct users to clean small mold areas with simple soap and water. State explicitly: _Never use bleach on porous surfaces, and never paint over mold._

### 2. GH-019: Report Mold from Humidity or Condensation (`pages/prevent-cockroaches.js` / adjacent transaction files)

- **The Goal**: Provide a streamlined, task-focused intake node that protects DPH resources from wrong-route structural issues.
- **Active Edits Required**:
  - **The 72-Hour Rule**: Tenants must notify property owners in writing first and wait at least 72 hours for a response before requesting an inspection.
  - **HHVC vs. DBI Routing**:
    - _Department of Building Inspection (DBI)_: Routes structural water leaks (leaking roofs, window frame failures, broken water heaters, dripping plumbing pipes).
    - _HHVC_: Routes condensation, humidity-related mold, and mechanical ventilation failures (broken exhaust fans).
  - **Inspection Threshold**: Visible mold must be actively growing on structural surfaces (walls or ceilings) and total at least 10 square feet to trigger enforcement.
  - **Jurisdiction Cap**: DPH does not have jurisdiction over personal property (clothing, furniture, or household items).

---

## Part 2: Critical Vector-Control Scope Corrections

These edits correct major operational errors in the existing codebase and ensure your mockups accurately represent HHVC's real inspection powers.

### 1. Fly Information Page (`pages/fly-information.js` / GH-009)

- **Current Code Error**: States that HHVC does not treat flies directly and only reviews breeding conditions.
- **Corrected Scope Block**: Replace the reporting threshold section to explicitly state HHVC's active inspection and enforcement powers under the San Francisco Health Code:
  ```javascript
  {
    heading: 'When to report',
    karl: 'Body: Reporting threshold and active enforcement routing. HHVC inspects active infestations and enforces fly control under the San Francisco Health Code.',
    kind: 'body',
    paragraphs: [
      'HHVC inspects active fly infestations and enforces fly control requirements under the San Francisco Health Code. If you rent your home, tell your landlord or property manager about the fly problem in writing first. Give them 72 hours to respond and start fixing the breeding source.',
      'You should report the issue to 311 if the fly infestation continues, if flies are breeding in shared areas (like communal kitchens, garbage rooms, or courtyards), or if your landlord does not respond.',
    ],
    cards: [
      {
        title: 'Report flies or breeding conditions',
        text: 'Report active fly infestations or unsanitary conditions breeding flies through 311 for HHVC inspection.',
        target: 'garbageReport',
      },
    ],
  }
  ```

### 2. Ground Wasp Information Page (`pages/ground-wasp-information.js` / waspInfo)

- **Current Code Error**: States that HHVC does not remove nests and only reviews general attractants.
- **Corrected Scope Block**: Update the reporting and action sections to reflect the dual-track enforcement model:
  ```javascript
  {
    heading: 'When to report',
    karl: 'Body: Reporting threshold and dual-track routing. HHVC inspects suspected nests to verify safety hazards and issue referrals or owner-correction orders.',
    kind: 'body',
    paragraphs: [
      'HHVC inspects suspected ground wasp nests to verify safety hazards. If you are a tenant, notify your landlord or property manager in writing immediately so they can address this safety hazard. If they do not respond or fail to hire a professional, report the nest to 311 to request an HHVC inspection.',
      'If an HHVC inspector finds a ground wasp nest on city or public property, we will refer the issue to the appropriate sister agency for safe removal. If the nest is on private residential property, HHVC will require the property owner to contract a licensed Pest Control Operator (PCO) to eliminate the nest.',
    ],
    cards: [
      {
        title: 'Report a ground wasp nest',
        text: 'Request an HHVC inspection for a suspected ground wasp nest on public or private residential property.',
        target: 'vegetationReport',
      },
    ],
  }
  ```

---

## Part 3: Legally Binding Deadlines and Enforceable Phrasing

Correct highly specific legal details on unverified pages to protect DPH from liability.

### 1. What Happens After You Report (`pages/what-happens-after-report.js` / GH-023)

- **Legal Deadlines (Verify or Caveat)**:
  - State that _sewage backups require correction within 48–72 hours_.
  - State that _general violations require correction within 30 days_.
  - Add the standard manual caveat: _"These timelines represent general enforcement standards. Actual correction deadlines are established on the official Notice of Violation based on the severity of the health hazard."_
- **No-Promise Rule**: Explicitly state that HHVC cannot guarantee exact inspection dates, immediate contact, or specific legal outcomes.

### 2. Owner IPM Guidance (`pages/integrated-pest-management-property-managers.js` / GH-022)

- **Enforceable Phrasing**: Under the structural sealing section, you must use the precise, legally enforceable terminology: **"rodent-proof materials."**
- **Material Definitions**: List the approved durable materials: **hardware cloth, copper mesh, sheet metal, concrete, mortar, or steel wool backed by sealant**.

---

## Part 4: Clinical Claims Clearance (The "Why It Matters" Pass)

Use the **Disease-Risk Reference Sheet** to verify and clear the health claims on the 11 affected pages in one combined review pass:

1.  **Extract the Health Blocks**: Collect the "Why it matters" sections from:
    - `bedBugsInfo` (skin irritation, sleep deprivation, non-disease vector status)
    - `flyInfo` (bacterial transmission, food poisoning, dysentery)
    - `waspInfo` (localized stings vs. systemic multi-sting kidney risk)
    - `ratsPrevent` & `ownerGuidance` (Hantavirus, Leptospirosis, Salmonella)
    - `miteInfo` (tropical rat mite dispersal dynamics after rodenticides)
    - `pigeonInfo` (histoplasmosis, psittacosis respiratory risks)
    - `cockroachesPrevent` (asthma trigger from casings/feces, Salmonella)
    - `mosquitoesPrevent` & `wnvBirdReport` (West Nile virus vector transmission)
2.  **Manager Presentation**: Present the consolidated reference sheet to your manager. Explain: _"To avoid legal and medical liability, I extracted all disease-transmission and health claims into this single sheet. We can route this to our Vector Control Program or medical officers for a single, one-pass scientific sign-off, which will instantly clear Check 13 (Public Health) for all eleven pages."_

---

## Part 5: Technical Script Alignments

To ensure your Excel tracking dashboard displays correct metrics for your manager, perform these two developer fixes:

1.  **Patch the File Sync Script**: Open `build_scripts/sync-tracking-sheet.js`. Ensure the hardcoded list of file paths includes these six missing files:
    - `report-a-problem.js`
    - `prevent-problems.js`
    - `prevent-overgrown-vegetation.js`
    - `prevent-garbage-clutter.js`
    - `ground-wasp-information.js`
    - `fly-information.js`
    - _Why_: This fixes the bug where these files are completely omitted from your exported `review/mockup_tracking_sheet.csv`.
2.  **Automate Blocker Detection**: Update the script's regex scan to search pages programmatically for the terms `BLOCKED` or `SME` inside their `editorNote` fields, rather than relying on a manually maintained dictionary. This will ensure your dashboard accurately reflects the five blocked/SME-blocked pages.
