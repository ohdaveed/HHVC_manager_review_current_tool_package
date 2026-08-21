# Security review of the `/ship` CI gate — 2026-08-21

**This is a dated record, not standing documentation.** It captures what was found in
`.claude/skills/ship/SKILL.md` on 2026-08-21, during PR #184 (`fix/ship-check-race`). Claims here
were true on that date. Every blocker named below was fixed before the PR merged, so **do not read
this file as a list of live defects** — read it for the failure shapes, which are the part worth
keeping. Corrections belong in the skill itself, not here.

## Why this was worth reviewing at all

The diff was 88 lines in one markdown file and touched no code, no workflows, and no manifests. That
reads as inert, and it is not: a `SKILL.md` is instructions an agent executes, and the added block
was a shell + `bun -e` snippet that decides whether CI is green before merging to `main`. `main`
auto-deploys to Railway, so a wrong answer there ships uninspected code. **The file was documentation
by extension and a security control by function.**

## Method

Five agents ran in parallel, one per risk area, each verifying empirically rather than by reading:
stubbed `gh` on `PATH` to force failure paths, crafted JSON through the real `bun -e` filter, and
live `gh` calls to establish actual exit codes. The value came from the stubs — three of the five
findings below are invisible to a careful read of the snippet and only appear when you run it.

## Findings, with disposition

| #   | Finding                                                         | Disposition                            |
| --- | --------------------------------------------------------------- | -------------------------------------- |
| B1  | Presence tested by cardinality, not membership                  | Fixed — presence by name               |
| B2  | The loop could never wait; it aborted in the creation window    | Fixed — four-outcome `probe()`         |
| B3  | `$PR` never assigned; `gh` silently resolves the current branch | Fixed — assigned explicitly            |
| S1  | `skipping` scored as a failure                                  | Fixed in `b198c6e`, restored `6a82d59` |
| S2  | Protection lookup hardcoded `main` while deriving contexts      | Superseded by the census/floor split   |
| S3  | Branch-protection read is admin-only, undocumented              | Superseded — falls back to a floor     |
| S4  | `allowed-tools` lacked `gh api` and `bun -e`                    | Fixed in `b198c6e`                     |
| S5  | `--watch` shares the same race, unguarded                       | Fixed in `b198c6e`                     |
| S6  | No deadline or iteration cap on the loop                        | Fixed — 1800s deadline                 |
| S7  | Step 7 recomputed the head instead of carrying step 6's SHA     | Fixed in `9883e31`                     |

### B1 — cardinality is not membership

```js
const mine = j.filter((c) => req.includes(c.name))
if (mine.length !== req.length) process.exit(1) // "a required check missing"
```

This counts check **runs** against required **contexts** — two different units. `req=[A,B]` against
rows `[A,A]` satisfies `2 !== 2`, so a required check that never ran reports green. `gh pr checks`
merges check-runs and commit statuses with no dedup across them, so duplicates are reachable.

### B2 — the loop aborted in the window it was written for

The prose said to wait for required checks to be **present** and finished; the code made absence an
abort. The `sleep` branch was reachable only when every required check already existed, so the block
never survived the creation window. Two prose claims were disproven by the code sitting directly
beneath them.

**The duplicated paragraph was the only correct prescription in the file.** The obvious tidy-up —
deleting it as redundant — would have shipped a gate that aborted on every run. `git blame` put it in
the first commit of the series: the author wrote the right guidance first, then wrote a loop that
contradicted it.

### B3 — an unset variable that returns success

`gh pr checks ""` is byte-identical to `gh pr checks`, exits 0, and resolves the current branch's PR.
The trigger is tool-call boundaries: shell state does not persist between Bash calls, so defining the
function in one call and running the loop in another leaves `$PR` empty. Note the wrong example in
the same file (`gh pr checks N`) **failed louder than the fix did**.

### S7 — the binding that was not carried

Step 6 bound its verdict to a specific SHA; step 7 then recomputed the head and required GitHub to
match _that_. Since step 6 ends by clearing review threads, and a cleared thread is usually a commit,
local `HEAD` and the PR head move together to something newer than the validated run — they agree
with each other, every proof reads clean, and the merge ships a commit whose checks may not exist.

This is not hypothetical. It is the sequence this very PR ran: the poll captured a SHA, clearing two
threads produced two more commits, and the merge was stopped only by an unrelated open-thread guard.

## Verified clean

- **No injection.** The `bun -e` program is single-quoted, the value crosses via the environment and
  is read as `process.env.REQ`, and every expansion is double-quoted. Context names containing spaces
  and commas pass through intact on every run. It would become injectable with a double-quoted
  program body or a concatenated `jq` filter; neither is present.
- **No secrets**, across the full patch of every commit on the branch — ambient `gh` auth only.
- **No path handling**: external input reaches only `grep -c` and a string comparison.
- **No dependency, lockfile, or workflow change.**
- **Inert until invoked** — `disable-model-invocation: true`, and no hook reads `.claude/skills/`.

## Where the review itself was wrong

Recording these because the review's own errors were as instructive as its findings.

- **Claimed a column-0 continuation broke rendering.** It is legal CommonMark, renders identically,
  and `lint:docs` passes. A markdown gate cannot catch duplication or contradiction.
- **Recommended `gh pr checks --required` as a simplification.** It removes the admin dependency, but
  a server-filtered list cannot report what is **missing**, and `[].every()` is `true`. Adopting it
  naively introduces a false green. The eventual design keeps it as a _fallback_ behind an explicit
  empty check and a SHA-bound precondition.
- **Asserted a name-space mismatch would hang the loop.** Branch-protection display names match
  `gh pr checks --json name` exactly; measured, not inferred.

## The general shape

Every defect here is the same one wearing different clothes: **an absence being read as a pass.** No
pending checks, an empty required list, a filtered-away context, a subset that happens to be green, a
SHA that quietly stopped referring to the thing that was tested. A gate that answers by counting what
it can see cannot distinguish "nothing is wrong" from "nothing is there." The fixes all move in one
direction — classify instead of count, name what must be present, and bind the verdict to a specific
commit.
