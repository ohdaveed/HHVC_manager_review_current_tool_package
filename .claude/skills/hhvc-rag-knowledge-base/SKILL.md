---
name: hhvc-rag-knowledge-base
description: 'HHVC repo: the compliance-audit RAG feature — docs/source corpus ingestion, chunking, Gemini-only embeddings, brute-force cosine retrieval, and citation validation against the retrieved set, plus what the corpus contains, why the `karl` category is an explicit file list rather than a glob, and why `mockup-draft` is the dangerous one. Load before editing build_scripts/knowledge-*.js, build_scripts/ai/compliance-audit.js, or ingest-knowledge.js.'
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
  citable, which is the failure mode this feature exists to avoid. What each
  category holds, why the outside list is a list rather than a second glob, and
  the measured document and chunk counts are all in **What the corpus
  contains** below — stated once, there, rather than summarized here as well.
- **Adding a category means adding it to `buildComplianceAuditSystemPrompt()`
  too**, which enumerates what each one is worth; a category the prompt cannot
  weigh reaches the reviewer as an unranked tag.
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

## What the corpus contains (`build_scripts/knowledge-sources.js`)

One glob (`docs/source/**/*.md`) used to define the corpus, which excluded both
the newest Karl capture and the mockup copy under review.
`collectKnowledgeSources()` is now the single definition, and every chunk
carries a `category`: `hhvc-standards` (the HHVC Web Governance and Content
Standards Manual), `hhvc-policy`, `sfgov-style`, `sfgov-live` (dated snapshots
of live SF.gov, plus the cross-type reading of them), `karl` (live editor
measurements, listed explicitly because they live outside `docs/source/`),
`karl-gitbook` (the Help Center's own published rules), `mockup-draft` (the
`pages/*.js` mockups, projected to markdown at ingest time and not committed),
and `sfds` (the vendored SF Design System token capture and its recorded
disagreements).

- **`EXTERNAL_SOURCE_FILES` is an explicit `{path, category}` list, not a
  glob**, because those documents live outside `docs/source/`. It was a flat
  path list that all became `karl` until 2026-08-16 — true while the only
  outside documents were Karl captures, and false the moment the standards
  manual came in. **Adding a file here moves the measured counts below**, so
  re-measure and re-ingest rather than editing the list alone.
- **The content standards manual is the addition worth understanding.**
  `js/standards/plain-language.js` cites it by section number for every scored
  `severity: 'error'` rule (§7.x, §6.3), and it was not in the corpus at all —
  it lives in `notebooklm/`, which no glob reached. A reviewer could not get
  from a citation back to the manual section the tool's own checks are named
  after. Added 2026-08-16, worth +75 chunks.
- **`karl` and `karl-gitbook` are separate on purpose** — the CMS as MEASURED
  versus as DOCUMENTED. They have disagreed four times over, and the prompt
  says the measurement wins.
- **The compliance matrix is projected from CSV, not converted.**
  `notebooklm/compliance-standards.csv` is the only place a requirement and the
  code section imposing it share a row, which is what lets a finding name a
  provision. `projectComplianceMatrixToMarkdown()` renders it at ingest time as
  `hhvc-policy/compliance-standards-matrix.md` — same treatment as `pages/*.js`,
  so no committed copy can drift from it. One `###` per requirement, 203 of
  them, 204 chunks, median 46 words. **`retrieveRelevantChunks()` is a flat
  top-6 with no per-category floor**, and short formulaic chunks embed toward
  each other — so a pest-page query can
  spend the whole top-6 on one provision family, and the document most at risk
  is the standards manual added in the same pass. Grouping by code section
  (~61 longer chunks) is the fallback; measure it as "does an audit of a pest
  page still cite `hhvc-standards`" before reaching for it.
- **A superseded document cannot carry its own warning**, because the chunker
  prefixes each chunk with its heading path and never with the file's opening
  banner. That is why `docs/wagtail-content-mapping.md`, the Help Center
  research note, `hhvc_chapter_drafts/**` and the dated audit records are
  excluded, and why draft Page Blueprints in `notebooklm/` are never filed as
  policy. `build_scripts/knowledge-sources.js` carries the register with the
  reason per file.
- **Category comes from the first path segment under `docs/source/`**, so a new
  folder files itself with no code change.
- **`mockup-draft` is about a quarter of the corpus and is the dangerous one** —
  draft copy nobody approved, including the page being audited. The prompt's
  source tag now carries `category`, the system prompt states what each category
  is worth, and it forbids citing draft copy as the authority a finding rests
  on. Resolved from the matched row, so the model cannot spoof it; it also
  travels with the citation the reviewer sees.
- Folder `README.md` files are excluded, so provenance notes stay uncitable.
- Measured 2026-08-16: **95 documents, 1230 chunks** (`hhvc-policy` 46/714,
  `mockup-draft` 29/233, `karl` 4/102, `hhvc-standards` 1/75, `sfgov-live`
  7/52, `karl-gitbook` 5/28, `sfgov-style` 2/24, `sfds` 1/2). Was 78/812 on
  2026-08-15; the compliance matrix is 204 of the added chunks, which is why
  `hhvc-policy` jumped 510 to 714 while gaining one document. **Measure with
  the real pages** — no `pages` option omits `mockup-draft` and looks like a
  regression. Still brute-force cosine.
- **`bun run ingest` is yours to run and is billed.** Nothing in CI or the
  build does it, so a corpus change is not live on a deployment until it runs.
- **`knowledge_chunks` is behind the storage seam**, so on Railway an ingest
  writes to Postgres and `compliance-audit` reports ready — verified by querying
  the deployed database directly, which held **816 chunks across 78 documents**
  after a re-ingest on 2026-08-17, matching the on-disk measurement above
  category for category. **That is a record of what that ingest wrote, not a
  standing guarantee**: the deployed count drifts behind the corpus the moment
  an ingested document is edited without a re-ingest, and it had, twice —
  the reading before this one was `chunkCount: 768`, 48 short, because it
  predated both `docs/karl-export-field-map.md` joining the `karl` category and
  the `sfds` category existing at all. A later reading of 812 was 4 short for
  the same reason, from edits to that file's own register. Those are CHUNK
  counts, not document counts — `sfds` is a single ingested document,
  `docs/source/sfds/disagreements.md`, because `collectKnowledgeSources()` takes
  only `**/*.md` and skips `README.md`, so the sibling `tokens.json` is not in
  the corpus and there is no second source to go looking for. Read the live
  count from `/api/ai/capabilities` rather than from this line.
- **Ingesting against the deployed Postgres needs two services' variables**, and
  `railway run` supplies one service's: `DATABASE_URL` is Postgres's and
  `GEMINI_API_KEY` is web's. The deployed `DATABASE_URL` also names
  `postgres.railway.internal`, which does not resolve off-platform, so rebuild
  it against `RAILWAY_TCP_PROXY_DOMAIN`/`RAILWAY_TCP_PROXY_PORT` rather than
  reusing the value the service sees.
