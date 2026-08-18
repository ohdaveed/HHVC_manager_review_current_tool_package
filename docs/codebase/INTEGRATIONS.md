# External Integrations

## Core Sections (Required)

### 1) Integration Inventory

| System                      | Type (API/DB/Queue/etc)       | Purpose                                                      | Auth model                                        | Criticality                   | Evidence                                                                  |
| --------------------------- | ----------------------------- | ------------------------------------------------------------ | ------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------- |
| Anthropic Messages API      | External LLM API              | Optional content drafting (`/api/ai/generate`)               | `ANTHROPIC_API_KEY`                               | Low (optional; 501 if unset)  | `build_scripts/ai/provider-anthropic.js`                                  |
| Google Gemini API           | External LLM API              | Alternate drafting provider                                  | `GEMINI_API_KEY`                                  | Low (optional)                | `build_scripts/ai/provider-gemini.js`                                     |
| Google Sheets API           | External API                  | Push tracking status (`bun run push-tracking`)               | Service-account JSON via env/path                 | Low (offline CSVs still work) | `build_scripts/push-tracking-sheet.js`, `build_scripts/sheet-config.json` |
| Netlify CDN/hosting         | Static hosting                | Deploy `dist/` for managers                                  | Netlify project + build                           | High for demo distribution    | `netlify.toml`                                                            |
| Railway volume (documented) | Hosted Bun + SQLite volume    | Production path for `DATA_DB_PATH` when sync API is deployed | Bearer `REVIEW_API_TOKEN` (+ optional principals) | Medium when sync is used      | `.gitignore` comment, `.claude/skills/verify-railway-backend/`            |
| Browser `localStorage`      | Client persistence            | Default review state                                         | Same-origin browser                               | High (always-on core)         | `js/review-state-store.js`, `AGENTS.md`                                   |
| Karl / SF.gov CMS           | External CMS (reference only) | Placement notes; not written by this tool                    | Out of band                                       | N/A for runtime               | `AGENTS.md` Karl section                                                  |

### 2) Data Stores

| Store                                          | Role                                        | Access layer                     | Key risk                                                           | Evidence                             |
| ---------------------------------------------- | ------------------------------------------- | -------------------------------- | ------------------------------------------------------------------ | ------------------------------------ |
| `localStorage` key `hhvcManagerReviewState:v1` | Reviewer decisions/notes/UI prefs           | `window.reviewState`             | Browser-local only; orphans when pages retire                      | `AGENTS.md`, `js/review-ops-data.js` |
| `localStorage` `hhvcReviewSyncConfig`          | Sync endpoint + token (separate on purpose) | `js/sync/review-state-sync.js`   | Token leakage if exported with reviews — mitigated by separate key | `AGENTS.md`                          |
| SQLite `review_pages` via `bun:sqlite`         | Optional multi-browser sync                 | `server.ts` `getDb()`            | Misconfigured open access — mitigated by fail-closed 501           | `server.ts`                          |
| Generated `data/page_inventory.*`              | Inventory export                            | `build_scripts/extract-pages.js` | Stale if not regenerated                                           | `.gitignore`                         |

### 3) Secrets and Credentials Handling

- Credential sources: environment variables / gitignored `.env.local`; Google SA JSON via `GOOGLE_SERVICE_ACCOUNT_JSON` or `GOOGLE_APPLICATION_CREDENTIALS`; sync Bearer token never in review export files
- Hardcoding checks: no committed API keys found in scanned source patterns; `.gitignore` excludes `.env.local` and `*-service-account*.json`
- Rotation or lifecycle notes: [ASK USER] operational rotation process for `REVIEW_API_TOKEN` / provider keys; code only documents unset → 501 behavior

### 4) Reliability and Failure Behavior

- Retry/backoff behavior: Anthropic SDK retries capped via env (`ANTHROPIC_MAX_RETRIES`); Gemini HTTP retry attempts pinned; AI validation retry carries rejected draft once (`AGENTS.md`, provider modules)
- Timeout policy: `AI_REQUEST_TIMEOUT_MS` (default 240s), per-provider timeouts (~150s), body size limits with drain-after-cap (`server.ts`)
- Circuit-breaker or fallback behavior: unconfigured provider → 501/400 (no silent cross-provider fallback); CORS OPTIONS answered before token gate; sync pull/push conflict UI rather than auto-merge

### 5) Observability for Integrations

- Logging around external calls: server maps AI errors to status codes; `console.warn` on bad env numbers
- Metrics/tracing coverage: none configured in repo ([TODO])
- Missing visibility gaps: no APM/SBOM/Dependabot configs in scan; Netlify UI-installed plugins are outside `netlify.toml` visibility (`netlify.toml` comments)

### 6) Evidence

- `server.ts`
- `build_scripts/ai/provider-anthropic.js`
- `build_scripts/ai/provider-gemini.js`
- `build_scripts/push-tracking-sheet.js`
- `js/sync/review-state-sync.js`
- `netlify.toml`
- `.gitignore`
