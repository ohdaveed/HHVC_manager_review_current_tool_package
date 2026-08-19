/**
 * The one definition of "markdown this repo authors".
 *
 * Two tools need this list — `build_scripts/lint-docs.js` (markdownlint) and
 * `build_scripts/check-links.js` (lychee) — and a second copy of it would be
 * free to drift from the first. That is the same argument `js/review/review-merge.js`
 * and `js/core/card-inheritance.js` make for being dual-exported rather than
 * reimplemented: two callers, one answer.
 *
 * **The list is derived, never written down.** The first version of the
 * markdownlint change hand-wrote five globs. They named 33 files;
 * `git ls-files '*.md'` finds 70 tracked, so the list was missing more than half
 * the repo — every file under `docs/codebase/`, and every skill directory not
 * named `hhvc-*`. A glob that stops matching does not fail. It stops checking,
 * and reports success while doing it.
 *
 * **`git ls-files` rather than a filesystem walk**, for two structural reasons:
 *
 * - Most entries under `.claude/skills/` are SYMLINKS into `.agents/skills/`.
 *   A filesystem glob follows them, so the same vendored file is inspected twice
 *   under two paths, and excluding `.agents/**` does not stop it. Git records the
 *   symlink itself and never its target, so each real file appears once.
 * - A walk sweeps whatever happens to be sitting in the working tree. Pointed at
 *   this repo it found 1,575 markdown files and reported ~52,000 problems,
 *   nearly all of them in `.netlify/plugins/node_modules` and other vendored
 *   READMEs. Tracked-ness is the property that actually distinguishes "ours"
 *   from "something that landed here".
 *
 * CommonJS like everything else under `build_scripts/`: `server.ts`
 * named-imports several of these modules from TypeScript, and Bun 1.3.14 stopped
 * letting CJS `require()` an ESM module. See AGENTS.md's CI section.
 */

const { spawnSync } = require('node:child_process')

/**
 * Trees this repo holds but does not author, so their markdown is not ours to
 * check. Each entry is matched as a path prefix against `git ls-files` output.
 *
 * **This is an exclusion list on purpose, and the direction matters.** A new
 * document anywhere in the repo is checked by default; a newly vendored tree
 * shows up as noise until someone excludes it. That is the correct way round —
 * a gap announces itself, rather than a new doc quietly falling outside a list
 * of includes nobody remembers to extend.
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
 * Throws rather than returning an empty array when git fails, and callers must
 * treat an empty result as a broken derivation rather than a clean sweep — both
 * markdownlint-cli2 and lychee exit 0 when handed no inputs, which is
 * indistinguishable from a clean run.
 *
 * @returns {string[]} repo-relative paths, in the order git lists them
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

module.exports = { NOT_OURS, ourMarkdownFiles }
