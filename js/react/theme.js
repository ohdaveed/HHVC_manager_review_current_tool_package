/* MUI theme for the review workspace, built FROM `css/theme.css` at runtime.

   Role: the single bridge between this repo's semantic design tokens and
   MUI's theme object. Everything React renders inside `#reviewWorkspace`
   takes its colours, radii and type steps from here, so the standing rule
   still holds — retheming the tool means editing `css/theme.css` only.

   Load-order dependency: none of its own. It reads the tokens off
   `document.documentElement` when `createWorkspaceTheme()` is CALLED, not at
   import time, so it does not care where in `js/main.js` the island lands as
   long as the stylesheets have been applied by the time a panel mounts.

   **Why literal values rather than `var(--surface-panel)` strings.** Passing a
   `var()` string into `palette` works for a plain `background` or `color` and
   then breaks the moment MUI does colour MATH with it: `alpha()`, `lighten()`,
   `darken()` and the automatic `contrastText` computation all run the value
   through `decomposeColor()`, which cannot parse `var(--x)`. That failure
   surfaces at hover time, in one component, long after the theme looks
   correct — so the tokens are resolved to real hex values here instead, which
   costs one `getComputedStyle()` call per theme build.

   **Dark mode comes from the media query, never from a toggle.**
   `css/theme.css` has exactly one `@media (prefers-color-scheme: dark)` block
   and no `data-theme` selector, so the surrounding non-React chrome switches
   with the OS and nothing else. A MUI `mode` the island owned independently
   would let the workspace go light while the panel around it went dark.
   `subscribeToColorScheme()` exists so a mounted island can rebuild its theme
   when that query flips. */

import { createTheme } from '@mui/material/styles'

/* Fallbacks are the light-mode values from css/theme.css. They are only
   reached when the tokens resolve empty — a happy-dom test, or a call made
   before the stylesheets applied — and exist so a theme build can never
   produce `undefined`, which MUI turns into a crash rather than a default. */
const TOKEN_FALLBACKS = {
  '--surface-page': '#f0f0f0',
  '--surface-panel': '#fcfcfc',
  '--surface-sunken': '#f8fafc',
  '--surface-soft': '#f0f0f0',
  '--text-primary': '#0b0c0c',
  '--text-secondary': '#6e7070',
  '--border-default': '#e9eaea',
  '--border-strong': '#c9caca',
  '--brand-40': '#2a60af',
  '--brand-10': '#001d4e',
  '--status-approved-fg': '#075e0a',
  '--status-blocked-fg': '#8f1d15',
  '--status-edits-fg': '#6f4a00',
  '--radius': '6px',
}

/**
 * Read one design token off the document root, resolved to whatever the
 * cascade currently computes — which is the dark value when the dark media
 * query is active, since that block redefines the same custom properties.
 *
 * @param {CSSStyleDeclaration|null} styles Computed style of the root element.
 * @param {string} name Custom property name, including the leading dashes.
 * @returns {string} The resolved value, or this repo's light-mode fallback.
 */
function token(styles, name) {
  const value = styles?.getPropertyValue(name)?.trim()
  return value || TOKEN_FALLBACKS[name] || ''
}

/**
 * Whether the viewer is currently in dark mode.
 *
 * @returns {boolean}
 */
function prefersDark() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/**
 * Build a MUI theme from the current values of this repo's semantic tokens.
 *
 * Call it again after the colour scheme changes rather than mutating the
 * returned object — MUI derives a lot from `palette` at creation time.
 *
 * @returns {import('@mui/material/styles').Theme}
 */
function createWorkspaceTheme() {
  const root = typeof document === 'undefined' ? null : document.documentElement
  const styles = root && typeof getComputedStyle === 'function' ? getComputedStyle(root) : null
  const dark = prefersDark()

  return createTheme({
    palette: {
      mode: dark ? 'dark' : 'light',
      primary: { main: token(styles, '--brand-40'), dark: token(styles, '--brand-10') },
      background: {
        default: token(styles, '--surface-page'),
        paper: token(styles, '--surface-panel'),
      },
      text: {
        primary: token(styles, '--text-primary'),
        secondary: token(styles, '--text-secondary'),
      },
      divider: token(styles, '--border-default'),
      success: { main: token(styles, '--status-approved-fg') },
      warning: { main: token(styles, '--status-edits-fg') },
      error: { main: token(styles, '--status-blocked-fg') },
    },
    shape: {
      // parseInt because MUI's shape.borderRadius is a number it multiplies;
      // the token is a CSS length.
      borderRadius: parseInt(token(styles, '--radius'), 10) || 6,
    },
    typography: {
      // Inherit the page's own stack rather than pulling in MUI's Roboto
      // default, which this tool does not load and which would make the
      // workspace read as a different product from the sidebar beside it.
      fontFamily: 'inherit',
      // The four steps in css/theme.css. Named --ds-text-*, not --*-size-*.
      h3: { fontSize: 'var(--ds-text-panel)', fontWeight: 800 },
      h4: { fontSize: 'var(--ds-text-card)', fontWeight: 800 },
      body2: { fontSize: 'var(--ds-text-label)' },
    },
    components: {
      // MUI's own baseline is deliberately absent: `CssBaseline` writes
      // element-level rules on html/body/*, and Emotion injects after the nine
      // stylesheets, so it would win ties INSIDE `.browser-shell` — the one
      // surface that has to keep rendering as SF.gov does. Measured before any
      // of this landed: a ThemeProvider plus a Button changes zero computed
      // properties on the mockup. Adding CssBaseline is what would break that,
      // so use ScopedCssBaseline inside a panel if a reset is ever needed.
      MuiPaper: { defaultProps: { elevation: 0 } },
      MuiButtonBase: { defaultProps: { disableRipple: true } },
    },
  })
}

/**
 * Call `onChange` whenever the OS colour scheme flips, so a mounted island can
 * rebuild its theme from the tokens' new values.
 *
 * @param {() => void} onChange
 * @returns {() => void} Unsubscribe.
 */
function subscribeToColorScheme(onChange) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const query = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = () => onChange()
  query.addEventListener('change', handler)
  return () => query.removeEventListener('change', handler)
}

export { createWorkspaceTheme, subscribeToColorScheme, prefersDark }
