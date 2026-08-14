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
  KARL_CAPTURE_FILES,
  categoryFor,
  collectKnowledgeSources,
  projectPageToMarkdown,
} = require('../build_scripts/knowledge-sources.js')

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
    expect(karl.length).toBe(KARL_CAPTURE_FILES.length)
    // The capture record is what carries the raw measured field names; the
    // cookbook is the prose built on top of it. Both are ingested, so a
    // question about Karl's actual fields can be answered from the measurement
    // rather than from the older UI-label-keyed reference doc.
    expect(karl.map((source) => source.markdown).join('\n')).toContain('data-contentpath')
  })

  test('includes the live SF.gov snapshots under their own category', () => {
    const live = sources.filter((source) => source.category === 'sfgov-live')
    expect(live.length).toBeGreaterThan(0)
    expect(live.every((source) => source.markdown.includes('source_url:'))).toBe(true)
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
