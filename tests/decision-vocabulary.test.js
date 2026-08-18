// Drift guard for the review decision vocabulary.
//
// `DECISIONS` in js/utils.js is the canonical table, and almost everything in
// the tool now derives from it — chip classes, queue-action slugs, chart
// colours, the pre-zeroed tally, the browser-side validator. Two WHOLE-LIST
// restatements survive, and neither is an oversight: both sit on the far side
// of a module boundary that stops them importing it.
//
//   - js/review/review-insights-data.js is dual-export (a `module.exports` block that
//     its own test `require`s). Adding an `import` would make it an ES module,
//     `module.exports` would stop running, and the require would come back
//     empty.
//   - build_scripts/review-state-schema.js is CommonJS, loaded by server.ts,
//     and feeds a Zod `z.enum()`. Reaching into a browser ES module from the
//     server's dependency graph is a cost this does not justify.
//
// So they restate the list, and this file is what makes that safe: add a sixth
// decision to the canonical table without mirroring it here and CI fails,
// instead of the tool shipping a decision that saves but draws no chart
// segment, or validates in the browser and is rejected by the server.
//
// That used to be the whole story, and it was wrong. The header claimed "two
// restatements" while roughly a dozen INDIVIDUAL labels were spelled out as
// string literals elsewhere: the queue's sort ranks and its blocked/approved
// predicates, its filter chips, the keyboard shortcuts' setDecision calls,
// several `|| 'Needs review'` fallbacks, and index.html's `data-decision`
// attributes. Those are not whole-list copies, so the two assertions below
// cannot see them — and they are string COMPARISONS against the canonical
// list, so renaming a decision leaves the chip rendering exactly as before
// while it silently stops matching, and the queue sorts and filters it wrong.
//
// The last describe block closes that gap: it reads those files and asserts
// every decision-shaped literal in them is a real label. It deliberately does
// NOT demand they be rewritten to reference the constant — several sit in
// modules that take no imports at all (js/review-queue*.js) or in HTML
// attributes, where a literal is the only option. What matters is that a
// rename cannot leave one behind.
import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'
import { DECISIONS, DECISION_LABELS, DECISION_UNDECIDED } from '../js/utils.js'

const { DECISION_ORDER } = require('../js/review/review-insights-data.js')
const { VALID_DECISIONS } = require('../build_scripts/review-state-schema.js')

describe('the canonical decision table', () => {
  test('gives every decision a label, slug, chip class, and chart colour', () => {
    for (const decision of DECISIONS) {
      expect(typeof decision.label).toBe('string')
      expect(decision.label.length).toBeGreaterThan(0)
      expect(decision.slug).toMatch(/^[a-z][a-z-]*$/)
      expect(decision.chipClass).toMatch(/^decision-[a-z]+$/)
      expect(decision.vizToken).toMatch(/^--viz-decision-[a-z]+$/)
      expect(decision.vizFallback).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  test('uses a distinct slug, chip class, and chart token per decision', () => {
    for (const field of ['label', 'slug', 'chipClass', 'vizToken']) {
      const values = DECISIONS.map((decision) => decision[field])
      expect(new Set(values).size).toBe(DECISIONS.length)
    }
  })

  test('names the undecided default as one of its own labels', () => {
    // Everything that asks "has this page been reviewed?" compares against
    // this string. If it ever stopped matching a real label, every page would
    // read as reviewed.
    expect(DECISION_LABELS).toContain(DECISION_UNDECIDED)
  })

  test('leads with the undecided default, which is where every page starts', () => {
    expect(DECISION_LABELS[0]).toBe(DECISION_UNDECIDED)
  })
})

describe('restatements of the decision vocabulary', () => {
  test('js/review/review-insights-data.js DECISION_ORDER matches label-for-label, in order', () => {
    // Order is asserted, not just membership: the chart legend and the mix bar
    // follow this array, and a reshuffle would reorder the segments.
    expect(DECISION_ORDER).toEqual(DECISION_LABELS)
  })

  test('build_scripts/review-state-schema.js VALID_DECISIONS covers the same set', () => {
    // Set equality, not order: this one feeds a Zod `z.enum()`, where order
    // carries no meaning.
    expect([...VALID_DECISIONS].sort()).toEqual([...DECISION_LABELS].sort())
  })
})

// Every file that spells out an individual decision label rather than deriving
// it. Listed explicitly rather than globbed: a glob would sweep in the
// canonical table itself, and — worse — would quietly stop covering a file the
// day someone renamed it, which is the exact failure this guards against.
const FILES_WITH_DECISION_LITERALS = [
  'js/review/review-queue-rows.js',
  'js/review/review-queue-render.js',
  'js/review/review-queue-state.js',
  'js/review/review-queue-undo.js',
  'js/keyboard-shortcuts.js',
  'js/ux-improvements-state-sync.js',
  'js/ux-improvements-export.js',
  'js/ux-improvements-workspace.js',
  'js/manager-review-export.js',
  'js/review/review-ops-data.js',
  // The Karl transcript prints the page's decision at the top and marks a
  // not-Approved page on every panel, so it compares against 'Approved' by
  // value and defaults an unreviewed page to 'Needs review'. Renaming either
  // label silently stops the comparison matching, and the visible symptom
  // would be an unapproved page exporting as though it were signed off.
  'js/karl/karl-transcript.js',
  'index.html',
]

/* Files whose decision-shaped literals are NOT decisions.

   js/utils.js declares the canonical table, and js/review/review-insights-data.js
   restates it wholesale under its own assertion above — re-checking either
   here would be circular.

   js/mockup/page-render.js is the interesting one: its `'Needs review'` and
   `'Blocked'` are editorStatus pill labels (the `needs-review | blocked |
   placeholder` page field), a separate vocabulary that happens to share two
   words. Pinning them to DECISION_LABELS would invent a coupling that does
   not exist — rename the review decision and this file must NOT follow. */
const NOT_THE_DECISION_VOCABULARY = new Set([
  'js/utils.js',
  'js/review/review-insights-data.js',
  'js/mockup/page-render.js',
])

/* Decision labels are ordinary English phrases, so a literal is recognized by
   SHAPE, not by searching for the known strings — searching for the current
   labels would pass trivially and prove nothing about a renamed one. These
   two patterns match how the labels actually appear in this codebase:

     'Approved with edits'          a quoted string
     data-decision="Needs review"   an HTML attribute

   The `Approved`/`Revise`/`Blocked`/`Needs` stems anchor it. A stem is a
   prefix of a real label, so a rename that changes only the tail (say
   'Approved with edits' -> 'Approved with changes') still matches and still
   gets checked — which is the rename most likely to slip through, since it
   leaves the chip looking right.

   The body is letters and spaces only, which is what keeps PROSE out: the
   shortcut list in js/keyboard-shortcuts.js describes its `r` binding as
   'Revise and resubmit (current or selected)', and a looser `[^']*` body
   swept that up and failed the file over a help string. Every real label is
   letters and spaces, so nothing legitimate is excluded by the narrowing. */
const QUOTED_DECISION_LITERAL = /'((?:Approved|Revise|Blocked|Needs)[A-Za-z ]*)'/g
const DATA_DECISION_ATTRIBUTE = /data-decision="([^"]+)"/g

/**
 * Every decision-shaped literal in a file, deduplicated.
 * @param {string} relativePath
 * @returns {string[]}
 */
function decisionLiteralsIn(relativePath) {
  const source = readFileSync(join(import.meta.dir, '..', relativePath), 'utf8')
  const found = new Set()
  for (const pattern of [QUOTED_DECISION_LITERAL, DATA_DECISION_ATTRIBUTE]) {
    for (const match of source.matchAll(pattern)) found.add(match[1])
  }
  return [...found]
}

describe('individually restated decision labels', () => {
  test.each(FILES_WITH_DECISION_LITERALS)('%s spells every label exactly', (relativePath) => {
    const literals = decisionLiteralsIn(relativePath)
    // A file that has stopped restating any label is fine — but an EMPTY
    // result usually means the patterns above have gone stale rather than
    // that the file was cleaned up, and a matcher that matches nothing
    // passes every assertion. Fail loudly instead, and let whoever genuinely
    // removed the last literal delete the entry from the list above.
    expect(literals.length).toBeGreaterThan(0)
    for (const literal of literals) {
      expect(DECISION_LABELS).toContain(literal)
    }
  })

  test('covers every file that actually restates one', () => {
    // The list is hand-maintained, so this is what stops it going stale in
    // the other direction: a new module hardcoding a label, uncovered.
    // One glob per shape rather than a `{a,b}` brace pattern: Bun.Glob
    // silently matches NOTHING for a top-level brace alternation, and a
    // coverage check that scans zero files passes unconditionally — the same
    // vacuous-pass trap the per-file assertion above guards against.
    //
    // `js/**/*.js`, not `js/*.js`: a single star does not cross a slash, so
    // the subdirectory that now holds the React islands was outside this
    // check entirely. A module under `js/react/` can hardcode a decision
    // label exactly as easily as one at the top level, and until 2026-08-15
    // nothing here would have noticed.
    const repoRoot = join(import.meta.dir, '..')
    const jsFiles = [...new Bun.Glob('js/**/*.js').scanSync({ cwd: repoRoot })]
    expect(jsFiles.length).toBeGreaterThan(0)
    expect(jsFiles.some((file) => file.startsWith('js/react/'))).toBe(true)

    const restating = [...jsFiles, 'index.html']
      .filter((file) => !NOT_THE_DECISION_VOCABULARY.has(file))
      .filter((file) => decisionLiteralsIn(file).length > 0)
      .sort()
    expect(restating).toEqual([...FILES_WITH_DECISION_LITERALS].sort())
  })
})
