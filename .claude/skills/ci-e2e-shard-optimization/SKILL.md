---
name: ci-e2e-shard-optimization
description: "Measure and optimize Playwright e2e CI performance by understanding Playwright's test-level sharding behavior, identifying actual bottlenecks (CPU contention vs assignment), and safely implementing improvements in GitHub Actions without breaking branch protection. Use this skill when Playwright e2e tests dominate your CI wall-clock time, when sharding a matrixed job in GitHub Actions, or when measuring and reporting CI performance improvements."
trigger: 'Use this skill when Playwright e2e tests dominate your CI wall-clock time, when sharding a matrixed job in GitHub Actions, or when measuring and reporting CI performance improvements.'
author: arrizon.david
source_sessions:
  - arrizon.david_arrizon.david's Organization_default_157935d8-7d04-4b58-95e5-82a55af69712
contributors:
  - arrizon.david
version: 1
created_by_agent: claude_code
created_at: 2026-08-26T02:32:01.185Z
updated_at: 2026-08-26T02:32:01.185Z
---

# Playwright E2E Shard Optimization

## When to use

Your Playwright e2e test suite dominates CI wall-clock time (e.g., e2e 338–380s while all other jobs finish in <70s). You're looking to parallelize without breaking branch protection or creating hand-maintained configuration debt.

## Workflow

### 1. Baseline measurement

Capture actual CI wall-clock times across **two runs**, along with a breakdown of where time goes. Wall-clock is what matters; summed test time hides setup overhead (playwright install --with-deps, per-runner apt work), queueing, and startup costs.

```bash
bun run test:e2e --list | wc -l  # total test count
gh run list --workflow ci.yml --limit 2 --json | jq '.[].durationMs'  # wall-clock
```

### 2. Critical path analysis

Identify which job is the ceiling. If e2e is 338s and everything else is 53s, e2e is your critical path. Document the baseline.

### 3. Hypothesis testing (cheapest first)

**Eliminate duplicate builds:** If `playwright.config.js` runs `bun run start` (which invokes `build:railway`), and that build already completed in a gated job, move the e2e job to artifact download + serve-only. Wrap the serve-only path in `if: ${{ env.CI == '1' }}` so local dev still builds.

**Raise workers:** Before sharding, test `workers: 4` locally across several runs. Measure flake rate (440+ test executions is a baseline sample). Expect 35% reduction in slowest-shard time if the bottleneck is CPU contention (axe runs, heavy transforms).

**Shard by test count:** Add `strategy.matrix: { shard: [1, 2, 3, 4] }` to the e2e job and pass `--shard=${{matrix.shard}}/4`. Playwright shards at test granularity under `fullyParallel: true`, not file level, so expect reasonably balanced distribution. Create a non-matrixed **aggregator job** (see below) to keep the required context name stable.

### 4. The aggregator pattern (GitHub Actions)

Matrixed jobs produce suffixed contexts (`E2E shard (1)`…`(4)`), but branch protection requires a single stable context name. Solve this once:

```yaml
e2e_complete: # This job keeps the required name
  needs: [e2e] # Depends on the matrixed job
  if: always()
  runs-on: ubuntu-latest
  steps:
    - run: |
        if [ "${{ needs.e2e.result }}" = "failure" ] || [ "${{ needs.e2e.result }}" = "cancelled" ]; then
          exit 1
        fi
```

Branch protection then requires `e2e_complete` — the name never changes on a future reshard. **Update your doc-counts test** to exclude matrixed jobs from the "each job name is a unique required context" assertion, and add a secondary assertion that each matrixed job is listed in some aggregator's `needs:`.

### 5. Measure impact

Capture wall-clock per shard and overall, across **two full runs**. Variance is ±20s; one sample can't separate signal from noise.

```bash
gh run view <run-id> --json jobs | jq '.[] | select(.name | startswith("E2E")) | {name, durationMs}'
```

## Key insights

- **Playwright shards by test count at test granularity under `fullyParallel: true`.** Config is `{ total: 4, current: 1 }`, not file-based. Individual tests are the unit, so `import-export.spec.js` runs across shards 1 _and_ 2, not "in shard 1". File-level bin-packing is a coarser partition.
- **Wall-clock time nearly inverts against summed test time under CPU contention.** A 107s test file can finish faster than an 80s axe-heavy file if workers are starved. Raising `workers` addresses this directly; it's not a hedge against coupling but a relief valve for contention.
- **Branch protection requires a stable context name.** Aggregator job solves this permanently; no protection settings need updating on a reshard.
- **Do not hand-maintain test-to-shard assignments.** A committed duration map defeats automatic balancing and silently rots as files change. Let Playwright's automatic scheme handle it.

## Anti-patterns

- Assuming test-time equals wall-clock time
- Rebuilding the app inside the e2e job when the artifact already exists
- Lowering `workers` to prevent "flakes" without measuring whether flakes actually occur
- Requiring branch-protection edits on every reshard
