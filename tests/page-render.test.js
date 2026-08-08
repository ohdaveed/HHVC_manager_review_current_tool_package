// Regression suite: every render* function in js/page-render.js must escape
// page-data field values before they reach innerHTML. This is the review
// tool's main HTML-building path, so an unescaped field here is an XSS
// regression the same shape as the one fixed in the workshop request form.
import { describe, test, expect } from 'bun:test'

// Importing js/page-render.js pulls in js/utils.js, js/karl-tag-meta.js and
// js/state.js through the module graph — the same three files the old vm
// harness had to be handed explicitly, now resolved by the loader. The
// happy-dom environment preloaded via bunfig.toml is what lets that chain
// evaluate here, since js/state.js reads window.HHVC_DATA on import.
import * as ctx from '../js/page-render.js'

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

  test('renderCards appends an unverified pill when card.unverified is true', () => {
    const html = ctx.renderCards([{ title: 'Card', text: 'Claim', unverified: true }])
    expect(html).toContain('<p>Claim<span class="unverified-pill">')
  })

  test('renderCards omits the pill when card.unverified is not set', () => {
    const html = ctx.renderCards([{ title: 'Card', text: 'Claim' }])
    expect(html).not.toContain('unverified-pill')
  })

  test('renderRelatedList passes the unverified pill through from renderCards', () => {
    const html = ctx.renderRelatedList([{ title: 'Related', text: 'Claim', unverified: true }])
    expect(html).toContain('<p>Claim<span class="unverified-pill">')
  })

  test('renderServiceTiles appends an unverified pill when card.unverified is true (button branch, no url)', () => {
    const html = ctx.renderServiceTiles([{ title: 'Tile', text: 'Claim', unverified: true }])
    expect(html).toContain('<span class="service-tile-text">Claim<span class="unverified-pill">')
  })

  test('renderServiceTiles appends an unverified pill when card.unverified is true (anchor branch, with url)', () => {
    const html = ctx.renderServiceTiles([
      { title: 'Tile', text: 'Claim', url: 'https://example.com', unverified: true },
    ])
    expect(html).toContain('<span class="service-tile-text">Claim<span class="unverified-pill">')
  })

  test('renderResourcesList appends an unverified pill when card.unverified is true', () => {
    const html = ctx.renderResourcesList([{ title: 'Resource', text: 'Claim', unverified: true }])
    expect(html).toContain('<p>Claim<span class="unverified-pill">')
  })

  test('renderRelatedRail appends an unverified pill when card.unverified is true', () => {
    const html = ctx.renderRelatedRail([
      { cards: [{ title: 'Related', text: 'Claim', unverified: true }] },
    ])
    expect(html).toContain('<p>Claim<span class="unverified-pill">')
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

// escapeHtml does not neutralize a URL scheme — `javascript:alert(1)` contains
// none of the five characters it escapes — so every href the renderer emits
// runs through safeUrl first. The AI assist preview renders model-generated
// pages through these same functions, which is what makes this reachable.
describe('page-render.js URL scheme guarding', () => {
  const DANGEROUS = 'javascript:alert(1)'

  test('button neutralizes a javascript: url', () => {
    const html = ctx.button('Go', 'primary', null, DANGEROUS)
    expect(html).toContain('href="#"')
    expect(html).not.toContain('javascript:')
  })

  test('renderCards neutralizes a javascript: card url', () => {
    const html = ctx.renderCards([{ title: 'Click me', url: DANGEROUS }])
    expect(html).toContain('href="#"')
    expect(html).not.toContain('javascript:')
  })

  test('renderServiceTiles neutralizes a javascript: card url', () => {
    const html = ctx.renderServiceTiles([{ title: 'Click me', url: DANGEROUS }])
    expect(html).toContain('href="#"')
    expect(html).not.toContain('javascript:')
  })

  test('renderResourcesList neutralizes a javascript: card url', () => {
    const html = ctx.renderResourcesList([{ title: 'Click me', url: DANGEROUS }])
    expect(html).toContain('href="#"')
    expect(html).not.toContain('javascript:')
  })

  test('renderRelatedList neutralizes a javascript: card url', () => {
    const html = ctx.renderRelatedList([{ title: 'Click me', url: DANGEROUS }])
    expect(html).toContain('href="#"')
    expect(html).not.toContain('javascript:')
  })

  test('keeps a legitimate https url intact', () => {
    const html = ctx.renderCards([{ title: 'CDC', url: 'https://www.cdc.gov/rodents/' }])
    expect(html).toContain('href="https://www.cdc.gov/rodents/"')
  })

  test('keeps the root-relative workshop form path intact', () => {
    const html = ctx.button('Request', 'primary', null, '/forms/mosquito-workshop-request/')
    expect(html).toContain('href="/forms/mosquito-workshop-request/"')
  })
})

// The AI-rewrite-selection feature needs a DOM node to trace back to the
// page-data field it came from. `data-rewrite-field` carries that dot-path.
// The delicate part is the index: partitionSections() redistributes
// page.sections into fixed-order layout buckets that are NOT source order
// (see the last test below), so the attribute must always be built from the
// section's original position in page.sections, never from render order.
describe('data-rewrite-field annotation', () => {
  test('annotates section paragraphs with their source index', () => {
    const html = ctx.paragraphList(['one', 'two'], 'sections.0.paragraphs')
    expect(html).toContain('data-rewrite-field="sections.0.paragraphs.0"')
    expect(html).toContain('data-rewrite-field="sections.0.paragraphs.1"')
  })

  test('annotates bullets with their source index', () => {
    const html = ctx.bulletList(['a', 'b'], 'sections.3.bullets')
    expect(html).toContain('data-rewrite-field="sections.3.bullets.0"')
    expect(html).toContain('data-rewrite-field="sections.3.bullets.1"')
  })

  test('annotates step text and step bullets under the step index', () => {
    const html = ctx.renderSteps(
      [{ title: 'Step', text: ['t'], bullets: ['b'] }],
      'sections.1.steps'
    )
    expect(html).toContain('data-rewrite-field="sections.1.steps.0.text.0"')
    expect(html).toContain('data-rewrite-field="sections.1.steps.0.bullets.0"')
  })

  test('emits no attribute when no path prefix is passed', () => {
    expect(ctx.paragraphList(['one'])).not.toContain('data-rewrite-field')
    expect(ctx.bulletList(['one'])).not.toContain('data-rewrite-field')
    expect(ctx.renderSteps([{ title: 'S', text: ['t'] }])).not.toContain('data-rewrite-field')
  })

  // The regression this whole addressing scheme exists to prevent. 'related'
  // sections are rendered LAST regardless of source order, so a path built
  // from render order would point at the wrong section entirely.
  test('uses the original page.sections index, not the rendered order', () => {
    const page = {
      slug: 'x',
      type: 'Information',
      title: 'X',
      summary: 'S',
      audience: ['a'],
      reading: 'Grade 6',
      sections: [
        { heading: 'Related things', component: 'related', karl: 'k', cards: [] },
        { heading: 'Body', karl: 'k', paragraphs: ['body copy'] },
      ],
    }
    const html = ctx.renderPageMain(page)
    // The body section is index 1 in source even though it renders before the
    // related section.
    expect(html).toContain('data-rewrite-field="sections.1.paragraphs.0"')
    expect(html).not.toContain('data-rewrite-field="sections.0.paragraphs.0"')
  })
})
