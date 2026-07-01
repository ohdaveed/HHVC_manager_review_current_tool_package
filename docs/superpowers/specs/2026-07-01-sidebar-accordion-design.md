# Sidebar accordion — design spec

## Problem

The `.sidebar` review panel in `index.html` stacks seven `control-group` sections in one
uninterrupted scroll: page selector + URL slug, live content editor, SEO metadata editor,
Karl CMS tag toggle, applied-rules checklist, manager review tools, and reading targets.
It's hard to scan and forces scrolling past sections a reviewer isn't using in the moment.

## Goal

Make the sidebar scannable by grouping it into seven collapsible sections, without adding
a build step, framework, or new dependency.

## Approach

Use native `<details>`/`<summary>` elements — one per group. This gives independent,
simultaneously-open sections for free (no JS accordion/state-machine needed) and is
accessible by default: keyboard-toggleable, and screen readers announce expanded/collapsed
state via the built-in disclosure widget semantics.

Rejected alternatives:
- **Custom JS accordion** (`button` + `aria-expanded` + max-height transitions) — reimplements
  what `<details>` does natively; only justified if animated open/close were required, which
  isn't a stated goal here.
- **CSS-only checkbox-hack accordion** — avoids JS but is a less semantic, less accessible
  pattern than `<details>`.

## Grouping

Seven `<details>` panels, in this order, replacing the current seven `control-group` divs
(the "Choose a page mockup" and "Preview URL slug" groups merge into one panel):

1. **Page mockup** *(open by default)* — page `<select>` + preview URL slug input
2. **Live content editor** *(collapsed)* — title / summary / CTA fields
3. **Search metadata** *(collapsed)* — SEO title / meta description + search preview
4. **Karl CMS tags** *(collapsed)* — placement tag toggle + help text
5. **Applied rules** *(collapsed)* — compliance checklist
6. **Manager review** *(open by default)* — reviewer name/date/decision/notes/risks/owner + export buttons
7. **Reading targets** *(collapsed)* — static reference table

Default-open state is set via the `open` attribute in the HTML at load time. No persistence
across reloads (localStorage, etc.) — the sidebar is never torn down or re-rendered when
switching pages in the mockup canvas, so in-session open/closed state naturally persists as
the user works, and that's sufficient.

## Visual treatment

- Each `<details>` reuses the existing `.control-group` spacing (top border + padding) as
  its container.
- `<summary>` becomes the section header: same weight/size as the current `.eyebrow` label,
  with a chevron indicator (rotates on open, via a `::marker` or `::after` triangle — default
  browser disclosure triangle is suppressed via `list-style: none` / `-webkit-details-marker:
  none` and replaced with a custom one for consistent cross-browser look).
- `summary` gets hover and focus-visible states using the corrected Karl tokens
  (`--sfds-action-blue` / `--sfds-slate-*`), consistent with the rest of the tool's interactive
  elements (buttons, links).
- No change to the content markup *inside* each section — only the wrapping element changes
  from `<div class="control-group">` to `<details class="control-group">` with a `<summary>`
  wrapping the existing `<div class="eyebrow">` label (or a new summary label where the group
  currently has no eyebrow, e.g. "Choose a page mockup" / "Preview URL slug" merge needs one
  shared label: "Page mockup").

## Scope / non-goals

- No changes to `js/app.js` logic — this is a structural/markup + CSS change to `index.html`
  and `css/styles.css` only.
- No changes to the manager-review export functionality, Karl tag rendering, or any mockup
  page content.
- `manager-review-single-file.html` and `single-file-export-current-source.html` are
  regenerated from `index.html` via `build_scripts/build-single-file.js` after the change —
  not hand-edited.

## Testing / verification

- Visual check in browser: each section collapses/expands independently; "Page mockup" and
  "Manager review" are open on load, the rest start collapsed.
- Keyboard check: `Tab` reaches each `<summary>`, `Enter`/`Space` toggles it.
- Re-run `node build_scripts/build-single-file.js` and `node build_scripts/validate.js` after
  the change; both single-file exports must reflect the new markup.
