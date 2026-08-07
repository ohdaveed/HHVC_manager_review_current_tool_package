---
name: verify-netlify-deploy
description: Verify the production Netlify deploy actually matches the current commit on main and is reachable, after a merge to main. Use after merging a PR, after pushing directly to main, or when asked to check deploy status, check the live site, or confirm a change is actually live. Catches the class of bug where something works in one build mode (bun run dev, or a local production build) but the story diverges once it's actually deployed.
---

# Verify Netlify deploy

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

## 2. Is the live site actually reachable?

```bash
curl -sI https://hhvc.netlify.app/
```

Expect `200`. If you get **401 or 403 instead of a build error**, don't
report that as a broken deploy — it's Netlify's visitor access control
(`projectAccessControls.requiresSSOTeamLogin` /
`requiresPassword` in the `get-projects` response), a site-wide gate
separate from whether the build succeeded. Report it as its own finding:
*the deploy is correct, but the live URL currently requires Netlify team SSO
to view* — worth flagging on its own, since this tool's whole purpose is a
mockup manager-review reviewers open directly, and a team-SSO gate means
reviewers without Netlify org access can't. (Confirmed present as of
2026-08-07 — checked the primary URL, the `main--hhvc.netlify.app` branch
alias, and the specific deploy's permalink; all three 401.) Don't silently
"fix" this by changing the site's access control — it may be deliberate
(the tool mocks up unreleased content); surface it and let the user decide.

## 3. Does the live bundle actually reflect the new commit?

Only reachable if step 2 returned 200. Two ways to check, cheapest first:

- **Asset-hash comparison** (no browser needed): after a `bun run build:app`
  from the same commit, `grep -oE '/assets/[a-zA-Z0-9._-]+\.(js|css)'
dist/index.html` and compare against the same grep on `curl -s
https://hhvc.netlify.app/`. Vite content-hashes its output filenames, so if
  the hashes match, the bytes match — no ambiguity, no guessing from
  timestamps.
- **Live browser check** (when you want to confirm a specific user-visible
  behavior, not just that *some* bundle shipped): navigate there with the
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
