// App bootstrap: wires up DOM event listeners and kicks off the initial
// render. Loaded after js/state.js, js/ui-controls.js, js/editor-panel.js,
// and js/page-render.js, all of which it depends on directly, and before
// js/manager-review-export.js, which wraps renderPage once init() has run.
function init() {
  buildPageSelect()
  const select = document.getElementById('pageSelect')
  select.addEventListener('change', (e) => renderPage(e.target.value))
  const urlInput = document.getElementById('urlInput')
  if (urlInput) {
    urlInput.addEventListener('input', (e) => {
      document.getElementById('browserUrl').textContent = 'https://' + e.target.value
      updateSearchPreview()
    })
  }
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
  mountKarlTagLegend?.()
  initChecklist()

  window.addEventListener('popstate', (e) => {
    if (e.state && e.state.key) {
      renderPage(e.state.key, true)
    } else {
      const params = new URLSearchParams(window.location.search)
      const key = params.get('page')
      if (key && pageData[key]) {
        renderPage(key, true)
      } else {
        renderPage('pestsTopic', true)
      }
    }
  })

  const params = new URLSearchParams(window.location.search)
  const initialKey = params.get('page') || 'pestsTopic'
  renderPage(initialKey, true)
}
init()
