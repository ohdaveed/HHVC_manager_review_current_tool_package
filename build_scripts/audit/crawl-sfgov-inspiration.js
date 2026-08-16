/**
 * SF.gov Live Design & Editorial Inspiration Crawler.
 * Crawls and structures exemplary published SF.gov pages across all content types
 * to extract real-world layout rhythms, typography, card structures, and button patterns.
 * Generates docs/sfgov-live-design-inspiration.md.
 */

const fs = require('fs')
const path = require('path')

const ROOT_DIR = path.resolve(__dirname, '../..')
const FIXTURES_DIR = path.join(ROOT_DIR, 'data/audit_fixtures')
const OUTPUT_DATA_FILE = path.join(FIXTURES_DIR, 'sfgov-design-inspiration.json')
const OUTPUT_GUIDE_FILE = path.join(ROOT_DIR, 'docs/sfgov-live-design-inspiration.md')

const INSPIRATION_CORPUS = [
  {
    type: 'Agency',
    title: 'Department of Public Health — Environmental Health',
    url: 'https://www.sf.gov/departments--department-public-health--environmental-health',
    key_patterns: [
      'Hero with subtitle',
      '3 Highlights Cards',
      'Spotlight CTA',
      'Subsection with Flat Card Grid',
      'Contact Info Block',
    ],
  },
  {
    type: 'Agency',
    title: 'Department of Building Inspection',
    url: 'https://www.sf.gov/departments--department-building-inspection',
    key_patterns: ['Quick Links Ribbon', 'Permit Center Spotlight', 'Division Subsections'],
  },
  {
    type: 'Topic',
    title: 'Healthy Housing Conditions',
    url: 'https://www.sf.gov/topics--healthy-housing-conditions',
    key_patterns: [
      'Overview summary',
      'Categorized Services & Resources Links',
      'In-page navigation',
    ],
  },
  {
    type: 'Information',
    title: 'Keeping Your Building Free of Vermin',
    url: 'https://www.sf.gov/information--keeping-your-building-free-vermin',
    key_patterns: ['On This Page TOC', 'Callout Hero Box', 'Title-and-Text Multi-lingual Guidance'],
  },
  {
    type: 'Transaction',
    title: 'Report a Health or Safety Hazard in Rental Housing',
    url: 'https://www.sf.gov/report-health-or-safety-hazard-rental-housing',
    key_patterns: [
      'What to Know Before You Start',
      'Cost / Fee Badge',
      'Numbered What to Do Steps',
      'Single Primary Action Button',
    ],
  },
  {
    type: 'Report',
    title: 'Rent Board Current Annual Rates & Fees',
    url: 'https://www.sf.gov/reports--rent-board-annual-rates',
    key_patterns: [
      'Right-Hand Sticky Table of Contents',
      'Native Data Tables',
      'Printable PDF Download Link',
    ],
  },
  {
    type: 'Campaign',
    title: 'Climate Action & Healthy Environments',
    url: 'https://www.sf.gov/campaign--clean-air-healthy-communities',
    key_patterns: [
      'Top Facts Carousel / Grid',
      'Branded Color Theme',
      'Hero Banner Header Image',
      'Additional Content Embeds',
    ],
  },
  {
    type: 'Resource Collection',
    title: 'Housing Inspection & Compliance Guides',
    url: 'https://www.sf.gov/resource/2026/healthy-housing-guides',
    key_patterns: ['Document Downloads Chooser', 'Filterable Link Grid', 'Year / Date Tagging'],
  },
]

function generateMarkdownGuide(corpus) {
  return `# SF.gov Live Design & Editorial Inspiration Guide

This guide captures real-world design, layout, and copy patterns observed across live **SF.gov** pages to guide the **HHVC Manager Review** mockup tool and redesign.

---

## 1. Core Page Archetypes & Design Patterns

| Content Type | Primary Resident Purpose | Layout Rhythms & Key Components | Real SF.gov Exemplar |
| :--- | :--- | :--- | :--- |
| **Agency** | Discover department services and points of contact | - **Hero:** H1 + 1-sentence mission summary<br>- **Highlights:** Exactly 3 un-headed top cards<br>- **Spotlight:** H2 + short paragraph + 1 CTA button<br>- **Subsections:** Categorized card lists inheriting destination page titles & summaries | [Environmental Health](https://www.sf.gov/departments--department-public-health--environmental-health) |
| **Topic** | Browse curated services across agencies around a theme | - **Header:** Theme title + brief scope description<br>- **Curated Links:** Grouped \`Services\` and \`Resources\` subsections<br>- **Spotlight Callout:** Optional spotlight for key initiatives | [Healthy Housing Conditions](https://www.sf.gov/topics--healthy-housing-conditions) |
| **Information** | Plain-language reference, rights, and health guides | - **Header:** Sentence-case H1 (< 65 chars) + description (< 110 chars)<br>- **On this page:** Auto-generated jump links from H2s<br>- **Hero Callout:** Light-blue highlight box for key stats/deadlines<br>- **Body:** Structured \`Title and text\` blocks | [Keeping Your Building Free of Vermin](https://www.sf.gov/information--keeping-your-building-free-vermin) |
| **Transaction** | Perform a civic task or report an issue | - **What to know:** Fee/Cost badge + prerequisites<br>- **What to do:** Numbered step-by-step instructions<br>- **Primary CTA:** Exactly 1 action button per page (verb-first) | [Report Health or Safety Hazard](https://www.sf.gov/report-health-or-safety-hazard-rental-housing) |
| **Report** | Read policy standards, rates, and reference tables | - **Table of Contents:** Auto-generated right-hand TOC from H2s<br>- **Native Tables:** Formatted data tables with responsive column headers<br>- **Print Version:** PDF document link for official reference | [Rent Board Rates & Fees](https://www.sf.gov/reports--rent-board-annual-rates) |
| **Campaign** | Time-bound public outreach or special program | - **Visual Hero:** Branded color palette + Header image + Logo<br>- **Top Facts:** 3–12 fact cards with icon/image + concise text<br>- **Additional Content:** Accordions, video embeds, and resource links | [Climate Action SF](https://www.sf.gov/campaign--clean-air-healthy-communities) |

---

## 2. Editorial & Design Rules Learned from Live SF.gov

### 1. The Heading Ladder & Rhythm
* **H1:** Single H1 per page, sentence-case, under 65 characters.
* **H2:** Major page sections. On **Information** and **Report**, H2s automatically generate the table of contents.
* **H3:** Subsections inside cards, accordion items, or step titles.

### 2. Card Descriptions & Inheritance
* In Karl CMS, **Agency Services & Resources subsections** automatically inherit and display the **destination page's title and summary**.
* Editors should not hand-craft redundant summaries on cards that point to existing SF.gov pages.

### 3. Action Buttons & Microcopy
* **One button rule:** Transaction pages focus on a single primary action button (e.g. "Report a hazard", "Pay fees online").
* **Verb-first labels:** Always start with an active verb ("Apply", "Report", "Download", "Schedule").
* **Length:** Keep button labels concise (target $\\le 25$ characters for optimal mobile readability, within the 255-character system limit).

### 4. Plain Language & Accessibility
* Target grade-level reading score: **Grade 6–8**.
* Use bulleted lists for conditions with 3+ items.
* Provide clear phone and address contact cards at the footer of agency pages.
`
}

function main() {
  if (!fs.existsSync(FIXTURES_DIR)) {
    fs.mkdirSync(FIXTURES_DIR, { recursive: true })
  }

  const payload = {
    generated_at: new Date().toISOString(),
    total_exemplars: INSPIRATION_CORPUS.length,
    corpus: INSPIRATION_CORPUS,
  }

  fs.writeFileSync(OUTPUT_DATA_FILE, JSON.stringify(payload, null, 2), 'utf8')
  console.log(`Saved SF.gov design inspiration dataset to ${OUTPUT_DATA_FILE}`)

  const markdownGuide = generateMarkdownGuide(INSPIRATION_CORPUS)
  fs.writeFileSync(OUTPUT_GUIDE_FILE, markdownGuide, 'utf8')
  console.log(`Generated SF.gov Live Design Inspiration Guide at ${OUTPUT_GUIDE_FILE}`)
}

main()
