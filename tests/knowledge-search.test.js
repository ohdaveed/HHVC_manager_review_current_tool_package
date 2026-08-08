const { describe, test, expect } = require('bun:test')
const { cosineSimilarity, topKBySimilarity } = require('../build_scripts/knowledge-search')

describe('cosineSimilarity', () => {
  test('returns 1 for identical vectors', () => {
    expect(cosineSimilarity(new Float32Array([1, 2, 3]), new Float32Array([1, 2, 3]))).toBeCloseTo(
      1,
      5
    )
  })

  test('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity(new Float32Array([1, 0]), new Float32Array([0, 1]))).toBeCloseTo(0, 5)
  })

  test('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity(new Float32Array([1, 0]), new Float32Array([-1, 0]))).toBeCloseTo(-1, 5)
  })

  test('returns 0 for a zero vector rather than dividing by zero', () => {
    expect(cosineSimilarity(new Float32Array([0, 0]), new Float32Array([1, 1]))).toBe(0)
  })
})

describe('topKBySimilarity', () => {
  const chunks = [
    { id: 'a', embedding: new Float32Array([1, 0]) },
    { id: 'b', embedding: new Float32Array([0.9, 0.1]) },
    { id: 'c', embedding: new Float32Array([0, 1]) },
  ]

  test('ranks chunks by descending similarity to the query', () => {
    const results = topKBySimilarity(new Float32Array([1, 0]), chunks, 3)
    expect(results.map((r) => r.chunk.id)).toEqual(['a', 'b', 'c'])
  })

  test('returns at most k results', () => {
    const results = topKBySimilarity(new Float32Array([1, 0]), chunks, 2)
    expect(results).toHaveLength(2)
    expect(results.map((r) => r.chunk.id)).toEqual(['a', 'b'])
  })

  test('each result carries the numeric score alongside the chunk', () => {
    const results = topKBySimilarity(new Float32Array([1, 0]), chunks, 1)
    expect(results[0].score).toBeCloseTo(1, 5)
  })

  test('returns an empty array for an empty corpus', () => {
    expect(topKBySimilarity(new Float32Array([1, 0]), [], 5)).toEqual([])
  })
})
