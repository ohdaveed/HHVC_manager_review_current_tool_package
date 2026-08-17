// Zod schema for the HHVC page data model, shared by build_scripts/validate.js
// and tests/data-validation.test.js so the schema itself has test coverage
// independent of whatever the current pages/*.js content happens to be.
const { z } = require('zod')

const karlGuideValueSchema = z.object({
  label: z.string().min(1),
  value: z.string(),
  source: z.enum(['visible', 'inherited', 'mockup-only', 'derived']).optional(),
})

const karlGuideSchema = z.object({
  path: z.string().optional(),
  panel: z.string().optional(),
  block: z.string().optional(),
  field: z.string().optional(),
  rawField: z.string().optional(),
  linkShape: z
    .enum(['page-reference', 'button-link', 'resources-list', 'campaign-related', 'rich-text-link'])
    .optional(),
  steps: z.array(z.string().min(1)).min(1),
  evidence: z.enum(['E1', 'E2', 'E3', 'E4', 'U']).optional(),
  // `inferred` is deliberately distinct from `confirmed`: it marks a
  // destination this repo CHOSE where the field map records no answer, and the
  // panel renders it as "Inferred — verify" rather than "E1 confirmed". See
  // INFERRED_PATHS in js/karl-guide-registry.js.
  status: z.enum(['confirmed', 'inferred', 'inherited', 'mockup-only', 'unresolved']).optional(),
  unresolvedId: z
    .string()
    .regex(/^U(?:[1-9]|1[0-9]|20)$/)
    .optional(),
  values: z.array(karlGuideValueSchema).optional(),
})

const imageSchema = z.object({
  src: z.string().min(1),
  alt: z.string().min(1),
  karl: z.string().optional(),
  karlGuide: karlGuideSchema.optional(),
  caption: z.string().optional(),
})

const cardSchema = z.object({
  title: z.string().min(1),
  text: z.string().min(1).optional(),
  target: z.string().optional(),
  url: z.string().optional(),
  karl: z.string().optional(),
  karlGuide: karlGuideSchema.optional(),
  fileType: z.string().optional(),
  unverified: z.boolean().optional(),
  unverifiedReason: z.string().optional(),
})

const calloutSchema = z.object({
  text: z.string().min(1),
  karl: z.string().optional(),
  karlGuide: karlGuideSchema.optional(),
  title: z.union([z.string(), z.literal(false)]).optional(),
  variant: z.enum(['info', 'warning', 'note']).optional(),
})

const unverifiedItemSchema = z.object({
  text: z.string().min(1),
  unverified: z.boolean().optional(),
  unverifiedReason: z.string().optional(),
})

const stepSchema = z.object({
  title: z.string().min(1),
  text: z.array(z.union([z.string(), unverifiedItemSchema])).optional(),
  bullets: z.array(z.union([z.string(), unverifiedItemSchema])).optional(),
  button: z.string().optional(),
  buttonTarget: z.string().optional(),
  buttonUrl: z.string().optional(),
  karl: z.string().optional(),
  karlGuide: karlGuideSchema.optional(),
  callout: calloutSchema.optional(),
})

const sectionComponentSchema = z.enum([
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
])

const sectionSchema = z.object({
  heading: z.string().min(1),
  kind: z.string().optional(),
  component: sectionComponentSchema.optional(),
  // Transaction supporting sections render as accordions; `open: true` makes
  // one render expanded on load (e.g. the report pages' "While you wait" tips).
  open: z.boolean().optional(),
  // Karl's Supporting information block mixes two kinds: Accordion title and
  // text (collapsible, the default here) and Custom section (plain
  // heading+text, no toggle). `flat: true` renders this section as the
  // latter. Orthogonal to `open`, which only has meaning for an accordion.
  flat: z.boolean().optional(),
  karl: z.string().min(1),
  karlGuide: karlGuideSchema.optional(),
  paragraphs: z.array(z.union([z.string(), unverifiedItemSchema])).optional(),
  steps: z.array(stepSchema).optional(),
  bullets: z.array(z.union([z.string(), unverifiedItemSchema])).optional(),
  // Karl's Campaign "Top facts" widget: a repeatable list of labeled facts
  // (Fact title + Fact text), distinct from `bullets` — a plain bullet has
  // no title of its own, and widening `bullets` to carry one would change
  // its shape for every other section type that already uses it.
  facts: z
    .array(
      z.object({
        label: z.string().min(1),
        text: z.string().min(1),
        unverified: z.boolean().optional(),
        unverifiedReason: z.string().optional(),
      })
    )
    .optional(),
  table: z.array(z.array(z.string())).optional(),
  cards: z.array(cardSchema).optional(),
  image: imageSchema.optional(),
  button: z.string().optional(),
  buttonTarget: z.string().optional(),
  buttonUrl: z.string().optional(),
  buttonStyle: z.string().optional(),
  callout: calloutSchema.optional(),
})

const whatToKnowSchema = z.object({
  cost: z.string().optional(),
  thingsToKnow: z
    .array(z.union([z.string(), z.object({ label: z.string().optional(), text: z.string() })]))
    .optional(),
  items: z
    .array(z.union([z.string(), z.object({ label: z.string().optional(), text: z.string() })]))
    .optional(),
})

const contactSchema = z.object({
  address: z.string().optional(),
  phone: z.array(z.string()).optional(),
  email: z.array(z.string()).optional(),
  hours: z.string().optional(),
  other: z.array(z.string()).optional(),
  // Karl's Campaign Contact-us block has a dedicated "Social media / other"
  // sub-stream (Facebook/X/Instagram URLs) alongside Address/Phone/Email —
  // no other content type's Contact-us has this, so it's optional here.
  social: z.array(z.object({ platform: z.string().min(1), url: z.string().min(1) })).optional(),
})

const spotlightSchema = z.object({
  title: z.string().optional(),
  paragraphs: z.array(z.string()).optional(),
  image: imageSchema.optional(),
  button: z.string().optional(),
  buttonTarget: z.string().optional(),
  buttonUrl: z.string().optional(),
  karl: z.string().optional(),
  karlGuide: karlGuideSchema.optional(),
})

const pageSchema = z.object({
  slug: z.string().min(1),
  type: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  audience: z.array(z.string()).min(1),
  reading: z.string().min(1),
  seoTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  primaryCta: z.string().optional(),
  editorNote: z.string().optional(),
  topicTag: z.string().optional(),
  whatToKnow: whatToKnowSchema.optional(),
  // Karl's "Partner agencies" field on a Transaction page — separate from
  // Primary Agency (the parent-program link every non-agency page already
  // renders). These point at real sf.gov department pages outside this
  // mockup's page set, so entries use `url`, never `target`.
  partnerAgencies: z.array(cardSchema).optional(),
  contact: contactSchema.optional(),
  spotlight: spotlightSchema.optional(),
  reportDate: z.string().optional(),
  printVersionUrl: z.string().optional(),
  editorStatus: z.enum(['needs-review', 'blocked', 'placeholder']).optional(),
  // No page-level `karlGuide`. Every other level of this schema has one and
  // js/page-render.js reads all of them — a section's, a card's, a step's, a
  // callout's, an image's, a spotlight's. A PAGE's had exactly one consumer,
  // the hero title tag, and attaching it there was wrong: the eight authored
  // objects all described their page's main CONTENT block (What to Do,
  // Custom section, Spotlight), so the title tag showed confirmed steps for
  // an unrelated Karl block. Removing that read left the field authored,
  // schema-validated, and consumed by nothing — which fails no test, since
  // unread data cannot. There is no natural page-level destination either:
  // js/karl-guide-registry.js's PAGE_TYPE_FIELDS already derives the main
  // content path per type, which is what those objects restated. Re-add this
  // only alongside a reader, not before one.
  sections: z.array(sectionSchema).optional(),
})

const dataSchema = z.object({
  pages: z.record(pageSchema),
  order: z.array(z.tuple([z.string(), z.string()])),
})

module.exports = {
  cardSchema,
  stepSchema,
  sectionSchema,
  pageSchema,
  dataSchema,
  imageSchema,
  calloutSchema,
  whatToKnowSchema,
  contactSchema,
  spotlightSchema,
  karlGuideSchema,
  karlGuideValueSchema,
}
