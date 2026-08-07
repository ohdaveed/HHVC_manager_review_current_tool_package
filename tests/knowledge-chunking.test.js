const { describe, test, expect } = require('bun:test')
const { chunkMarkdown } = require('../build_scripts/knowledge-chunking')

describe('chunkMarkdown', () => {
  test('splits on ## and ### headings and builds a heading path', () => {
    const markdown = [
      '## Rats',
      '',
      'Rats carry disease.',
      '',
      '### Reporting a sighting',
      '',
      'Call 311 to report a sighting.',
    ].join('\n')

    const chunks = chunkMarkdown(markdown, 'hhvc-policy/rats.md')

    expect(chunks).toHaveLength(2)
    expect(chunks[0].headingPath).toBe('Rats')
    expect(chunks[0].content).toContain('Rats carry disease.')
    expect(chunks[1].headingPath).toBe('Rats > Reporting a sighting')
    expect(chunks[1].content).toContain('Call 311 to report a sighting.')
  })

  test('every chunk carries its sourceFile and a sequential chunkIndex', () => {
    const markdown = '## A\n\nOne.\n\n## B\n\nTwo.'
    const chunks = chunkMarkdown(markdown, 'x.md')
    expect(chunks.map((c) => c.sourceFile)).toEqual(['x.md', 'x.md'])
    expect(chunks.map((c) => c.chunkIndex)).toEqual([0, 1])
  })

  test('content before the first heading gets a null headingPath', () => {
    const markdown = 'Intro paragraph with no heading above it.\n\n## First heading\n\nBody.'
    const chunks = chunkMarkdown(markdown, 'x.md')
    expect(chunks[0].headingPath).toBeNull()
    expect(chunks[0].content).toContain('Intro paragraph')
  })

  test('a section over 500 words is split into multiple chunks with word overlap', () => {
    const paragraphs = []
    for (let i = 0; i < 20; i += 1) {
      paragraphs.push(`Paragraph ${i} ${'word '.repeat(40)}`.trim())
    }
    const markdown = `## Long section\n\n${paragraphs.join('\n\n')}`
    const chunks = chunkMarkdown(markdown, 'long.md')

    expect(chunks.length).toBeGreaterThan(1)
    chunks.forEach((chunk) => expect(chunk.headingPath).toBe('Long section'))

    // The tail of chunk N reappears at the head of chunk N+1 (the overlap).
    const firstChunkWords = chunks[0].content.trim().split(/\s+/)
    const overlapWord = firstChunkWords[firstChunkWords.length - 1]
    expect(chunks[1].content).toContain(overlapWord)
  })

  test('skips headings that produce no body text', () => {
    const markdown = '## Empty\n\n## Has text\n\nSome text here.'
    const chunks = chunkMarkdown(markdown, 'x.md')
    expect(chunks).toHaveLength(1)
    expect(chunks[0].headingPath).toBe('Has text')
  })
})
