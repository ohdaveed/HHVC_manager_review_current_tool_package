/*
 * The drift guard for js/karl/karl-blocks.js.
 *
 * That file is transcribed by hand from a 930-line prose document that keeps
 * changing, and silent drift means an editor is told to type into a field that
 * no longer exists. Parsing the field map IN A TEST is correct even though
 * parsing it in the exporter was rejected: a test that goes red on drift is a
 * different thing from a runtime that silently loses the footnotes the tables
 * do not carry.
 *
 * The parser asserts a MINIMUM row count per type before asserting any row
 * contents. This repo has already been burned by a doc-parsing regex that
 * stopped matching and therefore stopped checking while every remaining
 * assertion passed — see tests/doc-counts.test.js's header for that history.
 * A parser that finds nothing must fail, not agree.
 */
const { describe, test, expect } = require('bun:test')
const fs = require('node:fs')
const path = require('node:path')
const {
  KARL_PANELS,
  KARL_NAV,
  KARL_FLAGS,
  PROMOTE_PANEL,
  UNRESOLVED,
  matchesSection,
  panelsFor,
} = require('../js/karl/karl-blocks.js')
const { PAGE_TYPES } = require('../build_scripts/schema.js')

const FIELD_MAP_PATH = path.resolve(__dirname, '..', 'docs', 'karl-export-field-map.md')
const FIELD_MAP = fs.readFileSync(FIELD_MAP_PATH, 'utf8')
const FIELD_MAP_LINES = FIELD_MAP.split('\n')

/** The heading each per-type panel table sits under. */
const TYPE_HEADINGS = {
  Transaction: '## Transaction — E1, full block detail',
  Information: '## Information — E1, full block detail',
  'Resource Collection': '## Resource Collection — E1, full block detail',
  Campaign: '## Campaign — E1, full block detail',
  Topic: '## Topic — E1, full block detail',
  Agency: '## Agency — E1, captured 2026-08-15',
  'About us': '## About us — E1, captured 2026-08-15',
  Report: '## Report — E1, captured 2026-08-15',
}

/**
 * Row counts measured 2026-08-16. The equality assertion below would catch a
 * DROPPED row, but only while the parser still finds rows at all — a parser
 * that matches nothing reports zero on both sides and passes. These are what
 * turn that into a failure.
 */
const MIN_ROWS = {
  Transaction: 17,
  Information: 8,
  'Resource Collection': 9,
  Campaign: 13,
  Topic: 6,
  Agency: 25,
  'About us': 4,
  Report: 7,
}

/**
 * Strip the markup the tables carry around labels, raw names and block lists:
 * the `↳` sub-row marker, backticks, bold `**`, the `\*` that marks a required
 * field, and the `\|` escape a block-chooser list uses to hold more than one
 * name in one cell. Comparing without this reports a difference in punctuation
 * as a difference in the mapping.
 * @param {string} cell
 * @returns {string}
 */
function normalize(cell) {
  return cell
    .replace(/↳/g, '')
    .replace(/\\\|/g, '|')
    .replace(/\\?\*/g, '')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * The first markdown table under a heading, as arrays of normalized cells with
 * the 1-based source line each row came from.
 *
 * Cells are split on UNESCAPED pipes only. Splitting on every `|` silently
 * shifts every column right of a block-chooser list — Transaction's "What to
 * Do" row carries `Callout \| Section` — so the Mockup source column would be
 * compared against the tail of the block list and every such row would report
 * a mismatch that is really a parser bug.
 * @param {string} heading
 * @returns {Array<{cells: string[], line: number}>}
 */
function tableUnder(heading) {
  const start = FIELD_MAP_LINES.indexOf(heading)
  if (start === -1) throw new Error(`field map heading not found: ${heading}`)
  const rows = []
  let inTable = false
  for (let index = start; index < FIELD_MAP_LINES.length; index += 1) {
    const line = FIELD_MAP_LINES[index]
    if (!line.trimStart().startsWith('|')) {
      if (inTable) break
      continue
    }
    inTable = true
    if (/^\s*\|[\s|:-]+\|\s*$/.test(line)) continue // the ---|--- separator
    const cells = line.split(/(?<!\\)\|/).slice(1, -1)
    rows.push({
      cells: cells.map(normalize),
      // The RAW first cell alongside the normalized ones, because normalize()
      // strips `↳` — the document's only marker for a panel nested under
      // another. The nesting assertion below needs it, and reading the file a
      // second way to get it is exactly the split-source-of-truth this test
      // exists to prevent.
      raw: cells[0] ?? '',
      line: index + 1,
    })
  }
  return rows.slice(1) // drop the header row
}

describe('karl-blocks inventory against docs/karl-export-field-map.md', () => {
  test('covers exactly the eight types the schema declares', () => {
    expect(Object.keys(KARL_PANELS).sort()).toEqual([...PAGE_TYPES].sort())
  })

  test.each(Object.keys(TYPE_HEADINGS))('%s: the parser still finds rows', (type) => {
    expect(tableUnder(TYPE_HEADINGS[type]).length).toBeGreaterThanOrEqual(MIN_ROWS[type])
  })

  test.each(Object.keys(TYPE_HEADINGS))('%s: every documented panel is transcribed', (type) => {
    const documented = tableUnder(TYPE_HEADINGS[type])
    const panels = panelsFor(type)
    expect(panels.length).toBe(documented.length)
    documented.forEach((row, index) => {
      const panel = panels[index]
      const [uiLabel, rawName, requiredDoc, repeatableDoc, blockTypesDoc, sourceDoc] = row.cells
      // Compared as one labelled object rather than six bare assertions, so a
      // failure names the type, the row and the column at once — a bare
      // `expect('title').toBe('description')` on row 12 of 25 says nothing
      // about which row moved.
      expect({ type, index, ...panelFacts(panel) }).toEqual({
        type,
        index,
        uiLabel,
        rawName,
        requiredDoc,
        repeatableDoc,
        blockTypesDoc,
        sourceDoc,
        order: index,
        docLine: row.line,
      })
    })
  })

  test.each(Object.keys(TYPE_HEADINGS))('%s: derived flags match their doc cells', (type) => {
    for (const panel of panelsFor(type)) {
      // `required` and `repeatable` are booleans the transcript branches on;
      // the *Doc strings are what the drift test above compares. Asserting the
      // derivation separately is what stops the two drifting apart in the one
      // direction the doc comparison cannot see.
      expect(panel.required).toBe(
        /\byes\b/i.test(panel.requiredDoc) || /\brequired\b/i.test(panel.requiredDoc)
      )
      expect(panel.repeatable).toBe(/repeatable/i.test(panel.repeatableDoc))
    }
  })

  test('every panel cites a real line of the field map', () => {
    for (const panels of Object.values(KARL_PANELS)) {
      for (const panel of panels) {
        expect(panel.docLine).toBeGreaterThan(0)
        expect(panel.docLine).toBeLessThanOrEqual(FIELD_MAP_LINES.length)
        // The cited line must actually be this panel's own row, not merely a
        // line that exists — an off-by-N citation sends a reader checking the
        // mapping to the wrong row, which is worse than no citation.
        // First raw name only: a handful of rows carry two or four names in
        // one cell (`alert + alert_agency_wide`, Agency's four archive fields),
        // and the separator differs per row.
        expect(FIELD_MAP_LINES[panel.docLine - 1]).toContain(panel.rawName.split(/[\s,+]/)[0])
      }
    }
  })

  test.each(Object.keys(TYPE_HEADINGS))('%s: nesting matches the document', (type) => {
    // `subPanelOf` is what breadcrumbFor() walks to build a path, so a panel
    // nested under the wrong parent — or not marked as nested at all — sends an
    // editor to a field that is not where the guide says it is. The document
    // marks nesting with a `↳` prefix and nothing else, and normalize() strips
    // it, so this reads the raw cell.
    //
    // It was hand-maintained and already wrong: Transaction's two sub-panels
    // carried the marker and Agency's three under About did not, so three rows
    // claimed to be top-level panels of the Agency form.
    const rows = tableUnder(TYPE_HEADINGS[type])
    const byRawName = new Map(KARL_PANELS[type].map((panel) => [panel.rawName, panel]))
    let lastTopLevel = null
    for (const row of rows) {
      const rawName = row.cells[1]
      const panel = byRawName.get(rawName)
      if (!panel) continue // covered by the transcription test above
      if (!row.raw.includes('↳')) {
        lastTopLevel = rawName
        expect(panel.subPanelOf, `${type} ${rawName} is top-level in the document`).toBeUndefined()
        continue
      }
      // A nested row belongs to the nearest preceding un-nested one, which is
      // how the document reads down the page.
      expect(panel.subPanelOf, `${type} ${rawName} is nested under ${lastTopLevel}`).toBe(
        lastTopLevel
      )
    }
  })

  test('the Promote tab is transcribed from its own table', () => {
    // The Promote tab is one table shared by all eight types, so it sits
    // outside KARL_PANELS and outside the per-type sweeps above — which means
    // nothing checked it at all until this test. It is not optional detail:
    // `slug` is required, and it is why a page cannot be saved from the
    // Content tab alone.
    const row = FIELD_MAP_LINES[PROMOTE_PANEL.docLine - 1]
    expect(row).toContain('slug')
    for (const field of PROMOTE_PANEL.fields) {
      const cited = FIELD_MAP_LINES.slice(
        PROMOTE_PANEL.docLine - 1,
        PROMOTE_PANEL.docLine + PROMOTE_PANEL.fields.length
      )
      expect(cited.some((line) => line.includes(`\`${field.rawName}\``))).toBe(true)
    }
  })

  test('the navigation path matches the documented "New: <Type>" form heading', () => {
    for (const type of PAGE_TYPES) {
      expect(KARL_NAV[type]).toBe(`New: ${type} → Content`)
    }
  })

  test('carries the footnote flags the tables do not', () => {
    expect(KARL_FLAGS.calloutHasNoTitle).toBe(true)
    expect(KARL_FLAGS.costDescriptionMaxChars).toBe(120)
    expect(KARL_FLAGS.bulletsFoldIntoText).toBe(true)
    expect(KARL_FLAGS.buttonLabelGuidanceChars).toBe(25)
    expect(KARL_FLAGS.buttonLabelMaxChars).toBe(255)
    expect(KARL_FLAGS.spotlightsAllowed).toEqual({ Agency: 2, Campaign: 2, Report: 1, Topic: 1 })
  })
})

/** The subset of a panel the drift comparison covers. */
function panelFacts(panel) {
  return {
    uiLabel: panel.uiLabel,
    rawName: panel.rawName,
    requiredDoc: panel.requiredDoc,
    repeatableDoc: panel.repeatableDoc,
    blockTypesDoc: panel.blockTypesDoc,
    sourceDoc: panel.sourceDoc,
    order: panel.order,
    docLine: panel.docLine,
  }
}

describe('UNRESOLVED', () => {
  test('every rule names a register ID, a shape, a reason and a real doc line', () => {
    expect(UNRESOLVED.length).toBeGreaterThan(0)
    for (const rule of UNRESOLVED) {
      expect(rule.id).toMatch(/^U\d+$/)
      expect(rule.shape).toMatch(/^[a-z0-9-]+$/)
      expect(rule.reason.length).toBeGreaterThan(40)
      expect(FIELD_MAP_LINES[rule.docLine - 1]).toContain(`\`${rule.id}\``)
    }
  })

  test('no two rules claim the same shape', () => {
    // A duplicate shape makes one of the two rules dead: the check that reads
    // this table only ever asks whether a shape is present, so the second
    // rule's reason would never be shown and its register entry could be closed
    // upstream with nothing here going red.
    const shapes = UNRESOLVED.map((rule) => rule.shape)
    expect(new Set(shapes).size).toBe(shapes.length)
  })
})

describe('matchesSection', () => {
  test('component: null matches only a section carrying no component', () => {
    expect(matchesSection({ component: null }, { heading: 'H' }, null)).toBe(true)
    expect(matchesSection({ component: null }, { heading: 'H', component: 'body' }, null)).toBe(
      false
    )
  })

  test('a named component matches only that component', () => {
    expect(matchesSection({ component: 'services' }, { component: 'services' }, null)).toBe(true)
    expect(matchesSection({ component: 'services' }, { component: 'resources' }, null)).toBe(false)
  })

  test('flat distinguishes an accordion from a plain custom section', () => {
    const section = { component: 'supporting', flat: true }
    expect(matchesSection({ component: 'supporting', flat: true }, section, null)).toBe(true)
    expect(matchesSection({ component: 'supporting', flat: false }, section, null)).toBe(false)
    // An absent `flat` is false, not "unspecified" — the two Karl panels are
    // mutually exclusive, so a section must land in exactly one of them.
    expect(
      matchesSection({ component: 'supporting', flat: false }, { component: 'supporting' }, null)
    ).toBe(true)
  })

  test('has and lacks are ANDed', () => {
    const section = { heading: 'H', paragraphs: ['p'] }
    expect(matchesSection({ has: ['paragraphs'], lacks: ['cards'] }, section, null)).toBe(true)
    expect(matchesSection({ has: ['paragraphs', 'cards'] }, section, null)).toBe(false)
    expect(matchesSection({ lacks: ['paragraphs'] }, section, null)).toBe(false)
  })

  test('an empty match accepts any section', () => {
    // Report's `content` panel takes every section, so this is a real case
    // rather than a degenerate one.
    expect(matchesSection({}, { heading: 'H' }, null)).toBe(true)
  })

  test('cardClass compares against the classification passed in, never re-derived', () => {
    const section = { heading: 'H', cards: [{ title: 'T' }] }
    expect(matchesSection({ cardClass: 'title-only' }, section, 'title-only')).toBe(true)
    expect(matchesSection({ cardClass: 'title-only' }, section, 'inherits')).toBe(false)
    expect(matchesSection({ cardClass: 'title-only' }, section, null)).toBe(false)
  })

  test('a missing match or section is false, never a throw', () => {
    expect(matchesSection(null, { heading: 'H' }, null)).toBe(false)
    expect(matchesSection({}, null, null)).toBe(false)
  })
})

describe('panelsFor', () => {
  test('returns the inventory in form order', () => {
    const orders = panelsFor('Transaction').map((panel) => panel.order)
    expect(orders).toEqual(orders.map((_value, index) => index))
  })

  test('an unknown type returns an empty array rather than throwing', () => {
    expect(panelsFor('Nonexistent')).toEqual([])
  })
})
