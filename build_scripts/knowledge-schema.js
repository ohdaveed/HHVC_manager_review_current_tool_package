// build_scripts/knowledge-schema.js
//
// The knowledge_chunks table definition, shared by the read path
// (build_scripts/ai/knowledge-retrieval.js, opened by the running server) and
// the write path (build_scripts/ingest-knowledge.js, run by hand via
// `bun run ingest`) so the two processes cannot define this table differently.
// Lives in the same SQLite file server.ts already opens at DATA_DB_PATH
// (which also holds review_pages) — see
// docs/superpowers/specs/2026-08-07-rag-knowledge-base-design.md.

/**
 * @param {import('bun:sqlite').Database} db
 */
function ensureKnowledgeChunksTable(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS knowledge_chunks (
      id TEXT PRIMARY KEY,
      source_file TEXT NOT NULL,
      category TEXT NOT NULL,
      heading_path TEXT,
      content TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      embedding BLOB NOT NULL,
      embedding_model TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `)
}

module.exports = { ensureKnowledgeChunksTable }
