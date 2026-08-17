import { serve } from "bun"
import { resolve } from "node:path"
import { createHash, createHmac, timingSafeEqual } from "node:crypto"
// @ts-ignore - plain JS module, shared with the browser via a <script> tag
// (see index.html); no .d.ts and none needed for the one function used here.
import { mergeReviewRecord } from "./js/review-merge.js"
// @ts-ignore - plain JS module (CJS via Zod), no .d.ts; same interop as above.
import { reviewRecordSchema } from "./build_scripts/review-state-schema.js"
// The storage seam. Postgres when DATABASE_URL is set, SQLite otherwise; see
// build_scripts/storage.js for why both drivers stay supported.
import {
  describeStorage,
  initStorage,
  readAllReviewPages,
  readReviewPage,
  upsertReviewPageIfUnchanged,
} from "./build_scripts/storage.js"
// @ts-ignore - plain JS modules, CommonJS; the AI assist service (see below).
import { generateContent, generateRewrite, getCapabilities, listModels } from "./build_scripts/ai/index.js"
// @ts-ignore - plain JS module, CommonJS. The compliance-audit task's
// orchestration — kept out of index.js because its Gemini-only embedding
// dependency has nothing to do with the page-drafting path.
import { generateComplianceAudit } from "./build_scripts/ai/compliance-audit.js"
// @ts-ignore - plain JS module, CommonJS.
import { isComplianceAuditAvailable } from "./build_scripts/ai/knowledge-retrieval.js"
// @ts-ignore - plain JS module, CommonJS.
import { generateRequestSchema, MAX_REQUEST_BODY_BYTES } from "./build_scripts/ai/schemas.js"
// @ts-ignore - plain JS module, CommonJS. Provider-neutral on purpose: these
// used to come from provider-anthropic.js, which meant this file imported an
// Anthropic module for concepts ("the model declined", "no such provider") that
// belong to no provider in particular.
import {
  RefusalError,
  UnknownProviderError,
  ProviderTimeoutError,
} from "./build_scripts/ai/errors.js"
// @ts-ignore - plain JS module, CommonJS. The registry, so nothing below has to
// name a provider or read a provider's API key directly.
import { hasConfiguredProvider, getProvider } from "./build_scripts/ai/providers.js"
// @ts-ignore - plain JS module, CommonJS.
import { numberFromEnv } from "./build_scripts/ai/env.js"
// Deliberately NOT importing @anthropic-ai/sdk here. It used to be imported
// for its error classes alone, as the fallback arm of aiErrorResponse's
// cancellation mapping — but the SDK ships separate require/import builds, so
// importing it here while build_scripts/ai/provider-anthropic.js requires it
// produced two unrelated copies of every class and made those `instanceof`
// checks permanently false. That whole fallback has since moved into
// provider-anthropic.js's own classifyAbort (constructor.name matching against
// the SDK copy IT requires, the same copy that threw), mirroring
// provider-gemini.js's classifyAbort — so this file needs no SDK import and no
// SDK-specific knowledge at all anymore.

const HOST = process.env.HOST ?? "127.0.0.1"
const PORT = Number.parseInt(process.env.PORT ?? "8080", 10)

// Directory the static handler serves from. Defaults to dist/, the Vite build
// output, because the app's entry point is now a bundled ES module: the repo
// root no longer contains anything a browser can load directly (index.html
// there references /js/main.js, which imports from node_modules and needs
// resolving). Overridable so a deployment can point at a different build
// directory, and so tests can serve a fixture tree.
//
// The API routes below are independent of this and work either way — during
// development Vite serves the app on :8080 and proxies /api here, so the
// static handler simply goes unused.
const APP_DIR = import.meta.dir
// resolve() rather than string concatenation, so an ABSOLUTE STATIC_ROOT is
// honoured as given. A production deployment pointing at, say,
// /srv/app/dist would otherwise be glued onto APP_DIR and become
// `${APP_DIR}/srv/app/dist` — a directory that does not exist, so every
// static request 404s while the API keeps answering and the server looks
// healthy. Relative values still resolve against APP_DIR, which is what the
// documented `STATIC_ROOT=dist` style override expects.
// `||` rather than `??` on purpose: an empty STATIC_ROOT must fall back to
// dist/, and `??` only catches null/undefined. `resolve(APP_DIR, "")` returns
// APP_DIR — the repository root — so an env var that is merely SET-BUT-EMPTY
// (trivially common in shell scripts, CI matrices and container manifests)
// would silently publish the whole source tree. The dotfile guard further down
// blocks /.env.local and /.git, but nothing stops /server.ts or /package.json,
// and / would serve the unbundled index.html that no browser can execute.
const ROOT = resolve(APP_DIR, process.env.STATIC_ROOT || "dist")

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
// configured. See the `hhvc-review-sync-backend` skill (extracted from
// CLAUDE.md; AGENTS.md carries the same section in full) for the
// deployment/Railway details and the per-page merge safety invariant this
// code must preserve (never wholesale-replace `pages`, always merge one
// page_key at a time through the same mergeReviewRecord used client-side).

const REVIEW_API_TOKEN = process.env.REVIEW_API_TOKEN ?? ""
// Anchored to APP_DIR, not ROOT: the static root moved to dist/, which is
// wiped on every build (`emptyOutDir`), and a database living there would be
// deleted by the next one. Keeping it beside the source also means the
// gitignored .data/ path stays exactly where it has always been.
const DATA_DB_PATH = process.env.DATA_DB_PATH ?? `${APP_DIR}/.data/review-state.local.db`

// --- Optional API access controls -----------------------------------------
//
// The legacy REVIEW_API_TOKEN remains deliberately supported: deployments that
// only set it receive one principal with every role, exactly as they did before
// roles existed. REVIEW_API_PRINCIPALS is an explicit replacement, never a
// supplement. Falling back to the broad legacy token after a malformed
// principal configuration would turn a typo in a least-privilege deployment
// into an escalation, so a present-but-invalid configuration disables API
// access instead.

const API_ROLES = {
  reviewRead: "review:read",
  reviewWrite: "review:write",
  aiGenerate: "ai:generate",
} as const

type ApiRole = (typeof API_ROLES)[keyof typeof API_ROLES]

const API_ROLE_VALUES = new Set<ApiRole>(Object.values(API_ROLES))
const ALL_API_ROLES = new Set<ApiRole>(Object.values(API_ROLES))
const MAX_API_PRINCIPALS = 100
const MAX_PRINCIPAL_CONFIG_BYTES = 64 * 1024
const MAX_ALLOWED_ORIGIN_CONFIG_BYTES = 16 * 1024

interface ApiPrincipal {
  principal: string
  token: string
  roles: Set<ApiRole>
}

type ApiAuthorizationConfiguration =
  | { state: "disabled" }
  | { state: "invalid" }
  | { state: "configured"; principals: ApiPrincipal[] }

interface AllowedOriginsConfiguration {
  valid: boolean
  origins: Set<string>
}

interface ApiRequestContext {
  corsHeaders: Record<string, string>
}

/**
 * Parse the opt-in JSON principal configuration without ever logging its
 * contents: it contains bearer credentials. The intentionally small shape
 * catches a misspelled role, a duplicate token, or a broad accidental value at
 * startup instead of silently accepting an authentication configuration the
 * operator did not mean to deploy.
 *
 * @example
 * REVIEW_API_PRINCIPALS='[{"principal":"reviewer","token":"...","roles":["review:read"]}]'
 */
function parseApiAuthorizationConfiguration(raw: string | undefined): ApiAuthorizationConfiguration {
  if (raw === undefined) {
    if (!REVIEW_API_TOKEN) return { state: "disabled" }
    return {
      state: "configured",
      principals: [
        {
          principal: "legacy-review-api-token",
          token: REVIEW_API_TOKEN,
          roles: new Set(ALL_API_ROLES),
        },
      ],
    }
  }

  // An explicitly empty value is a configuration error, not the same as an
  // absent opt-in. Treating it as absent would unexpectedly reactivate the
  // broad legacy credential if a deployment system emitted `NAME=""`.
  if (!raw || Buffer.byteLength(raw, "utf8") > MAX_PRINCIPAL_CONFIG_BYTES) {
    return { state: "invalid" }
  }

  let entries: unknown
  try {
    entries = JSON.parse(raw)
  } catch {
    return { state: "invalid" }
  }
  if (!Array.isArray(entries) || entries.length === 0 || entries.length > MAX_API_PRINCIPALS) {
    return { state: "invalid" }
  }

  const tokenValues = new Set<string>()
  const principalNames = new Set<string>()
  const principals: ApiPrincipal[] = []

  for (const entry of entries) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return { state: "invalid" }

    const record = entry as Record<string, unknown>
    const keys = Object.keys(record)
    if (
      keys.length !== 3 ||
      !keys.includes("principal") ||
      !keys.includes("token") ||
      !keys.includes("roles")
    ) {
      return { state: "invalid" }
    }

    const principal = record.principal
    const token = record.token
    const roles = record.roles
    if (
      typeof principal !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(principal) ||
      typeof token !== "string" ||
      !/^\S+$/.test(token) ||
      !Array.isArray(roles) ||
      roles.length === 0 ||
      roles.length > API_ROLE_VALUES.size ||
      tokenValues.has(token) ||
      principalNames.has(principal)
    ) {
      return { state: "invalid" }
    }

    const roleSet = new Set<ApiRole>()
    for (const role of roles) {
      if (typeof role !== "string" || !API_ROLE_VALUES.has(role as ApiRole) || roleSet.has(role as ApiRole)) {
        return { state: "invalid" }
      }
      roleSet.add(role as ApiRole)
    }

    tokenValues.add(token)
    principalNames.add(principal)
    principals.push({ principal, token, roles: roleSet })
  }

  return { state: "configured", principals }
}

/**
 * Validate an exact HTTP(S) origin. Wildcards, paths, credentials and opaque
 * origins are all deliberately rejected: the server reflects only an exact
 * serialized origin after matching it against this set.
 */
function parseHttpOrigin(value: string): string | null {
  try {
    const url = new URL(value)
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.origin !== value) {
      return null
    }
    return url.origin
  } catch {
    return null
  }
}

/**
 * Parse REVIEW_API_ALLOWED_ORIGINS as a comma-separated list of exact
 * browser origins. An unset or whitespace-only value means no cross-origin
 * callers; it does not mean "*".
 */
function parseAllowedOrigins(raw: string | undefined): AllowedOriginsConfiguration {
  if (raw === undefined || raw.trim() === "") return { valid: true, origins: new Set() }
  if (Buffer.byteLength(raw, "utf8") > MAX_ALLOWED_ORIGIN_CONFIG_BYTES) {
    return { valid: false, origins: new Set() }
  }

  const origins = new Set<string>()
  for (const candidate of raw.split(",")) {
    const origin = parseHttpOrigin(candidate.trim())
    if (!origin || origins.has(origin)) return { valid: false, origins: new Set() }
    origins.add(origin)
  }
  return { valid: true, origins }
}

const API_AUTH_CONFIGURATION = parseApiAuthorizationConfiguration(process.env.REVIEW_API_PRINCIPALS)
const ALLOWED_ORIGINS_CONFIGURATION = parseAllowedOrigins(process.env.REVIEW_API_ALLOWED_ORIGINS)

if (API_AUTH_CONFIGURATION.state === "invalid") {
  // Do not include the parse error or environment value: configuration often
  // contains bearer tokens and deployment logs are not a credential store.
  console.error("Review API authorization configuration is invalid; API access is fail-closed.")
}
if (!ALLOWED_ORIGINS_CONFIGURATION.valid) {
  console.error("Review API allowed-origin configuration is invalid; API access is fail-closed.")
}

// Fixed-window request limits are intentionally conservative. The map is
// bounded by configured principals × the three role buckets below, rather than
// by attacker-controlled IP addresses or request paths. It is a single-process
// safety belt, not a substitute for a shared edge limiter in a public
// multi-instance deployment.
const API_RATE_LIMIT = numberFromEnv("REVIEW_API_RATE_LIMIT", 120, { min: 1, max: 10_000 })
const API_RATE_WINDOW_MS = numberFromEnv("REVIEW_API_RATE_WINDOW_MS", 60_000, {
  min: 1_000,
  max: 3_600_000,
})
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>()

const API_PREFLIGHT_HEADERS = {
  "access-control-allow-methods": "GET, POST, PUT, OPTIONS",
  "access-control-allow-headers": "authorization, content-type",
}
const ALLOWED_PREFLIGHT_HEADERS = new Set(["authorization", "content-type"])

function jsonResponse(
  data: unknown,
  status: number,
  corsHeaders: Record<string, string> = {},
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...SECURITY_HEADERS,
      ...corsHeaders,
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  })
}

/**
 * Reject cross-origin API calls unless their exact origin is explicitly trusted.
 * Same-origin requests do not need configuration; requests without Origin are
 * non-browser or same-origin clients and deliberately receive no CORS header.
 */
function getApiRequestContext(req: Request, url: URL): ApiRequestContext | Response {
  if (!ALLOWED_ORIGINS_CONFIGURATION.valid) {
    return jsonResponse({ error: "API CORS configuration is invalid." }, 503)
  }

  const origin = req.headers.get("origin")
  if (!origin) return { corsHeaders: {} }

  const normalizedOrigin = parseHttpOrigin(origin)
  if (
    !normalizedOrigin ||
    (normalizedOrigin !== url.origin && !ALLOWED_ORIGINS_CONFIGURATION.origins.has(normalizedOrigin))
  ) {
    return jsonResponse({ error: "Origin is not allowed." }, 403)
  }

  return {
    corsHeaders: {
      "access-control-allow-origin": normalizedOrigin,
      vary: "Origin",
    },
  }
}

/**
 * OPTIONS requests cannot carry Authorization, so an allowed CORS preflight is
 * not proof of access. The subsequent request still must authenticate, pass a
 * role check, and consume its principal's own rate-limit bucket.
 */
function preflightResponse(req: Request, context: ApiRequestContext): Response {
  const requestedMethod = req.headers.get("access-control-request-method")
  if (requestedMethod && !["GET", "POST", "PUT", "OPTIONS"].includes(requestedMethod.toUpperCase())) {
    return jsonResponse({ error: "CORS method is not allowed." }, 403, context.corsHeaders)
  }

  const requestedHeaders = req.headers.get("access-control-request-headers")
  if (requestedHeaders) {
    const headers = requestedHeaders.split(",").map((header) => header.trim().toLowerCase())
    if (headers.some((header) => !header || !ALLOWED_PREFLIGHT_HEADERS.has(header))) {
      return jsonResponse({ error: "CORS headers are not allowed." }, 403, context.corsHeaders)
    }
  }

  return new Response(null, {
    status: 204,
    headers: {
      ...SECURITY_HEADERS,
      ...context.corsHeaders,
      ...API_PREFLIGHT_HEADERS,
      "cache-control": "no-store",
    },
  })
}

/* Same-origin reviewer sessions
   =============================
   The API is bearer-gated and the browser bundle is public, so a token can
   never ship in it — which left every reviewer pasting a token by hand, and is
   the reason sync went unused. Railway changed the constraint that forced
   that: `server.ts` serves the app and `/api/*` from ONE origin now, so a
   cookie set by this server is sent back by the same page automatically.

   A reviewer signs in once per browser with a shared password
   (`REVIEW_SESSION_PASSWORD`) and gets a cookie. Bearer tokens keep working
   unchanged, which is what tests and scripts use.

   **The cookie is a signed assertion, not a stored session.** Its value is
   `<principal>.<expiry>.<HMAC>`, verified on every request — no session table,
   nothing to replicate between instances, and nothing to lose on restart. The
   signing key is derived from the configured API tokens, so rotating
   `REVIEW_API_TOKEN` invalidates every outstanding session, which is the
   behaviour you want from a rotation.

   **A session gets `review:read` and `review:write` only — never
   `ai:generate`.** AI calls cost money per request and the AI client has its
   own configuration; a shared password that also unlocked paid generation
   would make one leaked password an unbounded bill. */
const SESSION_COOKIE_NAME = "hhvc_session"
const SESSION_PRINCIPAL_NAME = "session-reviewer"
const REVIEW_SESSION_PASSWORD = process.env.REVIEW_SESSION_PASSWORD ?? ""
const SESSION_TTL_MS =
  numberFromEnv("REVIEW_SESSION_TTL_HOURS", 12, { min: 1, max: 720 }) * 60 * 60 * 1000

/**
 * Failed sign-in attempts, one fixed window for the whole server.
 *
 * The per-principal limiter cannot help here: a sign-in attempt has no
 * principal yet, which is the whole point of the request. A global window is
 * blunt — a determined attacker can lock out reviewers — but a shared password
 * with no throttle at all is worse, and the alternative (keying on client IP)
 * is not trustworthy behind a proxy this server does not control.
 */
const SESSION_ATTEMPT_LIMIT = 10
const SESSION_ATTEMPT_WINDOW_MS = 60_000
let sessionAttempts = { count: 0, resetAt: 0 }

/**
 * Whether sign-in is available at all.
 *
 * Requires BOTH a password and a configured API, since a session is only
 * useful as a way to reach an API that exists.
 */
function isSessionLoginConfigured(): boolean {
  return Boolean(REVIEW_SESSION_PASSWORD) && API_AUTH_CONFIGURATION.state === "configured"
}

/**
 * The HMAC key for session cookies.
 *
 * Derived from the configured tokens rather than stored separately: it means
 * there is no extra secret to provision, and rotating the API token
 * invalidates outstanding sessions. `REVIEW_SESSION_SECRET` overrides it for a
 * deployment that wants the two lifecycles separated.
 */
function sessionSigningKey(): string {
  if (process.env.REVIEW_SESSION_SECRET) return process.env.REVIEW_SESSION_SECRET
  const tokens =
    API_AUTH_CONFIGURATION.state === "configured"
      ? API_AUTH_CONFIGURATION.principals.map((principal) => principal.token).join(" ")
      : ""
  return createHash("sha256").update(`hhvc-session-v1 ${tokens}`).digest("hex")
}

/**
 * Sign a session assertion that expires at `expiresAt`.
 */
function signSessionValue(expiresAt: number): string {
  const payload = `${SESSION_PRINCIPAL_NAME}.${expiresAt}`
  const signature = createHmac("sha256", sessionSigningKey()).update(payload).digest("base64url")
  return `${payload}.${signature}`
}

/**
 * Verify a cookie value, returning true only for an intact, unexpired
 * signature. Comparison is constant-time so a forged signature cannot be
 * refined byte by byte from response timing.
 */
function verifySessionValue(value: string): boolean {
  const separator = value.lastIndexOf(".")
  if (separator <= 0) return false
  const payload = value.slice(0, separator)
  const provided = Buffer.from(value.slice(separator + 1))
  const expected = Buffer.from(
    createHmac("sha256", sessionSigningKey()).update(payload).digest("base64url")
  )
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return false

  const [principal, expiresAt] = payload.split(".")
  if (principal !== SESSION_PRINCIPAL_NAME) return false
  const expiry = Number.parseInt(expiresAt ?? "", 10)
  return Number.isFinite(expiry) && Date.now() < expiry
}

/**
 * Read one cookie out of a request's Cookie header.
 */
function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie")
  if (!header) return null
  for (const part of header.split(";")) {
    const index = part.indexOf("=")
    if (index === -1) continue
    if (part.slice(0, index).trim() !== name) continue
    return decodeURIComponent(part.slice(index + 1).trim())
  }
  return null
}

/**
 * The principal a valid session cookie stands for.
 *
 * Built fresh rather than looked up: it holds no token, so it can never be
 * matched by the bearer path, and its roles are fixed here rather than read
 * from configuration.
 */
function sessionPrincipal(): ApiPrincipal {
  return {
    principal: SESSION_PRINCIPAL_NAME,
    token: "",
    roles: new Set<ApiRole>([API_ROLES.reviewRead, API_ROLES.reviewWrite]),
  }
}

/**
 * `Secure` is omitted on plain-HTTP localhost only.
 *
 * A cookie marked Secure is never sent over http://, which would silently
 * break `bun run dev:api` and the local verification flow. Everything else —
 * including any real deployment — gets it.
 */
function sessionCookieAttributes(url: URL): string {
  const isLocalHttp =
    url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")
  const secure = isLocalHttp ? "" : " Secure;"
  // SameSite=Strict is the CSRF control: a cookie-authenticated PUT cannot be
  // triggered by another site, because the browser will not attach this cookie
  // to a cross-site request at all. The API also rejects unlisted origins and
  // requires a JSON content type, so a cross-site form post cannot reach it
  // either.
  return `Path=/; HttpOnly;${secure} SameSite=Strict`
}

function constantTimeBearerMatch(header: string, token: string): boolean {
  const received = Buffer.from(header)
  const expected = Buffer.from(`Bearer ${token}`)
  return received.length === expected.length && timingSafeEqual(received, expected)
}

/**
 * Return a configured principal for this bearer credential. Every configured
 * candidate is compared, rather than returning from the first match, so a
 * matching position cannot be learned by timing a list of credentials.
 */
function authenticatePrincipal(req: Request): ApiPrincipal | null {
  if (API_AUTH_CONFIGURATION.state !== "configured") return null

  const header = req.headers.get("authorization") ?? ""
  let matched: ApiPrincipal | null = null
  for (const principal of API_AUTH_CONFIGURATION.principals) {
    if (constantTimeBearerMatch(header, principal.token)) matched = principal
  }
  if (matched) return matched

  // Fall back to a same-origin session cookie. Checked AFTER the bearer loop
  // so an explicit token always wins — a script running with a scoped token in
  // a browser that also holds a reviewer session must get the token's roles,
  // not the session's.
  const cookie = readCookie(req, SESSION_COOKIE_NAME)
  if (cookie && verifySessionValue(cookie)) return sessionPrincipal()
  return null
}

/**
 * The `/api/session` routes: sign in, check, sign out.
 *
 * Deliberately outside `requireApiPrincipal` — this is how a browser BECOMES a
 * principal, so gating it on already being one would be circular.
 */
async function handleSessionApi(req: Request, url: URL): Promise<Response> {
  const context = getApiRequestContext(req, url)
  if (context instanceof Response) return context
  if (req.method === "OPTIONS") return preflightResponse(req, context)

  if (req.method === "GET") {
    const cookie = readCookie(req, SESSION_COOKIE_NAME)
    return jsonResponse(
      {
        active: Boolean(cookie && verifySessionValue(cookie)),
        loginAvailable: isSessionLoginConfigured(),
      },
      200,
      context.corsHeaders
    )
  }

  if (req.method === "DELETE") {
    return jsonResponse({ active: false }, 200, context.corsHeaders, {
      "set-cookie": `${SESSION_COOKIE_NAME}=; ${sessionCookieAttributes(url)}; Max-Age=0`,
    })
  }

  if (req.method !== "POST") return jsonResponse({ error: "Not Found" }, 404, context.corsHeaders)

  if (!isSessionLoginConfigured()) {
    return jsonResponse(
      { error: "Reviewer sign-in is not configured on this server (REVIEW_SESSION_PASSWORD unset)." },
      501,
      context.corsHeaders
    )
  }

  const now = Date.now()
  if (now >= sessionAttempts.resetAt) {
    sessionAttempts = { count: 0, resetAt: now + SESSION_ATTEMPT_WINDOW_MS }
  }
  if (sessionAttempts.count >= SESSION_ATTEMPT_LIMIT) {
    return jsonResponse({ error: "Too many sign-in attempts. Try again shortly." }, 429, context.corsHeaders, {
      "retry-after": String(Math.max(1, Math.ceil((sessionAttempts.resetAt - now) / 1000))),
    })
  }

  const raw = await readBodyWithLimit(req, 4096)
  if (raw === null) return jsonResponse({ error: "Request body is too large." }, 413, context.corsHeaders)

  let password = ""
  try {
    const parsed = JSON.parse(raw)
    password = typeof parsed?.password === "string" ? parsed.password : ""
  } catch {
    return jsonResponse({ error: "Request body must be JSON." }, 400, context.corsHeaders)
  }

  // Length is compared first because timingSafeEqual throws on a mismatch;
  // the length of a shared password is not the secret worth protecting.
  const provided = Buffer.from(password)
  const expected = Buffer.from(REVIEW_SESSION_PASSWORD)
  const matches = provided.length === expected.length && timingSafeEqual(provided, expected)
  if (!matches) {
    sessionAttempts.count += 1
    return jsonResponse({ error: "Incorrect password." }, 401, context.corsHeaders)
  }

  const expiresAt = Date.now() + SESSION_TTL_MS
  return jsonResponse({ active: true }, 200, context.corsHeaders, {
    "set-cookie": `${SESSION_COOKIE_NAME}=${signSessionValue(expiresAt)}; ${sessionCookieAttributes(url)}; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  })
}

function requireApiPrincipal(
  req: Request,
  apiName: string,
  context: ApiRequestContext
): ApiPrincipal | Response {
  if (API_AUTH_CONFIGURATION.state === "disabled") {
    return jsonResponse(
      { error: `${apiName} is not configured on this server (REVIEW_API_TOKEN unset).` },
      501,
      context.corsHeaders
    )
  }
  if (API_AUTH_CONFIGURATION.state === "invalid") {
    return jsonResponse(
      { error: "API authorization configuration is invalid." },
      503,
      context.corsHeaders
    )
  }

  const principal = authenticatePrincipal(req)
  if (!principal) {
    return jsonResponse(
      { error: "Unauthorized" },
      401,
      context.corsHeaders,
      { "www-authenticate": "Bearer" }
    )
  }
  return principal
}

function consumeRateLimit(principal: ApiPrincipal, role: ApiRole): number | null {
  const now = Date.now()
  const key = `${principal.principal}\u0000${role}`
  const current = rateLimitBuckets.get(key)
  if (!current || now >= current.resetAt) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + API_RATE_WINDOW_MS })
    return null
  }
  if (current.count >= API_RATE_LIMIT) {
    return Math.max(1, Math.ceil((current.resetAt - now) / 1000))
  }
  current.count += 1
  return null
}

function requireApiRole(
  principal: ApiPrincipal,
  role: ApiRole,
  context: ApiRequestContext
): Response | null {
  if (!principal.roles.has(role)) {
    return jsonResponse({ error: "Forbidden" }, 403, context.corsHeaders)
  }

  const retryAfter = consumeRateLimit(principal, role)
  if (retryAfter !== null) {
    return jsonResponse(
      { error: "Rate limit exceeded. Try again later." },
      429,
      context.corsHeaders,
      { "retry-after": String(retryAfter) }
    )
  }
  return null
}

/**
 * Ceiling on a single review-record PUT.
 *
 * Deliberately LARGER than the AI cap, even though a typical review record is
 * far smaller than an AI request. `history[]` is append-only and the client
 * pushes the whole record, so this limit is not a quota on one edit — it is a
 * ceiling on the accumulated history of a page's entire review life. Once a
 * record crosses it, every subsequent push fails and the reviewer cannot
 * recover from the UI: shortening the current note does not remove historical
 * copies. That is a permanent sync lockout, which is far worse than the
 * unbounded read this cap exists to prevent.
 *
 * 64 KB was measured as roughly 70 recorded rounds with long notes — reachable
 * on a page that goes back and forth through a real review cycle. 1 MB clears
 * that by more than an order of magnitude while still bounding memory, which
 * is all the cap is actually for on an authenticated endpoint.
 */
const MAX_REVIEW_BODY_BYTES = 1024 * 1024

/**
 * How far past a body cap `readBodyWithLimit` will keep draining before it
 * gives up and breaks the connection. Draining keeps the connection usable for
 * the client's next request; this stops a sender who ignores the 413 from
 * making us read forever.
 */
const DRAIN_LIMIT_MULTIPLIER = 8

// Where review records live is decided by build_scripts/storage.js: Postgres
// when DATABASE_URL is set (Railway injects it from the managed Postgres
// service), SQLite at DATA_DB_PATH otherwise — local dev, and every server
// test. This file no longer knows which, or speaks either dialect.

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
      let chunk
      try {
        chunk = await reader.read()
      } catch {
        // The client went away or the connection errored mid-upload.
        // reader.read() rejects, and neither call site wraps this function, so
        // letting it escape turns an ordinary disconnect into an unhandled
        // rejection and a 500. There is no usable body either way — report it
        // as empty and let the JSON parse produce the normal 400.
        return ""
      }
      const { done, value } = chunk
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

/** Reassemble the flattened { version, updated_at, ui, globals, pages } shape
 *  js/review-state-store.js already uses, from the per-page rows table. */
async function getFullReviewState(): Promise<object> {
  // readAllReviewPages() already drops a row it cannot parse rather than
  // failing the whole GET — one corrupt record must not cost a reviewer the
  // other twenty-eight.
  const rows = await readAllReviewPages(DATA_DB_PATH)

  const pages: Record<string, unknown> = {}
  let latestUpdatedAt: string | null = null
  for (const row of rows) {
    const parsed = row.record as { updated_at?: unknown }
    pages[row.page_key] = parsed
    if (typeof parsed.updated_at === "string" && (!latestUpdatedAt || parsed.updated_at > latestUpdatedAt)) {
      latestUpdatedAt = parsed.updated_at
    }
  }

  return { version: 1, updated_at: latestUpdatedAt, ui: {}, globals: {}, pages }
}

async function putReviewPage(
  pageKey: string,
  req: Request,
  context: ApiRequestContext
): Promise<Response> {
  // A review record accumulates append-only history across a page's whole
  // review life, so it gets its own — deliberately LARGER — ceiling rather than
  // inheriting the AI cap. See MAX_REVIEW_BODY_BYTES for why too small a limit
  // here is a permanent sync lockout.
  const raw = await readBodyWithLimit(req, MAX_REVIEW_BODY_BYTES)
  if (raw === null) {
    return jsonResponse(
      { error: `Request body must be ${MAX_REVIEW_BODY_BYTES} bytes or fewer.` },
      413,
      context.corsHeaders
    )
  }

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400, context.corsHeaders)
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonResponse({ error: "Request body must be a JSON object." }, 400, context.corsHeaders)
  }

  // Validate against the same schema the browser validates GET responses
  // against (js/review-state-validation.js / build_scripts/review-state-schema.js)
  // — without this, a malformed or malicious PUT body would merge and
  // persist as-is, unlike every other entry point into review state.
  const parsed = reviewRecordSchema.safeParse(body)
  if (!parsed.success) {
    return jsonResponse(
      { error: "Invalid review record.", issues: parsed.error.issues },
      400,
      context.corsHeaders
    )
  }
  const patch = parsed.data as { updated_at?: string; synced_at?: string; [key: string]: unknown }

  const existing = (await readReviewPage(DATA_DB_PATH, pageKey)) as
    | { updated_at?: string; [key: string]: unknown }
    | null

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
        409,
        context.corsHeaders
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
  const written = await upsertReviewPageIfUnchanged(DATA_DB_PATH, {
    pageKey,
    record: merged,
    updatedAt: merged.updated_at,
    expectedUpdatedAt: existing?.updated_at ?? null,
  })
  if (!written) {
    return jsonResponse(
      { error: "Server has a newer version of this page. Pull before pushing again." },
      409,
      context.corsHeaders
    )
  }

  return jsonResponse(merged, 200, context.corsHeaders)
}

async function handleReviewStateApi(req: Request, url: URL): Promise<Response> {
  const context = getApiRequestContext(req, url)
  if (context instanceof Response) return context

  if (req.method === "OPTIONS") {
    return preflightResponse(req, context)
  }

  const principal = requireApiPrincipal(req, "Review-state sync", context)
  if (principal instanceof Response) return principal

  if (url.pathname === "/api/review-state" && req.method === "GET") {
    const roleResponse = requireApiRole(principal, API_ROLES.reviewRead, context)
    if (roleResponse) return roleResponse
    return jsonResponse(await getFullReviewState(), 200, context.corsHeaders)
  }

  const pageMatch = url.pathname.match(/^\/api\/review-state\/pages\/([^/]+)$/)
  if (pageMatch && req.method === "PUT") {
    const roleResponse = requireApiRole(principal, API_ROLES.reviewWrite, context)
    if (roleResponse) return roleResponse
    return putReviewPage(decodeURIComponent(pageMatch[1]), req, context)
  }

  return jsonResponse({ error: "Not Found" }, 404, context.corsHeaders)
}

// --- Optional AI assist backend (GET/POST /api/ai/*) ---------------------
//
// Same posture as the review-state sync layer above: entirely additive, off by
// default, and failing closed. The shared API authorization configuration
// (legacy REVIEW_API_TOKEN or REVIEW_API_PRINCIPALS) controls whether the API
// exists at all, and at least one provider key (ANTHROPIC_API_KEY,
// GEMINI_API_KEY) controls whether generation is possible. The keys never
// leave the server: the browser talks only to this origin.
//
// Nothing here writes to disk or to review state. Generated drafts are returned
// to the browser to preview, copy, and download — they never touch pages/*.js.
// HHVC standards manual §1.11 forbids any automated approval, and SF.gov's AI
// guidelines require generative-AI use to be disclosed, so every response
// carries a `disclosure` string the client renders alongside the draft.

/**
 * Whole-request budget for a generation, covering both validation attempts and
 * every SDK-level retry inside them. Four minutes is generous for one page at
 * high effort and still well under the client's own 180s-per-attempt patience,
 * so the browser gives up first in the normal case and this only catches a
 * genuinely wedged upstream.
 */
// max: one hour, matching ANTHROPIC_TIMEOUT_MS. The ceiling is not decorative:
// this value is handed straight to AbortSignal.timeout(), which throws a
// TypeError past Number.MAX_SAFE_INTEGER, and it is called BEFORE the generate
// route's try block — so an out-of-range value here is an unmapped 500 on every
// generation rather than a merely over-generous budget.
const AI_REQUEST_TIMEOUT_MS = numberFromEnv("AI_REQUEST_TIMEOUT_MS", 240_000, { max: 3_600_000 })

/** Map a thrown error to a status code and a message worth showing a reviewer. */
function aiErrorResponse(
  error: unknown,
  context: ApiRequestContext,
  signals?: { client?: AbortSignal; timeout?: AbortSignal }
): Response {
  if (error instanceof RefusalError) {
    // A refusal is a content outcome, not a server fault. 422 so the client can
    // say "the model declined" rather than "something broke". Raised by both
    // providers from their own very different signals (Claude's
    // `stop_reason: 'refusal'`, Gemini's blockReason/finishReason), normalized
    // in build_scripts/ai/errors.js so this stays one check.
    return jsonResponse(
      { error: error.message, category: error.category, explanation: error.explanation },
      422,
      context.corsHeaders
    )
  }

  if (error instanceof UnknownProviderError) {
    // 400, NOT 501. The server is working; the client asked for a provider this
    // deployment does not have, which in practice means a panel still holding a
    // picker built from another endpoint's capabilities. `available` lets it
    // recover without the reviewer guessing.
    return jsonResponse({ error: error.message, available: error.available }, 400, context.corsHeaders)
  }

  if (error instanceof ProviderTimeoutError) {
    // A provider's OWN deadline expired inside our longer budget, so neither
    // signal below is aborted and the error has to carry the distinction
    // itself. Checked before the signal branches because it is strictly more
    // specific than either: the provider already established that the client
    // was still connected when it gave up.
    //
    // This exists because Gemini's SDK aborts on timeout with a bare
    // `abort()`, producing a DOMException named "AbortError" — identical to a
    // reviewer pressing Cancel, and so answered 499 "Generation was
    // cancelled." for a request nobody cancelled. Normalized at the provider
    // boundary (build_scripts/ai/provider-gemini.js) where the caller's signal
    // is still in scope to tell the two apart.
    return jsonResponse({ error: "Generation timed out." }, 504, context.corsHeaders)
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
    return jsonResponse({ error: "Generation was cancelled." }, 499, context.corsHeaders)
  }
  if (signals?.timeout?.aborted) {
    // Our own budget expired, which is a gateway timeout rather than a client
    // cancellation. Separating the two lets the log answer "who gave up first?"
    // instead of collapsing both into one ambiguous code.
    return jsonResponse({ error: "Generation timed out." }, 504, context.corsHeaders)
  }
  // Fallback for aborts raised where NO signal was threaded through, so the
  // mapping degrades to something sane instead of back to a logged 500.
  //
  // Anthropic's own per-call deadline (APIConnectionTimeoutError, thrown
  // when the caller's signal was NOT the one that aborted) is normalized at
  // the provider boundary — see provider-anthropic.js's classifyAbort, which
  // mirrors provider-gemini.js's — and gets caught above by the
  // ProviderTimeoutError branch, so that exact case (the SDK's own timeout
  // firing inside our longer budget) never reaches this fallback anymore.
  // APIUserAbortError is NOT normalized there — classifyAbort rethrows it
  // untouched, since it only ever fires when the caller's own signal aborted
  // the call, and that case is already caught by the signals?.client?.aborted
  // branch above, before classifyAbort even runs.
  // What's left here is a provider-agnostic backstop: a real DOMException
  // named "AbortError"/"TimeoutError" raised somewhere outside a provider's
  // own normalization (e.g. AbortSignal.timeout() firing directly, or a
  // future provider that hasn't grown its own classifyAbort yet), which
  // every provider's own classifyAbort already rethrows untouched when it
  // doesn't recognize the shape.
  //
  // Matched on the DOMException's own `error.name` — a plain string —
  // rather than `instanceof`. An `instanceof` check against an SDK's error
  // classes is what this branch used to do, and it was doubly dead: the
  // relevant SDK errors carry name "Error" with no `status`, and
  // `@anthropic-ai/sdk` ships separate require/import builds, so a class
  // imported here would never be the same constructor as the one the
  // thrown error was actually built from. `error.name` needs no SDK import
  // and no per-provider class knowledge, so it stays correct as providers
  // are added.
  const errorName = (error as { name?: string })?.name
  if (errorName === "AbortError") {
    return jsonResponse({ error: "Generation was cancelled." }, 499, context.corsHeaders)
  }
  if (errorName === "TimeoutError") {
    return jsonResponse({ error: "Generation timed out." }, 504, context.corsHeaders)
  }

  const status = (error as { status?: number })?.status
  if (typeof status === "number" && status >= 400 && status < 600) {
    // An upstream API error (bad key, rate limit, overload). Surface it as a
    // gateway failure with the upstream status attached, so a 429 is not
    // mistaken for a bug in this server.
    //
    // The upstream MESSAGE stays out of the response body — it is written by a
    // third party and may name internal detail the browser has no business
    // seeing — but it is logged, because withholding it from the operator too
    // is what makes an upstream failure undiagnosable. A real 400 here read
    // "Your credit balance is too low to access the Anthropic API", and with
    // only the bare status reaching anyone it was investigated for a while as
    // a wrong model id. The 500 branch below has always logged; this one did
    // not, and the status alone is rarely enough to act on.
    console.error(`AI provider returned ${status}:`, (error as Error)?.message)
    return jsonResponse(
      { error: `The model provider returned ${status}.`, upstreamStatus: status },
      502,
      context.corsHeaders
    )
  }
  console.error("AI request failed:", error)
  return jsonResponse(
    { error: (error as Error)?.message || "AI request failed." },
    500,
    context.corsHeaders
  )
}

async function handleAiApi(req: Request, url: URL): Promise<Response> {
  const context = getApiRequestContext(req, url)
  if (context instanceof Response) return context

  if (req.method === "OPTIONS") {
    return preflightResponse(req, context)
  }

  const principal = requireApiPrincipal(req, "AI assist", context)
  if (principal instanceof Response) return principal

  // Deliberately answers even with no provider key at all. This is the
  // discovery endpoint the browser uses to render its empty state and build its
  // provider picker, and a 501 here would leave it unable to tell "no AI key"
  // from "no server at all".
  if (url.pathname === "/api/ai/capabilities" && req.method === "GET") {
    // Every AI endpoint requires the generation role. Capabilities and models
    // can reveal enabled providers and model names, so letting a review-only
    // token call them would weaken the role boundary even if POST stayed locked.
    const roleResponse = requireApiRole(principal, API_ROLES.aiGenerate, context)
    if (roleResponse) return roleResponse
    return jsonResponse(await getCapabilities(), 200, context.corsHeaders)
  }

  // The provider gate is checked INSIDE each route that needs it, not before
  // the routing below. Hoisting it would make every unmatched path answer 501
  // "no provider configured" instead of 404, which tells a client the route
  // exists when it does not.
  //
  // The condition is "no provider at all", not "this specific key is unset" —
  // a deployment with only a Gemini key is fully working, and a request naming
  // an unconfigured provider is a 400 raised downstream by resolveProvider, not
  // a 501 from here. Read from the registry per request rather than a
  // start-time constant so the two cannot drift.
  const noProvider = () =>
    jsonResponse(
      {
        error:
          "No model provider is configured on this server " +
          "(set ANTHROPIC_API_KEY or GEMINI_API_KEY).",
      },
      501,
      context.corsHeaders
    )

  if (url.pathname === "/api/ai/models" && req.method === "GET") {
    const roleResponse = requireApiRole(principal, API_ROLES.aiGenerate, context)
    if (roleResponse) return roleResponse
    if (!hasConfiguredProvider()) return noProvider()
    try {
      return jsonResponse(await listModels(), 200, context.corsHeaders)
    } catch (error) {
      return aiErrorResponse(error, context)
    }
  }

  if (url.pathname === "/api/ai/generate" && req.method === "POST") {
    const roleResponse = requireApiRole(principal, API_ROLES.aiGenerate, context)
    if (roleResponse) return roleResponse
    if (!hasConfiguredProvider()) return noProvider()

    // Refuse a body BEFORE reading it when the client has honestly declared one
    // so large that draining it is not worth the bandwidth. The Zod schema
    // bounds `page`, but only after req.json() has already buffered and parsed
    // the whole payload — so without a cap of some kind the cheapest way to burn
    // server memory is a request the validator was always going to reject.
    //
    // The threshold is deliberately the DRAIN limit, not the body cap. Answering
    // here means never touching `req.body`, which leaves the client's payload
    // sitting unread in the socket: the next request on that keep-alive
    // connection starts parsing mid-body, and Bun reads the leftover bytes as a
    // header block and answers 431 — or never answers at all. That is the same
    // connection corruption the drain branch in readBodyWithLimit exists to
    // avoid, reached from the other direction, and it is why this check has to
    // stop short of the cases that function can already handle cleanly.
    //
    // Between the cap and the drain limit, falling through costs one drain and
    // returns the identical 413 with the connection still usable — draining is
    // cheaper than closing a connection a well-behaved client would just reopen.
    // PAST the drain limit there is no such option: readBodyWithLimit would give
    // up on the connection anyway once it started reading, so there is nothing
    // to preserve by falling through, and refusing here still leaves the body
    // unread. `Connection: close` on the response is what actually prevents the
    // corruption in that case — without it, an HONEST client whose declared
    // size clears this threshold reproduces the exact keep-alive poisoning this
    // whole pre-check exists to avoid, just at a higher bar to trigger it.
    // Verified against a raw socket: Bun honors the header and answers nothing
    // further on that connection, rather than parsing the unread bytes as the
    // next request's framing.
    const declaredLength = Number(req.headers.get("content-length") ?? Number.NaN)
    if (
      Number.isFinite(declaredLength) &&
      declaredLength > MAX_REQUEST_BODY_BYTES * DRAIN_LIMIT_MULTIPLIER
    ) {
      return jsonResponse(
        { error: `Request body must be ${MAX_REQUEST_BODY_BYTES} bytes or fewer.` },
        413,
        context.corsHeaders,
        { Connection: "close" }
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
        413,
        context.corsHeaders
      )
    }

    let body: unknown
    try {
      body = JSON.parse(raw)
    } catch {
      return jsonResponse({ error: "Request body must be valid JSON." }, 400, context.corsHeaders)
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonResponse({ error: "Request body must be a JSON object." }, 400, context.corsHeaders)
    }

    const parsed = generateRequestSchema.safeParse(body)
    if (!parsed.success) {
      return jsonResponse(
        { error: "Invalid request.", issues: parsed.error.issues },
        400,
        context.corsHeaders
      )
    }

    if (parsed.data.task === "compliance-audit" && !(await isComplianceAuditAvailable())) {
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
      // Dispatch on the validated task. The request schema is a discriminated
      // union, so each branch is already guaranteed to carry the fields its
      // generator needs — `content` a prompt, `compliance-audit` a page,
      // `rewrite-field` the field text.
      const result =
        parsed.data.task === "compliance-audit"
          ? await generateComplianceAudit({ ...parsed.data, signal })
          : parsed.data.task === "rewrite-field"
            ? await generateRewrite({ ...parsed.data, signal })
            : await generateContent({ ...parsed.data, signal })
      return jsonResponse(result, 200, context.corsHeaders)
    } catch (error) {
      return aiErrorResponse(error, context, { client: req.signal, timeout })
    }
  }

  return jsonResponse({ error: "Not Found" }, 404, context.corsHeaders)
}

// Create the review-state table before the first request rather than lazily on
// it. On SQLite that was harmless — one process, one file. On Postgres two
// replicas racing the same DDL on their first requests is not, and a boot-time
// CREATE TABLE IF NOT EXISTS removes the race for the cost of one statement.
// Awaited at module top level, which Bun supports, so `serve()` cannot start
// listening against a schema that does not exist yet.
await initStorage(DATA_DB_PATH)

const server = serve({
  hostname: HOST,
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)

    // Ahead of the review-state routes because this is how a browser becomes
    // a principal — gating sign-in on already being one would be circular.
    if (url.pathname === "/api/session") {
      return handleSessionApi(req, url)
    }

    if (url.pathname === "/api/review-state" || url.pathname.startsWith("/api/review-state/")) {
      return handleReviewStateApi(req, url)
    }

    if (url.pathname === "/api/ai" || url.pathname.startsWith("/api/ai/")) {
      return handleAiApi(req, url)
    }

    // Never let the static handler below serve a dotfile/dotdir path (e.g.
    // /.data/review-state.local.db, /.git/..., /.env.local). The static
    // branch has no denylist otherwise — it serves any existing path under
    // ROOT. ROOT now defaults to dist/, which no longer contains .data/ or
    // .git/, but the guard stays: STATIC_ROOT can point anywhere (including
    // back at the repo root, where DATA_DB_PATH's default lives), and
    // "the build output happens not to include secrets today" is a much
    // weaker guarantee than refusing dotpaths outright.
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

// The storage line names the driver but never the connection string — the
// Postgres URL carries a password, and this log goes to Railway's log stream.
console.log(`HHVC mockup server running at http://${server.hostname}:${server.port}`)
console.log(`Review state stored in ${describeStorage(DATA_DB_PATH)}`)

/* **Graceful shutdown — and the reason this is not merely tidiness.**

   Railway replaces a deployment by sending SIGTERM to the outgoing container
   and waiting out a drain window before SIGKILL. With no handler installed,
   the default disposition kills the process outright: Bun reports the script
   as terminated by a signal, `bun run` turns that into a nonzero exit (128 +
   15 = 143), and Railway reads a nonzero exit at shutdown as a CRASH — which
   is exactly what it is not. Every deploy to `main` therefore mailed
   "Deploy Crashed!" about the deployment that had just been retired on
   purpose, with the only trace being this line in the OLD deployment's log:

     error: script "serve" was terminated by signal SIGTERM (Polite quit request)

   A crash notification that fires on every healthy deploy is worse than no
   notification, because it trains the reader to ignore the one that matters.

   The second reason is the honest one. `server.stop(false)` lets in-flight
   requests finish rather than severing them mid-response; the `false` is
   load-bearing, since `true` closes active connections immediately and
   reintroduces the truncated-response behavior this block exists to remove.
   A PUT /api/review-state landing at the moment of a redeploy is a reviewer's
   decision, and the compare-and-swap in build_scripts/storage.js only protects
   against a LOST update, not against a response the client never received.

   The race against a timer is the backstop: a request that never completes
   must not hold the process past Railway's drain window, where SIGKILL would
   return us to exit 143 by a slower route. Whichever settles first wins, and
   the explicit `process.exit(0)` is what states "this was an orderly stop" to
   the platform. Storage needs no close call — no driver in
   build_scripts/storage.js exports one, and the process is exiting anyway. */
const SHUTDOWN_GRACE_MS = 10_000
let shuttingDown = false

async function shutdown(signal: string) {
  // A second SIGTERM (or a SIGINT chasing a SIGTERM) must not start a second
  // drain and race the first one's exit.
  if (shuttingDown) return
  shuttingDown = true
  console.log(`Received ${signal}; draining in-flight requests before exit`)
  await Promise.race([server.stop(false), Bun.sleep(SHUTDOWN_GRACE_MS)])
  process.exit(0)
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM")
})
process.on("SIGINT", () => {
  void shutdown("SIGINT")
})

/* **This file deliberately has no default export, and adding one back would
   crash the deployment.** `bun run server.ts` auto-serves a module's default
   export when it carries a `fetch` — so exporting the already-started `Server`
   made Bun call `Bun.serve()` on it a second time, on a port the same process
   was already listening on. Railway's Bun 1.3.0 image crash-looped on exactly
   that, logging `HHVC mockup server running at http://0.0.0.0:8080` and then
   `error: Failed to start server. Is port 8080 in use? code: "EADDRINUSE"` with
   the second frame at `bun:main` rather than anywhere in this repo.

   Nothing needed the export: `serve()` above starts the server as a side
   effect, and every test spawns `bun run server.ts` as a subprocess rather than
   importing it (see `tests/review-api-server.test.js`'s header, which says so
   explicitly). Local Bun 1.3.14 tolerated the double-serve, which is why the
   suite stayed green while the deploy was down — so a passing `bun run test` is
   not evidence this is safe to re-add. */
