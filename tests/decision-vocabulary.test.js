// Drift guard for the review decision vocabulary.
//
// `DECISIONS` in js/utils.js is the canonical table, and almost everything in
// the tool now derives from it — chip classes, queue-action slugs, chart
// colours, the pre-zeroed tally, the browser-side validator. Two restatements
// survive, and neither is an oversight: both sit on the far side of a module
// boundary that stops them importing it.
//
//   - js/review-insights-data.js is dual-export (a `module.exports` block that
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
import { describe, test, expect } from 'bun:test'
import { DECISIONS, DECISION_LABELS, DECISION_UNDECIDED } from '../js/utils.js'

const { DECISION_ORDER } = require('../js/review-insights-data.js')
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
  test('js/review-insights-data.js DECISION_ORDER matches label-for-label, in order', () => {
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
