// Tests for the reading-level helper — the module the browser actually runs.
//
// That qualifier is the point of this file's import block. These tests used to
// require build_scripts/reading-level.js, a Node-side copy of the same logic
// that nothing but this file ever loaded: not validate, not export, not
// server.ts. The reviewer-facing "Computed reading level" check has always
// called window.readingLevel (js/standards/reading-level.js), which had no coverage at
// all. So 100% of the coverage sat on the copy that never shipped, and the two
// copies had drifted 1.14 grades apart on average without a single red test.
//
// The Node copy is now deleted and this points at the real one. happy-dom is
// registered by bunfig.toml before the loader runs, so the side-effect import
// below finds a `window` to attach to.
import { describe, test, expect } from 'bun:test'
import '../js/standards/reading-level.js'

const { loadPageData } = require('../build_scripts/load-pages')
const { fleschKincaidGrade, extractPageBodyText, normalizeTextItem, calloutText, joinChunks } =
  window.readingLevel

describe('load-pages', () => {
  test('discovers all page modules and loads HHVC_DATA', () => {
    const data = loadPageData()
    expect(data.order.length).toBe(29)
    expect(data.pages.pestsTopic).toBeTruthy()
    expect(data.order[0][0]).toBe('pestsTopic')
  })
})

describe('fleschKincaidGrade', () => {
  test('computes a grade for sample page body text', () => {
    const data = loadPageData()
    const page = data.pages.pestsTopic
    const text = extractPageBodyText(page)
    const grade = fleschKincaidGrade(text)
    expect(grade).not.toBeNull()
    expect(grade).toBeGreaterThan(0)
    expect(grade).toBeLessThan(20)
  })

  // Pins, not samples. The failure these guard against is silent: swap the
  // rule-based syllable counter back for a vowel-run approximation and every
  // assertion around them still passes, while pages quietly start reporting
  // they hit a target they miss.
  //
  // Both fixtures are single sentences, so the sentence-length term is
  // identical either way and any difference in the result is syllable counting
  // and nothing else. They deliberately miss in OPPOSITE directions — the old
  // approximation was not a uniform undercount, it was wrong per word in both
  // directions ("remediation" 4 against the correct 5, "investigates" 5
  // against the correct 4) and only netted out low once aggregated over a
  // whole page. A fixture pair that both drifted the same way would leave a
  // half-fixed counter passing.
  test('matches the reference where the old approximation read too hard', () => {
    // 6.8 here; 7.8 under the vowel-run formula this file replaced.
    expect(
      fleschKincaidGrade('The inspector will contact you to schedule a visit to your building.')
    ).toBe(6.8)
  })

  test('matches the reference where the old approximation read too easy', () => {
    // 16.6 here; 15.5 under the vowel-run formula.
    expect(
      fleschKincaidGrade(
        'Property owners are responsible for remediation of the reported conditions.'
      )
    ).toBe(16.6)
  })

  test('returns null rather than a confident number for text under five words', () => {
    expect(fleschKincaidGrade('Report a rat problem')).toBeNull()
    expect(fleschKincaidGrade('')).toBeNull()
    expect(fleschKincaidGrade(undefined)).toBeNull()
  })

  // A markdown link's target is a page key, not prose. Left in the string it
  // is scored as a word the reader never sees.
  test('scores markdown link labels, not their targets', () => {
    const withLink = 'You can [report a rat problem](rodentsReport) online at any time.'
    const plain = 'You can report a rat problem online at any time.'
    expect(fleschKincaidGrade(withLink)).toBe(fleschKincaidGrade(plain))
  })

  test('scores emphasized text the same as unemphasized text', () => {
    expect(fleschKincaidGrade('You **must** respond within thirty days of the notice.')).toBe(
      fleschKincaidGrade('You must respond within thirty days of the notice.')
    )
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
