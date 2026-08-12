// Coverage for parseKarlLabel(), the free-text-to-display-parts splitter
// behind the redesigned Karl tag. The ~350 `karl` notes across pages/*.js use
// wildly inconsistent conventions (`Field: value`, `Field = value`, `->`
// chains, bare rationale, terse one-liners), so the function trusts only one
// separator (a leading `->`/`→` chain in the note's OWN first sentence) and
// otherwise just splits at the first sentence boundary. What matters here is
// that it never drops or garbles content — every fixture below is checked
// for that, not just for the "happy path" split.
import { describe, test, expect } from 'bun:test'
import { parseKarlLabel } from '../js/karl-tag-meta.js'

/** Strip whitespace/punctuation (including the `->`/`→` separator itself,
 *  which is structural, not content) so two strings can be compared for the
 *  same CONTENT regardless of how parseKarlLabel re-joined/re-trimmed it. */
function contentOf(s) {
  return s
    .toLowerCase()
    .replace(/[\s.!?,;:'"()<>\-–—→]/g, '')
}

/** Assert nothing was dropped: every character of the original survives in
 *  some combination of breadcrumb + headline + rationale. */
function assertNoContentLost(original, parsed) {
  const reconstructed = [...parsed.breadcrumb, parsed.headline, parsed.rationale].join(' ')
  expect(contentOf(reconstructed)).toBe(contentOf(original))
}

describe('parseKarlLabel', () => {
  test('splits a leading arrow chain in the first sentence into a breadcrumb', () => {
    const label = 'Transaction -> Steps -> Step type field. Rationale sentence here.'
    const parsed = parseKarlLabel(label)
    expect(parsed.breadcrumb).toEqual(['Transaction', 'Steps'])
    expect(parsed.headline).toBe('Step type field')
    expect(parsed.rationale).toBe('Rationale sentence here.')
    expect(parsed.flagged).toBe(false)
    assertNoContentLost(label, parsed)
  })

  test('does not treat an arrow appearing only in later rationale prose as a breadcrumb', () => {
    // Regression guard: this is the exact shape a naive "split on any arrow"
    // parser gets wrong — the arrows here describe a field mapping in
    // running text, not a CMS location path.
    const label =
      'Maps to the top-level Introductory text field. Heading -> Title, paragraphs -> Text.'
    const parsed = parseKarlLabel(label)
    expect(parsed.breadcrumb).toEqual([])
    expect(parsed.headline).toBe('Maps to the top-level Introductory text field')
    expect(parsed.rationale).toBe('Heading -> Title, paragraphs -> Text.')
    assertNoContentLost(label, parsed)
  })

  test('splits plain prose with no arrow at the first sentence boundary', () => {
    const label =
      'Related panel page chooser entry. This is the appropriate route for a Notice of Violation, not the annual-fee payment path.'
    const parsed = parseKarlLabel(label)
    expect(parsed.breadcrumb).toEqual([])
    expect(parsed.headline).toBe('Related panel page chooser entry')
    expect(parsed.rationale).toBe(
      'This is the appropriate route for a Notice of Violation, not the annual-fee payment path.'
    )
    assertNoContentLost(label, parsed)
  })

  test('folds a too-short first sentence forward instead of rendering a fragment', () => {
    const label = 'Transaction -> Steps -> Step. Step type: number. Optional and Cost remain blank.'
    const parsed = parseKarlLabel(label)
    expect(parsed.breadcrumb).toEqual(['Transaction', 'Steps'])
    // "Step" alone (4 chars) is too short to stand as a headline, so the next
    // sentence folds in rather than rendering a bare fragment.
    expect(parsed.headline).toContain('Step')
    expect(parsed.headline.length).toBeGreaterThanOrEqual(12)
    expect(parsed.rationale).toBe('Optional and Cost remain blank.')
    assertNoContentLost(label, parsed)
  })

  test('falls back to the whole trimmed string when there is no punctuation at all', () => {
    const label = 'Body callout'
    const parsed = parseKarlLabel(label)
    expect(parsed.breadcrumb).toEqual([])
    expect(parsed.headline).toBe('Body callout')
    expect(parsed.rationale).toBe('')
  })

  test('never crashes when a too-short headline has no rationale left to fold in', () => {
    const parsed = parseKarlLabel('Body')
    expect(parsed.headline).toBe('Body')
    expect(parsed.rationale).toBe('')
  })

  test('handles the XSS-payload fixture used by page-render.test.js identically to a plain string', () => {
    // No `.`/`!`/`?` anywhere in this payload — must render exactly as well
    // as today's flat string (whole thing as the headline, no rationale).
    const payload = `<script>alert('xss')</script>`
    const parsed = parseKarlLabel(payload)
    expect(parsed.breadcrumb).toEqual([])
    expect(parsed.headline).toBe(payload)
    expect(parsed.rationale).toBe('')
  })

  test('flags an explicit editorial hold', () => {
    expect(
      parseKarlLabel('BLOCKED — pending SME confirmation of the fee schedule.').flagged
    ).toBe(true)
  })

  test('flags a note asking to route to Digital Services', () => {
    const label =
      'External-URL card, same mapping gap as the siblings above; flag for Digital Services rather than forcing a home.'
    expect(parseKarlLabel(label).flagged).toBe(true)
  })

  test('does not flag an ordinary settled placement note', () => {
    expect(parseKarlLabel('Agency -> Services subsection -> page chooser entry.').flagged).toBe(
      false
    )
  })

  test('returns empty parts for an empty or non-string label', () => {
    expect(parseKarlLabel('')).toEqual({ breadcrumb: [], headline: '', rationale: '', flagged: false })
    expect(parseKarlLabel(undefined)).toEqual({
      breadcrumb: [],
      headline: '',
      rationale: '',
      flagged: false,
    })
  })
})
