/**
 * Runs lychee over the markdown this repo authors, checking that every link
 * actually resolves.
 *
 * **This checks documentation, never mockup content.** The mockup's own links
 * are page keys, and `bun run validate` already proves every `card.target`,
 * `buttonTarget` and inline `[label](pageKey)` resolves — offline, which is the
 * only way it could work in a tool that has to run air-gapped. Nothing this
 * script touches is on a path a reviewer clicks.
 *
 * **The local half is the half that pays.** Of the 48 links, 32 are `file://` —
 * cross-file anchors between `AGENTS.md`, `CLAUDE.md` and
 * `.github/copilot-instructions.md`. Nothing else checks those: markdownlint's
 * MD051 validates a fragment against the file it sits IN, so
 * `AGENTS.md#review-state-sync-backend-optional` cited from elsewhere is
 * unchecked by every other tool here, and cross-file anchors between the three
 * mirrored instruction docs are exactly where drift shows up. The first run
 * proved it: `CLAUDE.md`'s `#local-persistence` had died because its heading
 * grew a parenthetical while `AGENTS.md`'s did not.
 *
 * **The external half is 16 links and a documentation-hygiene concern, not a
 * shipping one.** `findBrokenInlineLinks` in `build_scripts/data-checks.js`
 * validates the SHAPE of an `http(s)` URL and never whether it answers, so a
 * dead citation in `docs/karl-export-field-map.md` reads exactly like a live
 * one — worth catching, and it caught three on its first run, where
 * `docs/sfgov-live-design-inspiration.md` cites one live SF.gov page per content
 * type as the "Real SF.gov Exemplar" and three of the eight 404'd. Note the
 * coverage gap recorded in `.github/workflows/link-check.yml`: sf.gov answered a
 * known-404 path as OK from a GitHub runner, so **running this LOCALLY is what
 * verifies an sf.gov citation**, not the weekly schedule.
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
