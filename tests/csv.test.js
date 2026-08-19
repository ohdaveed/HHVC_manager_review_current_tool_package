const { describe, test, expect } = require('bun:test')
const { parseCsv, toCsv, csvEscape } = require('../build_scripts/csv')
const {
  csvEscape: browserCsvEscape,
  toCsv: browserToCsv,
  parseCsv: browserParseCsv,
} = require('../js/core/utils.js')

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

  // Mirrors the js/core/utils.js csvEscape fix: leading tab/CR must be checked on
  // the raw text (trimStart() strips them as whitespace, so the old
  // trimmed-value checks never matched). The CR case also picks up outer
  // quoting from the comma/quote/newline rule, apostrophe kept inside.
  test('csvEscape neutralizes a bare leading tab or carriage return', () => {
    expect(csvEscape('\tcmd')).toBe("'\tcmd")
    expect(csvEscape('\rcmd')).toBe('"' + "'\rcmd" + '"')
  })
})

// The browser (js/core/utils.js) and Node (build_scripts/csv.js) CSV helpers are
// two implementations of one format, and they must agree cell for cell.
//
// They are NOT merged into one shared module, deliberately. `toCsv` is
// byte-identical across the pair, but it is built on `csvEscape`, and the two
// csvEscape/parseCsv implementations genuinely differ underneath: the Node
// side wraps papaparse, the browser side is hand-rolled so no parser ships in
// the bundle. Extracting the identical function alone would silently bind one
// runtime's serializer to the other runtime's escaping.
//
// So the duplication stays and this pins it instead — the same answer
// tests/decision-vocabulary.test.js gives for a restatement that cannot be
// imported away. What matters is not that the source matches but that the
// OUTPUT does: a reviewer exports a CSV from the browser, and the build
// scripts write the tracking sheets that the same reviewer's spreadsheet
// opens beside it.
describe('js/core/utils.js and build_scripts/csv.js agree on the CSV format', () => {
  // Every escaping rule either implementation has, plus the combinations
  // where two rules interact — a formula prefix inside a value that also
  // needs quoting is where a naive fix puts the apostrophe outside the quote.
  const CELLS = [
    '',
    'plain',
    'with,comma',
    'with"quote',
    'with\nnewline',
    'with\r\ncrlf',
    '=SUM(A1:A9)',
    '+1234',
    '-1234',
    '@cmd',
    '  =leading spaces then formula',
    '\tleading tab',
    '\rleading carriage return',
    '=formula,with comma',
    '="quoted formula"',
    'trailing space ',
    'unicode — em dash and “smart quotes”',
    "apostrophe's own",
  ]

  test.each(CELLS.map((cell) => [JSON.stringify(cell), cell]))(
    'csvEscape agrees on %s',
    (_label, cell) => {
      expect(browserCsvEscape(cell)).toBe(csvEscape(cell))
    }
  )

  test('csvEscape agrees on null and undefined', () => {
    // Both coerce through String(value ?? ''), so an absent field is an empty
    // cell rather than the literal text "undefined" in a spreadsheet.
    expect(browserCsvEscape(null)).toBe(csvEscape(null))
    expect(browserCsvEscape(undefined)).toBe(csvEscape(undefined))
    expect(browserCsvEscape(undefined)).toBe('')
  })

  test('toCsv produces byte-identical output for a full sheet', () => {
    const rows = [
      ['page_key', 'decision', 'notes'],
      ...CELLS.map((cell) => ['k', 'Approved', cell]),
    ]
    expect(browserToCsv(rows)).toBe(toCsv(rows))
  })

  test('each parser reads back what the OTHER serializer wrote', () => {
    // The cross pairing is the point: same-side round trips can agree on a
    // shared misreading, and this is the direction that actually happens —
    // a browser-exported backup re-read by a build script, or a build-script
    // CSV imported into the review queue.
    const rows = [
      ['page_key', 'notes'],
      ['ratsReport', 'say "hello", team'],
      ['filthReport', 'line one\nline two'],
      ['payFee', 'plain'],
    ]
    expect(parseCsv(browserToCsv(rows))).toEqual(rows)
    expect(browserParseCsv(toCsv(rows))).toEqual(rows)
  })
})
