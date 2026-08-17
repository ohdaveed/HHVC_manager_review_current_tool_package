---
name: hhvc-rag-knowledge-base
description: HHVC repo: the compliance-audit RAG feature — docs/source corpus ingestion, chunking, Gemini-only embeddings, brute-force cosine retrieval, and citation validation against the retrieved set. Load before editing build_scripts/knowledge-*.js, build_scripts/ai/compliance-audit.js, or ingest-knowledge.js.
---

<!-- Extracted from CLAUDE.md/AGENTS.md on 2026-08-13. AGENTS.md remains the
     canonical copy of this content; see "Cross-tool canon" there. -->

# RAG knowledge base (optional)

`compliance-audit` is a second `/api/ai/generate` task alongside `content`: a
grounded compliance audit of the open page, citing this repo's own
`docs/source/` corpus instead of the model's unaided judgment. Same posture as
the rest of the AI backend — additive, off unless configured, fails closed,
never writes anything, and every result carries the same `disclosure` string.

- **Corpus is `docs/source/**/*.md` plus an explicit outside list, `README.md`
  excluded, publication status not filtered.**
  `build_scripts/knowledge-sources.js` globs the whole `docs/source/` tree
  except folder-index `README.md` files — including the one file named
  `DRAFT-NOT-FOR-PUBLICATION`, on an explicit reviewer decision. The
  alternative was the ingestion script silently deciding what counts as
  citable, which is the failure mode this feature exists to avoid.
  `EXTERNAL_SOURCE_FILES` in the same module carries the documents that live
  outside that tree as `{path, category}` pairs — the Karl captures, the SF.gov
  cross-type reading, and the HHVC Web Governance and Content Standards Manual,
  which `js/plain-language.js` cites by section for every scored `error` rule
  and which was absent from the corpus until 2026-08-16. **A superseded
  document is deliberately kept out**: the chunker prefixes a chunk with its
  heading path and never with the file's opening banner, so a "these claims are
  now wrong" header cannot travel with chunk 40. That module's own exclusion
  register names each excluded file and why.
- **`notebooklm/compliance-standards.csv` is projected, not committed.** It is
  the corpus's one non-markdown source and the only place a requirement and the
  code section imposing it share a row.
  `projectComplianceMatrixToMarkdown()` renders it at ingest time as
  `hhvc-policy/compliance-standards-matrix.md`, one `###` per requirement (203
  of them, 204 chunks, median 46 words) so each retrieves as its own citable
  provision. `retrieveRelevantChunks()` is a flat top-K with no per-category
  floor, so short formulaic chunks that embed toward each other can spend the
  whole top-6 on one provision family — the standards manual's prose is what
  loses that race. Grouping by code section (~61 longer chunks) is the recorded
  fallback; measure it as "does an audit of a pest page still cite
  `hhvc-standards`".
- **Measured 2026-08-16: 95 documents, 1230 chunks** across `hhvc-standards`,
  `hhvc-policy`, `sfgov-style`, `sfgov-live`, `karl`, `karl-gitbook`, `sfds`
  and `mockup-draft`. Measure with the real pages loaded — with no `pages`
  option `collectKnowledgeSources()` omits `mockup-draft` and the total looks
  like a regression. Adding a category means adding it to
  `buildComplianceAuditSystemPrompt()` too, which enumerates what each one is
  worth; a category the prompt cannot weigh reaches the reviewer as an
  unranked tag.
- **One new table, same store as `review_pages`.** `knowledge_chunks` lives
  wherever `build_scripts/storage.js` points — Postgres when `DATABASE_URL` is
  set, SQLite at `DATA_DB_PATH` otherwise — rather than a second database to
  configure. Both the write path (`build_scripts/ingest-knowledge.js`) and the
  read path (`build_scripts/ai/knowledge-retrieval.js`) go through that seam, so
  an ingest writes where the server reads. They did NOT, briefly, and the
  failure was silent: on Postgres the read path opened an empty local SQLite
  file, so `compliance-audit` reported itself unready however many times anyone
  ingested. The two processes cannot
  disagree on the schema, and ingestion never assumes the server ran first.
- **Chunking splits on headings, then on size.**
  `build_scripts/knowledge-chunking.js` splits on `##`/`###` headings, then
  sub-splits anything over 500 words at paragraph boundaries with a 50-word
  overlap, and prefixes every chunk with its heading path before embedding —
  so a boundary fact keeps its context and a chunk carries its own section
  location with no join back to the source file needed.
- **Embeddings are Gemini-only** — Anthropic has no embeddings API — so
  `compliance-audit` needs `GEMINI_API_KEY` even on a deployment generating
  with Claude. Default model `gemini-embedding-001`, overridable via
  `GEMINI_EMBEDDING_MODEL`. (Was `text-embedding-004` until a real `bun run
ingest` run 404'd on it — retired; verify against `client.models.list()`
  filtered to `embedContent` support, not a doc example, before trusting any
  hardcoded id here again.)
- **Retrieval is brute-force cosine similarity in JS, not a vector-index
  extension.** `build_scripts/knowledge-search.js` ranks the full corpus
  (~150-200 chunks) by cosine similarity in microseconds at this size; a
  loadable extension like `sqlite-vec` would buy nothing here and adds a
  native-binary deployment risk against Railway for no benefit. Dual-exported
  like `js/review-merge.js`, so ranking is tested against synthetic embeddings
  with no live Gemini call and no live DB.
- **Re-ingestion is idempotent per file, and always full.** `bun run ingest`
  deletes and reinserts each file's rows in one transaction, reprocessing
  every file on every run rather than diffing — so a re-run after editing
  `docs/source/` or changing `GEMINI_EMBEDDING_MODEL` is always safe, and no
  stale mix of two embedding models can accumulate. Manual, like
  `bun run export` — not part of `bun run build`, since it needs a real
  (billed) Gemini call CI must not make.
- **`GET /api/ai/capabilities` reports `knowledgeBase: {ready, chunkCount}`**
  so the browser can distinguish "no Gemini key" from "key present, nobody's
  run `bun run ingest` yet" — different states, different copy.
- **Citations are checked against the retrieved set, not accepted as free
  text.** Findings cite chunk ids (`${source_file}#${chunk_index}`), not a
  restated source/heading — the failure mode this guards against is a
  plausible-sounding citation that was never actually retrieved.
  `build_scripts/ai/validate-compliance-audit.js`'s `findInvalidCitations()`
  checks every cited id against what was retrieved for that request, and
  rejects an empty `citedChunkIds` too. A bad citation triggers one retry
  naming the specific finding and id; a finding still bad after that retry is
  returned anyway (same "always resolves with the draft" rule as `content`)
  but flagged `valid: false` with the bad id in `issues`. The
  `source_file`/`heading_path` shown to a reviewer is resolved server-side
  from the matched row, never echoed from the model.
- **The route gates on knowledge-base readiness separately from the generic
  no-provider gate.** `hasConfiguredProvider()` still gates first, same as
  `content`; past that, `compliance-audit` checks Gemini-configured **and**
  `knowledge_chunks` non-empty, answering 501 with which half is missing.
  `generateComplianceAudit()` (`build_scripts/ai/compliance-audit.js`) is a
  sibling to `generateContent()`, not a generalization of it — its own retry
  loop, rather than bending the existing task's machinery to fit a second,
  structurally different validator.
- **Never writes anything**, same as `content` — no filesystem, no
  review-state write, no `pages/*.js` mutation, and every successful audit
  carries the same `disclosure` string for the same §1.11/AI-disclosure
  reasons.
- Full design rationale, including what was deliberately left out (a
  corpus-wide embedding-model table, a task-dispatching registry refactor of
  `generateContent()`), is in
  `docs/superpowers/specs/2026-08-07-rag-knowledge-base-design.md`.
