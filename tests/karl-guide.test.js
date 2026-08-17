// Tests for the Karl guide: the registry that decides which Karl field a piece
// of mockup content belongs in, the panel markup that presents that answer, and
// the keyboard behaviour of the disclosure it lives in.
//
// **Why this file exists at all.** The guide's failure mode is not a crash and
// not a wrong render — it is a WRONG ANSWER delivered confidently. A guide
// stamps `E1 confirmed` whenever it has a path, and that badge means "measured
// against the live Karl admin"; a human editor reads it and pastes approved
// copy where it says. So the assertions here are mostly about paths that must
// NOT appear, and about the empty string, which is this feature's way of saying
// "this repo does not know" — the one answer that is never harmful.
//
// Four independent reviewers reported ten variants of the same defect against
// PR #153, every one of them a context resolving to a plausible neighbouring
// field. Each is pinned below by the page type and role that produced it.
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import {
  BUTTON_HOSTS,
  META_FIELDS,
  PAGE_TYPE_FIELDS,
  guideForContext,
} from '../js/karl-guide-registry.js'
import { renderKarlGuidePanel } from '../js/karl-tag-meta.js'

const { karlGuideSchema } = require('../build_scripts/schema.js')

/** Resolve a guide the way page-render.js does, for one type and role. */
function guideFor(type, role, context = {}) {
  return guideForContext({ page: { type }, kind: 'placement', context: { role, ...context } })
}

describe('unresolved mappings cannot also claim a destination', () => {
  // The contract behind most of the routing bugs: something has to be unable to
  // say "I do not know where this goes" and "E1 confirmed" in the same breath.
  test('an authored path loses to an unresolvedId at render time', () => {
    const guide = guideForContext({
      page: { type: 'Transaction' },
      guide: {
        path: 'Content → Anywhere',
        evidence: 'E1',
        status: 'confirmed',
        unresolvedId: 'U1',
      },
      context: { role: 'body' },
    })
    expect(guide.path).toBe('')
    expect(guide.evidence).toBe('U')
    expect(guide.status).toBe('unresolved')
  })

  test('the schema rejects the same combination before it can be authored', () => {
    const conflicting = {
      steps: ['Do the thing.'],
      unresolvedId: 'U1',
      path: 'Content → Anywhere',
      status: 'confirmed',
      evidence: 'E1',
    }
    expect(karlGuideSchema.safeParse(conflicting).success).toBe(false)
    // The unresolved half on its own stays valid — this rejects the conflict,
    // not the concept.
    expect(
      karlGuideSchema.safeParse({ steps: ['Resolve this.'], unresolvedId: 'U1', evidence: 'U' })
        .success
    ).toBe(true)
  })
})

describe('resolvePath never guesses', () => {
  test('an unrecognized role reports no path rather than the body stream', () => {
    // 'sidebar' names no Karl field on any type. Before this, the
    // `page-reference` branch fell back to the page's `content` path.
    expect(guideFor('Transaction', 'sidebar', { linkShape: 'page-reference' }).path).toBe('')
    expect(guideFor('Transaction', 'sidebar').status).toBe('mockup-only')
  })

  test('a tag kind leaking through as a role resolves to nothing', () => {
    // guideForContext falls back to `kind` when a call site passes no role.
    // 'placement' is a tag colour, not a field.
    for (const kind of ['meta', 'placement', 'editor']) {
      expect(guideFor('Agency', kind).path).toBe('')
    }
  })

  test('page metadata resolves type-independently', () => {
    for (const type of ['Transaction', 'Campaign', 'About us', 'Report']) {
      expect(guideFor(type, 'title').path).toBe(META_FIELDS.title)
      expect(guideFor(type, 'description').path).toBe(META_FIELDS.description)
    }
  })
})

describe('Contact us exists on three types and only three', () => {
  // Reported as: "Campaign contacts point to Additional content accordions,
  // Information contacts to Information-section text, Agency contacts to About
  // description". The correction is not a better path for all of them — five of
  // the eight types have no Contact us panel at all.
  test.each([
    ['Transaction', 'Content → Contact us'],
    ['Campaign', 'Content → Contact us'],
    ['Agency', 'Content → Contact us'],
  ])('%s routes contact content to its Contact us panel', (type, path) => {
    expect(guideFor(type, 'contact').path).toBe(path)
  })

  test.each([['Information'], ['Resource Collection'], ['Topic'], ['About us'], ['Report']])(
    '%s has no Contact us panel, so contact content reports mockup-only',
    (type) => {
      const guide = guideFor(type, 'contact')
      expect(guide.path).toBe('')
      expect(guide.status).toBe('mockup-only')
    }
  )

  test('no type routes contact content into a prose field', () => {
    // The specific harm: a phone number landing in a rich-text block. Assert it
    // against every type at once rather than trusting the two lists above to
    // stay exhaustive as types are added.
    for (const type of Object.keys(PAGE_TYPE_FIELDS)) {
      const contactPath = guideForContext({ page: { type }, context: { role: 'contact' } }).path
      const bodyPath = PAGE_TYPE_FIELDS[type].body
      if (contactPath) expect(contactPath).not.toBe(bodyPath)
    }
  })
})

describe('components that own a Karl panel are not folded into the body stream', () => {
  test('Campaign Top facts is its own panel', () => {
    expect(guideFor('Campaign', 'top-facts').path).toBe('Content → Top facts')
    // And is NOT the Additional content row it used to alias onto, which is one
    // of the two paths this repo inferred rather than measured.
    expect(guideFor('Campaign', 'top-facts').path).not.toBe(PAGE_TYPE_FIELDS.campaign.content)
    expect(guideFor('Campaign', 'top-facts').status).toBe('confirmed')
  })

  test('top facts on a type that has no such panel reports nothing', () => {
    expect(guideFor('Topic', 'top-facts').path).toBe('')
  })

  test("Transaction's What to know is the cost grouping, not the What to Do stream", () => {
    const guide = guideFor('Transaction', 'what-to-know')
    expect(guide.path).toBe('Content → What to Know Before You Start')
    expect(guide.path).not.toBe(PAGE_TYPE_FIELDS.transaction.content)
    // The path stops at the grouping, so a step has to name the two fields
    // under it or the editor cannot tell which half goes where.
    expect(guide.steps.join(' ')).toContain('Things to Know')
  })

  test('Partner agencies is an Agency-only page chooser on the types that have it', () => {
    expect(guideFor('Transaction', 'partner-agencies').path).toBe('Content → Partner agencies')
    expect(guideFor('Topic', 'partner-agencies').steps.join(' ')).toContain('Agency pages')
    // About us is the one type in use with no partner_agencies field.
    expect(guideFor('About us', 'partner-agencies').path).toBe('')
  })

  test('a Report table goes in the Table block, never Body', () => {
    expect(guideFor('Report', 'table').path).toBe('Content → Content → Table')
    expect(guideFor('Report', 'table').path).not.toBe(PAGE_TYPE_FIELDS.report.body)
    // No other type in use has a Table block; the mockup renders one on
    // Information as a deliberate preview, and it must not claim a field.
    expect(guideFor('Information', 'table').path).toBe('')
  })
})

describe('a Button link belongs to its host block', () => {
  // Link shape 2 is nested inside another component, so the host decides the
  // path. Answering with the page's generic content path put a Campaign
  // Spotlight CTA in an accordion.
  test('a Spotlight CTA resolves to the Spotlight nested Button link', () => {
    const guide = guideFor('Campaign', 'spotlight', { linkShape: 'button-link' })
    expect(guide.path).toBe(BUTTON_HOSTS['campaign.spotlight'])
    expect(guide.path).toContain('Spotlight')
    expect(guide.path).not.toBe(PAGE_TYPE_FIELDS.campaign.content)
  })

  test('a step action resolves to Section specifics Button link', () => {
    expect(guideFor('Transaction', 'what-to-do', { linkShape: 'button-link' }).path).toBe(
      BUTTON_HOSTS['transaction.what-to-do']
    )
  })

  test('a button in an unattested host reports nothing at all', () => {
    // Rather than the old literal `Content → Button link`, a level that exists
    // on no Karl form.
    const guide = guideFor('Information', 'body', { linkShape: 'button-link' })
    expect(guide.path).toBe('')
    expect(guide.steps.join(' ')).not.toContain('Button link →')
  })

  test('every BUTTON_HOSTS row names a Button link', () => {
    for (const path of Object.values(BUTTON_HOSTS)) expect(path).toContain('Button link')
  })
})

describe('the guide panel is phrasing content', () => {
  /* The panel renders inside `<span class="karl-guide">`, which itself renders
     wherever its tag does — including inside a paragraph, where a block-level
     start tag makes the parser close the paragraph early. The panel then
     escapes the positioned ancestor it anchors to and opens somewhere else on
     the page, restructuring the mockup under review. Asserting on the markup is
     what makes that unbreakable rather than a rule three call sites remember. */
  const panel = renderKarlGuidePanel(
    {
      path: 'Content → Title',
      steps: ['Open Karl.', 'Follow the path.'],
      status: 'confirmed',
      evidence: 'E1',
      linkShape: 'page-reference',
      unresolvedId: 'U1',
      values: [{ label: 'Title', value: 'A page', source: 'visible' }],
    },
    'karl-guide-test'
  )

  test.each(['<div', '<ol', '<ul', '<li', '<p ', '<p>', '<h1', '<h2', '<h3', '<h4'])(
    'emits no %s',
    (tag) => {
      expect(panel).not.toContain(tag)
    }
  )

  test('keeps list and heading semantics through ARIA instead', () => {
    expect(panel).toContain('role="list"')
    expect(panel).toContain('role="listitem"')
    expect(panel).toContain('role="heading" aria-level="4"')
    // One listitem per step, so a screen reader still announces the count.
    expect(panel.match(/role="listitem"/g)).toHaveLength(2)
  })
})

describe('Escape closes the guide from anywhere inside it', () => {
  // Reported twice, independently. The panel is a SIBLING of the trigger, so
  // resolving the trigger from the event target found nothing whenever focus
  // was on a Copy button — leaving a keyboard reviewer inside an open panel
  // with no way out but tabbing through every control in it.
  let wrapper

  beforeEach(async () => {
    const { initKarlGuides } = await import('../js/karl-guide.js')
    initKarlGuides()
    wrapper = document.createElement('span')
    wrapper.className = 'karl-guide'
    wrapper.setAttribute('data-karl-guide', '')
    wrapper.innerHTML =
      '<button type="button" class="karl-guide-trigger" aria-expanded="true" aria-controls="guide-panel-1"></button>' +
      '<span id="guide-panel-1" class="karl-guide-panel"><button type="button" class="karl-guide-copy">Copy</button></span>'
    document.body.append(wrapper)
  })

  afterEach(() => {
    wrapper.remove()
  })

  test('closes when Escape is pressed on a Copy button inside the panel', () => {
    const copy = wrapper.querySelector('.karl-guide-copy')
    copy.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(wrapper.querySelector('.karl-guide-trigger').getAttribute('aria-expanded')).toBe('false')
    expect(wrapper.querySelector('.karl-guide-panel').hidden).toBe(true)
  })

  test('still closes when Escape is pressed on the trigger itself', () => {
    const trigger = wrapper.querySelector('.karl-guide-trigger')
    trigger.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  test('leaves an already-closed guide alone', () => {
    const trigger = wrapper.querySelector('.karl-guide-trigger')
    trigger.setAttribute('aria-expanded', 'false')
    trigger.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })
})
