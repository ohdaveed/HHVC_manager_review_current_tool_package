// Drift guard for the counts written into the instruction docs.
//
// CLAUDE.md and AGENTS.md quote exact numbers — how many pages, how many
// unit-test files, how many e2e specs — because a vague doc is a useless one.
// The cost is that every number is a claim nobody re-checks, and this repo has
// shipped several wrong ones: "7 Bun unit files" and "10 files" against a real
// 19, and ci.yml describing "the 9 Playwright specs" when there were 14. Each
// was correct when written.
//
// Nothing about prose makes it fail when the filesystem moves, so this file
// does. It reads the counts back out of the docs and compares them to what is
// actually on disk.
//
// Deliberately NOT a general "every number in the docs" checker. It pins the
// handful that describe countable things on disk; a number inside a prose
// explanation (a contrast ratio, a byte limit) is not this file's business.
import { describe, test, expect } from 'bun:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
const { scanText, currentClaimFiles } = require('../build_scripts/doc-claims.js')

const ROOT = join(import.meta.dir, '..')
const read = (name) => readFileSync(join(ROOT, name), 'utf8')

const pkg = JSON.parse(read('package.json'))
const CLAUDE_MD = read('CLAUDE.md')
const AGENTS_MD = read('AGENTS.md')

/** Test files actually on disk. */
const unitTestFiles = readdirSync(join(ROOT, 'tests'))
  .filter((name) => name.endsWith('.test.js'))
  .sort()

/** Test files package.json's `test` script actually runs. */
const namedTestFiles = (pkg.scripts.test.match(/tests\/[\w-]+\.test\.js/g) || [])
  .map((path) => path.replace('tests/', ''))
  .sort()

const e2eSpecFiles = readdirSync(join(ROOT, 'tests', 'e2e'))
  .filter((name) => name.endsWith('.spec.js'))
  .sort()

const pageFiles = readdirSync(join(ROOT, 'pages')).filter((name) => name.endsWith('.js'))

/* Stylesheets on disk. CLAUDE.md and AGENTS.md both say "There are N
   repository-owned stylesheets" and then repeat that N six more times in the
   same paragraph — and unlike the counts above, nothing checked it. It drifted
   the first time a stylesheet was added: css/karl-guide.css landed with both
   docs still saying ten, in the paragraph that carries the load-bearing
   "sfds.css first, theme.css last" ordering rule, so an agent reading the
   canon was told a file that exists does not.

   The paragraph also makes a claim ABOUT those files rather than merely
   counting them — "each of the N opens with a banner comment naming what it
   owns" — and explicitly tells the reader to read those banners INSTEAD of a
   table here. That is a real dependency, not a flourish: it is the argument
   for having deleted the table, so a sheet with no banner leaves the doc
   pointing at nothing. css/karl-guide.css was exactly that, opening straight
   into `.karl-guide {`. Both halves are asserted below. */
const styleSheets = readdirSync(join(ROOT, 'css'))
  .filter((name) => name.endsWith('.css'))
  .sort()

// Deliberately a SEPARATE copy from build_scripts/doc-claims.js's exported
// NUMBER_WORDS, not an import of it, even though this file already imports
// scanText/currentClaimFiles from that module and the two tables overlap
// word-for-word from `ten` through `forty`. The "repeats one consistent
// count" test below (search NUMBER_WORDS starts at ten) depends on this
// table's LOWER bound being exactly `ten` — its comment explains that "two
// positions", "six dependency sheets", "three @sfgov/design-system sheets"
// and "one-line" in the ordering paragraph are safe from being swept into a
// stylesheet-count claim only because they all fall below that floor.
// Swapping in the exported table would not break that today (it also starts
// at `ten`), but it would silently couple a test about doc PROSE STRUCTURE to
// a table whose real job is claim-scanning coverage — someone extending the
// scanner's vocabulary downward past `ten` for an unrelated claim type would
// have no reason to know it also widens what this file's ordering-paragraph
// regex sweeps up, and the failure would show up here, far from the edit.
// Kept separate and untouched below `forty` (this file never needs `fifty`+),
// so this table's own floor stays a fact a reader of THIS file can see.
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
}

describe("package.json's explicit test list", () => {
  // The `test` script names its files rather than globbing, so a new test file
  // covers nothing until it is added there. It passes locally when invoked by
  // hand, which is exactly what makes the omission easy to miss.
  test('runs every tests/*.test.js on disk', () => {
    expect(namedTestFiles).toEqual(unitTestFiles)
  })

  test('names no test file that does not exist', () => {
    // Covered by the equality above, but asserted separately so a typo in the
    // script reports as a typo rather than as a missing test.
    for (const name of namedTestFiles) {
      expect(unitTestFiles).toContain(name)
    }
  })
})

/* Minimum claims each (file, claim type) pair must still yield.
 *
 * Per-claim-type, not one aggregate integer per file. An aggregate was tried
 * first and rejected: once a file's TOTAL sits comfortably above its floor,
 * one claim type could stop matching entirely — its regex silently drifting
 * out of reach — while the file's other claim types carry the aggregate over
 * the line, and the ratchet would still pass. That is the exact failure this
 * feature exists to prevent, surviving in a more diffuse form. Flooring each
 * (file, type) pair closes that gap: a claim type with no floor entry for a
 * file is simply not floored there, which is correct — not every file states
 * every claim — but a floored one that drops out is caught regardless of how
 * healthy its siblings look.
 *
 * Asserted BEFORE any value comparison, and that order is the point. A
 * doc-parsing regex that stops matching does not fail — it stops checking, and
 * every remaining assertion passes. tests/karl-blocks.test.js asserts a
 * minimum row count first for exactly this reason.
 *
 * Only (file, claim type) pairs carrying claims today get an entry: a claim
 * type absent from a file's object is simply not floored there, which is
 * correct — not every file states every claim. Skill files carry no entry at
 * all and are still SCANNED — the "every claim found anywhere matches the
 * filesystem" test below covers them regardless of floor, so an unfloored
 * file is not an unchecked one.
 *
 * Lowering a number here silently reduces coverage. Do not adjust one to make
 * a build pass; fix the doc or the pattern.
 *
 * `.github/copilot-instructions.md` earns floors despite being a deliberate
 * POINTER doc — no file inventories, no architecture summary, per the canon
 * section governing it — because it still quotes counts, and until a scanner
 * read it nothing did: it once sat claiming 33 unit-test files against a real
 * 36. A pointer being unchecked is exactly the rot the pointer convention
 * exists to avoid. It carries no `pages`/`stylesheets` entry because it makes
 * no such claim, not because one went uncounted. */
const CLAIM_FLOORS = {
  'AGENTS.md': { 'unit-tests': 1, 'e2e-specs': 1, pages: 2, stylesheets: 1 },
  'CLAUDE.md': { 'unit-tests': 1, 'e2e-specs': 1, pages: 3, stylesheets: 1 },
  '.github/copilot-instructions.md': { 'unit-tests': 2, 'e2e-specs': 1 },
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

// Flattened (file, floor, claimType) triples for test.each — one row per
// floored claim type per file, rather than one row per file. Floor sits
// before claimType so the title's %d/%s placeholders line up with each
// row's own types in left-to-right order (test.each substitutes positionally
// against the row, not against the callback's parameter names).
const CLAIM_TYPE_FLOORS = Object.entries(CLAIM_FLOORS).flatMap(([name, floors]) =>
  Object.entries(floors).map(([claimId, floor]) => [name, floor, claimId])
)

describe('doc claims, across every file that describes the repo as it is now', () => {
  const scanned = currentClaimFiles().map((name) => ({ name, claims: scanText(read(name)) }))

  test('scans a non-empty file set', () => {
    // An empty set is a broken derivation, not a clean run — the same reading
    // build_scripts/docs-file-set.js's callers take.
    expect(scanned.length).toBeGreaterThan(3)
  })

  test('floors a non-empty (file, claim type) table', () => {
    // Same reading as the file-set check above, and for the same reason: an
    // empty table is a broken derivation, not a clean run. Confirmed against
    // Bun 1.3.14, `test.each([])(...)` generates ZERO test cases rather than
    // failing — so if the CLAIM_FLOORS entries above were ever deleted down
    // to nothing, or the flatMap building CLAIM_TYPE_FLOORS broke and started
    // returning [], every floor assertion below would silently stop existing
    // and the suite would report 0 fail. This is the guard that turns that
    // into a loud failure instead.
    expect(CLAIM_TYPE_FLOORS.length).toBeGreaterThan(0)
  })

  test.each(CLAIM_TYPE_FLOORS)(
    '%s still yields at least %d "%s" claims',
    (name, floor, claimId) => {
      const entry = scanned.find((file) => file.name === name)
      expect(entry).toBeDefined()
      const matching = entry.claims.filter((claim) => claim.id === claimId).length
      if (matching < floor) {
        throw new Error(
          `${name}: "${claimId}" yielded ${matching} claims, floor requires at least ${floor}`
        )
      }
    }
  )

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

/*
 * Why only FILE counts are quoted in the docs, and why that is deliberate.
 *
 * The docs used to also state totals — "(1,592 tests)", "169 specs" — and
 * nothing here could check them: counting tests rather than files means
 * running the suite, which a test inside that suite cannot do, and parsing
 * `test(` out of the spec files would miscount every `test.skip`,
 * `test.each` and loop-generated case. So they rotted silently, exactly the
 * way the counts below would without this file: all four were stale before
 * anyone noticed, and correcting them by hand three times in one session is
 * what prompted removing them instead.
 *
 * The rule that follows: quote a number in the instruction docs only if
 * something here can verify it. A number nobody checks is worse than no
 * number, because it reads as authoritative.
 */
describe('counts quoted in the instruction docs', () => {
  test.each([
    ['CLAUDE.md', CLAUDE_MD],
    ['AGENTS.md', AGENTS_MD],
  ])('%s repeats one consistent count through the ordering paragraph', (_name, text) => {
    // That paragraph states its count SEVEN times in seven different
    // phrasings — "There are N", "first of the N", "each of the N", "N
    // one-line file descriptions", "a second copy of N header comments",
    // "first of the N, not first in the file", "before all N". Enumerating
    // those as regexes is how a guard silently stops checking: one rewording
    // upstream and the pattern matches nothing while still passing.
    //
    // So this slices the paragraph out and asserts that EVERY spelled-out
    // number inside it is the file count. It needs no phrase list, and it
    // cannot half-match. The paragraph's other numbers are safe from it
    // because NUMBER_WORDS starts at ten: "two positions", "six dependency
    // sheets", "three @sfgov/design-system sheets" and "one-line" are all
    // below that floor and are genuinely different quantities.
    const anchor = text.indexOf('repository-owned stylesheets')
    const end = text.indexOf('rather than the reverse.', anchor)
    expect(anchor).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(anchor)

    const prose = text.slice(text.lastIndexOf('\n\n', anchor) + 1, end)
    const spelled = prose.match(
      new RegExp(`\\b(?:${Object.keys(NUMBER_WORDS).join('|')})\\b`, 'gi')
    )
    expect(spelled?.length ?? 0).toBeGreaterThanOrEqual(7)
    for (const word of spelled) expect(NUMBER_WORDS[word.toLowerCase()]).toBe(styleSheets.length)
  })

  test('every stylesheet opens with the banner comment the docs point at', () => {
    // The count alone is not enough. Both docs tell the reader to read each
    // sheet's own banner comment INSTEAD of a table here, and that redirection
    // is the stated argument for having deleted the table — so a sheet with no
    // banner leaves the canon pointing at nothing. css/karl-guide.css was
    // exactly that when it arrived, opening straight into `.karl-guide {`.
    const missing = styleSheets.filter(
      (name) => !readFileSync(join(ROOT, 'css', name), 'utf8').startsWith('/*')
    )
    expect(missing).toEqual([])
  })

  test('CLAUDE.md names every unit-test file it claims to list', () => {
    // The prose enumerates the suite by bare module name ("`utils`,
    // `data-validation`, …"). A file added to package.json but not to that
    // sentence leaves the list quietly incomplete — which is how
    // mockup-image-export went missing from the e2e list before.
    const missing = unitTestFiles
      .map((name) => name.replace('.test.js', ''))
      .filter((stem) => !CLAUDE_MD.includes('`' + stem + '`'))
    expect(missing).toEqual([])
  })
})
