# Doc claim guard — single-sourcing the counts the mirrors keep drifting on

**Date:** 2026-08-20
**Status:** Design approved, not yet implemented
**Scope:** Tooling only. No prose reorganization, no change to the mirror set.

## The problem, as measured rather than assumed

PR #177 changed the number of Playwright spec files from twenty-two to
twenty-three. That count is stated in three files. **Two of them were
updated and the third was not**, and CI went green anyway.

`tests/doc-counts.test.js` exists precisely to stop this. It did not, for two
independent reasons, and both matter to the design:

1. **Its file list is hand-maintained.** The test reads
   `.github/copilot-instructions.md` at line 33 and includes it in the
   unit-test-count check — but that file was simply **left off** the
   `test.each` list for the spec-file check. Nothing detects an omission from
   a hand-written list; that is what a hand-written list is.
2. **Its regex could not have matched anyway.** The pattern
   `/\*{0,2}([\w-]+)\*{0,2}\s+spec\s+files/` requires the number to sit
   immediately before `spec files`. That file writes
   `twenty-two Playwright e2e spec files`, so two intervening words hid the
   claim even from the check that did run.

**The failure mode is silence.** A doc-parsing regex that stops matching does
not fail — it stops checking, and reports success. This repo has recorded that
exact lesson once already, in `tests/karl-blocks.test.js`, which asserts a
minimum row count FIRST for the same reason.

### What actually drifts

Every recorded drift incident in this repo has been a **count or an
inventory**, never the reasoning prose:

- the spec-file count, today;
- the stylesheet count inside `hhvc-react-islands`, which read `ten` for as
  long as the skill existed while both guarded docs said `eleven`;
- `.cursor` and `.windsurf` quoting a unit-test-file count "less than half the
  real one", per their own headers.

So the target is the count class, and the prose is deliberately left alone.

## Decisions

| # | Decision | Rejected alternative and why |
| - | -------- | ---------------------------- |
| 1 | Single-source the volatile facts | Guard-hardening alone fixes today's bug, not the class. Generating `CLAUDE.md` from `AGENTS.md` is a rewrite: only 37% of its paragraphs are byte-identical (38 KB shared, 76 KB unique). |
| 2 | Verify against the docs, with auto-discovered files | Marker injection (`<!--count:e2e-->`) litters the prose this repo values. Moving counts out of prose entirely destroys the inline-fact voice. |
| 3 | Coverage ratchet, floors asserted first | A strict phrasing allowlist bends the prose to the tool. Per-number triage is more upfront work than the risk warrants. |
| 4 | Scan the 3 prose mirrors + tracked `.claude/skills/*/SKILL.md` | Mirrors-only leaves the skill class unguarded, which has already failed once. All tracked markdown drags in `docs/`, whose dated notes are **frozen by policy** — "a count or claim that was right on its date stays in the file" — and would red-line correct history. |

## Architecture

One new module, `build_scripts/doc-claims.js`, exporting a pure scanner.
`tests/doc-counts.test.js` becomes its caller. Pure and dual-exported like
`js/review/review-merge.js` and `js/core/card-inheritance.js`, so the scanner
is testable against hand-built fixtures rather than only against the real
corpus — the same reason `card-inheritance` and `karl-transcript` are driven
with synthetic pages.

Three inputs, and **only one of them is hand-maintained**:

| Input | Source | Hand-maintained |
| ----- | ------ | --------------- |
| Files to scan | `git ls-files` → the 3 mirrors + tracked `.claude/skills/*/SKILL.md` | No |
| Claim types | the `CLAIMS` registry | **Yes** |
| Expected values | the filesystem, read at test time | No |

The hand-maintained axis shrinks from **(files × claims)** to **(claims)**.
That is the whole point: today's bug was a missing cell in the matrix, and the
matrix stops existing.

**Discovery reads `git ls-files`**, matching `build_scripts/docs-file-set.js`
and `tests/module-paths.test.js`. It inherits their property — an untracked
file is invisible — which is correct here: a new mirror is covered the moment
it is committed, with no list to update. It also inherits their hazard, that a
file must be tracked before the guard sees it, which the global floor below
partially covers.

## The CLAIMS registry

**The registry adopts the four regexes `doc-counts.test.js` already carries.**
They are field-proven against this corpus's false positives; new ones are not.
Each entry pairs one pattern with its filesystem deriver.

Registry phrases are **disambiguated noun phrases, never bare nouns** —
`repository-owned stylesheets`, not `stylesheets`. That single choice is what
keeps a runtime measurement out of the match set, and the existing test says so
in its own comment (`tests/doc-counts.test.js:199`): "Deliberately narrow: a
bare `/(\d+) pages/` also matches the plain-language budget".

### One regex is fixed

The e2e pattern is the one that failed and the only one changed:

```js
// before — misses "twenty-two Playwright e2e spec files"
/\*{0,2}([\w-]+)\*{0,2}\s+spec\s+files/gi

// after — tolerates up to 3 intervening tokens, each letter-initial but free
// to carry digits, periods and hyphens (so it can still cross "Node.js", "v2.1")
/\*{0,2}([\w-]+)\*{0,2}(?:\s+[A-Za-z][\w.-]*){0,3}\s+spec\s+files/gi
```

The gap is bounded at three letter-initial tokens, and `[\w.-]*` lets each of
those tokens itself contain digits, periods and hyphens — a period inside a
token is deliberately permitted, because this repo's own prose crosses tokens
like `Node.js`, `v2.1` and `e2e`. What the gap does **not** admit is a
punctuation character standing as its own whitespace-separated token, or a
sentence-ending character splitting what would otherwise be one token in two —
so it still cannot cross a clause boundary and capture an unrelated number
from the previous sentence.

### The capture must be number-anchored, and the gap must admit digits

Two rules, both established by testing the design rather than by reasoning
about it. The second one is the demonstrated bug; the first is a flaw found in
this design's own first draft.

**The capture group must match only number-shaped tokens.** The obvious
gap-tolerant fix — widening `([\w-]+)` and allowing intervening words —
captures the WRONG token, because the leftmost match wins:

```js
// captures "plus" from "plus twenty-three Playwright e2e spec files"
/\*{0,2}([\w-]+)\*{0,2}(?:\s+[A-Za-z][\w.-]*){0,3}\s+spec\s+files/gi
```

`[\w-]+` happily matches `plus`, then the gap absorbs
`twenty-three Playwright e2e`. `Number('plus')` is `NaN`, so the assertion
fails loudly rather than silently — better than the current bug, but it is a
false failure, not a correct check. The capture must therefore be an
alternation of digits and known number words, not any word.

**The gap must admit digits.** This is the actual cause of the miss, verified
by isolating it:

```
[A-Za-z.`-]+  matches "e2e"?  false
```

A gap class of letters-only cannot cross `e2e`, so
`twenty-three Playwright e2e spec files` never matches however the number
alternation is ordered. This repo's prose is full of digit-bearing tokens —
`e2e`, `h1`, `v2`, `SFDS` — so the gap token must be `[A-Za-z][\w.-]*`:
letter-initial, digits permitted after.

**Sorting the number-word alternation longest-first is a cheap precaution, not
a demonstrated fix.** It was asserted as the cause in this spec's first draft
and testing did not support it: regex backtracking recovers `twenty` →
`twenty-three` unaided. Keep the sort — it costs one line and removes a class
of reasoning about backtracking — but do not describe it as the bug, and do
not let it stand in for the two rules above, which are load-bearing.

## The ratchet

Floors are **per-(file, claim type), not one aggregate integer per file.** An
aggregate was tried first and rejected: once a file's TOTAL sits comfortably
above its floor, one claim type could stop matching entirely — its regex
silently drifting out of reach — while the file's other claim types carry the
aggregate over the line, and the ratchet would still pass. That is the exact
failure this feature exists to prevent, surviving in a more diffuse form.
Flooring each (file, type) pair closes that gap: a claim type with no floor
entry for a file is simply not floored there, which is correct — not every
file states every claim — but a floored one that drops out is caught
regardless of how healthy its siblings look.

Assertion order is load-bearing:

```
1. CLAIM_TYPE_FLOORS is non-empty              ← a broken table is not a clean run
2. found.length >= FLOOR[file][claimType]      ← fails FIRST, names the file AND the claim type
3. TOTAL >= GLOBAL_FLOOR                       ← the corpus cannot collapse wholesale
4. every found claim === filesystem
```

Value checking alone cannot catch a claim that stopped being *found*; that is
the whole lesson of `karl-blocks.test.js`, quoted in `CLAUDE.md`: "It asserts a
MINIMUM row count per type FIRST, because a doc-parsing regex that stops
matching does not fail — it stops checking, and reports zero rows on both
sides."

**The non-empty check exists for the same reason, one level up.** The
(file, claim type) floor table is flattened into `test.each` rows via
`Object.entries(CLAIM_FLOORS).flatMap(...)` rather than written as a literal
list, and `test.each([])(...)` generates ZERO test cases rather than failing —
confirmed against the Bun version this repo pins. So if the flattened table
were ever emptied, whether by deleting every `CLAIM_FLOORS` entry or by
breaking the `flatMap` itself, every floor assertion downstream would
silently stop existing and the suite would report a clean 0 failures. This
check is what turns that into a loud failure instead, and it has to run
*before* the `test.each` it is guarding.

Floors are committed integers, and **only for (file, claim type) pairs
carrying claims today**. A pair with no entry asserts nothing there, so the
skill files with no counts get no entry at all. They are still scanned: the
ratchet catches a *lost* claim, value checking catches a *wrong* one, and a
skill that newly acquires a stale count is caught by the second even with no
floor of its own.

`GLOBAL_FLOOR` exists so that a discovery bug — a broken `git ls-files` call,
a bad path join — cannot pass by finding nothing anywhere. Both
`build_scripts/docs-file-set.js` callers already treat an empty file list as a
broken derivation rather than a clean run, for the same reason.

## Failure output

Today's bug produced no signal at all. Every failure must name the file, the
claim, and both numbers:

```
copilot-instructions.md: "spec files" claims 22, filesystem has 23
copilot-instructions.md: matched 1 claim, floor is 2
```

The second line is the one the current design cannot express: **a claim
stopped being checked.**

## Migration

The five `test.each` blocks collapse into one scanner-driven loop.

**Hard requirement: no coverage regression.** Snapshot the current
(file × claim) matrix that the existing tests assert, and diff it against the
matrix the scanner produces. Replacing a hand list with discovery is exactly
where coverage silently drops, and an implementation that quietly checks fewer
pairs than before would be this bug a second time.

## Proof

Mutation-proven, per repo convention — this PR exists because two assertions
could not fail, so its own guard must be shown to.

| Mutation | Expected |
| -------- | -------- |
| Wrong spec count in one mirror | RED — value check, naming that file |
| A claim rephrased out of regex reach | RED — **ratchet**, before any value check |
| New `tests/e2e/*.spec.js`, docs untouched | RED — every mirror carrying that claim |
| Capture widened to `([\w-]+)` | RED — captures `plus`, `NaN` vs 23 |
| Gap class narrowed to letters-only | RED — **ratchet**: the claim goes unseen |
| `Emotion added 15 stylesheets` | **GREEN** — false-positive fixture |
| `nine pages reported hitting a reading target` | **GREEN** — false-positive fixture |

The three false-positive fixtures are committed as test data so that a later
"improvement" to a regex cannot silently re-admit them.

### The PR demonstrates itself

Adding `build_scripts/doc-claims.js` and its test file moves the unit-test
count 52 → 53. That must land in all three mirrors **and** in `package.json`'s
explicit `test` list, which is enumerated rather than globbed. If any is
missed, the new guard fails on its own introducing commit — which is the
cleanest available evidence that it works.

## Non-goals

Stated explicitly so they are not mistaken for solved:

- **The mirror count is unchanged.** Three prose files still carry real
  content and are still hand-synced. This kills the count drift class, not the
  mirrors.
- **Non-count prose stays unguarded.** The rot that hit `.cursor` and
  `.windsurf` was architecture prose describing a bundler the repo had
  removed. No regex catches that, and none is proposed.
- **Skills carrying non-count facts stay hand-synced** against `AGENTS.md`.

## Risks

- **A new claim type is added to the docs and never registered.** It is
  unguarded, and the ratchet does not see it because it never counted it.
  Mitigated only by the registry being short and reviewed; not eliminated.
- **The 3-word gap admits a false positive** some future sentence creates. The
  three-token bound and the requirement that each token be letter-initial
  narrow this; the false-positive fixtures are the regression net.
- **Floors are committed integers and can be lowered.** Lowering one to make a
  build pass silently reduces coverage. The global floor limits the blast
  radius; a reviewer noticing a decremented floor is the real control.

## PR shape

One PR, tooling only:

- `build_scripts/doc-claims.js` — the scanner
- `tests/doc-claims.test.js` — fixture-driven tests including the ordering
  trap and the three false positives
- `tests/doc-counts.test.js` — rewired to the scanner, coverage matrix diffed
- `package.json` — the new test file named in the explicit `test` list
- count corrections in the three mirrors, as the guard demands them

**One incidental fix was planned here and voided during execution.** The
comment at `tests/doc-counts.test.js:199` illustrated its regex with `19
pages`, from when the corpus held nineteen — the corpus holds 29, and this
spec originally called for correcting that worked example in place as a
stale-example fix riding along with the rewrite. There turned out to be
nothing to correct: that comment lived inside the hand-maintained `test.each`
block this rewrite deletes wholesale, so the stale example left the repo along
with the block that held it rather than being edited. Its underlying
rationale was worth keeping regardless of the worked example's staleness — a
bare `/(\d+) pages/` also matches the plain-language budget's threshold
("any one rule failing at most 8 pages"), not a count of what is on disk — so
it was rescued rather than discarded: it now lives in
`build_scripts/doc-claims.js`'s `CLAIMS` registry comment, attached to the
`pages` entry it explains.

No prose reorganization. The three pointer files
(`.cursor/rules/repo-context.mdc`, `.windsurfrules`, `.codex/AGENTS.md`) are
already correct and are not touched.
