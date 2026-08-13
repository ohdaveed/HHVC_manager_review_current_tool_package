# HHVC Manager Review Mockup Tool — Current Review Package

This package is the manager-review version of the current HHVC/SF.gov mockup tool.

## Current state

The app currently contains **29 page mockups** in `window.HHVC_DATA.order` (consolidated from
the earlier 33/40-page set in PR #60, then expanded again with gap-fill and new pages in later
PRs):

- 1 Agency page
- 1 Topic page
- 1 About us page
- 3 Resource Collection pages
- 14 Transaction pages
- 6 Information pages
- 1 Report page
- 2 Campaign pages

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
- Review tools sit in a workspace docked beside the preview, sticky to the viewport
- A sticky review bar shows the current page title, decision chip, queue progress, and navigation shortcuts
- A review queue tracks all 29 pages with filters, progress, and one-click navigation
- Workspace tabs hold the Overview, Page checks, and Help panels (shortcuts `1`–`3`)

Additional review aids:

- A Karl compliance scorecard for page type, title, summary, audience, CTA, related links, SEO, and reading target
- Dashboard guidance in the Help workspace tab
- Fast page search by title, page type, summary, or page key
- Review status chips that update when the manager decision changes
- A copyable review summary for fast pasting into email, chat, tickets, or the master workbook
- Local browser persistence for review state using `localStorage`

## Mockup-first layout and review queue

On load, the canvas shows:

1. A compact toolbar with the Karl-tag switch and the sticky review bar
2. The browser mockup preview
3. A workspace panel, docked as a third column, that toggles with **Show workspace**

The sticky bar includes:

- Decision chip and the current page title
- The active queue filter, when one is set
- Review progress (`X/29 reviewed`) — counts pages whose decision has moved off
  the default `Needs review`
- **Previous** / **Next** navigation, which follow the active filter
- **Show workspace** / **Hide workspace** toggle

The per-page checks ratio is not on the sticky bar; it is a column in the
review queue on the Overview tab.

The workspace tabs are:

| Tab         | Purpose                                                          |
| ----------- | ---------------------------------------------------------------- |
| Overview    | Insight cards, progress, filters, and the clickable review queue |
| Page checks | Scored rules for the open page, failures first, plus page facts  |
| Help        | Review guidance, the Karl tag legend, and advanced sections      |

Workspace UI preferences persist in `localStorage` under additive keys:

```js
state.ui = {
  workspace_open: false,
  workspace_tab: 'overview',
  last_page_key: '...',
  show_karl_tags: true,
}
```

Queue rows read saved decisions from `hhvcManagerReviewState:v1`. Unsaved pages show **Needs review**.

**Progress semantics:** The sticky bar and queue progress bar count **decided** pages — `stats.reviewed` in `js/review-queue-rows.js` filters on `utils.isDecided(row.decision)`, so a page whose decision is still **Needs review** does not count even when it carries saved notes. Saving a note is not a decision, and counting it as one would report the site as reviewed when nothing had been judged. The decision breakdown chips split the same set by decision. Sticky-bar prev/next respects the active queue filter when one is selected.

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

Use `PORT=3000 bun run dev` to change the port, or `HOST=0.0.0.0 bun run dev` to listen on all interfaces.

**A plain static server no longer works.** `python3 -m http.server`, `npx serve`
and friends used to be a valid way to open this tool, because `index.html`
loaded a list of classic `<script>` tags that a browser could fetch directly.
The app is now bundled by Vite from one ES-module entry point (`js/main.js`),
which imports packages by bare specifier (`import Fuse from 'fuse.js'`) and
imports CSS from JavaScript. No browser can resolve either without a bundler, so
serving the repository root raw leaves the page sitting on its "Loading…"
placeholder. Use `bun run dev` above, or build first and serve the output:

```bash
bun run build       # validate, export, bundle to dist/ and dist-singlefile/
bun run serve       # serve the built dist/ plus the optional sync API
```

`bun run start` does both in one step, assembling the same `dist/` bundle that
gets deployed. For a copy you can email around or open straight off disk with no
server at all, `bun run build:singlefile` writes a self-contained
`dist-singlefile/index.html` with every script and stylesheet inlined.

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
- Edit UX review helpers in `js/ux-improvements.js`, `js/review-queue.js`, `js/dashboard-guidance.js`, and `css/ux-improvements.css`.
- Edit styles in `css/styles.css` and theme tokens in `css/theme.css`.
- Use review exports for manager decisions only.
- Do not use review exports as automatic publication approval.

## Pull request scope

Keep **dashboard UX changes** (layout, queue, workspace tabs, review helpers) and **policy copy changes** (page text, source ingestion under `docs/source/`) in separate pull requests when possible. UX PRs should not bundle unrelated content rewrites, and policy PRs should not include layout refactors. This keeps review focused and avoids merge conflicts between parallel workstreams.

## Pages included

| #   | Page key            | Page title                                                  | Type                |
| --- | ------------------- | ----------------------------------------------------------- | ------------------- |
| 1   | `pestsTopic`        | Healthy Housing and Vector Control                          | Agency              |
| 2   | `healthyHousingTopic` | Healthy housing conditions                                | Topic               |
| 3   | `aboutHhvcTeam`     | Healthy Housing and Vector Control                          | About us            |
| 4   | `rodentsReport`     | Report rats, mice, and other four-legged problems           | Transaction         |
| 5   | `filthReport`       | Report garbage, filth, and overgrown vegetation             | Transaction         |
| 6   | `insectsReport`     | Report cockroaches, mosquitoes, and other insects           | Transaction         |
| 7   | `sroHotelReport`    | Report a problem in an SRO or hotel                         | Transaction         |
| 8   | `recordsHub`        | Look up building records                                    | Resource Collection |
| 9   | `findRecords`       | Find complaints and inspection records                      | Transaction         |
| 10  | `findViolations`    | Look up residential health code violations                  | Transaction         |
| 11  | `findHotelRecords`  | Find residential hotel and shelter records                  | Transaction         |
| 12  | `inspectorLookup`   | Find your Healthy Housing inspector by neighborhood         | Transaction         |
| 13  | `publicRecords`     | Make a public records request                               | Transaction         |
| 14  | `ownerHub`          | Property owner responsibilities                             | Resource Collection |
| 15  | `noticeOfViolation` | Fix your Healthy Housing and Vector Control violation       | Transaction         |
| 16  | `tenantNoticeSteps` | What tenants need to do after a Notice of Violation         | Transaction         |
| 17  | `inspectionPrepFollowup` | Get ready for a follow-up inspection                   | Transaction         |
| 18  | `payFee`            | Pay your annual Healthy Housing fee for apartment buildings | Transaction         |
| 19  | `scopeInfo`         | Learn what Healthy Housing and Vector Control can inspect   | Information         |
| 20  | `article11Compliance` | Article 11 compliance for property owners                 | Information         |
| 21  | `article11Guide`    | Health Code Article 11 in plain language                    | Report              |
| 22  | `ownerGuidance`     | Integrated pest management for property owners and managers | Information         |
| 23  | `verminResources`   | Healthy housing and pest resources                          | Resource Collection |
| 24  | `afterReport`       | What happens after you report a housing or pest problem     | Information         |
| 25  | `inspectionPrepInitial` | Get ready for a housing inspection after you report     | Transaction         |
| 26  | `tenantRights`      | Tenant rights when reporting housing conditions             | Information         |
| 27  | `mosquitoControl`   | Mosquito Control Program                                    | Information         |
| 28  | `mosquitoWorkshop`  | Free mosquito education workshop                            | Campaign            |
| 29  | `ipmEducation`      | Free IPM education workshop                                 | Campaign            |

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
