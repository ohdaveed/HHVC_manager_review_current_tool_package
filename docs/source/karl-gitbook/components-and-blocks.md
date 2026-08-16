# Karl CMS Components & Blocks Reference

Source: Karl Editor Help Center (GitBook) — https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center

Karl components provide modular building blocks across StreamFields and page panels.

---

## 1. Core Content Components

### Buttons & Call to Actions
- **Editorial Rule:** Keep button labels concise (target $\le 25$ characters for mobile readability).
- **Form Constraint:** Live Wagtail `button_link` text field has a physical limit of `maxlength="255"`.
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
- Available on Campaign (`additional_content`) and select section blocks.
- **Editorial Rule:** Keep accordion titles short and phrased as direct questions or task names.

### Resources & Links Lists
- **Karl Link Types:**
  1. **SF.gov Page:** Internal page chooser (automatically resolves URL and title).
  2. **External Link:** Label + absolute HTTPS URL.
- **Agency Subsections:** Auto-inserting Subsection blocks where child links inherit destination page titles and summaries.
- **About Us Resources:** Chooser offering `Resources section` (links) or `Downloadable files` (documents).

### In-This-Page Table of Contents
- Auto-generated on **Information** and **Report** pages from H2 headings.
- Renders as a quick-jump navigation menu at the top (mobile) or right sidebar (desktop).
