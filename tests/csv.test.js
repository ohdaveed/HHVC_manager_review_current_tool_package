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
})
