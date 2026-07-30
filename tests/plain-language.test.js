const { describe, test, expect } = require('bun:test')
const { loadPageData } = require('../build_scripts/load-pages')
const {
  analyzePlainLanguage,
  collectTextUnits,
  splitSentences,
  stripInline,
  extractLinks,
  countWords,
  containsPhrase,
  normalizePageType,
} = require('../js/plain-language.js')

/** Minimal schema-valid page to hang a single rule off. */
function makePage(overrides) {
  return {
    slug: 'sf.gov/test-page',
    type: 'Information',
    title: 'Report a pest problem',
    summary: 'Tell us about pests in your home so we can help.',
    audience: ['A tenant with a pest problem'],
    reading: 'Grade 6',
    sections: [],
    ...overrides,
  }
}

/** @returns {object} the single check with this id */
function checkFor(page, id) {
  const check = analyzePlainLanguage(page).checks.find((entry) => entry.id === id)
  if (!check) throw new Error(`no check with id ${id}`)
  return check
}

/** A section carrying one paragraph of prose. */
function sectionWith(paragraphs) {
  return { heading: 'What to do', karl: 'Body block', paragraphs }
}

describe('stripInline', () => {
  test('removes bold markers', () => {
    expect(stripInline('**Notify your landlord:** tell them')).toBe(
      'Notify your landlord: tell them'
    )
  })

  test('collapses a markdown link to its label', () => {
    expect(stripInline('See the [rodent guide](ownerGuidance) first')).toBe(
      'See the rodent guide first'
    )
  })

  test('returns an empty string for null and undefined', () => {
    expect(stripInline(null)).toBe('')
    expect(stripInline(undefined)).toBe('')
  })
})

describe('extractLinks', () => {
  test('returns each label and target pair', () => {
    expect(
      extractLinks('Read [the guide](ownerGuidance) or [call 311](https://sf311.org)')
    ).toEqual([
      { label: 'the guide', target: 'ownerGuidance' },
      { label: 'call 311', target: 'https://sf311.org' },
    ])
  })

  test('returns an empty array when there are no links', () => {
    expect(extractLinks('No links here.')).toEqual([])
  })
})

describe('splitSentences', () => {
  test('splits on terminal punctuation', () => {
    expect(splitSentences('Report it. We inspect. You get a result.')).toEqual([
      'Report it',
      'We inspect',
      'You get a result',
    ])
  })

  test('does not split on an abbreviation', () => {
    expect(splitSentences('See Sec. 581 for details.')).toEqual(['See Sec. 581 for details'])
  })

  test('does not split inside a decimal number', () => {
    expect(splitSentences('The fee is 12.50 per unit.')).toEqual(['The fee is 12.50 per unit'])
  })
})

describe('countWords', () => {
  test('counts words after stripping markdown', () => {
    expect(countWords('**Report** the [rat problem](rodentsReport)')).toBe(4)
  })
})

describe('containsPhrase', () => {
  test('matches a whole word', () => {
    expect(containsPhrase('You require a permit', 'require')).toBe(true)
  })

  test('does not match inside a longer word', () => {
    expect(containsPhrase('Check the requirements list', 'require')).toBe(false)
  })

  test('matches a multi-word phrase case-insensitively', () => {
    expect(containsPhrase('Please do this Prior To arrival', 'prior to')).toBe(true)
  })
})

describe('normalizePageType', () => {
  test('lowercases and drops a trailing "page"', () => {
    expect(normalizePageType('Transaction Page')).toBe('transaction')
    expect(normalizePageType('Resource Collection')).toBe('resource collection')
  })
})

describe('collectTextUnits', () => {
  test('addresses every unit by its field path', () => {
    const page = makePage({
      sections: [
        {
          heading: 'What to do',
          karl: 'Body block',
          steps: [{ title: 'Start', text: ['Call 311 now.'], bullets: ['Bring your address.'] }],
        },
      ],
    })
    const paths = collectTextUnits(page).map((unit) => unit.path)
    expect(paths).toContain('sections[0].steps[0].text[0]')
    expect(paths).toContain('sections[0].steps[0].bullets[0]')
  })

  test('reads the text out of an unverified item object', () => {
    const page = makePage({
      sections: [sectionWith([{ text: 'Sewage backups take 48 hours.', unverified: true }])],
    })
    const unit = collectTextUnits(page).find((entry) => entry.path === 'sections[0].paragraphs[0]')
    expect(unit.text).toBe('Sewage backups take 48 hours.')
  })

  test('marks headings and prose separately', () => {
    const units = collectTextUnits(makePage({ sections: [sectionWith(['A short sentence.'])] }))
    expect(units.find((unit) => unit.kind === 'heading').heading).toBe(true)
    expect(units.find((unit) => unit.kind === 'paragraph').prose).toBe(true)
  })

  test('skips blank and whitespace-only fields', () => {
    const page = makePage({ sections: [sectionWith(['', '   ', 'Real copy here.'])] })
    const paragraphs = collectTextUnits(page).filter((unit) => unit.kind === 'paragraph')
    expect(paragraphs.length).toBe(1)
  })

  test('returns an empty array for a missing page', () => {
    expect(collectTextUnits(undefined)).toEqual([])
  })
})

describe('sentence length checks', () => {
  test('passes copy built from short sentences', () => {
    const page = makePage({ sections: [sectionWith(['Call 311. We send an inspector.'])] })
    expect(checkFor(page, 'sentence-length-average').pass).toBe(true)
  })

  test('flags a sentence over twenty words and names its length', () => {
    const long =
      'You must tell the property owner about the problem before you report it to us so that they have a chance to fix it first.'
    const check = checkFor(
      makePage({ sections: [sectionWith([long])] }),
      'sentence-length-outliers'
    )
    expect(check.pass).toBe(false)
    expect(check.offenders[0].note).toBe('25 words')
    expect(check.offenders[0].path).toBe('sections[0].paragraphs[0]')
  })
})

describe('paragraph length check', () => {
  test('flags a paragraph running past three sentences', () => {
    const page = makePage({ sections: [sectionWith(['One. Two. Three. Four.'])] })
    const check = checkFor(page, 'paragraph-length')
    expect(check.pass).toBe(false)
    expect(check.offenders[0].note).toBe('4 sentences')
  })

  test('accepts a paragraph of exactly three sentences', () => {
    const page = makePage({ sections: [sectionWith(['One. Two. Three.'])] })
    expect(checkFor(page, 'paragraph-length').pass).toBe(true)
  })
})

describe('visual breaks check', () => {
  test('flags a section of four paragraphs with no list or callout', () => {
    const page = makePage({ sections: [sectionWith(['One.', 'Two.', 'Three.', 'Four.'])] })
    expect(checkFor(page, 'subheading-cadence').pass).toBe(false)
  })

  test('accepts the same section once it has a bulleted list', () => {
    const page = makePage({
      sections: [
        {
          heading: 'What to do',
          karl: 'Body block',
          paragraphs: ['One.', 'Two.', 'Three.', 'Four.'],
          bullets: ['A break.'],
        },
      ],
    })
    expect(checkFor(page, 'subheading-cadence').pass).toBe(true)
  })
})

describe('list conversion check', () => {
  test('flags a long prose sentence that enumerates more than three items', () => {
    const page = makePage({
      sections: [
        sectionWith([
          'We inspect homes for rats, mice, cockroaches, garbage, animal waste, and mold problems.',
        ]),
      ],
    })
    expect(checkFor(page, 'list-conversion').pass).toBe(false)
  })

  test('leaves a short card description alone', () => {
    // A noun phrase in a card is already a list item; flagging it produced
    // findings a reviewer could do nothing about.
    const page = makePage({
      sections: [
        {
          heading: 'Report a problem',
          karl: 'Quick links',
          cards: [{ title: 'Rodents', text: 'Rats, mice, raccoons, and other four-legged pests' }],
        },
      ],
    })
    expect(checkFor(page, 'list-conversion').pass).toBe(true)
  })
})

describe('contractions check', () => {
  test('flags a contraction', () => {
    const page = makePage({ sections: [sectionWith(["You don't need to send photos."])] })
    const check = checkFor(page, 'contractions')
    expect(check.pass).toBe(false)
    expect(check.offenders[0].note).toBe("don't")
  })

  test('leaves a possessive apostrophe alone', () => {
    const page = makePage({ sections: [sectionWith(["The City's inspectors will visit."])] })
    expect(checkFor(page, 'contractions').pass).toBe(true)
  })
})

describe('shall prohibition', () => {
  test('flags "shall" in ordinary body copy', () => {
    const page = makePage({ sections: [sectionWith(['The owner shall fix the problem.'])] })
    expect(checkFor(page, 'shall-prohibited').pass).toBe(false)
  })

  test('exempts a verbatim Health Code quote, which section 7.3.1 allows', () => {
    const page = makePage({
      sections: [
        {
          heading: 'Health code',
          karl: 'Report table',
          table: [
            ['Health code', 'In plain language'],
            ['Sec. 581(a): No person shall have upon any premises...', 'Keep your property clean.'],
          ],
        },
      ],
    })
    expect(checkFor(page, 'shall-prohibited').pass).toBe(true)
  })
})

describe('heading case check', () => {
  test('flags a shouted word', () => {
    const page = makePage({
      sections: [{ heading: 'IMPORTANT notice', karl: 'Body block', paragraphs: ['Read this.'] }],
    })
    expect(checkFor(page, 'heading-case').pass).toBe(false)
  })

  test('leaves an acronym with trailing punctuation alone', () => {
    const page = makePage({
      sections: [{ heading: 'CDC: Rodents', karl: 'Body block', paragraphs: ['Read this.'] }],
    })
    expect(checkFor(page, 'heading-case').pass).toBe(true)
  })

  test('leaves a proper-noun programme name alone', () => {
    const page = makePage({
      sections: [
        {
          heading: 'Healthy Housing and Vector Control',
          karl: 'Body block',
          paragraphs: ['Read this.'],
        },
      ],
    })
    expect(checkFor(page, 'heading-case').pass).toBe(true)
  })
})

describe('descriptive links check', () => {
  test('flags generic link text', () => {
    const page = makePage({ sections: [sectionWith(['To learn more, [click here](ownerHub).'])] })
    expect(checkFor(page, 'descriptive-links').pass).toBe(false)
  })

  test('flags a file link that omits its format', () => {
    const page = makePage({
      sections: [
        {
          heading: 'Resources',
          karl: 'Resources block',
          cards: [{ title: 'Fee schedule', url: 'https://example.org/fees.pdf' }],
        },
      ],
    })
    const check = checkFor(page, 'descriptive-links')
    expect(check.pass).toBe(false)
    expect(check.offenders[0].note).toBe('State the file format in the link text')
  })

  test('accepts a file link that states its format', () => {
    const page = makePage({
      sections: [
        {
          heading: 'Resources',
          karl: 'Resources block',
          cards: [{ title: 'Fee schedule (PDF)', url: 'https://example.org/fees.pdf' }],
        },
      ],
    })
    expect(checkFor(page, 'descriptive-links').pass).toBe(true)
  })
})

describe('alt text check', () => {
  test('flags a missing alt attribute', () => {
    const page = makePage({
      sections: [{ heading: 'Photo', karl: 'Body block', image: { src: 'a.png', alt: '' } }],
    })
    expect(checkFor(page, 'alt-text').pass).toBe(false)
  })

  test('flags a redundant "image of" opening', () => {
    const page = makePage({
      sections: [
        {
          heading: 'Photo',
          karl: 'Body block',
          image: { src: 'a.png', alt: 'Image of a rat trap' },
        },
      ],
    })
    const check = checkFor(page, 'alt-text')
    expect(check.pass).toBe(false)
    expect(check.offenders[0].note).toBe('Screen readers already announce the image')
  })

  test('reports cleanly when a page has no images', () => {
    const check = checkFor(makePage({}), 'alt-text')
    expect(check.pass).toBe(true)
    expect(check.detail).toBe('No images on this page')
  })
})

describe('terminology consistency check', () => {
  test('flags a competing term for the same concept', () => {
    const page = makePage({
      sections: [
        sectionWith([
          'A Notice of Violation explains the problem.',
          'Read the citation notice carefully.',
        ]),
      ],
    })
    expect(checkFor(page, 'terminology-consistency').pass).toBe(false)
  })

  test('accepts consistent use of the canonical term', () => {
    const page = makePage({
      sections: [sectionWith(['A Notice of Violation explains the problem.'])],
    })
    expect(checkFor(page, 'terminology-consistency').pass).toBe(true)
  })
})

describe('direct address check', () => {
  test('flags body copy that never says "you"', () => {
    const page = makePage({
      summary: 'Pest problems get inspected.',
      sections: [sectionWith(['Inspectors review each report.'])],
    })
    expect(checkFor(page, 'direct-address').pass).toBe(false)
  })

  test('flags a sentence addressed to the reader in the third person', () => {
    const page = makePage({
      sections: [sectionWith(['Tenants must report the problem to your landlord first.'])],
    })
    const check = checkFor(page, 'direct-address')
    expect(check.pass).toBe(false)
    expect(check.offenders[0].note).toBe('Rewrite as "you"')
  })
})

describe('meta description check', () => {
  test('does not score length, which the existing SEO rule owns', () => {
    // Manual 7.8 wants 110-160 characters; index.html and getRuleResultsFor
    // require 110 or fewer. A page cannot satisfy both, so this check stays
    // out of the argument entirely.
    const check = checkFor(
      makePage({ metaDescription: 'Report pests fast.' }),
      'meta-description-opening'
    )
    expect(check.pass).toBe(true)
  })

  test('flags an opening article instead of an active verb', () => {
    const page = makePage({ metaDescription: 'This page explains how to report pests.' })
    expect(checkFor(page, 'meta-description-opening').pass).toBe(false)
  })
})

describe('reading target recommendation', () => {
  test('flags a Transaction page whose stated target is not Grade 5-6', () => {
    const page = makePage({ type: 'Transaction', reading: 'Grade 7' })
    const check = checkFor(page, 'reading-target-match')
    expect(check.pass).toBe(false)
    expect(check.detail).toContain('recommends Grade 5-6')
  })

  test('accepts a Transaction page stating Grade 5-6', () => {
    const page = makePage({ type: 'Transaction', reading: 'Grade 5-6' })
    expect(checkFor(page, 'reading-target-match').pass).toBe(true)
  })
})

describe('severity split', () => {
  test('classifies every check as an error or a warning', () => {
    for (const check of analyzePlainLanguage(makePage({})).checks) {
      expect(['error', 'warning']).toContain(check.severity)
    }
  })

  test('cites a manual section on every check', () => {
    for (const check of analyzePlainLanguage(makePage({})).checks) {
      expect(check.section).toMatch(/^7\.\d/)
    }
  })
})

describe('against the real page corpus', () => {
  const data = loadPageData()

  test('scores every page without throwing', () => {
    for (const [key] of data.order) {
      expect(analyzePlainLanguage(data.pages[key]).checks.length).toBeGreaterThan(0)
    }
  })

  test('keeps mandatory failures rare enough to be actionable', () => {
    // The whole point of tuning the rules was signal over volume: a panel that
    // fails everything gets ignored. If a rule change pushes this up, either
    // the rule is too broad or the copy genuinely regressed - check which.
    let failures = 0
    for (const [key] of data.order) {
      for (const check of analyzePlainLanguage(data.pages[key]).checks) {
        if (check.severity === 'error' && !check.pass) failures += 1
      }
    }
    expect(failures).toBeLessThanOrEqual(12)
  })

  test('never reports an offender without a field path to fix', () => {
    for (const [key] of data.order) {
      for (const check of analyzePlainLanguage(data.pages[key]).checks) {
        for (const offender of check.offenders) {
          expect(offender.path.length).toBeGreaterThan(0)
          expect(typeof offender.note).toBe('string')
        }
      }
    }
  })

  test('exempts the Article 11 code-quote table from the shall rule', () => {
    expect(checkFor(data.pages.article11Guide, 'shall-prohibited').pass).toBe(true)
  })
})
