// Regression suite: every render* function in js/page-render.js must escape
// page-data field values before they reach innerHTML. This is the review
// tool's main HTML-building path, so an unescaped field here is an XSS
// regression the same shape as the one fixed in the workshop request form.
const { describe, test, expect } = require('bun:test')
const { loadScripts } = require('./helpers/load-scripts')

const ctx = loadScripts(['js/utils.js', 'js/karl-tag-meta.js', 'js/page-render.js'])

const PAYLOAD = `<script>alert('xss')</script>`
const ESCAPED = `&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;`

function assertEscaped(html) {
  expect(html).not.toContain(PAYLOAD)
  expect(html).toContain(ESCAPED)
}

describe('page-render.js escaping', () => {
  test('karlTag escapes its label', () => {
    assertEscaped(ctx.karlTag(PAYLOAD))
  })

  test('karlTag includes an explicit kind label', () => {
    const html = ctx.karlTag('Section heading', 'body')
    expect(html).toContain('class="karl-tag-kind"')
    expect(html).toContain('>Body</span>')
    expect(html).toContain('data-kind="body"')
  })

  test('paragraphList escapes every paragraph', () => {
    assertEscaped(ctx.paragraphList([PAYLOAD]))
  })

  test('paragraphList renders an unverified pill after a flagged paragraph', () => {
    const html = ctx.paragraphList([
      { text: 'Flagged claim', unverified: true, unverifiedReason: 'Confirm with SME' },
    ])
    expect(html).toBe(
      '<p>Flagged claim<span class="unverified-pill" title="Confirm with SME"><span aria-hidden="true">⚠</span> Unverified</span></p>'
    )
  })

  test('paragraphList leaves a plain string paragraph unchanged', () => {
    expect(ctx.paragraphList(['Plain claim'])).toBe('<p>Plain claim</p>')
  })

  test('bulletList renders an unverified pill after a flagged bullet', () => {
    const html = ctx.bulletList([{ text: 'Flagged claim', unverified: true }])
    expect(html).toContain('<li>Flagged claim<span class="unverified-pill">')
  })

  test('bulletList omits the title attribute when there is no unverifiedReason', () => {
    const html = ctx.bulletList([{ text: 'Flagged claim', unverified: true }])
    expect(html).not.toContain('title=')
  })

  test('bulletList escapes the unverifiedReason tooltip', () => {
    const html = ctx.bulletList([
      { text: 'Flagged claim', unverified: true, unverifiedReason: PAYLOAD },
    ])
    assertEscaped(html)
  })

  test('bulletList handles a mix of plain strings and unverified objects', () => {
    const html = ctx.bulletList(['Plain', { text: 'Flagged', unverified: true }])
    expect(html).toContain('<li>Plain</li>')
    expect(html).toContain('<li>Flagged<span class="unverified-pill">')
  })

  test('renderTextItems uses bullets for three or more items', () => {
    const html = ctx.renderTextItems(['One', 'Two', 'Three'])
    expect(html).toContain('<ul>')
    expect(html).toContain('<li>One</li>')
    expect(html).not.toContain('<p>One</p>')
  })

  test('renderTextItems keeps one or two items as paragraphs', () => {
    const html = ctx.renderTextItems(['One', 'Two'])
    expect(html).toContain('<p>One</p>')
    expect(html).not.toContain('<ul>')
  })

  test('renderAudience escapes every audience item', () => {
    assertEscaped(ctx.renderAudience([PAYLOAD]))
  })

  test('renderAudience tolerates non-array input', () => {
    expect(ctx.renderAudience(undefined)).toBe('')
  })

  test('bulletList escapes every bullet', () => {
    assertEscaped(ctx.bulletList([PAYLOAD]))
  })

  test('button escapes label, internal target, and external url', () => {
    assertEscaped(ctx.button(PAYLOAD, 'primary', PAYLOAD, null))
    assertEscaped(ctx.button('Go', 'secondary', null, `https://example.com/${PAYLOAD}`))
  })

  test('renderCards escapes title, text, and url for every card', () => {
    const html = ctx.renderCards([{ title: PAYLOAD, text: PAYLOAD, url: PAYLOAD }])
    assertEscaped(html)
  })

  test('renderRelatedList uses the cards grid layout', () => {
    const html = ctx.renderRelatedList(
      [{ title: 'Report mold', target: 'moldReport' }],
      'Related pages'
    )
    expect(html).toContain('class="section section--related"')
    expect(html).toContain('class="cards"')
    expect(html).toContain('class="card"')
    expect(html).toContain('data-render-target="moldReport"')
    expect(html).not.toContain('class="related-list"')
  })

  test('renderTable escapes header and body cells', () => {
    const html = ctx.renderTable([
      [PAYLOAD, 'Header 2'],
      [PAYLOAD, 'cell'],
    ])
    assertEscaped(html)
  })

  test('renderTable returns empty string for no rows', () => {
    expect(ctx.renderTable([])).toBe('')
  })

  test('renderTable emits code-translation variant for health code headers', () => {
    const html = ctx.renderTable(
      [
        ['Health code', 'In plain language'],
        ['**Sec. 581(a):** No nuisance.', 'You must not allow a public health nuisance.'],
      ],
      'information',
      'Mold and mildew'
    )
    expect(html).toContain('table--code-translation')
    expect(html).toContain('scope="col"')
    expect(html).toContain('scope="row"')
    expect(html).toContain('code-translation-figure')
    expect(html).toContain('Mold and mildew')
    expect(html).toContain('mockup-only-note')
  })

  test('renderTable on Report pages omits Information-only table warning', () => {
    const html = ctx.renderTable(
      [
        ['Health code', 'In plain language'],
        ['**Sec. 581(a):** No nuisance.', 'You must not allow a public health nuisance.'],
      ],
      'report',
      'About this guide'
    )
    expect(html).toContain('table--code-translation')
    expect(html).not.toContain('mockup-only-note')
  })

  test('renderSteps escapes step title, text, bullets, and callout text', () => {
    const html = ctx.renderSteps([
      {
        title: PAYLOAD,
        text: [PAYLOAD],
        bullets: [PAYLOAD],
        callout: { text: PAYLOAD },
      },
    ])
    assertEscaped(html)
  })

  test('renderSection escapes heading, paragraphs, bullets, and callout', () => {
    const html = ctx.renderSection({
      heading: PAYLOAD,
      paragraphs: [PAYLOAD],
      bullets: [PAYLOAD],
      callout: { text: PAYLOAD },
      karl: 'Body section',
    })
    assertEscaped(html)
  })

  test('renderSection escapes a section-level button label', () => {
    const html = ctx.renderSection({ heading: 'Heading', button: PAYLOAD, karl: 'Body section' })
    assertEscaped(html)
  })
})
