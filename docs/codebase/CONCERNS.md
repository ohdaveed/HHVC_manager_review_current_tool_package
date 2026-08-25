# Codebase Concerns

## Core Sections (Required)

### 1) Top Risks (Prioritized)

| Severity | Concern                                                                                                                                                                                                                                  | Evidence                                                                                                                                                                                                                                                                             | Impact                                                                                                                    | Suggested action                                                                                                                 |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| high     | Review import/export can destroy reviews if merge regresses. Coverage is split, and the **JSON backup import is the uncovered half**: `mergeReviewRecord` and the whole CSV path have unit tests, but `importReviewStateBackup` has none | `AGENTS.md` Local persistence; `tests/review-merge.test.js` (merge logic), `tests/csv-edited-fields-roundtrip.test.js` (mounts the real export/import IIFEs), `tests/e2e/import-export.spec.js` and `tests/e2e/merge-verification.spec.js` (the only cover for the JSON backup path) | Manager decisions wiped                                                                                                   | Keep both e2e specs green; manual round-trip after touching `importReviewStateBackup`, which no unit test reaches                |
| high     | Branch protection's required contexts are hand-transcribed job NAMES, and a skipped required job reads to GitHub as a PASS                                                                                                               | `.github/workflows/ci.yml` job names vs the protection settings; `tests/ci-workflow.test.js` pins the list in the docs but cannot read protection                                                                                                                                    | A renamed job leaves PRs permanently pending against a context nothing produces; an unrequired job lets a red build merge | Change protection in the same PR as any job rename or addition; all seven jobs must be required, `Detect changed files` included |
| med      | Optional APIs fail closed, so the UI reads “empty” until they are configured                                                                                                                                                             | `railway.json`, `AGENTS.md` workspace tab cuts                                                                                                                                                                                                                                       | Confusing demos                                                                                                           | Keep AI/ops nested under Help; document deploy matrix                                                                            |
| med      | Explicit `test` file list                                                                                                                                                                                                                | `package.json`, `tests/doc-counts.test.js`                                                                                                                                                                                                                                           | New tests silently never run                                                                                              | Always add to `package.json` when adding files                                                                                   |
| med      | No `.env.example` for many secrets/tunables                                                                                                                                                                                              | scan: no env template; greps in `server.ts` / AI providers                                                                                                                                                                                                                           | Misconfigured deploys                                                                                                     | Add sanitized template [ASK USER]                                                                                                |
| low      | Scan metrics polluted by `.worktrees` + large policy binaries                                                                                                                                                                            | `.codebase-scan.txt` CODE METRICS                                                                                                                                                                                                                                                    | Misleading size/complexity                                                                                                | Exclude worktrees when scanning                                                                                                  |

### 2) Technical Debt

| Debt item                                   | Why it exists                                             | Where                                       | Risk if ignored                   | Suggested fix                                                     |
| ------------------------------------------- | --------------------------------------------------------- | ------------------------------------------- | --------------------------------- | ----------------------------------------------------------------- |
| `utils.js` grab-bag + workspace DOM helpers | Incremental growth from monolith split                    | `js/core/utils.js`, `AGENTS.md`             | Layer inversion; harder refactors | Move panel helpers upward when touching them                      |
| IIFE/`window` namespace coupling            | Pre-Vite shared scope migration                           | `js/main.js` ordered imports                | Silent mount failures             | Prefer real imports when editing a subsystem                      |
| Client libs in `devDependencies`            | Static Vite bundle doesn’t need Node prod install of them | `package.json`                              | Tooling/npm audit confusion       | [ASK USER] move to `dependencies` for clarity                     |
| `README.md` counts are not gated            | `doc-counts` was scoped to the instruction docs           | `README.md`, `tests/doc-counts.test.js`     | README drifts silently            | Extend `doc-counts` to README, or accept it as ungated [ASK USER] |
| Historical high churn on deleted sitemap    | Feature removed after heavy iteration                     | git churn lists `js/interactive-sitemap.js` | Noise in fragility signals        | Ignore deleted paths when prioritizing                            |

Production TODO/FIXME/HACK scan: none found in production code (scan section).

### 3) Security Concerns

| Risk                                   | OWASP category (if applicable) | Evidence                                                 | Current mitigation                                  | Gap                                                                                    |
| -------------------------------------- | ------------------------------ | -------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Unsafe URL schemes in rendered hrefs   | A03 Injection                  | `js/core/utils.js` `safeUrl`, `js/mockup/page-render.js` | Scheme guard + validate `findUnsafeUrls`            | One markdown-link path uses `https?` regex instead of `safeUrl` (documented exception) |
| Unauthenticated sync/AI if misdeployed | A01 Broken Access Control      | `server.ts`                                              | Token required; unset → 501; rate limits; body caps | Ops must set secrets correctly                                                         |
| XSS via `innerHTML`                    | A03                            | page-render escaping tests                               | `escapeHtml` + URL guards; dedicated tests          | Keep render path coverage                                                              |
| Sync token in shareable backups        | A04                            | Separate `hhvcReviewSyncConfig` key                      | Documented separation                               | Educate reviewers not to paste tokens                                                  |
| No Dependabot/Snyk in scan             | N/A                            | scan SECURITY section empty                              | Manual upgrades                                     | [ASK USER] enable dependency alerts                                                    |

### 4) Performance and Scaling Concerns

| Concern                               | Evidence                                           | Current symptom                  | Scaling risk                                 | Suggested improvement                        |
| ------------------------------------- | -------------------------------------------------- | -------------------------------- | -------------------------------------------- | -------------------------------------------- |
| ECharts ~180 KB gzip chunk            | `AGENTS.md`, `vite.config.mjs` chunk warning limit | Deferred via dynamic import      | Acceptable for this tool size                | Optional hand SVG if bundle pressure returns |
| Workspace layout overlap historically | `AGENTS.md` 1700px dock breakpoint                 | Fixed; a11y axe caught obscuring | Regression if breakpoint lowered             | Sweep widths in e2e, not single widths       |
| In-memory rate-limit map              | `server.ts` `rateLimitBuckets`                     | Fine single-instance             | Multi-instance Bun hosts don’t share buckets | Document single-process assumption           |
| Append-only review `history[]`        | merge design                                       | Body capped at 1 MB              | Very long campaigns hit sync body cap        | Monitor; raise cap only with evidence        |

### 5) Fragile/High-Churn Areas

| Area                                           | Why fragile                                      | Churn signal          | Safe change strategy                               |
| ---------------------------------------------- | ------------------------------------------------ | --------------------- | -------------------------------------------------- |
| `index.html`                                   | Shell + workspace markup must match JS tab lists | 54 commits (90d scan) | Change with `WORKSPACE_TABS` + shortcuts together  |
| `js/review/ux-improvements.js` / workspace CSS | Docked layout + visibility class coupling        | 40 / 25 commits       | Touch `applyWorkspaceVisibility` only via one path |
| `js/mockup/page-render.js`                     | XSS surface + Karl tags                          | 35 commits            | Keep escape/URL tests green                        |
| `pages/agency-service-grouping.js`             | Agency hub content + invariants                  | 25 commits            | Run `validate` + banned-term checks                |
| `js/core/utils.js`                             | Shared vocabulary + URL + records                | 24 commits            | Prefer additive helpers; don’t restate decisions   |
| Instruction docs (`AGENTS.md`, `CLAUDE.md`)    | Counts drift                                     | high churn            | Update with `doc-counts` in the same PR            |

### 6) `[ASK USER]` Questions

1. [ASK USER] `README.md`, `js/main.js` and `order` now agree at **29** pages, so the drift is closed — should `tests/doc-counts.test.js` be extended to guard README so it stays that way?
2. [ASK USER] Is Railway the confirmed long-term host for `server.ts` sync/AI, or provisional documentation only?
3. [ASK USER] Should Vite-bundled client libraries move from `devDependencies` to `dependencies` for clearer production inventory?
4. [ASK USER] Railway now runs `server.ts` for manager demos — are the sync and AI endpoints meant to stay configured there, or to remain off for that audience?
5. [ASK USER] Do you want a committed `.env.example` listing required/optional vars without secrets?
6. [ASK USER] Should CI enforce a coverage threshold, or keep the current validate + explicit unit list + e2e gate?
7. [ASK USER] Is **29** the stable page-set target for this review package, or are more consolidations/additions expected soon?

### 7) Evidence

- `docs/codebase/.codebase-scan.txt` (TODO/FIXME, churn, CI, security sections)
- `README.md` vs `js/core/page-data.js`
- `AGENTS.md` (persistence / security / workspace)
- `package.json`
- `server.ts`
- `railway.json`
- `.gitignore`
- `tests/doc-counts.test.js`
