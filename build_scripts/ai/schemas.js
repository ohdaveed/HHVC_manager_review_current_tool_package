// Schemas for the AI assist API: the Zod schema validating an inbound request,
// and the JSON Schema constraining Claude's structured output.
//
// The output schema deliberately mirrors, but is NARROWER than,
// build_scripts/schema.js. Two reasons:
//
//   1. Structured outputs support a subset of JSON Schema. Length constraints
//      (minLength, maxLength) and numeric bounds are not supported, so rules
//      like "title must be non-empty" move into `description` text and are
//      enforced afterwards by the real Zod schema in validate-output.js. The
//      model is asked to comply; the validator is what actually holds.
//   2. Text-bearing arrays in the page schema accept `string | {text,
//      unverified}`. Here they are plain strings only. A plain string is one
//      arm of that union, so anything generated still satisfies the Zod
//      schema — the model just cannot invent an `unverified` flag, which is a
//      judgement about sourcing that belongs to a human, not a generator.
//
// Anything this schema allows must also pass build_scripts/schema.js.
// tests/ai-assist-schema.test.js is the guard against those two drifting.
const { z } = require('zod')
// The registry is the single source of truth for which provider names exist.
// Safe to require here: no provider module requires this file back, so there is
// no cycle.
const { allProviderNames } = require('./providers')
// A leaf module on purpose — see its header. The provider needs this fact and
// cannot require this file back without creating a cycle.
const { ANTHROPIC_GRAMMAR_INCOMPATIBLE } = require('./schema-flags')

/** Karl content types this mockup uses. Matches the values in pages/*.js. */
const PAGE_TYPES = [
  'Agency',
  'Transaction',
  'Information',
  'Resource Collection',
  'Campaign',
  'Report',
]

/** Section component roles, mirroring sectionComponentSchema. */
const SECTION_COMPONENTS = [
  'body',
  'services',
  'resources',
  'related',
  'contact',
  'spotlight',
  'what-to-do',
  'supporting',
  'intro',
  'top-facts',
]

const calloutSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string', description: 'Short heading for the callout.' },
    text: { type: 'string', description: 'The callout body. One or two sentences.' },
    variant: { type: 'string', enum: ['info', 'warning', 'note'] },
    karl: { type: 'string', description: 'Where this callout goes in Karl.' },
  },
  required: ['text', 'karl'],
}

const cardSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string', description: 'Link text. Must describe its destination.' },
    text: { type: 'string', description: 'One short sentence describing the destination.' },
    target: {
      type: 'string',
      description:
        'An EXISTING page key from the list of available page keys in the prompt. Never invent one.',
    },
    url: { type: 'string', description: 'An absolute http(s) URL, for external links only.' },
    karl: { type: 'string' },
  },
  required: ['title', 'karl'],
}

const stepSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string', description: 'Imperative step title, sentence case.' },
    text: {
      type: 'array',
      items: { type: 'string' },
      description: 'At most 2 entries. Use bullets for 3 or more.',
    },
    bullets: { type: 'array', items: { type: 'string' } },
    button: { type: 'string', description: 'Call to action. 25 characters or fewer.' },
    buttonTarget: { type: 'string', description: 'An existing page key.' },
    buttonUrl: { type: 'string', description: 'An absolute http(s) URL.' },
    callout: calloutSchema,
    karl: { type: 'string' },
  },
  required: ['title', 'karl'],
}

const sectionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    heading: {
      type: 'string',
      description: 'Sentence case. Lead with the keyword. Never a question.',
    },
    component: { type: 'string', enum: SECTION_COMPONENTS },
    kind: { type: 'string', enum: ['body', 'placement', 'meta', 'editor'] },
    open: { type: 'boolean', description: 'Render a supporting accordion expanded on load.' },
    karl: {
      type: 'string',
      description:
        'REQUIRED. A precise Karl CMS placement note saying which field or StreamField block this maps to.',
    },
    paragraphs: {
      type: 'array',
      items: { type: 'string' },
      description: 'At most 2 entries. Three or more MUST be bullets instead.',
    },
    bullets: { type: 'array', items: { type: 'string' } },
    steps: { type: 'array', items: stepSchema },
    cards: { type: 'array', items: cardSchema },
    callout: calloutSchema,
    button: { type: 'string', description: '25 characters or fewer.' },
    buttonTarget: { type: 'string' },
    buttonUrl: { type: 'string' },
  },
  required: ['heading', 'karl'],
}

/**
 * Anthropic's ceiling on optional properties in a structured-output schema.
 *
 * Taken from the API's own rejection message ("limit: 24"), not a doc page.
 * Gemini imposes no comparable limit, which is why exceeding it produced a
 * failure on one provider and not the other.
 */
const MAX_OPTIONAL_SCHEMA_PROPERTIES = 24

/**
 * Count optional properties the way the grammar compiler does: recursively,
 * through array `items`, and once per *use* of a shared subschema rather than
 * once per definition. `calloutSchema` is embedded by both sections and steps,
 * so each optional property it declares counts twice.
 *
 * Exported so `tests/ai-assist-schema.test.js` measures what the API measures
 * instead of restating a number that would drift.
 * @param {object} node A JSON Schema node.
 * @returns {number}
 */
function countOptionalProperties(node) {
  if (!node || typeof node !== 'object') return 0
  let total = 0
  if (node.type === 'object' && node.properties) {
    const required = new Set(node.required || [])
    for (const [key, child] of Object.entries(node.properties)) {
      if (!required.has(key)) total += 1
      total += countOptionalProperties(child)
    }
  }
  if (node.type === 'array' && node.items) total += countOptionalProperties(node.items)
  return total
}

/** The `content` task's output: one HHVC page object. */
const PAGE_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    slug: { type: 'string', description: 'For example sf.gov/report-rats-mice.' },
    type: { type: 'string', enum: PAGE_TYPES },
    title: { type: 'string', description: 'Sentence case, front-loaded, 80 characters or fewer.' },
    summary: { type: 'string', description: '180 characters or fewer. One sentence.' },
    audience: {
      type: 'array',
      items: { type: 'string' },
      description: 'Who this page is for. At least one entry, phrased as "A tenant who...".',
    },
    reading: { type: 'string', description: 'For example "Grade 6".' },
    seoTitle: { type: 'string', description: '60 characters or fewer, ending "| SF.gov".' },
    metaDescription: {
      type: 'string',
      description: '110 characters or fewer, opening with an active verb.',
    },
    primaryCta: { type: 'string' },
    editorNote: { type: 'string', description: 'A note to the human editor reviewing this draft.' },
    sections: { type: 'array', items: sectionSchema },
  },
  required: ['slug', 'type', 'title', 'summary', 'audience', 'reading', 'sections'],
}

/**
 * `PAGE_OUTPUT_SCHEMA` is one Anthropic's structured-output grammar compiler
 * cannot accept, so the Claude provider states it in the prompt instead.
 *
 * **Measured, not assumed.** `PAGE_OUTPUT_SCHEMA` fails two independent gates:
 * it declares 28 optional properties against a limit of 24, and once trimmed
 * under that limit the API still answered `"Schema is too complex."` — as it
 * did with `sections[].steps` removed entirely, a third of the schema gone. The
 * failure mode varies between `"Schema is too complex."` and
 * `"Grammar compilation timed out."` after minutes of compilation, so it is a
 * budget the page shape simply does not fit, not one bad branch to prune.
 *
 * **Nothing is lost by dropping to prompt instructions**, because structured
 * outputs was never the only guarantee here: `generateContent()` validates every
 * draft against the real Zod page schema and retries once with the specific
 * errors named. Measured on the same request that fails as a grammar: the model
 * returned a page in 21 seconds that parsed cleanly and passed
 * `validateGeneratedPage` with zero issues.
 *
 * Membership is by object identity rather than a flag inside the schema,
 * because the schema object is serialized straight into an API request and an
 * unrecognized key there is its own rejection.
 *
 * Gemini is unaffected — it compiles this schema fine, and that asymmetry is
 * exactly why the failure went unnoticed.
 */
PAGE_OUTPUT_SCHEMA[ANTHROPIC_GRAMMAR_INCOMPATIBLE] = true

/**
 * One compliance-audit finding: an issue grounded in one or more cited chunk
 * ids. Citation identity is an id, resolved against the actually-retrieved
 * set server-side in compliance-audit.js — a free-text citedSource/
 * citedHeading would let the model invent a plausible-sounding citation
 * nothing retrieved actually supports.
 */
const complianceFindingSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    issue: { type: 'string', description: 'One sentence naming the compliance gap or risk.' },
    severity: { type: 'string', enum: ['error', 'warning', 'note'] },
    citedChunkIds: {
      type: 'array',
      items: { type: 'string' },
      description:
        'The id attribute(s) of the <source> elements in <cited_sources> that ground this ' +
        'finding. At least one is required. Never invent an id that was not given to you.',
    },
    recommendation: { type: 'string', description: 'One concrete, actionable fix.' },
  },
  required: ['issue', 'severity', 'citedChunkIds', 'recommendation'],
}

/** The `compliance-audit` task's output. */
const COMPLIANCE_AUDIT_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    findings: { type: 'array', items: complianceFindingSchema },
    summary: { type: 'string', description: 'Two or three sentences summarizing the audit.' },
  },
  required: ['findings', 'summary'],
}

/**
 * Caps on the `page` grounding object.
 *
 * `prompt` is capped at 8000 characters, but `page` used to be an unbounded
 * `z.record(z.unknown())` — and it is serialized wholesale into the provider
 * prompt. That made the character cap decorative: an authenticated client could
 * send a megabyte of nested JSON and have the server pay for tokenizing it.
 * The real page objects in `pages/*.js` are nowhere near either limit (the
 * largest serializes to a few tens of KB and nests about six deep), so these
 * bound the abuse case without rejecting anything the tool itself displays.
 */
const MAX_PAGE_JSON_BYTES = 96 * 1024
const MAX_PAGE_DEPTH = 12

/**
 * Serialize the grounding page exactly as the provider prompt will send it.
 *
 * Shared with `buildContentUserPrompt` on purpose. The cap used to measure
 * compact `JSON.stringify(page)` while the prompt sent the pretty-printed
 * form, so indentation was free: an object of many small nested entries
 * measured ~100 KB here and expanded to ~400 KB upstream, sailing past a limit
 * whose whole job is bounding what gets tokenized. Measuring one string and
 * sending another is the bug; one function used by both is the fix.
 * @param {unknown} page
 * @returns {string}
 */
function serializePageForPrompt(page) {
  return JSON.stringify(page, null, 2)
}

/**
 * Depth of the deepest nested array/object, counting the root as 1.
 *
 * Iterative rather than recursive on purpose: a recursive walk over
 * attacker-supplied nesting is itself the denial-of-service it is meant to
 * detect, since it blows the stack before it can report anything. This bails
 * out as soon as the limit is passed, so a deeply nested payload costs one
 * partial traversal rather than a full one.
 * @param {unknown} value
 * @param {number} limit Stop once depth exceeds this.
 * @returns {number} The measured depth, capped at `limit + 1`.
 */
function measureDepth(value, limit) {
  let deepest = 0
  const stack = [{ node: value, depth: 1 }]
  while (stack.length) {
    const { node, depth } = stack.pop()
    if (!node || typeof node !== 'object') continue
    if (depth > deepest) deepest = depth
    if (depth > limit) return depth
    for (const child of Array.isArray(node) ? node : Object.values(node)) {
      if (child && typeof child === 'object') stack.push({ node: child, depth: depth + 1 })
    }
  }
  return deepest
}

/**
 * The page open in the mockup, sent as grounding context.
 *
 * Still passed through as opaque JSON rather than re-validated against
 * `pageSchema`: it comes from `pages/*.js`, which `validate.js` already
 * guarantees, and a stricter shape check here would reject a page the tool is
 * currently displaying. Size and depth are a different matter — those are
 * resource limits, not shape opinions, and they hold regardless of where the
 * object came from.
 */
const groundingPageSchema = z
  .record(z.unknown())
  .refine(
    (page) => {
      try {
        // Buffer.byteLength, not String#length: the constant is named in bytes
        // and the request contract is byte-based, but `.length` counts UTF-16
        // code units, so multi-byte page copy could exceed the cap by roughly
        // 3x. Same unit bug that was already fixed in readBodyWithLimit —
        // worth checking anywhere a byte limit meets a JS string.
        return Buffer.byteLength(serializePageForPrompt(page), 'utf8') <= MAX_PAGE_JSON_BYTES
      } catch {
        // A circular structure cannot be serialized into the prompt either.
        return false
      }
    },
    { message: `page must serialize to ${MAX_PAGE_JSON_BYTES} bytes or fewer` }
  )
  .refine((page) => measureDepth(page, MAX_PAGE_DEPTH) <= MAX_PAGE_DEPTH, {
    message: `page must not nest deeper than ${MAX_PAGE_DEPTH} levels`,
  })

/**
 * The `rewrite-field` task's output: one replacement string, nothing else.
 *
 * Deliberately minimal. The field's identity (which paragraph, which section)
 * is the browser's to track — the model is handed text and asked for text, so
 * it has no opportunity to relocate a rewrite onto a different field.
 */
const REWRITE_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['rewrittenText'],
  properties: {
    rewrittenText: {
      type: 'string',
      description: 'The rewritten field text, plain prose, markdown links preserved.',
    },
  },
}

/**
 * Inbound POST /api/ai/generate body.
 *
 * A discriminated union rather than one object with optional fields. The two
 * tasks genuinely differ: `content` cannot work without a prompt and
 * `rewrite-field` has no use for one. Expressing that as a single shape would
 * mean making `prompt` optional for both, which silently drops the guarantee
 * that a content request always carries an instruction.
 *
 * `provider` names a REGISTERED provider, not necessarily a configured one.
 * The enum only asks "is this a provider this build knows about?"; whether the
 * deployment holds a key for it is decided later by `resolveProvider`, which
 * can answer with the list of what IS available. Folding both checks in here
 * would turn a fixable "pick the other one" into a generic schema rejection.
 *
 * The accepted names are READ FROM THE REGISTRY rather than written out here.
 * providers.js documents that adding a provider is "a require plus a line in
 * REGISTRY; nothing downstream of here mentions a provider by name" — and a
 * second hardcoded list quietly breaks that: `capabilities` would advertise
 * the new provider and the browser picker would send its name, but this schema
 * would reject the request as malformed before `resolveProvider` ever ran. The
 * failure would look like a client bug rather than a missed registration.
 */
const generateRequestSchema = z.discriminatedUnion('task', [
  z.object({
    task: z.literal('content'),
    provider: z.enum(allProviderNames()).optional(),
    prompt: z.string().min(1).max(8000),
    page: groundingPageSchema.optional(),
  }),
  z.object({
    task: z.literal('rewrite-field'),
    provider: z.enum(allProviderNames()).optional(),
    fieldText: z.string().min(1).max(8000),
    instruction: z.string().max(2000).optional(),
    page: groundingPageSchema.optional(),
  }),
  z.object({
    task: z.literal('compliance-audit'),
    provider: z.enum(allProviderNames()).optional(),
    // No `prompt` field: this task's grounding comes from retrieval, not
    // free text. A plain (non-.strict()) z.object() silently drops an
    // unrecognized field, so a client that sends one anyway is simply
    // ignored, matching every other field's existing behavior on this schema.
    page: groundingPageSchema,
  }),
])

module.exports = {
  MAX_OPTIONAL_SCHEMA_PROPERTIES,
  countOptionalProperties,
  PAGE_OUTPUT_SCHEMA,
  REWRITE_OUTPUT_SCHEMA,
  COMPLIANCE_AUDIT_OUTPUT_SCHEMA,
  PAGE_TYPES,
  SECTION_COMPONENTS,
  generateRequestSchema,
  serializePageForPrompt,
  measureDepth,
  MAX_PAGE_JSON_BYTES,
  MAX_PAGE_DEPTH,
  MAX_REQUEST_BODY_BYTES: 128 * 1024,
}
