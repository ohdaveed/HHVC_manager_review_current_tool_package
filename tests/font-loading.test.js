/* Which webfont faces the bundle actually loads.

   Role: guards a failure that is invisible in code review and subtle in a
   screenshot. The mockup's headings are weight 700; if only the 400 face is
   imported the browser synthesises bold by smearing the 400 outlines, which
   has different metrics and reads as a rendering fault rather than a design.

   Roboto Slab gets both weights; Roboto Flex does NOT, and that's not an
   oversight. @fontsource/roboto-flex is generated from the variable Roboto
   Flex source and its README documents exactly one static weight —
   `Weights: [400]` — so there is no `latin-700.css` to import for it at any
   version. The only way to get a real 700 instance of Roboto Flex is the
   separate `@fontsource-variable/roboto-flex` package, which registers under
   the font-family name 'Roboto Flex Variable' rather than 'Roboto Flex' (a
   Fontsource convention to let both packages coexist) and would require
   rethreading --font-body/--sfds-font-sans in css/theme.css and css/sfds.css
   to match — a font-family decision with its own bundle-size cost, out of
   scope for loading a weight that already exists on disk. Bold body text
   (`.eyebrow`, `.brand`, `.table th`, `.tool-btn`, …) keeps rendering
   synthesised bold until that decision is made deliberately, in a task that
   owns it.

   The existsSync assertions below are the point of this file, not the
   import-string check: they pin the CURRENT SHAPE OF THE DEPENDENCY, not
   just this file's text. If a future @fontsource/roboto-flex release adds a
   static 700 build, the "must NOT exist" assertion goes red and tells
   whoever sees it to add the fourth import rather than leaving Flex bold
   permanently synthesised out of habit.

   Load-order dependency: none. */

import { describe, test, expect } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const repoRoot = join(import.meta.dir, '..')
const main = readFileSync(join(repoRoot, 'js/main.js'), 'utf8')

describe('webfont imports in js/main.js', () => {
  test('loads both weights of Roboto Slab', () => {
    const expected = [
      '@fontsource/roboto-slab/latin-400.css',
      '@fontsource/roboto-slab/latin-700.css',
    ]
    expect(expected.filter((face) => !main.includes(face))).toEqual([])
  })

  test('loads only weight 400 of Roboto Flex, since that is all the static package ships', () => {
    expect(main).toContain('@fontsource/roboto-flex/latin-400.css')
    expect(main).not.toContain('@fontsource/roboto-flex/latin-700.css')
  })
})

describe('webfont packages on disk (guards the dependency, not just this file)', () => {
  test('roboto-slab ships a static 700 face', () => {
    expect(existsSync(join(repoRoot, 'node_modules/@fontsource/roboto-slab/latin-700.css'))).toBe(
      true
    )
  })

  test('roboto-flex still ships no static 700 face', () => {
    expect(existsSync(join(repoRoot, 'node_modules/@fontsource/roboto-flex/latin-700.css'))).toBe(
      false
    )
  })
})
