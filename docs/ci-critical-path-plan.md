# CI critical-path plan — Playwright shard + prebuilt e2e server

Goal: cut the CI critical path from ~357s (the `e2e` job, which is the whole
path — the other six finish inside 70s) to roughly 135s, and close the gap
where e2e tests a build that is not the one the deploy ships.

**Do this before #220.** That work adds one axe run per Karl content type —
eight more page loads into exactly this suite. Landing it on a serial job makes
a 357s job a ~450s one; landing it on a sharded one costs almost nothing.

## Measured baseline (2026-08-25, run 32901612147)

| Job                         | Time     |
| --------------------------- | -------- |
| Playwright end-to-end tests | 338–380s |
| Unit tests (bun test)       | 36–68s   |
| Format, validate, lint      | 24–53s   |
| Build single-file export    | 17–64s   |
| Build railway bundle        | 13–52s   |
| Detect changed files        | 5–11s    |

Playwright's own line reads `220 passed (5.5m)` with **zero flaky and zero
retries**. `retries: 1` + `trace: 'on-first-retry'` are configured but never
firing, so none of the 357s is retry cost — it is 220 tests at `workers: 2`.
The flake hypothesis was checked and rejected; do not re-propose it without a
run that actually shows retry markers.

Caching is already correct: Bun install cache on all six jobs, Playwright
browsers at `ci.yml:330`. The time is real execution, not cold cache.

## Why the two changes ship together

The prebuilt-`dist` change is **not a speed win on its own** — it is a
correctness win, and standalone it is probably a small loss. Today `e2e` runs
beside `build_railway`; consuming its artifact means `needs: build_railway`, so
a 13–52s job (checkout + setup-bun + install included) moves onto the critical
path in exchange for removing an in-job build. Roughly a wash.

It becomes a real win **only under sharding**, where four shards would
otherwise each run `validate + vite build` independently. One build amortized
across four runners is the whole argument. Hence: together.

## Tasks

- [x] **1. Drop the redundant `validate` from the e2e webServer.** `bun run
start` is `validate && build:app && copy-workshop-form && serve`, but
      `e2e` already `needs: format_validate_lint`, which ran `validate` to
      completion. Free, no serialization, no protection surface — and it is 4×
      under sharding. `copy-workshop-form.js` must stay: the `workshop-form`
      spec needs `dist/forms/mosquito-workshop-request`.
      **Gate the command on CI.** Locally `reuseExistingServer` is on and
      nobody has built `dist/`; a serve-only command there is a 120s webServer
      timeout against a missing static root. Keep `bun run start` off CI.
- [x] **2. Consume the prebuilt `dist` artifact in `e2e`.** `build_railway`
      already uploads `dist` (`if-no-files-found: error`, 1-day retention) and
      `unit` already downloads it — copy that pattern exactly. Add
      `needs: build_railway`, download to `dist/`, and let the webServer run
      `bun run serve` only. This is what makes e2e test the artifact the deploy
      ships, closing the same class of gap the `unit` job's artifact download
      was added to close.
- [x] **3. Shard Playwright 4 ways.** `strategy.matrix.shard: [1,2,3,4]`,
      `--shard=${{ matrix.shard }}/4`. `fullyParallel: true` is already set.
      Expect **~135s, not ~110s**: each shard is a fresh runner paying
      checkout + setup-bun + cache restore + `bun install` + `bunx playwright
install --with-deps chromium`, and the `--with-deps` apt step is not
      covered by the `~/.cache/ms-playwright` cache. Call it a 40–60s fixed
      prefix per shard. 8-way would buy almost nothing over 4-way.
      Billing is roughly neutral: 4 × ~135s ≈ 540 runner-seconds against 357
      today, for ~2.6× the wall clock.
- [x] **4. Add an `e2e_complete` aggregator job named `Playwright end-to-end
tests`.** This is the load-bearing piece. A matrixed job's check contexts
      become suffixed (`… (1)`, `… (2)`), so branch protection's required
      context `Playwright end-to-end tests` would be produced by no job and sit
      **permanently pending** — the exact failure CLAUDE.md records from the
      last job split. Renaming the matrixed job (e.g. `E2E shard`) and giving
      the aggregator the old name keeps the required context **unchanged**.
      **Verify that property explicitly and record it here**, so nobody later
      "helpfully" re-points protection.
      `needs: [e2e]`, `if: always()`, and fail only on `failure` / `cancelled`
      — **pass on `skipped`**, which matches today's `!draft` and docs-only
      behavior where the whole job skips and reads to protection as a pass.
- [x] **5. Teach `tests/ci-workflow.test.js` about matrix jobs.** Its census
      asserts the mirrors enumerate exactly the job names `ci.yml` defines, on
      the premise that each job name is its own required context — which a
      matrixed job breaks. Exclude `strategy:`-bearing jobs from the census,
      **then assert every excluded job appears in some non-matrixed job's
      `needs:`.** Without that second half this is a hole carved in the gate
      rather than a fix; with it, the invariant the test protects (every
      required context is enumerated in both mirrors) is preserved.
- [x] **6. Update the mirrors.** `MIRRORS` in that test is `['AGENTS.md',
'CLAUDE.md']` only — `.github/copilot-instructions.md` carries no
      required-set sentence, so it is out of scope for the census. Update the
      required-set enumeration and the per-job description list in both, and
      state why the aggregator exists.
- [x] **7. Verify.** Open the PR, confirm all shards report, confirm
      `Playwright end-to-end tests` still appears as a single check context,
      confirm total 220 tests still run across the shards (sum the per-shard
      counts — a mis-specified `--shard` silently runs a subset), and record
      the new critical-path time here.

## Decisions made

- **Not raising `workers` from 2.** The cap is plausibly deliberate: the suite
  shares one server and one review-state store, and 4 workers could surface
  cross-test contamination as flakes. Sharding sidesteps it — each shard spawns
  its own `webServer` on its own runner, so it is isolation by construction.
  Treat raising workers as a separate experiment later, where a flake would
  tell you something real about test coupling rather than about CI.
- **Not touching the docs-only path filter.** It already works — the 20:22 run
  skipped Playwright and finished in 119s.

## Open

## Measured result (2026-08-25, run 32904736096 on PR #227)

**Run wall clock 404s -> 229s, a 43% cut.** Beat the ~135s shard estimate on
the shard itself and missed it on the total, for a reason worth recording: the
estimate costed the shard in isolation and the critical path is
`Detect changed files` -> `Format, validate, lint` -> `Build railway bundle` ->
slowest shard -> aggregator, which is 6 + 27 + 19 + 156 + 4 = 212s of job time
before queueing.

| Job                                      | Time |
| ---------------------------------------- | ---- |
| E2E shard (1)                            | 156s |
| E2E shard (2)                            | 155s |
| E2E shard (3)                            | 119s |
| E2E shard (4)                            | 115s |
| Unit tests (bun test)                    | 43s  |
| Format, validate, lint                   | 27s  |
| Build railway bundle                     | 19s  |
| Build single-file export                 | 18s  |
| Detect changed files                     | 6s   |
| Playwright end-to-end tests (aggregator) | 4s   |

Notes for whoever picks this up next:

- **The shards are unbalanced by ~35%** (156s against 115s). Playwright shards
  by test count, not duration, and 220 ÷ 4 = 55 exactly — so the split is even
  in tests and uneven in time. The critical path is the SLOWEST shard, so
  balancing is worth more than adding a fifth: perfect balance would put every
  shard near 136s.
- **`build_railway` cost 19s to save four rebuilds**, which settles the open
  question in this file — the artifact download did not eat the saving.
- **Sharding cost less than predicted.** The estimate assumed a 40-60s
  per-shard prefix; the fastest shard finished in 115s total, so the real
  prefix is well under that.
