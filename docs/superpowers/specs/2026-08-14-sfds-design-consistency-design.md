# One design system across the tool: adopting SFDS

**Status:** design approved 2026-08-14, ready for an implementation plan
**Surfaces:** the 29 mockup pages under `#mockPage`, and the review tool's own
chrome — both

---

## The problem

The tool has two visual surfaces and neither has a design authority it actually
follows.

The mockup surface claims one. `css/styles.css` declares 24 primitives under an
`--sfds-*` prefix, and CLAUDE.md documents the mockup's heading literals as a
deliberate exception because they "mirror what SF.gov actually renders." Both
claims turn out to be false, and they are false in different ways.

The chrome surface has scales — `--ds-space-*`, `--ds-text-*`, `--ds-radius-*`
— and mostly ignores them: 171 spacing literals against 55 token uses, 55
type literals against 24. It also reads `--radius`, a token declared in the
*mockup's* stylesheet, from 17 chrome rules and from the React island's MUI
theme.

The result is a tool whose two halves are internally inconsistent, mutually
inconsistent, and inconsistent with the design system whose name one of them
borrows.

---

## What was measured, and what it showed

Three findings, each from a different method, because no single source settled
the question.

**The `--sfds-*` prefix has no provenance.** `js/main.js` imports three bundles
from `@sfgov/design-system@0.0.1` — `base.css` (274 B), `typography.css`
(1.4 kB), `components.css` (2.3 kB). Between them they declare **zero** CSS
custom properties. Every `--sfds-*` name in this repo is hand-authored. The
package's real token payload is `sfds.css` (405 kB), which is on disk and has
never been imported.

**SFDS publishes tokens that this repo does not use.** Captured from the theme
`design-system.sf.gov` inlines into its own pages, and cross-checked against
`libraries/color/interface/`, which lists the identical palette. The
disagreement with the repo is not a matter of shade:

| Repo token | Repo value | SFDS name | SFDS value |
| --- | --- | --- | --- |
| `--sfds-action-blue` | `#2a60af` | `colors-action` / `blueBright` | `#495ed4` |
| `--sfds-slate-1` | `#0b0c0c` | `slateL4` | `#002b48` |
| `--sfds-slate-2` | `#383939` | `slateL3` | `#1d4d70` |
| `--sfds-slate-3` | `#6e7070` | `slateL2` | `#5a7a92` |
| `--sfds-slate-5` | `#f0f0f0` | `slateL1` | `#eff3f4` |
| `--sfds-white` | `#fcfcfc` | `white` | `#fff` |
| `--sfds-footer-bg` | `#001d4e` | `slateL4` | `#002b48` |

The repo's slates are neutral greys. SFDS's are blue-tinted. The action colour
— every link and primary button on the page under review — differs in hue.

**Live sf.gov agrees with neither.** Playwright, headless Chromium, 1440×900,
`sf.gov/information--keeping-your-building-free-vermin`, computed styles:

| Property | Live sf.gov | Repo | SFDS |
| --- | --- | --- | --- |
| body font / size / line-height | Roboto Flex 16/24 | same | same |
| body text | `#0b0c0c` | `#0b0c0c` | `#212123` |
| background | `#fcfcfc` | `#fcfcfc` | `#ffffff` |
| **link** | **`#1b519e`** | `#2a60af` | `#495ed4` |
| h1 | Slab 46/56 w600 | `clamp(2.2rem,4vw,4rem)` lh 1.15 | `titleXl` 32→60 |
| h2 | Slab 40/52 w500 | `clamp(1.6rem,2.6vw,2.25rem)` | `titleLg` 28→44 |
| h3 | **Flex** 20/28 w700 | 20px, but `--font-display` (Slab) | `titleXs` 20/24 |

**Three authorities, three different link colours.** `#1b519e` is what sf.gov
paints. `docs/sfgov-design-and-vermin-page-capture-2026-08-08.md` recorded that
exact value as Firecrawl's `primary` and set it aside — "most likely
header/footer chrome rather than content-area colours, and nothing in the mockup
needs them today." It is the body link colour. The value that same document
called a byte-identical confirmation, `#2a60af`, is not rendered anywhere that
was checked. That document's confidence block reported `buttons: 0` and
`overall: 0.45`, and misread body copy as 10px — the colour claim inherited
that unreliability and nothing caught it, because nothing tested it.

**SFDS is forward-looking, not descriptive.** It does not describe sf.gov today
— not the link colour, the background, the body text colour, or the heading
scale. sf.gov runs an older Drupal theme. The shipped `sfds.css@0.0.1` is
further behind still: it sets `a{color:#495ed4}` and `*{font-family:Rubik}`,
where the docs-site theme says Roboto Flex, which is what sf.gov actually
serves.

**A note on method.** The `#2a60af` error was produced by a heuristic scrape
that nothing later re-checked. Every colour and size in this spec came from
either a computed style in a real browser or a token declaration read out of the
system's own CSS. Where the two disagree, the disagreement is recorded rather
than averaged.

---

## Decisions

**SFDS is the authority for both surfaces.** Chosen over mockup-mirrors-sf.gov
with the trade-off stated: adopting SFDS means the mockup measurably stops
matching the page it is a redesign of. That is accepted deliberately — the
mockups are a proposal for a Karl-published future, and SFDS is the system that
future is built on.

**Where SFDS is silent, the repo extends it and says so.** SFDS publishes no
dark palette, no type step below 14px, and no radius scale. Those three
extensions stay, under a prefix that cannot be mistaken for a published token.

**The mockup's heading ladder is SFDS's `title` steps** — h1 `titleXl`, h2
`titleLg`, h3 `titleXs`. Chosen over the `display` ladder after seeing all three
rendered side by side at real size: SFDS makes `display` steps weight 300, so
those options turned the page title thin, and the weight change read as a larger
departure than the pixel sizes did. The `title` ladder keeps all headings at
bold 700.

**The docs-site theme is canon; `sfds.css@0.0.1` is the fallback.** They
disagree on typeface (Roboto Flex vs Rubik) and on title weight (700 vs 600).
The docs-site theme is newer and agrees with the font sf.gov actually serves.
Where only the package states something — the 768px desktop breakpoint, the
per-step letter-spacing — the package is the source, since the theme does not
carry it.

**Tokens are vendored and pinned, not generated.** A generator was considered
and rejected: the guarantee lives in the test, and a generated CSS file would be
a fourth artifact in a repo that already warns against hand-editing three.

---

## Architecture

Three layers, one file each, each prefixed with its own authority.

### `css/sfds.css` — new, imported first

SFDS primitives only, keyed to **SFDS's own names**, so any line can be diffed
against the published token list without a translation table:

```css
--sfds-color-blue-bright: #495ed4;
--sfds-color-slate-4: #002b48;
--sfds-space-16: 1rem;
--sfds-text-title-xl: 2rem;
```

That naming is the fix for the specific defect found. `--sfds-action-blue` is a
name SFDS never published, holding a value SFDS never specified; nothing about
the name made that discoverable.

Adding this file also moves the primitives **out of `css/styles.css`**, which is
what makes a shared design system structurally possible at all. Chrome cannot
depend on tokens declared in the mockup's own stylesheet — that is the same
defect as `--radius: 8px` at `styles.css:34`, read today by 17 chrome rules and
by `js/react/theme.js`.

### `css/theme.css` — unchanged role, now purely semantic

Surfaces, type roles, status colours, decision colours. It consumes `--sfds-*`
and `--ext-*` and declares no literal of its own. It still imports **last**, for
the same reason as before: its dark-mode block overrides the primitives, which
now arrive from `css/sfds.css` instead of `css/styles.css`.

### `--ext-*` — the three extensions, and only those

A grep for `--ext-` answers "what did we invent?", which is a question nobody
can answer against the current codebase.

- `--ext-dark-*` — the dark palette, derived from SFDS hues.
- `--ext-text-2xs: 0.6875rem` — one step below SFDS's 14px floor.
- `--ext-radius-{2,4,8,12,pill}` — derived from SFDS's own step ladder, since
  SFDS publishes no radius scale but its site uses `rounded-4` off that ladder.

### Units

Type and space convert px → rem at ÷16: identical rendering at a default root
size, but honours a user who has set a larger one. Breakpoints and border widths
stay px, where rem buys nothing and invites rounding error.

### Provenance and the pinning test

`docs/source/sfds/tokens.json` holds the captured token set;
`docs/source/sfds/README.md` records both captures — the docs-site inlined theme
and the live sf.gov computed-style measurement — dated, with the method, and
with the disagreement between them written down rather than resolved silently.

`tests/sfds-tokens.test.js` asserts two directions:

1. every `--sfds-*` declared in `css/sfds.css` matches `tokens.json`;
2. no `--sfds-*` name exists in the CSS that is absent from `tokens.json`.

The second direction is the one that matters. The first would have passed
happily on a repo where someone invented `--sfds-action-blue`; only the second
catches a token that claims a provenance it does not have.

**Knock-on:** `docs/source/**` is the RAG corpus
(`build_scripts/knowledge-sources.js`), so a new `sfds/` folder files itself as
a new category and changes the measured 76 documents / 768 chunks that
`tests/doc-counts.test.js` and the three mirror files record. Updating those is
part of the change, not a follow-up.

---

## The mockup surface

| | Now | SFDS |
| --- | --- | --- |
| link | `#2a60af` | `#495ed4` (`color-action`) |
| body text | `#0b0c0c` | `#212123` (`color-black`) |
| background | `#fcfcfc` | `#ffffff` (`color-white`) |
| h1 | `clamp(2.2rem,4vw,4rem)`, lh 1.15 | `titleXl` 2rem/2.25rem → 3.75rem/4rem @768px, w700, `-1px` |
| h2 | `clamp(1.6rem,2.6vw,2.25rem)` | `titleLg` 1.75rem/2rem → 2.75rem/3.25rem @768px, w700, `-1px` |
| h3 | 1.25rem, Roboto **Slab** | `titleXs` 1.25rem/1.5rem, Roboto **Flex**, w700 |
| slates | neutral greys | SFDS blue-tinted slates |
| letter-spacing | `-0.04em` / `-0.025em` | `-1px` on the title steps |

Two consequences that belong in the open, not in a diff.

**`--font-display` narrows from `h1`–`h4` to `h1`–`h2`.** Live sf.gov renders
`h3` in Roboto Flex and SFDS sets `*` to sans. Both authorities agree here and
the repo currently disagrees with both — so this is a plain bug fix that happens
to be found by the same audit.

**Body text and background are the two values that currently match live sf.gov
exactly, and this changes them.** `#0b0c0c`→`#212123`, `#fcfcfc`→`#ffffff`. This
is the chosen authority working as intended. It means 29 pages that reviewers
have already recorded decisions against will look different when reopened, and
CLAUDE.md's "the mockup mirrors what SF.gov actually renders" rationale must be
rewritten to state what is now true. Leaving that sentence standing would
reproduce exactly the failure this spec exists to fix.

---

## The chrome surface

### Type — three of four steps land on published tokens

| Chrome token | Now | Becomes |
| --- | --- | --- |
| `--ds-text-panel` | 1.05rem (16.8px) | `--sfds-text-title-xs` 1.25rem/1.5rem |
| `--ds-text-card` | 0.88rem (14.1px) | `--sfds-text-body` 1rem/1.5rem |
| `--ds-text-label` | 0.78rem (12.5px) | `--sfds-text-small` 0.875rem/1.125rem |
| `--ds-text-micro` | 0.68rem (10.9px) | `--ext-text-2xs` 0.6875rem |

The cost is concrete: **49 chrome declarations currently sit below 14px** and
all of them rise to SFDS's floor. Panels get taller and wider. This is the
largest risk in the design and it lands on the dock breakpoint (see
Verification).

### Space

`--ds-space-*` (4/8/12/16/24/32/48/64px) is re-pointed onto SFDS's
`0/2/4/8/12/16/20/28/40/60/80/96`. The two agree through 16px and diverge above
it — the repo's 24/32/48/64 have no SFDS counterpart, so those steps move to the
nearest SFDS value (24→20 or 28, 32→28 or 40, 48→40, 64→60).

**The `--ds-*` names survive; only their values change.** Chrome rules keep
consuming a semantic layer rather than reaching for `--sfds-space-16` directly,
for the same reason `css/theme.css` exists at all: a component rule should name
the role, not the primitive. The same holds for the `--ds-text-*` table above —
those four names stay, re-pointed at SFDS steps.

The 171 literals snap to the nearest SFDS step, ties rounding **down**. Roughly
59 are exact and free; roughly 112 are near-misses on a de-facto 0.05rem grid
(`0.35rem`, `0.6rem`, `0.45rem`) and each is a small visual change. This is a
sweep to verify by screenshot across a width range, not a substitution to trust.

### Radius

`--radius: 8px` is deleted from `css/styles.css`. `--ext-radius-*` derives from
SFDS's 2/4/8/12 steps plus a pill. `js/react/theme.js`'s `shape.borderRadius`
reads `--ext-radius-4`.

### The MUI island stops drifting

`js/react/theme.js` maps three typography variants and `shape.borderRadius`
today, and leaves `spacing` at MUI's default 8px factor — so a ported panel and
the string-template panel beside it disagree, and the disagreement grows with
every port. It gets the full mapping: `palette` onto SFDS colours, the whole
`typography` set onto the SFDS text tokens, `spacing` onto a 4px factor matching
the SFDS ladder, `shape` onto `--ext-radius-4`.

`theme.js` must keep resolving tokens to literal values at theme-build time, for
the documented reason: a `var(--x)` string breaks `alpha()`, `lighten()` and
`contrastText`, all of which run through `decomposeColor()`.

---

## Verification

- **Dark mode is derived, then measured.** SFDS publishes no dark palette
  (zero `prefers-color-scheme` rules in either shipped bundle), so `--ext-dark-*`
  comes off SFDS hues and every pair is contrast-checked: 4.5:1 for body text,
  3:1 for large text and UI. The `--viz-decision-*` dark set is re-derived
  against the new hues and re-validated to the documented ΔE 15 floor, not
  lightened by eye. Today's dark mode is ~238 lines and well contained: 219 in
  `css/theme.css`, 14 in `css/inline-content-edit.css`, 5 in
  `css/ux-improvements.css`.
- **The 1700px dock breakpoint is re-measured, not assumed.** Both numbers
  behind it move when chrome type grows. `tests/e2e/workspace-panels.spec.js`
  already sweeps 1280→1920 in 40px steps; that assertion is the check, and 1700
  may have to move. The failure it guards against — the panel docking on top of
  the mockup — is invisible in a screenshot at scroll position 0.
- **Axe re-run**, for the obscured-cell class of finding that a single
  screenshot cannot show.
- `bun run validate` → `bun run test` → `bun run test:e2e`, with
  `bun run format:check` as the CI gate. `findExternalAssetUrls` must still
  pass; fonts are already `@fontsource`, so no new off-origin asset is
  introduced.
- Review state is untouched, so the import/export round trip is not at risk.
  Confirm anyway that the queue's e2e specs assert on class names rather than
  colours, since every `--status-*` value moves.

---

## Delivery — three pull requests

**PR1 — foundation, no pixel moves.** `docs/source/sfds/tokens.json` and its
dated README, `css/sfds.css`, `tests/sfds-tokens.test.js`, and `--radius`
relocated out of the mockup stylesheet into `--ext-radius-*`. The existing
`--sfds-*` names survive as aliases holding their **current** values, so nothing
renders differently. Docs and all three mirrors updated, including the corpus
counts.

**PR2 — the mockup adopts SFDS.** Colours, the `title` heading ladder,
`--font-display` narrowed to `h1`–`h2`, legacy aliases deleted. This is the
reviewer-visible change, and it is worth telling reviewers before it lands.

**PR3 — the chrome adopts SFDS.** The 171-literal spacing sweep, the 49
sub-14px type declarations, the MUI theme mapping, the dark-mode extension, the
dock re-measure. Riskiest, so it ships last and alone.

Splitting PR2 from PR3 is also what CLAUDE.md asks for directly: keep mockup
content changes and dashboard-UX changes in separate pull requests.

---

## Out of scope

- Re-styling `#mockPage` to match SFDS *components* (buttons, cards, accordions
  as Storybook renders them). This spec covers tokens — colour, type, space,
  radius. Component-level fidelity is a separate, larger piece of work.
- Importing `sfds.css` or `utilities.css` (405 kB and 401 kB) for their utility
  classes. The tool has no Tailwind build and the mockup renders through string
  templates.
- Changing which SFDS version the repo depends on. `@sfgov/design-system@0.0.1`
  stays installed for the three small bundles `js/main.js` already imports.
