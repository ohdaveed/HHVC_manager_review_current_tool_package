// What the RAG corpus is made of, and what category each document is filed
// under. Deliberately separate from tests/knowledge-chunking.test.js: that
// covers how a document is split, this covers which documents exist at all —
// the thing that silently excluded the newest Karl capture for a week because
// it lived one directory above the glob.
//
// Needs no Gemini key and makes no embedding call: build_scripts/ingest-knowledge.js
// keeps the corpus definition here precisely so it can be tested for free.
const { describe, test, expect } = require('bun:test')
const {
  COMPLIANCE_MATRIX_SOURCE,
  EXTERNAL_SOURCE_FILES,
  categoryFor,
  collectKnowledgeSources,
  projectComplianceMatrixToMarkdown,
  projectPageToMarkdown,
} = require('../build_scripts/knowledge-sources.js')

/** How many of the outside-`docs/source/` documents file under one category. */
function externalCountFor(category) {
  return EXTERNAL_SOURCE_FILES.filter((entry) => entry.category === category).length
}

describe('categoryFor', () => {
  test('files a document under its first path segment', () => {
    expect(categoryFor('hhvc-policy/2026-07-02-ipm-pests-rats.md')).toBe('hhvc-policy')
    expect(categoryFor('sfgov-style/house-style.md')).toBe('sfgov-style')
  })

  test('a new corpus folder needs no code change to get its own category', () => {
    // This is why the scraped SF.gov snapshots just work: dropping them in
    // docs/source/sfgov-live/ files them without touching the ingester.
    expect(categoryFor('sfgov-live/report-a-health-nuisance-or-hazards.md')).toBe('sfgov-live')
  })
})

describe('collectKnowledgeSources', () => {
  const sources = collectKnowledgeSources({
    pages: {
      demoPage: {
        title: 'Demo page',
        type: 'Information',
        slug: 'sf.gov/demo',
        summary: 'A short summary.',
        sections: [{ heading: 'A section', karl: 'Maps to a Title and text block.' }],
      },
    },
  })
  const byFile = new Map(sources.map((source) => [source.sourceFile, source]))

  test('includes the committed policy corpus', () => {
    const policy = sources.filter((source) => source.category === 'hhvc-policy')
    expect(policy.length).toBeGreaterThan(0)
  })

  test('includes the Karl capture, which lives outside docs/source/', () => {
    // The regression this file exists for: the 2026-08-14 capture with the
    // measured field names was unretrievable, so the model could only cite the
    // older UI-label-keyed reference.
    const karl = sources.filter((source) => source.category === 'karl')
    // Counted per category rather than against the whole outside list: that
    // list carries the standards manual and the SF.gov synthesis now too, so
    // a total would pass while a Karl capture silently changed category.
    expect(karl.length).toBe(externalCountFor('karl'))
    // The capture record is what carries the raw measured field names; the
    // cookbook is the prose built on top of it. Both are ingested, so a
    // question about Karl's actual fields can be answered from the measurement
    // rather than from the older UI-label-keyed reference doc.
    expect(karl.map((source) => source.markdown).join('\n')).toContain('data-contentpath')
  })

  test('includes the live SF.gov snapshots under their own category', () => {
    const live = sources.filter((source) => source.category === 'sfgov-live')
    expect(live.length).toBeGreaterThan(0)
  })

  test('every scraped SF.gov snapshot carries the URL it was taken from', () => {
    // Scoped to the scraped snapshots — the files under docs/source/sfgov-live/
    // — rather than to the whole category. A snapshot claims to be what one
    // page published on one day, so it is worthless without the URL and the
    // front matter is the contract. The cross-type synthesis filed alongside
    // them reads six live pages and names each exemplar inline, so a single
    // `source_url:` would be a false claim about where it came from.
    const snapshots = sources.filter(
      (source) => source.category === 'sfgov-live' && !source.sourceFile.includes('inspiration')
    )
    expect(snapshots.length).toBeGreaterThan(0)
    expect(snapshots.every((source) => source.markdown.includes('source_url:'))).toBe(true)
  })

  test('the content standards manual is retrievable, under its own category', () => {
    // The gap this addition closed: js/plain-language.js cites this manual by
    // section number for every scored `severity: 'error'` rule, and it was the
    // one document a compliance audit could not quote back — it lives in
    // notebooklm/, which no glob here reached.
    const standards = sources.filter((source) => source.category === 'hhvc-standards')
    expect(standards.map((source) => source.sourceFile)).toEqual([
      'hhvc-standards/hhvc-standards-manual.md',
    ])
    expect(standards[0].markdown).toContain('Web Governance and Content Standards Manual')
  })

  test('files the Karl Help Center rules apart from the measured captures', () => {
    // Two categories on purpose: `karl-gitbook` is the CMS as DOCUMENTED and
    // `karl` is the CMS as MEASURED, and they have disagreed. Collapsing them
    // would let a Help Center claim the live admin contradicts be cited with
    // the authority of a measurement.
    const documented = sources.filter((source) => source.category === 'karl-gitbook')
    expect(documented.length).toBeGreaterThan(0)
    expect(documented.every((source) => source.sourceFile.startsWith('karl-gitbook/'))).toBe(true)
  })

  test('excludes every folder README, so folder notes are never citable', () => {
    expect(sources.some((source) => source.sourceFile.endsWith('README.md'))).toBe(false)
  })

  test('projects mockup pages under a distinct draft category', () => {
    // Draft copy must never be filed as policy: a compliance audit citing a
    // proposal as if it were adopted guidance is worse than citing nothing.
    const page = byFile.get('mockup/demoPage.md')
    expect(page).toBeDefined()
    expect(page.category).toBe('mockup-draft')
  })

  test('source ids are stable strings, since they are also the prune key', () => {
    // ingest-knowledge.js deletes rows whose source_file is not in this run's
    // list, so an unstable name would silently orphan or duplicate chunks.
    for (const source of sources) {
      expect(typeof source.sourceFile).toBe('string')
      expect(source.sourceFile.length).toBeGreaterThan(0)
    }
    expect(new Set(sources.map((s) => s.sourceFile)).size).toBe(sources.length)
  })
})

describe('projectPageToMarkdown', () => {
  const page = {
    title: 'Report rats',
    type: 'Transaction',
    slug: 'sf.gov/report-rats',
    summary: 'Tell us about rats.',
    sections: [
      {
        heading: 'What to do',
        karl: 'Maps to the What to do field, Section block.',
        paragraphs: ['Call 311.'],
        bullets: ['Have the address ready', { text: 'Note when it started', unverified: true }],
        steps: [{ title: 'Check scope', text: ['HHVC inspects housing.'], bullets: ['Rats'] }],
        callout: { text: 'Report an active problem through 311.' },
      },
      { heading: 'At a glance', karl: 'Table block.', table: [['Section', 'Covers']] },
    ],
  }
  const markdown = projectPageToMarkdown('rodentsReport', page)

  test('emits headings the chunker can split on', () => {
    expect(markdown).toContain('# Report rats')
    expect(markdown).toContain('## What to do')
    expect(markdown).toContain('### Check scope')
  })

  test('carries the karl placement notes, which are content here rather than comments', () => {
    expect(markdown).toContain('Karl placement note: Maps to the What to do field')
  })

  test('renders both string and {text} list items rather than [object Object]', () => {
    // The page schema allows either shape for any text-bearing array; a
    // projector that assumed strings would embed "[object Object]" as if it
    // were copy, and it would be retrievable.
    expect(markdown).toContain('- Have the address ready')
    expect(markdown).toContain('- Note when it started')
    expect(markdown).not.toContain('[object Object]')
  })

  test('names the page key and slug so a citation can be traced back', () => {
    expect(markdown).toContain('rodentsReport')
    expect(markdown).toContain('sf.gov/report-rats')
  })
})

describe('projectComplianceMatrixToMarkdown', () => {
  // Driven with a hand-built CSV rather than the real one, so a row added to
  // notebooklm/compliance-standards.csv never fails this file — same reasoning
  // as tests/card-inheritance.test.js not driving off the real page corpus.
  const csv = [
    'Category,Section/Topic,Requirement or Standard,Compliance/Ready Standard,Approved Wording or Legal Source,Responsible Party (Inferred),Source',
    'Sanitation,Rodent Exclusion,"Seal openings larger than  $1/4$  inch ( $0.25$  inches).",Use metal or concrete.,SF Health Code Art. 2 Sec. 92,Property Owner,"5, 6, 7"',
    'Mechanical,Room Temperature,Maintain 68 degrees.,Measured at 3 feet.,SF Housing Code Sec. 701,Property Owner,"8"',
    'Sanitation,Refuse Storage,Store refuse in covered containers.,Containers closed.,SF Health Code Sec. 283,Property Owner,"9"',
    'Penalties,Violation Fines,"Penalties up to $1,000 per day.",Assessed per violation.,SF Health Code Sec. 596,Director,"10"',
  ].join('\n')
  const markdown = projectComplianceMatrixToMarkdown(csv)

  test('gives every requirement its own heading, so a chunk carries one provision', () => {
    // The chunker splits on headings and prefixes each chunk with its heading
    // path. One heading per row is what makes a retrieved chunk citable as a
    // single requirement rather than as a slice of a table.
    expect(markdown).toContain('### Rodent Exclusion')
    expect(markdown).toContain('### Room Temperature')
    expect(markdown).toContain('**Legal source:** SF Health Code Art. 2 Sec. 92')
  })

  test('emits each category heading exactly once, even when its rows are split', () => {
    // The real CSV returns to Regulations/Sanitation after a detour through
    // Regulations/Mechanical. Emitting in row order writes that ## twice, and
    // two chunks then share one heading path — an ambiguous citation label.
    const headings = markdown.match(/^## .+$/gm)
    expect(headings).toEqual(['## Sanitation', '## Mechanical', '## Penalties'])
    expect(markdown.indexOf('### Refuse Storage')).toBeLessThan(markdown.indexOf('## Mechanical'))
  })

  test('unwraps the math delimiters without eating a real dollar amount', () => {
    // NotebookLM wrapped nine numeric values as $1/4$. Embedded verbatim, a
    // page correctly stating the quarter-inch rule reads as a near-miss
    // against its own requirement — and a naive strip of every $ would
    // destroy the penalty figure two rows down.
    expect(markdown).toContain('larger than 1/4 inch (0.25 inches)')
    expect(markdown).toContain('Penalties up to $1,000 per day.')
  })

  test('drops the NotebookLM citation indices, which resolve to nothing here', () => {
    // The trailing Source column holds indices into a source list that is not
    // in this repo. Embedded, they sit beside real legal citations looking
    // equally resolvable.
    expect(markdown).not.toContain('5, 6, 7')
    expect(markdown).not.toContain('**Source:**')
  })
})

describe('the compliance matrix in the corpus', () => {
  const sources = collectKnowledgeSources()
  const matrix = sources.find((source) => source.sourceFile === COMPLIANCE_MATRIX_SOURCE)

  test('is projected from the CSV rather than read from a committed copy', () => {
    // A committed markdown conversion would be a second source of truth free
    // to drift from the CSV the program actually maintains — the same reason
    // pages/*.js are projected at ingest time and not committed.
    expect(matrix).toBeDefined()
    expect(matrix.category).toBe('hhvc-policy')
    expect(matrix.markdown).toContain('# HHVC compliance standards matrix')
  })

  test('carries the code section behind the quarter-inch exclusion rule', () => {
    // The pairing that justifies the whole addition: an audit can otherwise
    // say a page contradicts policy but cannot name the provision.
    expect(matrix.markdown).toContain('SF Health Code Article 2 Sec. 92(b)-(c)')
  })

  test('does not collide with a real file at the same path', () => {
    // The projection claims a docs/source/ id that no file occupies. If one is
    // ever committed there, the glob emits it too and the duplicate would
    // otherwise only surface as a silent double-embed.
    const claimed = sources.filter((source) => source.sourceFile === COMPLIANCE_MATRIX_SOURCE)
    expect(claimed.length).toBe(1)
  })
})

describe('every category the corpus can emit is weighed by the audit prompt', () => {
  // The drift class this closes, rather than the instance: the prompt's
  // <source_categories> block enumerates what each category is worth, and it
  // is a hand-maintained list in a different file from the one that decides
  // which categories exist. `sfds` and `karl-gitbook` both entered the corpus
  // and never entered the prompt, so a retrieval could hand a reviewer a
  // citation tagged with a category the model was never told how to rank —
  // silently, since a missing tag reads as an ordinary source.
  const { buildComplianceAuditSystemPrompt } = require('../build_scripts/ai/prompts.js')

  test('names every category, including the projected mockup pages', () => {
    const { system } = buildComplianceAuditSystemPrompt()
    const sources = collectKnowledgeSources({
      pages: { demoPage: { title: 'Demo', sections: [] } },
    })
    const categories = [...new Set(sources.map((source) => source.category))].sort()
    const missing = categories.filter((category) => !system.includes(`"${category}"`))
    expect(missing).toEqual([])
  })
})

describe('the sfds category', () => {
  test('files the vendored SFDS capture under its own category', () => {
    const sources = collectKnowledgeSources()
    const sfds = sources.filter((s) => s.category === 'sfds')
    expect(sfds.map((s) => s.sourceFile.split('/').at(-1))).toEqual(['disagreements.md'])
  })

  test('excludes the folder README from the corpus', () => {
    const sources = collectKnowledgeSources()
    const readmes = sources.filter((s) => s.sourceFile.endsWith('sfds/README.md'))
    expect(readmes.length).toBe(0)
  })
})
