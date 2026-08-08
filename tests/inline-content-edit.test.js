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
