# SFDPH Healthy Housing and Vector Control

## **Chapter 5: Required Page Patterns**

_HHVC Web Governance and Content Standards Manual_

| **Field**                         | **Value**                                                               |
| :-------------------------------- | :---------------------------------------------------------------------- |
| **Document status**               | Version 3.1 Release Candidate                                           |
| **Version**                       | 3.1                                                                     |
| **Date**                          | July 6, 2026                                                            |
| **Status**                        | Approved Working Draft                                                  |
| **Primary standard**              | SF.gov and Karl CMS Editor Help Center                                  |
| **Project source of truth**       | HHVC Web Governance and Content Standards Manual source-of-truth update |
| **Tracking tool**                 | Content governance tracker in the SF.gov publication repository         |
| **Source basis for this chapter** | Aligned with the Karl CMS standards and the approved Topic-First Model. |

---

### **5.1 Purpose**

This chapter defines the standard page layout patterns, section hierarchies, call-to-action (CTA) placements, target audience statements, contact modules, and processing expectations that all Healthy Housing and Vector Control (HHVC) web pages must follow. Standardizing these layouts ensures a consistent, predictable, and fully accessible browsing experience for all San Francisco residents.

---

### **5.2 Universal Page Structure Hierarchy**

Every page drafted for publication on SF.gov must adhere to a strict top-to-bottom layout hierarchy. Custom, ad-hoc, or multi-column layout arrangements are technically prohibited by the platform to maintain mobile responsiveness and screen-reader accessibility. All pages must follow this structural order:

1. **Page Title:** Must be descriptive, keyword-forward, and user-focused. Start Transaction titles with a verb and use sentence case.
2. **Page Summary / Description:** A brief 1-to-2 sentence description (hard cap of 110 characters) explaining what the page covers. It must front-load key search terms and avoid repeating words from the title.
3. **Target Audience:** A designated block specifying exactly who the content applies to.
4. **Primary Action / Steps:** The core action button (CTA) or step-by-step instructions located near the top of the page.
5. **Supporting Content:** Required contextual information, legal exemptions, code rules, or compliance requirements.
6. **What Happens Next:** Clear, realistic processing timelines and program expectations showing what happens after the resident acts.

---

### **5.3 Topic Page Pattern (Thematic Navigation Hubs)**

Topic pages function as the primary program landing pages and single entry points for the HHVC program (specifically, **`sf.gov/topic-pests-and-housing-problems`**). Topic pages collect related pages around a common theme so users do not need to understand which specific department runs a program. Topic pages are created exclusively by Digital Services.

#### **Required CMS Template Fields & Structure:**

- **Title:** Precise, under 65 characters, using sentence case (e.g., "Pests and housing problems").
- **Description:** A short, keyword-rich summary under 110 characters.
- **Audience Selector Lanes:** Must group onward links into clear, distinct audience-focused lanes:
  1. _Report a Problem:_ Direct links to 311 online reporting forms and violation search tools.
  2. _Tenants:_ Links to tenant rights, preparation guidelines, and the reporting process.
  3. _Property Owners:_ Links to the owner responsibilities guide, fees, and compliance rules.
- **Featured Services / Primary Task Groups:** Prominent link groupings for high-demand actions.
- **Related Resources:** Links to resource collections, guidelines, or data stories.
- **Contact Us:** The standard program contact block.

---

### **5.4 Transaction Page Pattern (Service Actions)**

Transaction pages are designed to help users complete a single task (such as submitting a report, paying a fee, or filing an application). Every element on a Transaction page must propel the user forward to complete that task.

#### **Required CMS Template Fields & Structure:**

1. **Title:** Verb-first, keyword-forward, and less than 65 characters (e.g., "Report cockroaches"). Avoid putting the program name in the title.
2. **Description:** Under 110 characters, explaining the exact action the user is taking.
3. **Primary Agency:** Set to "Environmental Health" to drive correct platform routing.
4. **What to Know Before You Start:** Rendered in a prominent gray box below the description (separate from Description).
   - _Cost:_ Explicit cost or fee information. If free, must state "Free".
   - _Things to know:_ Key eligibility rules, documentation needed, or prep requirements. Keep to two items or fewer when possible.
5. **What to Do:** This section header is hard-coded in the CMS and cannot be removed. Editors add **Callout** or **Section** blocks inside it. The primary **Button** CTA (e.g., "Report through 311") lives inside a **What to do → Section** block — not as a separate top-level field above What to do. Never use generic labels like "Click here" or "Submit". Button labels must be 25 characters or fewer.
6. **Supporting Information:** Located near the bottom of the page. Supporting details may be placed in **expandable accordions** (only FAQs, term definitions, or secondary references).
   - _Critical Restriction:_ Mandatory compliance instructions, SRO fees, deadlines, or Notice of Violation (NOV) response steps must **never** be hidden inside accordions.
7. **Why is this Transaction Good for the Community?** An optional field at the bottom of the page to connect the action to the program's public health mission.
8. **Related Section:** A right-panel component manually linking to relevant Transaction, Information, Campaign, Topic, or Step-by-step pages (e.g., linking a "Report cockroaches" page to a "Prevent cockroaches" guide).
9. **Contact Us:** Uses Karl's standard contact component at the bottom of the page.
10. **Partner Agencies:** Footer block listing collaborating departments.
11. **Topics:** Relational tag to the parent Topic hub. Tagged Transactions auto-surface on the Topic "More services" grid.

**Mockup note:** The HHVC manager-review mockup does not render the gray **What to know before you start** box. Editors must fill Cost and Things to know directly in Karl — they are not the same as the page Description.

---

### **5.5 Step-by-Step Page Pattern (Process Overviews)**

Step-by-step pages are used to guide users through a complex process involving multiple individual transactions or events completed over a longer period of time (e.g., "What happens after you report" or "Get ready for an inspection").

#### **Required CMS Template Fields & Structure:**

- **Title:** Clear, process-oriented title in sentence case (e.g., "What happens after you report a housing or pest problem").
- **Description:** A short summary under 110 characters.
- **Primary Agency:** Set to "Environmental Health".
- **Intro:** A few scannable sentences explaining the overall process, eligibility, or high-level requirements. Do not include program history.
- **Steps (Up to 15, target under 5):** Bulleted, numbered, or sequential segments.
  - _Each step must include:_ Title, cost, time the step takes, and a detailed description.
  - _Transaction Links:_ Any individual step can link to exactly one (or zero) Transaction pages on SF.gov. When a user navigates to a transaction from a Step-by-step page, Karl automatically displays a "Part of" breadcrumb at the top of that Transaction page.
- **Topics:** Tagged to the parent pests Topic to ensure relational mapping.

---

### **5.6 Information Page Pattern (Education and Guidance)**

Information pages provide useful reference material, prevention advice, compliance rules, or notice explanations. If a page asks the user to take a direct action, it is legally out of scope for "Information" and must be moved to a Transaction page.

#### **Required Layout Structure:**

1.  **Title:** Precision-focused and under 65 characters in sentence case (e.g., "Prevent cockroaches").
2.  **Description:** Summarizes what the resident will learn (under 110 characters).
3.  **Primary Agency:** Set to "Environmental Health".
4.  **Part of:** An optional field used to manually link back to the parent Step-by-step page. Tagging a transaction in "Part of" automatically includes a backlink to that transaction.
5.  **Information Section:** The main content of the page, which must be structured into one of three repeatable block types:
    - **Title and text** — the block title field renders as an **H2** heading; use **H3** and **H4** inside the rich text for subheadings. Do not use bolding as heading overrides.
    - **Image** (must feature natural lighting, real places, and descriptive alt text under 120 characters).
    - **Callout** (blue background with an "i" icon for stable, critical information).
6.  **Partner Agencies:** Footer block listing collaborating departments (e.g., Rent Board on rent-guidance pages).
7.  **Topics:** Relational tag to the parent Topic hub.
8.  **Related Section:** Right-hand panel used to manually link to corresponding Transaction, Information, Campaign, or Topic pages (e.g., the "Prevent cockroaches" Information page must link to the "Report cockroaches" Transaction page).

**Information page restrictions:**

- No primary **Button** — if the page has a clear task, use a Transaction content type instead.
- No **tables** — use a **Report** page or link to a **Resource Collection** document for tabular data.
- **"On this page"** anchor navigation is auto-generated from H2 headings in the Information section (see live SF.gov rent-guidance pages).
- Information pages must be **manually linked** to other pages; they do not auto-link to each other.

---

### **5.7 Resource Collection Page Pattern (Libraries and Files)**

Resource Collections organize and group downloadable documents, forms, sheets, or external links into a single, clean library. This is the required pattern for hosting required program forms to avoid unorganized PDF directories.

**Canonical example:** Fog Sustainability RFP (`sf.gov/resource/2024/fog-sustainability-request-proposals-rfp`) — Documents list with publish dates, introductory text, and Resources links. Complex RFP pages are Resource Collections, not Campaigns.

**HHVC mockup hub note:** Pages like `reportHub` and `preventHub` are typed as Resource collection in the mockup but route residents to existing Transaction and Information pages via cross-link cards. Production Karl Resource Collections for HHVC forms should use **Body → Documents** for PDFs, not hub card patterns.

#### **Required CMS Template Fields & Structure:**

1. **Title and Description:** Highly specific, identifying the exact year or collection scope (e.g., "Healthy housing and pest prevention guides").
2. **Primary Agency:** Set to "Environmental Health".
3. **Data Dashboard (Optional):** Embedded analytics when the collection includes dashboard assets.
4. **Introductory Text (Optional):** Used to explain what types of documents users will find and why they are useful.
5. **Body Component:** Editors can add exactly three types of assets, each supporting subheaders:
   1. _Documents:_ Downloadable, accessible PDF files (such as required pesticide notices or bed bug log templates). Each entry displays title, description, and publish date.
   2. _Resources:_ Links to SF.gov pages or external trustworthy sites.
   3. _Data Stories:_ Links to Data story pages with Power BI or Looker Studio embeds.
6. **Custom Section (Optional):** A single paragraph of text allowed at the bottom of the page for program notes or legal disclaimers.
7. **Topics:** Relational tag indicating which Topic hub the collection supports.
8. **Partner Agencies:** Footer block listing collaborating departments.

Resource Collections are **not auto-linked** from other pages. Add them manually via Related or Resources on Topic, Agency, or service pages.

---

### **5.8 Campaign Page Pattern (Outreach and Programs)**

Campaign pages support message-focused, often ephemeral outreach with more branding flexibility than service pages. They are less automatically tied to SF.gov information architecture than Transaction or Information pages.

#### **Required CMS Template Fields & Structure:**

1. **Title:** Campaign name (under 65 characters, sentence case).
2. **Primary Agency:** Set to "Environmental Health".
3. **Logo:** 100 × 100 px JPG or PNG.
4. **Background Header Image:** Banner image (at least 375 px wide; title box overlaps on desktop — center focal elements).
5. **Color Theme:** Department branding choice.
6. **Spotlight 1:** Image + text + link on colored background.
7. **Top Facts:** Up to 12 fact items for key program highlights.
8. **Additional Content:** Flexible body blocks (Image with text, etc.).
9. **Spotlight 2:** Second spotlight block.
10. **About:** Organizational context for the campaign.
11. **Partner Agencies:** Footer collaborators.
12. **Related:** Manual links to Transaction, Information, Campaign, or Topic pages.

**Also available on Campaign pages:** Resources section, Accordions, Video, Embed, and Social media (per Karl GitBook).

**Discovery rules:** Campaigns are **not** auto-linked from other content types. Surface them via manual Related links, or Spotlight/Resources on Topic or Agency pages. Pair with a **News** item when announcing a new campaign.

**HHVC candidate:** `mosquitoWorkshop` is typed Information in the mockup today. Promote to Campaign if HHVC treats mosquito education as ongoing outreach with branded hero and top facts.

| Scenario                                                   | Use             |
| :--------------------------------------------------------- | :-------------- |
| Ongoing program with branded hero, logo, and top facts     | **Campaign**    |
| Static reference guide, rules, or prevention advice        | **Information** |
| Single scheduled session with date, time, and registration | **Event**       |

---

### **5.9 Summary Checklist for Chapter 5 Compliance:**

- **Page Task:** Does the drafted page focus on one primary task or purpose?
- **CMS Content Type:** Does the chosen page type match the page's behavioral goal?
- **Nesting & Headings:** Does the page use true semantic HTML headings in sequential order (H2 for Information section block titles; H3/H4 inside rich text) instead of bold overrides?
- **CTA Placement:** On Transaction pages, is the primary Button inside **What to do** and clearly visible?
- **Information restrictions:** Does the Information page have no primary Button and no tables?
- **Table placement:** Are fee tiers and rate tables on a **Report** or linked **Resource Collection**, not on Transaction or Information pages?
- **Resource Collection shape:** Do document libraries use **Body → Documents**, not hub cross-link cards?
- **No Placeholders:** Are there any empty stubs or "Under Construction" sections? (These are strictly prohibited).
- **Accordion Use:** Are all mandatory deadlines, fees, and legal requirements fully visible, with zero critical info hidden inside accordions?
