/* Pins the SFDS primitive layer against its vendored capture.

   Role: the guard that makes `--sfds-*` mean something. Once `css/sfds.css`
   exists (Task 3), every value declared there must match
   `docs/source/sfds/tokens.json`, AND no `--sfds-*` name may exist that the
   capture does not contain. The second direction is the one that matters:
   the first would have passed happily on the codebase this replaced, where
   someone invented `--sfds-action-blue` and gave it a value SFDS never
   published.

   This file also asserts the second direction — that the namespace's ONLY
   consumers are the ones that have actually adopted it. Before Task 6 that
   meant "no file outside css/sfds.css": it existed a task ahead of
   `css/sfds.css` on purpose (see Task 2's brief), so it was true from its
   first commit rather than deferred to the PR that added the real tokens.
   Task 6 is the one that makes `css/theme.css` (the semantic layer) and
   `css/styles.css` (the mockup's own rules) real consumers, so the allowlist
   below grew by exactly those two — not to "no file outside sfds.css" but
   to "no file outside the files that have actually migrated." Widening it
   further belongs to whichever later task migrates the next file (e.g.
   `css/ux-improvements.css`, `css/ai-assist.css`, still on `--legacy-*` as
   of Task 6); this test is what makes that widening a deliberate, reviewed
   line rather than a silent expansion. The value-pinning half — declared
   values against `docs/source/sfds/tokens.json` — lands with Task 3, once
   there is a `css/sfds.css` to check.

   Load-order dependency: none. It reads files off disk and parses text. */

import { describe, test, expect } from 'bun:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..')

/** Files that have migrated onto `--sfds-*` and may legitimately consume it,
 * beyond `css/sfds.css` itself (which declares the namespace). Task 6 added
 * `css/theme.css` and `css/styles.css`; every other stylesheet still reads
 * `--legacy-*` and is not yet on this list. */
const MIGRATED_CONSUMERS = ['css/theme.css', 'css/styles.css']

/**
 * Every file in the repo that may legitimately mention a design token.
 *
 * @returns {string[]} Absolute paths.
 */
function tokenBearingFiles() {
  const css = readdirSync(join(ROOT, 'css'))
    .filter((f) => f.endsWith('.css'))
    .map((f) => join(ROOT, 'css', f))
  const js = readdirSync(join(ROOT, 'js'))
    .filter((f) => f.endsWith('.js'))
    .map((f) => join(ROOT, 'js', f))
  return [...css, ...js]
}

describe('the --sfds-* namespace', () => {
  test('is used by no file outside css/sfds.css and its migrated consumers', () => {
    const offenders = tokenBearingFiles()
      .filter((path) => !path.endsWith('css/sfds.css'))
      .filter((path) => !MIGRATED_CONSUMERS.some((rel) => path.endsWith(rel)))
      .filter((path) => readFileSync(path, 'utf8').includes('--sfds-'))
      .map((path) => path.slice(ROOT.length + 1))
    expect(offenders).toEqual([])
  })
})

/**
 * Parse the custom properties declared in one CSS block.
 *
 * @param {string} block Raw CSS text.
 * @returns {Record<string, string>} Token name (with dashes) to value.
 */
function parseTokens(block) {
  const out = {}
  for (const match of block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    out[match[1]] = match[2].trim()
  }
  return out
}

const source = readFileSync(join(ROOT, 'css/sfds.css'), 'utf8')
const capture = JSON.parse(readFileSync(join(ROOT, 'docs/source/sfds/tokens.json'), 'utf8'))
const desktopBlock = source.slice(source.indexOf('@media (min-width: 768px)'))
const baseBlock = source.slice(0, source.indexOf('@media (min-width: 768px)'))

describe('css/sfds.css against the vendored capture', () => {
  test('declares every base token at the captured value', () => {
    expect(parseTokens(baseBlock)).toEqual(capture.base)
  })

  test('redeclares every desktop token at the captured value', () => {
    expect(parseTokens(desktopBlock)).toEqual(capture.desktop)
  })
})
