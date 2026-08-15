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
   produce `undefined`, which MUI turns into a crash rather than a default.

   Every colour here was the PRE-SFDS value until Task 11, and the whole
   table was wrong at once rather than drifting one entry at a time: Task 6
   repointed the semantic layer onto `--sfds-color-*` and Task 11 re-derived
   the brand ramp, and neither pass came back for this file. That is the
   failure mode a fallback invites — it renders only when the stylesheets
   are absent, so nothing on screen ever contradicts it, and
   tests/react-theme.test.js asserts each token HAS a fallback rather than
   what it says. Re-check these against css/theme.css's `:root` whenever a
   light-mode value moves; a stale one is not visible, it is just wrong. */
const TOKEN_FALLBACKS = {
  '--surface-page': '#f6f6f6',
  '--surface-panel': '#ffffff',
  '--surface-sunken': '#eff3f4',
  '--surface-soft': '#f6f6f6',
  '--text-primary': '#212123',
  '--text-secondary': '#1d4d70',
  '--border-default': '#e2e2e2',
  '--border-strong': '#c2c2c2',
  '--brand-40': '#495ed4',
  '--brand-10': '#0c1464',
  '--status-approved-fg': '#1b674d',
  '--status-blocked-fg': '#9b3921',
  '--status-edits-fg': '#424244',
  // Was '6px' until this task, which is wrong rather than merely stale: the
  // token this stands in for has been 8px since it was written, so any
  // render that ever fell through to the fallback — a happy-dom test, or a
  // theme built before the stylesheets applied — silently rendered a 2px
  // smaller radius than the real page. Do not "restore" 6px; it was never
  // the token's value.
  '--ext-radius-8': '8px',
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
      borderRadius: parseInt(token(styles, '--ext-radius-8'), 10) || 8,
    },
    /* MUI multiplies this factor by the number passed to `theme.spacing(n)`,
       so a factor of 4 makes spacing(1) 4px, spacing(2) 8px, spacing(3) 12px
       — SFDS's own ladder through its dense end, and the same values the
       string-template panels beside the island get from --ds-space-*. The
       default factor is 8, which is why a ported panel and its neighbour
       disagreed, and why the disagreement grew with every port.

       It agrees exactly through spacing(5) = 20px = --ds-space-5 and then
       stops: MUI's factor is linear and SFDS's ladder is not, so spacing(6)
       is 24px where --ds-space-6 is 28px, and the gap widens from there. A
       panel needing a step above the fifth should read `var(--ds-space-N)`
       directly rather than reach for spacing(6) and land a step short. */
    spacing: 4,
    typography: {
      // Inherit the page's own stack rather than pulling in MUI's Roboto
      // default, which this tool does not load and which would make the
      // workspace read as a different product from the sidebar beside it.
      fontFamily: 'inherit',
      // The four steps in css/theme.css, all four now — h3/h4/body2 alone
      // left body1, button and caption rendering at MUI's own sizes, which
      // are a real scale rather than an absent one, so the mismatch showed
      // up only beside a string-template panel. Named --ds-text-*, not
      // --*-size-*.
      h3: { fontSize: 'var(--ds-text-panel)', fontWeight: 800 },
      h4: { fontSize: 'var(--ds-text-card)', fontWeight: 800 },
      h5: { fontSize: 'var(--ds-text-card)', fontWeight: 700 },
      body1: { fontSize: 'var(--ds-text-card)' },
      body2: { fontSize: 'var(--ds-text-label)' },
      // MUI uppercases button labels by default and nothing else in this
      // chrome does, so this is a correction rather than a preference.
      button: { fontSize: 'var(--ds-text-label)', textTransform: 'none' },
      // caption is the eyebrow step, and --ds-text-micro is 11px — below the
      // 14px floor tests/e2e/chrome-tokens.spec.js enforces on chrome, whose
      // one exemption is uppercase text. A sentence-case caption at this size
      // would both fail that spec and lose the letter-spacing-and-weight
      // legibility argument the exemption rests on.
      caption: { fontSize: 'var(--ds-text-micro)', textTransform: 'uppercase' },
    },
    components: {
      // MUI's own baseline is deliberately absent: `CssBaseline` writes
      // element-level rules on html/body/*, and Emotion injects after the ten
      // stylesheets, so it would win ties INSIDE `.browser-shell` — the one
      // surface that has to keep rendering as SF.gov does. Measured before any
      // of this landed: a ThemeProvider plus a Button changes zero computed
      // properties on the mockup. Adding CssBaseline is what would break that,
      // so use ScopedCssBaseline inside a panel if a reset is ever needed.
      MuiPaper: { defaultProps: { elevation: 0 } },
      MuiButtonBase: { defaultProps: { disableRipple: true } },
      /* Chip carries its own font size — 13px on the root, 12px on the small
         variant — and neither is a step this chrome publishes. Mapping only
         the typography variants left it there: the Checks panel's Pass/Check
         badges rendered at 13px, below the 14px floor
         tests/e2e/chrome-tokens.spec.js enforces, and the floor test could
         not see them because islands mount on demand and nothing in that
         spec opened the tab (widened here, in the same commit).

         The eyebrow step rather than --ds-text-label is the deliberate
         reading: a status badge beside a 14px rule label is exactly the
         "small uppercase marker" --ext-text-2xs was scoped to, and at 14px
         the badge would compete with the rule it annotates. The weight and
         letter-spacing come with it, matching `.review-queue-kpi-label` in
         css/dashboard.css — that pairing is what the floor test's uppercase
         exemption rests on, so taking the size without them would satisfy
         the assertion and lose the legibility argument behind it. */
      MuiChip: {
        styleOverrides: {
          root: {
            fontSize: 'var(--ds-text-micro)',
            fontWeight: 800,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          },
          // `sizeSmall` sets its own fontSize, and it is the size the Checks
          // panel actually renders, so overriding `root` alone would leave
          // every real chip in the tool untouched.
          sizeSmall: { fontSize: 'var(--ds-text-micro)' },
        },
      },
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
