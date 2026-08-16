# Karl CMS Content Types Guide

Source: Karl Editor Help Center (GitBook) — https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center

Every page on SF.gov uses a specific Karl content type chosen based on resident needs and structural requirements.

---

## 1. Primary Service Content Types

### Information Page
- **URL Pattern:** `sf.gov/information/[slug]`
- **Resident Goal:** Learn about rules, rights, health guidance, policies, or general city programs.
- **Key Characteristics:**
  - Standard sentence-case title (< 65 characters) and summary (< 110 characters).
  - `information_section` StreamField: holds `Title and text`, `Image`, and `Callout` blocks.
  - Automatic "On this page" table of contents generated from H2 headings in Title and text blocks.
  - **Restrictions:** No native tables (use Report type if tables are needed).

### Transaction Page
- **URL Pattern:** `sf.gov/[verb-slug]` (e.g. `sf.gov/report-health-or-safety-hazard`)
- **Resident Goal:** Complete a discrete civic action (report an issue, apply for a permit, pay a fee, request a service).
- **Key Characteristics:**
  - Requires `cost` (fee information) and `primary_agency`.
  - `what_to_know`: Things to know before starting.
  - `what_to_do`: Numbered sequence of steps or subsections.
  - Exactly one primary call-to-action button per page.

### Resource Collection
- **URL Pattern:** `sf.gov/resource/[year]/[title]`
- **Resident Goal:** Browse and download related documents, forms, reports, and links.
- **Key Characteristics:**
  - Holds `body` StreamField with `Documents`, `Resources`, and `Data stories` blocks.
  - Supports downloadable PDFs and filterable document listings.

### Campaign Page
- **URL Pattern:** `sf.gov/[campaign-slug]`
- **Resident Goal:** Promote a time-bound civic initiative, educational drive, or marketing outreach.
- **Key Characteristics:**
  - Branded color theme, header background image, and campaign logo.
  - `spotlight_1` and `spotlight_2` (Top facts, up to 12 items).
  - `additional_content` StreamField: allows Embed, Image with text, Resources, Accordions, Video.
  - Repeatable `related_links`.

### Topic Page
- **URL Pattern:** `sf.gov/topics--[slug]`
- **Resident Goal:** Browse services and resources organized by an umbrella topic or theme across city departments.
- **Key Characteristics:**
  - Grouped `Services` and `Resources` subsections.
  - Optional `Spotlight` block in `content_fields`.

### Report Page
- **URL Pattern:** `sf.gov/reports--[slug]`
- **Resident Goal:** Read official reports, annual fee schedules, and public statistics.
- **Key Characteristics:**
  - The **only** content type that supports native **Tables**.
  - `content` StreamField offers `Body` (Draftail rich text) and `Table` only (no Callouts or Accordions).
  - H2 headings in Body auto-generate the sticky right-hand table of contents.
  - Supports `print_version` document chooser.

---

## 2. Organizational & Entity Types

### Agency Page
- **URL Pattern:** `sf.gov/departments--[agency-slug]`
- **Purpose:** Front door for a city department, office, commission, or board.
- **Requirements:** Requires `services_title`, `resources_title`, and `public_records` (does not take `primary_agency`).
- **Features:** 3 Highlight cards directly under description, Spotlight CTA, auto-inserting Services/Resources subsections, Division blocks, and Contact information.

### About Us Page
- **URL Pattern:** `sf.gov/departments--[agency-slug]/about`
- **Purpose:** Background, history, mission, leadership, and resources for an agency.
- **Panels:** `title`, `primary_agency`, `about_info` (auto-inserting Custom section), and `resources` chooser.
