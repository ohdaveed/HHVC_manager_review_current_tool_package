import { test, expect } from '@playwright/test'
import { gotoFresh, openWorkspaceTab, openAdvancedSection } from './helpers.js'

test.describe('chrome type scale', () => {
  test('resolves the four steps onto SFDS values', async ({ page }) => {
    await page.setViewportSize({ width: 1800, height: 1000 })
    await gotoFresh(page)
    const steps = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement)
      return {
        panel: s.getPropertyValue('--ds-text-panel').trim(),
        card: s.getPropertyValue('--ds-text-card').trim(),
        label: s.getPropertyValue('--ds-text-label').trim(),
        micro: s.getPropertyValue('--ds-text-micro').trim(),
      }
    })
    // `bun run test:e2e` always drives the BUILT app (Playwright's webServer
    // runs `bun run start`, which builds first) — never the unbundled dev
    // server — so these strings have to match what the production CSS
    // minifier actually emits, not what css/theme.css authors. Vite's CSS
    // minifier strips a leading zero from a fraction-only <number> token
    // (0.875rem -> .875rem) to save bytes; it does not touch a value with a
    // nonzero integer part (1.25rem, 1rem stay as authored). Confirmed
    // against dist/assets/*.css directly, not inferred: `--sfds-text-small`
    // serializes as `.875rem` and `--ext-text-2xs` as `.6875rem` there.
    expect(steps.panel).toBe('1.25rem')
    expect(steps.card).toBe('1rem')
    expect(steps.label).toBe('.875rem')
    expect(steps.micro).toBe('.6875rem')
  })

  test('leaves no chrome rule below the SFDS 14px floor except eyebrows', async ({ page }) => {
    await page.setViewportSize({ width: 1800, height: 1000 })
    await gotoFresh(page)
    // The React islands mount on demand, through a dynamic import fired when
    // their tab first opens, so a scan of a freshly loaded page walks chrome
    // that does not yet include any of them. That is not a small gap: MUI
    // components ship their own type sizes, and the Checks panel's Chip
    // rendered at 13px -- below this floor, not uppercase, and invisible to
    // this test -- until the theme mapped it. Opening the tab and waiting for
    // a real MUI class is what puts the island inside the scan.
    await openWorkspaceTab(page, 'checks')
    await page.locator('#reviewChecksIsland .MuiChip-root').first().waitFor()
    // Half this panel's chrome does not exist until Help opens, and the rest
    // of it not until each collapsed <details> is expanded -- they render on
    // Help opening but stay closed, so their contents never get a layout box
    // and every rule inside them was invisible to this scan. That was not
    // theoretical: `.karl-tag-legend-desc` renders non-uppercase at 0.76rem
    // (12.16px), below this floor, and lived entirely inside the unopened
    // legend. Opening each one is what puts the deferred chrome in scope.
    await openWorkspaceTab(page, 'help')
    for (const section of [
      'Draft content with AI',
      'Stored review data on this browser',
      'Pages added and deleted',
      'Save mockups as images',
    ]) {
      await openAdvancedSection(page, section)
    }
    const { total, small, micro } = await page.evaluate(() => {
      // Tool chrome is not just #reviewWorkspace -- the sidebar and the
      // canvas toolbar are chrome too, and a sub-14px rule added to either
      // of those would have passed this test silently before this scope
      // widened. `.app` is the outermost container for all three (sidebar,
      // canvas incl. toolbar, workspace), so scanning it and excluding the
      // mockup is what "the tool's chrome as a whole" actually means.
      //
      // `.browser-shell` is excluded, not scoped out entirely, because it
      // sits INSIDE `.app`: it is a live preview of a real SF.gov page that
      // managers are being asked to approve, and its type scale was settled
      // by separate work (see css/styles.css's h1-h4 comment) -- dragging it
      // into the chrome floor would flag the thing under review, not a
      // chrome regression.
      //
      // The inline-edit widgets are the exception, and excluding them was a
      // real hole. They are INJECTED under #mockPage, so they sit inside the
      // shell, but they are review-tool controls styled by
      // css/inline-content-edit.css -- not SF.gov page content. Dropping
      // every descendant of the shell meant a sub-14px regression in that
      // stylesheet could never fail this test. Membership is decided by the
      // widget's own class prefix rather than by position in the DOM, which
      // is the thing that actually distinguishes tool chrome from page copy
      // here.
      // The Karl tag legend is the mirror image of the inline-edit case, and
      // needs the opposite treatment. It lives in Help -- chrome, outside the
      // shell -- but its swatches and its two inline example pills
      // (`.karl-tag-flag`, `.karl-tag-inherit`) are SPECIMENS: their whole
      // job is to reproduce, at their real size, an annotation that renders
      // inside the mockup. Holding a specimen to the chrome floor flags the
      // thing being illustrated rather than any chrome, which is the same
      // argument that keeps `.browser-shell` out above -- and resizing them
      // to pass would make the legend stop depicting what it documents.
      // css/styles.css says as much where it pins the legend's swatch colours
      // to the mockup's rather than to the panel's. The legend's OWN prose
      // and headings are not specimens and are scanned normally.
      const isSpecimen = (el) =>
        !!el.closest('.karl-tag-legend') &&
        !!el.closest('.karl-tag, .karl-tag-flag, .karl-tag-inherit')
      const root = document.querySelector('.app')
      const isChrome = (el) =>
        (!el.closest('.browser-shell') || !!el.closest('[class*="inline-edit-"]')) &&
        !isSpecimen(el)
      const all = root ? [...root.querySelectorAll('*')].filter(isChrome) : []
      // The one size allowed below the floor, read from the token rather than
      // restated, so the exemption cannot drift away from the scale it names.
      const micro = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--ds-text-micro')
      )
      const microPx = micro * 16
      const small = all
        .map((el) => ({
          size: parseFloat(getComputedStyle(el).fontSize),
          transform: getComputedStyle(el).textTransform,
          cls: el.className && String(el.className).slice(0, 40),
          // Chromium gives every <input>/<button>/<select> a UA-stylesheet
          // default font-size of 13.3333px (10pt) regardless of any author
          // CSS, and the review queue's checkboxes never override it because
          // a checkbox renders no text glyph -- there is nothing for that
          // number to make "too small." Requiring visible text is what tells
          // a real violation (a label rendering below the floor) apart from
          // this UA artefact, which is present on `main` and unrelated to
          // the type-scale sweep.
          text: (el.textContent || '').trim(),
        }))
        // Uppercase is a narrow exemption for eyebrow labels, not a general
        // escape: legibility at these sizes comes from letter-spacing and
        // weight rather than from the glyph's own height, which is exactly
        // why the extension token (--ext-text-2xs, 11px) was scoped to
        // uppercase eyebrows and nothing else. A sub-14px rule that is NOT
        // uppercase gets no such argument and must resolve to a real step.
        //
        // The exemption is bounded by SIZE as well as by case, and it has to
        // be. `transform !== 'uppercase'` alone exempts EVERY uppercase
        // element at ANY size, so `font-size: 8px; text-transform: uppercase`
        // passed -- and so did the 12.16px and 12.48px legend labels, which
        // are uppercase but sit on no step at all. The argument for going
        // below the floor is specifically the one step the scale publishes
        // for it, so that is the only size it buys: --ds-text-micro, read
        // above from the token itself and compared with a half-pixel
        // tolerance for sub-pixel rounding.
        .filter(
          (r) =>
            r.size < 14 &&
            r.text &&
            !(r.transform === 'uppercase' && Math.abs(r.size - microPx) <= 0.5)
        )
      return { total: all.length, small, micro: microPx }
    })
    // Guard the exemption's own input: if --ds-text-micro ever fails to
    // resolve, `microPx` is NaN, every comparison against it is false, and
    // the filter silently becomes "no uppercase exemption at all" -- which
    // fails loudly rather than passing, but for a reason that would look
    // like a dozen unrelated type regressions. Naming it here is cheaper.
    expect(micro).toBeGreaterThan(0)
    // A selector that matches nothing yields an empty result and the
    // assertion below passes for the wrong reason -- this is the exact
    // failure mode that let the original #reviewWorkspace-only scope stay
    // unnoticed. Asserting the scan actually walked real chrome markup
    // before trusting an empty violation list is what closes that hole.
    expect(total).toBeGreaterThan(50)
    expect(small).toEqual([])
  })
})

test.describe('chrome spacing scale', () => {
  test('resolves every step onto an SFDS value', async ({ page }) => {
    await page.setViewportSize({ width: 1800, height: 1000 })
    await gotoFresh(page)
    const steps = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement)
      return [1, 2, 3, 4, 5, 6, 7, 8].map((n) => s.getPropertyValue(`--ds-space-${n}`).trim())
    })
    // Same minifier caveat as the type scale above, and it bites harder here:
    // the first three steps are fraction-only, so the built CSS serializes
    // them as `.25rem`/`.5rem`/`.75rem` rather than the `0.25rem` form
    // css/theme.css authors. Confirmed against dist/assets/*.css, not
    // inferred. Steps 5-8 are where the two ladders genuinely diverge —
    // the repo's 24/32/48/64px become SFDS's 20/28/40/60px — so those four
    // are a real value change and not a reformatting.
    expect(steps).toEqual([
      '.25rem',
      '.5rem',
      '.75rem',
      '1rem',
      '1.25rem',
      '1.75rem',
      '2.5rem',
      '3.75rem',
    ])
  })
})
