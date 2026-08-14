# Where the SFDS sources disagree

Four conflicts were found between the theme `design-system.sf.gov` inlines and
the published `@sfgov/design-system@0.0.1` package. All four resolve toward the
docs-site theme, which is newer and agrees with the typeface sf.gov actually
serves. They are recorded rather than silently resolved, because an unrecorded
discrepancy is how the wrong action colour survived in this repo for as long as
it did.

| Property | Docs-site theme (canon) | Package `sfds.css@0.0.1` |
| --- | --- | --- |
| Body typeface | Roboto Flex | Rubik |
| Title weight | 700 | 600 |
| `bigDesc` at desktop | bold | 400 |
| Responsive breakpoints | xs 375, sm 640, md 768, lg 1024, xl 1280 | md 420, lg 768, xl 1090 |

**The package's breakpoint names are shifted relative to the theme's.** The
package declares only three breakpoints — its `lg` (768px) aligns with the
theme's `md`, making this a renaming as much as a value disagreement. Comparing
the two by name alone would report agreement where none exists.

**It resolves toward the theme like the other three, and the compiled `sfds.css`
corroborates the theme rather than its own package's token source.** The
compiled stylesheet emits its responsive type steps at `@media (min-width:
768px)`, which matches the theme's `md` breakpoint, not the package's own
`breakpoints.js`. This evidence suggests the package's token source is stale,
and the canonical values are the theme's — the numbers this repo already uses.

A fifth disagreement is with the world rather than within SFDS: live sf.gov
matches neither source on link colour, background, body text colour, or heading
scale. See `README.md`.
