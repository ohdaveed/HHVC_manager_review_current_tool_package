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
