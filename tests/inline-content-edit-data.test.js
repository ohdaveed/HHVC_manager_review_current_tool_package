// Pure logic for section-level inline edits: computing the section_edits
// diff against ORIGINAL_DATA, and reapplying a saved section_edits map onto
// a live page object. No DOM — dual-exported like js/review-merge.js and
// js/standards/plain-language.js so this file is importable directly under Bun.
const { describe, test, expect } = require('bun:test')
const {
  computeSectionEdits,
  applyContentEditsToPageData,
  EDITABLE_FIELD_SHAPES,
  editableFieldKind,
  editableItemKind,
} = require('../js/inline-content-edit-data.js')

describe('EDITABLE_FIELD_SHAPES', () => {
  // Every path shape a reviewer can edit on the mockup, and the value shape
  // its stored section_edits entry must have. This list is the feature's
  // scope: an element carrying data-rewrite-field whose container path is
  // absent here renders an editor, accepts keystrokes, and then loses them
  // on the next load, because computeSectionEdits never records the field.
  // That is not hypothetical — step text was in exactly that state (stamped
  // by js/page-render.js since the AI-rewrite work, never recorded here),
  // which is why the list is now asserted whole rather than by example.
  test('covers section, step, table, and page-level text containers', () => {
    const kinds = Object.fromEntries(
      EDITABLE_FIELD_SHAPES.map(({ example, kind }) => [example, kind])
    )
    expect(kinds).toEqual({
      'sections.0.heading': 'string',
      'sections.0.paragraphs': 'textArray',
      'sections.0.bullets': 'textArray',
      'sections.0.table': 'table',
      'sections.0.callout.title': 'string',
      'sections.0.callout.text': 'string',
      'sections.0.steps.0.title': 'string',
      'sections.0.steps.0.text': 'textArray',
      'sections.0.steps.0.bullets': 'textArray',
      'sections.0.steps.0.callout.title': 'string',
      'sections.0.steps.0.callout.text': 'string',
      'whatToKnow.cost': 'string',
      'whatToKnow.thingsToKnow': 'textArray',
      'whatToKnow.items': 'textArray',
      'spotlight.title': 'string',
      'spotlight.paragraphs': 'textArray',
      'contact.address': 'string',
      'contact.hours': 'string',
      'contact.phone': 'stringArray',
      'contact.email': 'stringArray',
      'contact.other': 'stringArray',
    })
  })

  test('excludes card fields, whose text renders nowhere', () => {
    // A card's own `text` is never printed — an inheriting card publishes the
    // DESTINATION page's summary (see "Card descriptions are inherited, not
    // printed"). Recording an edit to it would persist a value the renderer
    // ignores, so the reviewer's change would reappear as the old text on the
    // next paint. The absence is the enforcement; keep it asserted.
    expect(editableFieldKind('sections.0.cards.0.text')).toBe(null)
    expect(editableFieldKind('sections.0.cards.0.title')).toBe(null)
  })

  test('excludes editor-only annotations', () => {
    expect(editableFieldKind('sections.0.karl')).toBe(null)
    expect(editableFieldKind('editorNote')).toBe(null)
  })
})

describe('editableItemKind', () => {
  // What ONE item inside an editable array is written back as. A paragraph,
  // bullet, or step text item carries the tagged
  // {text, unverified, unverifiedReason} form so the existing Unverified pill
  // renders with no renderer change; a table cell and a contact phone number
  // are plain strings their renderer escapes and prints directly, and writing
  // the tagged object into one of those renders "[object Object]".
  test('reports taggedText for paragraph, bullet, and step text items', () => {
    expect(editableItemKind('sections.0.paragraphs.1')).toBe('taggedText')
    expect(editableItemKind('sections.2.bullets.0')).toBe('taggedText')
    expect(editableItemKind('sections.0.steps.1.text.0')).toBe('taggedText')
    expect(editableItemKind('sections.0.steps.1.bullets.2')).toBe('taggedText')
    expect(editableItemKind('whatToKnow.items.0')).toBe('taggedText')
    // The one that reads like an exception and is not: build_scripts/schema.js
    // types the AUTHORED spotlight.paragraphs as string[], but it renders
    // through paragraphList() — the same helper section paragraphs use — so a
    // reviewer's edit takes the tagged form like any other body copy. The
    // schema constrains pages/*.js, not review state.
    expect(editableItemKind('spotlight.paragraphs.0')).toBe('taggedText')
  })

  test('reports plainString for table cells and string-array items', () => {
    // A contact entry and a table cell go through escapeHtml() directly in
    // js/page-render.js, so the tagged object would print as "[object
    // Object]".
    expect(editableItemKind('sections.0.table.1.2')).toBe('plainString')
    expect(editableItemKind('contact.phone.0')).toBe('plainString')
    expect(editableItemKind('contact.email.1')).toBe('plainString')
  })

  test('reports plainString for a whole-field string path', () => {
    expect(editableItemKind('sections.0.heading')).toBe('plainString')
    expect(editableItemKind('sections.0.callout.text')).toBe('plainString')
    expect(editableItemKind('sections.0.steps.0.title')).toBe('plainString')
    expect(editableItemKind('contact.address')).toBe('plainString')
  })

  test('reports null for a path outside the feature', () => {
    expect(editableItemKind('sections.0.cards.0.text')).toBe(null)
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

  // The return value drives a FOLLOW-UP RENDER in applySavedPageState()
  // (js/ux-improvements-state-sync.js): true means "the DOM the reviewer is
  // looking at is now stale". It used to mean "setByPath resolved a path",
  // which is true on every call for any page that has ever had a section
  // edit saved — so the render fired unconditionally, and a render replaces
  // #mockPage wholesale.
  //
  // That difference is a real bug, not a tidiness point: the render removes
  // whatever element has focus, an open inline editor's focusout fires as a
  // result, and EditorSession.commit() runs against a detached editor and
  // loses the reviewer's in-flight text (issue #118). The render is only
  // ever needed when a value actually CHANGED.
  test('reports false when every saved edit already matches the live page', () => {
    const page = freshPage()
    const edits = { section_edits: { 'sections.0.heading': 'Original Heading' } }
    expect(applyContentEditsToPageData(page, edits)).toBe(false)
  })

  test('reports false on a second identical reapply, having reported true on the first', () => {
    const page = freshPage()
    const edits = { section_edits: { 'sections.0.heading': 'Edited' } }
    expect(applyContentEditsToPageData(page, edits)).toBe(true)
    expect(applyContentEditsToPageData(page, edits)).toBe(false)
  })

  test('reports true when only one of several entries differs', () => {
    const page = freshPage()
    expect(
      applyContentEditsToPageData(page, {
        section_edits: {
          'sections.0.heading': 'Original Heading', // unchanged
          'sections.1.heading': 'Changed', // differs
        },
      })
    ).toBe(true)
  })

  test('compares array values by content, not by identity', () => {
    // A saved paragraphs/bullets array is a fresh object every read, so an
    // identity comparison would report a change on every single call and
    // defeat the whole point.
    const page = freshPage()
    expect(
      applyContentEditsToPageData(page, { section_edits: { 'sections.0.paragraphs': ['p1'] } })
    ).toBe(false)
    expect(
      applyContentEditsToPageData(page, {
        section_edits: { 'sections.0.paragraphs': ['p1', 'p2'] },
      })
    ).toBe(true)
  })

  test('compares the tagged item-object form by content too', () => {
    const page = freshPage()
    const tagged = [{ text: 'p1', unverified: true, unverifiedReason: 'Manually edited' }]
    expect(
      applyContentEditsToPageData(page, { section_edits: { 'sections.0.paragraphs': tagged } })
    ).toBe(true)
    expect(
      applyContentEditsToPageData(page, { section_edits: { 'sections.0.paragraphs': tagged } })
    ).toBe(false)
  })

  test('still WRITES an unchanged value, it just does not report it', () => {
    // The write has to stay unconditional: reporting is about whether a
    // repaint is needed, not about whether to apply the saved state.
    const page = freshPage()
    applyContentEditsToPageData(page, {
      section_edits: { 'sections.0.heading': 'Original Heading' },
    })
    expect(page.sections[0].heading).toBe('Original Heading')
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

// The containers beyond heading/paragraphs/bullets. Steps are the case that
// motivated this: js/page-render.js has stamped
// data-rewrite-field="sections.N.steps.M.text.K" since the AI-rewrite work,
// so the editor opened on a step paragraph and accepted the edit — and
// computeSectionEdits never recorded it, so it was gone on the next load
// with nothing erroring. Verified live against the payFee page before the
// fix: the edited text rendered, section_edits stayed {}, and a reload
// showed the original copy again.
describe('computeSectionEdits over the full editable surface', () => {
  const original = {
    sections: [
      {
        heading: 'Steps',
        steps: [
          { title: 'Step one', text: ['do this'], bullets: ['a'], callout: { text: 'note' } },
        ],
        callout: { title: 'Heads up', text: 'section callout' },
        table: [
          ['Head A', 'Head B'],
          ['cell 1', 'cell 2'],
        ],
      },
    ],
    whatToKnow: { cost: '$25', items: ['bring ID'] },
    spotlight: { title: 'Spotlight', paragraphs: ['first'] },
    contact: { address: '1 Main St', hours: '9-5', phone: ['415-555-0100'] },
  }
  const clone = () => JSON.parse(JSON.stringify(original))

  test('records an edited step title, text item, and bullet as whole fields', () => {
    const page = clone()
    page.sections[0].steps[0].title = 'Step one, edited'
    page.sections[0].steps[0].text = [
      {
        text: 'do this instead',
        unverified: true,
        unverifiedReason: 'Manually edited during review',
      },
    ]
    page.sections[0].steps[0].bullets = ['a', 'b']
    expect(computeSectionEdits(page, original)).toEqual({
      'sections.0.steps.0.title': 'Step one, edited',
      'sections.0.steps.0.text': [
        {
          text: 'do this instead',
          unverified: true,
          unverifiedReason: 'Manually edited during review',
        },
      ],
      'sections.0.steps.0.bullets': ['a', 'b'],
    })
  })

  test('records an edited callout on a section and on a step', () => {
    const page = clone()
    page.sections[0].callout.text = 'section callout, edited'
    page.sections[0].callout.title = 'Heads up, edited'
    page.sections[0].steps[0].callout.text = 'step note, edited'
    expect(computeSectionEdits(page, original)).toEqual({
      'sections.0.callout.title': 'Heads up, edited',
      'sections.0.callout.text': 'section callout, edited',
      'sections.0.steps.0.callout.text': 'step note, edited',
    })
  })

  test('records an edited table cell as the whole table', () => {
    // Same rule as bullets: a per-cell key would go stale the moment a row
    // is added or removed, so the container is what gets stored.
    const page = clone()
    page.sections[0].table[1][0] = 'cell 1, edited'
    expect(computeSectionEdits(page, original)).toEqual({
      'sections.0.table': [
        ['Head A', 'Head B'],
        ['cell 1, edited', 'cell 2'],
      ],
    })
  })

  test('records edited page-level whatToKnow, spotlight, and contact fields', () => {
    const page = clone()
    page.whatToKnow.cost = '$30'
    page.whatToKnow.items = ['bring ID', 'bring the notice']
    page.spotlight.title = 'Spotlight, edited'
    page.spotlight.paragraphs = ['first, edited']
    page.contact.address = '2 Main St'
    page.contact.phone = ['415-555-0199']
    expect(computeSectionEdits(page, original)).toEqual({
      'whatToKnow.cost': '$30',
      'whatToKnow.items': ['bring ID', 'bring the notice'],
      'spotlight.title': 'Spotlight, edited',
      'spotlight.paragraphs': ['first, edited'],
      'contact.address': '2 Main St',
      'contact.phone': ['415-555-0199'],
    })
  })

  test('reports nothing for a page whose new fields all match the original', () => {
    expect(computeSectionEdits(clone(), original)).toEqual({})
  })

  test('round-trips every new container through apply and back', () => {
    const page = clone()
    const savedEdits = {
      'sections.0.steps.0.title': 'Edited step',
      'sections.0.steps.0.text': ['edited step text'],
      'sections.0.callout.text': 'edited callout',
      'sections.0.table': [
        ['Head A', 'Head B'],
        ['edited', 'cell 2'],
      ],
      'whatToKnow.cost': '$40',
      'spotlight.paragraphs': ['edited spotlight'],
      'contact.email': ['hhvc@example.gov'],
    }
    expect(applyContentEditsToPageData(page, { section_edits: savedEdits })).toBe(true)
    // contact.email is absent from the original, so the reapply added it —
    // computeSectionEdits reports it back the same way it reports any other
    // divergence from ORIGINAL_DATA.
    expect(computeSectionEdits(page, original)).toEqual(savedEdits)
  })

  test('rejects a value whose shape does not match its container kind', () => {
    const page = clone()
    applyContentEditsToPageData(page, {
      section_edits: {
        'sections.0.steps.0.title': ['not a string'],
        'sections.0.table': ['not a row array'],
        'contact.phone': [{ text: 'tagged objects are not valid here' }],
      },
    })
    expect(page.sections[0].steps[0].title).toBe('Step one')
    expect(page.sections[0].table[1]).toEqual(['cell 1', 'cell 2'])
    expect(page.contact.phone).toEqual(['415-555-0100'])
  })

  test('skips a card path even when its value shape is valid', () => {
    const page = clone()
    page.sections[0].cards = [{ title: 'Card', text: 'authored', target: 'other' }]
    applyContentEditsToPageData(page, {
      section_edits: { 'sections.0.cards.0.text': 'edited card text' },
    })
    expect(page.sections[0].cards[0].text).toBe('authored')
  })
})
