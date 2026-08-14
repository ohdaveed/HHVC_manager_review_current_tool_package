// build_scripts/ai/knowledge-retrieval.js
//
// Read-side access to knowledge_chunks: a cached, in-memory view plus
// cosine-similarity retrieval over it.
//
// Storage lives behind build_scripts/storage.js, so this module works against
// whichever store the deployment uses — Postgres when DATABASE_URL is set,
// SQLite otherwise. It used to open its own bun:sqlite connection to
// DATA_DB_PATH, which was fine while SQLite was the only store and quietly
// broken once it was not: on Railway that opened an EMPTY local file, so
// `compliance-audit` reported itself unready no matter how many times anyone
// ran `bun run ingest` against the real database.
//
// Reading DATA_DB_PATH from the environment here (rather than having server.ts
// thread a handle through) matches how every sibling build_scripts/ai/* module
// reads its own configuration.
const { resolve } = require('node:path')
const { knowledgeVersion, readKnowledgeChunks } = require('../storage.js')
const { topKBySimilarity } = require('../knowledge-search')
// Deliberately named directly rather than via the provider registry: whether
// the knowledge base is USABLE depends on Gemini specifically (the only
// embedding source, see provider-gemini.js), independent of which provider
// later GENERATES the audit text.
const gemini = require('./provider-gemini')

const DATA_DB_PATH =
  process.env.DATA_DB_PATH || resolve(__dirname, '..', '..', '.data', 'review-state.local.db')

/** @type {{version: string, chunks: object[]} | null} */
let cache = null

/**
 * All chunks embedded with the CURRENTLY configured model, cached until the
 * corpus changes — so a running server picks up a fresh `bun run ingest`
 * without a restart and without re-reading every row per audit request.
 *
 * **The cache key is a corpus version, not the database file's mtime.** The
 * mtime worked while the rows were in a local SQLite file and is meaningless
 * once they are in Postgres — there is no file to stat, so a server would have
 * cached its first read forever, including an empty one. `knowledgeVersion()`
 * is a row count plus the newest `created_at`: it moves on any ingest,
 * including one that only deletes.
 *
 * Rows whose `embedding_model` does not match `gemini.getEmbeddingModel()` are
 * excluded, not just tolerated: `bun run ingest` always re-embeds the whole
 * corpus in one run, but a run that crashes partway through (or a
 * `GEMINI_EMBEDDING_MODEL` change between runs) can otherwise leave rows from
 * two different embedding spaces in the table at once. Cosine similarity
 * between vectors from different models is meaningless, so mixing them would
 * produce a plausible-looking but wrong ranking rather than a visible failure.
 * Filtering here means a partially-stale table degrades to "fewer chunks
 * available" instead of silently blending two vector spaces.
 *
 * @returns {Promise<Array<{id: string, sourceFile: string, category: string,
 *   headingPath: string|null, content: string, embedding: Float32Array}>>}
 */
async function loadChunks() {
  const version = await knowledgeVersion(DATA_DB_PATH)
  if (cache && cache.version === version) return cache.chunks

  const rows = await readKnowledgeChunks(DATA_DB_PATH)
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
      // a fresh buffer, so this does not depend on the stored bytes' byteOffset
      // being 4-byte aligned the way a raw `new Float32Array(row.embedding.buffer)`
      // view would. Both drivers hand back a Buffer here — SQLite from a BLOB,
      // Postgres from a bytea — and the round trip is byte-exact.
      embedding: new Float32Array(
        row.embedding.buffer.slice(
          row.embedding.byteOffset,
          row.embedding.byteOffset + row.embedding.byteLength
        )
      ),
    }))
  cache = { version, chunks }
  return chunks
}

/** @returns {Promise<number>} rows currently usable in knowledge_chunks. */
async function countKnowledgeChunks() {
  return (await loadChunks()).length
}

/**
 * @param {Float32Array} queryEmbedding
 * @param {number} topK
 * @param {object} [options]
 * @param {string[]} [options.excludeCategories] Categories to withhold from
 *   this retrieval — see `generateComplianceAudit`, which excludes
 *   `mockup-draft` so an audit cannot ground a compliance finding in
 *   unapproved draft copy.
 * @returns {Promise<Array<{chunk: object, score: number}>>}
 */
async function retrieveRelevantChunks(queryEmbedding, topK, options = {}) {
  const exclude = new Set(options.excludeCategories || [])
  const chunks = await loadChunks()
  const eligible = exclude.size ? chunks.filter((chunk) => !exclude.has(chunk.category)) : chunks
  return topKBySimilarity(queryEmbedding, eligible, topK)
}

/**
 * Whether the compliance-audit task can run at all: Gemini configured (for
 * embeddings, regardless of which provider will generate the audit) AND at
 * least one chunk ingested.
 *
 * @returns {Promise<boolean>}
 */
async function isComplianceAuditAvailable() {
  if (!gemini.isConfigured()) return false
  return (await countKnowledgeChunks()) > 0
}

module.exports = {
  loadChunks,
  countKnowledgeChunks,
  retrieveRelevantChunks,
  isComplianceAuditAvailable,
}
