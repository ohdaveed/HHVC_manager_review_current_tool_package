/* Contrast floors and separation floors for the token pairs this tool renders.

   Role: SFDS publishes a single fixed light palette. It states no dark mode,
   no eleven-step brand ramp, and no guarantees for the pairings this tool
   invents on top of it — so every figure `css/theme.css` claims about those is
   this repo's own measurement, and until now it lived only in a comment. Every
   dark-mode contrast bug this repo has had came from a literal sitting where a
   token belonged, and not one of them failed a test: a comment cannot go red.
   This file recomputes the figures from the declared values instead.

   Two things about how it reads the stylesheet are load-bearing.

   **It splits the file into three scopes, and only two of them are palettes.**
   `css/theme.css` declares the light tokens in `:root`, overrides them inside
   `@media (prefers-color-scheme: dark)`, and then RE-PINS the light values a
   third time in that media block's `.browser-shell` rule — the mockup is a
   preview of a light public page and must not follow the reviewer's OS theme.
   Scraping the whole file for a token therefore finds up to three values for
   it, two of which are the same. Everything here reads a named scope.

   **Separation is measured within a mode, never across them.** The naive
   version of the deltaE test scrapes every `--viz-decision-*` in the file and
   compares all 45 pairs, which puts the light neutral (#8a8d8d) against the
   dark one (#adb3b3) and reports deltaE 14.1 — a failure against the floor of
   15, describing two colours that can never appear on screen together. The
   floor exists so adjacent segments of one stacked bar stay distinguishable,
   and a bar is drawn in one mode.

   Load-order dependency: none. Pure arithmetic over the declared values; no
   DOM, no browser, no import of the app's module graph. */

import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const css = readFileSync(join(import.meta.dir, '..', 'css/theme.css'), 'utf8')

/* The primitive layer. Half the semantic tokens are declared as a reference
   into it — `--brand-primary: var(--sfds-color-action)` — so a resolver that
   stopped at this file's own `:root` would measure nothing that matters. */
const SFDS = readFileSync(join(import.meta.dir, '..', 'css/sfds.css'), 'utf8')

/* The three scopes described in the header. The dark palette ends where the
   `.browser-shell` light re-pin begins, so slicing at that selector is what
   keeps a light value from being read as a dark one. */
const DARK_START = css.indexOf('@media (prefers-color-scheme: dark)')
const SHELL_START = css.indexOf('.browser-shell {', DARK_START)
const LIGHT = css.slice(0, DARK_START)
const DARK = css.slice(DARK_START, SHELL_START)

const SFDS_WHITE = '#ffffff'

/**
 * Read one token's declared value out of a scope.
 *
 * @param {string} scope The slice of css/theme.css to search.
 * @param {string} name Token name including the leading dashes.
 * @returns {string} The raw declared value, hex or `var(--other)`.
 */
function declared(scope, name) {
  const match = scope.match(new RegExp(`${name}:\\s*([^;]+);`))
  if (!match) throw new Error(`${name} is not declared in this scope of css/theme.css`)
  return match[1].trim()
}

/**
 * Read one token as a literal hex, following `var()` references the way the
 * cascade does: within the scope first, then falling back to the light
 * `:root` block.
 *
 * Both directions are needed and neither is hypothetical. The dark block
 * points `--brand-primary` at `var(--brand-70)`, a step it does not override,
 * so that one resolves in `:root`; it points `--surface-panel` at
 * `var(--ext-dark-panel)`, which exists only inside the dark block, so that
 * one must resolve in scope. Resolving is what lets the test measure what
 * actually renders rather than skipping every token declared by reference —
 * which is most of them, that being the point of the layer.
 *
 * @param {string} scope The slice of css/theme.css to search.
 * @param {string} name Token name including the leading dashes.
 * @returns {string} Six-digit hex.
 */
function hex(scope, name) {
  const value = declared(scope, name)
  const direct = value.match(/^#[0-9a-f]{6}$/i)
  if (direct) return value.toLowerCase()
  const reference = value.match(/^var\((--[a-z0-9-]+)\)$/i)
  if (reference) {
    const target = reference[1]
    if (target.startsWith('--sfds-')) return hex(SFDS, target)
    const inScope = scope !== LIGHT && new RegExp(`${target}:`).test(scope)
    return hex(inScope ? scope : LIGHT, target)
  }
  throw new Error(`${name} resolves to ${value}, which is neither a hex nor a single var()`)
}

/**
 * Relative luminance of an sRGB hex colour, per WCAG 2.1.
 *
 * @param {string} value Six-digit hex, with or without the leading hash.
 * @returns {number}
 */
function luminance(value) {
  const v = value.replace('#', '')
  const channels = [0, 2, 4].map((i) => {
    const c = parseInt(v.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

/**
 * WCAG contrast ratio between two hex colours.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} Between 1 and 21.
 */
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Convert an sRGB hex colour to CIELAB with a D65 white point.
 *
 * @param {string} value
 * @returns {[number, number, number]}
 */
function lab(value) {
  const v = value.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(v.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]
}

/**
 * CIE76 colour difference between two sRGB hex colours.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function deltaE(a, b) {
  const [la, lb] = [lab(a), lab(b)]
  return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2])
}

describe('brand ramp contrast', () => {
  test('steps 50 and darker clear 4.5:1 on white, so they are safe for text', () => {
    for (const step of [
      '--brand-50',
      '--brand-40',
      '--brand-30',
      '--brand-20',
      '--brand-10',
      '--brand-05',
    ]) {
      expect(contrast(hex(LIGHT, step), SFDS_WHITE)).toBeGreaterThanOrEqual(4.5)
    }
  })

  test('step 60 clears the 3:1 non-text bar but not the text bar', () => {
    const ratio = contrast(hex(LIGHT, '--brand-60'), SFDS_WHITE)
    expect(ratio).toBeGreaterThanOrEqual(3)
    expect(ratio).toBeLessThan(4.5)
  })

  test('pins step 40 and step 10 to the real SFDS hexes', () => {
    expect(hex(LIGHT, '--brand-40')).toBe('#495ed4')
    expect(hex(LIGHT, '--brand-10')).toBe('#0c1464')
  })

  test('runs monotonically from darkest to lightest, with no step out of order', () => {
    const steps = ['--brand-05', '--brand-10', '--brand-20', '--brand-30', '--brand-40']
      .concat(['--brand-50', '--brand-60', '--brand-70', '--brand-80', '--brand-90', '--brand-95'])
      .map((step) => luminance(hex(LIGHT, step)))
    for (let i = 1; i < steps.length; i += 1) expect(steps[i]).toBeGreaterThan(steps[i - 1])
  })
})

describe('rendered brand pairs', () => {
  /* The button, in both themes. Light mode paints --brand-on-primary on
     --brand-primary; dark mode repoints both, and the dark pairing is the one
     SFDS says nothing at all about. */
  test('the primary button clears 4.5:1 in light mode', () => {
    expect(
      contrast(hex(LIGHT, '--brand-on-primary'), hex(LIGHT, '--brand-primary'))
    ).toBeGreaterThanOrEqual(4.5)
  })

  test('the primary button clears 4.5:1 in dark mode', () => {
    expect(
      contrast(hex(DARK, '--brand-on-primary'), hex(DARK, '--brand-primary'))
    ).toBeGreaterThanOrEqual(4.5)
  })

  test('links and their hover clear 4.5:1 on the dark panel', () => {
    const panel = hex(DARK, '--surface-panel')
    expect(contrast(hex(DARK, '--brand-primary'), panel)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(hex(DARK, '--brand-primary-hover'), panel)).toBeGreaterThanOrEqual(4.5)
  })

  test('body and secondary text clear their floors on the dark panel', () => {
    const panel = hex(DARK, '--surface-panel')
    expect(contrast(hex(DARK, '--text-primary'), panel)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(hex(DARK, '--text-secondary'), panel)).toBeGreaterThanOrEqual(4.5)
    /* A strong border carries meaning rather than text, so it takes the 3:1
       non-text bar (WCAG 1.4.11) and not the 4.5:1 one. */
    expect(contrast(hex(DARK, '--border-strong'), panel)).toBeGreaterThanOrEqual(3)
  })
})

describe('status chips in dark mode', () => {
  /* Each family's foreground is tuned against its own tinted background, and
     each border is tuned against the panel. Light mode is deliberately not
     asserted here: four of the five light `-border` steps are SFDS `l2`/`l3`
     tints that measure under 3:1 on white, a known and recorded finding whose
     fix needs a value SFDS does not publish. See the light-mode block's own
     comment in css/theme.css. */
  const FAMILIES = ['approved', 'edits', 'revise', 'blocked', 'pending']

  test('every foreground clears 4.5:1 on its own background', () => {
    for (const family of FAMILIES) {
      const fg = hex(DARK, `--status-${family}-fg`)
      const bg = hex(DARK, `--status-${family}-bg`)
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5)
    }
  })

  test('every border clears 3:1 on the dark panel', () => {
    const panel = hex(DARK, '--surface-panel')
    for (const family of FAMILIES) {
      expect(contrast(hex(DARK, `--status-${family}-border`), panel)).toBeGreaterThanOrEqual(3)
    }
  })
})

describe('decision fills', () => {
  /**
   * The five decision fills declared in one scope, keyed by decision.
   *
   * Keyed rather than positional because the two scopes are two independent
   * lists of declarations, and a reordering of one of them would otherwise
   * silently compare a green to a purple.
   *
   * @param {string} scope
   * @returns {Record<string, string>} Decision name to six-digit hex.
   */
  function decisionFills(scope) {
    const found = [...scope.matchAll(/--viz-decision-([a-z-]+):\s*(#[0-9a-f]{6})/gi)]
    return Object.fromEntries(found.map((m) => [m[1], m[2].toLowerCase()]))
  }

  for (const [mode, scope, surface] of [
    ['light', LIGHT, SFDS_WHITE],
    ['dark', DARK, null],
  ]) {
    test(`${mode} mode declares all five fills`, () => {
      expect(Object.keys(decisionFills(scope)).sort()).toEqual([
        'approved',
        'blocked',
        'edits',
        'pending',
        'revise',
      ])
    })

    test(`every ${mode} pair separates by at least 15 in CIE76 deltaE`, () => {
      const values = Object.values(decisionFills(scope))
      for (let i = 0; i < values.length; i += 1) {
        for (let j = i + 1; j < values.length; j += 1) {
          expect(deltaE(values[i], values[j])).toBeGreaterThanOrEqual(15)
        }
      }
    })

    test(`every ${mode} fill clears 3:1 against its own panel`, () => {
      const panel = surface ?? hex(DARK, '--surface-panel')
      for (const value of Object.values(decisionFills(scope))) {
        expect(contrast(value, panel)).toBeGreaterThanOrEqual(3)
      }
    })
  }

  /* The measurement that justifies scoping the two tests above per mode, and
     the reason it is asserted rather than stated: a figure that lives only in
     a comment is precisely what this file exists to replace. The neutral is
     the pair that fails — "Needs review" is the absence of a decision and is
     picked to recede against each mode's own panel, which sends it in
     opposite directions in the two modes.

     If this ever clears the floor, the split has stopped being load-bearing
     and should be reconsidered rather than left in place unexamined. That is
     why it asserts a FAILURE: a test that merely skipped the cross-mode pairs
     would keep the split forever without ever showing it was needed. */
  test('the cross-mode pair the split excludes really does fall under the floor', () => {
    const separation = deltaE(decisionFills(LIGHT).pending, decisionFills(DARK).pending)
    expect(separation).toBeLessThan(15)
    expect(separation).toBeGreaterThan(13)
  })
})

describe('categorical visualisation palette', () => {
  /* Okabe-Ito, narrowed to the four entries that clear 3:1 against BOTH
     themes' panel surfaces. The light surface moved from #fcfcfc to #ffffff
     when the semantic layer repointed onto SFDS, which is exactly the kind of
     move that silently invalidates a figure sitting in a comment. */
  const SERIES = ['--viz-1', '--viz-2', '--viz-3', '--viz-4']

  test('every series colour clears 3:1 on the light panel', () => {
    for (const name of SERIES) {
      expect(contrast(hex(LIGHT, name), SFDS_WHITE)).toBeGreaterThanOrEqual(3)
    }
  })

  test('every series colour clears 3:1 on the dark panel', () => {
    const panel = hex(DARK, '--surface-panel')
    for (const name of SERIES) {
      expect(contrast(hex(LIGHT, name), panel)).toBeGreaterThanOrEqual(3)
    }
  })
})

/* The toast controls, which are the one place in this file where the rendered
   colour is not a declared token.

   Every other pair here reads two tokens and compares them. The toast's two
   controls instead DERIVE their colour from `--toast-fg` at render time —
   the dismiss button through `opacity`, the action button through a
   `color-mix()` tint under its label — so the value that reaches the screen is
   in `css/styles.css`, not in the palette, and no amount of checking the
   palette catches it.

   That gap is not hypothetical. `--toast-info-bg` moved from #2a60af to SFDS's
   action blue #495ed4 during the ramp work. The token itself stayed correct
   (5.34:1 against `--toast-fg`, comfortably AA) and every existing test stayed
   green, while the dismiss button fell to 4.34:1 and the action label to
   4.23:1 — both under AA, both with an in-file comment still asserting the
   pre-move figures. Recomputing the composite from the two files is what would
   have caught it, so that is what these tests do.

   The lightest background always governs: opacity and a light tint each move
   the rendered colour TOWARD the background, so the variant with the least
   separation to begin with is the one that runs out first. */
const STYLES = readFileSync(join(import.meta.dir, '..', 'css/styles.css'), 'utf8')

/* Every toast background, DISCOVERED from the stylesheet rather than listed
   here. An earlier version hard-coded the three names under a comment
   claiming a new variant would be covered automatically -- which was simply
   false, and false in the direction that matters: adding `--toast-warning-bg`
   to css/theme.css would have left it untested while the comment said
   otherwise. Reading the declarations is what makes the claim true.

   `-fg` is excluded because it is the foreground these are measured AGAINST,
   not another surface to measure. */
const TOAST_BACKGROUNDS = [...LIGHT.matchAll(/(--toast-[a-z-]*bg):/g)].map((m) => m[1])

/**
 * Composite one hex colour over another at a given alpha, the way `opacity`
 * and `color-mix(… N%, transparent)` both resolve against an opaque backdrop.
 *
 * **The blend is deliberately in gamma-encoded sRGB, not linearized sRGB**,
 * and that is measured rather than assumed — it is the obvious thing to
 * "correct" (WCAG's luminance step linearizes, so the two get conflated), and
 * correcting it would make every number here wrong. Checked against Chromium
 * on 2026-08-16 by rendering the real pairing and reading it back:
 *
 *   - `opacity: .92` of #fcfcfc over #495ed4 renders as rgb(237, 239, 249).
 *     This function predicts (238, 239, 249); linearized predicts
 *     (244, 244, 249) — off by 7/255 on the red channel.
 *   - `color-mix(in srgb, #fcfcfc 6%, #495ed4)` computes to
 *     `color(srgb 0.328392 0.405804 0.840784)` = rgb(84, 104, 214). This
 *     function predicts (84, 103, 214); linearized predicts (98, 113, 215).
 *
 * Both halves match this implementation to within rounding. CSS `srgb` IS the
 * gamma-encoded space — `srgb-linear` is the separate one — so a blend that
 * linearized first would describe a colour the browser never draws.
 *
 * @param {string} fg Six-digit hex, the colour being laid down.
 * @param {string} bg Six-digit hex, the opaque colour behind it.
 * @param {number} alpha 0-1.
 * @returns {string} Six-digit hex of the result.
 */
function composite(fg, bg, alpha) {
  const [f, b] = [fg.replace('#', ''), bg.replace('#', '')]
  const channel = (i) => {
    const fv = parseInt(f.slice(i, i + 2), 16)
    const bv = parseInt(b.slice(i, i + 2), 16)
    return Math.round(alpha * fv + (1 - alpha) * bv)
  }
  return `#${[0, 2, 4].map((i) => channel(i).toString(16).padStart(2, '0')).join('')}`
}

/**
 * Read a numeric declaration out of one CSS rule in `css/styles.css`.
 *
 * Scoped to the rule rather than the file because `opacity` and
 * `color-mix()` both appear many times over; matching the first hit anywhere
 * would silently measure some other component's value and pass.
 *
 * @param {string} selector The rule's full selector text.
 * @param {RegExp} pattern Must expose the number as capture group 1.
 * @returns {number}
 */
function inRule(selector, pattern) {
  const start = STYLES.indexOf(`${selector} {`)
  if (start === -1) throw new Error(`${selector} is not declared in css/styles.css`)
  const rule = STYLES.slice(start, STYLES.indexOf('}', start))
  const match = rule.match(pattern)
  if (!match) throw new Error(`${selector} declares nothing matching ${pattern}`)
  return parseFloat(match[1])
}

describe('toast controls, composited against every variant', () => {
  const fg = hex(LIGHT, '--toast-fg')

  test('discovers every declared toast background', () => {
    // A regex that silently matches nothing turns every assertion below into
    // a loop over an empty list, which passes while measuring no colour at
    // all -- the same vacuous-pass shape this file guards against elsewhere.
    // The three named here are the ones that exist today; the point of the
    // discovery is that a fourth joins them without editing this file.
    expect(TOAST_BACKGROUNDS).toContain('--toast-bg')
    expect(TOAST_BACKGROUNDS).toContain('--toast-success-bg')
    expect(TOAST_BACKGROUNDS).toContain('--toast-info-bg')
  })

  test('the dismiss button clears 4.5:1 on every toast variant', () => {
    const opacity = inRule('.toast .toast-close', /opacity:\s*([\d.]+)/)
    for (const name of TOAST_BACKGROUNDS) {
      const bg = hex(LIGHT, name)
      expect(contrast(composite(fg, bg, opacity), bg)).toBeGreaterThanOrEqual(4.5)
    }
  })

  test('the action label clears 4.5:1 on every toast variant', () => {
    /* The label is full-strength --toast-fg; what moves is the surface under
       it, so the tint is composited into the BACKGROUND and the text stays
       put. Getting this the wrong way round measures a fading label on a
       fixed background and reports a number that is not on screen. */
    const tint = inRule('.toast .toast-action', /background:\s*color-mix\([^)]*?([\d.]+)%/) / 100
    for (const name of TOAST_BACKGROUNDS) {
      const bg = hex(LIGHT, name)
      expect(contrast(fg, composite(fg, bg, tint))).toBeGreaterThanOrEqual(4.5)
    }
  })

  test('the action border clears 3:1 against the toast behind it', () => {
    /* A boundary carries no text, so this is WCAG 1.4.11's 3:1 rather than
       4.5:1 — but it is what makes the control legible AS a control, and at
       the 45% it started at this was 2.32:1 on the info variant. */
    const border = inRule('.toast .toast-action', /border:[^;]*?([\d.]+)%/) / 100
    for (const name of TOAST_BACKGROUNDS) {
      const bg = hex(LIGHT, name)
      expect(contrast(composite(fg, bg, border), bg)).toBeGreaterThanOrEqual(3)
    }
  })

  test('hovering the action button never lowers its label contrast', () => {
    /* The regression this pins is specific: the hover rule used to raise the
       fill to 22%, taking the label to 3.49:1 — so pointing at the control
       made it less readable, which is the opposite of what a hover state is
       for. Asserting "no fill change on hover" would over-constrain the
       design; asserting the rendered result stays AA does not. */
    const start = STYLES.indexOf('.toast .toast-action:hover {')
    expect(start).toBeGreaterThan(-1)
    const rule = STYLES.slice(start, STYLES.indexOf('}', start))
    const fill = rule.match(/background:\s*color-mix\([^)]*?([\d.]+)%/)
    const tint = fill
      ? parseFloat(fill[1]) / 100
      : inRule('.toast .toast-action', /background:\s*color-mix\([^)]*?([\d.]+)%/) / 100
    for (const name of TOAST_BACKGROUNDS) {
      const bg = hex(LIGHT, name)
      expect(contrast(fg, composite(fg, bg, tint))).toBeGreaterThanOrEqual(4.5)
    }
  })
})
