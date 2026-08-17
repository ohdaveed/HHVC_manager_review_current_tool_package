// Zod schema for the HHVC page data model, shared by build_scripts/validate.js
// and tests/data-validation.test.js so the schema itself has test coverage
// independent of whatever the current pages/*.js content happens to be.
const { z } = require('zod')

const imageSchema = z.object({
  src: z.string().min(1),
  alt: z.string().min(1),
  karl: z.string().optional(),
  caption: z.string().optional(),
})

const cardSchema = z.object({
  title: z.string().min(1),
  text: z.string().min(1).optional(),
  target: z.string().optional(),
  url: z.string().optional(),
  karl: z.string().optional(),
  fileType: z.string().optional(),
  unverified: z.boolean().optional(),
  unverifiedReason: z.string().optional(),
})

const calloutSchema = z.object({
  text: z.string().min(1),
  karl: z.string().optional(),
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
})

/**
 * The Karl content types this corpus declares, in descending order of use
 * (Transaction 14 pages, Information 6, Resource Collection 3, Campaign 2, and
 * one page each of Topic, Agency, About us and Report).
 *
 * This is a closed union rather than an open string because js/karl-blocks.js
 * keys its per-type Karl panel inventory on this value: an unrecognised type
 * selects no inventory, so a typo would export an EMPTY transcript rather than
 * failing — and an empty transcript reads like a page with no content, not like
 * a bug. Adding a ninth type means capturing its form in
 * docs/karl-export-field-map.md and adding its panel inventory, in that order.
 */
const PAGE_TYPES = [
  'Transaction',
  'Information',
  'Resource Collection',
  'Campaign',
  'Topic',
  'Agency',
  'About us',
  'Report',
]

const pageSchema = z.object({
  slug: z.string().min(1),
  type: z.enum(PAGE_TYPES),
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
  sections: z.array(sectionSchema).optional(),
})

const dataSchema = z.object({
  pages: z.record(pageSchema),
  order: z.array(z.tuple([z.string(), z.string()])),
})

module.exports = {
  PAGE_TYPES,
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
}
