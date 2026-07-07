# SFDPH Healthy Housing and Vector Control

## **Chapter 4: Karl Content Type Standards**

_HHVC Web Governance and Content Standards Manual_

| **Field**                   | **Value**                                                               |
| :-------------------------- | :---------------------------------------------------------------------- |
| **Document status**         | Version 3.1 Release Candidate                                           |
| **Version**                 | 3.1                                                                     |
| **Date**                    | July 6, 2026                                                            |
| **Status**                  | Approved Working Draft                                                  |
| **Primary standard**        | SF.gov and Karl CMS Editor Help Center                                  |
| **Project source of truth** | HHVC Web Governance and Content Standards Manual source-of-truth update |
| **Tracking tool**           | Content governance tracker in the SF.gov publication repository         |

---

### **4.1 Purpose**

This chapter defines the approved Karl CMS content types used by the Healthy Housing and Vector Control (HHVC) program on SF.gov. It establishes binding standards for selecting, structuring, and governing each page type to ensure layout consistency and prevent resident confusion.

Under the **Topic-First Model**, all public-facing pages must be structured around resident needs and grouped under thematic hubs, rather than internal departmental structures. By aligning HHVC content with these platform-level standards, editors ensure that pages are scannable, search-optimized, and compliant with federal digital accessibility laws.

---

### **4.2 Approved Karl CMS Content Types**

The Karl CMS functions as a relational database of pages and files. To maintain structural integrity and a unified user experience across SF.gov, the platform supports exactly **14 distinct content types** organized into three functional categories.

HHVC editors must understand the technical boundaries and approved use cases for all 14 content types to make correct architectural decisions:

#### **Category A: Service Pages (4 Types)**

Service pages are the highest priority on SF.gov and are designed to help people complete a transaction or find direct assistance.

1. **`Topic` (Thematic Navigation Hubs)**
   - **Platform Purpose**: Groups transactions, services, policies, and events around a common theme. Only Digital Services can create new Topic pages.
   - **HHVC Application**: Serves as the primary program landing page and single entry point (e.g., `sf.gov/topic-pests-and-housing-problems`). It acts as a routing center, linking residents to report forms, inspection guidelines, owner responsibilities, and resource libraries.
   - **URL Structure**: `sf.gov/topic-[slug]`.
2. **`Transaction` (Action Pages)**
   - **Platform Purpose**: Focuses on a single interaction or exchange with the City. Every element on a Transaction page must propel the user forward to complete a task. Features a prominent, colored call-to-action (CTA) button.
   - **HHVC Application**: Used for direct actions, such as reporting an active pest infestation, paying a fee, or filing a formal complaint.
   - **URL Structure**: `sf.gov/[slug]` (Transaction start pages come right after the top-level domain with no subdirectory; e.g., `sf.gov/report-rats-or-mice`).
3. **`Step-by-step` (Process Overviews)**
   - **Platform Purpose**: Guides users through a complex, multi-stage process involving multiple transactions completed over time (frequently used in permitting).
   - **HHVC Application**: Used to explain sequential compliance or enforcement timelines, such as preparing for a formal inspection or correcting a notice of violation. Each step can link to one or zero transactions on SF.gov. Steps are limited to a maximum of 15.
   - **URL Structure**: `sf.gov/[slug]`.
4. **`Location` (Facility Profiles)**
   - **Platform Purpose**: Dedicated profiles for physical offices, clinics, or service centers.
   - **HHVC Application**: Used to profile the physical HHVC headquarters at 49 South Van Ness Ave, providing office hours, contact options, transit access, and language accommodations.
   - **URL Structure**: `sf.gov/[slug]`.

#### **Category B: Outreach Pages (3 Types)**

Outreach pages inform the public about active City initiatives, scheduled meetings, or time-sensitive announcements.

5. **`Campaign` (Focused Outreach Banners)**

- **Platform Purpose**: Visually distinct, structured templates used for temporary public outreach and educational campaigns. Supports branded hero, Spotlight, Top facts, and color theme options.
- **HHVC Application**: Used for seasonal public health messaging, such as the summer West Nile Virus awareness campaign or promotional sign-ups for free mosquito workshops.
- **URL Structure**: `sf.gov/[slug]`.
- **Do not confuse with Resource Collection**: Document-heavy outreach (for example, an RFP with a Documents list and revision dates) belongs on a **Resource Collection** page, not a Campaign. Campaigns are for message-focused, branded outreach — not PDF libraries. See [Karl content-type field reference](../docs/source/hhvc-policy/karl-content-type-field-reference.md).

6. **`News` (Press and Announcements)**
   - **Platform Purpose**: A template for time-sensitive announcements, program updates, or media releases.
   - **HHVC Application**: Used to publish regulatory announcements, such as the official publication of Version 3.0 of the Director's Rules and Regulations or scheduled rate adjustments.
   - **URL Structure**: `sf.gov/news-[slug]`.
7. **`Event` (Public Calendar Items)**
   - **Platform Purpose**: Profiles a specific, scheduled event, class, hearing, or workshop. Supports functional registration and calendar integration buttons.
   - **HHVC Application**: Used to schedule and promote individual free mosquito education workshops or public community forums.
   - **URL Structure**: `sf.gov/events-yyyymmdd-[slug]`.

#### **Category C: Department Support Pages (7 Types)**

Department support pages describe the internal structure, meetings, data assets, and formal documents of City agencies. 8. **`Agency` (Department Homepages)**

- **Platform Purpose**: Homepages for major City departments and offices. Agency pages are created exclusively by Digital Services and are not self-service templates for individual programs or divisions. Supports top-of-page Alerts and Highlights.
- **HHVC Application**: HHVC does not own an Agency page. The program's content sits under the parent Topic page, while the department homepage is managed at the SFDPH level.
- **URL Structure**: `sf.gov/department-[slug]`.

9. **`About` (Organizational Profiles)**
   - **Platform Purpose**: High-level overviews of a department's structure, mission, history, and leadership.
   - **HHVC Application**: Used to document the legal authority, operational scope, and mission of the Healthy Housing and Vector Control branch.
   - **URL Structure**: `sf.gov/about-[department-name]`.
10. **`Data story` (Dashboard Narratives)**
    - **Platform Purpose**: Public-facing narratives built around interactive data visualizations. Supports Callouts and PowerBI dashboard embeds.
    - **HHVC Application**: Used to publish interactive maps and charts showing quarterly pest complaint volume, code compliance rates, and mosquito trap monitoring data.
    - **URL Structure**: `sf.gov/[slug]`.
11. **`Meeting` (Public Hearing Records)**
    - **Platform Purpose**: Posts legally required agendas, schedules, and official minutes. Supports button links for virtual access.
    - **HHVC Application**: Used to log and schedule formal Director's Hearings for unresolved notices of violation, enabling tenants and owners to access agendas.
    - **URL Structure**: `sf.gov/meeting-yyyymmdd-[slug]`.
12. **`Profile` (Staff Directories)**
    - **Platform Purpose**: Short biographical and contact cards for individual team members, commissioners, or district leads.
    - **HHVC Application**: Used to publish district-specific inspector contact cards, helping residents identify and contact their assigned field officer.
    - **URL Structure**: `sf.gov/[slug]`.
13. **`Report` (Structured Long-form Documents)**
    - **Platform Purpose**: Used to publish long-form reference texts, formal policies, and regulations. **Crucially, in Karl CMS, "Report" is the only content type that natively supports tables.**
    - **Live SF.gov example**: Rent Board **Current Rates** pages — multi-table reference data, auto "On this page" table of contents, and a print-version PDF. **Do not** model this pattern as an Information page.
    - **HHVC Application**: Used to publish the citable, text-based versions of active housing standards, such as the _Director's Rules for Vector Control_ or the _San Francisco Housing Code_.
    - **URL Structure**: `sf.gov/[slug]`.
14. **`Resource Collection` (Document Libraries)**
    - **Platform Purpose**: Groups and displays lists of downloadable files (PDFs), external resources, or data stories in a structured library.
    - **HHVC Application**: Used to organize and host downloadable landlord bed bug disclosure forms, written pest management plan templates, SRO hygiene checklists, and Spanish/Chinese/Filipino translation flyers.
    - **URL Structure**: `sf.gov/resource/[year]/[title]`.

---

### **4.3 Content Type Selection Matrix**

To ensure that all pages are consistently organized around user tasks, editors must use the following **Content Type Selection Matrix**. To maintain search engine findability and prevent layout errors, never guess a page type; map the primary resident goal directly to its approved Karl content type:

| **Resident Goal or Action**                              |  **Karl Content Type**  | **HHVC Program Example**                   |
| :------------------------------------------------------- | :---------------------: | :----------------------------------------- |
| File a cockroach, mold, or bed bug report online         |     **Transaction**     | _Report cockroaches_                       |
| Pay an annual apartment program fee or late fee          |     **Transaction**     | _Pay your Healthy Housing fee_             |
| Learn how to seal cracks to keep mice out of a kitchen   |     **Information**     | _Keep rats and mice out_                   |
| Understand what steps to take after filing a complaint   |    **Step-by-step**     | _What happens after you report_            |
| Prepare a unit for an upcoming SRO hygiene inspection    |    **Step-by-step**     | _Get ready for an SRO inspection_          |
| Review legal requirements of a Notice of Violation (NOV) |     **Information**     | _Understand a notice of violation_         |
| Find and download the landlord Bed Bug Disclosure form   | **Resource Collection** | _Vermin prevention guides and forms_       |
| Publish fee tiers or rate tables                         | **Report** or linked **Resource Collection** | _Healthy Housing fee schedule document_    |
| View the program mission, office hours, and district map |        **About**        | _About Healthy Housing and Vector Control_ |

---

### **4.4 Page Type Governance Rules**

To prevent content type drift and protect the scannability of SF.gov, all HHVC drafts must comply with three strict page-building rules:

#### **Rule 1: The "No Mixed-Tasks" Rule**

Editors must **never** combine direct service transactions and educational guides on a single page.

- _The Problem_: Stuffer pages that pack biology, local laws, and fee schedules onto a report page overwhelm residents, leading to abandoned forms or misrouted complaints.
- _The Standard_: A page titled "Report cockroaches" [Sentence Case, `< 65 characters`] must focus exclusively on the reporting action. It must outline eligibility, required form fields, and the 311 button. It must _never_ include paragraphs on cockroach breeding habits.
- _The Solution_: Use Karl's **Relational Content** tags. Link the reporting Transaction page to a separate, educational Information page (e.g., "Prevent cockroaches") in the right-hand Related panel.

#### **Rule 2: The "No Placeholder" Rule**

Every staged and published page must be fully functional and complete.

- _The Problem_: Creating stub pages with "Under Construction" banners, "Coming Soon" text, or incomplete checklists erodes municipal credibility and frustrates users.
- _The Standard_: Do not submit a page for governance check or stage it on the live environment until all citable laws are verified, all PDF files are uploaded to their designated Collections, and all cross-page hyperlinks are functional.

#### **Rule 3: Strict Layout Enforcement**

Editors must work strictly within the design boundaries of Karl CMS templates.

- _The Problem_: Attempting to bypass Karl's styling constraints by using bold text for fake headings, typing hyphens to create lines, or using custom bullet symbols breaks mobile responsiveness and disrupts assistive screen readers.
- _The Standard_:
  - Use true semantic HTML headings (**H3 for section headings, H4 for subheadings**); never use bold inline text to separate sections.
  - Heading titles must be action-oriented, short, and use sentence case. Never use questions as headings (e.g., write "How to apply" instead of "How do I apply?").
  - Restrict tables to a maximum of **3 columns** and use them strictly for structured data, never for design layout. Table text is not machine-translated, so keep table narrative minimal.
  - Limit accordions to optional supporting details at the bottom of the page. **Never** hide mandatory compliance deadlines, SRO fees, or NOV response steps inside an accordion.

---

### **References**

- [📒 SF.gov and Karl Editor Help Center: Choosing a content type](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/using-karl-the-cms/content-types/choosing-a-content-type)
- [📒 SF.gov and Karl Editor Help Center: Transaction pages](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/using-karl-the-cms/content-types/building-a-page-by-content-type/transaction)
- [📒 SF.gov and Karl Editor Help Center: Step-by-step pages](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/using-karl-the-cms/content-types/building-a-page-by-content-type/step-by-step)
- [📒 SF.gov and Karl Editor Help Center: Information pages](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/using-karl-the-cms/content-types/building-a-page-by-content-type/information)
- [📒 SF.gov and Karl Editor Help Center: Resource Collections](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/using-karl-the-cms/content-types/building-a-page-by-content-type/resource-collection)
- [📋 Karl CMS content-type field reference](../docs/source/hhvc-policy/karl-content-type-field-reference.md) — HHVC field map supplement with SF.gov screenshot mapping
