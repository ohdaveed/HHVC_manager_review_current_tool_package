# RAG Knowledge Base + Compliance-Audit Task Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a RAG-grounded compliance-audit capability to the optional AI assist backend, using only this repo's existing stack (bun:sqlite, the Anthropic/Gemini provider registry, `docs/source/` as the corpus).

**Architecture:** A new `knowledge_chunks` SQLite table (same DB file `server.ts` already opens at `DATA_DB_PATH`), populated by a `bun run ingest` CLI script that chunks `docs/source/**/*.md`, embeds each chunk via Gemini, and upserts. A new `compliance-audit` task on the existing `POST /api/ai/generate` route embeds the page under review, retrieves the top-6 chunks by brute-force cosine similarity, and asks the resolved provider (Anthropic or Gemini) for structured, cited findings.

**Tech Stack:** `bun:sqlite`, `@google/genai` (already a dependency, used for both generation and — new in this plan — embeddings), `fast-glob` (already a dependency), Zod. No new dependencies.

## Global Constraints

- No Postgres, no Express, no OpenAI. Everything lives in the SQLite DB at `DATA_DB_PATH` and the existing Anthropic/Gemini provider registry (`build_scripts/ai/providers.js`).
- Embeddings come from Gemini only (Anthropic has no embeddings API) — model id `text-embedding-004`, confirmed against live `@google/genai` docs (`/websites/googleapis_github_io_js-genai`) via Context7, overridable with `GEMINI_EMBEDDING_MODEL`.
- The corpus is exactly `docs/source/**/*.md` (42 files today), `README.md` files excluded, **no other filtering** — the `DRAFT-NOT-FOR-PUBLICATION` file is ingested like every other file per an explicit reviewer decision.
- Vector search is brute-force cosine similarity in plain JS — no `sqlite-vec`, no native extension.
- `compliance-audit` is a new value on the existing task enum on `POST /api/ai/generate`, not a new route — it reuses `resolveProvider`, the disclosure convention, and the route's existing timeout/cancellation/error-mapping.
- Pure logic (`knowledge-chunking.js`, `knowledge-search.js`) is dual-exported (`window`/`module.exports`), matching `js/review-merge.js`/`js/plain-language.js`, and unit-tested without a DB or network call.
- New test files are added to `package.json`'s explicit (non-globbed) `test` script list — this repo's tests are enumerated, not discovered.
- Code style: no semicolons, single quotes, 2-space indent, ES5 trailing commas (Prettier is the linter — run `bun run format` before each commit in this plan).
- `build_scripts/ai/*` files are CommonJS (`require`/`module.exports`), matching every existing sibling in that directory. `server.ts` is the one TypeScript/ESM file.

---

### Task 1: `knowledge-chunking.js` — pure markdown chunker

**Files:**
- Create: `build_scripts/knowledge-chunking.js`
- Test: `tests/knowledge-chunking.test.js`

**Interfaces:**
- Produces: `chunkMarkdown(markdown: string, sourceFile: string) -> Array<{sourceFile: string, headingPath: string|null, content: string, chunkIndex: number}>`. Task 8 (ingestion script) and Task 2 (search) consume this shape's `content` field for embedding text.

- [ ] **Step 1: Write the failing tests**

```javascript
// tests/knowledge-chunking.test.js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/knowledge-chunking.test.js`
Expected: FAIL — `Cannot find module '../build_scripts/knowledge-chunking'`

- [ ] **Step 3: Write the implementation**

```javascript
// build_scripts/knowledge-chunking.js
//
// Pure markdown chunker for the RAG knowledge base. No I/O: takes a markdown
// string and returns chunk records. Dual-exported (window/module.exports),
// matching js/review-merge.js and js/plain-language.js, so this is
// unit-testable without a DB or a browser, and reusable if a browser-side
// tool ever wants the same chunking (none does today).
//
// Splits on ## and ### headings first, keeping a section's ideas together,
// then sub-splits any section over MAX_CHUNK_WORDS at paragraph boundaries
// with OVERLAP_WORDS of context carried into the next chunk, so a fact near a
// chunk boundary is not orphaned from the sentence before it. Every chunk is
// prefixed with its heading path so the embedded text — and what is later
// shown to the model at query time — carries its own section context.

const MAX_CHUNK_WORDS = 500
const OVERLAP_WORDS = 50

const HEADING_RE = /^(#{2,3})\s+(.+)$/

/**
 * Split markdown into sections at ## and ### headings, tracking a heading
 * path (e.g. "Rats > Reporting a sighting") via a stack keyed by heading
 * level. Content before the first heading becomes one section with an empty
 * heading path.
 * @param {string} markdown
 * @returns {Array<{headingPath: string, body: string}>}
 */
function parseSections(markdown) {
  const lines = markdown.split('\n')
  const sections = []
  const stack = []
  let bodyLines = []

  const flush = () => {
    const body = bodyLines.join('\n').trim()
    if (body) sections.push({ headingPath: stack.map((entry) => entry.title).join(' > '), body })
    bodyLines = []
  }

  for (const line of lines) {
    const match = line.match(HEADING_RE)
    if (!match) {
      bodyLines.push(line)
      continue
    }
    flush()
    const level = match[1].length
    const title = match[2].trim()
    while (stack.length && stack[stack.length - 1].level >= level) stack.pop()
    stack.push({ level, title })
  }
  flush()

  return sections
}

/**
 * Split one section's body into paragraph-aligned chunks of at most
 * `maxWords`, carrying `overlapWords` of the previous chunk's tail forward.
 * @param {string} body
 * @param {number} maxWords
 * @param {number} overlapWords
 * @returns {string[]}
 */
function splitIntoWordChunks(body, maxWords, overlapWords) {
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)

  const chunks = []
  let current = []
  let currentWords = 0

  for (const paragraph of paragraphs) {
    const wordCount = paragraph.split(/\s+/).filter(Boolean).length
    if (currentWords + wordCount > maxWords && current.length) {
      chunks.push(current.join('\n\n'))
      const tailWords = current.join(' ').split(/\s+/).filter(Boolean).slice(-overlapWords)
      current = tailWords.length ? [tailWords.join(' ')] : []
      currentWords = tailWords.length
    }
    current.push(paragraph)
    currentWords += wordCount
  }
  if (current.length) chunks.push(current.join('\n\n'))

  return chunks
}

/**
 * @param {string} markdown
 * @param {string} sourceFile Path recorded on every chunk (relative to
 *   docs/source/, e.g. "hhvc-policy/2026-07-02-ipm-pests-rats.md").
 * @returns {Array<{sourceFile: string, headingPath: string|null, content: string, chunkIndex: number}>}
 */
function chunkMarkdown(markdown, sourceFile) {
  const sections = parseSections(markdown)
  const chunks = []
  let chunkIndex = 0

  for (const section of sections) {
    const bodyChunks = splitIntoWordChunks(section.body, MAX_CHUNK_WORDS, OVERLAP_WORDS)
    for (const bodyChunk of bodyChunks) {
      const content = section.headingPath ? `${section.headingPath}\n\n${bodyChunk}` : bodyChunk
      chunks.push({
        sourceFile,
        headingPath: section.headingPath || null,
        content,
        chunkIndex,
      })
      chunkIndex += 1
    }
  }

  return chunks
}

if (typeof window !== 'undefined') {
  window.chunkMarkdown = chunkMarkdown
}

module.exports = { chunkMarkdown, MAX_CHUNK_WORDS, OVERLAP_WORDS }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/knowledge-chunking.test.js`
Expected: PASS — 5 tests

- [ ] **Step 5: Format and commit**

```bash
bun run format
git add build_scripts/knowledge-chunking.js tests/knowledge-chunking.test.js
git commit -m "feat: add pure markdown chunker for the RAG knowledge base"
```

---

### Task 2: `knowledge-search.js` — pure cosine-similarity top-K

**Files:**
- Create: `build_scripts/knowledge-search.js`
- Test: `tests/knowledge-search.test.js`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `topKBySimilarity(queryEmbedding: Float32Array, chunks: Array<{embedding: Float32Array, ...}>, k: number) -> Array<{chunk: object, score: number}>`, sorted by descending score. Task 6 (`knowledge-retrieval.js`) consumes this directly.

- [ ] **Step 1: Write the failing tests**

```javascript
// tests/knowledge-search.test.js
const { describe, test, expect } = require('bun:test')
const { cosineSimilarity, topKBySimilarity } = require('../build_scripts/knowledge-search')

describe('cosineSimilarity', () => {
  test('returns 1 for identical vectors', () => {
    expect(cosineSimilarity(new Float32Array([1, 2, 3]), new Float32Array([1, 2, 3]))).toBeCloseTo(1, 5)
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/knowledge-search.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```javascript
// build_scripts/knowledge-search.js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/knowledge-search.test.js`
Expected: PASS — 8 tests

- [ ] **Step 5: Format and commit**

```bash
bun run format
git add build_scripts/knowledge-search.js tests/knowledge-search.test.js
git commit -m "feat: add pure cosine-similarity top-K search for the RAG knowledge base"
```

---

### Task 3: `knowledge_chunks` shared table schema

**Files:**
- Create: `build_scripts/knowledge-schema.js`

**Interfaces:**
- Produces: `ensureKnowledgeChunksTable(db: import('bun:sqlite').Database) -> void`. Consumed by Task 6 (`knowledge-retrieval.js`, read path) and Task 8 (`ingest-knowledge.js`, write path) so the two processes' schemas cannot drift.

- [ ] **Step 1: Write the implementation** (no test — this is a one-line DDL wrapper; its behavior is exercised end-to-end by Task 6/8's own verification)

```javascript
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
```

- [ ] **Step 2: Commit**

```bash
bun run format
git add build_scripts/knowledge-schema.js
git commit -m "feat: add shared knowledge_chunks table schema"
```

---

### Task 4: Gemini `embedContent` on the provider module

**Files:**
- Modify: `build_scripts/ai/provider-gemini.js` (add after `generateObject`, before the closing `module.exports`, currently around line 314)

**Interfaces:**
- Consumes: `createClient()` (already defined in this file, line 111).
- Produces: `embedContent(texts: string[], taskType: 'DOCUMENT'|'QUERY') -> Promise<Float32Array[]>`, `getEmbeddingModel() -> string`, `DEFAULT_EMBEDDING_MODEL`. Consumed by Task 8 (ingestion) and Task 7 (`compliance-audit.js`).

No isolated unit test for this step — matching how `generateObject` itself has no isolated unit test in this codebase (it is only exercised via the stub-server integration tests). `embedContent` is covered the same way, in Task 9's server integration test.

- [ ] **Step 1: Add the embedding config and function**

Insert this block after the `generateObject` function (after line 314, before `module.exports`):

```javascript
/**
 * Task types the Gemini embeddings API accepts, confirmed against
 * https://googleapis.github.io/js-genai/release_docs/interfaces/types.EmbedContentConfig.html
 * via Context7 (2026-08-07). DOCUMENT is for indexed corpus chunks
 * (ingestion); QUERY is for the text being searched with (retrieval time) —
 * the API's own docs recommend matching task type to role for retrieval
 * quality, so build_scripts/ingest-knowledge.js and
 * build_scripts/ai/compliance-audit.js each pass the one that matches what
 * they are doing.
 */
const EMBEDDING_TASK_TYPES = { DOCUMENT: 'RETRIEVAL_DOCUMENT', QUERY: 'RETRIEVAL_QUERY' }

/**
 * Default embedding model id. `text-embedding-004` per the confirmed
 * @google/genai example (client.models.embedContent({model:
 * 'text-embedding-004', ...})). `GEMINI_EMBEDDING_MODEL` overrides it, for
 * the same reason DEFAULT_MODEL is overridable: Gemini's lineup moves.
 */
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-004'

/** @returns {string} the configured embedding model id. */
function getEmbeddingModel() {
  return process.env.GEMINI_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL
}

/**
 * Embed a batch of texts.
 *
 * Anthropic has no embeddings API, so this is the ONLY source of embeddings
 * in the provider registry. Callers that need one (ingestion, compliance-audit
 * retrieval) call this directly rather than going through resolveProvider(),
 * which resolves a GENERATION provider and may legitimately be Anthropic —
 * embeddings and generation are independent choices for this task.
 *
 * @param {string[]} texts
 * @param {'DOCUMENT'|'QUERY'} taskType
 * @returns {Promise<Float32Array[]>} One embedding per input text, same order.
 */
async function embedContent(texts, taskType) {
  const client = createClient()
  const response = await client.models.embedContent({
    model: getEmbeddingModel(),
    contents: texts,
    config: { taskType: EMBEDDING_TASK_TYPES[taskType] },
  })
  return (response.embeddings || []).map((embedding) => Float32Array.from(embedding.values || []))
}
```

- [ ] **Step 2: Export the new functions**

Find this block (currently lines 316-332):

```javascript
module.exports = {
  name: NAME,
  label: LABEL,
  generateObject,
  isConfigured,
  getModel,
  listModelIds,
  normalizeUsage,
  explainRefusal,
  classifyAbort,
  createClient,
  DEFAULT_MODEL,
  MAX_OUTPUT_TOKENS,
  MAX_ATTEMPTS,
  REQUEST_TIMEOUT_MS,
  REFUSAL_FINISH_REASONS,
}
```

Replace with:

```javascript
module.exports = {
  name: NAME,
  label: LABEL,
  generateObject,
  isConfigured,
  getModel,
  listModelIds,
  normalizeUsage,
  explainRefusal,
  classifyAbort,
  createClient,
  embedContent,
  getEmbeddingModel,
  DEFAULT_MODEL,
  DEFAULT_EMBEDDING_MODEL,
  MAX_OUTPUT_TOKENS,
  MAX_ATTEMPTS,
  REQUEST_TIMEOUT_MS,
  REFUSAL_FINISH_REASONS,
}
```

- [ ] **Step 3: Confirm the file still parses and existing tests still pass**

Run: `bun test tests/ai-assist-providers.test.js tests/ai-assist-server.test.js`
Expected: PASS — no existing test touches `embedContent`, so this only verifies the addition did not break anything already covered.

- [ ] **Step 4: Format and commit**

```bash
bun run format
git add build_scripts/ai/provider-gemini.js
git commit -m "feat: add Gemini embedContent for the RAG knowledge base"
```

---

### Task 5: `compliance-audit` schema additions

**Files:**
- Modify: `build_scripts/ai/schemas.js`

**Interfaces:**
- Produces: `COMPLIANCE_AUDIT_OUTPUT_SCHEMA` (JSON Schema for structured output). `generateRequestSchema`'s `task` enum grows to include `'compliance-audit'`, and `page` becomes conditionally required. Consumed by Task 7 (`compliance-audit.js`) and Task 9 (server route).

- [ ] **Step 1: Add the compliance-audit output schema**

Insert after the `PAGE_OUTPUT_SCHEMA` constant (currently ends at line 155, before the `MAX_PAGE_JSON_BYTES` comment block):

```javascript
/**
 * One compliance-audit finding: an issue grounded in one or more cited chunk
 * ids. Citation identity is an id, resolved against the actually-retrieved
 * set server-side in compliance-audit.js — a free-text citedSource/
 * citedHeading would let the model invent a plausible-sounding citation
 * nothing retrieved actually supports.
 */
const complianceFindingSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    issue: { type: 'string', description: 'One sentence naming the compliance gap or risk.' },
    severity: { type: 'string', enum: ['error', 'warning', 'note'] },
    citedChunkIds: {
      type: 'array',
      items: { type: 'string' },
      description:
        'The id attribute(s) of the <source> elements in <cited_sources> that ground this ' +
        'finding. At least one is required. Never invent an id that was not given to you.',
    },
    recommendation: { type: 'string', description: 'One concrete, actionable fix.' },
  },
  required: ['issue', 'severity', 'citedChunkIds', 'recommendation'],
}

/** The `compliance-audit` task's output. */
const COMPLIANCE_AUDIT_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    findings: { type: 'array', items: complianceFindingSchema },
    summary: { type: 'string', description: 'Two or three sentences summarizing the audit.' },
  },
  required: ['findings', 'summary'],
}
```

- [ ] **Step 2: Replace the request schema with a discriminated union**

`content` and `compliance-audit` need genuinely different shapes (a required `prompt` vs. a
required `page` and no `prompt` at all) — a discriminated union expresses that more clearly
than one shape with optional fields and `.refine()` checks. Find (currently lines 263-268):

```javascript
const generateRequestSchema = z.object({
  task: z.enum(['content']),
  provider: z.enum(allProviderNames()).optional(),
  prompt: z.string().min(1).max(8000),
  page: groundingPageSchema.optional(),
})
```

Replace with:

```javascript
const generateRequestSchema = z.discriminatedUnion('task', [
  z.object({
    task: z.literal('content'),
    provider: z.enum(allProviderNames()).optional(),
    prompt: z.string().min(1).max(8000),
    page: groundingPageSchema.optional(),
  }),
  z.object({
    task: z.literal('compliance-audit'),
    provider: z.enum(allProviderNames()).optional(),
    // No `prompt` field: this task's grounding comes from retrieval, not
    // free text. A plain (non-.strict()) z.object() silently drops an
    // unrecognized field, so a client that sends one anyway is simply
    // ignored, matching every other field's existing behavior on this schema.
    page: groundingPageSchema,
  }),
])
```

- [ ] **Step 3: Export the new schema**

Find (currently lines 270-280):

```javascript
module.exports = {
  PAGE_OUTPUT_SCHEMA,
  PAGE_TYPES,
  SECTION_COMPONENTS,
  generateRequestSchema,
  serializePageForPrompt,
  measureDepth,
  MAX_PAGE_JSON_BYTES,
  MAX_PAGE_DEPTH,
  MAX_REQUEST_BODY_BYTES: 128 * 1024,
}
```

Replace with:

```javascript
module.exports = {
  PAGE_OUTPUT_SCHEMA,
  COMPLIANCE_AUDIT_OUTPUT_SCHEMA,
  PAGE_TYPES,
  SECTION_COMPONENTS,
  generateRequestSchema,
  serializePageForPrompt,
  measureDepth,
  MAX_PAGE_JSON_BYTES,
  MAX_PAGE_DEPTH,
  MAX_REQUEST_BODY_BYTES: 128 * 1024,
}
```

- [ ] **Step 4: Extend the schema-drift guard test**

`tests/ai-assist-schema.test.js` guards `PAGE_OUTPUT_SCHEMA` against drifting from `build_scripts/schema.js`. Read that file first (`cat tests/ai-assist-schema.test.js`) to match its existing style, then add a new `describe` block:

```javascript
describe('COMPLIANCE_AUDIT_OUTPUT_SCHEMA', () => {
  test('every finding requires issue, severity, citedChunkIds, and recommendation', () => {
    const { COMPLIANCE_AUDIT_OUTPUT_SCHEMA } = require('../build_scripts/ai/schemas')
    const findingSchema = COMPLIANCE_AUDIT_OUTPUT_SCHEMA.properties.findings.items
    expect(findingSchema.required).toEqual([
      'issue',
      'severity',
      'citedChunkIds',
      'recommendation',
    ])
  })

  test('severity is constrained to error, warning, or note', () => {
    const { COMPLIANCE_AUDIT_OUTPUT_SCHEMA } = require('../build_scripts/ai/schemas')
    const findingSchema = COMPLIANCE_AUDIT_OUTPUT_SCHEMA.properties.findings.items
    expect(findingSchema.properties.severity.enum).toEqual(['error', 'warning', 'note'])
  })
})

describe('generateRequestSchema (discriminated union)', () => {
  const VALID_PAGE_STUB = {
    slug: 'x',
    type: 'Information',
    title: 'X',
    summary: 'X',
    audience: ['a'],
    reading: 'Grade 6',
    sections: [],
  }

  test('rejects a compliance-audit request with no page', () => {
    const { generateRequestSchema } = require('../build_scripts/ai/schemas')
    expect(generateRequestSchema.safeParse({ task: 'compliance-audit' }).success).toBe(false)
  })

  test('accepts a compliance-audit request with only task and page', () => {
    const { generateRequestSchema } = require('../build_scripts/ai/schemas')
    const result = generateRequestSchema.safeParse({
      task: 'compliance-audit',
      page: VALID_PAGE_STUB,
    })
    expect(result.success).toBe(true)
  })

  test('still rejects a content request with no prompt', () => {
    const { generateRequestSchema } = require('../build_scripts/ai/schemas')
    expect(generateRequestSchema.safeParse({ task: 'content', page: VALID_PAGE_STUB }).success).toBe(
      false
    )
  })
})
```

- [ ] **Step 5: Run tests**

Run: `bun test tests/ai-assist-schema.test.js tests/ai-assist-providers.test.js`
Expected: PASS

- [ ] **Step 6: Format and commit**

```bash
bun run format
git add build_scripts/ai/schemas.js tests/ai-assist-schema.test.js
git commit -m "feat: add compliance-audit output schema and widen the generate request schema"
```

---

### Task 6: `knowledge-retrieval.js` — cached read path over `knowledge_chunks`

**Files:**
- Create: `build_scripts/ai/knowledge-retrieval.js`

**Interfaces:**
- Consumes: `ensureKnowledgeChunksTable` (Task 3), `topKBySimilarity` (Task 2), `isConfigured` from `provider-gemini.js` (Task 4).
- Produces: `loadChunks() -> Array<{id, sourceFile, category, headingPath, content, embedding: Float32Array}>`, `countKnowledgeChunks() -> number`, `retrieveRelevantChunks(queryEmbedding: Float32Array, topK: number) -> Array<{chunk, score}>`, `isComplianceAuditAvailable() -> boolean`. Consumed by Task 7 (`compliance-audit.js`), Task 9 (server route gate), and index.js's `getCapabilities()`.

No isolated unit test — this module is a thin, stateful wrapper over `bun:sqlite` and the already-tested pure functions from Tasks 2-3; it is exercised end-to-end by Task 8's manual ingestion verification and Task 9's server integration test (which seeds real rows into a real DB file).

- [ ] **Step 1: Write the implementation**

```javascript
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
 * All chunks, cached until DATA_DB_PATH's mtime moves — i.e. until a fresh
 * `bun run ingest` writes to it — so a running server picks up new content
 * without a restart and without re-querying SQLite on every audit request.
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
      'SELECT id, source_file, category, heading_path, content, embedding FROM knowledge_chunks'
    )
    .all()
  const chunks = rows.map((row) => ({
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
```

- [ ] **Step 2: Format and commit**

```bash
bun run format
git add build_scripts/ai/knowledge-retrieval.js
git commit -m "feat: add cached knowledge_chunks read path with cosine retrieval"
```

---

### Task 7: Citation validation, compliance-audit prompts, and orchestration

**Files:**
- Modify: `build_scripts/ai/prompts.js` (add two functions, extend `module.exports`)
- Create: `build_scripts/ai/validate-compliance-audit.js`
- Create: `build_scripts/ai/compliance-audit.js`
- Test: `tests/validate-compliance-audit.test.js`

**Interfaces:**
- Consumes: `GUARDRAILS`, `serializePageForPrompt` (both already in `prompts.js`/`schemas.js`), `resolveProvider` (Task-independent, `providers.js`), `embedContent` (Task 4), `retrieveRelevantChunks` (Task 6), `COMPLIANCE_AUDIT_OUTPUT_SCHEMA` (Task 5), `DISCLOSURE`/`addUsage` (already exported from `build_scripts/ai/index.js`).
- Produces: `findInvalidCitations(result, retrievedIds) -> string[]`, `buildComplianceAuditSystemPrompt() -> {system: string}`, `buildComplianceAuditUserPrompt({page, retrieved, issues, previousDraft}) -> string`, `generateComplianceAudit({page, provider, signal}) -> Promise<object>`. Consumed by Task 9 (server route) and Task 10 (tests).

Citations must be verifiable, not free text the model can invent: nothing stops a model from
citing a document that was never retrieved. `findInvalidCitations` checks every finding's
`citedChunkIds` against the set of chunk ids **actually retrieved for this specific
request** (not the whole table), and `generateComplianceAudit` retries once with the bad
citations named, mirroring how `generateContent` retries `content` drafts against
`validateGeneratedPage`'s issues.

- [ ] **Step 1: Write the failing tests for `findInvalidCitations`**

```javascript
// tests/validate-compliance-audit.test.js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/validate-compliance-audit.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Write `validate-compliance-audit.js`**

```javascript
// build_scripts/ai/validate-compliance-audit.js
//
// Validates a compliance-audit result's structural invariants beyond what
// JSON Schema can express: every citedChunkIds entry must reference a chunk
// that was ACTUALLY retrieved for this specific request, not just any string
// the model produced. Sibling of validate-output.js's validateGeneratedPage,
// kept separate since compliance-audit results and page drafts share no
// structure.

/**
 * @param {{findings: Array<{issue?: string, citedChunkIds?: string[]}>}} result
 * @param {Set<string>} retrievedIds Chunk ids actually retrieved for this request.
 * @returns {string[]} Human-readable issues, empty if every finding cites at
 *   least one retrieved id and nothing else.
 */
function findInvalidCitations(result, retrievedIds) {
  const issues = []
  result.findings.forEach((finding, index) => {
    const label = finding.issue ? `"${finding.issue}"` : `#${index + 1}`
    const citedChunkIds = finding.citedChunkIds || []
    if (!citedChunkIds.length) {
      issues.push(
        `Finding ${label} cites no sources. Every finding must cite at least one id from ` +
          '<cited_sources>.'
      )
      return
    }
    const unknown = citedChunkIds.filter((id) => !retrievedIds.has(id))
    if (unknown.length) {
      issues.push(
        `Finding ${label} cites unknown source id(s): ${unknown.join(', ')}. Only cite ids ` +
          'from the sources you were given.'
      )
    }
  })
  return issues
}

module.exports = { findInvalidCitations }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/validate-compliance-audit.test.js`
Expected: PASS — 5 tests

- [ ] **Step 5: Format and commit**

```bash
bun run format
git add build_scripts/ai/validate-compliance-audit.js tests/validate-compliance-audit.test.js
git commit -m "feat: verify compliance-audit citations against the retrieved chunk set"
```

- [ ] **Step 6: Add prompt builders to `prompts.js`**

Insert after `buildContentUserPrompt` (currently ends at line 185, before `module.exports`):

```javascript
/**
 * Build the system prompt for the compliance-audit task.
 *
 * Byte-stable like buildContentSystemPrompt: the retrieved knowledge chunks
 * are per-request and belong in the user turn, never here — putting them here
 * would invalidate the provider-side prompt cache on every call, since a
 * different page retrieves different chunks.
 * @returns {{system: string}}
 */
function buildComplianceAuditSystemPrompt() {
  const system = `You are a compliance auditor for San Francisco's Healthy Housing and Vector
Control (HHVC) program, reviewing a page mockup against the HHVC policy and
SF.gov style reference material you are given for each request.

${GUARDRAILS}

<audit_rules>
- Every source you are given carries an id attribute. Ground every finding in
  one or more of those ids via citedChunkIds. Never cite an id that was not
  given to you, and never leave citedChunkIds empty.
- If nothing in the provided sources supports a finding, do not report it.
  Absence of evidence is not evidence of a problem.
- severity "error" means the page contradicts or omits something a cited
  source requires. "warning" is a real but lower-stakes gap. "note" is worth a
  human's attention but is not itself a compliance issue.
- This is an audit, not a rewrite. Name the issue and recommend what a human
  editor should check or change — do not draft replacement copy.
</audit_rules>`

  return { system }
}

/**
 * Build the user turn for a compliance-audit request.
 * @param {object} options
 * @param {object} options.page The page being audited.
 * @param {Array<{chunk: {id: string, sourceFile: string, headingPath: string|null, content: string}, score: number}>} options.retrieved
 *   Top-K knowledge chunks, most relevant first.
 * @param {string[]} [options.issues] Citation failures from a previous attempt.
 * @param {object} [options.previousDraft] The draft those failures came from.
 * @returns {string}
 */
function buildComplianceAuditUserPrompt({ page, retrieved, issues, previousDraft }) {
  const sources = retrieved
    .map(({ chunk }) => {
      const headingAttr = chunk.headingPath ? ` heading="${chunk.headingPath}"` : ''
      return `<source id="${chunk.id}" file="${chunk.sourceFile}"${headingAttr}>\n${chunk.content}\n</source>`
    })
    .join('\n\n')

  const parts = [
    `<cited_sources>\n${sources}\n</cited_sources>`,
    `<page_under_audit>\n${serializePageForPrompt(page)}\n</page_under_audit>`,
  ]

  if (issues && issues.length) {
    // The retry turn, mirroring buildContentUserPrompt's: the rejected draft
    // has to travel with the instruction, or "fix these and change nothing
    // else" is not followable.
    if (previousDraft) {
      parts.push(`<previous_draft>\n${JSON.stringify(previousDraft, null, 2)}\n</previous_draft>`)
    }
    parts.push(
      `<validation_failures>\nThe draft above failed validation. Return the same audit with ` +
        `every item below fixed, and change nothing else.\n\n${issues
          .map((issue) => `- ${issue}`)
          .join('\n')}\n</validation_failures>`
    )
  }

  return parts.join('\n\n')
}
```

- [ ] **Step 7: Export the new functions**

Find (currently lines 187-192):

```javascript
module.exports = {
  buildContentSystemPrompt,
  buildContentUserPrompt,
  loadStyleCorpus,
  GUARDRAILS,
}
```

Replace with:

```javascript
module.exports = {
  buildContentSystemPrompt,
  buildContentUserPrompt,
  buildComplianceAuditSystemPrompt,
  buildComplianceAuditUserPrompt,
  loadStyleCorpus,
  GUARDRAILS,
}
```

- [ ] **Step 8: Write `compliance-audit.js`**

```javascript
// build_scripts/ai/compliance-audit.js
//
// Orchestration for the compliance-audit task: embed the page, retrieve the
// most relevant knowledge chunks, ground a provider call in them, validate
// citations against the retrieved set, retry once if any are unverifiable.
// Sibling of index.js's generateContent — kept separate rather than folded
// into it, since generateContent() stays exactly what it is today
// (hardcoded to PAGE_OUTPUT_SCHEMA/validateGeneratedPage) and this task's
// Gemini-only embedding dependency and citation-checking retry loop have
// nothing to do with the page-drafting path.
const { serializePageForPrompt, COMPLIANCE_AUDIT_OUTPUT_SCHEMA } = require('./schemas')
const { buildComplianceAuditSystemPrompt, buildComplianceAuditUserPrompt } = require('./prompts')
const { resolveProvider } = require('./providers')
const gemini = require('./provider-gemini')
const { retrieveRelevantChunks } = require('./knowledge-retrieval')
const { findInvalidCitations } = require('./validate-compliance-audit')
const { DISCLOSURE, addUsage } = require('./index')

/** Chunks retrieved per audit. Small enough that every retrieved chunk
 * plausibly fits the page under review, large enough to cover more than one
 * policy document when the page touches more than one topic. */
const TOP_K = 6

// One retry, not a loop — same reasoning as index.js's generateContent:
// a second attempt with the specific bad citations named fixes most
// mechanical mistakes, and a third rarely adds anything.
const MAX_ATTEMPTS = 2

/**
 * @param {object} options
 * @param {object} options.page The page open in the mockup.
 * @param {string} [options.provider] Which provider GENERATES the audit
 *   text. Independent of embeddings, which always run on Gemini regardless
 *   (see provider-gemini.js's embedContent doc comment) — a deployment can
 *   generate on Anthropic while still using Gemini purely for retrieval.
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<object>}
 */
async function generateComplianceAudit({ page, provider, signal }) {
  const selected = resolveProvider(provider)
  const pageText = serializePageForPrompt(page)

  const [queryEmbedding] = await gemini.embedContent([pageText], 'QUERY')
  const retrieved = retrieveRelevantChunks(queryEmbedding, TOP_K)
  const retrievedIds = new Set(retrieved.map((entry) => entry.chunk.id))
  const chunksById = new Map(retrieved.map((entry) => [entry.chunk.id, entry.chunk]))

  const { system } = buildComplianceAuditSystemPrompt()

  let issues = []
  let generated = null
  let attempts = 0
  const usage = {}
  const usageByAttempt = []

  while (attempts < MAX_ATTEMPTS) {
    const previousDraft = generated ? generated.object : undefined
    attempts += 1
    const userPrompt = buildComplianceAuditUserPrompt({
      page,
      retrieved,
      issues: attempts > 1 ? issues : undefined,
      previousDraft: attempts > 1 ? previousDraft : undefined,
    })

    generated = await selected.generateObject({
      system,
      userPrompt,
      jsonSchema: COMPLIANCE_AUDIT_OUTPUT_SCHEMA,
      signal,
    })
    addUsage(usage, generated.usage)
    usageByAttempt.push(generated.rawUsage || {})

    issues = findInvalidCitations(generated.object, retrievedIds)
    if (issues.length === 0) break
  }

  // The source_file/headingPath a reviewer reads is resolved server-side from
  // the matched chunk row, never echoed back from the model — real corpus
  // metadata, not model-generated text, even for a finding whose citation
  // failed validation (a reviewer can still see what it WAS trying to cite).
  const findings = generated.object.findings.map((finding) => ({
    ...finding,
    citedSources: (finding.citedChunkIds || [])
      .filter((id) => chunksById.has(id))
      .map((id) => {
        const chunk = chunksById.get(id)
        return { id: chunk.id, sourceFile: chunk.sourceFile, headingPath: chunk.headingPath }
      }),
  }))

  return {
    task: 'compliance-audit',
    // The RESOLVED provider, matching generateContent's convention: an
    // unnamed request still has to report which model actually answered.
    provider: selected.name,
    model: generated.model,
    attempts,
    valid: issues.length === 0,
    issues,
    findings,
    summary: generated.object.summary,
    usage,
    usageByAttempt,
    disclosure: DISCLOSURE,
  }
}

module.exports = { generateComplianceAudit, TOP_K, MAX_ATTEMPTS }
```

- [ ] **Step 9: Confirm no cycle and existing tests still pass**

Run: `bun test tests/ai-assist-schema.test.js tests/ai-assist-providers.test.js tests/ai-assist-env.test.js tests/validate-compliance-audit.test.js`
Expected: PASS. (`compliance-audit.js` imports `DISCLOSURE`/`addUsage` from `index.js`; `index.js` does not import `compliance-audit.js` — one-directional, no cycle. `server.ts`, added in Task 9, is what imports both.)

- [ ] **Step 10: Format and commit**

```bash
bun run format
git add build_scripts/ai/prompts.js build_scripts/ai/compliance-audit.js
git commit -m "feat: add compliance-audit prompt builders and citation-checked orchestration"
```

---

### Task 8: Ingestion script + `bun run ingest`

**Files:**
- Create: `build_scripts/ingest-knowledge.js`
- Modify: `package.json` (add the `ingest` script)

**Interfaces:**
- Consumes: `chunkMarkdown` (Task 1), `ensureKnowledgeChunksTable` (Task 3), `embedContent`/`isConfigured`/`getEmbeddingModel` (Task 4).
- Produces: a populated `knowledge_chunks` table. No other module consumes this script directly — it is a CLI entry point.

- [ ] **Step 1: Write the script**

```javascript
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
const { mkdirSync, readFileSync } = require('node:fs')
const { dirname, resolve } = require('node:path')
const fg = require('fast-glob')
const { chunkMarkdown } = require('./knowledge-chunking')
const { ensureKnowledgeChunksTable } = require('./knowledge-schema')
const gemini = require('./ai/provider-gemini')

const ROOT = resolve(__dirname, '..')
const SOURCE_DIR = resolve(ROOT, 'docs/source')
const DATA_DB_PATH = process.env.DATA_DB_PATH || resolve(ROOT, '.data/review-state.local.db')

// embedContent accepts a batch, but a very large one risks an upstream
// request-size or timeout limit. This corpus produces roughly 150-200 chunks
// total, so 20 keeps each call small while still batching most files.
const EMBED_BATCH_SIZE = 20

/** @param {string} relativePath e.g. "hhvc-policy/foo.md" -> "hhvc-policy" */
function categoryFor(relativePath) {
  return relativePath.split('/')[0]
}

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

  const files = fg
    .sync('**/*.md', { cwd: SOURCE_DIR, onlyFiles: true })
    .filter((file) => file.split('/').pop() !== 'README.md')
    .sort((a, b) => a.localeCompare(b))

  let totalChunks = 0
  const emptyFiles = []

  for (const relativePath of files) {
    const markdown = readFileSync(resolve(SOURCE_DIR, relativePath), 'utf8')
    const chunks = chunkMarkdown(markdown, relativePath)
    if (!chunks.length) {
      emptyFiles.push(relativePath)
      continue
    }

    const vectors = await embedAll(chunks.map((chunk) => chunk.content))
    const category = categoryFor(relativePath)
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
    console.log(`  ${relativePath}: ${chunks.length} chunks`)
  }

  console.log(`\nIngested ${files.length - emptyFiles.length} files, ${totalChunks} chunks.`)
  if (emptyFiles.length) {
    // No silent drops: a file that globbed as markdown but chunked to
    // nothing (e.g. whitespace-only) is named explicitly, not just missing
    // from the count above.
    console.log(`Files with no chunks after parsing: ${emptyFiles.join(', ')}`)
  }
}

main()
```

- [ ] **Step 2: Add the `ingest` script to `package.json`**

Find the `"scripts"` block's `"export"` entry (search for `"// export"`):

```json
    "// export": "Generates data/page_inventory.{json,csv} and syncs the local tracking sheet",
    "export": "bun build_scripts/extract-pages.js && bun build_scripts/sync-tracking-sheet.js",
```

Add immediately after it:

```json
    "// ingest": "Chunks docs/source/**/*.md, embeds via Gemini, and upserts into knowledge_chunks. Needs GEMINI_API_KEY. Manual, not part of the build pipeline.",
    "ingest": "bun build_scripts/ingest-knowledge.js",
```

- [ ] **Step 3: Format**

```bash
bun run format
```

- [ ] **Step 4: Commit**

```bash
git add build_scripts/ingest-knowledge.js package.json
git commit -m "feat: add bun run ingest to populate the RAG knowledge base"
```

- [ ] **Step 5: Manual verification (not covered by CI — same category of gap as the CSV/JSON import round-trip)**

This step needs a real `GEMINI_API_KEY` and makes real, billed embedding calls — do not run it in CI or without the reviewer's go-ahead.

```bash
GEMINI_API_KEY=<real key> bun run ingest
```

Expected: a per-file line for all ~41 non-README markdown files (42 total minus 1 README), a final "Ingested N files, M chunks" line with M roughly 150-250, and no "Files with no chunks" line (every file in this corpus has real content). Then spot-check one row:

```bash
bun -e "
const { Database } = require('bun:sqlite')
const db = new Database('.data/review-state.local.db')
const row = db.query('SELECT source_file, heading_path, substr(content, 1, 200) as preview FROM knowledge_chunks LIMIT 1').get()
console.log(row)
"
```

Expected: a real `source_file` path under `docs/source/`, a plausible `heading_path`, and `preview` text that reads as real HHVC policy content, not garbled or empty.

---

### Task 9: Wire `compliance-audit` into the server route and capabilities

**Files:**
- Modify: `server.ts`
- Modify: `build_scripts/ai/index.js`

**Interfaces:**
- Consumes: `generateComplianceAudit` (Task 7), `isComplianceAuditAvailable`/`countKnowledgeChunks` (Task 6), `getProvider` (already exported by `providers.js`).

- [ ] **Step 1: Add imports to `server.ts`**

Find (currently near the top of the file, per the header comment block):

```typescript
import { generateContent, getCapabilities, listModels } from "./build_scripts/ai/index.js"
```

Add immediately after it:

```typescript
// @ts-ignore - plain JS module, CommonJS. The compliance-audit task's
// orchestration — kept out of index.js because its Gemini-only embedding
// dependency has nothing to do with the page-drafting path.
import { generateComplianceAudit } from "./build_scripts/ai/compliance-audit.js"
// @ts-ignore - plain JS module, CommonJS.
import { isComplianceAuditAvailable } from "./build_scripts/ai/knowledge-retrieval.js"
```

Find:

```typescript
import { hasConfiguredProvider } from "./build_scripts/ai/providers.js"
```

Replace with:

```typescript
import { hasConfiguredProvider, getProvider } from "./build_scripts/ai/providers.js"
```

- [ ] **Step 2: Report compliance-audit availability from `getCapabilities()`**

In `build_scripts/ai/index.js`, find (currently lines 58-79):

```javascript
function getCapabilities() {
  const corpus = loadStyleCorpus()
  const providers = {}
  const models = {}
  const labels = {}
  for (const provider of REGISTRY) {
    const configured = provider.isConfigured()
    providers[provider.name] = configured
    models[provider.name] = configured ? provider.getModel() : null
    labels[provider.name] = provider.label
  }
  return {
    providers,
    models,
    providerLabels: labels,
    defaultProvider: configuredProviders()[0]?.name || null,
    tasks: ['content'],
    groundedBy: corpus.files,
    pageCount: Object.keys(getPages()).length,
    disclosureRequired: true,
  }
}
```

Replace with:

```javascript
function getCapabilities() {
  const corpus = loadStyleCorpus()
  const providers = {}
  const models = {}
  const labels = {}
  for (const provider of REGISTRY) {
    const configured = provider.isConfigured()
    providers[provider.name] = configured
    models[provider.name] = configured ? provider.getModel() : null
    labels[provider.name] = provider.label
  }
  // Read lazily, not at module load: knowledge_chunks can go from empty to
  // populated (a fresh `bun run ingest`) while the server keeps running.
  const { isComplianceAuditAvailable, countKnowledgeChunks } = require('./knowledge-retrieval')
  const knowledgeBaseReady = isComplianceAuditAvailable()
  return {
    providers,
    models,
    providerLabels: labels,
    defaultProvider: configuredProviders()[0]?.name || null,
    tasks: knowledgeBaseReady ? ['content', 'compliance-audit'] : ['content'],
    groundedBy: corpus.files,
    pageCount: Object.keys(getPages()).length,
    disclosureRequired: true,
    // So the browser panel can tell "no Gemini key" apart from "key present,
    // nobody has run `bun run ingest` yet" — both are real, distinct empty
    // states a reviewer could hit, and they want different copy.
    knowledgeBase: { ready: knowledgeBaseReady, chunkCount: countKnowledgeChunks() },
  }
}
```

(The `require` is inlined rather than hoisted to the top of `index.js` to avoid a module-load-order dependency between `index.js` and `knowledge-retrieval.js` — `knowledge-retrieval.js` does not import `index.js`, so this is not a cycle, but keeping the require local to the one function that needs it matches this file's existing "everything provider-specific stays out of the top-level surface" discipline.)

- [ ] **Step 3: Add the task-specific route gate in `server.ts`**

Find the block (currently around lines 986-989):

```typescript
  if (url.pathname === "/api/ai/generate" && req.method === "POST") {
    const roleResponse = requireApiRole(principal, API_ROLES.aiGenerate, context)
    if (roleResponse) return roleResponse
    if (!hasConfiguredProvider()) return noProvider()
```

Leave that block as-is (a generation provider is still required for every task), and find the block immediately after body parsing (currently around lines 1027-1035):

```typescript
    const parsed = generateRequestSchema.safeParse(body)
    if (!parsed.success) {
      return jsonResponse(
        { error: "Invalid request.", issues: parsed.error.issues },
        400,
        context.corsHeaders
      )
    }
```

Add immediately after it:

```typescript
    if (parsed.data.task === "compliance-audit" && !isComplianceAuditAvailable()) {
      const geminiConfigured = Boolean(getProvider("gemini")?.isConfigured())
      return jsonResponse(
        {
          error: geminiConfigured
            ? "No knowledge base has been ingested yet. Run `bun run ingest`."
            : "Compliance audits require GEMINI_API_KEY (used for embeddings), " +
              "even when generating with a different provider.",
        },
        501,
        context.corsHeaders
      )
    }
```

- [ ] **Step 4: Dispatch on task**

Find (currently around lines 1046-1048):

```typescript
    try {
      const result = await generateContent({ ...parsed.data, signal })
      return jsonResponse(result, 200, context.corsHeaders)
    } catch (error) {
      return aiErrorResponse(error, context, { client: req.signal, timeout })
    }
```

Replace with:

```typescript
    try {
      const result =
        parsed.data.task === "compliance-audit"
          ? await generateComplianceAudit({ ...parsed.data, signal })
          : await generateContent({ ...parsed.data, signal })
      return jsonResponse(result, 200, context.corsHeaders)
    } catch (error) {
      return aiErrorResponse(error, context, { client: req.signal, timeout })
    }
```

- [ ] **Step 5: Confirm the server still starts and existing tests still pass**

Run: `bun run server.ts & sleep 1; curl -s http://127.0.0.1:8080/api/ai/capabilities -o /dev/null -w '%{http_code}\n'; kill %1` (or the repo's existing smoke-test convention if one already exists — check `package.json` first)
Run: `bun test`
Expected: the pre-existing suite still passes; Task 10 below adds the first tests that actually exercise `compliance-audit`.

- [ ] **Step 6: Format and commit**

```bash
bun run format
git add server.ts build_scripts/ai/index.js
git commit -m "feat: wire compliance-audit into /api/ai/generate and capabilities"
```

---

### Task 10: Server integration tests for `compliance-audit`

**Files:**
- Modify: `tests/ai-assist-server.test.js`

**Interfaces:**
- Consumes: the existing `geminiStub`/`stub` test harness (already in this file), `spawnServer`, `waitForServer`, `VALID_PAGE`.

Read the full existing file first — it is long and this task depends on matching its exact conventions (`geminiStub.queue`, `geminiResponse()`, `spawnServer()` env var shape, `DATA_DB_PATH` pointed at a per-suite temp dir). The stub server at `GEMINI_STUB_PORT` (confirmed in the excerpt already read during planning, lines 217-291) answers `GET .../models` specially and treats every OTHER request — including an `embedContent` call, since its path does not end in `/models` — as one entry off the shared `geminiStub.queue`. A `compliance-audit` request makes two Gemini calls in sequence (embed the page, then generate the audit), so tests must queue two responses in that order.

- [ ] **Step 1: Add a compliance-audit describe block**

Add this as a new top-level `describe` block in `tests/ai-assist-server.test.js`, after the existing `describe('AI assist API (server.ts)', ...)` block's closing (match the file's existing `beforeAll`/`afterAll` pattern — this can reuse the SAME `proc`/`stubServer`/`geminiStubServer` from the surrounding describe if nested inside it, or spawn its own if the existing structure is flat; read the file to confirm which, then follow it):

```javascript
describe('compliance-audit task', () => {
  /** A Gemini embedContent response with one embedding. */
  function geminiEmbeddingResponse(values) {
    return { embeddings: [{ values }] }
  }

  /** Insert one knowledge chunk directly, bypassing the ingestion script. */
  function seedChunk(dbPath, { id, sourceFile, headingPath, content, embedding }) {
    const { Database } = require('bun:sqlite')
    const db = new Database(dbPath, { create: true })
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
    const buffer = Buffer.from(Float32Array.from(embedding).buffer)
    db.run(
      `INSERT INTO knowledge_chunks
       (id, source_file, category, heading_path, content, chunk_index, embedding, embedding_model, created_at)
       VALUES (?, ?, 'hhvc-policy', ?, ?, 0, ?, 'test-model', ?)`,
      [id, sourceFile, headingPath, content, buffer, new Date().toISOString()]
    )
    db.close()
  }

  test('returns 501 when GEMINI_API_KEY is not configured', async () => {
    // Reuses the existing suite's server, which IS configured with a Gemini
    // key — so this spawns a SEPARATE short-lived server with only Anthropic
    // configured, matching how other "unconfigured" tests in this file work.
    const dbDir = createTestDbDir('no-gemini')
    const proc2 = spawnServer({
      REVIEW_API_TOKEN: TOKEN,
      ANTHROPIC_API_KEY: 'sk-ant-stub',
      ANTHROPIC_BASE_URL: `http://127.0.0.1:${STUB_PORT}`,
      DATA_DB_PATH: path.join(dbDir, 'review-state.db'),
    })
    try {
      await waitForServer(`${base}/api/ai/capabilities`)
      const res = await fetch(`${base}/api/ai/generate`, {
        method: 'POST',
        headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
        body: JSON.stringify({ task: 'compliance-audit', page: VALID_PAGE }),
      })
      expect(res.status).toBe(501)
      const body = await res.json()
      expect(body.error).toContain('GEMINI_API_KEY')
    } finally {
      proc2.kill()
      fs.rmSync(dbDir, { recursive: true, force: true })
    }
  })

  test('returns 501 when no chunks have been ingested', async () => {
    // Reuses the full-suite server (both providers configured) but its
    // freshly-created, empty DB — so Gemini is configured and the gate is
    // specifically about an empty knowledge_chunks table.
    const res = await fetch(`${base}/api/ai/generate`, {
      method: 'POST',
      headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ task: 'compliance-audit', page: VALID_PAGE }),
    })
    expect(res.status).toBe(501)
    const body = await res.json()
    expect(body.error).toContain('bun run ingest')
  })

  test('embeds the page, retrieves the closest chunk, and returns cited findings', async () => {
    seedChunk(path.join(dbDir, 'review-state.db'), {
      id: 'hhvc-policy/rats.md#0',
      sourceFile: 'hhvc-policy/rats.md',
      headingPath: 'Reporting a sighting',
      content: 'Reporting a sighting\n\nCall 311 to report rats.',
      embedding: [1, 0, 0],
    })

    geminiStub.queue = [
      { body: geminiEmbeddingResponse([1, 0, 0]) },
      {
        body: geminiResponse({
          findings: [
            {
              issue: 'The page never mentions calling 311.',
              severity: 'error',
              citedChunkIds: ['hhvc-policy/rats.md#0'],
              recommendation: 'Add a step telling the reader to call 311.',
            },
          ],
          summary: 'One grounded finding about the missing 311 instruction.',
        }),
      },
    ]

    const res = await fetch(`${base}/api/ai/generate`, {
      method: 'POST',
      headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ task: 'compliance-audit', page: VALID_PAGE, provider: 'gemini' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.task).toBe('compliance-audit')
    expect(body.provider).toBe('gemini')
    expect(body.valid).toBe(true)
    expect(body.findings).toHaveLength(1)
    expect(body.findings[0].citedSources[0].sourceFile).toBe('hhvc-policy/rats.md')
    expect(body.disclosure).toContain('AI-assisted draft')

    // Two Gemini calls: the embed, then the generate.
    expect(geminiStub.requests).toHaveLength(2)
  })

  test('retries once when the model cites a chunk id that was never retrieved', async () => {
    seedChunk(path.join(dbDir, 'review-state.db'), {
      id: 'hhvc-policy/rats.md#0',
      sourceFile: 'hhvc-policy/rats.md',
      headingPath: 'Reporting a sighting',
      content: 'Reporting a sighting\n\nCall 311 to report rats.',
      embedding: [1, 0, 0],
    })

    geminiStub.queue = [
      { body: geminiEmbeddingResponse([1, 0, 0]) },
      {
        // First attempt cites an id that was never retrieved.
        body: geminiResponse({
          findings: [
            {
              issue: 'Bad citation',
              severity: 'error',
              citedChunkIds: ['nonexistent.md#0'],
              recommendation: 'x',
            },
          ],
          summary: 'x',
        }),
      },
      {
        // Second attempt cites the real, retrieved id.
        body: geminiResponse({
          findings: [
            {
              issue: 'Fixed citation',
              severity: 'error',
              citedChunkIds: ['hhvc-policy/rats.md#0'],
              recommendation: 'x',
            },
          ],
          summary: 'x',
        }),
      },
    ]

    const res = await fetch(`${base}/api/ai/generate`, {
      method: 'POST',
      headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ task: 'compliance-audit', page: VALID_PAGE, provider: 'gemini' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.attempts).toBe(2)
    expect(body.valid).toBe(true)
    expect(body.findings[0].issue).toBe('Fixed citation')
    // Embed once, generate twice: 3 Gemini calls total.
    expect(geminiStub.requests).toHaveLength(3)
    // The retry turn named the bad id from attempt 1.
    const retryPrompt = JSON.stringify(geminiStub.requests[2].contents)
    expect(retryPrompt).toContain('nonexistent.md#0')
  })

  test('rejects compliance-audit without a page', async () => {
    const res = await fetch(`${base}/api/ai/generate`, {
      method: 'POST',
      headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ task: 'compliance-audit' }),
    })
    expect(res.status).toBe(400)
  })
})
```

Adjust variable references (`dbDir`, `TOKEN`, `base`, `proc`, `stubServer`, `geminiStubServer`, `createTestDbDir`, `spawnServer`, `waitForServer`, `geminiResponse`) to whatever names the surrounding file already uses — read it first; this task's code above assumes the same names seen in the excerpt already read from this file (lines 1-291), but confirm before pasting since the full file was not read end-to-end during planning.

- [ ] **Step 2: Run the new tests**

Run: `bun test tests/ai-assist-server.test.js`
Expected: PASS, including the 4 new tests. If the "no GEMINI_API_KEY" test's separate server spawn is awkward given the file's actual structure, adjust to whatever pattern the file already uses for a differently-configured server (search for other `spawnServer(` calls with a subset of env vars in this file for precedent).

- [ ] **Step 3: Confirm the test file is already in `package.json`'s test list**

`tests/ai-assist-server.test.js` is an existing file being extended, not a new one. Run: `grep ai-assist-server package.json` — expect it already present. If missing, add it (it should not be).

- [ ] **Step 4: Format and commit**

```bash
bun run format
git add tests/ai-assist-server.test.js
git commit -m "test: cover the compliance-audit task's gates and happy path"
```

---

### Task 11: Register the three new pure-logic test files in `package.json`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add the new test files to the explicit test list**

Find the `"test"` script (currently the long space-separated list ending in `tests/ai-assist-server.test.js`). Add `tests/knowledge-chunking.test.js`, `tests/knowledge-search.test.js`, and `tests/validate-compliance-audit.test.js` to that list — this repo's tests are enumerated, not globbed, so a file left off this list passes locally but covers nothing in CI (this exact failure mode is documented in this repo's `CLAUDE.md` for a prior page-count test). Place them near the other pure-logic tests (e.g. after `tests/decision-vocabulary.test.js`).

- [ ] **Step 2: Run the full suite**

Run: `bun run test`
Expected: PASS — all tests including the two new files, now via `bun run test` rather than only `bun test <file>` directly.

- [ ] **Step 3: Format and commit**

```bash
bun run format
git add package.json
git commit -m "test: register knowledge-chunking and knowledge-search in the test script"
```

---

### Task 12: `CLAUDE.md` and `AGENTS.md` documentation

**Files:**
- Modify: `CLAUDE.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Add a "RAG knowledge base (optional)" section to `CLAUDE.md`**

Place it immediately after the existing "AI assist backend (optional)" section (search for its closing bullet, `**Netlify** (\`build:netlify\`) has no server runtime, so the static deploy...`). Write the section in this repo's established voice — verbose, explanatory, `**Bold label:**` bullets stating a non-obvious fact and why it matters — covering:

- What it is: a `knowledge_chunks` table in the same `DATA_DB_PATH` SQLite file, populated by `bun run ingest`, backing the `compliance-audit` task on `/api/ai/generate`.
- The corpus is `docs/source/**/*.md` (README.md files excluded), including the one `DRAFT-NOT-FOR-PUBLICATION` file, per an explicit decision not to filter by publication status.
- Embeddings are Gemini-only (`text-embedding-004` by default, `GEMINI_EMBEDDING_MODEL` overrides) since Anthropic has no embeddings API — this is why `compliance-audit` specifically needs `GEMINI_API_KEY` even when generating on Anthropic.
- Retrieval is brute-force cosine similarity in JS (`build_scripts/knowledge-search.js`), not a vector-index extension — the corpus is small enough (~150-200 chunks) that this is microseconds of work, and a native extension would add Railway-deployment risk for no benefit.
- Chunking (`build_scripts/knowledge-chunking.js`) splits on `##`/`###` headings, then sub-splits sections over 500 words at paragraph boundaries with a 50-word overlap, prefixing every chunk with its heading path.
- Re-ingestion is idempotent per file (delete-then-reinsert by `source_file`) — safe to re-run `bun run ingest` after editing `docs/source/`.
- `GET /api/ai/capabilities` reports `knowledgeBase: {ready, chunkCount}` so the browser can distinguish "no Gemini key" from "key present, nobody has ingested yet".
- Same posture as every other AI-touching piece: additive, off unless configured, fails closed (501, not silently degraded), never writes anything, and every result carries the same `disclosure` string.
- Pointer to the full design rationale: `docs/superpowers/specs/2026-08-07-rag-knowledge-base-design.md`.

Write this as complete prose matching the surrounding section's density — do not leave it as a bullet outline. Read at least the immediately preceding "AI assist backend (optional)" section in full before writing, to match its exact register.

- [ ] **Step 2: Update the "Editing rules (quick reference)" section**

Find the line:

```
  Shared merge/history logic → `js/review-merge.js` (loaded both as a browser
```

In the same list, add an entry for the new files: `build_scripts/knowledge-chunking.js`, `build_scripts/knowledge-search.js`, `build_scripts/knowledge-schema.js`, `build_scripts/ingest-knowledge.js`, `build_scripts/ai/knowledge-retrieval.js`, and `build_scripts/ai/compliance-audit.js` → RAG knowledge base.

- [ ] **Step 3: Mirror the same section into `AGENTS.md`**

Per this repo's cross-tool-canon rule (`AGENTS.md` is the tool-agnostic source of truth; `CLAUDE.md` mirrors it), add the equivalent section to `AGENTS.md` in the same location relative to its own "AI assist backend" section. Read `AGENTS.md`'s existing AI-assist section first to match ITS voice, which may differ slightly in phrasing from `CLAUDE.md`'s even though the facts are identical.

- [ ] **Step 4: Verify the doc-counts drift guard still passes**

Run: `bun test tests/doc-counts.test.js`
Expected: PASS — this task does not change the page count, only adds a new section, but the guard also checks other quoted counts; confirm nothing in the new prose accidentally introduces a number that guard interprets as a page count (e.g. avoid phrasing like "the 20 pages" inside the new section).

- [ ] **Step 5: Format and commit**

```bash
bun run format:check
git add CLAUDE.md AGENTS.md
git commit -m "docs: document the RAG knowledge base and compliance-audit task"
```

---

### Task 13 (optional, non-blocking): SQLite MCP server for local DB inspection

**Files:**
- Create: `.mcp.json` (or modify, if one already exists — recheck, since the audit at the start of this feature's design found none)

This task is explicitly lower-priority per the design spec and does not block any other task — it is developer tooling, not part of the shipped feature.

- [ ] **Step 1: Check for an existing `.mcp.json`**

Run: `test -f .mcp.json && cat .mcp.json || echo "none"`

- [ ] **Step 2: Add a SQLite MCP server entry**

If none exists, create `.mcp.json`:

```json
{
  "mcpServers": {
    "hhvc-sqlite": {
      "command": "npx",
      "args": ["-y", "@executeautomation/database-server", "--sqlite", ".data/review-state.local.db"]
    }
  }
}
```

Verify the exact package name and CLI flags against its current published documentation before committing — this plan's audit did not confirm this specific package's interface, only that the local file path is safe to commit (unlike a Postgres connection string, it carries no credential). If `@executeautomation/database-server`'s actual flags differ, adjust to match.

- [ ] **Step 3: Commit**

```bash
git add .mcp.json
git commit -m "chore: add a local SQLite MCP server for DB inspection during development"
```

---

## Self-Review

**Spec coverage:** Schema (Task 3) ✓, chunking (Task 1) ✓, ingestion script + `bun run ingest` (Task 8) ✓, retrieval/cosine search (Tasks 2, 6) ✓, `compliance-audit` as an independent sibling function rather than a `generateContent()` refactor (Task 7) ✓, citation-id verification against the retrieved set with a retry loop (Task 7) ✓, discriminated request schema (Task 5) ✓, no `knowledge_corpus_meta`/`--full` flag per the reconciled spec's Non-goals (intentionally absent) ✓, `capabilities` reporting (Task 9) ✓, testing (Tasks 1, 2, 5, 7, 10, 11) ✓, docs (Task 12) ✓, MCP (Task 13, explicitly optional) ✓. Manual ingestion verification called out in Task 8 Step 5 per the spec's explicit non-CI-coverable gap.

**Placeholder scan:** No TBD/TODO left in any step; every code block is complete, runnable code, not a description of what to write.

**Type consistency:** `chunkMarkdown` (Task 1) → `{sourceFile, headingPath, content, chunkIndex}`, consumed identically in Task 8's ingestion script and Task 10's test seeding. `topKBySimilarity` (Task 2) → `{chunk, score}`, consumed identically in Task 6's `retrieveRelevantChunks` and Task 7's `compliance-audit.js` (`entry.chunk`, `entry.score`). `embedContent(texts, taskType)` (Task 4) called consistently with `'DOCUMENT'`/`'QUERY'` string literals in Task 8 and Task 7. `isComplianceAuditAvailable`/`countKnowledgeChunks` (Task 6) used identically in Task 9's `index.js` and `server.ts` edits. `findInvalidCitations(result, retrievedIds)` (Task 7) has the exact same signature in its own test (Task 7 Step 1) and its caller in `generateComplianceAudit` (Task 7 Step 8). `citedChunkIds` (not `citedSource`/`citedHeading`) is the field name consistently used across Task 5's schema, Task 7's prompt builder/orchestration/validator, and Task 10's tests — the earlier free-text-citation draft was fully replaced, not left as a second, inconsistent shape alongside the new one.
