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
import { pageData } from '../js/state.js'
import { escapeHtml } from '../js/utils.js'

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

  test('karlTag escapes an XSS payload split across the headline and rationale spans', () => {
    // parseKarlLabel() (js/karl-tag-meta.js) divides a note into separate
    // headline/rationale spans, each escaped independently — this proves
    // neither half leaks the raw payload and each renders its own escaped
    // fragment, not just that the whole markup string happens to contain one.
    const html = ctx.karlTag(`Body: ${PAYLOAD}. Trailing rationale text.`, 'body')
    expect(html).not.toContain(PAYLOAD)
    const headlineMatch = html.match(/<span class="karl-tag-headline">(.*?)<\/span>/)
    const rationaleMatch = html.match(/<span class="karl-tag-rationale">(.*?)<\/span>/)
    expect(headlineMatch[1]).toContain(ESCAPED)
    expect(rationaleMatch[1]).toBe('Trailing rationale text.')
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
    expect(html).toContain('<p>Claim<span class="unverified-pill">')
  })

  test('renderServiceTiles appends an unverified pill when card.unverified is true (anchor branch, with url)', () => {
    const html = ctx.renderServiceTiles([
      { title: 'Tile', text: 'Claim', url: 'https://example.com', unverified: true },
    ])
    expect(html).toContain('<p>Claim<span class="unverified-pill">')
  })

  test('renderResourcesList appends an unverified pill when card.unverified is true', () => {
    const html = ctx.renderResourcesList([{ title: 'Resource', text: 'Claim', unverified: true }])
    expect(html).toContain('<p>Claim<span class="unverified-pill">')
  })

  test('renderRelatedList uses the same plain divided-list layout as Resources', () => {
    const html = ctx.renderRelatedList(
      [{ title: 'Report mold', target: 'moldReport' }],
      'Related pages'
    )
    expect(html).toContain('class="section section--related"')
    expect(html).toContain('class="resources-list"')
    expect(html).toContain('data-render-target="moldReport"')
    expect(html).not.toContain('class="cards"')
    expect(html).not.toContain('class="card"')
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

describe('Transaction page layout', () => {
  test('renders Related as a plain bottom section, not a sidebar rail', () => {
    const page = {
      type: 'Transaction',
      title: 'Report a thing',
      summary: 'Summary.',
      audience: ['Someone'],
      reading: 'Grade 6',
      sections: [
        {
          heading: 'Related',
          karl: 'Related panel: linked pages',
          component: 'related',
          cards: [{ title: 'Other page', target: 'scopeInfo' }],
        },
      ],
    }
    const html = ctx.renderPageMain(page)
    expect(html).toContain('class="section section--related"')
    expect(html).not.toContain('related-rail')
    expect(html).not.toContain('page-layout--transaction')
  })

  test('Contact us renders H3 sub-headings, not bold inline labels', () => {
    const page = {
      type: 'Transaction',
      title: 'Report a thing',
      summary: 'Summary.',
      audience: ['Someone'],
      reading: 'Grade 6',
      contact: { phone: ['311'], email: ['ehb@sfdph.org'] },
      sections: [],
    }
    const html = ctx.renderPageMain(page)
    // One <p> per entry, each carrying its own edit path: an entry has to be
    // its own element to be separately editable, and the <div> holder the
    // editor mounts is not valid inside a <p> shared by several entries.
    expect(html).toContain('<h3>Phone</h3><p data-rewrite-field="contact.phone.0">311</p>')
    expect(html).toContain(
      '<h3>Email</h3><p data-rewrite-field="contact.email.0">ehb@sfdph.org</p>'
    )
    expect(html).not.toContain('<strong>Phone</strong>')
  })

  test('renders a Partner agencies section after Related when partnerAgencies is set', () => {
    const page = {
      type: 'Transaction',
      title: 'Report a thing',
      summary: 'Summary.',
      audience: ['Someone'],
      reading: 'Grade 6',
      partnerAgencies: [
        { title: '311 Customer Service Center', url: 'https://www.sf.gov/departments--311' },
      ],
      sections: [],
    }
    const html = ctx.renderPageMain(page)
    expect(html).toContain('class="section section--partner-agencies"')
    expect(html).toContain('>Partner agencies<')
    expect(html).toContain('311 Customer Service Center')
    const partnerIndex = html.indexOf('section--partner-agencies')
    const contactIndex = html.indexOf('class="contact-section')
    expect(partnerIndex).toBeGreaterThan(-1)
    expect(contactIndex).toBeGreaterThan(partnerIndex)
  })

  test('renders no Partner agencies section when partnerAgencies is unset', () => {
    const page = {
      type: 'Transaction',
      title: 'Report a thing',
      summary: 'Summary.',
      audience: ['Someone'],
      reading: 'Grade 6',
      sections: [],
    }
    const html = ctx.renderPageMain(page)
    expect(html).not.toContain('section--partner-agencies')
  })

  test('a Supporting information section renders as an accordion by default', () => {
    const page = {
      type: 'Transaction',
      title: 'Report a thing',
      summary: 'Summary.',
      audience: ['Someone'],
      reading: 'Grade 6',
      sections: [
        { heading: 'Other ways to report', karl: 'Supporting info', component: 'supporting' },
      ],
    }
    const html = ctx.renderPageMain(page)
    expect(html).toContain('accordion-trigger')
    expect(html).toContain('data-accordion-toggle')
    expect(html).not.toContain('class="custom-section"')
  })

  test('a Supporting information section marked flat renders as a plain Custom section', () => {
    const page = {
      type: 'Transaction',
      title: 'Report a thing',
      summary: 'Summary.',
      audience: ['Someone'],
      reading: 'Grade 6',
      sections: [
        {
          heading: 'Other ways to report',
          karl: 'Supporting info',
          component: 'supporting',
          flat: true,
        },
      ],
    }
    const html = ctx.renderPageMain(page)
    expect(html).toContain('class="custom-section"')
    expect(html).toContain(
      '<h3 id="section-other-ways-to-report" data-rewrite-field="sections.0.heading">Other ways to report</h3>'
    )
    expect(html).not.toContain('accordion-trigger')
    expect(html).not.toContain('data-accordion-toggle')
  })
})

describe('campaign page layout', () => {
  const base = {
    type: 'Campaign',
    title: 'Free workshop',
    summary: 'Summary.',
    audience: ['Someone'],
    reading: 'Grade 6',
  }

  test('shows a screen-reader-only "Campaign" eyebrow and no visible summary', () => {
    const html = ctx.renderPageMain({ ...base, sections: [] })
    expect(html).toContain('<p class="visually-hidden">Campaign</p>')
    expect(html).not.toContain('class="eyebrow')
    expect(html).not.toContain('class="summary"')
  })

  test('a component: spotlight section renders inside a blue Spotlight box with a button', () => {
    const page = {
      ...base,
      sections: [
        {
          heading: 'Request a workshop',
          karl: 'Spotlight 2',
          component: 'spotlight',
          paragraphs: ['Use the form to request a session.'],
          button: 'Request a workshop online',
          buttonUrl: '/forms/mosquito-workshop-request/',
        },
      ],
    }
    const html = ctx.renderPageMain(page)
    expect(html).toContain('class="spotlight-section"')
    expect(html).toContain('class="spotlight-section-inner"')
    expect(html).toContain('>Request a workshop<')
    expect(html).toContain('Request a workshop online')
  })

  test('a component: supporting section renders as an accordion, same as Transaction', () => {
    const page = {
      ...base,
      sections: [
        { heading: 'Who can request', karl: 'Accordion section', component: 'supporting' },
      ],
    }
    const html = ctx.renderPageMain(page)
    expect(html).toContain('accordion-trigger')
    expect(html).toContain('data-accordion-toggle')
  })

  test('a component: top-facts section renders each labeled fact as its own H3', () => {
    const page = {
      ...base,
      sections: [
        {
          heading: 'Questions before you apply',
          karl: 'Top facts',
          component: 'top-facts',
          facts: [
            { label: 'Contact', text: 'Call 311.' },
            {
              label: 'Group size',
              text: 'Up to 60 students.',
              unverified: true,
              unverifiedReason: 'Placeholder.',
            },
          ],
        },
      ],
    }
    const html = ctx.renderPageMain(page)
    expect(html).toContain('class="top-facts"')
    expect(html).toContain('<h3>Contact</h3><p>Call 311.</p>')
    expect(html).toContain('<h3>Group size</h3>')
    expect(html).toContain('unverified-pill')
  })

  test('renders Related, Partner agencies, and Contact us with a Social media block', () => {
    const page = {
      ...base,
      partnerAgencies: [{ title: 'Mosquito Control Program', target: 'mosquitoControl' }],
      contact: {
        email: ['shopdinesf@sfgov.org'],
        social: [{ platform: 'Facebook', url: 'https://www.facebook.com/shopdinesf' }],
      },
      sections: [
        {
          heading: 'Related',
          karl: 'Related links',
          component: 'related',
          cards: [{ title: 'CDC: Preventing mosquito bites', url: 'https://www.cdc.gov/' }],
        },
      ],
    }
    const html = ctx.renderPageMain(page)
    expect(html).toContain('class="section section--related"')
    expect(html).toContain('class="section section--partner-agencies"')
    expect(html).toContain('<h3>Social media</h3>')
    expect(html).toContain('>Facebook<')
  })
})

describe('topic page layout', () => {
  const base = {
    type: 'Topic',
    title: 'Healthy housing conditions',
    summary: 'Summary.',
    audience: ['Someone'],
    reading: 'Grade 6',
  }

  test('shows a visible orange "Topic" eyebrow, same treatment as Agency', () => {
    const html = ctx.renderPageMain({ ...base, sections: [] })
    expect(html).toContain('class="eyebrow eyebrow--agency"')
    expect(html).toContain('>Topic<')
  })

  test('a component: spotlight section renders inside the shared blue Spotlight box', () => {
    const page = {
      ...base,
      sections: [
        {
          heading: 'Report a housing health issue',
          karl: 'Spotlight',
          component: 'spotlight',
          paragraphs: ['Contact 311.'],
          button: 'Start a report',
          buttonTarget: 'rodentsReport',
        },
      ],
    }
    const html = ctx.renderPageMain(page)
    expect(html).toContain('class="spotlight-section"')
    expect(html).toContain('>Report a housing health issue<')
    expect(html).toContain('Start a report')
  })

  test('multiple component: services sections render as named H3 sub-groups inside one Services region', () => {
    const page = {
      ...base,
      sections: [
        {
          heading: 'General housing issues',
          karl: 'Services block 1',
          component: 'services',
          cards: [
            { title: 'Report rats, mice, and other four-legged problems', target: 'rodentsReport' },
          ],
        },
        {
          heading: 'Look up records',
          karl: 'Services block 2',
          component: 'services',
          cards: [{ title: 'Find complaints and inspection records', target: 'findRecords' }],
        },
      ],
    }
    const html = ctx.renderPageMain(page)
    expect(html).toContain('<h2 class="region-title">Services</h2>')
    expect(html).toContain(
      'class="service-group"><h3 id="section-general-housing-issues" data-rewrite-field="sections.0.heading">General housing issues</h3>'
    )
    expect(html).toContain(
      'class="service-group"><h3 id="section-look-up-records" data-rewrite-field="sections.1.heading">Look up records</h3>'
    )
    const servicesIndex = html.indexOf('region-title">Services')
    const firstGroupIndex = html.indexOf('General housing issues')
    expect(firstGroupIndex).toBeGreaterThan(servicesIndex)
  })

  test('a component: resources section renders as an H3 sub-group inside one Resources region', () => {
    const page = {
      ...base,
      sections: [
        {
          heading: 'Guidance and resources',
          karl: 'Resources block',
          component: 'resources',
          cards: [
            {
              title: 'Learn what Healthy Housing and Vector Control can inspect',
              target: 'scopeInfo',
            },
          ],
        },
      ],
    }
    const html = ctx.renderPageMain(page)
    expect(html).toContain('<h2 class="region-title">Resources</h2>')
    expect(html).toContain(
      'class="service-group"><h3 id="section-guidance-and-resources" data-rewrite-field="sections.0.heading">Guidance and resources</h3>'
    )
  })

  test('renders Partner agencies and Related', () => {
    const page = {
      ...base,
      partnerAgencies: [
        {
          title: 'Department of Public Health',
          url: 'https://www.sf.gov/departments--department-public-health',
        },
      ],
      sections: [
        {
          heading: 'Related',
          karl: 'Related links',
          component: 'related',
          cards: [{ title: 'Free mosquito education workshop', target: 'mosquitoWorkshop' }],
        },
      ],
    }
    const html = ctx.renderPageMain(page)
    expect(html).toContain('class="section section--partner-agencies"')
    expect(html).toContain('class="section section--related"')
  })
})

describe('about page layout', () => {
  const base = {
    type: 'About us',
    title: 'Healthy Housing and Vector Control',
    summary: 'Summary.',
    audience: ['Someone'],
    reading: 'Grade 6',
  }

  test('shows no visible eyebrow or summary, matching the live reference', () => {
    const html = ctx.renderPageMain({ ...base, sections: [] })
    expect(html).toContain('<p class="visually-hidden">About us</p>')
    expect(html).not.toContain('class="eyebrow')
    expect(html).not.toContain('class="summary"')
  })

  test('an Information section renders as a plain top-level H2, no wrapping region', () => {
    const page = {
      ...base,
      sections: [{ heading: 'Who we are', karl: 'Information block', paragraphs: ['We inspect.'] }],
    }
    const html = ctx.renderPageMain(page)
    expect(html).toContain('<h2 id="section-who-we-are"')
    expect(html).toContain('>Who we are<')
    expect(html).not.toContain('class="services-region"')
  })

  test('a component: resources section renders as an H3 sub-group inside one Resources region', () => {
    const page = {
      ...base,
      sections: [
        {
          heading: 'Program information',
          karl: 'Resources block',
          component: 'resources',
          cards: [{ title: 'Mosquito Control Program', target: 'mosquitoControl' }],
        },
      ],
    }
    const html = ctx.renderPageMain(page)
    expect(html).toContain('<h2 class="region-title">Resources</h2>')
    expect(html).toContain(
      'class="service-group"><h3 id="section-program-information" data-rewrite-field="sections.0.heading">Program information</h3>'
    )
  })
})

describe('renderParentLink', () => {
  test('links every non-Agency page back to the Agency page', () => {
    const page = { title: 'Some Transaction page' }
    const html = ctx.renderParentLink(page, 'insectsReport')
    expect(html).toContain(`>${escapeHtml(pageData.pestsTopic.title)}<`)
    expect(html).toContain('data-render-target="pestsTopic"')
  })

  test('renders nothing on the Agency page itself', () => {
    const page = { title: pageData.pestsTopic.title }
    expect(ctx.renderParentLink(page, 'pestsTopic')).toBe('')
  })

  // renderParentLink emits an <a data-render-target="pestsTopic">, not a
  // <button> — the shape every other internal-nav element in this file
  // uses. The mockup-internal click delegation in this module (the
  // document-level 'click' listener above renderCards) originally matched
  // only 'button[data-render-target]', so this <a> rendered correctly but
  // was inert: a click hit the a[href="#"] preventDefault branch and never
  // reached window.renderPage. A pure string assertion on the HTML markup
  // can't catch that — only a real dispatched click can, which is what this
  // test is for.
  test('clicking the rendered link navigates to the Agency page', () => {
    document.body.innerHTML = ctx.renderParentLink({ title: 'Some page' }, 'insectsReport')
    const originalRenderPage = window.renderPage
    let calledWith = null
    window.renderPage = (key) => {
      calledWith = key
    }
    try {
      const anchor = document.querySelector('[data-render-target="pestsTopic"]')
      anchor.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
      expect(calledWith).toBe('pestsTopic')
    } finally {
      window.renderPage = originalRenderPage
      document.body.innerHTML = ''
    }
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

  test('annotates a section heading with its source index', () => {
    const section = { heading: 'Test Heading', karl: 'k', __sectionIndex: 2, paragraphs: [] }
    const html = ctx.renderSection(section, 'information')
    expect(html).toContain('data-rewrite-field="sections.2.heading"')
    expect(html).toContain(
      '<h2 id="section-test-heading" data-rewrite-field="sections.2.heading">Test Heading</h2>'
    )
  })

  test('emits no heading data-rewrite-field when __sectionIndex is absent', () => {
    const section = { heading: 'No Index', karl: 'k', paragraphs: [] }
    const html = ctx.renderSection(section, 'information')
    expect(html).not.toContain('data-rewrite-field')
  })

  // renderSpotlightSection() and renderTopFacts() build their own <h2> and
  // call paragraphList() directly instead of going through renderSection()/
  // renderSectionInner() — the only path that reads __sectionIndex and stamps
  // the heading/paragraph attributes. That left every component: 'spotlight'
  // and component: 'top-facts' section (Topic's Spotlight, Campaign's
  // Spotlight and Top facts) with no click-to-edit affordance at all, despite
  // being ordinary sections with a heading and paragraphs — squarely inside
  // the feature's documented scope.
  test('annotates a component: spotlight section heading and paragraphs', () => {
    const section = {
      heading: 'Spotlight heading',
      karl: 'k',
      component: 'spotlight',
      __sectionIndex: 4,
      paragraphs: ['Spotlight copy.'],
    }
    const html = ctx.renderSpotlightSection(section)
    expect(html).toContain('data-rewrite-field="sections.4.heading"')
    expect(html).toContain('data-rewrite-field="sections.4.paragraphs.0"')
  })

  test('annotates a component: top-facts section heading and paragraphs', () => {
    const section = {
      heading: 'Top facts heading',
      karl: 'k',
      component: 'top-facts',
      __sectionIndex: 5,
      paragraphs: ['Top facts intro.'],
      facts: [{ label: 'Contact', text: 'Call 311.' }],
    }
    const html = ctx.renderTopFacts(section)
    expect(html).toContain('data-rewrite-field="sections.5.heading"')
    expect(html).toContain('data-rewrite-field="sections.5.paragraphs.0"')
  })

  // renderCustomSection() (a flat Supporting/Additional-content section) and
  // renderServiceGroup() (a Services/Resources H3 sub-group) both build their
  // own heading instead of going through renderSection() — same gap as
  // spotlight/top-facts above, on section shapes that predate that feature.
  test('annotates a custom (flat) section heading with its source index', () => {
    const section = { heading: 'Custom heading', karl: 'k', __sectionIndex: 6, flat: true }
    const html = ctx.renderCustomSection(section, 'transaction')
    expect(html).toContain('data-rewrite-field="sections.6.heading"')
  })

  test('annotates a service-group heading with its source index', () => {
    const section = { heading: 'Group heading', karl: 'k', __sectionIndex: 7 }
    const html = ctx.renderServiceGroup(section, 'topic')
    expect(html).toContain('data-rewrite-field="sections.7.heading"')
  })

  // An accordion's heading is the one editable field that cannot simply take
  // the attribute where it already sits. EditorSession.open()
  // (js/inline-content-edit.js) does target.replaceWith() with a <div> holder,
  // and the heading text used to live inside the <button data-accordion-toggle>
  // itself — so annotating it in place would have put a block-level Editor.js
  // instance inside a native button AND routed one click to both the toggle
  // and the editor. The chevron button and the heading are siblings now; these
  // two tests pin both halves of that split.
  test('annotates an accordion heading, kept outside the toggle button', () => {
    const section = { heading: 'Accordion heading', karl: 'k', __sectionIndex: 8 }
    const html = ctx.renderAccordionSection(section, 'transaction')
    expect(html).toContain('data-rewrite-field="sections.8.heading"')
    // The editable element must not be nested inside the toggle button: that
    // is what would hand a single click to two different handlers.
    const buttonMarkup = html.slice(html.indexOf('<button'), html.indexOf('</button>'))
    expect(buttonMarkup).not.toContain('data-rewrite-field')
  })

  test('keeps the accordion toggle working and named after its heading', () => {
    const section = { heading: 'Accordion heading', karl: 'k', __sectionIndex: 8 }
    const html = ctx.renderAccordionSection(section, 'transaction')
    expect(html).toContain('data-accordion-toggle')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('aria-controls="section-accordion-heading"')
    // The old full-row button took its accessible name from the heading text
    // it contained. The chevron has no text of its own, so the name has to be
    // restated explicitly or the control announces as a bare "button".
    expect(html).toContain('aria-label="Accordion heading"')
  })

  test('escapes a heading value carrying HTML', () => {
    const section = {
      heading: PAYLOAD,
      karl: 'k',
      __sectionIndex: 0,
      paragraphs: [],
    }
    assertEscaped(ctx.renderSection(section, 'information'))
  })

  // The regression this whole addressing scheme exists to prevent.
  // partitionSections() buckets sections by inferred role (body/resources/
  // related/etc.) and renderPageMain() for an Information page renders those
  // buckets in a FIXED layout order — all 'body'-role sections, then all
  // 'resources'-role sections, then 'related' last — which is not the same
  // as page.sections source order. data-rewrite-field must carry the SOURCE
  // index (section.__sectionIndex, stamped in partitionSections before the
  // bucketing) so an AI rewrite lands on the section the reviewer actually
  // saw, not on whatever happens to occupy that position in the rendered
  // output.
  //
  // The previous version of this test used a 'related'-role section (with
  // `cards`, no `paragraphs`) as its reordered section, on the theory that a
  // render-order implementation would misattribute paths onto it. That
  // fixture was vacuous: 'related' sections carry no `paragraphs`/`bullets`
  // and cards are deliberately out of the v1 rewrite-field scope (see
  // js/page-render.js's renderCards — it emits no data-rewrite-field at
  // all), so section 0 in that fixture NEVER emitted a data-rewrite-field
  // path under EITHER implementation. The assertion
  // `expect(html).not.toContain('data-rewrite-field="sections.0.paragraphs.0"')`
  // therefore passed trivially, with or without the __sectionIndex fix — it
  // proved nothing about which index scheme was in use.
  //
  // This fixture instead reorders two sections that both emit real
  // data-rewrite-field paths: a 'resources'-role section placed FIRST in
  // source order, and a plain body-role section placed SECOND. For an
  // Information page, renderPageMain() renders all body-role sections before
  // any resources-role section (see the `infoBody`/`resources.forEach` split
  // below the partitionSections() call), so the resources section (source
  // index 0) renders in HTML AFTER the body section (source index 1) — a
  // genuine, verified disagreement between source index and render position.
  //
  // Content-binding is deliberate, not decorative: a bare pair of
  // `toContain` checks for 'sections.0...' and 'sections.1...' would pass
  // under a BROKEN render-order implementation too, because swapping which
  // section is called "0" and which is "1" still produces both strings
  // somewhere in the document — only the pairing between an index and its
  // section's actual text content flips. Asserting the index immediately
  // followed by that section's distinctive paragraph text is what makes a
  // render-order regression fail this test instead of sailing through it.
  test('uses the original page.sections index, not the rendered order', () => {
    const page = {
      slug: 'x',
      type: 'Information',
      title: 'X',
      summary: 'S',
      audience: ['a'],
      reading: 'Grade 6',
      sections: [
        {
          heading: 'Resources first',
          component: 'resources',
          karl: 'k',
          paragraphs: ['resources copy'],
        },
        { heading: 'Body second', karl: 'k', paragraphs: ['body copy'] },
      ],
    }
    const html = ctx.renderPageMain(page)
    // Source index 0 (the resources section) renders LAST in this page type,
    // but its data-rewrite-field must still read "sections.0" and must still
    // be paired with ITS OWN text, "resources copy" — not the other
    // section's.
    expect(html).toContain('data-rewrite-field="sections.0.paragraphs.0">resources copy')
    // Source index 1 (the body section) renders FIRST, but its
    // data-rewrite-field must still read "sections.1" paired with "body
    // copy".
    expect(html).toContain('data-rewrite-field="sections.1.paragraphs.0">body copy')
    // And the render-order-implied (wrong) pairings must be absent: source
    // index 0's attribute must never precede "body copy", and source index
    // 1's attribute must never precede "resources copy".
    expect(html).not.toContain('data-rewrite-field="sections.0.paragraphs.0">body copy')
    expect(html).not.toContain('data-rewrite-field="sections.1.paragraphs.0">resources copy')
  })
})

describe('data-rewrite-field on the hero (title, summary, CTA)', () => {
  const transactionPage = {
    slug: 'x',
    type: 'Transaction',
    title: 'Test Title',
    summary: 'Test summary text.',
    audience: ['a'],
    reading: 'Grade 6',
    sections: [
      {
        heading: 'What to do',
        karl: 'k',
        steps: [{ title: 'Step one', text: ['do it'], button: 'Start now', buttonTarget: 'x' }],
      },
    ],
  }

  test('annotates the title with data-rewrite-field="title"', () => {
    const html = ctx.renderPageMain(transactionPage)
    expect(html).toContain('data-rewrite-field="title"')
    expect(html).toContain('<h1 tabindex="-1" data-rewrite-field="title">Test Title</h1>')
  })

  test('annotates the summary with data-rewrite-field="summary"', () => {
    const html = ctx.renderPageMain(transactionPage)
    expect(html).toContain('<p class="summary" data-rewrite-field="summary">Test summary text.</p>')
  })

  test('annotates the primary CTA button with data-rewrite-field="primaryCta"', () => {
    const html = ctx.renderPageMain(transactionPage)
    expect(html).toContain('data-rewrite-field="primaryCta"')
  })

  // The hero renders no pills of any kind after the CTA. It used to close
  // with a metadata row of up to three: 'Environmental Health' and 'HHVC'
  // were string literals in the renderer, identical on all 29 pages;
  // `page.reading` is a property OF the copy rather than part of it, and one
  // no Karl page publishes; and `topicTag`/`reportDate`, while real page
  // fields, still duplicated chrome that added nothing above the fold. A
  // mockup that prints reviewer chrome above the fold misrepresents the page
  // a manager is being asked to approve.
  //
  // These assertions exist because nothing covered that row, which is
  // exactly how the first three came to be removed in an unrelated change
  // without a single test noticing either the removal or the behaviour it
  // changed.
  test('renders no pills in the hero after the CTA', () => {
    const html = ctx.renderPageMain({
      ...transactionPage,
      topicTag: 'Pests',
      reportDate: '2026-01-01',
    })
    expect(html).not.toContain('<span class="pill')
    expect(html).not.toContain('<div class="metadata">')
  })

  test('does not print the reading grade as a hero pill', () => {
    const html = ctx.renderPageMain(transactionPage)
    // Reads the fixture's own `reading` value rather than a hardcoded
    // 'Grade 6' literal: a hardcoded string only catches the renderer
    // reintroducing the pill if it happens to also say 'Grade 6' — pinning
    // against the fixture data catches the regression regardless of what
    // `transactionPage.reading` is set to.
    expect(html).not.toContain(`<span class="pill">${transactionPage.reading}</span>`)
  })

  test('emits no CTA attribute when the page has no resolvable hero CTA', () => {
    const infoPage = {
      slug: 'y',
      type: 'Information',
      title: 'Info Title',
      summary: 'Info summary.',
      audience: ['a'],
      reading: 'Grade 6',
      sections: [{ heading: 'Body', karl: 'k', paragraphs: ['text'] }],
    }
    const html = ctx.renderPageMain(infoPage)
    expect(html).not.toContain('data-rewrite-field="primaryCta"')
  })

  test('escapes the title and summary', () => {
    const page = {
      ...transactionPage,
      title: PAYLOAD,
      summary: PAYLOAD,
    }
    assertEscaped(ctx.renderPageMain(page))
  })
})

// A Karl Services/Resources subsection entry, and a Related-panel entry, is
// only a page picker — there is no description field on the card, so what
// publishes comes from the DESTINATION page. Before this, js/page-render.js
// printed `card.text` verbatim, showing reviewers 12 descriptions that could
// never appear on SF.gov. These pin the resolution rules in
// js/card-inheritance.js against the renderer that now consumes them, since a
// silent regression here would put unpublishable copy back in front of a
// manager with nothing to report it.
describe('card description inheritance', () => {
  // Matches INHERITS in js/card-inheritance.js. `scopeInfo` is a real page key,
  // so pageData resolves it and its own summary is what must render.
  const inheritsSection = { heading: 'Services', karl: 'Services subsection: page chooser' }
  const titleOnlySection = { heading: 'Related', karl: 'Related panel: linked pages' }
  const authoredSection = { heading: 'Rules', karl: 'Table block: body table' }

  test('renders the destination summary instead of an inheriting card own text', () => {
    const html = ctx.renderCards(
      [{ title: 'Inspection scope', target: 'scopeInfo', text: 'Card copy that cannot publish.' }],
      inheritsSection
    )
    // Reads pageData['scopeInfo'].summary rather than pinning a copy of its
    // wording as a literal: a future copy edit to that page should not fail
    // this test just because inheritance kept working correctly — the literal
    // would drift from the fixture and start asserting the wrong thing rather
    // than catching a real regression.
    expect(html).toContain(`<p>${escapeHtml(pageData.scopeInfo.summary)}</p>`)
    expect(html).not.toContain('Card copy that cannot publish.')
  })

  test('renders no description element at all for a title-only card', () => {
    const html = ctx.renderCards(
      [{ title: 'Inspection scope', target: 'scopeInfo', text: 'Card copy that cannot publish.' }],
      titleOnlySection
    )
    expect(html).not.toContain('<p>')
    expect(html).not.toContain('Card copy that cannot publish.')
  })

  test('renders an authored card own text unchanged', () => {
    const html = ctx.renderCards(
      [{ title: 'Inspection scope', target: 'scopeInfo', text: 'Authored table copy.' }],
      authoredSection
    )
    expect(html).toContain('<p>Authored table copy.</p>')
  })

  test('renders an external-url card own text inside an inheriting section', () => {
    // An external link has no SF.gov page to inherit from, so its description
    // is genuinely authored whatever block holds it.
    const html = ctx.renderCards(
      [
        {
          title: 'CDC rodents',
          url: 'https://www.cdc.gov/rodents/',
          text: 'Authored external copy.',
        },
      ],
      inheritsSection
    )
    expect(html).toContain('<p>Authored external copy.</p>')
  })

  test('falls back to authored text when an inheriting card target resolves to nothing', () => {
    // Blanking the card would hide copy over what is really a broken link —
    // findBrokenCardTargets' job, and it reports it as one.
    const html = ctx.renderCards(
      [{ title: 'Gone', target: 'noSuchPageKey', text: 'Authored fallback copy.' }],
      inheritsSection
    )
    expect(html).toContain('<p>Authored fallback copy.</p>')
  })

  test('emits no data-rewrite-field on an inherited card description', () => {
    // Editing here would write the destination page's words into this card's
    // own `text`, which renders nowhere — the exact bug inheritance removes.
    const html = ctx.renderCards(
      [{ title: 'Inspection scope', target: 'scopeInfo', text: 'Card copy.' }],
      inheritsSection
    )
    expect(html).not.toContain('data-rewrite-field')
  })

  test('inherits through renderServiceTiles and renderResourcesList', () => {
    const card = { title: 'Inspection scope', target: 'scopeInfo', text: 'Card copy.' }
    // Live fixture value, same reasoning as the test above: a copy edit to
    // scopeInfo should not fail this test while inheritance still works.
    const expected = escapeHtml(pageData.scopeInfo.summary)
    expect(ctx.renderServiceTiles([card], inheritsSection)).toContain(expected)
    expect(ctx.renderResourcesList([card], inheritsSection)).toContain(expected)
  })

  test('renders no description paragraph when the description resolves empty', () => {
    const html = ctx.renderServiceTiles(
      [{ title: 'Inspection scope', target: 'scopeInfo', text: 'Card copy.' }],
      titleOnlySection
    )
    expect(html).not.toContain('<p>')
  })

  test('keeps step card text authored, since a step card is not a section card', () => {
    // renderSteps passes null for the section: a step's cards live in a Step
    // List block, which no live-site check has classified either way.
    const html = ctx.renderSteps([
      {
        title: 'Step one',
        cards: [{ title: 'Inspection scope', target: 'scopeInfo', text: 'Step card copy.' }],
      },
    ])
    expect(html).toContain('<p>Step card copy.</p>')
  })
})

// Both INHERITS and TITLE_ONLY are page-picker blocks with no label field, so
// Karl publishes the destination page's own Title for every internal card in
// either bucket — not just the ones that also carry a description. Before
// cardTitle() existed, only cardDescription() resolved through the
// destination; the title stayed the card's own authored `c.title` in every
// case, so a card whose title happened to match its destination's title at
// write time silently drifted the moment a reviewer retitled that
// destination and nothing here ever re-read it.
describe('card title inheritance', () => {
  const inheritsSection = { heading: 'Services', karl: 'Services subsection: page chooser' }
  const titleOnlySection = { heading: 'Related', karl: 'Related panel: linked pages' }
  const authoredSection = { heading: 'Rules', karl: 'Table block: body table' }
  // Live fixture value rather than a copy of its wording as a literal — same
  // reasoning as the description-inheritance tests above: a future title edit
  // to scopeInfo should not fail this test while inheritance still works.
  const scopeInfoTitle = escapeHtml(pageData.scopeInfo.title)
  /* **These assertions read the card's own markup, not the whole string.**
     Every card now renders a Karl guide panel beside it, and one of the values
     that panel offers to copy is the destination page's TITLE — that is the
     string Karl's page chooser searches on, so it belongs there. A
     whole-document `not.toContain(scopeInfoTitle)` therefore fails on an
     authored card for a reason that has nothing to do with inheritance: the
     title it found is in the guide, not in the card. Stripping the guide first
     keeps each test asking its own question. */
  const withoutGuide = (html) => html.replace(/<span class="karl-guide"[\s\S]*?<\/span><h3/g, '<h3')

  test('resolves the destination title for an inheriting internal card', () => {
    const html = ctx.renderCards(
      [{ title: 'Inspection scope', target: 'scopeInfo', text: 'Card copy.' }],
      inheritsSection
    )
    expect(html).toContain(`>${scopeInfoTitle}<`)
    expect(html).not.toContain('>Inspection scope<')
  })

  test('resolves the destination title for a title-only internal card', () => {
    const html = ctx.renderCards(
      [{ title: 'Inspection scope', target: 'scopeInfo', text: 'Card copy.' }],
      titleOnlySection
    )
    expect(html).toContain(`>${scopeInfoTitle}<`)
    expect(html).not.toContain('>Inspection scope<')
  })

  test('keeps an authored card own title unchanged', () => {
    const html = withoutGuide(
      ctx.renderCards(
        [{ title: 'Inspection scope', target: 'scopeInfo', text: 'Authored table copy.' }],
        authoredSection
      )
    )
    expect(html).toContain('>Inspection scope<')
    expect(html).not.toContain(`>${scopeInfoTitle}<`)
  })

  test('keeps an external card own title, even inside an inheriting section', () => {
    const html = ctx.renderCards(
      [{ title: 'CDC rodents', url: 'https://www.cdc.gov/rodents/', text: 'Authored copy.' }],
      inheritsSection
    )
    expect(html).toContain('CDC rodents')
  })

  test('falls back to the authored title when an inheriting card target resolves to nothing', () => {
    const html = ctx.renderCards(
      [{ title: 'Gone', target: 'noSuchPageKey', text: 'Authored fallback copy.' }],
      inheritsSection
    )
    expect(html).toContain('>Gone<')
  })

  test('resolves through renderServiceTiles and renderResourcesList too', () => {
    const card = { title: 'Inspection scope', target: 'scopeInfo', text: 'Card copy.' }
    expect(ctx.renderServiceTiles([card], inheritsSection)).toContain(scopeInfoTitle)
    expect(ctx.renderResourcesList([card], inheritsSection)).toContain(scopeInfoTitle)
  })
})

// cardInheritanceFact() (js/page-render.js) is a DIFF of values cardTitle()/
// cardDescription() already resolved against the card's own title/text, not
// a second classifier — so it structurally cannot disagree with what
// actually renders. These tests exist because a badge that disagrees with
// the render is worse than no badge: it would tell a reviewer their edit is
// dead when it isn't, or vice versa.
describe('card inheritance fact badge on the tag', () => {
  const inheritsSection = { heading: 'Services', karl: 'Services subsection: page chooser' }
  const titleOnlySection = { heading: 'Related', karl: 'Related panel: linked pages' }
  const authoredSection = { heading: 'Rules', karl: 'Table block: body table' }

  test('badges an inheriting internal card whose own title and text both get replaced', () => {
    const html = ctx.renderCards(
      [{ title: 'Inspection scope', target: 'scopeInfo', text: 'Card copy.' }],
      inheritsSection
    )
    expect(html).toContain('class="karl-tag-inherit"')
    expect(html).toContain('data-inherit="title-and-text"')
  })

  test('badges a title-only internal card the same way, since its title also inherits', () => {
    const html = ctx.renderCards(
      [{ title: 'Inspection scope', target: 'scopeInfo', text: 'Card copy.' }],
      titleOnlySection
    )
    expect(html).toContain('class="karl-tag-inherit"')
    expect(html).toContain('data-inherit="title-and-text"')
  })

  test('does not badge an authored card whose own fields render unchanged', () => {
    const html = ctx.renderCards(
      [{ title: 'Inspection scope', target: 'scopeInfo', text: 'Authored table copy.' }],
      authoredSection
    )
    expect(html).not.toContain('class="karl-tag-inherit"')
  })

  test('does not badge an external-url card inside an inheriting section, since its own fields really render', () => {
    // The regression case a bad diff-vs-classify implementation gets wrong:
    // this card has no `target`, so neither cardTitle() nor
    // cardDescription() substitutes anything, even though the section itself
    // classifies as `inherits`.
    const html = ctx.renderCards(
      [
        {
          title: 'CDC rodents',
          url: 'https://www.cdc.gov/rodents/',
          text: 'Authored external copy.',
        },
      ],
      inheritsSection
    )
    expect(html).not.toContain('class="karl-tag-inherit"')
  })

  test('does not badge a card with no section context (unknown classification)', () => {
    const html = ctx.renderCards([
      { title: 'Inspection scope', target: 'scopeInfo', text: 'Card copy.' },
    ])
    expect(html).not.toContain('class="karl-tag-inherit"')
  })
})

describe('renderCards / renderCardList: shared assembly does not change output', () => {
  // Both already have coverage elsewhere (renderCards directly by name;
  // renderCardList indirectly through renderResourcesList, since it is not
  // itself exported). This block pins the exact current output for cases
  // that differ between the two callers — url vs target vs inert, unverified,
  // and fileType — so extracting their shared logic into
  // cardActionAndDescription() cannot silently change what either renders.
  const CARDS = [
    { title: 'External', url: 'https://example.gov/page', text: 'An external link.' },
    { title: 'Internal', target: 'pestsTopic', text: 'An internal link.' },
    { title: 'Inert', text: 'No target or url at all.' },
    {
      title: 'Unverified',
      target: 'pestsTopic',
      text: 'Needs confirming.',
      unverified: true,
      unverifiedReason: 'Pending SME review',
    },
    { title: 'With file badge', url: 'https://example.gov/doc.pdf', fileType: 'PDF' },
  ]

  test('renderCards output for a representative card set', () => {
    expect(ctx.renderCards(CARDS)).toMatchSnapshot()
  })

  test('renderResourcesList (wraps renderCardList) output for the same card set', () => {
    expect(ctx.renderResourcesList(CARDS)).toMatchSnapshot()
  })

  test('renderCards external link uses rel="noopener" (not noreferrer)', () => {
    const html = ctx.renderCards([CARDS[0]])
    expect(html).toContain('rel="noopener"')
    expect(html).not.toContain('noreferrer')
  })

  test('renderResourcesList external link uses rel="noopener noreferrer"', () => {
    const html = ctx.renderResourcesList([CARDS[0]])
    expect(html).toContain('rel="noopener noreferrer"')
  })

  test('renderCards external-link mark carries no class', () => {
    const html = ctx.renderCards([CARDS[0]])
    expect(html).toContain('<span aria-hidden="true">↗</span>')
  })

  test('renderResourcesList external-link mark carries the external-mark class', () => {
    const html = ctx.renderResourcesList([CARDS[0]])
    expect(html).toContain('<span class="external-mark" aria-hidden="true">↗</span>')
  })

  test('renderResourcesList renders a file-type badge; renderCards does not', () => {
    const fileCard = [CARDS[4]]
    expect(ctx.renderResourcesList(fileCard)).toContain('<span class="file-badge">PDF</span>')
    expect(ctx.renderCards(fileCard)).not.toContain('file-badge')
  })
})

describe('hero eyebrow', () => {
  const base = {
    title: 'A page',
    summary: 'Summary.',
    audience: ['Someone'],
    reading: 'Grade 6',
    sections: [],
  }

  test('shows an orange eyebrow on the Agency page', () => {
    const html = ctx.renderPageMain({ ...base, type: 'Agency' })
    expect(html).toContain('class="eyebrow eyebrow--agency"')
    expect(html).toContain('>Agency<')
  })

  test('shows a plain "Service" eyebrow on a Transaction page', () => {
    const html = ctx.renderPageMain({ ...base, type: 'Transaction' })
    expect(html).toContain('class="eyebrow eyebrow--service"')
    expect(html).toContain('>Service<')
  })

  test('shows no eyebrow on an Information page', () => {
    const html = ctx.renderPageMain({ ...base, type: 'Information' })
    expect(html).not.toContain('class="eyebrow')
  })
})

describe('renderWhatToKnow', () => {
  test('shows a visible "What to know" H2 with an icon', () => {
    const page = {
      type: 'Transaction',
      title: 'Report a thing',
      summary: 'Summary.',
      audience: ['A tenant'],
      reading: 'Grade 6',
      whatToKnow: { cost: 'Free', thingsToKnow: ['Call 311 for help.'] },
      sections: [],
    }
    const html = ctx.renderPageMain(page)
    expect(html).toContain('<h2 class="what-to-know-heading">')
    expect(html).toContain('what-to-know-icon')
    expect(html).toContain('>What to know<')
  })

  test('renders Cost as its own H3, not an inline label', () => {
    const page = {
      type: 'Transaction',
      title: 'Report a thing',
      summary: 'Summary.',
      audience: ['A tenant'],
      reading: 'Grade 6',
      whatToKnow: { cost: 'Free', thingsToKnow: ['Call 311 for help.'] },
      sections: [],
    }
    const html = ctx.renderPageMain(page)
    expect(html).not.toContain('<strong>Cost:</strong>')
    expect(html).toContain('<h3>Cost</h3><p data-rewrite-field="whatToKnow.cost">Free</p>')
  })

  test('an unlabeled thingsToKnow entry falls back to one shared "Things to know" subsection', () => {
    const page = {
      type: 'Transaction',
      title: 'Report a thing',
      summary: 'Summary.',
      audience: ['A tenant'],
      reading: 'Grade 6',
      whatToKnow: { cost: 'Free', thingsToKnow: ['Call 311 for help.'] },
      sections: [],
    }
    const html = ctx.renderPageMain(page)
    expect(html).toContain('<h3>Things to know</h3>')
    expect(html).toContain('Call 311 for help.')
  })

  test('a labeled thingsToKnow entry renders as its own named H3 subsection', () => {
    const page = {
      type: 'Transaction',
      title: 'Report a thing',
      summary: 'Summary.',
      audience: ['A tenant'],
      reading: 'Grade 6',
      whatToKnow: {
        cost: 'Free',
        thingsToKnow: [{ label: 'What to report', text: 'Call 311 for help.' }],
      },
      sections: [],
    }
    const html = ctx.renderPageMain(page)
    expect(html).toContain(
      '<h3>What to report</h3><p data-rewrite-field="whatToKnow.thingsToKnow.0">Call 311 for help.</p>'
    )
    expect(html).not.toContain('<h3>Things to know</h3>')
  })
})
