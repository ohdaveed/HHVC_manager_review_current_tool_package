# Architecture

## Core Sections (Required)

### 1) Architectural Style

- Primary style: Data-driven static SPA with additive review layers and an optional Bun API sidecar. The mockup (`#mockPage`) has no UI framework — string templates only, so it mirrors the SF.gov page under review — while the review workspace (`#reviewWorkspace`) mounts React 19 + MUI islands from `js/react/`
- Why this classification: Page data modules populate globals; string-template rendering fills `#mockPage`; review features are self-mounting IIFEs over `localStorage`; `server.ts` is optional and fails closed when unconfigured
- Primary constraints:
  1. Must work fully offline for mockup review without any backend
  2. Review aids must never write to `pages/*.js` or publish to SF.gov/Karl
  3. Shared merge logic (`mergeReviewRecord`) is the only history constructor for sync/import/queue paths

### 2) System Flow

```text
index.html -> js/main.js (CSS + modules)
  -> pages/*.js register window.HHVC_PAGES
  -> js/core/page-data.js builds window.HHVC_DATA
  -> js/mockup/page-render.js + js/core/app.js render mockup
  -> review IIFEs read/write localStorage (hhvcManagerReviewState:v1)
  -> optional: fetch /api/review-state* or /api/ai/* on server.ts (Bearer token)
  -> Railway runs server.ts: serves dist/ plus the optional /api/* routes
```

1. Vite bundles `js/main.js` and CSS into `dist/` (or single-file HTML).
2. Each `pages/*.js` assigns a page object onto `window.HHVC_PAGES`; `js/core/page-data.js` sets `order` (29 entries) and deleted-key aliases.
3. Core modules render the mockup and wire editor/sidebar controls from in-memory `pageData`.
4. Review layers persist decisions/notes/edits in versioned `localStorage`; continuous autosave skips history; round boundaries go through `mergeReviewRecord`.
5. If configured, the browser sync client pushes/pulls per-page records through `server.ts` into whichever store `build_scripts/storage.js` selects — Postgres when `DATABASE_URL` is set, SQLite otherwise; AI panel posts drafts to `/api/ai/generate` (validated, never written to disk as pages).
6. Managers open the Railway deploy, which runs `server.ts`; the sync/AI routes still need secrets configured, and a purely static host would have no runtime for them at all.

### 3) Layer/Module Responsibilities

`js/` holds nine feature folders rather than one flat directory of modules —
`js/main.js` alone stays directly under `js/`, as the module graph's root:

| Folder          | Owns                                                                                                                                                                                                                                                                              |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `js/core/`      | Bootstrap and shared state/vocabulary: `utils.js`, `state.js`, `app.js`, `page-data.js`, `page-registry*.js`, `card-inheritance.js`, `third-party-globals.js`                                                                                                                     |
| `js/mockup/`    | Renders `#mockPage` from page data: `page-render.js`, `karl-tag-meta.js`, `inline-link-target.js`, `mockup-image-export.js`                                                                                                                                                       |
| `js/review/`    | The review/UX layers on top of the core: queue, insights, ops, `ux-improvements*.js`, `dashboard-guidance.js`, `editor-panel.js`, `keyboard-shortcuts.js`, `manager-review-export.js`, `review-merge.js`, `review-state-store.js`, `review-state-validation.js`, `ui-controls.js` |
| `js/editing/`   | Click-to-edit inline content editing on the rendered mockup                                                                                                                                                                                                                       |
| `js/ai/`        | Optional AI assist and AI rewrite features, invisible unless `/api/ai/*` is configured                                                                                                                                                                                            |
| `js/sync/`      | The optional review-state sync client                                                                                                                                                                                                                                             |
| `js/karl/`      | Karl guide panels and the Karl transcript export                                                                                                                                                                                                                                  |
| `js/standards/` | Content-standards scoring: `reading-level.js`, `plain-language.js`                                                                                                                                                                                                                |
| `js/react/`     | React 19 + MUI islands mounted inside `#reviewWorkspace`                                                                                                                                                                                                                          |

| Layer or module                                      | Owns                                                          | Must not own                                                         | Evidence                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------- |
| Page data (`pages/`, `page-data.js`)                 | Content objects + nav order                                   | Persistence, auth                                                    | `js/core/page-data.js`                                        |
| Core render (`page-render.js`, `app.js`, `state.js`) | DOM mockup, navigation, dirty/reset                           | Optional API                                                         | `js/mockup/page-render.js`                                    |
| Utils (`utils.js`)                                   | Escaping, `safeUrl`, decision vocabulary, review record shape | Feature UI ownership (some workspace helpers live here — noted debt) | `js/core/utils.js`, `AGENTS.md`                               |
| Review UX / queue / insights / ops                   | localStorage review workflow                                  | Source-file mutation                                                 | `js/review/ux-improvements*.js`, `js/review/review-queue*.js` |
| `review-merge.js`                                    | Merge precedence + history append                             | Transport                                                            | `js/review/review-merge.js`                                   |
| `server.ts` + `build_scripts/ai/`                    | Auth-gated sync + AI generation                               | Unauthenticated open access                                          | `server.ts`                                                   |
| Validate/export scripts                              | Schema + inventory CSVs                                       | Runtime UI                                                           | `build_scripts/validate.js`                                   |

### 4) Reused Patterns

| Pattern                                    | Where found                                               | Why it exists                                             |
| ------------------------------------------ | --------------------------------------------------------- | --------------------------------------------------------- |
| Side-effect page registration              | `pages/*.js` → `HHVC_PAGES`                               | Keep content files simple; graph imports enforce presence |
| Named IIFE + `window.X = window.X \|\| {}` | Review/UX modules                                         | Stateful subsystems without a framework                   |
| Dual export (`window` + `module.exports`)  | `review-merge.js`, `plain-language.js`, insights/ops data | Same logic in browser and Bun tests/server                |
| Provider registry                          | `build_scripts/ai/providers.js`                           | Add AI vendors without hardcoding in `server.ts`          |
| Fail-closed optional APIs                  | Missing `REVIEW_API_TOKEN` → 501                          | Offline-first; no open sync by default                    |
| Dynamic import for ECharts                 | `review-insights-charts.js`                               | Keep initial bundle small                                 |

### 5) Known Architectural Risks

- IIFE load order in `js/main.js` is still hand-maintained for `window.<Namespace>` edges the module graph cannot see — wrong order breaks silent mounts (`js/main.js` header).
- Import/export round-trip for reviews has limited automated coverage (primarily e2e); wholesale replace once destroyed reviews (`AGENTS.md`).
- Static-host vs Bun-backend split means AI/sync UI can look “empty” on the deploy managers open unless those panels stay collapsed/discoverable; Railway supplies the runtime, but each panel is still empty until its own backend is configured (`AGENTS.md`).
- Explicit `package.json` test file list: a new `tests/*.test.js` never runs until named (`package.json`, `tests/doc-counts.test.js`).

### 6) Evidence

- `js/main.js`
- `js/core/page-data.js`
- `js/review/review-merge.js`
- `server.ts`
- `vite.config.mjs`
- `railway.json`
- `AGENTS.md`
- `README.md`
