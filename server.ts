import { serve } from "bun"
import { Database } from "bun:sqlite"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { timingSafeEqual } from "node:crypto"
// @ts-ignore - plain JS module, shared with the browser via a <script> tag
// (see index.html); no .d.ts and none needed for the one function used here.
import { mergeReviewRecord } from "./js/review-merge.js"
// @ts-ignore - plain JS module (CJS via Zod), no .d.ts; same interop as above.
import { reviewRecordSchema } from "./build_scripts/review-state-schema.js"
// @ts-ignore - plain JS modules, CommonJS; the AI assist service (see below).
import { generateContent, getCapabilities, listModels } from "./build_scripts/ai/index.js"
// @ts-ignore - plain JS module, CommonJS.
import { generateRequestSchema, MAX_REQUEST_BODY_BYTES } from "./build_scripts/ai/schemas.js"
// @ts-ignore - plain JS module, CommonJS.
import { RefusalError } from "./build_scripts/ai/provider-anthropic.js"
// Imported for its error classes only, as the fallback arm of the cancellation
// mapping in aiErrorResponse. The SDK is never constructed here — every call
// goes through build_scripts/ai/.
import Anthropic from "@anthropic-ai/sdk"

const HOST = process.env.HOST ?? "127.0.0.1"
const PORT = Number.parseInt(process.env.PORT ?? "8080", 10)
const ROOT = import.meta.dir

const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "x-xss-protection": "1; mode=block",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "geolocation=(), microphone=(), camera=()",
}

const HTML_HEADERS = {
  ...SECURITY_HEADERS,
  "content-type": "text/html; charset=utf-8",
}

const STATIC_HEADERS = {
  ...SECURITY_HEADERS,
  "cache-control": "no-cache",
}

// --- Optional review-state sync backend (GET/PUT /api/review-state*) -----
//
// Additive, off-by-default persistence layer for the manager-review tool.
// It's entirely separate from the mockup's core localStorage-only review
// state (js/review-state-store.js): reviewers opt in per-browser via
// js/review-state-sync.js, which is a no-op unless a sync URL/token is
// configured. See CLAUDE.md's "Review-state sync backend" section for the
// deployment/Railway details and the per-page merge safety invariant this
// code must preserve (never wholesale-replace `pages`, always merge one
// page_key at a time through the same mergeReviewRecord used client-side).

const REVIEW_API_TOKEN = process.env.REVIEW_API_TOKEN ?? ""
const DATA_DB_PATH = process.env.DATA_DB_PATH ?? `${ROOT}/.data/review-state.local.db`

/**
 * Ceiling on a single review-record PUT. One page's decision, notes, reviewer,
 * and history is a few KB at most; 64 KB leaves generous room for a long
 * history array while still bounding the endpoint.
 */
const MAX_REVIEW_BODY_BYTES = 64 * 1024

/**
 * How far past a body cap `readBodyWithLimit` will keep draining before it
 * gives up and breaks the connection. Draining keeps the connection usable for
 * the client's next request; this stops a sender who ignores the 413 from
 * making us read forever.
 */
const DRAIN_LIMIT_MULTIPLIER = 8

let db: Database | null = null
function getDb(): Database {
  if (db) return db
  // { create: true } makes bun:sqlite create the DB *file*, but not its
  // parent directory (the Railway volume mount or local .data/ dir) —
  // without this, a fresh checkout/volume fails with SQLITE_CANTOPEN.
  mkdirSync(dirname(DATA_DB_PATH), { recursive: true })
  db = new Database(DATA_DB_PATH, { create: true })
  db.run(`
    CREATE TABLE IF NOT EXISTS review_pages (
      page_key TEXT PRIMARY KEY,
      record TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
  return db
}

const API_CORS_HEADERS = {
  "access-control-allow-origin": "*",
  // Shared by every /api/* route. POST is here for the AI assist routes below;
  // the review-state routes still only accept GET and PUT, which their own
  // method matching enforces.
  "access-control-allow-methods": "GET, POST, PUT, OPTIONS",
  "access-control-allow-headers": "authorization, content-type",
}

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...SECURITY_HEADERS,
      ...API_CORS_HEADERS,
      "content-type": "application/json; charset=utf-8",
    },
  })
}

/**
 * Read a request body as text, refusing it the moment it passes `maxBytes`.
 *
 * `await req.text()` buffers the WHOLE body before anything can measure it, so
 * a chunked request — or one that simply lies in Content-Length — allocates
 * whatever it likes and a 413 afterwards does not give the memory back. This
 * pulls the stream chunk by chunk and stops at the first byte over the limit.
 *
 * The count is in real bytes, not characters. The previous check compared
 * `raw.length` (UTF-16 code units) against a limit named in bytes, so a body
 * of multi-byte UTF-8 could be roughly three times the cap and still pass.
 *
 * Past the cap it stops accumulating but keeps draining — see the comment at
 * the drain branch for why cancelling the reader is not safe.
 *
 * @param req
 * @param maxBytes Hard ceiling on the decoded body.
 * @returns The body text, or null if it exceeded `maxBytes`.
 */
async function readBodyWithLimit(req: Request, maxBytes: number): Promise<string | null> {
  // A body-less request is legitimately the empty string; JSON.parse rejects
  // it downstream with the same 400 an unparseable body gets.
  if (!req.body) return ""

  const reader = req.body.getReader()
  // stream: true so a multi-byte character split across two chunks is decoded
  // once both halves have arrived, instead of becoming a replacement char.
  const decoder = new TextDecoder("utf-8")
  let total = 0
  let text = ""
  let overLimit = false

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength

      if (!overLimit && total > maxBytes) {
        // Stop ACCUMULATING here — that is what bounds memory, and it is the
        // whole point of the cap. Release what was collected so far.
        overLimit = true
        text = ""
      }
      if (overLimit) {
        // Keep draining, discarding as we go.
        //
        // Cancelling the reader instead leaves the connection framed
        // mid-request: the client is still sending, so the next request on
        // that keep-alive connection is read as garbage and Bun answers it
        // with an empty-bodied protocol-level 400. That surfaced as a flaky
        // failure in the test that runs after the chunked-oversize one, and
        // would hit a real client the same way — a 413 followed by an
        // inexplicable 400 on their next, perfectly valid, request.
        //
        // Draining costs bandwidth the sender is transmitting anyway, and
        // costs no memory, so the DoS this cap exists to stop is still
        // stopped. DRAIN_LIMIT below bounds even that.
        if (total > maxBytes * DRAIN_LIMIT_MULTIPLIER) {
          // Absurdly over: give up on a clean connection rather than read an
          // unbounded stream. Breaking this connection is the lesser harm.
          await reader.cancel()
          return null
        }
        continue
      }

      text += decoder.decode(value, { stream: true })
    }
  } finally {
    reader.releaseLock()
  }

  if (overLimit) return null
  return text + decoder.decode()
}

function isAuthorized(req: Request): boolean {
  if (!REVIEW_API_TOKEN) return false
  const header = req.headers.get("authorization") ?? ""
  const expected = `Bearer ${REVIEW_API_TOKEN}`
  // Constant-time comparison: a raw `===` on the token leaks timing info an
  // attacker could use to guess it one byte at a time. timingSafeEqual
  // throws on a length mismatch, so that has to be checked first — which is
  // itself timing-safe since header length isn't secret.
  const headerBuf = Buffer.from(header)
  const expectedBuf = Buffer.from(expected)
  return headerBuf.length === expectedBuf.length && timingSafeEqual(headerBuf, expectedBuf)
}

/** Reassemble the flattened { version, updated_at, ui, globals, pages } shape
 *  js/review-state-store.js already uses, from the per-page rows table. */
function getFullReviewState(): object {
  const rows = getDb()
    .query("SELECT page_key, record FROM review_pages")
    .all() as Array<{ page_key: string; record: string }>

  const pages: Record<string, unknown> = {}
  let latestUpdatedAt: string | null = null
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.record)
      pages[row.page_key] = parsed
      if (typeof parsed.updated_at === "string" && (!latestUpdatedAt || parsed.updated_at > latestUpdatedAt)) {
        latestUpdatedAt = parsed.updated_at
      }
    } catch {
      // Skip a corrupted row rather than fail the whole GET.
    }
  }

  return { version: 1, updated_at: latestUpdatedAt, ui: {}, globals: {}, pages }
}

async function putReviewPage(pageKey: string, req: Request): Promise<Response> {
  // One page's review record — decision, notes, reviewer, history — is far
  // smaller than an AI request, so it gets its own tighter ceiling rather than
  // inheriting the AI cap and being loosely bounded for no reason.
  const raw = await readBodyWithLimit(req, MAX_REVIEW_BODY_BYTES)
  if (raw === null) {
    return jsonResponse(
      { error: `Request body must be ${MAX_REVIEW_BODY_BYTES} bytes or fewer.` },
      413
    )
  }

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400)
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonResponse({ error: "Request body must be a JSON object." }, 400)
  }

  // Validate against the same schema the browser validates GET responses
  // against (js/review-state-validation.js / build_scripts/review-state-schema.js)
  // — without this, a malformed or malicious PUT body would merge and
  // persist as-is, unlike every other entry point into review state.
  const parsed = reviewRecordSchema.safeParse(body)
  if (!parsed.success) {
    return jsonResponse({ error: "Invalid review record.", issues: parsed.error.issues }, 400)
  }
  const patch = parsed.data as { updated_at?: string; synced_at?: string; [key: string]: unknown }

  const database = getDb()
  const existingRow = database
    .query("SELECT record FROM review_pages WHERE page_key = ?")
    .get(pageKey) as { record: string } | null
  const existing = existingRow ? JSON.parse(existingRow.record) : null

  // Reject a stale full-record push instead of silently overwriting a
  // newer server record with it: pushPage sends the client's entire local
  // snapshot (not a field-level diff), so if reviewer B already pushed a
  // newer version of this page since reviewer A last pulled, A's push
  // would otherwise carry A's stale copy of every field A didn't touch —
  // including reverting whatever B just changed.
  //
  // The freshness token is patch.synced_at, NOT patch.updated_at: the
  // latter is bumped by every local edit/autosave (including one that
  // fires immediately before every push), so it means "when this browser
  // last touched the record," not "what server state this browser last
  // observed" — comparing THAT against the server's timestamp would almost
  // always look artificially fresh and defeat this check entirely.
  // synced_at only changes on an actual pull/push response (see
  // js/review-state-sync.js), so it's the real baseline.
  //
  // A missing synced_at is only safe to wave through when there's no
  // existing row to lose (a page that's never existed on the server). If a
  // row DOES exist, a missing/blank synced_at means this browser has never
  // observed it — reviewing locally before ever configuring sync, or
  // syncing from a different browser — and pushing its full local snapshot
  // over real server content unconditionally would silently overwrite
  // another reviewer's decision/notes. Require a real baseline in that
  // case instead of treating "no baseline" as "no conflict."
  if (existing && typeof existing.updated_at === "string") {
    if (typeof patch.synced_at !== "string" || existing.updated_at > patch.synced_at) {
      return jsonResponse(
        { error: "Server has a newer version of this page. Pull before pushing again.", current: existing },
        409
      )
    }
  }

  // The one place server-side merges happen: always merge onto the single
  // page_key being written, never touch the rest of the table. This is the
  // server-side half of the "merge, never wipe" invariant the client side
  // already relies on (js/review-queue-import.js, js/ux-improvements-export.js).
  const merged = mergeReviewRecord(existing, { ...patch, page_key: pageKey }, {
    updatedBy: "sync",
  })

  // Compare-and-swap the write against the exact row we based `merged` on
  // (existing?.updated_at, or NULL for "no row yet"): the staleness check
  // above only proves no conflict existed at READ time. Within a single Bun
  // process this table only ever gets one JS-thread request at a time
  // between an `await` and the next, so no two requests can interleave
  // between that read and this write — but across multiple server
  // instances/replicas (nothing rules that out for this deployment), two
  // requests could both pass the check against the same prior row and race
  // to write. Gating the UPDATE on the row still matching what we read
  // means the loser's write becomes a no-op (`changes: 0`) instead of
  // silently clobbering the winner's — same "merge, never wipe" invariant,
  // just enforced atomically instead of just checked-then-trusted.
  const result = database.run(
    `INSERT INTO review_pages (page_key, record, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(page_key) DO UPDATE SET record = excluded.record, updated_at = excluded.updated_at
     WHERE review_pages.updated_at = ?`,
    [pageKey, JSON.stringify(merged), merged.updated_at, existing?.updated_at ?? null]
  )
  if (result.changes === 0) {
    return jsonResponse(
      { error: "Server has a newer version of this page. Pull before pushing again." },
      409
    )
  }

  return jsonResponse(merged, 200)
}

async function handleReviewStateApi(req: Request, url: URL): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...SECURITY_HEADERS, ...API_CORS_HEADERS } })
  }

  if (!REVIEW_API_TOKEN) {
    return jsonResponse(
      { error: "Review-state sync is not configured on this server (REVIEW_API_TOKEN unset)." },
      501
    )
  }
  if (!isAuthorized(req)) {
    return jsonResponse({ error: "Unauthorized" }, 401)
  }

  if (url.pathname === "/api/review-state" && req.method === "GET") {
    return jsonResponse(getFullReviewState(), 200)
  }

  const pageMatch = url.pathname.match(/^\/api\/review-state\/pages\/([^/]+)$/)
  if (pageMatch && req.method === "PUT") {
    return putReviewPage(decodeURIComponent(pageMatch[1]), req)
  }

  return jsonResponse({ error: "Not Found" }, 404)
}

// --- Optional AI assist backend (GET/POST /api/ai/*) ---------------------
//
// Same posture as the review-state sync layer above: entirely additive, off by
// default, and failing closed. Two independent switches gate it —
// REVIEW_API_TOKEN (shared with the sync routes; one server secret, not two)
// controls whether the API exists at all, and ANTHROPIC_API_KEY controls
// whether generation is possible. The key never leaves the server: the browser
// talks only to this origin.
//
// Nothing here writes to disk or to review state. Generated drafts are returned
// to the browser to preview, copy, and download — they never touch pages/*.js.
// HHVC standards manual §1.11 forbids any automated approval, and SF.gov's AI
// guidelines require generative-AI use to be disclosed, so every response
// carries a `disclosure` string the client renders alongside the draft.

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? ""

/**
 * Whole-request budget for a generation, covering both validation attempts and
 * every SDK-level retry inside them. Four minutes is generous for one page at
 * high effort and still well under the client's own 180s-per-attempt patience,
 * so the browser gives up first in the normal case and this only catches a
 * genuinely wedged upstream.
 */
const AI_REQUEST_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 240_000)

/** Map a thrown error to a status code and a message worth showing a reviewer. */
function aiErrorResponse(
  error: unknown,
  signals?: { client?: AbortSignal; timeout?: AbortSignal }
): Response {
  if (error instanceof RefusalError) {
    // A refusal is a content outcome, not a server fault. 422 so the client can
    // say "the model declined" rather than "something broke".
    return jsonResponse(
      { error: error.message, category: error.category, explanation: error.explanation },
      422
    )
  }

  // Cancellation is decided by SIGNAL STATE, not by the shape of the error.
  //
  // This branch used to test `error.name === "AbortError"` and never once ran:
  // the Anthropic SDK throws APIUserAbortError and APIConnectionTimeoutError,
  // both of which inherit name "Error" and carry no `status`, so every
  // cancelled generation fell through to the generic branch and was logged as
  // a 500. AbortSignal.timeout() also reports "TimeoutError", not "AbortError",
  // so a name check written for one would have missed the other anyway.
  //
  // Asking the signal instead is provider-agnostic — it will still be correct
  // for Gemini, whose error classes are entirely different — where an
  // instanceof list has to be extended per provider and rots silently the day
  // it isn't. The narrow cost is that an unrelated error thrown in the same
  // tick as an abort is reported as a cancellation, for a request that was
  // being torn down regardless.
  if (signals?.client?.aborted) {
    // The reviewer hit Cancel or navigated away. Nothing to log.
    return jsonResponse({ error: "Generation was cancelled." }, 499)
  }
  if (signals?.timeout?.aborted) {
    // Our own budget expired, which is a gateway timeout rather than a client
    // cancellation. Separating the two lets the log answer "who gave up first?"
    // instead of collapsing both into one ambiguous code.
    return jsonResponse({ error: "Generation timed out." }, 504)
  }
  // Fallback for aborts raised where no signal was threaded through, so the
  // mapping degrades to something sane instead of back to a logged 500.
  const errorName = (error as { name?: string })?.name
  if (
    error instanceof Anthropic.APIUserAbortError ||
    error instanceof Anthropic.APIConnectionTimeoutError ||
    errorName === "AbortError" ||
    errorName === "TimeoutError"
  ) {
    return jsonResponse({ error: "Generation was cancelled or timed out." }, 499)
  }

  const status = (error as { status?: number })?.status
  if (typeof status === "number" && status >= 400 && status < 600) {
    // An upstream API error (bad key, rate limit, overload). Surface it as a
    // gateway failure with the upstream status attached, so a 429 is not
    // mistaken for a bug in this server.
    return jsonResponse(
      { error: `The model provider returned ${status}.`, upstreamStatus: status },
      502
    )
  }
  console.error("AI request failed:", error)
  return jsonResponse({ error: (error as Error)?.message || "AI request failed." }, 500)
}

async function handleAiApi(req: Request, url: URL): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...SECURITY_HEADERS, ...API_CORS_HEADERS } })
  }

  if (!REVIEW_API_TOKEN) {
    return jsonResponse(
      { error: "AI assist is not configured on this server (REVIEW_API_TOKEN unset)." },
      501
    )
  }
  if (!isAuthorized(req)) {
    return jsonResponse({ error: "Unauthorized" }, 401)
  }

  // Deliberately answers even with no ANTHROPIC_API_KEY. This is the discovery
  // endpoint the browser uses to render its empty state, and a 501 here would
  // leave it unable to tell "no AI key" from "no server at all".
  if (url.pathname === "/api/ai/capabilities" && req.method === "GET") {
    return jsonResponse(getCapabilities(), 200)
  }

  // The provider gate is checked INSIDE each route that needs it, not before
  // the routing below. Hoisting it would make every unmatched path answer 501
  // "no provider configured" instead of 404, which tells a client the route
  // exists when it does not.
  const noProvider = () =>
    jsonResponse(
      { error: "No model provider is configured on this server (ANTHROPIC_API_KEY unset)." },
      501
    )

  if (url.pathname === "/api/ai/models" && req.method === "GET") {
    if (!ANTHROPIC_API_KEY) return noProvider()
    try {
      return jsonResponse(await listModels(), 200)
    } catch (error) {
      return aiErrorResponse(error)
    }
  }

  if (url.pathname === "/api/ai/generate" && req.method === "POST") {
    if (!ANTHROPIC_API_KEY) return noProvider()

    // Refuse an oversized body BEFORE reading it. The Zod schema bounds `page`,
    // but only after req.json() has already buffered and parsed the whole
    // payload — so without this the cheapest way to burn server memory is a
    // request the validator was always going to reject.
    const declaredLength = Number(req.headers.get("content-length") ?? Number.NaN)
    if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BODY_BYTES) {
      return jsonResponse(
        { error: `Request body must be ${MAX_REQUEST_BODY_BYTES} bytes or fewer.` },
        413
      )
    }

    // Content-Length is a claim, not a guarantee — a chunked or lying client
    // sends no usable header. Streaming the body against the same cap makes the
    // limit hold either way, and stops an oversized body from being allocated
    // in full before anything is allowed to object to it.
    const raw = await readBodyWithLimit(req, MAX_REQUEST_BODY_BYTES)
    if (raw === null) {
      return jsonResponse(
        { error: `Request body must be ${MAX_REQUEST_BODY_BYTES} bytes or fewer.` },
        413
      )
    }

    let body: unknown
    try {
      body = JSON.parse(raw)
    } catch {
      return jsonResponse({ error: "Request body must be valid JSON." }, 400)
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonResponse({ error: "Request body must be a JSON object." }, 400)
    }

    const parsed = generateRequestSchema.safeParse(body)
    if (!parsed.success) {
      return jsonResponse({ error: "Invalid request.", issues: parsed.error.issues }, 400)
    }

    // Two cancellation sources, combined. req.signal stops an abandoned
    // generation from costing tokens when the reviewer navigates away or hits
    // cancel; the timeout bounds the case where the client stays connected but
    // the upstream never answers. Without it the SDK's ~10-minute default
    // request timeout, multiplied by its retries and by our own validation
    // retry, leaves a request able to occupy the server for far longer than
    // any reviewer would wait.
    const timeout = AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS)
    const signal = AbortSignal.any([req.signal, timeout])

    try {
      const result = await generateContent({ ...parsed.data, signal })
      return jsonResponse(result, 200)
    } catch (error) {
      return aiErrorResponse(error, { client: req.signal, timeout })
    }
  }

  return jsonResponse({ error: "Not Found" }, 404)
}

const server = serve({
  hostname: HOST,
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)

    if (url.pathname === "/api/review-state" || url.pathname.startsWith("/api/review-state/")) {
      return handleReviewStateApi(req, url)
    }

    if (url.pathname === "/api/ai" || url.pathname.startsWith("/api/ai/")) {
      return handleAiApi(req, url)
    }

    // Never let the static handler below serve a dotfile/dotdir path (e.g.
    // /.data/review-state.local.db, /.git/..., /.env.local). The static
    // branch has no denylist otherwise — it serves any existing path under
    // ROOT — and DATA_DB_PATH's local-dev default lives under ROOT/.data/,
    // so without this guard the SQLite file holding every reviewer's
    // decisions/notes would be downloadable with no auth once synced.
    if (/(^|\/)\.[^/]+/.test(url.pathname)) {
      return new Response("Not Found", { status: 404, headers: HTML_HEADERS })
    }

    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(Bun.file(`${ROOT}/index.html`), {
        headers: HTML_HEADERS,
      })
    }

    const filePath = url.pathname.endsWith('/')
      ? url.pathname + 'index.html'
      : url.pathname
    let file = Bun.file(ROOT + filePath)
    if (!(await file.exists()) && !url.pathname.endsWith('/')) {
      file = Bun.file(ROOT + url.pathname + '/index.html')
    }
    if (await file.exists()) {
      // Let Bun.file infer content-type from the file extension (css/js/svg/etc.)
      // instead of overriding it, since `x-content-type-options: nosniff` makes
      // browsers reject scripts/styles served with the wrong MIME type.
      return new Response(file, {
        headers: STATIC_HEADERS,
      })
    }

    return new Response("Not Found", {
      status: 404,
      headers: HTML_HEADERS,
    })
  },
  error(error) {
    console.error("Server error:", error)
    return new Response("Internal Server Error", {
      status: 500,
      headers: SECURITY_HEADERS,
    })
  },
})

console.log(`HHVC mockup server running at http://${server.hostname}:${server.port}`)

export default server

