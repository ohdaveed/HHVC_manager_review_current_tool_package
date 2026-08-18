---
name: hhvc-react-islands
description: 'HHVC repo: the React 19 + MUI islands scoped to `#reviewWorkspace` — why the mockup boundary is the point, the measured proof that isolation holds and why there is no `CssBaseline`, why `js/react/theme.js` resolves tokens to literal values, why dark mode follows `prefers-color-scheme` only, and why each island needs its own child div. Load before editing anything under js/react/ or adding a React island.'
---

<!-- Extracted from CLAUDE.md/AGENTS.md on 2026-08-15. AGENTS.md remains the
     canonical copy of this content; see "Cross-tool canon" there. -->

# React islands in the workspace

The review workspace renders through **React 19 + MUI**, mounted as islands
inside `#reviewWorkspace`. Everything else — the sidebar, the toolbar, and above
all `#mockPage` — is untouched plain JS and string templates.

- **The boundary is the point.** The mockup is a preview of a real SF.gov page,
  so Material styling on that surface would misrepresent the thing under review
  — the same argument that docks the workspace at 1700px rather than squeezing
  the mockup. Tool chrome is fair game; `.browser-shell` is not.
- **That isolation is measured, not assumed.** A `ThemeProvider` plus one MUI
  `Button` mounted into the Checks panel changed **zero** computed properties
  across `body`, `.browser-shell`, the mockup's `h1`/`h2`/`p`/`a`/`ul`/`li`,
  `.karl-tag` and `.karl-tag-kind`, while Emotion added 15 stylesheets. It holds
  because MUI emits scoped `.css-*` classes and there is **no `CssBaseline`** —
  that writes element-level rules on `html`/`body`/`*`, and Emotion injects after
  every one of the repository's own stylesheets, so it would win ties inside the
  shell. Use `ScopedCssBaseline` inside a panel if a reset is ever needed. **The
  number of those sheets is deliberately not restated here** — it lives in
  `AGENTS.md` and `CLAUDE.md`, where `tests/doc-counts.test.js` pins it against
  what is actually in `css/`. This file said "ten" for as long as it existed,
  written before `css/karl-guide.css` landed and checked by nothing, which is
  exactly what an unguarded copy of a pinned count does.
- **`js/react/theme.js` is the only bridge to the design tokens**, read off
  `document.documentElement` at theme-build time so retheming still means
  editing `css/theme.css` only. It resolves them to literal values because a
  `var(--x)` string breaks `alpha()`, `lighten()` and `contrastText`, which all
  run through `decomposeColor()`.
- **Dark mode follows `prefers-color-scheme`, never a MUI toggle** — there is
  one dark media block and no `data-theme` selector, so an independently owned
  `mode` would leave the workspace light inside a dark panel.
- **Islands load on demand**, via a dynamic `import()` from
  `js/ux-improvements-state-sync.js`: React, React DOM, Emotion and MUI land in
  their own chunk (318 kB raw / 103 kB gzip) and the initial chunk did not grow.
  Same reasoning as ECharts.
- **A React root and `innerHTML` cannot share a host**, so each island gets its
  own child `<div>` (`#reviewChecksIsland`) beside the string-rendered section
  (`#reviewChecksAdvice`).
- **Data is passed in, never read from a global on mount** — the caller resolves
  the page as `(pageKey && DATA.pages[pageKey]) || getCurrentPage()`, in that
  order, because `#pageSelect.value` is stale during the initial View
  Transition.
- **Legacy class names stay** (`.compliance-item`, `.compliance-citation`, …):
  they are styled by `css/dashboard.css` and asserted on by
  `tests/e2e/review-workflow.spec.js`.
- **`.jsx` is new here**; such files live under `js/react/` and need
  `@vitejs/plugin-react`. Prettier still formats them, so `format:check` gates.

Ported so far: the Checks tab's scored rule list. The advisory section beside
it, the Overview queue and the Help tab are still string templates.
