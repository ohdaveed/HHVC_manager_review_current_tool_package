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
 * A second key the same page is filed under, for one pass only.
 *
 * The link checks in data-checks.js take a single `pages` object and use it for
 * both jobs: what to walk, and which targets resolve. Filing the draft under
 * CANDIDATE_KEY is what lets its internal links resolve at all — but it also
 * makes that sentinel itself a resolvable target, so a draft linking to
 * `__generated__` would pass every check while being a dead link in the
 * downloaded module (which is named from the page's slug, never the sentinel).
 *
 * Rather than re-implement each traversal to separate the two jobs, every check
 * runs twice under two different sentinels and the broken targets are unioned.
 * A link to either sentinel resolves in one pass and breaks in the other, so it
 * gets reported; a real page key resolves in both and never does.
 */
const PROBE_KEY = '__generated_probe__'

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
 * Run one link check over both sentinel universes and union the results.
 *
 * Results are filtered to the candidate so pre-existing problems in the repo's
 * own pages are never reported as if the model had caused them, and deduped so
 * an ordinary broken target found in both passes is reported once.
 * @param {(pages: Record<string, object>) => Array<{pageKey: string, target: string}>} find
 * @param {object} page The generated page.
 * @param {Record<string, object>} existingPages
 * @returns {string[]} Broken targets, each listed once.
 */
function findBrokenTargets(find, page, existingPages) {
  const broken = new Set()
  for (const key of [CANDIDATE_KEY, PROBE_KEY]) {
    for (const entry of find({ ...existingPages, [key]: page })) {
      if (entry.pageKey === key) broken.add(entry.target)
    }
  }
  return [...broken]
}

/**
 * Check a generated page.
 *
 * Link-target checks need the real page-key universe to resolve against, so the
 * candidate is merged into a copy of the existing pages under a sentinel key
 * and the results are filtered back down to it. Without the merge every
 * internal link would look broken; without the filter, pre-existing problems in
 * the repo's own pages would be reported as if the model had caused them. See
 * findBrokenTargets for why that merge happens twice.
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

  const brokenTargets = (find) => findBrokenTargets(find, page, existingPages)

  for (const target of brokenTargets(findBrokenCardTargets)) {
    issues.push(`Broken card target: "${target}" is not an existing page key.`)
  }
  for (const target of brokenTargets(findBrokenButtonTargets)) {
    issues.push(`Broken button target: "${target}" is not an existing page key.`)
  }
  for (const target of brokenTargets(findBrokenInlineLinks)) {
    issues.push(`Broken inline link: "${target}" is not an existing page key or an http(s) URL.`)
  }

  const listUniverse = { ...existingPages, [CANDIDATE_KEY]: page }
  for (const { path, count } of findListFormatViolations(listUniverse).filter(
    (entry) => entry.pageKey === CANDIDATE_KEY
  )) {
    issues.push(`${path} has ${count} items. Lists of 3 or more must use bullets.`)
  }
  // The output JSON Schema only *describes* url/buttonUrl as "an absolute
  // http(s) URL"; a description does not constrain, the same way length limits
  // in that schema do not (see build_scripts/ai/schemas.js). Without this, a
  // draft carrying a `javascript:` URL validated clean and reached a clickable
  // link in the assist preview.
  for (const { path, url } of findUnsafeUrls(listUniverse).filter(
    (entry) => entry.pageKey === CANDIDATE_KEY
  )) {
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

/**
 * Matches a markdown inline link, capturing its label and its target.
 *
 * `matchAll` requires the /g flag but does not mutate the regex's `lastIndex`,
 * which is what makes one shared module-scope literal safe for the two
 * independent scans below. A bare `.exec` loop over this would not be.
 */
const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g

/**
 * Validate a `rewrite-field` result against the text it was asked to rewrite.
 *
 * Narrow by design — this is prose, so there is no object shape to check
 * beyond "is it a non-empty string". The two checks that carry real weight are
 * the ones a reviewer would otherwise have to catch by eye:
 *
 *   1. HTML. Field text renders through `formatMarkdown()`, which escapes
 *      everything before it reaches innerHTML — so a model that helpfully
 *      returns `<strong>` produces visible angle brackets on the page rather
 *      than bold text. It reads as a rendering bug and is actually bad input.
 *   2. A dropped link. Rewording a link's visible LABEL is the entire point of
 *      the feature, so the check is on the TARGET: losing one silently removes
 *      navigation the page previously had, and nothing else in the pipeline
 *      would notice.
 *
 * Returns the same `{valid, issues, schemaValid}` shape `validateGeneratedPage`
 * does, so the caller's retry loop can treat both tasks identically.
 * @param {object} result The model's parsed output.
 * @param {string} fieldText The original field text.
 * @param {string} [pageType] The source page's `type`, so page-type-scoped
 *   plain-language rules apply the same way they would on the real page.
 * @returns {{valid: boolean, issues: string[], schemaValid: boolean}}
 */
function validateRewrite(result, fieldText, pageType) {
  const text = result?.rewrittenText
  // `schemaValid: false` is reserved for "not even the right shape", matching
  // validateGeneratedPage's convention of stopping before the content checks
  // when there is nothing coherent left to check.
  if (typeof text !== 'string' || !text.trim()) {
    return {
      valid: false,
      issues: ['rewrittenText must be a non-empty string.'],
      schemaValid: false,
    }
  }

  const issues = []
  if (/<[a-z][\s\S]*?>/i.test(text)) {
    issues.push('rewrittenText must be plain prose with no HTML tags.')
  }

  // Counted per target, not deduplicated into a Set: two independent links to
  // the same target in the original both have to survive. A Set-membership
  // check reports "target present" as long as at least one occurrence
  // remains, so a rewrite that merges two `[a](x)` mentions into one silently
  // drops a navigation path while still validating clean.
  const countTargets = (source) => {
    const counts = new Map()
    for (const match of source.matchAll(MARKDOWN_LINK_PATTERN)) {
      counts.set(match[2], (counts.get(match[2]) || 0) + 1)
    }
    return counts
  }
  const originalCounts = countTargets(String(fieldText))
  const rewrittenCounts = countTargets(text)
  // Every dropped target is reported, not just the first. The retry prompt is
  // only actionable if it names the whole set — fixing them one round trip at a
  // time would exhaust the single retry this feature allows.
  for (const [target, originalCount] of originalCounts) {
    const remaining = rewrittenCounts.get(target) || 0
    if (remaining < originalCount) {
      issues.push(
        originalCount > 1
          ? `The link target "${target}" appeared ${originalCount} times and only ${remaining} survived. Keep every [label](target) link.`
          : `The link target "${target}" was dropped. Keep every [label](target) link.`
      )
    }
  }

  // Run the same content-standards mandates a full page draft is held to
  // (js/plain-language.js), scoped to just this field's text via a
  // single-paragraph synthetic page — a rewrite that adds a contraction, a
  // prohibited term, or an overlong sentence previously validated clean
  // because nothing here checked prose quality at all, only shape.
  const syntheticPath = 'sections[0].paragraphs[0]'
  const synthetic = { type: pageType, sections: [{ heading: 'Rewrite', paragraphs: [text] }] }
  for (const check of analyzePlainLanguage(synthetic).checks) {
    if (check.severity !== 'error' || check.pass) continue
    if (!check.offenders.some((offender) => offender.path === syntheticPath)) continue
    issues.push(`${check.label}: ${check.detail}`)
  }

  return { valid: issues.length === 0, issues, schemaValid: true }
}

module.exports = {
  validateGeneratedPage,
  validateRewrite,
  findBrokenTargets,
  BANNED_TERMS,
  CANDIDATE_KEY,
  PROBE_KEY,
}
