# Design: RAG knowledge base + compliance-audit task on the AI assist backend

## Problem

The reviewer wants an AI-assisted compliance audit that grounds its findings in this
project's actual reference material (`docs/source/hhvc-policy/`, `docs/source/sfgov-style/`)
rather than the model's unaided judgment — retrieval-augmented generation (RAG) over that
corpus, surfaced as a new capability on the existing optional AI assist backend.

The original request specified a stack this repo does not use and would introduce in
parallel with what already exists and is deployed: Express (this repo's `server.ts` uses
`Bun.serve` directly), Railway Postgres + `pgvector` (the sync backend already runs on
`bun:sqlite` against a Railway volume, deployed as the `sync-api` service), OpenAI
embeddings/GPT-4o (the existing AI backend is built on a two-provider registry — Anthropic
and Gemini — and Anthropic has no embeddings API), and a new `./knowledge-source/` markdown
folder (this repo already vendors the relevant reference material under `docs/source/`).
This design adapts the same goal — chunk markdown, embed it, retrieve by similarity, feed
an LLM a grounded audit prompt — onto the stack and conventions this repo already has,
rather than duplicating a second backend alongside the first.

## Goals

- A reviewer can request an AI compliance audit of the currently-open page mockup, grounded
  in the real HHVC policy/style corpus, with cited sources per finding.
- No new backend, no new hosted database, no new external vendor. Reuses `bun:sqlite`
  (already the sync backend's storage), the existing Gemini provider config (already a
  dependency, already in the provider registry), and the existing `/api/ai/generate` route's
  provider resolution, retry, timeout/abort, and disclosure machinery.
- Same posture as every other AI-touching piece of this tool: entirely additive, off unless
  configured (`GEMINI_API_KEY` unset → ingestion and the new task both no-op/501 the same way
  the rest of `/api/ai/*` does today), never writes to `pages/*.js` or review state, and every
  successful audit result carries the same disclosure string the rest of `generate` does.

## Non-goals

- Not building a general-purpose RAG service — the corpus is exactly `docs/source/**/*.md`
  (42 files, ~86.5k words, an estimated ~150-200 chunks at ~500 words/chunk), a size where a
  loadable vector-index extension (`sqlite-vec`) buys nothing and only adds a native-binary
  deployment risk against Railway's runtime. Brute-force cosine similarity in plain JS is
  microseconds of work at this scale.
- Not adding OpenAI, Postgres, Express, or any dependency beyond what's already in
  `package.json` (`@google/genai` covers embeddings; `fast-glob` already covers file
  discovery for the ingestion script).
- Not changing what `docs/source/` contains or how `js/plain-language.js` uses
  `docs/source/sfgov-style/` today — this design only adds a second consumer (the ingestion
  script) reading the same files.
- Not filtering the corpus by publication status. Per an explicit reviewer decision, the one
  file named `DRAFT-NOT-FOR-PUBLICATION` is included in ingestion like every other file — the
  reviewer chose to accept that a draft could surface as a cited source in an audit rather
  than have the ingestion script silently apply an editorial filter.
- Not making ingestion automatic on deploy/build. `docs/source/` changes rarely; re-running
  `bun run ingest` by hand (like `bun run export`) is cheap and keeps ingestion out of the
  critical path of every `bun run build`.

## Architecture

### Storage: one new table, existing database

`knowledge_chunks` is added to the same SQLite file `server.ts` already opens at
`DATA_DB_PATH` (the file that holds `review_pages` today) — one connection, one Railway
volume, one file to back up, matching how `review_pages` already works rather than
introducing a second DB path/connection to manage.

```sql
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id TEXT PRIMARY KEY,           -- `${source_file}#${chunk_index}`, stable across re-ingests
  source_file TEXT NOT NULL,     -- path relative to docs/source/, e.g. "hhvc-policy/2026-07-02-ipm-pests-rats.md"
  category TEXT NOT NULL,        -- "hhvc-policy" | "sfgov-style", derived from the top-level subfolder
  heading_path TEXT,             -- "## Section > ### Subsection", for citation display
  content TEXT NOT NULL,         -- the chunk text, heading-path prefixed
  chunk_index INTEGER NOT NULL,
  embedding BLOB NOT NULL,       -- Float32Array serialized via .buffer
  embedding_model TEXT NOT NULL, -- e.g. "gemini-embedding-001" — a model change is detectable
  created_at TEXT NOT NULL
)
```

Re-ingestion is idempotent per file: `DELETE FROM knowledge_chunks WHERE source_file = ?`
followed by a fresh batch insert, in one transaction per file. Re-running `bun run ingest`
after editing `docs/source/` is always safe.

### Chunking

Each markdown file is split on `##`/`###` headers first, keeping a section's ideas
together; any resulting section over ~500 words is further split at paragraph boundaries
with a ~50-word overlap between adjacent chunks, so a fact near a chunk boundary doesn't
lose its surrounding context. Every chunk is prefixed with its heading path (e.g. "IPM:
Rats > Reporting a sighting: ...") before embedding, so the embedded text and what's later
shown to the model both carry section context — the retrieval step doesn't need a separate
join back to the source document to explain where a chunk came from.

Pure function, no I/O: `build_scripts/knowledge-chunking.js`, dual-exported
(`window`/`module.exports`) per this repo's existing convention for logic that needs to be
unit-testable without a browser or a live DB (mirrors `js/review-merge.js`,
`js/plain-language.js`).

### Ingestion script: `build_scripts/ingest-knowledge.js`

A `build_scripts/*.js` file run via `bun run`, not a TypeScript file — matches the existing
`extract-pages.js`/`sync-tracking-sheet.js` siblings, not `server.ts`. Steps:

1. `fast-glob` for `docs/source/**/*.md` (already a dependency, already used by
   `build_scripts/load-pages.js`'s sibling scripts for their own globbing).
2. Skip `README.md` files — they're folder-level indexes, not corpus content.
3. Chunk each file via `knowledge-chunking.js`.
4. Batch-embed chunks via a new `embedContent` method added to
   `build_scripts/ai/provider-gemini.js` (the embeddings-capable half of the existing
   two-provider registry; Anthropic has no embeddings API, so this is Gemini-only by
   necessity, not preference).
5. Open the same `DATA_DB_PATH` database `server.ts` uses; delete-and-reinsert per source
   file, one transaction per file.
6. Print a summary: files processed, chunks written, files skipped (e.g. the `.pdf`/`.pptx`/
   `.docx`/`.xlsx` originals with no `.md` extract) — no silent drops, matching this repo's
   existing "no silent caps" convention for anything that bounds or filters coverage.

`package.json` gets `"ingest": "bun run build_scripts/ingest-knowledge.js"`.

### Retrieval: `build_scripts/knowledge-search.js`

Pure function, dual-exported like the chunking module: cosine similarity between a query
embedding and the corpus, returning top-K. Testable against synthetic embeddings with no
real Gemini call and no live DB — the ranking logic is what's under test, not the embedding
API.

At request time, all `knowledge_chunks` rows are loaded once and cached in memory
(module-level), invalidated by checking `DATA_DB_PATH`'s mtime against the cache's
load time — so a fresh `bun run ingest` is picked up without a server restart, without
re-querying SQLite on every audit request.

### New task: `compliance-audit` on the existing `/api/ai/generate` route

Per the reviewer's explicit choice, this is a new value on the existing task enum, not a
new route — it reuses provider resolution, the `req.signal` + `AbortSignal.timeout()`
cancellation handling, the retry-with-validation-feedback loop, usage normalization, and the
mandatory `disclosure` string every other task already gets, rather than re-implementing
that machinery a second time.

Request shape is unchanged from the other tasks — `{task: 'compliance-audit', page}` — no
new client-facing field. Inside the route, before the provider call:

1. Serialize `page` via the existing `serializePageForPrompt()` (already the single
   shared measurement point between the size-cap check and what's actually sent, per the
   existing byte-stability rule).
2. Embed that serialized text via the same `embedContent` method the ingestion script uses.
3. Retrieve the top 6 chunks via `knowledge-search.js`.
4. Build the user turn: retrieved chunks (each carrying its `source_file`/`heading_path` as
   an inline citation) + the page content. The system prompt stays byte-stable per the
   existing `prompts.js` caching rule — retrieved content is request-specific and belongs in
   the user turn, not the cached system prompt.
5. Call `generateObject` on the resolved provider (Anthropic or Gemini — same registration
   order/fallback the other tasks use; a request naming an unconfigured provider still gets
   the existing 400 with the list of what's available) against a new schema:
   `{findings: [{issue, severity, citedSource, citedHeading, recommendation}], summary,
   disclosure}`.
6. `PAGE_OUTPUT_SCHEMA`-style JSON Schema lives in `build_scripts/ai/schemas.js` alongside
   the existing ones, so `tests/ai-assist-schema.test.js` guards it the same way.

Gate posture matches every other task: `hasConfiguredProvider()` still gates at the route
level (not hoisted, so an unmatched path stays a 404, not a blanket 501), and this task adds
one more implicit gate — no `GEMINI_API_KEY` means no embeddings are possible, so
`compliance-audit` specifically needs Gemini configured even on a deployment that only has
an Anthropic key for the other tasks. `capabilities` should report this task's availability
as `geminiConfigured && knowledge_chunks row count > 0`, so the panel can distinguish "no
Gemini key" from "key present but nobody's run `bun run ingest` yet" — both are real,
distinct empty states a reviewer could hit.

## Testing

- `tests/knowledge-chunking.test.js` — header-splitting, 500-word sub-splitting, overlap,
  heading-path prefixing. Pure function, no DB, no network.
- `tests/knowledge-search.test.js` — cosine similarity + top-K ranking against synthetic
  embeddings. Pure function, no real Gemini call.
- `tests/ai-assist-server.test.js` gets a new `describe` block for `task: 'compliance-audit'`
  against the existing stub-endpoint harness (stub Gemini embeddings + stub
  Anthropic/Gemini generation) — same pattern as every other task, no real API key, no paid
  call, no live SQLite fixture beyond what the harness already spins up.
- Both new test files are added to `package.json`'s explicit `test` script list (this repo's
  tests are enumerated, not globbed) as part of the implementation plan, not left to run only
  when invoked by hand.
- The ingestion script itself (real chunking of the real corpus, a real Gemini embedding
  call, a real DB write) is not unit-testable end-to-end without a paid call — same category
  of gap as the CSV/JSON import round-trip, which is manually verified rather than
  covered by CI. This gets called out explicitly as a manual verification step in the
  implementation plan: run `bun run ingest` against a real `GEMINI_API_KEY`, confirm
  `knowledge_chunks` row count and a spot-checked chunk's content/citation look right.

## Docs

- New CLAUDE.md section, "RAG knowledge base (optional)", placed alongside the existing "AI
  assist backend (optional)" section and written in the same voice — additive, off unless
  configured, fails closed, documents the exact gate conditions above.
- AGENTS.md gets the same section, per this repo's existing cross-tool-canon mirroring rule.
- `.github/copilot-instructions.md` stays a pointer per the same rule — no new summary added
  there.

## MCP (optional, non-blocking)

The original request's `@modelcontextprotocol/server-postgres` config doesn't apply — there
is no Postgres in this design. As a lower-priority, non-blocking addition, the implementation
plan can add a SQLite-flavored MCP server entry to this repo's `.mcp.json`, pointed at the
local `.data/review-state.local.db` path (safe to commit — it's a file path, not a
credential), so Claude Code can inspect `knowledge_chunks`/`review_pages` directly during
development. This is a developer-tooling convenience, not part of the shipped feature, and
does not block the rest of this design.
