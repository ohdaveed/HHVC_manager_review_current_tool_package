---
name: verify-railway-backend
description: Check whether this repo's optional sync/AI-assist backend (server.ts) is actually deployed and reachable on Railway, whether REVIEW_API_TOKEN and the AI keys are configured, and whether /api/review-state and /api/ai/capabilities respond as CLAUDE.md says they should. Use when asked to check the Railway deployment, check backend/sync status, or verify the optional server is up. As of 2026-08-07 no Railway project for this repo exists at all — treat that as the expected first-class outcome, not an error to work around.
---

# Verify the Railway-hosted optional backend

`server.ts` hosts two off-by-default subsystems: the review-state sync API
(`/api/review-state`, `/api/review-state/pages/:pageKey`) and the AI-assist
API (`/api/ai/*`). CLAUDE.md names Railway as the example production host
("Deployment (e.g. Railway): run server.ts (bun run start) with a persistent
volume mounted..."), but nothing in this repo or workspace had ever actually
checked whether that deployment exists. `tests/review-api-server.test.js` and
`tests/ai-assist-server.test.js` cover the code by spawning `server.ts`
locally against a temp SQLite DB and stub AI endpoints — real, valuable
coverage, but it proves the code is correct, not that a real deployment is
up, configured, and reachable.

**Confirmed 2026-08-07: no Railway project for this repo exists.**
`mcp__railway__list_projects` returned four projects in this account
(`resilient-education`, `candera-candles-design`, `AI Chatbot`,
`divine-warmth`) — none of them this tool. There's no `.railway/`,
`railway.json`, or `railway.toml` in the repo either. The entire
optional-backend story is genuinely untested outside the local stub-based
test suites; it has never been deployed. **If a later run of this skill
still finds nothing, that's not a bug in the check — report it plainly and
stop; don't guess at a project name or invent one.**

## Procedure, in order — stop and report at the first genuine failure

### 1. Does a Railway project for this repo exist?

`mcp__railway__list_projects` (account-wide) or
`mcp__claude_ai_railway__list-projects`. Look for a name plausibly matching
this tool (`hhvc`, `manager-review`, `healthy-housing`, etc.) — don't assume
the first project in the list is it. If nothing matches, **stop here** and
report: "no Railway deployment exists for this repo's optional backend."
Steps 2–5 don't apply.

### 2. Is a service actually running?

`mcp__railway__list_services` (with the project id from step 1), then
`mcp__railway__environment_status` for that project. Look for a service
whose latest deployment status is a running/success state, not crashed or
never-deployed. Cross-check `mcp__railway__list_deployments` — a project can
exist with services that were created but never successfully deployed.

### 3. Is `REVIEW_API_TOKEN` actually set — presence only, never the value

`mcp__railway__list_variables` (or `mcp__claude_ai_railway__list-variables`)
returns real variable values in plaintext — that's inherent to how Railway's
API answers this question, not a bug in the tool. **Report only whether the
key names `REVIEW_API_TOKEN`, `DATA_DB_PATH`, `ANTHROPIC_API_KEY`, and
`GEMINI_API_KEY` are present or absent. Never echo, log, or paste any of
their values into chat, a commit, or a file** — this repo's own CLAUDE.md is
explicit that a secret must never be printed, and this is a live production
credential, not a hypothetical one. If `REVIEW_API_TOKEN` is absent, CLAUDE.md
says the `/api/*` routes should self-report 501 rather than allow
unauthenticated access — step 4 verifies that's actually true rather than
trusting the code comment.

### 4. Does `/api/review-state` actually respond the way the code claims?

`mcp__railway__list_domains` for the live URL, then:

```bash
curl -sI https://<the-actual-domain>/api/review-state
```

Read the status code against what step 3 found, not in isolation:

- **501** — consistent with `REVIEW_API_TOKEN` unset. If step 3 found the
  token *is* set, this is a real bug (the route should be live) — report it
  as one, don't paper over the mismatch.
- **401** — consistent with `REVIEW_API_TOKEN` set and this request
  correctly lacking a valid `Authorization: Bearer` header (which it does,
  deliberately — never send the real token from this check to avoid it
  appearing in a request log with your account attached).
- **Connection refused / timeout** — the service isn't actually running
  regardless of what step 2's dashboard status claimed; report the
  discrepancy.
- **200** — would only happen if the request somehow carried a valid token,
  which this check never sends; treat as unexpected and investigate rather
  than reporting success.

Also check `mcp__railway__get_logs` (`log_type: "deploy"`, recent lines) for
startup errors — `server.ts` logs its own gating decisions
(`REVIEW_API_TOKEN`/`ANTHROPIC_API_KEY`/`GEMINI_API_KEY` configured or not)
on boot, which is a second, independent way to confirm step 3's answer.

### 5. If the AI-assist backend matters for this check too

`curl -s https://<domain>/api/ai/capabilities` — this route is deliberately
answerable even with no `ANTHROPIC_API_KEY`/`GEMINI_API_KEY` configured (see
CLAUDE.md's "Two independent gates" section), so a working response here
with `anthropic: false, gemini: false` is a valid, working state — not a
failure. Only `/api/ai/generate` and `/api/ai/models` require an actual key
to do anything.

## Reporting

State plainly which step you reached and why you stopped there. "No project
exists" (step 1) is a complete, valid answer on its own — don't treat it as
partial credit or keep searching for a differently-named project without
saying so. When something is actually wrong (a mismatch between what the
dashboard claims and what `curl` observes, a variable presence/route-status
mismatch), name the specific discrepancy rather than a vague "something's
off."
