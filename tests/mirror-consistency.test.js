// Guards the one property Cross-tool canon asserts and nothing enforced:
// that AGENTS.md, CLAUDE.md and .github/copilot-instructions.md state the
// same facts.
//
// WHY THIS EXISTS. The three mirrors are required to agree, and until now
// agreement was maintained entirely by hand. It failed: the Copilot mirror's
// security-review guidance drifted apart from the other two and was caught
// only because a reviewer happened to read it. Measured against the commit
// before the fix (e01870f), every one of the seven facts in SHARED_CLAIMS was
// absent from `.github/copilot-instructions.md` and present in both full
// mirrors — so this check would have failed on that tree, which is the whole
// argument for it. Nothing else covers this: markdownlint's MD051 validates a
// fragment against the file it sits IN, and link-check.yml runs weekly and
// opens an issue rather than failing a merge.
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
// scripted pass. Every comparison here runs over whitespace-collapsed text.

import { describe, test, expect } from 'bun:test'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..')

/** The three instruction files Cross-tool canon binds together. */
const MIRRORS = ['AGENTS.md', 'CLAUDE.md', '.github/copilot-instructions.md']

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
 */
const SHARED_CLAIMS = [
  { id: 'local-diff-names-head', needle: 'git diff HEAD' },
  { id: 'commit-diff-first-parent', needle: 'git show --first-parent' },
  { id: 'pr-diff-takes-number', needle: 'gh pr diff <number>' },
  { id: 'shallow-clone-deepen', needle: '--deepen=1' },
  { id: 'untracked-needs-status', needle: 'git status --short' },
  { id: 'attack-surface-bullets', needle: '3-5 bullets' },
  { id: 'assessment-deadline', needle: '2 tool calls' },
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
 * @returns {Map<string, string>} heading text to the trimmed body beneath it.
 */
function sectionsOf(text) {
  const out = new Map()
  let heading = null
  let body = []
  for (const line of text.split('\n')) {
    const match = line.match(/^## (.+)$/)
    if (match) {
      if (heading !== null) out.set(heading, body.join('\n').trim())
      heading = match[1].trim()
      body = []
    } else if (heading !== null) {
      body.push(line)
    }
  }
  if (heading !== null) out.set(heading, body.join('\n').trim())
  return out
}

describe('instruction mirrors', () => {
  // Anti-vacuity, asserted BEFORE anything that iterates the registries. A
  // check driven by an empty list does not fail — it stops checking, and
  // reports success while covering nothing. Same guard, and the same reason,
  // as the minimum row counts in tests/karl-blocks.test.js.
  test('the shared-claim registry is non-empty', () => {
    expect(SHARED_CLAIMS.length).toBeGreaterThanOrEqual(7)
  })

  test('the identical-section registry is non-empty', () => {
    expect(IDENTICAL_SECTIONS.length).toBeGreaterThanOrEqual(1)
  })

  test('every claim id is unique', () => {
    const ids = SHARED_CLAIMS.map((claim) => claim.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('every mirror named by the canon exists on disk', () => {
    for (const path of MIRRORS) expect(existsSync(join(ROOT, path))).toBe(true)
  })

  describe('shared claims appear in all three mirrors', () => {
    const normalized = Object.fromEntries(
      MIRRORS.map((path) => [path, normalize(readMirror(path))])
    )

    for (const { id, needle } of SHARED_CLAIMS) {
      test(`states "${needle}" (${id})`, () => {
        const missing = MIRRORS.filter((path) => !normalized[path].includes(needle))
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
