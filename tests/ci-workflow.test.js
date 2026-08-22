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

/**
 * Every JOB name in the workflow, from the four-space `name:` keys.
 *
 * Four spaces is the job level in this file — measured, not assumed: the seven
 * job names sit at four, the workflow's own `name: CI` at zero, and the two
 * artifact names (`name: dist`, `name: playwright-report`) at ten, under an
 * `upload-artifact` step's `with:`. Folding the artifacts in would demand the
 * mirrors enumerate two uploads as though they were required checks.
 *
 * @returns {string[]}
 */
function jobNames() {
  return [...WORKFLOW.matchAll(/^ {4}name: (.+)$/gm)].map((match) => match[1].trim())
}

/**
 * Every job ID — the two-space keys under `jobs:`.
 *
 * Parsed independently of `jobNames()` on purpose. It is the DERIVED floor for
 * the census below, replacing a hardcoded "at least five", which this repo's
 * own rule forbids ("do not hardcode counts, derive them from the source of
 * truth") and which would have gone red on a legitimate refactor that shrank
 * the workflow. Two parsers reading different keys of the same file cannot
 * both fall silent and still agree on a count, so `names.length === ids.length`
 * is a non-vacuity check with no magic number in it — and it is strictly
 * stronger than a threshold, because it also catches a job that declares no
 * `name:` at all, which branch protection could never require.
 *
 * @returns {string[]}
 */
function jobIds() {
  const jobsBlock = WORKFLOW.slice(WORKFLOW.indexOf('\njobs:'))
  return [...jobsBlock.matchAll(/^ {2}([A-Za-z_][\w-]*):$/gm)].map((match) => match[1])
}

/**
 * The paragraph in a mirror that enumerates the required contexts.
 *
 * Scoped rather than file-wide, and that is the whole point: every one of
 * these names also appears in the per-job description list above it, so a
 * file-wide search would be satisfied by prose ABOUT a job while the
 * enumeration that branch protection is copied from had lost it.
 *
 * @param {string} text Raw file contents.
 * @returns {string[]|null} the backticked names, or null if the sentence is gone.
 */
function requiredContextParagraph(text) {
  const start = text.indexOf('So the required set is')
  if (start < 0) return null
  const end = text.indexOf('\n\n', start)
  const paragraph = text.slice(start, end < 0 ? undefined : end)
  return [...paragraph.matchAll(/`([^`]+)`/g)].map((match) => match[1])
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

/* The required-context census.

   WHY THIS EXISTS. AGENTS.md and CLAUDE.md both warn that "Branch protection's
   required contexts are job NAMES, not job ids, and they have to be changed
   with this file", and that "Adding a job to this file means adding its name
   here and to protection, or it is advisory." Nothing enforced either half.
   Both failure modes are silent in the direction that matters:

   - A job RENAMED in ci.yml leaves branch protection requiring a context no
     job produces, and a context nothing produces stays permanently pending —
     so a fully green PR can never satisfy it.
   - A job ADDED and not listed is simply not required, and GitHub treats a
     conditionally skipped required check as PASSING, which is why the mirrors
     insist every job be required rather than only the code-path ones.

   This cannot read branch protection — that lives in GitHub's API, needs a
   token, and must not be a test dependency. What it CAN do is pin the two
   documents branch protection is copied from against the workflow itself, so
   the enumeration a human transcribes is never stale at the moment they
   transcribe it. Set equality in both directions, so a rename fails on both
   sides of the same edit. */
describe('the required-context enumeration in the mirrors', () => {
  const MIRRORS = ['AGENTS.md', 'CLAUDE.md']

  test('no two jobs share a name, so each is its own required context', () => {
    // Without this, the census has a hole a copy-pasted job walks straight
    // through: duplicate names keep `names.length === ids.length` true, and the
    // set comparison below collapses the pair into one value, so both mirrors
    // stay green while the second job has no distinct required context of its
    // own — and GitHub can only require a context by name.
    const names = jobNames()
    const duplicated = names.filter((name, index) => names.indexOf(name) !== index)
    expect(duplicated).toEqual([])
  })

  test('every job under `jobs:` declares a name, and both parsers see them', () => {
    // A parse that stops matching does not fail, it stops checking — so
    // non-vacuity is established before anything is compared. Derived from the
    // workflow's own job IDs rather than a threshold: see jobIds() for why.
    expect(jobNames().length).toBe(jobIds().length)
    expect(jobIds().length).toBeGreaterThan(0)
  })

  test.each(MIRRORS)('%s still carries the required-set sentence', (mirror) => {
    const text = readFileSync(join(ROOT, mirror), 'utf8')
    expect(requiredContextParagraph(text)).not.toBeNull()
  })

  test.each(MIRRORS)('%s enumerates exactly the jobs ci.yml defines', (mirror) => {
    const text = readFileSync(join(ROOT, mirror), 'utf8')
    const listed = new Set(requiredContextParagraph(text) ?? [])
    expect([...listed].sort()).toEqual([...new Set(jobNames())].sort())
  })
})
