// Retrieval against a real (temporary) knowledge_chunks table: the embedding
// model filter, the category exclusion compliance-audit depends on, and the
// corpus-version cache.
//
// Uses synthetic embeddings and a temp SQLite database, so it needs no Gemini
// key and makes no network call. It exercises the same storage seam the
// Postgres deployment uses; only the driver differs.
const { describe, test, expect, beforeEach, afterEach } = require('bun:test')
const { Database } = require('bun:sqlite')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const RETRIEVAL_PATH = path.resolve(ROOT, 'build_scripts/ai/knowledge-retrieval.js')
const STORAGE_PATH = path.resolve(ROOT, 'build_scripts/storage.js')
const EMBEDDING_MODEL = 'test-embedding-model'

let dbDir
let previousDbPath
let previousEmbeddingModel
let previousDatabaseUrl

/** A unit vector pointing at one axis, so similarity is easy to reason about. */
function vector(axis) {
  const values = [0, 0, 0]
  values[axis] = 1
  return Buffer.from(Float32Array.from(values).buffer)
}

function seed(rows) {
  const db = new Database(path.join(dbDir, 'knowledge.db'), { create: true })
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
  const insert = db.prepare(
    `INSERT INTO knowledge_chunks
     (id, source_file, category, heading_path, content, chunk_index, embedding, embedding_model, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  for (const row of rows) {
    insert.run(
      row.id,
      row.sourceFile,
      row.category,
      null,
      row.content,
      0,
      row.embedding,
      row.embeddingModel ?? EMBEDDING_MODEL,
      row.createdAt ?? '2026-08-14T00:00:00.000Z'
    )
  }
  db.close()
}

function loadRetrieval() {
  delete require.cache[RETRIEVAL_PATH]
  delete require.cache[STORAGE_PATH]
  return require(RETRIEVAL_PATH)
}

beforeEach(() => {
  previousDbPath = process.env.DATA_DB_PATH
  previousEmbeddingModel = process.env.GEMINI_EMBEDDING_MODEL
  previousDatabaseUrl = process.env.DATABASE_URL
  // The storage seam picks Postgres whenever DATABASE_URL is set; these tests
  // are about retrieval semantics, not the driver, so pin them to SQLite.
  delete process.env.DATABASE_URL
  dbDir = fs.mkdtempSync(path.join(ROOT, '.knowledge-retrieval-'))
  process.env.DATA_DB_PATH = path.join(dbDir, 'knowledge.db')
  process.env.GEMINI_EMBEDDING_MODEL = EMBEDDING_MODEL
})

afterEach(() => {
  fs.rmSync(dbDir, { recursive: true, force: true })
  if (previousDbPath === undefined) delete process.env.DATA_DB_PATH
  else process.env.DATA_DB_PATH = previousDbPath
  if (previousEmbeddingModel === undefined) delete process.env.GEMINI_EMBEDDING_MODEL
  else process.env.GEMINI_EMBEDDING_MODEL = previousEmbeddingModel
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL
  else process.env.DATABASE_URL = previousDatabaseUrl
  delete require.cache[RETRIEVAL_PATH]
  delete require.cache[STORAGE_PATH]
})

describe('retrieveRelevantChunks', () => {
  test('returns the closest chunks, read back through the storage seam', async () => {
    seed([
      {
        id: 'a#0',
        sourceFile: 'hhvc-policy/a.md',
        category: 'hhvc-policy',
        content: 'A',
        embedding: vector(0),
      },
      {
        id: 'b#0',
        sourceFile: 'hhvc-policy/b.md',
        category: 'hhvc-policy',
        content: 'B',
        embedding: vector(1),
      },
    ])
    const { retrieveRelevantChunks } = loadRetrieval()

    const hits = await retrieveRelevantChunks(Float32Array.from([1, 0, 0]), 2)

    expect(hits[0].chunk.id).toBe('a#0')
    // The embedding survived the BLOB round trip as real numbers, not bytes.
    expect(hits[0].score).toBeGreaterThan(hits[1].score)
  })

  test('excludes a category on request, which is how an audit refuses draft copy', async () => {
    // The reason this exists: measured against the real corpus, an audit of a
    // rats page returned three findings and all three cited `mockup-draft` —
    // real contradictions, but evidenced by other proposals rather than by the
    // policy they should rest on. The system prompt already forbade it; only
    // withholding the chunks actually stopped it.
    seed([
      {
        id: 'draft#0',
        sourceFile: 'mockup/rodentsReport.md',
        category: 'mockup-draft',
        content: 'Draft',
        embedding: vector(0),
      },
      {
        id: 'policy#0',
        sourceFile: 'hhvc-policy/rules.md',
        category: 'hhvc-policy',
        content: 'Policy',
        embedding: vector(1),
      },
    ])
    const { retrieveRelevantChunks } = loadRetrieval()

    // The query points straight at the draft chunk, so it would win outright.
    const query = Float32Array.from([1, 0, 0])
    expect((await retrieveRelevantChunks(query, 2))[0].chunk.id).toBe('draft#0')

    const filtered = await retrieveRelevantChunks(query, 2, {
      excludeCategories: ['mockup-draft'],
    })
    expect(filtered.map((hit) => hit.chunk.id)).toEqual(['policy#0'])
  })

  test('ignores chunks embedded with a different model rather than mixing vector spaces', async () => {
    // Cosine similarity across two embedding models is meaningless, so a
    // partially re-ingested table must degrade to "fewer chunks" rather than
    // to a confident, wrong ranking.
    seed([
      {
        id: 'stale#0',
        sourceFile: 'hhvc-policy/old.md',
        category: 'hhvc-policy',
        content: 'Stale',
        embedding: vector(0),
        embeddingModel: 'some-older-model',
      },
      {
        id: 'fresh#0',
        sourceFile: 'hhvc-policy/new.md',
        category: 'hhvc-policy',
        content: 'Fresh',
        embedding: vector(1),
      },
    ])
    const { retrieveRelevantChunks, countKnowledgeChunks } = loadRetrieval()

    expect(await countKnowledgeChunks()).toBe(1)
    const hits = await retrieveRelevantChunks(Float32Array.from([1, 0, 0]), 5)
    expect(hits.map((hit) => hit.chunk.id)).toEqual(['fresh#0'])
  })
})

describe('isComplianceAuditAvailable', () => {
  test('is false with an empty corpus even when Gemini is configured', async () => {
    seed([])
    const { isComplianceAuditAvailable } = loadRetrieval()
    expect(await isComplianceAuditAvailable()).toBe(false)
  })
})
