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

const NUMBER_WORDS = {
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  'twenty-one': 21,
  'twenty-two': 22,
}

/**
 * Pull every count matching a pattern out of a doc, accepting digits or the
 * spelled-out form — both spellings appear, sometimes in the same paragraph.
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

describe('counts quoted in the instruction docs', () => {
  test.each([
    ['CLAUDE.md', CLAUDE_MD],
    ['AGENTS.md', AGENTS_MD],
  ])('%s states the real number of unit-test files', (_name, text) => {
    const claims = countsIn(text, /([\w-]+) (?:Bun )?unit-test files/gi)
    expect(claims.length).toBeGreaterThan(0)
    for (const claim of claims) expect(claim).toBe(unitTestFiles.length)
  })

  test.each([
    ['CLAUDE.md', CLAUDE_MD],
    ['AGENTS.md', AGENTS_MD],
  ])('%s states the real number of e2e spec files', (_name, text) => {
    const claims = countsIn(text, /([\w-]+) spec files/gi)
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
    const claims = countsIn(text, /\*\*(\d+) pages\*\*|the (\d+) pages/g)
    expect(claims.length).toBeGreaterThan(0)
    for (const claim of claims) expect(claim).toBe(pageFiles.length)
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
