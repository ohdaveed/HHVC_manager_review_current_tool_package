---
name: verify-netlify-deploy
description: Verify the production Netlify deploy actually matches the current commit on main and is reachable, after a merge to main. Use after merging a PR, after pushing directly to main, or when asked to check deploy status, check the live site, or confirm a change is actually live. Catches the class of bug where something works in one build mode (bun run dev, or a local production build) but the story diverges once it's actually deployed.
---

# Verify Netlify deploy

> **Netlify is no longer the live host (2026-08-14).** Railway serves the deploy
> reviewers open — https://web-production-9bb3b.up.railway.app, project
> `hhvc-manager-review`, service `web`, tracking `main`. `netlify.toml` now sets
> `build.ignore = "exit 0"`, so Netlify builds nothing and its last deploy stays
> frozen at `38d152c`. **To verify the live site, use the
> `verify-railway-backend` skill** — it carries the current procedure, including
> the GitHub deployments-API fallback for when this session's Railway MCP
> exposes no `list_deployments`/`get_logs` (it frequently doesn't, and every
> remaining Railway tool needs a `projectId` that nothing in this repo records).
> Two Railway-specific facts the Netlify version has no equivalent for:
> `server.ts` binds `127.0.0.1` unless `HOST=0.0.0.0` is set, which produces a
> **502 behind a SUCCESSFUL build**; and `/api/*` answers **401** on the live
> deploy now that authorization is configured there — 501 is the fail-closed
> state of an _unconfigured_ deploy, so a 501 on this host means the variables
> were lost. Keep reading below only when checking the retired Netlify site
> itself.

This repo (`hhvc-manager-review-mockup-tool`) is a static Vite build deployed to
Netlify (`netlify.toml`, site name `hhvc`, site id
`af0a1d95-9b86-4604-8d01-1820c63fd3a6`). CI's `checks`/`e2e` jobs and the PR's
Netlify deploy-preview check both run **before merge**, against the PR branch.
Nothing in this repo automatically confirms that the **production** deploy —
the one that actually replaced what was live — matches what CI just approved,
or that a manager opening the live URL sees the same thing as the merged code.
That gap is exactly where a build-mode divergence hides: `bun run dev` and
`bun run build:app` can disagree (see the `js/review-insights.js` /
`js/review-insights-data.js` export-linking bug fixed 2026-08-07 — Vite's dev
server broke on it, the production Rollup build didn't, and nothing checked
the actual deployed site either way).

Run this after merging to `main`, or on request, to close that gap. Three
questions, in order — stop at the first one that fails and report it plainly
rather than continuing to guess:

## 1. Did Netlify build and deploy the commit that's actually on `main`?

```bash
git rev-parse origin/main
```

Then, via the Netlify MCP tools:

1. `netlify-project-services-reader` → `get-projects` with
   `projectNameSearchValue: "hhvc"` to get the site id and the
   `currentDeploy.currentDeploy.id` for production (skip this call if the
   site id above is still correct — it doesn't change).
2. `netlify-deploy-services-reader` → `get-deploy-for-site` with that site id
   and deploy id.

Check three fields on the result:

- `commit_ref` — must equal the `git rev-parse origin/main` output **exactly**
  (full 40-char SHA, not a prefix match). A mismatch means the production
  deploy is stale — either the build hasn't run yet (check `state`) or it
  silently didn't pick up the latest push.
- `state` — must be `"ready"`. `"error"` means the build itself failed;
  report `error_message` verbatim, don't paraphrase it.
- `context` — must be `"production"`, not `"deploy-preview"` or
  `"branch-deploy"`. Confirms you're looking at what's actually live, not a
  PR preview.

Also worth a glance: `deploy_validations_report.secret_scan_result` — Netlify
runs a secret scan on every deploy; a non-empty `secretsScanMatches` array
here is a real, separate incident (a credential got bundled and shipped),
distinct from a build failure.

**The Netlify MCP tools are not in every session.** Confirm with ToolSearch
before planning around them; a session without them cannot answer this
question at all, and the `netlify` CLI installed in the sandbox is
unauthenticated (`NETLIFY_AUTH_TOKEN` unset, no `.netlify/state.json`) — a
`netlify login` on the user's own machine does not reach this container. When
that happens, say so rather than reporting question 1 as failed, then **skip
to question 3**, which is the stronger check anyway: matching content hashes
prove the deployed bytes, where `commit_ref` only asserts what Netlify
believes it built. Hand the user these to run locally if they want the
metadata too:

```bash
netlify deploys:list --prod    # top entry's state and commit
netlify status                 # confirms which site the repo is linked to
```

## 2. Is the live site actually reachable?

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://hhvc.netlify.app/
```

**Ask for the status code; do not read headers with `-sI`.** Agent sessions
here reach the internet through an HTTPS proxy, and the first line `-sI`
prints is the proxy's own `HTTP/1.1 200 Connection Established` — the CONNECT
tunnel, not the site. A gated site that answers `401` still shows a `200` on
line one, so `curl -sI … | head -1` reports a **false pass**. `-w
'%{http_code}'` reports the response Netlify actually sent.

Expect `200`. If you get **401 or 403 instead of a build error**, don't
report that as a broken deploy — it's Netlify's visitor access control
(`projectAccessControls.requiresSSOTeamLogin` /
`requiresPassword` in the `get-projects` response), a site-wide gate
separate from whether the build succeeded. Report it as its own finding:
_the deploy is correct, but the live URL currently requires Netlify team SSO
to view_ — worth flagging on its own, since this tool's whole purpose is a
mockup manager-review reviewers open directly, and a team-SSO gate means
reviewers without Netlify org access can't. Don't silently "fix" this by
changing the site's access control — it may be deliberate (the tool mocks up
unreleased content); surface it and let the user decide.

**The gate's state is not fixed, so check it rather than assuming.** It was
on across all three URLs on 2026-08-07 and off on both the primary URL and the
`main--hhvc.netlify.app` alias on 2026-08-06 — an earlier revision of this
file asserted the 401 as standing fact, which would have had a later run
report a gate that was no longer there. The inverse is worth a word too: with
the gate off, a mockup of unreleased content is publicly reachable. That may
well be intended; note it, don't change it.

## 3. Does the live bundle actually reflect the new commit?

Only reachable if step 2 returned 200. Two ways to check, cheapest first:

- **Asset-hash comparison** (no browser needed): after a `bun run build:app`
  from the same commit, `grep -oE '/assets/[a-zA-Z0-9._-]+\.(js|css)'
dist/index.html` and compare against the same grep on `curl -s
https://hhvc.netlify.app/`. Vite content-hashes its output filenames, so if
  the hashes match, the bytes match — no ambiguity, no guessing from
  timestamps.
- **Live browser check** (when you want to confirm a specific user-visible
  behavior, not just that _some_ bundle shipped): navigate there with the
  Playwright or chrome-devtools MCP, check the console for errors the way
  `bun run dev` surfaced the review-insights bug, and look for the specific
  thing the merge was supposed to change. This is the only way to catch a
  divergence that's behavioral rather than a missing file — e.g. a bundle
  that ships successfully but throws at runtime under real browser
  conditions that a curl request can't see.

## Reporting

State plainly which of the three questions passed, and stop at the first
failure rather than speculating about the ones after it — a stale deploy
(question 1) makes questions 2 and 3 moot until it re-deploys. When
everything passes, say so in one line; this is meant to be a fast
confirmation, not a report that needs reading closely every time it's clean.

Distinguish **failed** from **could not run**. A question skipped for want of
the Netlify MCP tools is unanswered, not answered "no", and reporting it as a
failure invents a deploy problem out of a missing credential.

One local trap that is not a deploy problem either: if `bun run build:app`
fails to resolve an import, check whether the package is in `package.json`
and the lockfile before concluding `main` is broken. A sandbox's
`node_modules` goes stale as soon as a merged PR adds a dependency — this
happened with `@fontsource/roboto-flex` on 2026-08-06, which looked exactly
like a broken build and was fixed by `bun install`.
