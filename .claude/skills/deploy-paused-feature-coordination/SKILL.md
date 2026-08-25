---
name: deploy-paused-feature-coordination
description: 'Coordinate multiple feature-branch PRs on an auto-deploy system by pausing deployment, verifying each merge individually, then resuming. Use this skill when a single feature spans multiple PRs on a system with automatic deployment on merge, and you need to prevent partial features from shipping.'
trigger: 'Use this skill when a single feature spans multiple PRs on a system with automatic deployment on merge, and you need to prevent partial features from shipping.'
author: arrizon.david
source_sessions:
  - arrizon.david_arrizon.david's Organization_default_6a513126-9df3-44e7-86d2-d5736946d21c
  - arrizon.david_arrizon.david's Organization_default_3ed74575-71c7-48ea-9b3d-6448e3f42cd5
contributors:
  - arrizon.david
version: 1
created_by_agent: claude_code
created_at: 2026-08-25T16:35:04.320Z
updated_at: 2026-08-25T16:35:04.320Z
---

# Coordinated Multi-PR Deployment

When a feature spans multiple PRs and deploy-on-merge is enabled, each PR merge triggers a deployment. A five-PR feature would half-ship, break, recover four times without a pause. Pause first, merge each PR individually, verify deployment skips, then resume.

## Pause Auto-Deployment

**Railway's deploy trigger is the service's Watch Paths setting, not an environment
variable.** `railway variable set WATCH_PATTERNS ...` creates an ordinary
build/runtime variable that nothing consumes, so the branch trigger stays live — and
a variable change itself triggers a redeploy, which is the opposite of pausing.

Watch paths are **file-path globs matched against the files a push changed**, never
branch selectors. Pausing works by setting them to a pattern no file can match:

- Dashboard: service → Settings → Build → **Watch Paths**
- `railway.json`: `build.watchPatterns`
- Railway MCP: `update_service` with `watch_patterns`

Use a value that is obviously deliberate, so the next person knows it is a pause and
not a real filter:

```text
__deploys-paused-do-not-match__/**
```

**Record the previous value before changing it.** The usual resting state is EMPTY
(no patterns = every push deploys). It is not `main/**` — a branch name in this field
is a path glob matching nothing, which silently pauses deploys forever.

## Merge Each PR Individually

1. Resolve any required review threads in the GitHub UI.
2. Verify all CI checks pass.
3. Merge the PR and **note the merged commit SHA**, re-read from `origin/main` rather
   than local `HEAD` — after a squash merge those are different commits.
4. **Verify the deployment skipped, matched to that SHA:**

   ```bash
   railway deployments --limit 5
   ```

   Find the row **whose commit hash equals the SHA from step 3** and confirm it reads
   `SKIPPED`. Reading only the newest row proves nothing: an unrelated or stale
   `SKIPPED` entry satisfies that check while this merge deployed.

5. Start the next PR off fresh `main` (don't stack branches).

**Why verify each merge?** Silent misconfigurations (typo in pattern, stale cache, retry bypass) are invisible without watching the `SKIPPED` status. Observation is the evidence.

## Resume Deployment

After all PRs merge, restore the watch paths to the value recorded above — usually
clearing them entirely — through the same setting used to pause.

**Restoring is not retroactive.** Every deployment skipped while paused stays
skipped, and production keeps serving whatever it served before. Clearing the setting
only changes what the NEXT push does, so the merged work is still unshipped at this
point.

To ship it, trigger a deploy of the merged `main`:

- Redeploy the skipped deployment from the Railway dashboard, or
- Push any commit to `main` and let the connected-branch trigger fire.

**Never use `railway up` / `railway deploy` to resume.** Those upload the CURRENT
WORKING DIRECTORY, so a feature branch, a git worktree, or uncommitted local changes
ship in place of the merged `main` you just verified.

Then verify the live artifact: the public URL's status code, its deployed commit
against the merged SHA, and a clean console. A green build is not a serving deploy.

## Anti-patterns

- **Don't stack branches.** Each PR should base on `main`, not on the previous PR. Stacking creates conflicts.
- **Don't trust the pause without observation.** A missed `SKIPPED` status on the first merge means the pause silently failed.
- **Don't leave the pause on.** A forgotten pause is an invisible gate that blocks the next person's deploys.
