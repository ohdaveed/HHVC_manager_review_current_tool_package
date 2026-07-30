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

/** Inbound POST /api/ai/generate body. */
const generateRequestSchema = z.object({
  task: z.enum(['content']),
  provider: z.enum(['claude']).optional(),
  prompt: z.string().min(1).max(8000),
  // The page currently open in the mockup, sent as grounding context. Passed
  // through as opaque JSON rather than re-validated: it comes from pages/*.js,
  // which validate.js already guarantees, and a stricter check here would
  // reject a page the tool itself is displaying.
  page: z.record(z.unknown()).optional(),
})

module.exports = {
  PAGE_OUTPUT_SCHEMA,
  PAGE_TYPES,
  SECTION_COMPONENTS,
  generateRequestSchema,
}
