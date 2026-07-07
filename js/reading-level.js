// Flesch-Kincaid grade level for mockup body copy (browser-safe, no Node deps).
// Node build scripts can use build_scripts/reading-level.js (text-readability) for parity checks.
;(function initReadingLevel() {
  if (typeof window === 'undefined') return

  function countSyllables(word) {
    const w = String(word)
      .toLowerCase()
      .replace(/[^a-z]/g, '')
    if (!w) return 0
    if (w.length <= 3) return 1
    const vowels = w.match(/[aeiouy]+/g)
    let count = vowels ? vowels.length : 1
    if (w.endsWith('e') && !w.endsWith('le')) count -= 1
    return Math.max(1, count)
  }

  function tokenize(text) {
    return String(text || '')
      .replace(/\*\*/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .split(/\s+/)
      .filter(Boolean)
  }

  /**
   * Compute Flesch-Kincaid grade level for plain text.
   * @param {string} text
   * @returns {number|null} grade level, or null when text is too short
   */
  function fleschKincaidGrade(text) {
    const words = tokenize(text)
    if (words.length < 5) return null

    const sentences = String(text)
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    const sentenceCount = Math.max(1, sentences.length)
    const wordCount = words.length
    const syllableCount = words.reduce((sum, word) => sum + countSyllables(word), 0)

    const grade = 0.39 * (wordCount / sentenceCount) + 11.8 * (syllableCount / wordCount) - 15.59
    return Math.round(grade * 10) / 10
  }

  /**
   * Extract readable body text from a page object.
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

  /**
   * Parse a stored reading target like "Grade 5–6" into [min, max].
   * @param {string} readingTarget
   * @returns {[number, number]|null}
   */
  function parseReadingTarget(readingTarget) {
    const match = String(readingTarget || '').match(/(\d+)\s*[–-]\s*(\d+)/)
    if (match) return [Number(match[1]), Number(match[2])]
    const single = String(readingTarget || '').match(/(\d+)/)
    if (single) {
      const grade = Number(single[1])
      return [grade, grade]
    }
    return null
  }

  /**
   * Compare computed grade to the page's stated reading target.
   * @param {object} page
   * @returns {{ computed: number|null, target: string, withinTarget: boolean|null, detail: string }}
   */
  function analyzeReadingLevel(page) {
    const target = page.reading || ''
    const computed = fleschKincaidGrade(extractPageBodyText(page))
    const range = parseReadingTarget(target)

    if (computed == null) {
      return {
        computed: null,
        target,
        withinTarget: null,
        detail: 'Not enough body text to compute reading level',
      }
    }

    if (!range) {
      return {
        computed,
        target,
        withinTarget: null,
        detail: `Computed grade ${computed}; no numeric target to compare`,
      }
    }

    const [min, max] = range
    const withinTarget = computed >= min - 1 && computed <= max + 2
    return {
      computed,
      target,
      withinTarget,
      detail: withinTarget
        ? `Computed grade ${computed} is within target ${target}`
        : `Computed grade ${computed} exceeds target ${target}`,
    }
  }

  window.readingLevel = {
    fleschKincaidGrade,
    extractPageBodyText,
    parseReadingTarget,
    analyzeReadingLevel,
  }
})()
