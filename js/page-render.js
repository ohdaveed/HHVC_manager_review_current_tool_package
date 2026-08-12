// Mockup page rendering: turns page-data.js page objects into the HTML shown
// in #mockPage, including Karl placement/rationale tags. Depends on
// js/state.js (escapeHtml, pageData) and js/editor-panel.js /
// js/ui-controls.js for the post-render side effects triggered by
// applyPageContent (syncEditorFields, etc.).

import {
  applyChecklistState,
  restoreSidebarScroll,
  saveSidebarScroll,
  showToast,
} from './ui-controls.js'
import { currentPageKey, pageData, setCurrentPageKey } from './state.js'
import { escapeHtml, getPrimaryCta, resolvePageKey, safeUrl, showErrorBanner } from './utils.js'
import { karlKindMeta, parseKarlLabel } from './karl-tag-meta.js'
import { syncEditorFields, updateReadingTarget } from './editor-panel.js'
// Side-effect import: js/card-inheritance.js publishes window.cardInheritance
// and exports nothing, so this is what guarantees the classifier exists before
// any card renders. js/main.js lists it ahead of this file too, but that list
// is documentation — this import is the enforcement.
import './card-inheritance.js'
// Maps cardInheritanceFact()'s three outcomes to the badge text a reviewer
// sees on a card's tag — the only place this vocabulary is spelled out.
const INHERIT_BADGE_TEXT = {
  'title-and-text': 'Card title + text inherited from linked page',
  text: "Card text field won't publish",
  title: 'Card title inherited from linked page',
}

function karlTag(label, kind = 'body', opts = {}) {
  const meta = typeof karlKindMeta === 'function' ? karlKindMeta(kind) : { label: 'Body' }
  const parsed =
    typeof parseKarlLabel === 'function'
      ? parseKarlLabel(label)
      : { breadcrumb: [], headline: String(label ?? ''), rationale: '', flagged: false }

  const breadcrumbHtml = parsed.breadcrumb.length
    ? `<span class="karl-tag-breadcrumb">${parsed.breadcrumb
        .map((seg) => `<span class="karl-tag-crumb">${escapeHtml(seg)}</span>`)
        .join('<span class="karl-tag-crumb-sep" aria-hidden="true">›</span>')}</span>`
    : ''
  const flagHtml = parsed.flagged
    ? `<span class="karl-tag-flag">${escapeHtml('Unresolved mapping')}</span>`
    : ''
  const inheritHtml = INHERIT_BADGE_TEXT[opts.inheritanceFact]
    ? `<span class="karl-tag-inherit" data-inherit="${escapeHtml(opts.inheritanceFact)}">${escapeHtml(INHERIT_BADGE_TEXT[opts.inheritanceFact])}</span>`
    : ''
  const rationaleHtml = parsed.rationale
    ? `<span class="karl-tag-rationale">${escapeHtml(parsed.rationale)}</span>`
    : ''

  // Karl tags are visual reviewer annotations, not part of the public-page
  // control they precede. Leaving their long placement notes in the
  // accessibility tree made a card button announce the entire CMS rationale
  // before its actual destination; the toolbar toggle is the discoverable
  // control for showing that visual layer.
  return `<mark class="karl-tag" data-kind="${escapeHtml(kind)}" aria-hidden="true"><span class="karl-tag-kind">${escapeHtml(meta.label)}</span><span class="karl-tag-text"><strong>Karl:</strong> ${breadcrumbHtml}<span class="karl-tag-headline">${escapeHtml(parsed.headline)}</span>${flagHtml}${inheritHtml}${rationaleHtml}</span></mark>`
}
const EDITOR_QA_STATUS = {
  'needs-review': { icon: '⚠', label: 'Needs review' },
  blocked: { icon: '⛔', label: 'Blocked' },
  placeholder: { icon: '◆', label: 'Placeholder content' },
}
function editorQaBlock(page) {
  const status = EDITOR_QA_STATUS[page.editorStatus] || EDITOR_QA_STATUS['needs-review']
  const note =
    page.editorNote ||
    `Primary agency: Environmental Health. Parent department: Department of Public Health. Program: Healthy Housing and Vector Control. Reading level target: ${page.reading}. Transaction pages use one primary CTA and avoid about-style program background. Visual link boxes in this mockup are preview aids.`
  return `<aside class="editor-qa qa-${page.editorStatus || 'needs-review'}"><div class="editor-qa-head">${karlTag('Editor-only QA note / Do not publish', 'editor')}<span class="editor-qa-status"><span aria-hidden="true">${status.icon}</span>${escapeHtml(status.label)}</span></div><strong>Editor QA:</strong> ${escapeHtml(note)}</aside>`
}
function normalizeTextItem(item) {
  if (typeof item === 'string') return { text: item, unverified: false, unverifiedReason: '' }
  return {
    text: item.text,
    unverified: Boolean(item.unverified),
    unverifiedReason: item.unverifiedReason || '',
  }
}
function unverifiedPill(reason) {
  return `<span class="unverified-pill"${reason ? ` title="${escapeHtml(reason)}"` : ''}><span aria-hidden="true">⚠</span> Unverified</span>`
}
function formatMarkdown(text) {
  if (typeof text !== 'string') return ''
  let html = escapeHtml(text).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  // [label](pageKey) becomes an in-mockup nav button; [label](https://...)
  // becomes a real external link — page copy that points at third-party
  // references (CDC, UC IPM, the municipal code) uses the same inline syntax.
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, target) =>
    /^https?:\/\//.test(target)
      ? `<a class="inline-link" href="${target}" target="_blank" rel="noopener noreferrer">${label} <span aria-hidden="true">↗</span></a>`
      : `<button type="button" class="inline-link" data-render-target="${target}">${label}</button>`
  )
  return html
}
/**
 * @param {Array<string|object>} paragraphs
 * @param {string} [pathPrefix] Dot-path of the array, e.g. 'sections.2.paragraphs'.
 *   Omitted at call sites that are out of the AI-rewrite scope, which is how
 *   that scope boundary is expressed — the renderer itself has no opinion.
 * @returns {string}
 */
function paragraphList(paragraphs = [], pathPrefix = '') {
  return paragraphs
    .map((p, index) => {
      const item = normalizeTextItem(p)
      const attr = pathPrefix ? ` data-rewrite-field="${escapeHtml(`${pathPrefix}.${index}`)}"` : ''
      return `<p${attr}>${formatMarkdown(item.text)}${item.unverified ? unverifiedPill(item.unverifiedReason) : ''}</p>`
    })
    .join('')
}
function renderTextItems(items = []) {
  if (!items.length) return ''
  if (items.length <= 2) return paragraphList(items)
  return bulletList(items)
}
function renderAudience(audience = []) {
  if (!Array.isArray(audience)) return ''
  return audience.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
}
/**
 * @param {Array<string|object>} bullets
 * @param {string} [pathPrefix] Dot-path of the array, e.g. 'sections.2.bullets'.
 * @returns {string}
 */
function bulletList(bullets = [], pathPrefix = '') {
  if (!bullets.length) return ''
  return `<ul>${bullets
    .map((b, index) => {
      const item = normalizeTextItem(b)
      const attr = pathPrefix ? ` data-rewrite-field="${escapeHtml(`${pathPrefix}.${index}`)}"` : ''
      return `<li${attr}>${formatMarkdown(item.text)}${item.unverified ? unverifiedPill(item.unverifiedReason) : ''}</li>`
    })
    .join('')}</ul>`
}
function normalizePageType(type = '') {
  const t = String(type).toLowerCase()
  if (t.includes('transaction')) return 'transaction'
  if (t.includes('information')) return 'information'
  if (t.includes('topic')) return 'topic'
  if (t.includes('agency')) return 'agency'
  if (t.includes('resource collection')) return 'resource-collection'
  if (t.includes('campaign')) return 'campaign'
  if (t.includes('report')) return 'report'
  if (t.includes('about')) return 'about'
  return 'generic'
}
function inferSectionRole(section, pageType) {
  if (section.component) return section.component
  const k = (section.karl || '').toLowerCase()
  const heading = (section.heading || '').toLowerCase()
  if (section.kind === 'placement' && k.includes('related section')) return 'related'
  if (k.includes('related section: right-panel')) return 'related'
  if (heading === 'related pages' || heading === 'related') return 'related'
  if (section.component === 'contact' || k.includes('contact section')) return 'contact'
  if (pageType === 'topic') {
    if (k.includes('services section') || k.includes('service item')) return 'services'
    if (k.includes('resources section') || k.includes('resource item')) return 'resources'
    return 'intro'
  }
  if (pageType === 'agency') {
    // Agency page data sets `component:` explicitly on every section (checked
    // first, above); this karl-string fallback mirrors the topic branch so a
    // section with a real-Karl field note still lands in the right region.
    if (k.includes('section title 1') || k.includes('services')) return 'services'
    if (k.includes('section title 2') || k.includes('resources')) return 'resources'
    if (k.includes('about')) return 'body'
    return 'intro'
  }
  if (pageType === 'resource-collection') {
    if (k.includes('resource collection item') || section.cards) return 'resources'
    return 'intro'
  }
  if (pageType === 'transaction') {
    if (heading === 'what to do' || section.steps) return 'what-to-do'
    if (k.includes('supporting information')) return 'supporting'
    if (section.kind === 'placement' && section.cards) return 'supporting'
    return 'supporting'
  }
  if (pageType === 'information' || pageType === 'report') {
    if (k.includes('external') && section.cards) return 'resources'
    return 'body'
  }
  if (pageType === 'campaign') {
    // Campaign sections always carry an explicit `component` in this
    // mockup's content — this fallback exists only for parity with every
    // other type's explicit handling above, mirroring the Transaction
    // branch's own always-set-explicitly posture for its 'supporting' role.
    return 'body'
  }
  return 'body'
}
function partitionSections(page) {
  const pageType = normalizePageType(page.type)
  const intro = []
  const services = []
  const resources = []
  const related = []
  const whatToDo = []
  const supporting = []
  const spotlight = []
  const topFacts = []
  const body = []
  for (const [index, section] of (page.sections || []).entries()) {
    // The ORIGINAL index, attached to a copy rather than to page data. Buckets
    // are rendered in a fixed layout order that is not source order, so this is
    // the only surviving link back to where the section actually lives.
    const withIndex = { ...section, __sectionIndex: index }
    const role = inferSectionRole(section, pageType)
    if (role === 'related') related.push(withIndex)
    else if (role === 'services') services.push(withIndex)
    else if (role === 'resources') resources.push(withIndex)
    else if (role === 'intro') intro.push(withIndex)
    else if (role === 'what-to-do') whatToDo.push(withIndex)
    else if (role === 'supporting') supporting.push(withIndex)
    else if (role === 'spotlight') spotlight.push(withIndex)
    else if (role === 'top-facts') topFacts.push(withIndex)
    else body.push(withIndex)
  }
  return {
    pageType,
    intro,
    services,
    resources,
    related,
    whatToDo,
    supporting,
    spotlight,
    topFacts,
    body,
  }
}
function sectionAnchorId(heading) {
  return (
    'section-' +
    String(heading || 'section')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  )
}
// Mockup-internal navigation for buttons/cards rendered from page data.
document.addEventListener('click', (event) => {
  const inertAnchor = event.target.closest('a[href="#"]')
  if (inertAnchor) {
    event.preventDefault()
  }
  const link = event.target.closest(
    'button[data-render-target], a[data-render-target], button[data-render-inert], button[data-accordion-toggle]'
  )
  if (!link) return
  if (link.matches('button[data-accordion-toggle]')) {
    event.preventDefault()
    const panel = link.closest('.accordion-item')?.querySelector('.accordion-panel')
    if (!panel) return
    const expanded = link.getAttribute('aria-expanded') === 'true'
    link.setAttribute('aria-expanded', expanded ? 'false' : 'true')
    panel.hidden = expanded
    return
  }
  event.preventDefault()
  const key = link.getAttribute('data-render-target')
  if (key) window.renderPage(key)
})
function button(label, kind = 'primary', target = null, url = null) {
  const cls = kind === 'secondary' ? 'btn secondary' : 'btn'
  if (url) {
    return `<a class="${cls}" href="${escapeHtml(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${karlTag(kind === 'secondary' ? 'Links: Body external resource' : 'Button: Primary CTA (external)', 'placement')}${escapeHtml(label)} <span aria-hidden="true">↗</span></a>`
  }
  const attr = target ? ` data-render-target="${escapeHtml(target)}"` : ''
  return `<button type="button" class="${cls}"${attr}>${karlTag(kind === 'secondary' ? 'Links: Related Transaction page' : 'Button: Primary CTA', 'placement')}${escapeHtml(label)}</button>`
}
function renderCallout(callout, extraClass = '') {
  if (!callout) return ''
  const variant = callout.variant || 'info'
  const title =
    callout.title === false
      ? ''
      : callout.title
        ? `<strong>${escapeHtml(callout.title)}:</strong> `
        : ''
  return `<aside class="callout callout--${escapeHtml(variant)} ${extraClass}">${karlTag(callout.karl || 'Body callout', 'body')}${title}${formatMarkdown(callout.text)}</aside>`
}
/**
 * Non-Transaction pages don't get Karl's "What to know before you start" box
 * — that's Transaction-only (karl-content-type-field-reference.md:228,
 * confirmed against 8 real sf.gov pages sampled via Firecrawl: 2 of 3
 * sampled Information pages carry no audience framing at all, the third
 * folds it into a plain, page-specific body subheading — never a boxed
 * "This page can help if you are:" dump). `audience[]` stays mockup-only
 * editorial metadata (karl-content-type-field-reference.md:196) either way
 * — only how it's rendered differs by type, per the Component availability
 * matrix (karl-content-type-field-reference.md:384-400): Resource
 * Collection has no Callout ("use Custom section" instead), so it gets a
 * plain paragraph; every other non-Transaction type gets a blue info
 * Callout via the same renderCallout() the Transaction "What to know" box
 * and section-level callouts already use.
 */
function renderAudienceFraming(page, pageType) {
  const audience = Array.isArray(page.audience) ? page.audience : []
  if (!audience.length) return ''
  const text = audience.join(' ')
  if (pageType === 'resource-collection') {
    return `<p>${karlTag('Custom section: Who this is for (audience[] editorial framing, not a literal Karl field)', 'body')}${formatMarkdown(text)}</p>`
  }
  const karlNote =
    pageType === 'campaign'
      ? 'Additional content callout: Who this is for (audience[] editorial framing, not a literal Karl field)'
      : 'Body callout: Who this is for (audience[] editorial framing, not a literal Karl field)'
  return renderCallout({ title: 'Who this is for', variant: 'info', text, karl: karlNote })
}
function renderImage(image) {
  if (!image?.src) return ''
  return `<figure class="content-image">${karlTag(image.karl || 'Information section: Image', 'body')}<img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt || '')}" loading="lazy" />${image.caption ? `<figcaption>${escapeHtml(image.caption)}</figcaption>` : ''}</figure>`
}
/**
 * Resolve what a card's description should actually SAY on the published page.
 *
 * A Karl Services/Resources subsection entry, and a Related-panel entry, is
 * only a page picker — "add an SF.gov page or External link". There is no
 * description field on the card, so whatever a `pages/*.js` card writes into
 * `text` is invisible on SF.gov. The mockup printed it anyway, which meant
 * reviewers were being asked to approve 12 card descriptions that could never
 * publish. Resolving through the shared classifier instead makes the mockup
 * show exactly what Karl will render, and — because the string now comes from
 * the destination page rather than from a second copy on the card — removes
 * the possibility of the two drifting apart at all.
 *
 * The three outcomes, checked in this order:
 *
 * - **title-only** — the Related panel and a Resource Collection's Resource
 *   section render a title and a link and NOTHING else, so there is no
 *   description to resolve for any entry, internal or external.
 * - **inherits** with a resolvable internal target — the destination page's
 *   own `summary`, which is the field Karl reads.
 * - **everything else** — the card's authored `text`. That covers authored
 *   blocks (a table row, a rich-text block), external `url` cards inside an
 *   inheriting section (there is no SF.gov page to inherit from), unclassified
 *   blocks, and a `target` that resolves to nothing. Falling back to authored
 *   text is the safe direction: showing a reviewer copy that exists beats
 *   blanking a card because a `karl` note was worded unfamiliarly.
 *
 * @param {{karl?: string}|null|undefined} section The section holding the card,
 *   or null where the caller cannot supply one (see renderSteps).
 * @param {{text?: string, target?: string, url?: string}} card
 * @returns {string} The description to render, or '' to render none at all.
 */
function cardDescription(section, card) {
  const classify = window.cardInheritance?.classifySection
  const kind = section && typeof classify === 'function' ? classify(section) : 'unknown'
  if (kind === 'title-only') return ''
  if (kind === 'inherits' && card.target && pageData[card.target]) {
    return pageData[card.target].summary ?? ''
  }
  return card.text ?? ''
}
/**
 * Resolve what a card's TITLE should actually say on the published page —
 * the same question cardDescription() answers for the description, and for
 * the same reason. Both `title-only` and `inherits` are page-picker blocks
 * with no label field, so Karl renders the destination page's own Title for
 * every internal entry in either bucket, not just the ones that also carry a
 * description. Before this, only the description half of inheritance was
 * resolved — a card whose authored `title` still matched its destination's
 * title at write time silently drifted the moment a reviewer edited that
 * destination's title through the editor, since nothing here ever re-read it.
 *
 * External (`url`) and `authored`/`unknown` cards keep their own `title`:
 * an external card has no SF.gov page to inherit a title from, and an
 * authored block's title is exactly what the block is for.
 *
 * @param {{karl?: string}|null|undefined} section Same contract as cardDescription().
 * @param {{title: string, target?: string, url?: string}} card
 * @returns {string} The title to render.
 */
function cardTitle(section, card) {
  const classify = window.cardInheritance?.classifySection
  const kind = section && typeof classify === 'function' ? classify(section) : 'unknown'
  if ((kind === 'inherits' || kind === 'title-only') && card.target && pageData[card.target]) {
    return pageData[card.target].title ?? card.title
  }
  return card.title
}
/**
 * What actually happened to THIS card's own fields, derived by diffing
 * cardTitle()/cardDescription()'s already-resolved output against the card's
 * own `title`/`text` — not a second classification. Because it diffs values
 * those two functions already computed for rendering, it cannot disagree
 * with what actually renders: an external `url` card inside an `inherits` or
 * `title-only` section whose own title/text genuinely render (they have no
 * `target`, so neither resolver substitutes anything) correctly gets no fact
 * here, with no special-casing needed — the diff is simply empty.
 *
 * @param {{title?: string, text?: string}} card
 * @param {string} renderedTitle cardTitle(section, card)'s return value
 * @param {string} renderedDesc cardDescription(section, card)'s return value
 * @returns {'title-and-text'|'title'|'text'|null} null when nothing was replaced.
 */
function cardInheritanceFact(card, renderedTitle, renderedDesc) {
  const titleReplaced = Boolean(card.title) && renderedTitle !== card.title
  const textSuppressed = Boolean(card.text) && renderedDesc !== card.text
  if (titleReplaced && textSuppressed) return 'title-and-text'
  if (textSuppressed) return 'text'
  if (titleReplaced) return 'title'
  return null
}
// NO `data-rewrite-field` ON CARD DESCRIPTIONS — deliberately, and this is
// where it must stay decided. The inline-content-editing feature turns any
// element carrying that attribute into a click-to-edit field whose keystrokes
// are written back onto the addressed path of the CURRENT page's object. For
// an inherited description that path would be this card's own `text` — the
// exact field this change exists to prove renders nowhere. The edit would
// appear to work, autosave, and then vanish on the next paint, because the
// paint reads the destination's `summary`. The text a reviewer actually wants
// to change lives on the destination page, where inline editing already
// reaches it. A title-only card has no description to edit at all.
/**
 * Shared card action + description assembly for renderCards() and
 * renderCardList() — the two callers differ only in wrapper markup (article
 * vs li), the external-link rel value, the external-link mark's class, and
 * whether a file-type badge renders; every other card field resolves
 * identically, and had already drifted apart once when duplicated by hand.
 * @param {{karl?: string}|null|undefined} section Same contract as cardDescription().
 * @param {{title: string, target?: string, url?: string, unverified?: boolean, unverifiedReason?: string}} card
 * @param {{relNoreferrer?: boolean, externalMarkClass?: string}} [opts]
 * @returns {{action: string, desc: string, inheritanceFact: 'title-and-text'|'title'|'text'|null}}
 *   desc is '' when there is nothing to show — callers decide whether an
 *   empty desc means no <p> at all. Both `action` and `desc` are ALREADY
 *   escaped, ready-to-interpolate HTML (desc via escapeHtml(), with the
 *   unverified pill already appended) — never pass either through
 *   escapeHtml() again, or the markup double-escapes. `inheritanceFact` is
 *   raw (not HTML) — see cardInheritanceFact().
 */
function cardActionAndDescription(section, card, opts = {}) {
  const { relNoreferrer = false, externalMarkClass = '' } = opts
  const title = cardTitle(section, card)
  const rel = relNoreferrer ? 'noopener noreferrer' : 'noopener'
  const attr = card.url
    ? ` target="_blank" rel="${rel}"`
    : card.target
      ? ` data-render-target="${escapeHtml(card.target)}"`
      : ' data-render-inert=""'
  const markClass = externalMarkClass ? ` class="${externalMarkClass}"` : ''
  const externalMark = card.url ? ` <span${markClass} aria-hidden="true">↗</span>` : ''
  const action = card.url
    ? `<a href="${escapeHtml(safeUrl(card.url))}"${attr}>${escapeHtml(title)}${externalMark}</a>`
    : `<button type="button" class="inline-link"${attr}>${escapeHtml(title)}</button>`
  const descText = cardDescription(section, card)
  const desc = descText
    ? `${escapeHtml(descText)}${card.unverified ? unverifiedPill(card.unverifiedReason) : ''}`
    : ''
  const inheritanceFact = cardInheritanceFact(card, title, descText)
  return { action, desc, inheritanceFact }
}
function renderCards(cards = [], section = null) {
  return `<div class="cards">${cards
    .map((c) => {
      const { action, desc, inheritanceFact } = cardActionAndDescription(section, c)
      return `<article class="card">${karlTag(c.karl || 'Linked page item: title + description + link. Use Related section, body link, Resource Collection item, or Agency page link section as appropriate.', 'placement', { inheritanceFact })}<h3>${action}</h3>${desc ? `<p>${desc}</p>` : ''}</article>`
    })
    .join('')}</div>`
}
// Shared by renderResourcesList() and (via renderServiceTiles' delegation)
// every Services subsection, plus renderRelatedList() (Task 2) — one <li>
// shape for every plain, divided list of linked-page items. Real sf.gov never
// boxes this content (confirmed against 7 live reference pages spanning
// Agency/Transaction/Information/Resource-Collection shapes — see the design
// spec) — renderCards()/.card above is kept only for the one case that isn't
// a full section of links: a Step List's own inline cards (renderSteps()).
function renderCardList(cards = [], section = null) {
  return `<ul>${cards
    .map((c) => {
      const { action, desc, inheritanceFact } = cardActionAndDescription(section, c, {
        relNoreferrer: true,
        externalMarkClass: 'external-mark',
      })
      const fileBadge = c.fileType
        ? `<span class="file-badge">${escapeHtml(c.fileType)}</span>`
        : ''
      const text = desc ? `<p>${desc}</p>` : ''
      return `<li>${karlTag(c.karl || 'Linked page item: title + description + link', 'placement', { inheritanceFact })}${action}${fileBadge}${text}</li>`
    })
    .join('')}</ul>`
}
// heading is no longer a parameter: the caller (renderSection(), via
// renderSectionInner()) already prints section.heading as an <h2> before this
// ever runs, so a second, internal <h3 class="resources-list-heading"> was a
// duplicate heading on every Resources subsection — visible in a live
// screenshot of the mockup's own insectsReport Transaction page as "While you
// wait: tips to help with the problem" printed twice in a row.
function renderResourcesList(cards = [], section = null) {
  if (!cards.length) return ''
  return `<div class="resources-list">${karlTag('Body: Resources links', 'placement')}${renderCardList(cards, section)}</div>`
}
// Services subsections render identically to Resources subsections on real
// sf.gov (a plain divided list, not the boxed 2px-blue-border .service-tile
// grid this used to render) — kept as its own named function, rather than
// calling renderResourcesList directly from renderSectionInner, because
// tests/page-render.test.js and tests/e2e/accessibility.spec.js call it by
// name.
function renderServiceTiles(cards = [], section = null) {
  return renderResourcesList(cards, section)
}
function renderRelatedList(cards = [], heading = 'Related', section = null) {
  if (!cards.length) return ''
  return `<section class="section section--related">${karlTag('Related section: linked pages', 'placement')}<h2>${escapeHtml(heading)}</h2><div class="resources-list">${renderCardList(cards, section)}</div></section>`
}
// Karl's "Partner agencies" field on a Transaction page — a separate H2
// section from the Primary-Agency parent link (renderParentLink()) and from
// Related. Entries point at real sf.gov department pages outside this
// mockup's page set, so `section` is always null here: there is no local
// page to classify title/description inheritance against, matching a plain
// external card (see cardActionAndDescription()).
function renderPartnerAgencies(cards = []) {
  if (!cards.length) return ''
  return `<section class="section section--partner-agencies">${karlTag('Partner agencies: linked departments', 'placement')}<h2>Partner agencies</h2><div class="resources-list">${renderCardList(cards, null)}</div></section>`
}
/**
 * Step cards pass `null` for the section on purpose. A step's cards live inside
 * a Step List block, not in the section's own card list, so the section's
 * `karl` note describes a component they are not part of — and
 * build_scripts/audit-card-inheritance.js walks `section.cards` only, so no
 * live-site verification covers step cards either way. `null` classifies as
 * 'unknown', which keeps their authored text exactly as it renders today.
 *
 * @param {Array<object>} steps
 * @param {string} [pathPrefix] Dot-path of the steps array, e.g. 'sections.2.steps'.
 *   Threaded down to each step's own text/bullets arrays as
 *   '<pathPrefix>.<stepIndex>.text' / '.bullets'.
 * @returns {string}
 */
function renderSteps(steps = [], pathPrefix = '') {
  return `<ol class="step-list">${steps
    .map(
      (s, index) =>
        `<li class="step"><div>${karlTag(s.karl || 'Step List: body step', s.button ? 'placement' : 'body')}<h3>${escapeHtml(s.title)}</h3>${paragraphList(s.text || [], pathPrefix ? `${pathPrefix}.${index}.text` : '')}${bulletList(s.bullets || [], pathPrefix ? `${pathPrefix}.${index}.bullets` : '')}${s.cards ? renderCards(s.cards, null) : ''}${s.button ? button(s.button, 'secondary', s.buttonTarget || null, s.buttonUrl || null) : ''}${s.callout ? renderCallout(s.callout) : ''}</div></li>`
    )
    .join('')}</ol>`
}
function isCodeTranslationTable(head = []) {
  return head.length === 2 && head[0] === 'Health code' && head[1] === 'In plain language'
}
function renderTable(rows = [], pageType = 'generic', caption = '') {
  if (!rows.length) return ''
  const [head, ...body] = rows
  const codeTranslation = isCodeTranslationTable(head)
  const previewNote =
    pageType === 'information'
      ? `<p class="mockup-only-note">${karlTag('Editor QA: Report-only table preview on Information page', 'editor')}Tables are native to the <strong>Report</strong> content type in Karl, not Information. Use card-based routing or a linked Resource Collection in production.</p>`
      : ''
  const tableClass = codeTranslation ? 'table table--code-translation' : 'table'
  const table = `<table class="${tableClass}"><thead><tr>${head
    .map((h) => `<th scope="col">${formatMarkdown(h)}</th>`)
    .join('')}</tr></thead><tbody>${body
    .map(
      (r) =>
        `<tr>${r
          .map((c, i) => {
            const scope = codeTranslation && i === 0 ? ' scope="row"' : ''
            return `<td${scope}>${formatMarkdown(c)}</td>`
          })
          .join('')}</tr>`
    )
    .join('')}</tbody></table>`
  if (codeTranslation && caption) {
    return `${previewNote}<figure class="code-translation-figure"><figcaption class="visually-hidden">${escapeHtml(caption)}</figcaption>${table}</figure>`
  }
  return `${previewNote}${table}`
}
function resolveWhatToKnow(page) {
  if (page.whatToKnow) return page.whatToKnow
  if (normalizePageType(page.type) !== 'transaction') return null
  return {
    cost: 'Free',
    thingsToKnow: [
      'You can ask 311 for help in your language.',
      'It can take a few weekdays for 311 to assign an inspector after you report.',
    ],
  }
}
function resolveContact(page) {
  if (page.contact) return page.contact
  const pageType = normalizePageType(page.type)
  if (pageType !== 'transaction' && pageType !== 'information') return null
  return {
    phone: ['311 (call or text)'],
    email: ['ehb@sfdph.org'],
    other: ['Environmental Health — Healthy Housing and Vector Control'],
  }
}
function renderWhatToKnow(whatToKnow, page) {
  const data = whatToKnow || resolveWhatToKnow(page)
  if (!data) return ''
  const cost = data.cost || (normalizePageType(page.type) === 'transaction' ? 'Free' : '')
  const things = data.thingsToKnow || data.items || []
  const normalizedThings = Array.isArray(things)
    ? things.map((item) =>
        typeof item === 'string'
          ? { label: '', text: item }
          : { label: item.label || '', text: item.text || '' }
      )
    : []
  // "Who this page is for" is folded in here from page.audience rather than
  // duplicated as authored thingsToKnow text, so the audience list has one
  // source of truth and can't drift between the two.
  const audienceItems = Array.isArray(page.audience) ? page.audience : []
  const audienceHtml = audienceItems.length
    ? `<div class="what-to-know-subsection"><h3>Who this is for</h3><ul>${renderAudience(audienceItems)}</ul></div>`
    : ''
  const costHtml = cost
    ? `<div class="what-to-know-subsection what-to-know-cost"><h3>Cost</h3><p>${escapeHtml(cost)}</p></div>`
    : ''
  // Real sf.gov renders each "Things to know" entry as its own named H3
  // subsection (e.g. "What to report", "Response time varies" — confirmed
  // against 4 live Transaction pages). A labeled entry gets that treatment;
  // an unlabeled one has no name to give its own heading, so those fall back
  // to one shared "Things to know" list, same as before this change.
  const labeledHtml = normalizedThings
    .filter((t) => t.label)
    .map(
      (t) =>
        `<div class="what-to-know-subsection"><h3>${escapeHtml(t.label)}</h3><p>${formatMarkdown(t.text)}</p></div>`
    )
    .join('')
  const unlabeled = normalizedThings.filter((t) => !t.label).map((t) => t.text)
  const unlabeledHtml = unlabeled.length
    ? `<div class="what-to-know-subsection"><h3>Things to know</h3>${renderTextItems(unlabeled)}</div>`
    : ''
  const body = `${audienceHtml}${costHtml}${labeledHtml}${unlabeledHtml}`
  if (!body) return ''
  return `<section class="what-to-know">${karlTag('What to know before you start: Who this is for, Cost, and Things to know', 'body')}<h2 class="what-to-know-heading"><span class="what-to-know-icon" aria-hidden="true">ⓘ</span>What to know</h2>${body}</section>`
}
function renderContactSection(contact, page) {
  const data = contact || resolveContact(page)
  if (!data) return ''
  const blocks = []
  if (data.address) blocks.push(`<h3>Address</h3><p>${escapeHtml(data.address)}</p>`)
  if (data.phone?.length)
    blocks.push(`<h3>Phone</h3><p>${data.phone.map((p) => escapeHtml(p)).join('<br>')}</p>`)
  if (data.email?.length)
    blocks.push(`<h3>Email</h3><p>${data.email.map((e) => escapeHtml(e)).join('<br>')}</p>`)
  if (data.hours) blocks.push(`<h3>Hours</h3><p>${escapeHtml(data.hours)}</p>`)
  if (data.other?.length)
    blocks.push(`<h3>Other</h3><p>${data.other.map((o) => escapeHtml(o)).join('<br>')}</p>`)
  if (data.social?.length) {
    const links = data.social
      .map(
        (s) =>
          `<a href="${escapeHtml(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.platform)}</a>`
      )
      .join(' ')
    blocks.push(`<h3>Social media</h3><p>${links}</p>`)
  }
  return `<section class="contact-section section">${karlTag('Contact section', 'placement')}<h2>Contact us</h2>${blocks.join('')}</section>`
}
// A boxed "Spotlight" block: light-blue box, title + description + optional
// button, built from a mockup section object rather than the dedicated
// top-level `page.spotlight` field renderSpotlight() reads. Originally built
// for Campaign's Spotlight 1/Spotlight 2 (each independently repeatable —
// confirmed live: sf.gov/shop-dine-sf uses 2 instances) and reused as-is for
// Topic's own Spotlight block, confirmed the identical shape live
// (sf.gov/topics--healthy-housing-conditions). Both types represent this as
// an ordinary section tagged `component: 'spotlight'` rather than a
// dedicated top-level array field.
function renderSpotlightSection(section) {
  const base =
    typeof section.__sectionIndex === 'number' ? `sections.${section.__sectionIndex}` : ''
  const headingPathAttr = base ? ` data-rewrite-field="${base}.heading"` : ''
  const cta = section.button
    ? button(section.button, 'primary', section.buttonTarget || null, section.buttonUrl || null)
    : ''
  return `<section class="spotlight-section">${karlTag(section.karl || 'Spotlight', 'placement')}<div class="spotlight-section-inner"><h2${headingPathAttr}>${escapeHtml(section.heading)}</h2>${paragraphList(section.paragraphs || [], base ? `${base}.paragraphs` : '')}${section.callout ? renderCallout(section.callout) : ''}${cta}</div></section>`
}
// Karl's Campaign "Top facts" widget: a boxed panel of named facts, reusing
// the exact `what-to-know-subsection` H3-per-item markup/CSS
// renderWhatToKnow() established for Transaction's "What to know" box —
// visually and structurally the same shape, just keyed off a section's own
// `facts` array instead of `page.whatToKnow`.
function renderTopFacts(section) {
  const facts = Array.isArray(section.facts) ? section.facts : []
  if (!facts.length) return ''
  const base =
    typeof section.__sectionIndex === 'number' ? `sections.${section.__sectionIndex}` : ''
  const headingPathAttr = base ? ` data-rewrite-field="${base}.heading"` : ''
  const factsHtml = facts
    .map(
      (f) =>
        `<div class="what-to-know-subsection"><h3>${escapeHtml(f.label)}</h3><p>${formatMarkdown(f.text)}${f.unverified ? unverifiedPill(f.unverifiedReason) : ''}</p></div>`
    )
    .join('')
  return `<section class="top-facts">${karlTag(section.karl || 'Top facts', 'body')}<h2${headingPathAttr}>${escapeHtml(section.heading)}</h2>${paragraphList(section.paragraphs || [], base ? `${base}.paragraphs` : '')}${factsHtml}</section>`
}
function renderOnThisPage(sections = []) {
  const headings = sections
    .filter((s) => s.heading && inferSectionRole(s, 'information') === 'body')
    .map((s) => s.heading)
  if (headings.length < 2) return ''
  return `<nav class="on-this-page" aria-label="On this page">${karlTag('Auto-generated On this page navigation from H2 headings', 'body')}<h2 class="on-this-page-title">On this page</h2><ul>${headings
    .map((h) => `<li><a href="#${sectionAnchorId(h)}">${escapeHtml(h)}</a></li>`)
    .join('')}</ul></nav>`
}
function renderAccordionSection(section, pageType) {
  const panelId = sectionAnchorId(section.heading)
  // `open: true` renders the accordion expanded on load — used for content the
  // reviewer must see without a click (e.g. the report pages' "While you wait"
  // IPM tips); the toggle still works normally afterwards.
  const expanded = section.open === true
  return `<div class="accordion-item"><button type="button" class="accordion-trigger" data-accordion-toggle aria-expanded="${expanded ? 'true' : 'false'}" aria-controls="${panelId}">${escapeHtml(section.heading)}</button><div class="accordion-panel" id="${panelId}"${expanded ? '' : ' hidden'}>${renderSectionInner(section, pageType)}</div></div>`
}
// Karl's Supporting information block also allows a plain "Custom section"
// (Body, Main body, Text and title) alongside Accordion blocks — same H3
// visual level as an accordion trigger, but no toggle/ARIA-expanded chrome
// (confirmed live: sf.gov/report-health-nuisance-or-hazards's "Other ways to
// report" sits flat next to two real accordions). renderSection() renders a
// section.heading as h2, so this is its own small function rather than
// reusing renderSection() directly.
function renderCustomSection(section, pageType) {
  const anchor = section.heading ? ` id="${sectionAnchorId(section.heading)}"` : ''
  return `<div class="custom-section"><h3${anchor}>${escapeHtml(section.heading)}</h3>${renderSectionInner(section, pageType)}</div>`
}
function renderSectionInner(section, pageType = 'generic') {
  let inner = ''
  // section.__sectionIndex is the source-order index partitionSections()
  // stamped onto its render-time copy. It is absent for anything that didn't
  // pass through that partition loop (e.g. a bare section object built by a
  // test or a future caller), so the path prefix — and the attribute it
  // enables — degrades to nothing rather than guessing at a position.
  const base =
    typeof section.__sectionIndex === 'number' ? `sections.${section.__sectionIndex}` : ''
  inner += paragraphList(section.paragraphs || [], base ? `${base}.paragraphs` : '')
  inner += section.steps ? renderSteps(section.steps, base ? `${base}.steps` : '') : ''
  inner += bulletList(section.bullets || [], base ? `${base}.bullets` : '')
  inner += section.image ? renderImage(section.image) : ''
  inner += section.table ? renderTable(section.table, pageType, section.heading || '') : ''
  if (section.callout) inner += renderCallout(section.callout)
  if (section.button)
    inner += button(
      section.button,
      section.buttonStyle || 'primary',
      section.buttonTarget || null,
      section.buttonUrl || null
    )
  // The section travels with its cards so cardDescription() can ask its `karl`
  // note whether each description is inherited from the destination page.
  // Services, Resources, and every other card-bearing section now render
  // through the same plain-list path — renderCards()/.card is reserved for
  // a Step List's own inline cards (renderSteps(), a different, smaller
  // case with no section of its own to duplicate a heading against).
  if (section.cards) inner += renderResourcesList(section.cards, section)
  return inner
}
function renderSection(section, pageType = 'generic', options = {}) {
  const kind = section.kind || 'body'
  const role = inferSectionRole(section, pageType)
  const anchor = section.heading ? ` id="${sectionAnchorId(section.heading)}"` : ''
  const tag = options.skipKarl ? '' : karlTag(section.karl || 'Body section', kind)
  const headingPathAttr =
    typeof section.__sectionIndex === 'number'
      ? ` data-rewrite-field="sections.${section.__sectionIndex}.heading"`
      : ''
  const heading =
    role === 'what-to-do' && pageType === 'transaction'
      ? `<h2 class="what-to-do-heading">What to do</h2>`
      : section.heading
        ? `<h2${anchor}${headingPathAttr}>${escapeHtml(section.heading)}</h2>`
        : ''
  const inner = `${tag}${heading}${renderSectionInner(section, pageType)}`
  const cls =
    role === 'what-to-do'
      ? 'section section--what-to-do'
      : role === 'supporting'
        ? 'section section--supporting'
        : role === 'services'
          ? 'section section--services'
          : role === 'resources'
            ? 'section section--resources'
            : 'section'
  return `<section class="${cls}">${inner}</section>`
}
// Karl's Services/Resources block is Title + Links, repeatable — a Topic or
// Agency page can carry more than one, each becoming its own named
// sub-group (e.g. "General housing issues", "Lead poisoning issues" —
// confirmed live on sf.gov/topics--healthy-housing-conditions, 2 and 3
// sub-groups respectively). Their heading renders as H3 here rather than
// through renderSection()'s always-H2 default, since it nests one level
// under the region's own H2 "Services"/"Resources" wrapper. Matches
// renderCustomSection()'s established no-karl-tag-badge pattern for the
// same reason: renderSectionInner() never adds one itself.
function renderServiceGroup(section, pageType) {
  const anchor = section.heading ? ` id="${sectionAnchorId(section.heading)}"` : ''
  return `<div class="service-group"><h3${anchor}>${escapeHtml(section.heading)}</h3>${renderSectionInner(section, pageType)}</div>`
}
function renderServicesRegion(sections, pageType, karlLabel = 'Topic page Services section') {
  if (!sections.length) return ''
  return `<div class="services-region">${karlTag(karlLabel, 'placement')}<h2 class="region-title">Services</h2>${sections.map((s) => renderServiceGroup(s, pageType)).join('')}</div>`
}
function renderResourcesRegion(sections, pageType, karlLabel = 'Topic page Resources section') {
  if (!sections.length) return ''
  return `<div class="resources-region">${karlTag(karlLabel, 'placement')}<h2 class="region-title">Resources</h2>${sections.map((s) => renderServiceGroup(s, pageType)).join('')}</div>`
}
function renderSpotlight(spotlight) {
  if (!spotlight) return ''
  const img = spotlight.image
    ? `<div class="spotlight-media"><img src="${escapeHtml(spotlight.image.src)}" alt="${escapeHtml(spotlight.image.alt || '')}" width="${parseInt(spotlight.image.width, 10) || 800}" height="${parseInt(spotlight.image.height, 10) || 533}" fetchpriority="high" decoding="async" /></div>`
    : ''
  const cta = spotlight.button
    ? button(
        spotlight.button,
        'primary',
        spotlight.buttonTarget || null,
        spotlight.buttonUrl || null
      )
    : ''
  return `<section class="spotlight">${karlTag(spotlight.karl || 'Spotlight', 'placement')}<div class="spotlight-inner">${img}<div class="spotlight-copy"><h2>${escapeHtml(spotlight.title || '')}</h2>${paragraphList(spotlight.paragraphs || [])}${cta}</div></div></section>`
}
function resolveHeroCta(page, whatToDoSections) {
  if (normalizePageType(page.type) !== 'transaction') return null
  const label = typeof getPrimaryCta === 'function' ? getPrimaryCta(page) : page.primaryCta || ''
  if (!label) return null
  let target = null
  let url = null
  for (const section of whatToDoSections) {
    for (const step of section.steps || []) {
      if (step.button === label) {
        target = step.buttonTarget || null
        url = step.buttonUrl || null
        break
      }
    }
  }
  return { label, target, url }
}
function renderHero(page, heroCta) {
  const ctaAttr = heroCta ? ' data-rewrite-field="primaryCta"' : ''
  const ctaHtml = heroCta
    ? `<div class="hero-cta"${ctaAttr}>${button(heroCta.label, 'primary', heroCta.target, heroCta.url)}</div>`
    : ''
  const heroClass =
    normalizePageType(page.type) === 'transaction' ? 'hero hero--transaction' : 'hero'
  // Only the Agency/Topic-shaped reference page (healthy-housing-conditions)
  // showed a "TOPIC" eyebrow at all — the Transaction and Information
  // references show none. Rather than one gray label on every page type,
  // this now matches per-type: colored and present on Agency, absent
  // elsewhere.
  // Every sampled live Transaction page shows a plain "Service" label above
  // the H1 — literal text, not page.type: Karl's front-end label for this
  // content type reads "Service" even though the type itself is "Transaction"
  // (confirmed against 4 live pages, including sf.gov/report-health-nuisance-or-hazards).
  const pageTypeNormalized = normalizePageType(page.type)
  const eyebrowHtml =
    pageTypeNormalized === 'agency' || pageTypeNormalized === 'topic'
      ? // Agency and Topic share this exact visible, colored eyebrow —
        // confirmed live on sf.gov/topics--housing and
        // sf.gov/topics--healthy-housing-conditions (orange "TOPIC" above
        // the H1), matching the treatment already built for Agency.
        `${karlTag('Metadata: Karl page type', 'meta')}<div class="eyebrow eyebrow--agency">${escapeHtml(page.type)}</div>`
      : pageTypeNormalized === 'transaction'
        ? `${karlTag('Metadata: Karl page type (renders as "Service")', 'meta')}<div class="eyebrow eyebrow--service">Service</div>`
        : pageTypeNormalized === 'campaign'
          ? // Confirmed via 2 live Campaign pages (sf.gov/shop-dine-sf,
            // sf.gov/1865-til-infinity): no visible eyebrow text renders
            // above the H1, unlike Transaction's visible "Service" label.
            `${karlTag('Metadata: Karl page type (screen-reader-only)', 'meta')}<p class="visually-hidden">Campaign</p>`
          : pageTypeNormalized === 'about'
            ? // Confirmed live (sf.gov/departments--controllers-office--about):
              // no visible eyebrow above "About {name}" either.
              `${karlTag('Metadata: Karl page type (screen-reader-only)', 'meta')}<p class="visually-hidden">About us</p>`
            : ''
  // Campaign and About us both show no visible summary/description in the
  // hero (confirmed live for About us against the Controller's Office page:
  // just the H1 and the "Back to main page" link — renderParentLink()
  // already provides that link for every non-Agency page, unchanged).
  // `page.summary` stays required in the schema for SEO/list-preview use.
  const summaryHtml =
    pageTypeNormalized === 'campaign' || pageTypeNormalized === 'about'
      ? ''
      : `${karlTag('Short summary / Description field', 'meta')}<p class="summary" data-rewrite-field="summary">${escapeHtml(page.summary)}</p>`
  return `<section class="${heroClass}"><div class="hero-inner">${eyebrowHtml}${karlTag('Page title field', 'meta')}<h1 tabindex="-1" data-rewrite-field="title">${escapeHtml(page.title)}</h1>${summaryHtml}${ctaHtml}</div></section>`
}
// Every one of the 7 sf.gov reference pages audited for this pass shows one
// link back to its owning program (e.g. "Environmental Health"), never a
// breadcrumb trail. Rather than a new per-page schema field authored across
// 27 files for a link that reads the same on 26 of them, this derives it:
// every page except the Agency page is a child of HHVC in this site's actual
// structure, so it always links there. Reads the Agency page's live title
// from pageData rather than a literal, so an inline title edit to pestsTopic
// stays in sync with this link's label without a second place to update it.
function renderParentLink(page, key) {
  if (key === 'pestsTopic') return ''
  const label = pageData.pestsTopic?.title || 'Healthy Housing and Vector Control'
  return `<nav class="page-parent-link" aria-label="Parent program"><a href="#" data-render-target="pestsTopic">${escapeHtml(label)}</a></nav>`
}
function renderPrintVersion(url) {
  if (!url) return ''
  return `<p class="print-version-link">${karlTag('Report Print version field', 'placement')}<a href="${escapeHtml(safeUrl(url))}" target="_blank" rel="noopener noreferrer">Print version <span aria-hidden="true">↗</span></a></p>`
}
function renderPageMain(page) {
  const parts = partitionSections(page)
  const {
    pageType,
    intro,
    services,
    resources,
    related,
    whatToDo,
    supporting,
    spotlight,
    topFacts,
    body,
  } = parts
  const heroCta = resolveHeroCta(page, whatToDo)
  let html = renderHero(page, heroCta)
  html += `<main class="page-body page-body--${pageType}">`
  html += editorQaBlock(page)
  if (page.spotlight && normalizePageType(page.type) === 'report') {
    html += renderSpotlight(page.spotlight)
  }
  // Transaction pages fold "who this page is for" into the What to know
  // block's Things to know list instead of a standalone section — see
  // renderWhatToKnow() below.
  if (pageType !== 'transaction') {
    html += renderAudienceFraming(page, pageType)
  }
  // Agency pages render their spotlight mid-page (between Section title 1 and
  // 2, matching the real Karl field order), so skip the early placement here.
  if (page.spotlight && !['report', 'agency'].includes(normalizePageType(page.type))) {
    html += renderSpotlight(page.spotlight)
  }
  if (pageType === 'transaction') {
    html += renderWhatToKnow(page.whatToKnow, page)
    whatToDo.forEach((s) => {
      html += renderSection(s, pageType)
    })
    if (supporting.length) {
      html += `<div class="supporting-info">${karlTag('Supporting information: Accordions and custom sections', 'body')}<h2 class="visually-hidden">Supporting information</h2>`
      supporting.forEach((s) => {
        html += s.flat ? renderCustomSection(s, pageType) : renderAccordionSection(s, pageType)
      })
      html += `</div>`
    }
    body.forEach((s) => {
      html += renderSection(s, pageType)
    })
    related.forEach((s) => {
      html += renderRelatedList(s.cards || [], s.heading || 'Related', s)
    })
    html += renderPartnerAgencies(page.partnerAgencies || [])
    html += renderContactSection(page.contact, page)
  } else if (pageType === 'information' || pageType === 'report') {
    const infoBody = [
      ...body,
      ...supporting.filter((s) => inferSectionRole(s, pageType) === 'body'),
    ]
    html += renderOnThisPage(infoBody)
    infoBody.forEach((s) => {
      html += renderSection(s, pageType)
    })
    if (pageType === 'information') {
      resources.forEach((s) => {
        html += renderSection({ ...s, component: 'resources' }, pageType)
      })
    }
    if (pageType === 'report') {
      html += renderPrintVersion(page.printVersionUrl)
    }
  } else if (pageType === 'topic') {
    // Matches the real Karl Topic field order confirmed live
    // (sf.gov/topics--healthy-housing-conditions): Spotlight, then Services
    // and Resources (each possibly carrying multiple named sub-groups via
    // renderServicesRegion()/renderResourcesRegion()'s own H3 handling),
    // then Partner agencies. Related renders in the shared tail below.
    spotlight.forEach((s) => {
      html += renderSpotlightSection(s)
    })
    intro.forEach((s) => {
      html += renderSection(s, pageType)
    })
    html += renderServicesRegion(services, pageType)
    html += renderResourcesRegion(resources, pageType)
    html += renderPartnerAgencies(page.partnerAgencies || [])
  } else if (pageType === 'agency') {
    // Mirrors the real Karl Agency field order: Description/Quick links intro,
    // Section title 1 (Services), Spotlight 1, Section title 2 (Resources),
    // then About and other body sections. Contact us renders in the shared
    // tail below, alongside the related list.
    intro.forEach((s) => {
      html += renderSection(s, pageType)
    })
    html += renderServicesRegion(
      services,
      pageType,
      'Agency page Section title 1: Services + Subsection links'
    )
    html += renderSpotlight(page.spotlight)
    html += renderResourcesRegion(
      resources,
      pageType,
      'Agency page Section title 2: Resources + Subsection links'
    )
    body.forEach((s) => {
      html += renderSection(s, pageType)
    })
  } else if (pageType === 'resource-collection') {
    intro.forEach((s) => {
      html += renderSection(s, pageType)
    })
    resources.forEach((s) => {
      html += renderSection({ ...s, component: 'resources' }, pageType)
    })
  } else if (pageType === 'about') {
    // Karl's "About us" type is genuinely simple (Title, Primary agency,
    // Information, Resources — live-admin-confirmed, no Related/Partner
    // agencies/Contact us fields). Confirmed live
    // (sf.gov/departments--controllers-office--about): Information renders
    // as plain top-level H2 sections ("Who we are", "What we do", "Our
    // divisions" — no wrapping region heading, unlike Services/Resources),
    // so the body bucket's default renderSection() already matches with no
    // extra component needed. Resources reuses the exact H3-sub-group
    // component built for Topic.
    body.forEach((s) => {
      html += renderSection(s, pageType)
    })
    html += renderResourcesRegion(resources, pageType, 'About us page Resources section')
  } else if (pageType === 'campaign') {
    // Mirrors the real Karl Campaign field order confirmed live
    // (sf.gov/shop-dine-sf): Spotlight(s), Additional-content Accordions,
    // Top facts, About/other body content, Related, Partner agencies,
    // Contact us last. Accordion rendering reuses the exact code path
    // Transaction's Supporting information already uses — same component.
    spotlight.forEach((s) => {
      html += renderSpotlightSection(s)
    })
    if (supporting.length) {
      html += `<div class="supporting-info">${karlTag('Additional content: Accordion sections', 'body')}<h2 class="visually-hidden">Additional content</h2>`
      supporting.forEach((s) => {
        html += s.flat ? renderCustomSection(s, pageType) : renderAccordionSection(s, pageType)
      })
      html += `</div>`
    }
    topFacts.forEach((s) => {
      html += renderTopFacts(s)
    })
    body.forEach((s) => {
      html += renderSection(s, pageType)
    })
    related.forEach((s) => {
      html += renderRelatedList(s.cards || [], s.heading || 'Related', s)
    })
    html += renderPartnerAgencies(page.partnerAgencies || [])
    html += renderContactSection(page.contact, page)
  } else {
    ;[...body, ...whatToDo, ...supporting, ...intro, ...services, ...resources].forEach((s) => {
      html += renderSection(s, pageType)
    })
  }
  if (pageType === 'information') {
    related.forEach((s) => {
      html += renderRelatedList(s.cards || [], s.heading || 'Related', s)
    })
    html += renderContactSection(page.contact, page)
  }
  if (pageType === 'topic' || pageType === 'agency' || pageType === 'resource-collection') {
    related.forEach((s) => {
      html += renderRelatedList(s.cards || [], s.heading || 'Related', s)
    })
  }
  if (pageType === 'agency') {
    html += renderContactSection(page.contact, page)
  }
  html += `</main>`
  return html
}
function applyPageContent(key) {
  const page = pageData[key]
  if (!page) return
  saveSidebarScroll()
  setCurrentPageKey(key)
  document.getElementById('browserUrl').textContent = 'https://' + page.slug
  const urlInput = document.getElementById('urlInput')
  if (urlInput) urlInput.value = page.slug
  document.getElementById('pageSelect').value = key
  const pageHtml = renderPageMain(page)
  document.getElementById('mockPage').innerHTML = `
        <header class="site-header">
          <div class="site-header-inner">
            <a href="#" class="brand">
              <span class="brand-mark">SF</span>
              <span>SF.gov</span>
            </a>
            <nav class="site-nav" aria-label="Example navigation">
              <a href="#">Services <span aria-hidden="true">▼</span></a>
              <a href="#">Departments <span aria-hidden="true">▼</span></a>
              <a href="#">Jobs</a>
              <a href="#">Contact <span aria-hidden="true">▼</span></a>
              <a href="#">🌐 English <span aria-hidden="true">▼</span></a>
              <div class="site-search">
                <input type="text" placeholder="Search">
                <button type="button" aria-label="Search">🔍</button>
              </div>
            </nav>
          </div>
        </header>
        ${renderParentLink(page, key)}
        ${pageHtml}
        <div class="mockup-banner">This is a design mockup for HHVC content review, not a live SF.gov page.</div>
        <footer class="footer">
          <div class="footer-inner">
            <div class="footer-brand">
               <div class="footer-brand-row">
                 <span class="footer-brand-mark" aria-hidden="true"></span>
                 <strong class="footer-brand-name">City and County of<br>SAN FRANCISCO</strong>
               </div>
               <ul class="footer-social">
                 <li><a href="#" aria-label="Facebook"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12Z"/></svg></a></li>
                 <li><a href="#" aria-label="Instagram"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r="0.9" fill="currentColor" stroke="none"/></svg></a></li>
                 <li><a href="#" aria-label="Threads"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12.2 6.6c3.4 0 5.4 2.1 5.6 5.6.1 1.9-.2 4.7-3.3 5.9-1 .4-2.1.5-3.1.2-1.9-.5-2.9-1.8-2.9-3.1 0-1.8 1.8-2.9 4.3-2.9 1.6 0 2.9.3 3.9.9"/></svg></a></li>
                 <li><a href="#" aria-label="X"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor"><path d="M13.9 10.9 21 3h-2.2l-6.1 6.9L7.8 3H3l7.4 10.6L3 21h2.2l6.5-7.3L17.2 21H22l-8.1-10.1Z"/></svg></a></li>
                 <li><a href="#" aria-label="Bluesky"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor"><path d="M12 10.8C10.3 7.4 6.9 4.6 4.4 4c-1.1-.3-1.7.4-1.4 1.5.4 1.7 1.7 6.1 3.3 7.9 1.2 1.4 2.6 1.7 4.1.9-1 1.7-1.8 3.4-.4 4.6 1.3 1.1 2.6-.1 3.1-1.8.1-.4.2-.4.3 0 .5 1.7 1.8 2.9 3.1 1.8 1.4-1.2.6-2.9-.4-4.6 1.5.8 2.9.5 4.1-.9 1.6-1.8 2.9-6.2 3.3-7.9.3-1.1-.3-1.8-1.4-1.5-2.5.6-5.9 3.4-7.6 6.8Z"/></svg></a></li>
               </ul>
            </div>
            <div class="footer-columns">
               <div>
                 <h4>Our City</h4>
                 <ul>
                   <li><a href="#">Services</a></li>
                   <li><a href="#">Departments</a></li>
                   <li><a href="#">Jobs</a></li>
                   <li><a href="#">City Hall</a></li>
                 </ul>
               </div>
               <div>
                 <h4>Policy</h4>
                 <ul>
                   <li><a href="#">Privacy policy</a></li>
                   <li><a href="#">Disclaimer</a></li>
                 </ul>
               </div>
               <div>
                 <h4>Get help</h4>
                 <ul>
                   <li><a href="#">Contact the City</a></li>
                   <li><a href="#">Report a problem</a></li>
                   <li><a href="#">Contact 311</a></li>
                   <li><a href="#">Accessibility</a></li>
                 </ul>
               </div>
            </div>
          </div>
          <div class="footer-watermark" aria-hidden="true"></div>
        </footer>`
  syncEditorFields(page)
  updateReadingTarget(page)
  applyChecklistState(key)
  restoreSidebarScroll()
}
function renderPage(key, skipHistory = false) {
  // Resolve unknown/retired keys instead of silently no-op'ing and leaving
  // the static "Loading…" placeholder on screen. resolveInitialPageKey()
  // already covers the first URL load; this path covers every later caller
  // (page picker, inline mockup links, review queue, keyboard shortcuts).
  if (!pageData[key]) {
    const result =
      typeof resolvePageKey === 'function'
        ? resolvePageKey(key, pageData, window.HHVC_DELETED_PAGE_ALIASES, 'pestsTopic')
        : { key: 'pestsTopic', status: 'unknown', from: key }
    if (typeof showToast === 'function') {
      if (result.status === 'aliased' && pageData[result.key]) {
        showToast(
          `That page has been consolidated. Showing "${pageData[result.key].title}" instead.`,
          'info'
        )
      } else if (result.status === 'unknown') {
        const requested = result.from || key || 'unknown'
        showToast(
          `"${requested}" is not a page in this mockup. Showing the default page instead.`,
          'info'
        )
        if (typeof showErrorBanner === 'function') {
          showErrorBanner(
            `Unknown page key "${requested}". Opened the default page instead so you can keep reviewing.`
          )
        }
      }
    }
    if (!pageData[result.key]) return
    key = result.key
  }
  if (!skipHistory) {
    const url = new URL(window.location)
    url.searchParams.set('page', key)
    window.history.pushState({ key }, '', url)
  }
  function focusRenderedPageHeading() {
    document.querySelector('#mockPage h1')?.focus()
  }
  if (!document.startViewTransition) {
    applyPageContent(key)
    focusRenderedPageHeading()
    return
  }
  const transition = document.startViewTransition(() => applyPageContent(key))
  transition.ready.catch(() => {})
  transition.finished
    .then(() => {
      focusRenderedPageHeading()
    })
    .catch((err) => {
      if (err?.name !== 'AbortError') throw err
    })
  return transition.updateCallbackDone.catch((err) => {
    if (err?.name !== 'AbortError') throw err
  })
}

/* Republished as a browser global. This one is load-bearing in a way the
   others are not: js/ux-improvements.js wraps `window.renderPage` to refresh
   itself after every navigation — reading the current value, closing over it,
   and reassigning the wrapper (guarded by its own `__…Wrapped` flag so the
   chain builds exactly once).

   There were three wrappers. js/interactive-sitemap.js is gone, and
   js/manager-review-export.js's existed only to refresh a "Current page:"
   sidebar label that has since been cut, so it went with the label. The
   remaining one still needs the original on `window`, which the old shared
   script scope provided for free. Without this line its
   `typeof window.renderPage !== 'function'` guard returns early, the wrapper
   silently no-ops, and navigation stops updating the review bar — while the
   page itself still renders, so nothing looks broken. */
window.renderPage = renderPage

/* Also published for js/ai-assist-render.js, which calls it to preview an
   AI-drafted page object without touching pageData or the live mockup.

   That module is a self-mounting IIFE with no imports (like the other
   review/UX layers), so it reaches this through `window` — and the call sits
   inside a try/catch that turns any throw into "Could not preview this
   draft". Without this line the bare reference is a ReferenceError under ES
   modules, the catch swallows it, and the preview silently degrades to an
   error string while everything else keeps working. That matters more than
   usual here: renderPageMain is the escaping-audited renderer
   (tests/page-render.test.js), and it is deliberately the only path allowed
   to render untrusted model output. */
window.renderPageMain = renderPageMain

export {
  bulletList,
  button,
  karlTag,
  renderPageMain,
  paragraphList,
  renderAudience,
  renderCards,
  renderPage,
  renderParentLink,
  renderRelatedList,
  renderResourcesList,
  renderSection,
  renderServiceTiles,
  renderSpotlightSection,
  renderSteps,
  renderTable,
  renderTextItems,
  renderTopFacts,
}
