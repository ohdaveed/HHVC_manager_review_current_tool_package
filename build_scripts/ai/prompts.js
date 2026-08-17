// System-prompt assembly for the AI assist feature.
//
// The prompt is built once per process and cached, for two reasons. It is
// large — it inlines the vendored SF.gov style corpus — and it must be
// BYTE-STABLE, because provider-anthropic.js puts a `cache_control` breakpoint
// on the last system block. Rebuilding it per request with anything variable
// in it (a timestamp, a request id, a differently-ordered page-key list) would
// invalidate the prompt cache on every call. Everything request-specific goes
// in the user turn instead. See shared prompt-caching guidance: caching is a
// prefix match, so one changed byte early costs the whole cache.
const { readFileSync, existsSync } = require('node:fs')
const { join } = require('node:path')
const { serializePageForPrompt } = require('./schemas')

const STYLE_DIR = join(__dirname, '..', '..', 'docs', 'source', 'sfgov-style')

/** Vendored guidance files, in the order they are inlined. */
const STYLE_FILES = ['writing-and-style.md', 'content-types-and-components.md']

let cachedCorpus = null

/**
 * Read the vendored SF.gov guidance.
 *
 * Falls back to an empty string per missing file rather than throwing: the
 * corpus is grounding, not a hard dependency, and the tool must still start if
 * someone trims docs/. A missing corpus makes the model less well-grounded,
 * which the caller surfaces through `groundedBy`.
 * @returns {{text: string, files: string[]}}
 */
function loadStyleCorpus() {
  if (cachedCorpus) return cachedCorpus
  const parts = []
  const files = []
  for (const name of STYLE_FILES) {
    const path = join(STYLE_DIR, name)
    if (!existsSync(path)) continue
    try {
      parts.push(`<document name="${name}">\n${readFileSync(path, 'utf8')}\n</document>`)
      files.push(name)
    } catch {
      // Unreadable file behaves the same as a missing one.
    }
  }
  cachedCorpus = { text: parts.join('\n\n'), files }
  return cachedCorpus
}

/**
 * The standing rules that constrain every generation, independent of task.
 *
 * These are not stylistic preferences. They come from the HHVC Web Governance
 * and Content Standards Manual §1.11 ("No automated agent may programmatically
 * set a page status to 'Approved to Move = Yes'") and SF.gov's own published AI
 * guidelines ("Always fact check AI-generated content before using it",
 * "Always disclose usage of Generative AI in your output").
 */
const GUARDRAILS = `<guardrails>
You are drafting content for human review. You are not publishing it.

- Everything you produce is a DRAFT that a content editor and a program manager
  must review before it goes anywhere near staging.
- Never state or imply that a page is approved, signed off, or ready to publish.
- Ground every factual claim in the source material you are given. If you do not
  have a source for something, leave it out and say so in editorNote, rather
  than filling the gap from general knowledge. Invented inspection timelines,
  fees, phone numbers, or legal citations are the single worst failure mode here.
- HHVC's scope is San Francisco Health Code Article 11 only. Structural
  problems — plumbing, roof leaks, sewer lines, permits, construction defects —
  belong to the Department of Building Inspection, not HHVC. Never write copy
  that routes a resident to HHVC for those.
- Do not write anything that reads as legal advice.
</guardrails>`

/**
 * Build the system prompt for the `content` task.
 *
 * Byte-stable given the same corpus on disk: no timestamps, no request data,
 * and the page-key list is sorted. Request-specific material (the reviewer's
 * prompt, the current page, validation feedback on a retry) belongs in the
 * user turn.
 * @param {string[]} pageKeys Every existing page key, for link targets.
 * @returns {{system: string, groundedBy: string[]}}
 */
function buildContentSystemPrompt(pageKeys) {
  const corpus = loadStyleCorpus()
  const keys = [...pageKeys].sort()

  const system = `You are a content designer for San Francisco's Healthy Housing and Vector
Control (HHVC) program, drafting pages for SF.gov in the Karl CMS.

${GUARDRAILS}

<house_rules>
Write plain-language, tenant-facing civic copy. These are measured, not
suggested — a validator scores your output against them and will send it back:

- Sentences average under 15 words. No sentence over 20.
- Paragraphs are 3 sentences or fewer.
- Three or more items MUST be a bulleted list, never a run of paragraphs or
  step text. This is a hard validation failure, not a preference.
- Keep bulleted lists to 5 items or fewer.
- Active voice. Address the reader as "you"; call the department "we".
- No contractions. Write "do not", not "don't".
- Never use the word "shall". Use "must" for obligations, "should" for
  recommendations, "may" for options, "will" for what the City will do.
- No dashes, no ellipses, no "&", no "i.e." / "e.g." / "etc.", no "please".
- Everyday words: "help" not "assistance", "need" not "require", "start" not
  "commence", "stop" not "cease", "to" not "in order to".
- Headings are sentence case and lead with their keyword. Never phrase a
  heading as a question.
- Link text must describe its destination. Never "click here" or "read more".
- Buttons are 25 characters or fewer and start with a verb.
- Write out dates as "January 28, 2026". Format phone numbers as 415-555-1212.
</house_rules>

<karl_field_notes>
Every section and step you produce carries a \`karl\` string. This is not a
comment — it is the instruction a Karl editor follows to place the content, and
it is reviewed as content in its own right. Say which Karl field or StreamField
block the item maps to, and flag anything a human needs to confirm. Be specific:
"what_to_do -> Section block. Section title: 'Start your report'." beats
"body section".
</karl_field_notes>

<available_page_keys>
Card targets and button targets must be one of these existing page keys.
Never invent a key. For anything off-site, use an absolute http(s) URL instead.

${keys.join('\n')}
</available_page_keys>

<reference_material>
${corpus.text}
</reference_material>`

  return { system, groundedBy: corpus.files }
}

/**
 * Build the user turn for a content request.
 * @param {object} options
 * @param {string} options.prompt The reviewer's instruction.
 * @param {object} [options.page] The page open in the mockup, as grounding.
 * @param {string[]} [options.issues] Validation failures from a previous attempt.
 * @param {object} [options.previousDraft] The draft those failures came from.
 * @returns {string}
 */
function buildContentUserPrompt({ prompt, page, issues, previousDraft }) {
  const parts = []

  if (page && Object.keys(page).length) {
    // serializePageForPrompt, not a local JSON.stringify: the size cap in
    // schemas.js measures this exact string, and the two silently diverging is
    // what let a page pass the limit and then arrive several times larger.
    parts.push(
      `<current_page>\nThe reviewer is looking at this page. Use it as context for voice, structure, and Karl notes.\n\n${serializePageForPrompt(
        page
      )}\n</current_page>`
    )
  }

  parts.push(`<request>\n${prompt}\n</request>`)

  if (issues && issues.length) {
    // The retry turn. Naming the exact failures is what makes one retry worth
    // having: a bare "try again" tends to reproduce the same violation.
    //
    // The rejected draft has to travel with them. Each API call is stateless,
    // so without it "fix every item below and change nothing else" is an
    // instruction the model cannot follow — it has nothing to change. It would
    // regenerate from scratch and quietly lose whatever was already right,
    // which is the opposite of what a targeted retry is for.
    if (previousDraft) {
      parts.push(`<previous_draft>\n${JSON.stringify(previousDraft, null, 2)}\n</previous_draft>`)
    }
    parts.push(
      `<validation_failures>\nThe draft above failed validation. Return the same page with every item below fixed, and change nothing else.\n\n${issues
        .map((issue) => `- ${issue}`)
        .join('\n')}\n</validation_failures>`
    )
  }

  return parts.join('\n\n')
}

/**
 * Build the system prompt for the compliance-audit task.
 *
 * Byte-stable like buildContentSystemPrompt: the retrieved knowledge chunks
 * are per-request and belong in the user turn, never here — putting them here
 * would invalidate the provider-side prompt cache on every call, since a
 * different page retrieves different chunks.
 * @returns {{system: string}}
 */
function buildComplianceAuditSystemPrompt() {
  const system = `You are a compliance auditor for San Francisco's Healthy Housing and Vector
Control (HHVC) program, reviewing a page mockup against the HHVC policy and
SF.gov style reference material you are given for each request.

${GUARDRAILS}

<audit_rules>
- Every source you are given carries an id attribute. Ground every finding in
  one or more of those ids via citedChunkIds. Never cite an id that was not
  given to you, and never leave citedChunkIds empty.
- If nothing in the provided sources supports a finding, do not report it.
  Absence of evidence is not evidence of a problem.
- severity "error" means the page contradicts or omits something a cited
  source requires. "warning" is a real but lower-stakes gap. "note" is worth a
  human's attention but is not itself a compliance issue.
- This is an audit, not a rewrite. Name the issue and recommend what a human
  editor should check or change — do not draft replacement copy.
</audit_rules>

<source_categories>
Every source carries a category. They do not carry equal authority, and
confusing them is the most damaging mistake you can make here:
- "hhvc-standards" — the HHVC Web Governance and Content Standards Manual, the
  program's own adopted standard for what a compliant HHVC page looks like.
  Authoritative for structure, required page elements, wording gates and
  publication readiness. Cite it by its section number when it has one.
- "hhvc-policy" — adopted policy, Director's Rules, Health Code extracts and
  program guidance. This is what a page can be non-compliant WITH.
- "sfgov-style" — SF.gov's published writing and style guidance. Authoritative
  for how something is written, not for what is required.
- "karl" — a measurement of what the Karl CMS can actually publish, taken from
  the live editor. Authoritative for whether a page is BUILDABLE. A finding
  grounded here is about the CMS, not about policy.
- "karl-gitbook" — the Karl editor Help Center's own published rules. It
  describes the CMS as documented rather than as measured, and the two have
  disagreed; where it conflicts with "karl", the measurement wins.
- "sfds" — the San Francisco Design System token capture and the recorded
  disagreements between it and what SF.gov renders. Authoritative for design
  tokens, not for content.
- "sfgov-live" — a dated snapshot of what SF.gov publishes today. Useful as
  evidence of current practice, and it can itself be out of date or wrong. It
  is not a requirement.
- "mockup-draft" — the proposed page mockups themselves, including the page you
  are auditing. This is DRAFT copy nobody has approved. **Never treat it as a
  requirement, and never cite it as the authority a finding rests on.** Use it
  only to describe what the proposal currently says — for example when a
  finding is that two mockup pages contradict each other.
</source_categories>`

  return { system }
}

/**
 * Build the user turn for a compliance-audit request.
 * @param {object} options
 * @param {object} options.page The page being audited.
 * @param {Array<{chunk: {id: string, sourceFile: string, headingPath: string|null, content: string}, score: number}>} options.retrieved
 *   Top-K knowledge chunks, most relevant first.
 * @param {string[]} [options.issues] Citation failures from a previous attempt.
 * @param {object} [options.previousDraft] The draft those failures came from.
 * @returns {string}
 */
function buildComplianceAuditUserPrompt({ page, retrieved, issues, previousDraft }) {
  // `category` is rendered because the corpus is no longer one kind of thing.
  // It now holds adopted policy, a measurement of the CMS, snapshots of the
  // live site, and the DRAFT mockups themselves — and the draft is roughly a
  // third of it. Without the label, a retrieved chunk of the proposal reads to
  // the model exactly like a requirement, so an audit could cite the page under
  // audit as authority for itself. The value comes from the matched row, never
  // from the model, so it cannot be spoofed by a citation.
  const sources = retrieved
    .map(({ chunk }) => {
      const headingAttr = chunk.headingPath ? ` heading="${chunk.headingPath}"` : ''
      const categoryAttr = chunk.category ? ` category="${chunk.category}"` : ''
      return `<source id="${chunk.id}" file="${chunk.sourceFile}"${categoryAttr}${headingAttr}>\n${chunk.content}\n</source>`
    })
    .join('\n\n')

  const parts = [
    `<cited_sources>\n${sources}\n</cited_sources>`,
    `<page_under_audit>\n${serializePageForPrompt(page)}\n</page_under_audit>`,
  ]

  if (issues && issues.length) {
    // The retry turn, mirroring buildContentUserPrompt's: the rejected draft
    // has to travel with the instruction, or "fix these and change nothing
    // else" is not followable.
    if (previousDraft) {
      parts.push(`<previous_draft>\n${JSON.stringify(previousDraft, null, 2)}\n</previous_draft>`)
    }
    parts.push(
      `<validation_failures>\nThe draft above failed validation. Return the same audit with ` +
        `every item below fixed, and change nothing else.\n\n${issues
          .map((issue) => `- ${issue}`)
          .join('\n')}\n</validation_failures>`
    )
  }

  return parts.join('\n\n')
}

/**
 * The `rewrite-field` system prompt.
 *
 * Built from the same cached corpus as the content prompt, and byte-stable for
 * the same reason: caching is a prefix match, so anything variable in here
 * would invalidate it on every call. Everything request-specific — the field
 * text, the reviewer's optional instruction, the retry failures — goes in the
 * user turn.
 *
 * The standing instruction lives HERE rather than in the browser on purpose.
 * If the panel sent the house rules, the rules a rewrite is held to could
 * drift away from the rules js/plain-language.js scores the page against, and
 * the two would disagree with no single source of truth.
 * @returns {{system: string, groundedBy: string[]}}
 */
function buildRewriteSystemPrompt() {
  const corpus = loadStyleCorpus()
  const system = `You rewrite one field of body copy for a San Francisco government web page.

Return ONLY the rewritten text for that one field. Do not add a heading, do not
explain your changes, and do not return more than the one field you were given.

<house_rules>
- Plain language at roughly a Grade 6 reading level. Tenant-facing, empathetic.
- Preserve the meaning. Never introduce a fact, number, phone number, deadline,
  or obligation that is not already in the original text.
- Preserve every [label](target) markdown link. You may reword the label; never
  change or drop the target.
- Plain prose only. No HTML tags.
- Active voice. Address the reader as "you"; call the department "we".
- No contractions. Write "do not", not "don't".
- Never use the word "shall". Use "must" for obligations, "should" for
  recommendations, "may" for options, "will" for what the City will do.
- No dashes, no ellipses, no "&", no "i.e." / "e.g." / "etc.", no "please".
- Everyday words: "help" not "assistance", "need" not "require", "start" not
  "commence", "stop" not "cease", "to" not "in order to".
- Write out dates as "January 28, 2026". Format phone numbers as 415-555-1212.
</house_rules>

<reference_material>
${corpus.text}
</reference_material>`

  return { system, groundedBy: corpus.files }
}

/**
 * Build the user turn for a rewrite request.
 * @param {object} options
 * @param {string} options.fieldText The whole field being rewritten.
 * @param {string} [options.instruction] The reviewer's optional steer.
 * @param {object} [options.page] The page open in the mockup, as context.
 * @param {string[]} [options.issues] Validation failures from a previous attempt.
 * @param {string} [options.previousDraft] The rewrite those failures came from.
 * @returns {string}
 */
function buildRewriteUserPrompt({ fieldText, instruction, page, issues, previousDraft }) {
  const parts = []

  if (page && Object.keys(page).length) {
    // serializePageForPrompt for the same reason the content prompt uses it:
    // the size cap in schemas.js measures this exact string, and measuring one
    // string while sending another is what let an oversized page through once.
    parts.push(
      `<page_context>\nThis field appears on the page below. Use it for context only. Rewrite the single field, not the page.\n\n${serializePageForPrompt(
        page
      )}\n</page_context>`
    )
  }

  parts.push(`<field_to_rewrite>\n${fieldText}\n</field_to_rewrite>`)

  // An empty instruction is the common case — the reviewer clicked the button
  // without typing anything. The standing instruction is spelled out rather
  // than left implicit, so the model is never asked to rewrite with no goal.
  parts.push(
    instruction
      ? `<instruction>\n${instruction}\n</instruction>`
      : '<instruction>\nTighten this up and bring it in line with the house rules. Keep every fact.\n</instruction>'
  )

  if (issues && issues.length) {
    // The rejected rewrite travels with its failures, for the same reason it
    // does on the content path: each call is stateless, so "fix these and
    // change nothing else" is unfollowable without the thing to change, and
    // the retry would regenerate from scratch and lose what was already right.
    if (previousDraft) {
      parts.push(`<previous_attempt>\n${previousDraft}\n</previous_attempt>`)
    }
    parts.push(
      `<validation_failures>\nThe rewrite above failed validation. Return the field again with every item below fixed, and change nothing else.\n\n${issues
        .map((issue) => `- ${issue}`)
        .join('\n')}\n</validation_failures>`
    )
  }

  return parts.join('\n\n')
}

module.exports = {
  buildContentSystemPrompt,
  buildContentUserPrompt,
  buildRewriteSystemPrompt,
  buildRewriteUserPrompt,
  buildComplianceAuditSystemPrompt,
  buildComplianceAuditUserPrompt,
  loadStyleCorpus,
  GUARDRAILS,
}
