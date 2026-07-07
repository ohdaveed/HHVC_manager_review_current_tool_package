# SFDPH Healthy Housing and Vector Control

## **Chapter 6: Karl Component Standards (Comprehensive Release)**

_HHVC Web Governance and Content Standards Manual_

| **Field**                   | **Value**                                                                     |
| :-------------------------- | :---------------------------------------------------------------------------- |
| **Document status**         | Version 3.2 Release Candidate                                                 |
| **Version**                 | 3.2                                                                           |
| **Date**                    | July 6, 2026                                                                  |
| **Status**                  | Approved Master Draft                                                         |
| **Primary standard**        | SF.gov and Karl CMS Editor Help Center [282]                                  |
| **Project source of truth** | HHVC Web Governance and Content Standards Manual source-of-truth update [282] |
| **Tracking tool**           | Content governance tracker in the SF.gov publication repository [282]         |

---

### **6.1 Purpose**

This chapter establishes the approved, platform-validated use of all **28 Karl CMS design components** on Healthy Housing and Vector Control (HHVC) web pages [283]. It provides binding design rules, supported content types, layout restrictions, and character limits to ensure 100% compliance with SF.gov’s unified look and feel and federal ADA Title II accessibility mandates [1, 195, 283]. The master index aligns with `docs/source/hhvc-policy/2026-07-07-karl-cms-component-documentation.xlsx`.

For **which page types expose which fields** (Information, Transaction, Resource Collection, Campaign), see [`docs/source/hhvc-policy/karl-content-type-field-reference.md`](../docs/source/hhvc-policy/karl-content-type-field-reference.md). This chapter remains authoritative for _how_ to use each component; the field reference is authoritative for _where_ each component appears in Karl page templates.

---

### **6.2 Master Component Catalog and Mapping**

To prevent page clutter, editors must select the minimum number of components required to support the resident's primary task [283]. Below is the master validation index of all 28 components configurable within the Karl editor [7]:

| **Component Name**                |   **Snippet/Asset Class**    | **Supported Content Types**                               | **Primary HHVC Governance Role**                                                                                           |
| :-------------------------------- | :--------------------------: | :-------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------- |
| **1. Accordions**                 |      Non-Reusable [284]      | Campaign, Location, Meeting, Transaction [6, 123, 284]    | Frequently Asked Questions and minor details [284]                                                                         |
| **2. Address**                    |  Reusable Snippet [14, 49]   | All content types [14, 49]                                | Reusable physical facility or service sites [14, 49]                                                                       |
| **3. Alert**                      |      Non-Reusable [50]       | Agency, Location only [16, 123]                           | Top-of-page urgent emergency/service banners [16, 123]                                                                     |
| **4. Body Text**                  |      Non-Reusable [50]       | All content types [31]                                    | Standard paragraph formatting and in-page markup [31]                                                                      |
| **5. Button**                     |      Non-Reusable [50]       | Call to Action pages (Transaction, etc.) [40]             | Single primary action trigger (e.g., 'Start report') [40, 119]                                                             |
| **6. Callout**                    |      Non-Reusable [50]       | Transaction, Information, Data story [43, 123]            | Blue informational boxes highlighting citable rules [43, 123]                                                              |
| **7. Contact section**            |    Reusable Snippet [49]     | Transaction, Information, etc. [58, 61]                   | Standardized footer contact directory block [58, 61]                                                                       |
| **8. Cost**                       |      Non-Reusable [50]       | Transaction (What to know block) [115, 377]               | Optional program fee listing and description [70, 377]                                                                     |
| **9. Data**                       |    PowerBI Asset [83, 84]    | Data story, Resource Collection, Agency [84, 141]         | Dashboard embeds and analytics visualization [84, 141]                                                                     |
| **10. Description**               |      Non-Reusable [50]       | All content types [95]                                    | Front-loaded 110-character SEO sub-summaries [95]                                                                          |
| **11. Heading**                   |      Non-Reusable [50]       | All content types [73]                                    | Semantic H3/H4 structural order for screen readers [73]                                                                    |
| **12. Highlights**                |      Non-Reusable [50]       | Agency only [136]                                         | Top-of-page optional image-based spotlight grid [136]                                                                      |
| **13. Images**                    |     Reusable Asset [49]      | 9 content types (Campaign, Info, Report, etc.) [11]       | Real photography, alt-text, logos, and header images [11, 182]                                                             |
| **14. Links**                     | Relational / Hyperlink [179] | All content types [179]                                   | Navigation pathways and context-rich external links [23, 179]                                                              |
| **15. Partner agency**            |    Reusable Relationship     | All content types [141, 145, 150, 152]                    | Optional secondary departmental attribution [214]                                                                          |
| **16. People section**            |    Reusable Relationship     | Agency, Location only [218]                               | Collecting and rendering biographical profile grids [218]                                                                  |
| **17. Primary agency**            |    Reusable Relationship     | All content types (Required starting Nov 2025) [237]      | Mandatory citable department link and dashboard filter [237]                                                               |
| **18. Redirects**                 |  CMS Core (Disabled) [245]   | Disabled (Digital Services only) [245]                    | Programmatic 301 forward links (No editor control) [245]                                                                   |
| **19. Related**                   |   Relational Snippet [254]   | Transaction, Information, Campaign, Topic [255, 361]      | Right-panel or bottom-pane cross-service linking [254, 361]                                                                |
| **20. Resources**                 |    Reusable Snippet [49]     | About, Campaign, Resource Collection, Topic [269]         | Reusable styled blocks linking to PDFs or external links [270]                                                             |
| **21. Spotlight**                 |      Non-Reusable [50]       | All content types [313] (Wait: see 313)                   | Visually prominent banners drawing single-task focus [313]                                                                 |
| **22. Tables**                    |      Non-Reusable [50]       | Report only [328]                                         | Highly structured, 2-to-3 column untranslated data [328]                                                                   |
| **23. Title**                     |      Non-Reusable [50]       | All content types (Required) [340]                        | Sentence-case page identifier under 65 characters [340]                                                                    |
| **24. Topics**                    |    Reusable Relationship     | Transaction, Step-by-step, Campaign, etc. [347, 350, 352] | Categorizing child pages under parent Topic hubs [358, 387]                                                                |
| **25. URLs**                      |      Non-Reusable [50]       | All content types [364]                                   | Lowercase, hyphenated, verb-first direct web addresses [309, 336]                                                          |
| **26. Videos**                    |     Reusable Asset [49]      | All text-supporting content types [372, 373]              | Third-party embeds requiring complete transcripts [110, 372]                                                               |
| **27. Documents, including PDFs** |     Reusable Asset [49]      | All content types linking files                           | Downloadable PDFs and documents with title, description, format, and size labels [95]                                      |
| **28. Step List**                 |    In-page pattern (HHVC)    | Transaction pages (What to do)                            | Sequential steps with one primary action each; use Step-by-step content type for multi-stage journeys [10, 20, 23, 24, 34] |

---

### **6.3 Detailed Component Governance Rules**

#### **1. Accordions**

- **Platform Definition**: Expandable, accordion-style blocks featuring a text heading and a "+" icon that expand to reveal content upon user selection [5].
- **Supported Content Types**: Restricted strictly to **Campaign, Location, Meeting, and Transaction** pages [6, 123, 284]. Accordions are technically unavailable and **must never be planned** on Information, Topic, or Agency pages [123, 284].
- **Approved Use Cases**: Best suited for groups of Frequently Asked Questions (FAQs), complex term definitions, and minor background reference details [6, 284].
- **Prohibited Content (Critical ADA Violation)**: Never place mandatory compliance steps, citable tenant/owner duties, program fee tiers, filing deadlines, or Notice of Violation (NOV) appeal steps inside an accordion [284]. These critical pathways must remain fully visible on page load to protect reading comprehension for users under stress [284].
- **Layout Limit**: Capped at a maximum of **5 accordions per page** to preserve mobile viewport usability and prevent excessive scrolling [284].

#### **2. Address**

- **Platform Definition**: A reusable snippet component managed in Karl's central database (`Snippets` $
ightarrow$ `Addresses`) [14, 49].
- **Supported Content Types**: Supported across all page templates [14, 49].
- **Relational Logic**: Editors must never hardcode physical addresses into inline text fields. Address blocks must be added via the central address library [14]. When an office moves or updates its contact details, updating the snippet once automatically propagates the change across all citable sitemap locations, completely eliminating stale-data risks [49, 50].

#### **3. Alert**

- **Platform Definition**: A visually urgent, top-of-page emergency banner styled to communicate critical or temporary safety notices [16].
- **Supported Content Types**: Supported **exclusively on Agency and Location pages** [16, 123].
- **HHVC Restriction**: Alerts are technically unavailable on **Transaction and Information pages** [123]. To post seasonal notices, fee adjustments, or holiday hours on an HHVC service page, editors must use an **in-body Callout component** instead of an Alert [123].
- **Technical Parameters**: Bounded by a strict **30-character title limit**, a **120-character description limit**, and require explicit start and expiration dates to prevent outdated notices from cluttering the platform [123].

#### **4. Body (Main Body, Text and Title)**

- **Platform Definition**: Rich text formatting containers used to display standard page paragraphs and lists [31].
- **Supported Content Types**: All page templates [31].
- **Interface**: Features a familiar text formatting menu anchored at the top of the component text box [31]. Editors should use bulleted checklists and bold leading phrases to chunk text and support skimming readers [21, 243].

#### **5. Button**

- **Platform Definition**: High-contrast, clickable triggers styled to look like physical buttons, designed to drive user conversions [40].
- **Supported Content Types**: Supported only as part of a primary Call to Action (CTA) block on service-oriented pages, such as Transactions [40].
- **Strict Rules**:
  - **Limit**: Enforce a strict limit of **exactly one button per page** to prevent competing actions from overwhelming users [42, 119].
  - **Labels**: Labels must use active, verb-first text (e.g., 'Start your report' or 'Pay your program fee') [119].
  - **Prohibited Labels**: Never use passive or generic labels like "click here", "learn more", or "submit" [119].
  - **Label Length**: Hard-coded cap of **25 characters** for button labels.

#### **6. Callout**

- **Platform Definition**: An in-body colored highlight box featuring a prominent "i" icon to anchor critical notices [43, 123].
- **Supported Content Types**: Supported on **Transaction, Information, and Data story** pages [43, 123].
- **Color Standards**: Informational Callouts are **blue** [123] (not yellow).
- **Approved Use Cases**: Highlight stable, legally citable program boundaries—such as the SRO hygiene rules, 72-hour landlord investigation windows, or the 10-square-foot mold reporting threshold [123]. Never use Callouts to mock up temporary or emergency news (which belongs in News or Campaign types) [123].

#### **7. Contact section**

- **Platform Definition**: A standardized footer directory box placed at the bottom of all public-facing service pages to offer immediate access to help [58].
- **Supported Content Types**: Supported across all service and transaction pages [58, 61].
- **Fields**: Includes fields for Address, Phone, Email, and Social media / Other links [58]. The Address field must link directly to an existing asset in the central address snippet library to enforce database consistency [58].

#### **8. Cost**

- **Platform Definition**: An optional programmatic field nested within the gray "What to know before you start" box on Transaction pages [115, 377].
- **Functional Parameters**: Click on "Add Cost" and select the appropriate payment type [70]. Includes a "cost description" text field to document progressive fee schedules (such as the SRO unit tiers) or late penalties [70].

#### **9. Data**

- **Platform Definition**: A component configured to link interactive PowerBI dashboard embeds and charts to our pages, managed in coordination with DataSF [83, 84].
- **Supported Content Types**: Supported on Data stories, Resource Collections, and Agency pages [84, 141].

#### **10. Description**

- **Platform Definition**: A concise, search-optimized paragraph that appears immediately below the page Title on the front end [95].
- **Character Limits**: Restricted to a maximum of **110 characters** [95].
- **Editorial Rules**: Descriptions must front-load search-engine keywords to optimize sitemap visibility [95]. Editors are strictly prohibited from repeating words already used in the page Title [95].

#### **11. Heading**

- **Platform Definition**: Semantic HTML structural elements used to break up text and group logical thoughts [73].
- **Accessibility Standards**: Sighted users scan pages quickly, but screen readers require semantic HTML order to parse a page [73]. Editors must use native heading styles (**H3 for headings and H4 for subheadings**) rather than manually resizing text or using bold tags [73]. Never format headings as questions, as this slows down user skimming.

#### **12. Highlights**

- **Platform Definition**: Visually prominent, image-based promotion cards displaying near the top of a page to spotlight high-value content [136].
- **Supported Content Types**: Supported **only on Agency pages** [136]. Because HHVC does not own an Agency page, this component is out of scope for HHVC program editors [136, 243].
- **Technical Boundaries**: Locked at a **minimum of 2 and a maximum of 3 highlights** [136]. Each highlight card must feature an Image, a safe Link (internal/external), a Title, and a brief Description [136].

#### **13. Images**

- **Supported Content Types**: 9 content types support images: Agency, Campaign, Data story, Event, Information, Location, News, Profile, and Report [11].
- **Required Alt Text**: Alt text is **mandatory for all uploaded images** to maintain WCAG Level AA compliance [20]. Alt text should describe the functional context of the photo in **under 120 characters** (e.g., 'Inspector identifying a cockroach harbor in SRO baseboard') rather than a generic or literal phrase (e.g., 'Photo of a wall') [20].
- **Logo Specifications**: Logo assets display at the top of Agency and Campaign pages, and propagate to corresponding Profile and About pages [34, 182]. Logos must be exactly **100 x 100 px JPG or PNG images** [182, 183].
- **Header Image Specifications**: Banners displaying at the top of Agency or Campaign pages [130]. Banners must be at least 375 px wide [310]. On desktop viewports, part of the image will be covered by the floating white title box, so focal elements must be centered [130].
- **Permitted Photography Sources**: Free stock sites include unsplash.com, pexels.com, genderspectrum.vice.com, nappy.co, and flickr.com [319]. For premium, paid assets, editors can coordinate with Digital Services to source photos from the City's official **Getty Images subscription** [319].

#### **14. Links**

- **Platform Definition**: Relational or manual hyperlink pathways used to connect web files [179].
- **Automatic Content Relationships**: Meetings, Events, and News pages automatically cross-link on the front end when tagged under common Topics [56].
- **External Linking Rules (Endorsement Policy)**: Linking to an external, non-city domain carries version-control risks and counts as an official DPH endorsement [273]. External links are permitted **only if**:
  1. There is no existing internal SF.gov page hosting that information [24].
  2. The target website is a trustworthy, safe, and authoritative source [24, 273].
  3. The citizen requires that specific external tool to complete their task [24].
  4. The link serves as a citable "single source of truth" [24].
- **Linguistic Restrictions**: Never write generic anchor text such as "click here", "learn more", or "read this document" [23, 119]. Link texts must be descriptive, defining exactly what information the user will find when they select the link (e.g., 'Search housing violations by address') [23, 119].

#### **15. Partner agency**

- **Platform Definition**: An optional relational tag used to attribute secondary administrative responsibility for a page's content [214].
- **Relationship rules**: Unlike the Primary Agency field (which restricts editors to exactly one tag), pages can tag **multiple partner agencies** where operational responsibility is shared [214].

#### **16. People section**

- **Platform Definition**: A dynamic visual component that gathers and renders contact cards, including staff photos and bios, directly from individual Profile pages [218].
- **Supported Content Types**: Supported **only on Agency and Location pages** [218].

#### **17. Primary agency**

- **Platform Definition**: A mandatory database tag assigning primary administrative ownership and accountability for a page’s content to a specific City department [237].
- **Supported Content Types**: Required on **all pages across the sitemap starting mid-November 2025** [237].
- **Strict Relational Logic**: Strictly limited to **exactly one primary agency per page** to prevent dashboard filter conflicts [237, 240]. Sighted users see this tag as a clickable, high-contrast breadcrumb link at the top of the page, which serves as a pathway back to the department homepage [237].

#### **18. Redirect this page to**

- **Operational Status**: This in-page component has been **permanently disabled within the Karl CMS editor panel** [245]. Editors are structurally blocked from setting up 301 or 302 redirects [245]. To configure a redirect for consolidated or retired pages, editors must coordinate with Digital Services (`publishinghelp@sfgov.org`) [245].

#### **19. Related**

- **Platform Definition**: A dedicated relational sidebar (on desktop Transactions) or bottom block (on Information/Topic pages) that highlights connected pages across the dot-gov domain [254, 361].
- **Supported Content Types**: Only Transaction, Information, Campaign, and Topic pages can be tagged as Related pages [255, 361].
- **Dynamic Updating**: Tagged related pages automatically display their title and description [254, 361]. If the target page is updated, the Related panel automatically updates, eliminating manual sitemap maintenance [254, 361].

#### **20. Resources**

- **Platform Definition**: Styled blocks (known as Resource Tiles) used to display manual links to internal pages, external trustworthy sites, or downloadable PDF files [270].
- **Supported Content Types**: Supported on only 4 content types: **About, Campaign, Resource Collection, and Topic** [269].
- **PDF Download Rules**: To maintain accessibility conformance, downloadable files (like bed bug complaint logs or PCO written plan templates) must be hosted as media assets in a Resource Collection [285]. Links must feature explicit format and file size tags in brackets (e.g., 'Pre-Tenancy Bed Bug Disclosure [PDF, 185 KB]') [285].

#### **21. Spotlight**

- **Platform Definition**: Large, high-visibility visual banners pairing a centered graphic with custom text and an optional link on a solid, non-customizable background [313].
- **Use Cases**: Recommended for drawing high volumes of public focus to a single, critical initiative or programmatic change [313]. Spotlights are non-reusable [50].

#### **22. Tables**

- **Platform Definition**: Highly restricted grid blocks used to compare clean, structured data [328].
- **Supported Content Types**: **Report is the only content type on SF.gov that natively supports tables [328].**
- **Strict Column Limit**: Editors must restrict tables to **2 or 3 columns** [328]. Wide tables with more than 3 columns break mobile viewports, forcing users to scroll horizontally and creating layout failures on small screens [328].
- **Linguistic Warning (ADA Conformance)**: Text inside tables is **not machine-translated** by Google Translate [328]. To prevent language access violations, editors must never place narrative instructions or citable guidelines inside a table; tables must be reserved solely for numeric data and short reference labels [328].

#### **23. Title**

- **Platform Definition**: The primary, required heading block defining the page's purpose [340].
- **Supported Content Types**: Required on all pages across the sitemap [340].
- **Formatting Rules**: Page titles must precisely identify what the resident wants to do, using sentence-case formatting (only capitalize the first letter and proper nouns) [340].
- **Character Limit**: Hard-coded limit of **65 characters** [340]. Search engine results truncate titles exceeding 65 characters, creating broken context [340].

#### **24. Topics**

- **Platform Definition**: Dynamic database tags that align child pages with their parent Topic landing hubs (e.g., `sf.gov/topics/pests-and-housing-problems`) [357].
- **Functional Logic**: Under our Topic-First Model, tagging a Transaction or Step-by-step page with its parent Topic automatically publishes a card link to your page under the "More services" grid of that Topic page, removing the need for manual linking [358, 387].

#### **25. URLs**

- **Platform Definition**: Clean, lowercase, search-optimized web paths configured to show site hierarchy and reassure residents they are on a safe, unified dot-gov domain [364].
- **Slugging Rules**: prioritize services [364]. Transactions must sit immediately after the top-level domain (e.g., `sf.gov/[slug]`), while Topic pages occupy the `/topics/` directory (e.g., `sf.gov/topics/[slug]`). Avoid filler words (and, the, of, for) inside hyphenated slugs to optimize search rankings [309].

#### **26. Videos**

- **Platform Definition**: Embedded third-party media players (such as YouTube or Granicus players) [372, 373].
- **Direct Hosting Ban**: Video files **cannot be hosted directly on SF.gov** [372]. Videos must be uploaded to third-party platforms and embedded [372].
- **Mandatory Transcript Requirement**: All video embeds must have a **complete written transcript** hosted directly on the page or linked via a descriptive hyperlink to maintain strict WCAG Level AA conformance [110, 372].

#### **27. Documents, including PDFs**

- **Platform Definition**: Uploadable file assets (PDF, DOCX, etc.) attached to pages or linked from Resource Collection items [95].
- **Labeling Rules**: Every document link must include a title, short description, and explicit format and file size in brackets (e.g., `Bed bug complaint log (PDF, 185 KB)`).
- **Accessibility**: Provide an HTML equivalent or summary on SF.gov when residents must complete a task using the document; do not rely on PDF alone for mandatory instructions.
- **Overlap with Resources**: Resource Collection cards may link to PDFs; use the Documents component rules whenever a file is the primary deliverable.

#### **28. Step List**

- **Platform Definition**: In-page ordered steps on Transaction pages (the "What to do" section), rendered as a numbered list with optional Callout and Button per step.
- **HHVC Scope**: Approved HHVC pattern for report pages (see Page Blueprint — Report Cockroaches). Karl's native Step-by-step **content type** remains the choice for journeys longer than a single transaction.
- **Rules**: One primary action per step; use plain language; keep mandatory notices (72-hour tenant notice, privacy reassurance) in visible **Callout** blocks, never in Accordions.
- **Button Placement**: Only the primary 311 or payment CTA should use the Button component; supporting steps use body links or bullets.

---

##### **References**

- [📒 SF.gov and Karl Editor Help Center: Components](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/using-karl-the-cms/components) [7]
- [📒 SF.gov and Karl Editor Help Center: Reusable components](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/using-karl-the-cms/components#reusable-components) [49]
- [📒 SF.gov and Karl Editor Help Center: Tables](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/using-karl-the-cms/components/tables) [328]
- [📒 SF.gov and Karl Editor Help Center: Accordions](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/using-karl-the-cms/components/accordions) [5, 6]
- [📒 SF.gov and Karl Editor Help Center: Alert](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/using-karl-the-cms/components/alert) [16]
- [📒 SF.gov and Karl Editor Help Center: Callout](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/using-karl-the-cms/components/callout) [43]
