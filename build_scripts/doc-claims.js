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
 * Deliberately UNANCHORED — this is the raw alternation, still exactly what
 * it was before word-boundary anchoring was added, so `numberPattern`'s own
 * tests (which inspect this string directly, splitting on `|` and checking
 * longest-first order) keep asserting the clean word list rather than a
 * string with boundary tokens spliced onto its first and last entries. Every
 * CLAIMS pattern below reaches this through `boundedNumberPattern()`
 * instead of using it raw.
 *
 * @returns {string} regex source matching digits or a spelled-out number
 */
function numberPattern() {
  const words = Object.keys(NUMBER_WORDS).sort((a, b) => b.length - a.length)
  return `\\d+|${words.join('|')}`
}

/**
 * `numberPattern()`, wrapped so a claim can only be read from a COMPLETE
 * token. Unanchored, `\d+` matches inside a longer digit run — "v53 unit-test
 * files" read 53 out of "v53" — and the spelled-out alternation matches
 * inside a longer word — "often spec files" read ten out of "often", since
 * "often" contains the literal substring "ten". A bare `\b` anchor was tried
 * first and still let a hyphenated identifier through: `\b` sits between a
 * word character and a NON-word character, and `-` is itself a non-word
 * character, so "v-53 unit-test files" and "build-53 unit-test files" both
 * presented "53" as a complete token — the hyphen satisfied the boundary on
 * its own, with nothing left to reject it. The lookarounds below reject a
 * word character OR a hyphen on either side, so a number directly attached to
 * a hyphenated identifier by punctuation alone is never read as a standalone
 * claim. "twenty-three" still matches in full: its INTERNAL hyphen sits
 * between two characters the alternative already consumes as one literal
 * token, so the lookarounds only ever inspect the characters just outside the
 * whole matched alternative — the outer t/e edges of the compound — and never
 * see the hyphen in the middle. It is never truncated down to "three".
 *
 * @returns {string} regex source: a boundary-anchored number alternation
 */
function boundedNumberPattern() {
  return `(?<![\\w-])(?:${numberPattern()})(?![\\w-])`
}

// Words permitted between the number and its noun. Letter-initial so it cannot
// swallow the number itself, but \w after — this repo's prose is full of
// digit-bearing tokens (e2e, h1, v2), and a letters-only class cannot cross
// `e2e`. That is NOT what let the twenty-two/twenty-three miscount described
// above ship past CI — that was .github/copilot-instructions.md being left off
// a hand-maintained file list, a different failure mode entirely, fixed above
// by deriving the file list instead. But a letters-only gap would leave that
// same file's own e2e claim unseen by THIS pattern regardless of the file-list
// fix, since the claim text sits right next to the digit-bearing word `e2e` —
// reason enough on its own to admit digits here.
//
// A gap token may contain a period or a hyphen INTERNALLY — "Node.js" and
// "v2.1" both have to cross this gap — but must not END on one. `[\w.-]*\w`
// requires the token's last character to be a plain word character, so a
// token that would otherwise trail off on a sentence-ending period is cut
// back to the word before it: inside "twenty-three Playwright e2e. spec
// files" the token stops at "e2e", leaving the period stranded outside the
// gap. That stranded period is not whitespace, so it breaks the `\s+` the
// next gap token or the trailing noun phrase requires, and the whole match
// fails — a claim can no longer walk across a full stop and glue a number
// from one sentence onto a noun phrase from the next. A trailing period
// OUTSIDE the gap — ending the sentence the claim itself lives in — is
// unaffected: "twenty-three Playwright e2e spec files." still matches, since
// that period sits after "files", never inside a token the gap has to
// swallow.
const GAP = '(?:\\s+[A-Za-z](?:[\\w.-]*\\w)?){0,3}'

// Bounded at three letter-initial tokens, which may themselves contain
// digits, periods and hyphens internally (see GAP's own comment above) —
// "Node.js", "v2.1" and "e2e" all have to cross this gap, provided the token
// doesn't END on that punctuation. What it does NOT admit is a punctuation
// character as its own whitespace-separated token, or a sentence-ending
// character closing out a token, so a match still cannot cross a clause
// boundary and capture a number left over from the previous sentence.

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
 *
 * `pages-inventory` is a SEPARATE id from `pages`, not a third branch on its
 * pattern, even though both derive against the same `pageFiles` count. A PR
 * review on 2026-08-20 found a third phrasing neither `pages` branch can see:
 * AGENTS.md and CLAUDE.md both said "which imports all\n27 `pages/*.js`",
 * stale against a real 29, and invisible to a scanner that only recognizes
 * "**N pages**" and "the N pages" because the number there modifies a
 * backtick-fenced glob token, not the bare noun "pages". A shared `pages` id
 * would report that mismatch as "pages" and leave a reader guessing which of
 * three regex branches actually fired; a separate id keeps a floor, and a
 * failure message, specific to which grammatical shape broke.
 *
 * It stays exactly as narrow as `pages` is, and for the same reason `pages`
 * itself carries no GAP: the repo's own corpus mentions `` `pages/*.js` ``
 * roughly thirty times, so admitting a gap here — the way `unit-tests` and
 * `e2e-specs` must, to cross "Playwright e2e" — would turn every one of those
 * thirty sites into a match target for any number sitting up to three tokens
 * upstream, which is a materially wider surface than the one real instance
 * this id was written to guard ("27 `pages/*.js`", zero gap). No bold markers
 * either, for the same reason: neither guards a phrasing that exists. The
 * number must sit directly against the backtick-fenced glob, through nothing
 * but whitespace, so a bare "27 pages" in unrelated prose — the exact false
 * positive `pages` itself was built to reject — still cannot satisfy this
 * pattern either.
 */
const CLAIMS = [
  {
    id: 'unit-tests',
    deriver: 'unitTestFiles',
    pattern: () =>
      new RegExp(`\\*{0,2}(${boundedNumberPattern()})\\*{0,2}${GAP}\\s+unit-test\\s+files`, 'gi'),
  },
  {
    id: 'e2e-specs',
    deriver: 'e2eSpecFiles',
    pattern: () =>
      new RegExp(`\\*{0,2}(${boundedNumberPattern()})\\*{0,2}${GAP}\\s+spec\\s+files`, 'gi'),
  },
  {
    id: 'pages',
    deriver: 'pageFiles',
    pattern: () => new RegExp(`\\*\\*(\\d+)\\s+pages\\*\\*|\\bthe\\s+(\\d+)\\s+pages\\b`, 'g'),
  },
  {
    id: 'pages-inventory',
    deriver: 'pageFiles',
    pattern: () => new RegExp(`(${boundedNumberPattern()})\\s+\`pages/\\*\\.js\``, 'g'),
  },
  {
    id: 'stylesheets',
    deriver: 'styleSheets',
    pattern: () =>
      new RegExp(`\\bthe\\s+\\*{0,2}(${boundedNumberPattern()})\\*{0,2}\\s+stylesheets`, 'gi'),
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
