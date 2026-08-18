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
 * references in the tree today, across 1,371 matches in 308 files — the
 * fourth (`js/interactive-sitemap-render.js`) is this test file's own
 * self-reference, see its comment below, and only exists because the
 * original 307-file, three-entry count was necessarily taken before this
 * file joined the tree it now scans.
 */
const EXEMPT = new Set([
  // Described in the past tense in AGENTS.md, CLAUDE.md, docs/codebase/
  // CONCERNS.md, js/app.js, js/mockup/page-render.js and one e2e spec, as a module
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

/**
 * Every tracked file that could mention a js/ path.
 *
 * **`.css` belongs in this list.** This repo's stylesheets carry substantial
 * explanatory comments — see CLAUDE.md's "CSS" section on the required
 * boxed-banner voice — and those comments routinely name the specific JS
 * module a rule exists to serve (a token a script reads, a class a handler
 * toggles, a selector a sibling subsystem depends on). A path named in a CSS
 * comment rots exactly like a path named in a JS comment or a markdown
 * document: nothing enforces it, so a moved file leaves a confidently wrong
 * sentence behind. Omitting `.css` here let two such references go stale
 * across a two-task file-structure migration and pass this gate anyway — the
 * review-state-sync and ai-assist-render modules, moved into js/sync/ and
 * js/ai/ respectively (commits d2e561d and 5fdf758), were still named by
 * their pre-move bare paths in css/styles.css's comments. (Written here
 * without a leading `js/` on purpose, so this very sentence does not become
 * another match for the pattern it is describing.) A gate that under-scans
 * its own domain is the same defect this test exists to catch, just one
 * level up.
 */
function trackedFiles() {
  const out = spawnSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
  if (out.status !== 0) throw new Error('git ls-files failed: ' + out.stderr)
  return out.stdout
    .split('\n')
    .filter(Boolean)
    .filter((f) => /\.(js|jsx|ts|md|json|html|css)$/.test(f))
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
    // 1,371 matched at the time this was written (including this file's own
    // matches, once tracked). The floor is deliberately far below that — it
    // is a guard against a regex that stopped matching, not an assertion
    // about the count, which legitimately moves.
    expect(found).toBeGreaterThan(1000)
  })

  /**
   * A `js/` path that WRAPS across a line break is invisible to both tests
   * above, and for the same reason: `\bjs\/[a-z0-9/-]+\.jsx?\b` is matched
   * against one line's text at a time (a wrapped comment splits the path
   * into `js/inline-content-edit-` on one line and `data.js` on the next),
   * so the pattern never sees the two halves as one string and never
   * matches either fragment. A path in that shape resolves for a human
   * reader — prose reads across the line break fine — but is silent to
   * both the "resolves on disk" test and the "found enough references"
   * floor, which is exactly backwards: the file it names moved and the
   * gate that exists to catch that has nothing to look at.
   *
   * Not hypothetical: `js/editing/`'s move (task 5 of the file-structure
   * migration) left SEVEN of these behind, across five files, including two
   * lines in this file's own sibling e2e spec
   * (`tests/e2e/inline-content-edit.spec.js`). Every one of the seven broke
   * at a hyphen — `js/inline-content-edit-` before `data.js`,
   * `js/inline-content-edit-link-` before `tool.js`, `js/inline-` before
   * `content-edit....` — because a hyphen is where a prose reflow (by hand
   * or by a formatter) prefers to break a long hyphenated identifier, the
   * same way it would break any other compound word. None were caught by
   * the "resolves on disk" test, which is what motivates a THIRD, narrower
   * check rather than trusting the first two to eventually cover this: a
   * per-line pattern needs a per-line guard against the one shape it
   * structurally cannot see.
   *
   * The pattern matches a `js/` path fragment ending in a hyphen, sitting
   * at the end of a line with only trailing whitespace after it — a
   * trailing hyphen because that is the shape every real wrap in this repo
   * takes (see above), and end-of-line because a comment continuation
   * marker like `*` or `//` opens the NEXT line, so the broken half is
   * always the last non-whitespace text on its own line.
   *
   * **The character class allows an internal `/`, not just letters/digits/
   * hyphens.** A narrower first draft — matching only a single path segment
   * after `js/` — passed against this file's own dry run (all seven
   * originals were single-segment, e.g. `js/inline-content-edit-`) but
   * verifiably failed to catch a wrap re-tested against the FIXED text:
   * once a reference reads `js/editing/inline-content-edit.js` and wraps at
   * its usual hyphen, the dangling fragment is `js/editing/inline-`, which
   * contains a second `/` a single-segment class cannot see past. Six more
   * move tasks follow this one, each landing files a directory deeper than
   * the flat tree the narrower pattern was validated against — a class that
   * cannot see its own fix location is worse than no guard, since it would
   * report clean on exactly the shape it exists to catch going forward.
   */
  test('no js/ path fragment is left dangling at a line break', () => {
    const dangling = []
    const re = /js\/[a-z0-9][a-z0-9/-]*-\s*$/
    for (const file of trackedFiles()) {
      const abs = path.join(root, file)
      if (!existsSync(abs)) continue
      const lines = fs.readFileSync(abs, 'utf8').split('\n')
      lines.forEach((line, i) => {
        const match = line.match(re)
        if (match) dangling.push(`${file}:${i + 1}: "${match[0].trimEnd()}"`)
      })
    }
    expect(dangling).toEqual([])
  })
})
