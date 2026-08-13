/* Unit coverage for js/inline-link-target.js — the single definition of what an
   inline link target may be, shared by the browser widget
   (js/inline-content-edit-link-tool.js typing one, js/inline-content-edit.js
   committing a pasted one) and by build_scripts/data-checks.js's
   findBrokenInlineLinks() walking authored pages/*.js copy.

   The whole point of the module is that there is exactly one rule rather than
   two implementations free to drift, so these tests pin the rule itself rather
   than either caller's use of it. They import the module directly under Bun,
   which is what the dual export exists for. */

import { describe, test, expect } from 'bun:test'

const { isValidInlineLinkTarget, INLINE_LINK_TARGET_RULE } = require('../js/inline-link-target.js')

// A stand-in for what window.pageRegistry.knownKeys() returns in the browser and
// for Object.keys(pages) on the Node side: `hiddenPage` models a page the
// reviewer deleted, which stays known because Restore can bring it back.
const KNOWN = new Set(['pestsTopic', 'rodentsProblem', 'hiddenPage'])

describe('isValidInlineLinkTarget', () => {
  test('accepts a live page key', () => {
    expect(isValidInlineLinkTarget('rodentsProblem', KNOWN)).toBe(true)
  })

  test('accepts a key the reviewer has hidden, since Restore can bring it back', () => {
    // Deliberately NOT gated on DATA.pages: validating against the visible set
    // only would make deleting one page silently invalidate prose on other
    // pages that link to it, turning a reversible action into a destructive one.
    expect(isValidInlineLinkTarget('hiddenPage', KNOWN)).toBe(true)
  })

  test('rejects a key that does not exist', () => {
    expect(isValidInlineLinkTarget('rodentsProbelm', KNOWN)).toBe(false)
  })

  test('accepts the inert # sentinel', () => {
    expect(isValidInlineLinkTarget('#', KNOWN)).toBe(true)
  })

  test('accepts an https URL', () => {
    expect(isValidInlineLinkTarget('https://sf.gov/311', KNOWN)).toBe(true)
  })

  test('accepts a plain http URL', () => {
    expect(isValidInlineLinkTarget('http://example.gov/a', KNOWN)).toBe(true)
  })

  test('accepts an https URL padded with whitespace', () => {
    // The target is trimmed before testing rather than compared against its own
    // untrimmed self. formatMarkdown()'s capture is `([^)]+)`, so a padded
    // target arrives WITH its whitespace, and the question this rule asks is
    // about the scheme, not about whitespace hygiene.
    expect(isValidInlineLinkTarget('  https://sf.gov/311  ', KNOWN)).toBe(true)
  })

  test('trims before matching a page key too', () => {
    expect(isValidInlineLinkTarget(' rodentsProblem ', KNOWN)).toBe(true)
  })

  test('rejects a javascript: scheme', () => {
    expect(isValidInlineLinkTarget('javascript:alert(1)', KNOWN)).toBe(false)
  })

  test('rejects a data: scheme', () => {
    expect(isValidInlineLinkTarget('data:text/html,<script>', KNOWN)).toBe(false)
  })

  test('rejects a protocol-relative URL, which leaves the origin', () => {
    expect(isValidInlineLinkTarget('//evil.example/a', KNOWN)).toBe(false)
  })

  test('rejects mailto:, which formatMarkdown would render as a dead button', () => {
    // Not a scheme judgement — safeUrl() itself permits mailto:. It is
    // rejected because formatMarkdown()'s branch is /^https?:\/\//, so a
    // mailto: target becomes <button data-render-target="mailto:..."> and does
    // nothing when clicked. Accepting it here would require widening the
    // renderer, which paints every page of the mockup.
    expect(isValidInlineLinkTarget('mailto:hhvc@sfdph.org', KNOWN)).toBe(false)
  })

  test('rejects tel:, for the same renderer reason as mailto:', () => {
    expect(isValidInlineLinkTarget('tel:+14155551234', KNOWN)).toBe(false)
  })

  test('rejects a root-relative path, for the same renderer reason', () => {
    expect(isValidInlineLinkTarget('/forms/mosquito-workshop-request', KNOWN)).toBe(false)
  })

  test('rejects the empty string', () => {
    expect(isValidInlineLinkTarget('', KNOWN)).toBe(false)
  })

  test('rejects a whitespace-only target', () => {
    expect(isValidInlineLinkTarget('   ', KNOWN)).toBe(false)
  })

  test('rejects null and undefined without throwing', () => {
    // The browser callers read this value out of a DOM attribute or an <input>,
    // and the Node caller reads it out of a regex capture on authored copy —
    // neither guarantees a string reaches here.
    expect(isValidInlineLinkTarget(null, KNOWN)).toBe(false)
    expect(isValidInlineLinkTarget(undefined, KNOWN)).toBe(false)
  })

  test('accepts an array of keys as well as a Set', () => {
    // build_scripts/data-checks.js builds a Set; the browser's
    // pageRegistry.knownKeys() returns an array. Accepting both is what lets
    // one predicate serve both callers with no adapter at either site.
    expect(isValidInlineLinkTarget('rodentsProblem', ['rodentsProblem'])).toBe(true)
    expect(isValidInlineLinkTarget('rodentsProblem', [])).toBe(false)
  })

  test('treats a missing key collection as "no keys", not as "everything valid"', () => {
    // Failing open here would be the worst available default: the widget would
    // silently accept every typo during the window before page data loads.
    expect(isValidInlineLinkTarget('rodentsProblem', undefined)).toBe(false)
    expect(isValidInlineLinkTarget('https://sf.gov/311', undefined)).toBe(true)
  })

  test('does not treat an inherited Object.prototype name as a known key', () => {
    // A page key becomes an object property elsewhere in this tool, and
    // `toString`/`valueOf` satisfy the key pattern while being invisible to
    // Object.keys(). A plain-object key collection must not answer true for
    // them. Mirrors the hasOwn discipline in js/page-registry-data.js.
    expect(isValidInlineLinkTarget('toString', {})).toBe(false)
    expect(isValidInlineLinkTarget('hasOwnProperty', {})).toBe(false)
  })

  test('accepts a plain object keyed by page key, as data-checks.js holds pages', () => {
    expect(isValidInlineLinkTarget('rodentsProblem', { rodentsProblem: {} })).toBe(true)
  })
})

describe('findInvalidInlineLinkTargets', () => {
  const { findInvalidInlineLinkTargets } = require('../js/inline-link-target.js')

  test('returns nothing for text with no links at all', () => {
    expect(findInvalidInlineLinkTargets('Plain copy about rodents.', KNOWN)).toEqual([])
  })

  test('returns nothing when every link is valid', () => {
    const text = 'See [rodents](rodentsProblem), [311](https://sf.gov/311) and [tbd](#).'
    expect(findInvalidInlineLinkTargets(text, KNOWN)).toEqual([])
  })

  test('returns the target of a single broken link', () => {
    expect(findInvalidInlineLinkTargets('Go to [ghost](ghostPage).', KNOWN)).toEqual(['ghostPage'])
  })

  test('returns every broken target, in the order they appear', () => {
    // The refusal notice counts them ("Remove broken links (N)"), so a
    // deduplicating or unordered result would misreport what the reviewer is
    // about to remove.
    const text = '[a](ghostOne) then [b](rodentsProblem) then [c](ghostTwo)'
    expect(findInvalidInlineLinkTargets(text, KNOWN)).toEqual(['ghostOne', 'ghostTwo'])
  })

  test('reports the same broken target twice when it appears twice', () => {
    const text = '[a](ghost) and again [b](ghost)'
    expect(findInvalidInlineLinkTargets(text, KNOWN)).toEqual(['ghost', 'ghost'])
  })

  test('returns trimmed targets, so the notice does not quote stray whitespace', () => {
    expect(findInvalidInlineLinkTargets('[a]( ghost )', KNOWN)).toEqual(['ghost'])
  })

  test('accepts the item-field object form as well as a bare string', () => {
    // A paragraph/bullet commits as {text, unverified, unverifiedReason};
    // title/summary/heading commit as a plain string. commit() hands whichever
    // the field type produced straight to this function.
    expect(findInvalidInlineLinkTargets({ text: '[a](ghost)' }, KNOWN)).toEqual(['ghost'])
  })

  test('returns nothing for a null, undefined, or non-text value', () => {
    expect(findInvalidInlineLinkTargets(null, KNOWN)).toEqual([])
    expect(findInvalidInlineLinkTargets(undefined, KNOWN)).toEqual([])
    expect(findInvalidInlineLinkTargets({}, KNOWN)).toEqual([])
  })

  test('does not mistake a bracketed phrase with no link for a link', () => {
    expect(
      findInvalidInlineLinkTargets('A [bracketed] phrase (and a parenthetical).', KNOWN)
    ).toEqual([])
  })
})

describe('INLINE_LINK_TARGET_RULE', () => {
  test('is a reviewer-facing sentence naming all three accepted forms', () => {
    // Rendered into the link tool's visually-hidden description span, so it is
    // announced when focus enters the target input rather than only after the
    // reviewer gets it wrong. Declared here rather than in the widget so the
    // rule and its description cannot come to disagree.
    expect(INLINE_LINK_TARGET_RULE).toContain('page key')
    expect(INLINE_LINK_TARGET_RULE).toContain('https://')
    expect(INLINE_LINK_TARGET_RULE).toContain('#')
  })
})
