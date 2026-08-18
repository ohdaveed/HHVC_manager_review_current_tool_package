/**
 * Runs lychee over the markdown this repo authors, checking that every link
 * actually resolves.
 *
 * **Why this is not `findBrokenInlineLinks`.** That check, in
 * `build_scripts/data-checks.js`, validates internal page keys and the SHAPE of
 * an `http(s)` URL. It has never asked whether a URL answers. The docs cite live
 * sf.gov pages, the Karl Help Center and the municipal code by URL, and
 * `docs/karl-export-field-map.md`'s whole authority rests on those citations
 * resolving — a dead citation is a claim with nothing behind it, which reads
 * exactly like a live one.
 *
 * The first run found three: `docs/sfgov-live-design-inspiration.md` cites one
 * live SF.gov page per content type as the "Real SF.gov Exemplar", and three of
 * the eight 404'd.
 *
 * **Local file links and their fragments are checked too**, which is the half
 * markdownlint cannot do. MD051 validates a fragment against the file it sits
 * in; it says nothing about `AGENTS.md#review-state-sync-backend-optional` cited
 * from somewhere else. Cross-file anchors between the three mirrored instruction
 * docs are precisely where drift shows up.
 *
 * **Scheduled, never per-PR.** A third-party outage is not a reason a merge
 * cannot happen, and a link checker wired into `checks` would make sf.gov's
 * uptime a condition of shipping. `.github/workflows/link-check.yml` runs it
 * weekly and opens an issue on failure, because a scheduled workflow nobody
 * watches is the same defect as a gate that cannot fire.
 *
 * Expects `lychee` on PATH. The workflow installs a pinned release; locally,
 * install it however you like — this script is a convenience over the tool, not
 * a wrapper that owns its version.
 *
 * CommonJS like everything else under `build_scripts/`. See AGENTS.md's CI section.
 */

const { spawnSync } = require('node:child_process')

const { ourMarkdownFiles } = require('./docs-file-set.js')

const files = ourMarkdownFiles()

// Same guard as lint-docs.js, and for the same reason: lychee exits 0 when it is
// handed nothing, so an empty derivation would report a clean sweep of no files.
if (files.length === 0) {
  console.error('check-links: no markdown files matched — the derivation is broken, not the docs.')
  process.exit(1)
}

const result = spawnSync(
  'lychee',
  [
    // Fragments are the point on the local half — see the header.
    '--include-fragments',
    // The workflow's log is the artifact; a progress spinner in it is noise.
    '--no-progress',
    // Politeness toward the public sites being checked, not a performance knob.
    '--max-concurrency',
    '4',
    ...files,
  ],
  { stdio: 'inherit' }
)

if (result.error) {
  console.error(`check-links: could not run lychee (${result.error.message}).`)
  console.error('Install it from https://github.com/lycheeverse/lychee, or run the workflow.')
  process.exit(1)
}

process.exit(result.status ?? 1)
