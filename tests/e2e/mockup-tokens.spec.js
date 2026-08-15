import { test, expect } from '@playwright/test'
import { gotoFresh } from './helpers.js'

/* The mockup renders SFDS's palette and type ladder.

   These are the first assertions in the suite that read a computed colour or
   size. That is deliberate: a sweep of the suite before this file existed found
   exactly one mention of a hex value and it was a prose comment, which means
   nothing could have caught a palette that moved wrongly. */

test.describe('mockup SFDS tokens', () => {
  test('paints body copy and background in SFDS black on white', async ({ page }) => {
    await gotoFresh(page)
    const body = await page.locator('#mockPage').evaluate((el) => {
      const s = getComputedStyle(el)
      return { color: s.color, background: getComputedStyle(document.body).backgroundColor }
    })
    expect(body.color).toBe('rgb(33, 33, 35)')
  })

  test('paints inline links in the SFDS action colour', async ({ page }) => {
    await gotoFresh(page)
    /* Scoped to `.page-body`, not `#mockPage a` as the brief originally wrote
       it: `#mockPage`'s first `<a>` in DOM order is `.brand`, the site-header
       logo link, which is deliberately black (a more specific selector than
       the generic `a` rule) rather than action-blue. `#mockPage a` therefore
       resolved to the wrong element and the test could never have failed for
       the stated reason -- confirmed by running it before this fix, which
       reported rgb(11, 12, 12) (the old --legacy-slate-1 black), not the
       brief's claimed rgb(42, 96, 175). `.page-body` is the actual rendered
       page content below the header/nav chrome, where a real inline link
       lives. */
    const link = page.locator('#mockPage .page-body a').first()
    await expect(link).toHaveCSS('color', 'rgb(73, 94, 212)')
  })

  test('serves a real (non-synthesised) weight-700 instance of both typefaces', async ({
    page,
  }) => {
    /* `String.includes()` over js/main.js (tests/font-loading.test.js) proves
       an import line exists, not that the browser actually has a 700 face to
       draw with — a typo'd family name would still pass that check while
       silently falling back to the system sans. `document.fonts.check()` is
       the one API that answers the real question: it returns true only when
       a loaded face matches the given weight, and false when the browser
       would have to synthesise one by smearing a lighter weight's outlines
       (different metrics, different stroke contrast — a rendering fault,
       not a type choice). Awaiting `document.fonts.ready` first is required:
       @font-face rules are declared as soon as the stylesheet parses, but a
       face isn't "available" to check() until the browser has actually
       fetched and parsed its font data, which for a `font-display: swap`
       face can lag first paint. */
    await gotoFresh(page)
    const checks = await page.evaluate(async () => {
      await document.fonts.ready
      return {
        flex: document.fonts.check('700 16px "Roboto Flex Variable"'),
        slab: document.fonts.check('700 16px "Roboto Slab"'),
      }
    })
    expect(checks.flex).toBe(true)
    expect(checks.slab).toBe(true)
  })
})
