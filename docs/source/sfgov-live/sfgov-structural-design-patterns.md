---
source_url: https://www.sf.gov/
karl_content_type: sf.StructuralPatterns
fetched: 2026-08-08
capture: Firecrawl cross-site structural pattern analysis
---

# SF.gov Live Structural Design Patterns & Components

### Agency Template Order
1. **Content Type Badge:** \`Agency\`
2. **H1 Title:** Department or Division Name
3. **Mission Summary:** Single sentence summarizing civic mission.
4. **Highlights:** Exactly 3 un-headed highlight cards (requires 350x200 image + link title + description).
5. **Spotlight:** H2 heading + 1 paragraph + 1 CTA action button.
6. **Resources / Services:** Subsections with flat card lists inheriting destination page title & summary.
7. **About:** Short paragraph about the agency.
8. **Contact Information:** Address, Phone, Email, Hours, and Public Records link.

### Transaction Template Order
1. **Content Type Badge:** \`Transaction\`
2. **H1 Title:** Sentence-case action title (e.g. \`Report a health or safety hazard\`).
3. **Description:** Scope of the transaction.
4. **What to Know Before You Start:** Fee schedule / cost badge + eligibility prerequisites.
5. **What to Do:** Numbered sequential step blocks.
6. **Primary Call to Action:** Single action button (verb-first).
7. **Special Cases:** Exceptions, alternative filing routes.

### Information Template Order
1. **Content Type Badge:** \`Information\`
2. **H1 Title:** Sentence-case topic guide title (< 65 chars).
3. **Description:** Overview (< 110 chars).
4. **On This Page:** Jump-link table of contents (auto-generated from H2s).
5. **Hero Callout:** Light-blue alert/summary container for key deadlines or highlights.
6. **Body Content:** Structured \`Title and text\` blocks with H2 section headings.

---

## 2. Structural Typography & Layout Rules

* **Heading Ladder:** Strict single H1, H2 for major content zones, H3 for card titles and step headers.
* **Card Inheritance:** In Karl CMS, Agency Services & Resources subsection cards render the destination page's own title and summary dynamically.
* **Button Cardinality:** Digital Services recommends a maximum of one primary button per Transaction page to maintain clear resident conversion paths.
