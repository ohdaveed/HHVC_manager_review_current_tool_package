// Flesch-Kincaid grade level via text-readability (Node/Bun build scripts and tests).
const readability = require('text-readability').default

/**
 * Compute Flesch-Kincaid grade level for plain text.
 * @param {string} text
 * @returns {number|null}
 */
function fleschKincaidGrade(text) {
  const clean = String(text || '').trim()
  if (!clean) return null
  const grade = readability.fleschKincaidGrade(clean)
  return Number.isFinite(grade) ? Math.round(grade * 10) / 10 : null
}

/**
 * Flatten one text-bearing item to a plain string.
 *
 * Text arrays in the page schema accept either a bare string or an object —
 * `{ text, unverified? }` for body copy (build_scripts/schema.js's
 * unverifiedItemSchema) and `{ label?, text }` for whatToKnow entries. Before
 * this existed the traversal below pushed those objects straight into the
 * chunk list, so they reached the readability formula as the literal string
 * "[object Object]": 10 occurrences across 4 real pages, which pushed
 * `scopeInfo` to a nonsense grade 21.4. Both shapes are handled here so the
 * grade is computed over the words a reader actually sees.
 * @param {unknown} item
 * @returns {string}
 */
function normalizeTextItem(item) {
  if (typeof item === 'string') return item
  if (!item || typeof item !== 'object') return ''
  const label = typeof item.label === 'string' ? item.label : ''
  const text = typeof item.text === 'string' ? item.text : ''
  return [label, text].filter(Boolean).join(' ')
}

/**
 * Flatten a callout to its readable text, title included.
 * `title` is a union of string and the literal `false` (which suppresses the
 * heading at render time), so it cannot go through normalizeTextItem.
 * @param {object|undefined} callout
 * @returns {string}
 */
function calloutText(callout) {
  if (!callout || typeof callout !== 'object') return ''
  const title = typeof callout.title === 'string' ? callout.title : ''
  const text = typeof callout.text === 'string' ? callout.text : ''
  return [title, text].filter(Boolean).join(' ')
}

/**
 * Join extracted chunks into text a readability formula can segment.
 *
 * Chunks are self-contained units — a heading, a bullet, an audience entry, a
 * card title — and most carry no terminal punctuation. Joining them with a
 * bare space (what this used to do) made every consecutive unpunctuated unit
 * read as one enormous sentence: `scopeInfo`'s bullet list alone became a
 * single 218-word "sentence", dragging its average to 37.4 words and its
 * Flesch-Kincaid grade to a meaningless 21.4. Terminating each chunk keeps
 * one unit as one sentence.
 * @param {Array<unknown>} chunks
 * @returns {string}
 */
function joinChunks(chunks) {
  return chunks
    .map((chunk) => String(chunk == null ? '' : chunk).trim())
    .filter(Boolean)
    .map((chunk) => (/[.!?]["')\]]?$/.test(chunk) ? chunk : `${chunk}.`))
    .join(' ')
}

/**
 * Extract readable body text from a page object (same shape as browser helper).
 *
 * The rule for what belongs here: include everything the reader reads as prose
 * on the rendered page, exclude UI chrome. So `audience[]` (rendered as the
 * "Who this page is for" list), callout titles, step callouts, table cells,
 * whatToKnow and spotlight copy are all in; button/CTA labels stay out, since
 * they are short imperative fragments that skew sentence-length averages
 * without being prose the grade should judge.
 * @param {object} page
 * @returns {string}
 */
function extractPageBodyText(page) {
  if (!page || typeof page !== 'object') return ''
  // Every field goes through normalizeTextItem, including the ones that are
  // plain strings in today's data. It is a no-op for a string, and the moment
  // any of these picks up the `{text, unverified}` shape the rest of the schema
  // already allows, the untouched ones would silently re-introduce the exact
  // `[object Object]` corruption this function was fixed to remove.
  const chunks = [normalizeTextItem(page.title), normalizeTextItem(page.summary)]

  for (const item of page.audience || []) chunks.push(normalizeTextItem(item))

  if (page.whatToKnow) {
    if (page.whatToKnow.cost) chunks.push(normalizeTextItem(page.whatToKnow.cost))
    for (const item of page.whatToKnow.thingsToKnow || []) chunks.push(normalizeTextItem(item))
    for (const item of page.whatToKnow.items || []) chunks.push(normalizeTextItem(item))
  }

  if (page.spotlight) {
    if (page.spotlight.title) chunks.push(normalizeTextItem(page.spotlight.title))
    for (const paragraph of page.spotlight.paragraphs || [])
      chunks.push(normalizeTextItem(paragraph))
  }

  for (const section of page.sections || []) {
    if (section.heading) chunks.push(normalizeTextItem(section.heading))
    for (const paragraph of section.paragraphs || []) chunks.push(normalizeTextItem(paragraph))
    for (const bullet of section.bullets || []) chunks.push(normalizeTextItem(bullet))
    for (const step of section.steps || []) {
      if (step.title) chunks.push(normalizeTextItem(step.title))
      for (const line of step.text || []) chunks.push(normalizeTextItem(line))
      for (const bullet of step.bullets || []) chunks.push(normalizeTextItem(bullet))
      chunks.push(calloutText(step.callout))
    }
    for (const card of section.cards || []) {
      if (card.title) chunks.push(normalizeTextItem(card.title))
      if (card.text) chunks.push(normalizeTextItem(card.text))
    }
    for (const row of section.table || []) {
      for (const cell of row || []) chunks.push(normalizeTextItem(cell))
    }
    chunks.push(calloutText(section.callout))
  }

  return joinChunks(chunks)
}

module.exports = {
  fleschKincaidGrade,
  extractPageBodyText,
  normalizeTextItem,
  calloutText,
  joinChunks,
}
