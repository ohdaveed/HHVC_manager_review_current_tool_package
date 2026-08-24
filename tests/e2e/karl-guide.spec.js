// The Karl guide panel's field metadata, driven in a real browser.
//
// The unit tests in tests/karl-guide.test.js assert the markup string. What they
// cannot assert is that a REAL page produces a field reference at all — the
// chain runs page type -> role -> ROLE_ALIASES -> ROLE_PANELS -> the karl-blocks
// inventory, and a break anywhere in it renders a panel that is merely emptier,
// with nothing thrown and no assertion failed. Nor can a string assertion prove
// the panel stays inside the ancestor it is positioned against, or that the
// tag-visibility toggle actually hides it — those are layout and DOM-state
// facts a unit test over happy-dom markup cannot observe.
//
// payFee is a Transaction page with five steps. A step tag carries
// `context: { role: 'what-to-do' }`, which aliases to `content`, which
// resolves to `section_specifics`.
const { test, expect } = require('@playwright/test')
const { gotoFresh, selectPage } = require('./helpers')

test.describe('Karl guide field metadata', () => {
  test('a step tag names the raw Wagtail field it lands in', async ({ page }) => {
    await gotoFresh(page)
    await selectPage(page, 'payFee')
    // `js/mockup/page-render.js` emits exactly one `<li class="step">` per step,
    // and the step's own `karl` note (via `karlTag(s.karl, ...)`) is the FIRST
    // `.karl-guide` inside it — a step's optional button link, if present,
    // would render a second one further down the same `<li>`. `.first()` here
    // is a structural guarantee, not a coincidence of page content.
    const guide = page.locator('li.step .karl-guide').first()
    await guide.locator('.karl-guide-trigger').click()
    const panel = guide.locator('.karl-guide-panel')
    await expect(panel).toBeVisible()
    await expect(panel.locator('.karl-guide-path')).toContainText('Section specifics')
    await expect(panel.locator('.karl-guide-field code')).toHaveText('section_specifics')
    await expect(panel.locator('.karl-guide-field-label')).toHaveText('Section specifics')
  })

  test('the rules row reports the field map wording rather than a guess', async ({ page }) => {
    await gotoFresh(page)
    await selectPage(page, 'payFee')
    const guide = page.locator('li.step .karl-guide').first()
    await guide.locator('.karl-guide-trigger').click()
    const rules = guide.locator('.karl-guide-rules')
    await expect(rules).toContainText('not recorded')
    // `not recorded` and `Optional` are different claims about the field map —
    // see fieldMetaFor()'s header comment. A regression that quietly upgrades
    // one into the other reads as an improvement and is exactly what this
    // guards against.
    await expect(rules).not.toContainText('Optional')
    await expect(rules).toContainText('repeatable')
    await expect(rules).toContainText('chooser')
  })

  // A step's own tag is never a button link (its karl note documents the step
  // section itself, not a destination), so its panel must carry no Guidance
  // row at all — not an empty one, none.
  test('a step tag carries no Guidance row', async ({ page }) => {
    await gotoFresh(page)
    await selectPage(page, 'payFee')
    const guide = page.locator('li.step .karl-guide').first()
    await guide.locator('.karl-guide-trigger').click()
    const panel = guide.locator('.karl-guide-panel')
    await expect(panel).toBeVisible()
    await expect(panel.locator('.karl-guide-guidance')).toHaveCount(0)
  })

  // The panel is absolutely positioned against `.karl-guide`. A block-level tag
  // inside it closes an enclosing paragraph, and the panel then anchors to some
  // other element — which does not throw and does not fail a string assertion.
  // Measuring containment in the live layout is the only check that sees it.
  test('the open panel stays inside the guide it belongs to', async ({ page }) => {
    await gotoFresh(page)
    await selectPage(page, 'payFee')
    const guide = page.locator('li.step .karl-guide').first()
    await guide.locator('.karl-guide-trigger').click()
    const contained = await guide.evaluate((el) => {
      const panel = el.querySelector('.karl-guide-panel')
      return Boolean(panel) && el.contains(panel)
    })
    expect(contained).toBe(true)
  })

  test('hiding Karl tags hides the guide with them', async ({ page }) => {
    await gotoFresh(page)
    await selectPage(page, 'payFee')
    // `#tagToggle` ships unchecked and the mockup ships annotated regardless
    // (see js/core/app.js's comment on this: applying `hide-karl-tags` at load
    // would hide every Unverified pill on first paint too). The hiding class is
    // only synced on the checkbox's `change` event, and that event carries the
    // checkbox's OWN checked state — unchecked means hide. The native input is
    // visually replaced by `.karl-slider` (zero-size, not "visible" to
    // Playwright's actionability check — `tests/e2e/review-workflow.spec.js`'s
    // own tag-toggle test drives it the same way), so click the wrapping
    // `.karl-switch` label rather than `.check()`/`.uncheck()` on the input
    // directly. Reaching "hidden" from the unchecked default means toggling
    // through checked first: the first click flips it to checked (no `change`
    // effect on the class, since it was already absent), and the second click
    // flips it back to unchecked, which is what actually applies the class.
    const tagSwitch = page.locator('.karl-switch')
    await tagSwitch.click()
    await expect(page.locator('#tagToggle')).toBeChecked()
    await tagSwitch.click()
    await expect(page.locator('#tagToggle')).not.toBeChecked()
    await expect(page.locator('body')).toHaveClass(/hide-karl-tags/)
    await expect(page.locator('.karl-guide').first()).toBeHidden()
  })
})
