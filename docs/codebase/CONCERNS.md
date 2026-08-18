# Codebase Concerns

## Core Sections (Required)

### 1) Top Risks (Prioritized)

| Severity | Concern                                                                               | Evidence                                                                            | Impact                                                | Suggested action                                                                                          |
| -------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| high     | Review import/export can destroy reviews if merge regresses; limited non-e2e coverage | `AGENTS.md` Local persistence; deleted `review-import-export.spec.js` history       | Manager decisions wiped                               | Keep e2e green; manual round-trip after touching merge/import/export; consider dual-export for unit tests |
| high     | README page count stale (19) vs disk/`order` (20)                                     | `README.md` vs `js/page-data.js` (20 order entries), `pages/*.js` (20), `CLAUDE.md` | Wrong onboarding claims; sticky copy may still say 19 | Update README + any UI strings; extend `doc-counts` to README [ASK USER]                                  |
| med      | Optional APIs fail closed, but UI historically looked “empty” on Netlify              | `netlify.toml`, `AGENTS.md` workspace tab cuts                                      | Confusing demos                                       | Keep AI/ops nested under Help; document deploy matrix                                                     |
| med      | Explicit `test` file list                                                             | `package.json`, `tests/doc-counts.test.js`                                          | New tests silently never run                          | Always add to `package.json` when adding files                                                            |
| med      | No `.env.example` for many secrets/tunables                                           | scan: no env template; greps in `server.ts` / AI providers                          | Misconfigured deploys                                 | Add sanitized template [ASK USER]                                                                         |
| low      | Scan metrics polluted by `.worktrees` + large policy binaries                         | `.codebase-scan.txt` CODE METRICS                                                   | Misleading size/complexity                            | Exclude worktrees when scanning                                                                           |

### 2) Technical Debt

| Debt item                                   | Why it exists                                             | Where                                                  | Risk if ignored                   | Suggested fix                                        |
| ------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------ | --------------------------------- | ---------------------------------------------------- |
| `utils.js` grab-bag + workspace DOM helpers | Incremental growth from monolith split                    | `js/utils.js`, `AGENTS.md`                             | Layer inversion; harder refactors | Move panel helpers upward when touching them         |
| IIFE/`window` namespace coupling            | Pre-Vite shared scope migration                           | `js/main.js` ordered imports                           | Silent mount failures             | Prefer real imports when editing a subsystem         |
| Client libs in `devDependencies`            | Static Vite bundle doesn’t need Node prod install of them | `package.json`                                         | Tooling/npm audit confusion       | [ASK USER] move to `dependencies` for clarity        |
| Comment/doc page counts lag filesystem      | Rapid content adds (Article 11 compliance)                | `js/main.js` “19 pages”, `browser-env.js`, `README.md` | Agent/human confusion             | Fix comments; rely on `doc-counts` for AGENTS/CLAUDE |
| Historical high churn on deleted sitemap    | Feature removed after heavy iteration                     | git churn lists `js/interactive-sitemap.js`            | Noise in fragility signals        | Ignore deleted paths when prioritizing               |

Production TODO/FIXME/HACK scan: none found in production code (scan section).

### 3) Security Concerns

| Risk                                   | OWASP category (if applicable) | Evidence                                            | Current mitigation                                  | Gap                                                                                    |
| -------------------------------------- | ------------------------------ | --------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Unsafe URL schemes in rendered hrefs   | A03 Injection                  | `js/utils.js` `safeUrl`, `js/mockup/page-render.js` | Scheme guard + validate `findUnsafeUrls`            | One markdown-link path uses `https?` regex instead of `safeUrl` (documented exception) |
| Unauthenticated sync/AI if misdeployed | A01 Broken Access Control      | `server.ts`                                         | Token required; unset → 501; rate limits; body caps | Ops must set secrets correctly                                                         |
| XSS via `innerHTML`                    | A03                            | page-render escaping tests                          | `escapeHtml` + URL guards; dedicated tests          | Keep render path coverage                                                              |
| Sync token in shareable backups        | A04                            | Separate `hhvcReviewSyncConfig` key                 | Documented separation                               | Educate reviewers not to paste tokens                                                  |
| No Dependabot/Snyk in scan             | N/A                            | scan SECURITY section empty                         | Manual upgrades                                     | [ASK USER] enable dependency alerts                                                    |

### 4) Performance and Scaling Concerns

| Concern                               | Evidence                                           | Current symptom                  | Scaling risk                                 | Suggested improvement                        |
| ------------------------------------- | -------------------------------------------------- | -------------------------------- | -------------------------------------------- | -------------------------------------------- |
| ECharts ~180 KB gzip chunk            | `AGENTS.md`, `vite.config.mjs` chunk warning limit | Deferred via dynamic import      | Acceptable for this tool size                | Optional hand SVG if bundle pressure returns |
| Workspace layout overlap historically | `AGENTS.md` 1700px dock breakpoint                 | Fixed; a11y axe caught obscuring | Regression if breakpoint lowered             | Sweep widths in e2e, not single widths       |
| In-memory rate-limit map              | `server.ts` `rateLimitBuckets`                     | Fine single-instance             | Multi-instance Bun hosts don’t share buckets | Document single-process assumption           |
| Append-only review `history[]`        | merge design                                       | Body capped at 1 MB              | Very long campaigns hit sync body cap        | Monitor; raise cap only with evidence        |

### 5) Fragile/High-Churn Areas

| Area                                        | Why fragile                                      | Churn signal          | Safe change strategy                               |
| ------------------------------------------- | ------------------------------------------------ | --------------------- | -------------------------------------------------- |
| `index.html`                                | Shell + workspace markup must match JS tab lists | 54 commits (90d scan) | Change with `WORKSPACE_TABS` + shortcuts together  |
| `js/ux-improvements.js` / workspace CSS     | Docked layout + visibility class coupling        | 40 / 25 commits       | Touch `applyWorkspaceVisibility` only via one path |
| `js/mockup/page-render.js`                  | XSS surface + Karl tags                          | 35 commits            | Keep escape/URL tests green                        |
| `pages/agency-service-grouping.js`          | Agency hub content + invariants                  | 25 commits            | Run `validate` + banned-term checks                |
| `js/utils.js`                               | Shared vocabulary + URL + records                | 24 commits            | Prefer additive helpers; don’t restate decisions   |
| Instruction docs (`AGENTS.md`, `CLAUDE.md`) | Counts drift                                     | high churn            | Update with `doc-counts` in the same PR            |

### 6) `[ASK USER]` Questions

1. [ASK USER] Should `README.md` (and any remaining “19 pages” UI strings) be updated to **20**, and should `tests/doc-counts.test.js` also guard README?
2. [ASK USER] Is Railway the confirmed long-term host for `server.ts` sync/AI, or provisional documentation only?
3. [ASK USER] Should Vite-bundled client libraries move from `devDependencies` to `dependencies` for clearer production inventory?
4. [ASK USER] Is Netlify remaining permanently API-less for manager demos, or is a hosted sync/AI endpoint planned for that audience?
5. [ASK USER] Do you want a committed `.env.example` listing required/optional vars without secrets?
6. [ASK USER] Should CI enforce a coverage threshold, or keep the current validate + explicit unit list + e2e gate?
7. [ASK USER] After Article 11 compliance landed, is **20** the stable page-set target for this review package, or are more consolidations/additions expected soon?

### 7) Evidence

- `docs/codebase/.codebase-scan.txt` (TODO/FIXME, churn, CI, security sections)
- `README.md` vs `js/page-data.js`
- `AGENTS.md` (persistence / security / workspace)
- `package.json`
- `server.ts`
- `netlify.toml`
- `.gitignore`
- `tests/doc-counts.test.js`
