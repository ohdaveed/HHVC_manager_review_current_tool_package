// Pure serialization boundary between stored plain-string/{text,...} page
// values and @editorjs/editorjs's block-JSON OutputData. No DOM, no live
// Editor.js instance — dual-exported like js/editing/inline-content-edit-data.js so
// this file is importable directly under Bun. The fixed-point round-trip
// test at the bottom is Phase 1's highest-value coverage per the approved
// integration plan: a non-idempotent adapter would silently corrupt content
// on a no-op open/close, flowing straight into section_edits/localStorage/
// CSV with no schema violation to catch it.
const { describe, test, expect } = require('bun:test')
const { loadPageData } = require('../build_scripts/load-pages')
const {
  pageValueToEditorData,
  editorDataToPageValue,
  markdownToEditingHtml,
  editingHtmlToMarkdown,
  plainTextToEditingHtml,
  editingHtmlToPlainText,
  FIELD_TYPES,
  SCALAR_FIELD_TYPES,
  ITEM_FIELD_TYPES,
  isItemFieldType,
  isMarkdownFieldType,
} = require('../js/editing/inline-content-edit-adapter.js')

describe('FIELD_TYPES', () => {
  test('splits into exactly the five scalar and two item field kinds', () => {
    expect(SCALAR_FIELD_TYPES).toEqual([
      'title',
      'summary',
      'primaryCta',
      'heading',
      'markdownText',
    ])
    expect(ITEM_FIELD_TYPES).toEqual(['paragraph', 'bullet'])
    expect(FIELD_TYPES).toEqual([...SCALAR_FIELD_TYPES, ...ITEM_FIELD_TYPES])
  })

  // markdownText is the field type that crosses the two groups: it is scalar
  // (it commits a plain string, so a callout body and a table cell stay the
  // bare strings their renderers escape and print) while carrying markdown
  // (so the [label](target) links in them survive a round trip instead of
  // being flattened into literal text on the first edit).
  test('markdownText is scalar for committing but markdown-bearing for editing', () => {
    expect(isItemFieldType('markdownText')).toBe(false)
    expect(isMarkdownFieldType('markdownText')).toBe(true)
    expect(isMarkdownFieldType('paragraph')).toBe(true)
    expect(isMarkdownFieldType('heading')).toBe(false)
  })

  test('a markdownText round trip preserves an inline link and returns a plain string', () => {
    const value = 'Read the [tenant guide](tenantGuide) first.'
    const roundTripped = editorDataToPageValue(
      'markdownText',
      pageValueToEditorData('markdownText', value)
    )
    expect(roundTripped).toBe(value)
  })

  test('the same value edited as a heading would lose the link markup', () => {
    // Why markdownText had to exist rather than reusing 'heading': the plain
    // -text pair escapes the markdown into literal characters, so committing
    // a callout body through it would store text the renderer can no longer
    // turn back into a link.
    const value = 'Read the [tenant guide](tenantGuide) first.'
    const asHeading = editorDataToPageValue('heading', pageValueToEditorData('heading', value))
    expect(asHeading).toBe(value)
    expect(pageValueToEditorData('heading', value).blocks[0].data.text).not.toContain('<a ')
    expect(pageValueToEditorData('markdownText', value).blocks[0].data.text).toContain('<a ')
  })
})

describe('markdownToEditingHtml', () => {
  test('returns plain text unchanged when it carries no markdown', () => {
    expect(markdownToEditingHtml('Just plain copy.')).toBe('Just plain copy.')
  })

  test('converts **bold** to a <b> tag', () => {
    expect(markdownToEditingHtml('Read **carefully** please.')).toBe(
      'Read <b>carefully</b> please.'
    )
  })

  test('converts an internal page-key link to a data-render-target anchor', () => {
    expect(markdownToEditingHtml('See [the pests page](pestsTopic).')).toBe(
      'See <a data-render-target="pestsTopic">the pests page</a>.'
    )
  })

  test('converts an external https:// link to a target=_blank anchor', () => {
    expect(markdownToEditingHtml('See [SF.gov](https://sf.gov/).')).toBe(
      'See <a href="https://sf.gov/" target="_blank" rel="noopener noreferrer">SF.gov</a>.'
    )
  })

  test('escapes HTML special characters before applying markdown', () => {
    expect(markdownToEditingHtml('Tenants & landlords <see> "notes".')).toBe(
      'Tenants &amp; landlords &lt;see&gt; &quot;notes&quot;.'
    )
  })

  test('escapes an apostrophe as &#39;', () => {
    expect(markdownToEditingHtml("Owner's responsibility")).toBe('Owner&#39;s responsibility')
  })

  test('bold wrapping a link survives as a nested tag, matching formatMarkdown order', () => {
    expect(markdownToEditingHtml('**[Report it](pestsTopic)**')).toBe(
      '<b><a data-render-target="pestsTopic">Report it</a></b>'
    )
  })

  test('a link whose label is bold survives as a nested tag', () => {
    expect(markdownToEditingHtml('[**Report it**](pestsTopic)')).toBe(
      '<a data-render-target="pestsTopic"><b>Report it</b></a>'
    )
  })

  test('a non-string input returns an empty string rather than throwing', () => {
    expect(markdownToEditingHtml(undefined)).toBe('')
    expect(markdownToEditingHtml(null)).toBe('')
    expect(markdownToEditingHtml(42)).toBe('')
  })

  test('an unbalanced ** or [ with no matching close passes through literally', () => {
    expect(markdownToEditingHtml('This has a stray ** marker.')).toBe('This has a stray ** marker.')
    expect(markdownToEditingHtml('This has a stray [ bracket.')).toBe('This has a stray [ bracket.')
  })
})

describe('editingHtmlToMarkdown', () => {
  test('is the exact inverse of markdownToEditingHtml for plain text', () => {
    expect(editingHtmlToMarkdown('Just plain copy.')).toBe('Just plain copy.')
  })

  test('converts a <b> tag back to **bold**', () => {
    expect(editingHtmlToMarkdown('Read <b>carefully</b> please.')).toBe(
      'Read **carefully** please.'
    )
  })

  test('also recognizes <strong> as bold, matching whichever tag a real Bold tool emits', () => {
    expect(editingHtmlToMarkdown('Read <strong>carefully</strong> please.')).toBe(
      'Read **carefully** please.'
    )
  })

  test('converts a data-render-target anchor back to an internal link', () => {
    expect(
      editingHtmlToMarkdown('See <a data-render-target="pestsTopic">the pests page</a>.')
    ).toBe('See [the pests page](pestsTopic).')
  })

  test('converts an external anchor back to an https:// link', () => {
    expect(
      editingHtmlToMarkdown(
        'See <a href="https://sf.gov/" target="_blank" rel="noopener noreferrer">SF.gov</a>.'
      )
    ).toBe('See [SF.gov](https://sf.gov/).')
  })

  test('unescapes HTML entities back to their literal characters', () => {
    expect(editingHtmlToMarkdown('Tenants &amp; landlords &lt;see&gt; &quot;notes&quot;.')).toBe(
      'Tenants & landlords <see> "notes".'
    )
  })

  test('strips an unrecognized tag while keeping its text content', () => {
    expect(editingHtmlToMarkdown('<div>Pasted <span>text</span></div>')).toBe('Pasted text')
  })

  test('a non-string input returns an empty string rather than throwing', () => {
    expect(editingHtmlToMarkdown(undefined)).toBe('')
    expect(editingHtmlToMarkdown(null)).toBe('')
  })
})

describe('plainTextToEditingHtml', () => {
  test('escapes HTML special characters and applies no markdown syntax', () => {
    expect(plainTextToEditingHtml('Tenants & landlords <see> "notes".')).toBe(
      'Tenants &amp; landlords &lt;see&gt; &quot;notes&quot;.'
    )
  })

  test('leaves ** and [label](target) syntax as literal characters, unlike markdownToEditingHtml', () => {
    // title/summary/primaryCta/heading render through a bare escapeHtml()
    // with no formatMarkdown() call (js/page-render.js:216,219,560,631), so
    // these four fields never interpret this syntax — a literal "**bold**"
    // authored in a title is meant to display as literal asterisks, not
    // become a <b> tag while editing.
    expect(plainTextToEditingHtml('**bold**')).toBe('**bold**')
    expect(plainTextToEditingHtml('[label](target)')).toBe('[label](target)')
  })

  test('a non-string input returns an empty string rather than throwing', () => {
    expect(plainTextToEditingHtml(undefined)).toBe('')
    expect(plainTextToEditingHtml(null)).toBe('')
  })
})

describe('editingHtmlToPlainText', () => {
  test('unescapes HTML entities back to their literal characters', () => {
    expect(editingHtmlToPlainText('Tenants &amp; landlords &lt;see&gt; &quot;notes&quot;.')).toBe(
      'Tenants & landlords <see> "notes".'
    )
  })

  test('strips a real <b>/<a> tag down to its text content, unlike editingHtmlToMarkdown', () => {
    // The renderer for these four fields has no formatMarkdown() call to
    // turn a <b>/<a> tag back into formatting, so keeping the tag's
    // boundary as literal "**"/"[...]()" would be just as wrong as keeping
    // the tag itself — both get discarded down to plain text.
    expect(editingHtmlToPlainText('<b>bold</b>')).toBe('bold')
    expect(editingHtmlToPlainText('<a data-render-target="pestsTopic">link</a>')).toBe('link')
  })

  test('a non-string input returns an empty string rather than throwing', () => {
    expect(editingHtmlToPlainText(undefined)).toBe('')
    expect(editingHtmlToPlainText(null)).toBe('')
  })
})

describe('pageValueToEditorData', () => {
  test('wraps a plain string as one paragraph block', () => {
    expect(pageValueToEditorData('title', 'Pests & Vectors')).toEqual({
      blocks: [{ type: 'paragraph', data: { text: 'Pests &amp; Vectors' } }],
    })
  })

  test('a scalar field type never converts ** or [label](target) into markup', () => {
    // See markdownToEditingHtml/plainTextToEditingHtml's comments: only
    // paragraph/bullet items get bold/link interpretation, since only those
    // are rendered through formatMarkdown().
    expect(pageValueToEditorData('title', '**Report it**')).toEqual({
      blocks: [{ type: 'paragraph', data: { text: '**Report it**' } }],
    })
  })

  test('an item field type DOES convert ** and [label](target) into markup', () => {
    expect(pageValueToEditorData('paragraph', '**Report it**')).toEqual({
      blocks: [{ type: 'paragraph', data: { text: '<b>Report it</b>' } }],
    })
  })

  test('a non-string value is treated as empty', () => {
    expect(pageValueToEditorData('title', undefined)).toEqual({
      blocks: [{ type: 'paragraph', data: { text: '' } }],
    })
  })
})

describe('editorDataToPageValue', () => {
  const outputFor = (text) => ({
    time: 1700000000000,
    blocks: [{ id: 'abc123', type: 'paragraph', data: { text } }],
    version: '2.30.0',
  })

  test('a scalar field type resolves to a plain string', () => {
    expect(editorDataToPageValue('title', outputFor('New title'))).toBe('New title')
  })

  test.each(SCALAR_FIELD_TYPES)(
    '%s is a scalar field type that returns a plain string',
    (fieldType) => {
      expect(typeof editorDataToPageValue(fieldType, outputFor('x'))).toBe('string')
    }
  )

  test.each(ITEM_FIELD_TYPES)(
    '%s is an item field type that wraps the result as an unverified tagged object',
    (fieldType) => {
      expect(editorDataToPageValue(fieldType, outputFor('New bullet text'))).toEqual({
        text: 'New bullet text',
        unverified: true,
        unverifiedReason: 'Manually edited during review',
      })
    }
  )

  test('a scalar field strips a real <b> tag to plain text rather than encoding **bold**', () => {
    // Defense-in-depth: the UI disables the inline toolbar for scalar
    // fields (js/editing/inline-content-edit.js's openEditorJsEditor), but a paste
    // can still introduce a <b> tag into the block HTML regardless of
    // toolbar availability. The renderer has no formatMarkdown() call for
    // these four fields, so the correct outcome is the same either way —
    // strip to plain text, never encode as markdown that will never render.
    expect(editorDataToPageValue('title', outputFor('<b>Report it</b>'))).toBe('Report it')
  })

  test('an item field type still encodes a real <b> tag as **bold** markdown', () => {
    expect(editorDataToPageValue('paragraph', outputFor('<b>Report it</b>'))).toEqual({
      text: '**Report it**',
      unverified: true,
      unverifiedReason: 'Manually edited during review',
    })
  })

  test('multiple paragraph blocks are joined rather than truncated to the first', () => {
    const output = {
      blocks: [
        { type: 'paragraph', data: { text: 'First.' } },
        { type: 'paragraph', data: { text: 'Second.' } },
      ],
    }
    expect(editorDataToPageValue('summary', output)).toBe('First.\n\nSecond.')
  })

  test('a non-paragraph block is dropped rather than throwing', () => {
    const output = {
      blocks: [
        { type: 'header', data: { text: 'Should be dropped', level: 2 } },
        { type: 'paragraph', data: { text: 'Kept.' } },
      ],
    }
    expect(editorDataToPageValue('summary', output)).toBe('Kept.')
  })

  test('missing or malformed blocks resolve to an empty string, never throwing', () => {
    expect(editorDataToPageValue('summary', {})).toBe('')
    expect(editorDataToPageValue('summary', undefined)).toBe('')
    expect(editorDataToPageValue('summary', { blocks: null })).toBe('')
  })
})

describe('fixed-point round trip: editorDataToPageValue(pageValueToEditorData(x)) === x', () => {
  const scalarCases = [
    'Just plain copy.',
    'Read **carefully** please.',
    'See [the pests page](pestsTopic).',
    'See [SF.gov](https://sf.gov/).',
    'Tenants & landlords <see> "notes".',
    "Owner's responsibility.",
    '**[Report it](pestsTopic)**',
    '[**Report it**](pestsTopic)',
    'AT&T is not a markdown entity.',
    '5 < 10 & 10 > 5.',
    'A stray ** with no close.',
    'A stray [ with no close.',
    '',
  ]

  test.each(scalarCases)('scalar field round-trips %j unchanged', (value) => {
    const roundTripped = editorDataToPageValue('title', pageValueToEditorData('title', value))
    expect(roundTripped).toBe(value)
  })

  test.each(scalarCases)('item field round-trips %j unchanged in its .text', (value) => {
    const roundTripped = editorDataToPageValue(
      'paragraph',
      pageValueToEditorData('paragraph', value)
    )
    expect(roundTripped.text).toBe(value)
    expect(roundTripped.unverified).toBe(true)
  })

  describe('against every string in the real page corpus', () => {
    const data = loadPageData()
    const pages = Object.values(data.pages)

    /**
     * Unwrap a paragraph/bullet item to its plain text, mirroring
     * readScalarValue's own unwrapping (js/editing/inline-content-edit.js:59-66) —
     * pageValueToEditorData's contract takes the plain string a caller has
     * already unwrapped, not the raw {text,...} object.
     * @param {string|{text: string}} item
     * @returns {string}
     */
    function itemText(item) {
      if (item && typeof item === 'object') return item.text || ''
      return typeof item === 'string' ? item : ''
    }

    /** @type {Array<[string, string, string]>} [pageKey, fieldLabel, value] */
    const cases = []
    pages.forEach((page) => {
      if (typeof page.title === 'string') cases.push([page.title, 'title', page.title])
      if (typeof page.summary === 'string') cases.push([page.summary, 'summary', page.summary])
      ;(page.sections || []).forEach((section, sectionIndex) => {
        if (typeof section.heading === 'string') {
          cases.push([section.heading, `sections.${sectionIndex}.heading`, section.heading])
        }
        ;(section.paragraphs || []).forEach((item, itemIndex) => {
          const text = itemText(item)
          cases.push([text, `sections.${sectionIndex}.paragraphs.${itemIndex}`, text])
        })
        ;(section.bullets || []).forEach((item, itemIndex) => {
          const text = itemText(item)
          cases.push([text, `sections.${sectionIndex}.bullets.${itemIndex}`, text])
        })
      })
    })

    test('the corpus sweep actually found a non-trivial number of strings', () => {
      // Guards against a silently-empty sweep (e.g. loadPageData() returning
      // no pages) reporting false confidence via zero executed cases below.
      expect(cases.length).toBeGreaterThan(100)
    })

    test.each(cases)('%2$s round-trips unchanged', (label, path, value) => {
      const roundTripped = editorDataToPageValue(
        'paragraph',
        pageValueToEditorData('paragraph', value)
      )
      expect(roundTripped.text).toBe(value)
    })
  })
})
