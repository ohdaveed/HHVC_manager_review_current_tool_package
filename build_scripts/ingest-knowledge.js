#!/usr/bin/env bun
// build_scripts/ingest-knowledge.js
//
// CLI: `bun run ingest`. Chunks docs/source/**/*.md, embeds each chunk via
// Gemini, and upserts into knowledge_chunks in the same SQLite DB server.ts
// opens at DATA_DB_PATH. Safe to re-run: each source file's existing rows are
// replaced, not accumulated, so editing docs/source/ and re-running is always
// safe. See docs/superpowers/specs/2026-08-07-rag-knowledge-base-design.md.
//
// Manual, developer-triggered — like `bun run export` — not part of the build
// pipeline: docs/source/ changes rarely, and running this needs a real
// GEMINI_API_KEY and makes real (billed) embedding calls, so it must not run
// in CI or on every `bun run build`.
const { Database } = require('bun:sqlite')
const { mkdirSync } = require('node:fs')
const { dirname, resolve } = require('node:path')
const { chunkMarkdown } = require('./knowledge-chunking')
const { ensureKnowledgeChunksTable } = require('./knowledge-schema')
const { collectKnowledgeSources } = require('./knowledge-sources')
const { loadPageData } = require('./load-pages')
const gemini = require('./ai/provider-gemini')

const ROOT = resolve(__dirname, '..')
const DATA_DB_PATH = process.env.DATA_DB_PATH || resolve(ROOT, '.data/review-state.local.db')

// embedContent accepts a batch, but a very large one risks an upstream
// request-size or timeout limit. This corpus produces roughly 150-200 chunks
// total, so 20 keeps each call small while still batching most files.
const EMBED_BATCH_SIZE = 20

/**
 * @param {string[]} texts
 * @returns {Promise<Float32Array[]>}
 */
async function embedAll(texts) {
  const vectors = []
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBED_BATCH_SIZE)
    const batchVectors = await gemini.embedContent(batch, 'DOCUMENT')
    vectors.push(...batchVectors)
  }
  return vectors
}

async function main() {
  if (!gemini.isConfigured()) {
    console.error('GEMINI_API_KEY is not set. Ingestion needs it to generate embeddings.')
    process.exitCode = 1
    return
  }

  mkdirSync(dirname(DATA_DB_PATH), { recursive: true })
  const db = new Database(DATA_DB_PATH, { create: true })
  ensureKnowledgeChunksTable(db)

  // Which documents make up the corpus — and what category each is filed
  // under — lives in build_scripts/knowledge-sources.js, so this script stays
  // the embed-and-upsert half and the corpus definition is testable without a
  // Gemini key. The mockup pages are projected to markdown there; loading them
  // here keeps the page loader out of that module's dependencies.
  const { pages } = loadPageData()
  const sources = collectKnowledgeSources({ pages })

  let totalChunks = 0
  const emptyFiles = []

  for (const source of sources) {
    const relativePath = source.sourceFile
    const chunks = chunkMarkdown(source.markdown, relativePath)
    if (!chunks.length) {
      emptyFiles.push(relativePath)
      continue
    }

    const vectors = await embedAll(chunks.map((chunk) => chunk.content))
    const category = source.category
    const embeddingModel = gemini.getEmbeddingModel()
    const now = new Date().toISOString()

    db.transaction(() => {
      db.run('DELETE FROM knowledge_chunks WHERE source_file = ?', [relativePath])
      const insert = db.prepare(
        `INSERT INTO knowledge_chunks
         (id, source_file, category, heading_path, content, chunk_index, embedding, embedding_model, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      chunks.forEach((chunk, index) => {
        const id = `${relativePath}#${chunk.chunkIndex}`
        const embeddingBuffer = Buffer.from(Float32Array.from(vectors[index]).buffer)
        insert.run(
          id,
          relativePath,
          category,
          chunk.headingPath,
          chunk.content,
          chunk.chunkIndex,
          embeddingBuffer,
          embeddingModel,
          now
        )
      })
    })()

    totalChunks += chunks.length
    console.log(`  [${category}] ${relativePath}: ${chunks.length} chunks`)
  }

  console.log(`\nIngested ${sources.length - emptyFiles.length} documents, ${totalChunks} chunks.`)
  if (emptyFiles.length) {
    // No silent drops: a file that globbed as markdown but chunked to
    // nothing (e.g. whitespace-only) is named explicitly, not just missing
    // from the count above.
    console.log(`Files with no chunks after parsing: ${emptyFiles.join(', ')}`)
  }

  // Prune rows for documents that are no longer in the corpus, were renamed,
  // or now parse to zero chunks. The per-file DELETE above only fires for a
  // file actually reached by this run's loop with real content, so a file
  // removed (or emptied) between runs would otherwise leave its old chunks
  // in the table forever, citable by compliance-audit even though nothing on
  // disk backs them anymore.
  const keptFiles = sources
    .map((source) => source.sourceFile)
    .filter((file) => !emptyFiles.includes(file))
  const placeholders = keptFiles.map(() => '?').join(',')
  const staleCount = keptFiles.length
    ? db
        .query(
          `SELECT COUNT(*) as count FROM knowledge_chunks WHERE source_file NOT IN (${placeholders})`
        )
        .get(...keptFiles).count
    : db.query('SELECT COUNT(*) as count FROM knowledge_chunks').get().count
  if (staleCount > 0) {
    db.run(
      keptFiles.length
        ? `DELETE FROM knowledge_chunks WHERE source_file NOT IN (${placeholders})`
        : 'DELETE FROM knowledge_chunks',
      keptFiles
    )
    console.log(`Pruned ${staleCount} chunks from files no longer in the corpus.`)
  }
}

main()
