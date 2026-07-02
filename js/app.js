// App bootstrap: wires up DOM event listeners and kicks off the initial
// render. Loaded after js/state.js, js/ui-controls.js, js/editor-panel.js,
// and js/page-render.js, all of which it depends on directly, and before
// js/manager-review-export.js, which wraps renderPage once init() has run.
function init() {
  buildPageSelect()
  const select = document.getElementById('pageSelect')
  select.addEventListener('change', (e) => renderPage(e.target.value))
  document.getElementById('urlInput').addEventListener('input', (e) => {
    document.getElementById('browserUrl').textContent = 'https://' + e.target.value
    updateSearchPreview()
  })
  document.getElementById('titleInput').addEventListener('input', (e) => {
    const page = pageData[currentPageKey]
    page.title = e.target.value
    applyFieldToMockup('title', e.target.value)
    if (!page.seoTitleEdited) {
      setValue('seoTitleInput', defaultSeoTitle(page))
    }
    updateSearchPreview()
    updateDirtyIndicators(currentPageKey)
  })
  document.getElementById('descriptionInput').addEventListener('input', (e) => {
    const page = pageData[currentPageKey]
    page.summary = e.target.value
    applyFieldToMockup('summary', e.target.value)
    if (!page.metaDescriptionEdited) {
      setValue('metaDescriptionInput', defaultMetaDescription(page))
    }
    updateSearchPreview()
    updateDirtyIndicators(currentPageKey)
  })
  document.getElementById('ctaInput').addEventListener('input', (e) => {
    const page = pageData[currentPageKey]
    setPrimaryCta(page, e.target.value)
    applyFieldToMockup('cta', e.target.value)
    updateDirtyIndicators(currentPageKey)
  })
  document.getElementById('seoTitleInput').addEventListener('input', (e) => {
    const page = pageData[currentPageKey]
    page.seoTitle = e.target.value
    page.seoTitleEdited = true
    updateSearchPreview()
  })
  document.getElementById('metaDescriptionInput').addEventListener('input', (e) => {
    const page = pageData[currentPageKey]
    page.metaDescription = e.target.value
    page.metaDescriptionEdited = true
    updateSearchPreview()
  })
  document.getElementById('tagToggle').addEventListener('change', (e) => {
    document.body.classList.toggle('hide-karl-tags', !e.target.checked)
  })
  document.getElementById('resetTitleBtn')?.addEventListener('click', () => resetField('title'))
  document
    .getElementById('resetDescriptionBtn')
    ?.addEventListener('click', () => resetField('summary'))
  document.getElementById('resetCtaBtn')?.addEventListener('click', () => resetField('cta'))
  document.getElementById('sidebarToggle')?.addEventListener('click', toggleSidebar)
  initChecklist()
  renderPage('pestsTopic')
}
init()
