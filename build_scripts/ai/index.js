// Orchestration for the AI assist feature: generate, validate, retry once.
//
// Imported by server.ts's /api/ai/* routes. Everything here is provider-shaped
// but currently Claude-only; adding Gemini means a sibling of
// provider-anthropic.js and a switch in generateContent, not a rewrite.
const { loadPageData } = require('../load-pages')
const { buildContentSystemPrompt, buildContentUserPrompt, loadStyleCorpus } = require('./prompts')
const { PAGE_OUTPUT_SCHEMA } = require('./schemas')
const { validateGeneratedPage } = require('./validate-output')
const anthropic = require('./provider-anthropic')

// One retry, not a loop. A second attempt with the specific failures named
// fixes most mechanical violations; a third rarely adds anything and doubles
// the worst-case latency and cost of an already slow request.
const MAX_ATTEMPTS = 2

/**
 * SF.gov's AI guidelines require disclosure of generative AI in output, and
 * the HHVC standards manual §1.11 forbids any automated approval. This string
 * rides along with every result so the browser cannot render or export a draft
 * without carrying the label.
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
 * What this deployment can actually do. Drives the browser's empty state, so
 * an unconfigured server explains itself instead of failing on first use.
 * @returns {object}
 */
function getCapabilities() {
  const corpus = loadStyleCorpus()
  return {
    providers: { claude: anthropic.isConfigured() },
    models: { claude: anthropic.isConfigured() ? anthropic.getModel() : null },
    tasks: ['content'],
    groundedBy: corpus.files,
    pageCount: Object.keys(getPages()).length,
    disclosureRequired: true,
  }
}

/**
 * List the models the configured key can actually see.
 *
 * Queried live rather than hardcoded: model lineups move, and a stale constant
 * in committed code turns into a 404 nobody notices until a reviewer hits it.
 * @returns {Promise<{claude: string[]}>}
 */
async function listModels() {
  if (!anthropic.isConfigured()) return { claude: [] }
  const client = anthropic.createClient()
  const ids = []
  for await (const model of client.models.list()) ids.push(model.id)
  return { claude: ids }
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
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<object>}
 */
async function generateContent({ prompt, page, signal }) {
  const pages = getPages()
  const { system, groundedBy } = buildContentSystemPrompt(Object.keys(pages))

  let issues = []
  let generated = null
  let attempts = 0
  // Usage is summed, not overwritten. A retried generation really did cost two
  // calls, and reporting only the last one would understate the spend of
  // exactly the requests that cost the most.
  const usage = {}

  while (attempts < MAX_ATTEMPTS) {
    const previousDraft = generated ? generated.object : undefined
    attempts += 1
    const userPrompt = buildContentUserPrompt({
      prompt,
      page,
      issues: attempts > 1 ? issues : undefined,
      previousDraft: attempts > 1 ? previousDraft : undefined,
    })

    generated = await anthropic.generateObject({
      system,
      userPrompt,
      jsonSchema: PAGE_OUTPUT_SCHEMA,
      signal,
    })
    addUsage(usage, generated.usage)

    const validation = validateGeneratedPage(generated.object, pages)
    issues = validation.issues
    if (validation.valid) break
  }

  return {
    task: 'content',
    provider: 'claude',
    model: generated.model,
    attempts,
    valid: issues.length === 0,
    issues,
    result: generated.object,
    usage,
    groundedBy,
    disclosure: DISCLOSURE,
  }
}

module.exports = {
  generateContent,
  getCapabilities,
  listModels,
  getPages,
  addUsage,
  DISCLOSURE,
  MAX_ATTEMPTS,
}
