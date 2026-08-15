import { test, expect } from '@playwright/test'
import { gotoFresh } from './helpers.js'

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
    const { total, small } = await page.evaluate(() => {
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
      const root = document.querySelector('.app')
      const all = root
        ? [...root.querySelectorAll('*')].filter((el) => !el.closest('.browser-shell'))
        : []
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
        .filter((r) => r.size < 14 && r.transform !== 'uppercase' && r.text)
      return { total: all.length, small }
    })
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
