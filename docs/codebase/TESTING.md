# Testing Patterns

## Core Sections (Required)

### 1) Test Stack and Commands

- Primary test framework: Bun test (`bun:test`) via explicit file list in `package.json` (22 files on disk and in the script)
- Assertion/mocking tools: Bun `expect`; happy-dom globals; Playwright Test; `@axe-core/playwright` for a11y
- Commands:

```bash
bun run test
bun run test:e2e
# no dedicated coverage script
bun run validate   # complementary Zod/invariant check, not a unit test
bun run format:check
```

### 2) Test Layout

- Test file placement pattern: centralized `tests/` (not co-located with `js/`)
- Naming convention: `*.test.js` unit/integration; `tests/e2e/*.spec.js` Playwright (16 specs)
- Setup files and where they run:
  - `bunfig.toml` → preload `tests/helpers/browser-env.js` before every Bun test
  - `playwright.config.js` → `webServer: bun run start`, baseURL `http://127.0.0.1:8080`
  - `tests/e2e/helpers.js` shared helpers (`gotoFresh` waits on keyboard shortcuts ready)

### 3) Test Scope Matrix

| Scope                | Covered? | Typical target                                                                                           | Notes                                                       |
| -------------------- | -------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Unit                 | yes      | utils, merge, schema, plain-language, insights/ops data, AI env/providers/schema                         | Dual-export modules imported under Bun                      |
| Integration          | yes      | `review-api-server`, `ai-assist-server`, `review-state-sync`                                             | Spawn real `server.ts` / stub upstream APIs                 |
| E2E                  | yes      | navigation, editor, review workflow/queue/undo, import-export, a11y, AI panel, PNG export, workshop form | Separate CI job                                             |
| Schema/data validate | yes      | all `pages/*.js` + `page-data.js`                                                                        | `bun run validate` + `tests/data-validation.test.js`        |
| Doc drift            | yes      | page/unit/e2e counts in `AGENTS.md` / `CLAUDE.md`                                                        | `tests/doc-counts.test.js` (does **not** check `README.md`) |

### 4) Mocking and Isolation Strategy

- Main mocking approach: happy-dom for DOM; restore native `fetch` for real HTTP server tests; env mutation in AI provider tests; Anthropic/Gemini stub endpoints for AI server tests
- Isolation guarantees: localStorage cleared after tests in browser-env helper; temp SQLite DB for API server tests; Playwright `gotoFresh` for clean UI state
- Common failure mode in tests: unnamed new unit file never runs; e2e that hand-rolled merge instead of calling import APIs previously masked wipe bugs (historical; file deleted)

### 5) Coverage and Quality Signals

- Coverage tool + threshold: none found ([TODO])
- Current reported coverage: [TODO] not measured in CI
- Known gaps/flaky areas:
  - Review import/export merge path: automated mainly via `tests/e2e/import-export.spec.js`; AGENTS.md still requires manual export→re-import verification for related changes
  - Browser-only modules without `module.exports` cannot be unit-tested directly
  - `CI` uses Playwright retries=1; report artifact on failure

### 6) Evidence

- `package.json` (`test`, `test:e2e`)
- `bunfig.toml`
- `tests/helpers/browser-env.js`
- `playwright.config.js`
- `.github/workflows/ci.yml`
- `tests/doc-counts.test.js`
- `AGENTS.md`
