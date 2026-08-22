/* Pure logic for section-level inline content edits: deriving the
   section_edits diff against ORIGINAL_DATA, and reapplying a saved
   section_edits map onto a live page object on load.

   Dual-exported (window.inlineEditData plus module.exports), matching
   js/review/review-merge.js and js/standards/plain-language.js, so this file has no DOM
   dependency and is importable directly under Bun with no browser.

   Deliberately does NOT touch edited_title/edited_summary/primary_cta —
   those three page-level fields already have a working write/reapply path
   (collectCurrentPageReviewState / updateMockupTextFromSavedState in
   js/review/ux-improvements-state-sync.js) that predates this feature. Reapplying
   them here too would race that existing path on every page load. */

/**
 * Every field a reviewer can edit on the mockup, as the path shape its
 * stored section_edits entry uses and the value shape that entry must have.
 * This list IS the feature's scope, in one place, and four things read it:
 * computeSectionEdits (which containers to diff), applyContentEditsToPageData
 * (what a stored value may be), editableItemKind (how one item inside an
 * array is written back), and js/editing/inline-content-edit.js (which paths its
 * widgets may open).
 *
 * The four kinds:
 * - `string` — a plain string field (a heading, a step title, a callout's
 *   text, a contact address).
 * - `textArray` — an array of body-copy items, each a plain string or the
 *   tagged {text, unverified?, unverifiedReason?} object the Unverified pill
 *   already renders.
 * - `stringArray` — an array of plain strings whose renderer prints them
 *   directly through escapeHtml (a contact phone number, email or "other"
 *   line). A tagged object here renders as the literal "[object Object]",
 *   which is why it is a separate kind rather than a loosening of textArray.
 *   Note that `spotlight.paragraphs` is NOT one of these despite being typed
 *   `string[]` by build_scripts/schema.js — it renders through
 *   paragraphList(), so it is a textArray; see its entry below.
 * - `table` — an array of row arrays of plain strings.
 *
 * **Card fields are absent deliberately and must stay absent.** A card's own
 * `text` renders nowhere: an inheriting card publishes the DESTINATION page's
 * summary (see "Card descriptions are inherited, not printed" in AGENTS.md),
 * so an edit recorded here would persist a value the renderer ignores and
 * reappear as the old text on the next paint. `karl` notes and `editorNote`
 * are absent for a different reason — they are CMS annotations about the
 * content rather than the content itself — and the SEO fields are absent
 * because the editor panel already owns them.
 *
 * `example` exists so tests/inline-content-edit-data.test.js can assert the
 * whole list by value rather than by spot-check. A shape whose example does
 * not match its own pattern is a contradiction the test below catches.
 */
const EDITABLE_FIELD_SHAPES = [
  { pattern: /^sections\.\d+\.heading$/, kind: 'string', example: 'sections.0.heading' },
  { pattern: /^sections\.\d+\.paragraphs$/, kind: 'textArray', example: 'sections.0.paragraphs' },
  { pattern: /^sections\.\d+\.bullets$/, kind: 'textArray', example: 'sections.0.bullets' },
  { pattern: /^sections\.\d+\.table$/, kind: 'table', example: 'sections.0.table' },
  // A `top-facts` section's fact_items. textArray rather than a kind of its
  // own: a fact is {label, text} and isValidSectionEditItem accepts it (it
  // carries a string `text`), while writeScalarValue's taggedText branch
  // spreads the existing object so an edit to the text keeps the label — the
  // same mechanism whatToKnow.thingsToKnow already relies on. It gains NO
  // add/remove affordance from this registration: decorateListControls()
  // (js/editing/inline-content-edit.js) allowlists paragraphs and bullets by
  // path, not by kind, so an appended item that carried no `label` — which
  // renderTopFacts() prints unguarded — cannot be created here.
  { pattern: /^sections\.\d+\.facts$/, kind: 'factsArray', example: 'sections.0.facts' },
  {
    pattern: /^sections\.\d+\.callout\.title$/,
    kind: 'string',
    example: 'sections.0.callout.title',
  },
  { pattern: /^sections\.\d+\.callout\.text$/, kind: 'string', example: 'sections.0.callout.text' },
  {
    pattern: /^sections\.\d+\.steps\.\d+\.title$/,
    kind: 'string',
    example: 'sections.0.steps.0.title',
  },
  {
    pattern: /^sections\.\d+\.steps\.\d+\.text$/,
    kind: 'textArray',
    example: 'sections.0.steps.0.text',
  },
  {
    pattern: /^sections\.\d+\.steps\.\d+\.bullets$/,
    kind: 'textArray',
    example: 'sections.0.steps.0.bullets',
  },
  {
    pattern: /^sections\.\d+\.steps\.\d+\.callout\.title$/,
    kind: 'string',
    example: 'sections.0.steps.0.callout.title',
  },
  {
    pattern: /^sections\.\d+\.steps\.\d+\.callout\.text$/,
    kind: 'string',
    example: 'sections.0.steps.0.callout.text',
  },
  { pattern: /^whatToKnow\.cost$/, kind: 'string', example: 'whatToKnow.cost' },
  { pattern: /^whatToKnow\.thingsToKnow$/, kind: 'textArray', example: 'whatToKnow.thingsToKnow' },
  { pattern: /^whatToKnow\.items$/, kind: 'textArray', example: 'whatToKnow.items' },
  { pattern: /^spotlight\.title$/, kind: 'string', example: 'spotlight.title' },
  // textArray rather than stringArray even though build_scripts/schema.js
  // types the authored field as string[]: this renders through
  // paragraphList(), the same helper section paragraphs use, so it already
  // handles the tagged item form and shows the Unverified pill on an edited
  // entry. That schema types what pages/*.js may CONTAIN; a reviewer's edit
  // lives in review state and never reaches it.
  { pattern: /^spotlight\.paragraphs$/, kind: 'textArray', example: 'spotlight.paragraphs' },
  { pattern: /^contact\.address$/, kind: 'string', example: 'contact.address' },
  { pattern: /^contact\.hours$/, kind: 'string', example: 'contact.hours' },
  { pattern: /^contact\.phone$/, kind: 'stringArray', example: 'contact.phone' },
  { pattern: /^contact\.email$/, kind: 'stringArray', example: 'contact.email' },
  { pattern: /^contact\.other$/, kind: 'stringArray', example: 'contact.other' },
]

/**
 * Item containers whose entries are {label, text} objects, whose `label` each
 * renderer prints as that entry's own H3. Matched against a full item-label
 * path (`whatToKnow.thingsToKnow.0.label`), not a container path.
 *
 * Separate from EDITABLE_FIELD_SHAPES on purpose — see editableItemKind below
 * for why a label must not become a registered stored-key pattern.
 */
const LABELLED_ITEM_CONTAINERS = [
  /^whatToKnow\.thingsToKnow\.\d+\.label$/,
  /^whatToKnow\.items\.\d+\.label$/,
  /^sections\.\d+\.facts\.\d+\.label$/,
]

/**
 * The kind of container a section_edits path addresses, or null when the
 * path is outside the feature entirely.
 * @param {string} path
 * @returns {'string'|'textArray'|'factsArray'|'stringArray'|'table'|null}
 */
function editableFieldKind(path) {
  if (typeof path !== 'string') return null
  const shape = EDITABLE_FIELD_SHAPES.find((entry) => entry.pattern.test(path))
  return shape ? shape.kind : null
}

/**
 * How ONE item a reviewer edits should be written back onto the page object.
 *
 * `taggedText` items get the {text, unverified: true, unverifiedReason}
 * object form, which the existing Unverified pill renders with no renderer
 * change. `plainString` covers both a whole-field string (a heading, a step
 * title) and a single item of a stringArray or table, whose renderers print
 * the value directly — writing the tagged object into one of those renders
 * the literal "[object Object]" on the mockup.
 *
 * A path that addresses neither (a card, a karl note) returns null, and the
 * caller refuses to open an editor for it.
 * @param {string} path an item path (`sections.0.bullets.2`) or a whole-field path
 * @returns {'taggedText'|'plainString'|null}
 */
function editableItemKind(path) {
  if (typeof path !== 'string') return null
  const ownKind = editableFieldKind(path)
  if (ownKind) return ownKind === 'string' ? 'plainString' : null
  // An item's `label` sub-field, addressed directly: a whatToKnow entry and a
  // top-facts fact are both {label, text}, and each renderer prints that label
  // as the entry's own H3. It is deliberately NOT registered in
  // EDITABLE_FIELD_SHAPES, because that list feeds SECTION_EDIT_PATH_PATTERN —
  // the gate on what a STORED section_edits key may be — and a label is never
  // stored under its own key. It rides along inside its container's array,
  // which computeSectionEdits already diffs whole. Registering it would widen
  // the stored-key surface to admit a scalar write into a sub-field, reachable
  // from an older or hand-edited blob, for no gain.
  //
  // plainString, never taggedText: the value lands in an H3, and the tagged
  // {text, unverified} object has no rendering there — escapeHtml would print
  // "[object Object]" as the heading, and a heading cannot carry the
  // Unverified pill that justifies the tagged form in the first place.
  // Allowlisted by container rather than inferred from kind: only these three
  // hold {label, text} items. Deriving it from `kind === 'textArray'` instead
  // would classify `sections.0.bullets.0.label` as editable, and a bullet item
  // has no label — setByPath would graft one onto a string-or-{text} item that
  // no renderer reads. Nothing stamps that path today, which is exactly why an
  // allowlist is worth more than the inference: it stays wrong-proof when a
  // future renderer starts stamping label paths of its own.
  if (LABELLED_ITEM_CONTAINERS.some((pattern) => pattern.test(path))) return 'plainString'
  // An item path: drop trailing index segments until a registered container
  // path is left. A table cell needs two (row, then column); every array
  // item needs one.
  let container = path
  for (let depth = 0; depth < 2; depth += 1) {
    const cut = container.lastIndexOf('.')
    if (cut === -1) return null
    const trailing = container.slice(cut + 1)
    if (!/^\d+$/.test(trailing)) return null
    container = container.slice(0, cut)
    const kind = editableFieldKind(container)
    if (kind === 'textArray') return 'taggedText'
    // factsArray is stricter than textArray about the STORED ARRAY (both
    // halves required — see the shape list), but a fact's TEXT still commits
    // the tagged object exactly like any other body copy: writeScalarValue
    // spreads the existing {label, text} so the label survives the edit.
    if (kind === 'factsArray') return 'taggedText'
    if (kind === 'stringArray') return 'plainString'
    if (kind === 'table') return depth === 1 ? 'plainString' : null
    if (kind) return null
  }
  return null
}

/**
 * Path pattern for a section_edits key. Kept as a single regex because
 * build_scripts/review-state-schema.js and js/review/review-state-validation.js
 * each restate this same contract (they can't import it — see their own
 * comments for why) and validate the SAME record before it ever reaches
 * applyContentEditsToPageData below. This check exists anyway as
 * defense-in-depth: a value that predates those schemas, or reaches this
 * function through some future caller that bypasses them, must not corrupt
 * page.sections just because it matched a looser check upstream.
 */
const SECTION_EDIT_PATH_PATTERN = new RegExp(
  `^(?:${EDITABLE_FIELD_SHAPES.map((entry) => entry.pattern.source.replace(/^\^|\$$/g, '')).join('|')})$`
)

/**
 * Whether a single paragraph/bullet item has the shape
 * applyContentEditsToPageData/computeSectionEdits agree on: a plain string,
 * or a {text, unverified?, unverifiedReason?} object.
 *
 * Mirrors js/review/review-state-validation.js's isValidSectionEditItem, and is kept
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
function isValidSectionEditFact(item) {
  return (
    Boolean(item) &&
    typeof item === 'object' &&
    !Array.isArray(item) &&
    typeof item.label === 'string' &&
    typeof item.text === 'string'
  )
}

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
 * Whether a section_edits value matches the shape its path's kind requires.
 *
 * Takes the KIND rather than the path so the two validator restatements
 * (build_scripts/review-state-schema.js, js/review/review-state-validation.js) can
 * express the same rule against their own path matching. A path with no kind
 * has already been rejected by the caller.
 * @param {'string'|'textArray'|'factsArray'|'stringArray'|'table'|null} kind
 * @param {unknown} value
 * @returns {boolean}
 */
function isValidSectionEditValue(kind, value) {
  if (kind === 'string') return typeof value === 'string'
  if (kind === 'textArray') return Array.isArray(value) && value.every(isValidSectionEditItem)
  if (kind === 'factsArray') return Array.isArray(value) && value.every(isValidSectionEditFact)
  if (kind === 'stringArray')
    return Array.isArray(value) && value.every((item) => typeof item === 'string')
  if (kind === 'table')
    return (
      Array.isArray(value) &&
      value.every((row) => Array.isArray(row) && row.every((cell) => typeof cell === 'string'))
    )
  return false
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
 * in js/review/ux-improvements-state-sync.js), rather than accumulated as a stored
 * diff that could drift from what the page object actually contains.
 * @param {object} page the live (possibly edited) page object
 * @param {object} originalPage the pristine page object (ORIGINAL_DATA.pages[key])
 * @returns {Record<string, unknown>}
 */
function computeSectionEdits(page, originalPage) {
  if (!page || typeof page !== 'object') return {}
  if (!originalPage || typeof originalPage !== 'object') return {}

  const edits = {}
  for (const path of editableContainerPaths(page, originalPage)) {
    const current = getByPath(page, path)
    const original = getByPath(originalPage, path)
    if (current === undefined && original === undefined) continue
    if (deepEqual(current, original)) continue
    edits[path] = current
  }
  return edits
}

/**
 * Every concrete container path worth diffing for one page — EDITABLE_FIELD_SHAPES
 * with its `\d+` placeholders expanded against the real section and step
 * counts.
 *
 * Counts come from the union of the live page and the original, not from the
 * live page alone: a reviewer can only edit fields that exist, but a page
 * whose source lost a section since an edit was recorded still needs that
 * index visited, or the stale saved value would never be reported as a
 * divergence and would sit in storage forever.
 * @param {object} page
 * @param {object} originalPage
 * @returns {string[]}
 */
function editableContainerPaths(page, originalPage) {
  const paths = []
  const sectionCount = Math.max(
    Array.isArray(page.sections) ? page.sections.length : 0,
    Array.isArray(originalPage.sections) ? originalPage.sections.length : 0
  )
  for (let i = 0; i < sectionCount; i += 1) {
    paths.push(
      `sections.${i}.heading`,
      `sections.${i}.paragraphs`,
      `sections.${i}.bullets`,
      `sections.${i}.table`,
      `sections.${i}.facts`,
      `sections.${i}.callout.title`,
      `sections.${i}.callout.text`
    )
    const steps = page.sections?.[i]?.steps
    const originalSteps = originalPage.sections?.[i]?.steps
    const stepCount = Math.max(
      Array.isArray(steps) ? steps.length : 0,
      Array.isArray(originalSteps) ? originalSteps.length : 0
    )
    for (let j = 0; j < stepCount; j += 1) {
      paths.push(
        `sections.${i}.steps.${j}.title`,
        `sections.${i}.steps.${j}.text`,
        `sections.${i}.steps.${j}.bullets`,
        `sections.${i}.steps.${j}.callout.title`,
        `sections.${i}.steps.${j}.callout.text`
      )
    }
  }
  // The page-level containers carry no index to expand, so they are listed
  // once by taking every shape whose pattern contains no `\d`.
  for (const shape of EDITABLE_FIELD_SHAPES) {
    if (!shape.pattern.source.includes('\\d')) paths.push(shape.example)
  }
  return paths
}

/**
 * Reapply a saved section_edits map onto a live page object. Called once,
 * from applySavedPageState (js/review/ux-improvements-state-sync.js), alongside
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
 * js/review/ux-improvements-state-sync.js) uses this to decide whether the
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
    const kind = editableFieldKind(path)
    if (!kind || !isValidSectionEditValue(kind, value)) continue
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
// loaded after js/core/utils.js in js/main.js's import order, not an ES module
// importer of it (dual-export files in this repo take no imports — see
// js/review/review-merge.js and js/standards/plain-language.js for the same shape).
const { getByPath, setByPath } =
  typeof module !== 'undefined' && module.exports ? require('../core/utils.js') : window.utils

if (typeof window !== 'undefined') {
  window.inlineEditData = {
    computeSectionEdits,
    applyContentEditsToPageData,
    EDITABLE_FIELD_SHAPES,
    editableFieldKind,
    editableItemKind,
    SECTION_EDIT_PATH_PATTERN,
    isValidSectionEditValue,
  }
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    computeSectionEdits,
    applyContentEditsToPageData,
    EDITABLE_FIELD_SHAPES,
    editableFieldKind,
    editableItemKind,
    SECTION_EDIT_PATH_PATTERN,
    isValidSectionEditValue,
  }
}
