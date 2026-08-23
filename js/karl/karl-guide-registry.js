/* js/karl/karl-blocks.js is the Karl mapping AUTHORITY; this file is the guide
   panel's presentation layer over it. Everything Karl knows about itself —
   which panels a type has, what they are labelled, how they nest — is
   transcribed there from docs/karl-export-field-map.md and guarded against it
   by tests/karl-blocks.test.js. What lives here is this repo's own vocabulary:
   roles, link shapes, and the steps a reviewer reads.

   A static import rather than the `window.karlBlocks` indirection the other
   consumers use: this module is an ES module in the bundle's own graph, and
   Vite and Bun both resolve the CJS inventory through it. The window global
   stays for js/karl/karl-transcript.js, which is dual-exported and has to work
   under Node with no bundler. */
import { breadcrumbFor, panelByRawName, PROMOTE_PANEL } from './karl-blocks.js'

// Keyed by normalizePageType() OUTPUT, not by the Karl type name — that
// function lowercases and hyphenates, so `type: 'About us'` arrives here as
// `about-us`. These tables read `about` until 2026-08-17, so every About-us
// page missed both lookups: the label silently fell back to the raw type
// string (harmless) and the path resolved to '' (not harmless — a page with
// no explicit karlGuide reported every tag as unmapped). Note this file's
// normalizePageType is NOT js/mockup/page-render.js's same-named function, which
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

/* Which Karl PANEL each role belongs to, keyed by page type and then role.

   This replaced a table of 31 hand-written path strings on 2026-08-17. Nine of
   those had named a level no Karl form has — a raw Wagtail field name promoted
   into the navigation path, or another type's vocabulary borrowed across — and
   nothing could have caught it, because the strings were this file's own
   invention. js/karl/karl-blocks.js is transcribed from
   docs/karl-export-field-map.md and guarded against it by
   tests/karl-blocks.test.js, so every path now comes from there and drift goes
   red in CI.

   What is left here is the ROLE VOCABULARY, which is this repo's and not
   Karl's: `services`, `what-to-know`, `top-facts` are names js/mockup/page-render.js
   gives to parts of a mockup page. Each entry names the panel that role lands
   in by its RAW field name — unique within a type, unlike the UI label, which
   Agency repeats for its two "Subsection" panels — plus, optionally, the block
   type to choose inside it.

   Paths are shallower than the strings they replace. The inventory records
   PANELS, and several levels the old strings carried (`→ Links`,
   `→ Section content`, `→ Page`) are chooser or field levels the field map
   documents only in prose beneath its tables. That is the trade taken
   deliberately: a shorter path derived from a guarded record beats a longer one
   nothing checks. `blockTypesDoc` carries the chooser contents into the guide's
   steps, so the detail is not lost, only moved out of the breadcrumb. */
const ROLE_PANELS = {
  transaction: {
    content: { rawName: 'section_specifics' },
    body: { rawName: 'supporting_information' },
    supporting: { rawName: 'supporting_information' },
    related: { rawName: 'related' },
    // `cost` and `things_to_know` share the parent grouping "What to Know
    // Before You Start", which is not a panel row and so has no label to
    // derive. buildSteps() names both fields underneath.
    'what-to-know': { rawName: 'cost' },
    contact: { rawName: 'get_help' },
    'partner-agencies': { rawName: 'partner_agencies' },
  },
  information: {
    content: { rawName: 'information_section', within: 'Title and text' },
    body: { rawName: 'information_section', within: 'Title and text' },
    related: { rawName: 'related' },
    'partner-agencies': { rawName: 'partner_agencies' },
    // No Contact us panel on this type — see U22. An absent row resolves to
    // '' and reports as Mockup only, which is the honest answer.
  },
  'resource-collection': {
    content: { rawName: 'body', within: 'Resources' },
    resources: { rawName: 'body', within: 'Resources' },
    body: { rawName: 'introductory_text' },
    'partner-agencies': { rawName: 'partner_agencies' },
  },
  campaign: {
    content: { rawName: 'additional_content', within: 'Accordion section' },
    body: { rawName: 'additional_content', within: 'Accordion section' },
    spotlight: { rawName: 'spotlight_1' },
    related: { rawName: 'related_links' },
    'top-facts': { rawName: 'facts_title + fact_items' },
    contact: { rawName: 'contact' },
    'partner-agencies': { rawName: 'partner_agencies' },
  },
  topic: {
    content: { rawName: 'content_fields', within: 'Content' },
    body: { rawName: 'content_fields', within: 'Content' },
    services: { rawName: 'content_fields', within: 'Services' },
    resources: { rawName: 'content_fields', within: 'Resources' },
    spotlight: { rawName: 'content_fields', within: 'Spotlight' },
    'partner-agencies': { rawName: 'partner_agencies' },
  },
  agency: {
    content: { rawName: 'about_description' },
    body: { rawName: 'about_description' },
    services: { rawName: 'services' },
    resources: { rawName: 'resources' },
    spotlight: { rawName: 'spotlight_1' },
    contact: { rawName: 'contact' },
    'partner-agencies': { rawName: 'partner_agencies' },
  },
  'about-us': {
    content: { rawName: 'about_info', within: 'Custom section' },
    body: { rawName: 'about_info', within: 'Custom section' },
    resources: { rawName: 'resources', within: 'Resources section' },
  },
  report: {
    content: { rawName: 'content', within: 'Body' },
    body: { rawName: 'content', within: 'Body' },
    table: { rawName: 'content', within: 'Table' },
    spotlight: { rawName: 'spotlight' },
    'partner-agencies': { rawName: 'partner_agencies' },
  },
}

/* Page metadata, which resolves through the inventory like everything else.
   Karl labels the title field differently per type — "Page title" on
   Transaction, "Title" on Campaign and Agency — so a single shared string, as
   META_FIELDS used to hold, was wrong on half the corpus. `slug`, `seoTitle`
   and `metaDescription` live on the Promote tab and come from
   PROMOTE_PANEL. */
const META_PANELS = {
  title: { rawName: 'title' },
  description: { rawName: 'description' },
}

/* Where a Button link nested inside another component lives, keyed
   `<pageType>.<hostRole>`. A button is not a field of its own: it is a link
   shape (shape 2) that appears INSIDE a host block, and the host is what
   decides the path. The `button-link` branch in resolvePath() used to answer
   with the page type's generic `content` path plus a literal
   `'Content → Button link'` fallback — a level that exists on no form — so a
   Campaign Spotlight's CTA was routed to Additional content → Accordion
   section and stamped E1 confirmed.

   Only hosts the field map attests a nested Button link for are listed. A
   button in any other host resolves to '' and reports as unmapped, which is
   also what `U1` already says about the twelve section-level buttons that sit
   outside a step or a spotlight. */
const BUTTON_HOSTS = {
  'transaction.what-to-do': { rawName: 'section_specifics', within: 'Button link' },
  'transaction.content': { rawName: 'section_specifics', within: 'Button link' },
  'campaign.spotlight': { rawName: 'spotlight_1', within: 'Button link' },
  'agency.spotlight': { rawName: 'spotlight_1', within: 'Button link' },
  'topic.spotlight': { rawName: 'content_fields', within: 'Spotlight → Button link' },
  'report.spotlight': { rawName: 'spotlight', within: 'Button link' },
}

/* Rows this repo CHOSE rather than measured, keyed `<pageType>.<role>`.

   A guide built on one of these reports `status: 'inferred'` and `evidence: 'U'`
   instead of "E1 confirmed", and carries an extra step telling the editor to
   confirm the destination. That distinction is the whole point of the 2026-08-17
   audit: the failure this feature keeps producing is not a wrong path, it is a
   path indistinguishable from a measured one.

   Deleting the row instead was the alternative and was rejected for the same
   reason js/karl/karl-blocks.js prints its one inferred mapping rather than dropping
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

// Roles that name a destination ROLE_PANELS already records under a different
// word. An alias table rather than duplicate entries per type, so ROLE_PANELS
// stays one row per real Karl panel.
const ROLE_ALIASES = {
  'what-to-do': 'content',
  intro: 'body',
  callout: 'content',
  // `'top-facts': 'body'` was removed on 2026-08-17. It is a real Karl panel on
  // Campaign (`facts_title` + `fact_items`) and has a row of its own now; on
  // every other type it has no destination, and '' is the correct answer there
  // rather than the body stream.
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

/* Style advice this repo's record actually supports, keyed by link shape.

   **Guidance and schema are different claims and this table keeps them apart
   in the data, not just in the CSS.** docs/karl-export-field-map.md's obsolete
   register entry O14 records the live `Button link` text field at
   `maxlength="255"`, measured 2026-08-15 on a Transaction `section_specifics`
   block, and records the Help Center's "can only be 25 characters" as style
   guidance rather than a schema limit. U19 records ten mockup labels shortened
   on that guidance — on advice, not on constraint.

   Printing 25 as a limit would be a measured-looking falsehood in the one panel
   whose whole job is separating a measured destination from a chosen one, which
   is the same failure guideStatusLabel() checks `inferred` before the evidence
   line to avoid.

   **One entry, and add another only when the field map records one** — exactly
   the rule stated on UNRESOLVED above. This is a display string, not a second
   record of a measurement. */
const FIELD_GUIDANCE = {
  'button-link': {
    text: 'Use no more than 25 characters of link text — Karl Help Center style guidance.',
    schema: 'The field itself accepts 255 (measured 2026-08-15).',
  },
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
  // **Unresolved wins over every other signal, including an authored path.**
  // resolvePath() already returns '' for an unresolved context, but an explicit
  // `guide.path` bypassed it, and `explicit.evidence`/`explicit.status` were
  // taken verbatim below — so a guide carrying both an unresolvedId and a path
  // rendered as "E1 confirmed" while naming a destination this repo has openly
  // recorded as unknown. build_scripts/schema.js rejects that combination at
  // validation time; this is the same rule at render time, because the registry
  // also serves contexts assembled at runtime by page-render.js, which the
  // schema never sees.
  const unresolvedId = guideContext.unresolvedId
  const isUnresolved = Boolean(unresolvedId) && Boolean(UNRESOLVED[unresolvedId])
  // The reference is resolved once and the path formatted from it, so the field
  // block below cannot name a different destination than the breadcrumb does.
  const ref = isUnresolved || explicit.path ? null : resolveFieldRef(pageType, role, guideContext)
  const path = isUnresolved ? '' : explicit.path || resolvePath(pageType, role, guideContext)
  // Only a DERIVED path can be inferred. An explicitly authored `guide.path`
  // carries its own evidence and status and is not second-guessed here — and
  // for the same reason it carries no derived field block, which would claim a
  // destination the author did not name.
  const inferred = !explicit.path && Boolean(path) && isInferredPath(pageType, role)
  const resolvedValues = explicit.values || values
  const result = {
    ...explicit,
    path,
    steps:
      Array.isArray(explicit.steps) && explicit.steps.length
        ? explicit.steps
        : buildSteps(pageType, role, guideContext, path, inferred),
    evidence: isUnresolved ? 'U' : explicit.evidence || (inferred || !path ? 'U' : 'E1'),
    field: explicit.field || fieldMetaFor(ref),
    guidance: explicit.guidance || FIELD_GUIDANCE[guideContext.linkShape],
    status: isUnresolved
      ? 'unresolved'
      : explicit.status || (inferred ? 'inferred' : path ? 'confirmed' : 'mockup-only'),
    values: resolvedValues.length ? resolvedValues : undefined,
  }
  if (explicit.unresolvedId && !UNRESOLVED[explicit.unresolvedId]) {
    delete result.unresolvedId
  }
  return result
}

/**
 * Resolve WHICH Karl field a tag belongs to, as a reference rather than a
 * formatted string.
 *
 * resolvePath() used to do this lookup and keep only the breadcrumb, throwing
 * away the panel object — which carries the raw Wagtail name, the
 * required/repeatable wording and the block-type chooser contents that
 * js/karl/karl-blocks.js transcribes from the field map. The guide panel needs
 * those, and re-deriving them at the call site would be a second lookup free to
 * disagree with this one.
 *
 * The null case is symmetric with resolvePath()'s '': an unresolved context,
 * an unknown page type, and a role naming no panel all return null here and ''
 * there. The non-null case is NOT symmetric, and that asymmetry is
 * deliberate rather than a gap to close. A `kind: 'panel'` ref only records
 * that SOME lookup table (META_PANELS, ROLE_PANELS, BUTTON_HOSTS, …) named a
 * rawName for this role — it does not confirm that rawName resolves to a
 * real panel in this karlType's inventory. resolvePath() makes that second
 * check itself, by handing the ref to panelByRawName()/breadcrumbFor() and
 * printing '' when the lookup misses. A caller holding a `kind: 'panel'` ref
 * must re-run that same check with panelByRawName() before treating the ref
 * as a confirmed destination — concretely, `resolveFieldRef('campaign',
 * 'description', {})` returns a non-null ref naming rawName 'description',
 * because META_PANELS.description is type-agnostic, but Campaign, About us
 * and Report carry no 'description' panel in the field-map transcription
 * (only Transaction, Information, Topic, Agency and Resource Collection do),
 * so resolvePath() for that same call correctly returns ''. Skipping the
 * re-check would stamp `description` as an E1-confirmed Karl destination on
 * three page types where no such field exists — the exact "measured answer
 * that was never measured" failure this guide exists to prevent. This
 * asymmetry, including the description/Campaign case, is pinned in
 * tests/karl-guide.test.js.
 *
 * @param {string} pageType normalizePageType() output, e.g. 'about-us'.
 * @param {string} role Section/field role, or the tag kind when the call site
 *   supplied no role.
 * @param {{unresolvedId?: string, linkShape?: string}} context Guide context.
 * @returns {{kind: 'panel', karlType: string, rawName: string, within: string|undefined}
 *   |{kind: 'promote', field: object}|null} The reference, or null when none is recorded.
 */
function resolveFieldRef(pageType, role, context) {
  if (context.unresolvedId) return null
  const karlType = PAGE_TYPE_LABELS[pageType]
  if (!karlType) return null
  const panelRef = (ref) =>
    ref ? { kind: 'panel', karlType, rawName: ref.rawName, within: ref.within } : null

  if (META_PANELS[role]) return panelRef(META_PANELS[role])
  const promote = PROMOTE_PANEL.fields.find((field) => field.path === role)
  if (promote) return { kind: 'promote', field: promote }

  if (context.linkShape === 'button-link') return panelRef(BUTTON_HOSTS[`${pageType}.${role}`])
  if (context.linkShape === 'campaign-related') return panelRef(ROLE_PANELS.campaign.related)

  const roles = ROLE_PANELS[pageType]
  if (context.linkShape === 'page-reference') {
    if (role === 'related') return panelRef(roles?.related)
    return panelRef(roles?.[ROLE_ALIASES[role] || role])
  }
  if (role === 'image') {
    return pageType === 'information'
      ? panelRef({ rawName: 'information_section', within: 'Image' })
      : null
  }
  if (NON_FIELD_ROLES.has(role)) return null
  return panelRef(roles?.[ROLE_ALIASES[role] || role])
}

/**
 * The display facts for one field reference: raw Wagtail name, UI label, and
 * the required/repeatable/block-type wording the field map records.
 *
 * **Every value is a string, and the `*Doc` strings are preferred over the
 * booleans beside them.** js/karl/karl-blocks.js carries both — `required:
 * false` alongside `requiredDoc: 'not recorded'` — and they make different
 * claims. The boolean is this repo's coercion of an absent measurement into a
 * default; the string is what docs/karl-export-field-map.md actually says.
 * Rendering "Optional" from the boolean would tell a reviewer the live form was
 * measured and found to permit an empty value, which nobody measured. Same
 * posture as resolvePath() returning '' rather than guessing.
 *
 * @param {object|null} ref A resolveFieldRef() result.
 * @returns {{rawName: string, uiLabel: string, required: string, repeatable: string,
 *   blockTypes: string}|undefined} Undefined when there is nothing to show.
 */
function fieldMetaFor(ref) {
  if (!ref) return undefined
  if (ref.kind === 'promote') {
    return {
      rawName: ref.field.rawName,
      uiLabel: ref.field.label,
      required: ref.field.required ? 'yes' : 'no',
      repeatable: 'single',
      blockTypes: '',
    }
  }
  const panel = panelByRawName(ref.karlType, ref.rawName)
  if (!panel) return undefined
  return {
    rawName: panel.rawName,
    uiLabel: panel.uiLabel,
    required: panel.requiredDoc || 'not recorded',
    repeatable: panel.repeatableDoc || '',
    blockTypes: panel.blockTypesDoc || '',
  }
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
 * posture as js/karl/karl-transcript.js, where a section the card-inheritance
 * classifier returns `unknown` for is FLAGged rather than given a guessed
 * instruction a human then executes.
 *
 * Implemented over resolveFieldRef(); see that function for the reference shape.
 *
 * @param {string} pageType normalizePageType() output, e.g. 'about-us'.
 * @param {string} role Section/field role, or the tag kind when the call site
 *   supplied no role.
 * @param {{unresolvedId?: string, linkShape?: string}} context Guide context.
 * @returns {string} A Karl path, or '' when none is recorded.
 */
function resolvePath(pageType, role, context) {
  const ref = resolveFieldRef(pageType, role, context)
  if (!ref) return ''
  if (ref.kind === 'promote') return `${PROMOTE_PANEL.uiLabel} → ${ref.field.label}`
  return breadcrumbFor(ref.karlType, panelByRawName(ref.karlType, ref.rawName), ref.within)
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
  if (role === 'title')
    steps.push(
      `Set the page URL on the Promote tab: ${PROMOTE_PANEL.uiLabel} → ${PROMOTE_PANEL.fields[0].label}.`
    )
  if (role === 'table')
    steps.push(
      'Choose the table header option, enter Description and Caption, then add rich-text columns.'
    )
  if (role === 'spotlight')
    steps.push(
      'Choose image alignment and position, then add the optional Button link if the visible CTA is approved.'
    )
  // The path stops at the parent grouping because the mockup's whatToKnow
  // renders both halves; these name which field each half goes in.
  if (path && (ROLE_ALIASES[role] || role) === 'what-to-know')
    steps.push(
      'Cost is a required radio ending in a 120-character Cost description; each Things to Know entry is a Title plus rich text.'
    )
  if (path && (ROLE_ALIASES[role] || role) === 'top-facts')
    steps.push('Enter the section heading as Facts title, then add one Fact item per fact.')
  if (path && (ROLE_ALIASES[role] || role) === 'contact')
    steps.push('Add one block per detail: Address, Phone number, Email, or Additional info.')
  if (path && (ROLE_ALIASES[role] || role) === 'partner-agencies')
    steps.push('This is a page chooser restricted to Agency pages — it takes no free text or URL.')
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
  BUTTON_HOSTS,
  FIELD_GUIDANCE,
  INFERRED_PATHS,
  LINK_SHAPES,
  META_PANELS,
  ROLE_PANELS,
  PAGE_TYPE_LABELS,
  UNRESOLVED,
  fieldMetaFor,
  guideForContext,
  linkShapeMeta,
  normalizePageType,
  pageTypeLabel,
  resolveFieldRef,
  unresolvedDescription,
}
