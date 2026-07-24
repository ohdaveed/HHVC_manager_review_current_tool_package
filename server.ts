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
  "access-control-allow-methods": "GET, PUT, OPTIONS",
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
  let body: unknown
  try {
    body = await req.json()
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
  const patch = parsed.data as { updated_at?: string; [key: string]: unknown }

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
  // including reverting whatever B just changed. patch.updated_at is
  // already on every full record the client sends, so this reuses data
  // already on the wire rather than requiring a new field/wire format.
  if (existing && typeof existing.updated_at === "string" && typeof patch.updated_at === "string") {
    if (existing.updated_at > patch.updated_at) {
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

  database.run(
    `INSERT INTO review_pages (page_key, record, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(page_key) DO UPDATE SET record = excluded.record, updated_at = excluded.updated_at`,
    [pageKey, JSON.stringify(merged), merged.updated_at]
  )

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

const server = serve({
  hostname: HOST,
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)

    if (url.pathname === "/api/review-state" || url.pathname.startsWith("/api/review-state/")) {
      return handleReviewStateApi(req, url)
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

