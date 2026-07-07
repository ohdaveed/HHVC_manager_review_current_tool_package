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

  function checkTarget(pageKey, target) {
    if (target && !keys.has(target)) broken.push({ pageKey, target })
  }

  for (const [pageKey, page] of Object.entries(pages)) {
    if (page.partOf?.target) checkTarget(pageKey, page.partOf.target)
    for (const section of page.sections || []) {
      for (const card of section.cards || []) checkTarget(pageKey, card.target)
      for (const resource of section.resources || []) checkTarget(pageKey, resource.target)
      for (const group of section.resourceGroups || []) {
        for (const item of group.items || []) checkTarget(pageKey, item.target)
      }
      for (const story of section.dataStories || []) checkTarget(pageKey, story.target)
    }
  }
  return broken
}

/**
 * Find section/step button links that target a page key missing from `pages`.
 * @param {Record<string, object>} pages
 * @returns {Array<{pageKey: string, target: string}>}
 */
function findBrokenButtonTargets(pages) {
  const keys = new Set(Object.keys(pages))
  const broken = []
  for (const [pageKey, page] of Object.entries(pages)) {
    for (const section of page.sections || []) {
      if (section.buttonTarget && !keys.has(section.buttonTarget)) {
        broken.push({ pageKey, target: section.buttonTarget })
      }
      for (const step of section.steps || []) {
        if (step.buttonTarget && !keys.has(step.buttonTarget)) {
          broken.push({ pageKey, target: step.buttonTarget })
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

/**
 * Find Information pages that include a section table (invalid in Karl).
 * @param {Record<string, object>} pages
 * @returns {Array<{pageKey: string}>}
 */
function findInformationTableViolations(pages) {
  const violations = []
  for (const [pageKey, page] of Object.entries(pages)) {
    if (page.type !== 'Information') continue
    for (const section of page.sections || []) {
      if (section.table && section.table.length) {
        violations.push({ pageKey })
        break
      }
    }
  }
  return violations
}

/**
 * Find Resource collection pages with no body assets (documents, resources, or cards).
 * @param {Record<string, object>} pages
 * @returns {Array<{pageKey: string}>}
 */
function findResourceCollectionBodyGaps(pages) {
  const violations = []
  for (const [pageKey, page] of Object.entries(pages)) {
    if (page.type !== 'Resource collection') continue
    let hasBodyAsset = false
    for (const section of page.sections || []) {
      if (section.documents?.length || section.resources?.length || section.cards?.length) {
        hasBodyAsset = true
        break
      }
      if (section.resourceGroups?.some((group) => group.items?.length)) {
        hasBodyAsset = true
        break
      }
    }
    if (!hasBodyAsset) violations.push({ pageKey })
  }
  return violations
}

/**
 * Find accordion groups exceeding Karl guidance (max 5 per section).
 * @param {Record<string, object>} pages
 * @returns {Array<{pageKey: string, count: number}>}
 */
function findAccordionViolations(pages) {
  const violations = []
  for (const [pageKey, page] of Object.entries(pages)) {
    for (const section of page.sections || []) {
      if ((section.accordions || []).length > 5) {
        violations.push({ pageKey, count: section.accordions.length })
      }
    }
  }
  return violations
}

/**
 * Find Step-by-step pages with more than 15 steps (Karl limit).
 * @param {Record<string, object>} pages
 * @returns {Array<{pageKey: string, count: number}>}
 */
function findStepByStepLimitViolations(pages) {
  const violations = []
  for (const [pageKey, page] of Object.entries(pages)) {
    if (page.type !== 'Step-by-step') continue
    let count = 0
    for (const section of page.sections || []) {
      count += (section.steps || []).length
    }
    if (count > 15) violations.push({ pageKey, count })
  }
  return violations
}

module.exports = {
  findMissingOrderKeys,
  findBrokenCardTargets,
  findBrokenButtonTargets,
  isTopicPageFirst,
  findBannedTerms,
  findListFormatViolations,
  findInformationTableViolations,
  findResourceCollectionBodyGaps,
  findAccordionViolations,
  findStepByStepLimitViolations,
}
