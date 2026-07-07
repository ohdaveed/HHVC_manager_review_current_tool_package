# Karl CMS Content-Type Field Reference

Research synthesis mapping live SF.gov page patterns to Karl CMS editor fields and to the HHVC manager-review mockup schema.

**Sources:**

- SF.gov live-site screenshots (Rent Board, Fog RFP, health appointment, rent increases)
- [Karl Editor Help Center](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/llms.txt) (GitBook)
- [2026-07-07-karl-cms-component-documentation.md](./2026-07-07-karl-cms-component-documentation.md)
- [hhvc-manual-chapter-4.md](../../../hhvc_chapter_drafts/hhvc-manual-chapter-4.md), [chapter 5](../../../hhvc_chapter_drafts/hhvc-manual-chapter-5.md), [chapter 6 v2](../../../hhvc_chapter_drafts/hhvc-manual-chapter-6-v2.md)
- HHVC mockup: `pages/*.js`, `js/page-render.js`, `audit_karl_components.py`

**Karl CMS login:** `https://api.sf.gov/sso/login?next=/admin/`

---

## Executive summary

Karl CMS uses **14 content types**. This reference covers the four types most relevant to HHVC service content:

| Content type | Resident goal | URL pattern | HHVC mockup pages |
| --- | --- | --- | --- |
| **Information** | Learn reference material | `sf.gov/information/[slug]` | 21 pages (e.g. `bedBugsInfo`) |
| **Transaction** | Complete one action | `sf.gov/[verb-slug]` | 14 pages (e.g. `ratsReport`) |
| **Resource Collection** | Browse documents and links | `sf.gov/resource/[year]/[title]` | 4 hub pages (e.g. `reportHub`) |
| **Campaign** | Outreach with branded hero | `sf.gov/[campaign-slug]` | 0 pages (candidate: `mosquitoWorkshop`) |

**Important distinction from screenshots:** The Rent Board **Current Rates** page is a **Report** content type, not Information. Report is the only Karl type with native **tables**, auto **On this page** table of contents, and **Print version** PDF. Do not use that page as an Information-page template for HHVC.

---

## Screenshot appendix

Each screenshot from the research set, classified and mapped to Karl fields.

### 1. Learn about rent increases in San Francisco

**Content type:** Information

**URL pattern:** `sf.gov/information/...`

| Visible UI element | Karl CMS field / component |
| --- | --- |
| H1 page title | **Title** (< 65 characters, sentence case) |
| Summary under title | **Description** (< 110 characters) |
| "Rent Board" link below title | **Primary agency** (breadcrumb / agency link) |
| Light-blue hero box with 1.6% rate | **Callout** or highlighted text in **Information section** |
| City skyline photo | **Image** (in Information section) |
| "On this page" anchor list | Auto-generated from H2 headings in Information section |
| H2 body sections (Overview, Timing, etc.) | **Information section → Title and text** |
| Multilingual link lists | **Links** inside Title and text rich text |
| Math example ($2,000 × .016) | **Title and text** body content |
| "Tags: Topic 050" | **Topics** taxonomy tag |
| "Rent Board" in partner block | **Partner agencies** |
| Right-margin green checkmarks | CMS review UI (not published content) |

**GitBook:** [How an Information page works](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/using-karl-the-cms/content-types/building-a-page-by-content-type/information/how-an-information-page-works.md)

---

### 2. Banked rent increases

**Content type:** Information

| Visible UI element | Karl CMS field / component |
| --- | --- |
| H1 + summary paragraph | **Title**, **Description** |
| "Rent Board" agency link | **Primary agency** |
| Calculator/coins banner image | **Information section → Image** |
| H2 sections with H3 subheads | **Information section → Title and text** (H2 title field; H3/H4 in rich text) |
| Bulleted rule lists | Rich text lists inside Title and text |
| "Topic: 503" | **Topics** tag |
| "Departments: Rent Board" | **Partner agencies** |

**GitBook:** [Information section](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/using-karl-the-cms/content-types/building-a-page-by-content-type/information/information-section.md)

---

### 3. Get a health appointment

**Content type:** Transaction

**URL pattern:** `sf.gov/get-health-appointment` (verb-first, no `/information/` prefix)

| Visible UI element | Karl CMS field / component |
| --- | --- |
| H1 "Get a health appointment" | **Title** (verb-first) |
| Summary paragraph | **Description** |
| "What to do" H2 | Hard-coded **What to do** section heading |
| Numbered steps 1–2 | **What to do → Section** blocks with Text |
| "Login to MyChart" blue button | **What to do → Section → Button** (max 25 characters) |
| Phone number block | **What to do → Section → Phone number** or Text with link |
| Blue info box (urgent care) | **Callout** (in What to do or Supporting information) |
| "Related" link grid | **Related** (right panel; Transaction, Information, Campaign, Topic only) |
| "Partner agencies" | **Partner agencies** |

**GitBook:** [How a Transaction page works](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/using-karl-the-cms/content-types/building-a-page-by-content-type/transaction/how-a-transaction-page-works.md), [What to do section](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/using-karl-the-cms/content-types/building-a-page-by-content-type/transaction/what-to-do-section-on-a-transaction-page.md)

---

### 4. Fog Sustainability Request for Proposals (RFP)

**Content type:** Resource Collection

**URL pattern:** `sf.gov/resource/2024/fog-sustainability-request-proposals-rfp` (GitBook demo)

| Visible UI element | Karl CMS field / component |
| --- | --- |
| H1 + summary | **Title**, **Description** |
| "About the Fog Sustainability RFP" | **Introductory text** or Body subheader |
| "Key Dates" milestone list | **Introductory text** or Body with subheaders |
| "Applications are closed" status | **Custom section** or Callout-style text in Introductory text |
| "Documents" file list with dates | **Body → Documents** (title, description, publish date, file icon) |
| Document revision notes (right column) | Document description field per entry |
| "Technical Assistance" sessions | Body subheader + **Resources** links or Title and text in Custom section |
| Bottom resource cards | **Body → Resources** (links to SF.gov or external pages) |
| "Department of Fog" footer link | **Partner agencies** |

**GitBook:** [How a Resource Collection page works](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/using-karl-the-cms/content-types/building-a-page-by-content-type/resource-collection/how-a-resource-collection-page-works.md)

**Note:** Complex RFP pages are Resource Collections, not Campaigns. Campaigns are for branded outreach with Spotlight, Top facts, and color themes—not document libraries.

---

### 5. Current Rates (Rent Board) — Report type (out of scope for HHVC Information)

**Content type:** **Report** (not Information, Transaction, Resource Collection, or Campaign)

| Visible UI element | Karl CMS field / component |
| --- | --- |
| H1 + hero summary box | **Title**, **Spotlight** or body intro |
| "On this page" TOC | Auto-generated from **Body** H2 headings (Report-only feature) |
| Multiple data tables | **Body → Tables** (Report is the **only** Karl type with native tables; max 3 columns) |
| Multilingual link blocks after tables | **Links** in Body |
| "Print version" PDF link | **Print version** field |
| Section H2s (Allowable rent increase, etc.) | **Body** sections |

**Why this matters for HHVC:** Transaction and Information pages **cannot** host tables in Karl. Fee tiers and rate schedules belong on a **Report** or linked **Resource Collection** document, not on a Transaction page (see [hhvc-manual-chapter-8.md](../../../hhvc_chapter_drafts/hhvc-manual-chapter-8.md)).

**GitBook:** [How a Report page works](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/using-karl-the-cms/content-types/building-a-page-by-content-type/report/how-a-report-page-works.md)

---

## Information pages

### Purpose and selection

Publish useful reference information when there is **nothing directly actionable**. If the page contains a clear task, use **Transaction** instead.

- **Audience:** General public
- **URL:** `sf.gov/information/[slug]`
- **GitBook:** [Information](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/using-karl-the-cms/content-types/building-a-page-by-content-type/information.md)

### Karl editor fields (top → bottom)

| Order | Field | Constraints / notes |
| --- | --- | --- |
| 1 | **Title** | < 65 characters; sentence case; only H1 on page |
| 2 | **Description** | < 110 characters; front-load keywords |
| 3 | **Primary agency** | Required; drives breadcrumb and branding |
| 4 | **Part of** | Optional; links back to parent Step-by-step page |
| 5 | **Information section** | Repeatable blocks (see below) |
| 6 | **Partner agencies** | Optional; footer collaborator links |
| 7 | **Topics** | Tags page to Topic hub |
| 8 | **Related** | Manual links to Transaction, Information, Campaign, or Topic |

Information pages **must be manually linked** to other pages. They do not auto-link to each other.

### Information section block types

Only three component types are allowed inside **Information section**:

| Block type | Renders as | Use for |
| --- | --- | --- |
| **Title and text** | H2 section title + rich text (H3/H4 inside) | Main body, lists, inline links |
| **Image** | Featured photo with alt text | Visual context |
| **Callout** | Blue "i" box | Stable, citable rules and notices |

### Components not available on Information

- **Button** — use Transaction for primary CTAs
- **Tables** — use Report content type
- **Accordions** — use Transaction Supporting information or Campaign
- **Alert** banner — Agency/Location only; use in-body Callout instead

### HHVC mockup mapping

Example: [`pages/bed-bug-rules-prevention.js`](../../../pages/bed-bug-rules-prevention.js)

| Mockup field | Karl field / component |
| --- | --- |
| `type: 'Information'` | Content type selector |
| `title` | Title |
| `summary` | Description |
| `slug` | URL (auto-derived from title) |
| `audience[]` | Mockup-only "Who this page is for" (HHVC editorial metadata, not a Karl field) |
| `reading` | Mockup-only grade-level target |
| `sections[].heading` | Information section → Title and text (title field = H2) |
| `sections[].paragraphs` | Title and text body |
| `sections[].bullets` | Rich text unordered list |
| `sections[].callout` | Callout |
| `sections[].cards` with `url` | External Links in body (mockup uses card UI) |
| `sections[].cards` with `target` | Related links (mockup approximates right-panel Related) |
| `sections[].table` | **Invalid in Karl Information** — mockup renders for preview only |
| `sections[].karl` | Editor placement note (not published) |
| `editorNote` | Mockup QA only (not published) |
| `seoTitle`, `metaDescription`, `primaryCta` | Mockup SEO panel only |

---

## Transaction pages

### Purpose and selection

Single interaction or exchange with the City. Every element must propel the user toward completing the task.

- **Audience:** General public
- **URL:** `sf.gov/[verb-slug]` (no subdirectory)
- **GitBook:** [Transaction](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/using-karl-the-cms/content-types/building-a-page-by-content-type/transaction.md)

### Karl editor fields (top → bottom)

| Order | Field | Constraints / notes |
| --- | --- | --- |
| 1 | **Title** | Verb-first; < 65 characters; sentence case |
| 2 | **Description** | < 110 characters |
| 3 | **Primary agency** | Required |
| 4 | **What to know before you start** | Gray box below description |
| 4a | → **Cost** | Optional; state "Free" if no fee |
| 4b | → **Things to know** | Eligibility, deadlines, response time; ≤ 2 items recommended |
| 5 | **What to do** | **Hard-coded H2** — cannot rename or remove |
| 6 | **Supporting information** | Accordions (FAQs only) + optional custom section |
| 7 | **Why is this Transaction good for the Community?** | Optional mission blurb |
| 8 | **Related** | Right-panel cards; Transaction, Information, Campaign, Topic only |
| 9 | **Contact us** | Standard contact snippet |
| 10 | **Partner agencies** | Footer collaborators |
| 11 | **Topics** | Auto-surfaces on parent Topic "More services" grid when tagged |

### What to do section internals

Under **What to do**, editors add **Callout** or **Section** blocks:

- **Section** → H2 title (add numbers manually) → nested specifics:
  - Address, Callout, Document, Email, **Button**, Phone number, Text
- **Button** — max 25 characters; verb-first; recommend one primary per page
- Multi-stage journeys spanning several transactions → use **Step-by-step** content type instead

### HHVC mockup mapping

Example: [`pages/report-rats-or-mice.js`](../../../pages/report-rats-or-mice.js)

| Mockup field | Karl field / component |
| --- | --- |
| `type: 'Transaction'` | Content type selector |
| `title` | Title |
| `summary` | Description |
| `sections[].heading: 'What to do'` | What to do (hard-coded in Karl) |
| `sections[].steps[]` | What to do → Section blocks + Step List pattern |
| `steps[].title` | Section title (H2) |
| `steps[].text`, `steps[].bullets` | Section → Text |
| `steps[].button`, `buttonUrl` | Section → Button |
| `steps[].callout` | Section → Callout |
| Additional `sections[]` below What to do | Supporting information or extra body sections |
| `sections[].cards` with `target` | Related panel links |
| `primaryCta` | Mockup SEO panel (maps to primary Button label intent) |

**Gap:** Mockup does not render the gray **What to know before you start** box (Cost / Things to know). Editors must add that in Karl separately from `summary`.

---

## Resource Collection pages

### Purpose and selection

Display lists of **Documents** (PDFs), **Resources** (page links), or **Data stories** (dashboard embeds).

- **Audience:** People who need PDFs to print or want to research a topic
- **URL:** `sf.gov/resource/[year]/[title]`
- **GitBook:** [Resource Collection](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/using-karl-the-cms/content-types/building-a-page-by-content-type/resource-collection.md)

### Karl editor fields (top → bottom)

| Order | Field | Constraints / notes |
| --- | --- | --- |
| 1 | **Title** | Often year-scoped (e.g. "2024 HHVC forms") |
| 2 | **Description** | What the library contains |
| 3 | **Primary agency** | Required |
| 4 | **Data dashboard** | Optional embedded analytics |
| 5 | **Introductory text** | Optional explainer above lists |
| 6 | **Body** | Three asset slots (see below) |
| 7 | **Custom section** | Single optional paragraph at bottom |
| 8 | **Topics** | "Part of" topic relationship |
| 9 | **Partner agencies** | Footer collaborators |

### Body asset types

| Body slot | Displays as | Example from Fog RFP screenshot |
| --- | --- | --- |
| **Documents** | File icon, linked title, description, publish date | RFP PDFs with revision notes |
| **Resources** | Links to SF.gov or external pages | Technical assistance recordings |
| **Data stories** | Links to Data story pages | Power BI / Looker embeds |

Subheaders can organize items within each slot.

Resource Collections are **not auto-linked** — add manually as Related or Resources on other pages.

### HHVC mockup mapping

Example: [`pages/prevent-problems.js`](../../../pages/prevent-problems.js) (hub pattern)

| Mockup field | Karl field / component |
| --- | --- |
| `type: 'Resource collection'` | Content type selector |
| `title` | Title |
| `summary` | Description |
| `sections[].paragraphs` (intro) | Introductory text |
| `sections[].cards[]` with `target` | **Mockup approximation** of Body → Resources (cross-links to existing pages) |
| `sections[].cards[]` with `url` | Body → Resources (external links) |

**HHVC gap:** Hub pages like `reportHub` and `preventHub` use **card cross-links** to Transaction/Information pages instead of Karl's Documents/Resources/Data body slots. This is intentional for review mockups (reuse existing pages, avoid duplicating PDF inventory). Production Karl Resource Collections for HHVC forms should use **Body → Documents** for PDFs.

---

## Campaign pages

### Purpose and selection

Message-focused, often ephemeral outreach with more branding options than service pages. Less automatically tied to SF.gov information architecture.

- **Audience:** Can target specific demographics or neighborhoods
- **URL:** `sf.gov/[campaign-slug]`
- **GitBook:** [Campaign](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/using-karl-the-cms/content-types/building-a-page-by-content-type/campaign.md)

### Karl editor fields (top → bottom)

| Order | Field | Constraints / notes |
| --- | --- | --- |
| 1 | **Title** | Campaign name |
| 2 | **Primary agency** | Required |
| 3 | **Logo** | 100 × 100 px JPG or PNG |
| 4 | **Background header image** | ≥ 375 px wide; title box overlaps on desktop |
| 5 | **Color theme** | Department branding choice |
| 6 | **Spotlight 1** | Image + text + link on colored background |
| 7 | **Top facts** | Up to 12 fact items |
| 8 | **Additional content** | Flexible body (Image with text, etc.) |
| 9 | **Spotlight 2** | Second spotlight block |
| 10 | **About** | Organizational context |
| 11 | **Partner agencies** | Collaborators |
| 12 | **Related** | Manual links only |

**Also available:** Resources section, Accordions, Video, Embed, Social media (per GitBook component index).

### Discovery rules

Campaigns are **not** auto-linked from other content types. Surface them via:

- Manual **Related** on Information or Transaction pages
- **Resources** or **Spotlight** on Topic or Agency pages
- Pair with **News** item when announcing a new campaign

### When to choose Campaign vs Information vs Event

| Scenario | Use |
| --- | --- |
| Ongoing program with branded hero, logo, top facts | **Campaign** |
| Static reference guide, rules, prevention advice | **Information** |
| Single scheduled session with date, time, registration | **Event** |

### HHVC status

No mockup page uses `type: 'Campaign'`. [`pages/mosquito-education-workshop.js`](../../../pages/mosquito-education-workshop.js) is typed **Information** with `editorNote` guidance:

> Use Information if this stays reference + request link; use Campaign if HHVC treats it as an ongoing program with spotlight/top facts.

| If promoted to Campaign | Maps from current mockup content |
| --- | --- |
| Spotlight 1 | "Bring mosquito science to your students" + workshop photo |
| Top facts | Free program, eligible audiences, standards alignment bullets |
| Additional content | Station descriptions, request CTA |
| Button on request section | Would move to Campaign-allowed Button or link in Spotlight |

---

## Component availability matrix

Cross-type rules from [hhvc-manual-chapter-6-v2.md](../../../hhvc_chapter_drafts/hhvc-manual-chapter-6-v2.md) and the component xlsx extract.

| Component | Information | Transaction | Resource Collection | Campaign | Report |
| --- | --- | --- | --- | --- | --- |
| Button | No | Yes (primary CTA) | No | Yes | No |
| Callout | Yes (body) | Yes (What to do + body) | No (use Custom section) | Via Additional content | Yes |
| Tables | No | No | No | No | **Yes (only type)** |
| Accordions | No | Yes (supporting info only) | No | Yes | Yes |
| Related | Yes | Yes | Manual linking only | Yes | No |
| Resources snippet | No | No | Native Body slot | Yes | No |
| Spotlight | No | No | No | Yes (×2) | Yes |
| Images | Yes | Limited | Via document icons | Logo + header + spotlights | Yes |
| Topics tag | Yes | Yes (auto on Topic) | Yes | Yes | No |
| Contact section | Yes | Yes | No | No | No |
| Alert banner | No | No | No | No (Agency/Location) | No |

Enforced in repo by [`audit_karl_components.py`](../../../audit_karl_components.py):

- Description (`summary`) ≤ 110 characters
- Title ≤ 65 characters
- No Button/`primaryCta` on Information pages
- Tables ≤ 3 columns (Report-only in production Karl)

---

## Mockup page object schema (full mapping)

The mockup stores pages in `pages/*.js` and validates via [`build_scripts/schema.js`](../../../build_scripts/schema.js).

### Top-level page fields

| Mockup field | Karl equivalent | Published? |
| --- | --- | --- |
| `slug` | URL | Yes |
| `type` | Content type | Yes (eyebrow label) |
| `title` | Title | Yes |
| `summary` | Description | Yes |
| `audience[]` | HHVC editorial standard (not Karl) | Mockup only |
| `reading` | HHVC grade-level target | Mockup only |
| `seoTitle` | SEO override | Mockup editor panel |
| `metaDescription` | Meta description | Mockup editor panel |
| `primaryCta` | Primary Button label intent | Mockup editor panel |
| `editorNote` | QA guidance | Mockup only |
| `sections[]` | Body components | Yes |

### Section-level fields

| Mockup field | Karl equivalent |
| --- | --- |
| `heading` | Section title (H2) or What to do Section title |
| `karl` | Placement note for reviewers (not published) |
| `kind` | Tag color in mockup (`body`, `placement`, etc.) |
| `paragraphs[]` | Title and text / Text |
| `bullets[]` | Rich text list |
| `steps[]` | What to do Section + Step List |
| `table[][]` | Report Body tables only |
| `cards[]` | Related / Resources links |
| `callout` | Callout |
| `button`, `buttonUrl`, `buttonTarget` | Button / Links |
| `buttonStyle` | Primary vs secondary button |

### `karl` field conventions in HHVC data

| Pattern | Meaning |
| --- | --- |
| `Body: ...` | Main Information or Transaction body |
| `Body step: ...` | Step List item in What to do |
| `Body step N + Primary action button` | Step with Button CTA |
| `Resource collection body: Introductory text` | Resource Collection intro |
| `Resource collection item cross-link to ...` | Body → Resources link |
| `Related section: right-panel linked page` | Related component |
| `Body note: ...` | Callout placement |
| `BLOCKED — ...` | Editorial hold |

Rendered by `karlTag()` in [`js/page-render.js`](../../../js/page-render.js); visibility toggled via `show_karl_tags` in localStorage.

---

## HHVC gaps and recommendations

| Gap | Current state | Recommendation |
| --- | --- | --- |
| **Campaign** not modeled | `mosquitoWorkshop` is Information | Promote to Campaign if HHVC treats workshops as ongoing outreach |
| **Resource Collection** shape | Hubs use `cards[]` cross-links | Production PDF libraries should use Body → Documents |
| **What to know** box | Not rendered in mockup | Add gray-box section to Transaction template if reviewers need it |
| **Tables on Information** | Mockup can render `table[][]` | Do not publish tables on Information; use Report or linked Resource Collection |
| **Report** type | Not in mockup | Not needed for HHVC scope unless publishing Director's Rules as citable Report pages |
| **Step-by-step** type | Process pages use Information + `steps[]` | Consider `afterReport` as Step-by-step if Karl breadcrumb "Part of" is required |

---

## Spot-check: one HHVC page per type

| Type | Page key | File | Karl alignment |
| --- | --- | --- | --- |
| Information | `bedBugsInfo` | `pages/bed-bug-rules-prevention.js` | Title, Description, Information section blocks, Callouts, external Links via cards — no Button |
| Transaction | `ratsReport` | `pages/report-rats-or-mice.js` | What to do steps, primary Button, step Callouts — missing What to know box in mockup |
| Resource collection | `preventHub` | `pages/prevent-problems.js` | Title, Description, intro text, Resources-style card links — not Documents body |
| Campaign | _(none)_ | `pages/mosquito-education-workshop.js` (Information) | Candidate for Campaign promotion per `editorNote` |

---

## Related documentation

- [Karl CMS component documentation (28 components)](./2026-07-07-karl-cms-component-documentation.md)
- [HHVC Manual Chapter 1: Introduction and scope](../../../hhvc_chapter_drafts/hhvc-manual-chapter-1.md) — order of authority and field reference pointer
- [HHVC Manual Chapter 3: Information Architecture Standards](../../../hhvc_chapter_drafts/hhvc-manual-chapter-3.md) — URL patterns and navigation rules
- [HHVC Manual Chapter 4: Karl Content Type Standards](../../../hhvc_chapter_drafts/hhvc-manual-chapter-4.md)
- [HHVC Manual Chapter 5: Required Page Patterns](../../../hhvc_chapter_drafts/hhvc-manual-chapter-5.md) — includes Campaign page pattern (§5.8)
- [HHVC Manual Chapter 6: Karl Component Standards](../../../hhvc_chapter_drafts/hhvc-manual-chapter-6-v2.md)
- [HHVC Manual Chapter 8: Service Content Standards](../../../hhvc_chapter_drafts/hhvc-manual-chapter-8.md) — fee tier / Report table guidance
- [Karl Editor Help Center — Choosing a content type](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/using-karl-the-cms/content-types/choosing-a-content-type)
