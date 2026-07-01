# Adopt @sfgov/design-system CSS for visual fidelity

## Goal

The mockup tool hand-rolls SF.gov-style CSS (`css/styles.css`) with manually
copied color tokens (`--sfds-action-blue: #495ED4`, etc.). Adopt the real
`@sfgov/design-system` npm package as the source of truth for base tokens,
typography, and component CSS, so mockups stay accurate to the live SF.gov
design system without hand-maintained guesses. This is a styling-only change:
the string-template rendering in `js/app.js` and the existing markup/classes
are untouched.

Out of scope: SFDS web components (`dist/elements`), the React bundle
(`dist/react`), and `utilities.css` (401KB of Tailwind-style utility classes
not used by current markup).

## Dependency setup

- Add a minimal `package.json` at the repo root: `"private": true`, single
  `devDependencies` entry `"@sfgov/design-system": "0.0.1"` (the only
  published stable version; `latest` dist-tag as of this writing).
- Add `node_modules/` to `.gitignore`.
- Commit `package-lock.json` for reproducible installs.
- No bundler and no change to the existing static-file serving workflow —
  `npm install` populates `node_modules`, which `python3 -m http.server`
  serves the same as any other repo file.

## CSS files pulled in

From `node_modules/@sfgov/design-system/dist/css/`:

- `base.css` — resets (box-sizing, link color, focus ring, placeholder color)
- `typography.css` — font family/size scale, Rubik as primary font
- `components.css` — `.btn`, `.btn-secondary`, `.btn-link`, `.btn-inverse`,
  `.btn-block`, `.details-reset`, `.responsive-grid`, `.responsive-container`,
  `kbd`

Explicitly **not** pulled in:

- `fonts.css` — `index.html` already loads Rubik via a direct Google Fonts
  `<link>` with weights 400–800, a superset of `fonts.css`'s
  300/400/600. Pulling it in would duplicate/conflict with an existing link.
- `utilities.css` — 401KB, unused by current markup.

## Cascade order (the key mechanical detail)

`components.css` defines `.btn` with the same selector specificity as the
existing hand-rolled `.btn` in `css/styles.css:70`. CSS resolves equal-
specificity conflicts by declaration order — last wins. To make the real
SFDS button style win (per decision below), the three new `<link>` tags are
added in `index.html` **after** the existing `css/styles.css` link, in this
order:

```html
<link rel="stylesheet" href="css/styles.css" />
<link rel="stylesheet" href="node_modules/@sfgov/design-system/dist/css/base.css" />
<link rel="stylesheet" href="node_modules/@sfgov/design-system/dist/css/typography.css" />
<link rel="stylesheet" href="node_modules/@sfgov/design-system/dist/css/components.css" />
```

Verified no other collisions: `.btn-secondary`/`.btn-link`/`.btn-inverse`/
`.btn-block`/`.details-reset`/`.responsive-grid`/`.responsive-container`/`kbd`
are all net-new class names not present in `css/styles.css`.
`typography.css`'s `*{font-family:...}` rule has lower specificity than the
existing `body{font-family:...}` rule in `css/styles.css:20`, so it does not
override the current font stack for `body`-scoped text.

### Decision: let components.css win

Considered keeping the existing hand-rolled `.btn` untouched (pure "layer as
base, tokens only" — would mean dropping `components.css`). Decided instead
to let the real SFDS `.btn` styling win, since the goal is visual fidelity to
the live design system and `components.css` is small (~2KB) with only one
actual collision.

## Build script generalization

`build_scripts/build-single-file.js` currently inlines exactly one
hardcoded stylesheet (`css/styles.css`) via a single regex, while scripts are
already inlined generically (loop over every `<script src="...">`). Generalize
the stylesheet handling to match: loop over every local
`<link rel="stylesheet" href="...">` in `index.html` (skip absolute
`http(s)://` hrefs, so the Google Fonts `<link>` stays untouched as a real
external link) and inline each one as a `<style>` block, in document order.

This means the 3 new SFDS `<link>` tags get inlined into
`manager-review-single-file.html` and `single-file-export-current-source.html`
automatically, with no SFDS-specific code in the build script.

## Verification

1. `npm install`
2. `node build_scripts/build-single-file.js` — regenerate both single-file
   exports
3. Serve `index.html` locally (`python3 -m http.server`), visually confirm:
   - Primary CTA buttons render with the real SFDS button style
   - No layout, font, or color regressions elsewhere on the page
   - Single-file exports render identically to `index.html`
4. Check browser console for errors (missing stylesheet 404s, etc.)

## Docs

Update `README.md`: add `npm install` as a one-time setup step before
"Open `index.html` in a browser", and add `package.json` to the documented
file structure.
