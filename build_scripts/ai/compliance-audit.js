// Orchestration for the compliance-audit task: embed the page, retrieve the
// most relevant knowledge chunks, ground a provider call in them, validate
// citations against the retrieved set, retry once if any are unverifiable.
// Sibling of index.js's generateContent — kept separate rather than folded
// into it, since generateContent() stays exactly what it is today
// (hardcoded to PAGE_OUTPUT_SCHEMA/validateGeneratedPage) and this task's
// Gemini-only embedding dependency and citation-checking retry loop have
// nothing to do with the page-drafting path.
const { serializePageForPrompt, COMPLIANCE_AUDIT_OUTPUT_SCHEMA } = require('./schemas')
const { buildComplianceAuditSystemPrompt, buildComplianceAuditUserPrompt } = require('./prompts')
const { resolveProvider } = require('./providers')
const gemini = require('./provider-gemini')
const { retrieveRelevantChunks } = require('./knowledge-retrieval')
const { findInvalidCitations } = require('./validate-compliance-audit')
const { DISCLOSURE, addUsage } = require('./index')

/** Chunks retrieved per audit. Small enough that every retrieved chunk
 * plausibly fits the page under review, large enough to cover more than one
 * policy document when the page touches more than one topic. */
const TOP_K = 6

/** Categories withheld from compliance-audit retrieval; see the call site. */
const DRAFT_CATEGORIES = ['mockup-draft']

// One retry, not a loop — same reasoning as index.js's generateContent:
// a second attempt with the specific bad citations named fixes most
// mechanical mistakes, and a third rarely adds anything.
const MAX_ATTEMPTS = 2

/**
 * @param {object} options
 * @param {object} options.page The page open in the mockup.
 * @param {string} [options.provider] Which provider GENERATES the audit
 *   text. Independent of embeddings, which always run on Gemini regardless
 *   (see provider-gemini.js's embedContent doc comment) — a deployment can
 *   generate on Anthropic while still using Gemini purely for retrieval.
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<object>}
 */
async function generateComplianceAudit({ page, provider, signal }) {
  const selected = resolveProvider(provider)
  const pageText = serializePageForPrompt(page)

  const [queryEmbedding] = await gemini.embedContent([pageText], 'QUERY')
  // Draft mockup copy is withheld from THIS task's retrieval, structurally
  // rather than by instruction. The corpus deliberately contains the mockups
  // (they are the subject a reviewer asks the AI about elsewhere), but an
  // audit asks "does this page comply with policy", and a finding grounded in
  // an unapproved draft answers a different question with the same authority.
  //
  // The system prompt already says so in terms. It was not enough: measured
  // against the real corpus, an audit of a rats page returned three findings
  // and ALL THREE cited `mockup-draft` — real contradictions, but evidenced by
  // other proposals rather than by the Director's Rules they should rest on.
  // Prompt wording is a request; this is a guarantee.
  //
  // Nothing is lost by it: the page under audit travels in the prompt verbatim
  // as <page_under_audit>, so the model can still see exactly what it is
  // reviewing — it just cannot cite a draft as the rule it breaks.
  const retrieved = await retrieveRelevantChunks(queryEmbedding, TOP_K, {
    excludeCategories: DRAFT_CATEGORIES,
  })
  const retrievedIds = new Set(retrieved.map((entry) => entry.chunk.id))
  const chunksById = new Map(retrieved.map((entry) => [entry.chunk.id, entry.chunk]))

  const { system } = buildComplianceAuditSystemPrompt()

  let issues = []
  let generated = null
  let attempts = 0
  const usage = {}
  const usageByAttempt = []

  while (attempts < MAX_ATTEMPTS) {
    const previousDraft = generated ? generated.object : undefined
    attempts += 1
    const userPrompt = buildComplianceAuditUserPrompt({
      page,
      retrieved,
      issues: attempts > 1 ? issues : undefined,
      previousDraft: attempts > 1 ? previousDraft : undefined,
    })

    generated = await selected.generateObject({
      system,
      userPrompt,
      jsonSchema: COMPLIANCE_AUDIT_OUTPUT_SCHEMA,
      signal,
    })
    addUsage(usage, generated.usage)
    usageByAttempt.push(generated.rawUsage || {})

    issues = findInvalidCitations(generated.object, retrievedIds)
    if (issues.length === 0) break
  }

  // The source_file/headingPath a reviewer reads is resolved server-side from
  // the matched chunk row, never echoed back from the model — real corpus
  // metadata, not model-generated text, even for a finding whose citation
  // failed validation (a reviewer can still see what it WAS trying to cite).
  const findings = generated.object.findings.map((finding) => ({
    ...finding,
    citedSources: (finding.citedChunkIds || [])
      .filter((id) => chunksById.has(id))
      .map((id) => {
        const chunk = chunksById.get(id)
        // `category` travels with the citation for the same reason it is in the
        // prompt: the corpus now mixes adopted policy with draft mockup copy and
        // dated snapshots of the live site, and a reviewer deciding whether to
        // act on a finding needs to know which kind of source it rests on.
        // Resolved from the row, so the label cannot be model-generated.
        return {
          id: chunk.id,
          sourceFile: chunk.sourceFile,
          category: chunk.category,
          headingPath: chunk.headingPath,
        }
      }),
  }))

  return {
    task: 'compliance-audit',
    // The RESOLVED provider, matching generateContent's convention: an
    // unnamed request still has to report which model actually answered.
    provider: selected.name,
    model: generated.model,
    attempts,
    valid: issues.length === 0,
    issues,
    findings,
    summary: generated.object.summary,
    usage,
    usageByAttempt,
    disclosure: DISCLOSURE,
  }
}

module.exports = { generateComplianceAudit, TOP_K, MAX_ATTEMPTS, DRAFT_CATEGORIES }
