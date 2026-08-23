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
  ROLE_PANELS,
  fieldMetaFor,
  guideForContext,
  resolveFieldRef,
} from '../js/karl/karl-guide-registry.js'
import { renderKarlGuidePanel } from '../js/mockup/karl-tag-meta.js'

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

  test("page metadata carries each type's own label, not one shared string", () => {
    // This asserted the opposite until 2026-08-17, when the paths moved onto
    // the drift-guarded inventory: METADATA IS NOT TYPE-INDEPENDENT. Karl
    // labels the field "Page title" on three types and "Title" on the other
    // five, and the old shared `META_FIELDS.title` was therefore wrong on
    // whichever half you were not looking at.
    expect(guideFor('Transaction', 'title').path).toBe('Content → Page title')
    expect(guideFor('Campaign', 'title').path).toBe('Content → Title')
  })

  test('a type with no Description panel reports no destination for a summary', () => {
    // Campaign, About us and Report have no page `description` field at all —
    // that is `U21` in the field map's unresolved register, opened by this
    // repo's own sweep. The single shared META_FIELDS string sent a summary to
    // "Content → Description" on all three, naming a field their forms do not
    // have. Resolving through the inventory returns nothing instead, which the
    // panel renders as "Mockup only".
    for (const type of ['Campaign', 'About us', 'Report']) {
      expect(guideFor(type, 'description').path).toBe('')
      expect(guideFor(type, 'description').status).toBe('mockup-only')
    }
    expect(guideFor('Transaction', 'description').path).toBe('Content → Description')
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
    for (const type of Object.keys(ROLE_PANELS)) {
      const contactPath = guideForContext({ page: { type }, context: { role: 'contact' } }).path
      const bodyPath = guideFor(type, 'body').path
      if (contactPath) expect(contactPath).not.toBe(bodyPath)
    }
  })
})

describe('components that own a Karl panel are not folded into the body stream', () => {
  test('Campaign Top facts is its own panel', () => {
    expect(guideFor('Campaign', 'top-facts').path).toBe('Content → Top facts')
    // And is NOT the Additional content row it used to alias onto, which is one
    // of the two paths this repo inferred rather than measured.
    expect(guideFor('Campaign', 'top-facts').path).not.toBe(guideFor('campaign', 'content').path)
    expect(guideFor('Campaign', 'top-facts').status).toBe('confirmed')
  })

  test('top facts on a type that has no such panel reports nothing', () => {
    expect(guideFor('Topic', 'top-facts').path).toBe('')
  })

  test("Transaction's What to know is the cost grouping, not the What to Do stream", () => {
    const guide = guideFor('Transaction', 'what-to-know')
    // "What to Know Before You Start" is the parent GROUPING of `cost` and
    // `things_to_know`, not a panel row, so it has no label to derive and the
    // path names the field itself. buildSteps() still names both halves.
    expect(guide.path).toBe('Content → Cost')
    expect(guide.path).not.toBe(guideFor('transaction', 'content').path)
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
    expect(guideFor('Report', 'table').path).not.toBe(guideFor('report', 'body').path)
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
    expect(guide.path).toBe('Content → Spotlight 1 → Button link')
    expect(guide.path).toContain('Spotlight')
    expect(guide.path).not.toBe(guideFor('campaign', 'content').path)
  })

  test('a step action resolves to Section specifics Button link', () => {
    expect(guideFor('Transaction', 'what-to-do', { linkShape: 'button-link' }).path).toBe(
      'Content → What to Do → Section specifics → Button link'
    )
  })

  test('a button in an unattested host reports nothing at all', () => {
    // Rather than the old literal `Content → Button link`, a level that exists
    // on no Karl form.
    const guide = guideFor('Information', 'body', { linkShape: 'button-link' })
    expect(guide.path).toBe('')
    expect(guide.steps.join(' ')).not.toContain('Button link →')
  })

  test('every BUTTON_HOSTS row resolves to a path naming a Button link', () => {
    // The rows hold panel references now rather than path strings, so this
    // asserts the RESOLVED path — which is what a reviewer reads, and the only
    // thing that can go wrong once the breadcrumb is derived rather than typed.
    for (const [key, ref] of Object.entries(BUTTON_HOSTS)) {
      const [type, role] = key.split('.')
      const path = guideFor(type, role, { linkShape: 'button-link' }).path
      expect(path, `${key} should resolve`).not.toBe('')
      expect(path, `${key} should name a Button link`).toContain('Button link')
      expect(ref.within).toContain('Button link')
    }
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
    const { initKarlGuides } = await import('../js/karl/karl-guide.js')
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

describe('field references survive path resolution', () => {
  test('a Transaction step resolves to the Section specifics panel', () => {
    const ref = resolveFieldRef('transaction', 'what-to-do', {})
    expect(ref).toEqual({
      kind: 'panel',
      karlType: 'Transaction',
      rawName: 'section_specifics',
      within: undefined,
    })
  })

  test('a Spotlight CTA carries the nested Button link as its within', () => {
    const ref = resolveFieldRef('campaign', 'spotlight', { linkShape: 'button-link' })
    expect(ref).toEqual({
      kind: 'panel',
      karlType: 'Campaign',
      rawName: 'spotlight_1',
      within: 'Button link',
    })
  })

  test('a Promote field resolves to a promote ref, not a panel ref', () => {
    const ref = resolveFieldRef('transaction', 'seoTitle', {})
    expect(ref?.kind).toBe('promote')
    expect(ref?.field.rawName).toBe('seo_title')
  })

  test('an unresolved context has no reference at all', () => {
    expect(resolveFieldRef('transaction', 'content', { unresolvedId: 'U1' })).toBe(null)
  })

  // Path parity goes through guideFor(), the helper the rest of this file
  // already uses, because resolvePath is NOT exported — the existing suite
  // reaches it only through guideForContext, and widening the module's public
  // surface to let a test call it directly would make the refactor bigger than
  // the feature.
  test('the formatted path is exactly what it was before', () => {
    expect(guideFor('Transaction', 'what-to-do').path).toBe(
      'Content → What to Do → Section specifics'
    )
    expect(guideFor('Campaign', 'spotlight', { linkShape: 'button-link' }).path).toBe(
      'Content → Spotlight 1 → Button link'
    )
    expect(guideFor('Transaction', 'content', { unresolvedId: 'U1' }).path).toBe('')
  })

  // A non-null `kind: 'panel'` ref is not proof the panel resolves — it only
  // records that some lookup table (META_PANELS here) named a rawName for
  // this role. META_PANELS.description is type-agnostic, but Campaign, About
  // us and Report carry no 'description' panel in the field-map
  // transcription, so resolvePath() correctly reports '' / mockup-only for
  // them even though resolveFieldRef() handed back a reference. This is
  // deliberate asymmetry, not a bug to fix by tightening resolveFieldRef():
  // the confirming check belongs to panelByRawName()/breadcrumbFor(), which
  // is what resolvePath() (and any future consumer of a panel ref) must run
  // before treating the reference as a measured Karl destination. Transaction
  // is the contrasting case, where the same role DOES resolve.
  test('a non-null panel ref does not guarantee the panel resolves', () => {
    const campaignRef = resolveFieldRef('campaign', 'description', {})
    expect(campaignRef).toEqual({
      kind: 'panel',
      karlType: 'Campaign',
      rawName: 'description',
      within: undefined,
    })
    const campaignGuide = guideFor('Campaign', 'description')
    expect(campaignGuide.path).toBe('')
    expect(campaignGuide.status).toBe('mockup-only')

    const transactionGuide = guideFor('Transaction', 'description')
    expect(transactionGuide.path).toBe('Content → Description')
  })
})

describe('the guide carries the field the path leads to', () => {
  test('a Transaction step guide names the raw Wagtail field', () => {
    const guide = guideForContext({
      page: { type: 'Transaction' },
      context: { role: 'what-to-do' },
    })
    expect(guide.field.rawName).toBe('section_specifics')
    expect(guide.field.uiLabel).toBe('Section specifics')
  })

  // The inventory records required:false AND requiredDoc:'not recorded' for this
  // panel, and they are different claims: the boolean is this repo coercing an
  // absent measurement into a default, the string is what the field map says.
  // Rendering "Optional" would report a measurement nobody took.
  test("required and repeatable render the doc's own words, never the booleans", () => {
    const guide = guideForContext({
      page: { type: 'Transaction' },
      context: { role: 'what-to-do' },
    })
    expect(guide.field.required).toBe('not recorded')
    expect(guide.field.repeatable).toBe('repeatable')
    expect(guide.field.required).not.toBe('Optional')
    expect(typeof guide.field.required).toBe('string')
    expect(typeof guide.field.repeatable).toBe('string')
  })

  test('the block-type chooser contents come through verbatim', () => {
    const guide = guideForContext({
      page: { type: 'Transaction' },
      context: { role: 'what-to-do' },
    })
    expect(guide.field.blockTypes).toBe(
      'chooser: Address | Callout | Document | Email | Button link | Phone number | Text'
    )
  })

  test('a Promote field carries its own label and raw name', () => {
    const meta = fieldMetaFor(resolveFieldRef('transaction', 'seoTitle', {}))
    expect(meta.rawName).toBe('seo_title')
    expect(meta.uiLabel).toBe('Title tag')
  })

  // The whole point of resolvePath() returning '' is that an unrecorded
  // destination stays visibly unrecorded. A field block appearing without one
  // would put a confident field name under a "Mockup only" badge.
  test('a guide with no path carries no field at all', () => {
    const guide = guideForContext({
      page: { type: 'Information' },
      context: { role: 'contact' },
    })
    expect(guide.path).toBe('')
    expect(guide.field).toBeUndefined()
  })

  test('an unresolved guide carries no field either', () => {
    const guide = guideForContext({
      page: { type: 'Transaction' },
      context: { role: 'content', unresolvedId: 'U1' },
    })
    expect(guide.field).toBeUndefined()
  })

  // An authored guide.path is not second-guessed elsewhere in this function,
  // and a derived field block under it would claim a destination the author
  // did not name.
  test('an explicitly authored path carries no derived field', () => {
    const guide = guideForContext({
      page: { type: 'Transaction' },
      context: { role: 'what-to-do' },
      guide: { path: 'Content → Somewhere the author chose' },
    })
    expect(guide.path).toBe('Content → Somewhere the author chose')
    expect(guide.field).toBeUndefined()
  })

  // The production-reachable case fieldMetaFor()'s `if (!panel) return
  // undefined` guard exists for. META_PANELS.description is type-agnostic, so
  // resolveFieldRef() hands back a non-null `{kind: 'panel', rawName:
  // 'description', ...}` ref for EVERY page type — but panelByRawName() has no
  // 'description' entry for Campaign, About us, or Report, only for
  // Transaction, Information, Topic, Agency and Resource Collection. Without
  // this second check, a Campaign guide reporting `status: 'mockup-only'`
  // would ALSO print a confident field name for a field that does not exist on
  // that page type — a measured-looking answer nobody measured. The
  // contrasting Transaction case is asserted in the same test so this cannot
  // pass by the guard never firing at all.
  test('a page type with no description panel carries no field, even though the ref resolved', () => {
    const campaignGuide = guideForContext({
      page: { type: 'Campaign' },
      context: { role: 'description' },
    })
    expect(campaignGuide.path).toBe('')
    expect(campaignGuide.status).toBe('mockup-only')
    expect(campaignGuide.field).toBeUndefined()

    const transactionGuide = guideForContext({
      page: { type: 'Transaction' },
      context: { role: 'description' },
    })
    expect(transactionGuide.field.rawName).toBe('description')
  })
})

describe('the guide panel shows the field, not just the screen', () => {
  const transactionStep = () =>
    renderKarlGuidePanel(
      guideForContext({ page: { type: 'Transaction' }, context: { role: 'what-to-do' } }),
      'panel-1'
    )

  test('the raw Wagtail field name renders in a code element', () => {
    expect(transactionStep()).toContain('<code>section_specifics</code>')
  })

  test('the UI label renders beside it', () => {
    expect(transactionStep()).toContain('Section specifics')
  })

  test("the rules row prints the doc's required and repeatable wording", () => {
    const html = transactionStep()
    expect(html).toContain('not recorded')
    expect(html).toContain('repeatable')
  })

  test('the block-type chooser renders', () => {
    expect(transactionStep()).toContain('Button link | Phone number | Text')
  })

  // Same invariant the existing "the guide panel is phrasing content" block
  // asserts for the rest of the panel, restated for the new rows: the panel
  // renders inside a <span> that can sit inside a <p>, and a block-level start
  // tag closes that paragraph, so the panel escapes the ancestor it is
  // positioned against and reopens elsewhere on the page.
  test('the new rows emit no block-level element', () => {
    const html = transactionStep()
    expect(html).not.toMatch(/<(div|p|ul|ol|li|h[1-6])[\s>]/)
  })

  test('a guide with no field renders no field row at all', () => {
    const html = renderKarlGuidePanel(
      guideForContext({ page: { type: 'Information' }, context: { role: 'contact' } }),
      'panel-2'
    )
    expect(html).not.toContain('karl-guide-field')
    expect(html).not.toContain('karl-guide-rules')
  })

  test('field values are escaped', () => {
    const html = renderKarlGuidePanel(
      {
        path: 'Content',
        steps: [],
        field: {
          rawName: '<script>x</script>',
          uiLabel: 'a"b',
          required: 'yes',
          repeatable: 'single',
          blockTypes: '',
        },
      },
      'panel-3'
    )
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('a&quot;b')
  })
})
