// Provider-neutral error types for the AI assist feature.
//
// `RefusalError` used to live in provider-anthropic.js, which made server.ts
// import an Anthropic-specific module for a concept that has nothing to do with
// Anthropic: "the model declined this request" is a content outcome every
// provider can produce, and each one reports it in its own shape (Claude sets
// `stop_reason: 'refusal'`; Gemini sets `promptFeedback.blockReason` or a
// `finishReason` of SAFETY/PROHIBITED_CONTENT/BLOCKLIST/SPII). Normalizing onto
// one class here is what lets `aiErrorResponse` in server.ts answer 422 with a
// single `instanceof` check instead of growing a per-provider branch that rots
// the day a provider is added and nobody remembers to extend it.
//
// Deliberately dependency-free, so both providers and server.ts can require it
// without pulling in an SDK.

/**
 * Raised when the model declines the request.
 *
 * Carried as its own class so the route can answer 422 rather than a generic
 * 500 — a refusal is a content outcome, not a server fault. HHVC copy covers
 * pest control, disease vectors, and code enforcement, which sits squarely in
 * the blast radius of benign-but-classifier-tripping wording, so this path is
 * reached by real requests rather than only by abuse.
 *
 * @param {{category?: string, explanation?: string}} [details] Whatever the
 *   provider said about why. Both fields are surfaced to the reviewer, so a
 *   refusal explains itself instead of reading as an outage.
 */
class RefusalError extends Error {
  constructor(details) {
    super('The model declined this request.')
    this.name = 'RefusalError'
    this.category = (details && details.category) || null
    this.explanation = (details && details.explanation) || null
  }
}

/**
 * Raised when a request names a provider this deployment cannot use.
 *
 * Distinct from "no provider is configured at all" on purpose. That is a 501 —
 * the server genuinely cannot do the thing. This is a 400: the server works
 * fine, the client asked for something specific that it does not have, which in
 * practice means a panel still showing a picker built from another endpoint's
 * capabilities. Collapsing the two would tell a reviewer their server is broken
 * when the fix is to re-read capabilities.
 *
 * @param {string} requested The provider name that could not be resolved.
 * @param {string[]} available Provider names that ARE configured, for the message.
 */
class UnknownProviderError extends Error {
  constructor(requested, available) {
    const list = available.length ? available.join(', ') : 'none'
    super(`Provider "${requested}" is not configured on this server. Available: ${list}.`)
    this.name = 'UnknownProviderError'
    this.requested = requested
    this.available = available
  }
}

/**
 * Raised when a PROVIDER's own per-call deadline expired.
 *
 * Here for the same reason `RefusalError` is: it belongs to no provider in
 * particular, and normalizing it is what keeps `aiErrorResponse` a single
 * `instanceof` rather than a per-provider branch.
 *
 * The concrete failure this prevents: each provider enforces its own timeout
 * (`ANTHROPIC_TIMEOUT_MS` / `GEMINI_TIMEOUT_MS`, both 150s) *inside* the
 * route's longer budget (`AI_REQUEST_TIMEOUT_MS`, 240s). So a provider that
 * runs out of time throws with NEITHER of the route's signals aborted, and
 * `aiErrorResponse` has to classify it from the error alone. Anthropic's SDK
 * makes that possible — it throws `APIConnectionTimeoutError`, matched by
 * `constructor.name`. Gemini's does not: `@google/genai` implements its
 * timeout as a bare `abortController.abort()` with no reason, which rejects
 * with a DOMException whose `name` is **"AbortError"** — indistinguishable
 * from the reviewer pressing Cancel, and mapped to 499 "Generation was
 * cancelled." So a request that actually timed out told the reviewer they had
 * cancelled it.
 *
 * Detecting it at the provider boundary is the only place the distinction is
 * still available: the provider knows whether the caller's signal was the one
 * that aborted, and the route does not.
 */
class ProviderTimeoutError extends Error {
  constructor(provider) {
    super('The model provider did not respond in time.')
    this.name = 'ProviderTimeoutError'
    this.provider = provider || null
  }
}

module.exports = { RefusalError, UnknownProviderError, ProviderTimeoutError }
