// Flesch-Kincaid grade level for mockup body copy.
//
// This is the ONLY reading-level implementation in the repo, and that is a
// recent and deliberate change. There used to be two: this file carried a
// hand-rolled formula because it had to run in the browser with no build step,
// and build_scripts/reading-level.js wrapped `text-readability` for Node. Only
// the Node copy had tests. Only the browser copy shipped.
//
// They did not agree, and not marginally: over the 19 real pages the browser
// formula read LOWER on 18 of them, by 1.14 grades on average and 2.7 at the
// worst (article11Guide: 7.6 here against 10.3 there). The whole point of the
// check is to tell a reviewer whether copy is harder than its stated target, so
// a formula biased toward "easier than it is" fails in the one direction that
// matters. Nine of the 19 pages were reported as hitting their target when the
// authoritative formula says they do not.
//
// The cause was syllable counting. The old countSyllables() counted vowel runs
// and subtracted a silent trailing "e"; `text-readability` delegates to the
// rule-based `syllable` package. The approximation was not uniformly low —
// per word it missed in both directions ("remediation" 4 against the correct
// 5, "investigates" 5 against the correct 4) — but over the vocabulary these
// pages actually use it netted out consistently easy. That is not a gap a
// regex can be tuned to close, so the browser now uses the same library
// instead of approximating it. Vite bundles it, which costs 40 kB raw / 17.9
// kB gzip on the app chunk — real, and worth it for the tool's only automated
// content-quality number. The "no Node deps" constraint this file was written
// under disappeared with the Vite migration, and the duplicate outlived its
// own reason for existing.
import readability from 'text-readability'
;(function initReadingLevel() {
  if (typeof window === 'undefined') return

  /**
   * Compute Flesch-Kincaid grade level for plain text.
   *
   * `text-readability` returns a grade for any non-empty string, including a
   * two-word fragment where the sentence-length term is meaningless. The
   * five-word floor below is this tool's own guard, kept from the previous
   * implementation: a page with almost no body copy should report "not enough
   * text to compute" rather than a confident number derived from a headline.
   * @param {string} text
   * @returns {number|null} grade level, or null when text is too short
   */
  function fleschKincaidGrade(text) {
    const clean = String(text || '').trim()
    // Markdown emphasis and link syntax are authoring marks, not words the
    // reader sees. Left in, `[Report a problem](rodentsReport)` contributes the
    // page key as if it were prose.
    const plain = clean.replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    if (plain.split(/\s+/).filter(Boolean).length < 5) return null

    const grade = readability.fleschKincaidGrade(plain)
    return Number.isFinite(grade) ? Math.round(grade * 10) / 10 : null
  }

  /**
   * Flatten one text-bearing item to a plain string.
   *
   * Text arrays in the page schema accept either a bare string or an object —
   * `{ text, unverified? }` for body copy and `{ label?, text }` for
   * whatToKnow entries. Before this existed the traversal below pushed those
   * objects straight into the chunk list, so they reached the readability
   * formula as the literal string "[object Object]": 10 occurrences across 4
   * real pages, which pushed `scopeInfo` to a nonsense grade 21.4. Both shapes
   * are handled here so the grade is computed over the words a reader sees.
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
   * made every consecutive unpunctuated unit read as one enormous sentence:
   * `scopeInfo`'s bullet list alone became a single 218-word "sentence",
   * dragging its average to 37.4 words and its grade to a meaningless 21.4.
   * Terminating each chunk keeps one unit as one sentence.
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
    // Every field goes through normalizeTextItem, including the ones that are
    // plain strings in today's data. It is a no-op for a string, and the moment
    // any of these picks up the `{text, unverified}` shape the rest of the
    // schema already allows, the untouched ones would silently re-introduce the
    // exact `[object Object]` corruption this function was fixed to remove.
    const chunks = [normalizeTextItem(page.title), normalizeTextItem(page.summary)]

    for (const item of page.audience || []) chunks.push(normalizeTextItem(item))

    if (page.whatToKnow) {
      if (page.whatToKnow.cost) chunks.push(normalizeTextItem(page.whatToKnow.cost))
      for (const item of page.whatToKnow.thingsToKnow || []) chunks.push(normalizeTextItem(item))
      for (const item of page.whatToKnow.items || []) chunks.push(normalizeTextItem(item))
    }

    if (page.spotlight) {
      if (page.spotlight.title) chunks.push(normalizeTextItem(page.spotlight.title))
      for (const paragraph of page.spotlight.paragraphs || []) {
        chunks.push(normalizeTextItem(paragraph))
      }
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
