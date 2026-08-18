# SF.gov Live Design & Editorial Inspiration Guide

This guide captures real-world design, layout, and copy patterns observed across live **SF.gov** pages to guide the **HHVC Manager Review** mockup tool and redesign.

---

## 1. Core Page Archetypes & Design Patterns

| Content Type    | Primary Resident Purpose                               | Layout Rhythms & Key Components                                                                                                                                                                                                                             | Real SF.gov Exemplar                                                                                      |
| :-------------- | :----------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------- |
| **Agency**      | Discover department services and points of contact     | - **Hero:** H1 + 1-sentence mission summary<br>- **Highlights:** Exactly 3 un-headed top cards<br>- **Spotlight:** H2 + short paragraph + 1 CTA button<br>- **Subsections:** Categorized card lists inheriting destination page titles & summaries          | [Environmental Health](https://www.sf.gov/departments--department-public-health--environmental-health)    |
| **Topic**       | Browse curated services across agencies around a theme | - **Header:** Theme title + brief scope description<br>- **Curated Links:** Grouped `Services` and `Resources` subsections<br>- **Spotlight Callout:** Optional spotlight for key initiatives                                                               | [Healthy Housing Conditions](https://www.sf.gov/topics--healthy-housing-conditions)                       |
| **Information** | Plain-language reference, rights, and health guides    | - **Header:** Sentence-case H1 (< 65 chars) + description (< 110 chars)<br>- **On this page:** Auto-generated jump links from H2s<br>- **Hero Callout:** Light-blue highlight box for key stats/deadlines<br>- **Body:** Structured `Title and text` blocks | [Keeping Your Building Free of Vermin](https://www.sf.gov/information--keeping-your-building-free-vermin) |
| **Transaction** | Perform a civic task or report an issue                | - **What to know:** Fee/Cost badge + prerequisites<br>- **What to do:** Numbered step-by-step instructions<br>- **Primary CTA:** Exactly 1 action button per page (verb-first)                                                                              | [Report a health nuisance or hazards](https://www.sf.gov/report-health-nuisance-or-hazards)               |
| **Report**      | Read policy standards, rates, and reference tables     | - **Table of Contents:** Auto-generated right-hand TOC from H2s<br>- **Native Tables:** Formatted data tables with responsive column headers<br>- **Print Version:** PDF document link for official reference                                               | [Fee Schedule/Records](https://www.sf.gov/reports--november-2024--fee-schedulerecords)                    |
| **Campaign**    | Time-bound public outreach or special program          | - **Visual Hero:** Branded color palette + Header image + Logo<br>- **Top Facts:** 3–12 fact cards with icon/image + concise text<br>- **Additional Content:** Accordions, video embeds, and resource links                                                 | _No live exemplar (see note below)_                                                                       |

**Exemplar links re-checked 2026-08-17**, when a link checker was adopted and
three of the eight 404'd. Transaction and Report were re-pointed at live pages of
the same type — the Transaction exemplar is the one the mockup's own Topic page
already cites, and the Report exemplar is a fee schedule, which is the
rates-and-reference-tables shape this row describes.

**Campaign has no exemplar, and that is a measurement rather than an omission.**
The cited `campaign--clean-air-healthy-communities` 404s, and sf.gov's sitemap —
17,191 URLs on the date above — contains no `campaign--` prefix at all. Note the
limit of that evidence: 6,519 of those URLs carry no type prefix (the Transaction
exemplar above is one), so this shows no Campaign page is identifiable by URL,
not that none exists. Substituting a page that merely looks campaign-like would
put a guess where every other cell holds a verified example, so the cell says so
instead. The Campaign row's design description stands on the earlier capture.

---

## 2. Editorial & Design Rules Learned from Live SF.gov

### 1. The Heading Ladder & Rhythm

- **H1:** Single H1 per page, sentence-case, under 65 characters.
- **H2:** Major page sections. On **Information** and **Report**, H2s automatically generate the table of contents.
- **H3:** Subsections inside cards, accordion items, or step titles.

### 2. Card Descriptions & Inheritance

- In Karl CMS, **Agency Services & Resources subsections** automatically inherit and display the **destination page's title and summary**.
- Editors should not hand-craft redundant summaries on cards that point to existing SF.gov pages.

### 3. Action Buttons & Microcopy

- **One button rule:** Transaction pages focus on a single primary action button (e.g. "Report a hazard", "Pay fees online").
- **Verb-first labels:** Always start with an active verb ("Apply", "Report", "Download", "Schedule").
- **Length:** Keep button labels concise (target $\le 25$ characters for optimal mobile readability, within the 255-character system limit).

### 4. Plain Language & Accessibility

- Target grade-level reading score: **Grade 6–8**.
- Use bulleted lists for conditions with 3+ items.
- Provide clear phone and address contact cards at the footer of agency pages.
