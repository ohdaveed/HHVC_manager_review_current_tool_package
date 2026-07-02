// Negative-path coverage for the page-data validation logic used by
// build_scripts/validate.js. Previously this logic only had an implicit
// "test" (does it happen to pass on today's real page content) — nothing
// proved it actually catches malformed data.
const { describe, test, expect } = require('bun:test')
const { dataSchema } = require('../build_scripts/schema')
const {
  findMissingOrderKeys,
  findBrokenCardTargets,
  isTopicPageFirst,
  findBannedTerms,
} = require('../build_scripts/data-checks')

function validPage(overrides = {}) {
  return {
    slug: 'pests-and-housing-problems/report-rats-or-mice',
    type: 'Transaction',
    title: 'Report rats or mice',
    summary: 'Tell us about a rodent problem at your home or business.',
    audience: ['Tenants', 'Property owners'],
    reading: '8th grade',
    sections: [],
    ...overrides,
  }
}

function validData(pageOverrides = {}) {
  return {
    pages: { pestsTopic: validPage(pageOverrides) },
    order: [['pestsTopic', 'Pests and housing problems']],
  }
}

describe('dataSchema', () => {
  test('accepts a minimal valid page', () => {
    const result = dataSchema.safeParse(validData())
    expect(result.success).toBe(true)
  })

  test('rejects a page missing a required field', () => {
    const page = validPage()
    delete page.title
    const data = { pages: { pestsTopic: page }, order: [['pestsTopic', 'Pests']] }
    expect(dataSchema.safeParse(data).success).toBe(false)
  })

  test('rejects an empty-string required field', () => {
    const data = validData({ title: '' })
    expect(dataSchema.safeParse(data).success).toBe(false)
  })

  test('rejects an empty audience array', () => {
    const data = validData({ audience: [] })
    expect(dataSchema.safeParse(data).success).toBe(false)
  })

  test('rejects a section missing its required karl field', () => {
    const data = validData({
      sections: [{ heading: 'Intro', paragraphs: ['hello'] }],
    })
    expect(dataSchema.safeParse(data).success).toBe(false)
  })

  test('accepts a fully populated section with cards and steps', () => {
    const data = validData({
      sections: [
        {
          heading: 'Intro',
          karl: 'Body section',
          paragraphs: ['hello'],
          cards: [{ title: 'Card', text: 'Text', target: 'pestsTopic' }],
          steps: [{ title: 'Step', button: 'Go' }],
        },
      ],
    })
    expect(dataSchema.safeParse(data).success).toBe(true)
  })

  test('rejects an order entry that is not a [key, label] tuple', () => {
    const data = validData()
    data.order = [['pestsTopic']]
    expect(dataSchema.safeParse(data).success).toBe(false)
  })
})

describe('isTopicPageFirst', () => {
  test('true when pestsTopic leads the order array', () => {
    expect(
      isTopicPageFirst([
        ['pestsTopic', 'x'],
        ['other', 'y'],
      ])
    ).toBe(true)
  })

  test('false when another page leads', () => {
    expect(
      isTopicPageFirst([
        ['other', 'y'],
        ['pestsTopic', 'x'],
      ])
    ).toBe(false)
  })

  test('false for an empty order array', () => {
    expect(isTopicPageFirst([])).toBe(false)
  })
})

describe('findMissingOrderKeys', () => {
  test('empty when every order key exists in pages', () => {
    const pages = { a: {}, b: {} }
    const order = [
      ['a', 'A'],
      ['b', 'B'],
    ]
    expect(findMissingOrderKeys(pages, order)).toEqual([])
  })

  test('reports order keys with no matching page', () => {
    const pages = { a: {} }
    const order = [
      ['a', 'A'],
      ['ghost', 'Ghost'],
    ]
    expect(findMissingOrderKeys(pages, order)).toEqual(['ghost'])
  })
})

describe('findBrokenCardTargets', () => {
  test('empty when every card target exists', () => {
    const pages = {
      a: { sections: [{ cards: [{ target: 'b' }] }] },
      b: {},
    }
    expect(findBrokenCardTargets(pages)).toEqual([])
  })

  test('reports a card target with no matching page', () => {
    const pages = {
      a: { sections: [{ cards: [{ target: 'ghost' }] }] },
    }
    expect(findBrokenCardTargets(pages)).toEqual([{ pageKey: 'a', target: 'ghost' }])
  })

  test('ignores cards with no target (inert/decorative cards)', () => {
    const pages = { a: { sections: [{ cards: [{ title: 'No link' }] }] } }
    expect(findBrokenCardTargets(pages)).toEqual([])
  })
})

describe('findBannedTerms', () => {
  const bannedTerms = ['plumbing', 'dbi', 'sewer']

  test('empty when no banned terms are present', () => {
    expect(findBannedTerms({ title: 'Report rats or mice' }, bannedTerms)).toEqual([])
  })

  test('finds a banned term regardless of case or nesting depth', () => {
    const page = { sections: [{ paragraphs: ['Contact DBI about this.'] }] }
    expect(findBannedTerms(page, bannedTerms)).toEqual(['dbi'])
  })

  test('finds multiple banned terms', () => {
    const page = { title: 'plumbing and sewer issues' }
    expect(findBannedTerms(page, bannedTerms)).toEqual(['plumbing', 'sewer'])
  })
})
