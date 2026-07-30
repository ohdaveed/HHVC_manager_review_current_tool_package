// Claude provider for the AI assist feature.
//
// Deliberately non-streaming. `max_tokens` is 16000, comfortably inside the
// SDK's HTTP timeout budget, and one page object is far smaller than that —
// so streaming would buy nothing but a server-sent-events plumbing problem on
// both sides. Revisit if a future task (a whole sitemap, a long report) starts
// producing output near the cap.
const Anthropic = require('@anthropic-ai/sdk')

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

function createClient() {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    // Explicit rather than relying on the SDK's env fallback, so the stub
    // server in tests/ai-assist-server.test.js can be pointed at without
    // depending on undocumented resolution order.
    ...(process.env.ANTHROPIC_BASE_URL ? { baseURL: process.env.ANTHROPIC_BASE_URL } : {}),
  })
}

/**
 * Raised when the model declines the request. Carried as its own class so the
 * route can answer 422 rather than a generic 500 — a refusal is a content
 * outcome, not a server fault.
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
 * Ask Claude for a JSON object matching `jsonSchema`.
 *
 * @param {object} options
 * @param {string} options.system Byte-stable system prompt (see prompts.js).
 * @param {string} options.userPrompt The request turn.
 * @param {object} options.jsonSchema Structured-output schema.
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{object: object, model: string, usage: object, stopReason: string}>}
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
    usage: response.usage || {},
    stopReason: response.stop_reason || 'end_turn',
  }
}

module.exports = {
  generateObject,
  isConfigured,
  getModel,
  createClient,
  RefusalError,
  DEFAULT_MODEL,
  MAX_TOKENS,
}
