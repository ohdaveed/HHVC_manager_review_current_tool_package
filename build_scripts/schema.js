// Zod schema for the HHVC page data model, shared by build_scripts/validate.js
// and tests/data-validation.test.js so the schema itself has test coverage
// independent of whatever the current pages/*.js content happens to be.
const { z } = require('zod')

const cardSchema = z.object({
  title: z.string().min(1),
  text: z.string().min(1).optional(),
  target: z.string().optional(),
  url: z.string().optional(),
  karl: z.string().optional(),
  fileType: z.string().optional(),
})

const resourceSchema = z.object({
  title: z.string().min(1),
  text: z.string().min(1),
  target: z.string().optional(),
  url: z.string().optional(),
  karl: z.string().optional(),
})

const resourceGroupSchema = z.object({
  subheader: z.string().optional(),
  items: z.array(resourceSchema).min(1),
})

const dataStorySchema = z.object({
  title: z.string().min(1),
  text: z.string().min(1),
  target: z.string().optional(),
  url: z.string().optional(),
  karl: z.string().optional(),
})

const documentSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  date: z.string().optional(),
  url: z.string().min(1),
  karl: z.string().optional(),
})

const accordionSchema = z.object({
  title: z.string().min(1),
  text: z.array(z.string()).optional(),
  bullets: z.array(z.string()).optional(),
  karl: z.string().optional(),
})

const imageSchema = z.object({
  src: z.string().min(1),
  alt: z.string().min(1),
  caption: z.string().optional(),
  karl: z.string().optional(),
})

const contactSectionSchema = z.object({
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  karl: z.string().optional(),
})

const partnerAgencySchema = z.object({
  name: z.string().min(1),
  url: z.string().optional(),
  karl: z.string().optional(),
})

const whatToKnowSchema = z.object({
  cost: z.string().optional(),
  thingsToKnow: z.array(z.string()).optional(),
})

const spotlightSchema = z.object({
  title: z.string().optional(),
  text: z.string().min(1).optional(),
  paragraphs: z.array(z.string()).optional(),
  image: imageSchema.optional(),
  imageAlt: z.string().optional(),
  url: z.string().optional(),
  button: z.string().optional(),
  buttonTarget: z.string().optional(),
  buttonUrl: z.string().optional(),
  karl: z.string().optional(),
})

const logoSchema = z.object({
  src: z.string().min(1),
  alt: z.string().min(1),
})

const partOfSchema = z.object({
  title: z.string().min(1),
  target: z.string().min(1),
})

const stepSchema = z.object({
  title: z.string().min(1),
  text: z.array(z.string()).optional(),
  bullets: z.array(z.string()).optional(),
  cards: z.array(cardSchema).optional(),
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
  resources: z.array(resourceSchema).optional(),
  resourceGroups: z.array(resourceGroupSchema).optional(),
  dataStories: z.array(dataStorySchema).optional(),
  accordions: z.array(accordionSchema).optional(),
  image: imageSchema.optional(),
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
  documents: z.array(documentSchema).optional(),
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
  whatToKnow: whatToKnowSchema.optional(),
  topFacts: z.array(z.string()).optional(),
  spotlight: spotlightSchema.optional(),
  spotlight2: spotlightSchema.optional(),
  logo: logoSchema.optional(),
  colorTheme: z.string().optional(),
  about: z.string().optional(),
  intro: z.string().optional(),
  partOf: partOfSchema.optional(),
  topicTag: z.string().optional(),
  customSection: z.string().optional(),
  contactSection: contactSectionSchema.optional(),
  partnerAgencies: z.array(partnerAgencySchema).optional(),
  printVersionUrl: z.string().optional(),
  sections: z.array(sectionSchema).optional(),
})

const dataSchema = z.object({
  pages: z.record(pageSchema),
  order: z.array(z.tuple([z.string(), z.string()])),
})

module.exports = {
  cardSchema,
  resourceSchema,
  resourceGroupSchema,
  dataStorySchema,
  documentSchema,
  accordionSchema,
  imageSchema,
  contactSectionSchema,
  partnerAgencySchema,
  stepSchema,
  sectionSchema,
  pageSchema,
  dataSchema,
  whatToKnowSchema,
  spotlightSchema,
  logoSchema,
  partOfSchema,
}
