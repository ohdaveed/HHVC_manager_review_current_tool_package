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

**Railway example:**

```bash
railway variable set WATCH_PATTERNS '__deploys-paused-do-not-match__/**'
```

This makes the tracked branch unmatchable, skipping deployment. Verify the pause with:

```bash
railway deployments --limit 1
```

Record the original pattern (usually `main/**` or empty) to restore at the end.

## Merge Each PR Individually

1. Resolve any required review threads in the GitHub UI.
2. Verify all CI checks pass.
3. Merge the PR and note the commit SHA.
4. **Verify the deployment skipped:**

   ```bash
   railway deployments --limit 1
   ```

   Expect `SKIPPED` status on that SHA. This is the proof the pause held.

5. Start the next PR off fresh `main` (don't stack branches).

**Why verify each merge?** Silent misconfigurations (typo in pattern, stale cache, retry bypass) are invisible without watching the `SKIPPED` status. Observation is the evidence.

## Resume Deployment

After all PRs merge:

```bash
railway variable set WATCH_PATTERNS 'main/**'  # Restore original pattern
railway deploy
```

Verify the deployment succeeds and includes all PRs.

## Anti-patterns

- **Don't stack branches.** Each PR should base on `main`, not on the previous PR. Stacking creates conflicts.
- **Don't trust the pause without observation.** A missed `SKIPPED` status on the first merge means the pause silently failed.
- **Don't leave the pause on.** A forgotten pause is an invisible gate that blocks the next person's deploys.
