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
    const small = await page.evaluate(() => {
      const panel = document.querySelector('#reviewWorkspace')
      if (!panel) return []
      return [...panel.querySelectorAll('*')]
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
        .filter((r) => r.size < 14 && r.transform !== 'uppercase' && r.text)
    })
    expect(small).toEqual([])
  })
})
