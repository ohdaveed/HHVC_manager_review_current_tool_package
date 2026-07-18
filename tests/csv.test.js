const { describe, test, expect } = require('bun:test')
const { parseCsv, toCsv, csvEscape } = require('../build_scripts/csv')

describe('build_scripts/csv', () => {
  test('round-trips quoted fields and commas', () => {
    const rows = [
      ['page_key', 'notes'],
      ['ratsReport', 'say "hello", team'],
    ]
    const parsed = parseCsv(toCsv(rows))
    expect(parsed).toEqual(rows)
  })

  test('csvEscape neutralizes formula injection', () => {
    expect(csvEscape('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)")
    expect(csvEscape('+1234')).toBe("'+1234")
  })

  // Mirrors the js/utils.js csvEscape fix: leading tab/CR must be checked on
  // the raw text (trimStart() strips them as whitespace, so the old
  // trimmed-value checks never matched). The CR case also picks up outer
  // quoting from the comma/quote/newline rule, apostrophe kept inside.
  test('csvEscape neutralizes a bare leading tab or carriage return', () => {
    expect(csvEscape('\tcmd')).toBe("'\tcmd")
    expect(csvEscape('\rcmd')).toBe('"' + "'\rcmd" + '"')
  })
})
