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
    parts.push(
      `<current_page>\nThe reviewer is looking at this page. Use it as context for voice, structure, and Karl notes.\n\n${JSON.stringify(
        page,
        null,
        2
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

module.exports = {
  buildContentSystemPrompt,
  buildContentUserPrompt,
  loadStyleCorpus,
  GUARDRAILS,
}
