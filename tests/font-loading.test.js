/* Which webfont faces the bundle actually loads.

   Role: guards a failure that is invisible in code review and subtle in a
   screenshot. The mockup's headings are weight 700; if a face's 700 weight
   is not actually served the browser synthesises bold by smearing whatever
   weight it does have, which has different metrics and reads as a
   rendering fault rather than a design.

   Both typefaces now carry a real weight-700 instance, but by two different
   mechanisms, and that asymmetry is deliberate — see js/main.js's font-import
   comment before "fixing" it into a matching pair.

   Roboto Slab is genuinely a static, single-weight-per-file typeface
   upstream, so @fontsource/roboto-slab ships one CSS file per weight and
   this repo imports both latin-400.css and latin-700.css.

   Roboto Flex is a VARIABLE typeface upstream — one outline family whose
   weight axis runs 100 to 1000 — so @fontsource/roboto-flex (the static
   package) is a single frozen instance of it and its own metadata documents
   exactly one weight, `weights: [400]`, at any version: there is no
   latin-700.css for that package to ship, ever. The only way to a real 700
   instance is the separate `@fontsource-variable/roboto-flex` package, which
   serves the actual variable file. That package registers under the
   font-family name 'Roboto Flex Variable' rather than 'Roboto Flex' — a
   Fontsource convention that lets the static and variable packages coexist
   without one silently shadowing the other — so css/sfds.css's
   `--sfds-font-sans` and css/theme.css's `--font-body`/`--font-caption` had
   to be rethreaded to the new name together with this import, or the
   browser would fall back to the system sans with nothing visibly broken.
   This repo now carries ONLY the variable package: it replaces the static
   400-weight-only one rather than sitting alongside it, since it covers
   every weight the static package covered plus the 700 this task adds.

   The existsSync assertions below are the point of this file, not the
   import-string check: they pin the CURRENT SHAPE OF THE DEPENDENCY, not
   just this file's text. A future @fontsource/roboto-flex release adding a
   static 700 build, or @fontsource-variable/roboto-flex dropping its wght
   axis file, would go red here rather than silently rotting into a stale
   comment.

   Neither existsSync assertion nor the import-string checks below can prove
   a 700 instance actually RENDERS — they prove a file is on disk and an
   import line names it, which a typo in the family name would defeat
   without failing either. tests/e2e/mockup-tokens.spec.js closes that gap
   with `document.fonts.check('700 16px "…"')` against a real loaded page,
   which is the one API that reports whether the browser considers a face
   for that exact weight actually available (true) or whether it would
   synthesise one (false).

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

  test('loads the weight axis of the variable Roboto Flex package, not the static one', () => {
    expect(main).toContain('@fontsource-variable/roboto-flex/wght.css')
    expect(main).not.toContain('@fontsource/roboto-flex/latin-400.css')
    expect(main).not.toContain('@fontsource/roboto-flex/latin-700.css')
  })
})

describe('webfont packages on disk (guards the dependency, not just this file)', () => {
  test('roboto-slab ships a static 700 face', () => {
    expect(existsSync(join(repoRoot, 'node_modules/@fontsource/roboto-slab/latin-700.css'))).toBe(
      true
    )
  })

  test('the static roboto-flex package is not installed', () => {
    expect(existsSync(join(repoRoot, 'node_modules/@fontsource/roboto-flex'))).toBe(false)
  })

  test('the variable roboto-flex package ships a wght axis file covering weight 700', () => {
    const wghtPath = join(repoRoot, 'node_modules/@fontsource-variable/roboto-flex/wght.css')
    expect(existsSync(wghtPath)).toBe(true)
    const wght = readFileSync(wghtPath, 'utf8')
    // The variable file declares one @font-face per subset, each spanning the
    // full weight range as `font-weight: 100 1000` rather than a fixed
    // number — that range syntax IS what makes 700 a real, non-synthesised
    // instance rather than a single frozen weight.
    expect(wght).toContain("font-family: 'Roboto Flex Variable'")
    expect(wght).toContain('font-weight: 100 1000')
  })
})
