/**
 * Compile the Karl GitBook rules and documentation into structured RAG knowledge sources
 * under docs/source/karl-gitbook/*.md.
 */

const fs = require('fs')
const path = require('path')

const ROOT_DIR = path.resolve(__dirname, '../..')
const FIXTURES_DIR = path.join(ROOT_DIR, 'data/audit_fixtures')
const TARGET_DIR = path.join(ROOT_DIR, 'docs/source/karl-gitbook')
const RULES_FILE = path.join(FIXTURES_DIR, 'karl-gitbook-rules.json')

function generateContentTypesGuide() {
  return `# Karl CMS Content Types Guide

Source: Karl Editor Help Center (GitBook) — https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center

Every page on SF.gov uses a specific Karl content type chosen based on resident needs and structural requirements.

---

## 1. Primary Service Content Types

### Information Page
- **URL Pattern:** \`sf.gov/information/[slug]\`
- **Resident Goal:** Learn about rules, rights, health guidance, policies, or general city programs.
- **Key Characteristics:**
  - Standard sentence-case title (< 65 characters) and summary (< 110 characters).
  - \`information_section\` StreamField: holds \`Title and text\`, \`Image\`, and \`Callout\` blocks.
  - Automatic "On this page" table of contents generated from H2 headings in Title and text blocks.
  - **Restrictions:** No native tables (use Report type if tables are needed).

### Transaction Page
- **URL Pattern:** \`sf.gov/[verb-slug]\` (e.g. \`sf.gov/report-health-or-safety-hazard\`)
- **Resident Goal:** Complete a discrete civic action (report an issue, apply for a permit, pay a fee, request a service).
- **Key Characteristics:**
  - Requires \`cost\` (fee information) and \`primary_agency\`.
  - \`what_to_know\`: Things to know before starting.
  - \`what_to_do\`: Numbered sequence of steps or subsections.
  - Exactly one primary call-to-action button per page.

### Resource Collection
- **URL Pattern:** \`sf.gov/resource/[year]/[title]\`
- **Resident Goal:** Browse and download related documents, forms, reports, and links.
- **Key Characteristics:**
  - Holds \`body\` StreamField with \`Documents\`, \`Resources\`, and \`Data stories\` blocks.
  - Supports downloadable PDFs and filterable document listings.

### Campaign Page
- **URL Pattern:** \`sf.gov/[campaign-slug]\`
- **Resident Goal:** Promote a time-bound civic initiative, educational drive, or marketing outreach.
- **Key Characteristics:**
  - Branded color theme, header background image, and campaign logo.
  - \`spotlight_1\` and \`spotlight_2\` (Top facts, up to 12 items).
  - \`additional_content\` StreamField: allows Embed, Image with text, Resources, Accordions, Video.
  - Repeatable \`related_links\`.

### Topic Page
- **URL Pattern:** \`sf.gov/topics--[slug]\`
- **Resident Goal:** Browse services and resources organized by an umbrella topic or theme across city departments.
- **Key Characteristics:**
  - Grouped \`Services\` and \`Resources\` subsections.
  - Optional \`Spotlight\` block in \`content_fields\`.

### Report Page
- **URL Pattern:** \`sf.gov/reports--[slug]\`
- **Resident Goal:** Read official reports, annual fee schedules, and public statistics.
- **Key Characteristics:**
  - The **only** content type that supports native **Tables**.
  - \`content\` StreamField offers \`Body\` (Draftail rich text) and \`Table\` only (no Callouts or Accordions).
  - H2 headings in Body auto-generate the sticky right-hand table of contents.
  - Supports \`print_version\` document chooser.

---

## 2. Organizational & Entity Types

### Agency Page
- **URL Pattern:** \`sf.gov/departments--[agency-slug]\`
- **Purpose:** Front door for a city department, office, commission, or board.
- **Requirements:** Requires \`services_title\`, \`resources_title\`, and \`public_records\` (does not take \`primary_agency\`).
- **Features:** 3 Highlight cards directly under description, Spotlight CTA, auto-inserting Services/Resources subsections, Division blocks, and Contact information.

### About Us Page
- **URL Pattern:** \`sf.gov/departments--[agency-slug]/about\`
- **Purpose:** Background, history, mission, leadership, and resources for an agency.
- **Panels:** \`title\`, \`primary_agency\`, \`about_info\` (auto-inserting Custom section), and \`resources\` chooser.
`
}

function generateComponentsGuide() {
  return `# Karl CMS Components & Blocks Reference

Source: Karl Editor Help Center (GitBook) — https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center

Karl components provide modular building blocks across StreamFields and page panels.

---

## 1. Core Content Components

### Buttons & Call to Actions
- **Editorial Rule:** Keep button labels concise (target $\\le 25$ characters for mobile readability).
- **Form Constraint:** Live Wagtail \`button_link\` text field has a physical limit of \`maxlength="255"\`.
- **Microcopy:** Always start with an active verb ("Apply", "Report", "Pay", "Sign up").
- **Page Cardinality:** Digital Services recommends a maximum of one primary button per Transaction page.

### Callouts
- Single rich text field highlighted in light-blue background.
- Used to highlight critical deadlines, fee summaries, or safety warnings.
- **Structure:** In Karl, Callout is a single text block (does not have a distinct title field).

### Tables
- **Exclusivity:** Native tables are exclusive to the **Report** content type.
- **Structure:** Table header options, Description, Caption, Column headings, and Rich text cells.
- Tables are fully responsive and adapt to mobile viewports.

### Accordions
- Expandable disclosure blocks used for dense FAQs or multi-part reference material.
- Available on Campaign (\`additional_content\`) and select section blocks.
- **Editorial Rule:** Keep accordion titles short and phrased as direct questions or task names.

### Resources & Links Lists
- **Karl Link Types:**
  1. **SF.gov Page:** Internal page chooser (automatically resolves URL and title).
  2. **External Link:** Label + absolute HTTPS URL.
- **Agency Subsections:** Auto-inserting Subsection blocks where child links inherit destination page titles and summaries.
- **About Us Resources:** Chooser offering \`Resources section\` (links) or \`Downloadable files\` (documents).

### In-This-Page Table of Contents
- Auto-generated on **Information** and **Report** pages from H2 headings.
- Renders as a quick-jump navigation menu at the top (mobile) or right sidebar (desktop).
`
}

function generateStyleGuide() {
  return `# Karl CMS Editorial Style & Writing Standards

Source: Karl Editor Help Center (GitBook) — https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center

SF.gov writing standards ensure city information is accessible, direct, and easy to understand for all residents.

---

## 1. Plain Language & Readability
- **Target Grade Level:** Grade 6 to Grade 8 readability.
- **Tone:** Direct, clear, active voice, resident-focused.
- **Sentence Length:** Keep sentences concise (under 20 words where possible).
- **Paragraphs:** Keep paragraphs short (1–3 sentences). Break complex procedures into bulleted or numbered lists.

---

## 2. Typography & Character Guidelines
- **Page Titles (H1):**
  - Use sentence case (e.g. "Report a health or safety hazard in rental housing").
  - Target under 65 characters so titles fit in search previews and social cards.
- **Page Descriptions / Summaries:**
  - One to two concise sentences.
  - Target under 110 characters.
- **Heading Ladders:**
  - Single H1 per page.
  - H2 for major content sections.
  - H3 for subsections or step titles.
  - Avoid skipping heading levels (e.g. H1 directly to H3).
- **Prohibited Formatting:**
  - Do not use H2 inside rich text blocks on types where H2 is reserved for page sectioning (except Report Body).
  - Do not use ALL CAPS for emphasis (use bold sparingly).
`
}

function generatePublishingGuide() {
  return `# Karl CMS Publishing & Tab Workflows

Source: Karl Editor Help Center (GitBook) — https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center

Karl operates on a standard Wagtail 3-tab interface across all content types.

---

## 1. The Three-Tab Model

Every Karl content type uses a \`TabbedInterface\` with three tabs:
1. **Content Tab:** Page-specific body fields, heroes, streamfield choosers, and contact blocks.
2. **Promote Tab:** SEO and search metadata:
   - \`slug\` (Required): The URL slug for the page.
   - \`seo_title\` (Optional): Search engine title override.
   - \`search_description\` (Optional): Search snippet description.
   - \`show_in_menus\` (Optional): Checkbox to display page in navigation menus.
   - \`tags\` (Optional): Taxonomy tags (ClusterTaggableManager).
3. **Settings Tab:** Publication management:
   - Go-live date/time and Expiry date/time.
   - Privacy / access restrictions.
   - Locked / unlocked page state.

---

## 2. Editor Modes & States
- **Live Mode:** The currently published version visible to the public on SF.gov.
- **Page Editor Mode:** Working draft environment where edits can be staged and saved.
- **Preview Mode:** Renders the draft in real-time as it will appear on SF.gov before publishing.
- **Revision History:** Full audit log of all saves and publishes, allowing one-click rollback to any previous version.
`
}

function main() {
  if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true })
  }

  const files = [
    { name: 'content-types-guide.md', content: generateContentTypesGuide() },
    { name: 'components-and-blocks.md', content: generateComponentsGuide() },
    { name: 'editorial-style-and-standards.md', content: generateStyleGuide() },
    { name: 'publishing-and-workflow.md', content: generatePublishingGuide() },
  ]

  if (fs.existsSync(RULES_FILE)) {
    const rulesData = JSON.parse(fs.readFileSync(RULES_FILE, 'utf8'))
    let rulesMd = `# Karl GitBook Extracted Rules Summary\n\nTotal indexed articles: ${rulesData.total_articles}\n\n`
    rulesMd += `## Extracted Invariants & Character Limits\n\n`
    for (const r of rulesData.extracted_rules.slice(0, 100)) {
      rulesMd += `- **[${r.type}]** \`${r.source}\`: ${r.context || r.statement}\n`
    }
    files.push({ name: 'karl-gitbook-complete-rules.md', content: rulesMd })
  }

  for (const f of files) {
    const outPath = path.join(TARGET_DIR, f.name)
    fs.writeFileSync(outPath, f.content, 'utf8')
    console.log(`Created: ${outPath}`)
  }

  console.log(`\nSuccessfully compiled Karl GitBook corpus into ${TARGET_DIR}`)
}

main()
