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

test.describe('mockup type ladder', () => {
  test('renders the SFDS title steps at desktop width', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await gotoFresh(page)
    const sizes = await page.evaluate(() => {
      const read = (sel) => {
        const el = document.querySelector(sel)
        if (!el) return null
        const s = getComputedStyle(el)
        return {
          size: s.fontSize,
          leading: s.lineHeight,
          weight: s.fontWeight,
          family: s.fontFamily,
        }
      }
      // `#mockPage h2` alone resolves to the wrong element: DOM order puts
      // .region-title ("Services"/"Resources", a grouping label one tier
      // below the ladder -- see the comment on .region-title in
      // css/styles.css) before the page's actual section heading. `.section
      // h2` is renderSection()'s always-present heading and the one that
      // takes --sfds-text-title-lg, so it is the one this assertion means.
      // `#mockPage h3` needs no equivalent narrowing: the first h3 in DOM
      // order is .service-group's own heading, which IS on the ladder.
      return {
        h1: read('#mockPage h1'),
        h2: read('#mockPage .section h2'),
        h3: read('#mockPage h3'),
      }
    })
    expect(sizes.h1.size).toBe('60px')
    expect(sizes.h1.leading).toBe('64px')
    expect(sizes.h1.weight).toBe('700')
    expect(sizes.h2.size).toBe('44px')
    expect(sizes.h2.leading).toBe('52px')
    expect(sizes.h3.size).toBe('20px')
    expect(sizes.h3.leading).toBe('24px')
  })

  test('uses the slab face for h1 and h2 and the sans face for h3', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await gotoFresh(page)
    const faces = await page.evaluate(() => ({
      h1: getComputedStyle(document.querySelector('#mockPage h1')).fontFamily,
      h3: getComputedStyle(document.querySelector('#mockPage h3')).fontFamily,
    }))
    expect(faces.h1).toContain('Roboto Slab')
    expect(faces.h3).toContain('Roboto Flex')
    expect(faces.h3).not.toContain('Roboto Slab')

    /* getComputedStyle().fontWeight reports 700 whether the browser has a
       real 700 face or is synthesising one by geometrically smearing the
       400 outlines -- a different, worse set of metrics that reads as a
       rendering fault, not a type choice (see the "serves a real
       (non-synthesised) weight-700 instance" test above, which exists for
       exactly this reason). document.fonts.check() is the instrument that
       tells the two apart: it returns true only when a matching face is
       actually available to draw with. Checked here specifically for the
       slab face at h1/h2 and the sans face at h3, since those are the two
       faces this test's own weight-700 headings depend on. */
    const realFaces = await page.evaluate(async () => {
      await document.fonts.ready
      return {
        slab: document.fonts.check('700 16px "Roboto Slab"'),
        sans: document.fonts.check('700 16px "Roboto Flex Variable"'),
      }
    })
    expect(realFaces.slab).toBe(true)
    expect(realFaces.sans).toBe(true)
  })

  test('steps down below the 768px breakpoint', async ({ page }) => {
    await page.setViewportSize({ width: 700, height: 900 })
    await gotoFresh(page)
    const h1 = await page.evaluate(
      () => getComputedStyle(document.querySelector('#mockPage h1')).fontSize
    )
    expect(h1).toBe('32px')
  })
})
