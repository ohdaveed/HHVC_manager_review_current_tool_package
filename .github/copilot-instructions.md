# Copilot instructions for this repository

## What this is

A static, no-framework mockup tool for reviewing a redesigned HHVC (Healthy
Housing and Vector Control) section of SF.gov. There is no build step for
development — `index.html` loads plain `<script>` tags directly. Bun is used
only for the dev server and the CLI scripts (validate/export/build).

## Commands

```bash
bun install          # install deps
bun run dev           # start dev server with --watch (http://127.0.0.1:8080)
bun run start          # start dev server without watch
bun run validate       # Zod-validate pages/*.js and js/page-data.js shapes
bun run export         # regenerate data/page_inventory.json and .csv from page data
bun run sync-tracking  # regenerate review/*.csv tracking sheets for Google Sheets import
bun run push-tracking  # merge tracking into Master Control workbook format / API push
bun run build          # validate -> export -> regenerate single-file HTML exports
bun run format         # prettier --write on **/*.{js,ts,json,md,css,html}
bun run format:check   # prettier --check (no test suite exists in this repo)
```

There are no unit tests. `bun run validate` (`build_scripts/validate.js`) is
the closest thing to a test: it loads every file in `pages/*.js` plus
`js/page-data.js` into a Node VM context and enforces required fields/shapes
with Zod, so bad page data fails fast. Run it after editing anything under
`pages/` or `js/page-data.js`. There's no way to validate a single page file
in isolation — the script always validates the full list.

`HOST=0.0.0.0 bun run dev` / `PORT=3000 bun run dev` override the dev server bind.

## Architecture

- **Data-driven rendering, no framework.** Each file in `pages/*.js` assigns
  a page object onto the global `window.HHVC_PAGES['<pageKey>']`. `js/page-data.js`
  then builds `window.HHVC_DATA = { pages, order }`, where `order` is the
  array of `[pageKey, menuLabel]` pairs that drives navigation/menu order.
  `js/app.js` reads `window.HHVC_DATA` and throws immediately if it's missing
  — this means **script load order in `index.html` matters**: all `pages/*.js`
  files must load before `js/page-data.js`, which must load before `js/app.js`.
- **Script load order in `index.html`:** `js/utils.js` → `pages/*.js` (each
  page) → `js/page-data.js` → `js/app.js` → `js/ux-improvements.js` →
  `js/review-queue.js` → `js/dashboard-guidance.js` → `js/interactive-sitemap.js`.
  When adding a new page file, add its `<script>` tag in this same block, before `page-data.js`.
- **Page object shape** (see `build_scripts/validate.js` for the enforced
  Zod schema): `slug`, `type` (`Topic` | `Transaction` | `Information` |
  `Resource Collection`),
  `title`, `summary`, `audience[]`, `reading` (a grade-level string), and
  `sections[]`. Sections contain `cards[]` and/or `steps[]`; steps can have
  `bullets`, `callout`, and `button` (the primary CTA). Optional review/SEO
  fields include `seoTitle`, `metaDescription`, `primaryCta`.
- **`karl` fields are first-class content**, not comments — every card,
  step, section, and callout can carry a `karl` string that's a placement/rationale
  note surfaced to reviewers via `karlTag()` in `js/app.js`. Keep or update
  these when editing page copy so the manager-review UI stays accurate.
- **Shared helpers live in `js/utils.js`** (`escapeHtml`, `getPrimaryCta`,
  `setPrimaryCta`, `today`, `csvEscape`, `toCsv`, `downloadFile`, `debounce`,
  `throttle`), exposed as `window.utils` and as top-level function
  declarations. `js/utils.js` always loads first, so modules use these
  directly (bare calls or destructuring from `window.utils`) — add new shared
  utilities there rather than duplicating logic inline.
- **Review/UX layers are additive and separate from core rendering:**
  `js/ux-improvements.js` (sticky bar, workspace tabs, Karl scorecard, review
  controls), `js/review-queue.js` (cross-page review queue and progress),
  `js/dashboard-guidance.js` (consolidates sidebar helper copy into the Help
  workspace tab, hides duplicated sidebar text at runtime without deleting HTML)
  and `js/interactive-sitemap.js` (clickable sitemap reading from
  `HHVC_DATA`, lazy-loaded when the Sitemap tab opens) all layer on top of
  `js/app.js` and must not mutate page source data — they are review aids only.
  Queue progress counts **touched** pages (any saved `localStorage` entry per
  page); decision chips count **decided** pages (saved decision other than
  **Needs review**).
- **Local persistence:** all reviewer state (decisions, notes, edited SEO
  fields, etc.) is saved client-side to `localStorage` under the versioned
  key `hhvcManagerReviewState:v1`. Bump the version suffix if the persisted
  shape changes incompatibly.
- **Single-file exports:** `build_scripts/build-single-file.js` inlines
  `index.html`'s local stylesheets and scripts (in document order) into
  `manager-review-single-file.html` and `single-file-export-current-source.html`.
  Never hand-edit those two generated HTML files — edit the source files and
  re-run `bun run build`.
- **`data/page_inventory.{json,csv}`** are generated output from
  `build_scripts/extract-pages.js` — do not hand-edit; regenerate with
  `bun run export`.

## Editing rules (from README)

- Edit public page content in `pages/*.js`.
- Edit render behavior in `js/app.js`.
- Edit UX review helpers in `js/ux-improvements.js`, `js/review-queue.js`, `js/dashboard-guidance.js`,
  `js/interactive-sitemap.js`, and `css/ux-improvements.css`.
- Edit styles in `css/styles.css`.
- Review exports (`review/*.csv`, saved local-review CSV) are for manager
  decisions only — never treat them as automatic publication approval.

## Pull request scope

Keep dashboard UX changes (layout, queue, workspace, review helpers) and policy
copy changes (page text, `docs/source/` ingestion) in separate PRs when
possible. This reduces merge conflicts and keeps review focused.

## Code style

Enforced by Prettier (`.prettierrc.json`): no semicolons, single quotes,
2-space indentation, 100-character print width, ES5 trailing commas. Run
`bun run format` before committing; `.prettierignore` excludes `data/`,
`server.ts`, and the generated single-file HTML exports from formatting.
