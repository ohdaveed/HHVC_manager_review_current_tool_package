**Chapter 1: Purpose, Scope, and Governance**

| Field                       | Value                                                                   |
| :-------------------------- | :---------------------------------------------------------------------- |
| **Document Title**          | HHVC Web Governance and Content Standards Manual                        |
| **Version**                 | 2.1 Draft Update (Hybrid)                                               |
| **Date**                    | July 6, 2026                                                            |
| **Status**                  | Updated working draft                                                   |
| **Primary Standard**        | SF.gov and Karl CMS Editor Help Center                                  |
| **Project Source of Truth** | HHVC Web Governance and Content Standards Manual source-of-truth update |
| **Tracking Tool**           | Content governance tracker in the Sfgov publication repository          |

---

### 1.1 Purpose

This manual establishes the authoritative content governance standards for the Healthy Housing and Vector Control (HHVC) program's public-facing presence on SF.gov.

The development of this manual is driven by two critical citywide and regulatory requirements:

1. **Resident Task Autonomy:** Helping San Francisco residents find information quickly, complete essential transactions independently, and easily understand complex municipal service pathways.
2. **Federal Accessibility Compliance:** Meeting the strict requirements of Title II of the Americans with Disabilities Act (ADA), which mandates that all digital assets conform to the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA standard to guarantee access for users with disabilities.

This manual provides clear, actionable instructions to enable HHVC staff to plan, write, review, publish, and maintain digital content. Its goal is not to document the program's internal administrative procedures, but rather to ensure that every public-facing web page helps residents understand available services, complete the correct task, and know exactly what to expect next.

---

### 1.2 Authority of This Manual

This manual is the governing standard for all public-facing HHVC content on SF.gov.

This document implements the U.S. Department of Justice's final rule on web and mobile accessibility under ADA Title II (28 CFR Part 35). For public entities with a population of 50,000 or more, including the City and County of San Francisco, the compliance deadline is **April 26, 2027**. Conformance with the WCAG 2.1 Level AA technical standard is a mandatory legal floor, not an optional stretch goal. In any instance where this manual and the federal rule conflict, the federal requirement controls.

This manual formally governs:

- HHVC content planning and information architecture.
- Selecting the correct page types in Karl CMS.
- The proper and restricted use of Karl CMS components.
- Standardized page templates, layout hierarchies, and required page sections.
- Plain-language writing, readability levels, and translation-readiness rules.
- Search Engine Optimization (SEO) titles, meta descriptions, and link conventions.
- Public-facing explanations of Health Code Article 11, inspections, fees, notices of violation, and inter-agency routing.
- Draft change control, annual content maintenance, and archival policies.

---

### 1.3 Relationship to SF.gov and Karl CMS

All HHVC web pages must align fully with the design, structural, and technical rules of SF.gov and its custom content management system, **Karl CMS**. Karl CMS uses pre-determined page types and restricted component layouts to guarantee sitewide accessibility, responsiveness, and a unified visual design that cannot be customized by individual departments.

This manual serves as a program-specific supplement to the official SF.gov and Karl CMS Editor Help Center guidelines. To maintain compliance and resolve any contradictions in editing standards, staff must adhere to the following strict order of authority:

1. **Federal ADA Title II Web Accessibility Rule (28 CFR Part 35)**
2. **SF.gov General Web and Editorial Standards**
3. **Karl CMS Platform-Specific Rules**
4. **HHVC Web Governance and Content Standards Manual**
5. **HHVC Program-Specific Content Guidance**
6. **Legacy HHVC Content or Historical Branch Practices**

While program-specific guidance may add technical detail, it is never permitted to weaken or bypass broader SF.gov or Karl CMS standards.

---

### 1.4 Scope

The standards, rules, and checklists set forth in this manual apply to all public-facing HHVC content hosted on SF.gov, including:

- All active, staged, and draft HHVC pages.
- All Topic, Transaction, Information, Step-by-step, Campaign, and About pages.
- All Resource Collections, digital guides, forms, and PDF handouts.
- Plain-language restatements of Health Code Article 11 and Article 11A.
- Explanations of 311 complaint workflows, inspections, and Notice of Violation (NOV) processes.
- Information detailing annual program fees, reinspection fees, and payment methods.
- Routing copy that directs residents to adjacent departments, such as the Department of Building Inspection (DBI).

---

### 1.5 Jurisdictional Boundaries & Wrong-Door Routing

To prevent public confusion and save administrative triaging time, this manual codifies strict wrong-door routing standards based on official program matrices:

- **HHVC vs. DBI (Moisture Division):** HHVC investigates condensation, indoor humidity, and mechanical ventilation failures (such as broken kitchen or bathroom exhaust fans). Conversely, active structural plumbing leaks, dripping hot water heaters, structural window-frame seal failures, and leaking roof frames are completely out of HHVC's scope and must be routed immediately to the Department of Building Inspection (DBI).
- **Mold Threshold (Structural Mold Limit):** DPH inspectors can take regulatory action only on visible, structural mold growing on walls or ceilings that measures at least 10 square feet. Minor mold or dampness resulting from tenant housekeeping or poor indoor airflow is excluded.
- **No Personal Belongings (Personal Property Exclusion):** By municipal ordinance, DPH holds zero legal jurisdiction over personal property. The Department cannot inspect or issue violations for mold or vectors found on furniture, mattresses, clothing, or rugs.
- **Wildlife Routing:** HHVC regulates vector-breeding sanitation (such as standing water for mosquitoes or loose garbage for rats). The actual physical trapping or biological management of wild animals (including raccoons and feral cats) is entirely out of HHVC's scope and must be routed directly to San Francisco Animal Care & Control (ACC).

---

### 1.6 Out of Scope

This manual is strictly a digital content and communication standard; it is not an operational guide. It does not govern:

- Internal HHVC branch workflows or inspector standard operating procedures (SOPs).
- Field inspection protocols, technical testing methodologies, or case-assignment rules.
- Internal inspector training, evidence gathering, or case-file documentation.
- Internal escalations, enforcement decisions, or personnel management.
- Legal strategies for hearings, court referrals, or the preparation of Director's Hearings.

Internal administrative details may only be published if they directly affect a resident’s ability to use a service, understand a legal obligation, prepare for an inspection, or navigate a fee payment.

---

### 1.7 Sourcing Provenance & Content Confidence Tiers

Every public page draft in the repository must be catalogued in the Content Governance Tracker against specific source document IDs. Page content is split into three strict tiers:

- **Tier 1 (Claim-Audited):** Checked line-by-line against specific named source documents and verified in a formal audit matrix.
- **Tier 2 (Flagged, Unaudited):** Content that is conceptually aligned with program services but contains unverified timelines, requirements, or procedural claims.
- **Tier 3 (Plausible Placeholder):** Purely illustrative mockup copy written to populate structural slots during early development. Tier 3 copy must be completely replaced or audited to Tier 1 before staging.

**Critical Refactoring De-Class Rule:** Our audits prove that developer refactoring frequently introduces unverified content. Any structural or text modifications made to an audited (Tier 1) page automatically strips its "Pass" status, requiring a human re-audit of its citable claims before staging.

---

### 1.8 Who Should Use This Manual

This manual is a day-to-day reference guide designed to remove reliance on personal preference or legacy branch memory. It must be used by:

- **HHVC Content Editors and Writers** drafting or updating pages.
- **HHVC Program Managers and Inspectors** verifying technical and legal accuracy.
- **Environmental Health Branch (EHB) and SFDPH Communications Staff** reviewing copy for public alignment.
- **Karl CMS Editors and Digital Services Partners** auditing and staging HHVC pages.

---

### 1.9 Core Governance Principles

All HHVC content must be planned, written, and maintained in accordance with seven foundational principles:

#### 1. Start With Resident Needs

SF.gov is a service-centered delivery platform, not an informational dump. Group and label pages around the common public terms residents use to describe their everyday problems (e.g., "Pests and housing problems" as the main Topic hub) rather than the Department's internal organizational charts. Every page must clearly tell the user:

- Who is this page for?
- What can I do here?
- How do I get started?
- What happens next?
- Who is responsible for taking action?
- Where can I find more help?

#### 2. One Primary Task per Page

To prevent cognitive overload, each web page must focus on a single, clear goal. Do not combine unrelated actions, such as reporting cockroaches and reviewing hotel inspection history, on the same page. If a page begins to cover multiple distinct needs, split it into separate pages and link them contextually.

#### 3. Choose the Correct Karl Content Type

Selecting the correct page template is vital for scannability and structural alignment. Editors must use only these approved page types: Topic, Transaction, Information, Step-by-step, Campaign, and Resource Collection.

#### 4. Keep Pages Short and Scannable

Residents rarely read web pages line-by-line; they skim to find immediate answers. Place the primary call to action (CTA) near the top. Skip long introductory backgrounds. Use short sentences (15-20 words) and scannable bulleted lists.

#### 5. Make Responsibilities Clear

Web content must remove all ambiguity regarding municipal and private duties. Pages must clearly distinguish between tenant duties, property owner/manager duties, HHVC duties, 311 duties, and DBI duties.

#### 6. Explain What Happens Next

Never leave a resident in a digital dead end. Every transactional page must explain the next physical steps in the service cycle, detailing timelines, inspection expectations, and what occurs if a property owner fails to comply.

#### 7. Maintain Trust

The public relies on DPH as the single, current source of truth. Every page must have a named content owner and review schedule. Every page must link to active, verified resources and cite the correct legal basis.

---

### 1.10 Required Governance Checks Before Publication

Before any draft is approved for staging or publication on SF.gov, the editor must verify that it meets the following required standards:

| Check                    | Required Standard    | Pass Condition                                                                    |
| :----------------------- | :------------------- | :-------------------------------------------------------------------------------- |
| **Resident Need**        | User focus           | The page addresses a clear, documented public need or service goal.               |
| **Page Task**            | Single focus         | The page supports exactly one primary resident task or goal.                      |
| **Karl Content Type**    | Structural alignment | The page is built on the approved Karl template that matches its goal.            |
| **Karl Components**      | Component rules      | Only approved components (Callouts, Accordions, Cards) are used.                  |
| **Audience**             | Named groups         | The target audience is clearly identified using the required format.              |
| **Call to Action (CTA)** | Prominent action     | The main task button or link is distinct and placed near the top.                 |
| **Plain Language**       | Simple vocabulary    | The text uses common words, active voice, and meets grade-level targets.          |
| **Accessibility**        | WCAG 2.1 AA          | Headings are sequentially nested; tables are simple; links are descriptive.       |
| **SEO**                  | Metadata rules       | Page title is under 65 chars; description is under 110 chars.                     |
| **Routing**              | Clear boundaries     | The page accurately routes non-HHVC issues (e.g., structural leaks) to DBI/311.   |
| **What Happens Next**    | Timelines            | The user is told what the Department does next and what timelines apply.          |
| **Legal Accuracy**       | Verified citations   | References to Article 11/11A and the FY27 fee schedules are verified and current. |
| **Maintenance**          | Ownership            | A named content owner, last reviewed date, and next review date are recorded.     |

---

### 1.11 AI-Assisted Draft Content, Automated Agents & Human Oversight

The HHVC program repository utilizes automated agent classes (e.g., Intake & Metadata Agent, Merge Review Agent, Folder Organizer Agent) to assist with codebase validation, file sorting, and drafting.

However, AI tools cannot replace human editorial oversight or official program review. **No automated agent may programmatically set a page status to "Approved to Move = Yes."** Final QA approval, staging, and publication remain human-in-the-loop decisions.

All AI-assisted drafts must be rigorously reviewed by a content editor and program manager before staging to guarantee that:

- The text is 100% grounded in verified HHVC source documents.
- No training-data assumptions or unverified timelines have been introduced.
- The terminology is legally accurate and correctly routes residents between HHVC and DBI.

---

### 1.12 Mandatory Legal & Statutory Citations

To ensure our public text is legally defensible, all HHVC pages must be grounded in these specific municipal and state codes:

- **SF Health Code Article 11:** General authority for housing sanitation and public health inspections.
- **SF Health Code Article 11A:** Bed bug rules, landlord disclosure requirements, and tenant notice rules.
- **SF Health Code Section 609:** Statutory basis for the billing and collection of the Healthy Housing Fee.
- **SF Health Code Section 581:** Statutory nuisance definitions (Sec. 581(b)(1) garbage, 581(b)(2) weeds, 581(b)(6) mold, 581(b)(8) insects, 581(b)(13) rodents).
- **SF Rent Ordinance Section 37.9(d):** Protection for tenants against landlord retaliation for reporting violations.
- **SF Language Access Ordinance:** Mandates that all service-critical pages be fully translated into Spanish, Chinese, and Filipino.

---

### 1.13 Change Control

To maintain consistency across our digital ecosystem, major updates to web standards must follow a structured change control process.

- **Major Revisions (Require Formal Approval):** Changes that alter the approved sitemap, adjust Karl mapping, rewrite core Article 11/11A legal interpretations, or modify fee schedules must be formally approved.
- **Minor Edits (Self-Service):** Editors may make immediate updates to correct typos, fix links, or apply minor plain-language improvements that do not change the legal meaning.

---

### 1.14 Required Source Documentation

Every page draft or chapter update must be documented in the central content governance tracker. This ledger serves as the branch's audit trail. At minimum, the tracker must record:

- The page or chapter title, Karl CMS content type, and URL slug.
- The primary user group, primary task, and approved call to action (CTA).
- The exact ID or file name of the source documents used for grounding.
- The required legal, program, or communications review status.
- A formal signal indicating whether the draft has passed automated compliance QA.

---

### 1.15 Chapter 1 Summary

Chapter 1 establishes the baseline governance, scope, and editorial authority for all HHVC digital copy on SF.gov. By enforcing the core principles of Services First, progressive disclosure, and task-first scannability, this framework ensures that all web pages conform to the mandatory WCAG 2.1 Level AA accessibility standard ahead of our April 2027 legal deadline, and that complaints are routed correctly from the start.

---

### 1.16 Editorial Checklist

Use this final quality gate before sending any drafted page to the web editor for staging and publication:

- **Plain Language:** The page targets Grade 5-6 for service actions and Grade 6-8 for general guides.
- **Single Task:** The page supports a single, clear user goal.
- **Accessibility Compliant:** Headings are nested sequentially; links are descriptive.
- **Approved Karl CMS Structure:** The page is built using an approved content type and standard components.
- **Expectation Management:** The page clearly explains timelines and potential enforcement outcomes.
- **Automated Validation:** The draft has passed compliance validation to verify it is free of legacy formatting.
