# SFDS adoption — status and what not to rediscover

Working notes for the migration described in
`docs/superpowers/specs/2026-08-14-sfds-design-consistency-design.md` and
executed by `docs/superpowers/plans/2026-08-14-sfds-design-consistency.md`.

This file is tracked on purpose. The same notes lived in a scratch progress
ledger under `.superpowers/`, which is gitignored, and it was destroyed when the
worktree holding it was removed after a merge — taking every review finding with
it. Anything a later session would otherwise pay to rediscover belongs here
instead.

## What has landed

**Tasks 1–6 and the webfont remediation**, merged as `08ed345`, "feat: adopt
SFDS as the shared design layer across mockup and tool chrome (#133)". That
squash does not carry the original thirteen commits as ancestors, so they will
not appear in the branch graph.

- `docs/source/sfds/` vendors the SFDS token capture with its provenance, plus
  `disagreements.md` recording where the published theme and the shipped
  `@sfgov/design-system@0.0.1` package disagree.
- `css/sfds.css` holds the primitives, keyed to SFDS's own published names and
  pinned in both directions against the capture by `tests/sfds-tokens.test.js`.
- The 30 hand-authored primitives that previously squatted on the `--sfds-*`
  prefix are renamed `--legacy-*` and are being retired task by task.
- The mockup renders in SFDS's palette.

**Task 7**, the mockup's heading ladder — `h1` on `titleXl`, `h2` on `titleLg`,
`h3` on `titleXs`, all weight 700, with the slab face narrowed to `h1`–`h2`.

## What remains

Tasks 8 through 12: the chrome type scale, the chrome spacing sweep, the MUI
theme mapping, the brand ramp and dark-palette re-derivation, and the dock
breakpoint re-measure.

## Things that will cost you an hour if you rediscover them

- **`bun run test:e2e` needs an explicit port.** `reuseExistingServer` is on
  outside CI, so a dev server bound to 8080 from another checkout is silently
  reused and the entire suite reports on a build unrelated to the branch under
  test — green, and meaningless. Run `HHVC_E2E_PORT=<n> bun run test:e2e`.
  Setting the variable also disables reuse, so asking for a port means getting
  one.

- **`tests/e2e/mosquito-workshop-form.spec.js` has one failing test**, "keeps
  the request visible when submission fails". It is pre-existing and unrelated
  to this migration — proved by reverting every migration file to the base
  commit and reproducing it identically. It deserves its own investigation; do
  not chase it from inside a migration task.

- **Four `--status-*-border` tokens sit below the 3:1 non-text contrast floor** —
  measured 1.41, 1.64, 1.56 and 1.78 — because SFDS's tint steps are paler than
  the palette they replaced. This is deliberately deferred, not missed: re-picking
  them is a decision about the whole chip visual system and it fans out into dark
  mode and the `--viz-decision-*` palette. The header comment in `css/theme.css`
  names the real figures rather than asserting they pass.

- **`--legacy-info-light` (`#e5f1ff`) and `--legacy-blue-soft-bg` (`#f1f4ff`)
  were visually distinct and now both resolve to `--sfds-color-blue-l1`.** The
  mapping specifies that collapse; it is recorded rather than a defect to undo.

- **The sans family is `'Roboto Flex Variable'`, not `'Roboto Flex'`.** The
  static `@fontsource/roboto-flex` ships weight 400 only — Roboto Flex is a
  variable font — so the branch adopted `@fontsource-variable/roboto-flex`, and
  a self-hosted variable build registers that family name. Recorded as a
  deliberate departure in `docs/source/sfds/disagreements.md`.

## Two method notes worth keeping

**`getComputedStyle().fontWeight === '700'` is not evidence of a real face.** A
browser asked for a weight it does not have synthesises one by geometrically
smearing the outlines it does have, and reports 700 either way — different
metrics, and it reads as a rendering fault rather than a type choice.
`document.fonts.check('700 16px "<family>"')`, after `await document.fonts.ready`,
returns true only when a matching face is actually available. That is the
assertion `tests/e2e/mockup-tokens.spec.js` carries.

**Measure a contrast failure before calling it a tool artefact.** One review
round dismissed an axe `color-contrast` violation as a false positive on the
grounds that the token's own value cleared the floor comfortably. Axe was right:
the text was being composited under `.compliance-list--facts { opacity: 0.85 }`
and genuinely rendered at 4.47:1 against a 4.5 floor. The direct computed-style
read and axe's sampled value disagreed, and that disagreement was the clue. It
was fixed at the rendering rather than by darkening an SFDS token, because text
at reduced alpha is harder to read whatever its nominal colour.

**A corollary that keeps paying off:** run the full suite at each phase
boundary. The chip failure passed at the end of Phase 1 and failed after the
palette task, and that is what proved it was ours rather than pre-existing.

## A cascade trap this migration walked into twice

Putting a size on a bare element selector does nothing if a component-scoped
selector already sets it. `h1` is specificity 0-0-1; `.hero-inner h1` is 0-1-1
and wins. The heading-ladder task's own worked example expected `h1` at 64px
when the page had been rendering 40px from `.hero-inner h1` all along, and
nobody noticed because the number was never measured.

The same shape bit a second time in the same task: replacing a shared
`h1, h2, h3, h4` block with per-level rules silently dropped `line-height: 1.15`
from every heading that had relied on the shared block and set none of its own —
ten selectors, two of which no grep for "h2" or "h3" would find, because their
class names are `.what-to-know-heading` and `.accordion-heading`.

When you move a declaration off a shared selector, enumerate what was relying on
it rather than listing what you remember.
