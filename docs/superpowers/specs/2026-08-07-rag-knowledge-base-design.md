# Design: RAG knowledge base + compliance-audit task on the AI assist backend

## Problem

The reviewer wants an AI-assisted compliance audit that grounds its findings in this
project's actual reference material (`docs/source/hhvc-policy/`, `docs/source/sfgov-style/`)
rather than the model's unaided judgment — retrieval-augmented generation (RAG) over that
corpus, surfaced as a new capability on the existing optional AI assist backend.

The original request specified a stack this repo does not use and would introduce in
parallel with what already exists in code: Express (this repo's `server.ts` uses
`Bun.serve` directly), Railway Postgres + `pgvector` (the sync backend already runs on
`bun:sqlite`, designed to sit on a Railway volume), OpenAI
embeddings/GPT-4o (the existing AI backend is built on a two-provider registry — Anthropic
and Gemini — and Anthropic has no embeddings API), and a new `./knowledge-source/` markdown
folder (this repo already vendors the relevant reference material under `docs/source/`).
This design adapts the same goal — chunk markdown, embed it, retrieve by similarity, feed
an LLM a grounded audit prompt — onto the stack and conventions this repo already has,
rather than duplicating a second backend alongside the first.

**Deployment is a prerequisite, not existing infrastructure.** As of this writing, this
repository has no Railway project at all — `server.ts`'s `bun:sqlite`/volume design is
code that runs correctly locally (`.data/review-state.local.db`) but has never been
deployed anywhere `knowledge_chunks` could persist across restarts. Everything below that
assumes a shared, persistent `DATA_DB_PATH` (retrieval reading what ingestion wrote, both
across server restarts) requires: (1) a Railway service actually deployed from this repo's
`server.ts`, with (2) a volume mounted and `DATA_DB_PATH` pointed at it. Both must exist
*before* `bun run ingest` is run against production, or ingestion writes to a path that
evaporates on the next deploy and retrieval finds an empty table. This is called out again
at the storage section below, since it is the single most likely way this feature silently
does nothing in production.

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
`DATA_DB_PATH` (the file that holds `review_pages` today) — one connection, one file to
back up, matching how `review_pages` already works rather than introducing a second DB
path/connection to manage. In production this file must live on the Railway volume
described in the Problem section's deployment-prerequisite note above: if `bun run ingest`
is ever run against a `DATA_DB_PATH` that is not the deployed server's persisted path (a
local laptop run, a redeploy that lost the volume mount), it silently succeeds while
writing rows the running server will never see, and retrieval will look correctly wired
while permanently returning zero results.

```sql
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id TEXT PRIMARY KEY,           -- `${source_file}#${chunk_index}`, stable across re-ingests
  source_file TEXT NOT NULL,     -- path relative to docs/source/, e.g. "hhvc-policy/2026-07-02-ipm-pests-rats.md"
  category TEXT NOT NULL,        -- "hhvc-policy" | "sfgov-style", derived from the top-level subfolder
  heading_path TEXT,             -- "## Section > ### Subsection", for citation display
  content TEXT NOT NULL,         -- the chunk text, heading-path prefixed
  chunk_index INTEGER NOT NULL,
  embedding BLOB NOT NULL,       -- Float32Array serialized via .buffer
  embedding_model TEXT NOT NULL, -- e.g. "gemini-embedding-001", per row — see corpus metadata below
  created_at TEXT NOT NULL
)

CREATE TABLE IF NOT EXISTS knowledge_corpus_meta (
  -- Single-row table (id is always 'default'): the embedding model/dimension the CURRENT
  -- contents of knowledge_chunks were embedded with, corpus-wide. Exists because cosine
  -- similarity between an embedding from model A and one from model B is meaningless —
  -- the two vector spaces are not comparable — so retrieval must know it is looking at one
  -- consistent space, not silently average scores across two.
  id TEXT PRIMARY KEY,
  embedding_model TEXT NOT NULL,
  embedding_dimension INTEGER NOT NULL,
  updated_at TEXT NOT NULL
)
```

**Both `CREATE TABLE IF NOT EXISTS` statements are defined once, in a shared helper —
`build_scripts/knowledge-schema.js` — imported by both `server.ts` (called at startup,
right where `review_pages`'s own `CREATE TABLE IF NOT EXISTS` already runs) and
`build_scripts/ingest-knowledge.js`.** Ingestion cannot assume `server.ts` has ever run
first: a fresh clone's first setup step is plausibly `bun run ingest`, not `bun run dev`,
and without a shared helper the table either doesn't exist yet (ingestion crashes on
`INSERT`) or two independently hand-written `CREATE TABLE` statements drift out of sync
over time. One helper, called from both places, makes "which one owns the schema" not a
question that needs an answer.

**Re-ingestion is per-file only when the embedding model hasn't changed; a model change
forces a full rebuild, never a partial one.** At the start of `bun run ingest`, read
`knowledge_corpus_meta`. If the table is empty (first run) or its `embedding_model`
matches what this run would use, per-file re-ingestion proceeds as before: `DELETE FROM
knowledge_chunks WHERE source_file = ?` followed by a fresh batch insert, one transaction
per file, and `knowledge_corpus_meta` is upserted with the (unchanged) model/dimension at
the end. If `knowledge_corpus_meta.embedding_model` does not match, partial re-ingestion is
refused outright — the script prints which files changed and which did not, and requires
an explicit `--full` flag that wipes `knowledge_chunks` entirely before re-embedding every
file, so the table can never hold two embedding spaces at once. `knowledge-search.js`'s
retrieval path also checks `knowledge_corpus_meta` before running similarity: if the row
is missing (nothing ingested yet) or `knowledge_chunks` contains more than one distinct
`embedding_model` value (a `--full` rebuild that died partway through), it returns a
retrieval-unavailable error rather than a plausible-looking top-K ranked across two
incompatible vector spaces.

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
5. Open the same `DATA_DB_PATH` database `server.ts` uses, calling the shared
   `build_scripts/knowledge-schema.js` helper first to create `knowledge_chunks` and
   `knowledge_corpus_meta` if they don't exist yet — ingestion cannot assume `server.ts`
   has run before it has. Then follow the per-file vs. full-rebuild re-ingestion rule from
   the storage section above, keyed on whether `knowledge_corpus_meta.embedding_model`
   matches this run's model.
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

### `generateContent()` becomes a task dispatcher — it is not one today

**Correction to an earlier draft of this design:** the phrase "the existing task enum" above
described something that does not exist in the code. `build_scripts/ai/index.js`'s
`generateContent()` is a single hardcoded function: it always calls `buildContentUserPrompt()`,
always sends `PAGE_OUTPUT_SCHEMA` as the response schema, and always validates the result
with `validateGeneratedPage()`, which runs a full HHVC page object through `pageSchema` plus
this repo's link/list/banned-term invariants. `getCapabilities()` reports `tasks: ['content']`
as a literal one-element array, and `generateRequestSchema` in `schemas.js` is
`task: z.enum(['content'])` — a second task value is rejected by Zod before the route body
ever runs. `compliance-audit` cannot be "a new value on the existing enum" without first
making the enum, and the machinery behind it, actually dispatch on task:

- `build_scripts/ai/index.js` gets a `TASKS` registry: `{ content: {...}, 'compliance-audit':
  {...} }`, one entry per task, each providing `buildUserPrompt`, `jsonSchema`, `validate`,
  and `buildResult` (the shape of the final resolved object — `content`'s is the page object
  plus `groundedBy`; `compliance-audit`'s is `{findings, summary}` as fixed below).
  `generateContent({ task, ...options })` looks up the entry and keeps everything that
  is genuinely task-agnostic — provider resolution, the `MAX_ATTEMPTS` retry loop's control
  flow, `addUsage`/`usageByAttempt` accounting, and the mandatory `disclosure` string — as
  shared code that calls into the per-task functions rather than being copy-pasted per task.
- `validateGeneratedPage()` stays exactly what it is today — the `content` task's validator,
  unchanged — rather than being generalized into something that also has to make sense for
  an audit result. `compliance-audit` gets its own validator (below), not a bent version of
  this one.
- `getCapabilities().tasks` becomes `configuredTasks()` (real array, `content` always present,
  `compliance-audit` present only when its own gate — Gemini configured *and*
  `knowledge_chunks` non-empty — passes), and `generateRequestSchema` becomes the
  discriminated union described next.

### Citations must be verifiable, not free text the model can invent

An earlier draft of the output schema was `{findings: [{issue, severity, citedSource,
citedHeading, recommendation}], summary, disclosure}`, with `citedSource`/`citedHeading` as
free-text strings the model fills in. Nothing stops the model from citing a document that
was never retrieved, misquoting a heading, or citing something plausible-sounding that
doesn't exist in `docs/source/` at all — exactly the failure mode this whole feature exists
to prevent (grounding a finding in real reference material, not the model's unaided
judgment). The fix moves citation identity out of free text and into the retrieved set the
server already controls:

- Retrieval already returns each chunk with a stable `id` (`${source_file}#${chunk_index}`,
  per the storage section above). The user-turn prompt is built listing each retrieved
  chunk under its `id`, and findings must cite by `id`, not by restating a source/heading
  from memory: `{findings: [{issue, severity, citedChunkIds: string[], recommendation}],
  summary}`. `citedChunkIds` requires at least one entry — an uncited finding is exactly the
  "unaided judgment" failure mode this design exists to prevent, so the schema enforces
  citing something rather than relying on the model to volunteer it.
- After generation, the route resolves every `citedChunkIds` entry against the actual
  retrieved set (not the whole table — only the chunks this specific request retrieved) and
  rejects any ID that doesn't match, feeding it back through the same
  validate-then-retry-with-issues loop `generateContent()` already runs for `content`:
  the retry prompt names exactly which finding cited an unknown ID, the same way a `content`
  retry names which plain-language rule failed. A finding surviving both attempts with a bad
  citation is returned anyway (per this file's existing "always resolves with the draft, valid
  or not" principle) but flagged `valid: false` with the bad ID named in `issues`, so a
  reviewer sees exactly which finding not to trust rather than the audit silently dropping it.
- The `source_file`/`heading_path` text a reviewer actually reads is resolved server-side
  from the matched chunk row, not echoed back from the model — the response's rendered
  citation is always real corpus metadata, never model-generated text, even when the model's
  own phrasing of the source was accurate.
- `build_scripts/ai/validate-output.js` gets a sibling to `validateGeneratedPage()` —
  `validateComplianceAudit(result, retrievedChunkIds)` — doing exactly this ID-membership
  check plus the existing shape/enum checks (`severity` against a fixed enum, non-empty
  `issue`/`recommendation` strings). This is the `compliance-audit` entry's `validate`
  function in the `TASKS` registry above.

### Request shape: a discriminated union, not one shared shape

The original plan — `{task: 'compliance-audit', page}`, prompt omitted — does not fit the
current `generateRequestSchema = z.object({ task: z.enum(['content']), prompt:
z.string().min(1).max(8000), page: ... })`: `prompt` is required and non-empty for every
request today, so a `compliance-audit` call with no `prompt` is rejected by Zod before
`generateContent()` is ever reached, regardless of what the route body does. Fixing this
needs the schema itself to vary by task, not an extra `if` inside one fixed shape:

```js
const generateRequestSchema = z.discriminatedUnion('task', [
  z.object({
    task: z.literal('content'),
    prompt: z.string().min(1).max(8000),
    page: pageSchema.partial().optional(),
    provider: providerEnum.optional(),
  }),
  z.object({
    task: z.literal('compliance-audit'),
    page: pageSchema, // required — an audit has nothing to audit without it
    provider: providerEnum.optional(),
    // no `prompt` field: this task's grounding comes from retrieval, not free text
  }),
])
```

`js/ai-assist-client.js`'s `generate({ task, prompt, page, provider, signal })` currently
always sends `prompt` as part of the request body. It needs a task-conditional branch that
omits `prompt` entirely for `compliance-audit` rather than sending an empty string (which
`z.string().min(1)` would reject identically to a missing field) — the panel UI similarly
should not render a prompt textarea for a task that does not use one.

### Route flow (updated to reflect the task dispatcher and citation fix above)

Inside the `compliance-audit` branch of `/api/ai/generate`, before the provider call:

1. Serialize `page` via the existing `serializePageForPrompt()` (already the single
   shared measurement point between the size-cap check and what's actually sent, per the
   existing byte-stability rule).
2. Embed that serialized text via the same `embedContent` method the ingestion script uses.
3. Retrieve the top 6 chunks via `knowledge-search.js` (after `knowledge-search.js`'s own
   corpus-consistency check from the storage section above — a mismatched or missing
   `knowledge_corpus_meta` row fails this step with a clear error before any provider call
   is made, rather than surfacing as an unexplained empty or wrong-looking audit).
4. Build the user turn: each retrieved chunk listed under its `id` (its
   `source_file`/`heading_path` included for the model to reference in its reasoning, but
   citation *identity* is the `id`, per the citation-verifiability fix above) + the page
   content. The system prompt stays byte-stable per the existing `prompts.js` caching rule —
   retrieved content is request-specific and belongs in the user turn, not the cached system
   prompt.
5. Call `generateObject` on the resolved provider (Anthropic or Gemini — same registration
   order/fallback the other tasks use; a request naming an unconfigured provider still gets
   the existing 400 with the list of what's available) against the new schema:
   `{findings: [{issue, severity, citedChunkIds, recommendation}], summary}`, run through
   `TASKS['compliance-audit'].validate` (i.e. `validateComplianceAudit`) inside the same
   retry loop `content` uses.
6. `COMPLIANCE_AUDIT_OUTPUT_SCHEMA` (a `PAGE_OUTPUT_SCHEMA` sibling) lives in
   `build_scripts/ai/schemas.js` alongside the existing ones, so `tests/ai-assist-schema.test.js`
   guards it the same way, and the `provider` enum on both schemas stays derived from
   `allProviderNames()` per this repo's existing "never hardcode the provider list twice" rule.

Gate posture matches every other task: `hasConfiguredProvider()` still gates at the route
level (not hoisted, so an unmatched path stays a 404, not a blanket 501), and this task adds
one more implicit gate — no `GEMINI_API_KEY` means no embeddings are possible, so
`compliance-audit` specifically needs Gemini configured even on a deployment that only has
an Anthropic key for the other tasks. `capabilities` should report this task's availability
as `geminiConfigured && knowledge_chunks row count > 0 && knowledge_corpus_meta is
consistent` (the last clause per the storage section's embedding-space-mixing guard), so the
panel can distinguish "no Gemini key" from "key present but nobody's run `bun run ingest`
yet" from "ingestion is mid-rebuild and retrieval is temporarily refusing requests" — three
real, distinct empty/unavailable states a reviewer could hit.

## Testing

- `tests/knowledge-chunking.test.js` — header-splitting, 500-word sub-splitting, overlap,
  heading-path prefixing. Pure function, no DB, no network.
- `tests/knowledge-search.test.js` — cosine similarity + top-K ranking against synthetic
  embeddings, *and* the corpus-consistency guard: a synthetic `knowledge_chunks` fixture
  seeded with two distinct `embedding_model` values, or a missing/empty
  `knowledge_corpus_meta`, must return the retrieval-unavailable error rather than a ranked
  result. Pure function, no real Gemini call.
- `tests/validate-output.test.js` (existing file, extended) gets cases for
  `validateComplianceAudit`: a finding whose `citedChunkIds` includes an ID outside the
  retrieved set is rejected with that ID named in `issues`; an empty `citedChunkIds` array
  is rejected (citing nothing is not a valid finding); a `severity` outside the fixed enum
  is rejected; a well-formed result with all citations inside the retrieved set validates
  clean.
- `tests/ai-assist-schema.test.js` (existing file, extended) gets the `compliance-audit`
  branch of the discriminated `generateRequestSchema`: a `content` request without `prompt`
  is still rejected (unchanged behavior), a `compliance-audit` request *with* a `prompt`
  field is rejected (the union has no such field on that branch — a client sending one is a
  bug worth surfacing, not silently ignored), and a `compliance-audit` request without
  `page` is rejected.
- `tests/ai-assist-server.test.js` gets a new `describe` block for `task: 'compliance-audit'`
  against the existing stub-endpoint harness (stub Gemini embeddings + stub
  Anthropic/Gemini generation), covering: a normal grounded audit, a stub response citing an
  unretrieved chunk ID (asserts the retry-with-named-issue path fires, mirroring the
  existing `content` retry tests), and `capabilities` correctly reporting
  `compliance-audit` as unavailable when the stub `knowledge_chunks` table is empty — same
  pattern as every other task, no real API key, no paid call, no live SQLite fixture beyond
  what the harness already spins up.
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
