/* Pure serialization boundary between the plain-string/{text,unverified,...}
   page-value shapes this tool has always stored and @editorjs/editorjs's
   block-JSON OutputData shape. Editor.js is a transient EDITING widget only
   — its blocks never become the storage format. Every value this module
   produces for a page write is exactly the shape writeScalarValue already
   wrote before Editor.js existed (js/inline-content-edit.js), so
   build_scripts/review-state-schema.js, js/review-state-validation.js and
   js/inline-content-edit-data.js's SECTION_EDIT_PATH_PATTERN/shape checks
   need no changes — this file's whole job is to keep producing values that
   already satisfy checks that predate it.

   Dual-exported (window.inlineEditAdapter plus module.exports), matching
   js/inline-content-edit-data.js, js/review-merge.js and
   js/plain-language.js, so this file has no DOM dependency and is
   importable directly under Bun with no browser and no live Editor.js
   instance — the round-trip tests in
   tests/inline-content-edit-adapter.test.js exercise plain OutputData
   objects, never a real editor.

   Deliberately import-free, like js/inline-content-edit-data.js: escaping
   and unescaping are reimplemented here rather than importing
   js/utils.js's escapeHtml, so this module has no load-order dependency of
   its own. */

/**
 * The editable field kinds. Scalar fields resolve to a plain string on
 * commit; paragraph/bullet items resolve to the same tagged object form
 * writeScalarValue already writes for a manual edit
 * (js/inline-content-edit.js:100-104) — this module's job is field-shape
 * fidelity, not a new tagging convention.
 *
 * `markdownText` is the one kind that splits those two properties apart, and
 * it exists because a callout's body and a table cell are both: the renderer
 * runs them through formatMarkdown(), so their `[label](target)` links must
 * survive a round trip like a paragraph's — but the page schema stores them
 * as bare strings, so the tagged object a paragraph commits to would render
 * as the literal "[object Object]". It therefore reads and writes markdown
 * like an item while resolving to a plain string like a scalar.
 */
const SCALAR_FIELD_TYPES = ['title', 'summary', 'primaryCta', 'heading', 'markdownText']
const ITEM_FIELD_TYPES = ['paragraph', 'bullet']
const FIELD_TYPES = [...SCALAR_FIELD_TYPES, ...ITEM_FIELD_TYPES]

/**
 * Whether a field type's text carries the markdown the renderer interprets
 * (bold, and the inline links the link tool writes), as opposed to plain text
 * whose renderer prints it verbatim.
 * @param {string} fieldType one of FIELD_TYPES
 * @returns {boolean}
 */
function isMarkdownFieldType(fieldType) {
  return ITEM_FIELD_TYPES.includes(fieldType) || fieldType === 'markdownText'
}

/**
 * The `unverifiedReason` stamped on a manually edited paragraph or bullet.
 *
 * Declared once and read by js/inline-content-edit.js off
 * `window.inlineEditAdapter` rather than restated there, because this is a
 * PERSISTED data value, not a label: it is written into `section_edits` under
 * hhvcManagerReviewState:v1 and rendered as the Unverified pill's reason. Two
 * literals of a stored string means two classes of edited item that no longer
 * compare equal, with nothing on screen to show why.
 */
const MANUAL_EDIT_UNVERIFIED_REASON = 'Manually edited during review'

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const HTML_UNESCAPES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }

/**
 * Escape the five HTML special characters, matching js/utils.js's
 * escapeHtml exactly (character set and entity spelling) — not imported,
 * per this file's own import-free convention, but must stay in step with
 * it by inspection since both run over the same authored content.
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch])
}

/**
 * Invert escapeHtml. A single left-to-right regex pass is exact here
 * (rather than ambiguous) because escapeHtml only ever emits these five
 * literal entity strings for an actual &/</>/"/' character — a source
 * string that happens to already contain the literal text "&amp;" gets
 * escaped to "&amp;amp;" by escapeHtml, and this single pass consumes only
 * the leading "&amp;" of that pair, correctly leaving "amp;" untouched and
 * reproducing the original "&amp;" rather than over-decoding it.
 * @param {string} html
 * @returns {string}
 */
function unescapeHtml(html) {
  return String(html).replace(/&amp;|&lt;|&gt;|&quot;|&#39;/g, (m) => HTML_UNESCAPES[m])
}

/**
 * Convert a stored plain-text value (the bold/link markdown convention —
 * **bold**, [label](target) — js/page-render.js's formatMarkdown() renders)
 * into the inline HTML representation Editor.js's paragraph block holds
 * while editing. Applies ONLY to paragraph/bullet items — title, summary,
 * primaryCta, and section heading are rendered by renderHero()/button()/
 * renderSection() via a bare escapeHtml() with no formatMarkdown() call at
 * all (js/page-render.js:216,219,560,631), so those four fields never
 * interpret that bold/link syntax on the real mockup; converting an edit
 * to one of them into that markup would store literal asterisks a reviewer
 * never asked for and the renderer will never turn back into formatting.
 * plainTextToEditingHtml/editingHtmlToPlainText below are the correct pair
 * for those four fields — see pageValueToEditorData's dispatch.
 *
 * This is a private editing-time representation, independent of
 * formatMarkdown's own rendered HTML (which adds UI chrome like the
 * external-link "↗" glyph that belongs to the mockup, not to editing) — the
 * only shared contract between the two is the plain-string markdown
 * convention itself, which is what actually gets persisted. Order matters
 * and mirrors formatMarkdown exactly: escape first, then bold, then links,
 * so a bold span wrapping a link ("**[label](target)**") and a link whose
 * label is bold ("[**label**](target)") both survive the round trip the
 * same way formatMarkdown's own two-pass regex does.
 * @param {string} text
 * @returns {string} inline HTML
 */
function markdownToEditingHtml(text) {
  if (typeof text !== 'string') return ''
  let html = escapeHtml(text).replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, target) =>
    /^https?:\/\//.test(target)
      ? `<a href="${target}" target="_blank" rel="noopener noreferrer">${label}</a>`
      : `<a data-render-target="${target}">${label}</a>`
  )
  return html
}

/**
 * Invert markdownToEditingHtml. Unwraps in the opposite order links were
 * added in (links, then bold, then unescape), which is what makes the two
 * nesting cases above symmetric. Any tag this function doesn't recognize
 * (a paste artifact — a stray <div>, <span>, <br>) is stripped while its
 * text content is kept, mirroring
 * js/inline-content-edit-data.js's applyContentEditsToPageData "drop don't
 * throw" posture: an unrecognized fragment degrades to plain text rather
 * than surfacing raw HTML into stored content or throwing.
 * @param {string} html
 * @returns {string} plain-text markdown
 */
function editingHtmlToMarkdown(html) {
  if (typeof html !== 'string') return ''
  let text = html.replace(
    /<a\s+data-render-target="([^"]*)">([\s\S]*?)<\/a>/g,
    (match, target, label) => `[${label}](${target})`
  )
  text = text.replace(
    /<a\s+href="([^"]*)"(?:\s+target="_blank")?(?:\s+rel="noopener noreferrer")?>([\s\S]*?)<\/a>/g,
    (match, target, label) => `[${label}](${target})`
  )
  text = text.replace(/<(?:b|strong)>([\s\S]*?)<\/(?:b|strong)>/g, (match, inner) => `**${inner}**`)
  // Defense-in-depth for real Editor.js output (paste, browser
  // contenteditable normalization): strip any remaining tag, keep its text.
  // Never exercised by the pure round-trip test below, which only ever
  // feeds this function HTML this module itself produced.
  text = text.replace(/<[^>]+>/g, '')
  return unescapeHtml(text)
}

/**
 * The plain-text pair for title/summary/primaryCta/heading (see
 * markdownToEditingHtml's comment for why those four fields get no
 * bold/link interpretation): escape only, no markdown syntax applied.
 * @param {string} text
 * @returns {string} inline HTML — just the escaped text, no tags
 */
function plainTextToEditingHtml(text) {
  if (typeof text !== 'string') return ''
  return escapeHtml(text)
}

/**
 * Invert plainTextToEditingHtml. Strips ANY tag Editor.js's contenteditable
 * introduced — including a real <b>/<a> a reviewer produced via the inline
 * toolbar or a paste — before unescaping, since renderHero()/button()/
 * renderSection() have no formatMarkdown() call to turn markup back into
 * formatting for these four fields; keeping a <b> tag's boundary as literal
 * "**" here would be just as wrong as keeping the tag itself.
 * @param {string} html
 * @returns {string} plain text
 */
function editingHtmlToPlainText(html) {
  if (typeof html !== 'string') return ''
  return unescapeHtml(html.replace(/<[^>]+>/g, ''))
}

/**
 * Whether a field kind wraps its committed value as
 * {text, unverified, unverifiedReason} (paragraph/bullet items) or writes a
 * plain string (title/summary/primaryCta/heading) — the same split
 * writeScalarValue already makes (js/inline-content-edit.js:82-105).
 * @param {string} fieldType
 * @returns {boolean}
 */
function isItemFieldType(fieldType) {
  return ITEM_FIELD_TYPES.includes(fieldType)
}

/**
 * Concatenate every paragraph-type block's text into one string, in block
 * order, joined by a blank line. A single-block-constrained Editor.js
 * instance (every instance this feature ever opens, per the "Instance
 * granularity" design) normally has exactly one block — the join and the
 * defensive non-paragraph-block skip exist for the same "drop don't throw"
 * reason applyContentEditsToPageData tolerates a stale/malformed path: a
 * paste or undo/redo can still leave more than one block, or a block of a
 * type the tools config was meant to exclude, and this function must never
 * throw on that, only degrade.
 * @param {unknown} blocks
 * @returns {string}
 */
function blocksToEditingHtml(blocks) {
  if (!Array.isArray(blocks)) return ''
  return blocks
    .filter((block) => block && block.type === 'paragraph' && typeof block.data?.text === 'string')
    .map((block) => block.data.text)
    .join('\n\n')
}

/**
 * Plain page value (a string) → Editor.js OutputData for initializing an
 * editor instance. Returns only `blocks` — `time`/`version` are meaningful
 * on editor.save() output, not on data handed to `new EditorJS({data})`,
 * so there is nothing meaningful to fabricate for them here.
 *
 * Dispatches by fieldType: paragraph/bullet items go through
 * markdownToEditingHtml (the renderer interprets that bold/link syntax
 * for these); title/summary/primaryCta/heading go through
 * plainTextToEditingHtml (the renderer never does for these four — see
 * markdownToEditingHtml's comment).
 * @param {string} fieldType one of FIELD_TYPES
 * @param {string} value the plain string readScalarValue already unwrapped
 * @returns {{blocks: Array<{type: 'paragraph', data: {text: string}}>}}
 */
function pageValueToEditorData(fieldType, value) {
  const text = typeof value === 'string' ? value : ''
  const html = isMarkdownFieldType(fieldType)
    ? markdownToEditingHtml(text)
    : plainTextToEditingHtml(text)
  return { blocks: [{ type: 'paragraph', data: { text: html } }] }
}

/**
 * Editor.js OutputData (the resolved value of editor.save()) → the plain
 * page-value shape writeScalarValue already writes: a plain string for
 * title/summary/primaryCta/heading, or {text, unverified: true,
 * unverifiedReason} for a paragraph/bullet item — reusing the existing
 * Unverified-pill rendering with no renderer change, exactly as
 * writeScalarValue's own comment documents (js/inline-content-edit.js:71-76).
 *
 * Dispatches by fieldType the same way pageValueToEditorData does, and for
 * the same reason: a scalar field's block HTML is decoded as plain text
 * (editingHtmlToPlainText), never re-encoded as bold/link markdown the
 * renderer would never interpret for it.
 * @param {string} fieldType one of FIELD_TYPES
 * @param {unknown} outputData the object editor.save() resolved to
 * @returns {string|{text: string, unverified: true, unverifiedReason: string}}
 */
function editorDataToPageValue(fieldType, outputData) {
  const html = blocksToEditingHtml(outputData?.blocks)
  const isItem = isItemFieldType(fieldType)
  const text = isMarkdownFieldType(fieldType)
    ? editingHtmlToMarkdown(html)
    : editingHtmlToPlainText(html)
  if (isItem) {
    return { text, unverified: true, unverifiedReason: MANUAL_EDIT_UNVERIFIED_REASON }
  }
  return text
}

if (typeof window !== 'undefined') {
  window.inlineEditAdapter = {
    pageValueToEditorData,
    editorDataToPageValue,
    markdownToEditingHtml,
    editingHtmlToMarkdown,
    plainTextToEditingHtml,
    editingHtmlToPlainText,
    isItemFieldType,
    isMarkdownFieldType,
    FIELD_TYPES,
    SCALAR_FIELD_TYPES,
    ITEM_FIELD_TYPES,
    MANUAL_EDIT_UNVERIFIED_REASON,
  }
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    pageValueToEditorData,
    editorDataToPageValue,
    markdownToEditingHtml,
    editingHtmlToMarkdown,
    plainTextToEditingHtml,
    editingHtmlToPlainText,
    isItemFieldType,
    isMarkdownFieldType,
    FIELD_TYPES,
    SCALAR_FIELD_TYPES,
    ITEM_FIELD_TYPES,
    MANUAL_EDIT_UNVERIFIED_REASON,
  }
}
