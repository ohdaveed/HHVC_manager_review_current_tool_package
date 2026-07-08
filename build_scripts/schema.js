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
])

const sectionSchema = z.object({
  heading: z.string().min(1),
  kind: z.string().optional(),
  component: sectionComponentSchema.optional(),
  karl: z.string().min(1),
  paragraphs: z.array(z.union([z.string(), unverifiedItemSchema])).optional(),
  steps: z.array(stepSchema).optional(),
  bullets: z.array(z.union([z.string(), unverifiedItemSchema])).optional(),
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
