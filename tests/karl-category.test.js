// The Karl tag CATEGORY: what kind of CMS thing a tag points at, which is a
// different question from the tag's `kind`.
//
// **Why this is a separate axis rather than a rename.** `guideForContext()`
// computes `role = context.role || context.component || kind`, and 14 of the 34
// karlTag() call sites pass a bare kind literal with no role — so for those,
// the kind string IS the role that resolves a Karl field path. Renaming kinds
// to carry semantic categories would silently resolve those to '' and report
// "Mockup only", which is the confidently-wrong answer this whole subsystem
// exists to prevent. So the category is DERIVED from signals already in scope
// and the kind is left alone.
import { describe, test, expect } from 'bun:test'
import { KARL_CATEGORIES, karlCategory } from '../js/mockup/karl-category.js'

describe('karlCategory', () => {
  test('page metadata is metadata', () => {
    expect(karlCategory({ kind: 'meta' })).toBe('metadata')
    expect(karlCategory({ kind: 'body', role: 'title' })).toBe('metadata')
    expect(karlCategory({ kind: 'body', role: 'description' })).toBe('metadata')
  })

  test('an editor-only QA note is its own category', () => {
    expect(karlCategory({ kind: 'editor' })).toBe('editor')
  })

  test('a button link is an action', () => {
    expect(karlCategory({ kind: 'placement', linkShape: 'button-link' })).toBe('action')
  })

  test('a callout is a callout', () => {
    expect(karlCategory({ kind: 'body', role: 'callout' })).toBe('callout')
  })

  test('a page picker is inherited', () => {
    expect(karlCategory({ kind: 'placement', linkShape: 'page-reference' })).toBe('inherited')
    expect(karlCategory({ kind: 'placement', linkShape: 'resources-list' })).toBe('inherited')
    expect(karlCategory({ kind: 'placement', linkShape: 'campaign-related' })).toBe('inherited')
  })

  test('a card whose text is inherited is inherited even with no link shape', () => {
    expect(karlCategory({ kind: 'placement', inheritanceFact: 'title-and-text' })).toBe('inherited')
    expect(karlCategory({ kind: 'placement', inheritanceFact: 'title' })).toBe('inherited')
  })

  test('ordinary body content is a StreamField block', () => {
    expect(karlCategory({ kind: 'body' })).toBe('block')
    expect(karlCategory({ kind: 'body', role: 'what-to-do' })).toBe('block')
  })

  // PRECEDENCE. These combinations occur together in the real corpus, so the
  // order is a decision rather than an accident, and each collision is pinned
  // here so a later reader cannot reorder the branches without a test going
  // red. Same reasoning as guideStatusLabel() checking `inferred` before the
  // evidence line.
  describe('precedence when several signals are present at once', () => {
    test('editor-only beats every other signal, because it must never read as publishable', () => {
      expect(karlCategory({ kind: 'editor', linkShape: 'button-link', role: 'callout' })).toBe(
        'editor'
      )
    })

    test('a Spotlight CTA is an action, not a block — link shape beats role', () => {
      expect(karlCategory({ kind: 'placement', role: 'spotlight', linkShape: 'button-link' })).toBe(
        'action'
      )
    })

    test('an inheriting card that also has a link shape is inherited, not an action', () => {
      expect(
        karlCategory({
          kind: 'placement',
          linkShape: 'page-reference',
          inheritanceFact: 'title-and-text',
        })
      ).toBe('inherited')
    })

    test('metadata beats a link shape, since a title is not a link picker', () => {
      expect(karlCategory({ kind: 'meta', linkShape: 'page-reference' })).toBe('metadata')
    })
  })

  // The classifier must have no silent seventh bucket. An unrecognized
  // combination lands in `block`, the named default, rather than in undefined —
  // an undefined category renders as a tag with NO fill, which reads as a
  // styling bug rather than as an unclassified tag.
  describe('total function', () => {
    test('every input returns a declared category, never undefined', () => {
      const inputs = [
        {},
        { kind: 'nonsense' },
        { kind: undefined, role: undefined },
        { kind: 'placement', linkShape: 'not-a-shape' },
        { kind: 'body', role: 'not-a-role' },
        { kind: null, role: null, linkShape: null, inheritanceFact: null },
      ]
      for (const input of inputs) {
        const category = karlCategory(input)
        expect(Object.keys(KARL_CATEGORIES)).toContain(category)
      }
    })

    test('an unrecognized input lands in the named default', () => {
      expect(karlCategory({})).toBe('block')
    })
  })

  test('every category declares a label and a hint for the legend', () => {
    for (const [id, meta] of Object.entries(KARL_CATEGORIES)) {
      expect(typeof meta.label).toBe('string')
      expect(meta.label.length).toBeGreaterThan(0)
      expect(typeof meta.hint).toBe('string')
      expect(meta.hint.length).toBeGreaterThan(0)
      expect(id).toBe(id.toLowerCase())
    }
  })

  test('there are exactly six categories', () => {
    // Five from the brief plus `editor`, which the brief's five do not cover:
    // a QA note is not a Karl field at all and must stay visually distinct
    // from anything publishable.
    expect(Object.keys(KARL_CATEGORIES).sort()).toEqual([
      'action',
      'block',
      'callout',
      'editor',
      'inherited',
      'metadata',
    ])
  })
})
