// Validates a compliance-audit result's structural invariants beyond what
// JSON Schema can express: every citedChunkIds entry must reference a chunk
// that was ACTUALLY retrieved for this specific request, not just any string
// the model produced. Sibling of validate-output.js's validateGeneratedPage,
// kept separate since compliance-audit results and page drafts share no
// structure.

/**
 * @param {{findings: Array<{issue?: string, citedChunkIds?: string[]}>}} result
 * @param {Set<string>} retrievedIds Chunk ids actually retrieved for this request.
 * @returns {string[]} Human-readable issues, empty if every finding cites at
 *   least one retrieved id and nothing else.
 */
function findInvalidCitations(result, retrievedIds) {
  const issues = []
  result.findings.forEach((finding, index) => {
    const label = finding.issue ? `"${finding.issue}"` : `#${index + 1}`
    const citedChunkIds = finding.citedChunkIds || []
    if (!citedChunkIds.length) {
      issues.push(
        `Finding ${label} cites no sources. Every finding must cite at least one id from ` +
          '<cited_sources>.'
      )
      return
    }
    const unknown = citedChunkIds.filter((id) => !retrievedIds.has(id))
    if (unknown.length) {
      issues.push(
        `Finding ${label} cites unknown source id(s): ${unknown.join(', ')}. Only cite ids ` +
          'from the sources you were given.'
      )
    }
  })
  return issues
}

module.exports = { findInvalidCitations }
