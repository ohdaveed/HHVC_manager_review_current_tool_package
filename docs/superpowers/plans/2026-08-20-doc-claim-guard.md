# Doc Claim Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a count stated in one instruction mirror but not another fail CI, by replacing `doc-counts.test.js`'s hand-maintained (file × claim) matrix with a scanner that discovers its files from `git ls-files` and asserts a per-file coverage floor before checking any value.

**Architecture:** One new pure module, `build_scripts/doc-claims.js`, owning the file discovery, the `CLAIMS` registry and the scan. `tests/doc-counts.test.js` becomes its caller, keeping its four non-count tests unchanged. CommonJS, like everything else under `build_scripts/`.

**Tech Stack:** Bun test, plain CommonJS, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-20-doc-claim-guard-design.md`

## Global Constraints

- **CommonJS under `build_scripts/`.** `server.ts` named-imports from these modules; ESM there broke every server suite once. Use `module.exports`, never `export`.
- **No new npm dependencies.**
- **Prettier is a CI gate:** no semicolons, single quotes, 2-space indent, `printWidth: 100`, ES5 trailing commas. Run `bun run format` before every commit.
- **oxlint core rules gate CI** via `.oxlintrc.ci.json` over `js pages build_scripts tests`.
- **Comment voice:** module header stating role and load-order; JSDoc with `@param`/`@returns`; comments justify *why*, not *what*.
- **Never hardcode a count in a test.** Derive from the filesystem — the repo's own rule, and the subject of this work.
- **Verification is evidence, not assertion.** Every "verify it fails" step must actually be run and its output read.

---

### Task 1: The scanner module

**Files:**
- Create: `build_scripts/doc-claims.js`
- Test: `tests/doc-claims.test.js`
- Modify: `package.json` — the explicit `test` list
- Modify: `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md` — unit-test count 52 → 53

**Why this task touches the docs.** Creating `tests/doc-claims.test.js` makes the unit-test count 53 the instant the file exists, which breaks two assertions that ALREADY exist in `tests/doc-counts.test.js` — `runs every tests/*.test.js on disk` and `states the real number of unit-test files`. Leaving them red until a later task would commit a broken tree, so the count updates belong here. This is the guard working on its own introducing commit.

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `NUMBER_WORDS: Record<string, number>` — used by the coverage test
  - `numberPattern(): string` — the number alternation source, longest-first
  - `scanText(text): Array<{ id: string, value: number }>`
  - `currentClaimFiles(): string[]` — repo-relative paths, derived from git

  `CLAIMS` stays module-internal: nothing outside consumes it, and an unused
  export is dead surface. Note `pattern` is a FUNCTION on each entry, not a
  regex — a shared `/g` regex carries `lastIndex` and silently skips matches on
  its second use, so `scanText` must build a fresh one per scan.

- [ ] **Step 1: Write the failing test**

Create `tests/doc-claims.test.js`:

```js
import { describe, test, expect } from 'bun:test'
const { scanText, numberPattern, NUMBER_WORDS } = require('../build_scripts/doc-claims.js')

describe('scanText', () => {
  test('reads a spelled-out count stated immediately before its noun', () => {
    expect(scanText('twenty-three spec files, all UI-driven')).toEqual([
      { id: 'e2e-specs', value: 23 },
    ])
  })

  // The exact string that shipped a wrong count past CI. Two words sit between
  // the number and the noun, and one of them carries a DIGIT — a letters-only
  // gap class cannot cross `e2e`, which is what actually hid this claim.
  test('reads a count separated from its noun by digit-bearing words', () => {
    expect(scanText('plus twenty-three Playwright e2e spec files.')).toEqual([
      { id: 'e2e-specs', value: 23 },
    ])
  })

  // Leftmost-match: a capture group of [\w-]+ takes `plus` and the gap absorbs
  // the real number, yielding NaN. The capture must be number-anchored.
  test('never captures a non-numeric word as the count', () => {
    const values = scanText('plus twenty-three Playwright e2e spec files.').map((c) => c.value)
    for (const value of values) expect(Number.isNaN(value)).toBe(false)
  })

  test('reads bold digits', () => {
    expect(scanText('runs **52** Bun unit-test files')).toEqual([
      { id: 'unit-tests', value: 52 },
    ])
  })

  test('reads a phrase wrapped across a line break', () => {
    expect(scanText('plus twenty-three\nPlaywright e2e spec files.')).toEqual([
      { id: 'e2e-specs', value: 23 },
    ])
  })

  test('returns an empty array for prose carrying no claim', () => {
    expect(scanText('The 1700px breakpoint is measured.')).toEqual([])
  })
})

describe('false positives that must never be read as claims', () => {
  // A runtime measurement of what Emotion injected, NOT the repo's sheet count.
  // hhvc-react-islands deliberately does not restate that count.
  test('ignores a runtime stylesheet measurement', () => {
    expect(scanText('while Emotion added 15 stylesheets. It holds')).toEqual([])
  })

  // A historical finding about reading levels, not the page inventory.
  test('ignores a historical page finding', () => {
    expect(scanText('so nine pages reported hitting a reading target they miss')).toEqual([])
  })

  test('ignores an unrelated use of the word pages', () => {
    expect(scanText('one for conflicted pages')).toEqual([])
  })
})

describe('numberPattern', () => {
  // Cheap precaution rather than a demonstrated fix: backtracking recovers the
  // unsorted case unaided. It costs one line and removes a whole class of
  // reasoning about backtracking, so it is pinned.
  test('orders the alternation longest-first', () => {
    const words = numberPattern()
      .split('|')
      .filter((token) => /^[a-z]/.test(token))
    for (let i = 1; i < words.length; i += 1) {
      expect(words[i - 1].length).toBeGreaterThanOrEqual(words[i].length)
    }
  })

  test('covers every word in NUMBER_WORDS', () => {
    const source = numberPattern()
    for (const word of Object.keys(NUMBER_WORDS)) expect(source).toContain(word)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/doc-claims.test.js`
Expected: FAIL — `Cannot find module '../build_scripts/doc-claims.js'`

- [ ] **Step 3: Write the implementation**

Create `build_scripts/doc-claims.js`:

```js
// Scanner for the counts the instruction mirrors quote about this repo.
//
// WHY THIS EXISTS. tests/doc-counts.test.js used to hold a hand-maintained
// (file x claim) matrix of test.each entries. PR #177 moved the e2e spec count
// from twenty-two to twenty-three; two of the three mirrors were updated and
// CI went green, because .github/copilot-instructions.md had simply been left
// off the list for that one claim. Nothing detects an omission from a
// hand-written list — that is what a hand-written list is.
//
// So the file list is DERIVED here (git ls-files) and only the CLAIMS registry
// below is written by hand. The hand-maintained axis shrinks from
// (files x claims) to (claims).
//
// CommonJS on purpose: everything under build_scripts/ is, because server.ts
// named-imports these modules and Bun 1.3.14 stopped letting CJS require ESM.

const { execFileSync } = require('node:child_process')
const { join } = require('node:path')

const ROOT = join(__dirname, '..')

/** Spelled-out numbers the docs actually use. Digits are handled separately. */
const NUMBER_WORDS = {
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  'twenty-one': 21,
  'twenty-two': 22,
  'twenty-three': 23,
  'twenty-four': 24,
  'twenty-five': 25,
  'twenty-six': 26,
  'twenty-seven': 27,
  'twenty-eight': 28,
  'twenty-nine': 29,
  thirty: 30,
  'thirty-one': 31,
  'thirty-two': 32,
  'thirty-three': 33,
  'thirty-four': 34,
  'thirty-five': 35,
  'thirty-six': 36,
  'thirty-seven': 37,
  'thirty-eight': 38,
  'thirty-nine': 39,
  forty: 40,
  fifty: 50,
  'fifty-one': 51,
  'fifty-two': 52,
  'fifty-three': 53,
}

/**
 * The number alternation, sorted longest-first.
 *
 * @returns {string} regex source matching digits or a spelled-out number
 */
function numberPattern() {
  const words = Object.keys(NUMBER_WORDS).sort((a, b) => b.length - a.length)
  return `\\d+|${words.join('|')}`
}

// Words permitted between the number and its noun. Letter-initial so it cannot
// swallow the number itself, but \w after — this repo's prose is full of
// digit-bearing tokens (e2e, h1, v2), and a letters-only class cannot cross
// `e2e`, which is precisely what hid the claim that shipped wrong.
const GAP = '(?:\\s+[A-Za-z][\\w.-]*){0,3}'

// Bounded at three words and admitting no punctuation, so a match cannot cross
// a clause boundary and capture a number from the previous sentence.

/**
 * The registry — the ONLY hand-maintained axis.
 *
 * Phrases are disambiguated, never bare nouns: `the N stylesheets` rather than
 * `stylesheets`, so a runtime measurement ("Emotion added 15 stylesheets") is
 * not read as a claim about this repo.
 */
const CLAIMS = [
  {
    id: 'unit-tests',
    deriver: 'unitTestFiles',
    pattern: () =>
      new RegExp(`\\*{0,2}(${numberPattern()})\\*{0,2}${GAP}\\s+unit-test\\s+files`, 'gi'),
  },
  {
    id: 'e2e-specs',
    deriver: 'e2eSpecFiles',
    pattern: () =>
      new RegExp(`\\*{0,2}(${numberPattern()})\\*{0,2}${GAP}\\s+spec\\s+files`, 'gi'),
  },
  {
    id: 'pages',
    deriver: 'pageFiles',
    pattern: () => new RegExp(`\\*\\*(\\d+)\\s+pages\\*\\*|\\bthe\\s+(\\d+)\\s+pages\\b`, 'g'),
  },
  {
    id: 'stylesheets',
    deriver: 'styleSheets',
    pattern: () =>
      new RegExp(`\\bthe\\s+\\*{0,2}(${numberPattern()})\\*{0,2}\\s+stylesheets`, 'gi'),
  },
]

/**
 * Every count claim in one document.
 *
 * @param {string} text
 * @returns {Array<{id: string, value: number}>}
 */
function scanText(text) {
  const found = []
  for (const claim of CLAIMS) {
    for (const match of text.matchAll(claim.pattern())) {
      const raw = match.slice(1).find((group) => group !== undefined)
      if (raw === undefined) continue
      found.push({ id: claim.id, value: NUMBER_WORDS[raw.toLowerCase()] ?? Number(raw) })
    }
  }
  return found
}

/**
 * Files that claim to describe the repo as it is NOW.
 *
 * Derived from git ls-files rather than globbed, matching
 * build_scripts/docs-file-set.js. An untracked file is invisible, which is
 * correct: a new mirror is covered the moment it is committed.
 *
 * docs/ is deliberately excluded — its dated notes are frozen records, and a
 * count that was right on its date stays in the file by policy.
 *
 * @returns {string[]} repo-relative paths
 */
function currentClaimFiles() {
  const tracked = execFileSync('git', ['ls-files', '.claude/skills/*/SKILL.md'], {
    cwd: ROOT,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean)
  return ['AGENTS.md', 'CLAUDE.md', '.github/copilot-instructions.md', ...tracked].sort()
}

module.exports = { NUMBER_WORDS, numberPattern, scanText, currentClaimFiles }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/doc-claims.test.js`
Expected: PASS, all 12 tests.

If `ignores an unrelated use of the word pages` fails, the `pages` pattern's `\bthe\s+` anchor is missing — restore it rather than widening the test.

- [ ] **Step 5: Verify the scanner against the real corpus**

Run:

```bash
bun -e '
const {scanText,currentClaimFiles}=require("./build_scripts/doc-claims.js")
const fs=require("fs")
for (const f of currentClaimFiles()) {
  const c=scanText(fs.readFileSync(f,"utf8"))
  if (c.length) console.log(f, JSON.stringify(c))
}'
```

Expected exactly:

```
.github/copilot-instructions.md [{"id":"unit-tests","value":52},{"id":"unit-tests","value":52},{"id":"e2e-specs","value":23}]
AGENTS.md [{"id":"unit-tests","value":52},{"id":"e2e-specs","value":23},{"id":"pages","value":29},{"id":"pages","value":29},{"id":"stylesheets","value":11}]
CLAUDE.md [{"id":"unit-tests","value":52},{"id":"e2e-specs","value":23},{"id":"pages","value":29},{"id":"pages","value":29},{"id":"pages","value":29},{"id":"stylesheets","value":11}]
```

No skill file may appear. If one does, its phrase is a false positive — tighten the registry pattern and add a fixture in Step 1, do not exempt the file.

- [ ] **Step 6: Register the new test file and correct the count it moved**

The `test` script enumerates its files rather than globbing, so a new test file runs only once named there — it passes locally by hand and covers nothing in CI until then.

```bash
bun -e '
const fs=require("fs"); const p=JSON.parse(fs.readFileSync("package.json","utf8"))
if (!p.scripts.test.includes("tests/doc-claims.test.js"))
  p.scripts.test = p.scripts.test.trimEnd() + " tests/doc-claims.test.js"
fs.writeFileSync("package.json", JSON.stringify(p,null,2)+"\n")'

# 2. the count is now 53. NOT sed: the claim in copilot-instructions.md is
#    line-wrapped ("**52** Bun unit-test" / "files"), and sed is line-based,
#    so it would silently miss one of the four. \s+ between every token is
#    the same rule doc-counts.test.js's own header states for this reason.
bun -e '
const fs=require("fs")
const re=/(\*{0,2})52(\*{0,2})(\s+(?:Bun\s+)?unit-test\s+files)/g
for (const f of ["AGENTS.md","CLAUDE.md",".github/copilot-instructions.md"]) {
  const t=fs.readFileSync(f,"utf8")
  const hits=(t.match(re)||[]).length
  fs.writeFileSync(f, t.replace(re,(m,a,b,rest)=>a+"53"+b+rest))
  console.log(f, "replaced", hits)
}'
```

Expected output — **four** replacements, not three; `copilot-instructions.md`
carries two claims and one of them is wrapped:

```
AGENTS.md replaced 1
CLAUDE.md replaced 1
.github/copilot-instructions.md replaced 2
```

Then confirm — do not assume the `sed` matched:

```bash
ls tests/*.test.js | wc -l    # expect 53
grep -ozP "\*{0,2}52\*{0,2}\s+(Bun\s+)?unit-test\s+files" \
  AGENTS.md CLAUDE.md .github/copilot-instructions.md && echo "LEFTOVER 52 CLAIM" || echo "none left"
```

Expected: `53` on disk and `none left`. `grep -zP` is used rather than plain
`grep` for the same reason the replacement is: the claim can wrap, and a
line-based search reports a clean file that is not clean.

- [ ] **Step 7: Confirm the existing suite is green again**

Run: `bun test tests/doc-counts.test.js tests/doc-claims.test.js`
Expected: PASS. The two assertions that broke when the file appeared must both be green before committing.

- [ ] **Step 8: Format, lint, commit**

```bash
bun run format
bun run format:check && bun run lint:js
git add build_scripts/doc-claims.js tests/doc-claims.test.js package.json AGENTS.md CLAUDE.md .github/copilot-instructions.md
git commit -m "feat: add a doc-claim scanner that derives its own file list

The hand-maintained (file x claim) matrix in doc-counts.test.js let PR #177
ship a wrong e2e spec count: copilot-instructions.md was left off the list for
that one claim. Files are derived from git ls-files here, so only the CLAIMS
registry is written by hand.

Two matching rules are load-bearing and both are pinned by tests. The capture
is number-anchored, because a [\\\\w-]+ capture takes \"plus\" from \"plus
twenty-three ... spec files\" and yields NaN. And the gap admits digits,
because a letters-only class cannot cross \"e2e\" — the actual cause of the
missed claim."
```

---

### Task 2: Rewire doc-counts to the scanner, with the ratchet

**Files:**
- Modify: `tests/doc-counts.test.js` — replace the four count `test.each` blocks

**Interfaces:**
- Consumes: `scanText`, `currentClaimFiles` from Task 1.
- Produces: nothing consumed later.

- [ ] **Step 1: Record the current coverage matrix**

Replacing a hand list with discovery is exactly where coverage silently drops, so capture the baseline BEFORE editing:

```bash
bun test tests/doc-counts.test.js 2>&1 | grep -E "states the real|repeats one|names every|opens with" | sort > /tmp/doc-counts-before.txt
cat /tmp/doc-counts-before.txt
```

Expected: 11 assertions across the four count claims plus the non-count tests.

- [ ] **Step 2: Write the failing ratchet test**

In `tests/doc-counts.test.js`, add above the existing `describe('counts quoted in the instruction docs')`:

```js
const { scanText, currentClaimFiles } = require('../build_scripts/doc-claims.js')

/* Minimum claims each file must still yield.
 *
 * Asserted BEFORE any value comparison, and that order is the point. A
 * doc-parsing regex that stops matching does not fail — it stops checking, and
 * every remaining assertion passes. tests/karl-blocks.test.js asserts a
 * minimum row count first for exactly this reason.
 *
 * Only files carrying claims today get an entry: a floor of 0 asserts nothing.
 * Skill files are still SCANNED — the ratchet catches a lost claim, and the
 * value check below catches a wrong one even with no floor.
 *
 * Lowering a number here silently reduces coverage. Do not adjust one to make
 * a build pass; fix the doc or the pattern. */
const CLAIM_FLOORS = {
  'AGENTS.md': 5,
  'CLAUDE.md': 6,
  '.github/copilot-instructions.md': 3,
}
const GLOBAL_FLOOR = 14

const derivedCounts = {
  unitTestFiles: unitTestFiles.length,
  e2eSpecFiles: e2eSpecFiles.length,
  pageFiles: pageFiles.length,
  styleSheets: styleSheets.length,
}
const DERIVER_BY_CLAIM = {
  'unit-tests': 'unitTestFiles',
  'e2e-specs': 'e2eSpecFiles',
  pages: 'pageFiles',
  stylesheets: 'styleSheets',
}

describe('doc claims, across every file that describes the repo as it is now', () => {
  const scanned = currentClaimFiles().map((name) => ({ name, claims: scanText(read(name)) }))

  test('scans a non-empty file set', () => {
    // An empty set is a broken derivation, not a clean run — the same reading
    // build_scripts/docs-file-set.js's callers take.
    expect(scanned.length).toBeGreaterThan(3)
  })

  test.each(Object.entries(CLAIM_FLOORS))('%s still yields at least %d claims', (name, floor) => {
    const entry = scanned.find((file) => file.name === name)
    expect(entry).toBeDefined()
    expect(entry.claims.length).toBeGreaterThanOrEqual(floor)
  })

  test('the corpus as a whole has not lost claims', () => {
    const total = scanned.reduce((sum, file) => sum + file.claims.length, 0)
    expect(total).toBeGreaterThanOrEqual(GLOBAL_FLOOR)
  })

  test('every claim found anywhere matches the filesystem', () => {
    const wrong = []
    for (const { name, claims } of scanned) {
      for (const claim of claims) {
        const expected = derivedCounts[DERIVER_BY_CLAIM[claim.id]]
        if (claim.value !== expected) {
          wrong.push(`${name}: "${claim.id}" claims ${claim.value}, filesystem has ${expected}`)
        }
      }
    }
    expect(wrong).toEqual([])
  })
})
```

- [ ] **Step 3: Run it and read the failure**

Run: `bun test tests/doc-counts.test.js`
Expected: FAIL on `.github/copilot-instructions.md still yields at least 3 claims` **or** on the value check, depending on the corpus state.

Read the message. It must name the file and both numbers — that naming is the deliverable, since the original bug produced no signal at all.

- [ ] **Step 4: Delete the four superseded count blocks**

Remove exactly these four `test.each` blocks from `describe('counts quoted in the instruction docs')`:
`states the real number of unit-test files`, `states the real number of e2e spec files`, `states the real number of pages`, `states the real number of stylesheets outside the ordering paragraph`.

**Keep** every other test in the file: `repeats one consistent count through the ordering paragraph`, `every stylesheet opens with the banner comment the docs point at`, `CLAUDE.md names every unit-test file it claims to list`, and the whole `package.json's explicit test list` describe. They assert things the scanner does not.

Keep `countsIn` and `NUMBER_WORDS` in the file — the ordering-paragraph test still uses them.

- [ ] **Step 5: Verify no coverage regression**

```bash
bun test tests/doc-counts.test.js tests/doc-claims.test.js 2>&1 | tail -5
diff <(grep -E "repeats one|names every|opens with" /tmp/doc-counts-before.txt) \
     <(bun test tests/doc-counts.test.js 2>&1 | grep -E "repeats one|names every|opens with" | sort)
```

Expected: all pass; the `diff` is empty, proving every non-count test survived.

- [ ] **Step 6: Commit**

```bash
bun run format && bun run format:check && bun run lint:js
git add tests/doc-counts.test.js
git commit -m "test: assert a coverage floor before checking any doc claim

The four count blocks collapse into one scanner-driven loop over files derived
from git ls-files, so a mirror cannot be omitted from a claim's coverage.

The floors are asserted FIRST. A regex that stops matching does not fail, it
stops checking, so a value-only check cannot catch a claim that went out of
reach — the karl-blocks.test.js lesson applied here.

Non-count tests are untouched; the coverage matrix was diffed before and after."
```

---

### Task 3: Mutation-prove the guard, and fix the stale worked example

**Files:**
- Modify: `tests/doc-counts.test.js:199` region — the stale `19 pages` comment

**Interfaces:**
- Consumes: everything from Tasks 1-2.
- Produces: nothing.

- [ ] **Step 1: Prove a wrong count fails**

```bash
sed -i 's/twenty-three Playwright e2e spec files/twenty-two Playwright e2e spec files/' .github/copilot-instructions.md
bun test tests/doc-counts.test.js 2>&1 | grep -E "claims 22|fail"
git checkout .github/copilot-instructions.md
```

Expected: RED, naming `.github/copilot-instructions.md: "e2e-specs" claims 22, filesystem has 23`.
**This is the exact bug that shipped.** If it does not go red, stop — the guard does not work.

- [ ] **Step 2: Prove a rephrased claim trips the ratchet**

```bash
sed -i 's/twenty-three Playwright e2e spec files/a good number of Playwright specs/' .github/copilot-instructions.md
bun test tests/doc-counts.test.js 2>&1 | grep -E "at least 3|fail"
git checkout .github/copilot-instructions.md
```

Expected: RED on the floor for that file — a claim went unchecked rather than wrong. Under the old design this was green.

- [ ] **Step 3: Prove the capture must stay number-anchored**

In `build_scripts/doc-claims.js`, temporarily change the `e2e-specs` capture from `(${numberPattern()})` to `([\\w-]+)`.

```bash
bun test tests/doc-claims.test.js 2>&1 | grep -E "never captures|fail"
```

Expected: RED on `never captures a non-numeric word as the count`. Revert with `git checkout build_scripts/doc-claims.js`.

- [ ] **Step 4: Prove the gap must admit digits**

In `build_scripts/doc-claims.js`, temporarily change `GAP` to `'(?:\\s+[A-Za-z.-]+){0,3}'`.

```bash
bun test tests/doc-claims.test.js tests/doc-counts.test.js 2>&1 | grep -E "digit-bearing|at least 3|fail"
```

Expected: RED on `reads a count separated from its noun by digit-bearing words` AND on the copilot floor. Revert with `git checkout build_scripts/doc-claims.js`.

- [ ] **Step 5: Prove a new spec file is caught**

```bash
printf "const { test } = require('@playwright/test')\n" > tests/e2e/zz-mutation-probe.spec.js
bun test tests/doc-counts.test.js 2>&1 | grep -E "claims 23, filesystem has 24|fail"
rm tests/e2e/zz-mutation-probe.spec.js
```

Expected: RED in all three mirrors — filesystem 24, docs 23.

- [ ] **Step 6: Fix the stale worked example**

The comment at `tests/doc-counts.test.js:199` still illustrates its regex with `19 pages`, from when the corpus held nineteen; it holds 29. The assertion is derived so the code is correct and only the example is stale — but a stale example inside the guard this PR rewrites is the same defect class.

Replace `19` with `29` in both places in that comment (`holds **19 pages** under` and `across the 19 pages`).

- [ ] **Step 7: Full suite and commit**

```bash
bun run format && bun run format:check && bun run lint:js && bun run validate
bun run test 2>&1 | tail -5
git add -A
git commit -m "test: mutation-prove the doc-claim guard

Five mutations, each verified red, and the reverts confirmed clean:

- copilot count set to 22          -> RED, naming the file and both numbers
- the claim rephrased out of reach -> RED on the FLOOR, green under the old design
- capture widened to [\\\\w-]+       -> RED, it captures \"plus\" and yields NaN
- gap narrowed to letters-only     -> RED, it cannot cross \"e2e\"
- a spec file added, docs untouched-> RED in all three mirrors

Also corrects the worked example at doc-counts.test.js:199, which still
illustrated its regex with 19 pages against a corpus of 29. The assertion is
derived so only the comment was stale, but a stale example inside this guard is
the same defect class it exists to catch."
```

- [ ] **Step 8: Confirm the count moved and the docs agree**

Adding `tests/doc-claims.test.js` moves the unit-test count 52 → 53. The guard should already have forced this; confirm it landed everywhere rather than assuming:

```bash
ls tests/*.test.js | wc -l          # expect 53
grep -oh "5[0-9] \(Bun \)\?unit-test files" AGENTS.md CLAUDE.md .github/copilot-instructions.md | sort -u
bun test tests/doc-counts.test.js 2>&1 | tail -3
```

Expected: `53` on disk, every mirror saying 53, all tests green. If a mirror still says 52 and the suite is green, the guard has a hole — stop and fix it, because that is this PR's own bug reappearing.

- [ ] **Step 9: Push and open the PR**

```bash
git push -u origin HEAD
gh pr create --fill
```

Watch CI to green per the repo's Definition of Done.
