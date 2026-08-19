// Unit tests for js/editing/inline-content-edit.js — the click-to-edit orchestrator
// for SCALAR fields (title, summary, primaryCta, section heading, a single
// paragraph, a single bullet), plus Task 7's add/remove/undo/reset controls
// and the post-render decoration entry points.
//
// Unlike tests/inline-content-edit-refresh.test.js's module under test, this
// one needs real DOM behavior — real click/keydown/focusout events bubbling
// up to a delegated #mockPage listener, real Element.replaceWith(), a real
// @editorjs/editorjs instance mounted into a contenteditable div — so this
// file uses the real happy-dom `window`/`document` that
// tests/helpers/browser-env.js already registers globally, rather than
// replacing global.window wholesale the way the refresh test does for its
// DOM-free module. It only ATTACHES the mock dependencies (window.HHVC_DATA,
// window.ReviewUx.stateSync, etc.) onto that real window.
//
// This file used to drive a plain <input>/<textarea> widget synchronously
// (widget.value = x; keydown(widget, 'Enter')). Phase 6 of the Editor.js
// integration removed that widget entirely — openEditorJsEditor() is now the
// only path — which makes every open/commit/cancel here asynchronous: a
// click sets editingPath and inserts the (still-empty) holder <div>
// synchronously, but @editorjs/editorjs itself is dynamically imported and
// only fills the contenteditable in once editor.isReady resolves, and commit
// only runs once editor.save() resolves. A throwaway probe confirmed
// happy-dom CAN host a real Editor.js instance (mount, render prefilled
// text, save) before this rewrite was attempted — see
// waitForEditorBlock()/commitOpenField()/cancelOpenField() below, which poll
// rather than assume synchronous completion. There is also no Enter-to-
// commit path anymore for any field, single-line or not — Editor.js traps
// Enter inside its own single-block guard — so every commit test uses a
// focusout, matching openEditorJsEditor's holder-level 'focusout' listener
// (js/editing/inline-content-edit.js) rather than a 'blur' dispatched directly on a
// widget the way the old tests did.
//
// js/editing/inline-content-edit.js is a self-mounting IIFE (no module.exports), so
// each test imports it via a cache-busting dynamic import() to get a fresh
// closure (editingPath state must not leak between tests) — same pattern
// tests/inline-content-edit-refresh.test.js uses for its own IIFE-shaped
// module under test.
const { describe, test, expect, beforeEach, afterEach } = require('bun:test')
const path = require('path')
const realUtils = require('../js/utils.js')
const realInlineEditData = require('../js/editing/inline-content-edit-data.js')
require('../js/mockup/inline-link-target.js') // side-effect: populates window.inlineLinkTarget,
// which commit() and the link tool both consult before accepting a link target.
require('../js/editing/inline-content-edit-render.js') // side-effect: populates window.InlineEdit.render
require('../js/editing/inline-content-edit-link-tool.js') // side-effect: populates window.InlineEdit.LinkTool
require('../js/editing/inline-content-edit-adapter.js') // side-effect: populates window.inlineEditAdapter
// Imported once at file scope, not inside a test: js/review/ui-controls.js statically
// imports js/state.js, which side-effect-loads the REAL js/page-data.js (all
// 19 pages/*.js) and overwrites window.HHVC_DATA/window.ORIGINAL_DATA with the
// real dataset the moment it first runs. Importing it here, before any test's
// beforeEach/mountInlineContentEdit stub assigns the test-scoped
// window.HHVC_DATA, means that one-time real-data clobber happens up front and
// every test's own stub assignment (which always runs after this point) wins.
// Requiring it again inside a test returns the cached module with no further
// side effect, so this also documents why later `require('../js/review/ui-controls.js')`
// calls in the tests below are safe.
const { showToast: realShowToast } = require('../js/review/ui-controls.js')

const MODULE_PATH = path.resolve(__dirname, '../js/editing/inline-content-edit.js')

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
 * Mount a fresh instance of js/editing/inline-content-edit.js against the real
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
  // The real classifier, not a stub: it is what decides whether a committed
  // edit is written as tagged body copy or as a bare string, so stubbing it
  // would make every write-shape assertion below test the stub.
  window.inlineEditData = realInlineEditData
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

/** Poll for the open field's contenteditable block. Measured, not assumed:
    the block and its pre-filled text are already in the DOM well before
    openEditorJsEditor's `await editor.isReady` resolves — existence alone is
    therefore not proof the field is ready to receive input; see
    setEditorBlockText's comment for what that gap actually breaks. */
async function waitForEditorBlock(mockPage, { timeout = 1000, interval = 5 } = {}) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const block = mockPage.querySelector('.inline-edit-editorjs-holder [contenteditable="true"]')
    if (block) return block
    await new Promise((resolve) => setTimeout(resolve, interval))
  }
  throw new Error('Editor.js block never appeared')
}

/** Replace the open field's entire text (mirrors the old widget's
    `widget.value = x` — a contenteditable has no .value to set) and give
    openEditorJsEditor's post-`editor.isReady` continuation — which attaches
    the holder's 'focusout' commit listener used by
    commitOpenField()/cancelOpenField() below — time to actually finish. This
    settle delay is an empirical buffer, not a proven ordering guarantee: a
    helper that dispatched the instant the block appeared reliably dispatched
    before that listener was attached, and commit() then silently never ran —
    no write, no error, no signal anything was wrong — for every field except
    whichever one happened to win the race in a given run. `activeElement`
    was tried as a more precise readiness signal first and rejected:
    happy-dom never reflects Editor.js's own `.focus()` call on the
    contenteditable, so that check simply timed out every time. No
    deterministic readiness signal was found, so this remains a sleep tuned
    against this machine's timing rather than a hard guarantee — the e2e
    equivalent in tests/e2e/inline-content-edit.spec.js uses Playwright's
    auto-retrying assertions instead and doesn't have this limitation. */
async function setEditorBlockText(mockPage, text, { settle = 100 } = {}) {
  const block = await waitForEditorBlock(mockPage)
  await new Promise((resolve) => setTimeout(resolve, settle))
  block.textContent = text
  return block
}

/** Commit the open field via focusout — openEditorJsEditor's holder-level
    'focusout' listener is what calls commit(), same as a reviewer blurring
    away in a real browser. No relatedTarget means "focus left the editor
    entirely", which is what a genuine commit needs (js/editing/inline-content-edit.js's
    holder.contains(nextFocus) guard). Waits for the same
    post-isReady settle setEditorBlockText does (see its comment) before
    dispatching — this is also the only wait point for tests that open a
    field and commit it WITHOUT calling setEditorBlockText in between (e.g.
    the unchanged-value case) — then waits again for commit()'s own async
    work (editor.save() -> the adapter -> persist()/rerender()) to finish. */
async function commitOpenField(mockPage, { settle = 100, wait = 100 } = {}) {
  const block = await waitForEditorBlock(mockPage)
  await new Promise((resolve) => setTimeout(resolve, settle))
  block.dispatchEvent(new window.Event('focusout', { bubbles: true }))
  await new Promise((resolve) => setTimeout(resolve, wait))
}

/** Cancel the open field via Escape — synchronous in openEditorJsEditor
    (editor.destroy() has no async step) once the keydown listener is
    actually attached, which needs the same post-isReady settle as
    commitOpenField above. */
async function cancelOpenField(mockPage, { settle = 100, wait = 10 } = {}) {
  const block = await waitForEditorBlock(mockPage)
  await new Promise((resolve) => setTimeout(resolve, settle))
  block.dispatchEvent(
    new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
  )
  await new Promise((resolve) => setTimeout(resolve, wait))
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

  test('clicking a title field opens the Editor.js widget, pre-filled, synchronously marking isEditing', async () => {
    const { mockPage, inlineEdit } = await mountInlineContentEdit()
    mockPage.innerHTML = '<h1 data-rewrite-field="title">Original Title</h1>'
    const h1 = mockPage.querySelector('[data-rewrite-field="title"]')

    click(h1)

    // openEditorJsEditor sets editingPath and inserts the (still-empty)
    // holder synchronously, before the dynamic import of @editorjs/editorjs
    // resolves — both are true immediately, with no wait needed.
    const holder = mockPage.querySelector('[data-inline-edit-input]')
    expect(holder).not.toBeNull()
    expect(inlineEdit.isEditing()).toBe(true)

    const block = await waitForEditorBlock(mockPage)
    expect(block.textContent).toBe('Original Title')
  })

  test('clicking a summary field opens it pre-filled with the summary text', async () => {
    const { mockPage } = await mountInlineContentEdit()
    mockPage.innerHTML = '<p data-rewrite-field="summary">Original summary text.</p>'
    const p = mockPage.querySelector('[data-rewrite-field="summary"]')

    click(p)

    const block = await waitForEditorBlock(mockPage)
    expect(block.textContent).toBe('Original summary text.')
  })

  test('clicking a section heading opens it pre-filled with the heading text', async () => {
    const { mockPage } = await mountInlineContentEdit()
    mockPage.innerHTML = '<h2 data-rewrite-field="sections.0.heading">Original Heading</h2>'
    const h2 = mockPage.querySelector('[data-rewrite-field="sections.0.heading"]')

    click(h2)

    const block = await waitForEditorBlock(mockPage)
    expect(block.textContent).toBe('Original Heading')
  })

  test('clicking a paragraph opens it pre-filled with the paragraph text', async () => {
    const { mockPage } = await mountInlineContentEdit()
    mockPage.innerHTML =
      '<p data-rewrite-field="sections.0.paragraphs.0">Original paragraph text.</p>'
    const p = mockPage.querySelector('[data-rewrite-field="sections.0.paragraphs.0"]')

    click(p)

    const block = await waitForEditorBlock(mockPage)
    expect(block.textContent).toBe('Original paragraph text.')
  })

  test('clicking a bullet opens it pre-filled with the bullet text', async () => {
    const { mockPage } = await mountInlineContentEdit()
    mockPage.innerHTML = '<li data-rewrite-field="sections.0.bullets.0">Original bullet text.</li>'
    const li = mockPage.querySelector('[data-rewrite-field="sections.0.bullets.0"]')

    click(li)

    const block = await waitForEditorBlock(mockPage)
    expect(block.textContent).toBe('Original bullet text.')
  })

  test('clicking a primaryCta field opens it pre-filled with the CTA label', async () => {
    const { mockPage } = await mountInlineContentEdit()
    mockPage.innerHTML = '<a data-rewrite-field="primaryCta">Original CTA</a>'
    const a = mockPage.querySelector('[data-rewrite-field="primaryCta"]')

    click(a)

    const block = await waitForEditorBlock(mockPage)
    expect(block.textContent).toBe('Original CTA')
  })

  test('clicking a hero CTA rendered as an external <a href> opens the editor and prevents navigation', async () => {
    // Matches what js/mockup/page-render.js actually produces: data-rewrite-field
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

    const holder = mockPage.querySelector('[data-inline-edit-input]')
    expect(holder).not.toBeNull()
    expect(event.defaultPrevented).toBe(true)
    const block = await waitForEditorBlock(mockPage)
    expect(block.textContent).toBe('Original CTA')
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

    const holder = mockPage.querySelector('[data-inline-edit-input]')
    expect(holder).not.toBeNull()
    const block = await waitForEditorBlock(mockPage)
    expect(block.textContent).toBe('Original CTA')
    // Deliberately NOT asserting event.defaultPrevented here. This module's
    // own guard is `if (navigatingAnchor) event.preventDefault()`, scoped to
    // an `a[href]` ancestor — a no-op for this button, which has none — so it
    // never calls preventDefault() itself either way. But defaultPrevented is
    // a property of the shared event object, not of this module: in the real
    // app, js/mockup/page-render.js's own document-level click listener ALSO
    // matches `button[data-render-target]` and unconditionally calls
    // preventDefault() on it, for entirely unrelated SPA-navigation reasons.
    // Whether that listener happens to be registered in this Bun process
    // depends on which other test files ran first and imported it — CI
    // caught this failing intermittently for exactly that reason. What this
    // regression guard actually verifies is that the editor still opens for
    // a button-rendered CTA, asserted above.
  })

  test('clicking an inline reference link inside a paragraph opens that paragraph editor and prevents navigation', async () => {
    // The hero CTA isn't the only place a navigating anchor sits inside a
    // [data-rewrite-field] element. formatMarkdown() (js/mockup/page-render.js)
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

    const holder = mockPage.querySelector('[data-inline-edit-input]')
    expect(holder).not.toBeNull()
    expect(event.defaultPrevented).toBe(true)
    const block = await waitForEditorBlock(mockPage)
    expect(block.textContent).toBe('Original paragraph text.')
  })

  test('committing a title edit writes page.title, persists, and re-renders', async () => {
    const { mockPage, page, renderPageCalls, getPersistCalls } = await mountInlineContentEdit()
    mockPage.innerHTML = '<h1 data-rewrite-field="title">Original Title</h1>'
    click(mockPage.querySelector('[data-rewrite-field="title"]'))
    await setEditorBlockText(mockPage, 'New Title')

    await commitOpenField(mockPage)

    expect(page.title).toBe('New Title')
    expect(getPersistCalls()).toBe(1)
    expect(renderPageCalls).toEqual([{ key: 'testPage', skipHistory: true }])
  })

  test('committing a summary edit writes page.summary, persists, and re-renders', async () => {
    const { mockPage, page, renderPageCalls, getPersistCalls } = await mountInlineContentEdit()
    mockPage.innerHTML = '<p data-rewrite-field="summary">Original summary text.</p>'
    click(mockPage.querySelector('[data-rewrite-field="summary"]'))
    await setEditorBlockText(mockPage, 'New summary text.')

    await commitOpenField(mockPage)

    expect(page.summary).toBe('New summary text.')
    expect(getPersistCalls()).toBe(1)
    expect(renderPageCalls).toEqual([{ key: 'testPage', skipHistory: true }])
  })

  test('committing a primaryCta edit writes the CTA label via setPrimaryCta', async () => {
    const { mockPage, page } = await mountInlineContentEdit()
    mockPage.innerHTML = '<a data-rewrite-field="primaryCta">Original CTA</a>'
    click(mockPage.querySelector('[data-rewrite-field="primaryCta"]'))
    await setEditorBlockText(mockPage, 'New CTA')

    await commitOpenField(mockPage)

    expect(realUtils.getPrimaryCta(page)).toBe('New CTA')
  })

  test('committing a heading edit writes it via setByPath', async () => {
    const { mockPage, page } = await mountInlineContentEdit()
    mockPage.innerHTML = '<h2 data-rewrite-field="sections.0.heading">Original Heading</h2>'
    click(mockPage.querySelector('[data-rewrite-field="sections.0.heading"]'))
    await setEditorBlockText(mockPage, 'New Heading')

    await commitOpenField(mockPage)

    expect(page.sections[0].heading).toBe('New Heading')
  })

  // Found live, not by reading the code: a whatToKnow entry is {label, text},
  // and the item write used to replace the stored item wholesale with the
  // adapter's {text, unverified, unverifiedReason} object — deleting the label
  // that renderWhatToKnow() prints as that entry's own H3 heading. The heading
  // simply vanished from the mockup the moment a reviewer edited the paragraph
  // underneath it, with nothing erroring.
  // The Edited badge (and the Reset control that rides with it) used to be
  // limited to headings and the three page-level scalars, so every other
  // plain-string field — a step title, a callout, a table cell, a contact
  // entry — was edited with nothing on the mockup to say so and no way back
  // to the original. Paragraphs and bullets are unaffected: they carry the
  // Unverified pill instead.
  test('an edited step title gets the Edited badge and a reset control', async () => {
    const { mockPage, page } = await mountInlineContentEdit({
      page: {
        title: 'T',
        summary: 'S',
        sections: [{ heading: 'H', steps: [{ title: 'Step one', text: ['do this'] }] }],
      },
    })
    window.ORIGINAL_DATA = {
      pages: {
        testPage: {
          title: 'T',
          summary: 'S',
          sections: [{ heading: 'H', steps: [{ title: 'Step one', text: ['do this'] }] }],
        },
      },
    }
    page.sections[0].steps[0].title = 'Step one, edited'
    mockPage.innerHTML = '<h3 data-rewrite-field="sections.0.steps.0.title">Step one, edited</h3>'

    window.inlineEdit.decorateEditedFields()

    const field = mockPage.querySelector('[data-rewrite-field="sections.0.steps.0.title"]')
    expect(field.querySelector('.inline-edit-badge')).not.toBeNull()
    expect(field.querySelector('[data-inline-edit-reset]')).not.toBeNull()
  })

  test('a taggedText item is never badge-decorated, edited or not', async () => {
    // whatToKnow.thingsToKnow is a textArray, so its items classify as
    // taggedText and decorateEditedFields returns at the
    // `itemKindFor(path) !== 'plainString'` guard before comparing anything.
    // That is the intended split, not an oversight: an edited paragraph-shaped
    // item already announces itself with the Unverified pill, and adding the
    // badge as well would mark the same edit twice. Pinned with a value that
    // HAS changed, so it fails if the guard is dropped rather than passing on
    // the comparison happening to match.
    const { mockPage } = await mountInlineContentEdit({
      page: {
        title: 'T',
        summary: 'S',
        whatToKnow: { thingsToKnow: [{ label: 'Reporting anonymously', text: 'Edited text.' }] },
        sections: [],
      },
    })
    window.ORIGINAL_DATA = {
      pages: {
        testPage: {
          title: 'T',
          summary: 'S',
          whatToKnow: {
            thingsToKnow: [{ label: 'Reporting anonymously', text: 'Original text.' }],
          },
          sections: [],
        },
      },
    }
    mockPage.innerHTML = '<p data-rewrite-field="whatToKnow.thingsToKnow.0">Edited text.</p>'

    window.inlineEdit.decorateEditedFields()

    expect(mockPage.querySelector('.inline-edit-badge')).toBeNull()
  })

  test('an unedited plainString item stored as the tagged object form gets no badge', async () => {
    // contact.phone is a stringArray, so its items classify as plainString and
    // the comparison above actually runs — both sides through readScalarValue,
    // which unwraps {label, text} to its text. Comparing a raw object against
    // the rendered string would never match, so an untouched entry would claim
    // to have been edited. Defensive rather than a shape writeScalarValue can
    // produce (it writes a bare string for this kind), but an imported or
    // merged record is not bound by that, and the unwrap is one line away from
    // being deleted as dead code if nothing reaches it.
    const item = { label: 'Main line', text: '311 (call or text)' }
    const { mockPage } = await mountInlineContentEdit({
      page: { title: 'T', summary: 'S', contact: { phone: [item] }, sections: [] },
    })
    window.ORIGINAL_DATA = {
      pages: {
        testPage: { title: 'T', summary: 'S', contact: { phone: [{ ...item }] }, sections: [] },
      },
    }
    mockPage.innerHTML = '<p data-rewrite-field="contact.phone.0">311 (call or text)</p>'

    window.inlineEdit.decorateEditedFields()

    expect(mockPage.querySelector('.inline-edit-badge')).toBeNull()
  })

  test('an edited plainString item stored as the tagged object form does get a badge', async () => {
    // The other direction of the same comparison. Without it, a readScalarValue
    // that returned a constant would satisfy the test above while decorating
    // nothing at all.
    const { mockPage } = await mountInlineContentEdit({
      page: {
        title: 'T',
        summary: 'S',
        contact: { phone: [{ label: 'Main line', text: '555-0100' }] },
        sections: [],
      },
    })
    window.ORIGINAL_DATA = {
      pages: {
        testPage: {
          title: 'T',
          summary: 'S',
          contact: { phone: [{ label: 'Main line', text: '311 (call or text)' }] },
          sections: [],
        },
      },
    }
    mockPage.innerHTML = '<p data-rewrite-field="contact.phone.0">555-0100</p>'

    window.inlineEdit.decorateEditedFields()

    const field = mockPage.querySelector('[data-rewrite-field="contact.phone.0"]')
    expect(field.querySelector('.inline-edit-badge')).not.toBeNull()
    expect(field.querySelector('[data-inline-edit-reset]')).not.toBeNull()
  })

  test('committing a labeled whatToKnow item keeps its label', async () => {
    const { mockPage, page } = await mountInlineContentEdit({
      page: {
        title: 'T',
        summary: 'S',
        whatToKnow: {
          thingsToKnow: [{ label: 'Reporting anonymously', text: 'Original entry text.' }],
        },
        sections: [],
      },
    })
    mockPage.innerHTML =
      '<p data-rewrite-field="whatToKnow.thingsToKnow.0">Original entry text.</p>'
    click(mockPage.querySelector('[data-rewrite-field="whatToKnow.thingsToKnow.0"]'))
    await setEditorBlockText(mockPage, 'Edited entry text.')

    await commitOpenField(mockPage)

    expect(page.whatToKnow.thingsToKnow[0]).toEqual({
      label: 'Reporting anonymously',
      text: 'Edited entry text.',
      unverified: true,
      unverifiedReason: 'Manually edited during review',
    })
  })

  // The other half of the same rule: a field whose renderer escapes and prints
  // the value directly must stay a bare string. The tagged object renders as
  // the literal "[object Object]" there, which is what made these separate
  // kinds rather than one loosened check.
  test('committing a table cell writes a plain string, not the tagged object', async () => {
    const { mockPage, page } = await mountInlineContentEdit({
      page: {
        title: 'T',
        summary: 'S',
        sections: [
          {
            heading: 'H',
            table: [
              ['Head A', 'Head B'],
              ['cell 1', 'cell 2'],
            ],
          },
        ],
      },
    })
    mockPage.innerHTML = '<td><span data-rewrite-field="sections.0.table.1.0">cell 1</span></td>'
    click(mockPage.querySelector('[data-rewrite-field="sections.0.table.1.0"]'))
    await setEditorBlockText(mockPage, 'edited cell')

    await commitOpenField(mockPage)

    expect(page.sections[0].table[1]).toEqual(['edited cell', 'cell 2'])
  })

  test('committing a contact phone entry writes a plain string', async () => {
    const { mockPage, page } = await mountInlineContentEdit({
      page: { title: 'T', summary: 'S', contact: { phone: ['311'] }, sections: [] },
    })
    mockPage.innerHTML = '<p data-rewrite-field="contact.phone.0">311</p>'
    click(mockPage.querySelector('[data-rewrite-field="contact.phone.0"]'))
    await setEditorBlockText(mockPage, '415-555-0100')

    await commitOpenField(mockPage)

    expect(page.contact.phone).toEqual(['415-555-0100'])
  })

  test('committing a step title writes a plain string', async () => {
    const { mockPage, page } = await mountInlineContentEdit({
      page: {
        title: 'T',
        summary: 'S',
        sections: [{ heading: 'H', steps: [{ title: 'Step one', text: ['do this'] }] }],
      },
    })
    mockPage.innerHTML = '<h3 data-rewrite-field="sections.0.steps.0.title">Step one</h3>'
    click(mockPage.querySelector('[data-rewrite-field="sections.0.steps.0.title"]'))
    await setEditorBlockText(mockPage, 'Step one, edited')

    await commitOpenField(mockPage)

    expect(page.sections[0].steps[0].title).toBe('Step one, edited')
  })

  test('committing a paragraph edit writes the tagged {text, unverified} object form', async () => {
    const { mockPage, page } = await mountInlineContentEdit()
    mockPage.innerHTML =
      '<p data-rewrite-field="sections.0.paragraphs.0">Original paragraph text.</p>'
    click(mockPage.querySelector('[data-rewrite-field="sections.0.paragraphs.0"]'))
    await setEditorBlockText(mockPage, 'New paragraph text.')

    await commitOpenField(mockPage)

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
    await setEditorBlockText(mockPage, 'New bullet text.')

    await commitOpenField(mockPage)

    expect(page.sections[0].bullets[0]).toEqual({
      text: 'New bullet text.',
      unverified: true,
      unverifiedReason: 'Manually edited during review',
    })
  })

  test('committing a paragraph with the value unchanged does not write or persist', async () => {
    // Regression coverage: a blur used to commit unconditionally, so an
    // untouched paragraph got tagged into the {text, unverified: true, ...}
    // object form and showed a false "Unverified" pill for copy the
    // reviewer never changed.
    const { mockPage, page, getPersistCalls, renderPageCalls } = await mountInlineContentEdit()
    mockPage.innerHTML =
      '<p data-rewrite-field="sections.0.paragraphs.0">Original paragraph text.</p>'
    click(mockPage.querySelector('[data-rewrite-field="sections.0.paragraphs.0"]'))
    await waitForEditorBlock(mockPage) // opened, but never edited

    await commitOpenField(mockPage)

    expect(page.sections[0].paragraphs[0]).toBe('Original paragraph text.')
    expect(getPersistCalls()).toBe(0)
    // Still re-renders to close the editor widget, same as a cancel.
    expect(renderPageCalls).toEqual([{ key: 'testPage', skipHistory: true }])
  })

  test('committing title/summary/primaryCta as blank is refused and the field keeps its value', async () => {
    // Regression coverage: writeScalarValue accepted an empty string for
    // these three fields, but updateMockupTextFromSavedState
    // (js/review/ux-improvements-state-sync.js) only reapplies a TRUTHY saved
    // value, so a cleared field looked saved for the session and then
    // silently reverted to the authored value on the next reload. This
    // guard is exercised end to end in tests/e2e/inline-content-edit.spec.js
    // too, but only against the real browser; this is the unit-level check
    // of openEditorJsEditor's own isPageLevelScalar branch. The console
    // warning this test (and the blank-paragraph test below) prints —
    // `Block «paragraph» skipped because saved data is invalid` — is
    // Editor.js's own validation reacting to the emptied block; it's
    // expected here, not a sign anything is wrong.
    const { mockPage, page, getPersistCalls } = await mountInlineContentEdit()
    mockPage.innerHTML = '<h1 data-rewrite-field="title">Original Title</h1>'
    click(mockPage.querySelector('[data-rewrite-field="title"]'))
    await setEditorBlockText(mockPage, '   ')

    await commitOpenField(mockPage)

    expect(page.title).toBe('Original Title')
    expect(getPersistCalls()).toBe(0)
  })

  test('committing a paragraph as blank IS allowed (only page-level scalars are guarded)', async () => {
    const { mockPage, page } = await mountInlineContentEdit()
    mockPage.innerHTML =
      '<p data-rewrite-field="sections.0.paragraphs.0">Original paragraph text.</p>'
    click(mockPage.querySelector('[data-rewrite-field="sections.0.paragraphs.0"]'))
    await setEditorBlockText(mockPage, '')

    await commitOpenField(mockPage)

    expect(page.sections[0].paragraphs[0]).toEqual({
      text: '',
      unverified: true,
      unverifiedReason: 'Manually edited during review',
    })
  })

  test('Escape cancels the edit: no write, no persist, but does re-render to restore the view', async () => {
    const { mockPage, page, renderPageCalls, getPersistCalls } = await mountInlineContentEdit()
    mockPage.innerHTML = '<p data-rewrite-field="summary">Original summary text.</p>'
    click(mockPage.querySelector('[data-rewrite-field="summary"]'))
    await setEditorBlockText(mockPage, 'Should not be saved.')

    await cancelOpenField(mockPage)

    expect(page.summary).toBe('Original summary text.')
    expect(getPersistCalls()).toBe(0)
    expect(renderPageCalls).toEqual([{ key: 'testPage', skipHistory: true }])
  })

  test('Escape on a title field also cancels without writing', async () => {
    const { mockPage, page, getPersistCalls } = await mountInlineContentEdit()
    mockPage.innerHTML = '<h1 data-rewrite-field="title">Original Title</h1>'
    click(mockPage.querySelector('[data-rewrite-field="title"]'))
    await setEditorBlockText(mockPage, 'Should not be saved.')

    await cancelOpenField(mockPage)

    expect(page.title).toBe('Original Title')
    expect(getPersistCalls()).toBe(0)
  })

  test('isEditing returns to false after commit', async () => {
    const { mockPage, inlineEdit } = await mountInlineContentEdit()
    mockPage.innerHTML = '<h1 data-rewrite-field="title">Original Title</h1>'
    click(mockPage.querySelector('[data-rewrite-field="title"]'))
    expect(inlineEdit.isEditing()).toBe(true)
    await waitForEditorBlock(mockPage)

    await commitOpenField(mockPage)

    expect(inlineEdit.isEditing()).toBe(false)
  })

  test('isEditing returns to false after cancel', async () => {
    const { mockPage, inlineEdit } = await mountInlineContentEdit()
    mockPage.innerHTML = '<h1 data-rewrite-field="title">Original Title</h1>'
    click(mockPage.querySelector('[data-rewrite-field="title"]'))
    await waitForEditorBlock(mockPage)

    await cancelOpenField(mockPage)

    expect(inlineEdit.isEditing()).toBe(false)
  })

  test('a second focusout on the same field commits only once (no double-save)', async () => {
    // The old widget's version of this guard was "Enter then blur don't
    // double-fire" — there's no Enter-commit anymore, so the equivalent
    // race here is two focusout events reaching the same field (e.g. a
    // stray event after the holder's own listener already ran once).
    // openEditorJsEditor's `settled` flag inside commit() is what this
    // proves: it's checked and set before any async work starts, so a
    // second call is a no-op even though editor.save() from the first call
    // may still be in flight.
    const { mockPage, page, renderPageCalls, getPersistCalls } = await mountInlineContentEdit()
    mockPage.innerHTML = '<h1 data-rewrite-field="title">Original Title</h1>'
    click(mockPage.querySelector('[data-rewrite-field="title"]'))
    const block = await setEditorBlockText(mockPage, 'New Title')

    block.dispatchEvent(new window.Event('focusout', { bubbles: true }))
    block.dispatchEvent(new window.Event('focusout', { bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 30))

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

    // editingPath is set synchronously by the FIRST click, before Editor.js's
    // own async mount even starts — so the second click's `if (editingPath)
    // return` guard fires immediately too, with no wait needed.
    const holders = mockPage.querySelectorAll('[data-inline-edit-input]')
    expect(holders.length).toBe(1)
  })

  test('ensureBound is idempotent: calling it twice does not double-bind the click listener', async () => {
    const { mockPage, inlineEdit, page, renderPageCalls } = await mountInlineContentEdit()
    inlineEdit.ensureBound()
    inlineEdit.ensureBound()

    mockPage.innerHTML = '<h1 data-rewrite-field="title">Original Title</h1>'
    click(mockPage.querySelector('[data-rewrite-field="title"]'))
    await setEditorBlockText(mockPage, 'New Title')

    await commitOpenField(mockPage)

    // A double-bound listener would run openEditorJsEditor/commit twice per
    // click, which would show up as two render calls for one commit.
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
    // clicked — getCurrentKey() is the seam js/review/ux-improvements.js's real
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
    // No <ul> at all: bulletList() in js/mockup/page-render.js renders '' for an
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
    // js/mockup/mockup-image-export.js's capture filter skips any node carrying
    // data-export-exclude — every persistent decoration control this module
    // renders must carry it, or it leaks into a reviewer's exported PNG
    // (which is meant to represent the page under review, not this tool's
    // own review-time chrome). The transient Editor.js holder (editorJsHolderHtml)
    // is deliberately NOT included here: excluding it would drop the field's
    // live text from an export taken mid-edit, not just strip chrome around it.
    const render = window.InlineEdit.render
    expect(render.listAddControlHtml('sections.0.bullets')).toContain('data-export-exclude')
    expect(render.listRemoveControlHtml('sections.0.bullets', 0)).toContain('data-export-exclude')
    expect(render.editedBadgeHtml()).toContain('data-export-exclude')
    expect(render.resetControlHtml('title')).toContain('data-export-exclude')
  })
})

describe('InlineEdit.LinkCommitBridge', () => {
  // window.InlineEdit.LinkCommitBridge is populated once, at file-load time,
  // by the top-of-file `require('../js/editing/inline-content-edit-link-tool.js')`
  // side effect — it is not per-test state and needs no cache-busting import
  // the way the orchestrator itself does.
  test('take() returns the HTML stash()ed for the same holder element', () => {
    const holder = document.createElement('div')
    window.InlineEdit.LinkCommitBridge.stash(holder, '<a data-render-target="foo">bar</a>')
    expect(window.InlineEdit.LinkCommitBridge.take(holder)).toBe(
      '<a data-render-target="foo">bar</a>'
    )
  })

  test('take() clears the stash, so a second call on the same element returns undefined', () => {
    const holder = document.createElement('div')
    window.InlineEdit.LinkCommitBridge.stash(holder, 'x')
    window.InlineEdit.LinkCommitBridge.take(holder)
    expect(window.InlineEdit.LinkCommitBridge.take(holder)).toBeUndefined()
  })

  test('take() on a holder nothing was stashed for returns undefined without throwing', () => {
    const holder = document.createElement('div')
    expect(() => window.InlineEdit.LinkCommitBridge.take(holder)).not.toThrow()
    expect(window.InlineEdit.LinkCommitBridge.take(holder)).toBeUndefined()
  })

  test('stash() on a null holder is a no-op, not a throw', () => {
    expect(() => window.InlineEdit.LinkCommitBridge.stash(null, 'x')).not.toThrow()
  })

  test('two different holders keep independent stashes', () => {
    const a = document.createElement('div')
    const b = document.createElement('div')
    window.InlineEdit.LinkCommitBridge.stash(a, 'A')
    window.InlineEdit.LinkCommitBridge.stash(b, 'B')
    expect(window.InlineEdit.LinkCommitBridge.take(a)).toBe('A')
    expect(window.InlineEdit.LinkCommitBridge.take(b)).toBe('B')
  })
})
