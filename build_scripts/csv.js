// Shared CSV parse/write for Node/Bun build scripts.
// Wraps papaparse and preserves HHVC formula-injection neutralization.
const Papa = require('papaparse')

/**
 * Neutralize spreadsheet formula injection by prefixing dangerous cell values.
 * @param {string} value
 * @returns {string}
 */
function neutralizeFormulaInjection(value) {
  const text = String(value ?? '')
  // =/+/-/@ are checked on the trimStart()ed value so formulas hidden behind
  // spaces are caught; tab/CR must be checked on the RAW text because
  // trimStart() strips them as whitespace, which made the old trimmed-value
  // checks unreachable (same fix as csvEscape in js/utils.js — keep in sync).
  const trimmed = text.trimStart()
  const needsProtection =
    trimmed.startsWith('=') ||
    trimmed.startsWith('+') ||
    trimmed.startsWith('-') ||
    trimmed.startsWith('@') ||
    text.startsWith('\t') ||
    text.startsWith('\r')
  return needsProtection ? "'" + text : text
}

/**
 * Escape a single CSV cell value (RFC 4180 + formula injection protection).
 * @param {string} value
 * @returns {string}
 */
function csvEscape(value) {
  const protectedText = neutralizeFormulaInjection(value)
  return /[",\n\r]/.test(protectedText)
    ? '"' + protectedText.replaceAll('"', '""') + '"'
    : protectedText
}

/**
 * Parse CSV text into rows of cell values.
 * @param {string} text
 * @returns {Array<Array<string>>}
 */
function parseCsv(text) {
  const result = Papa.parse(text, {
    delimiter: ',',
    skipEmptyLines: false,
    transform: (value) => (value == null ? '' : String(value)),
  })
  if (result.errors.length) {
    const first = result.errors[0]
    throw new Error(`CSV parse error at row ${first.row}: ${first.message}`)
  }
  const rows = result.data
  if (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') {
    rows.pop()
  }
  return rows
}

/**
 * Serialize rows to CSV text.
 * @param {Array<Array<string>>} rows
 * @returns {string}
 */
function toCsv(rows) {
  return rows.map((row) => row.map(csvEscape).join(',')).join('\n') + '\n'
}

module.exports = { parseCsv, toCsv, csvEscape, neutralizeFormulaInjection }
