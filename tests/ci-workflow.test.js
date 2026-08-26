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
 * Four spaces is the job level in this file — measured, not assumed: the job
 * names sit at four, the workflow's own `name: CI` at zero, and the two
 * artifact names (`name: dist`, `name: playwright-report`) at ten, under an
 * `upload-artifact` step's `with:`. Folding the artifacts in would demand the
 * mirrors enumerate two uploads as though they were required checks.
 *
 * @returns {string[]}
 */
function jobNames() {
  return [...WORKFLOW.matchAll(/^ {4}name: (.+)$/gm)].map((match) => decodeScalar(match[1]))
}

/**
 * A YAML scalar as a reader sees it: trailing comment stripped, surrounding
 * quotes removed.
 *
 * No job in `ci.yml` is quoted or commented today, so this changes nothing
 * now. It exists because the alternative failure is confusing rather than
 * informative: a name written `"Tests: unit"` — which YAML requires the moment
 * a value contains a colon-space — would otherwise be compared as
 * `"Tests: unit"`, quotes included, against a mirror that sensibly writes
 * `Tests: unit`. The census would fail correctly and for a reason nobody could
 * read off the diff.
 *
 * @param {string} raw The text after `name:`.
 * @returns {string}
 */
function decodeScalar(raw) {
  const trimmed = raw.trim()
  // Quotes are matched FIRST, and a comment only stripped from what follows
  // the closing quote. The other order — strip the comment, then unquote —
  // reads `name: "Deploy #1"` as `"Deploy` and cannot recover, because inside
  // quotes a `#` is part of the value rather than the start of a comment.
  const quoted = trimmed.match(/^(['"])(.*?)\1\s*(?:#.*)?$/)
  if (quoted) return quoted[2]
  return trimmed.replace(/\s+#.*$/, '').trim()
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
 * Every job as a `{ id, name, block }` record — the same two keys the two
 * parsers above read, but kept together so a question can be asked about ONE
 * job rather than about the file.
 *
 * The flat parsers stay: they are each other's non-vacuity check, and this
 * one is not a substitute for that. What it adds is the block text, which is
 * the only way to tell a matrixed job from a plain one.
 *
 * @returns {{id: string, name: string|null, block: string}[]} one record per job, in file order.
 */
function jobBlocks() {
  const jobsBlock = WORKFLOW.slice(WORKFLOW.indexOf('\njobs:'))
  const starts = [...jobsBlock.matchAll(/^ {2}([A-Za-z_][\w-]*):$/gm)]
  return starts.map((match, index) => {
    const end = index + 1 < starts.length ? starts[index + 1].index : jobsBlock.length
    const block = jobsBlock.slice(match.index, end)
    const name = block.match(/^ {4}name: (.+)$/m)
    return { id: match[1], name: name ? decodeScalar(name[1]) : null, block }
  })
}

/**
 * Whether a job fans out over a matrix.
 *
 * This is the whole reason the census below is not simply `jobNames()`. GitHub
 * suffixes a matrixed job's check contexts — `E2E shard (1)`, `(2)` — so the
 * literal after `name:` is a context NO job produces, and requiring it in
 * branch protection would leave a PR permanently pending. A matrixed job is
 * therefore not a required context and must not be enumerated as one.
 *
 * @param {{block: string}} job The job record to test.
 * @returns {boolean} true when the job declares a `strategy:` block.
 */
function isMatrixed(job) {
  return /^ {4}strategy:$/m.test(job.block)
}

/**
 * A job's declared `needs:`, as job IDs.
 *
 * Only the inline-array form is parsed, which is the only form `ci.yml` uses.
 * A block-sequence `needs:` would read as zero dependencies here — caught by
 * the aggregator assertion below failing, not by passing silently, since that
 * assertion demands a match rather than tolerating its absence.
 *
 * @param {{block: string}} job The job record to read.
 * @returns {string[]} the job IDs it declares as dependencies, empty when it declares none.
 */
function needsOf(job) {
  const line = job.block.match(/^ {4}needs: (.+)$/m)
  if (!line) return []
  return line[1]
    .replace(/[[\]]/g, '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
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

  test('every matrixed job is gated by a plain job that depends on it', () => {
    // The half that keeps the exclusion below from being a hole in the census
    // rather than a correction to it.
    //
    // A matrixed job produces no requirable context, so dropping it from the
    // enumeration is right — but on its own that means a job can be made
    // matrixed and thereby made UNREQUIRED, silently, by an edit that adds
    // four lines and touches no document. What restores the guarantee is an
    // aggregator: a non-matrixed job that `needs:` it, fails when it fails,
    // and carries a stable name the enumeration does list. Assert the shape,
    // so the exclusion always comes with its replacement.
    const jobs = jobBlocks()
    const plain = jobs.filter((job) => !isMatrixed(job))
    for (const job of jobs.filter(isMatrixed)) {
      const gates = plain.filter((candidate) => needsOf(candidate).includes(job.id))
      expect(gates.map((gate) => gate.name)).not.toEqual([])
    }
  })

  test.each(MIRRORS)('%s enumerates exactly the jobs ci.yml defines', (mirror) => {
    // Matrixed jobs excluded: see isMatrixed() for why their `name:` is not a
    // context branch protection could ever require, and the assertion above
    // for what stands in their place.
    const text = readFileSync(join(ROOT, mirror), 'utf8')
    const listed = new Set(requiredContextParagraph(text) ?? [])
    const required = jobBlocks()
      .filter((job) => !isMatrixed(job))
      .map((job) => job.name)
    expect([...listed].sort()).toEqual([...new Set(required)].sort())
  })
})
