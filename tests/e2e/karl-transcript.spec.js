// The Karl transcript panel, driven the way a reviewer drives it: open the
// workspace, expand the section, press the button, read what appears.
//
// The builder itself is unit-tested against hand-built pages
// (tests/karl-transcript.test.js). What only a browser can prove is the half
// this file covers: that the panel mounts inside a collapsed <details> the Help
// tab re-appends on every open, that it resolves the page CURRENTLY in the
// mockup, and that it reads this browser's saved review record rather than the
// authored page alone.
const { test, expect } = require('@playwright/test')
const { gotoFresh, openAdvancedSection, setDecision, selectPage } = require('./helpers')

const SECTION = 'Karl transcript for this page'

test.describe('Karl transcript panel', () => {
  test('renders the open page’s transcript, headed by the Karl path', async ({ page }) => {
    await gotoFresh(page)
    await openAdvancedSection(page, SECTION)
    await page.click('#karlTranscriptPreviewButton')

    const preview = page.locator('#karlTranscriptPreview')
    await expect(preview).toBeVisible()
    // pestsTopic is the Agency page and loads first, so this also proves the
    // panel picked the page in the mockup rather than a fixed one.
    await expect(preview).toContainText('New: Agency → Content')
    await expect(preview).toContainText('Karl transcript')
    await expect(preview).toContainText('nothing here has been written to Karl')
  })

  test('follows the reviewer to another page', async ({ page }) => {
    await gotoFresh(page)
    await selectPage(page, 'article11Guide')
    await openAdvancedSection(page, SECTION)
    await page.click('#karlTranscriptPreviewButton')
    await expect(page.locator('#karlTranscriptPreview')).toContainText('New: Report → Content')
  })

  test('carries this browser’s saved decision', async ({ page }) => {
    await gotoFresh(page)
    await setDecision(page, 'Approved')
    await openAdvancedSection(page, SECTION)
    await page.click('#karlTranscriptPreviewButton')

    const preview = page.locator('#karlTranscriptPreview')
    await expect(preview).toContainText('**Decision:** Approved')
    await expect(preview).not.toContainText('NOT APPROVED')
  })

  test('marks a not-approved page throughout', async ({ page }) => {
    // Approval is per page and not per field, so the caveat has to reach every
    // panel rather than sitting in the header alone.
    await gotoFresh(page)
    await setDecision(page, 'Blocked')
    await openAdvancedSection(page, SECTION)
    await page.click('#karlTranscriptPreviewButton')

    const preview = page.locator('#karlTranscriptPreview')
    await expect(preview).toContainText('NOT APPROVED')
    await expect(preview).toContainText('page not approved')
  })

  test('carries an inline content edit rather than the copy it superseded', async ({ page }) => {
    // The whole point of the feature: an editor must be typing approved copy.
    // Seeded through the same localStorage shape every other review surface
    // reads, then read back through the panel.
    await gotoFresh(page)
    await page.evaluate(() => {
      window.reviewState.update((state) => {
        state.pages.pestsTopic = {
          ...(state.pages.pestsTopic || {}),
          page_key: 'pestsTopic',
          decision: 'Approved',
          edited_summary: 'A summary the reviewer rewrote.',
        }
        return state
      })
    })
    await page.reload()
    await openAdvancedSection(page, SECTION)
    await page.click('#karlTranscriptPreviewButton')
    await expect(page.locator('#karlTranscriptPreview')).toContainText(
      'A summary the reviewer rewrote.'
    )
  })
})
