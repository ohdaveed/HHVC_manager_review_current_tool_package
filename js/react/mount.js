/* Mount helper for the React islands inside `#reviewWorkspace`.

   Role: the one place a React root is created, kept and re-rendered, so the
   rest of the tool keeps its existing "call a render function with the data"
   shape and never has to know that a panel is React underneath.

   Load-order dependency: none. It is imported by whichever panel module needs
   it, and it touches the DOM only when `renderIsland()` is called.

   **One root per host element, kept for the life of the page.** `createRoot()`
   on an element that already has a root warns and leaks the old tree, and the
   panels here re-render on every navigation, filter and keystroke — so the
   root is cached against the host in a `WeakMap` and only the element passed
   to `render()` changes. The map is weak so a host removed from the DOM takes
   its root with it.

   **The theme is rebuilt on a colour-scheme flip, not memoised forever.** It
   is derived from `css/theme.css`'s tokens as they compute right now (see
   js/react/theme.js), and those change wholesale when the dark media query
   turns on. A single cached theme would leave the island light inside a dark
   panel. */

import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@mui/material/styles'
import { createWorkspaceTheme, subscribeToColorScheme } from './theme.js'

/** @type {WeakMap<Element, import('react-dom/client').Root>} */
const roots = new WeakMap()

/** @type {WeakMap<Element, () => void>} */
const lastRenders = new WeakMap()

/** @type {import('@mui/material/styles').Theme|null} */
let theme = null

/** @type {boolean} */
let watchingScheme = false

/**
 * Get the current theme, building it on first use.
 *
 * @returns {import('@mui/material/styles').Theme}
 */
function currentTheme() {
  if (!theme) theme = createWorkspaceTheme()
  return theme
}

/**
 * Start watching the colour scheme once, and re-run every island's last
 * render against a freshly built theme when it flips.
 *
 * Re-running the LAST render rather than asking callers to re-render is
 * deliberate: a scheme change is not a data change, and the panels' data
 * lives in the plain-JS layer that called us. Replaying what each island was
 * already showing keeps the two in step with no extra contract.
 *
 * @param {Element} host
 */
function watchScheme(host) {
  if (!watchingScheme) {
    watchingScheme = true
    subscribeToColorScheme(() => {
      theme = createWorkspaceTheme()
      for (const replay of schemeReplays) replay()
    })
  }
  const replay = () => lastRenders.get(host)?.()
  schemeReplays.add(replay)
}

/** Replays registered by mounted islands; see watchScheme(). */
const schemeReplays = new Set()

/**
 * Render a React element into a host element, creating the root once.
 *
 * @param {Element|null} host The element to own the React tree.
 * @param {import('react').ReactElement} element What to render inside the theme.
 * @returns {void}
 */
function renderIsland(host, element) {
  if (!host) return
  let root = roots.get(host)
  if (!root) {
    root = createRoot(host)
    roots.set(host, root)
    watchScheme(host)
  }
  const draw = () => root.render(createElement(ThemeProvider, { theme: currentTheme() }, element))
  lastRenders.set(host, draw)
  draw()
}

/**
 * Find or create a child element for an island to own.
 *
 * The panels this replaces wrote `innerHTML` on the panel itself, which would
 * destroy a React root living in the same element. Giving the island its own
 * child means the surrounding string-rendered sections can still be replaced
 * wholesale without touching it.
 *
 * @param {Element|null} panel
 * @param {string} id Element id for the island host.
 * @returns {Element|null}
 */
function ensureIslandHost(panel, id) {
  if (!panel) return null
  const existing = panel.querySelector(`#${id}`)
  if (existing) return existing
  const host = document.createElement('div')
  host.id = id
  panel.appendChild(host)
  return host
}

export { renderIsland, ensureIslandHost }
