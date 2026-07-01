# HHVC Manager Review Mockup Tool — Topic Page Update

This package is the manager-review version of the current HHVC/SF.gov mockup tool.

## Primary change

**Pests and housing problems** is now a **Topic page**, not an Agency page section.

The Topic page opens first and uses four scannable clusters:

1. Report a problem
2. Prevent pests and housing health problems
3. Know what HHVC can inspect
4. Tenant rights and help

## UX/UI review improvements

The manager-review interface now includes:

- A live manager review dashboard above the page preview
- A Karl compliance scorecard for page type, title, summary, audience, CTA, related links, SEO, and reading target
- A dashboard guidance panel that consolidates instructional copy from the sidebar
- An interactive sitemap diagram with clickable page nodes, page-type filters, and selected-page details
- Fast page search by title, page type, summary, or page key
- Review status chips that update when the manager decision changes
- A copyable review summary for fast pasting into email, chat, tickets, or the master workbook
- Local browser persistence for review state using `localStorage`

These additions are review aids only. They do not publish content, change page source data, or replace legal/source review.

## Interactive sitemap

The interactive sitemap is rendered by `js/interactive-sitemap.js` and reads from the existing `HHVC_DATA` page registry.

The sitemap lets reviewers:

- Select a node to open that page mockup
- Filter the map by Topic, Transaction, or Information page type
- See selected-page details, including reading target, CTA, audience count, linked items, and URL slug
- Review how pages cluster around report/pay, prevention, inspection/rights, and information/education paths

This sitemap is a review aid only. It does not replace the source page inventory, live SF.gov IA, or publication approval.

## Dashboard guidance copy

Descriptive review instructions now live in the dashboard instead of being repeated throughout the sidebar.

The dashboard guidance panel explains:

- How to review page patterns
- How to test wording safely
- How to use Karl placement tags
- How review exports work
- Which reading targets apply by page type

The sidebar remains focused on controls and inputs. The guidance module hides duplicated sidebar helper copy at runtime without deleting the underlying HTML.

## Local review persistence

Review state is saved in the browser under this versioned key:

```text
hhvcManagerReviewState:v1
```

The tool saves:

- Last selected page
- Karl tag visibility preference
- Reviewer name
- Per-page review date, decision, notes, risks or blockers, and follow-up owner
- Per-page edited title, summary, CTA, SEO title, meta description, and URL slug

Use **Export saved local reviews CSV** to download all locally saved page decisions for Google Sheets, Make.com, or the master workbook.

Use **Clear local saved reviews** only when you want to reset the local browser cache. This does not change source files, GitHub, or exported CSV files.

## Open

Run `npm install` once to fetch `@sfgov/design-system` (used for base/typography/component CSS). Then open `index.html` in a browser. If browser security blocks local scripts, run:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

## File structure

```text
HHVC_manager_review_current_tool_package/
├─ package.json
├─ index.html
├─ css/styles.css
├─ css/ux-improvements.css
├─ js/page-data.js
├─ js/app.js
├─ js/ux-improvements.js
├─ js/dashboard-guidance.js
├─ js/interactive-sitemap.js
├─ pages/*.js
├─ data/page_inventory.json
├─ data/page_inventory.csv
├─ diagrams/hhvc-current-tool-sitemap.svg
└─ review/
   ├─ manager_review_packet.md
   ├─ manager_decision_log.csv
   └─ page_approval_checklist.csv
```

## Editing rules

- Edit public page content in `pages/*.js`.
- Edit render behavior in `js/app.js`.
- Edit UX review helpers in `js/ux-improvements.js`, `js/dashboard-guidance.js`, `js/interactive-sitemap.js`, and `css/ux-improvements.css`.
- Edit styles in `css/styles.css`.
- Use review exports for manager decisions only.
- Do not use review exports as automatic publication approval.

## Pages included

- Pests and housing problems — Topic page
- Report rats or mice — Transaction
- Report cockroaches — Transaction
- Report bed bugs — Transaction
- Bed bug rules and prevention — Information
- Report mosquitoes in your home or backyard — Transaction
- Report overgrown vegetation or garbage — Transaction
- Report mold from humidity or condensation — Transaction
- Learn what Healthy Housing and Vector Control can inspect — Information
- Integrated pest management for property managers — Information
- What happens after you report a housing or pest problem — Information
- Tenant rights when reporting housing conditions — Information
- Keep rats and mice out of your home — Information
- Prevent cockroaches — Information
- Prevent mosquitoes — Information

## Automation note

Best workflow: export manager-review CSV files into a watched Drive folder, then use Make.com to update only matching review rows in the master workbook by `page_key` or `url_slug`.

The new copyable review summary can also be used for lightweight manual triage in GitHub issues, Gmail, Teams, or the master workbook before CSV import is automated.

The saved local review CSV is the better automation handoff when reviewing multiple pages in one browser session, because it exports all saved local decisions in one file.
