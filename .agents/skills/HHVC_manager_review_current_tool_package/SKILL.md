---
name: HHVC_manager_review_current_tool_package
description: Development patterns and conventions for the HHVC manager-review mockup tool. Use when writing or editing code in this repo — page data, render/state modules, review/UX layers, tests, or styles. The full canon lives in AGENTS.md at the repo root.
---

# HHVC_manager_review_current_tool_package — Development Patterns

> The complete, authoritative guide is **`AGENTS.md`** at the repo root. Read it
> for architecture, the page-object schema, validation invariants, build outputs,
> and commit/PR conventions. This skill is a quick-reference summary. If anything
> here disagrees with `AGENTS.md`, `AGENTS.md` wins.

## What this repo is

A static, **no-framework** mockup tool for manager review of a redesigned HHVC
section of SF.gov. `index.html` loads plain classic `<script>` tags directly —
**this is plain browser JavaScript, not TypeScript**; there is no bundler and no
ES modules/`import`/`export` in `js/*.js`. **Bun** runs the dev server, CLI
scripts, and tests.

## Coding conventions

- **Formatting (CI gate):** Prettier only (`.prettierrc.json`) — no semicolons,
  single quotes, 2-space indent, 100-char width, ES5 trailing commas. Code must be
  ASI-safe. Run `bun run format` before committing.
- **File naming:** existing files are `kebab-case.js` (e.g. `review-queue-state.js`,
  `page-render.js`) — follow the sibling files in whatever directory you're in.
- **No imports/exports.** Modules are either (1) bare top-level `const`/`function`
  sharing one global lexical scope via ordered `<script>` tags, or (2) **named
  IIFEs with a leading semicolon** — `;(function mountX(){…})()` — exposing an API
  on `window.<Namespace>` via the idempotent `window.X = window.X || {}` idiom.
- **Naming:** `camelCase` JS identifiers, `UPPER_SNAKE_CASE` module constants,
  `snake_case` serialized/CSV data fields.
- **Defensive by default:** `escapeHtml` everything reaching `innerHTML`; optional
  chaining + `?? ''`; guard-clause early returns; reuse `js/utils.js` helpers.
- **Comments:** write detailed, explanatory comments that justify the _why_ and
  note load-order dependencies — not terse restatements of code.

## Testing

- Framework is **Bun test**: `const { describe, test, expect } = require('bun:test')`.
  Tests live in `tests/*.test.js`; a `tests/helpers/load-scripts.js` harness
  evaluates the classic `<script>` files. Playwright e2e lives in `tests/e2e/`.
- Name `describe` after the unit; write `test` names as behavioral verb sentences.
  Prefer exact-string assertions; use `test.todo` (with a comment) for known bugs.
- Run `bun run test` and `bun run validate` after editing `pages/*.js` or
  `js/page-data.js`.

## Key workflows

- **Edit page content** in `pages/*.js` (one `window.HHVC_PAGES['key'] = {…}`
  assignment). Keep `karl` annotation fields accurate — they're first-class
  content, not comments. When adding a page, also add its `<script>` tag to
  `index.html` and an `order` entry in `js/page-data.js`.
- **Never hand-edit generated files** (single-file HTML exports,
  `data/page_inventory.*`) — edit sources and re-run `bun run build`.
- **Keep dashboard-UX and policy-copy changes in separate PRs.**

## Commands

| Command                | Purpose                                                |
| ---------------------- | ------------------------------------------------------ |
| `bun run dev`          | Dev server with watch at http://127.0.0.1:8080         |
| `bun run validate`     | Zod-validate all `pages/*.js` (schema + invariants)    |
| `bun run test`         | Bun unit-test suite (7 files)                          |
| `bun run test:e2e`     | Playwright end-to-end tests                            |
| `bun run format:check` | Prettier check — the lint step                         |
| `bun run build`        | validate → export → workshop-form → single-file export |
