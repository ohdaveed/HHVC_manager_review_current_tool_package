# Codebase Structure

## Core Sections (Required)

### 1) Top-Level Map

| Path                               | Purpose                                                                        | Evidence                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `index.html`                       | Single HTML shell; one module script → `/js/main.js`                           | `index.html`, `AGENTS.md`                                       |
| `js/`                              | Core app + review/UX layers (ES modules)                                       | `js/main.js`                                                    |
| `pages/`                           | Page objects registered on `window.HHVC_PAGES` (20 `.js` files)                | `pages/*.js`, `js/core/page-data.js`                            |
| `css/`                             | Hand-authored stylesheets imported by `js/main.js`                             | `js/main.js`                                                    |
| `build_scripts/`                   | Validate, export, schema, AI providers, sheet sync                             | `package.json` scripts                                          |
| `tests/`                           | Bun unit tests + `tests/e2e/` Playwright                                       | `package.json`, `playwright.config.js`                          |
| `forms/mosquito-workshop-request/` | Independent Vite sub-app; committed `dist/` copied into root `dist/`           | `forms/.../package.json`, `build_scripts/copy-workshop-form.js` |
| `server.ts`                        | Serves `dist/` + optional review-sync and AI APIs                              | `server.ts`                                                     |
| `review/`                          | Manager-review reference outputs (CSV/MD), not browser localStorage            | `README.md`, `AGENTS.md`                                        |
| `docs/`                            | Policy sources, design specs, agent guides; this folder under `docs/codebase/` | tree                                                            |
| `data/`                            | Generated inventory (gitignored); created by `bun run export`                  | `.gitignore`, `AGENTS.md`                                       |
| `archive/pages/`                   | Retired page modules kept for reference                                        | `archive/pages/README.md`                                       |
| `AGENTS.md`                        | Canonical tool-agnostic contributor guide                                      | `AGENTS.md`                                                     |
| `.github/workflows/`               | CI (`checks` + `e2e` jobs)                                                     | `ci.yml`                                                        |

### 2) Entry Points

- Main browser entry: `js/main.js` (loaded from `index.html` as `type="module"`)
- Production/static server entry: `server.ts` (`bun run serve` / `bun run start`)
- Dev UI: Vite via `bun run dev` (`start-dev.sh`); optional API: `bun run dev:api`
- CLI jobs: `build_scripts/validate.js`, `extract-pages.js`, `sync-tracking-sheet.js`, `push-tracking-sheet.js`, AI under `build_scripts/ai/`
- Workshop form entry: `forms/mosquito-workshop-request/` (own Vite build)
- How entry is selected: `package.json` scripts; Netlify uses `bun run build:netlify` → publish `dist`

### 3) Module Boundaries

| Boundary                                               | What belongs here                                              | What must not be here                          |
| ------------------------------------------------------ | -------------------------------------------------------------- | ---------------------------------------------- |
| `pages/*.js`                                           | Page content objects (copy, sections, karl notes)              | Review UI logic; publishing/CMS writes         |
| `js/` core (`utils`, `state`, `page-render`, `app`, …) | Render, in-memory state, editor panel                          | Optional API secrets; SQLite                   |
| `js/` review/UX IIFEs                                  | localStorage review aids, queue, insights, AI panel UI         | Writing back into `pages/*.js` source          |
| `js/review/review-merge.js`                            | Shared merge + history construction (browser + server)         | DOM assumptions                                |
| `build_scripts/`                                       | Node/Bun validation, export, AI providers                      | Browser-only `window` APIs without dual-export |
| `server.ts`                                            | Static file serve + gated `/api/review-state*` and `/api/ai/*` | Page content authorship                        |
| `forms/...`                                            | Isolated workshop request form                                 | Main app review state                          |

### 4) Naming and Organization Rules

- File naming pattern: lowercase; single-word core modules (`app.js`, `utils.js`); hyphenated multi-word (`review-queue-state.js`, `page-render.js`) — never camelCase filenames (`AGENTS.md`)
- Directory organization: layer-ish split (pages / js / css / build_scripts / tests) plus one nested Vite app under `forms/`
- Import aliasing: none observed; relative imports with `.js` extension (`import { escapeHtml } from './utils.js'`)

### 5) Evidence

- `js/main.js`
- `js/core/page-data.js`
- `package.json`
- `index.html`
- `docs/codebase/.codebase-scan.txt`
- `AGENTS.md`
