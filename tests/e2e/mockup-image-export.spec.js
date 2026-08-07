// PNG export of the page mockups, driven through the real UI.
//
// The value of this spec is that it exercises the actual capture: the module
// serialises the live DOM through modern-screenshot, so a broken selector, a
// CSS feature the serialiser chokes on, or a bundling mistake all surface here
// and nowhere else. Asserting on the produced file (real PNG magic bytes, more
// than a trivial number of them) is what separates "a download happened" from
// "a usable image was produced".
const { test, expect } = require('@playwright/test')
const { gotoFresh, focusMockPage, openAdvancedSection } = require('./helpers')

// PNG files always begin with this 8-byte signature.
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

async function readDownload(download) {
  const stream = await download.createReadStream()
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  return Buffer.concat(chunks)
}

test.describe('mockup PNG export', () => {
  test('the Help panel button downloads a PNG of the current mockup', async ({ page }) => {
    await gotoFresh(page)
    // These two buttons used to sit in .canvas-toolbar beside the decision chip
    // and Previous/Next. Saving a picture for someone outside the review is a
    // real task but an occasional one, so it moved into Help's advanced
    // sections; the `p` shortcut is unchanged and still the fast path.
    await openAdvancedSection(page, 'Save mockups as images')

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-mockup-export="current"]'),
    ])

    // Default page is the agency page, so the name should identify it.
    expect(download.suggestedFilename()).toMatch(/^hhvc-pestsTopic-\d{4}-\d{2}-\d{2}\.png$/)

    const bytes = await readDownload(download)
    expect(bytes.subarray(0, 8).equals(PNG_MAGIC)).toBe(true)
    // A blank or failed capture still yields a valid PNG header, so assert the
    // image has real content in it. A full page render at 2x is far larger
    // than this; the threshold only needs to exclude an empty canvas.
    expect(bytes.length).toBeGreaterThan(20_000)
  })

  test('the p shortcut exports the current mockup', async ({ page }) => {
    await gotoFresh(page)
    // Shortcuts are gated on focus being in a shortcut context — see
    // focusMockPage in helpers.js.
    await focusMockPage(page)

    const [download] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('p')])

    expect(download.suggestedFilename()).toMatch(/\.png$/)
    const bytes = await readDownload(download)
    expect(bytes.subarray(0, 8).equals(PNG_MAGIC)).toBe(true)
  })

  /* A test here used to prove the capture EXCLUDED the Karl tag banner — the
     block carrying the "Show Karl tags" switch, the colour legend and a
     "What are Karl tags?" disclosure, which sat inside figure.browser-shell and
     so inside the capture target. It did that by decoding the PNG and scanning
     the top of the image for rows of the banner's flat tint, because three
     cheaper assertions all passed even when the banner WAS captured.

     The banner is gone from the mockup entirely — about 495px of permanent
     reference material above every page — and the switch it carried now lives
     in the toolbar, outside .browser-shell. There is nothing left to exclude,
     and "the element does not exist in the capture target" is a stronger
     guarantee than "the serialiser skips it". The Karl-tag legend's new home in
     Help is asserted in tests/e2e/workspace-panels.spec.js. */

  test('the export omits Karl tags and restores them afterwards', async ({ page }) => {
    await gotoFresh(page)
    await openAdvancedSection(page, 'Save mockups as images')

    // Karl tags default off, but this regression must cover the reviewer's
    // enabled state: the exporter may hide them for capture, never after it.
    await expect(page.locator('#tagToggle')).not.toBeChecked()
    await page.locator('.karl-switch').click()
    await expect(page.locator('#tagToggle')).toBeChecked()
    await expect(page.locator('body')).not.toHaveClass(/hide-karl-tags/)

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-mockup-export="current"]'),
    ])
    await readDownload(download)

    // The reviewer's own view must come back exactly as it was: the module
    // hides tags only for the duration of the capture.
    await expect(page.locator('body')).not.toHaveClass(/hide-karl-tags/)
    await expect(page.locator('#tagToggle')).toBeChecked()
  })
})
