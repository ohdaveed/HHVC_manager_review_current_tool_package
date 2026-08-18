# Design: RAG knowledge base + compliance-audit task on the AI assist backend

## Problem

The reviewer wants an AI-assisted compliance audit that grounds its findings in this
project's actual reference material (`docs/source/hhvc-policy/`, `docs/source/sfgov-style/`)
rather than the model's unaided judgment — retrieval-augmented generation (RAG) over that
corpus, surfaced as a new capability on the existing optional AI assist backend.

The original request specified a stack this repo does not use and would introduce in
parallel with what already exists and is deployed: Express (this repo's `server.ts` uses
`Bun.serve` directly), Railway Postgres + `pgvector` (the sync backend already runs on
`bun:sqlite` against a Railway volume, deployed as the `sync-api` service — confirmed live
via `railway status` during this design's review), OpenAI embeddings/GPT-4o (the existing AI
backend is built on a two-provider registry — Anthropic and Gemini — and Anthropic has no
embeddings API), and a new `./knowledge-source/` markdown folder (this repo already vendors
the relevant reference material under `docs/source/`). This design adapts the same goal —
chunk markdown, embed it, retrieve by similarity, feed an LLM a grounded audit prompt — onto
the stack and conventions this repo already has, rather than duplicating a second backend
alongside the first.

## Goals

- A reviewer can request an AI compliance audit of the currently-open page mockup, grounded
  in the real HHVC policy/style corpus, with cited sources per finding.
- No new backend, no new hosted database, no new external vendor. Reuses `bun:sqlite`
  (already the sync backend's storage, already deployed on the Railway volume behind
  `sync-api`), the existing Gemini provider config (already a dependency, already in the
  provider registry), and the existing `/api/ai/generate` route's provider resolution,
  timeout/abort, and disclosure machinery.
- Same posture as every other AI-touching piece of this tool: entirely additive, off unless
  configured (`GEMINI_API_KEY` unset → ingestion and the new task both no-op/501 the same way
  the rest of `/api/ai/*` does today), never writes to `pages/*.js` or review state, and every
  successful audit result carries the same disclosure string the rest of `generate` does.
- Citations are verifiable, not free text the model can invent — a finding must cite a chunk
  that was actually retrieved for that request, checked server-side.

## Non-goals

- Not building a general-purpose RAG service — the corpus is exactly `docs/source/**/*.md`
  (42 files, ~86.5k words, an estimated ~150-200 chunks at ~500 words/chunk), a size where a
  loadable vector-index extension (`sqlite-vec`) buys nothing and only adds a native-binary
  deployment risk against Railway's runtime. Brute-force cosine similarity in plain JS is
  microseconds of work at this scale.
- Not adding OpenAI, Postgres, Express, or any dependency beyond what's already in
  `package.json` (`@google/genai` covers embeddings; `fast-glob` already covers file
  discovery for the ingestion script).
- Not changing what `docs/source/` contains or how `js/standards/plain-language.js` uses
  `docs/source/sfgov-style/` today — this design only adds a second consumer (the ingestion
  script) reading the same files.
- Not filtering the corpus by publication status. Per an explicit reviewer decision, the one
  file named `DRAFT-NOT-FOR-PUBLICATION` is included in ingestion like every other file — the
  reviewer chose to accept that a draft could surface as a cited source in an audit rather
  than have the ingestion script silently apply an editorial filter.
- Not making ingestion automatic on deploy/build. `docs/source/` changes rarely; re-running
  `bun run ingest` by hand (like `bun run export`) is cheap and keeps ingestion out of the
  critical path of every `bun run build`.
- Not refactoring `generateContent()` into a task-dispatching registry. It stays exactly what
  it is today — a `content`-only function, unchanged — and `compliance-audit` gets its own
  sibling function (`generateComplianceAudit()`) with its own retry loop, called directly by
  the route based on the request's `task`. This is a smaller, lower-risk change than
  generalizing the one existing task's machinery to also fit a second, structurally different
  one (a page draft with plain-language rules vs. a citation-checked audit).
- Not tracking a corpus-wide embedding model/version table. The ingestion script re-embeds
  and re-inserts *every* file on *every* run (never a partial or incremental re-ingest — see
  the ingestion section below), so a stale mix of two embedding models across
  `knowledge_chunks` cannot occur except if the script is killed mid-run; the practical
  mitigation is "let it finish, or just re-run it" given how cheap a full re-ingest is at this
  corpus size, not a second table and a `--full` rebuild flag for a failure mode this design
  doesn't otherwise create.

## Architecture

### Storage: one new table, existing database

`knowledge_chunks` is added to the same SQLite file `server.ts` already opens at
`DATA_DB_PATH` (the file that holds `review_pages` today, on the already-deployed Railway
volume) — one connection, one volume, one file to back up, matching how `review_pages`
already works rather than introducing a second DB path/connection to manage.

```sql
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id TEXT PRIMARY KEY,           -- `${source_file}#${chunk_index}`, stable across re-ingests
  source_file TEXT NOT NULL,     -- path relative to docs/source/, e.g. "hhvc-policy/2026-07-02-ipm-pests-rats.md"
  category TEXT NOT NULL,        -- "hhvc-policy" | "sfgov-style", derived from the top-level subfolder
  heading_path TEXT,             -- "## Section > ### Subsection", for citation display
  content TEXT NOT NULL,         -- the chunk text, heading-path prefixed
  chunk_index INTEGER NOT NULL,
  embedding BLOB NOT NULL,       -- Float32Array serialized via .buffer
  embedding_model TEXT NOT NULL, -- e.g. "text-embedding-004" — a model change is detectable per row
  created_at TEXT NOT NULL
)
```

The table definition lives in one shared helper — `build_scripts/knowledge-schema.js` — used
by both the read path (`build_scripts/ai/knowledge-retrieval.js`, opened by the running
server) and the write path (`build_scripts/ingest-knowledge.js`), so the two processes cannot
define this table differently, and ingestion does not need to assume the server has ever run
first (a fresh clone's first setup step could plausibly be `bun run ingest` before `bun run
dev`).

Re-ingestion is idempotent per file: `DELETE FROM knowledge_chunks WHERE source_file = ?`
followed by a fresh batch insert, in one transaction per file — and the ingestion script
always processes every file in the corpus on every run (not just changed ones), so the whole
table is rebuilt from the current `docs/source/` content and the current `embedding_model`
every time. Re-running `bun run ingest` after editing `docs/source/`, or after changing
`GEMINI_EMBEDDING_MODEL`, is always safe.

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
`js/standards/plain-language.js`).

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
   necessity, not preference). Model id `text-embedding-004`, confirmed against live
   `@google/genai` docs, overridable via `GEMINI_EMBEDDING_MODEL`.
5. Open the same `DATA_DB_PATH` database `server.ts` uses (calling the shared
   `knowledge-schema.js` helper first to create `knowledge_chunks` if it doesn't exist yet),
   and delete-and-reinsert every file's rows, one transaction per file.
6. Print a summary: files processed, chunks written — no silent drops, matching this repo's
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

### New task: `compliance-audit`, as a sibling function, not a route or a registry

`compliance-audit` is a new value on `POST /api/ai/generate`'s request schema, but it is
**not** implemented by generalizing `generateContent()` — that function stays exactly what it
is today (hardcoded to `PAGE_OUTPUT_SCHEMA` and `validateGeneratedPage()`), and a new sibling,
`generateComplianceAudit()` (`build_scripts/ai/compliance-audit.js`), handles the new task.
The route (`server.ts`) picks which one to call based on `parsed.data.task`. This reuses
provider resolution, the `req.signal` + `AbortSignal.timeout()` cancellation handling, and the
mandatory `disclosure` string every other task already gets — `generateComplianceAudit()` runs
its own retry loop, structured the same way `generateContent()`'s is (attempt, validate, retry
once with the specific failures named), rather than sharing a generalized loop across two
structurally different validators.

### Citations must be verifiable, not free text the model can invent

A finding's citation is the biggest place this feature could quietly fail at its own job:
nothing stops a model from citing a document that was never retrieved, misquoting a heading,
or citing something plausible-sounding that does not exist in `docs/source/` at all — exactly
the "unaided judgment" failure mode RAG exists to prevent. The fix moves citation identity out
of free text and into the retrieved set the server already controls:

- Retrieval returns each chunk with a stable `id` (`${source_file}#${chunk_index}`). The
  user-turn prompt lists each retrieved chunk under its `id`, and findings cite by `id`, not
  by restating a source/heading from memory: `{findings: [{issue, severity,
  citedChunkIds: string[], recommendation}], summary}`.
- After generation, `generateComplianceAudit()` checks every `citedChunkIds` entry against the
  actual retrieved set for that request (not the whole table) via
  `build_scripts/ai/validate-compliance-audit.js`'s `findInvalidCitations()`. An empty
  `citedChunkIds` array is also rejected — citing nothing is not a valid finding. Any issue
  found feeds back into a retry turn naming exactly which finding cited an unknown or missing
  id, mirroring `content`'s retry-with-named-issues pattern. A finding surviving both attempts
  with a bad citation is still returned (per this file's existing "always resolves with the
  draft, valid or not" principle) but the response is flagged `valid: false` with the bad id
  named in `issues`, so a reviewer sees exactly which finding not to trust.
- The `source_file`/`heading_path` a reviewer actually reads is resolved server-side from the
  matched chunk row (via the retrieved set already held in memory for that request), never
  echoed back from the model — the response's rendered citation is always real corpus
  metadata.

### Request shape: a discriminated union

`generateRequestSchema` becomes a Zod discriminated union on `task`, since `content` and
`compliance-audit` need genuinely different shapes (a required `prompt` vs. a required `page`
and no `prompt` at all), which a single object with optional fields plus `.refine()` checks
expresses less clearly than two literal branches:

```js
const providerSchema = z.enum(allProviderNames())

const generateRequestSchema = z.discriminatedUnion('task', [
  z.object({
    task: z.literal('content'),
    provider: providerSchema.optional(),
    prompt: z.string().min(1).max(8000),
    page: groundingPageSchema.optional(),
  }),
  z.object({
    task: z.literal('compliance-audit'),
    provider: providerSchema.optional(),
    page: groundingPageSchema,
  }),
])
```

Each branch is a plain `z.object()` (not `.strict()`): an unrecognized field is silently
stripped, matching this schema's existing behavior for every other field, rather than
introducing a new class of 400 this design doesn't otherwise need. A `compliance-audit`
request that also sends `prompt` simply has it ignored.

### Route flow

Inside the `compliance-audit` branch of `/api/ai/generate`, before the provider call:

1. Serialize `page` via the existing `serializePageForPrompt()` (already the single shared
   measurement point between the size-cap check and what's actually sent, per the existing
   byte-stability rule).
2. Embed that serialized text via the same `embedContent` method the ingestion script uses,
   with `taskType: 'RETRIEVAL_QUERY'` (ingestion uses `'RETRIEVAL_DOCUMENT'` — the Gemini API's
   own docs recommend matching task type to role for retrieval quality).
3. Retrieve the top 6 chunks via `knowledge-search.js`.
4. Build the user turn: each retrieved chunk listed under its `id` (with its
   `source_file`/`heading_path` shown for the model's own reasoning, but citation *identity*
   is the `id`) plus the page content. The system prompt stays byte-stable per the existing
   `prompts.js` caching rule — retrieved content is request-specific and belongs in the user
   turn, not the cached system prompt.
5. Call `generateObject` on the resolved provider (Anthropic or Gemini — same registration
   order/fallback the other tasks use; a request naming an unconfigured provider still gets
   the existing 400 with the list of what's available) against `COMPLIANCE_AUDIT_OUTPUT_SCHEMA`,
   then validate citations via `findInvalidCitations()` inside the retry loop described above.
6. `COMPLIANCE_AUDIT_OUTPUT_SCHEMA` lives in `build_scripts/ai/schemas.js` alongside
   `PAGE_OUTPUT_SCHEMA`, so `tests/ai-assist-schema.test.js` guards it the same way, and the
   `provider` enum on the request schema stays derived from `allProviderNames()` per this
   repo's existing "never hardcode the provider list twice" rule.

Gate posture matches every other task: `hasConfiguredProvider()` still gates at the route
level (not hoisted, so an unmatched path stays a 404, not a blanket 501), and this task adds
one more implicit gate — no `GEMINI_API_KEY` means no embeddings are possible, so
`compliance-audit` specifically needs Gemini configured even on a deployment that only has an
Anthropic key for the other tasks. `capabilities` reports this task's availability as
`geminiConfigured && knowledge_chunks row count > 0`, so the panel can distinguish "no Gemini
key" from "key present but nobody's run `bun run ingest` yet" — both are real, distinct empty
states a reviewer could hit.

## Testing

- `tests/knowledge-chunking.test.js` — header-splitting, 500-word sub-splitting, overlap,
  heading-path prefixing. Pure function, no DB, no network.
- `tests/knowledge-search.test.js` — cosine similarity + top-K ranking against synthetic
  embeddings. Pure function, no real Gemini call.
- `tests/ai-assist-schema.test.js` (existing file, extended) gets the `compliance-audit`
  branch of the discriminated `generateRequestSchema` and `COMPLIANCE_AUDIT_OUTPUT_SCHEMA`'s
  required fields/enum.
- `tests/ai-assist-server.test.js` gets a new `describe` block for `task: 'compliance-audit'`
  against the existing stub-endpoint harness (stub Gemini embeddings + stub
  Anthropic/Gemini generation), covering: the two availability gates (no Gemini key; no
  ingested chunks), a normal grounded audit with valid citations, and a request missing
  `page` — same pattern as every other task, no real API key, no paid call, no live SQLite
  fixture beyond what the harness already spins up plus directly-seeded rows.
- Both new pure-logic test files are added to `package.json`'s explicit `test` script list
  (this repo's tests are enumerated, not globbed) as part of the implementation plan, not left
  to run only when invoked by hand.
- The ingestion script itself (real chunking of the real corpus, a real Gemini embedding
  call, a real DB write) is not unit-testable end-to-end without a paid call — same category
  of gap as the CSV/JSON import round-trip, which is manually verified rather than
  covered by CI. This gets called out explicitly as a manual verification step in the
  implementation plan: run `bun run ingest` against a real `GEMINI_API_KEY`, confirm
  `knowledge_chunks` row count and a spot-checked chunk's content look right.

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

## Revision note

This spec went through two review passes before implementation: an initial draft, then a
review pass (from a separate concurrent session) that correctly identified the citation-
verifiability gap and the need for a discriminated request schema, but also introduced two
things this revision removes: a `knowledge_corpus_meta` table plus mandatory `--full` rebuild
flag (addressing an embedding-model-mixing scenario that cannot occur given this design's
always-re-embed-everything ingestion script — see Non-goals), a `TASKS` registry refactor of
`generateContent()` (unnecessary since `compliance-audit` is implemented as an independent
sibling function instead), and a claim that "this repository has no Railway project at all"
(false — confirmed live via `railway status` both before and after that review pass).
