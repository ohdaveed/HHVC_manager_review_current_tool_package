// Coverage for build_scripts/karl-vocabulary.js — the checks `bun run validate`
// runs over the `karl` notes in pages/*.js.
//
// Driven with hand-built pages rather than the real corpus, for the reason
// tests/card-inheritance.test.js and tests/karl-transcript.test.js are: a
// legitimately added page must never fail this suite. The one assertion that
// DOES read the real corpus is the last one, and it asserts the corpus is clean
// rather than asserting any particular note — that is what validate enforces,
// so a test of it cannot go stale in the direction of passing wrongly.
import { describe, test, expect } from 'bun:test'
const {
  CROSS_TYPE_TERMS,
  NESTED_TERMS_BY_TYPE,
  TERMS_BY_TYPE,
  blockTypeTerms,
  collectKarlNotes,
  findUnmooredNotes,
  findWrongTypeNotes,
  termsForType,
} = require('../build_scripts/karl-vocabulary.js')
const { PAGE_TYPES } = require('../build_scripts/schema.js')
const { loadPageData } = require('../build_scripts/load-pages.js')

/** A minimal page carrying one section note. */
function pageWith(type, karl, overrides = {}) {
  return {
    slug: 'a-page',
    type,
    title: 'A page',
    summary: 'Summary.',
    audience: ['Tenants'],
    reading: 'Grade 6',
    sections: [{ heading: 'A section', karl, ...overrides }],
  }
}

describe('the vocabulary is derived from the panel inventory', () => {
  test('covers every content type the schema declares', () => {
    expect(Object.keys(TERMS_BY_TYPE).sort()).toEqual([...PAGE_TYPES].sort())
  })

  test('accepts a panel by its UI label and by its raw field name', () => {
    // Both spellings are in real use across the corpus, and both are what the
    // field map prints, so neither may be the only accepted form.
    const transaction = TERMS_BY_TYPE.Transaction
    expect(transaction.has('what to do')).toBe(true)
    expect(transaction.has('what_to_do')).toBe(true)
    expect(transaction.has('accordion title and text')).toBe(true)
    expect(transaction.has('supporting_information')).toBe(true)
  })

  test('accepts the block types named inside a panel chooser', () => {
    // `what_to_do`'s blockTypesDoc reads "chooser: Callout | Section" — a note
    // naming the block rather than the panel is still correct.
    expect(TERMS_BY_TYPE.Transaction.has('callout')).toBe(true)
    expect(TERMS_BY_TYPE.Report.has('table')).toBe(true)
  })

  test('keeps each type separate — that separation is the whole point', () => {
    // Transaction has `what_to_do`; Report does not. A flat vocabulary cannot
    // express this, and expressing it is what catches a note describing the
    // wrong form.
    expect(TERMS_BY_TYPE.Transaction.has('what_to_do')).toBe(true)
    expect(TERMS_BY_TYPE.Report.has('what_to_do')).toBe(false)
    expect(TERMS_BY_TYPE.Report.has('content')).toBe(true)
  })

  test('an unknown type gets the cross-type terms and no panels', () => {
    // Not an error case: schema.js's PAGE_TYPES union is what rejects an
    // unknown type. This just must not throw, and must not silently accept
    // every panel of every form either.
    const unknown = termsForType('Not A Karl Type')
    expect(unknown.has('what_to_do')).toBe(false)
    expect(unknown.has('sf.gov page')).toBe(true)
    expect(unknown.size).toBeLessThan(TERMS_BY_TYPE.Transaction.size)
  })
})

describe('terms must stand as whole words', () => {
  // Raw substring matching was the first version and it silently weakened the
  // whole check: a note naming NO Karl construct was accepted because a term
  // happened to sit inside an ordinary English word.
  test('a term inside a longer word is not a match', () => {
    // `suitable` contains `table`; `candidate` contains `date`. Both are real
    // Report block names, and both notes name nothing.
    expect(
      findUnmooredNotes({ a: pageWith('Report', 'Put this somewhere suitable.') })
    ).toHaveLength(1)
    expect(findUnmooredNotes({ a: pageWith('Report', 'A candidate for review.') })).toHaveLength(1)
  })

  test('a plural still matches', () => {
    // The corpus writes "Resource sections" and "two Related panels", so the
    // boundary rule has to allow a trailing s or it rejects correct notes.
    expect(
      findUnmooredNotes({ a: pageWith('Resource Collection', 'Two Resource sections here.') })
    ).toEqual([])
  })

  test('an underscored field name is not matched by its bare prefix', () => {
    // Load-bearing: `related` must NOT match inside `related_links`, or the
    // Topic finding this check exists to report stops being reported.
    const pages = { a: pageWith('Topic', 'Maps to Karl’s related_links stream.') }
    expect(findUnmooredNotes(pages)).toHaveLength(1)
  })
})

describe('nested block names are scoped to their owning type', () => {
  test('a Campaign construct is not accepted on a Report page', () => {
    // These sat in CROSS_TYPE_TERMS until review caught it, which handed every
    // nested name to every form — reintroducing the exact defect the module
    // exists to catch.
    expect(TERMS_BY_TYPE.Campaign.has('accordion sidebar')).toBe(true)
    expect(TERMS_BY_TYPE.Report.has('accordion sidebar')).toBe(false)
    const found = findWrongTypeNotes({ a: pageWith('Report', 'Maps to an Accordion sidebar.') })
    expect(found).toHaveLength(1)
    expect(found[0].belongsTo).toEqual(['Campaign'])
  })

  test('every scoped term names a type the schema declares', () => {
    expect(Object.keys(NESTED_TERMS_BY_TYPE).every((type) => PAGE_TYPES.includes(type))).toBe(true)
  })
})

describe('blockTypeTerms', () => {
  test('skips the qualifiers that describe a block rather than name one', () => {
    // "one type: title_and_text, no chooser" — collecting `no chooser` let a
    // note reading only that pass as though it named a Karl construct.
    const terms = blockTypeTerms('one type: title_and_text, no chooser')
    expect(terms).toContain('title_and_text')
    expect(terms).not.toContain('no chooser')
    expect(findUnmooredNotes({ a: pageWith('Transaction', 'no chooser') })).toHaveLength(1)
  })

  test('splits a chooser list into its block names', () => {
    expect(blockTypeTerms('chooser: Callout | Section')).toEqual(['Callout', 'Section'])
  })

  test('picks up a quoted instance label the prose adds', () => {
    // Transaction's `supporting_information` is "one type: title_and_text,
    // instance labelled "Accordion item"" — the quoted name is what an editor
    // actually sees on the block, so a note naming it is correct.
    expect(
      blockTypeTerms('one type: title_and_text, instance labelled "Accordion item"')
    ).toContain('Accordion item')
  })

  test('returns nothing for an absent or empty cell', () => {
    expect(blockTypeTerms(undefined)).toEqual([])
    expect(blockTypeTerms('')).toEqual([])
  })
})

describe('findUnmooredNotes', () => {
  test('accepts a note naming a panel on its own type', () => {
    const pages = {
      a: pageWith('Transaction', 'Maps to the What to Do panel, one Section per step.'),
    }
    expect(findUnmooredNotes(pages)).toEqual([])
  })

  test('reports a note naming nothing on the form', () => {
    const pages = { a: pageWith('Transaction', 'Put this somewhere sensible near the top.') }
    const found = findUnmooredNotes(pages)
    expect(found).toHaveLength(1)
    expect(found[0].pageKey).toBe('a')
    expect(found[0].type).toBe('Transaction')
  })

  test('a note declaring an unresolved mapping is not a failure', () => {
    // Roughly a tenth of the corpus honestly records that no mapping exists.
    // That is a state, not a defect, and the phrases come from
    // GAP_LABEL_PATTERN in js/karl-tag-meta.js rather than a second list here.
    for (const phrase of [
      'BLOCKED pending a decision.',
      'External-URL card with no clean mapping in the verified schema.',
      'Unusual shape — flag for Digital Services.',
    ]) {
      expect(findUnmooredNotes({ a: pageWith('Transaction', phrase) })).toEqual([])
    }
  })

  test('walks cards, steps, callouts and images, not only sections', () => {
    // Every nested path collectKarlNotes claims to walk is represented here.
    // The fixture carried a section, a card and a callout only, so a
    // regression in the image, step or step-callout paths would have passed.
    const pages = {
      a: pageWith('Transaction', 'What to Do panel.', {
        cards: [{ title: 'A card', karl: 'Put it wherever.' }],
        callout: { text: 'Note.', karl: 'Also wherever.' },
        image: { src: 'a.png', alt: 'A', karl: 'Somewhere for the picture.' },
        steps: [
          {
            title: 'A step',
            karl: 'Anywhere at all.',
            callout: { text: 'Note.', karl: 'And here too.' },
          },
        ],
      }),
    }
    expect(collectKarlNotes(pages)).toHaveLength(6)
    // Only the section note names a real panel; the other five name nothing.
    expect(findUnmooredNotes(pages)).toHaveLength(5)
  })

  test('a note naming one field of a compound inventory row is accepted', () => {
    // Campaign's inventory stores `facts_title + fact_items` in one cell, and
    // Agency stores four comma-separated archive fields. Registering only the
    // combined literal reported a note naming one constituent as unmoored.
    expect(findUnmooredNotes({ a: pageWith('Campaign', 'Maps to facts_title.') })).toEqual([])
    expect(findUnmooredNotes({ a: pageWith('Agency', 'Maps to archive_url.') })).toEqual([])
  })
})

describe('findWrongTypeNotes', () => {
  test('names the type a misplaced term really belongs to', () => {
    // The defect this module exists for: the note is precise, names real Karl
    // fields, and describes a form this page does not have.
    const pages = { a: pageWith('Report', 'Maps to the what_to_do stream, one Section per step.') }
    const found = findWrongTypeNotes(pages)
    expect(found).toHaveLength(1)
    expect(found[0].term).toBe('what_to_do')
    expect(found[0].belongsTo).toEqual(['Transaction'])
  })

  test('is a strict subset of the unmoored set', () => {
    // A note that correctly describes its own form and mentions another type in
    // passing must not be reported — otherwise every comparative note becomes a
    // finding and the check gets routed around.
    const pages = {
      a: pageWith('Report', 'Report Content -> Table block, unlike Transaction’s what_to_do.'),
    }
    expect(findUnmooredNotes(pages)).toEqual([])
    expect(findWrongTypeNotes(pages)).toEqual([])
  })
})

describe('the real corpus', () => {
  test('every karl note names a field on its own page type', () => {
    // What `bun run validate` gates on. Asserted here too so a failure names the
    // note rather than only failing the build.
    const { pages } = loadPageData()
    expect(findWrongTypeNotes(pages)).toEqual([])
    expect(findUnmooredNotes(pages)).toEqual([])
  })
})
