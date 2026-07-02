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

The manager-review interface uses a **mockup-first layout**:

- The page preview loads above the fold; review tools sit in a collapsible workspace below it
- A sticky review bar shows the current page title, decision chip, check count, queue progress, and navigation shortcuts
- A **review queue** tracks all 17 pages with filters, progress, and one-click navigation
- Workspace tabs hold the queue (default), checks/scorecard, interactive sitemap, and help guidance

Additional review aids:

- A **mockup-first layout** — the page preview stays above the fold; review tools live in a collapsible workspace below
- A **sticky review bar** with decision status, compliance checks, queue progress, and prev/next navigation
- A **review queue** showing all pages with filterable decision status and progress across the full inventory
- A tabbed review workspace (Queue, Checks, Sitemap, Help) collapsed by default
- A Karl compliance scorecard for page type, title, summary, audience, CTA, related links, SEO, and reading target
- Dashboard guidance in the Help workspace tab
- An interactive sitemap diagram (lazy-loaded when the Sitemap tab is opened)
- Fast page search by title, page type, summary, or page key
- Review status chips that update when the manager decision changes
- A copyable review summary for fast pasting into email, chat, tickets, or the master workbook
- Local browser persistence for review state using `localStorage`

These additions are review aids only. They do not publish content, change page source data, or replace legal/source review.

## Mockup-first layout and review queue

On load, the canvas shows:

1. A compact toolbar with the current page badge and sticky review bar
2. The browser mockup preview
3. A collapsed workspace panel (open with **Show workspace**)

The sticky bar includes:

- Current page title, decision chip, and `X/9` checks chip
- Queue progress (`X/17 reviewed`)
- **Previous**, **Next**, and **Next needs review** navigation
- **Show workspace** / **Hide workspace** toggle

The workspace tabs are:

| Tab | Purpose |
| --- | --- |
| Queue | Progress bar, decision breakdown, filters, and clickable page list |
| Checks | Metrics grid and Karl compliance scorecard |
| Sitemap | Interactive HHVC sitemap (lazy-rendered when the tab opens) |
| Help | Review guidance cards |

Workspace UI preferences persist in `localStorage` under additive keys:

```js
state.ui = {
  workspace_open: false,
  workspace_tab: 'queue',
  last_page_key: '...',
  show_karl_tags: true,
}
```

Queue rows read saved decisions from `hhvcManagerReviewState:v1`. Unsaved pages show **Needs review**. Sticky-bar prev/next respects the active queue filter when one is selected.

## Interactive sitemap

The interactive sitemap is rendered by `js/interactive-sitemap.js` and reads from the existing `HHVC_DATA` page registry.

The sitemap lets reviewers:

- Select a node to open that page mockup
- Filter the map by Topic, Transaction, or Information page type
- See selected-page details, including reading target, CTA, audience count, linked items, and URL slug
- Review how pages cluster around report/pay, prevention, inspection/rights, and information/education paths

This sitemap is a review aid only. It does not replace the source page inventory, live SF.gov IA, or publication approval.

## Dashboard guidance copy

Descriptive review instructions live in the **Help** tab of the review workspace (below the mockup preview) instead of being repeated throughout the sidebar.

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
- Review workspace open/closed state and active tab
- Reviewer name
- Per-page review date, decision, notes, risks or blockers, and follow-up owner
- Per-page edited title, summary, CTA, SEO title, meta description, and URL slug

Use **Export saved local reviews CSV** to download all locally saved page decisions for Google Sheets, Make.com, or the master workbook.

Use **Clear local saved reviews** only when you want to reset the local browser cache. This does not change source files, GitHub, or exported CSV files.

## Project tooling

This project uses Bun for development and scripting.

### Setup

```bash
bun install
```

### Available scripts

```bash
# Start the Bun dev server
bun run dev

# Validate page data structure with Zod
bun run validate

# Export JSON and CSV page inventory
bun run export

# Run validation, export, and regenerate single-file HTML in one step
bun run build

# Check code formatting
bun run format:check

# Auto-format source files with Prettier
bun run format
```

The `validate` script checks the `pages/*.js` and `js/page-data.js` data model, ensuring page objects have required fields and valid card, step, section, and page shapes before exports run.

The `export` script regenerates `data/page_inventory.json` and `data/page_inventory.csv` from the source page data.

The `build` script runs validation and export, then rebuilds the self-contained HTML exports.

## Code style

This repo uses Prettier with the following conventions:

- No semicolons
- Single quotes
- 2-space indentation
- 100-character print width
- Trailing commas where valid in ES5

## Open

Then open:

```text
http://127.0.0.1:8080/
```

Or use the static server of your choice:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

Use `PORT=3000 bun run dev` to change the port, or `HOST=0.0.0.0 bun run dev` to listen on all interfaces.

## File structure

```text
HHVC_manager_review_current_tool_package/
├─ package.json
├─ bun.lock
├─ index.html
├─ server.ts
├─ .prettierrc.json
├─ .prettierignore
├─ css/styles.css
├─ css/ux-improvements.css
├─ js/page-data.js
├─ js/app.js
├─ js/ux-improvements.js
├─ js/review-queue.js
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
- Edit UX review helpers in `js/ux-improvements.js`, `js/review-queue.js`, `js/dashboard-guidance.js`, `js/interactive-sitemap.js`, and `css/ux-improvements.css`.
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
- Report pigeons — Transaction
- Report garbage or clutter — Transaction
- Report overgrown vegetation — Transaction
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
