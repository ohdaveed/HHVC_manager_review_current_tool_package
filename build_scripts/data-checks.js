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
 * The main HHVC Agency page must lead the menu order. Its key stays
 * `pestsTopic` (from when this slot held the Topic page) so downstream
 * invariants, tests, and saved review state keep a stable identifier.
 * @param {Array<[string, string]>} order
 * @returns {boolean}
 */
function isTopicPageFirst(order) {
  return order.length > 0 && order[0][0] === 'pestsTopic'
}

/**
 * Find inline markdown links `[label](target)` in paragraphs, bullets, table
 * cells, and step text whose target is neither an existing page key nor an
 * http(s) URL.
 * These render as in-mockup nav buttons (see formatMarkdown in
 * js/page-render.js), so a dangling key silently no-ops on click — the
 * card/button target checks above never see them.
 * @param {Record<string, object>} pages
 * @returns {Array<{pageKey: string, target: string}>}
 */
function findBrokenInlineLinks(pages) {
  const keys = new Set(Object.keys(pages))
  const broken = []

  function checkItems(pageKey, items) {
    for (const item of items || []) {
      const text = typeof item === 'string' ? item : item?.text || ''
      for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
        const target = match[1]
        // `#` is the deliberate inert-link sentinel (kept un-navigable by the
        // mockup's click handler), so only real keys and URLs are checked.
        if (target !== '#' && !keys.has(target) && !/^https?:\/\//.test(target)) {
          broken.push({ pageKey, target })
        }
      }
    }
  }

  for (const [pageKey, page] of Object.entries(pages)) {
    for (const section of page.sections || []) {
      checkItems(pageKey, section.paragraphs)
      checkItems(pageKey, section.bullets)
      for (const row of section.table || []) {
        checkItems(pageKey, row)
      }
      if (section.callout) checkItems(pageKey, [section.callout.text])
      for (const step of section.steps || []) {
        checkItems(pageKey, step.text)
        checkItems(pageKey, step.bullets)
        if (step.callout) checkItems(pageKey, [step.callout.text])
      }
    }
  }
  return broken
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
 * Count bullets, paragraphs, step text/bullets, and cards flagged
 * `unverified: true` across every page. Used for the validate.js summary line.
 * @param {Record<string, object>} pages
 * @returns {number}
 */
function countUnverifiedClaims(pages) {
  function countFlagged(items) {
    return (items || []).filter((item) => item && typeof item === 'object' && item.unverified)
      .length
  }

  let count = 0
  for (const page of Object.values(pages)) {
    for (const section of page.sections || []) {
      count += countFlagged(section.paragraphs)
      count += countFlagged(section.bullets)
      count += (section.cards || []).filter((card) => card.unverified).length
      for (const step of section.steps || []) {
        count += countFlagged(step.text)
        count += countFlagged(step.bullets)
      }
    }
  }
  return count
}

module.exports = {
  findMissingOrderKeys,
  findBrokenCardTargets,
  findBrokenButtonTargets,
  findBrokenInlineLinks,
  isTopicPageFirst,
  findBannedTerms,
  findListFormatViolations,
  countUnverifiedClaims,
}
