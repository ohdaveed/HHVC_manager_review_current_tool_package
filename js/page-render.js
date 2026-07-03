// Mockup page rendering: turns page-data.js page objects into the HTML shown
// in #mockPage, including Karl placement/rationale tags. Depends on
// js/state.js (escapeHtml, pageData) and js/editor-panel.js /
// js/ui-controls.js for the post-render side effects triggered by
// applyPageContent (syncEditorFields, updateDirtyIndicators, etc.).
function karlTag(label, kind = 'body') {
  return `<div class="karl-tag" data-kind="${kind}"><strong>Karl:</strong> ${escapeHtml(label)}</div>`
}
function formatMarkdown(text) {
  if (typeof text !== 'string') return ''
  return escapeHtml(text).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
}
function paragraphList(paragraphs = []) {
  return paragraphs.map((p) => `<p>${formatMarkdown(p)}</p>`).join('')
}
function renderAudience(audience = []) {
  if (!Array.isArray(audience)) return ''
  return audience.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
}
function bulletList(bullets = []) {
  if (!bullets.length) return ''
  return `<ul>${bullets.map((b) => `<li>${formatMarkdown(b)}</li>`).join('')}</ul>`
}
// Mockup-internal navigation for buttons/cards rendered from page data.
// A delegated listener avoids inline onclick handlers, which would execute
// page-data strings in a JS context that escapeHtml does not protect.
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[data-render-target], a[data-render-inert]')
  if (!link) return
  event.preventDefault()
  const key = link.getAttribute('data-render-target')
  if (key) window.renderPage(key)
})
function button(label, kind = 'primary', target = null, url = null) {
  const cls = kind === 'secondary' ? 'btn secondary' : 'btn'
  if (url) {
    return `<a class="${cls}" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${karlTag(kind === 'secondary' ? 'Body link to external tool or resource' : 'Button label: Primary CTA to external tool', 'placement')}${escapeHtml(label)} <span aria-hidden="true">↗</span></a>`
  }
  const attr = target ? ` data-render-target="${escapeHtml(target)}"` : ''
  return `<a class="${cls}" href="#"${attr}>${karlTag(kind === 'secondary' ? 'Body link to related Transaction page' : 'Button label: Primary CTA', 'placement')}${escapeHtml(label)}</a>`
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
      return `<article class="card">${karlTag(c.karl || 'Linked page item: title + description + link. Use Related section, body link, Resource Collection item, or Agency page link section as appropriate.', 'placement')}<h3><a href="${href}"${attr}>${escapeHtml(c.title)}${externalMark}</a></h3><p>${escapeHtml(c.text)}</p></article>`
    })
    .join('')}</div>`
}
function renderSteps(steps = []) {
  return `<ol class="step-list">${steps.map((s) => `<li class="step"><div>${karlTag(s.karl || 'Body step', s.button ? 'placement' : 'body')}<h3>${escapeHtml(s.title)}</h3>${paragraphList(s.text || [])}${bulletList(s.bullets || [])}${s.button ? button(s.button, 'primary', s.buttonTarget || null, s.buttonUrl || null) : ''}${s.callout ? `<div class="callout">${karlTag(s.callout.karl || 'Body note', 'body')}${s.callout.title === false ? '' : `<strong>${escapeHtml(s.callout.title || 'Note')}:</strong> `}${formatMarkdown(s.callout.text)}</div>` : ''}</div></li>`).join('')}</ol>`
}
function renderTable(rows = []) {
  if (!rows.length) return ''
  const [head, ...body] = rows
  return `<table class="table"><thead><tr>${head.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
}
function renderSection(section) {
  const kind = section.kind || 'body'
  let inner = `${karlTag(section.karl || 'Body section', kind)}<h2>${escapeHtml(section.heading)}</h2>`
  inner += paragraphList(section.paragraphs || [])
  inner += section.steps ? renderSteps(section.steps) : ''
  inner += bulletList(section.bullets || [])
  inner += section.table ? renderTable(section.table) : ''
  if (section.callout)
    inner += `<div class="callout">${karlTag(section.callout.karl || 'Body callout', 'body')}${formatMarkdown(section.callout.text)}</div>`
  if (section.button)
    inner += button(
      section.button,
      section.buttonStyle || 'primary',
      section.buttonTarget || null,
      section.buttonUrl || null
    )
  if (section.cards) inner += renderCards(section.cards)
  return `<div class="section">${inner}</div>`
}
function applyPageContent(key) {
  const page = pageData[key]
  if (!page) return
  saveSidebarScroll()
  currentPageKey = key
  document.getElementById('browserUrl').textContent = 'https://' + page.slug
  document.getElementById('urlInput').value = page.slug
  document.getElementById('pageSelect').value = key
  document.getElementById('mockPage').innerHTML = `
        <header class="site-header"><div class="site-header-inner"><a href="#" class="brand"><span class="brand-mark">SF</span><span>SF.gov</span></a><nav class="site-nav" aria-label="Example navigation"><a href="#">Services</a><a href="#">Departments</a><a href="#">Search</a></nav></div></header>
        <section class="hero"><div class="hero-inner">${karlTag('Metadata: Karl page type', 'meta')}<div class="eyebrow">${escapeHtml(page.type)}</div>${karlTag('Page title field', 'meta')}<h1 tabindex="-1">${escapeHtml(page.title)}</h1>${karlTag('Short summary / Description field', 'meta')}<p class="summary">${escapeHtml(page.summary)}</p>${karlTag('Metadata: Agency, program, reading target', 'meta')}<div class="metadata"><span class="pill">Environmental Health</span><span class="pill">HHVC</span><span class="pill">${escapeHtml(page.reading)}</span></div></div></section>
        <main class="page-body"><div class="editor-note">${karlTag('Editor-only QA note / Do not publish', 'editor')}<strong>Editor QA:</strong> ${escapeHtml(page.editorNote || `Primary agency: Environmental Health. Parent department: Department of Public Health. Program: Healthy Housing and Vector Control. Reading level target: ${page.reading}. Transaction pages use one primary CTA and avoid about-style program background. Visual link boxes in this mockup are preview aids.`)}</div><div class="section audience-section">${karlTag('Body: Audience section', 'body')}<h2>Who this page is for</h2><p>This page can help if you are:</p><ul>${renderAudience(page.audience)}</ul></div>${page.sections.map(renderSection).join('')}</main>
        <footer class="footer"><div class="footer-inner"><strong>City and County of San Francisco</strong><br>This is a design mockup for HHVC content review, not a live SF.gov page.</div></footer>`
  syncEditorFields(page)
  updateDirtyIndicators(key)
  updateReadingTarget(page)
  updatePageBadge(page.title)
  applyChecklistState(key)
  restoreSidebarScroll()
}
function renderPage(key) {
  if (!pageData[key]) return
  if (!document.startViewTransition) {
    applyPageContent(key)
    return
  }
  const transition = document.startViewTransition(() => applyPageContent(key))
  // `ready` rejects with AbortError whenever a transition is skipped (e.g.
  // rapid navigation); left unhandled it triggers the global error banner.
  transition.ready.catch(() => {})
  transition.finished
    .then(() => {
      document.querySelector('#mockPage h1')?.focus()
    })
    .catch((err) => {
      // Rapid navigation skips the pending transition with an AbortError; the
      // DOM update still ran, so that is not an error worth surfacing.
      if (err?.name !== 'AbortError') throw err
    })
  // Let wrappers (page label, UX refresh, sitemap) wait until applyPageContent
  // has actually run — the transition applies the DOM update asynchronously.
  // Skip aborts resolve normally so wrappers still refresh; real errors from
  // applyPageContent stay rejected and reach the global error banner.
  return transition.updateCallbackDone.catch((err) => {
    if (err?.name !== 'AbortError') throw err
  })
}
