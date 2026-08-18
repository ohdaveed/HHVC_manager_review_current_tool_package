/* The Karl transcript builder: turning one reviewed mockup page into a
   field-by-field instruction an editor follows in Karl's own form order.

   Pure. It takes a page object, a review record and the page corpus, and
   returns data — no filesystem, no DOM, no global state — so the Node CLI
   (build_scripts/export-karl-transcript.js) and the browser panel
   (js/karl-transcript-panel.js) share exactly one set of judgements about what
   an editor is told to type. Every such judgement lives here and only here.

   The four outcomes are kept distinct on purpose, because keeping them apart is
   what makes the transcript safe to follow:

     TYPE     — an authored value the editor types.
     CHOOSE   — a page-chooser reference. The editor picks a page and types
                nothing, because the destination page supplies the words.
     UNMAPPED — no documented Karl destination. Emitted loudly, never guessed.
     FLAG     — a value with a known problem to resolve before saving.

   Nothing here writes anywhere. A transcript is an export: it changes what an
   export contains, not what it authorizes, and a human performs every
   keystroke.

   Dual-exported (window.karlTranscript plus module.exports) like
   js/review-merge.js and js/standards/plain-language.js.

   Load-order dependency: reads window.karlBlocks, window.cardInheritance and
   window.utils in the browser branch, so js/main.js must list it after
   js/karl-blocks.js, js/card-inheritance.js and js/utils.js. Under Node it
   require()s all three directly. */

// Resolved the way js/editing/inline-content-edit-data.js resolves its helpers:
// require() under Node, the window namespaces in the browser. Dual-export files
// in this repo take no imports, so this indirection is the idiom rather than a
// workaround — see that file's own note at its foot.
const isNodeContext = typeof module !== 'undefined' && module.exports
const { panelsFor, matchesSection, KARL_NAV, KARL_FLAGS, PROMOTE_PANEL } = isNodeContext
  ? require('./karl-blocks.js')
  : window.karlBlocks
const { classifySection } = isNodeContext
  ? require('./card-inheritance.js')
  : window.cardInheritance
const { getByPath } = isNodeContext ? require('./utils.js') : window.utils

/* The decision labels that mean "signed off", spelled out rather than derived
   from DECISIONS. Deriving them would need a flag on the table in js/utils.js
   that nothing else reads, and the labels are string literals here for the
   reason tests/decision-vocabulary.test.js exists: most of the queue compares
   them as strings, so a renamed decision has to fail somewhere loud. That test
   pins every file spelling an individual label, this one included. */
const APPROVED_DECISIONS = new Set(['Approved', 'Approved with edits'])

/**
 * Mockup fields with no Karl destination and no intention of gaining one
 * (field map lines 796-809). They are excluded from the unmapped sweep rather
 * than reported, because reporting them would bury a real finding under twelve
 * standing ones on every page.
 *
 * `karl` is the most load-bearing entry: it is the instruction ABOUT the
 * migration, so migrating it would be a category error.
 */
const NOT_MIGRATED_PAGE_FIELDS = new Set([
  'audience',
  'reading',
  'editorNote',
  'editorStatus',
  'topicTag',
  'primaryCta',
  'type',
  'slug',
  'seoTitle',
  'metaDescription',
])

/** Section and step fields that carry content an editor has to place somewhere. */
const SECTION_CONTENT_FIELDS = [
  'heading',
  'paragraphs',
  'bullets',
  'table',
  'cards',
  'steps',
  'facts',
  'image',
  'button',
  'buttonUrl',
]

const STEP_CONTENT_FIELDS = ['title', 'text', 'bullets', 'button', 'buttonUrl']

/**
 * The value an editor should type at `path`: the reviewer's edit if there is
 * one, else the authored value from pages/*.js.
 *
 * Overlay precedence is the point of the whole feature — an editor must be
 * typing approved copy, never the draft it superseded.
 *
 * `hasOwnProperty` rather than truthiness, because a reviewer clearing a field
 * to the empty string is a decision and must survive as one. Falling back on
 * falsiness would silently resurrect the copy they deleted, which is the single
 * worst thing this function could do.
 *
 * `edited_title`/`edited_summary` are checked separately because those two live
 * at the top of the review record rather than inside `section_edits` — a split
 * that predates inline editing (see js/editing/inline-content-edit-data.js's header).
 *
 * @param {object} page
 * @param {object|null|undefined} reviewRecord
 * @param {string} path a dotted page path
 * @returns {{value: unknown, overlaid: boolean}}
 */
function resolveValue(page, reviewRecord, path) {
  const edits = reviewRecord && reviewRecord.section_edits
  if (edits && Object.prototype.hasOwnProperty.call(edits, path)) {
    return { value: edits[path], overlaid: true }
  }
  if (path === 'title' && reviewRecord && reviewRecord.edited_title) {
    return { value: reviewRecord.edited_title, overlaid: true }
  }
  if (path === 'summary' && reviewRecord && reviewRecord.edited_summary) {
    return { value: reviewRecord.edited_summary, overlaid: true }
  }
  // `slug` is the third scalar the review layer edits and the only one it
  // stores under a DIFFERENT name: `#urlInput` persists to `record.url_slug`
  // and deliberately never mutates `page.slug`, so reading the page value here
  // reported the authored slug after a reviewer had changed it. That is worse
  // than a stale display — slug is required on the Promote tab of every Karl
  // type, so the transcript was telling an editor to publish the page at the
  // superseded URL. js/ux-improvements-export.js resolves it the same way
  // (`saved.url_slug || page.slug`).
  if (path === 'slug' && reviewRecord && reviewRecord.url_slug) {
    return { value: reviewRecord.url_slug, overlaid: true }
  }
  return { value: getByPath(page, path), overlaid: false }
}

/**
 * The text of one body-copy item, which may be a plain string or the tagged
 * {text, unverified?, unverifiedReason?} object the Unverified pill renders.
 * Only the text reaches Karl; the flag is a review annotation.
 * @param {unknown} item
 * @returns {string}
 */
function itemText(item) {
  if (typeof item === 'string') return item
  if (item && typeof item === 'object' && typeof item.text === 'string') return item.text
  return ''
}

/**
 * One rich-text value from a section's paragraphs and bullets.
 *
 * Karl's Text block renders bullets INSIDE its own rich text rather than as a
 * sibling block (field map line 334), so emitting them as two panels would tell
 * an editor to create a block that does not exist. Document order is paragraphs
 * then bullets, matching how js/page-render.js paints them.
 * @param {Array<string|{text: string}>|undefined} paragraphs
 * @param {Array<string|{text: string}>|undefined} bullets
 * @returns {string}
 */
function foldTextAndBullets(paragraphs, bullets) {
  const prose = (paragraphs || []).map(itemText).filter(Boolean)
  const list = (bullets || []).map(itemText).filter(Boolean)
  const parts = []
  if (prose.length) parts.push(prose.join('\n\n'))
  if (list.length) parts.push(list.map((item) => `- ${item}`).join('\n'))
  return parts.join('\n\n')
}

/**
 * Which of Karl's five link representations a target needs.
 * @param {string} target
 * @param {Record<string, object>} pages
 * @returns {string}
 */
function linkRepresentation(target, pages) {
  if (target === '#') {
    return 'no destination — the mockup uses `#` as an inert sentinel; resolve it before typing'
  }
  if (/^https?:\/\//.test(target)) return 'shape 5 — rich text Link tool → External link'
  const destination = pages && pages[target]
  if (destination) {
    return `shape 5 — rich text Link tool → Internal link → "${destination.title}"`
  }
  return 'unresolved target — neither a page key in this corpus nor an http(s) URL'
}

/**
 * The inline `[label](target)` links inside one rich-text value, each with the
 * Karl representation an editor must use to recreate it.
 *
 * Karl has five distinct link representations and an internal link is a
 * CHOOSER, not text — so pasting a markdown link produces a dead literal on the
 * published page. Surfacing the links separately is what stops that, and naming
 * the representation is what makes the instruction followable rather than a
 * warning the editor has to research.
 * @param {string} text
 * @param {Record<string, object>} pages
 * @returns {Array<{label: string, target: string, representation: string}>}
 */
function extractInlineLinks(text, pages) {
  const links = []
  for (const match of String(text == null ? '' : text).matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
    links.push({
      label: match[1],
      target: match[2],
      representation: linkRepresentation(match[2], pages),
    })
  }
  return links
}

/** A fresh, empty entry for one panel. */
function newEntry(panel, outcome) {
  return {
    uiLabel: panel.uiLabel,
    rawName: panel.rawName,
    docLine: panel.docLine,
    outcome,
    inferred: false,
    fields: [],
    choices: [],
    links: [],
    notes: [],
    overlaid: false,
  }
}

/** Lowercase-hyphenated form of a content type, for a shape identifier. */
function kebab(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * The stable identifier for a class of unmappable content.
 *
 * Exemptions are matched on this rather than on a page key or a section index:
 * an allowlist of paths would let a NEWLY AUTHORED section inherit an old
 * exemption just by landing at the same index, which is the case the validate
 * ratchet exists to catch. The named shapes are the ones the unresolved
 * register already documents; everything else falls through to a derived name
 * so a new class appears with an identifier of its own rather than joining one.
 * @param {string} type
 * @param {object} section
 * @param {string} field
 * @returns {string}
 */
function unmappedShape(type, section, field) {
  if (field === 'button' || field === 'buttonUrl') return 'section-button-outside-step'
  if (field === 'steps' && type === 'Information') return 'information-steps'
  if (field === 'cards' && type === 'Topic') return 'topic-related'
  if (
    (field === 'paragraphs' || field === 'bullets') &&
    type === 'Agency' &&
    (section.component === 'services' || section.component === 'resources')
  ) {
    return 'agency-subsection-paragraphs'
  }
  return `${kebab(type)}-${section.component ? kebab(section.component) : 'no-component'}-${field}`
}

/**
 * Build the transcript for one page.
 *
 * @param {object} page a page object from pages/*.js
 * @param {object|null|undefined} reviewRecord this browser's saved review record
 * @param {Record<string, object>} pages the corpus, for resolving link targets
 * @returns {object} the transcript
 */
function buildTranscript(page, reviewRecord, pages) {
  const type = page && page.type
  const panels = panelsFor(type)
  const transcript = {
    pageKey: findPageKey(page, pages),
    type,
    title: (page && page.title) || '',
    slug: resolveValue(page, reviewRecord, 'slug').value || '',
    navPath: KARL_NAV[type] || '',
    decision: (reviewRecord && reviewRecord.decision) || 'Needs review',
    reviewer: (reviewRecord && reviewRecord.reviewer) || '',
    reviewDate: (reviewRecord && reviewRecord.review_date) || '',
    reviewed: Boolean(reviewRecord),
    // **Both approval outcomes count.** `DECISIONS` in js/utils.js carries
    // `Approved` and `Approved with edits`, and the queue groups them together
    // in its Approved filter and count. An exact match on the first marked
    // every page reviewed through the second as unapproved, so the transcript
    // headed a fully signed-off page "NOT APPROVED — do not publish" and
    // repeated it on every panel. The edits that outcome refers to are already
    // applied here, by resolveValue() above.
    approved: Boolean(reviewRecord && APPROVED_DECISIONS.has(reviewRecord.decision)),
    entries: [],
    consumed: [],
    unmapped: [],
    flags: [],
  }

  if (!panels.length) {
    // Unreachable from real page data — build_scripts/schema.js's `type` union
    // is what makes it so — but a caller passing a hand-built page still
    // deserves a named failure rather than an empty file that reads like a page
    // with no content.
    transcript.entries.push({
      ...newEntry(
        { uiLabel: 'Unknown content type', rawName: String(type), docLine: 0 },
        'UNMAPPED'
      ),
      notes: [`No Karl panel inventory for content type "${type}".`],
    })
    return transcript
  }

  const sections = Array.isArray(page.sections) ? page.sections : []
  // Classified ONCE, and passed everywhere it is needed. Re-deriving it inside
  // a matcher would put a second copy of the card-publishing rule in play, and
  // two copies free to disagree is the exact drift js/card-inheritance.js
  // exists to prevent.
  const classes = sections.map((section) => (section.cards ? classifySection(section) : null))
  const consumed = new Set()
  const context = { page, reviewRecord, pages, sections, classes, consumed, transcript, type }

  for (const panel of panels) {
    // Sub-panels (Transaction's Section title and Section specifics) are fields
    // of the block their parent emits, not panels an editor visits on their
    // own. Emitting them separately would tell an editor to fill a field that
    // only exists inside a block they have already filled.
    if (panel.subPanelOf) continue
    const sources = Array.isArray(panel.source) ? panel.source : [panel.source]
    emitPanelSources(context, panel, sources)
  }

  emitPromoteTab(context)
  sweepUnconsumed(context)

  transcript.consumed = [...consumed].sort()
  return transcript
}

/** The corpus key for a page object, or '' when it is not in the corpus. */
function findPageKey(page, pages) {
  for (const [key, candidate] of Object.entries(pages || {})) {
    if (candidate === page) return key
  }
  return ''
}

/**
 * Emit one panel from all of its sources.
 *
 * A panel's section sources are unioned and DEDUPED BY SECTION INDEX before
 * anything is emitted. Several panels legitimately carry two sources that
 * overlap — Information's `related` matches both `component: 'related'` and any
 * `title-only` card section, and a Related panel is usually both — and emitting
 * per source produced two identical "Related [CHOOSE]" blocks telling an editor
 * to add the same three page references twice. The first matching source wins,
 * which is why the documented predicate is listed ahead of the inferred one.
 *
 * Neither existing ratchet could see this: `consumed` is a Set, so a double
 * emission is invisible to the unmapped sweep, and both gates are about
 * UNDER-coverage. tests/data-validation.test.js now asserts the over-coverage
 * half against the real corpus.
 * @param {object} context
 * @param {object} panel
 * @param {object[]} sources
 */
function emitPanelSources(context, panel, sources) {
  const bySectionIndex = new Map()
  for (const source of sources) {
    if (!source || source.kind !== 'sections') {
      emitPanel(context, panel, source)
      continue
    }
    for (const index of matchedSectionIndexes(context, source)) {
      if (!bySectionIndex.has(index)) bySectionIndex.set(index, source)
    }
  }
  for (const index of [...bySectionIndex.keys()].sort((a, b) => a - b)) {
    const source = bySectionIndex.get(index)
    const section = context.sections[index]
    if (source.field) emitSectionField(context, panel, source, section, index)
    else emitSection(context, panel, source, section, index)
  }
}

/** Dispatch one non-section panel/source pair to the right emitter. */
function emitPanel(context, panel, source) {
  if (!source || source.kind === 'none') return emitEmptyPanel(context, panel)
  if (source.kind === 'path') return emitPathPanel(context, panel, source)
}

/**
 * The indexes of the sections one `sections` source selects, in document order.
 * @param {object} context
 * @param {object} source
 * @returns {number[]}
 */
function matchedSectionIndexes(context, source) {
  const matched = context.sections
    .map((section, index) => ({ section, index }))
    .filter(({ section, index }) => matchesSection(source.match, section, context.classes[index]))
  if (typeof source.nth === 'number') {
    return matched[source.nth] ? [matched[source.nth].index] : []
  }
  return matched.map(({ index }) => index)
}

/**
 * A panel with no mockup source. Emitted only when an editor has to act on it
 * anyway — because Karl requires it, or because the field map records something
 * about it worth knowing (a disabled field, a chooser whose mockup values are
 * the wrong kind of thing). Emitting all of them would run Agency to 25 panels
 * of which 16 say nothing.
 */
function emitEmptyPanel(context, panel) {
  if (!panel.required && !panel.note) return
  const entry = newEntry(panel, panel.required ? 'FLAG' : 'TYPE')
  entry.notes.push(
    panel.note ||
      'Required by Karl, and this tool holds no value for it — supply it by hand before saving.'
  )
  context.transcript.entries.push(entry)
}

/** A panel whose source is a dotted page path. */
function emitPathPanel(context, panel, source) {
  const paths = [source.path, ...(source.altPaths || [])]
  let resolved = null
  let usedPath = source.path
  for (const path of paths) {
    const candidate = resolveValue(context.page, context.reviewRecord, path)
    if (candidate.value !== undefined && candidate.value !== null && candidate.value !== '') {
      resolved = candidate
      usedPath = path
      break
    }
    if (!resolved) resolved = candidate
  }
  paths.forEach((path) => context.consumed.add(path))

  const value = resolved ? resolved.value : undefined
  if (value === undefined || value === null || value === '') return emitEmptyPanel(context, panel)

  const entry = newEntry(panel, 'TYPE')
  entry.overlaid = Boolean(resolved.overlaid)
  if (panel.note) entry.notes.push(panel.note)

  if (usedPath === 'whatToKnow.cost') {
    entry.fields.push({ label: 'Cost description', value: String(value) })
    const length = String(value).length
    if (length > KARL_FLAGS.costDescriptionMaxChars) {
      // Measured on the OVERLAID value, never the authored one: a reviewer can
      // push a short value over the cap and pull a long one under it, so
      // measuring the original reports the wrong page in both directions.
      entry.outcome = 'FLAG'
      entry.notes.push(
        `Cost description is ${length} characters; Karl caps this field at ${KARL_FLAGS.costDescriptionMaxChars}. Shorten it before typing.`
      )
    }
    entry.notes.push(
      'Choose the Cost radio first (Free, Flat fee, Range, Minimum and up, None) — all five variants end at this same description field.'
    )
    collectLinks(context, entry, String(value))
    context.transcript.entries.push(entry)
    return
  }

  if (usedPath === 'partnerAgencies') {
    entry.outcome = 'CHOOSE'
    entry.notes.push(
      'A page chooser restricted to Agency pages. These entries name real sf.gov department pages outside this mockup, so search Karl for each by title.'
    )
    for (const card of value) {
      entry.choices.push({ label: card.title, pageKey: '', slug: card.url || '' })
    }
    context.transcript.entries.push(entry)
    return
  }

  if (usedPath === 'contact') {
    emitContact(context, entry, value)
    return
  }

  if (usedPath === 'spotlight') {
    emitSpotlightValue(context, entry, value, 'spotlight')
    return
  }

  if (Array.isArray(value)) {
    // things_to_know: one repeated Title-and-text block per item. An item may
    // carry its own label or be a bare string, and Karl's Title field is plain
    // text with no toolbar even though its sibling Text field is rich.
    value.forEach((item, index) => {
      const label = item && typeof item === 'object' && item.label ? item.label : ''
      const text = itemText(item)
      entry.fields.push({ label: `Block ${index + 1} — Title`, value: label })
      entry.fields.push({ label: `Block ${index + 1} — Text`, value: text })
      collectLinks(context, entry, text)
    })
    context.transcript.entries.push(entry)
    return
  }

  entry.fields.push({ label: panel.uiLabel, value: String(value) })
  collectLinks(context, entry, String(value))
  context.transcript.entries.push(entry)
}

/** Karl's Contact us block and its four sub-streams. */
function emitContact(context, entry, contact) {
  const push = (label, value) => {
    if (value) entry.fields.push({ label, value })
  }
  push('Address (snippet chooser)', contact.address)
  for (const phone of contact.phone || []) push('Phone number', phone)
  for (const email of contact.email || []) push('Email', email)
  push('Additional info — hours', contact.hours)
  for (const other of contact.other || []) push('Additional info', other)
  for (const social of contact.social || []) push(`Social media — ${social.platform}`, social.url)
  entry.notes.push(
    'Address is a snippet chooser referencing a stored Address record, not inline fields, and Phone number’s first field is labelled "Owner" rather than "Name".'
  )
  if (entry.fields.length) context.transcript.entries.push(entry)
}

/** Karl's Spotlight block, wherever it is hosted. */
function emitSpotlightValue(context, entry, spotlight, basePath) {
  if (spotlight.title) entry.fields.push({ label: 'Spotlight title', value: spotlight.title })
  const description = foldTextAndBullets(spotlight.paragraphs, undefined)
  if (description) {
    entry.fields.push({ label: 'Spotlight description', value: description })
    collectLinks(context, entry, description)
  }
  if (spotlight.image) {
    entry.fields.push({
      label: 'Spotlight image (chooser, min 1080×350)',
      value: spotlight.image.alt || '(image)',
    })
  }
  if (spotlight.button) {
    entry.fields.push({ label: 'Button link — Link text', value: spotlight.button })
    entry.fields.push({
      label: 'Button link — destination',
      value: buttonDestination(context, spotlight),
    })
    noteButtonLength(entry, spotlight.button)
  }
  entry.notes.push(
    'Image alignment (Side by side / Full width) and Image position (Right / Left) are both required radios with no mockup equivalent — choose them by hand.'
  )
  const cap = KARL_FLAGS.spotlightsAllowed[context.type]
  if (cap) {
    entry.notes.push(
      `${context.type} shows up to ${cap} Spotlight${cap === 1 ? '' : 's'}. That is a rendering and editorial cap, not one the form enforces.`
    )
  }
  context.consumed.add(basePath)
  if (entry.fields.length) context.transcript.entries.push(entry)
}

/** A button's destination, as the editor has to express it. */
function buttonDestination(context, holder) {
  if (holder.buttonTarget) {
    const destination = context.pages[holder.buttonTarget]
    return `SF.gov page → "${destination ? destination.title : holder.buttonTarget}"`
  }
  if (holder.buttonUrl) return `External URL → ${holder.buttonUrl}`
  return 'None'
}

/** Record the 25-character guidance without pretending it is a schema limit. */
function noteButtonLength(entry, label) {
  if (label.length > KARL_FLAGS.buttonLabelGuidanceChars) {
    entry.notes.push(
      `Link text is ${label.length} characters. The Help Center's ${KARL_FLAGS.buttonLabelGuidanceChars}-character rule is editorial guidance, not a schema limit — the field accepts ${KARL_FLAGS.buttonLabelMaxChars}.`
    )
  }
}

/** One field of a matched section (Agency's two required section headings). */
function emitSectionField(context, panel, source, section, index) {
  const path = `sections.${index}.${source.field}`
  const { value, overlaid } = resolveValue(context.page, context.reviewRecord, path)
  context.consumed.add(path)
  if (!value) return emitEmptyPanel(context, panel)
  const entry = newEntry(panel, 'TYPE')
  entry.overlaid = overlaid
  entry.fields.push({ label: panel.uiLabel, value: String(value) })
  if (panel.note) entry.notes.push(panel.note)
  context.transcript.entries.push(entry)
}

/**
 * One matched section, emitted by its shape and by the source's scope.
 *
 * `source.emit` narrows WHAT of the section this panel takes, which is the
 * generalization of `source.field`. Resource Collection needs it: one mockup
 * section carrying both `paragraphs[]` and `cards[]` maps to TWO Karl panels —
 * `introductory_text` (a Title-and-text block with no chooser at all) and
 * `body` → Resources (a links list). Without a scope, both panels emitted the
 * whole section, so the transcript told an editor to pick pages inside a panel
 * that has no page chooser, and printed the same links twice.
 */
function emitSection(context, panel, source, section, index) {
  const cardClass = context.classes[index]
  const scope = source.emit || 'all'
  const entry = newEntry(panel, 'TYPE')
  entry.inferred = Boolean(source.inferred)
  entry.sectionIndex = index
  entry.scope = scope
  if (panel.note) entry.notes.push(panel.note)
  if (entry.inferred) {
    entry.notes.push(
      'Inferred mapping — the field map documents this panel only for supporting/flat sections. Transaction has no generic body stream and this is its only repeatable Title-and-text panel, so verify the destination before saving.'
    )
  }

  const headingPath = `sections.${index}.heading`
  const heading = resolveValue(context.page, context.reviewRecord, headingPath)
  context.consumed.add(headingPath)

  if (section.steps) {
    // The section's own heading is NOT typed anywhere: Karl's What to Do panel
    // carries its own fixed label, and `special_cases` overrides the headings of
    // supporting_information and custom_section, not this one. Saying so is the
    // point — an editor who sees the mockup heading and no instruction for it
    // will otherwise go looking for a field that does not exist.
    entry.notes.push(
      `The mockup heading "${heading.value || ''}" is not typed anywhere — Karl's What to Do panel carries its own label. Each step below becomes one Section block.`
    )
    emitSteps(context, entry, section, index)
    context.transcript.entries.push(entry)
    return
  }

  if (section.component === 'spotlight') {
    emitSectionSpotlight(context, entry, section, index, heading.value)
    return
  }

  if (section.facts) {
    entry.fields.push({ label: 'Facts title', value: String(heading.value || '') })
    section.facts.forEach((fact, factIndex) => {
      entry.fields.push({ label: `Fact ${factIndex + 1} — title`, value: fact.label })
      entry.fields.push({ label: `Fact ${factIndex + 1} — text`, value: fact.text })
    })
    context.consumed.add(`sections.${index}.facts`)
    entry.notes.push(
      'Fact items carry no reviewer overlay — this tool records no edit for them, so these are the authored values rather than reviewed ones.'
    )
    emitSectionProse(context, entry, section, index, { headingAlreadyEmitted: true })
    context.transcript.entries.push(entry)
    return
  }

  if (
    scope !== 'prose' &&
    section.cards &&
    (cardClass === 'inherits' || cardClass === 'title-only')
  ) {
    // A cards-scoped panel is a Resource section, which does have a Title of
    // its own — unlike a Related panel, which is a bare page list with no
    // fields at all, so the heading is printed only in the scoped case.
    if (scope === 'cards' && heading.value) {
      entry.fields.push({ label: 'Resource section — Title', value: String(heading.value) })
    }
    emitCardChoices(context, entry, section, index, cardClass)
    if (scope === 'all') emitSectionProse(context, entry, section, index, {})
    context.transcript.entries.push(entry)
    return
  }

  if (scope !== 'prose' && section.cards && context.type === 'Report') {
    // U15: Report has no page-card block. Each card becomes an inline hyperlink
    // inside the Body rich text, which is the mockup's own fallback note and
    // the only thing the chooser allows.
    entry.fields.push({ label: 'Body — Heading 2', value: String(heading.value || '') })
    emitSectionProse(context, entry, section, index, { headingAlreadyEmitted: true })
    for (const card of section.cards) {
      entry.links.push({
        label: card.title,
        target: card.target || card.url || '#',
        representation: linkRepresentation(card.target || card.url || '#', context.pages),
      })
    }
    context.consumed.add(`sections.${index}.cards`)
    entry.notes.push(
      'Report has no page-card block (U15) — each of these becomes a hyperlink inside the Body rich text, and the card’s own description is dropped.'
    )
    context.transcript.entries.push(entry)
    return
  }

  if (scope !== 'prose' && section.cards && cardClass !== 'authored') {
    // The classifier could not place this section, so what its cards publish is
    // unknown. Guessing TYPE would reintroduce the exact defect
    // js/card-inheritance.js exists to prevent — here as an instruction a human
    // executes — and guessing CHOOSE would silently drop authored copy.
    context.transcript.flags.push({
      path: `sections.${index}.cards`,
      reason: `The card-inheritance classifier returns "unknown" for this section, so whether these cards publish their own words or the destination page's is undecided. Its karl note reads: "${(section.karl || '').slice(0, 160)}". Resolve it before typing anything from them.`,
    })
    context.consumed.add(`sections.${index}.cards`)
  }

  if (scope !== 'cards')
    emitSectionProse(context, entry, section, index, { heading: heading.value })
  if (scope !== 'prose' && section.cards && cardClass === 'authored') {
    section.cards.forEach((card, cardIndex) => {
      entry.fields.push({ label: `Entry ${cardIndex + 1} — Title`, value: card.title })
      if (card.text) entry.fields.push({ label: `Entry ${cardIndex + 1} — Text`, value: card.text })
    })
    context.consumed.add(`sections.${index}.cards`)
  }
  if (entry.fields.length || entry.links.length) context.transcript.entries.push(entry)
}

/** A section that maps to a Spotlight block. */
function emitSectionSpotlight(context, entry, section, index, heading) {
  emitSpotlightValue(
    context,
    entry,
    {
      title: heading,
      paragraphs: section.paragraphs,
      image: section.image,
      button: section.button,
      buttonTarget: section.buttonTarget,
      buttonUrl: section.buttonUrl,
    },
    `sections.${index}`
  )
  for (const field of ['paragraphs', 'image', 'button', 'buttonUrl']) {
    if (section[field]) context.consumed.add(`sections.${index}.${field}`)
  }
  if (section.callout) emitCallout(context, entry, section.callout, `sections.${index}.callout`)
}

/** The prose half of a section: heading, paragraphs, bullets, table, callout. */
function emitSectionProse(context, entry, section, index, options) {
  if (!options.headingAlreadyEmitted && options.heading !== undefined) {
    // Report's Body is one rich text field with no Title of its own — a
    // section heading becomes a Heading 2 INSIDE it, which is also what
    // auto-generates the published page's table of contents. Labelling it
    // "Title" would send an editor looking for a field the Body block does not
    // have.
    if (context.type === 'Report') {
      entry.fields.push({ label: 'Body — Heading 2', value: String(options.heading || '') })
      entry.notes.push(
        'Every Body block on this page can live in ONE Body field: Heading 2 auto-generates the table of contents and Heading 3 appears under "See all sections". Do not use Heading 4, 5 or 6 — they never render.'
      )
    } else {
      entry.fields.push({ label: 'Title', value: String(options.heading || '') })
    }
  }
  const paragraphsPath = `sections.${index}.paragraphs`
  const bulletsPath = `sections.${index}.bullets`
  const paragraphs = resolveValue(context.page, context.reviewRecord, paragraphsPath)
  const bullets = resolveValue(context.page, context.reviewRecord, bulletsPath)
  const text = foldTextAndBullets(paragraphs.value, bullets.value)
  if (text) {
    entry.fields.push({ label: 'Text', value: text })
    entry.overlaid = entry.overlaid || paragraphs.overlaid || bullets.overlaid
    collectLinks(context, entry, text)
    context.consumed.add(paragraphsPath)
    context.consumed.add(bulletsPath)
  }

  if (section.table) {
    const tablePath = `sections.${index}.table`
    const table = resolveValue(context.page, context.reviewRecord, tablePath)
    if (context.type === 'Report') {
      entry.table = table.value
      entry.notes.push(
        'Table block: choose the header option first, then add a column per heading. Use 2 or 3 columns — more forces horizontal scrolling on a phone — and note that text inside a table is NOT machine translated while the rest of sf.gov is.'
      )
      context.consumed.add(tablePath)
    }
    // On any other type the table is left unconsumed and reported by the sweep:
    // Report is the only Karl content type with a Table block, so there is
    // genuinely nowhere for one to go.
  }

  if (section.callout) emitCallout(context, entry, section.callout, `sections.${index}.callout`)
}

/** A Callout block, and the title problem every one of them has. */
function emitCallout(context, entry, callout, basePath) {
  const textPath = `${basePath}.text`
  const text = resolveValue(context.page, context.reviewRecord, textPath)
  if (text.value) {
    // U18: Report's `content` chooser offers Body and Table and nothing else —
    // opened in the live form on 2026-08-15, against a component matrix that
    // claims Callout: Yes. There is no Callout block to put this in, so it
    // folds into the Body rich text, and the transcript says which rather than
    // labelling it as a block that does not exist.
    const isReport = context.type === 'Report'
    entry.fields.push({
      label: isReport
        ? 'Body — fold in as a bolded lead-in (Report has no Callout block)'
        : 'Callout (rich text, no title field)',
      value: String(text.value),
    })
    if (isReport) {
      context.transcript.flags.push({
        path: textPath,
        reason:
          'U18 — Report’s content chooser offers Body and Table only, so this callout has no block of its own. Fold it into the Body rich text as a bolded lead-in; the component matrix claiming Callout: Yes for Report is wrong (O11).',
      })
    }
    collectLinks(context, entry, String(text.value))
    context.consumed.add(textPath)
  }
  const titlePath = `${basePath}.title`
  const title = resolveValue(context.page, context.reviewRecord, titlePath)
  if (title.value && title.value !== false) {
    // U2. Folding it into the rich text as a bolded lead-in is a content
    // judgement, and this tool does not make those — it reports the problem and
    // leaves the decision with the person who owns the copy.
    context.transcript.flags.push({
      path: titlePath,
      reason: `Callout title "${title.value}" has no Karl field — every Karl Callout is a single rich text field with no title (U2). Fold it into the rich text as a bolded lead-in, or get a field added.`,
    })
    context.consumed.add(titlePath)
  }
}

/** A section's cards, where the cards are pickers rather than authored copy. */
function emitCardChoices(context, entry, section, index, cardClass) {
  entry.outcome = 'CHOOSE'
  entry.notes.push(
    cardClass === 'inherits'
      ? 'This block publishes the destination page’s title AND its summary. Choose the page and type no description — anything typed here cannot appear.'
      : 'This block publishes the destination page’s title and a link, and NOTHING else. Choose the page and type no description.'
  )
  section.cards.forEach((card, cardIndex) => {
    if (card.target) {
      const destination = context.pages[card.target]
      entry.choices.push({
        label: destination ? destination.title : card.target,
        pageKey: card.target,
        slug: destination ? destination.slug : '',
      })
      return
    }
    // An external entry has no destination page to inherit from, so it carries
    // its own authored text — settled by the 332-page departments--* census. In
    // a title-only block the opposite holds: that component renders no
    // description for ANY entry, so a description here is dead.
    entry.outcome = entry.choices.length ? entry.outcome : 'TYPE'
    entry.fields.push({ label: `External link ${cardIndex + 1} — Title`, value: card.title })
    entry.fields.push({ label: `External link ${cardIndex + 1} — URL`, value: card.url || '' })
    if (cardClass === 'inherits' && card.text) {
      entry.fields.push({ label: `External link ${cardIndex + 1} — Description`, value: card.text })
    } else if (card.text) {
      context.transcript.flags.push({
        path: `sections.${index}.cards.${cardIndex}.text`,
        reason: `This entry carries a description, but the block it sits in renders no description for any entry. Typing it publishes nothing — delete it from the mockup rather than pasting it.`,
      })
    }
  })
  context.consumed.add(`sections.${index}.cards`)
}

/** A section's steps, as Karl what_to_do Section blocks. */
function emitSteps(context, entry, section, index) {
  section.steps.forEach((step, stepIndex) => {
    const base = `sections.${index}.steps.${stepIndex}`
    const title = resolveValue(context.page, context.reviewRecord, `${base}.title`)
    entry.fields.push({
      label: `Section ${stepIndex + 1} — Section title`,
      value: String(title.value || ''),
    })
    context.consumed.add(`${base}.title`)

    const text = resolveValue(context.page, context.reviewRecord, `${base}.text`)
    const bullets = resolveValue(context.page, context.reviewRecord, `${base}.bullets`)
    const folded = foldTextAndBullets(text.value, bullets.value)
    if (folded) {
      entry.fields.push({
        label: `Section ${stepIndex + 1} — Section specifics → Text`,
        value: folded,
      })
      collectLinks(context, entry, folded)
      entry.overlaid = entry.overlaid || text.overlaid || bullets.overlaid
    }
    context.consumed.add(`${base}.text`)
    context.consumed.add(`${base}.bullets`)

    if (step.button) {
      entry.fields.push({
        label: `Section ${stepIndex + 1} — Section specifics → Button link → Link text`,
        value: step.button,
      })
      entry.fields.push({
        label: `Section ${stepIndex + 1} — Button link → destination`,
        value: buttonDestination(context, step),
      })
      noteButtonLength(entry, step.button)
      context.consumed.add(`${base}.button`)
      context.consumed.add(`${base}.buttonUrl`)
    }

    if (step.callout) emitCallout(context, entry, step.callout, `${base}.callout`)
  })
  context.consumed.add(`sections.${index}.steps`)
  entry.notes.push(
    'A step with text, a button and a callout becomes ONE Section block whose Section specifics holds a Text, a Button link and a Callout as siblings — not fields on the step.'
  )
}

/** Pull inline links out of an emitted value and record them on the entry. */
function collectLinks(context, entry, text) {
  for (const link of extractInlineLinks(text, context.pages)) entry.links.push(link)
}

/** The Promote tab, identical on all eight types. */
function emitPromoteTab(context) {
  const entry = newEntry(
    { uiLabel: PROMOTE_PANEL.uiLabel, rawName: 'promote', docLine: PROMOTE_PANEL.docLine },
    'TYPE'
  )
  for (const field of PROMOTE_PANEL.fields) {
    const { value } = resolveValue(context.page, context.reviewRecord, field.path)
    context.consumed.add(field.path)
    if (value)
      entry.fields.push({ label: `${field.label} (\`${field.rawName}\`)`, value: String(value) })
  }
  entry.notes.push(
    'The slug is REQUIRED and lives on the Promote tab, so a page cannot be saved from the Content tab alone.'
  )
  if (entry.fields.length) context.transcript.entries.push(entry)
}

/**
 * Everything on the page that carries content and reached no panel.
 *
 * This is the half that makes the transcript honest: without it, content with
 * no Karl destination simply does not appear, and an absence reads as "there
 * was nothing there" rather than as "there is nowhere for this to go".
 */
function sweepUnconsumed(context) {
  const { page, consumed, transcript, type } = context
  for (const [field, value] of Object.entries(page)) {
    if (field === 'sections' || NOT_MIGRATED_PAGE_FIELDS.has(field)) continue
    if (value === undefined || value === null || value === '') continue
    if (consumed.has(field)) continue
    if (field === 'whatToKnow' || field === 'contact' || field === 'spotlight') {
      // Consumed as a whole when their panel exists; the panel adds the bare
      // key. A sub-key left over is not addressable as its own Karl field, so
      // reporting the container is the honest granularity.
      if ([...consumed].some((path) => path === field || path.startsWith(`${field}.`))) continue
    }
    transcript.unmapped.push({
      path: field,
      shape: `${kebab(type)}-page-${kebab(field)}`,
      reason: `The page carries \`${field}\`, and no ${type} panel documented in the field map accepts it.`,
    })
  }

  context.sections.forEach((section, index) => {
    const missing = SECTION_CONTENT_FIELDS.filter(
      (field) => section[field] && !consumed.has(`sections.${index}.${field}`)
    )
    // A heading rides along with whatever else in its section is unmapped: the
    // finding is the section, and reporting its title as a second finding
    // inflates the count without naming anything new. It is reported on its own
    // only when it really is the one thing with nowhere to go.
    const fields = missing.length > 1 ? missing.filter((field) => field !== 'heading') : missing
    for (const field of fields) {
      transcript.unmapped.push({
        path: `sections.${index}.${field}`,
        shape: unmappedShape(type, section, field),
        reason: unmappedReason(type, section, field),
      })
    }
    // Same reasoning one level down: if the steps container itself has no home,
    // every field of every step is the same finding. Reporting them separately
    // turned one Information page into eleven findings and buried the one that
    // names the actual problem.
    if (missing.includes('steps')) return
    for (const [stepIndex, step] of (section.steps || []).entries()) {
      for (const field of STEP_CONTENT_FIELDS) {
        if (!step[field]) continue
        const path = `sections.${index}.steps.${stepIndex}.${field}`
        if (consumed.has(path)) continue
        transcript.unmapped.push({
          path,
          shape: `${kebab(type)}-step-${field}`,
          reason: `Step field \`${field}\` reached no Karl block on a ${type} page.`,
        })
      }
    }
  })
}

/** Why one unconsumed field has no home, in the words the register uses. */
function unmappedReason(type, section, field) {
  if (field === 'button' || field === 'buttonUrl') {
    return "U1 — a section-level button outside any step. Transaction's only Button link slot sits inside a what_to_do Section, and Report's only inside the Spotlight, so this has no documented Karl destination."
  }
  if (field === 'steps' && type === 'Information') {
    return 'U3 — steps on an Information page. Information has no what_to_do-style container. Karl’s Step by step type fits the steps but has no cost and no things_to_know, so retyping the page would drop its whatToKnow entirely.'
  }
  if (field === 'cards' && type === 'Topic') {
    return 'U5 — Topic has no `related` field, confirmed at E1. Either this panel moves into content_fields as a Resources block, or the page drops it.'
  }
  if (field === 'table') {
    return 'Report is the only Karl content type with a Table block, so a table on this type has nowhere to go.'
  }
  if (
    (field === 'paragraphs' || field === 'bullets') &&
    type === 'Agency' &&
    (section.component === 'services' || section.component === 'resources')
  ) {
    return 'U20 — an Agency Services/Resources Subsection carries a single optional Title and a links list. There is no description field, so this prose has nowhere to go.'
  }
  return `\`${field}\` on this section reached no panel in the ${type} inventory.`
}

/**
 * Render a transcript as the markdown an editor reads.
 *
 * The decision goes at the TOP and on every panel, because approval in this
 * tool is per PAGE and not per field: there is no field-level approval to
 * report, so a not-approved page has to be marked throughout rather than
 * exported as though it were signed off.
 * @param {object} transcript
 * @returns {string}
 */
function renderTranscriptMarkdown(transcript) {
  const lines = []
  const caveat = transcript.approved ? '' : ' — page not approved'
  lines.push(`# ${transcript.title} — Karl transcript`)
  lines.push('')
  lines.push(`**Karl path:** ${transcript.navPath}`)
  if (transcript.reviewed) {
    const who = [transcript.reviewer, transcript.reviewDate].filter(Boolean).join(', ')
    lines.push(`**Decision:** ${transcript.decision}${who ? ` (${who})` : ''}`)
  } else {
    lines.push('**Decision:** no review recorded')
  }
  lines.push(
    `**Page key:** \`${transcript.pageKey}\` · **Slug:** \`${transcript.slug}\` · **Type:** ${transcript.type}`
  )
  lines.push('')
  if (!transcript.approved) {
    lines.push(
      '**NOT APPROVED — do not publish from this transcript.** Approval in this tool is per page, not per field, so nothing below is signed off.'
    )
    lines.push('')
  }
  lines.push(
    '> Every keystroke below is yours to make. This file is an export, not an approval, and nothing here has been written to Karl.'
  )
  lines.push('')

  for (const entry of transcript.entries) {
    lines.push(`### ${entry.uiLabel} — \`${entry.rawName}\` [${entry.outcome}]${caveat}`)
    lines.push('')
    if (entry.inferred) {
      lines.push('⚠ Inferred mapping — verify the destination before saving.')
      lines.push('')
    }
    for (const note of entry.notes) {
      lines.push(`_${note}_`)
      lines.push('')
    }
    for (const field of entry.fields) {
      lines.push(`**${field.label}:**`)
      lines.push('')
      lines.push(field.value === '' ? '_(empty)_' : field.value)
      lines.push('')
    }
    entry.choices.forEach((choice, index) => {
      lines.push(
        `${index + 1}. Choose page: "${choice.label}"${choice.pageKey ? ` (\`${choice.pageKey}\`${choice.slug ? ` → /${choice.slug}` : ''})` : ''}`
      )
    })
    if (entry.choices.length) lines.push('')
    if (entry.table) {
      // The separator row is not decoration: without it every row renders as a
      // header, and the whole point of printing a table here is that an editor
      // can see which cell goes in which column.
      entry.table.forEach((row, rowIndex) => {
        lines.push(`| ${row.join(' | ')} |`)
        if (rowIndex === 0) lines.push(`| ${row.map(() => '---').join(' | ')} |`)
      })
      lines.push('')
    }
    if (entry.links.length) {
      lines.push('**Links in this text — recreate each with the Link tool, do not paste them:**')
      lines.push('')
      for (const link of entry.links) {
        lines.push(`- "${link.label}" → ${link.representation}`)
      }
      lines.push('')
    }
  }

  if (transcript.flags.length) {
    lines.push(`## Flags — resolve before saving${caveat}`)
    lines.push('')
    for (const flag of transcript.flags) {
      lines.push(`- \`${flag.path}\` — ${flag.reason}`)
    }
    lines.push('')
  }

  if (transcript.unmapped.length) {
    lines.push('## Unmapped — no documented Karl destination')
    lines.push('')
    lines.push(
      'Nothing below has a field to be typed into. It is listed rather than dropped, because an absence reads as "there was nothing there".'
    )
    lines.push('')
    for (const finding of transcript.unmapped) {
      lines.push(`- \`${finding.path}\` — ${finding.reason}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

if (typeof window !== 'undefined') {
  window.karlTranscript = {
    buildTranscript,
    renderTranscriptMarkdown,
    resolveValue,
    foldTextAndBullets,
    extractInlineLinks,
  }
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buildTranscript,
    renderTranscriptMarkdown,
    resolveValue,
    foldTextAndBullets,
    extractInlineLinks,
  }
}
