// Orchestration for the AI assist feature: generate, validate, retry once.
//
// Imported by server.ts's /api/ai/* routes. Provider-agnostic throughout — no
// function here names Claude or Gemini. Everything provider-specific is behind
// the registry in providers.js, so a third provider is a line there and nothing
// in this file.
const { loadPageData } = require('../load-pages')
const {
  buildContentSystemPrompt,
  buildContentUserPrompt,
  buildRewriteSystemPrompt,
  buildRewriteUserPrompt,
  loadStyleCorpus,
} = require('./prompts')
const { PAGE_OUTPUT_SCHEMA, REWRITE_OUTPUT_SCHEMA } = require('./schemas')
const { validateGeneratedPage, validateRewrite } = require('./validate-output')
const { REGISTRY, configuredProviders, resolveProvider } = require('./providers')

// One retry, not a loop. A second attempt with the specific failures named
// fixes most mechanical violations; a third rarely adds anything and doubles
// the worst-case latency and cost of an already slow request.
const MAX_ATTEMPTS = 2

/**
 * SF.gov's AI guidelines require disclosure of generative AI in output, and
 * the HHVC standards manual §1.11 bars an automated agent from setting a page
 * status to "Approved to Move = Yes" (quoted verbatim in
 * docs/source/sfgov-style/writing-and-style.md). This string rides along with
 * every result so the browser cannot render or export a draft without carrying
 * the label. Keep this wording in step with the same rule's restatement in
 * server.ts's AI-routes header — they cited it two different ways once already.
 */
const DISCLOSURE =
  'AI-assisted draft. Not reviewed, not approved, and not publishable as-is. ' +
  'Fact-check every claim against HHVC source documents before use.'

let cachedPages = null

/**
 * Existing page data, for link-target resolution and the prompt's key list.
 *
 * Cached for the process lifetime: loadPageData() evaluates every pages/*.js
 * file in a VM context, which is far too heavy to repeat per request. The
 * trade-off is that editing a page needs a server restart before the AI sees
 * it — acceptable for a dev-time tool, and `bun run dev` restarts on change
 * anyway.
 * @returns {Record<string, object>}
 */
function getPages() {
  if (!cachedPages) cachedPages = loadPageData().pages
  return cachedPages
}

/**
 * What this deployment can actually do. Drives the browser's empty state and
 * its provider picker, so an unconfigured server explains itself instead of
 * failing on first use.
 *
 * `providers` and `models` are keyed maps covering EVERY registered provider,
 * including the unconfigured ones (`false` / `null`). Listing only what is
 * configured would leave the panel unable to say "this server has no Gemini
 * key" as distinct from "Gemini does not exist here", and the two want
 * different copy. `defaultProvider` tells the picker what an unnamed request
 * would run on, so its initial selection matches what the server would do.
 * @returns {object}
 */
async function getCapabilities() {
  const corpus = loadStyleCorpus()
  const providers = {}
  const models = {}
  const labels = {}
  for (const provider of REGISTRY) {
    const configured = provider.isConfigured()
    providers[provider.name] = configured
    models[provider.name] = configured ? provider.getModel() : null
    labels[provider.name] = provider.label
  }
  // Read lazily, not at module load: knowledge_chunks can go from empty to
  // populated (a fresh `bun run ingest`) while the server keeps running.
  const { isComplianceAuditAvailable, countKnowledgeChunks } = require('./knowledge-retrieval')
  // Async since the knowledge base moved behind the storage seam: on Postgres
  // these are real queries rather than a synchronous read of a local file.
  const knowledgeBaseReady = await isComplianceAuditAvailable()
  const chunkCount = await countKnowledgeChunks()
  return {
    providers,
    models,
    providerLabels: labels,
    defaultProvider: configuredProviders()[0]?.name || null,
    // Every task this deployment can actually run, composed from BOTH gates.
    // `content`/`rewrite-field` need a configured provider — this used to be
    // asserted in a comment rather than checked, so a deployment with zero
    // configured providers still advertised both, and a click reached the
    // provider gate and got a 501. `compliance-audit` additionally needs an
    // ingested knowledge base. The browser reads this list to decide whether
    // to mount an affordance at all — a deploy with no /api/ai/* runtime (or
    // no provider key) must show no button rather than one that always fails.
    tasks: configuredProviders().length
      ? knowledgeBaseReady
        ? ['content', 'compliance-audit', 'rewrite-field']
        : ['content', 'rewrite-field']
      : [],
    groundedBy: corpus.files,
    pageCount: Object.keys(getPages()).length,
    disclosureRequired: true,
    // So the browser panel can tell "no Gemini key" apart from "key present,
    // nobody has run `bun run ingest` yet" — both are real, distinct empty
    // states a reviewer could hit, and they want different copy.
    knowledgeBase: { ready: knowledgeBaseReady, chunkCount },
  }
}

/**
 * List the models each configured key can actually see.
 *
 * Queried live rather than hardcoded: model lineups move, and a stale constant
 * in committed code turns into a 404 nobody notices until a reviewer hits it.
 *
 * Settled per provider rather than awaited together. One bad key or one
 * provider's outage must not blank the other's list — this endpoint exists to
 * help a reviewer find a working model id, and answering "nothing anywhere"
 * because one of two providers is down is the opposite of useful. A failed
 * lookup reports an empty array, which reads the same as "no models" and is
 * honest about what was learned.
 * @returns {Promise<Record<string, string[]>>}
 */
async function listModels() {
  const settled = await Promise.allSettled(
    REGISTRY.map((provider) => (provider.isConfigured() ? provider.listModelIds() : []))
  )
  const result = {}
  REGISTRY.forEach((provider, index) => {
    const outcome = settled[index]
    result[provider.name] = outcome.status === 'fulfilled' ? outcome.value : []
  })
  return result
}

/**
 * Add one attempt's usage counters into a running total, in place.
 *
 * Only numeric fields are summed. The usage object also carries non-numeric
 * entries (`service_tier`, and nested cache-creation breakdowns), and summing
 * or clobbering those would produce a total that is wrong rather than merely
 * incomplete — so anything that is not a number from every attempt is left at
 * whatever the first attempt reported.
 * @param {Record<string, unknown>} total Mutated.
 * @param {Record<string, unknown>} [next] One attempt's usage.
 * @returns {Record<string, unknown>} `total`, for chaining.
 */
function addUsage(total, next) {
  if (!next || typeof next !== 'object') return total
  for (const [key, value] of Object.entries(next)) {
    if (typeof value === 'number')
      total[key] = (typeof total[key] === 'number' ? total[key] : 0) + value
    else if (!(key in total)) total[key] = value
  }
  return total
}

/**
 * Generate a page draft, validate it, and retry once with the failures named.
 *
 * Always resolves with the draft, valid or not: a page that fails one
 * plain-language rule is still useful to a reviewer who can see which rule and
 * fix it by hand. Hiding it would be worse than showing it with its problems
 * attached.
 * @param {object} options
 * @param {string} options.prompt
 * @param {object} [options.page] The page open in the mockup, as grounding.
 * @param {string} [options.provider] Which provider to run on. Unset takes the
 *   deployment's default; a name that is not configured throws rather than
 *   falling back, so a draft is never attributed to a model that did not write it.
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<object>}
 */
async function generateContent({ prompt, page, provider, signal }) {
  // Resolved before any work is done, so an unknown provider costs nothing.
  const selected = resolveProvider(provider)
  const pages = getPages()
  const { system, groundedBy } = buildContentSystemPrompt(Object.keys(pages))

  let issues = []
  let generated = null
  let attempts = 0
  // Usage is summed, not overwritten. A retried generation really did cost two
  // calls, and reporting only the last one would understate the spend of
  // exactly the requests that cost the most. Summing works across providers
  // only because each one normalizes its counters first — see normalizeUsage.
  const usage = {}
  // The provider-native counters, one entry per attempt. Kept OUT of the summed
  // object on purpose: addUsage keeps the first attempt's value for non-numeric
  // fields, so folding a nested raw object in would report attempt one's
  // numbers as though they covered every attempt.
  const usageByAttempt = []

  while (attempts < MAX_ATTEMPTS) {
    const previousDraft = generated ? generated.object : undefined
    attempts += 1
    const userPrompt = buildContentUserPrompt({
      prompt,
      page,
      issues: attempts > 1 ? issues : undefined,
      previousDraft: attempts > 1 ? previousDraft : undefined,
    })

    generated = await selected.generateObject({
      system,
      userPrompt,
      jsonSchema: PAGE_OUTPUT_SCHEMA,
      signal,
    })
    addUsage(usage, generated.usage)
    usageByAttempt.push(generated.rawUsage || {})

    const validation = validateGeneratedPage(generated.object, pages)
    issues = validation.issues
    if (validation.valid) break
  }

  return {
    task: 'content',
    // The RESOLVED provider, not what the client asked for. An unnamed request
    // still has to report which model actually answered — the panel's meta line
    // and the downloaded module both carry it.
    provider: selected.name,
    model: generated.model,
    attempts,
    valid: issues.length === 0,
    issues,
    result: generated.object,
    usage,
    usageByAttempt,
    groundedBy,
    disclosure: DISCLOSURE,
  }
}

/**
 * Rewrite one field of body copy, validate it, and retry once with the
 * failures named.
 *
 * A SIBLING of generateContent, not a generalization of it. The two share only
 * the retry/usage/disclosure envelope, and folding them into one dispatcher
 * would put the page-draft path — the one with real users and real coverage
 * today — at risk for no gain. The cost is the duplicated loop below, which is
 * the cheaper of the two mistakes.
 * @param {object} options
 * @param {string} options.fieldText The whole field to rewrite.
 * @param {string} [options.instruction] The reviewer's optional steer.
 * @param {object} [options.page] The page open in the mockup, as context.
 * @param {string} [options.provider] Unset takes the deployment's default; a
 *   name that is not configured throws rather than falling back, so a rewrite
 *   is never attributed to a model that did not produce it.
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<object>}
 */
async function generateRewrite({ fieldText, instruction, page, provider, signal }) {
  // Resolved before any work is done, so an unknown provider costs nothing.
  const selected = resolveProvider(provider)
  const { system, groundedBy } = buildRewriteSystemPrompt()

  let issues = []
  let generated = null
  let attempts = 0
  const usage = {}
  const usageByAttempt = []

  while (attempts < MAX_ATTEMPTS) {
    // The previous REWRITE string, not the whole object — that is what the
    // retry turn asks the model to correct.
    const previousDraft = generated ? generated.object?.rewrittenText : undefined
    attempts += 1
    const userPrompt = buildRewriteUserPrompt({
      fieldText,
      instruction,
      page,
      issues: attempts > 1 ? issues : undefined,
      previousDraft: attempts > 1 ? previousDraft : undefined,
    })

    generated = await selected.generateObject({
      system,
      userPrompt,
      jsonSchema: REWRITE_OUTPUT_SCHEMA,
      signal,
    })
    addUsage(usage, generated.usage)
    usageByAttempt.push(generated.rawUsage || {})

    const validation = validateRewrite(generated.object, fieldText, page?.type)
    issues = validation.issues
    if (validation.valid) break
  }

  return {
    task: 'rewrite-field',
    // The RESOLVED provider, for the same reason the content task reports it:
    // the panel's meta line attributes the suggestion to a specific model.
    provider: selected.name,
    model: generated.model,
    attempts,
    // Always resolves with the rewrite, valid or not. A suggestion that dropped
    // a link is still useful to a reviewer who can SEE that it dropped a link —
    // hiding it would leave them with a spinner and no explanation.
    valid: issues.length === 0,
    issues,
    result: generated.object,
    usage,
    usageByAttempt,
    groundedBy,
    disclosure: DISCLOSURE,
  }
}

module.exports = {
  generateContent,
  generateRewrite,
  getCapabilities,
  listModels,
  getPages,
  addUsage,
  DISCLOSURE,
  MAX_ATTEMPTS,
}
