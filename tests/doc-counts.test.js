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

const ROOT = join(import.meta.dir, '..')
const read = (name) => readFileSync(join(ROOT, name), 'utf8')

const pkg = JSON.parse(read('package.json'))
const CLAUDE_MD = read('CLAUDE.md')
const AGENTS_MD = read('AGENTS.md')
/* The THIRD mirror. It is deliberately a pointer — no file inventories, no
   architecture summary — but it does quote one count, and until this file read
   it nothing did: it sat claiming 33 unit-test files against a real 36, which
   is exactly the rot the pointer convention exists to avoid and which two
   checked mirrors cannot catch on its behalf. Only its counts are pinned here;
   re-expanding it into a summary is what the canon section forbids. */
const COPILOT_MD = read('.github/copilot-instructions.md')

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

/**
 * Pull every count matching a pattern out of a doc, accepting digits or the
 * spelled-out form — both spellings appear, sometimes in the same paragraph.
 *
 * Two things a pattern here must tolerate, because this is prose in wrapped
 * markdown and BOTH of them hid a wrong count that this very file was supposed
 * to be checking:
 *
 *   - **Separate words with `\s+`, never a literal space.** Any two words in a
 *     phrase can be split across a line break at any time by an unrelated edit
 *     upstream rewrapping the paragraph. `.github/copilot-instructions.md` kept
 *     a spelled-out "thirty-three" claim straight through the change that added
 *     it to this file's coverage, because the phrase had wrapped between
 *     "unit-test" and "files".
 *   - **Allow `**` around the number.** The same claim then survived the `\s+`
 *     fix too: it reads `**thirty-six** Bun unit-test files`, and `[\w-]+`
 *     cannot end on `*`, so the capture slid forward and matched the literal
 *     word "Bun" instead of the count.
 *
 * The shared failure mode is that a pattern which stops matching does not fail
 * — it silently stops checking, and every remaining assertion passes. The
 * `expect(claims.length).toBeGreaterThan(0)` guard in each test below is what
 * catches the total-miss case; these two rules are what catch the partial one,
 * where some claims in a file still match and the wrong one does not.
 */
function countsIn(text, pattern) {
  const found = []
  for (const match of text.matchAll(pattern)) {
    // First capture group that actually matched — patterns with alternatives
    // leave the others undefined.
    const raw = match.slice(1).find((group) => group !== undefined)
    if (raw === undefined) continue
    found.push(NUMBER_WORDS[raw.toLowerCase()] ?? Number(raw))
  }
  return found
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
    ['.github/copilot-instructions.md', COPILOT_MD],
  ])('%s states the real number of unit-test files', (_name, text) => {
    const claims = countsIn(text, /\*{0,2}([\w-]+)\*{0,2}\s+(?:Bun\s+)?unit-test\s+files/gi)
    expect(claims.length).toBeGreaterThan(0)
    for (const claim of claims) expect(claim).toBe(unitTestFiles.length)
  })

  test.each([
    ['CLAUDE.md', CLAUDE_MD],
    ['AGENTS.md', AGENTS_MD],
  ])('%s states the real number of e2e spec files', (_name, text) => {
    const claims = countsIn(text, /\*{0,2}([\w-]+)\*{0,2}\s+spec\s+files/gi)
    expect(claims.length).toBeGreaterThan(0)
    for (const claim of claims) expect(claim).toBe(e2eSpecFiles.length)
  })

  test.each([
    ['CLAUDE.md', CLAUDE_MD],
    ['AGENTS.md', AGENTS_MD],
  ])('%s states the real number of pages', (_name, text) => {
    // Both spellings the docs actually use — "holds **19 pages** under" and
    // "across the 19 pages". Deliberately narrow: a bare /(\d+) pages/ also
    // matches the plain-language budget ("any one rule failing at most 8
    // pages"), which is a threshold, not a count of what is on disk.
    const claims = countsIn(text, /\*\*(\d+)\s+pages\*\*|the (\d+)\s+pages/g)
    expect(claims.length).toBeGreaterThan(0)
    for (const claim of claims) expect(claim).toBe(pageFiles.length)
  })

  test.each([
    ['CLAUDE.md', CLAUDE_MD],
    ['AGENTS.md', AGENTS_MD],
  ])('%s states the real number of stylesheets outside the ordering paragraph', (_name, text) => {
    // "the N stylesheets", never a bare "N stylesheets". Both docs also say
    // "Emotion added 15 stylesheets" — that counts what MUI injects at
    // runtime, not what is in css/, and folding it in would pin an unrelated
    // measurement to this repo's file count.
    //
    // This catches the React-islands note only. The ordering paragraph phrases
    // its own count as "There are N repository-owned stylesheets", with two
    // words in between, so this pattern cannot see it — which is the whole
    // reason the next test exists rather than a second regex here.
    const claims = countsIn(text, /\bthe\s+\*{0,2}([\w-]+)\*{0,2}\s+stylesheets/gi)
    expect(claims.length).toBeGreaterThan(0)
    for (const claim of claims) expect(claim).toBe(styleSheets.length)
  })

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
