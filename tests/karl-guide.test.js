import { describe, expect, test } from 'bun:test'
import {
  guideCopyValues,
  guideStatusLabel,
  normalizeKarlGuide,
  renderKarlGuidePanel,
} from '../js/karl-tag-meta.js'

const page = { type: 'Agency', title: 'Program', summary: 'Summary.' }

describe('structured Karl guides', () => {
  test('builds the canonical Agency subsection path and ordered steps', () => {
    const guide = normalizeKarlGuide({
      page,
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
      guide: { unresolvedId: 'U1', status: 'unresolved', evidence: 'U', steps: ['Decision required.'] },
    })
    expect(guide.path).toBe('')
    expect(guide.status).toBe('unresolved')
    expect(guide.unresolvedId).toBe('U1')
    expect(guideStatusLabel(guide)).toBe('U1 unresolved')
  })

  test('copies only safe visible values and preserves source labels', () => {
    const values = guideCopyValues([
      { label: 'Title', value: 'Visible title', source: 'inherited' },
      { label: '', value: 'discarded' },
      { label: 'URL', value: 'https://example.test', source: 'visible' },
    ])
    expect(values).toEqual([
      { label: 'Title', value: 'Visible title', source: 'inherited' },
      { label: 'URL', value: 'https://example.test', source: 'visible' },
    ])
  })

  test('escapes guide values and renders copy controls', () => {
    const html = renderKarlGuidePanel(
      normalizeKarlGuide({
        page,
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
