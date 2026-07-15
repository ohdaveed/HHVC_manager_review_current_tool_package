// App bootstrap: wires up DOM event listeners and kicks off the initial
// render. Loaded after js/state.js, js/ui-controls.js, js/editor-panel.js,
// and js/page-render.js, all of which it depends on directly, and before
// js/manager-review-export.js, which wraps renderPage once init() has run.

// Resolves a ?page= URL param to a real page key, following the
// consolidation alias map for retired keys and falling back to the
// default page. Without this, renderPage() silently no-ops on an unknown
// key (e.g. an old saved/shared link), leaving the viewer stuck on the
// static "Loading…" placeholder in index.html forever. Pure resolution
// logic lives in resolvePageKey() (js/utils.js) so it's independently
// testable; this wrapper only adds the toast side effect.
function resolveInitialPageKey(key) {
  const result = resolvePageKey(key, pageData, window.HHVC_DELETED_PAGE_ALIASES, 'pestsTopic')
  if (typeof showToast === 'function') {
    if (result.status === 'aliased') {
      showToast(
        `That page has been consolidated. Showing "${pageData[result.key].title}" instead.`,
        'info'
      )
    } else if (result.status === 'unknown') {
      showToast(
        `"${result.from}" is not a page in this mockup. Showing the default page instead.`,
        'info'
      )
    }
  }
  return result.key
}

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
      renderPage(resolveInitialPageKey(params.get('page')), true)
    }
  })

  const params = new URLSearchParams(window.location.search)
  renderPage(resolveInitialPageKey(params.get('page')), true)
}
init()
