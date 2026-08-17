import { test, expect } from '@playwright/test'
import { gotoFresh, selectPage } from './helpers.js'

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
      // .region-title ("Services"/"Resources", a grouping label ON the
      // ladder but a step below this one -- --sfds-text-title-sm rather than
      // -lg, see the comment on .region-title in css/styles.css and the
      // "promotes .region-title" test below) before the page's actual
      // section heading. `.section h2` is renderSection()'s always-present
      // heading and the one that takes --sfds-text-title-lg, so it is the
      // one this assertion means.
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
    /* h2 is read explicitly rather than left to the bare `h1, h2` rule this
       test is really about. The rule is unscoped, so a scoped override —
       `.section h2` already exists and sets its own size — could take the
       slab face off every content heading in the mockup while h1 and h3 both
       stayed correct. The test was named for h1 and h2 and asserted h1 and
       h3, so that regression had no assertion anywhere.

       `.section h2` specifically, not a bare `#mockPage h2`: the first h2 in
       document order can be the "On this page" widget's own label, which is
       deliberately off the title ladder and would be measuring a different
       tier than the one this test names. */
    const faces = await page.evaluate(() => ({
      h1: getComputedStyle(document.querySelector('#mockPage h1')).fontFamily,
      h2: getComputedStyle(document.querySelector('#mockPage .section h2')).fontFamily,
      h3: getComputedStyle(document.querySelector('#mockPage h3')).fontFamily,
    }))
    expect(faces.h1).toContain('Roboto Slab')
    expect(faces.h2).toContain('Roboto Slab')
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

  /* A follow-up review found that splitting the old shared
     `h1, h2, h3, h4 { line-height: 1.15 }` block into separate per-level
     rules had silently dropped line-height for every heading that carries
     its own font-size but not its own line-height: an h1-h3-level one
     cascades in the WRONG ladder token from the bare per-level rule
     (mismatched, not absent -- see e.g. .top-facts h2's comment), while h4
     had no matching rule at any specificity and fell all the way through to
     body's 1.55. `.footer-columns h4` is the only h4 the mockup renders, so
     it stands in for the whole h4 case; css/styles.css names the other
     affected selectors (`.sidebar h2`, `.card h3`, `.contact-section h3`,
     `.top-facts h2`, `.callout-header h3`, `.what-to-know-subsection h3`,
     `.custom-section h3`, `.what-to-know-heading`, `.accordion-heading`)
     each carrying the same restored `line-height: 1.15`, but asserting all
     nine here would be redundant with what the comments already pin per
     selector -- this is a regression guard for the class of bug, not an
     exhaustive re-listing. */
  test('restores line-height for h4, which the ladder split left without one', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await gotoFresh(page)
    const h4 = await page.evaluate(() => {
      const el = document.querySelector('#mockPage .footer-columns h4')
      const s = getComputedStyle(el)
      return { size: s.fontSize, leading: s.lineHeight }
    })
    expect(h4.size).toBe('17.6px')
    // 1.15 x 17.6px, not body's inherited 1.55 (which would read 27.28px).
    expect(h4.leading).toBe('20.24px')
  })

  /* .spotlight-section-inner h2 had never been given a font-size of its own
     (see its own comment in css/styles.css), so it silently rendered at the
     full bare-h2 titleLg step -- confirmed live on ipmEducation, where its
     heading rendered as large as a real .section h2 inside a box meant to
     read as a secondary widget. It is now matched to .top-facts h2 exactly,
     since both are the same class of boxed sub-widget. ipmEducation is the
     one page carrying both components, so this asserts they agree rather
     than re-asserting either literal on its own. */
  test('matches .spotlight-section-inner h2 to .top-facts h2, not the h2 ladder step', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await gotoFresh(page)
    await selectPage(page, 'ipmEducation')
    const sizes = await page.evaluate(() => {
      const read = (sel) => {
        const s = getComputedStyle(document.querySelector(sel))
        return { size: s.fontSize, leading: s.lineHeight }
      }
      return {
        spotlight: read('#mockPage .spotlight-section-inner h2'),
        topFacts: read('#mockPage .top-facts h2'),
      }
    })
    expect(sizes.spotlight.size).toBe('18.4px')
    expect(sizes.spotlight.leading).toBe('21.16px')
    expect(sizes.spotlight).toEqual(sizes.topFacts)
  })

  /* .region-title ("Services"/"Resources") used to sit 4px above
     .service-group h3 at its own bespoke 1.35rem. .service-group h3 joined
     the ladder's titleXs step (20px) in the same pass that introduced the
     ladder, shrinking that gap to 1.6px with nothing else distinguishing the
     grouping label from the heading of the group beneath it -- confirmed
     live on pestsTopic, where "Services" read as a peer of "Get help with
     pests, mold, or trash" rather than its label. Promoted onto
     --sfds-text-title-sm (24px/28px): still comfortably under a real
     .section h2 (44px on the same page, asserted below) so it does not
     compete with an actual section heading, and clearly above
     .service-group h3 again. */
  test('promotes .region-title onto the ladder, above .service-group h3', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await gotoFresh(page)
    const sizes = await page.evaluate(() => {
      const read = (sel) => {
        const s = getComputedStyle(document.querySelector(sel))
        return { size: s.fontSize, leading: s.lineHeight }
      }
      return {
        regionTitle: read('#mockPage .region-title'),
        serviceGroupH3: read('#mockPage .service-group h3'),
        sectionH2: read('#mockPage .section h2'),
      }
    })
    expect(sizes.regionTitle.size).toBe('24px')
    expect(sizes.regionTitle.leading).toBe('28px')
    expect(sizes.serviceGroupH3.size).toBe('20px')
    expect(sizes.sectionH2.size).toBe('44px')
  })
})
