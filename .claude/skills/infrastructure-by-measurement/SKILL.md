---
name: infrastructure-by-measurement
description: "Approach infrastructure and DevOps decisions through empirical measurement and testing, not speculation. Use this skill when making changes to CI/CD pipelines, databases, containers, system configuration, or when diagnosing infrastructure problems that aren't responding to guesses."
trigger: "Use this skill when making changes to CI/CD pipelines, databases, containers, system configuration, or when diagnosing infrastructure problems that aren't responding to guesses."
author: arrizon.david
source_sessions:
  - arrizon.david_arrizon.david's Organization_default_157935d8-7d04-4b58-95e5-82a55af69712
contributors:
  - arrizon.david
version: 1
created_by_agent: claude_code
created_at: 2026-08-26T01:30:44.955Z
updated_at: 2026-08-26T01:30:44.955Z
---

# Infrastructure Work: Measurement First

Infrastructure decisions—CI/CD optimization, database selection, daemon configuration, resource tuning—are often made based on intuition. This leads to changes that miss the real problem or introduce cascading failures. Measure actual state first, test theories empirically, then decide based on data.

## Establish baseline through measurement

- Don't speculate about current state; check it: `systemd status`, `docker ps`, database listings, CI logs, monitoring dashboards
- Measure metrics relevant to your decision: wall-clock time for CI, test counts, resource usage, uptime
- If variance matters, take multiple samples—a single measurement showing "faster" could be noise. Expect ~20% variance; two samples establish whether improvement is real
- Capture the actual driver, not the proxy: Is the slowdown CPU contention or task assignment? Disk I/O or network? Permission or capability?

## Test theories empirically before changing anything

- If you think changing X will solve the problem, measure before and after on real workloads, not assumptions
- Test on your actual configuration: a theory that works on one machine might fail under load or with different concurrency
- Check what changing one system affects: CI matrix contexts break branch protection, database config opens access to all apps on that host, daemon restart kills containers unless live-restore is set first
- Example: duration-based shard balancing sounds logical (spread long tests across shards), but Playwright shards by test _count_ at test granularity. Summed test-time nearly inverted against actual wall clock. The real driver was CPU contention, not task assignment. Measuring revealed the wrong lever

## Reject theories based on data

- If measurement contradicts your theory, the theory is wrong, regardless of how sensible it sounds
- Record why theories failed so they don't resurface: "Shard balancing by duration rejected—Playwright shards by test count, making file-level partitioning coarser; CPU contention was the actual driver"
- Use the measurement to identify the actual problem, not the symptom you expected

## Handle cascading effects and sequence safely

- Infrastructure changes ripple through dependent systems; understand the full surface before changing anything
- Use abstractions to absorb side effects: aggregator jobs maintain stable CI context names despite matrix expansion; separate schemas scope database configuration; staged restart procedures preserve container uptime
- Sequence changes to avoid cascading failures: test locally, validate migrations work, apply to remote with rollback prepared

## Verify and document

- After deployment, measure actual impact and confirm side effects stayed contained
- Document baseline, theory, measurement, and decision: "Mean slowest shard 142s → 120s; spread 35s → 13s; zero flakes across 440 test executions"
- Keep the record: rejected theories prevent the same speculation from surfacing again in six months
