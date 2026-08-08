// Gemini provider for the AI assist feature.
//
// A sibling of provider-anthropic.js, exporting the same surface so
// providers.js can hold both behind one registry: `name`, `label`,
// `isConfigured()`, `getModel()`, `listModelIds()`, `normalizeUsage()`, and
// `generateObject({system, userPrompt, jsonSchema, signal})`.
//
// Deliberately non-streaming, for the same reason the Claude provider is: one
// page object is far smaller than the output cap, so streaming would buy
// nothing but a server-sent-events plumbing problem on both sides.
//
// API-key auth against the Gemini Developer API only. `@google/genai` also
// speaks to Vertex AI, but that means service-account credentials, a project
// id, and a region — a different credential story than the single
// GEMINI_API_KEY the rest of this feature's env handling assumes.
const { GoogleGenAI } = require('@google/genai')
const { numberFromEnv } = require('./env')
const { RefusalError, ProviderTimeoutError } = require('./errors')

/** Registry key and the label the browser's provider picker shows. */
const NAME = 'gemini'
const LABEL = 'Gemini'

/**
 * Default model id.
 *
 * A deliberately conservative GA id rather than the newest preview. Gemini's
 * lineup moves faster than this repo does, and a preview id that ages out
 * becomes a 404 on every generation. `GEMINI_MODEL` overrides it, and
 * `GET /api/ai/models` lists what the configured key can actually see — check
 * there before assuming this constant is still the best choice.
 */
const DEFAULT_MODEL = 'gemini-2.5-pro'
const MAX_OUTPUT_TOKENS = 16000

/**
 * Total upstream attempts per call, INCLUDING the first — not the number of
 * retries after it. That off-by-one is the whole reason this is spelled out
 * rather than left at the SDK default.
 *
 * `@google/genai` defaults to 5 attempts, which composes badly here in exactly
 * the way `ANTHROPIC_MAX_RETRIES` was tuned to avoid: two validation attempts,
 * each retried up to five times on a 429 or 5xx, is up to ten upstream calls
 * for one click on a provider that is already failing. Two attempts (one retry)
 * still absorbs a single transient blip while keeping the worst case at four,
 * matching the Claude path.
 */
// min: 1 — "no retries at all" is spelled 1 here, not 0, since the original
// request is counted. max: 10, matching ANTHROPIC_MAX_RETRIES: each attempt is
// a full upstream call, this multiplies with the validation retry above it, and
// a mistyped count in the thousands is not a slow request but one that never
// returns.
const MAX_ATTEMPTS = numberFromEnv('GEMINI_MAX_ATTEMPTS', 2, { min: 1, max: 10 })

/**
 * Per-call ceiling, mirroring ANTHROPIC_TIMEOUT_MS. Without it a wedged
 * upstream holds a server request open long after the only person who wanted
 * the answer has gone.
 */
// max: one hour. Nothing about this feature is a background job — a reviewer is
// watching a spinner — so anything larger is a typo rather than an intent.
const REQUEST_TIMEOUT_MS = numberFromEnv('GEMINI_TIMEOUT_MS', 150_000, { max: 3_600_000 })

/**
 * Finish reasons that mean the model declined, as opposed to finished or ran
 * out of room. Kept as a Set so the check reads as one membership test rather
 * than a chain of comparisons nobody updates together.
 *
 * RECITATION is deliberately NOT here: it means the output was suppressed for
 * reproducing training data, which is a generation failure worth surfacing as
 * an error, not a policy refusal a reviewer should be told the model "declined".
 */
const REFUSAL_FINISH_REASONS = new Set(['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII'])

/**
 * Explain a candidate-level refusal in terms a reviewer can act on.
 *
 * `finishMessage` looks like the field for this and is empty on every request
 * this tool makes: it is a Vertex-only field, and the SDK's response converter
 * drops it on the Gemini Developer API path — verified against a stub, not
 * assumed. Leaving the explanation null there would mean the most common
 * refusal shape arrives with a category and nothing else.
 *
 * `safetyRatings` DOES survive, and its blocked entries name the categories
 * that actually stopped the generation. For HHVC copy that is genuinely useful:
 * pest control and disease-vector wording trips DANGEROUS_CONTENT often enough
 * that "which one" is the difference between rewording a sentence and giving up.
 * @param {object} [candidate]
 * @returns {string|null}
 */
function explainRefusal(candidate) {
  if (candidate?.finishMessage) return candidate.finishMessage
  const blocked = (candidate?.safetyRatings || [])
    .filter((rating) => rating?.blocked)
    .map((rating) => rating.category)
    .filter(Boolean)
  if (!blocked.length) return null
  return `Blocked on ${blocked.join(', ')}.`
}

/** @returns {boolean} whether a Gemini API key is configured. */
function isConfigured() {
  return Boolean(process.env.GEMINI_API_KEY)
}

/** @returns {string} the configured model id. */
function getModel() {
  return process.env.GEMINI_MODEL || DEFAULT_MODEL
}

function createClient() {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      timeout: REQUEST_TIMEOUT_MS,
      retryOptions: { attempts: MAX_ATTEMPTS },
      // Explicit rather than relying on an env fallback, so the stub server in
      // tests/ai-assist-server.test.js can be pointed at without depending on
      // undocumented resolution order. Same reasoning as ANTHROPIC_BASE_URL.
      ...(process.env.GEMINI_BASE_URL ? { baseUrl: process.env.GEMINI_BASE_URL } : {}),
    },
  })
}

/**
 * List the model ids this key can see.
 *
 * Queried live rather than hardcoded, for the reason DEFAULT_MODEL spells out.
 * The API returns resource names (`models/gemini-2.5-pro`); the prefix is
 * stripped so the ids listed here are the ids GEMINI_MODEL accepts — returning
 * a name the config would reject makes this endpoint actively misleading.
 * @returns {Promise<string[]>}
 */
async function listModelIds() {
  const client = createClient()
  const ids = []
  for await (const model of await client.models.list()) {
    const name = model.name || ''
    if (name) ids.push(name.startsWith('models/') ? name.slice('models/'.length) : name)
  }
  return ids
}

/**
 * Map Gemini's token counters onto the shape every provider reports.
 *
 * See normalizeUsage in provider-anthropic.js for why this normalization exists
 * at the provider boundary rather than in the caller.
 *
 * `totalTokenCount` is taken as authoritative when present rather than
 * recomputed: Gemini bills thinking tokens (`thoughtsTokenCount`) and tool-use
 * prompt tokens on top of prompt+candidates, so `input + output` understates
 * the real total on exactly the thinking-heavy requests this feature makes.
 * @param {object} [usage] Gemini's `response.usageMetadata`.
 * @returns {{inputTokens: number, outputTokens: number, totalTokens: number}}
 */
function normalizeUsage(usage) {
  const input = Number(usage?.promptTokenCount) || 0
  const output = Number(usage?.candidatesTokenCount) || 0
  const total = Number(usage?.totalTokenCount) || input + output
  return { inputTokens: input, outputTokens: output, totalTokens: total }
}

/**
 * Run one generateContent call, turning the SDK's own timeout into a typed
 * error the route can tell apart from a cancellation.
 *
 * `@google/genai` implements `httpOptions.timeout` as a bare
 * `abortController.abort()` (dist/index.cjs, the `setTimeout(() =>
 * abortController.abort(), httpOptions.timeout)` line). `abort()` with no
 * reason rejects with a DOMException whose `name` is **"AbortError"** — the
 * exact shape a reviewer pressing Cancel produces. `aiErrorResponse` matches
 * that name and answers 499 "Generation was cancelled.", so before this a
 * Gemini request that ran out of time told the reviewer they had cancelled it.
 *
 * The caller's signal is what disambiguates, and it is only in scope here: if
 * `signal` is aborted, the abort really was the client (or the route deadline)
 * and the error is passed through untouched so the existing 499/504 signal
 * branches still own it. If it is NOT aborted, the only thing that could have
 * aborted the fetch is the SDK's own deadline.
 *
 * Note the deliberate asymmetry with the Anthropic path, which needs no
 * equivalent: its SDK throws a distinctly-named `APIConnectionTimeoutError`,
 * so `constructor.name` already separates the two cases there.
 *
 * Split out as a pure function rather than inlined in the catch below so it can
 * be tested without standing up an SDK client or waiting out a real timeout —
 * the whole behaviour is a decision about two inputs.
 *
 * @param {unknown} error The error the SDK threw.
 * @param {AbortSignal} [signal] The caller's signal, if any.
 * @throws {ProviderTimeoutError} when the SDK's own deadline aborted the call.
 * @throws {unknown} the original error in every other case.
 * @returns {never}
 */
function classifyAbort(error, signal) {
  const isAbort = error?.name === 'AbortError'
  if (isAbort && !signal?.aborted) throw new ProviderTimeoutError(NAME)
  throw error
}

/**
 * @param {object} client A GoogleGenAI instance.
 * @param {object} request The generateContent request.
 * @param {AbortSignal} [signal] The caller's signal, if any.
 * @returns {Promise<object>} the SDK response.
 */
async function generateWithNormalizedTimeout(client, request, signal) {
  try {
    return await client.models.generateContent(request)
  } catch (error) {
    classifyAbort(error, signal)
  }
}

/**
 * Ask Gemini for a JSON object matching `jsonSchema`.
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

  const response = await generateWithNormalizedTimeout(
    client,
    {
      model: getModel(),
      contents: userPrompt,
      config: {
        systemInstruction: system,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        // `responseJsonSchema`, NOT `responseSchema`. The latter takes a narrow
        // OpenAPI 3.0 subset; this one takes real JSON Schema, which is what lets
        // PAGE_OUTPUT_SCHEMA be shared byte-for-byte with the Claude path rather
        // than forked into a second copy that tests/ai-assist-schema.test.js
        // would then have to guard twice. Every keyword the schema uses (type,
        // properties, items, enum, required, description, additionalProperties)
        // is supported.
        responseMimeType: 'application/json',
        responseJsonSchema: jsonSchema,
        // No thinkingConfig: the model's own default is used. AI_EFFORT maps to
        // Anthropic's output_config.effort, and Gemini's thinking budget is not
        // the same dial — translating one into the other would be a guess
        // presented as a setting.
        //
        // No explicit cache breakpoint either. Gemini caches implicitly on a
        // prefix match, so the byte-stability prompts.js already guarantees is
        // what makes caching work here; there is simply nothing to mark.
        ...(signal ? { abortSignal: signal } : {}),
      },
    },
    signal
  )

  // Check why generation stopped BEFORE touching the content, exactly as the
  // Claude path checks stop_reason first. On a block the candidate carries no
  // parts, so reaching for the text throws a confusing TypeError instead of
  // reporting what actually happened.
  //
  // Two places have to be consulted, not one. `promptFeedback.blockReason` is
  // set when the INPUT was blocked and no candidate exists at all;
  // `candidates[0].finishReason` is set when generation started and was then
  // stopped. Checking only the second misses every prompt-level block, which
  // then surfaces as the generic "returned no text" error below and reads to a
  // reviewer as an outage rather than a refusal.
  const blockReason = response.promptFeedback?.blockReason
  if (blockReason) {
    throw new RefusalError({
      category: blockReason,
      explanation: response.promptFeedback?.blockReasonMessage || null,
    })
  }

  const candidate = (response.candidates || [])[0]
  const finishReason = candidate?.finishReason
  if (REFUSAL_FINISH_REASONS.has(finishReason)) {
    throw new RefusalError({ category: finishReason, explanation: explainRefusal(candidate) })
  }
  if (finishReason === 'MAX_TOKENS') {
    throw new Error('The model hit the output limit before finishing. Try a narrower request.')
  }

  // `response.text` concatenates the text parts of the first candidate and
  // excludes thought parts, which is exactly what is wanted: the thinking
  // output is not part of the JSON document and would break the parse.
  const text = response.text
  if (!text) {
    throw new Error('The model returned no text content.')
  }

  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    // responseJsonSchema is supposed to guarantee parseable JSON, so this means
    // the schema was rejected or the format was dropped. Say so rather than
    // surfacing a bare SyntaxError.
    throw new Error('The model returned text that was not valid JSON.')
  }

  return {
    object: parsed,
    model: response.modelVersion || getModel(),
    usage: normalizeUsage(response.usageMetadata),
    rawUsage: response.usageMetadata || {},
    stopReason: finishReason || 'STOP',
  }
}

/**
 * Task types the Gemini embeddings API accepts, confirmed against
 * https://googleapis.github.io/js-genai/release_docs/interfaces/types.EmbedContentConfig.html
 * via Context7 (2026-08-07). DOCUMENT is for indexed corpus chunks
 * (ingestion); QUERY is for the text being searched with (retrieval time) —
 * the API's own docs recommend matching task type to role for retrieval
 * quality, so build_scripts/ingest-knowledge.js and
 * build_scripts/ai/compliance-audit.js each pass the one that matches what
 * they are doing.
 */
const EMBEDDING_TASK_TYPES = { DOCUMENT: 'RETRIEVAL_DOCUMENT', QUERY: 'RETRIEVAL_QUERY' }

/**
 * Default embedding model id. `text-embedding-004` per the confirmed
 * @google/genai example (client.models.embedContent({model:
 * 'text-embedding-004', ...})). `GEMINI_EMBEDDING_MODEL` overrides it, for
 * the same reason DEFAULT_MODEL is overridable: Gemini's lineup moves.
 */
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-004'

/** @returns {string} the configured embedding model id. */
function getEmbeddingModel() {
  return process.env.GEMINI_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL
}

/**
 * Embed a batch of texts.
 *
 * Anthropic has no embeddings API, so this is the ONLY source of embeddings
 * in the provider registry. Callers that need one (ingestion, compliance-audit
 * retrieval) call this directly rather than going through resolveProvider(),
 * which resolves a GENERATION provider and may legitimately be Anthropic —
 * embeddings and generation are independent choices for this task.
 *
 * @param {string[]} texts
 * @param {'DOCUMENT'|'QUERY'} taskType
 * @returns {Promise<Float32Array[]>} One embedding per input text, same order.
 * @throws {Error} if the API returns a different number of embeddings than
 *   texts requested — callers zip the result back onto their input array by
 *   index (ingest-knowledge.js onto chunks, compliance-audit.js onto the
 *   page text), and a silent length mismatch would misassign an embedding to
 *   the wrong chunk rather than fail loudly.
 */
async function embedContent(texts, taskType) {
  const client = createClient()
  const response = await client.models.embedContent({
    model: getEmbeddingModel(),
    contents: texts,
    config: { taskType: EMBEDDING_TASK_TYPES[taskType] },
  })
  const embeddings = response.embeddings || []
  if (embeddings.length !== texts.length) {
    throw new Error(
      `Gemini embedContent returned ${embeddings.length} embeddings for ${texts.length} texts.`
    )
  }
  return embeddings.map((embedding) => Float32Array.from(embedding.values || []))
}

module.exports = {
  name: NAME,
  label: LABEL,
  generateObject,
  isConfigured,
  getModel,
  listModelIds,
  normalizeUsage,
  explainRefusal,
  classifyAbort,
  createClient,
  embedContent,
  getEmbeddingModel,
  DEFAULT_MODEL,
  DEFAULT_EMBEDDING_MODEL,
  MAX_OUTPUT_TOKENS,
  MAX_ATTEMPTS,
  REQUEST_TIMEOUT_MS,
  REFUSAL_FINISH_REASONS,
}
