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
   * Flatten one text-bearing item to a plain string.
   *
   * Text arrays in the page schema accept either a bare string or an object —
   * `{ text, unverified? }` for body copy and `{ label?, text }` for
   * whatToKnow entries. Before this existed the traversal below pushed those
   * objects straight into the chunk list, so they reached the readability
   * formula as the literal string "[object Object]". Keep in step with
   * build_scripts/reading-level.js.
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
   * Flatten a callout to its readable text, title included. `title` is a union
   * of string and the literal `false`, so it cannot go through normalizeTextItem.
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
   * Chunks are self-contained units — a heading, a bullet, an audience entry —
   * and most carry no terminal punctuation. Joining them with a bare space
   * made every consecutive unpunctuated unit read as one enormous sentence
   * (`scopeInfo`'s bullet list became a single 218-word "sentence"). Keep in
   * step with build_scripts/reading-level.js.
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
   * Extract readable body text from a page object.
   *
   * Include everything the reader reads as prose, exclude UI chrome: so
   * `audience[]`, callout titles, step callouts, table cells, whatToKnow and
   * spotlight copy are in; button/CTA labels stay out, since they are short
   * imperative fragments that skew sentence-length averages.
   * @param {object} page
   * @returns {string}
   */
  function extractPageBodyText(page) {
    if (!page || typeof page !== 'object') return ''
    const chunks = [page.title, page.summary]

    for (const item of page.audience || []) chunks.push(normalizeTextItem(item))

    if (page.whatToKnow) {
      if (page.whatToKnow.cost) chunks.push(page.whatToKnow.cost)
      for (const item of page.whatToKnow.thingsToKnow || []) chunks.push(normalizeTextItem(item))
      for (const item of page.whatToKnow.items || []) chunks.push(normalizeTextItem(item))
    }

    if (page.spotlight) {
      if (page.spotlight.title) chunks.push(page.spotlight.title)
      for (const paragraph of page.spotlight.paragraphs || []) {
        chunks.push(normalizeTextItem(paragraph))
      }
    }

    for (const section of page.sections || []) {
      if (section.heading) chunks.push(section.heading)
      for (const paragraph of section.paragraphs || []) chunks.push(normalizeTextItem(paragraph))
      for (const bullet of section.bullets || []) chunks.push(normalizeTextItem(bullet))
      for (const step of section.steps || []) {
        if (step.title) chunks.push(step.title)
        for (const line of step.text || []) chunks.push(normalizeTextItem(line))
        for (const bullet of step.bullets || []) chunks.push(normalizeTextItem(bullet))
        chunks.push(calloutText(step.callout))
      }
      for (const card of section.cards || []) {
        if (card.title) chunks.push(card.title)
        if (card.text) chunks.push(card.text)
      }
      for (const row of section.table || []) {
        for (const cell of row || []) chunks.push(normalizeTextItem(cell))
      }
      chunks.push(calloutText(section.callout))
    }

    return joinChunks(chunks)
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

    // Asymmetric tolerance: one grade of slack below the stated target, two
    // above. Copy pitched a little simpler than its target is not a problem;
    // copy pitched harder is what the check exists to catch.
    const [min, max] = range
    const withinTarget = computed >= min - 1 && computed <= max + 2
    // Say which direction it missed in. This used to report "exceeds" for both
    // sides, so a page reading *below* its target was described as reading
    // above it — the opposite of the actual finding.
    const direction = computed > max + 2 ? 'exceeds' : 'falls below'
    return {
      computed,
      target,
      withinTarget,
      detail: withinTarget
        ? `Computed grade ${computed} is within target ${target}`
        : `Computed grade ${computed} ${direction} target ${target}`,
    }
  }

  window.readingLevel = {
    fleschKincaidGrade,
    extractPageBodyText,
    normalizeTextItem,
    calloutText,
    joinChunks,
    parseReadingTarget,
    analyzeReadingLevel,
  }
})()
