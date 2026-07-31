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

module.exports = { RefusalError, UnknownProviderError }
