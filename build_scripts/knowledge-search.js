//
// Pure cosine-similarity ranking over embedded knowledge chunks. No DB, no
// network — takes a query vector and an in-memory list of chunks, returns the
// top K by similarity. Brute-force on purpose: at this corpus's size
// (~150-200 chunks, see docs/superpowers/specs/2026-08-07-rag-knowledge-base-design.md)
// this is microseconds of work, and a loadable vector-index extension would
// add native-binary deployment risk for no benefit. Dual-exported like
// knowledge-chunking.js.

/**
 * @param {Float32Array} a
 * @param {Float32Array} b
 * @returns {number} Cosine similarity in [-1, 1], or 0 if either vector has
 *   zero magnitude (rather than dividing by zero).
 */
function cosineSimilarity(a, b) {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * @param {Float32Array} queryEmbedding
 * @param {Array<{embedding: Float32Array}>} chunks
 * @param {number} k
 * @returns {Array<{chunk: object, score: number}>} Sorted by descending score.
 */
function topKBySimilarity(queryEmbedding, chunks, k) {
  return chunks
    .map((chunk) => ({ chunk, score: cosineSimilarity(queryEmbedding, chunk.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
}

if (typeof window !== 'undefined') {
  window.cosineSimilarity = cosineSimilarity
  window.topKBySimilarity = topKBySimilarity
}

module.exports = { cosineSimilarity, topKBySimilarity }
