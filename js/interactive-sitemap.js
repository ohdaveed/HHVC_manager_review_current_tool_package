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

  function openPageByKey(key) {
    if (!key || !DATA.pages[key]) return
    state.selectedKey = key
    window.renderPage?.(key)
    window.setTimeout(window.InteractiveSitemap.render.rerender, 0)
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
        window.InteractiveSitemap.render.rerender()
        return
      }
      if (action === 'go-to-current') {
        openPageByKey(window.InteractiveSitemap.data.getCurrentKey())
        return
      }
      if (action === 'toggle-links') {
        state.showLinksFromSelected = !state.showLinksFromSelected
        window.InteractiveSitemap.render.rerender()
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
      window.InteractiveSitemap.render.rerender()
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
    const workspace = document.getElementById('reviewWorkspace')
    const sitemapTab = document.querySelector('[data-workspace-tab="sitemap"]')
    const sitemapVisible =
      workspace &&
      !workspace.hidden &&
      sitemapTab &&
      sitemapTab.getAttribute('aria-selected') === 'true'
    if (!sitemapVisible) return

    const searchInput = event.target.closest('.sitemap-search-input')
    if (searchInput) {
      if (event.key === 'Escape') {
        state.search = ''
        searchInput.value = ''
        window.InteractiveSitemap.render.rerender()
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

    if (event.key === 'Escape' && event.target.closest('#reviewWorkspaceSitemap')) {
      state.showLinksFromSelected = false
      state.filter = 'All'
      window.InteractiveSitemap.render.rerender()
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
    window.InteractiveSitemap.render.rerender()
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
    // Forward skipHistory so wrapped popstate renders don't push history
    // entries (which would clear the browser's forward stack).
    window.renderPage = function renderPageWithSitemapRefresh(key, skipHistory) {
      const result = originalRenderPage.call(this, key, skipHistory)
      // Under View Transitions, renderPage returns a promise that resolves
      // once #pageSelect reflects the new page; rerendering earlier would
      // highlight the previous page as current.
      if (result && typeof result.then === 'function')
        result.then(() => {
          if (sitemapMounted) window.InteractiveSitemap.render.rerender()
        })
      else if (sitemapMounted) window.InteractiveSitemap.render.rerender()
      return result
    }
    window.renderPage.__sitemapWrapped = true
  }

  function ensureSitemapRendered() {
    if (sitemapMounted) {
      window.InteractiveSitemap.render.rerender()
      return
    }
    sitemapMounted = true
    window.InteractiveSitemap.render.rerender()
  }

  function init() {
    document.addEventListener('click', handleClick)
    document.addEventListener('keydown', handleKeydown)
    document.addEventListener('input', handleSearchInput)
    document.addEventListener('hhvc:review-data-changed', () => {
      if (sitemapMounted) window.InteractiveSitemap.render.rerender()
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
