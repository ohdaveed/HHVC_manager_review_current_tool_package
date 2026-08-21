// Guards the one property Cross-tool canon asserts and nothing enforced:
// that AGENTS.md, CLAUDE.md and .github/copilot-instructions.md state the
// same facts.
//
// WHY THIS EXISTS. The three mirrors are required to agree, and until now
// agreement was maintained entirely by hand. It failed: the Copilot mirror's
// security-review guidance drifted apart from the other two and was caught
// only because a reviewer happened to read it. Measured against the commit
// before the fix (e01870f), all SEVEN of the security-review claims below were
// absent from `.github/copilot-instructions.md` and present in both full
// mirrors — so this check would have failed on that tree, which is the whole
// argument for it. The twelve identifier claims were already present at that
// revision and prove nothing about it; they guard a different failure, stated
// where they are declared. Nothing else covers this: markdownlint's MD051
// validates a fragment against the file it sits IN, and link-check.yml runs
// weekly and opens an issue rather than failing a merge.
//
// WHAT THIS DOES NOT CATCH. Presence, not polarity. A mirror that keeps a
// registered token and reverses the sentence around it — "an assessment need
// NOT land within the first 2 tool calls" — still passes, because substring
// matching cannot read meaning. Matching polarity instead would mean a
// per-mirror regex over prose three documents deliberately word differently,
// which is brittle in the direction that matters: it fails on rewordings that
// are fine and still misses reversals phrased another way. So this gate covers
// a fact being DELETED from a mirror or DIVERGING between them, and a semantic
// reversal remains a human reviewer's job. Nor does a file-scoped claim on a
// REPEATED identifier catch its defining mention drifting while other mentions
// remain — which is why only identifiers appearing at most twice per mirror are
// registered at all. Better a narrow check that holds than a wide one that lies
// about its reach.
//
// WHY NOT COMPARE THE FILES. They are deliberately not byte-identical, and a
// naive equality check would be wrong rather than merely noisy. Measured on
// the current tree, only ONE of the eleven headings the two full mirrors share
// is byte-identical; the other ten differ legitimately, because CLAUDE.md
// extracts eleven subsystem write-ups to `.claude/skills/hhvc-*/SKILL.md` and
// summarizes them in place. The Copilot mirror is compressed further still, to
// bullets. So identity is asserted only where it is intended (IDENTICAL_SECTIONS)
// and the general property is checked as shared FACTS instead.
//
// WHY WHITESPACE IS NORMALIZED. Prose wraps. Writing this check with a literal
// substring match reported `2 tool calls` as missing from the Copilot mirror,
// which carries it as "within the first 2\n  tool calls" — a false positive
// produced by a line break, and the same failure mode AGENTS.md's refactor
// guidance names: a path or phrase line-wrapped in prose is invisible to a
// scripted pass. So the SHARED-CLAIM searches run over whitespace-collapsed
// text — and only those. IDENTICAL_SECTIONS deliberately compares raw bodies,
// because byte identity is what it asserts: normalizing there would wave
// through a rewrap of one mirror and not the other, which is drift in exactly
// the sections declared to be word-for-word the same.

import { describe, test, expect } from 'bun:test'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..')

/**
 * The three instruction files Cross-tool canon binds together, each mapped to
 * the section that carries the guidance under test.
 *
 * Scoping is load-bearing, not tidiness. Searching the whole file lets
 * unrelated prose satisfy a claim after the real instruction has drifted, and
 * that was not hypothetical: the commit introducing this test added a
 * test-inventory entry to `AGENTS.md` and `CLAUDE.md` that quotes
 * `2 tool calls`, so the phrase appeared in BOTH `Commands` and
 * `Security Reviews` and deleting the requirement from the latter would have
 * left this suite green. A gate that its own commit renders vacuous is worse
 * than no gate, because it reports coverage.
 *
 * The heading differs per file because the mirrors are shaped differently:
 * the two full mirrors carry a `## Security Reviews` section, and the Copilot
 * mirror compresses it to a bullet under `## Workflow & verification`.
 */
const DEFAULT_SECTIONS = {
  'AGENTS.md': 'Security Reviews',
  'CLAUDE.md': 'Security Reviews',
  '.github/copilot-instructions.md': 'Workflow & verification',
}

/** Just the paths, for the checks that do not care about sections. */
const MIRROR_PATHS = Object.keys(DEFAULT_SECTIONS)

/** The two that carry every section in full. The Copilot mirror does not. */
const FULL_MIRRORS = ['AGENTS.md', 'CLAUDE.md']

/**
 * Facts that must survive in ALL THREE mirrors, however each one words them.
 *
 * Each entry is a `needle` short enough that a legitimate rewrite of the
 * surrounding prose keeps it, and specific enough that dropping the fact
 * removes it. They are commands and figures rather than sentences, because a
 * sentence is the part an editor rewrites and a command is the part they must
 * not.
 *
 * Adding to this list is a deliberate act: it asserts the fact belongs in
 * every mirror, including the compressed one.
 *
 * A claim may carry its own `sections` map to look somewhere other than
 * DEFAULT_SECTIONS, so the registry is not bound to one part of the documents.
 *
 * WHAT EARNS A PLACE HERE, so the list does not become a matter of taste: a
 * fact qualifies only if it ALREADY appears in all three mirrors. That keeps
 * the rule mechanical rather than editorial, and it can never force the
 * compressed Copilot mirror to carry detail it deliberately omits — the gate
 * preserves an agreement that exists, it does not impose one. Measured when
 * this list was written, 62 code spans satisfied that test; the ones below are
 * the subset whose exact spelling is load-bearing, which is the second and
 * last filter: a mirror naming a different storage key, role or entry point is
 * not stale but wrong, and a reader who follows it writes to the wrong place.
 * Incidental path mentions are deliberately left out, since one mirror
 * dropping a passing reference is not drift.
 */
const SHARED_CLAIMS = [
  // Procedural guidance: scoped to the section that carries it, because the
  // same words can appear in prose ABOUT the rule without being the rule.
  { id: 'local-diff-names-head', needle: 'git diff HEAD' },
  { id: 'commit-diff-first-parent', needle: 'git show --first-parent' },
  { id: 'pr-diff-takes-number', needle: 'gh pr diff <number>' },
  { id: 'shallow-clone-deepen', needle: '--deepen=1' },
  { id: 'untracked-needs-status', needle: 'git status --short' },
  { id: 'attack-surface-bullets', needle: '3-5 bullets' },
  { id: 'assessment-deadline', needle: '2 tool calls' },

  // Identifiers searched file-wide, and RARE ENOUGH that presence is the fact.
  //
  // A file-scoped claim on a frequently repeated identifier cannot fail in the
  // way it implies. `server.ts` appears 43 times in AGENTS.md; if the one
  // sentence that DEFINES it as the server entry point drifted, forty-two
  // other mentions would still satisfy an `includes`. The claim would then
  // only detect a mirror dropping the string entirely, which will never
  // happen — and this repo already has doctrine for that: getRuleResultsFor()
  // marks rules that cannot fail `scored: false`, because scoring them buries
  // the rules that do fail under permanent green. Same reasoning, so the same
  // answer: nine such claims were registered and then removed rather than kept
  // as decoration.
  //
  // Measured occurrences across the three mirrors, which is how the survivors
  // were chosen rather than by taste:
  //
  //   removed:  server.ts 43/28/2   pages/*.js 21/16/4   js/main.js 12/11/5
  //             index.html 7/11/2   css/theme.css 7/6/2  /api/ai/* 5/4/1
  //             review:read 5/4/1   review:write 4/3/1   ai:generate 4/3/2
  //   kept:     hhvcManagerReviewState:v1 2/2/1
  //             window.HHVC_PAGES['<pageKey>'] 1/1/1
  //             window.HHVC_DATA = { pages, order } 1/1/1
  //
  // For these three, the mention IS the definition, so a wrong storage key or
  // a wrong global shape fails here — which is the failure worth catching, a
  // reader who follows the mirror writing to the wrong place.
  { id: 'persisted-state-key', needle: 'hhvcManagerReviewState:v1', scope: 'file' },
  { id: 'page-registry-global', needle: "window.HHVC_PAGES['<pageKey>']", scope: 'file' },
  { id: 'page-data-global', needle: 'window.HHVC_DATA = { pages, order }', scope: 'file' },
]

/**
 * Sections required to be BYTE-IDENTICAL between the two full mirrors.
 *
 * Deliberately short. A heading earns a place here only when the two files are
 * meant to carry the same words, not merely the same facts — which is the
 * exception, not the rule.
 */
const IDENTICAL_SECTIONS = ['Security Reviews']

/** Collapse every run of whitespace so a line break cannot hide a match. */
function normalize(text) {
  return text.replace(/\s+/g, ' ')
}

/** @returns {string} the file's contents, or throws naming the missing path. */
function readMirror(relativePath) {
  const full = join(ROOT, relativePath)
  if (!existsSync(full)) throw new Error(`mirror is missing from the repo: ${relativePath}`)
  return readFileSync(full, 'utf8')
}

/**
 * Split a markdown file into its `## ` sections.
 *
 * @param {string} text Raw file contents.
 * @returns {Map<string, string>} heading text to the RAW body beneath it.
 *   Deliberately untrimmed: IDENTICAL_SECTIONS asks for byte identity, and a
 *   trim would let a whitespace-only difference at either boundary pass.
 */
function sectionsOf(text) {
  const out = new Map()
  let heading = null
  let body = []
  for (const line of text.split('\n')) {
    const match = line.match(/^## (.+)$/)
    if (match) {
      if (heading !== null) out.set(heading, body.join('\n'))
      heading = match[1].trim()
      body = []
    } else if (heading !== null) {
      body.push(line)
    }
  }
  if (heading !== null) out.set(heading, body.join('\n'))
  return out
}

describe('instruction mirrors', () => {
  // Anti-vacuity, asserted BEFORE anything that iterates the registries: a
  // check driven by an empty list does not fail, it stops checking, and reports
  // success while covering nothing.
  //
  // Non-empty, but deliberately WITHOUT a numeric floor. This repo bans hard-coded
  // counts in tests, and a floor here would buy nothing the literal registry
  // does not already give: unlike tests/karl-blocks.test.js, whose minimums
  // guard a registry TRANSCRIBED from a prose document that can silently stop
  // parsing, this list is declared inline. It cannot shrink by accident, only
  // by an edit a reviewer sees.
  test('the shared-claim registry is non-empty', () => {
    expect(SHARED_CLAIMS.length).toBeGreaterThan(0)
  })

  test('the identical-section registry is non-empty', () => {
    expect(IDENTICAL_SECTIONS.length).toBeGreaterThan(0)
  })

  test('every claim id is unique', () => {
    const ids = SHARED_CLAIMS.map((claim) => claim.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('every mirror named by the canon exists on disk', () => {
    for (const path of MIRROR_PATHS) expect(existsSync(join(ROOT, path))).toBe(true)
  })

  test('every section any claim points at actually exists', () => {
    // Without this, a renamed heading silently empties the haystack and every
    // claim fails for a reason that names the wrong problem.
    const wanted = new Set()
    for (const claim of SHARED_CLAIMS) {
      if (claim.scope === 'file') continue
      const map = claim.sections ?? DEFAULT_SECTIONS
      for (const path of MIRROR_PATHS) wanted.add(`${path}\u0000${map[path]}`)
    }
    for (const key of wanted) {
      const [path, heading] = key.split('\u0000')
      const has = sectionsOf(readMirror(path)).get(heading) !== undefined
      expect({ path, heading, present: has }).toEqual({ path, heading, present: true })
    }
  })

  describe('shared claims appear in all three mirrors', () => {
    const parsed = Object.fromEntries(MIRROR_PATHS.map((p) => [p, sectionsOf(readMirror(p))]))

    const whole = Object.fromEntries(MIRROR_PATHS.map((p) => [p, normalize(readMirror(p))]))

    /**
     * Normalized haystack for one claim in one mirror.
     *
     * Section-scoped by default, because prose ABOUT a rule can otherwise
     * satisfy the check after the rule itself has gone — that happened here
     * once already. A claim marked `scope: 'file'` searches the whole document
     * instead: it names an identifier, and an identifier appearing anywhere IS
     * the fact, so pinning it to a section would only make the check brittle
     * against the mirrors' different shapes.
     */
    const haystackFor = (claim, path) =>
      claim.scope === 'file'
        ? whole[path]
        : normalize(parsed[path].get((claim.sections ?? DEFAULT_SECTIONS)[path]) ?? '')

    for (const claim of SHARED_CLAIMS) {
      const { id, needle } = claim
      test(`states "${needle}" (${id})`, () => {
        const missing = MIRROR_PATHS.filter((path) => !haystackFor(claim, path).includes(needle))
        // The failure message names the file AND the fact, because "a mirror
        // drifted" is not actionable and "copilot-instructions.md no longer
        // says `gh pr diff <number>`" is.
        expect({ claim: id, needle, missingFrom: missing }).toEqual({
          claim: id,
          needle,
          missingFrom: [],
        })
      })
    }
  })

  describe('sections declared identical really are', () => {
    for (const heading of IDENTICAL_SECTIONS) {
      test(`"${heading}" is byte-identical across the full mirrors`, () => {
        const bodies = FULL_MIRRORS.map((path) => ({
          path,
          body: sectionsOf(readMirror(path)).get(heading),
        }))

        // A heading that vanished from one mirror is drift too, and it would
        // otherwise compare `undefined` against `undefined` and pass.
        for (const { path, body } of bodies) {
          expect({ path, heading, present: body !== undefined }).toEqual({
            path,
            heading,
            present: true,
          })
        }

        const [first, ...rest] = bodies
        for (const other of rest) {
          expect({
            heading,
            a: first.path,
            b: other.path,
            same: other.body === first.body,
          }).toEqual({ heading, a: first.path, b: other.path, same: true })
        }
      })
    }
  })
})
