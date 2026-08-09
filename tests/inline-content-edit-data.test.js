// Pure logic for section-level inline edits: computing the section_edits
// diff against ORIGINAL_DATA, and reapplying a saved section_edits map onto
// a live page object. No DOM — dual-exported like js/review-merge.js and
// js/plain-language.js so this file is importable directly under Bun.
const { describe, test, expect } = require('bun:test')
const {
  computeSectionEdits,
  applyContentEditsToPageData,
  IN_SCOPE_SECTION_FIELD_SUFFIXES,
} = require('../js/inline-content-edit-data.js')

describe('IN_SCOPE_SECTION_FIELD_SUFFIXES', () => {
  test('lists exactly heading, paragraphs, and bullets', () => {
    expect(IN_SCOPE_SECTION_FIELD_SUFFIXES).toEqual(['heading', 'paragraphs', 'bullets'])
  })
})

describe('computeSectionEdits', () => {
  const original = {
    sections: [
      { heading: 'Original Heading', paragraphs: ['p1', 'p2'], bullets: ['b1'] },
      { heading: 'Second Section', paragraphs: ['q1'] },
    ],
  }

  test('returns an empty object when nothing differs from original', () => {
    const page = JSON.parse(JSON.stringify(original))
    expect(computeSectionEdits(page, original)).toEqual({})
  })

  test('reports a changed heading under its dot-path', () => {
    const page = JSON.parse(JSON.stringify(original))
    page.sections[0].heading = 'Edited Heading'
    expect(computeSectionEdits(page, original)).toEqual({
      'sections.0.heading': 'Edited Heading',
    })
  })

  test('reports a changed paragraphs array as the whole array, not a diff', () => {
    const page = JSON.parse(JSON.stringify(original))
    page.sections[0].paragraphs = ['p1', 'p2 edited', 'p3 new']
    expect(computeSectionEdits(page, original)).toEqual({
      'sections.0.paragraphs': ['p1', 'p2 edited', 'p3 new'],
    })
  })

  test('reports a changed bullets array including object-shaped unverified entries', () => {
    const page = JSON.parse(JSON.stringify(original))
    page.sections[0].bullets = [
      'b1',
      { text: 'b2 new', unverified: true, unverifiedReason: 'Manually edited during review' },
    ]
    expect(computeSectionEdits(page, original)).toEqual({
      'sections.0.bullets': [
        'b1',
        { text: 'b2 new', unverified: true, unverifiedReason: 'Manually edited during review' },
      ],
    })
  })

  test('reports multiple sections and multiple fields at once, each under its own path', () => {
    const page = JSON.parse(JSON.stringify(original))
    page.sections[0].heading = 'Edited Heading'
    page.sections[1].paragraphs = ['q1 edited']
    expect(computeSectionEdits(page, original)).toEqual({
      'sections.0.heading': 'Edited Heading',
      'sections.1.paragraphs': ['q1 edited'],
    })
  })

  test('drops a path once its value is written back to match the original (reset)', () => {
    const page = JSON.parse(JSON.stringify(original))
    page.sections[0].heading = 'Edited Heading'
    expect(computeSectionEdits(page, original)).toEqual({ 'sections.0.heading': 'Edited Heading' })
    page.sections[0].heading = original.sections[0].heading
    expect(computeSectionEdits(page, original)).toEqual({})
  })

  test('ignores fields outside heading/paragraphs/bullets, e.g. kind or component', () => {
    const page = JSON.parse(JSON.stringify(original))
    page.sections[0].kind = 'placement'
    expect(computeSectionEdits(page, original)).toEqual({})
  })

  test('returns an empty object when the page has no sections', () => {
    expect(computeSectionEdits({ sections: [] }, original)).toEqual({})
  })

  test('returns an empty object rather than throwing when page or originalPage is missing', () => {
    expect(computeSectionEdits(null, original)).toEqual({})
    expect(computeSectionEdits(original, null)).toEqual({})
    expect(computeSectionEdits(undefined, undefined)).toEqual({})
  })

  test('reports every in-scope field of a section with no original counterpart as an edit (no crash)', () => {
    const page = JSON.parse(JSON.stringify(original))
    page.sections.push({ heading: 'New Section', paragraphs: ['new'] })
    // The third section has no original counterpart to diff against, so its
    // fields are reported as edits (current value differs from undefined).
    expect(computeSectionEdits(page, original)).toEqual({
      'sections.2.heading': 'New Section',
      'sections.2.paragraphs': ['new'],
    })
  })
})

describe('applyContentEditsToPageData', () => {
  function freshPage() {
    return {
      sections: [
        { heading: 'Original Heading', paragraphs: ['p1'], bullets: ['b1'] },
        { heading: 'Second', paragraphs: ['q1'] },
      ],
    }
  }

  test('applies a saved section_edits map onto the page via setByPath', () => {
    const page = freshPage()
    applyContentEditsToPageData(page, {
      section_edits: { 'sections.0.heading': 'Restored Heading' },
    })
    expect(page.sections[0].heading).toBe('Restored Heading')
  })

  test('applies multiple entries across different sections and field kinds', () => {
    const page = freshPage()
    applyContentEditsToPageData(page, {
      section_edits: {
        'sections.0.paragraphs': ['p1 saved', 'p2 saved'],
        'sections.1.heading': 'Second Saved',
      },
    })
    expect(page.sections[0].paragraphs).toEqual(['p1 saved', 'p2 saved'])
    expect(page.sections[1].heading).toBe('Second Saved')
  })

  test('no-ops cleanly when savedRecord has no section_edits', () => {
    const page = freshPage()
    const before = JSON.parse(JSON.stringify(page))
    applyContentEditsToPageData(page, { decision: 'Approved' })
    expect(page).toEqual(before)
  })

  test('no-ops cleanly when savedRecord is null or undefined', () => {
    const page = freshPage()
    const before = JSON.parse(JSON.stringify(page))
    applyContentEditsToPageData(page, null)
    applyContentEditsToPageData(page, undefined)
    expect(page).toEqual(before)
  })

  test('never throws on a stale path that no longer resolves against the current page shape', () => {
    const page = { sections: [] }
    expect(() =>
      applyContentEditsToPageData(page, {
        section_edits: { 'sections.5.heading': 'Ghost section' },
      })
    ).not.toThrow()
    expect(page.sections).toEqual([])
  })

  test('ignores a malformed (non-object) section_edits value', () => {
    const page = freshPage()
    const before = JSON.parse(JSON.stringify(page))
    expect(() =>
      applyContentEditsToPageData(page, { section_edits: 'not an object' })
    ).not.toThrow()
    expect(page).toEqual(before)
  })

  test('round-trips through computeSectionEdits: apply then compute reproduces the same map', () => {
    const original = {
      sections: [{ heading: 'Original', paragraphs: ['p1'], bullets: ['b1'] }],
    }
    const page = JSON.parse(JSON.stringify(original))
    const savedEdits = { 'sections.0.heading': 'Round Tripped' }
    applyContentEditsToPageData(page, { section_edits: savedEdits })
    expect(computeSectionEdits(page, original)).toEqual(savedEdits)
  })

  test('skips an entry whose path is outside the heading/paragraphs/bullets contract', () => {
    // Defense-in-depth: build_scripts/review-state-schema.js and
    // js/review-state-validation.js already filter these before a record
    // reaches here, but this function must not trust that unconditionally.
    const page = freshPage()
    applyContentEditsToPageData(page, {
      section_edits: {
        'sections.0.kind': 'placement', // unsupported suffix
        'sections.0.bullets.0': 'per-index path, not the whole array',
      },
    })
    expect(page.sections[0].kind).toBeUndefined()
    expect(page.sections[0].bullets).toEqual(['b1'])
  })

  test('skips an entry whose value shape does not match its path suffix', () => {
    const page = freshPage()
    applyContentEditsToPageData(page, {
      section_edits: {
        'sections.0.heading': 123, // must be a string
        'sections.0.paragraphs': 'not an array',
        'sections.0.bullets': ['ok', { missing: 'text field' }],
      },
    })
    expect(page.sections[0].heading).toBe('Original Heading')
    expect(page.sections[0].paragraphs).toEqual(['p1'])
    expect(page.sections[0].bullets).toEqual(['b1'])
  })

  test('a mix of valid and invalid entries applies only the valid ones', () => {
    const page = freshPage()
    const wroteAny = applyContentEditsToPageData(page, {
      section_edits: {
        'sections.0.heading': 'Valid new heading',
        'sections.1.kind': 'placement', // dropped
      },
    })
    expect(page.sections[0].heading).toBe('Valid new heading')
    expect(page.sections[1].kind).toBeUndefined()
    expect(wroteAny).toBe(true)
  })
})
