/* Deterministic plain-language and scannability scoring for HHVC page copy.

   Every rule here encodes a written standard, not a preference. The primary
   source is notebooklm/hhvc-standards-manual.md ("HHVC Web Governance and
   Content Standards Manual", v2.1) sections 7.2-7.9, cross-checked against the
   live SF.gov / Karl Editor Help Center guidance (Readability, How to write in
   plain language, Tone and voice, Check your content). Each check below cites
   the section it comes from, so a reviewer who disagrees with a result can go
   argue with the standard rather than with the tool.

   Consumed by the browser (js/ux-improvements-state-sync.js's Page checks
   panel) via window.plainLanguage, and by Node/Bun (tests, and later the AI
   output validator) via a plain require -- the same dual-export arrangement
   js/review-merge.js uses, and for the same reason: one implementation cannot
   drift from itself. It has no DOM dependency and must stay loadable in both
   contexts.

   Wrapped in an IIFE rather than declared at top level because a classic
   <script> shares one global scope with every other js/*.js file, and
   js/page-render.js already declares a top-level `normalizeTextItem`. */
;(function initPlainLanguage() {
  // --- Thresholds -------------------------------------------------------
  // Manual 7.2.2: sentences average "15 to 20 words or fewer"; the Karl
  // Readability page is stricter still ("users understand 100% of sentences at
  // 9 words or less", 90% at 14). We score the mean against the manual's
  // stricter end and flag individual sentences that run past its looser end,
  // so a page can pass on average while still being told which sentences hurt.
  const MEAN_SENTENCE_WORDS = 15
  const LONG_SENTENCE_WORDS = 20
  const MAX_PARAGRAPH_SENTENCES = 3 // 7.2.2
  const MAX_PARAGRAPHS_BEFORE_BREAK = 3 // 7.2.2
  const MAX_LIST_ITEMS_IN_SENTENCE = 3 // 7.2.2
  const MAX_ALT_TEXT_CHARS = 120 // 7.6.1
  const MAX_SEO_TITLE_CHARS = 60 // 7.8
  // Manual 7.8 also specifies a 110-160 character meta description, which this
  // file deliberately does not enforce -- see the meta-description check for
  // why that rule cannot coexist with the one already in the reviewer UI.

  /**
   * Reading-level targets by content category (manual 7.2.1). Keyed by the
   * normalized Karl content type this mockup uses. Advisory only -- the Karl
   * Readability page is explicit that a 5th-grade level "is not required on
   * SF.gov, but it's a helpful guideline", and docs/wagtail-content-mapping.md
   * already records that this contradicts the manual's publish-blocking
   * framing. We report the disagreement rather than silently picking a winner.
   */
  const RECOMMENDED_READING_TARGETS = {
    transaction: [5, 6],
    information: [6, 6],
    agency: [6, 6],
    topic: [6, 6],
    campaign: [6, 6],
    'resource collection': [6, 6],
    report: [7, 8],
  }

  // Manual 7.2.3 names the first four explicitly; the rest are the standard
  // plain-language swaps from the same section's "prioritize common, everyday
  // words" rule. Kept deliberately short -- a long list produces noise, and a
  // noisy panel gets ignored.
  const WORD_SWAPS = [
    ['assistance', 'help'],
    ['require', 'need'],
    ['requires', 'needs'],
    ['required', 'needed'],
    ['mandate', 'must'],
    ['commence', 'start'],
    ['cease', 'stop'],
    ['utilize', 'use'],
    ['obtain', 'get'],
    ['prior to', 'before'],
    ['in order to', 'to'],
    ['additional', 'more'],
    ['sufficient', 'enough'],
    ['terminate', 'end'],
    ['remainder', 'rest'],
    ['approximately', 'about'],
  ]

  // Manual 7.2.3: contractions are banished because stressed readers, non-native
  // speakers, and screen readers misread apostrophes -- which can reverse the
  // meaning of an instruction. Listed explicitly rather than matched by regex
  // so possessives ("the City's inspectors") are never flagged.
  const CONTRACTIONS = [
    "don't",
    "doesn't",
    "didn't",
    "can't",
    "won't",
    "wouldn't",
    "shouldn't",
    "couldn't",
    "isn't",
    "aren't",
    "wasn't",
    "weren't",
    "hasn't",
    "haven't",
    "hadn't",
    "it's",
    "you're",
    "we're",
    "they're",
    "i'm",
    "you'll",
    "we'll",
    "they'll",
    "you've",
    "we've",
    "they've",
    "that's",
    "there's",
    "here's",
    "what's",
    "who's",
    "let's",
  ]

  // Manual 7.3: "must" / "should" / "may" / "will" are the whole permitted set.
  // These periphrastic forms are the common ways writers dodge it.
  const WEAK_MODALS = ['is required to', 'are required to', 'needs to', 'need to', 'has to']

  const GENERIC_LINK_LABELS = [
    'click here',
    'here',
    'read more',
    'more',
    'learn more',
    'info',
    'link',
    'this page',
    'this link',
    'download',
  ]

  // Manual 7.7: idioms do not survive translation into the City's threshold
  // languages, so they are a language-access problem, not a style preference.
  const IDIOMS = [
    'in a jiffy',
    'piece of cake',
    'ballpark',
    'down the road',
    'circle back',
    'touch base',
    'heads up',
    'on the same page',
    'rule of thumb',
    'cut corners',
    'red tape',
    'hit the ground running',
    'reach out',
    'a leg up',
    'jump through hoops',
  ]

  // Manual 7.7: one concept, one label. Translators cannot reconcile synonyms,
  // and in an enforcement context a swapped term is a legal error.
  const TERMINOLOGY_GROUPS = [
    {
      canonical: 'Notice of Violation',
      variants: ['citation notice', 'violation letter', 'violations letter', 'warning ticket'],
    },
    {
      canonical: '311',
      variants: ['3-1-1'],
    },
  ]

  const HEADING_PREFIXES = ['how to', 'instructions for', 'information about', 'a guide to']

  // Karl components: Button ("Buttons can only be 25 characters long") and the
  // A-to-Z guide's Bullets entry ("limit to 3-5 bullets").
  const MAX_BUTTON_CHARS = 25
  const MAX_BULLETS_PER_LIST = 5

  /**
   * SF.gov house style, from the Content style guide A-to-Z and "More house
   * style rules" on the Karl Editor Help Center. These are mechanical and
   * unambiguous, which is exactly why they belong in a tool rather than in a
   * reviewer's head. Grouped into one check so a dozen individually-tiny rules
   * cannot crowd out the substantive findings above.
   *
   * Two entries from those pages are deliberately absent. Verb-first button
   * text needs a verb allowlist, and an incomplete one flagged "Open lookup
   * tool" as a violation — the same unimplementable-by-allowlist problem that
   * removed Title Case detection. Bullet terminal punctuation ("no punctuation
   * within bullets") matches 115 times because every bullet in the repo ends
   * in a period; that is a house-convention decision to make once, not 115
   * findings to show a reviewer.
   */
  const HOUSE_STYLE_RULES = [
    // "Avoid using dashes entirely on SF.gov." Hyphens in compound words
    // ("four-legged") are correct and must not match, so this looks only for
    // em dashes, en dashes, and a spaced hyphen used as punctuation.
    { pattern: /[—–]|\s-\s/, note: 'Do not use dashes — rewrite as two sentences' },
    { pattern: /\.\.\.|…/, note: 'Do not use ellipses' },
    { pattern: /(^|[^\w&])&([^\w&]|$)/, note: 'Use "and", not "&"' },
    { pattern: /\b(i\.e\.|e\.g\.|etc\.)/i, note: 'Avoid Latin abbreviations' },
    { pattern: /\bplease\b/i, note: 'Be direct — do not say "please" in instructions' },
    { pattern: /\bU\.S\./, note: 'Write "US", not "U.S."' },
    { pattern: /\bnon-profit\b/i, note: 'Write "nonprofit" as one word' },
    { pattern: /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/, note: 'Write dates as "January 28, 2026"' },
    { pattern: /\b\d+(st|nd|rd|th)\b/, note: 'Use cardinal dates ("28", not "28th")' },
    {
      pattern: /\(\d{3}\)\s*\d{3}[-.]\d{4}|\b\d{3}\.\d{3}\.\d{4}\b/,
      note: 'Format phone numbers as 415-555-1212',
    },
    { pattern: /\b\d\s?(AM|PM)\b/, note: 'Use lowercase am/pm' },
    { pattern: /^welcome to\b/i, note: 'Skip the welcome — say what people can do' },
  ]

  // Uppercase tokens that are acronyms, not shouting (7.4.1 bans ALL CAPS).
  const ACRONYMS = new Set([
    'HHVC',
    'DPH',
    'DBI',
    'SF',
    'NOV',
    'IPM',
    'PDF',
    'CDC',
    'EHB',
    'SFDS',
    'ADA',
    'WCAG',
    'FAQ',
    'US',
  ])

  // --- Text helpers -----------------------------------------------------

  /**
   * Strip the inline markdown js/page-render.js understands, leaving the words
   * a reader actually sees: `**bold**` markers go, `[label](target)` collapses
   * to its label.
   * @param {unknown} text
   * @returns {string}
   */
  function stripInline(text) {
    return String(text == null ? '' : text)
      .replace(/\*\*/g, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .trim()
  }

  /**
   * Pull the `[label](target)` links out of a string.
   * @param {unknown} text
   * @returns {Array<{label: string, target: string}>}
   */
  function extractLinks(text) {
    const links = []
    const pattern = /\[([^\]]+)\]\(([^)]*)\)/g
    let match = pattern.exec(String(text == null ? '' : text))
    while (match) {
      links.push({ label: match[1], target: match[2] })
      match = pattern.exec(String(text == null ? '' : text))
    }
    return links
  }

  /**
   * Split prose into sentences, protecting the abbreviations and decimals that
   * would otherwise each produce a spurious sentence break.
   * @param {unknown} text
   * @returns {string[]}
   */
  function splitSentences(text) {
    return stripInline(text)
      .replace(/\b(No|Mr|Mrs|Ms|Dr|St|Ave|Inc|Sec|approx|vs|etc|e\.g|i\.e)\./gi, '$1<DOT>')
      .replace(/(\d)\.(\d)/g, '$1<DOT>$2')
      .split(/[.!?]+(?=\s|$)/)
      .map((sentence) => sentence.replace(/<DOT>/g, '.').trim())
      .filter(Boolean)
  }

  /**
   * @param {unknown} text
   * @returns {number}
   */
  function countWords(text) {
    return stripInline(text).split(/\s+/).filter(Boolean).length
  }

  /**
   * @param {unknown} type
   * @returns {string}
   */
  function normalizePageType(type) {
    return String(type == null ? '' : type)
      .toLowerCase()
      .replace(/\s+page$/, '')
      .trim()
  }

  // --- Text unit collection --------------------------------------------

  /**
   * Walk a page object into addressable units of text.
   *
   * Every check runs over these rather than over one flattened blob, so an
   * offender can be reported with the exact field it came from
   * (`sections[2].steps[0].bullets[1]`) instead of just a count. `prose` marks
   * the units that carry sentences and so participate in the sentence, voice,
   * and vocabulary checks; `heading` marks the units the heading rules apply
   * to. A unit can be neither (alt text, SEO fields).
   * @param {object} page
   * @returns {Array<{path: string, kind: string, text: string, prose: boolean, heading: boolean}>}
   */
  function collectTextUnits(page) {
    if (!page || typeof page !== 'object') return []
    const units = []
    const add = (path, kind, text, options) => {
      const value = typeof text === 'string' ? text : ''
      if (!value.trim()) return
      units.push({
        path,
        kind,
        text: value,
        prose: Boolean(options && options.prose),
        heading: Boolean(options && options.heading),
      })
    }
    const addItem = (path, kind, item, options) => {
      if (typeof item === 'string') return add(path, kind, item, options)
      if (item && typeof item === 'object' && typeof item.text === 'string') {
        return add(path, kind, item.text, options)
      }
      return undefined
    }

    add('title', 'title', page.title, { heading: true })
    add('summary', 'summary', page.summary, { prose: true })
    add('seoTitle', 'seo-title', page.seoTitle)
    add('metaDescription', 'meta-description', page.metaDescription)
    ;(page.audience || []).forEach((entry, index) => {
      addItem(`audience[${index}]`, 'audience', entry, {})
    })

    if (page.whatToKnow) {
      add('whatToKnow.cost', 'what-to-know', page.whatToKnow.cost, { prose: true })
      ;(page.whatToKnow.thingsToKnow || []).forEach((entry, index) => {
        addItem(`whatToKnow.thingsToKnow[${index}]`, 'what-to-know', entry, { prose: true })
      })
      ;(page.whatToKnow.items || []).forEach((entry, index) => {
        addItem(`whatToKnow.items[${index}]`, 'what-to-know', entry, { prose: true })
      })
    }

    if (page.spotlight) {
      add('spotlight.title', 'spotlight-title', page.spotlight.title, { heading: true })
      ;(page.spotlight.paragraphs || []).forEach((entry, index) => {
        addItem(`spotlight.paragraphs[${index}]`, 'spotlight', entry, { prose: true })
      })
      if (page.spotlight.image) {
        add('spotlight.image.alt', 'alt', page.spotlight.image.alt)
      }
    }
    ;(page.sections || []).forEach((section, sectionIndex) => {
      const base = `sections[${sectionIndex}]`
      add(`${base}.heading`, 'heading', section.heading, { heading: true })
      ;(section.paragraphs || []).forEach((entry, index) => {
        addItem(`${base}.paragraphs[${index}]`, 'paragraph', entry, { prose: true })
      })
      ;(section.bullets || []).forEach((entry, index) => {
        addItem(`${base}.bullets[${index}]`, 'bullet', entry, { prose: true })
      })
      ;(section.steps || []).forEach((step, stepIndex) => {
        const stepBase = `${base}.steps[${stepIndex}]`
        add(`${stepBase}.title`, 'step-title', step.title, { heading: true })
        ;(step.text || []).forEach((entry, index) => {
          addItem(`${stepBase}.text[${index}]`, 'step-text', entry, { prose: true })
        })
        ;(step.bullets || []).forEach((entry, index) => {
          addItem(`${stepBase}.bullets[${index}]`, 'step-bullet', entry, { prose: true })
        })
        if (step.callout) {
          add(`${stepBase}.callout.text`, 'callout', step.callout.text, { prose: true })
        }
      })
      ;(section.cards || []).forEach((card, cardIndex) => {
        add(`${base}.cards[${cardIndex}].title`, 'card-title', card.title, { heading: true })
        add(`${base}.cards[${cardIndex}].text`, 'card-text', card.text, { prose: true })
      })
      ;(section.table || []).forEach((row, rowIndex) => {
        ;(row || []).forEach((cell, cellIndex) => {
          addItem(`${base}.table[${rowIndex}][${cellIndex}]`, 'table-cell', cell, { prose: true })
        })
      })
      if (section.callout) {
        add(`${base}.callout.text`, 'callout', section.callout.text, { prose: true })
      }
      if (section.image) {
        add(`${base}.image.alt`, 'alt', section.image.alt)
      }
    })

    return units
  }

  // --- Check helpers ----------------------------------------------------

  /**
   * @param {string} id
   * @param {string} label
   * @param {string} section Manual section this rule comes from.
   * @param {boolean} pass
   * @param {string} detail
   * @param {Array<object>} offenders
   * @param {string} severity 'error' for a manual mandate, 'warning' for advice.
   * @returns {object}
   */
  function makeCheck(id, label, section, pass, detail, offenders, severity) {
    return {
      id,
      label,
      section,
      pass,
      severity: severity || 'error',
      detail,
      offenders: offenders || [],
    }
  }

  /** @param {string} text @returns {string} */
  function excerpt(text) {
    const clean = stripInline(text)
    return clean.length > 120 ? `${clean.slice(0, 117)}...` : clean
  }

  /**
   * Case-insensitive whole-phrase search that ignores matches inside a longer
   * word, so "require" does not fire on "requirement".
   * @param {string} haystack
   * @param {string} phrase
   * @returns {boolean}
   */
  function containsPhrase(haystack, phrase) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(^|[^\\w-])${escaped}([^\\w-]|$)`, 'i').test(haystack)
  }

  // --- The checks -------------------------------------------------------

  /**
   * Score one page against every plain-language rule.
   * @param {object} page
   * @returns {{checks: object[], metrics: object, units: object[]}}
   */
  function analyzePlainLanguage(page) {
    const units = collectTextUnits(page)
    const prose = units.filter((unit) => unit.prose)
    const headings = units.filter((unit) => unit.heading)
    const pageType = normalizePageType(page && page.type)
    const checks = []

    // --- 7.2.2 Sentence length ---
    const sentences = []
    for (const unit of prose) {
      for (const sentence of splitSentences(unit.text)) {
        sentences.push({ unit, sentence, words: countWords(sentence) })
      }
    }
    const totalWords = sentences.reduce((sum, entry) => sum + entry.words, 0)
    const meanSentenceWords = sentences.length ? totalWords / sentences.length : 0
    checks.push(
      makeCheck(
        'sentence-length-average',
        'Average sentence length',
        '7.2.2',
        sentences.length === 0 || meanSentenceWords <= MEAN_SENTENCE_WORDS,
        sentences.length
          ? `${meanSentenceWords.toFixed(1)} words per sentence (target ${MEAN_SENTENCE_WORDS} or fewer)`
          : 'No body sentences to measure',
        [],
        'error'
      )
    )

    const longSentences = sentences.filter((entry) => entry.words > LONG_SENTENCE_WORDS)
    checks.push(
      makeCheck(
        'sentence-length-outliers',
        'Long sentences',
        '7.2.2',
        longSentences.length === 0,
        longSentences.length
          ? `${longSentences.length} sentence(s) over ${LONG_SENTENCE_WORDS} words`
          : `No sentence over ${LONG_SENTENCE_WORDS} words`,
        longSentences.map((entry) => ({
          path: entry.unit.path,
          text: excerpt(entry.sentence),
          note: `${entry.words} words`,
        })),
        // The manual's mandate is on the average, which is scored above and
        // which most pages already meet. Individual outliers are the actionable
        // detail underneath it, so they advise rather than fail.
        'warning'
      )
    )

    // --- 7.2.2 Paragraph length ---
    const longParagraphs = prose
      .filter((unit) => unit.kind === 'paragraph' || unit.kind === 'step-text')
      .map((unit) => ({ unit, count: splitSentences(unit.text).length }))
      .filter((entry) => entry.count > MAX_PARAGRAPH_SENTENCES)
    checks.push(
      makeCheck(
        'paragraph-length',
        'Paragraph length',
        '7.2.2',
        longParagraphs.length === 0,
        longParagraphs.length
          ? `${longParagraphs.length} paragraph(s) over ${MAX_PARAGRAPH_SENTENCES} sentences`
          : `Every paragraph is ${MAX_PARAGRAPH_SENTENCES} sentences or fewer`,
        longParagraphs.map((entry) => ({
          path: entry.unit.path,
          text: excerpt(entry.unit.text),
          note: `${entry.count} sentences`,
        })),
        'error'
      )
    )

    // --- 7.2.2 Break up runs of paragraphs ---
    const denseSections = []
    ;((page && page.sections) || []).forEach((section, index) => {
      const paragraphCount = (section.paragraphs || []).length
      const hasBreak = Boolean(
        (section.bullets || []).length ||
        (section.steps || []).length ||
        (section.table || []).length ||
        section.callout ||
        section.image
      )
      if (paragraphCount > MAX_PARAGRAPHS_BEFORE_BREAK && !hasBreak) {
        denseSections.push({
          path: `sections[${index}]`,
          text: section.heading || '(untitled section)',
          note: `${paragraphCount} paragraphs, no list or callout`,
        })
      }
    })
    checks.push(
      makeCheck(
        'subheading-cadence',
        'Visual breaks between paragraphs',
        '7.2.2',
        denseSections.length === 0,
        denseSections.length
          ? `${denseSections.length} section(s) run past ${MAX_PARAGRAPHS_BEFORE_BREAK} paragraphs with no list, callout, or image`
          : 'No wall-of-text sections',
        denseSections,
        'error'
      )
    )

    // --- 7.2.2 Lists rather than run-on enumerations ---
    // Restricted to running prose. Card descriptions and bullets are already
    // list items -- "Rats, mice, raccoons, and other four-legged pests" is a
    // noun phrase doing its job, not a sentence that needs breaking up -- and
    // flagging them produced 95 offenders that a reviewer could do nothing
    // about. The word floor drops the remaining short noun phrases.
    const LIST_PROSE_KINDS = ['paragraph', 'step-text', 'summary']
    const MIN_ENUMERATION_WORDS = 12
    const enumerations = sentences.filter((entry) => {
      if (!LIST_PROSE_KINDS.includes(entry.unit.kind)) return false
      if (entry.words < MIN_ENUMERATION_WORDS) return false
      const commas = (entry.sentence.match(/,/g) || []).length
      return commas >= MAX_LIST_ITEMS_IN_SENTENCE && /,\s*(and|or)\s/i.test(entry.sentence)
    })
    checks.push(
      makeCheck(
        'list-conversion',
        'Lists instead of run-on sentences',
        '7.2.2',
        enumerations.length === 0,
        enumerations.length
          ? `${enumerations.length} sentence(s) list more than ${MAX_LIST_ITEMS_IN_SENTENCE} items inline`
          : 'No inline enumerations to convert',
        enumerations.map((entry) => ({
          path: entry.unit.path,
          text: excerpt(entry.sentence),
          note: 'Convert to a bulleted list',
        })),
        'warning'
      )
    )

    // --- 7.2.3 Active voice ---
    // Deliberately narrow: a form of "to be" followed by a past participle.
    // Broader heuristics fire on every "is available" and drown the panel.
    const passivePattern =
      /\b(is|are|was|were|be|been|being)\s+(\w+ed|given|taken|written|sent|made|held|done|shown|known|seen|kept|found|left|paid|built|brought|put|set|read)\b/i
    const passives = sentences.filter((entry) => passivePattern.test(entry.sentence))
    checks.push(
      makeCheck(
        'active-voice',
        'Active voice',
        '7.2.3',
        passives.length === 0,
        passives.length
          ? `${passives.length} sentence(s) look passive`
          : 'No passive constructions found',
        passives.map((entry) => ({
          path: entry.unit.path,
          text: excerpt(entry.sentence),
          note: 'Name who acts',
        })),
        'warning'
      )
    )

    // --- 7.2.3 Contractions ---
    const contractionHits = []
    for (const unit of prose.concat(headings)) {
      const clean = stripInline(unit.text)
      for (const contraction of CONTRACTIONS) {
        if (containsPhrase(clean, contraction)) {
          contractionHits.push({ path: unit.path, text: excerpt(unit.text), note: contraction })
          break
        }
      }
    }
    checks.push(
      makeCheck(
        'contractions',
        'No contractions',
        '7.2.3',
        contractionHits.length === 0,
        contractionHits.length
          ? `${contractionHits.length} field(s) use a contraction`
          : 'No contractions',
        contractionHits,
        'error'
      )
    )

    // --- 7.2.3 Direct address ---
    const bodyText = prose.map((unit) => stripInline(unit.text)).join(' ')
    const usesYou = /\b(you|your)\b/i.test(bodyText)
    // Only sentence-initial third-person subjects, so "help for tenants" in the
    // middle of a sentence is left alone -- the rule is about who the sentence
    // is addressed to, not about banning the noun.
    const thirdPerson = sentences.filter((entry) =>
      /^(applicants|residents|property owners|tenants|users|the user)\b/i.test(entry.sentence)
    )
    checks.push(
      makeCheck(
        'direct-address',
        'Direct address ("you")',
        '7.2.3',
        usesYou && thirdPerson.length === 0,
        usesYou
          ? thirdPerson.length
            ? `${thirdPerson.length} sentence(s) address the reader in the third person`
            : 'Addresses the reader directly'
          : 'Body copy never says "you" or "your"',
        thirdPerson.map((entry) => ({
          path: entry.unit.path,
          text: excerpt(entry.sentence),
          note: 'Rewrite as "you"',
        })),
        'warning'
      )
    )

    // --- 7.2.3 Everyday vocabulary ---
    const swapHits = []
    for (const unit of prose.concat(headings)) {
      const clean = stripInline(unit.text)
      for (const [term, replacement] of WORD_SWAPS) {
        if (containsPhrase(clean, term)) {
          swapHits.push({
            path: unit.path,
            text: excerpt(unit.text),
            note: `"${term}" -> "${replacement}"`,
          })
        }
      }
    }
    checks.push(
      makeCheck(
        'plain-vocabulary',
        'Everyday words',
        '7.2.3',
        swapHits.length === 0,
        swapHits.length
          ? `${swapHits.length} bureaucratic word(s) with a plainer alternative`
          : 'No bureaucratic vocabulary found',
        swapHits,
        'warning'
      )
    )

    // --- 7.3.1 "shall" is prohibited ---
    // 7.3.1 bans "shall" outright with one exception: verbatim quotes of the
    // Health Code itself. The manual expects those to be italicised, but page
    // data carries no italic markup, so the practical signal is the section
    // citation such a quote opens with ("Sec. 581(a): No person shall...").
    // Without this, article11Guide -- a page whose entire job is quoting the
    // code in a translation table -- failed on seven quotations it is
    // required to reproduce word for word.
    const isVerbatimCodeQuote = (text) => /^\s*(\*\*)?\s*(sec\.|section)\s*\d/i.test(text)
    const shallHits = units
      .filter(
        (unit) => containsPhrase(stripInline(unit.text), 'shall') && !isVerbatimCodeQuote(unit.text)
      )
      .map((unit) => ({
        path: unit.path,
        text: excerpt(unit.text),
        note: 'Use "must" — this is not a verbatim Health Code quote',
      }))
    checks.push(
      makeCheck(
        'shall-prohibited',
        'No "shall"',
        '7.3.1',
        shallHits.length === 0,
        shallHits.length ? `${shallHits.length} use(s) of "shall"` : 'No use of "shall"',
        shallHits,
        'error'
      )
    )

    // --- 7.3 Modal scheme ---
    const modalHits = []
    for (const unit of prose) {
      const clean = stripInline(unit.text)
      for (const weak of WEAK_MODALS) {
        if (containsPhrase(clean, weak)) {
          modalHits.push({ path: unit.path, text: excerpt(unit.text), note: `"${weak}" -> "must"` })
          break
        }
      }
    }
    checks.push(
      makeCheck(
        'modal-scheme',
        'must / should / may / will',
        '7.3',
        modalHits.length === 0,
        modalHits.length
          ? `${modalHits.length} field(s) dodge the modal scheme`
          : 'Obligations use the approved modals',
        modalHits,
        'warning'
      )
    )

    // --- 7.4.1 Sentence case headings ---
    // Only shouting is detected, not Title Case.
    //
    // A Title Case heuristic cannot tell "Healthy Housing and Vector Control"
    // (the program's own name) or "UC IPM Pest Notes: Rats" (a publication
    // title) from an editor capitalizing Every Word, and trying produced 32
    // offenders that were all legitimate proper nouns. Distinguishing them
    // needs a name list nobody maintains, so the rule that cannot be
    // implemented honestly is left out rather than shipped noisy.
    //
    // Shouting is detectable: acronyms are short, so an all-caps token of six
    // or more characters is a word being yelled, as is a run of three or more
    // consecutive all-caps tokens. Trailing punctuation is stripped first so
    // "CDC:" is still recognised as the acronym CDC.
    const caseHits = []
    for (const unit of headings) {
      const clean = stripInline(unit.text)
      const words = clean.split(/\s+/).filter(Boolean)
      const bare = words.map((word) => word.replace(/[^\w]/g, ''))
      const isCaps = bare.map(
        (word) => word.length > 1 && word === word.toUpperCase() && /[A-Z]/.test(word)
      )
      const shouting = bare.some(
        (word, index) => isCaps[index] && word.length >= 6 && !ACRONYMS.has(word)
      )
      let run = 0
      let longRun = false
      for (const caps of isCaps) {
        run = caps ? run + 1 : 0
        if (run >= 3) longRun = true
      }
      if (shouting || longRun) {
        caseHits.push({ path: unit.path, text: excerpt(unit.text), note: 'ALL CAPS' })
      }
    }
    checks.push(
      makeCheck(
        'heading-case',
        'Sentence case headings',
        '7.4.1',
        caseHits.length === 0,
        caseHits.length
          ? `${caseHits.length} heading(s) not in sentence case`
          : 'Headings look fine',
        caseHits,
        'error'
      )
    )

    // --- 7.4.2 Keyword-forward, non-question headings ---
    const headingStyleHits = []
    const publicPageType = pageType === 'transaction' || pageType === 'information'
    for (const unit of headings) {
      const clean = stripInline(unit.text)
      if (publicPageType && clean.endsWith('?')) {
        headingStyleHits.push({
          path: unit.path,
          text: excerpt(unit.text),
          note: 'Question heading on a public page',
        })
        continue
      }
      const lower = clean.toLowerCase()
      const prefix = HEADING_PREFIXES.find((entry) => lower.startsWith(entry))
      if (prefix) {
        headingStyleHits.push({
          path: unit.path,
          text: excerpt(unit.text),
          note: `Lead with the keyword, not "${prefix}"`,
        })
      }
    }
    checks.push(
      makeCheck(
        'heading-style',
        'Keyword-forward headings',
        '7.4.2',
        headingStyleHits.length === 0,
        headingStyleHits.length
          ? `${headingStyleHits.length} heading(s) bury the keyword or ask a question`
          : 'Headings lead with their keyword',
        headingStyleHits,
        'warning'
      )
    )

    // --- 7.5 Descriptive links ---
    const linkHits = []
    for (const unit of units) {
      for (const link of extractLinks(unit.text)) {
        const label = link.label.trim().toLowerCase()
        if (GENERIC_LINK_LABELS.includes(label) || /^https?:\/\//i.test(link.label.trim())) {
          linkHits.push({
            path: unit.path,
            text: link.label,
            note: 'Link text must describe its destination',
          })
        }
      }
    }
    ;((page && page.sections) || []).forEach((section, sectionIndex) => {
      ;(section.cards || []).forEach((card, cardIndex) => {
        const title = String(card.title || '').trim()
        if (GENERIC_LINK_LABELS.includes(title.toLowerCase())) {
          linkHits.push({
            path: `sections[${sectionIndex}].cards[${cardIndex}].title`,
            text: title,
            note: 'Card title is the link text',
          })
        }
        // 7.5: a download must state its format in the link text.
        const isFile = card.fileType || /\.(pdf|docx?|xlsx?|pptx?)(\?|#|$)/i.test(card.url || '')
        if (isFile && !/\b(pdf|doc|docx|xls|xlsx|ppt|pptx)\b/i.test(title)) {
          linkHits.push({
            path: `sections[${sectionIndex}].cards[${cardIndex}].title`,
            text: title,
            note: 'State the file format in the link text',
          })
        }
      })
    })
    checks.push(
      makeCheck(
        'descriptive-links',
        'Descriptive link text',
        '7.5',
        linkHits.length === 0,
        linkHits.length
          ? `${linkHits.length} link(s) are generic or omit a file format`
          : 'Link text describes its destination',
        linkHits,
        'error'
      )
    )

    // --- 7.6.1 Alt text ---
    const altHits = []
    const images = []
    if (page && page.spotlight && page.spotlight.image) {
      images.push({ path: 'spotlight.image', image: page.spotlight.image })
    }
    ;((page && page.sections) || []).forEach((section, index) => {
      if (section.image) images.push({ path: `sections[${index}].image`, image: section.image })
    })
    for (const entry of images) {
      const alt = String(entry.image.alt || '').trim()
      if (!alt) {
        altHits.push({ path: `${entry.path}.alt`, text: '(missing)', note: 'Alt text is required' })
        continue
      }
      if (alt.length > MAX_ALT_TEXT_CHARS) {
        altHits.push({
          path: `${entry.path}.alt`,
          text: excerpt(alt),
          note: `${alt.length} characters, limit ${MAX_ALT_TEXT_CHARS}`,
        })
      }
      if (/^(image|graphic|picture|photo) of\b/i.test(alt)) {
        altHits.push({
          path: `${entry.path}.alt`,
          text: excerpt(alt),
          note: 'Screen readers already announce the image',
        })
      }
    }
    checks.push(
      makeCheck(
        'alt-text',
        'Image alt text',
        '7.6.1',
        altHits.length === 0,
        altHits.length
          ? `${altHits.length} alt-text problem(s)`
          : images.length
            ? 'Every image has usable alt text'
            : 'No images on this page',
        altHits,
        'error'
      )
    )

    // --- 7.7 Idioms ---
    const idiomHits = []
    for (const unit of prose.concat(headings)) {
      const clean = stripInline(unit.text)
      for (const idiom of IDIOMS) {
        if (containsPhrase(clean, idiom)) {
          idiomHits.push({ path: unit.path, text: excerpt(unit.text), note: `"${idiom}"` })
        }
      }
    }
    checks.push(
      makeCheck(
        'idioms',
        'Translation-ready wording',
        '7.7',
        idiomHits.length === 0,
        idiomHits.length ? `${idiomHits.length} idiom(s) that will not translate` : 'No idioms',
        idiomHits,
        'warning'
      )
    )

    // --- 7.7 Consistent terminology ---
    const allText = units.map((unit) => stripInline(unit.text)).join(' ')
    const terminologyHits = []
    for (const group of TERMINOLOGY_GROUPS) {
      if (!containsPhrase(allText, group.canonical)) continue
      for (const variant of group.variants) {
        if (containsPhrase(allText, variant)) {
          terminologyHits.push({
            path: 'page',
            text: variant,
            note: `Use "${group.canonical}" everywhere`,
          })
        }
      }
    }
    checks.push(
      makeCheck(
        'terminology-consistency',
        'Consistent terminology',
        '7.7',
        terminologyHits.length === 0,
        terminologyHits.length
          ? `${terminologyHits.length} competing term(s) for one concept`
          : 'One term per concept',
        terminologyHits,
        'error'
      )
    )

    // --- SF.gov house style (Content style guide A-to-Z) ---
    // Verbatim Health Code quotes are exempt for the same reason they are
    // exempt from the "shall" rule: their ellipses mark elided statutory text
    // and cannot be edited away without misquoting the code.
    const houseStyleHits = []
    for (const unit of units) {
      if (isVerbatimCodeQuote(unit.text)) continue
      const clean = stripInline(unit.text)
      for (const rule of HOUSE_STYLE_RULES) {
        if (rule.pattern.test(clean)) {
          houseStyleHits.push({ path: unit.path, text: excerpt(unit.text), note: rule.note })
        }
      }
    }
    checks.push(
      makeCheck(
        'house-style',
        'SF.gov house style',
        '7.8',
        houseStyleHits.length === 0,
        houseStyleHits.length
          ? `${houseStyleHits.length} house-style issue(s)`
          : 'Matches SF.gov house style',
        houseStyleHits,
        'warning'
      )
    )

    // --- Karl Button component: 25-character limit ---
    // Length only. The same page also says button text should start with a
    // verb, which is not checked here -- see HOUSE_STYLE_RULES for why.
    const buttonHits = []
    const addButton = (path, label) => {
      const value = String(label || '').trim()
      if (value.length > MAX_BUTTON_CHARS) {
        buttonHits.push({
          path,
          text: value,
          note: `${value.length} characters, limit ${MAX_BUTTON_CHARS}`,
        })
      }
    }
    if (page && page.primaryCta) addButton('primaryCta', page.primaryCta)
    ;((page && page.sections) || []).forEach((section, sectionIndex) => {
      addButton(`sections[${sectionIndex}].button`, section.button)
      ;(section.steps || []).forEach((step, stepIndex) => {
        addButton(`sections[${sectionIndex}].steps[${stepIndex}].button`, step.button)
      })
    })
    if (page && page.spotlight) addButton('spotlight.button', page.spotlight.button)
    checks.push(
      makeCheck(
        'button-length',
        'Button text length',
        '7.8',
        buttonHits.length === 0,
        buttonHits.length
          ? `${buttonHits.length} button(s) over ${MAX_BUTTON_CHARS} characters`
          : 'Button text fits Karl’s limit',
        buttonHits,
        'error'
      )
    )

    // --- A-to-Z guide, Bullets: keep lists to 3-5 items ---
    // Note this pulls against manual 7.2.2, which pushes prose *into* lists.
    // Both hold at once: use a list, but split it once it runs long.
    const listHits = []
    ;((page && page.sections) || []).forEach((section, sectionIndex) => {
      const bullets = (section.bullets || []).length
      if (bullets > MAX_BULLETS_PER_LIST) {
        listHits.push({
          path: `sections[${sectionIndex}].bullets`,
          text: section.heading || '(untitled section)',
          note: `${bullets} bullets, aim for ${MAX_BULLETS_PER_LIST} or fewer`,
        })
      }
    })
    checks.push(
      makeCheck(
        'list-length',
        'Bulleted list length',
        '7.2.2',
        listHits.length === 0,
        listHits.length
          ? `${listHits.length} list(s) over ${MAX_BULLETS_PER_LIST} bullets`
          : 'Lists stay short',
        listHits,
        'warning'
      )
    )

    // --- 7.8 SEO title ---
    // The manual specifies "[Action] | San Francisco"; every page in this repo
    // uses "| SF.gov". Both are a keyword-forward action plus a site suffix, so
    // we enforce the substance (length, and that a suffix exists) rather than
    // failing all 19 pages over which wording of the suffix is house style.
    const seoTitle = String((page && page.seoTitle) || '').trim()
    const seoHits = []
    if (seoTitle) {
      if (seoTitle.length > MAX_SEO_TITLE_CHARS) {
        seoHits.push({
          path: 'seoTitle',
          text: excerpt(seoTitle),
          note: `${seoTitle.length} characters, limit ${MAX_SEO_TITLE_CHARS}`,
        })
      }
      if (!seoTitle.includes('|')) {
        seoHits.push({ path: 'seoTitle', text: excerpt(seoTitle), note: 'Add a "| site" suffix' })
      }
    }
    checks.push(
      makeCheck(
        'seo-title',
        'SEO title format',
        '7.8',
        seoHits.length === 0,
        seoTitle
          ? seoHits.length
            ? `${seoHits.length} problem(s)`
            : `${seoTitle.length} characters, limit ${MAX_SEO_TITLE_CHARS}`
          : 'No SEO title set',
        seoHits,
        'error'
      )
    )

    // --- 7.8 Meta description ---
    // Opening only -- length is deliberately NOT checked here.
    //
    // Manual 7.8 requires 110-160 characters. The reviewer UI requires the
    // opposite: index.html labels the field "Target: 110 or fewer" and
    // getRuleResultsFor fails anything over META_DESCRIPTION_LIMIT = 110. All
    // 19 pages sit at 87-109 characters, so they satisfy the UI and fail the
    // manual, and a page cannot possibly satisfy both. Shipping a second,
    // contradictory length rule would make the panel unpassable, so length
    // stays with the existing rule that owns it and this contradiction is
    // escalated to a human instead of being resolved by a tool.
    const metaDescription = String((page && page.metaDescription) || '').trim()
    const metaHits = []
    if (metaDescription && /^(this page|the |a |an )/i.test(metaDescription)) {
      metaHits.push({
        path: 'metaDescription',
        text: excerpt(metaDescription),
        note: 'Start with an active verb',
      })
    }
    checks.push(
      makeCheck(
        'meta-description-opening',
        'Meta description opening',
        '7.8',
        metaHits.length === 0,
        metaDescription
          ? metaHits.length
            ? 'Starts with an article, not an active verb'
            : 'Starts with an active verb'
          : 'No meta description set',
        metaHits,
        'warning'
      )
    )

    // --- 7.2.1 Stated target vs the manual's recommendation ---
    const recommended = RECOMMENDED_READING_TARGETS[pageType]
    const statedTarget = String((page && page.reading) || '')
    const statedRange = statedTarget.match(/(\d+)/g)
    let targetPass = true
    let targetDetail = statedTarget
      ? `Stated target ${statedTarget}`
      : 'No reading target on this page'
    if (recommended && statedRange) {
      const statedMin = Number(statedRange[0])
      const statedMax = Number(statedRange[statedRange.length - 1])
      const label =
        recommended[0] === recommended[1]
          ? `Grade ${recommended[0]}`
          : `Grade ${recommended[0]}-${recommended[1]}`
      targetPass = statedMin === recommended[0] && statedMax === recommended[1]
      targetDetail = targetPass
        ? `Stated target ${statedTarget} matches the ${pageType} recommendation`
        : `Stated target ${statedTarget}; manual 7.2.1 recommends ${label} for ${pageType} pages`
    }
    checks.push(
      makeCheck(
        'reading-target-match',
        'Reading target for this page type',
        '7.2.1',
        targetPass,
        targetDetail,
        [],
        'warning'
      )
    )

    return {
      units,
      checks,
      metrics: {
        sentenceCount: sentences.length,
        wordCount: totalWords,
        meanSentenceWords: Number(meanSentenceWords.toFixed(1)),
        longSentenceCount: longSentences.length,
      },
    }
  }

  /**
   * Flatten an analysis into the `{ label, pass, detail }` rows the Page checks
   * panel already renders, so plain-language results sit alongside the Karl
   * compliance rules with no separate rendering path.
   * @param {object} page
   * @returns {Array<{label: string, pass: boolean, detail: string}>}
   */
  function getPlainLanguageRules(page) {
    return analyzePlainLanguage(page).checks.map((check) => ({
      label: check.label,
      pass: check.pass,
      detail: check.detail,
    }))
  }

  const api = {
    analyzePlainLanguage,
    getPlainLanguageRules,
    collectTextUnits,
    splitSentences,
    stripInline,
    extractLinks,
    countWords,
    containsPhrase,
    normalizePageType,
    RECOMMENDED_READING_TARGETS,
    MEAN_SENTENCE_WORDS,
    LONG_SENTENCE_WORDS,
    MAX_PARAGRAPH_SENTENCES,
  }

  if (typeof window !== 'undefined') window.plainLanguage = api
  if (typeof module !== 'undefined' && module.exports) module.exports = api
})()
