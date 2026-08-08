// build_scripts/ai/knowledge-retrieval.js
//
// Read-side access to knowledge_chunks: a cached, in-memory view plus
// cosine-similarity retrieval over it.
//
// Opens its OWN bun:sqlite connection to DATA_DB_PATH rather than sharing
// server.ts's `db` — SQLite supports multiple reader connections alongside
// one writer on the same file, and this module never writes
// (build_scripts/ingest-knowledge.js owns every write to this table).
// Reading its own env var directly, rather than having server.ts thread a
// `db` handle through generateContent/generateComplianceAudit, matches how
// every sibling build_scripts/ai/* module already reads its own env
// configuration (GEMINI_API_KEY, AI_EFFORT, etc.) rather than receiving it as
// a parameter.
const { Database } = require('bun:sqlite')
const { mkdirSync, statSync } = require('node:fs')
const { dirname, resolve } = require('node:path')
const { ensureKnowledgeChunksTable } = require('../knowledge-schema')
const { topKBySimilarity } = require('../knowledge-search')
// Deliberately named directly rather than via the provider registry: whether
// the knowledge base is USABLE depends on Gemini specifically (the only
// embedding source, see provider-gemini.js), independent of which provider
// later GENERATES the audit text.
const gemini = require('./provider-gemini')

const DATA_DB_PATH =
  process.env.DATA_DB_PATH || resolve(__dirname, '..', '..', '.data', 'review-state.local.db')

let db = null
function getKnowledgeDb() {
  if (db) return db
  mkdirSync(dirname(DATA_DB_PATH), { recursive: true })
  db = new Database(DATA_DB_PATH, { create: true })
  ensureKnowledgeChunksTable(db)
  return db
}

/** @type {{mtimeMs: number, chunks: object[]} | null} */
let cache = null

/**
 * All chunks embedded with the CURRENTLY configured model, cached until
 * DATA_DB_PATH's mtime moves — i.e. until a fresh `bun run ingest` writes to
 * it — so a running server picks up new content without a restart and
 * without re-querying SQLite on every audit request.
 *
 * Rows whose `embedding_model` does not match `gemini.getEmbeddingModel()`
 * are excluded, not just tolerated: `bun run ingest` always re-embeds the
 * whole corpus in one run, but a run that crashes partway through (or a
 * `GEMINI_EMBEDDING_MODEL` change between runs) can otherwise leave rows
 * from two different embedding spaces in the table at once. Cosine
 * similarity between vectors from different models is meaningless, so
 * mixing them in would produce a plausible-looking but wrong ranking rather
 * than a visible failure. Filtering here means a partially-stale table
 * degrades to "fewer chunks available" (still correct rankings, just over a
 * smaller corpus) instead of silently blending two vector spaces.
 * @returns {Array<{id: string, sourceFile: string, category: string,
 *   headingPath: string|null, content: string, embedding: Float32Array}>}
 */
function loadChunks() {
  const instance = getKnowledgeDb()
  let mtimeMs = 0
  try {
    mtimeMs = statSync(DATA_DB_PATH).mtimeMs
  } catch {
    // File does not exist yet. No chunks either way; fall through with 0.
  }
  if (cache && cache.mtimeMs === mtimeMs) return cache.chunks

  const rows = instance
    .query(
      'SELECT id, source_file, category, heading_path, content, embedding, embedding_model FROM knowledge_chunks'
    )
    .all()
  const currentModel = gemini.getEmbeddingModel()
  const chunks = rows
    .filter((row) => row.embedding_model === currentModel)
    .map((row) => ({
      id: row.id,
      sourceFile: row.source_file,
      category: row.category,
      headingPath: row.heading_path,
      content: row.content,
      // .slice() on the underlying ArrayBuffer copies the exact byte range into
      // a fresh buffer, so this does not depend on the BLOB's byteOffset being
      // 4-byte aligned the way a raw `new Float32Array(row.embedding.buffer)`
      // view would.
      embedding: new Float32Array(
        row.embedding.buffer.slice(
          row.embedding.byteOffset,
          row.embedding.byteOffset + row.embedding.byteLength
        )
      ),
    }))
  cache = { mtimeMs, chunks }
  return chunks
}

/** @returns {number} rows currently in knowledge_chunks. */
function countKnowledgeChunks() {
  return loadChunks().length
}

/**
 * @param {Float32Array} queryEmbedding
 * @param {number} topK
 * @returns {Array<{chunk: object, score: number}>}
 */
function retrieveRelevantChunks(queryEmbedding, topK) {
  return topKBySimilarity(queryEmbedding, loadChunks(), topK)
}

/**
 * Whether the compliance-audit task can run at all: Gemini configured (for
 * embeddings, regardless of which provider will generate the audit) AND at
 * least one chunk ingested.
 * @returns {boolean}
 */
function isComplianceAuditAvailable() {
  return gemini.isConfigured() && countKnowledgeChunks() > 0
}

module.exports = {
  loadChunks,
  countKnowledgeChunks,
  retrieveRelevantChunks,
  isComplianceAuditAvailable,
  getKnowledgeDb,
}
