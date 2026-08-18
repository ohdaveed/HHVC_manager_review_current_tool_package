// Zod schema for the HHVC page data model, shared by build_scripts/validate.js
// and tests/data-validation.test.js so the schema itself has test coverage
// independent of whatever the current pages/*.js content happens to be.
const { z } = require('zod')

const karlGuideValueSchema = z.object({
  label: z.string().min(1),
  value: z.string(),
  source: z.enum(['visible', 'inherited', 'mockup-only', 'derived']).optional(),
})

const karlGuideSchema = z
  .object({
    path: z.string().optional(),
    panel: z.string().optional(),
    block: z.string().optional(),
    field: z.string().optional(),
    rawField: z.string().optional(),
    linkShape: z
      .enum([
        'page-reference',
        'button-link',
        'resources-list',
        'campaign-related',
        'rich-text-link',
      ])
      .optional(),
    steps: z.array(z.string().min(1)).min(1),
    evidence: z.enum(['E1', 'E2', 'E3', 'E4', 'U']).optional(),
    // `inferred` is deliberately distinct from `confirmed`: it marks a
    // destination this repo CHOSE where the field map records no answer, and the
    // panel renders it as "Inferred — verify" rather than "E1 confirmed". See
    // INFERRED_PATHS in js/karl/karl-guide-registry.js.
    status: z.enum(['confirmed', 'inferred', 'inherited', 'mockup-only', 'unresolved']).optional(),
    // Shape only — `U` followed by digits. This read
    // `/^U(?:[1-9]|1[0-9]|20)$/` until the Karl transcript work merged, which
    // was a hardcoded CEILING at U20 rather than a validity check, and it was
    // already wrong: `docs/karl-export-field-map.md`'s register had opened
    // U21, U22 and U23, so `js/karl/karl-blocks.js` cited three IDs this schema
    // rejected outright. A bound that has to be edited every time the register
    // grows fails closed against correct data, which is the worst direction
    // for a validator to fail in.
    //
    // Whether an ID is REAL is checked where the register actually lives:
    // `tests/karl-blocks.test.js` asserts every rule names a register ID and
    // cites a real line of that document. Duplicating the range here would be
    // a second copy of the register's bounds, free to drift from it — the
    // problem this file has twice now.
    unresolvedId: z
      .string()
      .regex(/^U\d+$/)
      .optional(),
    values: z.array(karlGuideValueSchema).optional(),
  })
  // **An unresolved mapping may not also claim a destination.** These three
  // fields are what the panel renders as authority — a path is printed as the
  // place to paste approved copy, and `evidence: 'E1'` / `status: 'confirmed'`
  // is what tells a reviewer that placement was MEASURED against the live Karl
  // form. `unresolvedId` says the opposite: that this repo does not know where
  // the value goes. A guide carrying both renders the open question as a
  // settled answer, which is the exact failure this feature exists to prevent,
  // and it renders it in the one place a human editor is most likely to act on
  // it. The registry enforces the same rule at render time
  // (`guideForContext()`), so authored data and derived data cannot disagree;
  // this check is what stops the contradiction being authored in the first
  // place, where the registry could only paper over it.
  .superRefine((guide, ctx) => {
    if (!guide.unresolvedId) return
    for (const [field, invalid] of [
      ['path', Boolean(guide.path)],
      ['status', guide.status && guide.status !== 'unresolved'],
      ['evidence', guide.evidence && guide.evidence !== 'U'],
    ]) {
      if (!invalid) continue
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [field],
        message: `karlGuide.${field} conflicts with unresolvedId ${guide.unresolvedId}: an unresolved mapping must not also carry a path, a confirmed status, or evidence other than 'U'`,
      })
    }
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

/**
 * The Karl content types this corpus declares, in descending order of use
 * (Transaction 14 pages, Information 6, Resource Collection 3, Campaign 2, and
 * one page each of Topic, Agency, About us and Report).
 *
 * This is a closed union rather than an open string because js/karl/karl-blocks.js
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
  // No page-level `karlGuide`. Every level that renders its own tagged block
  // has one and js/page-render.js reads all of them — a section's, a card's, a
  // step's, a callout's, an image's, a spotlight's. (`whatToKnowSchema` and
  // `contactSchema` carry none either: they describe values the page renders
  // through a tag of its own, not blocks with a guide to attach to. The claim
  // here was once "every other level of this schema", which those two make
  // false.) A PAGE's had exactly one consumer,
  // the hero title tag, and attaching it there was wrong: the eight authored
  // objects all described their page's main CONTENT block (What to Do,
  // Custom section, Spotlight), so the title tag showed confirmed steps for
  // an unrelated Karl block. Removing that read left the field authored,
  // schema-validated, and consumed by nothing — which fails no test, since
  // unread data cannot. There is no natural page-level destination either:
  // js/karl/karl-guide-registry.js's PAGE_TYPE_FIELDS already derives the main
  // content path per type, which is what those objects restated. Re-add this
  // only alongside a reader, not before one.
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
  karlGuideSchema,
  karlGuideValueSchema,
}
