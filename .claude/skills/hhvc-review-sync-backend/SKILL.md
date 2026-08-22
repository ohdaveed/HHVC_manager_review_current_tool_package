---
name: hhvc-review-sync-backend
description: "HHVC repo: the optional review-state sync API and its client — push-vs-pull asymmetry, the never-compare-clocks rule, local_dirty's tri-state, conflict surfacing and resolution binding. Load before editing server.ts's review-state routes or js/sync/review-state-sync.js."
---

<!-- Extracted from CLAUDE.md/AGENTS.md on 2026-08-13. AGENTS.md remains the
     canonical copy of this content; see "Cross-tool canon" there. -->

# Review-state sync backend (optional)

`server.ts` optionally serves a small sync API alongside its static file
serving, backed by **Postgres when `DATABASE_URL` is set and SQLite
otherwise** — entirely additive, off by default, and fails closed (501)
rather than open if unconfigured. Neither driver is reached directly: one
module, `build_scripts/storage.js`, decides the store and speaks its dialect,
so `server.ts` calls functions and never sees a driver or a SQL string. See
"Where review records live" in `AGENTS.md`/`CLAUDE.md` for that seam's own
rules — the async-in-both-drivers shape, `updated_at` staying TEXT, and the
compare-and-swap that makes a lost update impossible.

- **Routes**: `GET /api/review-state` (full state, same shape as
  `window.reviewState.read()`); `PUT /api/review-state/pages/:pageKey` (merges
  a patch via the shared `mergeReviewRecord()` — `server.ts` imports
  `js/review/review-merge.js` directly, the same file a `<script>` tag loads
  client-side — and returns the merged record). Every write is scoped to one
  `page_key`; the server never wholesale-replaces the table. The PUT body is
  capped at `MAX_REVIEW_BODY_BYTES` (1 MB) via the same streaming
  `readBodyWithLimit()` the AI routes use, in front of the parse — so an
  oversized body never reaches `mergeReviewRecord` and a rejected write is
  never partial. **Deliberately larger than the AI cap:** `history[]` is
  append-only and the client pushes the whole record, so this bounds a page's
  entire review life, not one edit. Too low and it is a permanent sync lockout
  — 64 KB measured at ~70 recorded rounds with long notes.
- **Auth**: see the "Optional API access hardening" section of CLAUDE.md/AGENTS.md.
  The legacy token remains broad for compatibility; production deployments
  should use per-token principals and grant only `review:read`/`review:write`
  to sync reviewers.
- **Storage**: a `review_pages (page_key TEXT PRIMARY KEY, record TEXT,
updated_at TEXT)` table, created at boot by `build_scripts/storage.js` in
  whichever store is configured. On Postgres that is the database
  `DATABASE_URL` names (Railway injects it from the managed service); on
  SQLite it is the file at `DATA_DB_PATH` (default: gitignored
  `.data/review-state.local.db` for local dev; point at a mounted volume in
  production). `updated_at` is TEXT in both, never a timestamp type — every
  freshness check below is a string compare, and letting Postgres reformat
  those values would silently change them.
- **Client**: `js/sync/review-state-sync.js`, a no-op unless configured. Its
  settings live under their own `hhvcReviewSyncConfig` localStorage key,
  separate from `hhvcManagerReviewState:v1` on purpose — the token must never
  round-trip through the shareable CSV/JSON export/import/backup files.
  **Sync is automatic as of 2026-08-14** — `startAutoSync()` pulls once at
  init, `scheduleAutoPush()` pushes one page on a 3s debounce AFTER the
  autosave has already written localStorage, and `pushDirtyPages()` sends
  anything saved while the server was unreachable. History stays bounded
  because the client still never merges on the push path: the server merges
  with `updatedBy: 'sync'`, and merging here too would append an entry per
  debounce. The manual Pull/Push buttons remain for explicit use. **No push
  may precede the first pull** — a push carries a `synced_at` baseline, and
  pushing one this browser never observed is a guaranteed 409.
  The default endpoint is now the page's own origin rather than a baked-in
  hostname (the old one named a dead deployment); the token still has no
  default, because the bundle is public.
- **Push vs. pull differ on purpose**: push sends one page's full record and
  accepts the server's merged response as authoritative for that page; pull
  is last-write-wins **per page**, never a field-level re-merge client-side
  (the server's `history` is already merged — re-merging it would duplicate
  entries, and treating a full local snapshot as a "patch" onto the server's
  record would let stale local copies of fields another reviewer changed
  silently overwrite them).
- **Never compare a browser-clock timestamp against a server-clock one.**
  `pullFromServer` decides each page from two clock-independent facts:
  does the server hold a revision this browser hasn't observed
  (`serverRecord.updated_at > localRecord.synced_at` — _both_ server-issued,
  since `synced_at` is only ever assigned from a sync response), and does
  this browser hold unpushed work (the explicit boolean `local_dirty`)? A
  local record's `updated_at` comes from the browser's own clock and must
  never take part: on a browser running behind the server, a genuine
  unsynced edit looks older than an untouched server record and used to be
  silently overwritten by it. `local_dirty` is set by the local write paths
  (autosave only when content actually changed, per `reviewContentEquals`;
  every `mergeReviewRecord` call except the server's own
  `updatedBy: 'sync'`) and cleared only by a real push/pull. It is a genuine
  boolean, hence the explicit branch in `js/review/review-state-validation.js` —
  the generic `String()` coercion there would turn `false` into the truthy
  string `'false'`. Only an **explicit `false`** means clean: records
  written before the field existed don't carry it (the storage version was
  deliberately not bumped, the field being additive), and treating
  "missing" as "clean" would let the first pull after an upgrade overwrite
  reviews that were never pushed. The absence has to survive autosave too:
  `nextLocalDirty()` (`js/review/ux-improvements-state-sync.js`) returns
  `undefined` for an unchanged legacy record instead of collapsing it to a
  boolean, since a content-neutral save would otherwise write an explicit
  `false` and grant the pull path the very permission this rule withholds.
- **A divergence is surfaced, never guessed.** A new server revision _and_
  unpushed local edits means neither side has seen the other's work; the
  record is left completely untouched (no content change, and no `synced_at`
  bump, which would let the next push sail through the server's staleness
  check) and reported in `conflicts`, with the server's copy in
  `conflictRecords`. `resolveConflict(pageKey, 'server'|'local',
serverRecord)` is the only way out, one page at a time — `'server'` adopts
  the server copy and clears `local_dirty`; `'local'` keeps local content
  but records the server's revision as observed so the next push stops being
  rejected. The sync controls render a button pair per conflicted page. Each
  resolution is bound to the endpoint that produced it (`pullFromServer`
  returns `apiUrl`, `resolveConflict` refuses a mismatch, and saving new
  settings clears the panel): a stale row would otherwise import another
  deployment's content, and its `'local'` branch would re-mint the exact
  `synced_at` baseline `writeConfig` had just cleared.
- **A resolution is bound to the _divergence_ too.** A row asserts "the
  server holds a revision this browser hasn't observed", and that can stop
  being true underneath it: a push whose PUT reaches the server before an
  overlapping pull's GET, but whose response lands after, makes the pull
  report a conflict against this browser's **own** content and then quietly
  reconcile the record. `resolveConflict` refuses when
  `serverRecord.updated_at <= localRecord.synced_at` (both server-issued,
  so the no-cross-clock rule holds) — acting on such a row adopts a revision
  the page already moved past, discarding anything edited since the push.
  No misfire on a genuine conflict: `pullFromServer` reports one only when
  the server revision is _newer_ than `synced_at`, and leaves `synced_at`
  alone for conflicted pages. `pruneReconciledConflicts()` after a push and
  the mutually-disabled Push/Pull buttons are hygiene on top, not the
  mechanism — either call can be made programmatically.
- **That binding starts at _request_ time.** `pullFromServer` and
  `pushPage` capture `readConfig().apiUrl` before calling `apiFetch` and
  re-check it (`assertEndpointUnchanged()`) before touching state, so a
  response that outlived its configuration is rejected rather than applied.
  Reading the endpoint in the `.then()` instead is the bug it fixes: a pull
  from X landing after the reviewer saved Y gets labelled `Y`, passes
  `resolveConflict`'s guard, and writes X's revision into `synced_at`
  under Y.
- Switching the sync server URL (`writeConfig`) clears every local page's
  `synced_at` **and deletes its `local_dirty` flag**, since both only mean
  something relative to the deployment that issued them. A `false` dirty
  flag asserts "matches what the server has" — a judgement made against
  the _old_ server, so carrying it over lets the first pull from the new
  one see a new revision plus an explicitly clean record and overwrite the
  local decision/notes. It's `delete`d rather than forced to `true`:
  absent is the honest state (unknown provenance) and is already what
  `pullFromServer` treats as possibly-unpushed. There is deliberately **no
  "both non-empty" guard** on that comparison: clearing settings then
  pointing at a different server is two transitions (`X` → `''` → `Y`), and
  requiring both sides to be non-empty would skip the clear on both,
  carrying `X`'s baselines to `Y`.
- **A superseded pull must not drive the conflict UI.** Two Pull clicks put
  two GETs in flight with no ordering guarantee, and
  `assertEndpointUnchanged` can't help — both go to the _same_ endpoint. A
  module-level generation counter stamps each `pullFromServer()` call, and
  its result carries `stale: true` when a later pull started while it was
  in flight. Applying either response's _state_ is safe (last-write-wins
  per page regardless); the conflict panel is not, since a stale empty
  conflict list would erase resolution controls a newer pull correctly
  populated. The guard lives in `pullFromServer`, not the click handler, so
  it's unit-testable and inherited by any caller; the button is disabled
  for the duration as well.
- **Deployment**: run `server.ts` (`bun run start`) with a persistent volume
  mounted, `DATA_DB_PATH` pointed at it, and either a generated
  `REVIEW_API_TOKEN` or the documented `REVIEW_API_PRINCIPALS` secret
  configuration (never committed). Apply the reverse-proxy/identity-aware edge
  control described above for public or replicated deployments. Local dev and
  any static-only deploy (the `build:railway` bundle served without `server.ts`,
  so these routes have no runtime) are unaffected either way.
- **Tests**: `tests/review-merge.test.js` (unit),
  `tests/review-api-server.test.js` (spawns `server.ts` against a temp SQLite
  DB, exercises auth/merge/isolation over real HTTP), and
  `tests/review-api-postgres.test.js` (the same routes against a **real**
  Postgres, **skipped unless one is reachable** — `TEST_DATABASE_URL`, else a
  local server on the default port, so CI runs it as a no-op). That second
  server suite exists because the two drivers express the compare-and-swap
  differently and a lost update there is silent: its race test issues two
  pushes carrying the same baseline and asserts exactly one 409. A change to
  the sync routes that passes only the SQLite suite has not been tested on the
  driver the live deployment actually runs.
