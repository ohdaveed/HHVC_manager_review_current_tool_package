// Mockup page rendering: turns page-data.js page objects into the HTML shown
// in #mockPage, including Karl placement/rationale tags. Depends on
// js/state.js (escapeHtml, pageData) and js/editor-panel.js /
// js/ui-controls.js for the post-render side effects triggered by
// applyPageContent (syncEditorFields, etc.).
function karlTag(label, kind = 'body') {
  const meta = typeof karlKindMeta === 'function' ? karlKindMeta(kind) : { label: 'Body' }
  return `<mark class="karl-tag" data-kind="${escapeHtml(kind)}"><span class="karl-tag-kind">${escapeHtml(meta.label)}</span><span class="karl-tag-text"><strong>Karl:</strong> ${escapeHtml(label)}</span></mark>`
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
function formatMarkdown(text) {
  if (typeof text !== 'string') return ''
  let html = escapeHtml(text).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="#" data-render-target="$2">$1</a>')
  return html
}
function paragraphList(paragraphs = []) {
  return paragraphs.map((p) => `<p>${formatMarkdown(p)}</p>`).join('')
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
function bulletList(bullets = []) {
  if (!bullets.length) return ''
  return `<ul>${bullets.map((b) => `<li>${formatMarkdown(b)}</li>`).join('')}</ul>`
}
function normalizePageType(type = '') {
  const t = String(type).toLowerCase()
  if (t.includes('transaction')) return 'transaction'
  if (t.includes('information')) return 'information'
  if (t.includes('topic')) return 'topic'
  if (t.includes('resource collection')) return 'resource-collection'
  if (t.includes('campaign')) return 'campaign'
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
  if (pageType === 'information') {
    if (k.includes('external') && section.cards) return 'resources'
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
  const body = []
  for (const section of page.sections || []) {
    const role = inferSectionRole(section, pageType)
    if (role === 'related') related.push(section)
    else if (role === 'services') services.push(section)
    else if (role === 'resources') resources.push(section)
    else if (role === 'intro') intro.push(section)
    else if (role === 'what-to-do') whatToDo.push(section)
    else if (role === 'supporting') supporting.push(section)
    else body.push(section)
  }
  return { pageType, intro, services, resources, related, whatToDo, supporting, body }
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
  const backLink = event.target.closest('.back-link')
  if (backLink) {
    event.preventDefault()
    window.history.back()
    return
  }
  const link = event.target.closest(
    'a[data-render-target], a[data-render-inert], button[data-accordion-toggle]'
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
    return `<a class="${cls}" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${karlTag(kind === 'secondary' ? 'Links: Body external resource' : 'Button: Primary CTA (external)', 'placement')}${escapeHtml(label)} <span aria-hidden="true">↗</span></a>`
  }
  const attr = target ? ` data-render-target="${escapeHtml(target)}"` : ''
  return `<a class="${cls}" href="#"${attr}>${karlTag(kind === 'secondary' ? 'Links: Related Transaction page' : 'Button: Primary CTA', 'placement')}${escapeHtml(label)}</a>`
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
function renderImage(image) {
  if (!image?.src) return ''
  return `<figure class="content-image">${karlTag(image.karl || 'Information section: Image', 'body')}<img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt || '')}" loading="lazy" />${image.caption ? `<figcaption>${escapeHtml(image.caption)}</figcaption>` : ''}</figure>`
}
function renderCards(cards = []) {
  return `<div class="cards">${cards
    .map((c) => {
      const href = c.url ? escapeHtml(c.url) : '#'
      const attr = c.url
        ? ' target="_blank" rel="noopener"'
        : c.target
          ? ` data-render-target="${escapeHtml(c.target)}"`
          : ' data-render-inert=""'
      const externalMark = c.url ? ' <span aria-hidden="true">↗</span>' : ''
      return `<article class="card">${karlTag(c.karl || 'Linked page item: title + description + link. Use Related section, body link, Resource Collection item, or Agency page link section as appropriate.', 'placement')}<h3><a href="${href}"${attr}>${escapeHtml(c.title)}${externalMark}</a></h3>${c.text ? `<p>${escapeHtml(c.text)}</p>` : ''}</article>`
    })
    .join('')}</div>`
}
function renderServiceTiles(cards = []) {
  return `<div class="service-tiles">${cards
    .map((c) => {
      const href = c.url ? escapeHtml(c.url) : '#'
      const attr = c.url
        ? ' target="_blank" rel="noopener"'
        : c.target
          ? ` data-render-target="${escapeHtml(c.target)}"`
          : ' data-render-inert=""'
      const externalMark = c.url ? ' <span aria-hidden="true">↗</span>' : ''
      return `<a class="service-tile" href="${href}"${attr}>${karlTag(c.karl || 'Topic page service item', 'placement')}<span class="service-tile-title">${escapeHtml(c.title)}${externalMark}</span><span class="service-tile-text">${escapeHtml(c.text)}</span></a>`
    })
    .join('')}</div>`
}
function renderSteps(steps = []) {
  return `<ol class="step-list">${steps.map((s) => `<li class="step"><div>${karlTag(s.karl || 'Body step', s.button ? 'placement' : 'body')}<h3>${escapeHtml(s.title)}</h3>${paragraphList(s.text || [])}${bulletList(s.bullets || [])}${s.button ? button(s.button, 'primary', s.buttonTarget || null, s.buttonUrl || null) : ''}${s.callout ? `<aside class="callout callout--step">${karlTag(s.callout.karl || 'Body note', 'body')}${s.callout.title === false ? '' : `<strong>${escapeHtml(s.callout.title || 'Note')}:</strong> `}${formatMarkdown(s.callout.text)}</aside>` : ''}</div></li>`).join('')}</ol>`
}
function renderResourcesList(cards = [], heading = 'Resources') {
  if (!cards.length) return ''
  return `<div class="resources-list">${karlTag('Body: Resources links', 'placement')}<h3 class="resources-list-heading">${escapeHtml(heading)}</h3><ul>${cards
    .map((c) => {
      const href = c.url ? escapeHtml(c.url) : '#'
      const attr = c.url
        ? ' target="_blank" rel="noopener noreferrer"'
        : c.target
          ? ` data-render-target="${escapeHtml(c.target)}"`
          : ' data-render-inert=""'
      const externalMark = c.url ? ' <span class="external-mark" aria-hidden="true">↗</span>' : ''
      const fileBadge = c.fileType
        ? `<span class="file-badge">${escapeHtml(c.fileType)}</span>`
        : ''
      return `<li>${karlTag(c.karl || 'Resources section link', 'placement')}<a href="${href}"${attr}>${escapeHtml(c.title)}${externalMark}</a>${fileBadge}<p>${escapeHtml(c.text)}</p></li>`
    })
    .join('')}</ul></div>`
}
function renderRelatedList(cards = [], heading = 'Related') {
  if (!cards.length) return ''
  return `<section class="section section--related">${karlTag('Related section: linked pages', 'placement')}<h2>${escapeHtml(heading)}</h2>${renderCards(cards)}</section>`
}
function renderRelatedRail(sections = []) {
  const cards = sections.flatMap((s) => s.cards || [])
  if (!cards.length) return ''
  return `<aside class="related-rail" aria-label="Related pages">${karlTag('Related section: right-panel linked pages', 'placement')}<h2 class="related-rail-title">Related</h2><ul class="related-rail-list">${cards
    .map((c) => {
      const href = c.url ? escapeHtml(c.url) : '#'
      const attr = c.url
        ? ' target="_blank" rel="noopener noreferrer"'
        : c.target
          ? ` data-render-target="${escapeHtml(c.target)}"`
          : ' data-render-inert=""'
      return `<li><a href="${href}"${attr}>${escapeHtml(c.title)}</a><p>${escapeHtml(c.text)}</p></li>`
    })
    .join('')}</ul></aside>`
}
function renderSteps(steps = []) {
  return `<ol class="step-list">${steps
    .map(
      (s) =>
        `<li class="step"><div>${karlTag(s.karl || 'Step List: body step', s.button ? 'placement' : 'body')}<h3>${escapeHtml(s.title)}</h3>${paragraphList(s.text || [])}${bulletList(s.bullets || [])}${s.cards ? renderCards(s.cards) : ''}${s.button ? button(s.button, 'secondary', s.buttonTarget || null, s.buttonUrl || null) : ''}${s.callout ? renderCallout(s.callout) : ''}</div></li>`
    )
    .join('')}</ol>`
}
function renderTable(rows = [], pageType = 'generic') {
  if (!rows.length) return ''
  const [head, ...body] = rows
  const previewNote =
    pageType === 'information'
      ? `<p class="mockup-only-note">${karlTag('Editor QA: Report-only table preview on Information page', 'editor')}Tables are native to the <strong>Report</strong> content type in Karl, not Information. Use card-based routing or a linked Resource Collection in production.</p>`
      : ''
  return `${previewNote}<table class="table"><thead><tr>${head.map((h) => `<th>${formatMarkdown(h)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${formatMarkdown(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
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
  const thingItems = Array.isArray(things)
    ? things.map((item) =>
        typeof item === 'string' ? item : `${item.label ? item.label + ': ' : ''}${item.text || ''}`
      )
    : []
  if (!cost && !thingItems.length) return ''
  return `<section class="what-to-know">${karlTag('What to know before you start: Cost and Things to know', 'body')}<h2 class="visually-hidden">What to know before you start</h2>${cost ? `<p class="what-to-know-cost"><strong>Cost:</strong> ${escapeHtml(cost)}</p>` : ''}${thingItems.length ? `<div class="what-to-know-things"><strong>Things to know</strong>${renderTextItems(thingItems)}</div>` : ''}</section>`
}
function renderContactSection(contact, page) {
  const data = contact || resolveContact(page)
  if (!data) return ''
  const blocks = []
  if (data.address) blocks.push(`<p><strong>Address</strong><br>${escapeHtml(data.address)}</p>`)
  if (data.phone?.length)
    blocks.push(
      `<p><strong>Phone</strong><br>${data.phone.map((p) => escapeHtml(p)).join('<br>')}</p>`
    )
  if (data.email?.length)
    blocks.push(
      `<p><strong>Email</strong><br>${data.email.map((e) => escapeHtml(e)).join('<br>')}</p>`
    )
  if (data.hours) blocks.push(`<p><strong>Hours</strong><br>${escapeHtml(data.hours)}</p>`)
  if (data.other?.length)
    blocks.push(
      `<p><strong>Other</strong><br>${data.other.map((o) => escapeHtml(o)).join('<br>')}</p>`
    )
  return `<section class="contact-section section">${karlTag('Contact section', 'placement')}<h2>Contact us</h2>${blocks.join('')}</section>`
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
  return `<div class="accordion-item"><button type="button" class="accordion-trigger" data-accordion-toggle aria-expanded="false" aria-controls="${panelId}">${escapeHtml(section.heading)}</button><div class="accordion-panel" id="${panelId}" hidden>${renderSectionInner(section, pageType)}</div></div>`
}
function renderSectionInner(section, pageType = 'generic') {
  let inner = ''
  inner += paragraphList(section.paragraphs || [])
  inner += section.steps ? renderSteps(section.steps) : ''
  inner += bulletList(section.bullets || [])
  inner += section.image ? renderImage(section.image) : ''
  inner += section.table ? renderTable(section.table, pageType) : ''
  if (section.callout) inner += renderCallout(section.callout)
  if (section.button)
    inner += button(
      section.button,
      section.buttonStyle || 'primary',
      section.buttonTarget || null,
      section.buttonUrl || null
    )
  if (section.cards && section.component === 'services') inner += renderServiceTiles(section.cards)
  else if (section.cards && (section.component === 'resources' || section.cards.some((c) => c.url)))
    inner += renderResourcesList(section.cards, section.heading)
  else if (section.cards) inner += renderCards(section.cards)
  return inner
}
function renderSection(section, pageType = 'generic', options = {}) {
  const kind = section.kind || 'body'
  const role = inferSectionRole(section, pageType)
  const anchor = section.heading ? ` id="${sectionAnchorId(section.heading)}"` : ''
  const tag = options.skipKarl ? '' : karlTag(section.karl || 'Body section', kind)
  const heading =
    role === 'what-to-do' && pageType === 'transaction'
      ? `<h2 class="what-to-do-heading">What to do</h2>`
      : section.heading
        ? `<h2${anchor}>${escapeHtml(section.heading)}</h2>`
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
function renderServicesRegion(sections, pageType) {
  if (!sections.length) return ''
  return `<div class="services-region">${karlTag('Topic page Services section', 'placement')}<h2 class="region-title">Services</h2>${sections.map((s) => renderSection(s, pageType)).join('')}</div>`
}
function renderResourcesRegion(sections, pageType) {
  if (!sections.length) return ''
  return `<div class="resources-region">${karlTag('Topic page Resources section', 'placement')}<h2 class="region-title">Resources</h2>${sections.map((s) => renderSection(s, pageType)).join('')}</div>`
}
function renderSpotlight(spotlight) {
  if (!spotlight) return ''
  const img = spotlight.image
    ? `<div class="spotlight-media"><img src="${escapeHtml(spotlight.image.src)}" alt="${escapeHtml(spotlight.image.alt || '')}" loading="lazy" /></div>`
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
  const ctaHtml = heroCta
    ? `<div class="hero-cta">${button(heroCta.label, 'primary', heroCta.target, heroCta.url)}</div>`
    : ''
  const topicChip = page.topicTag
    ? `<span class="pill pill--topic">${escapeHtml(page.topicTag)}</span>`
    : ''
  return `<section class="hero"><div class="hero-inner">${karlTag('Metadata: Karl page type', 'meta')}<div class="eyebrow">${escapeHtml(page.type)}</div>${karlTag('Page title field', 'meta')}<h1 tabindex="-1">${escapeHtml(page.title)}</h1>${karlTag('Short summary / Description field', 'meta')}<p class="summary">${escapeHtml(page.summary)}</p>${ctaHtml}${karlTag('Metadata: Agency, program, reading target', 'meta')}<div class="metadata"><span class="pill">Environmental Health</span><span class="pill">HHVC</span><span class="pill">${escapeHtml(page.reading)}</span>${topicChip}</div></div></section>`
}
function renderPageMain(page) {
  const parts = partitionSections(page)
  const { pageType, intro, services, resources, related, whatToDo, supporting, body } = parts
  const heroCta = resolveHeroCta(page, whatToDo)
  let html = renderHero(page, heroCta)
  html += `<main class="page-body page-body--${pageType}">`
  html += editorQaBlock(page)
  html += `<section class="section audience-section">${karlTag('Body: Audience section', 'body')}<h2>Who this page is for</h2><p>This page can help if you are:</p><ul>${renderAudience(page.audience)}</ul></section>`
  if (page.spotlight) html += renderSpotlight(page.spotlight)
  if (pageType === 'transaction') {
    html += renderWhatToKnow(page.whatToKnow, page)
    html += `<div class="page-layout page-layout--transaction"><div class="page-layout-main">`
    whatToDo.forEach((s) => {
      html += renderSection(s, pageType)
    })
    if (supporting.length) {
      html += `<div class="supporting-info">${karlTag('Supporting information: Accordions and custom sections', 'body')}<h2 class="visually-hidden">Supporting information</h2>`
      supporting.forEach((s) => {
        html += renderAccordionSection(s, pageType)
      })
      html += `</div>`
    }
    body.forEach((s) => {
      html += renderSection(s, pageType)
    })
    html += `</div>${renderRelatedRail(related)}</div>`
    html += renderContactSection(page.contact, page)
  } else if (pageType === 'information') {
    const infoBody = [
      ...body,
      ...supporting.filter((s) => inferSectionRole(s, pageType) === 'body'),
    ]
    html += renderOnThisPage(infoBody)
    infoBody.forEach((s) => {
      html += renderSection(s, pageType)
    })
    resources.forEach((s) => {
      html += renderSection({ ...s, component: 'resources' }, pageType)
    })
  } else if (pageType === 'topic') {
    intro.forEach((s) => {
      html += renderSection(s, pageType)
    })
    html += renderServicesRegion(services, pageType)
    html += renderResourcesRegion(resources, pageType)
  } else if (pageType === 'resource-collection') {
    intro.forEach((s) => {
      html += renderSection(s, pageType)
    })
    resources.forEach((s) => {
      html += renderSection({ ...s, component: 'resources' }, pageType)
    })
  } else {
    ;[...body, ...whatToDo, ...supporting, ...intro, ...services, ...resources].forEach((s) => {
      html += renderSection(s, pageType)
    })
  }
  if (pageType === 'information') {
    related.forEach((s) => {
      html += renderRelatedList(s.cards || [], s.heading || 'Related')
    })
    html += renderContactSection(page.contact, page)
  }
  if (pageType === 'topic' || pageType === 'resource-collection') {
    related.forEach((s) => {
      html += renderRelatedList(s.cards || [], s.heading || 'Related')
    })
  }
  html += `</main>`
  return html
}
function applyPageContent(key) {
  const page = pageData[key]
  if (!page) return
  saveSidebarScroll()
  currentPageKey = key
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
        <nav class="page-breadcrumbs" aria-label="Breadcrumbs"><div class="page-breadcrumbs-inner"><a href="#" class="back-link">Back</a><ol><li><a href="#">Home</a></li><li><a href="#">Services</a></li><li><span aria-current="page">${escapeHtml(page.title)}</span></li></ol></div></nav>
        ${pageHtml}
        <div class="mockup-banner">This is a design mockup for HHVC content review, not a live SF.gov page.</div>
        <footer class="footer">
          <div class="footer-inner">
            <div class="footer-brand">
               <div class="footer-brand-row">
                 <span class="footer-brand-mark" aria-hidden="true"></span>
                 <strong class="footer-brand-name">City and County of<br>SAN FRANCISCO</strong>
               </div>
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
  updatePageBadge(page.title)
  applyChecklistState(key)
  restoreSidebarScroll()
}
function renderPage(key, skipHistory = false) {
  if (!pageData[key]) return
  if (!skipHistory) {
    const url = new URL(window.location)
    url.searchParams.set('page', key)
    window.history.pushState({ key }, '', url)
  }
  if (!document.startViewTransition) {
    applyPageContent(key)
    return
  }
  const transition = document.startViewTransition(() => applyPageContent(key))
  transition.ready.catch(() => {})
  transition.finished
    .then(() => {
      document.querySelector('#mockPage h1')?.focus()
    })
    .catch((err) => {
      if (err?.name !== 'AbortError') throw err
    })
  return transition.updateCallbackDone.catch((err) => {
    if (err?.name !== 'AbortError') throw err
  })
}
