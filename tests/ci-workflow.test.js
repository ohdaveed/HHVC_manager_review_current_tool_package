/* Pins the CI workflow against the safety properties the instruction docs
   promise on its behalf.

   Role: `.github/workflows/ci.yml` is prose to every reader and configuration
   to exactly one consumer, so a claim about it in AGENTS.md is unverified by
   default. This file closes the specific gap that motivated it: AGENTS.md said
   "Both jobs pin Bun from `.bun-version`, and that pin is load-bearing," and
   described CI as having taken `bun-version: latest` only "until 2026-08-15" —
   while both jobs were still on `latest`, with `.bun-version` sitting unread on
   disk. A prior session recorded the same mismatch on 2026-08-08 and it
   survived. The documentation was not lying so much as unchecked, which is the
   same thing over a long enough interval.

   Why the pin matters, from AGENTS.md's own account: taking `latest` meant the
   runtime changed under the repo with no commit, and Bun 1.3.14's dropping of
   `require()` on an async ESM module made `server.ts` throw at boot, so every
   suite that spawns it reported "did not start in time" — intermittently,
   depending on what `latest` resolved to at that moment.

   Deliberately narrow. This is not a general "assert the whole workflow"
   test, which would fail on every legitimate edit and teach people to update
   it without reading. It checks the two properties a doc currently asserts:
   that every Bun setup step reads the version file, and that the file exists
   with a concrete version in it.

   Load-order dependency: none. It reads two files off disk and parses text. */

import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..')
const WORKFLOW = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8')

/** Every `oven-sh/setup-bun` step's `with:` block, one string per occurrence. */
function setupBunBlocks() {
  return WORKFLOW.split(/uses:\s*oven-sh\/setup-bun/)
    .slice(1)
    .map((rest) => rest.split(/\n\s*-\s/)[0])
}

describe('the CI workflow', () => {
  test('sets up Bun in more than one job', () => {
    // The vacuous-pass guard. Rename the action or restructure the file and
    // the assertions below would otherwise scan nothing and pass silently —
    // the failure mode `tests/doc-counts.test.js` documents at length.
    expect(setupBunBlocks().length).toBeGreaterThan(1)
  })

  test('pins Bun from .bun-version in every job, never `latest`', () => {
    const blocks = setupBunBlocks()
    for (const block of blocks) {
      expect(block).toContain('bun-version-file: .bun-version')
      expect(block).not.toContain('bun-version: latest')
    }
  })

  test('.bun-version holds a concrete version', () => {
    // A pin pointing at an empty or wildcarded file is not a pin.
    const pinned = readFileSync(join(ROOT, '.bun-version'), 'utf8').trim()
    expect(pinned).toMatch(/^\d+\.\d+\.\d+$/)
  })
})
