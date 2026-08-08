// Unit tests for the `rewrite-field` task's output validator.
//
// The validator is deliberately narrow — a rewrite is prose, so there is no
// object shape to check beyond "is it a non-empty string". The two checks that
// carry real weight are the ones a reviewer would otherwise have to catch by
// eye: HTML sneaking into a field that is rendered through formatMarkdown
// (which escapes it, so it surfaces as visible angle brackets rather than
// markup), and a dropped [label](target) link, which silently removes
// navigation the page previously had.
import { describe, test, expect } from 'bun:test'

const { validateRewrite } = require('../build_scripts/ai/validate-output.js')

describe('validateRewrite', () => {
  test('accepts plain prose that preserves every link target', () => {
    const result = validateRewrite(
      { rewrittenText: 'Call us at 415-555-1212 or see [our guide](pestsTopic).' },
      'Reach out on 415-555-1212 or read [the guide](pestsTopic).'
    )
    expect(result.valid).toBe(true)
    expect(result.issues).toEqual([])
  })

  test('rejects an empty rewrite', () => {
    const result = validateRewrite({ rewrittenText: '   ' }, 'Original copy.')
    expect(result.valid).toBe(false)
    expect(result.schemaValid).toBe(false)
  })

  test('rejects a missing rewrittenText field', () => {
    const result = validateRewrite({}, 'Original copy.')
    expect(result.valid).toBe(false)
    expect(result.schemaValid).toBe(false)
  })

  test('rejects introduced HTML tags', () => {
    const result = validateRewrite({ rewrittenText: 'Call <strong>now</strong>.' }, 'Call now.')
    expect(result.valid).toBe(false)
    expect(result.issues.join(' ')).toContain('HTML')
  })

  test('names a dropped link target so the retry can restore it', () => {
    const result = validateRewrite(
      { rewrittenText: 'See the guide.' },
      'See [the guide](pestsTopic).'
    )
    expect(result.valid).toBe(false)
    expect(result.issues.join(' ')).toContain('pestsTopic')
  })

  // Rewording the visible label is the entire point of the feature, so the
  // check is on the TARGET, not on the whole link. A validator that pinned the
  // label would reject every useful rewrite.
  test('allows reworded link labels as long as the target survives', () => {
    const result = validateRewrite(
      { rewrittenText: 'Read [pest control basics](pestsTopic).' },
      'See [the guide](pestsTopic).'
    )
    expect(result.valid).toBe(true)
  })

  test('reports every dropped target, not just the first', () => {
    const result = validateRewrite(
      { rewrittenText: 'No links at all here.' },
      'See [one](pestsTopic) and [two](ownerGuidance).'
    )
    expect(result.valid).toBe(false)
    const joined = result.issues.join(' ')
    expect(joined).toContain('pestsTopic')
    expect(joined).toContain('ownerGuidance')
  })

  test('accepts a rewrite of copy that never had links', () => {
    const result = validateRewrite(
      { rewrittenText: 'Report the problem to us.' },
      'You must report the problem to us.'
    )
    expect(result.valid).toBe(true)
    expect(result.schemaValid).toBe(true)
  })
})
