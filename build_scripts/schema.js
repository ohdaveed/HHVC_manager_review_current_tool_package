// Zod schema for the HHVC page data model, shared by build_scripts/validate.js
// and tests/data-validation.test.js so the schema itself has test coverage
// independent of whatever the current pages/*.js content happens to be.
const { z } = require('zod')

const cardSchema = z.object({
  title: z.string().min(1),
  text: z.string().min(1),
  target: z.string().optional(),
  url: z.string().optional(),
  karl: z.string().optional(),
})

const stepSchema = z.object({
  title: z.string().min(1),
  text: z.array(z.string()).optional(),
  bullets: z.array(z.string()).optional(),
  button: z.string().optional(),
  buttonTarget: z.string().optional(),
  buttonUrl: z.string().optional(),
  karl: z.string().optional(),
  callout: z
    .object({
      text: z.string().min(1),
      karl: z.string().optional(),
    })
    .optional(),
})

const sectionSchema = z.object({
  heading: z.string().min(1),
  kind: z.string().optional(),
  karl: z.string().min(1),
  paragraphs: z.array(z.string()).optional(),
  steps: z.array(stepSchema).optional(),
  bullets: z.array(z.string()).optional(),
  table: z.array(z.array(z.string())).optional(),
  cards: z.array(cardSchema).optional(),
  button: z.string().optional(),
  buttonTarget: z.string().optional(),
  buttonUrl: z.string().optional(),
  buttonStyle: z.string().optional(),
  callout: z
    .object({
      text: z.string().min(1),
      karl: z.string().optional(),
    })
    .optional(),
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
  editorStatus: z.enum(['needs-review', 'blocked', 'placeholder']).optional(),
  sections: z.array(sectionSchema).optional(),
})

const dataSchema = z.object({
  pages: z.record(pageSchema),
  order: z.array(z.tuple([z.string(), z.string()])),
})

module.exports = { cardSchema, stepSchema, sectionSchema, pageSchema, dataSchema }
