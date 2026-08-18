# Technology Stack

## Core Sections (Required)

### 1) Runtime Summary

| Area                | Value                                                                                                                  | Evidence                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Primary language    | JavaScript (ES modules) for the app; TypeScript only for `server.ts`                                                   | `js/main.js`, `server.ts`, `package.json`                         |
| Runtime + version   | Bun (CLI, tests, `server.ts`); Node used for one build copy step. CI installs Bun `latest` — no pinned `engines` field | `package.json` scripts, `.github/workflows/ci.yml`, `AGENTS.md`   |
| Package manager     | Bun (`bun.lock` committed; no `package-lock.json`)                                                                     | `netlify.toml`, `.github/workflows/ci.yml`                        |
| Module/build system | Vite 8 (`vite.config.mjs`); workshop sub-app has its own Vite 6                                                        | `vite.config.mjs`, `forms/mosquito-workshop-request/package.json` |

### 2) Production Frameworks and Dependencies

No UI framework. Rendering is data-driven string templates. High-impact packages:

| Dependency                                                  | Version            | Role in system                                                 | Evidence                                                  |
| ----------------------------------------------------------- | ------------------ | -------------------------------------------------------------- | --------------------------------------------------------- |
| `zod`                                                       | ^3.24.1            | Page-object schema + AI request/output validation              | `package.json` `dependencies`, `build_scripts/schema.js`  |
| `@anthropic-ai/sdk`                                         | ^0.115.0           | Optional AI assist (Claude) via `server.ts`                    | `package.json`, `build_scripts/ai/provider-anthropic.js`  |
| `@google/genai`                                             | ^2.15.0            | Optional AI assist (Gemini) via `server.ts`                    | `package.json`, `build_scripts/ai/provider-gemini.js`     |
| `text-readability`                                          | ^1.1.1             | Flesch-Kincaid reading level in the browser                    | `package.json`, `js/standards/reading-level.js`           |
| Bun `bun:sqlite`                                            | (runtime built-in) | Optional review-state SQLite store                             | `server.ts`, `.gitignore`                                 |
| Vite-bundled client libs (declared under `devDependencies`) | see below          | Shipped in `dist/` via Vite, not required as Node runtime deps | `js/main.js`, `js/third-party-globals.js`, `package.json` |

Client libraries bundled into the static app (listed in `devDependencies` but imported by app code):

| Dependency             | Version | Role                                     | Evidence                              |
| ---------------------- | ------- | ---------------------------------------- | ------------------------------------- |
| `@sfgov/design-system` | 0.0.1   | SF.gov/Karl CSS primitives               | `js/main.js`                          |
| `fuse.js`              | ^7.4.2  | Page search                              | `js/third-party-globals.js`           |
| `defu`                 | ^6.1.7  | Deep merge helper (globals)              | `js/third-party-globals.js`           |
| `papaparse`            | ^5.5.4  | CSV parse/serialize                      | `js/third-party-globals.js`           |
| `echarts`              | ^6.1.0  | Overview activity chart (dynamic import) | `js/review/review-insights-charts.js` |
| `modern-screenshot`    | ^4.7.0  | Mockup PNG export                        | `js/mockup/mockup-image-export.js`    |

### 3) Development Toolchain

| Tool                                | Purpose                                | Evidence                                               |
| ----------------------------------- | -------------------------------------- | ------------------------------------------------------ |
| Prettier                            | Sole lint/format gate (`format:check`) | `.prettierrc.json`, `.github/workflows/ci.yml`         |
| Bun test                            | Unit/integration tests                 | `package.json` `test`, `bunfig.toml`                   |
| happy-dom                           | DOM globals for Bun tests              | `bunfig.toml`, `tests/helpers/browser-env.js`          |
| Playwright + `@axe-core/playwright` | E2E + a11y                             | `playwright.config.js`, `tests/e2e/`                   |
| Vite / `vite-plugin-singlefile`     | App + portable single-file builds      | `vite.config.mjs`                                      |
| `googleapis` / `csv-writer`         | Tracking-sheet push/export scripts     | `package.json`, `build_scripts/push-tracking-sheet.js` |
| `fast-glob`                         | Build/validate page discovery          | `build_scripts/`                                       |

### 4) Key Commands

```bash
bun install
bun run build          # validate -> export -> workshop form -> app -> copy form -> singlefile
bun run build:netlify  # validate -> vite build -> copy workshop form (Netlify)
bun run test           # explicit list of 22 Bun unit-test files
bun run test:e2e       # Playwright
bun run format:check   # lint step
bun run validate       # Zod + invariants over pages
bun run dev            # Vite HMR on :8080
bun run dev:api        # optional server.ts API on :8081
```

### 5) Environment and Config

- Config sources: `vite.config.mjs`, `netlify.toml`, `bunfig.toml`, `playwright.config.js`, `build_scripts/sheet-config.json`, gitignored `.env.local`
- No `.env.example` / `.env.template` in repo ([TODO] if one should be added)
- Required / optional env vars observed in code:
  - Server/static: `HOST`, `PORT`, `STATIC_ROOT`, `API_PORT` (Vite proxy)
  - Review sync API: `REVIEW_API_TOKEN`, `DATA_DB_PATH`, `REVIEW_API_PRINCIPALS`, `REVIEW_API_ALLOWED_ORIGINS`, `REVIEW_API_RATE_LIMIT`, `REVIEW_API_RATE_WINDOW_MS`
  - AI: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_MAX_RETRIES`, `ANTHROPIC_TIMEOUT_MS`, `AI_EFFORT`, `AI_REQUEST_TIMEOUT_MS`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_BASE_URL`, `GEMINI_MAX_ATTEMPTS`, `GEMINI_TIMEOUT_MS`
  - Sheets push: `GOOGLE_SERVICE_ACCOUNT_JSON` or `GOOGLE_APPLICATION_CREDENTIALS`
  - E2E: `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`, `CI`
- Deployment constraints: Netlify publish is static `dist/` only — optional `/api/*` has no Netlify runtime. Production SQLite path is documented as a Railway volume in `.gitignore`.

### 6) Evidence

- `package.json`
- `vite.config.mjs`
- `netlify.toml`
- `.github/workflows/ci.yml`
- `server.ts`
- `build_scripts/ai/provider-anthropic.js`
- `build_scripts/ai/provider-gemini.js`
- `docs/codebase/.codebase-scan.txt`
