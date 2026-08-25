# External Integrations

## Core Sections (Required)

### 1) Integration Inventory

| System                 | Type (API/DB/Queue/etc)       | Purpose                                                                                                                                                    | Auth model                                                                                         | Criticality                   | Evidence                                                                  |
| ---------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------- |
| Anthropic Messages API | External LLM API              | Optional content drafting (`/api/ai/generate`)                                                                                                             | `ANTHROPIC_API_KEY`                                                                                | Low (optional; 501 if unset)  | `build_scripts/ai/provider-anthropic.js`                                  |
| Google Gemini API      | External LLM API              | Alternate drafting provider                                                                                                                                | `GEMINI_API_KEY`                                                                                   | Low (optional)                | `build_scripts/ai/provider-gemini.js`                                     |
| Google Sheets API      | External API                  | Push tracking status (`bun run push-tracking`)                                                                                                             | Service-account JSON via env/path                                                                  | Low (offline CSVs still work) | `build_scripts/push-tracking-sheet.js`, `build_scripts/sheet-config.json` |
| Railway hosting        | App hosting (build + run)     | Build `dist/` and run `server.ts` for managers                                                                                                             | Railway project + service + env vars                                                               | High for demo distribution    | `railway.json`                                                            |
| Railway Postgres       | Managed Postgres              | Production review-state store; Railway injects `DATABASE_URL`, which selects the Postgres driver. `DATA_DB_PATH` (SQLite) is the local-dev and CI fallback | Credentials embedded in `DATABASE_URL` (the bearer token guards the HTTP API, not this connection) | Medium when sync is used      | `build_scripts/storage.js`, `.claude/skills/verify-railway-backend/`      |
| Browser `localStorage` | Client persistence            | Default review state                                                                                                                                       | Same-origin browser                                                                                | High (always-on core)         | `js/review/review-state-store.js`, `AGENTS.md`                            |
| Karl / SF.gov CMS      | External CMS (reference only) | Placement notes; not written by this tool                                                                                                                  | Out of band                                                                                        | N/A for runtime               | `AGENTS.md` Karl section                                                  |

### 2) Data Stores

| Store                                          | Role                                        | Access layer                     | Key risk                                                           | Evidence                                    |
| ---------------------------------------------- | ------------------------------------------- | -------------------------------- | ------------------------------------------------------------------ | ------------------------------------------- |
| `localStorage` key `hhvcManagerReviewState:v1` | Reviewer decisions/notes/UI prefs           | `window.reviewState`             | Browser-local only; orphans when pages retire                      | `AGENTS.md`, `js/review/review-ops-data.js` |
| `localStorage` `hhvcReviewSyncConfig`          | Sync endpoint + token (separate on purpose) | `js/sync/review-state-sync.js`   | Token leakage if exported with reviews — mitigated by separate key | `AGENTS.md`                                 |
| `review_pages` (Postgres or SQLite)            | Optional multi-browser sync                 | `build_scripts/storage.js`       | Misconfigured open access — mitigated by fail-closed 501           | `build_scripts/storage.js`, `server.ts`     |
| Generated `data/page_inventory.*`              | Inventory export                            | `build_scripts/extract-pages.js` | Stale if not regenerated                                           | `.gitignore`                                |

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
- Missing visibility gaps: no APM/SBOM/Dependabot configs in scan; Railway service variables are set in the Railway UI rather than in `railway.json` (`AGENTS.md` deploy section)

### 6) Evidence

- `server.ts`
- `build_scripts/ai/provider-anthropic.js`
- `build_scripts/ai/provider-gemini.js`
- `build_scripts/push-tracking-sheet.js`
- `js/sync/review-state-sync.js`
- `railway.json`
- `.gitignore`
