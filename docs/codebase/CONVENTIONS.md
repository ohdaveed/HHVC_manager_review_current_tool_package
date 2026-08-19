# Coding Conventions

## Core Sections (Required)

### 1) Naming Rules

| Item               | Rule                                                                   | Example                                | Evidence                                   |
| ------------------ | ---------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------ |
| Files              | lowercase; hyphenate multi-word; no camelCase filenames                | `review-queue-rows.js`                 | `js/`, `AGENTS.md`                         |
| Functions/methods  | camelCase                                                              | `mergeReviewRecord`, `escapeHtml`      | `js/review/review-merge.js`, `js/utils.js` |
| Types/interfaces   | TypeScript only in `server.ts`; JSDoc elsewhere                        | `ApiRole`, `@param` blocks             | `server.ts`, module headers                |
| Constants/env vars | `UPPER_SNAKE_CASE` module constants; `snake_case` persisted/CSV fields | `MAX_REVIEW_BODY_BYTES`, `review_date` | `server.ts`, `AGENTS.md`                   |
| Window namespaces  | PascalCase internals / mixed public APIs as documented                 | `window.ReviewUx`, `window.aiAssist`   | `AGENTS.md`                                |

### 2) Formatting and Linting

- Formatter: Prettier (`.prettierrc.json`) — no semicolons, single quotes, 2-space indent, `printWidth` 100, ES5 trailing commas
- Linter: Prettier check only — no ESLint/tsc CI gate (`.github/workflows/ci.yml`, `AGENTS.md`)
- Most relevant enforced rules: ASI-safe semicolon-free JS; leading `;` before IIFEs; format must pass CI
- Run commands: `bun run format`, `bun run format:check`

### 3) Import and Module Conventions

- Import grouping/order: documented sequence in `js/main.js` (CSS → third-party globals → core → review IIFEs → shortcuts)
- Alias vs relative: relative paths with explicit `.js` extensions
- Public exports: core modules use bottom `export { … }` plus selective `window.*` republish; IIFEs attach to `window.<Namespace>`; several pure modules dual-export for Bun `require`

### 4) Error and Logging Conventions

- Error strategy by layer: browser review code prefers toasts / silent degrade for optional features; API returns HTTP status codes (401/413/422/499/501/504) with JSON bodies; AI routes map provider errors via shared helpers in `server.ts` / `build_scripts/ai/errors.js`
- Logging style: `console.warn` for bad numeric env values (`build_scripts/ai/env.js`); server JSON error responses for clients
- Sensitive-data redaction: sync token stored under separate `hhvcReviewSyncConfig` key so it does not round-trip through shareable review exports (`AGENTS.md`); secrets gitignored (`.env.local`, `*-service-account*.json`)

### 5) Testing Conventions

- Test file naming/location: `tests/<name>.test.js` (Bun); `tests/e2e/<name>.spec.js` (Playwright)
- Mocking strategy: happy-dom preload + restore Bun fetch; sync tests stub `window`/localStorage; AI/server tests spawn `server.ts` against stubs/temp DB
- Coverage expectation: no coverage tool/threshold configured ([TODO] if team wants one)
- Test names: behavioral verb sentences (`AGENTS.md`); `test.todo` for known unfixed bugs

### 6) Evidence

- `.prettierrc.json`
- `js/main.js`
- `AGENTS.md`
- `bunfig.toml`
- `tests/helpers/browser-env.js`
- `.github/workflows/ci.yml`
