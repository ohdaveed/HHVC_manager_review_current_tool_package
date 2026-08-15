/* The MUI theme bridge's token and scale contract.

   Role: pins two things about js/react/theme.js. First, which design tokens
   it reads, and that every one of them has a fallback — a token read with no
   fallback resolves to '' in a happy-dom test or before the stylesheets
   apply, and MUI turns an empty palette value into a crash rather than a
   default. Second, which parts of this repo's chrome scale the bridge maps
   at all: MUI's own type sizes and its 8px spacing factor are a real scale
   rather than an absent one, so an unmapped variant renders plausibly and
   only reads wrong beside the string-template panel next door.

   Load-order dependency: none. */

import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const source = readFileSync(join(import.meta.dir, '..', 'js/react/theme.js'), 'utf8')

describe('js/react/theme.js token reads', () => {
  test('reads the radius from --ext-radius-8, not the mockup stylesheet', () => {
    expect(source).toContain("token(styles, '--ext-radius-8')")
    expect(source).not.toContain("token(styles, '--radius')")
  })

  test('has a fallback for every token it reads', () => {
    const read = [...source.matchAll(/token\(styles, '(--[a-z0-9-]+)'\)/g)].map((m) => m[1])
    const fallbacks = [...source.matchAll(/'(--[a-z0-9-]+)':\s*'/g)].map((m) => m[1])
    // Guard the regex extraction itself, not just its result: if a harmless
    // reformat ever breaks the `token(styles, '...')` pattern — a call
    // wrapped across two lines, say — `read` silently becomes [], and
    // `expect([]).toEqual([])` on the line below would pass while checking
    // nothing at all. A text-matching test that can quietly match nothing
    // is exactly the failure mode this assertion exists to catch.
    expect(read.length).toBeGreaterThan(0)
    expect(read.filter((name) => !fallbacks.includes(name))).toEqual([])
  })
})

/* The other half of the bridge: the scale. These are source-text assertions
   like the ones above rather than assertions on a built theme object, and
   deliberately so — the failure they exist to catch is a variant or a
   spacing factor going MISSING, which leaves MUI's own default silently in
   its place. A default is a real value, so a theme built without them looks
   correct in isolation and only reads wrong beside the string-template panel
   next door, which is exactly the disagreement no unit test would see. */
describe('js/react/theme.js scale coverage', () => {
  test('maps a spacing factor rather than inheriting MUI default', () => {
    // The value matters, not just the key: MUI's default factor is 8, so an
    // unset `spacing` makes theme.spacing(1) 8px where --ds-space-1 is 4px,
    // and every ported panel drifts one step coarser than its neighbour.
    expect(source).toContain('spacing: 4')
  })

  test('maps every chrome type step', () => {
    for (const step of [
      '--ds-text-panel',
      '--ds-text-card',
      '--ds-text-label',
      '--ds-text-micro',
    ]) {
      expect(source).toContain(step)
    }
  })

  test('maps the caption and button variants, not only h3/h4/body2', () => {
    for (const variant of ['h5:', 'body1:', 'caption:', 'button:']) {
      expect(source).toContain(variant)
    }
  })

  test('leaves MUI button labels in the case they were written in', () => {
    // MUI uppercases button labels by default and nothing else in this
    // chrome does, so an unmapped `button` variant is visible as soon as an
    // island renders one beside a string-template control.
    expect(source).toContain("textTransform: 'none'")
  })
})
