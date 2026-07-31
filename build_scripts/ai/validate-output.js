// Validate a generated page against the same rules CI enforces.
//
// This is the point of the whole feature. Anything here can also be produced by
// `bun run validate` and `bun run test`, so a draft that passes this would
// actually survive being dropped into pages/ — and a draft that fails comes
// back with the specific reasons, which are fed to the model for exactly one
// retry and shown to the reviewer either way.
//
// Three layers, in increasing subtlety:
//   1. build_scripts/schema.js  — the Zod shape validate.js uses.
//   2. build_scripts/data-checks.js — the business invariants (link targets
//      resolve, lists of 3+ use bullets, the Agency page stays in scope).
//   3. js/plain-language.js — the written content standards.
const { pageSchema } = require('../schema')
const {
  findBrokenCardTargets,
  findBrokenButtonTargets,
  findBrokenInlineLinks,
  findBannedTerms,
  findListFormatViolations,
  findUnsafeUrls,
} = require('../data-checks')
const { analyzePlainLanguage } = require('../../js/plain-language.js')

// Same list validate.js applies. HHVC's remit is Health Code Article 11;
// structural problems belong to the Department of Building Inspection.
const BANNED_TERMS = [
  'plumbing',
  'dbi',
  'roof leak',
  'sewer',
  'permit issue',
  'construction defect',
]

/** The key a generated page is filed under while being checked. */
const CANDIDATE_KEY = '__generated__'

/**
 * Format a Zod issue as a sentence the model can act on.
 * @param {object} issue
 * @returns {string}
 */
function formatZodIssue(issue) {
  const path = issue.path.length ? issue.path.join('.') : '(root)'
  return `Schema: ${path} — ${issue.message}`
}

/**
 * Check a generated page.
 *
 * Link-target checks need the real page-key universe to resolve against, so the
 * candidate is merged into a copy of the existing pages under CANDIDATE_KEY and
 * the results are filtered back down to it. Without the merge every internal
 * link would look broken; without the filter, pre-existing problems in the
 * repo's own pages would be reported as if the model had caused them.
 *
 * @param {object} page The generated page object.
 * @param {Record<string, object>} existingPages Real pages, for link resolution.
 * @returns {{valid: boolean, issues: string[], schemaValid: boolean}}
 */
function validateGeneratedPage(page, existingPages = {}) {
  const issues = []

  const parsed = pageSchema.safeParse(page)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) issues.push(formatZodIssue(issue))
    // Stop here when the shape is wrong. The invariant checks below walk
    // `sections[].cards[]` and friends directly and would throw on a page that
    // is not shaped like a page — and the model cannot act on a cascade of
    // downstream errors caused by one missing field anyway.
    return { valid: false, issues, schemaValid: false }
  }

  const universe = { ...existingPages, [CANDIDATE_KEY]: page }
  const mine = (results) => results.filter((entry) => entry.pageKey === CANDIDATE_KEY)

  for (const { target } of mine(findBrokenCardTargets(universe))) {
    issues.push(`Broken card target: "${target}" is not an existing page key.`)
  }
  for (const { target } of mine(findBrokenButtonTargets(universe))) {
    issues.push(`Broken button target: "${target}" is not an existing page key.`)
  }
  for (const { target } of mine(findBrokenInlineLinks(universe))) {
    issues.push(`Broken inline link: "${target}" is not an existing page key or an http(s) URL.`)
  }
  for (const { path, count } of mine(findListFormatViolations(universe))) {
    issues.push(`${path} has ${count} items. Lists of 3 or more must use bullets.`)
  }
  // The output JSON Schema only *describes* url/buttonUrl as "an absolute
  // http(s) URL"; a description does not constrain, the same way length limits
  // in that schema do not (see build_scripts/ai/schemas.js). Without this, a
  // draft carrying a `javascript:` URL validated clean and reached a clickable
  // link in the assist preview.
  for (const { path, url } of mine(findUnsafeUrls(universe))) {
    issues.push(`${path} uses an unsafe URL scheme: "${url}". Use an absolute http(s) URL.`)
  }

  // Scope check applies to the Agency page only, matching validate.js. Other
  // pages legitimately name DBI when routing a resident to the right
  // department, and flagging that would punish correct wrong-door handling.
  if (String(page.type || '').toLowerCase() === 'agency') {
    for (const term of findBannedTerms(page, BANNED_TERMS)) {
      issues.push(`Out of scope for the Agency page: "${term}". HHVC covers Article 11 only.`)
    }
  }

  for (const check of analyzePlainLanguage(page).checks) {
    if (check.severity !== 'error' || check.pass) continue
    const where = check.offenders.length
      ? ` (${check.offenders
          .slice(0, 3)
          .map((offender) => offender.path)
          .join(', ')})`
      : ''
    issues.push(`${check.label}: ${check.detail}${where}`)
  }

  return { valid: issues.length === 0, issues, schemaValid: true }
}

module.exports = {
  validateGeneratedPage,
  BANNED_TERMS,
  CANDIDATE_KEY,
}
