// Claude provider for the AI assist feature.
//
// Deliberately non-streaming. `max_tokens` is 16000, comfortably inside the
// SDK's HTTP timeout budget, and one page object is far smaller than that —
// so streaming would buy nothing but a server-sent-events plumbing problem on
// both sides. Revisit if a future task (a whole sitemap, a long report) starts
// producing output near the cap.
const { existsSync, readdirSync } = require('node:fs')
const { homedir } = require('node:os')
const { join } = require('node:path')
const Anthropic = require('@anthropic-ai/sdk')
const { numberFromEnv } = require('./env')
const { RefusalError, ProviderTimeoutError } = require('./errors')
const { supportsAnthropicStructuredOutput } = require('./schema-flags')

/** Registry key and the label the browser's provider picker shows. */
const NAME = 'claude'
const LABEL = 'Claude'

const DEFAULT_MODEL = 'claude-opus-5'
const DEFAULT_EFFORT = 'high'
const MAX_TOKENS = 16000

// The scalar "default" form of server-side fallbacks: on a policy refusal the
// API retries the same request on a model Anthropic picks by refusal category,
// instead of handing us a refusal to deal with. Benign security and
// life-sciences wording occasionally trips the classifiers, and HHVC copy
// covers pest control, disease vectors, and enforcement — squarely in that
// blast radius. The header and the parameter shape are a matched pair: the
// scalar "default" requires -2026-07-01, the array form requires -2026-06-01,
// and pairing either with the other returns a 400.
const FALLBACK_BETA = 'server-side-fallback-2026-07-01'

/**
 * Where `ant auth login` stores its credentials.
 *
 * `ANTHROPIC_CONFIG_DIR` is honoured because the SDK honours it — and because
 * it is the only way a test can pin this to a directory it controls. Without
 * that, the profile check below would report whatever the machine running the
 * suite happens to have logged in, and `tests/ai-assist-providers.test.js`
 * (which varies provider keys directly) would pass or fail by accident.
 *
 * Windows' `%APPDATA%\Anthropic` is deliberately not handled: `server.ts` runs
 * under Bun on Linux locally, in CI, and on Railway, so a second path would be
 * an untested branch. A Windows deployment sets `ANTHROPIC_CONFIG_DIR`.
 * @returns {string}
 */
function credentialsDir() {
  const base = process.env.ANTHROPIC_CONFIG_DIR || join(homedir(), '.config', 'anthropic')
  return join(base, 'credentials')
}

/**
 * Whether an `ant auth login` OAuth profile exists on disk.
 *
 * Checked because the SDK resolves credentials in the order
 * `ANTHROPIC_API_KEY` → `ANTHROPIC_AUTH_TOKEN` → the active profile, so a
 * deployment can hold a perfectly good credential with no environment variable
 * set at all. Reading the disk rather than an env var is what that costs: the
 * profile `ant auth login` writes is the *default* one, and it sets neither
 * `ANTHROPIC_PROFILE` nor `ANTHROPIC_CONFIG_DIR`, so an env-only check would
 * report "not configured" for the single most common way to be configured.
 *
 * `ANTHROPIC_PROFILE` narrows the check to that one file when it is set, since
 * that is the profile the SDK will actually load — any other profile in the
 * directory is irrelevant to whether THIS request can authenticate.
 * @returns {boolean}
 */
function hasOAuthProfile() {
  const dir = credentialsDir()
  const profile = process.env.ANTHROPIC_PROFILE
  try {
    if (profile) return existsSync(join(dir, `${profile}.json`))
    return readdirSync(dir).some((entry) => entry.endsWith('.json'))
  } catch {
    // No config directory, or no permission to read it. Either way there is no
    // profile this process can use.
    return false
  }
}

/**
 * Whether a Claude credential of any kind is available.
 *
 * **This is a weaker claim than it used to make.** It once meant "an API key
 * string is present", which was very nearly "a usable credential". A profile
 * can be present and *expired* — refresh tokens hard-expire rather than
 * sliding — so this can now report configured and then fail at request time.
 * That surfaces as a 502 with the upstream message logged (see server.ts's
 * upstream-error branch) rather than the clean 501 a missing key gives. The
 * alternative was a network call inside a synchronous gate that runs on every
 * `/api/ai/capabilities` request, which is worse.
 *
 * Re-read on every call, never cached: the registry is a module singleton
 * required once at server start, and `tests/ai-assist-providers.test.js` pins
 * that behaviour.
 * @returns {boolean}
 */
function isConfigured() {
  return (
    Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) || hasOAuthProfile()
  )
}

/** @returns {string} the configured model id. */
function getModel() {
  return process.env.ANTHROPIC_MODEL || DEFAULT_MODEL
}

/**
 * Retries inside the SDK, on top of our own validation retry.
 *
 * The SDK defaults to 2, which composes badly here: two validation attempts,
 * each retried twice on a 429 or 5xx, is up to six upstream calls for one
 * click. One SDK retry still absorbs a single transient blip while keeping the
 * worst case bounded at four.
 */
// min: 0 — "no SDK retries at all" is a legitimate choice here, unlike a
// timeout, where zero would mean every call fails instantly. max: 10 because
// each retry is a full upstream call against a provider that is already
// failing, and this multiplies with the validation retry above it; a mistyped
// count in the thousands would not be a slow request, it would be a request
// that never returns.
const MAX_RETRIES = numberFromEnv('ANTHROPIC_MAX_RETRIES', 1, { min: 0, max: 10 })

/**
 * Per-call ceiling. The SDK's default is about 10 minutes, which is longer
 * than any reviewer waits and longer than the browser's own timeout, so a
 * wedged upstream would hold a server request open long after the only person
 * who wanted the answer had gone.
 */
// max: one hour. Nothing about this feature is a background job — a reviewer is
// watching a spinner — so an hour is already far past useful and any larger
// value is a typo rather than an intent. Capping it keeps the "wedged upstream
// holds the request open" failure this constant exists to prevent from being
// reintroduced by the environment variable that configures it.
const REQUEST_TIMEOUT_MS = numberFromEnv('ANTHROPIC_TIMEOUT_MS', 150_000, { max: 3_600_000 })

function createClient() {
  return new Anthropic({
    // Spread rather than passed unconditionally. An explicitly-passed `apiKey`
    // takes precedence over every other credential source, so passing the env
    // var when it is unset would hand the SDK an explicit empty credential on
    // exactly the deployments that authenticate by profile instead. Omitting
    // the key entirely is what lets the SDK's own resolution run.
    ...(process.env.ANTHROPIC_API_KEY ? { apiKey: process.env.ANTHROPIC_API_KEY } : {}),
    maxRetries: MAX_RETRIES,
    timeout: REQUEST_TIMEOUT_MS,
    // Explicit rather than relying on the SDK's env fallback, so the stub
    // server in tests/ai-assist-server.test.js can be pointed at without
    // depending on undocumented resolution order.
    ...(process.env.ANTHROPIC_BASE_URL ? { baseURL: process.env.ANTHROPIC_BASE_URL } : {}),
  })
}

/**
 * List the model ids this key can see.
 *
 * Queried live rather than hardcoded: model lineups move, and a stale constant
 * in committed code turns into a 404 nobody notices until a reviewer hits it.
 * @returns {Promise<string[]>}
 */
async function listModelIds() {
  const client = createClient()
  const ids = []
  for await (const model of client.models.list()) ids.push(model.id)
  return ids
}

/**
 * Map Anthropic's token counters onto the shape every provider reports.
 *
 * The counters themselves are provider-native (`input_tokens` here,
 * `promptTokenCount` on Gemini), and `addUsage()` in index.js sums usage across
 * the validation retry field by field. Summing two providers' differently-named
 * fields into one object would produce a total that is not wrong so much as
 * meaningless, and would force every consumer to know which provider produced
 * it. Normalizing at the provider boundary keeps the response shape stable no
 * matter who answered.
 *
 * The raw object is NOT folded in here — it travels separately as `rawUsage`,
 * because `addUsage` keeps the first attempt's value for non-numeric fields and
 * would therefore report attempt one's raw counters as if they covered both.
 * @param {object} [usage] Anthropic's `response.usage`.
 * @returns {{inputTokens: number, outputTokens: number, totalTokens: number}}
 */
function normalizeUsage(usage) {
  // All THREE input counters, per the API's own definition: "Total input tokens
  // in a request is the summation of input_tokens, cache_creation_input_tokens,
  // and cache_read_input_tokens." They are reported separately, not folded into
  // input_tokens.
  //
  // This is not a rounding detail for this feature specifically. prompts.js
  // inlines the entire vendored sfgov-style corpus into the system prompt and
  // marks it with cache_control precisely so it is cached — so on every warm
  // request virtually the whole prompt is billed through
  // cache_read_input_tokens and `input_tokens` alone is a small remainder.
  // Reading only that counter made the provider-neutral total understate real
  // usage by most of the prompt, on exactly the requests the caching was added
  // to make cheap. The per-attempt raw counters still travel separately as
  // `rawUsage`/`usageByAttempt[]`, so the creation-vs-read split is not lost.
  const input = Number(usage?.input_tokens) || 0
  const cacheCreation = Number(usage?.cache_creation_input_tokens) || 0
  const cacheRead = Number(usage?.cache_read_input_tokens) || 0
  const output = Number(usage?.output_tokens) || 0
  const totalInput = input + cacheCreation + cacheRead
  return { inputTokens: totalInput, outputTokens: output, totalTokens: totalInput + output }
}

/**
 * Normalize the SDK's own per-call deadline into ProviderTimeoutError — the
 * error-classification half of the provider contract provider-gemini.js's
 * classifyAbort also implements, so server.ts needs to know neither SDK's
 * class names to answer 504 rather than a generic 500.
 *
 * Unlike Gemini's SDK, Anthropic's throws a distinctly-named
 * `APIConnectionTimeoutError` for its own deadline (and a separate
 * `APIUserAbortError` when the CALLER's signal aborted it) — so the class
 * name itself already carries the distinction Gemini's classifyAbort has to
 * infer from `signal` alone. `signal` is still consulted here as the same
 * defense-in-depth check, consistent with the SDK's own classification
 * rather than the sole source of truth.
 * @param {unknown} error The error the SDK threw.
 * @param {AbortSignal} [signal] The caller's signal, if any.
 * @throws {ProviderTimeoutError} when the SDK's own deadline aborted the call.
 * @throws {unknown} the original error in every other case.
 * @returns {never}
 */
function classifyAbort(error, signal) {
  const isOwnTimeout = error?.constructor?.name === 'APIConnectionTimeoutError'
  if (isOwnTimeout && !signal?.aborted) throw new ProviderTimeoutError(NAME)
  throw error
}

/**
 * State the schema as an instruction, for schemas the grammar compiler rejects.
 *
 * The schema itself is sent verbatim rather than paraphrased: it is the same
 * object the validator enforces, so a prose restatement would be a second
 * description free to drift from the one that actually holds.
 * @param {object} jsonSchema
 * @returns {string}
 */
function schemaInstruction(jsonSchema) {
  return [
    'Reply with a single JSON object and nothing else. No prose before or after,',
    'and no markdown code fence. It must validate against this JSON Schema exactly,',
    'honouring "required" and "additionalProperties": false at every level:',
    JSON.stringify(jsonSchema, null, 2),
  ].join('\n')
}

/**
 * Strip a markdown fence the model was asked not to add.
 *
 * Belt and braces for the prompt-instructed path only: with no grammar holding
 * the output shape, a stray ```json wrapper is the one deviation likely enough
 * to be worth absorbing rather than spending a whole retry on. Anything else
 * malformed still falls through to the validator and its retry.
 * @param {string} text
 * @returns {string}
 */
function stripCodeFence(text) {
  const fenced = text.trim().match(/^```(?:json)?\s*\n([\s\S]*?)\n?```$/)
  return fenced ? fenced[1] : text
}

/**
 * Ask Claude for a JSON object matching `jsonSchema`.
 *
 * Two request shapes, chosen by whether Anthropic can compile the schema into a
 * grammar (see `schema-flags.js`). When it can, `output_config.format`
 * guarantees the shape. When it cannot — `PAGE_OUTPUT_SCHEMA` is measurably one
 * such — the schema is stated in the system prompt instead and the shape rests
 * on the caller's validate-and-retry loop, which runs either way.
 *
 * @param {object} options
 * @param {string} options.system Byte-stable system prompt (see prompts.js).
 * @param {string} options.userPrompt The request turn.
 * @param {object} options.jsonSchema Structured-output schema.
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{object: object, model: string, usage: object, rawUsage: object,
 *   stopReason: string}>}
 */
async function generateObject({ system, userPrompt, jsonSchema, signal }) {
  const client = createClient()
  const structured = supportsAnthropicStructuredOutput(jsonSchema)

  // Two system blocks when the schema cannot be a grammar, one when it can.
  // Both are byte-stable across requests, so the cache breakpoint still covers
  // everything — it moves to the LAST block, which caches every block before
  // it. Putting the schema in its own block rather than concatenating keeps the
  // style corpus's bytes unchanged either way.
  const systemBlocks = [{ type: 'text', text: system }]
  if (!structured) systemBlocks.push({ type: 'text', text: schemaInstruction(jsonSchema) })
  systemBlocks[systemBlocks.length - 1].cache_control = { type: 'ephemeral' }

  let response
  try {
    response = await client.beta.messages.create(
      {
        model: getModel(),
        max_tokens: MAX_TOKENS,
        betas: [FALLBACK_BETA],
        fallbacks: 'default',
        // Adaptive thinking is the only on-mode on current models; `budget_tokens`
        // is removed and returns a 400. Effort is the depth control.
        thinking: { type: 'adaptive' },
        output_config: {
          effort: process.env.AI_EFFORT || DEFAULT_EFFORT,
          ...(structured ? { format: { type: 'json_schema', schema: jsonSchema } } : {}),
        },
        system: systemBlocks,
        messages: [{ role: 'user', content: userPrompt }],
      },
      signal ? { signal } : undefined
    )
  } catch (error) {
    classifyAbort(error, signal)
  }

  // Check stop_reason BEFORE touching content. On a refusal `content` is empty
  // or partial, so indexing into it throws a confusing TypeError instead of
  // reporting what actually happened.
  if (response.stop_reason === 'refusal') {
    throw new RefusalError(response.stop_details)
  }
  if (response.stop_reason === 'max_tokens') {
    throw new Error('The model hit the output limit before finishing. Try a narrower request.')
  }

  const textBlock = (response.content || []).find((block) => block.type === 'text')
  if (!textBlock || !textBlock.text) {
    throw new Error('The model returned no text content.')
  }

  let parsed
  try {
    parsed = JSON.parse(structured ? textBlock.text : stripCodeFence(textBlock.text))
  } catch {
    // On the structured path `output_config.format` is supposed to guarantee
    // parseable JSON, so this means the schema was rejected or the format was
    // dropped. On the prompt-instructed path it means the model ignored the
    // instruction. Either way, say so rather than surfacing a bare SyntaxError.
    throw new Error('The model returned text that was not valid JSON.')
  }

  return {
    object: parsed,
    model: response.model || getModel(),
    usage: normalizeUsage(response.usage),
    rawUsage: response.usage || {},
    stopReason: response.stop_reason || 'end_turn',
  }
}

module.exports = {
  name: NAME,
  label: LABEL,
  generateObject,
  classifyAbort,
  isConfigured,
  hasOAuthProfile,
  credentialsDir,
  getModel,
  listModelIds,
  normalizeUsage,
  createClient,
  // Re-exported rather than defined here. It moved to ./errors.js when Gemini
  // landed (a refusal is not an Anthropic concept), but this module was the
  // documented import site, so the old spelling keeps working.
  RefusalError,
  DEFAULT_MODEL,
  MAX_TOKENS,
  MAX_RETRIES,
  REQUEST_TIMEOUT_MS,
}
