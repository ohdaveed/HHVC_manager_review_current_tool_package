# HHVC Manager Review Mockup Tool — Current Review Package

This package is the manager-review version of the current HHVC/SF.gov mockup tool.

## Current state

The app currently contains **19 page mockups** in `window.HHVC_DATA.order` (consolidated from
the earlier 33/40-page set in PR #60):

- 1 Agency page
- 2 Resource Collection pages
- 8 Transaction pages
- 6 Information pages
- 1 Report page
- 1 Campaign page

The mockup is a review aid. It does not publish content, change SF.gov, replace source review, or replace legal/SME review.

## Primary page pattern

**Healthy Housing and Vector Control** is the top-level **Agency page** for the HHVC mockup set.
(Its page key is still `pestsTopic` — retained from the Topic-page era on purpose so validation
invariants, tests, and saved review state stay stable. `build_scripts/validate.js` requires
`pestsTopic` to exist and be first in `order`, and forbids a bare `agency` key.)

The Agency page routes users into scannable service groups:

1. Report a problem now
2. What we do
3. Report and pay
4. Get help and know your rights
5. For property owners and managers
6. Mosquito and vector programs
7. Learn about pests from trusted sources
8. About Healthy Housing and Vector Control

Retired page keys (from the consolidation) are mapped to their replacement pages in
`window.HHVC_DELETED_PAGE_ALIASES` in `js/page-data.js`, so old shared `?page=<key>` links
redirect instead of dead-ending.

## UX/UI review improvements

The manager-review interface uses a **mockup-first layout**:

- The page preview loads above the fold
- Review tools sit in a collapsible workspace below the preview
- A sticky review bar shows the current page title, decision chip, check count, queue progress, and navigation shortcuts
- A review queue tracks all 19 pages with filters, progress, and one-click navigation
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
- Queue progress (`X/19 touched`) — counts pages with any saved localStorage entry; decision chips show decided counts separately
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
- Filter the map by page type (Agency, Transaction, Information, and the other Karl types in use)
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

| #   | Page key            | Page title                                                  | Type                |
| --- | ------------------- | ----------------------------------------------------------- | ------------------- |
| 1   | `pestsTopic`        | Healthy Housing and Vector Control                          | Agency              |
| 2   | `rodentsReport`     | Report rats, mice, and other four-legged problems           | Transaction         |
| 3   | `filthReport`       | Report garbage, filth, and overgrown vegetation             | Transaction         |
| 4   | `insectsReport`     | Report cockroaches, mosquitoes, and other insects           | Transaction         |
| 5   | `recordsHub`        | Look up building records                                    | Resource Collection |
| 6   | `findRecords`       | Find complaints and inspection records                      | Transaction         |
| 7   | `findViolations`    | Look up residential health code violations                  | Transaction         |
| 8   | `findHotelRecords`  | Find residential hotel and shelter records                  | Transaction         |
| 9   | `publicRecords`     | Make a public records request                               | Transaction         |
| 10  | `ownerHub`          | Property owner responsibilities                             | Resource Collection |
| 11  | `noticeOfViolation` | How to respond to a notice of violation                     | Information         |
| 12  | `payFee`            | Pay your annual Healthy Housing fee for apartment buildings | Transaction         |
| 13  | `scopeInfo`         | Learn what Healthy Housing and Vector Control can inspect   | Information         |
| 14  | `article11Guide`    | Health Code Article 11 in plain language                    | Report              |
| 15  | `ownerGuidance`     | Integrated pest management for property owners and managers | Information         |
| 16  | `afterReport`       | What happens after you report a housing or pest problem     | Information         |
| 17  | `tenantRights`      | Tenant rights when reporting housing conditions             | Information         |
| 18  | `mosquitoControl`   | Mosquito Control Program                                    | Information         |
| 19  | `mosquitoWorkshop`  | Free mosquito education workshop                            | Campaign            |

## Known content review flags

These are the open SME/legal items carried on the live pages (as `editorStatus`, `editorNote`,
and `unverified` fields in `pages/*.js` — grep for them to see the full detail):

- `noticeOfViolation` is `editorStatus: 'blocked'` — NOV templates, appeal windows, contact
  routes, and free-visit sequencing still need SME/legal confirmation.
- `findHotelRecords` is `editorStatus: 'placeholder'` — the lookup CTA points at an interim
  sfdph.org URL until the real entry point is confirmed.
- `mosquitoWorkshop` is `editorStatus: 'placeholder'` — workshop capacity, lead time, and the
  request-form intake backend are illustrative; it carries `unverified` flags on those claims.
- `payFee` has no real payment URL yet — its primary CTA is an inert button until the client
  confirms the SF.gov payment destination.
- `ownerHub` links the FY25–26 fee schedule PDF; do not treat as final until the FY26–27
  public URL is confirmed.
- `ownerGuidance` should use “rodent-proof materials” as the enforceable concept. Examples may include steel wool backed by sealant, hardware cloth, copper mesh, sheet metal, mortar, concrete, or other durable materials.
- The dead-bird reporting flag (inherited from the retired `wnvBirdReport` page) now rides on
  the `insectsReport`/`mosquitoControl`/`mosquitoWorkshop` cluster: the HHVC/CDPH dead bird
  collection workflow, pickup criteria, and seasonal details are still unconfirmed.
- Legal/source review is required for pages that cite Article 11, fees, notices of violation, enforcement, pesticide notification, or inspection requirements.

## Automation note

Best workflow: export manager-review CSV files into a watched Drive folder, then use Make.com to update only matching review rows in the master workbook by `page_key` or `url_slug`.

The copyable review summary can also be used for lightweight manual triage in GitHub issues, Gmail, Teams, or the master workbook before CSV import is automated.

The saved local review CSV is the better automation handoff when reviewing multiple pages in one browser session, because it exports all saved local decisions in one file.
