/**
 * Every `js/<something>.js` path this repo mentions must exist on disk.
 *
 * **Why this exists.** Path references live in three places and only one of
 * them fails when it goes wrong. An `import` breaks the build. A
 * `require('../js/core/utils.js')` throws. But a path named in a COMMENT or in a
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
 *
 * **The exemption is GLOBAL, not per-site.** This is a plain `Set` keyed on
 * the path string alone, and the "every js/ path mentioned in a tracked file
 * exists on disk" test below only ever asks `EXEMPT.has(ref)` — it carries no
 * memory of which file or line each entry was written for. Adding
 * `'js/interactive-sitemap.js'` here to cover its six known past-tense
 * mentions also silences a future, unrelated, genuinely broken reference to
 * that exact string anywhere else in the tree — a new doc that typos a path
 * into this one, say. That is inherent to a Set-of-strings design, not a bug
 * to fix: the alternative (keying on file+line, or re-deriving the mention
 * count on every run) is real complexity this test does not need for four
 * entries. It does mean the choice between "add an EXEMPT entry" and "reword
 * the comment so the path doesn't appear at all" is not neutral — an entry
 * here is a standing exemption for that string everywhere, forever, while a
 * reworded comment (see `js/core/third-party-globals.js`'s fix below, in the
 * dangling-line test's own comment) closes the specific case with no lasting
 * width. Prefer rewording when the string can be avoided; reach for EXEMPT
 * only when it can't, same as the four entries below already do. Also note
 * this Set is consulted by exactly one test — the dangling-line-break check
 * two tests down never reads it, so a wrap that happens to end in an EXEMPT
 * string still fails there; see that test's own comment.
 */
const EXEMPT = new Set([
  // Described in the past tense in AGENTS.md, CLAUDE.md, docs/codebase/
  // CONCERNS.md, js/core/app.js, js/mockup/page-render.js and one e2e spec, as a module
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
 *
 * **`.cjs` and `.mjs` belong in this list too, added during task 8.**
 * `.dependency-cruiser.cjs` holds nine `js/…` path references — regex
 * alternations naming the pinned base modules' current locations — and that
 * file is edited by this task and by each of the two tasks that follow it,
 * since every task moving a pinned base module has to touch the same
 * alternation. Before this fix a `.cjs` config file naming a real `js/` path
 * was invisible to `trackedFiles()`'s extension filter, so a task that moved
 * a pinned module but forgot (or mis-edited) the regex would leave a stale
 * path sitting in committed config with nothing here to catch it — the exact
 * failure mode this test exists to close for every other file type. `.mjs`
 * is added for the same reason even though nothing under that extension is
 * tracked today (`/tmp/hhvc-retarget.mjs` is a throwaway, never committed,
 * per its own header) — a future `.mjs` build script naming a `js/` path
 * should not have to rediscover this gap.
 *
 * **`.yml`, `.yaml`, `.toml` and `.jsonc` belong in this list too, added
 * during the final whole-branch review of this migration.** `ci.yml`'s
 * dependency-cruiser step comment, `bunfig.toml`'s preload-order rationale,
 * and `knip.jsonc`'s ignore-list rationale each named the page-data, state
 * and page-registry core modules by their pre-move bare paths after this
 * migration relocated them under `js/core/`, and none of it was visible to
 * `trackedFiles()`'s extension filter — `.yml`/`.toml`/`.jsonc` were as
 * unscanned as `.cjs` was before task 8 closed that exact gap, one file
 * extension later. `.github/workflows/ci.yml` and `.github/workflows/link-check.yml`
 * match `.yml`; `bunfig.toml` and `netlify.toml` match `.toml`; `knip.jsonc`
 * and `.markdownlint-cli2.jsonc` match `.jsonc`; `.codex/config.toml` and its
 * sibling agent `.toml` files now scan too, though re-deriving rather than
 * trusting the finding that motivated this fix turned up no stale path
 * inside any of them.
 *
 * **`.gitignore` is scanned by exact basename, not by extension**, since it
 * has none for the regex above to test — and it earned the special case for
 * the same reason as the three config files above: its Karl-transcript
 * comment named the karl-blocks module by its pre-move bare path after that
 * module's own move into a new `js/karl/` folder. Widening the extension
 * test itself to accept any bare dotfile would also pull in every other
 * extensionless file this repo tracks — `.nvmrc`, `.bun-version`,
 * `.windsurfrules`, several `.claude/skills/<name>` entries with no
 * extension of their own — and checking each of those by hand found none
 * holding a `js/` path reference, so that width would cost real scan volume
 * for zero caught defects today. `SCAN_BASENAMES` below names `.gitignore`
 * explicitly instead, so a future extensionless file that does need scanning
 * is one entry away rather than a second regex to get wrong.
 */
const SCAN_BASENAMES = new Set(['.gitignore'])

function trackedFiles() {
  const out = spawnSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
  if (out.status !== 0) throw new Error('git ls-files failed: ' + out.stderr)
  return out.stdout
    .split('\n')
    .filter(Boolean)
    .filter(
      (f) =>
        /\.(js|jsx|ts|cjs|mjs|md|json|jsonc|html|css|yml|yaml|toml)$/.test(f) ||
        SCAN_BASENAMES.has(path.basename(f))
    )
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
   *
   * **The terminal character class allows a trailing `/` as well as a
   * trailing `-`, added during the final whole-branch review.** Every path
   * this repo names now carries a folder segment, so a reflow can just as
   * easily break right after the slash — `js/review/` at the end of one
   * line, `review-queue.js` opening the next — as after a hyphen inside a
   * name, and the hyphen-only class was blind to that shape by construction.
   * There is no live instance of it today; this is prevention, the same
   * posture task 8 took adding `.cjs`/`.mjs` ahead of any file needing them.
   * Widening the class makes a COMPLETE past-tense reference read as a
   * dangling one if the reference itself ends a line in `/` with nothing
   * else following — `js/core/third-party-globals.js` said exactly that
   * about the deleted `js/vendor/` directory, and reflowing it (not adding
   * an EXEMPT entry, which this test never consults — see EXEMPT's own
   * comment) is the fix, because EXEMPT is a `Set` keyed on the path
   * strings the LITERAL test's for-loop tests membership against; this
   * test's for-loop never reads it.
   */
  test('no js/ path fragment is left dangling at a line break', () => {
    const dangling = []
    const re = /js\/[a-z0-9][a-z0-9/-]*[-/]\s*$/
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

  /**
   * A `js/<prefix>*` GLOB reference is invisible to every test above, and for
   * a different reason than the dangling-line case. Those three tests' shared
   * pattern is `[a-z0-9/-]+` — a character class with no `*` in it — so a
   * glob string never matches at all: the scan simply does not see it,
   * matched or broken. A literal path breaks loudly (the "resolves on disk"
   * test fails); a glob breaks silently, because nothing upstream of this
   * test was ever looking at it.
   *
   * (This paragraph deliberately never spells out `js/` immediately followed
   * by a hyphenated name and a bare `*.js` — every such string below is this
   * test's OWN broken-glob shape, and writing one here would make this
   * comment a fixture for the assertion beneath it.)
   *
   * **This repo had eight distinct stale glob families, not the seven this
   * task's own plan predicted.** The plan's table (written mid-migration, one
   * task before this one) named seven — the `ai-assist`, `ai-rewrite`,
   * `inline-content-edit`, `review-insights`, `review-ops` and `review-queue`
   * families (plus a malformed trailing-dot copy of the inline-content-edit
   * one) — and estimated 23 locations. Re-deriving rather than trusting that
   * restatement (the same discipline this repo's own docs insist on
   * elsewhere) found two more, `page-registry` and `ux-improvements`, sitting
   * in files the plan's own reference table didn't name
   * (`.claude/skills/hhvc-page-registry/SKILL.md`,
   * `tests/e2e/page-registry.spec.js`), and a true count of 40 locations
   * across those eight families. All eight were stale for the same reason:
   * every file a family glob used to match sat directly in `js/` before this
   * migration, and none of them do now — the flat directory the glob was
   * written against is gone.
   *
   * **Expansion is directory-scoped, not recursive, and that is deliberate.**
   * A real shell glob's `*` cannot cross a `/`, so a bare `js/<name>*.js`
   * pattern only ever meant "files starting with `<name>` sitting directly in
   * `js/`" — never "anywhere under `js/`". Expanding it any other way would
   * make every one of the eight stale families above pass by accident: the
   * files still exist somewhere under `js/`, just nested one level deeper
   * now, and a recursive search would find them there without the prose ever
   * being corrected to say where. The fix this task applies is exactly that
   * correction — folding the destination folder into the pattern itself, e.g.
   * `js/review/review-queue*.js` in place of the old bare form — so the glob
   * keeps meaning "this family of files," now rooted where the family
   * actually lives.
   */
  test('every js/<prefix>* glob pattern expands to at least one real file', () => {
    const broken = []
    const re = /\bjs\/[a-z0-9/-]+\*\.jsx?\b/g
    for (const file of trackedFiles()) {
      const abs = path.join(root, file)
      if (!existsSync(abs)) continue
      const source = fs.readFileSync(abs, 'utf8')
      for (const match of source.matchAll(re)) {
        const ref = match[0]
        const starIndex = ref.indexOf('*')
        const dirEnd = ref.lastIndexOf('/', starIndex)
        const dir = ref.slice(0, dirEnd)
        const prefix = ref.slice(dirEnd + 1, starIndex)
        const suffix = ref.slice(starIndex + 1) // ".js" or ".jsx"
        const dirAbs = path.join(root, dir)
        const matched =
          existsSync(dirAbs) &&
          fs.readdirSync(dirAbs).some((name) => name.startsWith(prefix) && name.endsWith(suffix))
        if (!matched) broken.push(`${file}: ${ref}`)
      }
    }
    expect(broken).toEqual([])
  })
})
