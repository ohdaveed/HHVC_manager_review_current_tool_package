# SF.gov visual fidelity: de-boxing pass, parent link, eyebrow color, footer icons

## Context

The user supplied 7 screenshots of live `www.sf.gov` pages (plus one Karl
training page showing image placement), captured 2026-08-08, spanning the
Agency/Topic, Transaction, Information, and Campaign content-type shapes
this tool mocks:

- `healthy-housing-conditions` (Topic/Agency hub)
- `report-mold-in-my-home`, `report-a-health-nuisance-or-hazards` (Transaction)
- `about-population-health`, `syphilis-facts`,
  `prepare-for-your-dph-directors-hearing` (Information/Agency-adjacent)
- `rent-board-portal-user-guide-campaign` (Campaign, accordion-heavy)
- `web-training-dev.sf.gov/image-with-text-examples` (Karl training page,
  image placement reference)

These are the same 7-page corpus referenced in commit `9f91bba` ("sf.gov
design fidelity"), which already fixed font self-hosting, `.callout`
treatment, button corner radius, hero pill removal, and section spacing.
This spec covers the layer of gaps that pass did not reach, found by
screenshotting our own mockup (Agency/`pestsTopic`, Transaction/
`insectsReport`, Information/`tenantRights`, Campaign/`ipmEducation`) via
Playwright and comparing element-by-element against the references.

**Confirmed NOT a gap, don't touch:** heading typography (Roboto Slab
renders as a proper slab-serif, matches the references) and the dashed
border around the page title (that's the tool's own Karl-annotation /
editable-field indicator — deliberate, has no real-SF.gov equivalent to
match).

## Finding

Real SF.gov never renders a bordered/background box around list or link
content. Every reference screenshot — including the closest thing to a
"card grid," population-health's "Our Divisions," which is a 3-column grid
with **no border** — uses plain typographic hierarchy: bold link/heading +
description, separated by a thin rule or grid spacing alone. Our mockup
boxes this content in four places via two CSS components: `.card`/`.cards`
(`css/styles.css:692`) and `.service-tile`/`.service-tiles`
(`css/styles.css:980`), plus `.step` (`css/styles.css:600`) and
`.contact-section`. Two existing renderers are already correct as
reference — `renderResourcesList()` (`.resources-list`, a plain `<ul>`) and
`renderRelatedRail()` (`.related-rail`, also a plain `<ul>`) — and are the
pattern the boxed ones should converge on.

## Scope

### A — De-box four components

1. **Services** (`js/page-render.js` `renderServiceTiles()`, called from
   `renderSectionInner()` when `section.component === 'services'`).
   Currently renders `.service-tile` (2px solid blue border, white
   background, 3-col grid). Change to a plain divided list, matching
   `renderResourcesList()`'s markup shape (`<div><h3>...</h3><ul><li>...`).
   Reuse `.resources-list`'s CSS rather than inventing a parallel plain-list
   style — two components that render identically should share one style,
   or drift is inevitable the next time either changes.

2. **Related sections** (`renderRelatedList()`, `js/page-render.js:387`,
   which calls `renderCards()`) and **Resource Collection's Resource
   section** (the `renderSectionInner()` fallback branch,
   `js/page-render.js:577`, `else if (section.cards) inner +=
renderCards(...)`) — both currently render `.card`/`.cards` (1px border,
   radius, white background). Both should render through the same
   plain-list pattern as Services above. `renderCards()` itself stays
   (still used inline for `s.cards` on a step, `js/page-render.js:437`,
   which is a different, smaller case — see decision below), but its two
   call sites that represent a whole section of links (Related,
   Resource-Collection fallback) switch to the plain-list renderer.

   Decision: introduce one shared plain-list renderer (the existing
   `renderResourcesList()`, generalized with a heading-level parameter if
   the `<h3>` doesn't fit every call site — check at implementation time)
   rather than three near-duplicate plain-list functions. `renderCards()`
   remains for the one case it's still correct for.

3. **Numbered "what to do" steps** (`renderSteps()`, `.step-list`/`.step`,
   `css/styles.css:592`). Currently a bordered box with a circular blue
   number badge (`.step::before`). Change to a plain numbered flow: no
   border, no background, no circular badge — the reference pages
   (`report-mold-in-my-home`, `report-a-health-nuisance-or-hazards`) render
   "1. Check if your issue is..." as a plain H3, number inline with the
   heading text. `.step-list`'s CSS Grid gap (currently 2.5rem) should be
   kept or reassessed for the plain-flow spacing, not necessarily copied
   verbatim.

4. **Contact us** (`renderContactSection()`, `.contact-section`, gray
   background box). Drop the box entirely — heading, then labeled fields
   (Phone/Email/Other), no background/border. Matches both Transaction
   references, where "Contact us" is plain.

### B — Related rail → single column

`page-layout--transaction`'s two-column grid (`js/page-render.js:684`,
`<div class="page-layout page-layout--transaction"><div
class="page-layout-main">`, closed at `js/page-render.js:698` with
`renderRelatedRail()` as the second grid child) currently puts Related
links in a right-side `<aside>`. Every reference page is single-column,
full-width, with no equivalent sidebar. Change: drop the two-column grid;
render the Related content as a plain section at the bottom of the page
flow instead of a sidebar `<aside>`. This likely means retiring
`renderRelatedRail()` in favor of routing Related content through the same
plain-list section pattern as A.2, placed after the main content rather
than beside it. `css/styles.css`'s `page-layout--transaction` grid rules
(including the `@media (max-width: 900px)` single-column fallback, which
becomes the only-column rule) need updating accordingly.

### C — Breadcrumb → parent-program link

Every reference page shows one link back to its owning
program/department (e.g. "Environmental Health", "Department of Public
Health", "San Francisco City Clinic") — never a breadcrumb trail. Our
mockup's breadcrumb (`js/page-render.js:804`, static markup: `‹ Back /
Home / Services / [page title]`) is hardcoded chrome, not driven by page
data.

Decision: do NOT add a new per-page schema field for this (would require
authoring a value across 22 page files for a single link that's the same
on 21 of them). Instead, derive it: every page except the Agency page
(`pestsTopic`) renders one link reading "Healthy Housing and Vector
Control" that targets `pestsTopic`, since that is genuinely each page's
parent in this site's information architecture. The Agency page itself
renders no parent link (it has none — it IS the top, matching how none of
the reference pages that resemble the Agency/Topic shape show a parent
link either). No schema change, no `pages/*.js` edits.

### D — Eyebrow label

Real "TOPIC" eyebrow color, canvas-sampled directly from the
`healthy-housing-conditions` reference screenshot (darkest/most-saturated
pixel in the label's bounding box): `#A84B00`. Currently every page type
renders its `page.type` string in a muted gray eyebrow
(`js/page-render.js:655`, `<div class="eyebrow">${escapeHtml(page.type)}
</div>`), unconditionally.

Change:
- Add a contrast-checked theme token (e.g. `--eyebrow-agency`) in
  `css/theme.css` for `#A84B00`, verified against both the light and dark
  panel surfaces the way every other color token in this file is (see
  `css/theme.css`'s existing ΔE/contrast-math comments for the expected
  rigor) — dark mode will need its own tuned value, not a raw reuse of the
  light-mode hex, per this repo's established pattern.
- Render the eyebrow only when `page.type` normalizes to Agency/Topic;
  omit it entirely for Transaction/Information/Campaign/Report/Resource
  Collection, matching the reference pages of those shapes, none of which
  show an eyebrow at all.

### E — What to know

`renderWhatToKnow()` (`js/page-render.js:492`) currently wraps
`thingsToKnow[]`/`items[]` in an extra `<div class="what-to-know-things">
<strong>Things to know</strong>...`. Real boxes go straight from the box
title ("What to know") to specific bold sub-labels ("Cost", "Who fixes
it"). Drop the generic "Things to know" wrapper heading; render the items
directly under the box.

### F — Footer social icons

Add the five icons every reference footer shows (Facebook, Instagram,
Threads, X, Bluesky) as self-hosted inline SVGs in the footer markup
(`js/page-render.js:807` region) — no CDN icon font or external image,
consistent with this tool's offline-first requirement. Link `href`s can be
inert (`#` or omitted target) since this is a mockup, not a live site.

## Out of scope

- Typography (already correct).
- The dashed editable-field border (tool chrome, not a fidelity gap).
- Any change to the card-inheritance title/description resolution logic
  (`js/card-inheritance.js`) — this spec only changes how resolved
  cards/tiles/steps are *rendered*, never what text they resolve to.
- New schema fields (explicitly rejected for the parent-program link, C).

## Testing

This changes shared render/CSS used by all 22 pages:

- `tests/page-render.test.js` needs assertion updates everywhere it
  currently asserts `.card`, `.service-tile`, `.step`, `.contact-section`,
  or the breadcrumb/eyebrow markup shape.
- `tests/card-inheritance.test.js` and `tests/review-insights-*.test.js`
  should be unaffected (they don't assert on this markup) but must still
  pass — run the full suite, not just the touched files.
- `bun run validate` should be unaffected (no schema/page-data changes).
- `bun run test:e2e` full run required: `accessibility.spec.js` (color
  contrast on the new eyebrow token, both themes),
  `navigation.spec.js`/`workspace-panels.spec.js` (the layout-breakpoint
  sweep in `workspace-panels.spec.js` samples 1280→1920px — the
  `page-layout--transaction` grid removal in B changes what's at those
  widths and must be re-verified, not just re-run blind), and any spec
  that clicks/asserts through `.card`/`.service-tile`/breadcrumb selectors.
- Manual verification: screenshot the same four representative pages
  (Agency/`pestsTopic`, Transaction/`insectsReport`,
  Information/`tenantRights`, Campaign/`ipmEducation`) used for this
  audit, side by side with the reference screenshots, both light and dark
  mode.
