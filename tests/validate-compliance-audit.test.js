const { describe, test, expect } = require('bun:test')
const { findInvalidCitations } = require('../build_scripts/ai/validate-compliance-audit')

describe('findInvalidCitations', () => {
  const retrievedIds = new Set(['a.md#0', 'b.md#0'])

  test('returns no issues when every citation is in the retrieved set', () => {
    const result = {
      findings: [{ issue: 'x', citedChunkIds: ['a.md#0', 'b.md#0'] }],
    }
    expect(findInvalidCitations(result, retrievedIds)).toEqual([])
  })

  test('flags a citation outside the retrieved set, naming the finding and the bad id', () => {
    const result = {
      findings: [{ issue: 'Missing 311 instruction', citedChunkIds: ['c.md#0'] }],
    }
    const issues = findInvalidCitations(result, retrievedIds)
    expect(issues).toHaveLength(1)
    expect(issues[0]).toContain('c.md#0')
    expect(issues[0]).toContain('Missing 311 instruction')
  })

  test('flags an empty citedChunkIds array', () => {
    const result = { findings: [{ issue: 'x', citedChunkIds: [] }] }
    expect(findInvalidCitations(result, retrievedIds)).toHaveLength(1)
  })

  test('flags a missing citedChunkIds field', () => {
    const result = { findings: [{ issue: 'x' }] }
    expect(findInvalidCitations(result, retrievedIds)).toHaveLength(1)
  })

  test('checks every finding independently, not just the first', () => {
    const result = {
      findings: [
        { issue: 'ok', citedChunkIds: ['a.md#0'] },
        { issue: 'bad', citedChunkIds: ['nonexistent.md#0'] },
      ],
    }
    const issues = findInvalidCitations(result, retrievedIds)
    expect(issues).toHaveLength(1)
    expect(issues[0]).toContain('bad')
  })
})
