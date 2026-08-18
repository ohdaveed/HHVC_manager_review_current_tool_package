/**
 * Runs markdownlint-cli2 over the markdown this repo authors.
 *
 * The file list is derived rather than globbed, and `build_scripts/docs-file-set.js`
 * holds that derivation plus the reasoning for it — it is shared with
 * `build_scripts/check-links.js` so the two docs tools cannot come to disagree
 * about which files are ours.
 *
 * Rules live in `.markdownlint-cli2.jsonc`, which carries no file list of its own
 * for the same reason: a `globs` key there would be a second, competing answer to
 * the question this script exists to answer.
 *
 * CommonJS like everything else under `build_scripts/`. See AGENTS.md's CI section.
 */

const { spawnSync } = require('node:child_process')
const { dirname, resolve } = require('node:path')

const { ourMarkdownFiles } = require('./docs-file-set.js')

const files = ourMarkdownFiles()

// A zero-length file list is the failure this script exists to prevent:
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
//
// The bin path is read out of the package rather than written down, since the
// package declares it and a second copy here would be free to go stale.
const manifestPath = require.resolve('markdownlint-cli2/package.json')
const binary = resolve(dirname(manifestPath), require(manifestPath).bin['markdownlint-cli2'])

const result = spawnSync(process.execPath, [binary, ...files], { stdio: 'inherit' })
process.exit(result.status ?? 1)
