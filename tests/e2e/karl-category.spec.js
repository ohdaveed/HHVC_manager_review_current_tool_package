/*
 * Karl tag categories, proven in a real browser.
 *
 * The unit tests assert that `karlTag()` emits `data-category` and that
 * css/ux-improvements.css declares six colour blocks. Neither can tell you
 * whether the six actually LOOK different on a rendered page: the tokens
 * resolve through three cascading scopes, `.browser-shell` re-pins the light
 * palette inside the mockup so a reviewer on a dark machine still sees a light
 * public page, and the per-category rules only win because of an `!important`
 * flag and a specificity count. Every one of those is a runtime fact, so this
 * reads `getComputedStyle` rather than the stylesheet.
 *
 * Both colour schemes are exercised. Dark is not a formality here — the tag
 * colour system has one rule that fires ONLY in dark mode and only outside the
 * shell (the legend swatch foreground), and the whole family this branch added
 * had to be declared in three scopes to survive it.
 */
const { test, expect } = require('@playwright/test')
const { gotoFresh, selectPage, openWorkspaceTab, expectNoSeriousViolations } = require('./helpers')

/** The four kinds `karlTag()` accepts. A category may never replace one. */
const KINDS = ['meta', 'body', 'placement', 'editor']

/**
 * Show the Karl annotations. `#tagToggle` is a visually hidden checkbox, so it
 * is driven through its `.karl-switch` label rather than `.check()`.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
async function showKarlTags(page) {
  if (!(await page.locator('#tagToggle').isChecked())) {
    await page.locator('.karl-switch').click()
  }
  await expect(page.locator('#tagToggle')).toBeChecked()
}

/**
 * Every rendered tag's category, kind, computed fill and printed kind word.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<Array<{category: string, kind: string, fill: string, word: string}>>}
 */
function readTags(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('.karl-tag')].map((el) => ({
      category: el.getAttribute('data-category'),
      kind: el.getAttribute('data-kind'),
      fill: getComputedStyle(el).backgroundColor,
      word: el.querySelector('.karl-tag-kind')?.textContent?.trim() ?? '',
    }))
  )
}

for (const scheme of ['light', 'dark']) {
  test.describe(`Karl tag categories in ${scheme} mode`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme })
      await gotoFresh(page)
      await selectPage(page, 'payFee')
      await showKarlTags(page)
    })

    test('every tag carries both axes, and the kind is still one of the four', async ({ page }) => {
      const tags = await readTags(page)
      expect(tags.length).toBeGreaterThan(0)
      for (const tag of tags) {
        expect(KINDS).toContain(tag.kind)
        expect(tag.category).toBeTruthy()
      }
    })

    test('tags of different categories are drawn in different fills', async ({ page }) => {
      // The point of the whole subsystem: two categories on one page must be
      // visibly distinct. Read from the browser, because the distinction is
      // produced by the cascade rather than by any one declaration.
      const byCategory = new Map()
      for (const tag of await readTags(page)) byCategory.set(tag.category, tag.fill)
      expect(byCategory.size).toBeGreaterThan(1)
      const fills = [...byCategory.values()]
      expect(new Set(fills).size).toBe(fills.length)
    })

    test('every tag still names its kind in words', async ({ page }) => {
      // Colour is never the only encoding. This is what makes that true, and
      // it is why moving colour onto the category costs nothing in
      // accessibility terms.
      for (const tag of await readTags(page)) {
        expect(tag.word.length).toBeGreaterThan(0)
      }
    })

    test('the Help-tab legend decodes categories and passes the axe check', async ({ page }) => {
      // The legend renders real .karl-tag markup OUTSIDE .browser-shell, so
      // unlike every tag on the mockup its tokens resolve to the dark palette
      // in dark mode. That is the one place the dark-only foreground override
      // fires, and the only way to check it is to scan it here.
      await openWorkspaceTab(page, 'help')
      const legend = page.locator('.karl-tag-legend--full')
      await expect(legend).toBeVisible()
      const swatches = await legend.locator('.karl-tag-legend-swatch').count()
      expect(swatches).toBe(6)
      await expectNoSeriousViolations(page)
    })

    // The mockup test above can only compare the categories a given page
    // happens to render — payFee produces several, not all six — so a missing
    // selector or a duplicated fill in one of the unused families would pass
    // it. The legend is the one place all six are on screen at once, in both
    // modes, and its swatches carry the same `data-category` the tags do, so
    // reading their computed fills here closes that gap. The unit tests in
    // tests/theme-contrast.test.js measure the same six families at the TOKEN
    // level; this measures what the cascade actually produced.
    test('all six category swatches are drawn in six different fills', async ({ page }) => {
      await openWorkspaceTab(page, 'help')
      const fills = await page.$$eval('.karl-tag-legend--full .karl-tag-legend-swatch', (nodes) =>
        nodes.map((el) => ({
          category: el.getAttribute('data-category'),
          fill: getComputedStyle(el).backgroundColor,
        }))
      )
      expect(fills.length).toBe(6)
      expect(new Set(fills.map((f) => f.category)).size).toBe(6)
      expect(new Set(fills.map((f) => f.fill)).size).toBe(6)
    })
  })
}
