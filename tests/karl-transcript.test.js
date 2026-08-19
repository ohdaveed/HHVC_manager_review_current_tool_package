/*
 * The Karl transcript builder, over hand-built pages.
 *
 * Deliberately NOT driven from the real corpus. This suite asserts what an
 * editor is told to type, and driving it from pages/*.js would mean a
 * legitimately added page fails the suite while proving nothing about the
 * rules. tests/card-inheritance.test.js is built the same way and for the same
 * reason; the real corpus is covered by the coverage ratchet in
 * tests/data-validation.test.js instead, which is a different question.
 */
const { describe, test, expect } = require('bun:test')
const {
  buildTranscript,
  renderTranscriptMarkdown,
  resolveValue,
  foldTextAndBullets,
  extractInlineLinks,
} = require('../js/karl/karl-transcript.js')

/** A minimal page carrying only what the test under it needs. */
function page(overrides) {
  return {
    slug: 'apply-for-a-thing',
    type: 'Transaction',
    title: 'Apply for a thing',
    summary: 'How to apply.',
    audience: ['Tenants'],
    reading: 'Grade 6',
    sections: [],
    ...overrides,
  }
}

/** A corpus with one destination page, for resolving choices and links. */
const PAGES = {
  target: {
    slug: 'target-page',
    type: 'Information',
    title: 'Target page',
    summary: 'Target summary.',
  },
}

/** The entry for one raw Karl field name, or undefined. */
function entryFor(transcript, rawName) {
  return transcript.entries.find((entry) => entry.rawName === rawName)
}

describe('resolveValue — overlay precedence', () => {
  test('a section_edits entry beats the authored value', () => {
    const built = page({ sections: [{ heading: 'Old', karl: 'Custom section.' }] })
    const record = { section_edits: { 'sections.0.heading': 'New' } }
    expect(resolveValue(built, record, 'sections.0.heading')).toEqual({
      value: 'New',
      overlaid: true,
    })
  })

  test('edited_title beats the authored title', () => {
    expect(resolveValue(page({}), { edited_title: 'Reviewed title' }, 'title')).toEqual({
      value: 'Reviewed title',
      overlaid: true,
    })
  })

  test('edited_summary beats the authored summary', () => {
    expect(resolveValue(page({}), { edited_summary: 'Reviewed summary.' }, 'summary')).toEqual({
      value: 'Reviewed summary.',
      overlaid: true,
    })
  })

  test('falls back to the authored value with no record at all', () => {
    expect(resolveValue(page({}), null, 'title')).toEqual({
      value: 'Apply for a thing',
      overlaid: false,
    })
  })

  test('a path that does not resolve returns undefined rather than throwing', () => {
    expect(() => resolveValue(page({}), null, 'sections.9.steps.4.title')).not.toThrow()
    expect(resolveValue(page({}), null, 'sections.9.steps.4.title').value).toBeUndefined()
  })

  test('an empty-string edit is honoured, not treated as absent', () => {
    // A reviewer clearing a field is a decision. hasOwnProperty, not
    // truthiness, is what separates "cleared" from "never edited" — falling
    // back on falsiness would resurrect the copy they deleted.
    const built = page({ sections: [{ heading: 'Old', karl: 'Custom section.' }] })
    const record = { section_edits: { 'sections.0.heading': '' } }
    expect(resolveValue(built, record, 'sections.0.heading')).toEqual({ value: '', overlaid: true })
  })
})

describe('foldTextAndBullets', () => {
  test('bullets fold into the same rich text value as the paragraphs', () => {
    expect(foldTextAndBullets(['Intro line.'], ['One', 'Two'])).toBe('Intro line.\n\n- One\n- Two')
  })

  test('tagged unverified items contribute their text and nothing else', () => {
    expect(foldTextAndBullets([{ text: 'Claim.', unverified: true }], [])).toBe('Claim.')
  })

  test('an absent bullets array is not an empty bullet', () => {
    expect(foldTextAndBullets(['Only prose.'], undefined)).toBe('Only prose.')
  })

  test('bullets alone still fold into one value', () => {
    expect(foldTextAndBullets(undefined, ['One'])).toBe('- One')
  })
})

describe('extractInlineLinks', () => {
  test('an internal page key reports the chooser representation', () => {
    expect(extractInlineLinks('See [the target](target).', PAGES)).toEqual([
      {
        label: 'the target',
        target: 'target',
        representation: 'shape 5 — rich text Link tool → Internal link → "Target page"',
      },
    ])
  })

  test('an http URL reports the external representation', () => {
    expect(extractInlineLinks('See [SF](https://sf.gov).', PAGES)).toEqual([
      {
        label: 'SF',
        target: 'https://sf.gov',
        representation: 'shape 5 — rich text Link tool → External link',
      },
    ])
  })

  test('the inert # sentinel reports as a link with no destination', () => {
    expect(extractInlineLinks('See [nothing](#).', PAGES)[0].representation).toContain(
      'no destination'
    )
  })

  test('text with no links yields none, and a nullish value does not throw', () => {
    expect(extractInlineLinks('Plain prose.', PAGES)).toEqual([])
    expect(extractInlineLinks(undefined, PAGES)).toEqual([])
  })
})

describe('buildTranscript — the four outcomes', () => {
  test('an authored value is TYPE', () => {
    const title = entryFor(buildTranscript(page({}), null, PAGES), 'title')
    expect(title.outcome).toBe('TYPE')
    expect(title.fields).toEqual([{ label: 'Page title', value: 'Apply for a thing' }])
  })

  test('a title-only card is CHOOSE and emits NO description', () => {
    // The defect js/core/card-inheritance.js exists to prevent, here as an
    // instruction a human would execute. A Related entry publishes a title and
    // a link and nothing else, so a description typed here cannot appear.
    const built = page({
      sections: [
        {
          heading: 'Related',
          karl: 'Maps to the Related field (a generic unrestricted "Page" chooser).',
          cards: [
            { title: 'Ignored label', text: 'Copy that can never publish.', target: 'target' },
          ],
        },
      ],
    })
    const related = entryFor(buildTranscript(built, null, PAGES), 'related')
    expect(related.outcome).toBe('CHOOSE')
    expect(related.choices).toEqual([
      { label: 'Target page', pageKey: 'target', slug: 'target-page' },
    ])
    expect(JSON.stringify(related)).not.toContain('Copy that can never publish.')
  })

  test('an inheriting subsection is CHOOSE, and says the destination supplies the summary', () => {
    const built = page({
      type: 'Agency',
      sections: [
        {
          heading: 'Services',
          component: 'services',
          karl: 'Maps to an Agency services subsection (page chooser).',
          cards: [{ title: 'Anything', target: 'target' }],
        },
      ],
    })
    const services = entryFor(buildTranscript(built, null, PAGES), 'services')
    expect(services.outcome).toBe('CHOOSE')
    expect(services.notes.join(' ')).toContain('destination page’s title AND its summary')
  })

  test('an external-URL entry inside an inheriting subsection keeps its own description', () => {
    // Settled by the 332-page departments--* census: there is no destination
    // page to inherit from, so the description is authored on the entry.
    const built = page({
      type: 'Agency',
      sections: [
        {
          heading: 'Resources',
          component: 'resources',
          karl: 'Maps to an Agency resources subsection (page chooser).',
          cards: [{ title: 'State portal', url: 'https://ca.gov', text: 'Report a dead bird.' }],
        },
      ],
    })
    const resources = entryFor(buildTranscript(built, null, PAGES), 'resources')
    expect(resources.fields).toContainEqual({
      label: 'External link 1 — Description',
      value: 'Report a dead bird.',
    })
  })

  test('an external entry in a title-only block reports its description as dead', () => {
    // The opposite case, and it needs its own evidence: that component renders
    // no description for ANY entry, which is a fact about the component rather
    // than about the destination.
    const built = page({
      sections: [
        {
          heading: 'Related',
          karl: 'Maps to the Related field (page chooser).',
          cards: [{ title: 'State portal', url: 'https://ca.gov', text: 'Dead text.' }],
        },
      ],
    })
    const transcript = buildTranscript(built, null, PAGES)
    expect(transcript.flags.some((flag) => flag.path === 'sections.0.cards.0.text')).toBe(true)
  })

  test('a section-level button outside a step is UNMAPPED', () => {
    const built = page({
      sections: [
        {
          heading: 'Look it up',
          karl: 'Custom section.',
          paragraphs: ['Prose.'],
          button: 'Search records',
          buttonUrl: 'https://sf.gov/search',
        },
      ],
    })
    const transcript = buildTranscript(built, null, PAGES)
    const shapes = transcript.unmapped.map((finding) => finding.shape)
    expect(shapes).toContain('section-button-outside-step')
    expect(
      transcript.unmapped.find((finding) => finding.path === 'sections.0.button').reason
    ).toContain('U1')
  })

  test('a callout title is FLAG, never folded silently', () => {
    // Folding it into the rich text as a bolded lead-in is a content
    // judgement, and this tool does not make those.
    const built = page({
      sections: [
        {
          heading: 'Note',
          karl: 'Custom section.',
          paragraphs: ['Prose.'],
          callout: { text: 'Body of the callout.', title: 'Heads up' },
        },
      ],
    })
    const transcript = buildTranscript(built, null, PAGES)
    const flag = transcript.flags.find((entry) => entry.path === 'sections.0.callout.title')
    expect(flag).toBeDefined()
    expect(flag.reason).toContain('U2')
    // The callout's TEXT still gets typed — only its title has no home.
    const custom = entryFor(transcript, 'custom_section')
    expect(custom.fields).toContainEqual({
      label: 'Callout (rich text, no title field)',
      value: 'Body of the callout.',
    })
  })

  test('callout.title: false is absence, not a title', () => {
    // build_scripts/schema.js allows the literal `false` to suppress a title,
    // and a truthiness check that treated it as present would raise a flag on
    // a page that deliberately has none.
    const built = page({
      sections: [
        {
          heading: 'Note',
          karl: 'Custom section.',
          paragraphs: ['Prose.'],
          callout: { text: 'Body.', title: false },
        },
      ],
    })
    expect(buildTranscript(built, null, PAGES).flags).toEqual([])
  })
})

describe('buildTranscript — the cost cap', () => {
  test('a cost description over 120 characters is FLAG, carrying the measured length', () => {
    const long = 'x'.repeat(121)
    const cost = entryFor(
      buildTranscript(page({ whatToKnow: { cost: long } }), null, PAGES),
      'cost'
    )
    expect(cost.outcome).toBe('FLAG')
    expect(cost.notes.join(' ')).toContain('121 characters')
    expect(cost.notes.join(' ')).toContain('120')
  })

  test('a cost description at the cap is not flagged', () => {
    const exact = 'x'.repeat(120)
    expect(
      entryFor(buildTranscript(page({ whatToKnow: { cost: exact } }), null, PAGES), 'cost').outcome
    ).toBe('TYPE')
  })

  test('the cap measures the OVERLAID value, not the original', () => {
    // A reviewer can push a short authored value over the cap and pull a long
    // one under it. Measuring the original reports the wrong page both ways.
    const overLong = { section_edits: { 'whatToKnow.cost': 'y'.repeat(200) } }
    expect(
      entryFor(buildTranscript(page({ whatToKnow: { cost: 'Free.' } }), overLong, PAGES), 'cost')
        .outcome
    ).toBe('FLAG')

    const trimmed = { section_edits: { 'whatToKnow.cost': 'Free.' } }
    expect(
      entryFor(
        buildTranscript(page({ whatToKnow: { cost: 'z'.repeat(200) } }), trimmed, PAGES),
        'cost'
      ).outcome
    ).toBe('TYPE')
  })
})

describe('buildTranscript — steps and bullets', () => {
  test('a step becomes one Section block whose specifics hold Text, Button link and Callout', () => {
    const built = page({
      sections: [
        {
          heading: 'What to do',
          karl: 'Maps to what_to_do.',
          steps: [
            {
              title: 'Do the thing',
              text: ['Bring ID.'],
              bullets: ['Proof of address'],
              button: 'Start now',
              buttonTarget: 'target',
              callout: { text: 'Your report is confidential.' },
            },
          ],
        },
      ],
    })
    const entry = entryFor(buildTranscript(built, null, PAGES), 'what_to_do')
    expect(entry.fields).toContainEqual({
      label: 'Section 1 — Section title',
      value: 'Do the thing',
    })
    // Bullets fold INTO the Text block's rich text rather than becoming a
    // block of their own — telling an editor otherwise sends them looking for
    // a block that does not exist.
    expect(entry.fields).toContainEqual({
      label: 'Section 1 — Section specifics → Text',
      value: 'Bring ID.\n\n- Proof of address',
    })
    expect(entry.fields).toContainEqual({
      label: 'Section 1 — Button link → destination',
      value: 'SF.gov page → "Target page"',
    })
    expect(entry.fields).toContainEqual({
      label: 'Callout (rich text, no title field)',
      value: 'Your report is confidential.',
    })
  })

  test('an inline link inside step text surfaces separately with its representation', () => {
    // Karl's internal link is a CHOOSER, not text, so pasting the markdown
    // leaves a dead literal on the published page.
    const built = page({
      sections: [
        {
          heading: 'What to do',
          karl: 'Maps to what_to_do.',
          steps: [{ title: 'Read', text: ['See [the target](target) first.'] }],
        },
      ],
    })
    const entry = entryFor(buildTranscript(built, null, PAGES), 'what_to_do')
    expect(entry.links).toEqual([
      {
        label: 'the target',
        target: 'target',
        representation: 'shape 5 — rich text Link tool → Internal link → "Target page"',
      },
    ])
  })
})

describe('buildTranscript — review decision', () => {
  test('a page with no review record is marked, not silently exported', () => {
    const transcript = buildTranscript(page({}), null, PAGES)
    expect(transcript.reviewed).toBe(false)
    expect(transcript.approved).toBe(false)
    expect(renderTranscriptMarkdown(transcript)).toContain('no review recorded')
  })

  test('a not-Approved page is marked throughout, not only in the header', () => {
    // Approval is per page and not per field, so every panel carries the
    // caveat rather than the header carrying it alone.
    const markdown = renderTranscriptMarkdown(
      buildTranscript(page({}), { decision: 'Revise and resubmit' }, PAGES)
    )
    expect(markdown).toContain('Revise and resubmit')
    expect(markdown).toContain('NOT APPROVED')
    const headings = markdown.match(/^### .*$/gm) || []
    expect(headings.length).toBeGreaterThan(0)
    for (const heading of headings) expect(heading).toContain('page not approved')
  })

  test('an Approved page carries no caveat', () => {
    const markdown = renderTranscriptMarkdown(
      buildTranscript(page({}), { decision: 'Approved' }, PAGES)
    )
    expect(markdown).not.toContain('NOT APPROVED')
    expect(markdown).not.toContain('page not approved')
  })

  test('"Approved with edits" is an approval, not a rejection', () => {
    // Both labels exist in DECISIONS and the queue counts them together under
    // Approved. An exact match on the first label headed a fully signed-off
    // page "NOT APPROVED — do not publish" and repeated it on every panel —
    // and the edits that outcome names are already applied by resolveValue().
    const transcript = buildTranscript(page({}), { decision: 'Approved with edits' }, PAGES)
    expect(transcript.approved).toBe(true)
    const markdown = renderTranscriptMarkdown(transcript)
    expect(markdown).not.toContain('NOT APPROVED')
    expect(markdown).not.toContain('page not approved')
  })
})

describe('buildTranscript — the edited slug', () => {
  test('a reviewer-edited slug overlays the authored one', () => {
    // `#urlInput` persists to `record.url_slug` and never mutates `page.slug`,
    // so reading the page value reported the superseded URL. Slug is required
    // on the Promote tab of every Karl type, which makes this an instruction
    // to publish at the wrong address rather than a stale display.
    const transcript = buildTranscript(
      page({}),
      { decision: 'Approved', url_slug: 'sf.gov/apply-for-the-renamed-thing' },
      PAGES
    )
    expect(transcript.slug).toBe('sf.gov/apply-for-the-renamed-thing')
    expect(renderTranscriptMarkdown(transcript)).toContain('sf.gov/apply-for-the-renamed-thing')
  })

  test('an absent or empty url_slug leaves the authored slug alone', () => {
    // The overlay is opt-in on a truthy value: a record that has never touched
    // the URL field carries `url_slug: ''` from buildReviewRecord(), and
    // treating that as an edit would publish every reviewed page at no slug
    // at all.
    expect(buildTranscript(page({}), { decision: 'Approved' }, PAGES).slug).toBe(
      'apply-for-a-thing'
    )
    expect(buildTranscript(page({}), { decision: 'Approved', url_slug: '' }, PAGES).slug).toBe(
      'apply-for-a-thing'
    )
  })
})

describe('buildTranscript — inferred mappings and unknown classification', () => {
  test('a plain Transaction body section reaches custom_section, marked inferred', () => {
    const built = page({
      sections: [{ heading: 'What you need', karl: 'Custom section.', paragraphs: ['Bring ID.'] }],
    })
    const entry = entryFor(buildTranscript(built, null, PAGES), 'custom_section')
    expect(entry.outcome).toBe('TYPE')
    expect(entry.inferred).toBe(true)
    expect(entry.notes.join(' ')).toContain('Inferred mapping')
    expect(entry.fields).toContainEqual({ label: 'Text', value: 'Bring ID.' })
  })

  test('a card section the classifier cannot place is FLAG, never a guessed TYPE', () => {
    // classifySection returns 'unknown' for most karl notes. Guessing TYPE
    // reintroduces the defect js/core/card-inheritance.js prevents; guessing CHOOSE
    // silently drops authored copy. Neither is a thing to hand a human.
    const built = page({
      sections: [
        {
          heading: 'Mystery',
          component: 'supporting',
          karl: 'Maps to supporting_information (Accordions).',
          cards: [{ title: 'A card', text: 'Some words.' }],
        },
      ],
    })
    const transcript = buildTranscript(built, null, PAGES)
    const flag = transcript.flags.find((entry) => entry.path === 'sections.0.cards')
    expect(flag).toBeDefined()
    expect(flag.reason).toContain('unknown')
  })

  test('an unknown content type fails by name rather than producing an empty file', () => {
    const transcript = buildTranscript(page({ type: 'Nonexistent' }), null, PAGES)
    expect(transcript.entries).toHaveLength(1)
    expect(transcript.entries[0].outcome).toBe('UNMAPPED')
    expect(transcript.entries[0].notes.join(' ')).toContain('No Karl panel inventory')
  })
})

describe('buildTranscript — two sources on one panel', () => {
  test('a section matching both of a panel\u2019s sources is emitted once', () => {
    // Information's `related` matches both `component: 'related'` and any
    // `title-only` card section, and a Related panel is usually both. Emitting
    // per source told an editor to add the same page references twice.
    const built = page({
      type: 'Information',
      sections: [
        {
          heading: 'Related',
          component: 'related',
          karl: 'Maps to the Related field (a generic unrestricted "Page" chooser).',
          cards: [{ title: 'Ignored', target: 'target' }],
        },
      ],
    })
    const related = buildTranscript(built, null, PAGES).entries.filter(
      (entry) => entry.rawName === 'related'
    )
    expect(related).toHaveLength(1)
    expect(related[0].choices).toHaveLength(1)
  })

  test('a scoped source takes only its half of the section', () => {
    // A Resource Collection section carrying both paragraphs and cards maps to
    // TWO panels. Without the scope, `introductory_text` — a Title-and-text
    // block with no chooser at all — also emitted the cards, so the transcript
    // told an editor to pick pages in a panel that has no page chooser.
    const built = page({
      type: 'Resource Collection',
      sections: [
        {
          heading: 'If you rent',
          karl: 'Maps to Body → Resources → one Resource section (page chooser).',
          paragraphs: ['Use these resources.'],
          cards: [{ title: 'Ignored', target: 'target' }],
        },
      ],
    })
    const transcript = buildTranscript(built, null, PAGES)
    const intro = entryFor(transcript, 'introductory_text')
    const body = entryFor(transcript, 'body')

    expect(intro.outcome).toBe('TYPE')
    expect(intro.choices).toEqual([])
    expect(intro.fields).toContainEqual({ label: 'Text', value: 'Use these resources.' })

    expect(body.outcome).toBe('CHOOSE')
    expect(body.choices).toHaveLength(1)
    // The prose belongs to the panel above; printing it twice would read as
    // two different fields wanting the same words.
    expect(body.fields.map((field) => field.label)).not.toContain('Text')
  })
})

describe('buildTranscript — coverage sweep', () => {
  test('a table on a non-Report type is unmapped, since only Report has tables', () => {
    const built = page({
      sections: [{ heading: 'Fees', karl: 'Custom section.', table: [['A', 'B']] }],
    })
    const finding = buildTranscript(built, null, PAGES).unmapped.find(
      (entry) => entry.path === 'sections.0.table'
    )
    expect(finding).toBeDefined()
    expect(finding.reason).toContain('only Karl content type with a Table block')
  })

  test('a heading rides along with its section rather than being counted twice', () => {
    // The finding is the section. Reporting its title separately doubles the
    // count without naming anything new.
    const built = page({
      type: 'Information',
      sections: [
        { heading: 'Steps', karl: 'Step block.', steps: [{ title: 'One', text: ['Do it.'] }] },
      ],
    })
    const paths = buildTranscript(built, null, PAGES).unmapped.map((entry) => entry.path)
    expect(paths).toEqual(['sections.0.steps'])
  })

  test('fields the field map lists as never migrated are not reported', () => {
    const built = page({ editorNote: 'QA guidance', audience: ['Tenants'], reading: 'Grade 6' })
    const paths = buildTranscript(built, null, PAGES).unmapped.map((entry) => entry.path)
    expect(paths).not.toContain('editorNote')
    expect(paths).not.toContain('audience')
    expect(paths).not.toContain('reading')
  })
})

describe('renderTranscriptMarkdown', () => {
  test('heads the file with the page title, the Karl path and the decision', () => {
    const markdown = renderTranscriptMarkdown(
      buildTranscript(page({}), { decision: 'Approved' }, PAGES)
    )
    expect(markdown.split('\n')[0]).toBe('# Apply for a thing — Karl transcript')
    expect(markdown).toContain('New: Transaction → Content')
    expect(markdown).toContain('**Decision:** Approved')
  })

  test('emits panels in the form’s own order', () => {
    const markdown = renderTranscriptMarkdown(buildTranscript(page({}), null, PAGES))
    expect(markdown.indexOf('`title`')).toBeLessThan(markdown.indexOf('`description`'))
    expect(markdown.indexOf('`description`')).toBeLessThan(markdown.indexOf('`primary_agency`'))
  })

  test('states plainly that copying publishes nothing', () => {
    const markdown = renderTranscriptMarkdown(buildTranscript(page({}), null, PAGES))
    expect(markdown).toContain('nothing here has been written to Karl')
  })

  test('the Promote tab carries the slug, which is required and lives there', () => {
    const markdown = renderTranscriptMarkdown(buildTranscript(page({}), null, PAGES))
    expect(markdown).toContain('Slug (`slug`)')
    expect(markdown).toContain('apply-for-a-thing')
  })
})
