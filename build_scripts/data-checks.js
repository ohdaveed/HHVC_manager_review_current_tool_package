// Structural checks on already-schema-validated HHVC page data: cross-page
// link integrity, menu order consistency, and topic-page content rules.
// Split out from build_scripts/validate.js as pure functions so they have
// direct test coverage (see tests/data-validation.test.js) independent of
// the real pages/*.js content.
//
// safeUrl comes from js/utils.js — the same function js/page-render.js applies
// at render time — so findUnsafeUrls below cannot drift from what the renderer
// actually considers safe. That file is browser-first and exports only its URL
// guard to Node; see the note at its foot.
const { safeUrl, urlProbe } = require('../js/utils.js')

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

/**
 * Find `url` / `buttonUrl` / `printVersionUrl` values whose scheme is unsafe to
 * put in an href — `javascript:`, `data:`, and friends.
 *
 * The page schema types these as bare strings, and `escapeHtml` does not touch
 * a scheme, so before this check a `javascript:` URL passed validation and
 * reached a clickable link. That matters most for the AI assist preview, which
 * renders model-generated drafts through the same renderer as real pages, but
 * it is enforced repo-wide because there is no reason authored copy should
 * carry one either.
 *
 * Shares `safeUrl` with js/page-render.js rather than re-deriving the rule, so
 * the validator cannot come to disagree with the renderer about what is safe.
 * @param {Record<string, object>} pages
 * @returns {Array<{pageKey: string, path: string, url: string}>}
 */
function findUnsafeUrls(pages) {
  const unsafe = []

  function check(pageKey, path, value) {
    if (typeof value !== 'string' || !value) return
    // Compare against the TRIMMED value, not the raw one. safeUrl() trims
    // before returning, so comparing with the original reported any
    // whitespace-padded URL — including a perfectly safe https:// one — as an
    // unsafe scheme. This check is about schemes, not whitespace hygiene.
    if (safeUrl(value) !== value.trim()) unsafe.push({ pageKey, path, url: value })
  }

  for (const [pageKey, page] of Object.entries(pages)) {
    check(pageKey, 'printVersionUrl', page.printVersionUrl)
    if (page.spotlight) check(pageKey, 'spotlight.buttonUrl', page.spotlight.buttonUrl)
    ;(page.sections || []).forEach((section, sectionIndex) => {
      const at = `sections[${sectionIndex}]`
      check(pageKey, `${at}.buttonUrl`, section.buttonUrl)
      ;(section.cards || []).forEach((card, cardIndex) => {
        check(pageKey, `${at}.cards[${cardIndex}].url`, card.url)
      })
      ;(section.steps || []).forEach((step, stepIndex) => {
        check(pageKey, `${at}.steps[${stepIndex}].buttonUrl`, step.buttonUrl)
      })
    })
  }

  return unsafe
}

/**
 * Find image sources that would make rendering a page depend on a third party.
 *
 * This tool's central claim is that it works fully offline with no server
 * beyond static files, and for a long time that claim was false because of a
 * single hotlinked `images.unsplash.com` URL on the Agency page. It was easy
 * to miss precisely because it *worked* — on a connected machine the page
 * looked fine, so the only visible symptoms were somewhere else entirely: an
 * air-gapped review showing a broken image, and a PNG export of that page
 * silently depending on a third-party host being up.
 *
 * `data:` is allowed and is what the placeholder uses. That is the opposite of
 * `findUnsafeUrls`'s rule on purpose: there, `data:` is rejected because the
 * value becomes a navigation target, where a data URL is a phishing vector.
 * Here the value becomes an `<img src>`, which renders bytes rather than
 * navigating, and being self-contained is exactly the property wanted.
 * Relative and root-relative paths are fine too — they resolve against
 * whatever is serving the tool, so they add no external dependency.
 * @param {Record<string, object>} pages
 * @returns {Array<{pageKey: string, path: string, url: string}>}
 */
function findExternalAssetUrls(pages) {
  const external = []

  function check(pageKey, path, value) {
    if (typeof value !== 'string') return
    // Test the browser-normalized probe, not the raw string. Matching the raw
    // string on /^(https?:)?\/\// was wrong in exactly the way safeUrl already
    // documents: `\\cdn.example.com/a.jpg`, `\/cdn…`, `/\cdn…` and
    // `https:<TAB>//cdn…` all pass that test and all still fetch off-origin —
    // verified in Chromium, not inferred from the URL spec. Sharing urlProbe
    // with safeUrl is what stops the two guards from disagreeing about what a
    // browser will do.
    const probe = urlProbe(value.trim())
    // Anything with an explicit host is off-site: an absolute http(s) URL, or
    // a protocol-relative one, which reads as a path but leaves the origin.
    if (/^(https?:)?\/\//.test(probe)) external.push({ pageKey, path, url: value })
  }

  for (const [pageKey, page] of Object.entries(pages)) {
    if (page.spotlight?.image) check(pageKey, 'spotlight.image.src', page.spotlight.image.src)
    ;(page.sections || []).forEach((section, sectionIndex) => {
      if (section.image) check(pageKey, `sections[${sectionIndex}].image.src`, section.image.src)
    })
  }

  return external
}

module.exports = {
  findMissingOrderKeys,
  findBrokenCardTargets,
  findBrokenButtonTargets,
  findBrokenInlineLinks,
  isTopicPageFirst,
  findBannedTerms,
  findListFormatViolations,
  findUnsafeUrls,
  findExternalAssetUrls,
  countUnverifiedClaims,
}
