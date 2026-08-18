/**
 * Every `js/<something>.js` path this repo mentions must exist on disk.
 *
 * **Why this exists.** Path references live in three places and only one of
 * them fails when it goes wrong. An `import` breaks the build. A
 * `require('../js/utils.js')` throws. But a path named in a COMMENT or in a
 * markdown document is read by people and checked by nothing, so a moved file
 * leaves behind a sentence that confidently points at nowhere. That is worse
 * than no comment: a reader trusts it and loses the time.
 *
 * The check is deliberately dumb — it finds path-shaped strings and asks
 * whether the file is there. It cannot tell a real reference from an example,
 * which is why EXEMPT below exists and why each entry states its reason.
 */
import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'

const root = path.resolve(import.meta.dir, '..')

/**
 * Trees this repo holds but whose path references are not ours to keep current,
 * matched as path prefixes. This is the same set `build_scripts/docs-file-set.js`
 * and `.prettierignore` already exclude, and for the same reason.
 *
 * **`docs/superpowers/` is the one that matters here.** Those are RECORDS of
 * past work — a 2026-07-07 plan naming `js/interactive-sitemap-render.js` is
 * correct, because that file existed on that date. Scanning them found 148
 * additional "broken" references, every one of them a historical document
 * accurately describing a tree that has since changed. Rewriting a record to
 * match the present is how a record stops being one.
 */
const SKIP =
  /^(\.agents|tools\/oxlint|archive|forms|node_modules|docs\/superpowers|docs\/source|review|\.playwright-mcp)\//

/**
 * Path-shaped strings that are deliberately not real files.
 *
 * Measured, not guessed: with SKIP applied, these four are the ONLY broken
 * references in the tree today, across 1,370 matches in 308 files — the
 * fourth (`js/interactive-sitemap-render.js`) is this test file's own
 * self-reference, see its comment below, and only exists because the
 * original 307-file, three-entry count was necessarily taken before this
 * file joined the tree it now scans.
 */
const EXEMPT = new Set([
  // Described in the past tense in AGENTS.md, CLAUDE.md, docs/codebase/
  // CONCERNS.md, js/app.js, js/page-render.js and one e2e spec, as a module
  // that was REMOVED. Each sentence is correct precisely because the file is
  // gone, so making the path resolve would make the prose wrong.
  'js/interactive-sitemap.js',
  // Quoted, also in the past tense, two comment blocks above — the worked
  // example of why docs/superpowers/ is SKIPped rather than kept current.
  // This test file is itself a tracked .js file the scan reads, so its own
  // illustrative mention of a deleted module needs the same exemption every
  // other past-tense mention of one gets here. The original census (1,362
  // matches, three broken paths) necessarily predates this file's own
  // existence, so it could not have counted a reference this file makes to
  // itself; staging this file and re-running the test is what surfaced it.
  'js/interactive-sitemap-render.js',
  // Generic two-file examples in a skill's prose, never real paths.
  'js/a.js',
  'js/b.js',
])

/** Every tracked file that could mention a js/ path. */
function trackedFiles() {
  const out = spawnSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
  if (out.status !== 0) throw new Error('git ls-files failed: ' + out.stderr)
  return out.stdout
    .split('\n')
    .filter(Boolean)
    .filter((f) => /\.(js|jsx|ts|md|json|html)$/.test(f))
    .filter((f) => !SKIP.test(f))
}

describe('js/ path references', () => {
  test('every js/ path mentioned in a tracked file exists on disk', () => {
    const broken = []
    for (const file of trackedFiles()) {
      const abs = path.join(root, file)
      if (!existsSync(abs)) continue
      const source = fs.readFileSync(abs, 'utf8')
      for (const match of source.matchAll(/\bjs\/[a-z0-9/-]+\.jsx?\b/g)) {
        const ref = match[0]
        if (EXEMPT.has(ref)) continue
        if (!existsSync(path.join(root, ref))) broken.push(`${file}: ${ref}`)
      }
    }
    expect(broken).toEqual([])
  })

  test('finds at least one reference, so a broken scan cannot pass silently', () => {
    let found = 0
    for (const file of trackedFiles()) {
      const abs = path.join(root, file)
      if (!existsSync(abs)) continue
      found += [...fs.readFileSync(abs, 'utf8').matchAll(/\bjs\/[a-z0-9/-]+\.jsx?\b/g)].length
    }
    // 1,370 matched at the time this was written (including this file's own
    // matches, once tracked). The floor is deliberately far below that — it
    // is a guard against a regex that stopped matching, not an assertion
    // about the count, which legitimately moves.
    expect(found).toBeGreaterThan(1000)
  })
})
