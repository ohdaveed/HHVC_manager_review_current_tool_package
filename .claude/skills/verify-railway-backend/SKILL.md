---
name: verify-railway-backend
description: Check whether this repo's optional sync/AI-assist backend (server.ts) is actually deployed and reachable on Railway, whether the API authorization layer and the AI keys are configured, and whether /api/review-state and /api/ai/capabilities respond as AGENTS.md says they should. Use when asked to check the Railway deployment, check backend/sync status, verify the optional server is up, or confirm a merge to main actually redeployed. As of 2026-08-15 the deployment exists and is live at https://web-production-9bb3b.up.railway.app.
---

# Verify the Railway-hosted optional backend

`server.ts` hosts two off-by-default subsystems: the review-state sync API
(`/api/review-state`, `/api/review-state/pages/:pageKey`) and the AI-assist
API (`/api/ai/*`). `tests/review-api-server.test.js` and
`tests/ai-assist-server.test.js` cover the code by spawning `server.ts`
locally against a temp database and stub AI endpoints — real, valuable
coverage, but it proves the code is correct, not that a real deployment is
up, configured, and reachable. That gap is what this skill closes.

**Status as of 2026-08-15 — this replaces the 2026-08-07 finding.** The
deployment now exists and is live at
**https://web-production-9bb3b.up.railway.app** (Railway project
`hhvc-manager-review`, service `web`, connected to `main`; `railway.json` is
committed). The API authorization layer is **configured**: an unauthenticated
`GET /api/review-state` answers **401**, not the 501 it returned while
unconfigured. The earlier version of this file asserted the opposite — no
project, no `railway.json`, never deployed — and instructed stopping at step 1.
Both statements were true when written on 2026-08-07 and became false when
Railway went live on 2026-08-14 (#129). **If a future run finds the project
genuinely gone, report that plainly and stop; don't guess at a project name or
invent one.**

## Know which tools you actually have before planning the check

This is the trap that cost the most time on 2026-08-15. The Railway MCP
surface **varies by session**, and the ID-taking tools are useless without a
way to discover the IDs.

- **Session-dependent:** a `list-projects` / `list-services` /
  `list-deployments` / `get-logs` set may or may not be present. On 2026-08-15
  the session had only `list-workspaces`, `list-domains`, `list-variables`,
  `get-service-config`, `get-service-metrics`, `create-service`,
  `generate-domain`, `set-variables`, `update-service`, and the docs tools.
- **Every useful one of those requires a `projectId` and `serviceId`**, and
  `railway.json` records neither — it carries only build and deploy commands.
  `list-workspaces` returns the workspace and a project _count_, not the
  projects. So with that toolset there is **no path from this repo to a
  Railway project ID**, and steps written around `list_projects` simply cannot
  run.
- **Don't let that block the check.** Fall back to the two sources below,
  which need no Railway API access at all. Say in your report which route you
  took, so a later reader knows whether "no deployment record" meant absence
  or blindness.

## The fallback that actually works: GitHub's deployments API

Railway's GitHub integration writes a deployment record and status history
into the repo itself, and the repo is public, so **this needs no token and no
Railway access**. It answers the question the user usually means — _did my
merge deploy, and did it succeed?_ — better than a dashboard status does,
because it is per-commit.

```bash
REPO=ohdaveed/HHVC_manager_review_current_tool_package
# Which commits Railway built, newest first
curl -sS "https://api.github.com/repos/$REPO/deployments?per_page=20"
# How a given one ended (states: in_progress -> success | failure, then inactive)
curl -sS "https://api.github.com/repos/$REPO/deployments/<id>/statuses"
```

Reading it correctly:

- **Railway files two deployment records per commit**, seconds apart, with
  separate status histories. Treat the commit as the unit, not the record —
  and expect the pair to sometimes disagree (on `d66e369` one went
  `success` then `failure`, the other straight to `failure`).
- **`inactive` is not a failure.** It means a later deploy superseded this
  one. A commit whose history ends `success` → `inactive` deployed fine and
  was simply replaced.
- **Always check the commit _before_ the one you care about.** This is the
  single most valuable step and the easiest to skip. On 2026-08-15 the merge
  under investigation showed `failure`, which reads as "my change broke the
  deploy" — but its parent `1ee5946` had failed the same way four hours
  earlier, before that change existed. The breakage window opened at #129 and
  closed at #132, whose title names the real cause: `server.ts`'s default
  export was crash-looping the deploy. The commit in between was an innocent
  bystander. Attributing a pre-existing crash loop to whatever merged into it
  is the characteristic wrong answer here.
- **A config-only change leaves no fingerprint in the served output.** Don't
  try to prove it shipped by diffing asset hashes — a bundle hash moves for
  unrelated reasons (a dependency resolving differently, an intervening
  design change) and stays put for a change that never touches the bundle.
  Prove it by ancestry instead — and **mind the argument order, which carries
  the whole meaning.** `--is-ancestor` asks "is the FIRST one an ancestor of
  the other?", so reversing it tests whether the deploy is an ancestor of your
  work. That is usually true of an undeployed branch, so the reversed form
  answers "shipped" precisely when it has not shipped.

  ```bash
  git merge-base --is-ancestor <your-sha> <deployed-sha>  # exit 0 = it shipped
  git show <deployed-sha>:<file>                          # read the deployed tree
  ```

## Procedure, in order — stop and report at the first genuine failure

### 1. What is actually deployed right now?

Get the live commit from the newest GitHub deployment record, confirm its
status history ends in `success`, and compare it to `origin/main`. **`main`
often moves past the commit you care about**, so establish "what is live" and
"is my change in it" as two separate questions.

If a Railway `list-projects`-style tool _is_ available this session, use it
too and prefer a name matching this tool (`hhvc`, `manager-review`,
`healthy-housing`) — don't assume the first project in the list is it.

### 2. Is the service answering?

```bash
URL=https://web-production-9bb3b.up.railway.app
curl -sS -o /dev/null -w "%{http_code}\n" "$URL/"
curl -sS -o /dev/null -w "%{http_code}\n" "$URL/forms/mosquito-workshop-request/"
```

`200` on both means the static bundle and the separately-copied workshop
sub-app are being served. A **502 behind a `success` build** is the
signature failure on this host and is documented in AGENTS.md's "Deploying"
section: the container started but bound `127.0.0.1`, so `HOST=0.0.0.0` is
missing from the service variables. Connection refused or a timeout means the
service is not running whatever any dashboard claims — report the
discrepancy.

### 3. Is the API authorization layer configured — presence only, never values

If `list-variables` is reachable, it returns **real values in plaintext**;
that is inherent to how Railway answers the question, not a bug. **Report
only whether the key names are present or absent — never echo, log, or paste
a value into chat, a commit, or a file.** These are live production
credentials. The names worth reporting are `REVIEW_API_TOKEN`,
`REVIEW_API_PRINCIPALS`, `REVIEW_API_ALLOWED_ORIGINS`, `DATABASE_URL`,
`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `HOST`, and `PORT`.

**`REVIEW_API_ALLOWED_ORIGINS` belongs on that list even though it is not an
authorization variable**, because a malformed value produces the same 503 the
authorization config does — and produces it _first_, so it masks everything
behind it. Step 4 explains how to tell the two apart.

When it is not reachable, **step 4 infers what it can from the response
itself**, which is better evidence anyway — it observes the running server
rather than its configuration.

**That inference has one hard limit, and it is the trap this whole section
exists for.** A CORS 503 answers before the authorization gate is ever
reached, so when the body names CORS, the authorization state is not "broken"
— it is **unknown**, and nothing observable from outside narrows it further.
Report it as unknown and go fix the origins list first. Recording "auth is
misconfigured" on the strength of a 503 you did not read the body of is
exactly the misdiagnosis this step is meant to prevent.

### 4. Read the status codes against the two independent gates

```bash
curl -sS -w "\n%{http_code}\n" "$URL/api/review-state"
curl -sS -w "\n%{http_code}\n" "$URL/api/ai/capabilities"
```

**Keep the response body — do not `-o /dev/null` these.** The status code
alone cannot separate the two 503s below, and the body names which one it is.

Never send a real bearer token from this check — it would land in a request
log with your account attached. So:

- **401 — the configured-and-healthy state, and what both routes return
  today.** Authorization is set up and correctly rejected an unauthenticated
  request.
- **501** — nothing is configured: neither `REVIEW_API_TOKEN` nor
  `REVIEW_API_PRINCIPALS` is set. Healthy for a default deploy, but **stale
  for this one** — a 501 here now is a regression (variables lost in a service
  rebuild), not the documented resting state.
- **503 — two different causes, and the body is the only way to tell them
  apart.** A body of `API CORS configuration is invalid.` means
  `REVIEW_API_ALLOWED_ORIGINS` is malformed. A body of
  `API authorization configuration is invalid.` means `REVIEW_API_PRINCIPALS`
  is present but empty, duplicated, oversized, or naming an unknown role — it
  fails closed this way and never falls back to `REVIEW_API_TOKEN`. **Do not
  assume the authorization one.** `getApiRequestContext()` runs at the top of
  every API handler and returns the CORS 503 before `requireApiPrincipal()` is
  ever reached, so a malformed origins list masks the authorization state
  entirely — including on `/api/ai/capabilities`, making it look like an auth
  problem on a deploy whose auth is fine.
- **200** — unexpected, since this check sends no credential. Investigate
  rather than reporting success.
- **Connection refused / timeout** — see step 2.

**`/api/ai/capabilities` answering 401 says nothing about the provider keys,
and this is the correction most worth carrying.** The two gates run in order:
API authorization first, provider key second. Older guidance here said this
route is "deliberately answerable with no `ANTHROPIC_API_KEY`/`GEMINI_API_KEY`
configured," so `{anthropic: false, gemini: false}` was a valid working
result — true of the _provider_ gate, but only reachable once you are past the
_authorization_ gate. With authorization now configured, an unauthenticated
caller gets 401 and never sees the capability report. **Provider-key state is
therefore not observable from outside without a token**; get it from step 3's
variable names, or from the boot log if a log tool is available (`server.ts`
logs its own gating decisions at startup).

## Reporting

State which route you took — Railway API or the GitHub deployments fallback —
and which step you stopped at. Distinguish these three, which are easy to
blur:

- **the service is up** (step 2),
- **the live commit contains the change you care about** (step 1 + ancestry),
- **a specific commit's own deploy succeeded** (deployment statuses).

All three can disagree. A failed deploy for your commit, on a service that is
currently up and already carrying your change via a later successful build, is
a perfectly coherent outcome — and the accurate report says exactly that
rather than picking whichever one sounds tidier. When something is genuinely
wrong (a variable/status mismatch, a `success` build serving 502), name the
specific discrepancy instead of a vague "something's off."
