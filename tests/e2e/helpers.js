// Shared helpers for the Playwright e2e suite. Plain functions (no fixture
// framework) to match this repo's no-framework ethos.
const { expect } = require('@playwright/test')
const STORAGE_KEY = 'hhvcManagerReviewState:v1'

const DECISIONS = {
  needsReview: 'Needs review',
  approved: 'Approved',
  approvedWithEdits: 'Approved with edits',
  revise: 'Revise and resubmit',
  blocked: 'Blocked',
}

// Load the app with no saved reviewer state. Each Playwright test gets a
// fresh browser context, so storage is already empty on first navigation —
// deliberately no clear+reload here: the app flushes current field values to
// localStorage on pagehide, so a clear-then-reload would boot the app with a
// freshly recreated (non-virgin) state blob.
async function gotoFresh(page, path = '/') {
  await page.goto(path)
  await page.waitForSelector('#mockPage h1')
  // The sticky review bar mounts a beat after the first render; most flows
  // (workspace toggling, w shortcut) need it, so wait for full app init.
  await page.waitForSelector('[data-sticky-action="toggle-workspace"]')
  // ...but the sticky bar is mounted by js/ux-improvements.js, which runs
  // EARLY in the DOMContentLoaded cascade. js/keyboard-shortcuts.js is the last
  // script in index.html and attaches its keydown listener in its own init, so
  // waiting for it is what actually makes "full app init" true. Without this a
  // test could press a global shortcut into a document with no handler yet.
  await waitForShortcuts(page)
}

// Wait until js/keyboard-shortcuts.js has actually attached its keydown
// listener. The sticky bar that gotoFresh waits for is mounted by
// js/ux-improvements.js, which initializes EARLIER in the DOMContentLoaded
// cascade, so it is a proxy for "the app booted", not for "a keypress will be
// handled". Any test that presses a global shortcut must await this first or
// it is racing the listener.
async function waitForShortcuts(page) {
  await page.waitForFunction(() => window.reviewKeyboardShortcuts?.ready === true)
}

// Record every toast that appears into window.__toasts. Toasts auto-dismiss
// after 4s, so under parallel-worker load a boot-time toast can be gone before
// page.goto() even resolves — call this BEFORE goto and assert on the record.
async function recordToasts(page) {
  await page.addInitScript(() => {
    window.__toasts = []
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1 && node.classList?.contains('toast')) {
            window.__toasts.push(node.textContent || '')
          }
        }
      }
      // Observe the Document node itself: at init-script time the eventual
      // <html> element doesn't exist yet (the parser replaces the initial one).
    }).observe(document, { childList: true, subtree: true })
  })
}

async function readRecordedToasts(page) {
  return page.evaluate(() => (window.__toasts || []).join('\n'))
}

async function clearState(page) {
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY)
}

async function readState(page) {
  return page.evaluate(() => window.reviewState.read())
}

// Seed saved review state directly. Callers usually reload() afterwards so the
// UI (queue rows, restored fields) reflects the seeded state.
async function seedState(page, pages, globals = {}) {
  await page.evaluate(
    ({ pages, globals }) => {
      window.reviewState.write({
        version: 1,
        updated_at: new Date().toISOString(),
        ui: {},
        globals,
        pages,
      })
    },
    { pages, globals }
  )
}

function makeReviewRecord(pageKey, overrides = {}) {
  return {
    page_key: pageKey,
    decision: DECISIONS.needsReview,
    notes: '',
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

async function openWorkspace(page) {
  const workspace = page.locator('#reviewWorkspace')
  if (!(await workspace.isVisible())) {
    await page.click('[data-sticky-action="toggle-workspace"]')
    await workspace.waitFor({ state: 'visible' })
  }
}

// Open a workspace tab by its data-workspace-tab value: overview | checks |
// help. The queue and the help panels mount lazily on first open. AI assist
// and the stored-data diagnostics are collapsed <details> INSIDE help now, not
// tabs of their own — openAdvancedSection() below reaches them.
async function openWorkspaceTab(page, tab) {
  await openWorkspace(page)
  await page.click(`.review-workspace-tab[data-workspace-tab="${tab}"]`)
  await page.locator(`.review-workspace-panel[data-workspace-panel="${tab}"]`).waitFor({
    state: 'visible',
  })
}

// Expand one of the collapsed sections at the end of the Help tab (AI assist,
// stored review data, mockup images). They render on Help opening but stay
// closed, so their contents are invisible to actionability checks until this
// runs.
async function openAdvancedSection(page, summaryText) {
  await openWorkspaceTab(page, 'help')
  const group = page.locator(`.review-advanced-group:has(> summary:text-is("${summaryText}"))`)
  if (!(await group.evaluate((el) => el.open))) {
    // `> summary` — the direct child. The AI assist panel renders its own
    // nested <details><summary>AI server settings</summary>, so a descendant
    // match resolves to two elements and trips Playwright's strict mode.
    await group.locator('> summary').click()
  }
  return group
}

// Set the sidebar decision the way a reviewer does: by clicking a chip.
//
// This used to be `page.selectOption('#reviewDecision', …)`. The <select> that
// sat above the chips was a second control writing the same field, so it is now
// an <input type="hidden"> holding the value while the chips carry the visible
// and accessible semantics — which means selectOption no longer applies, and
// clicking is what the reviewer actually does. Assertions can still read
// `#reviewDecision`'s value: a hidden input has one.
async function setDecision(page, decision) {
  // Non-default decisions are attributable review actions. Existing tests
  // using this convenience helper exercise successful persistence rather than
  // anonymous-decision rejection, so supply the same explicit reviewer a
  // person would enter before choosing a chip.
  const reviewer = page.locator('#reviewerInput')
  if (!(await reviewer.inputValue()).trim()) await reviewer.fill('E2E Reviewer')
  await page.click(`#decisionQuickActions [data-decision="${decision}"]`)
  await expect(page.locator('#reviewDecision')).toHaveValue(decision)
}

// The "Search metadata" sidebar group is a closed <details> by default, so
// its inputs are invisible to actionability checks until it's expanded.
async function openSearchMetadata(page) {
  const group = page.locator('details.control-group:has(#seoTitleInput)')
  if (!(await group.evaluate((el) => el.open))) {
    await group.locator('summary').click()
  }
  await page.locator('#seoTitleInput').waitFor({ state: 'visible' })
}

// Field persistence is debounced 300ms (js/ux-improvements.js); wait it out.
async function settleDebounce(page) {
  await page.waitForTimeout(400)
}

/**
 * Put keyboard focus somewhere the global shortcuts will actually fire.
 *
 * js/keyboard-shortcuts.js gates every shortcut on isShortcutContext(): the
 * focused element must sit inside #reviewWorkspace, .canvas-toolbar or
 * #mockPage. That is deliberate — it stops single-letter shortcuts firing
 * while a reviewer types in the sidebar — so a test that presses a key
 * without establishing focus first is testing a race, not the shortcut.
 *
 * The race is real and it is environment-dependent. After gotoFresh() the
 * only thing that happens to land focus inside the workspace is the
 * first-run onboarding, which opens the workspace and focuses the selected
 * tab asynchronously. On a fast machine the keypress arrives after that and
 * the test passes; on a slower CI runner it arrives first and the shortcut is
 * correctly ignored. Call this before any keyboard.press() to remove the
 * timing dependency entirely.
 * @param {import('@playwright/test').Page} page
 */
async function focusMockPage(page) {
  // .focus(), not .click(): the mockup's <h1> now carries
  // data-rewrite-field="title" (inline content editing), so a real click
  // opens that field's inline editor instead of merely moving keyboard
  // focus — swallowing every subsequent shortcut press, since the editor's
  // <input> matches js/keyboard-shortcuts.js's isTypingContext() guard.
  // .focus() sets DOM focus directly with no click event, so it still lands
  // focus inside #mockPage (satisfying isShortcutContext()) without
  // triggering the click-to-edit handler at all.
  await page.locator('#mockPage h1').first().focus()
}

// Locate the live Editor.js contenteditable block for whichever field is
// currently open, and wait for it to actually hold focus. openEditorJsEditor
// (js/inline-content-edit.js) sets autofocus: true, but that only lands once
// editor.isReady resolves — a real async gap, since @editorjs/editorjs is
// dynamically imported on first use (js/inline-content-edit.js's
// loadEditorJs()) — so waiting on toBeFocused() rather than just visibility
// is what actually proves the editor mounted rather than racing it.
async function editorJsBlock(page) {
  const block = page.locator('.inline-edit-editorjs-holder [contenteditable="true"]')
  await expect(block).toBeFocused()
  return block
}

// Replace the open Editor.js field's entire text: select all, then type.
// Mirrors the old <input>/<textarea> widget's .fill() semantics — a
// contenteditable block has no single-call equivalent.
async function replaceEditorJsFieldText(page, block, text) {
  await block.press('ControlOrMeta+a')
  await block.pressSequentially(text)
}

// Commit the open Editor.js field the way a reviewer actually does: blur it.
// Every field in this widget commits on focusout (openEditorJsEditor's own
// `holder.addEventListener('focusout', commit)`) — unlike the old widget,
// there is no Enter-to-commit path even for single-line fields (title,
// heading, the CTA), since Enter inside Editor.js's contenteditable is
// trapped by the single-block guard (onChange) rather than left to bubble.
async function commitEditorJsField(page) {
  await page.locator('.inline-edit-editorjs-holder [contenteditable="true"]').blur()
}

// Select `word` inside the open Editor.js block and click the resulting
// Link inline-toolbar button (js/inline-content-edit-link-tool.js), all
// inside ONE page.evaluate() call. This has to happen in a single browser-
// side round trip, not as separate Playwright locator actions: Editor.js's
// inline toolbar visibility is driven by the native 'selectionchange'
// event, which fires asynchronously relative to the synthetic 'mouseup'
// this dispatches on the selected word — and the real wall-clock gap
// between two separate page.evaluate() calls (each its own CDP round trip)
// is enough time for that async handling to invalidate Editor.js's captured
// selection before a follow-up click ever reaches it. Measured live: doing
// the select-then-click as two separate Playwright actions reproducibly
// left document.activeElement on <body> post-click (no button, no input,
// nothing focused) even though the button was visibly present a moment
// before — moving the click inside the same synchronous call this function
// makes is what fixed it.
//
// expectActionsPanel: false is for the unwrap (remove-link) case: clicking
// the button on text already inside a link removes it directly and opens
// no target-entry input, so "no actions panel appeared" must not be treated
// as a retry signal there the way it is for the add-link path.
async function selectWordAndClickLinkButton(page, word, { expectActionsPanel = true } = {}) {
  return page.evaluate(
    async ({ word, expectActionsPanel }) => {
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
      const holder = document.querySelector('.inline-edit-editorjs-holder')
      const block = holder?.querySelector('[contenteditable="true"]')
      if (!block) return { ok: false, reason: 'no editable block' }
      const editor = holder.__inlineEditEditor

      const selectWord = () => {
        const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
        let node
        let target = null
        let offset = -1
        while ((node = walker.nextNode())) {
          const idx = node.textContent.indexOf(word)
          if (idx !== -1) {
            target = node
            offset = idx
            break
          }
        }
        if (!target) return false
        const range = document.createRange()
        range.setStart(target, offset)
        range.setEnd(target, offset + word.length)
        block.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
        const selection = window.getSelection()
        selection.removeAllRanges()
        selection.addRange(range)
        block.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
        document.dispatchEvent(new Event('selectionchange'))
        // Editor.js only populates the inline toolbar's tool buttons after
        // its own mousedown-driven BlockManager.currentBlock tracking has
        // run — a synthetic selection with no real user click leaves that
        // unset even after the events above, so the toolbar element exists
        // but renders zero buttons. editor.inlineToolbar.open() is Editor.js's
        // own public API for opening it directly against the current
        // selection, sidestepping that internal tracking entirely.
        editor?.inlineToolbar?.open()
        return true
      }

      for (let attempt = 0; attempt < 20; attempt++) {
        if (!selectWord()) return { ok: false, reason: `word "${word}" not found` }
        const linkButton = document.querySelector('.inline-edit-link-button')
        if (linkButton) {
          linkButton.click()
          if (!expectActionsPanel) return { ok: true }
          const input = document.querySelector('.inline-edit-link-input')
          const actions = input?.closest('.inline-edit-link-actions')
          if (input && actions && !actions.hidden && document.activeElement === input) {
            return { ok: true }
          }
        }
        await wait(150)
      }
      return { ok: false, reason: 'link button/input never settled after retries' }
    },
    { word, expectActionsPanel }
  )
}

// Select `word`, open the Link tool, type `target` into its input and press
// Enter — all inside one evaluate() call, for the same reason
// selectWordAndClickLinkButton's own header comment gives: splitting this
// across separate Playwright round trips (an earlier version of this helper
// returned a Locator for a later pressSequentially() call to type into) left
// a real, reproducible gap for the target-entry input to close in between —
// confirmed live, the input was open and focused at the end of one
// evaluate() call and gone by the time the next Playwright action reached
// it. Only valid when `word` is NOT already inside a link; see
// selectWordAndClickLinkButton directly (with expectActionsPanel: false)
// for the unwrap/remove-link case, which opens no input to type into.
async function addInlineLink(page, word, target) {
  return page.evaluate(
    async ({ word, target }) => {
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
      const holder = document.querySelector('.inline-edit-editorjs-holder')
      const block = holder?.querySelector('[contenteditable="true"]')
      if (!block) return { ok: false, reason: 'no editable block' }
      const editor = holder.__inlineEditEditor

      const selectWord = () => {
        const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
        let node
        let start = null
        let offset = -1
        while ((node = walker.nextNode())) {
          const idx = node.textContent.indexOf(word)
          if (idx !== -1) {
            start = node
            offset = idx
            break
          }
        }
        if (!start) return false
        const range = document.createRange()
        range.setStart(start, offset)
        range.setEnd(start, offset + word.length)
        block.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
        const selection = window.getSelection()
        selection.removeAllRanges()
        selection.addRange(range)
        block.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
        document.dispatchEvent(new Event('selectionchange'))
        editor?.inlineToolbar?.open()
        return true
      }

      for (let attempt = 0; attempt < 20; attempt++) {
        if (!selectWord()) return { ok: false, reason: `word "${word}" not found` }
        const linkButton = document.querySelector('.inline-edit-link-button')
        if (linkButton) {
          linkButton.click()
          const input = document.querySelector('.inline-edit-link-input')
          const actions = input?.closest('.inline-edit-link-actions')
          if (input && actions && !actions.hidden && document.activeElement === input) {
            input.value = target
            input.dispatchEvent(new Event('input', { bubbles: true }))
            input.dispatchEvent(
              new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
            )
            return { ok: true }
          }
        }
        await wait(150)
      }
      return { ok: false, reason: 'link button/input never settled after retries' }
    },
    { word, target }
  )
}

// Read the link tool's target-entry input after an attempted commit.
//
// addInlineLink() reports only that it managed to press Enter, which was
// enough while every target was accepted. Now that a target pointing nowhere
// is REFUSED (js/inline-content-edit-link-tool.js's commitLink()), a test has
// to distinguish "the link was inserted" from "the input is still open,
// holding what was typed, marked invalid" — which is the whole refusal
// contract in one object.
async function readLinkInputState(page) {
  return page.evaluate(() => {
    const input = document.querySelector('.inline-edit-link-input')
    if (!input) return { present: false }
    const actions = input.closest('.inline-edit-link-actions')
    return {
      present: true,
      open: !actions?.hidden,
      invalid: input.getAttribute('aria-invalid') === 'true',
      value: input.value,
      focused: document.activeElement === input,
      // The rule sentence is a STANDING description, so this id must resolve
      // whether or not the value is currently rejected.
      describedByText: document.getElementById(input.getAttribute('aria-describedby'))?.textContent,
    }
  })
}

// Paste an anchor into the open Editor.js block, bypassing the link tool
// entirely — which is what a reviewer copying linked text actually does.
//
// This dispatches a REAL ClipboardEvent carrying text/html, rather than
// appending the element directly, and the difference is not cosmetic: it was
// measured. An anchor appended programmatically is stripped by Editor.js's own
// blur cleanup before commit() ever reads the value (the same cleanup
// js/inline-content-edit-link-tool.js's LinkCommitBridge exists to work
// around), so it never reaches the adapter and never exercises the refusal. A
// pasted one goes through Editor.js's paste pipeline and its sanitizer — which
// this tool's sanitize() config permits data-render-target through — and
// survives to the commit. Confirmed live: after a real paste, editor.save()
// returns the anchor intact.
async function pasteAnchorIntoEditor(page, { label, target }) {
  return page.evaluate(
    async ({ label, target }) => {
      const holder = document.querySelector('.inline-edit-editorjs-holder')
      const block = holder?.querySelector('[contenteditable="true"]')
      if (!block) return { ok: false, reason: 'no editable block' }
      // Paste at the end of the existing text, the way a reviewer appending a
      // reference would.
      const selection = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(block)
      range.collapse(false)
      selection.removeAllRanges()
      selection.addRange(range)

      const data = new DataTransfer()
      data.setData('text/html', ` <a data-render-target="${target}">${label}</a>`)
      data.setData('text/plain', ` ${label}`)
      block.dispatchEvent(
        new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data })
      )
      // Editor.js handles paste asynchronously; without this the commit that
      // follows can read the block before the anchor has landed.
      await new Promise((resolve) => setTimeout(resolve, 400))
      return { ok: block.innerHTML.includes(target) }
    },
    { label, target }
  )
}

// The refusal notice appended inside the holder when a commit is rejected for
// carrying a link that points nowhere.
async function readBrokenLinkNotice(page) {
  return page.evaluate(() => {
    const holder = document.querySelector('.inline-edit-editorjs-holder')
    if (!holder) return { holderPresent: false }
    const notice = holder.querySelector('.inline-edit-broken-links')
    return {
      holderPresent: true,
      holderInvalid: holder.getAttribute('aria-invalid') === 'true',
      // The notice must be INSIDE the holder: the holder's focusout listener
      // returns early for focus moving to a descendant, which is what stops
      // pressing the button from re-entering commit() and re-refusing.
      noticeInsideHolder: !!notice,
      describedByResolves: holder.getAttribute('aria-describedby') === notice?.id,
      message: notice?.querySelector('[data-inline-edit-broken-links-message]')?.textContent || '',
      buttonLabel:
        notice?.querySelector('[data-inline-edit-remove-broken-links]')?.textContent || '',
    }
  })
}

// Type additional text into the currently-open Editor.js block right after
// addInlineLink() has committed a link, but BEFORE the field is blurred —
// the exact window in which js/inline-content-edit.js's commit() used to
// silently discard anything typed, since it always preferred the ONE-TIME
// HTML snapshot js/inline-content-edit-link-tool.js's commitLink() stashed
// at link-insertion time over the live editor state. Appends extraText as a
// plain text node at the end of the block and dispatches a real, bubbling
// 'input' event — the same event js/inline-content-edit.js's holder-level
// 'input' listener (added to fix that gap) re-syncs the stash on. Returns
// the stash's live value so a test can assert the fix actually ran, not
// just that the final commit happened to look right.
async function typeAfterLinkCommit(page, extraText) {
  return page.evaluate((extraText) => {
    const holder = document.querySelector('.inline-edit-editorjs-holder')
    const block = holder?.querySelector('[contenteditable="true"]')
    if (!block) return { ok: false, reason: 'no editable block' }
    block.appendChild(document.createTextNode(extraText))
    block.dispatchEvent(new Event('input', { bubbles: true }))
    return { ok: true, pendingStash: holder.dataset.hhvcPendingLinkHtml }
  }, extraText)
}

// Switch pages via the sidebar picker and wait for the render to land.
// renderPage() pushes ?page=<key> immediately but applies content inside a
// View Transition, so wait for #browserUrl to show the target page's slug —
// that's set by applyPageContent, i.e. only once the new page is in the DOM.
async function selectPage(page, key) {
  await page.selectOption('#pageSelect', key)
  await page.waitForFunction(
    (expected) =>
      document.getElementById('browserUrl')?.textContent ===
      'https://' + window.HHVC_PAGES[expected].slug,
    key
  )
  await page.waitForSelector('#mockPage h1')
}

module.exports = {
  waitForShortcuts,
  STORAGE_KEY,
  DECISIONS,
  gotoFresh,
  recordToasts,
  readRecordedToasts,
  clearState,
  readState,
  seedState,
  makeReviewRecord,
  openWorkspace,
  openWorkspaceTab,
  openAdvancedSection,
  setDecision,
  openSearchMetadata,
  settleDebounce,
  selectPage,
  focusMockPage,
  editorJsBlock,
  replaceEditorJsFieldText,
  commitEditorJsField,
  selectWordAndClickLinkButton,
  addInlineLink,
  readLinkInputState,
  pasteAnchorIntoEditor,
  readBrokenLinkNotice,
  typeAfterLinkCommit,
}
