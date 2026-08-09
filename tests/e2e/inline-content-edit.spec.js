// Inline content editing: click-to-edit on the mockup, add/remove for
// paragraphs and bullets, one-step undo, per-field reset, and persistence
// across reload and the JSON backup export/import round trip. See
// js/inline-content-edit.js and js/inline-content-edit-render.js for the
// feature's implementation; existing unit tests (tests/inline-content-edit*)
// already cover internals through happy-dom — this file drives the real
// browser UI instead, matching tests/e2e/import-export.spec.js's
// merge-not-wipe verification pattern for its last test.
//
// Selectors here favor the data-inline-edit-* attributes over class names,
// mirroring the unit tests' own convention (see
// tests/inline-content-edit.test.js) since those attributes are the
// intentional hook points, not incidental styling classes.
const fs = require('fs')
const { test, expect } = require('@playwright/test')
const { gotoFresh, selectPage, settleDebounce } = require('./helpers.js')

// The default landing page (pestsTopic, the Agency page) has paragraph
// sections but no bullet sections (js/page-data.js / pages/agency-service-grouping.js).
// scopeInfo (pages/hhvc-inspection-scope.js) has several section-level bullet
// lists with 2+ items each, so the add/remove list tests navigate there
// explicitly rather than assuming the default page carries list controls.
// A Transaction page like payFee also has bullets, but they sit nested
// inside steps[].bullets (js/inline-content-edit.js's decorateListControls()
// only decorates sections.N.bullets/paragraphs directly, not
// sections.N.steps.M.bullets) — verified live, this is out of the current
// feature's scope, not a bug, so the fixture page must be picked accordingly.
const BULLETED_PAGE_KEY = 'scopeInfo'

test.describe('inline content editing', () => {
  test('editing the title updates the mockup immediately and shows the Edited badge', async ({
    page,
  }) => {
    await gotoFresh(page)
    const title = page.locator('#mockPage h1[data-rewrite-field="title"]')
    const originalText = (await title.textContent())?.trim()
    await title.click()

    const input = page.locator('#mockPage [data-inline-edit-input]')
    await expect(input).toBeVisible()
    await input.fill('A New Test Title')
    await input.press('Enter')

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

    const input = page.locator('#mockPage [data-inline-edit-input]')
    await input.fill('Should Not Save')
    await input.press('Escape')

    const restoredTitle = page.locator('#mockPage h1[data-rewrite-field="title"]')
    await expect(restoredTitle).toHaveText(originalText)
    await expect(restoredTitle.locator('.inline-edit-badge')).toHaveCount(0)
  })

  test('editing a paragraph shows the Unverified pill, not the Edited badge', async ({ page }) => {
    await gotoFresh(page)
    const paragraph = page
      .locator('#mockPage p[data-rewrite-field^="sections."][data-rewrite-field$=".paragraphs.0"]')
      .first()
    await expect(paragraph).toBeVisible()
    await paragraph.click()

    const textarea = page.locator('#mockPage textarea[data-inline-edit-input]')
    await expect(textarea).toBeVisible()
    await textarea.fill('An edited paragraph.')
    await textarea.blur()

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

    // addListItem() (js/inline-content-edit.js) opens the new item's editor
    // once its own rerender() resolves — a real, possibly-async View
    // Transition in a real browser (see that function's comments) — so wait
    // for the widget to exist rather than asserting focus at a fixed instant.
    // The new item's edit widget (a <textarea>, per widgetTagFor()) replaces
    // the rendered <li>/<p> in place and carries the same data-rewrite-field
    // path — scope to [data-inline-edit-input] so this resolves the live
    // editor, not the element it replaced.
    const active = page.locator(
      `#mockPage [data-rewrite-field="${containerPath}.${before}"][data-inline-edit-input]`
    )
    await active.waitFor({ state: 'visible' })
    await expect(active).toBeFocused()
    await active.fill('A brand new item.')
    await active.blur()

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

    const input = page.locator('#mockPage [data-inline-edit-input]')
    await input.fill('Edited Heading Text')
    await input.press('Enter')

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

    const input = page.locator('#mockPage [data-inline-edit-input]')
    await input.fill('Persisted Title')
    await input.press('Enter')
    await expect(page.locator('#mockPage h1[data-rewrite-field="title"]')).toContainText(
      'Persisted Title'
    )

    await page.reload()
    await expect(page.locator('#mockPage h1[data-rewrite-field="title"]')).toContainText(
      'Persisted Title'
    )
  })

  test('a section edit survives export, clear, and JSON backup re-import (merge, not wipe)', async ({
    page,
  }) => {
    await gotoFresh(page)
    const heading = page.locator('#mockPage h2[data-rewrite-field$=".heading"]').first()
    await heading.click()

    const input = page.locator('#mockPage [data-inline-edit-input]')
    await input.fill('Round Trip Heading')
    await input.press('Enter')
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
})
