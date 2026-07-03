// Structural checks on already-schema-validated HHVC page data: cross-page
// link integrity, menu order consistency, and topic-page content rules.
// Split out from build_scripts/validate.js as pure functions so they have
// direct test coverage (see tests/data-validation.test.js) independent of
// the real pages/*.js content.

/**
 * Find order entries that reference a page key missing from `pages`.
 * @param {Record<string, object>} pages
 * @param {Array<[string, string]>} order
 * @returns {string[]} missing page keys, in order-array order
 */
function findMissingOrderKeys(pages, order) {
  const keys = new Set(Object.keys(pages))
  return order.filter(([key]) => !keys.has(key)).map(([key]) => key)
}

/**
 * Find card links that target a page key missing from `pages`.
 * @param {Record<string, object>} pages
 * @returns {Array<{pageKey: string, target: string}>}
 */
function findBrokenCardTargets(pages) {
  const keys = new Set(Object.keys(pages))
  const broken = []
  for (const [pageKey, page] of Object.entries(pages)) {
    for (const section of page.sections || []) {
      for (const card of section.cards || []) {
        if (card.target && !keys.has(card.target)) {
          broken.push({ pageKey, target: card.target })
        }
      }
    }
  }
  return broken
}

/**
 * @param {Array<[string, string]>} order
 * @returns {boolean}
 */
function isTopicPageFirst(order) {
  return order.length > 0 && order[0][0] === 'pestsTopic'
}

/**
 * Case-insensitive search for any banned term inside a page (or any object),
 * serialized to JSON. Used to keep off-topic content out of the Topic page.
 * @param {object} page
 * @param {string[]} bannedTerms
 * @returns {string[]} banned terms found
 */
function findBannedTerms(page, bannedTerms) {
  const text = JSON.stringify(page).toLowerCase()
  return bannedTerms.filter((term) => text.includes(term.toLowerCase()))
}

/**
 * Find sections or steps that store 3+ list items in `paragraphs` or `text`
 * instead of `bullets`. Lists of three or more must use bullet form.
 * @param {Record<string, object>} pages
 * @returns {Array<{pageKey: string, path: string, count: number}>}
 */
function findListFormatViolations(pages) {
  const violations = []

  function checkList(pageKey, path, items) {
    if (Array.isArray(items) && items.length >= 3) {
      violations.push({ pageKey, path, count: items.length })
    }
  }

  for (const [pageKey, page] of Object.entries(pages)) {
    for (let sectionIndex = 0; sectionIndex < (page.sections || []).length; sectionIndex++) {
      const section = page.sections[sectionIndex]
      checkList(pageKey, `sections[${sectionIndex}].paragraphs`, section.paragraphs)
      for (let stepIndex = 0; stepIndex < (section.steps || []).length; stepIndex++) {
        checkList(
          pageKey,
          `sections[${sectionIndex}].steps[${stepIndex}].text`,
          section.steps[stepIndex].text
        )
      }
    }
  }

  return violations
}

module.exports = {
  findMissingOrderKeys,
  findBrokenCardTargets,
  isTopicPageFirst,
  findBannedTerms,
  findListFormatViolations,
}
