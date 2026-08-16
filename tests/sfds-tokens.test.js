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
   values against `docs/source/sfds/tokens.json` — is the second describe
   block below. (An earlier version of this header said it "lands with Task 3";
   it landed, and the sentence did not move. Corrected 2026-08-15.)

   The file scan is RECURSIVE, and that is not a detail. It walked `js/` with a
   flat `readdirSync` until 2026-08-15, and `js/react/theme.js` — the ONLY file
   under `js/` that reads `--sfds-*` at all — sits one directory down, so the
   guard could not see the single file it most needed to. A namespace guard
   with a blind spot over the newest code is worse than none: it reports green
   about a directory it never opened. Hence `expect(files.length)` below as
   well, so a walk that silently finds nothing fails loudly.

   Load-order dependency: none. It reads files off disk and parses text. */

import { describe, test, expect } from 'bun:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..')

/** Files that have migrated onto `--sfds-*` and may legitimately consume it,
 * beyond `css/sfds.css` itself (which declares the namespace). Task 6 added
 * `css/theme.css` and `css/styles.css`; every other stylesheet still reads
 * `--legacy-*` and is not yet on this list.
 *
 * `js/react/theme.js` is here because it is the ONE bridge between the design
 * tokens and MUI — it reads them off `document.documentElement` at theme-build
 * time so retheming still means editing `css/theme.css` only (see AGENTS.md,
 * "React islands in the workspace"). It has read `--sfds-*` since the chrome
 * scale was mapped into the theme; it was invisible to this guard until the
 * scan became recursive, so listing it now records a consumer that already
 * existed rather than permitting a new one. */
const MIGRATED_CONSUMERS = ['css/theme.css', 'css/styles.css', 'js/react/theme.js']

/**
 * Every file in the repo that may legitimately mention a design token.
 *
 * Recurses, because the offender this guard exists to catch can be added in a
 * subdirectory as easily as a top-level one — and one already had been.
 *
 * @param {string} dir Absolute directory to walk.
 * @param {RegExp} extension Which files count.
 * @returns {string[]} Absolute paths.
 */
function filesUnder(dir, extension) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return filesUnder(path, extension)
    return extension.test(entry.name) ? [path] : []
  })
}

function tokenBearingFiles() {
  return [...filesUnder(join(ROOT, 'css'), /\.css$/), ...filesUnder(join(ROOT, 'js'), /\.jsx?$/)]
}

describe('the --sfds-* namespace', () => {
  test('is used by no file outside css/sfds.css and its migrated consumers', () => {
    const scanned = tokenBearingFiles()
    // A walk that finds nothing would make the assertion below pass while
    // checking nothing at all — the failure mode this guard just had.
    expect(scanned.length).toBeGreaterThan(0)

    const offenders = scanned
      .filter((path) => !path.endsWith('css/sfds.css'))
      .filter((path) => !MIGRATED_CONSUMERS.some((rel) => path.endsWith(rel)))
      .filter((path) => readFileSync(path, 'utf8').includes('--sfds-'))
      .map((path) => path.slice(ROOT.length + 1))
    expect(offenders).toEqual([])
  })

  test('reaches the subdirectories a flat scan would miss', () => {
    // Names the specific file the flat scan skipped, so a future refactor that
    // reintroduces a non-recursive walk fails here rather than going quiet.
    const scanned = tokenBearingFiles().map((path) => path.slice(ROOT.length + 1))
    expect(scanned).toContain('js/react/theme.js')
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
