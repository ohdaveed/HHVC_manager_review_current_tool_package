// Mockup page rendering: turns page-data.js page objects into the HTML shown
// in #mockPage, including Karl placement/rationale tags. Depends on
// js/state.js (escapeHtml, pageData) and js/editor-panel.js /
// js/ui-controls.js for the post-render side effects triggered by
// applyPageContent (syncEditorFields, updateDirtyIndicators, etc.).
function karlTag(label, kind = 'body') {
  return `<mark class="karl-tag" data-kind="${kind}"><strong>Karl:</strong> ${escapeHtml(label)}</mark>`
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
  const backLink = event.target.closest('.back-link')
  if (backLink) {
    event.preventDefault()
    window.history.back()
    return
  }
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
      return `<article class="card">${karlTag(c.karl || 'Linked page item: title + description + link. Use Related section, body link, Resource Collection item, or Agency page link section as appropriate.', 'placement')}<h3><a href="${href}"${attr}>${escapeHtml(c.title)}${externalMark}</a></h3>${c.text ? `<p>${escapeHtml(c.text)}</p>` : ''}</article>`
    })
    .join('')}</div>`
}
function renderSteps(steps = []) {
  return `<ol class="step-list">${steps.map((s) => `<li class="step"><div>${karlTag(s.karl || 'Body step', s.button ? 'placement' : 'body')}<h3>${escapeHtml(s.title)}</h3>${paragraphList(s.text || [])}${bulletList(s.bullets || [])}${s.button ? button(s.button, 'primary', s.buttonTarget || null, s.buttonUrl || null) : ''}${s.callout ? `<aside class="callout callout--step">${karlTag(s.callout.karl || 'Body note', 'body')}${s.callout.title === false ? '' : `<strong>${escapeHtml(s.callout.title || 'Note')}:</strong> `}${formatMarkdown(s.callout.text)}</aside>` : ''}</div></li>`).join('')}</ol>`
}
function renderTable(rows = []) {
  if (!rows.length) return ''
  const [head, ...body] = rows
  return `<table class="table"><thead><tr>${head.map((h) => `<th>${formatMarkdown(h)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${formatMarkdown(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
}
function renderSection(section) {
  const kind = section.kind || 'body'
  let inner = `${karlTag(section.karl || 'Body section', kind)}<h2>${escapeHtml(section.heading)}</h2>`
  inner += paragraphList(section.paragraphs || [])
  inner += section.steps ? renderSteps(section.steps) : ''
  inner += bulletList(section.bullets || [])
  inner += section.table ? renderTable(section.table) : ''
  if (section.callout)
    inner += `<aside class="callout callout--panel">${karlTag(section.callout.karl || 'Body callout', 'body')}<div class="callout-header"><span class="callout-icon" aria-hidden="true">ⓘ</span><h3>What to know</h3></div>${formatMarkdown(section.callout.text)}</aside>`
  if (section.button)
    inner += button(
      section.button,
      section.buttonStyle || 'primary',
      section.buttonTarget || null,
      section.buttonUrl || null
    )
  if (section.cards) inner += renderCards(section.cards)
  return `<section class="section">${inner}</section>`
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
        <section class="hero"><div class="hero-inner">${karlTag('Metadata: Karl page type', 'meta')}<div class="eyebrow">${escapeHtml(page.type)}</div>${karlTag('Page title field', 'meta')}<h1 tabindex="-1">${escapeHtml(page.title)}</h1>${karlTag('Short summary / Description field', 'meta')}<p class="summary">${escapeHtml(page.summary)}</p>${karlTag('Metadata: Agency, program, reading target', 'meta')}<div class="metadata"><span class="pill">Environmental Health</span><span class="pill">HHVC</span><span class="pill">${escapeHtml(page.reading)}</span></div></div></section>
        <main class="page-body">${editorQaBlock(page)}<section class="section audience-section">${karlTag('Body: Audience section', 'body')}<h2>Who this page is for</h2><p>This page can help if you are:</p><ul>${renderAudience(page.audience)}</ul></section>${page.sections.map(renderSection).join('')}</main>
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
  updateDirtyIndicators(key)
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
