/* Interactive HHVC sitemap diagram.
   Orchestrator: interaction handlers and lifecycle wiring on top of
   window.InteractiveSitemap.state/.data (js/interactive-sitemap-data.js) and
   window.InteractiveSitemap.render (js/interactive-sitemap-render.js). */
;(function mountInteractiveSitemap() {
  const DATA = window.HHVC_DATA
  if (!hasValidPageData(DATA) || !window.InteractiveSitemap?.render) return

  let sitemapMounted = false

  const { debounce } = window.utils
  const state = window.InteractiveSitemap.state
  const { getCurrentKey } = window.InteractiveSitemap.data
  const { rerender } = window.InteractiveSitemap.render

  function openPageByKey(key) {
    if (!key || !DATA.pages[key]) return
    state.selectedKey = key
    window.renderPage?.(key)
    window.setTimeout(rerender, 0)
    window.setTimeout(() => {
      const node = document.querySelector(`[data-sitemap-key="${CSS.escape(key)}"]`)
      if (node) node.focus()
    }, 50)
  }

  function handleClick(event) {
    const actionButton = event.target.closest('[data-sitemap-action]')
    if (actionButton) {
      const action = actionButton.getAttribute('data-sitemap-action')
      if (action === 'clear-search') {
        state.search = ''
        rerender()
        return
      }
      if (action === 'go-to-current') {
        openPageByKey(getCurrentKey())
        return
      }
      if (action === 'toggle-links') {
        state.showLinksFromSelected = !state.showLinksFromSelected
        rerender()
        return
      }
      if (action === 'open-link') {
        const chip = event.target.closest('[data-sitemap-key]')
        const key = chip?.getAttribute('data-sitemap-key')
        openPageByKey(key)
        return
      }
    }

    const filterButton = event.target.closest('[data-sitemap-filter]')
    if (filterButton) {
      state.filter = filterButton.getAttribute('data-sitemap-filter') || 'All'
      state.showLinksFromSelected = false
      rerender()
      return
    }

    const nodeButton = event.target.closest('[data-sitemap-key]')
    if (nodeButton) {
      const key = nodeButton.getAttribute('data-sitemap-key')
      openPageByKey(key)
      return
    }
  }

  function handleKeydown(event) {
    const searchInput = event.target.closest('.sitemap-search-input')
    if (searchInput) {
      if (event.key === 'Escape') {
        state.search = ''
        searchInput.value = ''
        rerender()
        searchInput.focus()
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        const firstNode = document.querySelector('.sitemap-diagram-node:not(.dimmed)')
        if (firstNode) firstNode.focus()
        return
      }
    }

    if (event.key === 'Escape') {
      state.showLinksFromSelected = false
      state.filter = 'All'
      rerender()
      return
    }

    const focusedNode = document.activeElement?.closest('.sitemap-diagram-node')
    if (!focusedNode || focusedNode.classList.contains('dimmed')) return

    const nodes = Array.from(document.querySelectorAll('.sitemap-diagram-node:not(.dimmed)'))
    const index = nodes.indexOf(focusedNode)

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      nodes[index + 1]?.focus()
      return
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      nodes[index - 1]?.focus()
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      nodes[0]?.focus()
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      nodes[nodes.length - 1]?.focus()
      return
    }
  }

  const handleSearchInput = debounce((event) => {
    if (!event.target.closest('.sitemap-search-input')) return
    state.search = event.target.value
    state.showLinksFromSelected = false
    rerender()
    const input = document.querySelector('.sitemap-search-input')
    if (input) {
      input.focus()
      const end = input.value.length
      input.setSelectionRange(end, end)
    }
  }, 180)

  function wrapRenderPageForSitemap() {
    if (typeof window.renderPage !== 'function' || window.renderPage.__sitemapWrapped) return
    const originalRenderPage = window.renderPage
    window.renderPage = function renderPageWithSitemapRefresh(key) {
      const result = originalRenderPage.call(this, key)
      // Under View Transitions, renderPage returns a promise that resolves
      // once #pageSelect reflects the new page; rerendering earlier would
      // highlight the previous page as current.
      if (result && typeof result.then === 'function')
        result.then(() => {
          if (sitemapMounted) rerender()
        })
      else if (sitemapMounted) rerender()
      return result
    }
    window.renderPage.__sitemapWrapped = true
  }

  function ensureSitemapRendered() {
    if (sitemapMounted) {
      rerender()
      return
    }
    sitemapMounted = true
    rerender()
  }

  function init() {
    document.addEventListener('click', handleClick)
    document.addEventListener('keydown', handleKeydown)
    document.addEventListener('input', handleSearchInput)
    document.addEventListener('hhvc:review-data-changed', () => {
      if (sitemapMounted) rerender()
    })
    wrapRenderPageForSitemap()

    window.__mountInteractiveSitemapOnTabOpen = ensureSitemapRendered
  }

  function teardown() {
    sitemapMounted = false
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }

  if (typeof window !== 'undefined') {
    window.__mountInteractiveSitemapTeardown = teardown
  }
})()
