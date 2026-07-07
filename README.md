# HHVC Manager Review Mockup Tool — Current Review Package

This package is the manager-review version of the current HHVC/SF.gov mockup tool.

## Current state

The app currently contains **46 page mockups** in `window.HHVC_DATA.order` (canonical registry: `js/page-data.js`):

- 1 Topic page
- 8 Resource collection pages (4 review hubs + 4 document libraries)
- 14 Transaction pages
- 17 Information pages
- 4 Step-by-step pages
- 1 Campaign page
- 1 Report page

**Canonical HHVC contact (Transaction + Information footers):** Environmental Health `415-252-3800`, `healthyhousing@sf.gov` (`js/hhvc-page-defaults.js`). Mosquito program pages use `415-252-3806` and `mosquito@sf.gov` instead.

The mockup is a review aid. It does not publish content, change SF.gov, replace source review, or replace legal/SME review.

## Primary page pattern

**Pests and housing problems** is the top-level **Topic page** for the HHVC mockup set.

The Topic page routes users into scannable groups:

1. Report a problem
2. Prevent pests and housing health problems
3. Wildlife and other vector concerns
4. Know what HHVC can inspect
5. Property owner responsibilities
6. Tenant rights and help

## UX/UI review improvements

The manager-review interface uses a **mockup-first layout**:

- The page preview loads above the fold
- Review tools sit in a collapsible workspace below the preview
- A sticky review bar shows the current page title, decision chip, check count, queue progress, and navigation shortcuts
- A review queue tracks all 46 pages with filters, progress, and one-click navigation
- Workspace tabs hold the Queue, Checks, Sitemap, and Help panels

Additional review aids:

- A Karl compliance scorecard for page type, title, summary, audience, CTA, related links, SEO, and reading target
- Dashboard guidance in the Help workspace tab
- An interactive sitemap diagram that lazy-loads when the Sitemap tab opens
- Fast page search by title, page type, summary, or page key
- Review status chips that update when the manager decision changes
- A copyable review summary for fast pasting into email, chat, tickets, or the master workbook
- Local browser persistence for review state using `localStorage`

## Mockup-first layout and review queue

On load, the canvas shows:

1. A compact toolbar with the current page badge and sticky review bar
2. The browser mockup preview
3. A collapsed workspace panel that opens with **Show workspace**

The sticky bar includes:

- Current page title, decision chip, and `X/9` checks chip
- Queue progress (`X/46 touched`) — counts pages with any saved localStorage entry; decision chips show decided counts separately
- **Previous**, **Next**, and **Next needs review** navigation
- **Show workspace** / **Hide workspace** toggle

The workspace tabs are:

| Tab     | Purpose                                                            |
| ------- | ------------------------------------------------------------------ |
| Queue   | Progress bar, decision breakdown, filters, and clickable page list |
| Checks  | Metrics grid and Karl compliance scorecard                         |
| Sitemap | Interactive HHVC sitemap with filtering and linked-page details    |
| Help    | Review guidance cards                                              |

Workspace UI preferences persist in `localStorage` under additive keys:

```js
state.ui = {
  workspace_open: false,
  workspace_tab: 'queue',
  last_page_key: '...',
  show_karl_tags: true,
}
```

Queue rows read saved decisions from `hhvcManagerReviewState:v1`. Unsaved pages show **Needs review**.

**Progress semantics:** The sticky bar and queue progress bar count **touched** pages — any page with a saved entry in `localStorage`, even if the decision is still **Needs review** (for example, after saving notes without changing the decision). The decision breakdown chips count **decided** pages where the saved decision is not **Needs review**. Sticky-bar prev/next respects the active queue filter when one is selected.

## Interactive sitemap

The interactive sitemap is rendered by `js/interactive-sitemap.js` and reads from the existing `HHVC_DATA` page registry.

The sitemap lets reviewers:

- Select a node to open that page mockup
- Filter the map by Topic, Transaction, or Information page type
- Search page title, key, summary, or slug
- See selected-page details, including reading target, CTA, audience count, linked items, and URL slug
- Review link connectivity and how pages cluster around report/pay, prevention, inspection/rights, records, and vector information paths

This sitemap is a review aid only. It does not replace the source page inventory, live SF.gov IA, or publication approval.

## Dashboard guidance copy

Descriptive review instructions live in the **Help** tab of the review workspace below the mockup preview instead of being repeated throughout the sidebar.

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

# Start the TypeScript server directly
bun run start

# Validate page data structure with Zod
bun run validate

# Export JSON and CSV page inventory
bun run export

# Run validation, export, form build, and single-file HTML rebuild
bun run build

# Build the Netlify distribution
bun run build:netlify

# Check code formatting
bun run format:check

# Auto-format source files with Prettier
bun run format
```

The `validate` script checks the `pages/*.js` and `js/page-data.js` data model, ensuring page objects have required fields and valid card, step, section, and page shapes before exports run.

The `export` script regenerates `data/page_inventory.json` and `data/page_inventory.csv` from the source page data, then refreshes Google Sheets–ready tracking CSVs under `review/`.

The `sync-tracking` script regenerates tracking files only:

- `review/mockup_tracking_sheet.csv` — import or sync to your Google tracking sheet by `page_key`
- `review/manager_decision_log.csv` — all-page manager decision template
- `review/page_approval_checklist.csv` — per-page approval checklist rows

Run `bun run sync-tracking` (or `bun run export`) after editing any file under `pages/` so mockup change status, last-changed dates, and policy audit summaries stay current.

Push merged status into the HHVC Master Control workbook:

- **Editable:** [HHVC_SFgov_Master_Control_v1_Clean](https://docs.google.com/spreadsheets/d/1Y480ZykxlmlGv6RECHN37N4F1oQsPwzJWQLCj7uTemk/edit)
- **Published (read-only):** [pubhtml view](https://docs.google.com/spreadsheets/d/e/2PACX-1vS3s9MdupOwodS2lNYG7yA71BYQs42Rs-uPHs_2-sPyIvIyaYjG699tNDhGefYE4W2AbD5h9EQ8TABv/pubhtml)

```bash
bun run push-tracking
```

This reads the live **004 Page Inventory & IA** tab (via the published CSV export when available), merges `review/mockup_tracking_sheet.csv`, and writes `review/page_inventory_sheet_update.csv`. Import that file into the **editable** workbook to refresh the published view. If `GOOGLE_SERVICE_ACCOUNT_JSON` is set and the editable sheet is shared with that service account, updates push automatically.

Import the tracking CSV into Google Sheets, or point a Make.com scenario at a watched Drive folder to update rows by `page_key` or `url_slug`.

The `build` script runs validation, export, the mosquito workshop form build, and the self-contained HTML rebuild.

## Code style

This repo uses Prettier with the following conventions:

- No semicolons
- Single quotes
- 2-space indentation
- 100-character print width
- Trailing commas where valid in ES5

## Open

Start the dev server:

```bash
bun run dev
```

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
├─ css/theme.css
├─ css/styles.css
├─ css/ux-improvements.css
├─ js/page-data.js
├─ js/app.js
├─ js/state.js
├─ js/utils.js
├─ js/ux-improvements.js
├─ js/review-queue.js
├─ js/dashboard-guidance.js
├─ js/interactive-sitemap.js
├─ pages/*.js
├─ data/page_inventory.json
├─ data/page_inventory.csv
├─ diagrams/hhvc-current-tool-sitemap.svg
├─ forms/mosquito-workshop-request/
└─ review/
   ├─ manager_review_packet.md
   ├─ mockup_tracking_sheet.csv
   ├─ page_inventory_sheet_update.csv
   ├─ manager_decision_log.csv
   └─ page_approval_checklist.csv
```

## Editing rules

- Edit public page content in `pages/*.js`.
- Edit render behavior in `js/app.js`.
- Edit shared local-state behavior in `js/state.js`.
- Edit shared helpers in `js/utils.js`.
- Edit UX review helpers in `js/ux-improvements.js`, `js/review-queue.js`, `js/dashboard-guidance.js`, `js/interactive-sitemap.js`, and `css/ux-improvements.css`.
- Edit styles in `css/styles.css` and theme tokens in `css/theme.css`.
- Use review exports for manager decisions only.
- Do not use review exports as automatic publication approval.

## Pull request scope

Keep **dashboard UX changes** (layout, queue, workspace tabs, review helpers) and **policy copy changes** (page text, source ingestion under `docs/source/`) in separate pull requests when possible. UX PRs should not bundle unrelated content rewrites, and policy PRs should not include layout refactors. This keeps review focused and avoids merge conflicts between parallel workstreams.

## Pages included

| #   | Page key                | Page title                                                  | Type                |
| --- | ----------------------- | ----------------------------------------------------------- | ------------------- |
| 1   | `pestsTopic`            | Pests and housing problems                                  | Topic page          |
| 2   | `reportHub`             | Report a problem                                            | Resource collection |
| 3   | `preventHub`            | Prevent problems                                            | Resource collection |
| 4   | `recordsHub`            | Look up building records                                    | Resource collection |
| 5   | `findRecords`           | Find complaints and inspection records                      | Transaction         |
| 6   | `findViolations`        | Look up residential health code violations                  | Transaction         |
| 7   | `findHotelRecords`      | Find residential hotel and shelter records                  | Transaction         |
| 8   | `findInspector`         | Find your district inspector                                | Information         |
| 9   | `publicRecords`         | Make a public records request                               | Transaction         |
| 10  | `ownerHub`              | Property owner responsibilities                             | Resource collection |
| 11  | `feeSchedule`           | Healthy Housing fee schedule FY27                           | Resource collection |
| 12  | `feeReport`             | Healthy Housing fee schedule FY27                           | Report              |
| 13  | `ownerForms`            | Owner forms and IPM templates                               | Resource collection |
| 14  | `vectorRules`           | Director’s Rules for Vector Control                         | Resource collection |
| 15  | `noticeOfViolation`     | Respond to a notice of violation                            | Step-by-step        |
| 16  | `ratsReport`            | Report rats or mice                                         | Transaction         |
| 17  | `cockroachesReport`     | Report cockroaches                                          | Transaction         |
| 18  | `bedBugsReport`         | Report bed bugs                                             | Transaction         |
| 19  | `bedBugsInfo`           | Bed bug rules and prevention                                | Information         |
| 20  | `bedBugForms`           | Bed bug forms and guides                                    | Resource collection |
| 21  | `mosquitoesReport`      | Report mosquitoes in your home or backyard                  | Transaction         |
| 22  | `wnvBirdReport`         | Report a dead bird                                          | Transaction         |
| 23  | `pigeonsReport`         | Report pigeons                                              | Transaction         |
| 24  | `garbageReport`         | Report garbage or clutter                                   | Transaction         |
| 25  | `vegetationReport`      | Report overgrown vegetation                                 | Transaction         |
| 26  | `moldReport`            | Report mold from humidity or condensation                   | Transaction         |
| 27  | `payFee`                | Pay your annual Healthy Housing fee for apartment buildings | Transaction         |
| 28  | `scopeInfo`             | Learn what Healthy Housing and Vector Control can inspect   | Information         |
| 29  | `ownerGuidance`         | Integrated pest management for property owners and managers | Information         |
| 30  | `afterReport`           | What happens after you report a housing or pest problem     | Step-by-step        |
| 31  | `tenantRights`          | Tenant rights when reporting housing conditions             | Information         |
| 32  | `ratsPrevent`           | Keep rats and mice out of your home                         | Information         |
| 33  | `cockroachesPrevent`    | Prevent cockroaches                                         | Information         |
| 34  | `mosquitoesPrevent`     | Prevent mosquitoes                                          | Information         |
| 35  | `vegetationInfo`        | Prevent overgrown vegetation                                | Information         |
| 36  | `garbageInfo`           | Prevent garbage and clutter problems                        | Information         |
| 37  | `mosquitoControl`       | Mosquito Control Program                                    | Information         |
| 38  | `mosquitoWorkshop`      | Free mosquito education workshop                            | Campaign            |
| 39  | `raccoonInfo`           | Raccoons and housing health                                 | Information         |
| 40  | `raccoonLatrineCleanup` | Clean up a raccoon latrine safely                           | Step-by-step        |
| 41  | `pigeonInfo`            | Pigeons and housing health                                  | Information         |
| 42  | `miteInfo`              | Mites and housing health                                    | Information         |
| 43  | `miteTreatmentSteps`    | Treat mite sources before rodenticides                      | Step-by-step        |
| 44  | `waspInfo`              | Ground wasps and housing health                             | Information         |
| 45  | `flyInfo`               | Flies and housing health                                    | Information         |
| 46  | `reduceMoisture`        | Reduce indoor moisture, condensation, and humidity          | Information         |

Regenerate this table after page additions: `node build_scripts/print-page-inventory-table.js`

## Known content review flags

- `wnvBirdReport` must remain SME-blocked until HHVC/CDPH dead bird collection workflow, local pickup criteria, and seasonal operating details are confirmed.
- `ownerGuidance` should use “rodent-proof materials” as the enforceable concept. Examples may include steel wool backed by sealant, hardware cloth, copper mesh, sheet metal, mortar, concrete, or other durable materials.
- Legal/source review is required for pages that cite Article 11, fees, notices of violation, enforcement, pesticide notification, or inspection requirements.

## Automation note

Best workflow: export manager-review CSV files into a watched Drive folder, then use Make.com to update only matching review rows in the master workbook by `page_key` or `url_slug`.

The copyable review summary can also be used for lightweight manual triage in GitHub issues, Gmail, Teams, or the master workbook before CSV import is automated.

The saved local review CSV is the better automation handoff when reviewing multiple pages in one browser session, because it exports all saved local decisions in one file.
