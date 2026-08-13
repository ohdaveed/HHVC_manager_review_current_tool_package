# Implementation brief: move review-state sync onto a cloud database

**Audience:** an AI coding agent working in this repository.
**Status:** brief, not a decision. Two questions at the bottom are deliberately
left open and must be answered by a human before implementation starts.

---

## What you are being asked to build

The HHVC manager-review tool already has a working, optional review-state sync
backend. It stores every reviewer's decisions in a local SQLite file next to the
server process. Replace that storage layer with a **hosted cloud database**, so
that reviewers on different machines converge on one shared review record
without anyone running a server themselves.

This is a storage-layer change with a concurrency problem hiding inside it. It is
not a rewrite of the sync protocol, and it is not a change to how the tool
behaves when sync is switched off.

---

## What exists today — read this before proposing anything

Do not take the following on trust. Every claim here is checkable in the files
named, and you should check the ones your design depends on.

**The tool is browser-first and works with no server at all.** Reviewer state
lives under the versioned `localStorage` key `hhvcManagerReviewState:v1`
(`js/review-state-store.js`), read and written synchronously through
`window.reviewState.read()/write()/update()`. The Netlify deploy is static and
has no runtime for any of the API routes. **This must remain true after your
change.** A reviewer who never configures sync must observe zero behavioural
difference and zero network requests.

**Sync is opt-in, per browser, and manual-trigger only.** `js/review-state-sync.js`
is a no-op unless configured. Its settings live under their own `localStorage`
key, `hhvcReviewSyncConfig`, deliberately separate from the review state itself,
so that a sync token can never round-trip through the shareable CSV/JSON
export/import files. There is no background timer; the reviewer presses Pull or
Push.

**The server is `server.ts`.** Two routes:

- `GET /api/review-state` — the full state, same shape the browser reads.
- `PUT /api/review-state/pages/:pageKey` — merges a patch for exactly one page
  and returns the merged record.

Storage is `bun:sqlite` at `DATA_DB_PATH` (default
`.data/review-state.local.db`, gitignored):

```sql
CREATE TABLE IF NOT EXISTS review_pages (
  page_key   TEXT PRIMARY KEY,
  record     TEXT NOT NULL,
  updated_at TEXT NOT NULL
)
```

The PUT body is capped at `MAX_REVIEW_BODY_BYTES` (1 MB) by a streaming
`readBodyWithLimit()` that measures **bytes, not characters**, and that keeps
draining past the cap rather than cancelling the reader — cancelling leaves the
connection framed mid-request and corrupts the client's *next* request on the
same keep-alive socket.

**Access control is already built and is not in scope to redesign.** Either a
legacy broad `REVIEW_API_TOKEN`, or `REVIEW_API_PRINCIPALS` — a JSON array of
`{principal, token, roles}` with roles drawn from `review:read`, `review:write`,
`ai:generate`. Unset means the API answers 501; malformed means 503; there is no
fallback from principals back to the legacy token. No cross-origin browser origin
is allowed by default.

---

## The invariants you must not break

These are the expensive part of this codebase. Most of them exist because the
obvious implementation was tried and was wrong. Treat each as a constraint on
your design, not as advice.

**One merge function, shared by both sides.** `mergeReviewRecord()` in
`js/review-merge.js` is the only place in the entire system where a `history[]`
entry is ever constructed. `server.ts` imports that exact file — the same file
the browser loads. Your cloud-database layer must call it too. Do **not** write a
second merge in SQL, in a stored procedure, or in a database trigger: two merge
implementations free to drift is precisely the failure this arrangement prevents.

**`history[]` is append-only.** Nothing may delete an entry. Even the queue's
undo feature works by writing the previous content back as a *new* recorded
round, so the trail reads "set to Approved, then reverted" — which is what
actually happened.

**Every write is scoped to one `page_key`.** The server never wholesale-replaces
the table. A prior regression in the import path replaced saved state instead of
merging it and destroyed reviews; the per-page discipline is the structural
answer to that.

**Never compare a browser clock against a server clock.** This is the subtlest
rule here and the easiest to undo by accident. `pullFromServer` decides each page
from two clock-independent facts: does the server hold a revision this browser
has not observed (`serverRecord.updated_at > localRecord.synced_at` — *both*
values server-issued, since `synced_at` is only ever assigned from a sync
response), and does this browser hold unpushed work (the explicit boolean
`local_dirty`). A local record's own `updated_at` comes from the browser's clock
and must never participate: on a browser running behind the server, a genuine
unsynced edit looks older than an untouched server record and gets silently
overwritten.

**`local_dirty` is tri-state and "absent" is not "clean".** `true`, an explicit
`false`, and *missing* are three different things. `mergeReviewRecord` sets
`local_dirty = updatedBy !== 'sync'`. Records written before the field existed do
not carry it at all, and treating missing as clean would let the first pull after
an upgrade overwrite reviews that were never pushed.

**A divergence is surfaced, never guessed.** A new server revision *and* unpushed
local edits means neither side has seen the other's work. The record is left
completely untouched — no content change, and no `synced_at` bump, which would
let the next push sail through the server's staleness check — and reported in
`conflicts`, with the server's copy in `conflictRecords`. `resolveConflict()` is
the only way out, one page at a time. It is bound to the endpoint that produced
it and it refuses when `serverRecord.updated_at <= localRecord.synced_at`,
because acting on such a row adopts a revision the page has already moved past.

**Push and pull differ on purpose.** Push sends one page's full record and accepts
the server's merged response as authoritative for that page. Pull is
last-write-wins **per page**, never a field-level re-merge client-side — the
server's `history` is already merged, so re-merging would duplicate entries.

**Switching the sync endpoint clears every page's `synced_at` and *deletes* its
`local_dirty` flag.** Both only mean something relative to the deployment that
issued them. The flag is deleted rather than forced to `true` because absent is
the honest state.

---

## The new problem a cloud database introduces

Today the server is one process holding one SQLite file, so a `PUT` is
effectively serialized: read the row, merge in memory, write it back. Nothing
overlaps.

A hosted database with more than one server instance — or one instance serving
concurrent requests against a network database — breaks that assumption, and it
breaks it **silently**. Two reviewers pushing the same page at the same time both
read the same prior record, both merge their own entry onto it, and the second
write lands on top of the first. No error is raised. A history entry simply
disappears from an append-only log, which is the one thing that log promises
cannot happen.

**Solving this is the core of the task, not a detail of it.** Acceptable
approaches include a serializable transaction around the read-merge-write, or
optimistic concurrency using a version column with a retry loop, or a
database-level conditional update. What is not acceptable is an in-process mutex:
it is exactly the thing that stops working the moment there is a second instance,
which is the situation you are being asked to build for.

There is a second, related casualty. The existing rate limiter is
**process-local** by design and documented as such. Once there is more than one
instance, it stops being a coordinated limit. Either move it to a shared store or
state plainly in your write-up that the deployment now requires a reverse proxy
or identity-aware edge to enforce it — do not leave a process-local counter in
place while implying it still bounds abuse.

---

## Functional requirements for the database layer

1. **Keep the record as a JSON document, keyed by page key.** `mergeReviewRecord`
   owns the record's shape and the schema is validated in two places already
   (`build_scripts/review-state-schema.js` server-side,
   `js/review-state-validation.js` in the browser). Normalizing the record into
   relational columns would create a third authority on that shape. Add columns
   only for what you must index or lock on — a version or revision counter, and
   the server-issued `updated_at`.
2. **The storage layer must be swappable.** `tests/review-api-server.test.js`
   spawns `server.ts` as a subprocess against a temporary database and drives it
   over real HTTP. That test must keep working without a live cloud account and
   without network access, so keep a local driver available and select it by
   configuration.
3. **Migrations must be explicit and repeatable**, not the implicit
   `CREATE TABLE IF NOT EXISTS` at boot that the current code uses. State how an
   existing `.data/review-state.local.db` is migrated into the cloud, or state
   that it is not and that reviewers re-push.
4. **Backups and point-in-time recovery are a requirement, not a nice-to-have.**
   The review record *is* the deliverable of this tool. Say what the retention
   window is and how a restore is performed.
5. **Credentials come from the environment at use time** and never enter the
   repository, the logs, or any export file. The gitignored `.env.local` is where
   they live locally.
6. **Connection handling must survive the deployment model you choose.** If the
   target is serverless, address cold starts and connection limits explicitly; a
   per-request connection against a Postgres instance with a low connection cap
   fails under exactly the concurrent load that motivated this change.

---

## Explicitly out of scope

- Redesigning the authorization layer. Bearer tokens, principals, roles and the
  origin policy stay as they are.
- Making sync automatic or background. It stays manual-trigger, which is what
  keeps sync-generated history entries bounded to explicit reviewer actions.
- Any change to `pages/*.js` content, the renderer, or the review UI.
- Making the CSV export carry `section_edits`. That is a known, documented
  limitation of the flat-row format and is unrelated to storage.

---

## Acceptance criteria

Your work is not done until all of these hold, and you must show the actual
output rather than assert it:

- `bun run validate` and `bun run test` both pass. The test suite is named
  explicitly in `package.json` rather than globbed, so **a new test file runs
  only once you add it to that list.**
- `tests/review-api-server.test.js` still passes against a local driver, with no
  cloud credentials present.
- **A new concurrency test exists and is mutation-proven.** Fire two overlapping
  `PUT`s for the same `page_key` and assert both history entries survive. Before
  claiming it works, deliberately break your concurrency control and confirm the
  test *fails* — a concurrency test that has never been seen to fail is not
  evidence of anything.
- The offline path is untouched: with no sync configuration, the tool makes no
  network request and behaves identically. Verify in a browser, not by reasoning.
- The import/export round trip still merges rather than replaces: export a
  snapshot, re-import it, confirm existing decisions and notes survive. Two e2e
  specs cover parts of this (`tests/e2e/import-export.spec.js`,
  `tests/e2e/merge-verification.spec.js`) — a green run is evidence for those two
  scenarios and nothing else on that path.
- `bun run format:check` passes. Prettier is the only linter and it is a hard CI
  gate: no semicolons, single quotes, two-space indent, 100 columns.

---

## Two questions to answer before you start — surface them, do not guess

1. **Which provider, and where does the data live?** This is San Francisco
   municipal review content. Data residency, the organization's existing vendor
   relationships, and who holds the credentials are all decisions outside your
   reach. Do not pick a provider because it is convenient to code against.
2. **Does `globals` sync, and should it?** Today it deliberately does not: the
   server always returns `globals: {}`. That is why a page a reviewer *added* in
   the browser has its review record pushed while the page registry explaining it
   never travels, so the receiving browser gets a record with no page attached to
   it. Fixing that is a real improvement and a real scope increase — it makes the
   registry a shared, conflict-capable object rather than per-browser state.
   Raise it; do not quietly implement either answer.
