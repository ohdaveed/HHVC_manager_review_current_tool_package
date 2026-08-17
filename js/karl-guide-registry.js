// Keyed by normalizePageType() OUTPUT, not by the Karl type name — that
// function lowercases and hyphenates, so `type: 'About us'` arrives here as
// `about-us`. These tables read `about` until 2026-08-17, so every About-us
// page missed both lookups: the label silently fell back to the raw type
// string (harmless) and the path resolved to '' (not harmless — a page with
// no explicit karlGuide reported every tag as unmapped). Note this file's
// normalizePageType is NOT js/page-render.js's same-named function, which
// maps the same input to `about`; the two are independent and only the keys
// here follow this one.
const PAGE_TYPE_LABELS = {
  transaction: 'Transaction',
  information: 'Information',
  'resource-collection': 'Resource Collection',
  campaign: 'Campaign',
  topic: 'Topic',
  agency: 'Agency',
  'about-us': 'About us',
  report: 'Report',
}

/* Where each page type's body content goes in Karl, keyed by role.
   Every row was checked against its own `## <Type> — E1` section of
   docs/karl-export-field-map.md on 2026-08-17, because these arrived unverified
   and guideForContext() stamps any non-empty path `evidence: 'E1'` /
   `status: 'confirmed'` — so an unchecked row renders to a reviewer as a
   measurement.

   The rule the audit applied: **a path may name only levels the field map's own
   "Panel / field (UI label)" column attests.** Nine rows failed it the same way,
   by promoting a raw Wagtail field name (`supporting_information`,
   `about_description`) or another type's vocabulary ("Links", which belongs to
   Topic and Resource Collection) into the navigation path an editor is told to
   click through. Each is corrected in place with a comment naming what was
   wrong, rather than silently rewritten.

   One row was DELETED rather than corrected: `transaction.custom`
   ("Content → Custom Section → Title and text") was accurate but unreachable —
   no call site passes `role: 'custom'` and inferSectionRole() never returns it,
   so it was a correct answer to a question nothing asks.

   Two rows are INFERRED rather than measured and now print as such; see
   INFERRED_PATHS. */
const PAGE_TYPE_FIELDS = {
  transaction: {
    content: 'Content → What to Do → Section → Section specifics',
    // The panel's own UI label IS "Accordion title and text"; `supporting_information`
    // is its raw Wagtail name. These two read
    // "Content → Supporting information → Accordion title and text" until the
    // 2026-08-17 audit, which put the raw name in the editor's navigation path as
    // though it were a panel to click through. There is no such level on the form.
    body: 'Content → Accordion title and text',
    supporting: 'Content → Accordion title and text',
    related: 'Content → Related → Page',
  },
  information: {
    content: 'Content → Information section → Title and text',
    body: 'Content → Information section → Title and text',
    related: 'Content → Related → Page',
  },
  'resource-collection': {
    content: 'Content → Body → Resources → Resource section → Links',
    body: 'Content → Introductory text → Title and text',
    resources: 'Content → Body → Resources → Resource section → Links',
  },
  campaign: {
    // INFERRED, and printed as such — see INFERRED_PATHS below. `additional_content`
    // offers five block types (Image with text, Video, Accordion section, Embed,
    // Resources) and the field map picks none of them for a plain heading-plus-prose
    // section. Accordion section is the only one that holds prose, so it is the
    // reasonable choice — but it is this repo's choice, not a measurement.
    content: 'Content → Additional content → Accordion section',
    body: 'Content → Additional content → Accordion section',
    spotlight: 'Content → Spotlight 1 or Spotlight 2 → Spotlight',
    // "Page block" named no field. `related_links` entries carry "Page" * and
    // "Link text" *, so Page is the field an editor lands on.
    related: 'Content → Related → Page',
  },
  topic: {
    content: 'Content → Child topics → Content → Section content',
    body: 'Content → Child topics → Content → Section content → Text',
    services: 'Content → Child topics → Services → Links',
    resources: 'Content → Child topics → Resources → Links',
    spotlight: 'Content → Child topics → Spotlight → Spotlight',
  },
  agency: {
    // The panel is labelled "About"; `about_description` is its raw name, and these
    // two appended it as a field to click into. Its actual children are Call to
    // action, Divisions or subcommittees and Partner agencies.
    content: 'Content → About',
    body: 'Content → About',
    // A Subsection's entries are added straight from its own "+", which offers
    // `SF.gov page` and `External link`. There is no "Links" level on Agency — that
    // label belongs to Topic's Services/Resources blocks and Resource Collection's
    // Resource section, and was carried across. The link shape line beneath the path
    // already names the two entry types, so the path stops where the form does.
    services: 'Content → Section title 1 → Subsection',
    resources: 'Content → Section title 2 → Subsection',
  },
  'about-us': {
    content: 'Content → Information → Custom section',
    body: 'Content → Information → Custom section',
    // Same borrowed "Links" level as Agency above: `Resources section` offers
    // SF.gov page / External link / Downloadable files from its own "+".
    resources: 'Content → Resources → Resources section',
  },
  report: {
    content: 'Content → Content → Body',
    body: 'Content → Content → Body',
    table: 'Content → Content → Table',
    spotlight: 'Content → Spotlight → Spotlight',
  },
}

/* Rows this repo CHOSE rather than measured, keyed `<pageType>.<role>`.

   A guide built on one of these reports `status: 'inferred'` and `evidence: 'U'`
   instead of "E1 confirmed", and carries an extra step telling the editor to
   confirm the destination. That distinction is the whole point of the 2026-08-17
   audit: the failure this feature keeps producing is not a wrong path, it is a
   path indistinguishable from a measured one.

   Deleting the row instead was the alternative and was rejected for the same
   reason js/karl-blocks.js prints its one inferred mapping rather than dropping
   it — a Campaign body section would otherwise report "no verified Karl field",
   which is less true than "Accordion section, verify this". Re-examine when the
   field map records which of `additional_content`'s five block types a plain
   prose section belongs in. */
const INFERRED_PATHS = new Set(['campaign.content', 'campaign.body'])

/**
 * Whether the path resolved for this type/role is one of the inferred rows.
 *
 * Takes the ROLE as passed, then re-applies ROLE_ALIASES, so an aliased role
 * (`what-to-do`, `intro`, `top-facts`, `callout`) is judged on the row it
 * actually reads rather than on its own name.
 *
 * @param {string} pageType normalizePageType() output.
 * @param {string} role Section/field role.
 * @returns {boolean} True when the row was chosen by this repo, not measured.
 */
function isInferredPath(pageType, role) {
  const key = ROLE_ALIASES[role] || role
  return INFERRED_PATHS.has(`${pageType}.${key}`)
}

// Page-level metadata does NOT vary by type, unlike everything in
// PAGE_TYPE_FIELDS: every one of the eight measured types opens its Content
// tab with `Title *` and a single `Description` textarea, and every one has
// the identical Promote tab carrying `slug` (docs/karl-export-field-map.md,
// "The Promote tab — where seoTitle and metaDescription actually go", which
// closed U11 on 2026-08-15 at E1). These are separate from the body stream
// because a guide that routed a page summary into `Content → About → About
// description` — which is what the body fallback did — tells an editor to
// paste approved copy into the wrong field, the one failure this whole
// feature exists to prevent.
const META_FIELDS = {
  title: 'Content → Title',
  description: 'Content → Description',
  slug: 'Promote → For search engines → Slug',
  seoTitle: 'Promote → For search engines → Title tag',
  metaDescription: 'Promote → For search engines → Meta description',
}

// Roles that name a destination PAGE_TYPE_FIELDS already records under a
// different word. An alias table rather than duplicate keys per type, so
// PAGE_TYPE_FIELDS stays one row per real Karl panel.
const ROLE_ALIASES = {
  'what-to-do': 'content',
  intro: 'body',
  'top-facts': 'body',
  callout: 'content',
}

// Not roles at all — these are TAG KINDS leaking through because the call
// site passed no `context.role` and guideForContext falls back to `kind`.
// None of them names a Karl field, and resolving them to the page's body
// path is what let a metadata tag render as "E1 confirmed" while pointing at
// the body stream.
const NON_FIELD_ROLES = new Set(['meta', 'placement', 'editor'])

const LINK_SHAPES = {
  pageReference: {
    key: 'page-reference',
    label: 'Bare page reference',
    description: 'Choose an SF.gov page; Karl supplies the destination title and link.',
  },
  button: {
    key: 'button-link',
    label: 'Button link',
    description: 'Choose an SF.gov page or enter an external URL, then add Link text.',
  },
  resources: {
    key: 'resources-list',
    label: 'Resources links list',
    description:
      'Choose SF.gov page or External link; external entries carry title, URL, and description.',
  },
  campaignRelated: {
    key: 'campaign-related',
    label: 'Campaign related link',
    description: 'Choose a page or external URL and provide Link text.',
  },
  richText: {
    key: 'rich-text-link',
    label: 'Draftail rich-text link',
    description: 'Select text and use Draftail’s Internal link or External link tool.',
  },
}

/* Reader-facing one-liners for the unresolved mappings this renderer actually
   cites. **docs/karl-export-field-map.md's "Unresolved register" is the
   authority**; this is a display string, not a second record of the decision.

   It held seven entries until the 2026-08-17 audit and five of them were dead —
   nothing in js/ or pages/ ever set U3, U4, U5, U6 or U20. Being unused is what
   let two of them go wrong unnoticed: U3 here described step-shaped content on
   INFORMATION, while the register's U3 (status `narrowed`, answered 2026-08-15)
   is about Transaction's `Step by step` type; and U20 had no register row at
   all, that document's register ending at U19. Five restatements nobody read,
   two of them contradicting the document they restate, is the same
   two-copies-free-to-drift problem this whole file has to be careful about.

   Add an entry here when a call site cites the ID, not before, and quote the
   register rather than paraphrasing it. */
const UNRESOLVED = {
  U1: 'This visible button has no verified destination outside Karl’s documented button slot.',
  U2: 'Karl Callout has no separate title field; fold the title into the rich text or get a CMS decision.',
}

function normalizePageType(type) {
  return String(type || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
}

function pageTypeLabel(type) {
  return PAGE_TYPE_LABELS[normalizePageType(type)] || String(type || 'Karl page')
}

function guideForContext({ page, kind = 'body', context = {}, guide = null, values = [] } = {}) {
  const pageType = normalizePageType(page?.type)
  const explicit = guide && typeof guide === 'object' ? guide : {}
  const role = context.role || context.component || kind
  const guideContext = { ...context, unresolvedId: explicit.unresolvedId || context.unresolvedId }
  const path = explicit.path || resolvePath(pageType, role, guideContext)
  // Only a DERIVED path can be inferred. An explicitly authored `guide.path`
  // carries its own evidence and status and is not second-guessed here.
  const inferred = !explicit.path && Boolean(path) && isInferredPath(pageType, role)
  const resolvedValues = explicit.values || values
  const result = {
    ...explicit,
    path,
    steps:
      Array.isArray(explicit.steps) && explicit.steps.length
        ? explicit.steps
        : buildSteps(pageType, role, guideContext, path, inferred),
    evidence: explicit.evidence || (inferred || !path ? 'U' : 'E1'),
    status:
      explicit.status ||
      (explicit.unresolvedId
        ? 'unresolved'
        : inferred
          ? 'inferred'
          : path
            ? 'confirmed'
            : 'mockup-only'),
    values: resolvedValues.length ? resolvedValues : undefined,
  }
  if (explicit.unresolvedId && !UNRESOLVED[explicit.unresolvedId]) {
    delete result.unresolvedId
  }
  return result
}

/**
 * Resolve the Karl field path a tag's guide should print, or '' when this
 * repo has no recorded destination for it.
 *
 * The '' return is the load-bearing case. guideForContext() stamps a guide
 * with `evidence: 'E1'` and `status: 'confirmed'` whenever a path is present,
 * and guideStatusLabel() renders that to the reviewer as "E1 confirmed" — so
 * a guessed path is indistinguishable from a measured one. This function
 * therefore never guesses: an unrecognized role returns '', which reports as
 * "Mockup only" with a step saying no verified Karl field is shown. Same
 * posture as js/karl-transcript.js, where a section the card-inheritance
 * classifier returns `unknown` for is FLAGged rather than given a guessed
 * instruction a human then executes.
 *
 * @param {string} pageType normalizePageType() output, e.g. 'about-us'.
 * @param {string} role Section/field role, or the tag kind when the call site
 *   supplied no role.
 * @param {{unresolvedId?: string, linkShape?: string}} context Guide context.
 * @returns {string} A Karl path, or '' when none is recorded.
 */
function resolvePath(pageType, role, context) {
  if (context.unresolvedId) return ''
  const fields = PAGE_TYPE_FIELDS[pageType]
  // Metadata first: it is type-independent, so it must not fall through to
  // the per-type body tables below.
  if (META_FIELDS[role]) return META_FIELDS[role]
  if (context.linkShape === 'button-link') return fields?.content || 'Content → Button link'
  if (context.linkShape === 'campaign-related') return PAGE_TYPE_FIELDS.campaign.related
  if (context.linkShape === 'page-reference') {
    if (role === 'related') return fields?.related || ''
    return fields?.[role] || fields?.content || ''
  }
  if (role === 'image')
    return pageType === 'information' ? 'Content → Information section → Image' : ''
  if (NON_FIELD_ROLES.has(role)) return ''
  return fields?.[ROLE_ALIASES[role] || role] || ''
}

function buildSteps(pageType, role, context, path, inferred = false) {
  if (context.unresolvedId)
    return [UNRESOLVED[context.unresolvedId] || 'Resolve this CMS mapping before publishing.']
  const type = pageTypeLabel(pageType)
  const steps = [`Open Karl admin → Pages → Add child page → ${type}.`]
  if (path) steps.push(`Open Content and follow: ${path}.`)
  else steps.push('Keep this value in the mockup review record; no verified Karl field is shown.')
  // Stated as its own step rather than folded into the one above, so an editor
  // reading only the numbered list cannot miss that this destination is this
  // repo's reading rather than a measured one.
  if (inferred)
    steps.push(
      'This destination is inferred, not measured — confirm it against the live form before pasting.'
    )
  const link = Object.values(LINK_SHAPES).find((item) => item.key === context.linkShape)
  if (link) steps.push(link.description)
  // The title tag's own copy panel offers Slug alongside Title, and slug is
  // required on every type but lives on a different tab — so the step has to
  // name that tab or the editor cannot save the page from Content alone.
  if (role === 'title') steps.push(`Set the page URL on the Promote tab: ${META_FIELDS.slug}.`)
  if (role === 'table')
    steps.push(
      'Choose the table header option, enter Description and Caption, then add rich-text columns.'
    )
  if (role === 'spotlight')
    steps.push(
      'Choose image alignment and position, then add the optional Button link if the visible CTA is approved.'
    )
  if (context.inheritance === 'inherits')
    steps.push('Choose the destination page; Karl publishes its title and summary here.')
  if (context.inheritance === 'title-only')
    steps.push('Choose the destination page; Karl publishes only its title and link here.')
  return steps
}

function unresolvedDescription(id) {
  return UNRESOLVED[id] || 'This mapping is unresolved.'
}

function linkShapeMeta(shape) {
  return Object.values(LINK_SHAPES).find((item) => item.key === shape) || null
}

export {
  INFERRED_PATHS,
  LINK_SHAPES,
  META_FIELDS,
  PAGE_TYPE_FIELDS,
  PAGE_TYPE_LABELS,
  UNRESOLVED,
  guideForContext,
  linkShapeMeta,
  normalizePageType,
  pageTypeLabel,
  unresolvedDescription,
}
