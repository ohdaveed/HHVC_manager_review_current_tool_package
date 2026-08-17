// Coverage for parseKarlLabel(), the free-text-to-display-parts splitter
// behind the redesigned Karl tag. The `karl` notes across pages/*.js use
// wildly inconsistent conventions (`Field: value`, `Field = value`, `->`
// chains, bare rationale, terse one-liners), so the function trusts only one
// separator (a leading `->`/`→` chain in the note's OWN first sentence) and
// otherwise just splits at the first sentence boundary. What matters here is
// that it never drops or garbles content — every fixture below is checked
// for that, not just for the "happy path" split.
//
// This header quoted "~350 notes" until 2026-08-15, against a real 308. The
// number was never checked by anything and carried no weight in the argument
// (the notes are inconsistent whatever their count), so it is deleted rather
// than corrected — the repo's own rule, from tests/doc-counts.test.js: quote a
// number only if something here can verify it, because an unverified one reads
// as authoritative.
import { describe, test, expect } from 'bun:test'
import {
  guideCopyValues,
  guideStatusLabel,
  normalizeKarlGuide,
  parseKarlLabel,
  renderKarlGuidePanel,
} from '../js/karl-tag-meta.js'

/** Strip whitespace/punctuation (including the `->`/`→` separator itself,
 *  which is structural, not content) so two strings can be compared for the
 *  same CONTENT regardless of how parseKarlLabel re-joined/re-trimmed it. */
function contentOf(s) {
  return s.toLowerCase().replace(/[\s.!?,;:'"()<>\-–—→]/g, '')
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
    expect(parseKarlLabel('BLOCKED — pending SME confirmation of the fee schedule.').flagged).toBe(
      true
    )
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
    expect(parseKarlLabel('')).toEqual({
      breadcrumb: [],
      headline: '',
      rationale: '',
      flagged: false,
    })
    expect(parseKarlLabel(undefined)).toEqual({
      breadcrumb: [],
      headline: '',
      rationale: '',
      flagged: false,
    })
  })
})

describe('structured Karl guides', () => {
  test('builds the canonical Agency subsection path and ordered steps', () => {
    const guide = normalizeKarlGuide({
      page: { type: 'Agency', title: 'Program', summary: 'Summary.' },
      context: { role: 'services', linkShape: 'resources-list' },
    })
    expect(guide.path).toBe('Content → Section title 1 → Subsection → Links')
    expect(guide.steps[0]).toContain('Add child page → Agency')
    expect(guide.steps[1]).toContain('Section title 1')
    expect(guide.evidence).toBe('E1')
  })

  test('unresolved mappings never expose a guessed path', () => {
    const guide = normalizeKarlGuide({
      page: { type: 'Report' },
      context: { role: 'content' },
      guide: {
        unresolvedId: 'U1',
        status: 'unresolved',
        evidence: 'U',
        steps: ['Decision required.'],
      },
    })
    expect(guide.path).toBe('')
    expect(guide.status).toBe('unresolved')
    expect(guide.unresolvedId).toBe('U1')
    expect(guideStatusLabel(guide)).toBe('U1 unresolved')
  })

  test('resolves an About us page against the hyphenated normalized key', () => {
    // normalizePageType('About us') is 'about-us'; both registry tables were
    // keyed 'about', so every About-us tag without an explicit karlGuide
    // resolved to no path at all and reported as unmapped. The label survived
    // that mismatch (it falls back to the raw type string), so only the path
    // is proof the keys agree.
    const guide = normalizeKarlGuide({
      page: { type: 'About us' },
      context: { role: 'resources', linkShape: 'resources-list' },
    })
    expect(guide.path).toBe('Content → Resources → Resources section → Links')
    expect(guide.steps[0]).toContain('Add child page → About us')
  })

  test('routes page metadata to the Content and Promote tabs, not the body stream', () => {
    // Title, Description and Slug are identical across all eight measured
    // types (docs/karl-export-field-map.md, Promote tab / per-type Content
    // tables), so they must never resolve through the per-type body path —
    // that told an Agency reviewer to paste the page summary into
    // `Content → About → About description`.
    const title = normalizeKarlGuide({ page: { type: 'Agency' }, context: { role: 'title' } })
    expect(title.path).toBe('Content → Title')
    expect(title.steps.some((step) => step.includes('Promote'))).toBe(true)

    const description = normalizeKarlGuide({
      page: { type: 'Agency' },
      context: { role: 'description' },
    })
    expect(description.path).toBe('Content → Description')
  })

  test('reports a tag kind with no role as mockup-only rather than guessing a path', () => {
    // A call site that passes no context.role leaves guideForContext falling
    // back to the tag KIND. 'placement' and 'meta' name no Karl field, and a
    // resolved path is stamped "E1 confirmed" — so a body-path fallback here
    // renders a guess as a measurement.
    for (const role of ['placement', 'meta', 'editor']) {
      const guide = normalizeKarlGuide({ page: { type: 'Agency' }, context: { role } })
      expect(guide.path).toBe('')
      expect(guide.status).toBe('mockup-only')
      expect(guideStatusLabel(guide)).toBe('Mockup only')
    }
  })

  test('keeps Services and Resources on their own Agency subsections', () => {
    // Both render through renderResourcesList(), which used to hardcode the
    // Resources role for everything that was not Related — so a Services list
    // printed the Resources path directly under the Services region heading.
    const services = normalizeKarlGuide({
      page: { type: 'Agency' },
      context: { role: 'services', linkShape: 'resources-list' },
    })
    const resources = normalizeKarlGuide({
      page: { type: 'Agency' },
      context: { role: 'resources', linkShape: 'resources-list' },
    })
    expect(services.path).toBe('Content → Section title 1 → Subsection → Links')
    expect(resources.path).toBe('Content → Section title 2 → Subsection → Links')
  })

  test('copies only safe visible values and preserves source labels', () => {
    expect(
      guideCopyValues([
        { label: 'Title', value: 'Visible title', source: 'inherited' },
        { label: '', value: 'discarded' },
        { label: 'URL', value: 'https://example.test', source: 'visible' },
      ])
    ).toEqual([
      { label: 'Title', value: 'Visible title', source: 'inherited' },
      { label: 'URL', value: 'https://example.test', source: 'visible' },
    ])
  })

  test('escapes guide values and renders copy controls', () => {
    const html = renderKarlGuidePanel(
      normalizeKarlGuide({
        page: { type: 'Agency' },
        guide: {
          path: 'Content → Body',
          steps: ['Paste the visible value.'],
          values: [{ label: 'Title', value: '<script>alert(1)</script>' }],
        },
      }),
      'guide-test'
    )
    expect(html).toContain('id="guide-test"')
    expect(html).toContain('Copy Title')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toContain('<script>')
  })
})
