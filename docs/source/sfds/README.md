# SF Design System — vendored token capture

`tokens.json` is the SFDS token set this repo builds `css/sfds.css` from.
`tests/sfds-tokens.test.js` pins the CSS against it in both directions, so a
value edited in one place and not the other fails CI rather than drifting.

## Two captures, on 2026-08-14

**The token values** come from the Stitches theme that `design-system.sf.gov`
inlines into its own pages, cross-checked against
`design-system.sf.gov/libraries/color/interface/`, which lists an identical
palette. Structural values the theme does not carry — the 768px desktop
breakpoint and the per-step letter-spacing — come from
`node_modules/@sfgov/design-system/dist/css/sfds.css@0.0.1`.

**A live measurement** of `sf.gov/information--keeping-your-building-free-vermin`
in headless Chromium at 1440x900, reading computed styles rather than scraping.
It is recorded here because it disagrees with SFDS and that disagreement is a
fact about the world, not an error to reconcile: sf.gov paints links `#1b519e`,
body text `#0b0c0c` on `#fcfcfc`, and headings at Slab 46/56 w600 and 40/52
w500. SFDS describes a system sf.gov has not adopted.

## Why this file exists at all

The primitives this capture replaces were hand-authored under an `--sfds-*`
prefix that implied a provenance they did not have, and the wrong action colour
(`#2a60af`) survived because a heuristic scrape asserted it and nothing tested
it. Vendoring the capture and testing against it is the specific fix.

## Recorded disagreements

See `disagreements.md`.
