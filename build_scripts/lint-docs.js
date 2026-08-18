/**
 * Runs markdownlint-cli2 over the markdown this repo actually authors.
 *
 * **Why a script rather than a `globs` key.** markdownlint-cli2 takes globs, and
 * the first version of this change wrote five of them by hand. That list named
 * 33 files; `git ls-files '*.md'` finds 70 tracked, so it was missing more than
 * half the repo — every file under `docs/codebase/`, and every skill whose
 * directory is not named `hhvc-*`. A glob that stops matching does not fail. It
 * stops checking, and reports success while doing it. This repo has been bitten
 * by that shape three times in one week: a dependency-cruiser rule whose
 * `exclude` deleted the modules it was meant to inspect, an oxlint probe masked
 * by a second rule firing on the same line, and a doc-parsing regex that
 * silently matched zero rows.
 *
 * **Why `git ls-files` specifically, and not a filesystem walk.** Two reasons,
 * both structural rather than stylistic:
 *
 * - Most entries under `.claude/skills/` are SYMLINKS into `.agents/skills/`.
 *   A filesystem glob follows them, so the same vendored file gets linted twice
 *   under two different paths, and excluding `.agents/**` does not stop it. Git
 *   records the symlink itself and never its target, so the derived set contains
 *   each real file once.
 * - A filesystem walk sweeps whatever happens to be sitting in the working tree.
 *   Pointed at this repo it found 1,575 markdown files and reported ~52,000
 *   problems, nearly all of them in `.netlify/plugins/node_modules` and other
 *   vendored READMEs. Tracked-ness is the property that actually distinguishes
 *   "ours" from "something that landed here".
 *
 * **`NOT_OURS` is an exclusion list on purpose, and the direction matters.** A
 * new document anywhere in the repo is linted by default; a newly vendored tree
 * shows up as noise until someone excludes it. That is the correct way round —
 * a gap announces itself, rather than a new doc quietly falling outside a list
 * of includes nobody remembers to extend.
 *
 * CommonJS like everything else under `build_scripts/`: `server.ts`
 * named-imports several of these modules from TypeScript, and Bun 1.3.14 stopped
 * letting CJS `require()` an ESM module. See AGENTS.md's CI section.
 */

const { spawnSync } = require('node:child_process')
const { dirname, resolve } = require('node:path')

/**
 * Trees this repo holds but does not author, so their markdown is not ours to
 * lint. Each entry is matched as a path prefix against `git ls-files` output.
 *
 * `docs/source/`, `docs/superpowers/`, `review/` and `.playwright-mcp/` are the
 * same set `.prettierignore` already excludes, and for the same reason: they are
 * reference, planning and output rather than source. The rest are vendored or
 * converted:
 *
 * - `hhvc_chapter_drafts/` is the HHVC Web Governance and Content Standards
 *   Manual, converted chapter by chapter from the source document. Reformatting
 *   it would weaken the fidelity that makes it quotable as the standard.
 * - `.agents/` is the vendored multi-harness skill set (and the target of most
 *   of `.claude/skills/`'s symlinks).
 * - `tools/oxlint/` is a byte-identical copy of an upstream plugin, kept that
 *   way so a re-install is a clean diff — the same argument `.prettierignore`
 *   makes for it at greater length.
 */
const NOT_OURS = [
  '.agents/',
  '.playwright-mcp/',
  'archive/',
  'docs/source/',
  'docs/superpowers/',
  'forms/',
  'hhvc_chapter_drafts/',
  'notebooklm/',
  'review/',
  'tools/oxlint/',
]

/**
 * Every tracked markdown file this repo authors.
 *
 * @returns {string[]} repo-relative paths, sorted as git lists them
 */
function ourMarkdownFiles() {
  const listed = spawnSync('git', ['ls-files', '-z', '*.md'], { encoding: 'utf8' })
  if (listed.status !== 0) {
    throw new Error(`git ls-files failed: ${listed.stderr || listed.status}`)
  }
  return listed.stdout
    .split('\0')
    .filter(Boolean)
    .filter((file) => !NOT_OURS.some((prefix) => file.startsWith(prefix)))
}

const files = ourMarkdownFiles()

// A zero-length file list is the failure this whole script exists to prevent:
// markdownlint-cli2 exits 0 on "no files matched", which is indistinguishable
// from a clean run. Fail loudly instead, the way tests/karl-blocks.test.js
// asserts a minimum row count before it asserts anything about the rows.
if (files.length === 0) {
  console.error('lint-docs: no markdown files matched — the derivation is broken, not the docs.')
  process.exit(1)
}

// Resolved rather than spawned by bare name. `bun run` puts `node_modules/.bin`
// on PATH and a direct `bun build_scripts/lint-docs.js` does not, so a bare name
// works through the package script and fails — silently, with exit 1 and no
// output — when the file is run the obvious way while debugging it.
// The bin path is read out of the package rather than written down, since the
// package declares it and a second copy here would be free to go stale.
const manifestPath = require.resolve('markdownlint-cli2/package.json')
const binary = resolve(dirname(manifestPath), require(manifestPath).bin['markdownlint-cli2'])

const result = spawnSync(process.execPath, [binary, ...files], { stdio: 'inherit' })
process.exit(result.status ?? 1)
