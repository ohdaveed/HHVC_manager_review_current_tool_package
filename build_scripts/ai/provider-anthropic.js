// Claude provider for the AI assist feature.
//
// Deliberately non-streaming. `max_tokens` is 16000, comfortably inside the
// SDK's HTTP timeout budget, and one page object is far smaller than that —
// so streaming would buy nothing but a server-sent-events plumbing problem on
// both sides. Revisit if a future task (a whole sitemap, a long report) starts
// producing output near the cap.
const Anthropic = require('@anthropic-ai/sdk')
const { numberFromEnv } = require('./env')
const { RefusalError } = require('./errors')

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

/** @returns {boolean} whether a Claude API key is configured. */
function isConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY)
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
    apiKey: process.env.ANTHROPIC_API_KEY,
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
 * Ask Claude for a JSON object matching `jsonSchema`.
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

  const response = await client.beta.messages.create(
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
        format: { type: 'json_schema', schema: jsonSchema },
      },
      system: [
        {
          type: 'text',
          text: system,
          // The system prompt inlines the whole vendored style corpus and does
          // not vary between requests, so it is worth caching. Placed on the
          // last system block, which caches everything before it too.
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userPrompt }],
    },
    signal ? { signal } : undefined
  )

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
    parsed = JSON.parse(textBlock.text)
  } catch {
    // output_config.format is supposed to guarantee parseable JSON, so this
    // means the schema was rejected or the format was dropped. Say so rather
    // than surfacing a bare SyntaxError.
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
  isConfigured,
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
