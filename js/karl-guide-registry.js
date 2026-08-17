const PAGE_TYPE_LABELS = {
  transaction: 'Transaction',
  information: 'Information',
  'resource-collection': 'Resource Collection',
  campaign: 'Campaign',
  topic: 'Topic',
  agency: 'Agency',
  about: 'About us',
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
  about: {
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

function resolvePath(pageType, role, context) {
  if (context.unresolvedId) return ''
  if (context.linkShape === 'button-link')
    return PAGE_TYPE_FIELDS[pageType]?.content || 'Content → Button link'
  if (context.linkShape === 'campaign-related') return PAGE_TYPE_FIELDS.campaign.related
  if (context.linkShape === 'page-reference') {
    if (role === 'related') return PAGE_TYPE_FIELDS[pageType]?.related || ''
    return PAGE_TYPE_FIELDS[pageType]?.[role] || PAGE_TYPE_FIELDS[pageType]?.content || ''
  }
  if (role === 'table') return PAGE_TYPE_FIELDS[pageType]?.table || ''
  if (role === 'spotlight') return PAGE_TYPE_FIELDS[pageType]?.spotlight || ''
  if (role === 'services' || role === 'resources') return PAGE_TYPE_FIELDS[pageType]?.[role] || ''
  if (role === 'related') return PAGE_TYPE_FIELDS[pageType]?.related || ''
  if (role === 'image')
    return pageType === 'information' ? 'Content → Information section → Image' : ''
  if (role === 'callout') return PAGE_TYPE_FIELDS[pageType]?.content || ''
  return PAGE_TYPE_FIELDS[pageType]?.[role] || PAGE_TYPE_FIELDS[pageType]?.body || ''
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
  PAGE_TYPE_FIELDS,
  PAGE_TYPE_LABELS,
  UNRESOLVED,
  guideForContext,
  linkShapeMeta,
  normalizePageType,
  pageTypeLabel,
  unresolvedDescription,
}
