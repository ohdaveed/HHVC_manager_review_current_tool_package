import { describe, test, expect } from 'bun:test'
const { scanText, numberPattern, NUMBER_WORDS } = require('../build_scripts/doc-claims.js')

describe('scanText', () => {
  test('reads a spelled-out count stated immediately before its noun', () => {
    expect(scanText('twenty-three spec files, all UI-driven')).toEqual([
      { id: 'e2e-specs', value: 23 },
    ])
  })

  // Two words sit between the number and the noun, and one of them carries a
  // DIGIT — a letters-only gap class cannot cross `e2e`. (What actually let a
  // wrong e2e count ship past CI once was a file omitted from the old
  // hand-maintained (file x claim) matrix, not a regex gap — see
  // build_scripts/doc-claims.js's header comment. This test instead pins the
  // substantive reason the gap must admit digits: a letters-only class would
  // leave copilot-instructions.md's own e2e claim unseen by this pattern.)
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
    expect(scanText('runs **52** Bun unit-test files')).toEqual([{ id: 'unit-tests', value: 52 }])
  })

  test('reads a phrase wrapped across a line break', () => {
    expect(scanText('plus twenty-three\nPlaywright e2e spec files.')).toEqual([
      { id: 'e2e-specs', value: 23 },
    ])
  })

  test('returns an empty array for prose carrying no claim', () => {
    expect(scanText('The 1700px breakpoint is measured.')).toEqual([])
  })

  // The phrasing a 2026-08-20 PR review found neither `pages` branch could
  // see: a number modifying the backtick-fenced glob `pages/*.js` directly,
  // rather than the bare noun "pages" — AGENTS.md and CLAUDE.md both said
  // "which imports all\n27 `pages/*.js`" and the miscount went unnoticed
  // because nothing scanned this shape at all.
  test('reads a count modifying the backtick-fenced pages glob', () => {
    expect(scanText('which imports all\n27 `pages/*.js`, so window.HHVC_DATA')).toEqual([
      { id: 'pages-inventory', value: 27 },
    ])
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

  // Proves `pages-inventory` stays as narrow as `pages` itself: a bare count
  // of the noun "pages", with no backtick-fenced `pages/*.js` glob anywhere
  // nearby, must satisfy neither claim id.
  test('ignores a bare page count with no backtick-fenced glob nearby', () => {
    expect(scanText('a bare 27 pages in unrelated prose')).toEqual([])
  })

  // Neither the spelled-out alternation nor \d+ was word-boundary-anchored
  // before this test existed: "often" contains the literal substring "ten",
  // so an unanchored alternation read a claim out of a word that never
  // mentions a count at all.
  test('ignores a spelled-out number embedded inside a larger word', () => {
    expect(scanText('often spec files')).toEqual([])
  })

  // Same failure mode, digit side: an unanchored \d+ matches inside a longer
  // digit-bearing token rather than only a standalone number, so a version
  // string or an identifier like "v53" would have been misread as the count
  // "53" sitting right before "unit-test files".
  test('ignores a digit run embedded inside a larger token', () => {
    expect(scanText('v53 unit-test files')).toEqual([])
  })

  // A hyphen is not a word character, so a bare \b anchor sits satisfied on
  // its own between "-" and "5" — "v-53" presented "53" as a complete token
  // even after word-boundary anchoring was added. boundedNumberPattern()'s
  // lookarounds reject a word character OR a hyphen on either side, which is
  // what actually closes this off.
  test('ignores a digit run attached to a hyphenated identifier', () => {
    expect(scanText('v-53 unit-test files')).toEqual([])
  })

  test('ignores a digit run attached to a hyphenated identifier, build-prefixed', () => {
    expect(scanText('build-53 unit-test files')).toEqual([])
  })

  // Same hyphen-boundary failure, spelled-out side: "x-twenty-three" would
  // have read the whole compound as a complete token under the old \b
  // anchor, since the hyphen before "twenty" satisfied the boundary as
  // readily as whitespace would have.
  test('ignores a spelled-out number attached to a hyphenated identifier', () => {
    expect(scanText('x-twenty-three spec files')).toEqual([])
  })

  // GAP used to admit a gap token ending in "." — "e2e." — so the match
  // crossed the sentence boundary the period was meant to be. The fix
  // requires a gap token's last character to be a plain word character, so
  // "e2e." stops at "e2e" and strands the period, breaking the \s+ the
  // trailing "spec files" needs immediately after it.
  test('ignores a claim whose gap token trails a sentence-ending period', () => {
    expect(scanText('twenty-three Playwright e2e. spec files')).toEqual([])
  })
})

describe('spelled-out numbers still match in full after hyphen-boundary tightening', () => {
  // Fix 1 rejects a hyphen on either side of the whole matched alternative,
  // not just a bare \b — regression risk is that a naive trailing anchor
  // reads a hyphenated compound's OWN internal hyphen as a boundary and
  // truncates it down to its last segment ("twenty-three" -> "three").
  // These pin the full compound surviving that tightening.
  test('reads twenty-three in full, not truncated to three', () => {
    expect(scanText('twenty-three spec files')).toEqual([{ id: 'e2e-specs', value: 23 }])
  })

  test('reads thirty-six in full, not truncated to six', () => {
    expect(scanText('thirty-six unit-test files')).toEqual([{ id: 'unit-tests', value: 36 }])
  })

  test('reads fifty-two in full, not truncated to two', () => {
    expect(scanText('fifty-two unit-test files')).toEqual([{ id: 'unit-tests', value: 52 }])
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
