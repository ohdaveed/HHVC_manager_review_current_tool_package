// Mockup page rendering: turns page-data.js page objects into the HTML shown
// in #mockPage, including Karl placement/rationale tags. Depends on
// js/core/state.js (escapeHtml, pageData) and js/review/editor-panel.js /
// js/review/ui-controls.js for the post-render side effects triggered by
// applyPageContent (syncEditorFields, etc.).

import {
  applyChecklistState,
  restoreSidebarScroll,
  saveSidebarScroll,
  showToast,
} from '../review/ui-controls.js'
import { currentPageKey, pageData, setCurrentPageKey } from '../core/state.js'
import {
  escapeHtml,
  getPrimaryCta,
  resolvePageKey,
  safeUrl,
  showErrorBanner,
  safeMarkdown,
} from '../core/utils.js'
import {
  karlKindMeta,
  nextKarlGuideId,
  normalizeKarlGuide,
  parseKarlLabel,
  renderKarlGuidePanel,
} from './karl-tag-meta.js'
import { karlCategory } from './karl-category.js'
import { syncEditorFields, updateReadingTarget } from '../review/editor-panel.js'
// Side-effect import: js/core/card-inheritance.js publishes window.cardInheritance
// and exports nothing, so this is what guarantees the classifier exists before
// any card renders. js/main.js lists it ahead of this file too, but that list
// is documentation — this import is the enforcement.
import '../core/card-inheritance.js'
// Maps cardInheritanceFact()'s three outcomes to the badge text a reviewer
// sees on a card's tag — the only place this vocabulary is spelled out.
const INHERIT_BADGE_TEXT = {
  'title-and-text': 'Card title + text inherited from linked page',
  text: "Card text field won't publish",
  title: 'Card title inherited from linked page',
}

/* Render subscribers, in registration order — one list per channel.
 *
 * This exists so nothing has to monkey-patch renderPage. A subscriber that
 * needs to run around navigation registers here; page-render calls it and never
 * learns who it was. The dependency therefore points from the subscriber to
 * this module, which is what keeps the import graph acyclic. Replaces the
 * js/review/ux-improvements.js monkey-patch that used to reassign
 * window.renderPage to a wrapper. Measurement made `window.renderPage` the
 * largest single contributor to this codebase's one window-graph cycle; the
 * exact figures once quoted here are superseded, so re-derive with
 * `bun build_scripts/measure-window-graph.js` rather than trusting a
 * restatement (see the 2026-08-21 correction in
 * docs/superpowers/specs/2026-08-19-module-coherence-measurement.md).
 *
 * **There are two channels because a wrapper straddled the render and a
 * subscriber cannot.** The old wrapper did work on BOTH sides of its
 * `originalRenderPage.call(...)`, and the before-side is not optional: it
 * flushes in-progress sidebar edits while the DOM still holds the OUTGOING
 * page's values. applyPageContent() overwrites #seoTitleInput and
 * #metaDescriptionInput through syncEditorFields() on every render, and
 * collectCurrentPageReviewState() reads both back out of the live DOM — so a
 * flush moved to the after-channel writes the incoming page's values into the
 * outgoing page's record. That is silent review-data loss, it is not
 * hypothetical (it shipped in d71ff26 and tests/e2e/navigation-flush.spec.js
 * is the spec that caught it), and no amount of care in the after-hook can
 * recover a value the render has already replaced. */
const beforeRenderHooks = []
const afterRenderHooks = []

/**
 * Register a callback to run BEFORE every renderPage() touches the DOM.
 *
 * Called synchronously, while the outgoing page's content and form values are
 * still on screen — that is the entire reason this channel exists, so do not
 * defer the dispatch here as the after channel does.
 *
 * @param {(pageKey: string) => void} fn called with the key about to render
 * @returns {() => void} unsubscribe; calling it twice is harmless
 */
function onBeforeRender(fn) {
  return subscribe(beforeRenderHooks, fn)
}

/**
 * Register a callback to run after every renderPage() completes.
 *
 * @param {(pageKey: string) => void} fn called with the key just rendered
 * @returns {() => void} unsubscribe; calling it twice is harmless
 */
function onAfterRender(fn) {
  return subscribe(afterRenderHooks, fn)
}

/**
 * Shared registration for both channels.
 *
 * @param {Array<Function>} hooks the channel's subscriber list
 * @param {Function} fn the callback to add
 * @returns {() => void} unsubscribe
 */
function subscribe(hooks, fn) {
  if (typeof fn !== 'function') return () => {}
  hooks.push(fn)
  return () => {
    const at = hooks.indexOf(fn)
    if (at !== -1) hooks.splice(at, 1)
  }
}

/**
 * Run every hook on one channel. A hook that throws is reported and skipped, so
 * one broken subscriber cannot stop the others or abort the render that called
 * it.
 *
 * @param {Array<Function>} hooks the channel's subscriber list
 * @param {string} label channel name, for the console message
 * @param {string} pageKey the key being rendered
 */
function runHooks(hooks, label, pageKey) {
  // Snapshot before iterating: a hook is allowed to call its own unsubscribe
  // function (or subscribe a new hook) from inside itself, and mutating the
  // list mid-iteration would skip or double-run a sibling hook.
  // .slice() rather than a spread so oxlint's no-useless-spread rule (a
  // `--deny-warnings` gate on this file) doesn't read it as accidental.
  for (const fn of hooks.slice()) {
    try {
      fn(pageKey)
    } catch (error) {
      console.error(label + ' hook failed', error)
    }
  }
}

/**
 * Run every registered before-render hook.
 *
 * @param {string} pageKey the key about to be rendered
 */
function runBeforeRenderHooks(pageKey) {
  runHooks(beforeRenderHooks, 'before-render', pageKey)
}

/**
 * Run every registered after-render hook, as of NOW.
 *
 * @param {string} pageKey the key that was just rendered
 */
function runAfterRenderHooks(pageKey) {
  runHooks(afterRenderHooks, 'after-render', pageKey)
}

/**
 * Bind the after-render subscriber list for a render that has not finished yet,
 * returning the dispatcher to call once it has.
 *
 * **The binding happens here, not in the returned function, and that is the
 * point.** After-dispatch is always deferred — a `setTimeout(fn, 0)` or a View
 * Transitions promise — so a dispatcher that read `afterRenderHooks` when it
 * FIRED would deliver a render's completion to subscribers that did not exist
 * when that render was requested. That is not hypothetical: the app's bootstrap
 * render is made during module evaluation, before js/review/ux-improvements.js
 * has registered anything, and its deferred hook nonetheless reached
 * ux-improvements.js's subscriber and stamped `state.ui.show_karl_tags = false`
 * into localStorage from an untouched checkbox. That was patched at the call
 * site with renderPage()'s `skipHooks`, which fixes the one render anybody had
 * noticed; binding here fixes the class, so a future deferred render scheduled
 * before a subscriber mounts does not need to remember a flag.
 *
 * The tradeoff, stated because it is a real semantic choice rather than a free
 * win: a hook that unsubscribes during the deferral window still fires, and one
 * that subscribes during it does not. Both readings are defensible; this is
 * "the subscribers of THIS render". No production subscriber does either today
 * — js/review/ux-improvements.js and js/editing/inline-content-edit.js both
 * register once at init, in the same synchronous module-evaluation pass.
 *
 * @param {string} pageKey the key being rendered
 * @returns {() => void} dispatcher bound to the current subscriber list
 */
function scheduleAfterRenderHooks(pageKey) {
  const bound = afterRenderHooks.slice()
  return () => runHooks(bound, 'after-render', pageKey)
}

function karlTag(label, kind = 'body', opts = {}) {
  const meta = typeof karlKindMeta === 'function' ? karlKindMeta(kind) : { label: 'Body' }
  const parsed =
    typeof parseKarlLabel === 'function'
      ? parseKarlLabel(label)
      : { breadcrumb: [], headline: String(label ?? ''), rationale: '', flagged: false }
  const guide = normalizeKarlGuide({
    page: opts.page || pageData[currentPageKey],
    kind,
    context: opts.context || {},
    guide: opts.guide,
    values: opts.values,
  })
  if (opts.inheritanceFact === 'title-and-text') guide.status = 'inherited'
  // Derived, never passed in: a call site that could choose its own category
  // could put a publishable colour on an editor note. See js/mockup/karl-category.js
  // for why this reads the signals rather than renaming `kind`.
  const category = karlCategory({
    kind,
    role: opts.context?.role || opts.context?.component,
    linkShape: opts.context?.linkShape,
    inheritanceFact: opts.inheritanceFact,
  })
  const panelId = nextKarlGuideId()
  const breadcrumbHtml = parsed.breadcrumb.length
    ? `<span class="karl-tag-breadcrumb">${parsed.breadcrumb
        .map((seg) => `<span class="karl-tag-crumb">${escapeHtml(seg)}</span>`)
        .join('<span class="karl-tag-crumb-sep" aria-hidden="true">›</span>')}</span>`
    : ''
  const flagHtml = parsed.flagged
    ? `<span class="karl-tag-flag">${escapeHtml('Legacy note needs review')}</span>`
    : ''
  const inheritHtml = INHERIT_BADGE_TEXT[opts.inheritanceFact]
    ? `<span class="karl-tag-inherit" data-inherit="${escapeHtml(opts.inheritanceFact)}">${escapeHtml(INHERIT_BADGE_TEXT[opts.inheritanceFact])}</span>`
    : ''
  const rationaleHtml = parsed.rationale
    ? `<span class="karl-tag-rationale">${escapeHtml(parsed.rationale)}</span>`
    : ''
  const triggerLabel = `Open Karl guide: ${parsed.headline || meta.label}`
  return `<span class="karl-guide" data-karl-guide><button type="button" class="karl-guide-trigger" aria-expanded="false" aria-controls="${escapeHtml(panelId)}" aria-label="${escapeHtml(triggerLabel)}"><mark class="karl-tag" data-kind="${escapeHtml(kind)}" data-category="${escapeHtml(category)}" aria-hidden="true"><span class="karl-tag-kind">${escapeHtml(meta.label)}</span><span class="karl-tag-text"><strong>Karl:</strong> ${breadcrumbHtml}<span class="karl-tag-headline">${escapeHtml(parsed.headline)}</span>${flagHtml}${inheritHtml}${rationaleHtml}</span></mark><span class="karl-guide-trigger-icon" aria-hidden="true">+</span></button>${renderKarlGuidePanel(guide, panelId)}</span>`
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
/**
 * Flatten a text-bearing array to the plain strings a Karl tag's `values` list
 * shows the editor.
 *
 * Paragraphs, bullets and step text each accept either a plain string or a
 * `{ text, unverified }` object (see build_scripts/schema.js), so a bare
 * `items.join('\n')` stringifies the object form to "[object Object]". That
 * matters more here than a cosmetic glitch would: a Karl tag's values are what
 * tell an editor what to type into Karl, and the Karl transcript export reads
 * the same content — a confidently-wrong instruction is this feature's worst
 * failure mode, so it must never print a JS internal.
 * @param {Array<string|{text: string}>} items
 * @returns {string} One plain string per item, newline-joined.
 */
function textValues(items) {
  return (items || []).map((item) => normalizeTextItem(item).text).join('\n')
}
function unverifiedPill(reason) {
  return `<span class="unverified-pill"${reason ? ` title="${escapeHtml(reason)}"` : ''}><span aria-hidden="true">⚠</span> Unverified</span>`
}
function formatMarkdown(text) {
  return safeMarkdown(text)
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
  // The path sits on a <span> INSIDE the <li>, never on the <li> itself —
  // the same rule renderTable() follows for a cell, and for the same reason:
  // EditorSession.open() (js/editing/inline-content-edit.js) mounts by
  // target.replaceWith(holder) and that holder is a <div>, so annotating the
  // <li> puts a <div> as a direct child of <ul> for as long as the editor is
  // open. Invalid content model, and this was the last place the rule was not
  // followed. The span wraps the pill too, matching paragraphList()'s <p>,
  // where the pill likewise disappears while the editor is open and returns
  // on the next render.
  return `<ul>${bullets
    .map((b, index) => {
      const item = normalizeTextItem(b)
      const attr = pathPrefix ? ` data-rewrite-field="${escapeHtml(`${pathPrefix}.${index}`)}"` : ''
      const body = `${formatMarkdown(item.text)}${item.unverified ? unverifiedPill(item.unverifiedReason) : ''}`
      return attr ? `<li><span${attr}>${body}</span></li>` : `<li>${body}</li>`
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
function button(label, kind = 'primary', target = null, url = null, guideOptions = {}) {
  const cls = kind === 'secondary' ? 'btn secondary' : 'btn'
  const guideLabel =
    kind === 'secondary' ? 'Button link: secondary action' : 'Button link: primary action'
  const guide = karlTag(guideOptions.label || guideLabel, 'placement', {
    guide: guideOptions.guide,
    context: { linkShape: 'button-link', ...(guideOptions.context || {}) },
    values: [
      { label: 'Link text', value: label, source: 'visible' },
      ...(url ? [{ label: 'External URL', value: safeUrl(url), source: 'visible' }] : []),
      // **The page KEY is useless in Karl and was what this offered to copy.**
      // `rodentsReport` is this mockup's private identifier; Karl's page
      // chooser searches by page title, so a reviewer pasting the key finds
      // nothing and has no way to tell that the value — not their search — was
      // wrong. The destination's title is the string that actually locates the
      // page, and it is marked `derived` rather than `visible` because it is
      // resolved from the target rather than read off this control. A target
      // naming no page in the mockup falls back to the key, which is at least
      // a lead, and is the honest thing to show when nothing better exists.
      ...(target
        ? [
            {
              label: 'SF.gov page to choose',
              value: pageData[target]?.title || target,
              source: pageData[target]?.title ? 'derived' : 'mockup-only',
            },
          ]
        : []),
    ],
  })
  const control = url
    ? `<a class="${cls}" href="${escapeHtml(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)} <span aria-hidden="true">↗</span></a>`
    : `<button type="button" class="${cls}"${target ? ` data-render-target="${escapeHtml(target)}"` : ''}>${escapeHtml(label)}</button>`
  return `<span class="review-action-with-guide">${guide}${control}</span>`
}
/**
 * @param {object|null} callout
 * @param {string} [extraClass]
 * @param {string} [pathPrefix] Dot-path of the callout object itself, e.g.
 *   'sections.2.callout' or 'sections.2.steps.0.callout'. Empty for a callout
 *   the renderer synthesizes rather than reads off the page (the audience
 *   framing box below), which has no field on the page object to write back
 *   to and so must not advertise itself as editable.
 * @returns {string}
 */
function renderCallout(callout, extraClass = '', pathPrefix = '') {
  if (!callout) return ''
  const variant = callout.variant || 'info'
  // The title and the body text carry their own paths on the elements that
  // already wrap them — a <strong> and a <span>. Both sit directly inside the
  // <aside>, which is flow content, so the <div> holder EditorSession.open()
  // swaps in via replaceWith() is valid in either position. Wrapping the body
  // in a <p> instead would add block spacing the callout never had.
  const titleAttr = pathPrefix ? ` data-rewrite-field="${escapeHtml(`${pathPrefix}.title`)}"` : ''
  const textAttr = pathPrefix ? ` data-rewrite-field="${escapeHtml(`${pathPrefix}.text`)}"` : ''
  const title =
    callout.title === false
      ? ''
      : callout.title
        ? `<strong${titleAttr}>${escapeHtml(callout.title)}:</strong> `
        : ''
  const guide =
    callout.title && callout.title !== false
      ? { ...(callout.karlGuide || {}), status: 'unresolved', evidence: 'U', unresolvedId: 'U2' }
      : callout.karlGuide
  return `<aside class="callout callout--${escapeHtml(variant)} ${extraClass}">${karlTag(callout.karl || 'Body callout', 'body', { guide, context: { role: 'callout' }, values: [{ label: 'Text', value: callout.text, source: 'visible' }, ...(callout.title && callout.title !== false ? [{ label: 'Title', value: callout.title, source: 'mockup-only' }] : [])] })}${title}<span${textAttr}>${formatMarkdown(callout.text)}</span></aside>`
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
    // The tag sits BEFORE the <p>, never inside it. karlTag() now emits a
    // block-level guide panel, and a <div> inside a <p> makes the HTML parser
    // close that paragraph early — the panel then lands outside
    // `.karl-guide`, which is the positioned ancestor it is absolutely
    // positioned against, so it opens somewhere else on the page and the
    // paragraph's own markup is silently restructured. Same reason at
    // renderTable()'s mockup-only note and renderPrintVersion().
    return `${karlTag('Custom section: Who this is for (audience[] editorial framing, not a literal Karl field)', 'body')}<p>${formatMarkdown(text)}</p>`
  }
  const karlNote =
    pageType === 'campaign'
      ? 'Additional content callout: Who this is for (audience[] editorial framing, not a literal Karl field)'
      : 'Body callout: Who this is for (audience[] editorial framing, not a literal Karl field)'
  return renderCallout({ title: 'Who this is for', variant: 'info', text, karl: karlNote })
}
function renderImage(image) {
  if (!image?.src) return ''
  return `<figure class="content-image">${karlTag(image.karl || 'Information section: Image', 'body', { guide: image.karlGuide, context: { role: 'image' }, values: [{ label: 'Alt text', value: image.alt, source: 'visible' }, ...(image.caption ? [{ label: 'Caption', value: image.caption, source: 'visible' }] : [])] })}<img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt || '')}" loading="lazy" />${image.caption ? `<figcaption>${escapeHtml(image.caption)}</figcaption>` : ''}</figure>`
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
  return { action, desc, descriptionText: descText, inheritanceFact }
}
/**
 * The Karl guide role a card-bearing section's own links belong to.
 *
 * Cards used to pass no role at all, so guideForContext() fell back to the
 * tag KIND ('placement'), which names no Karl field — every Agency service
 * and resource card then resolved to the page type's body path and told the
 * reviewer to open `Content → About → About description`. The section already
 * knows: inferSectionRole() is the one classifier this file uses for exactly
 * this question, so it is reused rather than a second one written beside it.
 *
 * The page type is read off `currentPageKey` rather than threaded down from
 * the caller, matching what karlTag() itself already does one function above.
 * That is safe rather than convenient: nothing renders a section for a page
 * other than the open one — js/mockup/mockup-image-export.js, the only caller that
 * sweeps every page, navigates through `window.renderPage(pageKey)`, which
 * sets `currentPageKey` before it renders. Threading the parameter would mean
 * widening renderCards/renderCardList/renderResourcesList, which tests and
 * e2e specs call by name.
 *
 * @param {object|null} section The section owning the cards, or null for a
 *   card list with no section (Partner agencies, a Step List's own cards).
 * @returns {string|undefined} 'services' | 'resources' | 'related' | the
 *   section's own role, or undefined when there is no section to classify.
 */
function cardSectionRole(section) {
  if (!section) return undefined
  const pageType = normalizePageType(pageData[currentPageKey]?.type)
  return inferSectionRole(section, pageType)
}
function cardGuideOptions(section, card, title, desc, inheritanceFact, roleOverride) {
  const classify = window.cardInheritance?.classifySection
  const sectionKind = section && typeof classify === 'function' ? classify(section) : 'unknown'
  const linkShape =
    sectionKind === 'title-only'
      ? 'page-reference'
      : sectionKind === 'inherits'
        ? 'resources-list'
        : // **An `authored` card is a link in rich text, not a Resources entry.**
          // The card-inheritance classifier returning `authored` means the host
          // is a Table or Title-and-text block writing its own words — so its
          // links are made with Draftail's Internal link / External link tools
          // on selected text, which is link shape 5. Treating a URL-bearing one
          // as `resources-list` described a Resources form it will never see:
          // a title, a URL and a description field that do not exist here.
          // Both directions go the same way, because Draftail's two tools are
          // the same control on the same selected text.
          sectionKind === 'authored'
          ? 'rich-text-link'
          : card.url
            ? 'resources-list'
            : 'page-reference'
  const values = [
    {
      label: 'Title',
      value: title,
      source:
        inheritanceFact === 'title' || inheritanceFact === 'title-and-text'
          ? 'inherited'
          : 'visible',
    },
  ]
  if (desc)
    values.push({
      label: 'Description',
      value: desc,
      source:
        inheritanceFact === 'text' || inheritanceFact === 'title-and-text'
          ? 'inherited'
          : 'visible',
    })
  if (card.url) values.push({ label: 'URL', value: safeUrl(card.url), source: 'visible' })
  // Same correction as button()'s: the mockup's page key is not a value Karl's
  // page chooser can find. Offer the destination's title, which is what the
  // chooser searches on.
  if (card.target)
    values.push({
      label: 'SF.gov page to choose',
      value: pageData[card.target]?.title || card.target,
      source: pageData[card.target]?.title ? 'derived' : 'mockup-only',
    })
  return {
    context: {
      role: roleOverride || cardSectionRole(section),
      linkShape,
      inheritance: sectionKind,
    },
    values,
  }
}

function renderCards(cards = [], section = null) {
  return `<div class="cards">${cards
    .map((c) => {
      const { action, desc, descriptionText, inheritanceFact } = cardActionAndDescription(
        section,
        c
      )
      const guideOptions = cardGuideOptions(
        section,
        c,
        cardTitle(section, c),
        descriptionText,
        inheritanceFact
      )
      return `<article class="card">${karlTag(c.karl || 'Linked page item: title + description + link. Use Related section, body link, Resource Collection item, or Agency page link section as appropriate.', 'placement', { inheritanceFact, ...guideOptions })}<h3>${action}</h3>${desc ? `<p>${desc}</p>` : ''}</article>`
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
// `roleOverride` exists for the card lists that have no section to classify:
// cardSectionRole(null) is undefined, and an undefined role resolves to no Karl
// field at all. Partner agencies is the case — a real, named Karl field whose
// entries had been reporting "Mockup only" because the list they render in
// carries no section object.
function renderCardList(cards = [], section = null, roleOverride = undefined) {
  return `<ul>${cards
    .map((c) => {
      const { action, desc, descriptionText, inheritanceFact } = cardActionAndDescription(
        section,
        c,
        {
          relNoreferrer: true,
          externalMarkClass: 'external-mark',
        }
      )
      const fileBadge = c.fileType
        ? `<span class="file-badge">${escapeHtml(c.fileType)}</span>`
        : ''
      const text = desc ? `<p>${desc}</p>` : ''
      const guideOptions = cardGuideOptions(
        section,
        c,
        cardTitle(section, c),
        descriptionText,
        inheritanceFact,
        roleOverride
      )
      return `<li>${karlTag(c.karl || 'Linked page item: title + description + link', 'placement', { inheritanceFact, ...guideOptions })}${action}${fileBadge}${text}</li>`
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
  // A Services subsection renders through this same function (see
  // renderServiceTiles below), so hardcoding 'resources' for everything that
  // is not Related told every Agency and Topic Services list to use the
  // Resources field path — contradicting the Services region guide printed
  // directly above it. inferSectionRole() is the authority for which of the
  // two a section is; `component` alone misses the karl-string fallback it
  // carries for sections that set no component.
  const role = cardSectionRole(section) || 'resources'
  const related = role === 'related'
  const label =
    role === 'related'
      ? 'Related page links'
      : role === 'services'
        ? 'Services links list'
        : 'Resources links list'
  return `<div class="resources-list">${karlTag(label, 'placement', { context: { role, linkShape: related ? 'page-reference' : 'resources-list' } })}${renderCardList(cards, section)}</div>`
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
  // **Campaign's Related is not the same field as everyone else's**, despite
  // the identical panel label — the field map records that correction as `O2`.
  // Transaction/Information `related` is a bare page chooser, so Karl supplies
  // the destination title and the entry needs nothing else (link shape 1).
  // Campaign `related_links` is a Page block requiring "Link text" and
  // accepting an external URL (link shape 4). Hardcoding shape 1 told an editor
  // on the two Campaign pages that a required field did not exist.
  const linkShape =
    normalizePageType(pageData[currentPageKey]?.type) === 'campaign'
      ? 'campaign-related'
      : 'page-reference'
  return `<section class="section section--related">${karlTag('Related section: linked pages', 'placement', { context: { role: 'related', linkShape }, guide: section?.karlGuide })}<h2>${escapeHtml(heading)}</h2><div class="resources-list">${renderCardList(cards, section)}</div></section>`
}
// Karl's "Partner agencies" field on a Transaction page — a separate H2
// section from the Primary-Agency parent link (renderParentLink()) and from
// Related. Entries point at real sf.gov department pages outside this
// mockup's page set, so `section` is always null here: there is no local
// page to classify title/description inheritance against, matching a plain
// external card (see cardActionAndDescription()).
function renderPartnerAgencies(cards = []) {
  if (!cards.length) return ''
  // `partner_agencies` is a real, identically-named field on seven of the eight
  // types in use (About us is the exception), and it is a page chooser
  // restricted to Agency pages — not the external-resource form these entries
  // were being described as. The section tag carried no context at all, so it
  // fell back to the 'placement' KIND and reported no field; the entries
  // themselves had no section to classify and so reported none either.
  const context = { role: 'partner-agencies', linkShape: 'page-reference' }
  return `<section class="section section--partner-agencies">${karlTag('Partner agencies: linked departments', 'placement', { context })}<h2>Partner agencies</h2><div class="resources-list">${renderCardList(cards, null, 'partner-agencies')}</div></section>`
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
        `<li class="step"><div>${karlTag(s.karl || 'Step List: body step', s.button ? 'placement' : 'body', { guide: s.karlGuide, context: { role: 'what-to-do' }, values: [{ label: 'Title', value: s.title, source: 'visible' }, ...(s.text?.length ? [{ label: 'Text', value: s.text.map((item) => (typeof item === 'string' ? item : item.text)).join('\n'), source: 'visible' }] : []), ...(s.bullets?.length ? [{ label: 'Bullets', value: s.bullets.map((item) => (typeof item === 'string' ? item : item.text)).join('\n'), source: 'visible' }] : [])] })}<h3${pathPrefix ? ` data-rewrite-field="${escapeHtml(`${pathPrefix}.${index}.title`)}"` : ''}>${escapeHtml(s.title)}</h3>${paragraphList(s.text || [], pathPrefix ? `${pathPrefix}.${index}.text` : '')}${bulletList(s.bullets || [], pathPrefix ? `${pathPrefix}.${index}.bullets` : '')}${s.cards ? renderCards(s.cards, null) : ''}${s.button ? button(s.button, 'secondary', s.buttonTarget || null, s.buttonUrl || null, { context: { role: 'what-to-do' } }) : ''}${s.callout ? renderCallout(s.callout, '', pathPrefix ? `${pathPrefix}.${index}.callout` : '') : ''}</div></li>`
    )
    .join('')}</ol>`
}
function isCodeTranslationTable(head = []) {
  return head.length === 2 && head[0] === 'Health code' && head[1] === 'In plain language'
}
/**
 * @param {string[][]} rows
 * @param {string} [pageType]
 * @param {string} [caption]
 * @param {string} [pathPrefix] Dot-path of the table array itself, e.g.
 *   'sections.3.table'. Each cell is addressed by row and column
 *   (`sections.3.table.1.0`) and edits store the whole table, the same
 *   whole-field rule bullets follow — a per-cell key would go stale the
 *   moment a row is inserted.
 * @returns {string}
 */
function renderTable(rows = [], pageType = 'generic', caption = '', pathPrefix = '') {
  if (!rows.length) return ''
  const [head, ...body] = rows
  // A cell's editable element is a <span> INSIDE the cell, never the <td>
  // itself: EditorSession.open() mounts by replacing its target
  // (target.replaceWith(holder)), and replacing a <td> would tear the row
  // apart. A <div> holder inside the cell is valid content.
  const cellAttr = (row, column) =>
    pathPrefix ? ` data-rewrite-field="${escapeHtml(`${pathPrefix}.${row}.${column}`)}"` : ''
  const codeTranslation = isCodeTranslationTable(head)
  const previewNote =
    pageType === 'information'
      ? // Tag outside the <p>, not inside it — see renderAudienceFraming() for
        // why a guide panel nested in a paragraph detaches from its anchor.
        `${karlTag('Editor QA: Report-only table preview on Information page', 'editor')}<p class="mockup-only-note">Tables are native to the <strong>Report</strong> content type in Karl, not Information. Use card-based routing or a linked Resource Collection in production.</p>`
      : ''
  const tableClass = codeTranslation ? 'table table--code-translation' : 'table'
  /* **The table gets its own guide, rather than borrowing its section's.**
     A Karl Table is a block in its own right — `Content → Content → Table` on
     Report, the only type that has one — while the section's tag speaks for the
     section's prose. Six of the seven table-bearing sections in the corpus
     carry no prose at all, so before this the section tag was the table's only
     guide and it resolved through `inferSectionRole()` to `body`: an
     E1-confirmed instruction to paste tabular content into rich text. The
     seventh has a lead-in paragraph, which is exactly why this is a second tag
     rather than a change to the section's role — that paragraph really does
     belong in Body, and the table really does not.

     On every other type the registry has no `table` row, so this reports
     "Mockup only", pairing with the Information-only preview note above. */
  const guide = karlTag('Table block', 'placement', {
    context: { role: 'table' },
    values: caption ? [{ label: 'Caption', value: caption, source: 'visible' }] : [],
  })
  const table = `<table class="${tableClass}"><thead><tr>${head
    .map((h, i) => `<th scope="col"><span${cellAttr(0, i)}>${formatMarkdown(h)}</span></th>`)
    .join('')}</tr></thead><tbody>${body
    .map(
      (r, rowIndex) =>
        `<tr>${r
          .map((c, i) => {
            // A row header is a `<th scope="row">`, never a `<td scope="row">`.
            // `scope` is only valid on `<th>` — on a `<td>` it is ignored by
            // assistive technology AND flagged by axe's `scope-attr-valid`, so
            // the cell it was meant to label announced as ordinary data. This
            // shipped on 25 nodes of the Article 11 code-translation tables,
            // whose whole point is that the left column names the code section
            // the row is about.
            //
            // Caught by the `#mockPage .page-body` scan in
            // tests/e2e/accessibility.spec.js, not by the whole-page one:
            // `scope-attr-valid` is `moderate`, and the older helper filters to
            // critical/serious. Table semantics survive export into Karl, which
            // is why the body gate does not filter by impact.
            const rowHeader = codeTranslation && i === 0
            const tag = rowHeader ? 'th' : 'td'
            const scope = rowHeader ? ' scope="row"' : ''
            // rowIndex + 1: `body` is rows[1..], so the stored path has to
            // count the header row the destructure above removed.
            return `<${tag}${scope}><span${cellAttr(rowIndex + 1, i)}>${formatMarkdown(c)}</span></${tag}>`
          })
          .join('')}</tr>`
    )
    .join('')}</tbody></table>`
  if (codeTranslation && caption) {
    return `${previewNote}${guide}<figure class="code-translation-figure"><figcaption class="visually-hidden">${escapeHtml(caption)}</figcaption>${table}</figure>`
  }
  return `${previewNote}${guide}${table}`
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
  // Editable only when the box is reading page.whatToKnow. resolveWhatToKnow()
  // above SYNTHESIZES a default box for a Transaction page that authored none,
  // and that text lives in this renderer rather than on the page object — an
  // edit would address whatToKnow.cost on a page with no whatToKnow at all,
  // where setByPath finds no parent to write into and the reviewer's change
  // disappears with nothing erroring. No field, no affordance.
  const editable = Boolean(page.whatToKnow) && data === page.whatToKnow
  const cost = data.cost || (normalizePageType(page.type) === 'transaction' ? 'Free' : '')
  // Gated on the RESOLVED cost, not on `data.cost`. A Transaction page that
  // authored a whatToKnow box but left cost empty still renders the "Free"
  // fallback below, and gating on the authored field would print that visible
  // line with no click-to-edit affordance — the one shape this feature exists
  // to remove. `editable` has already established that `page.whatToKnow` is a
  // real object, so setByPath has a parent to write the reviewer's value into.
  const costAttr = editable && cost ? ' data-rewrite-field="whatToKnow.cost"' : ''
  // Which of the two array fields this page uses decides the stored path, so
  // it is resolved once here rather than inferred later: an edit recorded
  // under whatToKnow.items on a page whose array is thingsToKnow would reapply
  // onto a field the renderer never reads.
  const thingsField = data.thingsToKnow ? 'thingsToKnow' : data.items ? 'items' : ''
  const things = data.thingsToKnow || data.items || []
  const normalizedThings = Array.isArray(things)
    ? things.map((item, index) => ({
        label: typeof item === 'string' ? '' : item.label || '',
        text: typeof item === 'string' ? item : item.text || '',
        unverified: typeof item === 'string' ? false : Boolean(item.unverified),
        unverifiedReason: typeof item === 'string' ? '' : item.unverifiedReason || '',
        // The path has to carry the SOURCE index: the labeled and unlabeled
        // entries are rendered as two separate lists below, so an index taken
        // from either filtered list would address the wrong entry.
        path: editable && thingsField ? `whatToKnow.${thingsField}.${index}` : '',
      }))
    : []
  // "Who this page is for" is folded in here from page.audience rather than
  // duplicated as authored thingsToKnow text, so the audience list has one
  // source of truth and can't drift between the two.
  const audienceItems = Array.isArray(page.audience) ? page.audience : []
  const audienceHtml = audienceItems.length
    ? `<div class="what-to-know-subsection"><h3>Who this is for</h3><ul>${renderAudience(audienceItems)}</ul></div>`
    : ''
  const costHtml = cost
    ? `<div class="what-to-know-subsection what-to-know-cost"><h3>Cost</h3><p${costAttr}>${escapeHtml(cost)}</p></div>`
    : ''
  // Real sf.gov renders each "Things to know" entry as its own named H3
  // subsection (e.g. "What to report", "Response time varies" — confirmed
  // against 4 live Transaction pages). A labeled entry gets that treatment;
  // an unlabeled one has no name to give its own heading, so those fall back
  // to one shared "Things to know" list, same as before this change.
  const itemAttr = (item) => (item.path ? ` data-rewrite-field="${escapeHtml(item.path)}"` : '')
  const itemPill = (item) => (item.unverified ? unverifiedPill(item.unverifiedReason) : '')
  // The label is the entry's own H3, and was the one piece of visible copy in
  // this box a reviewer could not touch: editing "who must pay" worked while
  // the heading "Who must pay" above it did not. It addresses the same item as
  // itemAttr's path with a `.label` suffix, and stores through the
  // whatToKnow.thingsToKnow/items container the same way the text does.
  const labelAttr = (item) =>
    item.path ? ` data-rewrite-field="${escapeHtml(`${item.path}.label`)}"` : ''
  const labeledHtml = normalizedThings
    .filter((t) => t.label)
    .map(
      (t) =>
        `<div class="what-to-know-subsection"><h3${labelAttr(t)}>${escapeHtml(t.label)}</h3><p${itemAttr(t)}>${formatMarkdown(t.text)}${itemPill(t)}</p></div>`
    )
    .join('')
  const unlabeled = normalizedThings.filter((t) => !t.label)
  // Rendered here rather than through renderTextItems() because each entry
  // needs its own source-index path, which that helper has no parameter for —
  // and its filtered position is not the index an edit must be stored under.
  // The two-or-fewer/three-or-more switch it applies is preserved.
  const unlabeledItemsHtml =
    unlabeled.length <= 2
      ? unlabeled
          .map((t) => `<p${itemAttr(t)}>${formatMarkdown(t.text)}${itemPill(t)}</p>`)
          .join('')
      : // Same <span>-inside-<li> rule as bulletList() above: a <div> holder
        // replacing an annotated <li> is invalid inside a <ul>.
        `<ul>${unlabeled
          .map((t) => {
            const body = `${formatMarkdown(t.text)}${itemPill(t)}`
            const attr = itemAttr(t)
            return attr ? `<li><span${attr}>${body}</span></li>` : `<li>${body}</li>`
          })
          .join('')}</ul>`
  const unlabeledHtml = unlabeled.length
    ? `<div class="what-to-know-subsection"><h3>Things to know</h3>${unlabeledItemsHtml}</div>`
    : ''
  const body = `${audienceHtml}${costHtml}${labeledHtml}${unlabeledHtml}`
  if (!body) return ''
  // `what-to-know`, not `content`: Karl stores Cost and Things to Know in two
  // top-level fields under "What to Know Before You Start", not in the
  // What to Do stream that `content` resolves to.
  return `<section class="what-to-know">${karlTag('What to know before you start: Who this is for, Cost, and Things to know', 'body', { context: { role: 'what-to-know' }, values: [...(cost ? [{ label: 'Cost', value: cost, source: 'visible' }] : []), ...(audienceItems.length ? [{ label: 'Audience', value: audienceItems.join('\n'), source: 'mockup-only' }] : [])] })}<h2 class="what-to-know-heading"><span class="what-to-know-icon" aria-hidden="true">ⓘ</span>What to know</h2>${body}</section>`
}
function renderContactSection(contact, page) {
  const data = contact || resolveContact(page)
  if (!data) return ''
  // Same rule as the What-to-know box: resolveContact() synthesizes a default
  // block for Transaction and Information pages that authored none, and there
  // is no page.contact for an edit to be written back into.
  const editable = Boolean(page.contact) && data === page.contact
  const attr = (path) => (editable ? ` data-rewrite-field="${escapeHtml(path)}"` : '')
  // One <p> per entry rather than one <p> holding <br>-separated entries: an
  // entry has to be its own element to carry its own path, and
  // EditorSession.open() replaces that element with a <div> holder, which is
  // not valid inside a <p>. The list reads the same.
  const list = (field, values) =>
    values
      .map((value, index) => `<p${attr(`contact.${field}.${index}`)}>${escapeHtml(value)}</p>`)
      .join('')
  const blocks = []
  if (data.address)
    blocks.push(`<h3>Address</h3><p${attr('contact.address')}>${escapeHtml(data.address)}</p>`)
  if (data.phone?.length) blocks.push(`<h3>Phone</h3>${list('phone', data.phone)}`)
  if (data.email?.length) blocks.push(`<h3>Email</h3>${list('email', data.email)}`)
  if (data.hours)
    blocks.push(`<h3>Hours</h3><p${attr('contact.hours')}>${escapeHtml(data.hours)}</p>`)
  if (data.other?.length) blocks.push(`<h3>Other</h3>${list('other', data.other)}`)
  if (data.social?.length) {
    const links = data.social
      .map(
        (s) =>
          `<a href="${escapeHtml(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.platform)}</a>`
      )
      .join(' ')
    blocks.push(`<h3>Social media</h3><p>${links}</p>`)
  }
  // `contact`, not `content`. Transaction, Campaign and Agency each have a
  // dedicated Contact us panel; Information, Resource Collection, Topic,
  // About us and Report have none at all, so on those the registry resolves
  // this to "Mockup only" rather than to a prose field. Both outcomes beat the
  // old one, which sent a phone number to whatever the page's body stream was.
  return `<section class="contact-section section">${karlTag('Contact section', 'placement', {
    context: { role: 'contact' },
    values: [
      {
        label: 'Contact values',
        value: blocks
          .map((block) => block.replace(/<[^>]+>/g, ' '))
          .join(' ')
          .trim(),
        source: 'visible',
      },
    ],
  })}<h2>Contact us</h2>${blocks.join('')}</section>`
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
  // The host role travels with the button: a Button link is link shape 2
  // living INSIDE another block, so the Spotlight is what decides its path.
  // Without this the guide resolved it to the page type's body stream.
  const cta = section.button
    ? button(section.button, 'primary', section.buttonTarget || null, section.buttonUrl || null, {
        context: { role: 'spotlight' },
      })
    : ''
  return `<section class="spotlight-section">${karlTag(section.karl || 'Spotlight', 'placement', { guide: section.karlGuide, context: { role: 'spotlight' }, values: [{ label: 'Title', value: section.heading, source: 'visible' }, ...(section.paragraphs?.length ? [{ label: 'Description', value: textValues(section.paragraphs), source: 'visible' }] : [])] })}<div class="spotlight-section-inner"><h2${headingPathAttr}>${escapeHtml(section.heading)}</h2>${paragraphList(section.paragraphs || [], base ? `${base}.paragraphs` : '')}${section.callout ? renderCallout(section.callout, '', base ? `${base}.callout` : '') : ''}${cta}</div></section>`
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
  // Both halves of a fact are visible copy, so both carry a path. The label
  // renders as the fact's own H3 and is addressed as a `.label` sub-field —
  // stored through the `sections.N.facts` container rather than under its own
  // key, since computeSectionEdits diffs that array whole. `base` gates them:
  // a section that never went through partitionSections() has no
  // __sectionIndex, and a path built on `sections..facts` would address
  // nothing.
  const factAttr = (index, suffix) =>
    base ? ` data-rewrite-field="${escapeHtml(`${base}.facts.${index}${suffix}`)}"` : ''
  const factsHtml = facts
    .map(
      (f, index) =>
        `<div class="what-to-know-subsection"><h3${factAttr(index, '.label')}>${escapeHtml(f.label)}</h3><p${factAttr(index, '')}>${formatMarkdown(f.text)}${f.unverified ? unverifiedPill(f.unverifiedReason) : ''}</p></div>`
    )
    .join('')
  // `top-facts` is a Karl panel of its own on Campaign (`facts_title` +
  // `fact_items`), not part of the Additional content stream `content` maps to.
  return `<section class="top-facts">${karlTag(section.karl || 'Top facts', 'body', { guide: section.karlGuide, context: { role: 'top-facts' }, values: [{ label: 'Section title', value: section.heading, source: 'visible' }] })}<h2${headingPathAttr}>${escapeHtml(section.heading)}</h2>${paragraphList(section.paragraphs || [], base ? `${base}.paragraphs` : '')}${factsHtml}</section>`
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
// THE TOGGLE AND THE HEADING ARE SEPARATE ELEMENTS, and that split is the
// whole reason this function does not look like the standard ARIA accordion
// pattern (a heading wrapping a full-width button).
//
// Every other editable field carries `data-rewrite-field` on the element that
// already renders it, because EditorSession.open()
// (js/editing/inline-content-edit.js) mounts the editor by calling
// `target.replaceWith(holder)` — and that holder is a <div>. Annotating the
// heading text where it used to live, inside the trigger <button>, would
// therefore have done two broken things at once: dropped a block-level
// Editor.js instance inside a native button (invalid content model, and
// unreliable focus/caret behaviour), and handed a single click to two
// different listeners — the document-level accordion toggle below and the
// #mockPage editor handler, neither of which calls stopPropagation(). The
// panel would open while the heading flipped into an edit box.
//
// So the chevron owns the toggle and the <h3> owns the text, as siblings
// inside .accordion-header. The cost is a smaller pointer target than the old
// full-row button: the chevron is sized to 44x44 in css/styles.css to stay
// well clear of WCAG 2.5.8's 24x24 minimum. The accessible name is restated
// with aria-label because the chevron has no text of its own — the old button
// took its name from the heading text it contained, and dropping that would
// have left screen-reader users with an unlabeled "button".
function renderAccordionSection(section, pageType) {
  const panelId = sectionAnchorId(section.heading)
  // `open: true` renders the accordion expanded on load — used for content the
  // reviewer must see without a click (e.g. the report pages' "While you wait"
  // IPM tips); the toggle still works normally afterwards.
  const expanded = section.open === true
  const headingPathAttr =
    typeof section.__sectionIndex === 'number'
      ? ` data-rewrite-field="sections.${section.__sectionIndex}.heading"`
      : ''
  const trigger = `<button type="button" class="accordion-trigger" data-accordion-toggle aria-expanded="${expanded ? 'true' : 'false'}" aria-controls="${panelId}" aria-label="${escapeHtml(section.heading)}"></button>`
  const heading = `<h3 class="accordion-heading"${headingPathAttr}>${escapeHtml(section.heading)}</h3>`
  return `<div class="accordion-item"><div class="accordion-header">${trigger}${heading}</div><div class="accordion-panel" id="${panelId}"${expanded ? '' : ' hidden'}>${renderSectionInner(section, pageType)}</div></div>`
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
  const headingPathAttr =
    typeof section.__sectionIndex === 'number'
      ? ` data-rewrite-field="sections.${section.__sectionIndex}.heading"`
      : ''
  return `<div class="custom-section"><h3${anchor}${headingPathAttr}>${escapeHtml(section.heading)}</h3>${renderSectionInner(section, pageType)}</div>`
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
  inner += section.table
    ? renderTable(section.table, pageType, section.heading || '', base ? `${base}.table` : '')
    : ''
  if (section.callout) inner += renderCallout(section.callout, '', base ? `${base}.callout` : '')
  if (section.button)
    inner += button(
      section.button,
      section.buttonStyle || 'primary',
      section.buttonTarget || null,
      section.buttonUrl || null,
      { guide: { status: 'unresolved', evidence: 'U', unresolvedId: 'U1' } }
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
  const sectionRole = role === 'what-to-do' ? 'what-to-do' : section.component || role
  const tag = options.skipKarl
    ? ''
    : karlTag(section.karl || 'Body section', kind, {
        guide: section.karlGuide,
        context: {
          role: sectionRole,
          linkShape: sectionRole === 'related' ? 'page-reference' : undefined,
        },
        values: [{ label: 'Section title', value: section.heading, source: 'visible' }],
      })
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
  const headingPathAttr =
    typeof section.__sectionIndex === 'number'
      ? ` data-rewrite-field="sections.${section.__sectionIndex}.heading"`
      : ''
  return `<div class="service-group"><h3${anchor}${headingPathAttr}>${escapeHtml(section.heading)}</h3>${renderSectionInner(section, pageType)}</div>`
}
function renderServicesRegion(sections, pageType, karlLabel = 'Topic page Services section') {
  if (!sections.length) return ''
  return `<div class="services-region">${karlTag(karlLabel, 'placement', { context: { role: 'services', linkShape: 'resources-list' } })}<h2 class="region-title">Services</h2>${sections.map((s) => renderServiceGroup(s, pageType)).join('')}</div>`
}
function renderResourcesRegion(sections, pageType, karlLabel = 'Topic page Resources section') {
  if (!sections.length) return ''
  return `<div class="resources-region">${karlTag(karlLabel, 'placement', { context: { role: 'resources', linkShape: 'resources-list' } })}<h2 class="region-title">Resources</h2>${sections.map((s) => renderServiceGroup(s, pageType)).join('')}</div>`
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
        spotlight.buttonUrl || null,
        { context: { role: 'spotlight' } }
      )
    : ''
  return `<section class="spotlight">${karlTag(spotlight.karl || 'Spotlight', 'placement', { guide: spotlight.karlGuide, context: { role: 'spotlight' }, values: [{ label: 'Title', value: spotlight.title || '', source: 'visible' }, ...(spotlight.paragraphs?.length ? [{ label: 'Description', value: textValues(spotlight.paragraphs), source: 'visible' }] : [])] })}<div class="spotlight-inner">${img}<div class="spotlight-copy"><h2 data-rewrite-field="spotlight.title">${escapeHtml(spotlight.title || '')}</h2>${paragraphList(spotlight.paragraphs || [], 'spotlight.paragraphs')}${cta}</div></div></section>`
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
        `${karlTag('Metadata: Karl page type', 'meta', { values: [{ label: 'Page type', value: page.type, source: 'visible' }] })}<div class="eyebrow eyebrow--agency">${escapeHtml(page.type)}</div>`
      : pageTypeNormalized === 'transaction'
        ? `${karlTag('Metadata: Karl page type (renders as "Service")', 'meta', { values: [{ label: 'Page type', value: page.type, source: 'visible' }] })}<div class="eyebrow eyebrow--service">Service</div>`
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
      : // role: 'description' resolves to the Content tab's own Description
        // textarea. Without it the role fell back to the tag kind, which names
        // no field, and the guide printed the page type's BODY path — telling
        // an editor to paste an Agency page's summary into `Content → About →
        // About description`, or a Transaction's into What to Do.
        `${karlTag('Short summary / Description field', 'meta', { context: { role: 'description' }, values: [{ label: 'Description', value: page.summary, source: 'visible' }] })}<p class="summary" data-rewrite-field="summary">${escapeHtml(page.summary)}</p>`
  // No `guide: page.karlGuide` here. A page-level karlGuide describes that
  // page's MAIN CONTENT block (What to Do, Custom section, Spotlight), so
  // attaching it to the title tag showed confirmed steps for an unrelated
  // Karl block beside Title and Slug copy values. Title and slug are
  // type-independent and resolve from META_FIELDS instead.
  return `<section class="${heroClass}"><div class="hero-inner">${eyebrowHtml}${karlTag(
    'Page title field',
    'meta',
    {
      context: { role: 'title' },
      values: [
        { label: 'Title', value: page.title, source: 'visible' },
        { label: 'Slug', value: page.slug, source: 'visible' },
      ],
    }
  )}<h1 tabindex="-1" data-rewrite-field="title">${escapeHtml(page.title)}</h1>${summaryHtml}${ctaHtml}</div></section>`
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
  // Tag outside the <p>, not inside it — see renderAudienceFraming() for why
  // a guide panel nested in a paragraph detaches from its anchor.
  return `${karlTag('Report Print version field', 'placement')}<p class="print-version-link"><a href="${escapeHtml(safeUrl(url))}" target="_blank" rel="noopener noreferrer">Print version <span aria-hidden="true">↗</span></a></p>`
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
/* There is deliberately no `if (!key)` branch here, and one was removed on
   2026-08-17 because it CRASHED the default entry point. It cleared #mockPage
   and then set `.textContent` on `document.getElementById('pageTitle')` — an
   element that exists nowhere in index.html — so a bare URL with no `?page=`
   threw a TypeError before anything rendered, and so did every history pop
   back to that URL. It survived because `resolveInitialPageKey()` already maps
   a null key onto `pestsTopic`, so the only caller that could reach it was
   js/core/app.js passing an explicit null, and every e2e spec navigates with a
   `?page=` parameter.

   That branch was the landing state for the bottom-drawer workspace, which is
   also gone. A key that names no page is resolved rather than special-cased —
   see resolveInitialPageKey() and resolvePageKey()'s `defaultKey`. */
/**
 * @param {string} key page key to render
 * @param {boolean} [skipHistory] true suppresses a history.pushState entry
 * @param {boolean} [skipHooks] true runs this one render with NEITHER channel
 *   dispatched — no onBeforeRender() and no onAfterRender() subscribers. One
 *   flag rather than two, because every caller that wants to skip wants to
 *   skip both: this is the "render the DOM, run none of the navigation
 *   bookkeeping" mode, and it reproduces exactly what calling the captured
 *   pre-wrap function used to do under the old window.renderPage monkey-patch,
 *   which bypassed the wrapper's flush and its refresh together.
 *
 *   Three callers pass it. js/core/app.js's bootstrap render is the first
 *   renderPage() in the app's lifecycle, made at module-eval time before
 *   js/review/ux-improvements.js (loaded later in js/main.js) has registered
 *   anything. Under the old monkey-patch that was safe for free — nothing had
 *   wrapped window.renderPage yet, so the call could not pick up side effects
 *   that did not exist at call time. Hooks are baked into renderPage() now and
 *   after-dispatch is DEFERRED (setTimeout(0) or a View Transitions promise),
 *   which once meant the deferred hook reached subscribers that registered
 *   synchronously after the call. Measured, not theoretical: with no guard, the
 *   bootstrap render's hook stamped state.ui.show_karl_tags = false into
 *   localStorage from the Karl-tags checkbox's untouched, unchecked default,
 *   and a later render picked it up via applySavedUiPreferences(), hiding
 *   `.unverified-pill` for a session that never touched the toggle
 *   (`tests/e2e/ai-rewrite.spec.js`'s "flags the applied copy unverified"
 *   caught it).
 *
 *   **scheduleAfterRenderHooks() now binds that list at schedule time, so the
 *   bootstrap render can no longer reach a later subscriber even without this
 *   flag.** It is kept there anyway, and deliberately: it states the intent at
 *   the call site, it also suppresses the SYNCHRONOUS before-channel, and it
 *   keeps the guarantee from depending on js/main.js's import order — reorder
 *   ux-improvements.js ahead of app.js and the binding argument evaporates
 *   while the flag still holds. The other two callers are
 *   restoreInitialPage()'s bookkeeping repaints, where subscribers ARE
 *   registered and the flag is doing the whole job — see their own comments.
 *
 *   Every OTHER caller omits this argument and gets both channels.
 */
function renderPage(key, skipHistory = false, skipHooks = false) {
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
    // When js/editing/inline-content-edit.js's addListItem() opens a new item, it
    // triggers this same render and then, two rAFs later, calls
    // openEditorJsEditor() — which sets editingPath synchronously before
    // the async open() runs. transition.finished fires after the animation
    // completes, which under load can be AFTER those two rAFs: focusing the
    // h1 then steals focus from the editor's contenteditable, fires a
    // focusout that commits with empty text, and collapses the editor before
    // the reviewer can type. Skip the focus entirely when an editor is open.
    //
    // window.inlineEdit is the public API js/editing/inline-content-edit.js mounts
    // on window; the optional chain degrades gracefully to "always focus" on
    // any page where that module hasn't loaded yet.
    if (window.inlineEdit?.isEditing?.()) return
    document.querySelector('#mockPage h1')?.focus()
  }
  // Synchronously, before EITHER branch touches the DOM. The before-channel's
  // whole value is that the outgoing page's content and form values are still
  // on screen when it runs, so it must not be deferred and must not move
  // inside the startViewTransition callback below — that callback is invoked
  // after the browser has taken its snapshot, which is already too late.
  if (!skipHooks) runBeforeRenderHooks(key)
  if (!document.startViewTransition) {
    applyPageContent(key)
    focusRenderedPageHeading()
    if (!skipHooks) {
      // Deferred with the same setTimeout(fn, 0) the old js/review/ux-improvements.js
      // wrapper used for its non-transition applyAndRefresh dispatch, and for
      // the same reason: a hook (applySavedPageState, by way of
      // js/review/ux-improvements.js's registered subscriber) can trigger the async
      // section_edits follow-up render documented on
      // js/review/ux-improvements-state-sync.js's refreshInFlightForKey guard. Calling
      // hooks synchronously here would run that nested render inside this
      // render's own call stack instead of after it. The subscriber list is
      // bound NOW rather than when the timer fires — see
      // scheduleAfterRenderHooks().
      window.setTimeout(scheduleAfterRenderHooks(key), 0)
    }
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
  // Hooks run off updateCallbackDone (DOM committed), not transition.finished
  // (full animation done) — matching where the old js/review/ux-improvements.js
  // wrapper ran applyAndRefresh, since patching sidebar fields any earlier
  // would hit the outgoing page's elements. The .catch() runs FIRST, then
  // .then(): an interrupted transition (fast successive navigation) rejects
  // updateCallbackDone with AbortError, the catch swallows it and the chain
  // still resolves, so the hooks still run for whichever render actually
  // won — reproducing the old wrapper's behavior, where `result` was already
  // caught before `.then(applyAndRefresh)` ran on it. Reversing this order
  // would silently skip every subscriber (including the one that restores
  // saved review fields) on every interrupted transition.
  // Bound here, synchronously, for the same reason as the setTimeout path
  // above: this promise settles long after renderPage() returns.
  const dispatchAfterHooks = skipHooks ? null : scheduleAfterRenderHooks(key)
  return transition.updateCallbackDone
    .catch((err) => {
      if (err?.name !== 'AbortError') throw err
    })
    .then(() => {
      if (dispatchAfterHooks) dispatchAfterHooks()
    })
}

/**
 * Repaint a page without navigating: no history entry, no hook dispatch.
 *
 * `renderPage(key, true, true)` is what all three callers actually wrote, and
 * two anonymous booleans at a call site do not say which of renderPage's three
 * separable jobs — resolve-and-paint, push history, dispatch navigation
 * bookkeeping — are being turned off. Getting one of them wrong is silent:
 * a spurious history entry, or an untouched preference stamped into storage
 * (see the Karl-tags regression on `skipHooks` above). This names the
 * combination once so the call sites state intent instead of re-deriving it
 * from a comment.
 *
 * This is a thin alias, not a second entry point — it is renderPage with both
 * flags set, and anything that changes about repainting belongs in renderPage.
 *
 * @param {string} key page key to repaint
 * @returns {*} whatever renderPage returns (a Promise under View Transitions)
 */
function repaintPage(key) {
  return renderPage(key, true, true)
}

/* Republished as a browser global. This one is load-bearing in a way the
   others are not, though what NEEDS it changed here: js/review/ux-improvements.js
   used to wrap `window.renderPage` to refresh itself after every navigation —
   reading the current value, closing over it, and reassigning the wrapper
   (guarded by its own `__…Wrapped` flag so the chain built exactly once).
   That wrapper is gone; ux-improvements.js now registers with
   onAfterRender() above instead, which needs no `window` reference at all,
   since page-render.js calls its subscribers directly rather than being
   monkey-patched by them.

   js/editing/inline-content-edit.js's wrapper is gone too — it decorated
   #mockPage's add/remove controls and Edited badges by reassigning
   `window.renderPage`, and is now an onAfterRender() subscriber like
   ux-improvements.js's. **No module wraps this function any more**, so if you
   are here to add post-render work, subscribe above rather than reassigning
   below; a wrapper only decorates callers that reach for the global, which
   silently excludes anyone using the import.

   What still needs this assignment is calling, not wrapping:
   roughly fifteen call sites across the review/UX IIFEs (js/ai/ai-rewrite.js,
   js/core/page-registry.js, js/review/review-queue.js,
   js/review/keyboard-shortcuts.js, js/review/ux-improvements-workspace.js,
   js/mockup/mockup-image-export.js, js/editing/inline-content-edit.js among them) call
   `window.renderPage?.(key)` directly rather than importing renderPage, since
   they are self-mounting IIFEs reaching this module the same way the old
   shared script scope let every classic <script> reach every global. */
window.renderPage = renderPage

/* Also published for js/ai/ai-assist-render.js, which calls it to preview an
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
  onAfterRender,
  onBeforeRender,
  renderPageMain,
  paragraphList,
  renderAudience,
  renderCards,
  renderPage,
  renderParentLink,
  renderRelatedList,
  renderResourcesList,
  renderAccordionSection,
  renderCustomSection,
  renderSection,
  renderServiceGroup,
  renderServiceTiles,
  renderSpotlightSection,
  renderSteps,
  renderTable,
  renderTextItems,
  renderTopFacts,
  repaintPage,
  runAfterRenderHooks,
  runBeforeRenderHooks,
  scheduleAfterRenderHooks,
}
