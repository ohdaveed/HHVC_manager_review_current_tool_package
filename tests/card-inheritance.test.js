// Coverage for the card-inheritance classifier and the audit built on top of it.
//
// Both halves needed pinning for the same reason, and it is not the usual one.
// `js/card-inheritance.js` exists so that `js/page-render.js` and
// `build_scripts/audit-card-inheritance.js` cannot come to disagree about what
// inherits — but a shared module only removes the disagreement between the two
// CALLERS. It does nothing to stop the shared answer itself from changing, and
// the consequence of a wrong answer here is not a crash: it is a mockup that
// silently shows a reviewer copy which can never publish, or silently hides
// copy that can. Neither shows up in any other test.
//
// The audit half is tested against hand-built page objects rather than the real
// `pages/*.js` set on purpose. Asserting "the corpus currently has 101 internal
// cards" would fail every time someone legitimately adds a card, which trains
// people to update the number without reading it. What is worth pinning is the
// BEHAVIOUR — which bucket a row lands in, and which populations are counted
// separately — and synthetic pages state that directly.
const { describe, test, expect } = require('bun:test')
const { classifySection, AUTHORED, INHERITS, TITLE_ONLY } = require('../js/card-inheritance.js')
const { auditCards } = require('../build_scripts/audit-card-inheritance.js')

/** A karl note naming an Agency Services subsection — the `inherits` bucket. */
const INHERITS_KARL = 'Agency page -> Services subsection -> page chooser entry.'
/** A karl note naming a Related panel — the `title-only` bucket. */
const TITLE_ONLY_KARL = 'Maps to a related_links entry (Link to = External URL).'
/** A karl note naming a Table block — the `authored` bucket. */
const AUTHORED_KARL = 'Body -> Table block. The card is mockup presentation only.'

/**
 * Build a one-page corpus plus the destination pages its cards point at, so a
 * test states only the section and cards it cares about.
 *
 * @param {object[]} sections
 * @param {Record<string, object>} [destinations]
 * @returns {Record<string, object>}
 */
function corpus(sections, destinations = {}) {
  return { home: { sections }, ...destinations }
}

describe('classifySection', () => {
  test('classifies a Services/Resources subsection as inherits', () => {
    expect(classifySection({ karl: INHERITS_KARL })).toBe('inherits')
    expect(classifySection({ karl: 'Agency page -> Resources subsection.' })).toBe('inherits')
  })

  test('classifies a Related panel and a Resource section as title-only', () => {
    expect(classifySection({ karl: TITLE_ONLY_KARL })).toBe('title-only')
    expect(classifySection({ karl: 'Resource section -> Document Picker upload.' })).toBe(
      'title-only'
    )
  })

  test('classifies a Table block and a Title-and-text block as authored', () => {
    expect(classifySection({ karl: AUTHORED_KARL })).toBe('authored')
    expect(classifySection({ karl: 'Body -> Title and text block.' })).toBe('authored')
  })

  test('returns unknown for an unrecognized karl note rather than guessing', () => {
    // Reported under UNKNOWN rather than assumed safe: a new section with an
    // unfamiliar note must surface, not be silently skipped.
    expect(classifySection({ karl: 'Some block nobody has classified yet.' })).toBe('unknown')
  })

  test('returns unknown for a section with no karl note at all', () => {
    // renderSteps() passes null for the section on purpose, and this is the
    // branch that keeps a step card's authored text exactly as it renders.
    expect(classifySection({})).toBe('unknown')
  })

  test('prefers authored over every other bucket', () => {
    // A Table block whose note also mentions a page chooser must not inherit —
    // this is the ordering that stops a mechanical pass corrupting table rows.
    expect(classifySection({ karl: 'Table block with a page chooser entry.' })).toBe('authored')
  })

  test('prefers title-only over inherits when a note matches both', () => {
    // The Related karl notes also contain 'a generic unrestricted "Page"
    // chooser', which INHERITS would otherwise claim. Getting this backwards
    // makes the audit demand a description on a panel that renders none.
    expect(classifySection({ karl: 'Related panel: a generic unrestricted "Page" chooser.' })).toBe(
      'title-only'
    )
  })

  test('exports the three regexes it decides with', () => {
    // Exported so a caller can explain a classification rather than restate the
    // patterns; a second copy of these is exactly what this module prevents.
    for (const pattern of [AUTHORED, INHERITS, TITLE_ONLY]) {
      expect(pattern).toBeInstanceOf(RegExp)
    }
  })
})

describe('auditCards — internal cards', () => {
  test('reports nothing when an inheriting card carries a matching title and no text', () => {
    const pages = corpus(
      [
        {
          heading: 'Services',
          karl: INHERITS_KARL,
          cards: [{ title: 'Report rodents', target: 'rodents' }],
        },
      ],
      { rodents: { title: 'Report rodents', summary: 'Report rats and mice.' } }
    )
    const result = auditCards(pages)

    expect(result.total).toBe(1)
    expect(result.findings).toEqual([])
    expect(result.unknown).toEqual([])
  })

  test('reports an inheriting card that carries any text of its own', () => {
    // The assertion is "the card text is EMPTY", not "it equals the destination
    // summary" — since the renderer began inheriting, a card's own text reaches
    // no reader, so demanding a verbatim duplicate would re-create the drift
    // the inheritance was introduced to make impossible.
    const pages = corpus(
      [
        {
          heading: 'Services',
          karl: INHERITS_KARL,
          cards: [{ title: 'Report rodents', text: 'Report rats and mice.', target: 'rodents' }],
        },
      ],
      { rodents: { title: 'Report rodents', summary: 'Report rats and mice.' } }
    )
    const result = auditCards(pages)

    expect(result.findings).toHaveLength(1)
    expect(result.findings[0].kind).toBe('inherits')
    expect(result.findings[0].titleMatches).toBe(true)
    expect(result.findings[0].textMatches).toBe(false)
    expect(result.findings[0].external).toBeUndefined()
  })

  test('reports a card that names its destination differently', () => {
    const pages = corpus(
      [
        {
          heading: 'Services',
          karl: INHERITS_KARL,
          cards: [{ title: 'Rodent reports', target: 'rodents' }],
        },
      ],
      { rodents: { title: 'Report rodents', summary: 'Report rats and mice.' } }
    )
    const result = auditCards(pages)

    expect(result.findings).toHaveLength(1)
    expect(result.findings[0].titleMatches).toBe(false)
    expect(result.findings[0].destTitle).toBe('Report rodents')
  })

  test('leaves an authored section alone however far its card diverges', () => {
    const pages = corpus(
      [
        {
          heading: 'Mold and lead hazards',
          karl: AUTHORED_KARL,
          cards: [{ title: 'Nothing like it', text: 'Authored words.', target: 'rodents' }],
        },
      ],
      { rodents: { title: 'Report rodents', summary: 'Report rats and mice.' } }
    )
    const result = auditCards(pages)

    // Still counted — it is an internal link that was checked — but never
    // reported, because a table row writing its own words is correct.
    expect(result.total).toBe(1)
    expect(result.findings).toEqual([])
    expect(result.unknown).toEqual([])
  })

  test('routes an unclassifiable section to unknown rather than to findings', () => {
    const pages = corpus(
      [
        {
          heading: 'Something new',
          karl: 'A block nobody has classified.',
          cards: [{ title: 'Wrong name', text: 'Some copy.', target: 'rodents' }],
        },
      ],
      { rodents: { title: 'Report rodents', summary: 'Report rats and mice.' } }
    )
    const result = auditCards(pages)

    expect(result.findings).toEqual([])
    expect(result.unknown).toHaveLength(1)
  })

  test('skips a card whose target resolves to no page at all', () => {
    // A broken target is findBrokenCardTargets' job. Reporting it here too
    // would give one defect two owners and two different suggested fixes.
    const pages = corpus([
      {
        heading: 'Services',
        karl: INHERITS_KARL,
        cards: [{ title: 'Gone', text: 'Some copy.', target: 'doesNotExist' }],
      },
    ])
    const result = auditCards(pages)

    expect(result.total).toBe(0)
    expect(result.findings).toEqual([])
  })
})

describe('auditCards — external-URL cards', () => {
  test('reports an external card in a title-only section as dead text', () => {
    // A title-only component renders link text and no other text node — a fact
    // about the COMPONENT, so it holds for an external entry exactly as it does
    // for an internal one. These land in the same dead-text bucket.
    const pages = corpus([
      {
        heading: 'Related pages',
        karl: TITLE_ONLY_KARL,
        cards: [{ title: 'CDC guidance', text: 'Prevention tips.', url: 'https://www.cdc.gov/' }],
      },
    ])
    const result = auditCards(pages)

    expect(result.findings).toHaveLength(1)
    expect(result.findings[0].kind).toBe('title-only')
    expect(result.findings[0].external).toBe(true)
    expect(result.findings[0].target).toBe('https://www.cdc.gov/')
    // Asserted true rather than computed: an external card's title IS its
    // authored link label, so it keeps these rows out of the TITLE bucket
    // without that filter needing to learn about external cards.
    expect(result.findings[0].titleMatches).toBe(true)
    expect(result.externalAuthored).toEqual([])
  })

  test('holds an external card in an inheriting section separately, not as a finding', () => {
    // An external entry in a Services/Resources subsection authors its own
    // description and Karl renders it — a census of all 332 sf.gov Agency pages
    // on 2026-08-09 found 333 of 363 off-domain entries carrying one. So this
    // text is correct, and must never land in `findings`, where every other row
    // is something to go and delete.
    const pages = corpus([
      {
        heading: 'Services',
        karl: INHERITS_KARL,
        cards: [{ title: '311 online services', text: 'Start a request.', url: 'https://sf.gov/' }],
      },
    ])
    const result = auditCards(pages)

    expect(result.findings).toEqual([])
    expect(result.externalAuthored).toHaveLength(1)
    expect(result.externalAuthored[0].kind).toBe('inherits')
    expect(result.externalAuthored[0].external).toBe(true)
  })

  test('says nothing about an external card that carries no text', () => {
    const pages = corpus([
      {
        heading: 'Related pages',
        karl: TITLE_ONLY_KARL,
        cards: [{ title: 'CDC guidance', url: 'https://www.cdc.gov/' }],
      },
      {
        heading: 'Services',
        karl: INHERITS_KARL,
        cards: [{ title: '311', url: 'https://sf.gov/' }],
      },
    ])
    const result = auditCards(pages)

    expect(result.findings).toEqual([])
    expect(result.externalAuthored).toEqual([])
    // Still counted: they were checked and found correct, and a bucket whose
    // denominator excludes its passes cannot be read as a ratio.
    expect(result.externalTotal).toBe(2)
  })

  test('leaves external cards in authored and unknown sections untouched', () => {
    const pages = corpus([
      {
        heading: 'Mold and lead hazards',
        karl: AUTHORED_KARL,
        cards: [{ title: 'Lead safety', text: 'Authored words.', url: 'https://sf.gov/lead' }],
      },
      {
        heading: 'Something new',
        karl: 'A block nobody has classified.',
        cards: [{ title: 'Elsewhere', text: 'Authored words.', url: 'https://sf.gov/x' }],
      },
    ])
    const result = auditCards(pages)

    expect(result.findings).toEqual([])
    expect(result.externalAuthored).toEqual([])
    expect(result.unknown).toEqual([])
    // Not counted either: `externalTotal` is the population this audit can say
    // something about, and these two are not in it.
    expect(result.externalTotal).toBe(0)
  })

  test('counts external cards separately from internal ones', () => {
    // The two totals must not merge. `total` is the number the renderer's
    // inheritance behaviour is judged by; folding in a second population makes
    // a change in one look like a change in the other.
    const pages = corpus(
      [
        {
          heading: 'Services',
          karl: INHERITS_KARL,
          cards: [
            { title: 'Report rodents', target: 'rodents' },
            { title: '311', url: 'https://sf.gov/' },
          ],
        },
      ],
      { rodents: { title: 'Report rodents', summary: 'Report rats and mice.' } }
    )
    const result = auditCards(pages)

    expect(result.total).toBe(1)
    expect(result.externalTotal).toBe(1)
  })
})
