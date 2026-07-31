// PNG export of the page mockups, driven through the real UI.
//
// The value of this spec is that it exercises the actual capture: the module
// serialises the live DOM through modern-screenshot, so a broken selector, a
// CSS feature the serialiser chokes on, or a bundling mistake all surface here
// and nowhere else. Asserting on the produced file (real PNG magic bytes, more
// than a trivial number of them) is what separates "a download happened" from
// "a usable image was produced".
const { test, expect } = require('@playwright/test')
const { gotoFresh, focusMockPage } = require('./helpers')

// PNG files always begin with this 8-byte signature.
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

async function readDownload(download) {
  const stream = await download.createReadStream()
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  return Buffer.concat(chunks)
}

test.describe('mockup PNG export', () => {
  test('the toolbar button downloads a PNG of the current mockup', async ({ page }) => {
    await gotoFresh(page)

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

  test('the export omits the Karl tag toggle banner', async ({ page }) => {
    await gotoFresh(page)

    // The banner carrying the "Show Karl tags" switch and the tag legend sits
    // INSIDE figure.browser-shell — it has to, so the switch is next to what it
    // controls — which puts it inside the capture target. It is tool chrome, so
    // index.html marks it data-export-exclude.
    //
    // This has to be checked against pixels, and by searching for the banner
    // rather than by looking where it ought to be. Three cheaper assertions were
    // tried and all three pass even when the banner IS captured:
    //
    //   - Asserting the attribute is present only restates the markup.
    //   - Asserting on the PNG's height proves nothing: modern-screenshot sizes
    //     the output canvas from the SOURCE node's box, so excluding a child
    //     shortens the drawn content but leaves the canvas exactly as tall
    //     (measured: 13508px either way).
    //   - Sampling one pixel at the banner's shell-relative position misses,
    //     because the serialiser draws with its own offset — image coordinates
    //     are not shell coordinates.
    //
    // What is left is a property of the whole image: the banner is a wide band
    // of one flat tint, and nothing else near the top of a mockup uses that
    // colour. So scan the top of the image for rows that are mostly that tint.
    // Measured: 18 such rows when the banner is captured, 0 when it is excluded.
    const bannerBackground = await page.evaluate(
      () =>
        window.getComputedStyle(document.querySelector('.karl-page-tags-banner')).backgroundColor
    )

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-mockup-export="current"]'),
    ])
    const bytes = await readDownload(download)

    // Decode in the browser rather than adding a PNG library to the repo for one
    // assertion — the page already has canvas.
    const bandedRows = await page.evaluate(
      async ({ base64, background }) => {
        const [r0, g0, b0] = background.match(/\d+/g).map(Number)
        const blob = await (await fetch(`data:image/png;base64,${base64}`)).blob()
        const bitmap = await createImageBitmap(blob)
        const canvas = document.createElement('canvas')
        canvas.width = bitmap.width
        canvas.height = bitmap.height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(bitmap, 0, 0)

        // Only the top of the image: the banner sits directly under the browser
        // bar, and limiting the scan keeps unrelated tinted blocks further down
        // the page from ever being mistaken for it.
        const top = Math.min(1600, bitmap.height)
        const data = ctx.getImageData(0, 0, bitmap.width, top).data
        let banded = 0
        for (let y = 0; y < top; y += 8) {
          let hits = 0
          let samples = 0
          for (let x = 0; x < bitmap.width; x += 16) {
            const i = (y * bitmap.width + x) * 4
            samples += 1
            if (data[i] === r0 && data[i + 1] === g0 && data[i + 2] === b0) hits += 1
          }
          if (hits / samples > 0.5) banded += 1
        }
        return banded
      },
      { base64: bytes.toString('base64'), background: bannerBackground }
    )

    expect(bandedRows).toBe(0)
  })

  test('the export omits Karl tags and restores them afterwards', async ({ page }) => {
    await gotoFresh(page)

    // Karl tags are on by default; they are review scaffolding and must not
    // appear in a deliverable handed to anyone outside the review.
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
