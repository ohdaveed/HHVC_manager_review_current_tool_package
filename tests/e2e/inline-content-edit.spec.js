// Inline content editing: click-to-edit on the mockup, add/remove for
// paragraphs and bullets, one-step undo, per-field reset, internal/external
// links, and persistence across reload and the JSON backup export/import
// round trip. See js/editing/inline-content-edit.js, js/editing/inline-content-edit-render.js
// and js/editing/inline-content-edit-link-tool.js for the feature's implementation;
// existing unit tests (tests/inline-content-edit*, tests/inline-content-edit-
// adapter.test.js) already cover internals through happy-dom — this file
// drives the real browser UI instead, matching tests/e2e/import-export.spec.js's
// merge-not-wipe verification pattern for its last test.
//
// Driven against the @editorjs/editorjs widget path — the only path since
// Phase 6 cutover removed the rollout toggle (hhvcInlineEditWidget) and the
// older plain <input>/<textarea> widget this file used to drive with
// .fill(). This file's git history is the coverage record for that older
// path; the happy-dom unit tests in tests/inline-content-edit.test.js were
// rewritten to drive Editor.js directly rather than retired, once a probe
// confirmed happy-dom can host a real Editor.js instance.
//
// Selectors here favor the data-inline-edit-*/data-rewrite-field attributes
// over class names, mirroring the unit tests' own convention (see
// tests/inline-content-edit.test.js) since those attributes are the
// intentional hook points, not incidental styling classes.
//
// The three Link-tool cases below are re-proven via deliberate breakage:
// reverting js/editing/inline-content-edit.js's holder.contains(nextFocus) focusout
// check back to its earlier holder.closest('.codex-editor') form (which can
// never match — .codex-editor is a DESCENDANT of holder, never an ancestor,
// so that comparison was always false) makes exactly the internal-link and
// external-link cases hang waiting for an element that no longer exists,
// with cases 1-8 above still passing. That was a real, previously-uncovered
// Phase 4 bug, confirmed with real (non-synthetic) Playwright MCP clicks
// before being fixed here, not a test-harness artifact: clicking the Link
// tool's own button unconditionally committed the whole field before its
// target-entry input ever appeared, since ANY focus move onto a toolbar tool
// (the same would apply to Bold, never previously exercised by any test)
// tripped the broken containment check. See that file's own comment on the
// fix for the full explanation.
const fs = require('fs')
const { test, expect } = require('@playwright/test')
const {
  gotoFresh,
  selectPage,
  settleDebounce,
  editorJsBlock,
  replaceEditorJsFieldText,
  commitEditorJsField,
  selectWordAndClickLinkButton,
  addInlineLink,
  readLinkInputState,
  pasteAnchorIntoEditor,
  readBrokenLinkNotice,
  typeAfterLinkCommit,
} = require('./helpers.js')

// The default landing page (pestsTopic, the Agency page) has paragraph
// sections but no bullet sections (js/page-data.js / pages/agency-service-grouping.js).
// scopeInfo (pages/hhvc-inspection-scope.js) has several section-level bullet
// lists with 2+ items each, so the add/remove list tests navigate there
// explicitly rather than assuming the default page carries list controls.
// A Transaction page like payFee also has bullets, but they sit nested
// inside steps[].bullets (js/editing/inline-content-edit.js's decorateListControls()
// only decorates sections.N.bullets/paragraphs directly, not
// sections.N.steps.M.bullets) — verified live, this is out of the current
// feature's scope, not a bug, so the fixture page must be picked accordingly.
const BULLETED_PAGE_KEY = 'scopeInfo'

test.describe('inline content editing (Editor.js widget)', () => {
  test('editing the title updates the mockup immediately and shows the Edited badge', async ({
    page,
  }) => {
    await gotoFresh(page)
    const title = page.locator('#mockPage h1[data-rewrite-field="title"]')
    const originalText = (await title.textContent())?.trim()
    await title.click()

    const block = await editorJsBlock(page)
    await replaceEditorJsFieldText(page, block, 'A New Test Title')
    await commitEditorJsField(page)

    const updatedTitle = page.locator('#mockPage h1[data-rewrite-field="title"]')
    await expect(updatedTitle).toContainText('A New Test Title')
    await expect(updatedTitle.locator('.inline-edit-badge')).toContainText('Edited')
    expect((await updatedTitle.textContent())?.trim()).not.toContain(originalText)
  })

  test('escape cancels a title edit without saving', async ({ page }) => {
    await gotoFresh(page)
    const title = page.locator('#mockPage h1[data-rewrite-field="title"]')
    const originalText = (await title.textContent())?.trim()
    await title.click()

    const block = await editorJsBlock(page)
    await replaceEditorJsFieldText(page, block, 'Should Not Save')
    await block.press('Escape')

    const restoredTitle = page.locator('#mockPage h1[data-rewrite-field="title"]')
    await expect(restoredTitle).toHaveText(originalText)
  })

  test('committing a blank title is rejected and the original text survives', async ({ page }) => {
    // js/editing/inline-content-edit.js's commit() special-cases title/summary/
    // primaryCta: unlike a section paragraph or bullet (which CAN be
    // deleted to empty via the remove control), clearing one of these three
    // to blank text and committing is refused outright — the field would
    // otherwise render nothing on the mockup. This is the one branch in the
    // feature where the failure mode is silent data loss on reload, so it
    // gets its own e2e case rather than relying solely on the happy-dom unit
    // test (tests/inline-content-edit.test.js), whose equivalent assertion
    // depends on a fixed settle delay rather than a real readiness signal.
    //
    // Select-all-then-Backspace, not replaceEditorJsFieldText(..., '   ') —
    // real Chromium re-encodes consecutive spacebar presses inside a
    // contenteditable as non-breaking spaces to keep them visible, so a
    // three-space commit lands as the literal text "&nbsp; &nbsp;" rather
    // than the blank string this test needs to trigger the guard (confirmed
    // live: that variant produced a title of literal "&nbsp; &nbsp;" instead
    // of being refused). Backspace-to-empty has no such encoding step.
    await gotoFresh(page)
    const title = page.locator('#mockPage h1[data-rewrite-field="title"]')
    const originalText = (await title.textContent())?.trim()
    await title.click()

    const block = await editorJsBlock(page)
    await block.press('ControlOrMeta+a')
    await block.press('Backspace')
    await commitEditorJsField(page)

    const restoredTitle = page.locator('#mockPage h1[data-rewrite-field="title"]')
    await expect(restoredTitle).toHaveText(originalText)
    await expect(restoredTitle.locator('.inline-edit-badge')).toHaveCount(0)
    await expect(restoredTitle.locator('.inline-edit-badge')).toHaveCount(0)
  })

  test('editing a paragraph shows the Unverified pill, not the Edited badge', async ({ page }) => {
    await gotoFresh(page)
    const paragraph = page
      .locator('#mockPage p[data-rewrite-field^="sections."][data-rewrite-field$=".paragraphs.0"]')
      .first()
    await expect(paragraph).toBeVisible()
    await paragraph.click()

    const block = await editorJsBlock(page)
    await replaceEditorJsFieldText(page, block, 'An edited paragraph.')
    await commitEditorJsField(page)

    const updated = page.locator('#mockPage p', { hasText: 'An edited paragraph.' })
    await expect(updated).toBeVisible()
    await expect(updated.locator('.unverified-pill')).toBeVisible()
    await expect(updated.locator('.inline-edit-badge')).toHaveCount(0)
  })

  test('adding a bullet opens it in edit mode and increases the item count', async ({ page }) => {
    await gotoFresh(page)
    await selectPage(page, BULLETED_PAGE_KEY)

    // Target a bullets-container add control specifically — the fixture
    // page's first section also has a paragraphs list with its own add
    // control, so an un-scoped .first() can resolve to the wrong container.
    const addButton = page
      .locator('#mockPage [data-inline-edit-add^="sections."][data-inline-edit-add$=".bullets"]')
      .first()
    await expect(addButton).toBeVisible()
    const containerPath = await addButton.getAttribute('data-inline-edit-add')

    const before = await page.locator(`#mockPage [data-rewrite-field^="${containerPath}."]`).count()
    await addButton.click()

    // addListItem() (js/editing/inline-content-edit.js) opens the new item's editor
    // once its own rerender() resolves — a real, possibly-async View
    // Transition in a real browser (see that function's comments) — so wait
    // for the widget to exist rather than asserting focus at a fixed instant.
    // js/editing/inline-content-edit-render.js's editorJsHolderHtml() carries the
    // same data-rewrite-field/data-inline-edit-input attributes the old
    // <textarea> widget did, so this selector still resolves the live
    // editor for the new item unchanged — only what's INSIDE it (a
    // contenteditable div, not a <textarea>) is new.
    const activeHolder = page.locator(
      `#mockPage [data-rewrite-field="${containerPath}.${before}"][data-inline-edit-input]`
    )
    await activeHolder.waitFor({ state: 'visible' })
    const activeBlock = activeHolder.locator('[contenteditable="true"]')
    await expect(activeBlock).toBeFocused()
    // A brand-new item starts empty — no select-all needed before typing.
    await activeBlock.pressSequentially('A brand new item.')
    // Assert the text landed BEFORE committing, and assert it on the live
    // editor rather than on the mockup. This does not make the test pass more
    // often — it makes its failures legible. The underlying flake is that the
    // editor is destroyed mid-typing under parallel-worker load, and without
    // this line that surfaced two assertions later as a missing element in the
    // rendered mockup, which reads as a render bug rather than as input that
    // never arrived. See the note above this test.
    await expect(activeBlock).toHaveText('A brand new item.')
    // Not activeBlock.blur() — see commitEditorJsField()'s own comment. Acting
    // through a locator handle here failed ~50% of the time under two workers.
    await commitEditorJsField(page)

    const after = await page.locator(`#mockPage [data-rewrite-field^="${containerPath}."]`).count()
    expect(after).toBe(before + 1)
    await expect(page.locator('#mockPage', { hasText: 'A brand new item.' })).toBeVisible()
  })

  test('removing a bullet shows an undo toast that restores it', async ({ page }) => {
    await gotoFresh(page)
    await selectPage(page, BULLETED_PAGE_KEY)

    const removeButtons = page.locator('#mockPage [data-inline-edit-remove]')
    const removeCount = await removeButtons.count()
    test.skip(removeCount === 0, 'no removable items on the bulleted fixture page')

    const target = removeButtons.first()
    const removedText = (await target.evaluate((el) => el.parentElement?.textContent))
      ?.replace('×', '')
      .trim()

    await target.click()

    const toast = page.locator('#toastContainer .toast', {
      hasText: /^Removed (bullet|paragraph)\./,
    })
    await expect(toast).toBeVisible()
    await expect(page.locator('#mockPage', { hasText: removedText })).toHaveCount(0)

    await toast.locator('[data-inline-edit-undo]').click()

    await expect(page.locator('#mockPage', { hasText: removedText })).toBeVisible()
  })

  test('editing a section heading shows Reset to original, which restores it', async ({ page }) => {
    await gotoFresh(page)
    const heading = page.locator('#mockPage h2[data-rewrite-field$=".heading"]').first()
    const originalText = (await heading.textContent())?.trim()
    await heading.click()

    const block = await editorJsBlock(page)
    await replaceEditorJsFieldText(page, block, 'Edited Heading Text')
    await commitEditorJsField(page)

    const editedHeading = page.locator('#mockPage h2', { hasText: 'Edited Heading Text' })
    await expect(editedHeading).toBeVisible()
    await editedHeading.locator('[data-inline-edit-reset]').click()

    const restoredHeading = page.locator('#mockPage h2', { hasText: originalText })
    await expect(restoredHeading).toBeVisible()
    await expect(page.locator('#mockPage h2', { hasText: 'Edited Heading Text' })).toHaveCount(0)
  })

  test('a title edit persists across reload', async ({ page }) => {
    await gotoFresh(page)
    const title = page.locator('#mockPage h1[data-rewrite-field="title"]')
    await title.click()

    const block = await editorJsBlock(page)
    await replaceEditorJsFieldText(page, block, 'Persisted Title')
    await commitEditorJsField(page)
    await expect(page.locator('#mockPage h1[data-rewrite-field="title"]')).toContainText(
      'Persisted Title'
    )

    await page.reload()
    await expect(page.locator('#mockPage h1[data-rewrite-field="title"]')).toContainText(
      'Persisted Title'
    )
  })

  // This proves section_edits round-trips through the JSON backup path
  // specifically (CLAUDE.md documents that the CSV export path does NOT
  // carry section_edits, only edited_title/edited_summary/primary_cta) —
  // NOT that the import path merges rather than wipes. Local state is
  // cleared before re-importing, so nothing survives here for a wholesale
  // replace to destroy; that distinction is covered separately by
  // tests/e2e/merge-verification.spec.js, which re-imports an older backup
  // ON TOP OF live state that has moved on. See CLAUDE.md's "Local
  // persistence" section for why the two shapes are not interchangeable.
  test('a section edit survives an export, clear, and JSON backup re-import cycle', async ({
    page,
  }) => {
    await gotoFresh(page)
    const heading = page.locator('#mockPage h2[data-rewrite-field$=".heading"]').first()
    await heading.click()

    const block = await editorJsBlock(page)
    await replaceEditorJsFieldText(page, block, 'Round Trip Heading')
    await commitEditorJsField(page)
    await expect(page.locator('#mockPage h2', { hasText: 'Round Trip Heading' })).toBeVisible()
    await settleDebounce(page)

    await page.selectOption('#exportScope', 'backup-json')
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#exportReviews'),
    ])
    // Re-save the download into this test's own output dir, matching
    // tests/e2e/import-export.spec.js's writeTempFile() pattern — the
    // download's own temp path is not guaranteed stable across the reloads
    // below.
    const backupText = fs.readFileSync(await download.path(), 'utf8')
    const backupPath = test.info().outputPath('inline-edit-roundtrip.json')
    fs.writeFileSync(backupPath, backupText)

    page.on('dialog', (dialog) => dialog.accept())
    await page.click('#clearSavedLocalReviews')
    await page.reload()
    await expect(page.locator('#mockPage h2', { hasText: 'Round Trip Heading' })).toHaveCount(0)

    await page.setInputFiles('#reviewImportFile', backupPath)
    await page.reload()
    await expect(page.locator('#mockPage h2', { hasText: 'Round Trip Heading' })).toBeVisible()
  })

  // The four cases below cover js/editing/inline-content-edit-link-tool.js (Phase 4
  // of the Editor.js integration), which had no e2e coverage before this
  // rewrite. The first three are mutation-proven: reverting js/inline-
  // content-edit.js's commit()-prefers-the-stash fix (deleting the
  // `pendingLinkHtml` override and falling back to raw editor.save()
  // output) was confirmed to fail the internal- and external-link cases
  // specifically, with the plain-text paragraph edit case above still
  // passing — proving these two are the ones actually exercising that fix,
  // not incidentally passing alongside it. The "typing after inserting a
  // link" case immediately below the first covers a narrower regression in
  // that same stash: reverting the holder-level 'input' listener that keeps
  // it in sync with further typing (js/editing/inline-content-edit.js) reproduces
  // the silent-data-loss bug this test exists to catch.
  test('adding an internal link renders as an internal-page control', async ({ page }) => {
    await gotoFresh(page)
    const paragraph = page
      .locator('#mockPage p[data-rewrite-field^="sections."][data-rewrite-field$=".paragraphs.0"]')
      .first()
    const paragraphText = (await paragraph.textContent()) || ''
    const selectedWord = paragraphText.trim().split(/\s+/)[0]
    await paragraph.click()
    await editorJsBlock(page)

    const result = await addInlineLink(page, selectedWord, 'rodentsReport')
    expect(result.ok).toBe(true)
    await commitEditorJsField(page)

    const internalLink = paragraph.locator('button.inline-link[data-render-target="rodentsReport"]')
    await expect(internalLink).toHaveText(selectedWord)
    await expect(page.locator('#mockPage p .unverified-pill').first()).toBeVisible()
  })

  test('typing after inserting a link is not silently discarded on blur', async ({ page }) => {
    // Regression test for the bug this fixes: js/inline-content-edit-link-
    // tool.js's commitLink() stashes the block's HTML at link-insertion time
    // (Editor.js's own blur cleanup strips the anchor before commit() can
    // read editor.save()'s output faithfully), and js/editing/inline-content-edit.js's
    // commit() always preferred that ONE-TIME stash over live editor state —
    // so any text typed after inserting a link but before blurring the field
    // (a completely normal add-link-then-keep-typing flow) vanished with no
    // error, no warning, nothing. js/editing/inline-content-edit.js's holder-level
    // 'input' listener now keeps the stash in sync with further typing.
    await gotoFresh(page)
    const paragraph = page
      .locator('#mockPage p[data-rewrite-field^="sections."][data-rewrite-field$=".paragraphs.0"]')
      .first()
    const paragraphText = (await paragraph.textContent()) || ''
    const selectedWord = paragraphText.trim().split(/\s+/)[0]
    await paragraph.click()
    await editorJsBlock(page)

    const result = await addInlineLink(page, selectedWord, 'rodentsReport')
    expect(result.ok).toBe(true)

    const typeResult = await typeAfterLinkCommit(page, ' EXTRA TYPED TEXT AFTER LINK')
    expect(typeResult.ok).toBe(true)
    // Asserting on the stash directly (not just the eventual commit) proves
    // the holder's 'input' listener actually re-synced it, rather than the
    // final assertions below passing for some other reason.
    expect(typeResult.pendingStash).toContain('EXTRA TYPED TEXT AFTER LINK')

    await commitEditorJsField(page)

    const internalLink = paragraph.locator('button.inline-link[data-render-target="rodentsReport"]')
    await expect(internalLink).toHaveText(selectedWord)
    await expect(
      page.locator('#mockPage p', { hasText: 'EXTRA TYPED TEXT AFTER LINK' })
    ).toBeVisible()
  })

  test('adding an external link renders with target=_blank and the external glyph', async ({
    page,
  }) => {
    await gotoFresh(page)
    const paragraph = page
      .locator('#mockPage p[data-rewrite-field^="sections."][data-rewrite-field$=".paragraphs.0"]')
      .first()
    const paragraphText = (await paragraph.textContent()) || ''
    const selectedWord = paragraphText.trim().split(/\s+/)[0]
    await paragraph.click()
    await editorJsBlock(page)

    const result = await addInlineLink(page, selectedWord, 'https://sf.gov/311')
    expect(result.ok).toBe(true)
    await commitEditorJsField(page)

    const externalLink = page.locator('#mockPage a.inline-link[href="https://sf.gov/311"]')
    await expect(externalLink).toHaveAttribute('target', '_blank')
    await expect(externalLink).toHaveAttribute('rel', 'noopener noreferrer')
    await expect(externalLink).toContainText(selectedWord)
  })

  test('clicking the Link tool on already-linked text removes the link', async ({ page }) => {
    await gotoFresh(page)
    const paragraph = page
      .locator('#mockPage p[data-rewrite-field^="sections."][data-rewrite-field$=".paragraphs.0"]')
      .first()
    const paragraphText = (await paragraph.textContent()) || ''
    const selectedWord = paragraphText.trim().split(/\s+/)[0]
    await paragraph.click()
    await editorJsBlock(page)

    const result = await addInlineLink(page, selectedWord, 'rodentsReport')
    expect(result.ok).toBe(true)
    await commitEditorJsField(page)

    const internalLink = paragraph.locator('button.inline-link[data-render-target="rodentsReport"]')
    await expect(internalLink).toBeVisible()

    // Reopen the same field: pageValueToEditorData/markdownToEditingHtml
    // (js/editing/inline-content-edit-adapter.js) turns the stored
    // [word](rodentsReport) markdown back into an
    // <a data-render-target="rodentsReport">word</a> for editing, so the
    // selected text is now INSIDE that anchor. Clicking the Link button on
    // an existing anchor calls surround()'s unwrap() branch directly — no
    // target-entry input ever opens, unlike the add-link case above.
    await paragraph.click()
    await editorJsBlock(page)
    const unwrapResult = await selectWordAndClickLinkButton(page, selectedWord, {
      expectActionsPanel: false,
    })
    expect(unwrapResult.ok).toBe(true)
    await commitEditorJsField(page)

    await expect(
      paragraph.locator('button.inline-link[data-render-target="rodentsReport"]')
    ).toHaveCount(0)
    await expect(page.locator('#mockPage p', { hasText: paragraphText.trim() })).toBeVisible()
  })
  // The three cases below cover link-target validation: a target that points
  // nowhere is REFUSED rather than silently turned into a control that does
  // nothing when clicked. The rule itself has exhaustive unit coverage in
  // tests/inline-link-target.test.js; what these add is the two things only a
  // browser can show — that a typed rejection leaves the input open and
  // usable, and that a PASTED broken link (which never touches the link tool
  // at all) blocks the commit and can be cleared from inside the holder.
  test('a typed target that is not a page key is refused, leaving the input open', async ({
    page,
  }) => {
    await gotoFresh(page)
    const paragraph = page
      .locator('#mockPage p[data-rewrite-field^="sections."][data-rewrite-field$=".paragraphs.0"]')
      .first()
    const paragraphText = (await paragraph.textContent()) || ''
    const selectedWord = paragraphText.trim().split(/\s+/)[0]
    await paragraph.click()
    await editorJsBlock(page)

    const result = await addInlineLink(page, selectedWord, 'rodentsProbelm')
    expect(result.ok).toBe(true)

    const state = await readLinkInputState(page)
    // Still open, still holding what was typed: refusing is not cancelling.
    expect(state.open).toBe(true)
    expect(state.invalid).toBe(true)
    expect(state.value).toBe('rodentsProbelm')
    expect(state.focused).toBe(true)
    // The rule is a STANDING description, announced on entering the field
    // rather than injected at error time.
    expect(state.describedByText).toContain('page key')

    // Nothing was inserted — the mockup must not carry a control pointing at
    // a page that does not exist.
    await commitEditorJsField(page)
    await expect(
      page.locator('#mockPage button.inline-link[data-render-target="rodentsProbelm"]')
    ).toHaveCount(0)
  })

  test('correcting a refused target and retrying inserts the link', async ({ page }) => {
    // The refusal has to be recoverable in place. If Enter stopped working
    // after one rejection, the only way out would be Escape, which discards
    // the whole edit.
    await gotoFresh(page)
    const paragraph = page
      .locator('#mockPage p[data-rewrite-field^="sections."][data-rewrite-field$=".paragraphs.0"]')
      .first()
    const paragraphText = (await paragraph.textContent()) || ''
    const selectedWord = paragraphText.trim().split(/\s+/)[0]
    await paragraph.click()
    await editorJsBlock(page)

    expect((await addInlineLink(page, selectedWord, 'rodentsProbelm')).ok).toBe(true)
    expect((await readLinkInputState(page)).invalid).toBe(true)

    await page.evaluate(() => {
      const input = document.querySelector('.inline-edit-link-input')
      input.value = 'rodentsReport'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
      )
    })
    await commitEditorJsField(page)

    await expect(
      paragraph.locator('button.inline-link[data-render-target="rodentsReport"]')
    ).toHaveText(selectedWord)
  })

  test('a pasted broken link blocks the commit until it is removed', async ({ page }) => {
    await gotoFresh(page)
    const paragraph = page
      .locator('#mockPage p[data-rewrite-field^="sections."][data-rewrite-field$=".paragraphs.0"]')
      .first()
    const paragraphText = ((await paragraph.textContent()) || '').trim()
    await paragraph.click()
    await editorJsBlock(page)

    // Bypasses the link tool entirely, which is exactly what a paste does:
    // the tool's sanitize() config allows data-render-target, so Editor.js
    // carries a copied anchor straight through to the adapter.
    expect((await pasteAnchorIntoEditor(page, { label: 'ghost', target: 'ghostPage' })).ok).toBe(
      true
    )
    await commitEditorJsField(page)

    const notice = await readBrokenLinkNotice(page)
    expect(notice.holderPresent).toBe(true)
    expect(notice.holderInvalid).toBe(true)
    expect(notice.noticeInsideHolder).toBe(true)
    expect(notice.describedByResolves).toBe(true)
    // The offending target is quoted so a typo is distinguishable from a page
    // the reviewer only thought existed.
    expect(notice.message).toContain('ghostPage')
    expect(notice.buttonLabel).toBe('Remove broken link')

    // The editor is still open holding the reviewer's text — refusing is not
    // cancelling — and nothing was written to the mockup.
    await expect(page.locator('.inline-edit-editorjs-holder')).toHaveCount(1)
    await expect(
      page.locator('#mockPage button.inline-link[data-render-target="ghostPage"]')
    ).toHaveCount(0)

    // The way out. Pressing it strips the anchor to plain text and lets the
    // same commit through, keeping everything else that was typed.
    await page.click('[data-inline-edit-remove-broken-links]')
    await expect(page.locator('.inline-edit-editorjs-holder')).toHaveCount(0)
    await expect(
      page.locator('#mockPage button.inline-link[data-render-target="ghostPage"]')
    ).toHaveCount(0)
    const committed = page.locator('#mockPage p', { hasText: paragraphText.slice(0, 30) }).first()
    // The label survives as text: only the linking is lost, not the writing.
    await expect(committed).toContainText('ghost')
  })
})
