const { test, expect } = require('@playwright/test')
const { gotoFresh } = require('./helpers')

// The DOMPurify allowlist in js/core/utils.js's safeMarkdown(), asserted in a
// REAL browser. This is the only place the <strong>/<em> positive assertions
// can live.
//
// WHY NOT ENTIRELY IN THE UNIT SUITE. tests/utils.test.js covers image
// stripping, both link renderers, script removal, and repeated parse/sanitize
// calls by importing real marked and DOMPurify into window in a beforeAll.
// That leaves one gap: happy-dom strips <strong> and <em> even though both are
// in ALLOWED_TAGS, while <a>, <button> and <span> survive —
//
//   DOMPurify.sanitize('<strong>b</strong>', { ALLOWED_TAGS: ['strong'] })
//     -> 'b'                  (happy-dom)
//     -> '<strong>b</strong>' (Chromium)
//
// so a unit assertion on those two tags would either pin the happy-dom artifact
// or pass vacuously. A vacuous pass is the dangerous half: a test asserting
// "no <script> in the output" succeeds trivially against a sanitizer that strips
// EVERYTHING, and would keep succeeding if the allowlist were later widened to
// admit <img>. tests/utils.test.js carries a test.todo recording the same
// measurement.
//
// WHY THIS MATTERS RATHER THAN BEING TIDINESS. safeMarkdown deliberately passes
// an explicit ALLOWED_TAGS rather than using DOMPurify's default, and the
// 18-line comment above that call explains the cost of widening it: the default
// permits <img>, marked.parseInline emits one for `![alt](url)`, and
// findExternalAssetUrls() in build_scripts/data-checks.js inspects `image.src`
// only — so a remote image written into any paragraph, bullet, table cell or
// callout loads off-origin from inside page copy and validation never sees it.
// That reasoning was guarded by a comment and nothing else.

test.describe('safeMarkdown sanitizer allowlist (real browser)', () => {
  /**
   * Run safeMarkdown in the page and return its output.
   * @param {import('@playwright/test').Page} page
   * @param {string} input
   * @returns {Promise<string>}
   */
  const render = (page, input) =>
    page.evaluate((markdown) => window.utils.safeMarkdown(markdown), input)

  test.beforeEach(async ({ page }) => {
    await gotoFresh(page)
  })

  // The specific hazard the explicit allowlist exists to prevent.
  test('strips an image, which DOMPurify’s default allowlist would permit', async ({ page }) => {
    const html = await render(page, '![alt](https://evil.test/tracker.png)')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('evil.test')
  })

  test('strips script and event-handler attributes', async ({ page }) => {
    expect(await render(page, '<script>alert(1)</script>ok')).not.toContain('<script')
    // onerror on an <img> — the whole element is stripped, so also verify that
    // an event-handler attribute on an ALLOWED element (e.g. <span>) is removed
    // even when the element itself is retained.
    const onerror = await render(page, '<img src=x onerror="alert(1)">')
    expect(onerror).not.toContain('onerror')
    expect(onerror).not.toContain('<img')
    const onclick = await render(page, '<span onclick="alert(1)">text</span>')
    expect(onclick).not.toContain('onclick')
    expect(onclick).toContain('<span')
  })

  // Block-level elements DOMPurify's default admits and this renderer has never
  // produced from inline markdown. Asserting their absence is what stops the
  // allowlist being widened without a decision.
  test('strips block elements the mockup renderer never emits', async ({ page }) => {
    const html = await render(
      page,
      '<h1>Heading</h1># Heading\n\n<div>x</div><table><tr><td>y</td></tr></table>'
    )
    for (const tag of ['<h1', '<div', '<table', '<tr', '<td']) {
      expect(html, `${tag} must not survive`).not.toContain(tag)
    }
  })

  // The positive half. Without this the suite would pass against a sanitizer
  // that stripped everything — which is precisely how happy-dom behaves, and
  // precisely why this file is an e2e spec.
  test('keeps the tags safeMarkdown is supposed to emit', async ({ page }) => {
    expect(await render(page, '**bold**')).toContain('<strong>bold</strong>')
    expect(await render(page, '_em_')).toContain('<em>em</em>')
    expect(await render(page, '`code`')).toContain('<code>code</code>')
  })

  test('renders an external link as a new-tab anchor, attributes intact', async ({ page }) => {
    const html = await render(page, '[guide](https://sf.gov/guide)')
    expect(html).toContain('href="https://sf.gov/guide"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('class="inline-link"')
  })

  test('renders an internal page target as a render button', async ({ page }) => {
    const html = await render(page, '[rodents](rodentsTopic)')
    expect(html).toContain('data-render-target="rodentsTopic"')
    expect(html).toContain('<button')
  })

  // formatMarkdown's inline links gate on /^https?:\/\// rather than safeUrl,
  // so a javascript: target falls through to the render-button branch. It must
  // not become a navigable href either way.
  test('never emits a javascript: URL', async ({ page }) => {
    const html = await render(page, '[x](javascript:alert(1))')
    expect(html).not.toContain('href="javascript:')
  })

  // The end of the chain: real page copy, sanitized, in the DOM. pages/
  // about-hhvc-team.js writes **bold** into its bullets, so this proves the
  // path works on shipped content and not only on strings this spec invents.
  test('renders real page copy through the sanitizer into the DOM', async ({ page }) => {
    await page.evaluate(() => window.renderPage('aboutHhvcTeam'))
    const mock = page.locator('#mockPage')
    await expect(
      mock.locator('strong', { hasText: 'Environmental Health Inspectors' })
    ).toHaveCount(1)
    // No body-copy markdown anywhere in the corpus may produce an image.
    expect(await mock.locator('img').count()).toBe(0)
  })
})
