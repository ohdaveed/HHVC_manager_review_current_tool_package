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
 * Extract readable body text from a page object (same shape as browser helper).
 * @param {object} page
 * @returns {string}
 */
function extractPageBodyText(page) {
  const chunks = [page.title, page.summary]
  for (const section of page.sections || []) {
    if (section.heading) chunks.push(section.heading)
    for (const paragraph of section.paragraphs || []) chunks.push(paragraph)
    for (const bullet of section.bullets || []) chunks.push(bullet)
    for (const step of section.steps || []) {
      if (step.title) chunks.push(step.title)
      for (const line of step.text || []) chunks.push(line)
      for (const bullet of step.bullets || []) chunks.push(bullet)
    }
    for (const card of section.cards || []) {
      if (card.title) chunks.push(card.title)
      if (card.text) chunks.push(card.text)
    }
    if (section.callout?.text) chunks.push(section.callout.text)
  }
  return chunks.filter(Boolean).join(' ')
}

module.exports = { fleschKincaidGrade, extractPageBodyText }
