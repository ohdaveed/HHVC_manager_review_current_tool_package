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

  while (attempts < MAX_ATTEMPTS) {
    attempts += 1
    const userPrompt = buildContentUserPrompt({
      prompt,
      page,
      issues: attempts > 1 ? issues : undefined,
    })

    generated = await anthropic.generateObject({
      system,
      userPrompt,
      jsonSchema: PAGE_OUTPUT_SCHEMA,
      signal,
    })

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
    usage: generated.usage,
    groundedBy,
    disclosure: DISCLOSURE,
  }
}

module.exports = {
  generateContent,
  getCapabilities,
  listModels,
  getPages,
  DISCLOSURE,
  MAX_ATTEMPTS,
}
