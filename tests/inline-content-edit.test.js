// Unit tests for js/inline-content-edit.js — the click-to-edit orchestrator
// for SCALAR fields (title, summary, primaryCta, section heading, a single
// paragraph, a single bullet). Add/remove/undo/reset are Task 7's scope and
// are not exercised here.
//
// Unlike tests/inline-content-edit-refresh.test.js's module under test, this
// one needs real DOM behavior — real click/keydown/blur events bubbling up
// to a delegated #mockPage listener, real Element.replaceWith(), real
// <input>/<textarea> focus and value handling — so this file uses the real
// happy-dom `window`/`document` that tests/helpers/browser-env.js already
// registers globally, rather than replacing global.window wholesale the way
// the refresh test does for its DOM-free module. It only ATTACHS the mock
// dependencies (window.HHVC_DATA, window.ReviewUx.stateSync, etc.) onto that
// real window.
//
// js/inline-content-edit.js is a self-mounting IIFE (no module.exports), so
// each test imports it via a cache-busting dynamic import() to get a fresh
// closure (editingPath state must not leak between tests) — same pattern
// tests/inline-content-edit-refresh.test.js uses for its own IIFE-shaped
// module under test.
const { describe, test, expect, beforeEach, afterEach } = require('bun:test')
const path = require('path')
const realUtils = require('../js/utils.js')
require('../js/inline-content-edit-render.js') // side-effect: populates window.InlineEdit.render
// Imported once at file scope, not inside a test: js/ui-controls.js statically
// imports js/state.js, which side-effect-loads the REAL js/page-data.js (all
// 19 pages/*.js) and overwrites window.HHVC_DATA/window.ORIGINAL_DATA with the
// real dataset the moment it first runs. Importing it here, before any test's
// beforeEach/mountInlineContentEdit stub assigns the test-scoped
// window.HHVC_DATA, means that one-time real-data clobber happens up front and
// every test's own stub assignment (which always runs after this point) wins.
// Requiring it again inside a test returns the cached module with no further
// side effect, so this also documents why later `require('../js/ui-controls.js')`
// calls in the tests below are safe.
const { showToast: realShowToast } = require('../js/ui-controls.js')

const MODULE_PATH = path.resolve(__dirname, '../js/inline-content-edit.js')

let originalInlineEdit
let originalHHVCData
let originalOriginalData
let originalUtils
let originalRenderPage
let originalReviewUx
let originalShowToast

beforeEach(() => {
  originalInlineEdit = window.inlineEdit
  originalHHVCData = window.HHVC_DATA
  originalOriginalData = window.ORIGINAL_DATA
  originalUtils = window.utils
  originalRenderPage = window.renderPage
  originalReviewUx = window.ReviewUx
  originalShowToast = window.showToast
})

afterEach(() => {
  window.inlineEdit = originalInlineEdit
  window.HHVC_DATA = originalHHVCData
  window.ORIGINAL_DATA = originalOriginalData
  window.utils = originalUtils
  window.renderPage = originalRenderPage
  window.ReviewUx = originalReviewUx
  window.showToast = originalShowToast
  document.body.innerHTML = ''
})

/**
 * Mount a fresh instance of js/inline-content-edit.js against the real
 * happy-dom window/document, with a stubbed window.HHVC_DATA, renderPage,
 * and ReviewUx.stateSync.saveCurrentPageToLocalStorage — the three seams
 * the orchestrator reaches through.
 * @param {object} [options]
 * @param {object} [options.page] the page object window.HHVC_DATA.pages.testPage will hold
 * @returns {Promise<{
 *   inlineEdit: {ensureBound: Function, isEditing: Function},
 *   mockPage: HTMLElement,
 *   page: object,
 *   renderPageCalls: Array,
 *   getPersistCalls: () => number,
 * }>}
 */
async function mountInlineContentEdit({
  page = {
    title: 'Original Title',
    summary: 'Original summary text.',
    primaryCta: 'Original CTA',
    sections: [
      {
        heading: 'Original Heading',
        paragraphs: ['Original paragraph text.'],
        bullets: ['Original bullet text.'],
      },
    ],
  },
} = {}) {
  document.body.innerHTML = '<div id="mockPage"></div>'
  const mockPage = document.getElementById('mockPage')

  const renderPageCalls = []
  let persistCalls = 0

  window.HHVC_DATA = { pages: { testPage: page }, order: [['testPage', 'Test']] }
  window.ORIGINAL_DATA = { pages: {} }
  window.utils = { ...realUtils, getCurrentKey: () => 'testPage' }
  window.renderPage = (key, skipHistory) => {
    renderPageCalls.push({ key, skipHistory })
  }
  window.ReviewUx = {
    stateSync: {
      saveCurrentPageToLocalStorage: () => {
        persistCalls += 1
      },
    },
  }
  window.showToast = () => {}

  const modUrl = `${MODULE_PATH}?t=${Date.now()}-${Math.random()}`
  await import(modUrl)

  const inlineEdit = window.inlineEdit
  inlineEdit.ensureBound()

  return {
    inlineEdit,
    mockPage,
    page,
    renderPageCalls,
    getPersistCalls: () => persistCalls,
  }
}

/** Dispatch a real click event at an element, bubbling so #mockPage's delegated listener sees it. */
function click(el) {
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
}

/** Dispatch a keydown event with the given key at an element. */
function keydown(el, key) {
  el.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
}

describe('inline content edit: click-to-edit for scalar fields', () => {
  test('window.inlineEdit exposes ensureBound and isEditing', async () => {
    const { inlineEdit } = await mountInlineContentEdit()
    expect(typeof inlineEdit.ensureBound).toBe('function')
    expect(typeof inlineEdit.isEditing).toBe('function')
  })

  test('isEditing is false before any field is clicked', async () => {
    const { inlineEdit } = await mountInlineContentEdit()
    expect(inlineEdit.isEditing()).toBe(false)
  })

  test('clicking a title field swaps it for a pre-filled <input>', async () => {
    const { mockPage, inlineEdit } = await mountInlineContentEdit()
    mockPage.innerHTML = '<h1 data-rewrite-field="title">Original Title</h1>'
    const h1 = mockPage.querySelector('[data-rewrite-field="title"]')

    click(h1)

    const widget = mockPage.querySelector('[data-inline-edit-input]')
    expect(widget).not.toBeNull()
    expect(widget.tagName).toBe('INPUT')
    expect(widget.value).toBe('Original Title')
    expect(inlineEdit.isEditing()).toBe(true)
  })

  test('clicking a summary field swaps it for a pre-filled <textarea>', async () => {
    const { mockPage } = await mountInlineContentEdit()
    mockPage.innerHTML = '<p data-rewrite-field="summary">Original summary text.</p>'
    const p = mockPage.querySelector('[data-rewrite-field="summary"]')

    click(p)

    const widget = mockPage.querySelector('[data-inline-edit-input]')
    expect(widget.tagName).toBe('TEXTAREA')
    expect(widget.value).toBe('Original summary text.')
  })

  test('clicking a section heading swaps it for a pre-filled <input>', async () => {
    const { mockPage } = await mountInlineContentEdit()
    mockPage.innerHTML = '<h2 data-rewrite-field="sections.0.heading">Original Heading</h2>'
    const h2 = mockPage.querySelector('[data-rewrite-field="sections.0.heading"]')

    click(h2)

    const widget = mockPage.querySelector('[data-inline-edit-input]')
    expect(widget.tagName).toBe('INPUT')
    expect(widget.value).toBe('Original Heading')
  })

  test('clicking a paragraph swaps it for a pre-filled <textarea>', async () => {
    const { mockPage } = await mountInlineContentEdit()
    mockPage.innerHTML =
      '<p data-rewrite-field="sections.0.paragraphs.0">Original paragraph text.</p>'
    const p = mockPage.querySelector('[data-rewrite-field="sections.0.paragraphs.0"]')

    click(p)

    const widget = mockPage.querySelector('[data-inline-edit-input]')
    expect(widget.tagName).toBe('TEXTAREA')
    expect(widget.value).toBe('Original paragraph text.')
  })

  test('clicking a bullet swaps it for a pre-filled <textarea>', async () => {
    const { mockPage } = await mountInlineContentEdit()
    mockPage.innerHTML = '<li data-rewrite-field="sections.0.bullets.0">Original bullet text.</li>'
    const li = mockPage.querySelector('[data-rewrite-field="sections.0.bullets.0"]')

    click(li)

    const widget = mockPage.querySelector('[data-inline-edit-input]')
    expect(widget.tagName).toBe('TEXTAREA')
    expect(widget.value).toBe('Original bullet text.')
  })

  test('clicking a primaryCta field swaps it for a pre-filled <input>', async () => {
    const { mockPage } = await mountInlineContentEdit()
    mockPage.innerHTML = '<a data-rewrite-field="primaryCta">Original CTA</a>'
    const a = mockPage.querySelector('[data-rewrite-field="primaryCta"]')

    click(a)

    const widget = mockPage.querySelector('[data-inline-edit-input]')
    expect(widget.tagName).toBe('INPUT')
    expect(widget.value).toBe('Original CTA')
  })

  test('clicking a hero CTA rendered as an external <a href> opens the editor and prevents navigation', async () => {
    // Matches what js/page-render.js actually produces: data-rewrite-field
    // sits on the WRAPPING <div class="hero-cta">, not on the anchor, and
    // button() renders a real navigating <a href target="_blank"> for a CTA
    // with a buttonUrl (e.g. mosquito-education-workshop.js). Without a
    // scoped event.preventDefault(), clicking this anchor both opens the
    // inline editor (delegated click bubbling to the ancestor
    // [data-rewrite-field] div) AND navigates in a new tab (native anchor
    // behavior) — this test proves only the former happens.
    const { mockPage } = await mountInlineContentEdit()
    mockPage.innerHTML =
      '<div class="hero-cta" data-rewrite-field="primaryCta">' +
      '<a class="btn" href="https://example.com" target="_blank" rel="noopener noreferrer">Original CTA</a>' +
      '</div>'
    const anchor = mockPage.querySelector('a[href]')

    const event = new window.MouseEvent('click', { bubbles: true, cancelable: true })
    anchor.dispatchEvent(event)

    const widget = mockPage.querySelector('[data-inline-edit-input]')
    expect(widget).not.toBeNull()
    expect(widget.tagName).toBe('INPUT')
    expect(widget.value).toBe('Original CTA')
    expect(event.defaultPrevented).toBe(true)
  })

  test('clicking a hero CTA rendered as an internal-target <button> still opens the editor (regression guard)', async () => {
    // The internal-target CTA variant has no href to prevent — button()
    // renders a bare <button type="button" data-render-target="...">, which
    // does not navigate on click by default. This proves the anchor-scoped
    // preventDefault() fix does not change behavior for this variant: the
    // editor still opens normally.
    const { mockPage } = await mountInlineContentEdit()
    mockPage.innerHTML =
      '<div class="hero-cta" data-rewrite-field="primaryCta">' +
      '<button type="button" class="btn" data-render-target="pestsTopic">Original CTA</button>' +
      '</div>'
    const button = mockPage.querySelector('button[data-render-target]')

    const event = new window.MouseEvent('click', { bubbles: true, cancelable: true })
    button.dispatchEvent(event)

    const widget = mockPage.querySelector('[data-inline-edit-input]')
    expect(widget).not.toBeNull()
    expect(widget.tagName).toBe('INPUT')
    expect(widget.value).toBe('Original CTA')
    // Buttons have no default navigation action, so this is a no-op either
    // way — asserted for clarity of intent, not because it's load-bearing.
    expect(event.defaultPrevented).toBe(false)
  })

  test('clicking an inline reference link inside a paragraph opens that paragraph editor and prevents navigation', async () => {
    // The hero CTA isn't the only place a navigating anchor sits inside a
    // [data-rewrite-field] element. formatMarkdown() (js/page-render.js)
    // turns a [label](https://...) markdown link in body copy into
    // <a class="inline-link" href="..." target="_blank" rel="noopener
    // noreferrer">, rendered directly inside the <p data-rewrite-field=
    // "sections.N.paragraphs.M"> the text belongs to — reachable wherever a
    // paragraph or bullet cites an external source. By design, clicking that
    // link opens the paragraph's editor rather than following the citation:
    // editing the field takes priority over navigating away from the review
    // tool while a reviewer is trying to edit the very text the link sits
    // in. This mirrors the hero-CTA case one level deeper in the DOM.
    const { mockPage } = await mountInlineContentEdit()
    mockPage.innerHTML =
      '<p data-rewrite-field="sections.0.paragraphs.0">' +
      'See the ' +
      '<a class="inline-link" href="https://example.com/source" target="_blank" rel="noopener noreferrer">' +
      'source document <span aria-hidden="true">↗</span></a> for details.' +
      '</p>'
    const inlineLink = mockPage.querySelector('a.inline-link')

    const event = new window.MouseEvent('click', { bubbles: true, cancelable: true })
    inlineLink.dispatchEvent(event)

    const widget = mockPage.querySelector('[data-inline-edit-input]')
    expect(widget).not.toBeNull()
    expect(widget.tagName).toBe('TEXTAREA')
    expect(widget.value).toBe('Original paragraph text.')
    expect(event.defaultPrevented).toBe(true)
  })

  test('committing a title edit via Enter writes page.title, persists, and re-renders', async () => {
    const { mockPage, page, renderPageCalls, getPersistCalls } = await mountInlineContentEdit()
    mockPage.innerHTML = '<h1 data-rewrite-field="title">Original Title</h1>'
    click(mockPage.querySelector('[data-rewrite-field="title"]'))

    const widget = mockPage.querySelector('[data-inline-edit-input]')
    widget.value = 'New Title'
    keydown(widget, 'Enter')

    expect(page.title).toBe('New Title')
    expect(getPersistCalls()).toBe(1)
    expect(renderPageCalls).toEqual([{ key: 'testPage', skipHistory: true }])
  })

  test('committing a summary edit via blur writes page.summary, persists, and re-renders', async () => {
    const { mockPage, page, renderPageCalls, getPersistCalls } = await mountInlineContentEdit()
    mockPage.innerHTML = '<p data-rewrite-field="summary">Original summary text.</p>'
    click(mockPage.querySelector('[data-rewrite-field="summary"]'))

    const widget = mockPage.querySelector('[data-inline-edit-input]')
    widget.value = 'New summary text.'
    widget.dispatchEvent(new window.Event('blur'))

    expect(page.summary).toBe('New summary text.')
    expect(getPersistCalls()).toBe(1)
    expect(renderPageCalls).toEqual([{ key: 'testPage', skipHistory: true }])
  })

  test('committing a primaryCta edit writes the CTA label via setPrimaryCta', async () => {
    const { mockPage, page } = await mountInlineContentEdit()
    mockPage.innerHTML = '<a data-rewrite-field="primaryCta">Original CTA</a>'
    click(mockPage.querySelector('[data-rewrite-field="primaryCta"]'))

    const widget = mockPage.querySelector('[data-inline-edit-input]')
    widget.value = 'New CTA'
    keydown(widget, 'Enter')

    expect(realUtils.getPrimaryCta(page)).toBe('New CTA')
  })

  test('committing a heading edit writes it via setByPath', async () => {
    const { mockPage, page } = await mountInlineContentEdit()
    mockPage.innerHTML = '<h2 data-rewrite-field="sections.0.heading">Original Heading</h2>'
    click(mockPage.querySelector('[data-rewrite-field="sections.0.heading"]'))

    const widget = mockPage.querySelector('[data-inline-edit-input]')
    widget.value = 'New Heading'
    keydown(widget, 'Enter')

    expect(page.sections[0].heading).toBe('New Heading')
  })

  test('committing a paragraph edit writes the tagged {text, unverified} object form', async () => {
    const { mockPage, page } = await mountInlineContentEdit()
    mockPage.innerHTML =
      '<p data-rewrite-field="sections.0.paragraphs.0">Original paragraph text.</p>'
    click(mockPage.querySelector('[data-rewrite-field="sections.0.paragraphs.0"]'))

    const widget = mockPage.querySelector('[data-inline-edit-input]')
    widget.value = 'New paragraph text.'
    widget.dispatchEvent(new window.Event('blur'))

    expect(page.sections[0].paragraphs[0]).toEqual({
      text: 'New paragraph text.',
      unverified: true,
      unverifiedReason: 'Manually edited during review',
    })
  })

  test('committing a bullet edit writes the tagged {text, unverified} object form', async () => {
    const { mockPage, page } = await mountInlineContentEdit()
    mockPage.innerHTML = '<li data-rewrite-field="sections.0.bullets.0">Original bullet text.</li>'
    click(mockPage.querySelector('[data-rewrite-field="sections.0.bullets.0"]'))

    const widget = mockPage.querySelector('[data-inline-edit-input]')
    widget.value = 'New bullet text.'
    widget.dispatchEvent(new window.Event('blur'))

    expect(page.sections[0].bullets[0]).toEqual({
      text: 'New bullet text.',
      unverified: true,
      unverifiedReason: 'Manually edited during review',
    })
  })

  test('Escape cancels the edit: no write, no persist, but does re-render to restore the view', async () => {
    const { mockPage, page, renderPageCalls, getPersistCalls } = await mountInlineContentEdit()
    mockPage.innerHTML = '<p data-rewrite-field="summary">Original summary text.</p>'
    click(mockPage.querySelector('[data-rewrite-field="summary"]'))

    const widget = mockPage.querySelector('[data-inline-edit-input]')
    widget.value = 'Should not be saved.'
    keydown(widget, 'Escape')

    expect(page.summary).toBe('Original summary text.')
    expect(getPersistCalls()).toBe(0)
    expect(renderPageCalls).toEqual([{ key: 'testPage', skipHistory: true }])
  })

  test('Escape on an <input>-backed field also cancels without writing', async () => {
    const { mockPage, page, getPersistCalls } = await mountInlineContentEdit()
    mockPage.innerHTML = '<h1 data-rewrite-field="title">Original Title</h1>'
    click(mockPage.querySelector('[data-rewrite-field="title"]'))

    const widget = mockPage.querySelector('[data-inline-edit-input]')
    widget.value = 'Should not be saved.'
    keydown(widget, 'Escape')

    expect(page.title).toBe('Original Title')
    expect(getPersistCalls()).toBe(0)
  })

  test('isEditing returns to false after commit', async () => {
    const { mockPage, inlineEdit } = await mountInlineContentEdit()
    mockPage.innerHTML = '<h1 data-rewrite-field="title">Original Title</h1>'
    click(mockPage.querySelector('[data-rewrite-field="title"]'))
    expect(inlineEdit.isEditing()).toBe(true)

    const widget = mockPage.querySelector('[data-inline-edit-input]')
    keydown(widget, 'Enter')

    expect(inlineEdit.isEditing()).toBe(false)
  })

  test('isEditing returns to false after cancel', async () => {
    const { mockPage, inlineEdit } = await mountInlineContentEdit()
    mockPage.innerHTML = '<h1 data-rewrite-field="title">Original Title</h1>'
    click(mockPage.querySelector('[data-rewrite-field="title"]'))

    const widget = mockPage.querySelector('[data-inline-edit-input]')
    keydown(widget, 'Escape')

    expect(inlineEdit.isEditing()).toBe(false)
  })

  test('Enter then blur on the same input commits only once (no double-save)', async () => {
    const { mockPage, page, renderPageCalls, getPersistCalls } = await mountInlineContentEdit()
    mockPage.innerHTML = '<h1 data-rewrite-field="title">Original Title</h1>'
    click(mockPage.querySelector('[data-rewrite-field="title"]'))

    const widget = mockPage.querySelector('[data-inline-edit-input]')
    widget.value = 'New Title'
    keydown(widget, 'Enter')
    // Enter's commit already replaced `widget` in the DOM via target.replaceWith();
    // simulate the blur a real browser would still fire on the detached node.
    widget.dispatchEvent(new window.Event('blur'))

    expect(page.title).toBe('New Title')
    expect(getPersistCalls()).toBe(1)
    expect(renderPageCalls.length).toBe(1)
  })

  test('clicking a second field while one is already open does not open a second editor', async () => {
    const { mockPage } = await mountInlineContentEdit()
    mockPage.innerHTML =
      '<h1 data-rewrite-field="title">Original Title</h1>' +
      '<p data-rewrite-field="summary">Original summary text.</p>'
    click(mockPage.querySelector('[data-rewrite-field="title"]'))
    click(mockPage.querySelector('[data-rewrite-field="summary"]'))

    const widgets = mockPage.querySelectorAll('[data-inline-edit-input]')
    expect(widgets.length).toBe(1)
  })

  test('ensureBound is idempotent: calling it twice does not double-bind the click listener', async () => {
    const { mockPage, inlineEdit, page, renderPageCalls } = await mountInlineContentEdit()
    inlineEdit.ensureBound()
    inlineEdit.ensureBound()

    mockPage.innerHTML = '<h1 data-rewrite-field="title">Original Title</h1>'
    click(mockPage.querySelector('[data-rewrite-field="title"]'))
    const widget = mockPage.querySelector('[data-inline-edit-input]')
    widget.value = 'New Title'
    keydown(widget, 'Enter')

    // A double-bound listener would run openScalarEditor/commit twice per
    // click, which would show up as two render calls for one Enter commit.
    expect(renderPageCalls.length).toBe(1)
    expect(page.title).toBe('New Title')
  })

  test('a click outside any [data-rewrite-field] element does nothing', async () => {
    const { mockPage, renderPageCalls } = await mountInlineContentEdit()
    mockPage.innerHTML = '<div class="not-editable">plain content</div>'
    click(mockPage.querySelector('.not-editable'))

    expect(mockPage.querySelector('[data-inline-edit-input]')).toBeNull()
    expect(renderPageCalls).toEqual([])
  })
})

// Task 7: add/remove for paragraph/bullet arrays, one-step undo, and
// per-field "Reset to original". These tests reuse mountInlineContentEdit's
// stubbed window.renderPage (which does not actually repaint #mockPage), so
// each test rebuilds mockPage.innerHTML by hand after a mutating action to
// simulate what the real renderPage would have painted, then calls the
// module's decoration entry points directly through a real click/DOM path
// wherever the assertion is about click behavior, and through init()/rerender
// side effects wherever it's about decoration. This mirrors how
// tests/inline-content-edit-refresh.test.js drives IIFE-internal behavior
// through its published seams rather than reaching into the closure.
describe('inline content edit: add/remove/undo for paragraph and bullet arrays', () => {
  test('clicking an Add control appends an empty tagged item and opens it in edit mode', async () => {
    const { mockPage, page } = await mountInlineContentEdit()
    mockPage.innerHTML =
      '<li data-rewrite-field="sections.0.bullets.0">Original bullet text.</li>' +
      '<button type="button" data-inline-edit-add="sections.0.bullets">+ Add</button>'

    click(mockPage.querySelector('[data-inline-edit-add]'))

    expect(page.sections[0].bullets.length).toBe(2)
    expect(page.sections[0].bullets[1]).toEqual({
      text: '',
      unverified: true,
      unverifiedReason: 'Manually edited during review',
    })
  })

  test('Add control click does not open a scalar editor on the same click', async () => {
    const { mockPage, inlineEdit } = await mountInlineContentEdit()
    mockPage.innerHTML =
      '<li data-rewrite-field="sections.0.bullets.0">Original bullet text.</li>' +
      '<button type="button" data-inline-edit-add="sections.0.bullets">+ Add</button>'

    click(mockPage.querySelector('[data-inline-edit-add]'))

    // The click landed on the Add button, not on a [data-rewrite-field]
    // element, so no scalar editor opens as a side effect of this click.
    expect(inlineEdit.isEditing()).toBe(false)
  })

  test('clicking a Remove control deletes exactly that item via a whole-array replace', async () => {
    const { mockPage, page } = await mountInlineContentEdit({
      page: {
        title: 'T',
        summary: 'S',
        sections: [{ heading: 'H', paragraphs: [], bullets: ['First', 'Second', 'Third'] }],
      },
    })
    mockPage.innerHTML =
      '<li data-rewrite-field="sections.0.bullets.0">First</li>' +
      '<li data-rewrite-field="sections.0.bullets.1">Second</li>' +
      '<li data-rewrite-field="sections.0.bullets.2">Third</li>' +
      '<button type="button" data-inline-edit-remove="sections.0.bullets" data-inline-edit-index="1">×</button>'

    click(mockPage.querySelector('[data-inline-edit-remove]'))

    // Whole-array-replace: the resulting array has the middle item gone,
    // written back as a fresh array, not a per-index splice against
    // whatever the live array happened to be at click time.
    expect(page.sections[0].bullets).toEqual(['First', 'Third'])
  })

  test('removing an item persists and re-renders', async () => {
    const { mockPage, getPersistCalls, renderPageCalls } = await mountInlineContentEdit({
      page: {
        title: 'T',
        summary: 'S',
        sections: [{ heading: 'H', paragraphs: [], bullets: ['First', 'Second'] }],
      },
    })
    mockPage.innerHTML =
      '<li data-rewrite-field="sections.0.bullets.0">First</li>' +
      '<li data-rewrite-field="sections.0.bullets.1">Second</li>' +
      '<button type="button" data-inline-edit-remove="sections.0.bullets" data-inline-edit-index="0">×</button>'

    click(mockPage.querySelector('[data-inline-edit-remove]'))

    expect(getPersistCalls()).toBe(1)
    expect(renderPageCalls).toEqual([{ key: 'testPage', skipHistory: true }])
  })

  test('removing an item shows a toast whose action button carries the undo marker', async () => {
    const { mockPage } = await mountInlineContentEdit({
      page: {
        title: 'T',
        summary: 'S',
        sections: [{ heading: 'H', paragraphs: [], bullets: ['First', 'Second'] }],
      },
    })
    document.body.insertAdjacentHTML('beforeend', '<div id="toastContainer"></div>')
    window.showToast = realShowToast

    mockPage.innerHTML =
      '<li data-rewrite-field="sections.0.bullets.0">First</li>' +
      '<li data-rewrite-field="sections.0.bullets.1">Second</li>' +
      '<button type="button" data-inline-edit-remove="sections.0.bullets" data-inline-edit-index="0">×</button>'

    click(mockPage.querySelector('[data-inline-edit-remove]'))

    const toast = document.querySelector('#toastContainer .toast')
    expect(toast).not.toBeNull()
    expect(toast.textContent).toContain('Removed bullet.')
    const undoButton = toast.querySelector('[data-inline-edit-undo]')
    expect(undoButton).not.toBeNull()
    expect(undoButton.textContent).toBe('Undo')
  })

  test('clicking the toast Undo button restores the removed item at its original position', async () => {
    const { mockPage, page } = await mountInlineContentEdit({
      page: {
        title: 'T',
        summary: 'S',
        sections: [{ heading: 'H', paragraphs: [], bullets: ['First', 'Second', 'Third'] }],
      },
    })
    document.body.insertAdjacentHTML('beforeend', '<div id="toastContainer"></div>')
    window.showToast = realShowToast

    mockPage.innerHTML =
      '<li data-rewrite-field="sections.0.bullets.0">First</li>' +
      '<li data-rewrite-field="sections.0.bullets.1">Second</li>' +
      '<li data-rewrite-field="sections.0.bullets.2">Third</li>' +
      '<button type="button" data-inline-edit-remove="sections.0.bullets" data-inline-edit-index="1">×</button>'

    click(mockPage.querySelector('[data-inline-edit-remove]'))
    expect(page.sections[0].bullets).toEqual(['First', 'Third'])

    click(document.querySelector('#toastContainer [data-inline-edit-undo]'))

    expect(page.sections[0].bullets).toEqual(['First', 'Second', 'Third'])
  })

  test('undo is consumed on use: undo is only offered once per removal', async () => {
    const { mockPage, page } = await mountInlineContentEdit({
      page: {
        title: 'T',
        summary: 'S',
        sections: [{ heading: 'H', paragraphs: [], bullets: ['First', 'Second'] }],
      },
    })
    document.body.insertAdjacentHTML('beforeend', '<div id="toastContainer"></div>')
    window.showToast = realShowToast

    mockPage.innerHTML =
      '<li data-rewrite-field="sections.0.bullets.0">First</li>' +
      '<li data-rewrite-field="sections.0.bullets.1">Second</li>' +
      '<button type="button" data-inline-edit-remove="sections.0.bullets" data-inline-edit-index="0">×</button>'
    click(mockPage.querySelector('[data-inline-edit-remove]'))
    expect(page.sections[0].bullets).toEqual(['Second'])

    const undoButton = document.querySelector('#toastContainer [data-inline-edit-undo]')
    click(undoButton)
    expect(page.sections[0].bullets).toEqual(['First', 'Second'])

    // The toast (and its undo button) is gone after being clicked once —
    // showToast's own close-on-action behavior — so a second click has
    // nothing left to act on.
    expect(document.querySelector('#toastContainer [data-inline-edit-undo]')).toBeNull()
  })

  test('undo is a no-op if the reviewer navigated to a different page before clicking it', async () => {
    const { mockPage, page, getPersistCalls } = await mountInlineContentEdit({
      page: {
        title: 'T',
        summary: 'S',
        sections: [{ heading: 'H', paragraphs: [], bullets: ['First', 'Second'] }],
      },
    })
    document.body.insertAdjacentHTML('beforeend', '<div id="toastContainer"></div>')
    window.showToast = realShowToast

    mockPage.innerHTML =
      '<li data-rewrite-field="sections.0.bullets.0">First</li>' +
      '<li data-rewrite-field="sections.0.bullets.1">Second</li>' +
      '<button type="button" data-inline-edit-remove="sections.0.bullets" data-inline-edit-index="0">×</button>'

    click(mockPage.querySelector('[data-inline-edit-remove]'))
    expect(page.sections[0].bullets).toEqual(['Second'])
    const persistCallsAfterRemove = getPersistCalls()

    // Simulate navigating to a different page before the undo toast is
    // clicked — getCurrentKey() is the seam js/ux-improvements.js's real
    // navigation flips.
    window.utils.getCurrentKey = () => 'otherPage'

    const undoButton = document.querySelector('#toastContainer [data-inline-edit-undo]')
    click(undoButton)

    // Must not silently restore-and-save under the wrong page: the removed
    // item stays removed (no in-memory restore either — restoring the data
    // without a matching save would just move the bug, not fix it) and no
    // extra persist() call fires.
    expect(page.sections[0].bullets).toEqual(['Second'])
    expect(getPersistCalls()).toBe(persistCallsAfterRemove)
  })

  test('removing a paragraph reports the singular label "paragraph" in the toast', async () => {
    const { mockPage } = await mountInlineContentEdit({
      page: {
        title: 'T',
        summary: 'S',
        sections: [{ heading: 'H', paragraphs: ['Only one.'], bullets: [] }],
      },
    })
    document.body.insertAdjacentHTML('beforeend', '<div id="toastContainer"></div>')
    window.showToast = realShowToast

    mockPage.innerHTML =
      '<p data-rewrite-field="sections.0.paragraphs.0">Only one.</p>' +
      '<button type="button" data-inline-edit-remove="sections.0.paragraphs" data-inline-edit-index="0">×</button>'

    click(mockPage.querySelector('[data-inline-edit-remove]'))

    const toast = document.querySelector('#toastContainer .toast')
    expect(toast.textContent).toContain('Removed paragraph.')
  })
})

describe('inline content edit: per-field reset to original', () => {
  test('resetting a heading restores its ORIGINAL_DATA value, persists, and re-renders', async () => {
    const { mockPage, page, getPersistCalls, renderPageCalls } = await mountInlineContentEdit()
    window.ORIGINAL_DATA = {
      pages: {
        testPage: {
          title: 'Original Title',
          sections: [{ heading: 'Original Heading' }],
        },
      },
    }
    page.sections[0].heading = 'Edited Heading'
    mockPage.innerHTML =
      '<h2 data-rewrite-field="sections.0.heading">' +
      'Edited Heading<button type="button" data-inline-edit-reset="sections.0.heading">Reset to original</button>' +
      '</h2>'

    click(mockPage.querySelector('[data-inline-edit-reset]'))

    expect(page.sections[0].heading).toBe('Original Heading')
    expect(getPersistCalls()).toBe(1)
    expect(renderPageCalls).toEqual([{ key: 'testPage', skipHistory: true }])
  })

  test('resetting title restores page.title directly', async () => {
    const { mockPage, page } = await mountInlineContentEdit()
    window.ORIGINAL_DATA = { pages: { testPage: { title: 'Original Title' } } }
    page.title = 'Edited Title'
    mockPage.innerHTML =
      '<h1 data-rewrite-field="title">Edited Title' +
      '<button type="button" data-inline-edit-reset="title">Reset to original</button></h1>'

    click(mockPage.querySelector('[data-inline-edit-reset]'))

    expect(page.title).toBe('Original Title')
  })

  test('resetting summary restores page.summary directly', async () => {
    const { mockPage, page } = await mountInlineContentEdit()
    window.ORIGINAL_DATA = { pages: { testPage: { summary: 'Original summary text.' } } }
    page.summary = 'Edited summary.'
    mockPage.innerHTML =
      '<p data-rewrite-field="summary">Edited summary.' +
      '<button type="button" data-inline-edit-reset="summary">Reset to original</button></p>'

    click(mockPage.querySelector('[data-inline-edit-reset]'))

    expect(page.summary).toBe('Original summary text.')
  })

  test('resetting primaryCta restores the CTA label via setPrimaryCta', async () => {
    const { mockPage, page } = await mountInlineContentEdit()
    window.ORIGINAL_DATA = { pages: { testPage: { primaryCta: 'Original CTA' } } }
    realUtils.setPrimaryCta(page, 'Edited CTA')
    mockPage.innerHTML =
      '<a data-rewrite-field="primaryCta">Edited CTA' +
      '<button type="button" data-inline-edit-reset="primaryCta">Reset to original</button></a>'

    click(mockPage.querySelector('[data-inline-edit-reset]'))

    expect(realUtils.getPrimaryCta(page)).toBe('Original CTA')
  })

  test('a click outside any reset/add/remove control is unaffected (regression guard)', async () => {
    const { mockPage, page } = await mountInlineContentEdit()
    mockPage.innerHTML = '<h1 data-rewrite-field="title">Original Title</h1>'
    click(mockPage.querySelector('[data-rewrite-field="title"]'))

    // Normal scalar editing still opens as before; reset/add/remove wiring
    // must not have broken the plain click-to-edit path from Task 6.
    expect(mockPage.querySelector('[data-inline-edit-input]')).not.toBeNull()
    expect(page.title).toBe('Original Title')
  })
})

describe('inline content edit: decorateListControls appends add/remove controls after render', () => {
  test('init() decorates a bullet list already present at mount with a remove control per item and one add control', async () => {
    document.body.innerHTML =
      '<div id="mockPage">' +
      '<ul>' +
      '<li data-rewrite-field="sections.0.bullets.0">First</li>' +
      '<li data-rewrite-field="sections.0.bullets.1">Second</li>' +
      '</ul>' +
      '</div>'
    const mockPage = document.getElementById('mockPage')

    window.HHVC_DATA = {
      pages: {
        testPage: {
          title: 'T',
          summary: 'S',
          sections: [{ heading: 'H', paragraphs: [], bullets: ['First', 'Second'] }],
        },
      },
      order: [['testPage', 'Test']],
    }
    window.ORIGINAL_DATA = { pages: {} }
    window.utils = { ...realUtils, getCurrentKey: () => 'testPage' }
    window.renderPage = () => {}
    window.ReviewUx = { stateSync: { saveCurrentPageToLocalStorage: () => {} } }
    window.showToast = () => {}

    const modUrl = `${MODULE_PATH}?t=${Date.now()}-${Math.random()}`
    await import(modUrl)

    const removeControls = mockPage.querySelectorAll('[data-inline-edit-remove]')
    expect(removeControls.length).toBe(2)
    const addControls = mockPage.querySelectorAll('[data-inline-edit-add]')
    expect(addControls.length).toBe(1)
    expect(addControls[0].getAttribute('data-inline-edit-add')).toBe('sections.0.bullets')
  })

  test('the add control is placed after the last bullet item', async () => {
    document.body.innerHTML =
      '<div id="mockPage">' +
      '<ul>' +
      '<li data-rewrite-field="sections.0.bullets.0">First</li>' +
      '<li data-rewrite-field="sections.0.bullets.1">Second</li>' +
      '</ul>' +
      '</div>'
    const mockPage = document.getElementById('mockPage')

    window.HHVC_DATA = {
      pages: {
        testPage: {
          title: 'T',
          summary: 'S',
          sections: [{ heading: 'H', paragraphs: [], bullets: ['First', 'Second'] }],
        },
      },
      order: [['testPage', 'Test']],
    }
    window.ORIGINAL_DATA = { pages: {} }
    window.utils = { ...realUtils, getCurrentKey: () => 'testPage' }
    window.renderPage = () => {}
    window.ReviewUx = { stateSync: { saveCurrentPageToLocalStorage: () => {} } }
    window.showToast = () => {}

    const modUrl = `${MODULE_PATH}?t=${Date.now()}-${Math.random()}`
    await import(modUrl)

    // The add control is wrapped in its own <li> when appended to a <ul> —
    // a <ul>'s only valid children are <li> elements (axe's "list" rule
    // flags a bare sibling <button>, confirmed live on the scopeInfo page),
    // so the direct ul > * child to look for is the <li> containing the
    // control, not the control itself.
    const items = Array.from(mockPage.querySelectorAll('ul > *'))
    const lastItemIndex = items.findIndex((el) => el.querySelector('[data-inline-edit-add]'))
    expect(lastItemIndex).toBe(items.length - 1)
    expect(items[lastItemIndex].tagName).toBe('LI')
  })

  test('a bullets array with zero items still gets an add control, anchored to the section heading (no dead end)', async () => {
    // No <ul> at all: bulletList() in js/page-render.js renders '' for an
    // empty array, whether the list was just emptied via the remove control
    // or authored empty — both cases produce the same DOM shape this test
    // exercises.
    document.body.innerHTML =
      '<div id="mockPage"><h2 data-rewrite-field="sections.0.heading">H</h2></div>'
    const mockPage = document.getElementById('mockPage')

    window.HHVC_DATA = {
      pages: {
        // No `paragraphs` key at all, so only `bullets` is an eligible empty
        // container — keeps the assertion below unambiguous about ordering.
        testPage: { title: 'T', summary: 'S', sections: [{ heading: 'H', bullets: [] }] },
      },
      order: [['testPage', 'Test']],
    }
    window.ORIGINAL_DATA = { pages: {} }
    window.utils = { ...realUtils, getCurrentKey: () => 'testPage' }
    window.renderPage = () => {}
    window.ReviewUx = { stateSync: { saveCurrentPageToLocalStorage: () => {} } }
    window.showToast = () => {}

    const modUrl = `${MODULE_PATH}?t=${Date.now()}-${Math.random()}`
    await import(modUrl)

    const addControl = mockPage.querySelector('[data-inline-edit-add="sections.0.bullets"]')
    expect(addControl).not.toBeNull()
    expect(addControl.previousElementSibling).toBe(
      mockPage.querySelector('[data-rewrite-field="sections.0.heading"]')
    )
  })

  test('clicking Add on an emptied bullets list appends the first item (whole-array-replace from empty)', async () => {
    const { mockPage, page } = await mountInlineContentEdit({
      page: {
        title: 'T',
        summary: 'S',
        sections: [{ heading: 'H', paragraphs: [], bullets: [] }],
      },
    })
    mockPage.innerHTML =
      '<h2 data-rewrite-field="sections.0.heading">H</h2>' +
      '<button type="button" data-inline-edit-add="sections.0.bullets">+ Add</button>'

    click(mockPage.querySelector('[data-inline-edit-add]'))

    expect(page.sections[0].bullets).toEqual([
      { text: '', unverified: true, unverifiedReason: 'Manually edited during review' },
    ])
  })
})

describe('inline content edit: decorateEditedFields applies the Edited badge and reset control', () => {
  test('a heading that differs from ORIGINAL_DATA is decorated with the badge and a reset control', async () => {
    document.body.innerHTML =
      '<div id="mockPage"><h2 data-rewrite-field="sections.0.heading">Edited Heading</h2></div>'
    const mockPage = document.getElementById('mockPage')

    window.HHVC_DATA = {
      pages: {
        testPage: { title: 'T', summary: 'S', sections: [{ heading: 'Edited Heading' }] },
      },
      order: [['testPage', 'Test']],
    }
    window.ORIGINAL_DATA = {
      pages: {
        testPage: { title: 'T', summary: 'S', sections: [{ heading: 'Original Heading' }] },
      },
    }
    window.utils = { ...realUtils, getCurrentKey: () => 'testPage' }
    window.renderPage = () => {}
    window.ReviewUx = { stateSync: { saveCurrentPageToLocalStorage: () => {} } }
    window.showToast = () => {}

    const modUrl = `${MODULE_PATH}?t=${Date.now()}-${Math.random()}`
    await import(modUrl)

    const heading = mockPage.querySelector('[data-rewrite-field="sections.0.heading"]')
    expect(heading.querySelector('.inline-edit-badge')).not.toBeNull()
    const reset = heading.querySelector('.inline-edit-reset')
    expect(reset).not.toBeNull()
    expect(reset.getAttribute('data-inline-edit-reset')).toBe('sections.0.heading')
  })

  test('a heading matching ORIGINAL_DATA gets no badge', async () => {
    document.body.innerHTML =
      '<div id="mockPage"><h2 data-rewrite-field="sections.0.heading">Same Heading</h2></div>'
    const mockPage = document.getElementById('mockPage')

    window.HHVC_DATA = {
      pages: { testPage: { title: 'T', summary: 'S', sections: [{ heading: 'Same Heading' }] } },
      order: [['testPage', 'Test']],
    }
    window.ORIGINAL_DATA = {
      pages: { testPage: { title: 'T', summary: 'S', sections: [{ heading: 'Same Heading' }] } },
    }
    window.utils = { ...realUtils, getCurrentKey: () => 'testPage' }
    window.renderPage = () => {}
    window.ReviewUx = { stateSync: { saveCurrentPageToLocalStorage: () => {} } }
    window.showToast = () => {}

    const modUrl = `${MODULE_PATH}?t=${Date.now()}-${Math.random()}`
    await import(modUrl)

    const heading = mockPage.querySelector('[data-rewrite-field="sections.0.heading"]')
    expect(heading.querySelector('.inline-edit-badge')).toBeNull()
  })

  test('a paragraph is NOT decorated with the Edited badge, even when edited (it already carries the Unverified pill)', async () => {
    document.body.innerHTML =
      '<div id="mockPage"><p data-rewrite-field="sections.0.paragraphs.0">Edited text.</p></div>'
    const mockPage = document.getElementById('mockPage')

    window.HHVC_DATA = {
      pages: {
        testPage: { title: 'T', summary: 'S', sections: [{ paragraphs: ['Edited text.'] }] },
      },
      order: [['testPage', 'Test']],
    }
    window.ORIGINAL_DATA = {
      pages: { testPage: { title: 'T', summary: 'S', sections: [{ paragraphs: ['Original.'] }] } },
    }
    window.utils = { ...realUtils, getCurrentKey: () => 'testPage' }
    window.renderPage = () => {}
    window.ReviewUx = { stateSync: { saveCurrentPageToLocalStorage: () => {} } }
    window.showToast = () => {}

    const modUrl = `${MODULE_PATH}?t=${Date.now()}-${Math.random()}`
    await import(modUrl)

    const p = mockPage.querySelector('[data-rewrite-field="sections.0.paragraphs.0"]')
    expect(p.querySelector('.inline-edit-badge')).toBeNull()
  })
})

describe('inline content edit: decoration controls are excluded from PNG export', () => {
  test('add, remove, edited-badge, and reset controls all carry data-export-exclude', () => {
    // js/mockup-image-export.js's capture filter skips any node carrying
    // data-export-exclude — every persistent decoration control this module
    // renders must carry it, or it leaks into a reviewer's exported PNG
    // (which is meant to represent the page under review, not this tool's
    // own review-time chrome). The transient edit widget (scalarEditorHtml)
    // is deliberately NOT included here: excluding it would drop the field's
    // live text from an export taken mid-edit, not just strip chrome around it.
    const render = window.InlineEdit.render
    expect(render.listAddControlHtml('sections.0.bullets')).toContain('data-export-exclude')
    expect(render.listRemoveControlHtml('sections.0.bullets', 0)).toContain('data-export-exclude')
    expect(render.editedBadgeHtml()).toContain('data-export-exclude')
    expect(render.resetControlHtml('title')).toContain('data-export-exclude')
  })
})
