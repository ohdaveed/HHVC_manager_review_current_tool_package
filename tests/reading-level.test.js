const { describe, test, expect } = require('bun:test')
const { loadPageData } = require('../build_scripts/load-pages')
const {
  fleschKincaidGrade,
  extractPageBodyText,
  normalizeTextItem,
  calloutText,
  joinChunks,
} = require('../build_scripts/reading-level')

describe('load-pages', () => {
  test('discovers all page modules and loads HHVC_DATA', () => {
    const data = loadPageData()
    expect(data.order.length).toBe(19)
    expect(data.pages.pestsTopic).toBeTruthy()
    expect(data.order[0][0]).toBe('pestsTopic')
  })
})

describe('reading-level', () => {
  test('computes a grade for sample page body text', () => {
    const data = loadPageData()
    const page = data.pages.pestsTopic
    const text = extractPageBodyText(page)
    const grade = fleschKincaidGrade(text)
    expect(grade).not.toBeNull()
    expect(grade).toBeGreaterThan(0)
    expect(grade).toBeLessThan(20)
  })
})

describe('normalizeTextItem', () => {
  test('passes a plain string through unchanged', () => {
    expect(normalizeTextItem('Report a rat problem')).toBe('Report a rat problem')
  })

  test('unwraps an unverified item object to its text', () => {
    expect(normalizeTextItem({ text: 'Sewage backups', unverified: true })).toBe('Sewage backups')
  })

  test('joins a whatToKnow label and text', () => {
    expect(normalizeTextItem({ label: 'Cost', text: 'Free' })).toBe('Cost Free')
  })

  test('returns an empty string for null, numbers, and shapeless objects', () => {
    expect(normalizeTextItem(null)).toBe('')
    expect(normalizeTextItem(42)).toBe('')
    expect(normalizeTextItem({ unverified: true })).toBe('')
  })
})

describe('calloutText', () => {
  test('joins a string title with its text', () => {
    expect(calloutText({ title: 'Your report is confidential', text: 'We never share it' })).toBe(
      'Your report is confidential We never share it'
    )
  })

  test('drops a suppressed title of literal false', () => {
    expect(calloutText({ title: false, text: 'You do not need photos' })).toBe(
      'You do not need photos'
    )
  })

  test('returns an empty string when there is no callout', () => {
    expect(calloutText(undefined)).toBe('')
  })
})

describe('joinChunks', () => {
  test('terminates unpunctuated chunks so each stays one sentence', () => {
    expect(joinChunks(['Rats or mice', 'Cockroaches', 'Bed bugs'])).toBe(
      'Rats or mice. Cockroaches. Bed bugs.'
    )
  })

  test('leaves existing terminal punctuation alone', () => {
    expect(joinChunks(['Report it now.', 'Who can help?', 'Act fast!'])).toBe(
      'Report it now. Who can help? Act fast!'
    )
  })

  test('drops empty and nullish chunks', () => {
    expect(joinChunks(['Kept', '', null, undefined, '   '])).toBe('Kept.')
  })
})

describe('extractPageBodyText regressions', () => {
  const data = loadPageData()

  test('never emits [object Object] for any real page', () => {
    for (const [key] of data.order) {
      expect(extractPageBodyText(data.pages[key])).not.toContain('[object Object]')
    }
  })

  test('reads the text out of unverified item objects', () => {
    // pages/what-happens-after-report.js carries { text, unverified } entries.
    expect(extractPageBodyText(data.pages.afterReport)).toContain('Sewage')
  })

  test('includes audience entries, which render as the "who this page is for" list', () => {
    const page = data.pages.pestsTopic
    expect(extractPageBodyText(page)).toContain(page.audience[0])
  })

  test('keeps every real page under a sane average sentence length', () => {
    // The space-joined version collapsed whole bullet lists into one
    // "sentence" — scopeInfo hit 218 words and a grade of 21.4.
    for (const [key] of data.order) {
      const text = extractPageBodyText(data.pages[key])
      const sentences = text.split(/[.!?]+/).filter((s) => s.trim())
      const words = text.split(/\s+/).filter(Boolean).length
      expect(words / sentences.length).toBeLessThan(20)
      expect(fleschKincaidGrade(text)).toBeLessThan(15)
    }
  })

  test('returns an empty string for a missing page rather than throwing', () => {
    expect(extractPageBodyText(undefined)).toBe('')
  })
})
