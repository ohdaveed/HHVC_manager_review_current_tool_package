/* Storage seam for the optional review-state API.
   ================================================
   Role: the one place that decides WHERE review records live and speaks the
   dialect that store needs. `server.ts` calls these functions and never sees a
   driver, a connection, or a SQL string.

   Two drivers, chosen by `DATABASE_URL`:

   - **Postgres** when `DATABASE_URL` is set — what Railway injects from the
     managed Postgres service. This is production.
   - **SQLite** otherwise, at `DATA_DB_PATH` — local dev, and every server test.
     `tests/review-api-server.test.js` spawns the real `server.ts` against a
     temp `DATA_DB_PATH` and asserts twenty-odd behaviours over real HTTP,
     including the compare-and-swap 409. Keeping SQLite as the fallback is what
     lets that suite keep running with no service container in CI, and it keeps
     `bun run dev:api` working on a laptop with nothing installed.

   **Every function here is async, including the SQLite ones.** `bun:sqlite` is
   synchronous and `Bun.SQL` is not; giving the two different shapes would push
   the difference back out into `server.ts`, which is exactly what this file
   exists to prevent. The handlers that call these are already async.

   **`updated_at` is TEXT in both drivers, never a timestamp type.** Every
   freshness comparison in this system is a string compare — the server checks
   `existing.updated_at > patch.synced_at`, and the client checks
   `serverRecord.updated_at > localRecord.synced_at` — against ISO strings that
   only ever come from the server. Letting Postgres parse and reformat them
   would change those comparisons for values that differ only in
   representation, and the failure would be a silently lost update rather than
   an error. See the long comment in `putReviewPage`.

   Load-order dependency: none. It opens nothing at import time; the first call
   to `initStorage()` or any read/write connects. */

import { Database } from 'bun:sqlite'
import { SQL } from 'bun'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
// The SQLite DDL, shared with the ingest path so the two cannot disagree about
// the table's shape. The Postgres equivalent lives below, next to it.
import { ensureKnowledgeChunksTable } from './knowledge-schema.js'

/** @type {import('bun:sqlite').Database|null} */
let sqliteDb = null

/** @type {SQL|null} */
let postgresDb = null

/** Resolved once so a mid-process env change cannot half-switch drivers. */
let resolvedDriver = null

/**
 * Which store this process is using.
 *
 * @returns {'postgres'|'sqlite'}
 */
function storageDriver() {
  if (!resolvedDriver) {
    resolvedDriver = process.env.DATABASE_URL ? 'postgres' : 'sqlite'
  }
  return resolvedDriver
}

/**
 * A one-line description for diagnostics and the boot log. Never includes the
 * connection string — it carries the Postgres password.
 *
 * @param {string} sqlitePath Where the SQLite fallback would live.
 * @returns {string}
 */
function describeStorage(sqlitePath) {
  return storageDriver() === 'postgres' ? 'postgres (DATABASE_URL)' : `sqlite (${sqlitePath})`
}

/**
 * Open (or reuse) the SQLite handle.
 *
 * @param {string} sqlitePath
 * @returns {import('bun:sqlite').Database}
 */
function getSqlite(sqlitePath) {
  if (sqliteDb) return sqliteDb
  // { create: true } makes bun:sqlite create the DB *file*, but not its parent
  // directory — without this, a fresh checkout fails with SQLITE_CANTOPEN.
  mkdirSync(dirname(sqlitePath), { recursive: true })
  sqliteDb = new Database(sqlitePath, { create: true })
  return sqliteDb
}

/**
 * Open (or reuse) the Postgres client.
 *
 * @returns {SQL}
 */
function getPostgres() {
  if (postgresDb) return postgresDb
  postgresDb = new SQL(process.env.DATABASE_URL)
  return postgresDb
}

/**
 * Create the review-state table if it is not already there.
 *
 * **Called at boot rather than lazily on the first request**, which is the one
 * behavioural change from the SQLite-only version. A lazy `CREATE TABLE IF NOT
 * EXISTS` is harmless when the database is a file only this process opens; on
 * Postgres, two replicas racing the same DDL on their first requests is not.
 * Doing it once before the server listens removes the race entirely.
 *
 * @param {string} sqlitePath Path for the SQLite fallback.
 * @returns {Promise<void>}
 */
async function initStorage(sqlitePath) {
  if (storageDriver() === 'postgres') {
    const sql = getPostgres()
    // jsonb rather than text: the record is already JSON, and one of the
    // reasons for choosing a real database was being able to query reviews
    // from outside the container without parsing a blob first.
    await sql`
      CREATE TABLE IF NOT EXISTS review_pages (
        page_key TEXT PRIMARY KEY,
        record JSONB NOT NULL,
        updated_at TEXT NOT NULL
      )
    `
    await initKnowledgeStorage(sqlitePath)
    return
  }

  getSqlite(sqlitePath).run(`
    CREATE TABLE IF NOT EXISTS review_pages (
      page_key TEXT PRIMARY KEY,
      record TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
  await initKnowledgeStorage(sqlitePath)
}

/**
 * Normalize a stored record to a parsed object.
 *
 * SQLite hands back the TEXT column as a string; Postgres parses `jsonb` and
 * hands back an object already. Returning `null` for anything unparseable is
 * deliberate — a single corrupt row must not fail a whole GET.
 *
 * @param {unknown} record
 * @returns {object|null}
 */
function parseRecord(record) {
  if (record && typeof record === 'object') return record
  if (typeof record !== 'string') return null
  try {
    return JSON.parse(record)
  } catch {
    return null
  }
}

/**
 * Every review record on the server, keyed by page.
 *
 * @param {string} sqlitePath
 * @returns {Promise<Array<{page_key: string, record: object}>>}
 */
async function readAllReviewPages(sqlitePath) {
  const rows =
    storageDriver() === 'postgres'
      ? await getPostgres()`SELECT page_key, record FROM review_pages`
      : getSqlite(sqlitePath).query('SELECT page_key, record FROM review_pages').all()

  const out = []
  for (const row of rows) {
    const parsed = parseRecord(row.record)
    if (parsed) out.push({ page_key: row.page_key, record: parsed })
  }
  return out
}

/**
 * One review record, or null when the page has never been pushed.
 *
 * @param {string} sqlitePath
 * @param {string} pageKey
 * @returns {Promise<object|null>}
 */
async function readReviewPage(sqlitePath, pageKey) {
  if (storageDriver() === 'postgres') {
    const rows = await getPostgres()`SELECT record FROM review_pages WHERE page_key = ${pageKey}`
    return rows.length ? parseRecord(rows[0].record) : null
  }

  const row = getSqlite(sqlitePath)
    .query('SELECT record FROM review_pages WHERE page_key = ?')
    .get(pageKey)
  return row ? parseRecord(row.record) : null
}

/**
 * Compare-and-swap a merged record into place.
 *
 * The write only lands if the row still carries `expectedUpdatedAt` — the value
 * read before the merge. `null` means "there was no row", in which case the
 * plain INSERT applies and the `WHERE` on the conflict branch never runs. Two
 * replicas that both passed the staleness check against the same prior row
 * therefore cannot both write: the loser's statement matches nothing and this
 * returns `false`, which the caller turns into a 409. The rule it enforces is
 * "merge, never wipe", atomically rather than checked-then-trusted.
 *
 * @param {string} sqlitePath
 * @param {{pageKey: string, record: object, updatedAt: string, expectedUpdatedAt: string|null}} params
 * @returns {Promise<boolean>} Whether the write landed.
 */
async function upsertReviewPageIfUnchanged(sqlitePath, params) {
  const { pageKey, record, updatedAt, expectedUpdatedAt } = params

  if (storageDriver() === 'postgres') {
    // RETURNING rather than a driver-specific "rows affected" field: it means
    // the same expression answers the question on any driver, and it is the
    // only portable way to tell a skipped conflict branch from a real write.
    // The record is passed as an OBJECT and left for the driver to serialize.
    // Passing `${JSON.stringify(record)}::jsonb` looks equivalent and is not:
    // Bun sends the string as a JSON parameter, so the cast wraps it and the
    // column ends up holding a jsonb *string scalar* rather than an object.
    // Measured: `jsonb_typeof` returns "string" and `record->>'decision'`
    // returns NULL. Nothing in the app notices, because the read path parses a
    // string just as happily — so the only thing that catches it is asserting
    // the stored type in the database, which the Postgres suite now does.
    const rows = await getPostgres()`
      INSERT INTO review_pages (page_key, record, updated_at)
      VALUES (${pageKey}, ${record}, ${updatedAt})
      ON CONFLICT (page_key) DO UPDATE
        SET record = excluded.record, updated_at = excluded.updated_at
        WHERE review_pages.updated_at = ${expectedUpdatedAt}
      RETURNING page_key
    `
    return rows.length > 0
  }

  const result = getSqlite(sqlitePath).run(
    `INSERT INTO review_pages (page_key, record, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(page_key) DO UPDATE SET record = excluded.record, updated_at = excluded.updated_at
     WHERE review_pages.updated_at = ?`,
    [pageKey, JSON.stringify(record), updatedAt, expectedUpdatedAt]
  )
  return result.changes > 0
}

/* The RAG knowledge base
   ======================
   `knowledge_chunks` lives in the same store as `review_pages` — one
   connection, one thing to provision — and it moved behind this seam for the
   reason the review table did: on a Postgres deployment it was still opening a
   local SQLite file, which on Railway is empty, so `compliance-audit` reported
   itself unready no matter how many times anyone ran `bun run ingest`.

   **Embeddings are raw little-endian Float32 bytes in both drivers** — a BLOB
   in SQLite, `bytea` in Postgres. Verified byte-exact through Bun's client
   rather than assumed. Storing them as an array of doubles would double the
   size and lose the "one buffer, one memcpy" read the ranking loop depends on. */

/**
 * Create the knowledge table. Called by `initStorage`, so a server boot and an
 * ingest run agree on the schema without either assuming the other ran first.
 *
 * @param {string} sqlitePath
 * @returns {Promise<void>}
 */
async function initKnowledgeStorage(sqlitePath) {
  if (storageDriver() === 'postgres') {
    await getPostgres()`
      CREATE TABLE IF NOT EXISTS knowledge_chunks (
        id TEXT PRIMARY KEY,
        source_file TEXT NOT NULL,
        category TEXT NOT NULL,
        heading_path TEXT,
        content TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        embedding BYTEA NOT NULL,
        embedding_model TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `
    return
  }
  ensureKnowledgeChunksTable(getSqlite(sqlitePath))
}

/**
 * Replace one document's chunks, atomically.
 *
 * DELETE-then-insert inside a transaction rather than an upsert: a re-ingest
 * can produce FEWER chunks than last time (an edit that shortens a document),
 * and an upsert would leave the surplus rows behind as citable content that no
 * longer exists in the source.
 *
 * @param {string} sqlitePath
 * @param {string} sourceFile
 * @param {Array<{id: string, category: string, headingPath: string|null,
 *   content: string, chunkIndex: number, embedding: Buffer,
 *   embeddingModel: string, createdAt: string}>} rows
 * @returns {Promise<void>}
 */
async function replaceDocumentChunks(sqlitePath, sourceFile, rows) {
  if (storageDriver() === 'postgres') {
    const sql = getPostgres()
    await sql.begin(async (tx) => {
      await tx`DELETE FROM knowledge_chunks WHERE source_file = ${sourceFile}`
      for (const row of rows) {
        await tx`
          INSERT INTO knowledge_chunks
            (id, source_file, category, heading_path, content, chunk_index, embedding, embedding_model, created_at)
          VALUES (${row.id}, ${sourceFile}, ${row.category}, ${row.headingPath}, ${row.content},
                  ${row.chunkIndex}, ${row.embedding}, ${row.embeddingModel}, ${row.createdAt})
        `
      }
    })
    return
  }

  const db = getSqlite(sqlitePath)
  db.transaction(() => {
    db.run('DELETE FROM knowledge_chunks WHERE source_file = ?', [sourceFile])
    const insert = db.prepare(
      `INSERT INTO knowledge_chunks
       (id, source_file, category, heading_path, content, chunk_index, embedding, embedding_model, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    for (const row of rows) {
      insert.run(
        row.id,
        sourceFile,
        row.category,
        row.headingPath,
        row.content,
        row.chunkIndex,
        row.embedding,
        row.embeddingModel,
        row.createdAt
      )
    }
  })()
}

/**
 * Drop chunks for documents that are no longer in the corpus.
 *
 * The per-document replace above only fires for documents this run actually
 * reached, so a file that was renamed, deleted, or now parses to nothing would
 * otherwise leave its chunks citable forever with nothing on disk behind them.
 *
 * @param {string} sqlitePath
 * @param {string[]} sourceFiles Everything that SHOULD remain.
 * @returns {Promise<number>} How many rows were removed.
 */
async function pruneChunksNotIn(sqlitePath, sourceFiles) {
  if (storageDriver() === 'postgres') {
    const sql = getPostgres()
    if (!sourceFiles.length) return (await sql`DELETE FROM knowledge_chunks RETURNING id`).length
    // Generated `$1, $2, …` placeholders with the values passed as real
    // parameters, mirroring the SQLite branch below.
    //
    // Three tidier-looking forms were tried against a real Postgres and all
    // three fail: `= ANY(${array})` and `unnest(${array}::text[])` both make
    // Bun serialize the JS array as `a,b,c`, which Postgres rejects as a
    // malformed array literal; and `jsonb_array_elements_text(${json}::jsonb)`
    // hits the same double-encoding that bit `review_pages.record` — the cast
    // wraps the string, so the server reports "cannot extract elements from a
    // scalar". Joining the names into a `{a,b}` literal DOES work and is not
    // used on purpose: a source file containing a comma, brace, quote or
    // backslash would corrupt the list, and building SQL by concatenating
    // values is how injection gets in.
    const placeholders = sourceFiles.map((_, index) => `$${index + 1}`).join(',')
    const rows = await sql.unsafe(
      `DELETE FROM knowledge_chunks WHERE source_file NOT IN (${placeholders}) RETURNING id`,
      sourceFiles
    )
    return rows.length
  }

  const db = getSqlite(sqlitePath)
  const placeholders = sourceFiles.map(() => '?').join(',')
  const count = sourceFiles.length
    ? db
        .query(
          `SELECT COUNT(*) as count FROM knowledge_chunks WHERE source_file NOT IN (${placeholders})`
        )
        .get(...sourceFiles).count
    : db.query('SELECT COUNT(*) as count FROM knowledge_chunks').get().count
  if (count > 0) {
    db.run(
      sourceFiles.length
        ? `DELETE FROM knowledge_chunks WHERE source_file NOT IN (${placeholders})`
        : 'DELETE FROM knowledge_chunks',
      sourceFiles
    )
  }
  return count
}

/**
 * Every chunk, as stored. Filtering by embedding model is the caller's job —
 * this layer does not know which model is configured.
 *
 * @param {string} sqlitePath
 * @returns {Promise<Array<object>>}
 */
async function readKnowledgeChunks(sqlitePath) {
  const query =
    'SELECT id, source_file, category, heading_path, content, embedding, embedding_model FROM knowledge_chunks'
  if (storageDriver() === 'postgres') return getPostgres().unsafe(query)
  return getSqlite(sqlitePath).query(query).all()
}

/**
 * A cheap token that changes whenever the corpus does.
 *
 * Replaces the old `statSync(DATA_DB_PATH).mtimeMs` cache key, which is
 * meaningless once the rows live in Postgres — there is no file to stat, and a
 * server would have cached the first read forever. Row count plus the newest
 * `created_at` moves on any ingest, including one that only deletes, and costs
 * one aggregate over a table of a few hundred rows.
 *
 * @param {string} sqlitePath
 * @returns {Promise<string>}
 */
async function knowledgeVersion(sqlitePath) {
  const query = 'SELECT COUNT(*) AS count, MAX(created_at) AS newest FROM knowledge_chunks'
  const row =
    storageDriver() === 'postgres'
      ? (await getPostgres().unsafe(query))[0]
      : getSqlite(sqlitePath).query(query).get()
  return `${row?.count ?? 0}:${row?.newest ?? ''}`
}

export {
  describeStorage,
  initKnowledgeStorage,
  initStorage,
  knowledgeVersion,
  pruneChunksNotIn,
  readAllReviewPages,
  readKnowledgeChunks,
  readReviewPage,
  replaceDocumentChunks,
  storageDriver,
  upsertReviewPageIfUnchanged,
}
