---
name: hhvc-ai-assist-backend
description: "HHVC repo: the optional /api/ai/* content-drafting backend — the two independent gates, the provider registry, usage normalization, input bounding and body draining, cancellation-vs-timeout classification, and the validation retry loop. Load before editing server.ts's AI routes or anything under build_scripts/ai/."
---

<!-- Extracted from CLAUDE.md/AGENTS.md on 2026-08-13. AGENTS.md remains the
     canonical copy of this content; see "Cross-tool canon" there. -->

# AI assist backend (optional)

`server.ts` also hosts an optional content-drafting API under `/api/ai/*`,
backed by `build_scripts/ai/`. Same posture as the sync backend: additive, off
by default, failing closed.

- **Two independent gates.** The shared optional API authorization
  configuration described above (legacy `REVIEW_API_TOKEN` or
  `REVIEW_API_PRINCIPALS`) decides whether the API exists; no configuration
  makes every actual `/api/ai/*` route 501. A CORS `OPTIONS` preflight remains
  unauthenticated because browsers cannot attach the bearer header to it, but
  it must pass the exact-origin policy and grants no role. `ai:generate` is
  required for every AI route. `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` decides
  whether generation works; unset makes `generate` and `models` 501 while
  `capabilities` still answers. That asymmetry is deliberate — `capabilities`
  is the browser's discovery endpoint, and a 501 there cannot be told apart
  from "no server at all".
- **The provider gate lives inside each route, not before routing**, so an
  unknown path answers 404 rather than 501 claiming the route exists.
- **Two providers, behind a registry.** `build_scripts/ai/providers.js` holds
  `provider-anthropic.js` and `provider-gemini.js` behind one list; nothing in
  `index.js` or `server.ts` names a provider. A third is a require plus a line
  there. Every entry exports the same surface: `name`, `label`,
  `isConfigured()`, `getModel()`, `listModelIds()`, `normalizeUsage()`, and
  `generateObject({system, userPrompt, jsonSchema, signal})`. Configuration is
  read from the environment **per call**, not snapshot at require time — the
  registry is a module singleton `server.ts` imports once at startup, so caching
  it would freeze the first environment it ever saw.
- **Registration order is the preference order.** An unnamed request runs on the
  first _configured_ provider (Claude, then Gemini). A request naming an
  unconfigured provider is a **400**, never a silent fallback — running a Gemini
  request on Claude would attribute one model's output to another in the panel's
  meta line and in the downloaded module. "Nothing configured at all" stays a
  501: the server genuinely cannot, rather than merely lacking what was asked for.
- **Shared error types live in `build_scripts/ai/errors.js`**, not in a provider
  module. `RefusalError` is raised by both providers from entirely different
  signals — Claude's `stop_reason: 'refusal'`, Gemini's `promptFeedback.blockReason`
  or a `finishReason` of `SAFETY`/`PROHIBITED_CONTENT`/`BLOCKLIST`/`SPII` — so
  `server.ts` maps 422 with one `instanceof` instead of a per-provider branch
  that rots the day a provider is added. `provider-anthropic.js` re-exports it,
  since that was the documented import site.
- **Usage is normalized at the provider boundary** to
  `{inputTokens, outputTokens, totalTokens}`, because `addUsage()` sums usage
  across the validation retry field by field and Anthropic's `input_tokens` and
  Gemini's `promptTokenCount` would otherwise sum into something meaningless.
  Gemini's `totalTokenCount` is trusted over input+output: thinking tokens are
  billed on top, so recomputing understates exactly the thinking-heavy requests
  this feature makes. Provider-native counters ride alongside as
  `usageByAttempt[]` rather than inside the sum — `addUsage` keeps the _first_
  attempt's value for non-numeric fields, so a nested raw object in the total
  would claim attempt one's numbers covered every attempt.
- **Anthropic's input total is all THREE counters**, per the API's own
  definition: `input_tokens` **+** `cache_creation_input_tokens` **+**
  `cache_read_input_tokens`. They are reported separately, not folded in. This
  is not a rounding detail here: `prompts.js` inlines the whole vendored style
  corpus and marks it `cache_control` precisely so it is cached, so on a warm
  request nearly the entire prompt is billed through `cache_read_input_tokens`
  and `input_tokens` is a small remainder. Reading only that counter reported
  **42** input tokens for a request that really used **18042** — understating
  usage by most of the prompt on exactly the requests the caching exists to
  make cheap.
- **The `provider` enum is read from the registry, never written out.**
  `schemas.js` builds it from `allProviderNames()`. A second hardcoded list
  silently breaks the "a require plus a line in `REGISTRY`" contract:
  `capabilities` would advertise the new provider and the browser picker would
  send its name, but the schema would reject the request as malformed before
  `resolveProvider` ever ran — a failure that reads as a client bug rather than
  a missed registration.
- **Routes**: `GET /api/ai/capabilities` (per-provider `providers`, `models`,
  `providerLabels`, and `defaultProvider` — every _registered_ provider, including
  unconfigured ones, so the panel can tell "no key for Gemini" from "no Gemini
  here"), `GET /api/ai/models` (queried live, never hardcoded; settled per
  provider so one bad key does not blank the other's list),
  `POST /api/ai/generate` (`{task, prompt, page?, provider?}`, Zod-validated).
- **Env**: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (default `claude-opus-5`),
  `AI_EFFORT` (default `high`), `ANTHROPIC_BASE_URL` (tests only);
  `GEMINI_API_KEY`, `GEMINI_MODEL` (default `gemini-2.5-pro`),
  `GEMINI_MAX_ATTEMPTS` (default 2), `GEMINI_TIMEOUT_MS`, `GEMINI_BASE_URL`
  (tests only). Keep them in the gitignored `.env.local`.
- **Gemini specifics that a naive port gets wrong.** Use `responseJsonSchema`,
  not `responseSchema` — the latter takes a narrower OpenAPI subset, and the
  wider one is what lets `PAGE_OUTPUT_SCHEMA` be shared byte-for-byte instead of
  forked into a second copy `tests/ai-assist-schema.test.js` would have to guard
  twice. Check `promptFeedback.blockReason` **and** `candidates[0].finishReason`:
  the first covers a blocked _input_ where no candidate exists at all, and
  checking only the second makes those surface as "returned no text" and read as
  an outage. Both are checked before touching content, for the same reason the
  Claude path checks `stop_reason` first. `finishMessage` looks like the refusal
  explanation and is always absent — it is Vertex-only and the SDK's converter
  drops it on the Developer API path — so the explanation is built from the
  blocked `safetyRatings` entries instead. `httpOptions.retryOptions.attempts`
  defaults to **5**, which composes as badly as the Anthropic default did: two
  validation attempts times five is ten upstream calls per click, so it is
  pinned to 2. There is no `cache_control` equivalent; Gemini caches implicitly
  on a prefix match, which is exactly what `prompts.js`'s byte-stability rule
  already provides. API-key auth only — `@google/genai` also speaks to Vertex,
  but that is a different credential story than a single `GEMINI_API_KEY`.
- **Every input is bounded, and the bound is enforced while reading.** `prompt`
  caps at 8000 characters, but `page` is serialized into the provider prompt
  just the same — so it carries its own limits (96 KB serialized, 12 levels
  deep). The body goes through `readBodyWithLimit()`, which streams `req.body`
  and stops at the first byte past 128 KB. `await req.text()` is the wrong
  tool: it buffers everything before anything can measure it, so a chunked or
  Content-Length-lying client allocates freely and a later 413 does not give
  that back. The Content-Length pre-check stays as a cheap first pass, but **it
  triggers at the DRAIN limit (8× the cap), not at the cap** — answering from it
  means never touching `req.body`, leaving the client's payload unread in the
  socket and corrupting the very next request on that keep-alive connection.
  That is the same failure the drain branch below prevents, reached from the
  other direction; it surfaced as a 431 (Bun reading leftover body bytes as a
  header block) on whichever test ran next, and it is why the pre-check must
  stop short of the range `readBodyWithLimit` handles cleanly. Between the cap
  and the drain limit, falling through costs one drain and returns the identical
  413 with the connection intact. The count
  is in **bytes, not characters** — `String#length` against a byte limit lets
  multi-byte UTF-8 through at ~3× the cap. Depth is measured iteratively, never
  recursively: a recursive walk over attacker-supplied nesting is itself the
  denial of service it exists to detect.
- **Past the cap it stops accumulating but keeps draining.** Cancelling the
  reader leaves the connection framed mid-request, so the client's _next_
  request is read as garbage and gets an empty-bodied protocol-level 400 from
  Bun — a 413 followed by an inexplicable failure on a valid follow-up.
  Dropping the accumulated text is what bounds memory; draining costs only
  bandwidth already in flight. `DRAIN_LIMIT_MULTIPLIER` (8×) bounds that too.
  The regression test must trickle chunks on a timer, or the client finishes
  sending before the server reads and the bug hides.
- **The `page` cap measures the string actually sent.**
  `serializePageForPrompt()` is shared by the size refinement and
  `buildContentUserPrompt`. They used to differ (compact measured,
  pretty-printed sent), so a page could measure ~100 KB and arrive ~4x larger.
  Real pages expand only ~1.2x, so nothing legitimate is rejected.
- **Cancellation is decided by signal state, not the error's shape.** The SDK
  client sets `maxRetries: 1` and a 150s per-call timeout; the route combines
  `req.signal` with `AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS)` (default 240s)
  and hands **both** to `aiErrorResponse`, which maps `client.aborted` → **499**
  and `timeout.aborted` → **504**. Matching on the error does not work: the SDK
  throws `APIUserAbortError` / `APIConnectionTimeoutError`, both inheriting
  `name` `"Error"` with no `status`, so a `name === 'AbortError'` test never
  fired and every cancellation was logged as a 500. `AbortSignal.timeout()`
  reports `"TimeoutError"` besides. Signal state is also provider-agnostic.
  The 504 path is tested against a slow stub — 499 is not observable, since the
  client that aborts cannot read the response.
- **`provider-anthropic.js`'s own `classifyAbort()` matches
  `constructor.name`, never `instanceof` — and it lives in the provider now,
  not in `server.ts`'s fallback.** Neither signal is aborted when the SDK's
  own per-call timeout fires first — which a short `ANTHROPIC_TIMEOUT_MS`, or
  `ANTHROPIC_MAX_RETRIES=0` removing the retries that would carry the call
  past the route budget, makes routine — so this is a live path, not a safety
  net: `classifyAbort()` throws `ProviderTimeoutError`, caught by
  `aiErrorResponse`'s `ProviderTimeoutError` branch (**504**), mirroring
  `provider-gemini.js`'s own `classifyAbort()` (see the next bullet). This
  used to be a `constructor.name` fallback arm inside `server.ts` itself, and
  was dead there for two reasons: the SDK's `APIUserAbortError`/
  `APIConnectionTimeoutError` both inherit `name` `"Error"` with no `status`
  (the same issue the bullet above describes), **and** `@anthropic-ai/sdk`
  ships separate `require`/`import` builds — `server.ts` imported it while
  `build_scripts/ai/provider-anthropic.js` requires it, so an `instanceof`
  check there compared the thrown error against a different copy of the same
  class and was permanently false. Measured at the time: an SDK timeout
  returned **500**, not the 499 the code read as. Moving the match into
  `provider-anthropic.js` — the same module that requires the SDK — closes
  the dual-package hazard outright rather than working around it with
  `constructor.name`, and means `server.ts` needs no SDK import and no
  SDK-specific knowledge at all: its own fallback is now a provider-agnostic
  DOMException `error.name` check (`"AbortError"`/`"TimeoutError"`) for
  whatever a provider's own `classifyAbort()` doesn't recognize and rethrows
  untouched.
- **Gemini's timeout has to be normalized at the provider, because its SDK
  makes it unrecognizable at the route.** `@google/genai` implements
  `httpOptions.timeout` as a bare `abortController.abort()` — no reason — which
  rejects with a `DOMException` whose `name` is `"AbortError"`: byte-identical
  to a reviewer pressing Cancel, and so answered **499 "Generation was
  cancelled."** for a request nobody cancelled. `constructor.name` cannot help
  here the way it does for Anthropic; it is `"DOMException"`. The caller's
  signal is the only thing that still distinguishes the two, and it is in scope
  only inside the provider, so `classifyAbort()` in `provider-gemini.js` raises
  a `ProviderTimeoutError` when the SDK aborted and the caller's signal did
  **not** — and rethrows untouched when it did, so a genuine cancel still
  reaches the signal branches. `ProviderTimeoutError` lives in `errors.js` for
  the reason `RefusalError` does: it belongs to no provider, and normalizing it
  keeps `aiErrorResponse` one `instanceof` instead of a per-provider branch.
- **Numeric env tunables are range-checked, not merely parsed.**
  `numberFromEnv` (`build_scripts/ai/env.js`) rejects NaN, Infinity, negatives,
  fractions, and anything outside `[min, max]` (default max
  `Number.MAX_SAFE_INTEGER`), warning and falling back rather than throwing.
  `Number.isFinite` is not sufficient: `AI_REQUEST_TIMEOUT_MS=1e20` is finite
  and `AbortSignal.timeout()` rejects it, and that call sits outside the
  generate route's `try` — so the value becomes an unmapped 500 on every
  generation, the very failure the helper exists to prevent. Both timeouts also
  cap at one hour and `ANTHROPIC_MAX_RETRIES` at 10.
- **The retry carries the rejected draft, not just the failures.** Each API
  call is stateless, so "fix these and change nothing else" is only followable
  if the draft travels with the instruction. Usage is summed across attempts
  for the same reason: reporting only the last call understates exactly the
  requests that cost the most.
- **The draft is checked under two different sentinel keys.** `data-checks.js`
  uses one `pages` object both for what to walk and for which targets resolve,
  so filing the draft under `__generated__` made that string a resolvable
  target. Running each check under `__generated__` and `__generated_probe__`
  and unioning the broken targets closes that with no duplicated traversal.
- **Validation is the feature.** `build_scripts/ai/validate-output.js` runs a
  generated page through `build_scripts/schema.js`,
  the `data-checks.js` invariants, and `js/plain-language.js`'s mandates — then
  names the failures back to the model for exactly one retry. Results always
  return 200 with issues attached, since a draft failing one rule still helps a
  reviewer who can see which rule.
- **The system prompt must stay byte-stable.** It inlines the vendored
  `docs/source/sfgov-style/` corpus behind a `cache_control` breakpoint;
  caching is a prefix match, so anything variable in it kills the cache.
- **Never writes anything** — no filesystem, no review state, no `pages/*.js`.
  Standards manual §1.11 forbids automated approval and SF.gov's AI guidelines
  require disclosing generative-AI use, so every successful `generate` result
  carries a `disclosure` string — scoped to that shape only (`capabilities`
  advertises `disclosureRequired: true`, `models` returns bare ids, errors
  carry none). Both browser export paths carry it: Download and Copy emit the
  same `buildPageModuleSource()` output. So the field's presence is not a test
  for whether a payload holds generated content.
- **Tests**: `tests/ai-assist-server.test.js` (spawns `server.ts` against a stub
  Anthropic endpoint — no API key, CI never makes a paid call) and
  `tests/ai-assist-schema.test.js` (guards the structured-output schema against
  drifting from the Zod page schema).

  **One test in that file carries a bounded retry and a 20s budget, and both are
  load-bearing** (fixed on `main` in #106). The Content-Length pre-check answers
  413 with `Connection: close` while the client's declared body is still
  unsent — correct, since the socket genuinely cannot be reused — but Bun's
  `fetch` returns that socket to its keep-alive pool anyway, and the next
  same-origin request that draws it **stalls rather than erroring**. That is why
  a catch matching only `ECONNRESET` never fired: there is no error to catch, so
  the request never settled, the test burned its whole default 5s budget, and
  bun tore down the spawned server — cascading `ConnectionRefused` into the other
  21 tests in the file. One root cause, 21 collateral failures, and the whole
  thing read as a dead server for four consecutive red runs on `main`.

  It was never a dead server. Measured against the same wedged process: a raw
  socket gets `HTTP/1.1 413` with `Connection: close` and the server serves the
  next connection normally, and a request to the `localhost` spelling (a
  different pool key, same server) answers 200 immediately. So the fix belongs on
  the client side of the test — `AbortSignal.timeout()` bounds the poisoned
  attempt, the catch matches a hang as well as a reset, and the test's own budget
  has to exceed that timeout or it dies mid-retry and still looks like a server
  failure. Do not restore the default 5s budget, and do not narrow the catch back
  to `ECONNRESET`.
