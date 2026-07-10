# Copilot instructions for this repository

**The canonical, complete guide is [`AGENTS.md`](../AGENTS.md).** Read it first —
it covers architecture, the page-object schema, validation invariants,
local-persistence hazards, JS/CSS idioms, comment voice, test conventions, and
commit/PR preferences. This file is a short orientation that defers to it; if the
two ever disagree, `AGENTS.md` wins.

## What this is

A static, no-framework mockup tool for manager review of a redesigned HHVC
(Healthy Housing and Vector Control) section of SF.gov. There is no backend and no
build step for development — `index.html` loads plain classic `<script>` tags
directly (not ES modules). **Bun** powers the dev server, the CLI scripts, and the
test runner. This is **plain browser JavaScript, not TypeScript.**

## Commands

```bash
bun install          # install deps (required before first `dev`)
bun run dev           # dev server with --watch at http://127.0.0.1:8080
bun run start         # dev server without watch
bun run validate      # Zod-validate pages/*.js and js/page-data.js (schema + invariants)
bun run test          # Bun test runner over the 7 unit-test files in tests/
bun run test:e2e      # Playwright end-to-end tests
bun run export        # regenerate data/page_inventory.{json,csv} + local tracking sheet
bun run build         # validate -> export -> build:workshop-form -> single-file HTML
bun run format        # prettier --write on everything
bun run format:check  # prettier --check — this is the lint step (no ESLint/tsc)
```

**There is a real test suite.** `bun run test` runs seven Bun unit-test files
(`utils`, `data-validation`, `page-render`, `csv`, `review-state-schema`,
`reading-level`, `index-html-checks`) plus Playwright e2e. `bun run validate` is a
complementary check that Zod-validates the full `pages/*.js` set — you can't
validate one page in isolation. Run both after editing anything under `pages/` or
`js/page-data.js`.

## Architecture (essentials — full detail in `AGENTS.md`)

- **Data-driven, no framework.** Each `pages/*.js` file assigns onto
  `window.HHVC_PAGES['<pageKey>']`; `js/page-data.js` builds
  `window.HHVC_DATA = { pages, order }`. **Script load order in `index.html`
  matters** — classic `<script>` tags share one global lexical scope, and
  `js/state.js` throws if `HHVC_DATA` is missing.
- **Core is split into focused modules** (formerly one `app.js`): `js/utils.js`
  (shared helpers, loads first), `js/state.js`, `js/ui-controls.js`,
  `js/editor-panel.js`, `js/page-render.js` (holds `karlTag()`), `js/app.js`.
  Don't re-monolith them.
- **Review/UX layers are additive** self-contained IIFEs on top of the core
  (`js/ux-improvements.js`, `js/review-queue.js`, `js/dashboard-guidance.js`,
  `js/interactive-sitemap.js`, `js/keyboard-shortcuts.js`) that read `HHVC_DATA`
  and `localStorage`. They may edit the **in-memory** page data but must never
  write back to `pages/*.js` or publish content.
- **`karl` fields are first-class content**, not comments — placement/rationale
  notes mapping mockup content to Karl CMS StreamField blocks, surfaced via
  `karlTag()`. Keep them accurate when editing copy.
- **Local persistence** is browser-only under `localStorage` key
  `hhvcManagerReviewState:v1`. The CSV/JSON import path in `js/review-queue.js` has
  regressed before by overwriting instead of merging — manually verify any change
  to the import/export round-trip.

## Code style

Prettier is the only linter (`.prettierrc.json`): no semicolons, single quotes,
2-space indent, 100-char width, ES5 trailing commas. `camelCase` JS identifiers,
`UPPER_SNAKE_CASE` constants, `snake_case` data fields. Write detailed,
explanatory comments that justify the _why_. Run `bun run format` before
committing. See `AGENTS.md` for the full idiom and commit/PR conventions.

## Pull request scope

Keep dashboard-UX changes (layout, queue, workspace, review helpers) and
policy-copy changes (page text, `docs/source/` ingestion) in **separate PRs** when
possible.
