/* The MUI theme bridge's token contract.

   Role: pins which design tokens js/react/theme.js reads, and that every one
   of them has a fallback. A token read with no fallback resolves to '' in a
   happy-dom test or before the stylesheets apply, and MUI turns an empty
   palette value into a crash rather than a default.

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
