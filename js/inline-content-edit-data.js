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
 * shape are out of scope — see the `hhvc-inline-content-editing` skill
 * (extracted from CLAUDE.md; AGENTS.md carries the same section in full).
 */
const IN_SCOPE_SECTION_FIELD_SUFFIXES = ['heading', 'paragraphs', 'bullets']

/**
 * Path pattern for a section_edits key, built from the canonical suffix list
 * above rather than a separate literal. build_scripts/review-state-schema.js
 * and js/review-state-validation.js each restate this same pattern (they
 * can't import it — see their own comments for why), and validate the SAME
 * record before it ever reaches applyContentEditsToPageData below. This
 * check exists anyway as defense-in-depth: a value that predates those
 * schemas, or reaches this function through some future caller that
 * bypasses them, must not corrupt page.sections just because it matched a
 * looser check upstream.
 */
const SECTION_EDIT_PATH_PATTERN = new RegExp(
  `^sections\\.\\d+\\.(${IN_SCOPE_SECTION_FIELD_SUFFIXES.join('|')})$`
)

/**
 * Whether a single paragraph/bullet item has the shape
 * applyContentEditsToPageData/computeSectionEdits agree on: a plain string,
 * or a {text, unverified?, unverifiedReason?} object.
 *
 * Mirrors js/review-state-validation.js's isValidSectionEditItem, and is kept
 * textually identical to it on purpose — the two sit on either side of the
 * same value (this one on the write side computing the diff, that one on the
 * read side validating the stored blob), so a shape one accepts and the other
 * rejects is how a reviewer's inline edits get dropped on the next load with
 * nothing erroring. The array exclusion is the half this copy used to lack:
 * `typeof [] === 'object'`, so an array carrying an own `.text` property
 * passed here and failed there. Neither can import the other (this module is
 * require()'d by its tests and so cannot gain an ES import; that one is a
 * window-only IIFE), so tests/inline-content-edit-data.test.js pins the
 * accept/reject boundary of both together.
 * @param {unknown} item
 * @returns {boolean}
 */
function isValidSectionEditItem(item) {
  if (typeof item === 'string') return true
  return (
    Boolean(item) &&
    typeof item === 'object' &&
    !Array.isArray(item) &&
    typeof item.text === 'string'
  )
}

/**
 * Whether a section_edits value matches the shape its path's suffix
 * requires: a string for `heading`, or an array of isValidSectionEditItem
 * entries for `paragraphs`/`bullets`.
 * @param {string} suffix one of IN_SCOPE_SECTION_FIELD_SUFFIXES
 * @param {unknown} value
 * @returns {boolean}
 */
function isValidSectionEditValue(suffix, value) {
  if (suffix === 'heading') return typeof value === 'string'
  return Array.isArray(value) && value.every(isValidSectionEditItem)
}

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
 * Returns whether reapplying actually CHANGED the page — not whether it
 * wrote. The caller (applySavedPageState in
 * js/ux-improvements-state-sync.js) uses this to decide whether the
 * just-rendered DOM is stale and needs a follow-up render, and a render
 * there replaces #mockPage wholesale.
 *
 * The distinction is issue #118. This used to report whatever setByPath
 * returned, which is true whenever a path RESOLVES — so for any page that
 * had ever had a section edit saved, every call reported true and the
 * follow-up render fired unconditionally, repainting a DOM that already
 * matched. That waste is not harmless: the repaint removes whatever element
 * holds focus, an open inline editor's focusout fires as a consequence, and
 * EditorSession.commit() then runs against a detached editor and loses the
 * reviewer's in-flight text. Traced live by logging every renderPage caller
 * during typing — the sequence was addListItem's render, this reapply's
 * follow-up render, then a commit nobody asked for.
 *
 * The write itself stays unconditional. Only the REPORTING narrows: applying
 * saved state is always correct, repainting for it is only correct when
 * something moved.
 *
 * This function itself stays DOM-free; it only reports the fact.
 * @param {object} page the live page object to mutate
 * @param {object|null|undefined} savedRecord a stored review record, or none
 * @returns {boolean} true if at least one path's value actually changed
 */
function applyContentEditsToPageData(page, savedRecord) {
  if (!page || typeof page !== 'object') return false
  const sectionEdits = savedRecord?.section_edits
  if (!sectionEdits || typeof sectionEdits !== 'object' || Array.isArray(sectionEdits)) return false
  let changedAny = false
  for (const [path, value] of Object.entries(sectionEdits)) {
    const match = SECTION_EDIT_PATH_PATTERN.exec(path)
    if (!match || !isValidSectionEditValue(match[1], value)) continue
    const before = getByPath(page, path)
    if (!setByPath(page, path, value)) continue
    if (!sectionEditValuesEqual(before, value)) changedAny = true
  }
  return changedAny
}

/**
 * Whether two section-edit values are the same content.
 *
 * The values this compares are exactly what isValidSectionEditValue admits:
 * a plain string (a heading), or an array of strings and/or
 * {text, unverified, unverifiedReason} objects (paragraphs, bullets). All of
 * it is JSON-safe by construction — it round-trips through localStorage as
 * JSON on every save — so serializing is a sound comparison here rather than
 * a shortcut, and it is why this needs no deep-equality helper.
 *
 * Identity comparison would be wrong: a saved array is a fresh object on
 * every read of the stored record, so `before === value` is false for every
 * array on every call, which is the same unconditional-true this change
 * exists to remove.
 *
 * Key order is stable in practice — both sides are produced by
 * computeSectionEdits from the same field shapes — but a reordered object
 * would only ever cause a FALSE positive (an unnecessary repaint), which is
 * the old behaviour and safe, never a missed one.
 *
 * @param {unknown} before
 * @param {unknown} after
 * @returns {boolean}
 */
function sectionEditValuesEqual(before, after) {
  if (before === after) return true
  if (typeof before === 'string' || typeof after === 'string') return false
  try {
    return JSON.stringify(before) === JSON.stringify(after)
  } catch {
    // A value that cannot be serialized cannot be compared this way; report
    // "not equal" so the caller repaints, which is the pre-#118 behaviour
    // and never loses data.
    return false
  }
}

// getByPath/setByPath are resolved differently depending on execution context: under
// Bun (this file's own tests) it's require()'d directly; in the browser
// bundle it's read off window.utils, since this file is a plain script
// loaded after js/utils.js in js/main.js's import order, not an ES module
// importer of it (dual-export files in this repo take no imports — see
// js/review-merge.js and js/plain-language.js for the same shape).
const { getByPath, setByPath } =
  typeof module !== 'undefined' && module.exports ? require('./utils.js') : window.utils

if (typeof window !== 'undefined') {
  window.inlineEditData = {
    computeSectionEdits,
    applyContentEditsToPageData,
    IN_SCOPE_SECTION_FIELD_SUFFIXES,
    SECTION_EDIT_PATH_PATTERN,
    isValidSectionEditValue,
  }
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    computeSectionEdits,
    applyContentEditsToPageData,
    IN_SCOPE_SECTION_FIELD_SUFFIXES,
    SECTION_EDIT_PATH_PATTERN,
    isValidSectionEditValue,
  }
}
