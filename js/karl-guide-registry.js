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

const PAGE_TYPE_FIELDS = {
  transaction: {
    content: 'Content → What to Do → Section → Section specifics',
    body: 'Content → Supporting information → Accordion title and text',
    supporting: 'Content → Supporting information → Accordion title and text',
    custom: 'Content → Custom Section → Title and text',
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
    content: 'Content → Additional content → Accordion section',
    body: 'Content → Additional content → Accordion section',
    spotlight: 'Content → Spotlight 1 or Spotlight 2 → Spotlight',
    related: 'Content → Related → Page block',
  },
  topic: {
    content: 'Content → Child topics → Content → Section content',
    body: 'Content → Child topics → Content → Section content → Text',
    services: 'Content → Child topics → Services → Links',
    resources: 'Content → Child topics → Resources → Links',
    spotlight: 'Content → Child topics → Spotlight → Spotlight',
  },
  agency: {
    content: 'Content → About → About description',
    body: 'Content → About → About description',
    services: 'Content → Section title 1 → Subsection → Links',
    resources: 'Content → Section title 2 → Subsection → Links',
  },
  'about-us': {
    content: 'Content → Information → Custom section',
    body: 'Content → Information → Custom section',
    resources: 'Content → Resources → Resources section → Links',
  },
  report: {
    content: 'Content → Content → Body',
    body: 'Content → Content → Body',
    table: 'Content → Content → Table',
    spotlight: 'Content → Spotlight → Spotlight',
  },
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

const UNRESOLVED = {
  U1: 'This visible button has no verified destination outside Karl’s documented button slot.',
  U2: 'Karl Callout has no separate title field; fold the title into the rich text or get a CMS decision.',
  U3: 'Step-shaped content on Information needs a content decision before a Karl path is chosen.',
  U4: 'Services/Resources has no intro paragraph field without an additional nested Text block.',
  U5: 'This Related panel has no verified field on this page type.',
  U6: 'Primary agency is required in Karl but has no mockup field; supply it at build time.',
  U20: 'This Agency subsection has visible intro prose with no verified destination field.',
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
  const resolvedValues = explicit.values || values
  const result = {
    ...explicit,
    path,
    steps:
      Array.isArray(explicit.steps) && explicit.steps.length
        ? explicit.steps
        : buildSteps(pageType, role, guideContext, path),
    evidence: explicit.evidence || (path ? 'E1' : 'U'),
    status:
      explicit.status ||
      (explicit.unresolvedId ? 'unresolved' : path ? 'confirmed' : 'mockup-only'),
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

function buildSteps(pageType, role, context, path) {
  if (context.unresolvedId)
    return [UNRESOLVED[context.unresolvedId] || 'Resolve this CMS mapping before publishing.']
  const type = pageTypeLabel(pageType)
  const steps = [`Open Karl admin → Pages → Add child page → ${type}.`]
  if (path) steps.push(`Open Content and follow: ${path}.`)
  else steps.push('Keep this value in the mockup review record; no verified Karl field is shown.')
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
