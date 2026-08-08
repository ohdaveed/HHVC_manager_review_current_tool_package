/* Pure logic for section-level inline content edits: deriving the
   section_edits diff against ORIGINAL_DATA, and reapplying a saved
   section_edits map onto a live page object on load.

   Dual-exported (window.inlineEditData plus module.exports), matching
   js/review-merge.js and js/plain-language.js, so this file has no DOM
   dependency and is importable directly under Bun with no browser.

   Deliberately does NOT touch edited_title/edited_summary/primary_cta —
   those three page-level fields already have a working write/reapply path
   (collectCurrentPageReviewState / updateMockupTextFromSavedState in
   js/ux-improvements-state-sync.js) that predates this feature. Reapplying
   them here too would race that existing path on every page load. */

/**
 * The only section-level field kinds this feature ever diffs or writes.
 * Cards, callouts, table cells, step text/bullets, and every other section
 * shape are out of scope — see CLAUDE.md's "Inline content editing" section.
 */
const IN_SCOPE_SECTION_FIELD_SUFFIXES = ['heading', 'paragraphs', 'bullets']

/**
 * Deep-equality check via JSON serialization. Section field values here are
 * always JSON-safe (strings, or arrays of strings/{text,unverified,...}
 * objects), so this is equivalent to a real deep-equal without pulling in a
 * dependency for it.
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Derive the current section_edits map by diffing a page's in-scope section
 * fields (heading, paragraphs, bullets) against ORIGINAL_DATA's copy of the
 * same page. A path is included only when its current value differs from
 * the original — this is the whole mechanism behind "reset to original":
 * once a field is written back to match the original, the next call here
 * simply omits it, with no separate deletion logic required.
 *
 * Mirrors how edited_title/edited_summary/primary_cta are already derived
 * fresh from live page state on every autosave (collectCurrentPageReviewState
 * in js/ux-improvements-state-sync.js), rather than accumulated as a stored
 * diff that could drift from what the page object actually contains.
 * @param {object} page the live (possibly edited) page object
 * @param {object} originalPage the pristine page object (ORIGINAL_DATA.pages[key])
 * @returns {Record<string, unknown>}
 */
function computeSectionEdits(page, originalPage) {
  if (!page || typeof page !== 'object') return {}
  if (!originalPage || typeof originalPage !== 'object') return {}
  const sections = Array.isArray(page.sections) ? page.sections : []
  const originalSections = Array.isArray(originalPage.sections) ? originalPage.sections : []

  const edits = {}
  sections.forEach((section, index) => {
    const originalSection = originalSections[index]
    for (const suffix of IN_SCOPE_SECTION_FIELD_SUFFIXES) {
      const current = section?.[suffix]
      const original = originalSection?.[suffix]
      if (current === undefined && original === undefined) continue
      if (deepEqual(current, original)) continue
      edits[`sections.${index}.${suffix}`] = current
    }
  })
  return edits
}

/**
 * Reapply a saved section_edits map onto a live page object. Called once,
 * from applySavedPageState (js/ux-improvements-state-sync.js), alongside
 * the existing updateMockupTextFromSavedState call — the single choke point
 * every load/navigation/sync-pull/conflict-resolution path already funnels
 * through.
 *
 * Deliberately total, like getByPath/setByPath themselves: a missing
 * savedRecord, a missing or malformed section_edits, or an individual path
 * that no longer resolves against the current page shape (the page was
 * edited in pages/*.js since the saved edit was recorded, for instance) are
 * all silently skipped rather than thrown. A stale saved edit failing to
 * reapply is a normal, expected outcome — not a bug to surface as an error.
 *
 * Returns whether it actually wrote anything, so callers can tell "there was
 * nothing to reapply" apart from "there was, and the live page object no
 * longer matches it" — the caller (applySavedPageState) uses that signal to
 * decide whether the just-rendered DOM is now stale and needs a follow-up
 * render. This function itself stays DOM-free; it only reports the fact.
 * @param {object} page the live page object to mutate
 * @param {object|null|undefined} savedRecord a stored review record, or none
 * @returns {boolean} true if at least one path was written via setByPath
 */
function applyContentEditsToPageData(page, savedRecord) {
  if (!page || typeof page !== 'object') return false
  const sectionEdits = savedRecord?.section_edits
  if (!sectionEdits || typeof sectionEdits !== 'object' || Array.isArray(sectionEdits)) return false
  let wroteAny = false
  for (const [path, value] of Object.entries(sectionEdits)) {
    if (setByPath(page, path, value)) wroteAny = true
  }
  return wroteAny
}

// setByPath is resolved differently depending on execution context: under
// Bun (this file's own tests) it's require()'d directly; in the browser
// bundle it's read off window.utils, since this file is a plain script
// loaded after js/utils.js in js/main.js's import order, not an ES module
// importer of it (dual-export files in this repo take no imports — see
// js/review-merge.js and js/plain-language.js for the same shape).
const setByPath =
  typeof module !== 'undefined' && module.exports
    ? require('./utils.js').setByPath
    : window.utils.setByPath

if (typeof window !== 'undefined') {
  window.inlineEditData = {
    computeSectionEdits,
    applyContentEditsToPageData,
    IN_SCOPE_SECTION_FIELD_SUFFIXES,
  }
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    computeSectionEdits,
    applyContentEditsToPageData,
    IN_SCOPE_SECTION_FIELD_SUFFIXES,
  }
}
