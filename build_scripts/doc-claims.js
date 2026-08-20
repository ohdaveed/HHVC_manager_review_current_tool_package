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
 *
 * The `pages` entry is the narrowest, and deliberately. This rationale moved
 * here from the test block that used to hold it, because that block is gone
 * and the reasoning outlived it: a bare /(\d+) pages/ also matches the
 * plain-language budget ("any one rule failing at most 8 pages"), which is a
 * THRESHOLD rather than a count of what is on disk. It also matches prose
 * findings like "nine pages reported hitting a reading target". Both spellings
 * the docs really use are covered — "holds **29 pages** under" and "across the
 * 29 pages" — and nothing wider than those two.
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
    pattern: () => new RegExp(`\\*{0,2}(${numberPattern()})\\*{0,2}${GAP}\\s+spec\\s+files`, 'gi'),
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
