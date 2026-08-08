// End-to-end coverage for the selection-driven AI rewrite.
//
// This is the ONLY layer that proves the feature actually works: the
// orchestrator (js/ai-rewrite.js) and the view (js/ai-rewrite-render.js) are
// browser-only IIFEs with no module.exports, so nothing beneath this can
// unit-test them. Everything below drives the real UI — a real DOM selection,
// the real floating button, the real popover — against a stubbed /api/ai/*, so
// no API key is needed and CI never makes a paid call.
import { test, expect } from '@playwright/test'
import { gotoFresh } from './helpers.js'

const REWRITTEN = 'Report the problem to us.'

/** Capabilities advertising both tasks, so the rewrite affordance mounts. */
function capabilitiesBody(tasks = ['content', 'rewrite-field']) {
  return {
    providers: { claude: true },
    models: { claude: 'stub-model' },
    providerLabels: { claude: 'Claude' },
    defaultProvider: 'claude',
    tasks,
    groundedBy: ['writing-and-style.md'],
    pageCount: 20,
    disclosureRequired: true,
  }
}

/** The server envelope generateRewrite returns, as the client expects it. */
function generateBody(overrides = {}) {
  return {
    task: 'rewrite-field',
    provider: 'claude',
    model: 'stub-model',
    attempts: 1,
    valid: true,
    issues: [],
    result: { rewrittenText: REWRITTEN },
    usage: {},
    usageByAttempt: [],
    groundedBy: [],
    disclosure: 'AI-assisted draft. Not reviewed, not approved.',
    ...overrides,
  }
}

async function stubAi(page, { tasks, generate } = {}) {
  await page.route('**/api/ai/capabilities', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(capabilitiesBody(tasks)),
    })
  )
  await page.route('**/api/ai/generate', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(generate || generateBody()),
    })
  )
}

/**
 * Point the AI client at this origin, then reload so the orchestrator's
 * one-shot capability check runs against the stub. It reads capabilities at
 * init, so configuring after load would leave the button gated off.
 */
async function configureAi(page) {
  await page.evaluate(() => {
    localStorage.setItem(
      'hhvcAiConfig',
      JSON.stringify({ apiUrl: window.location.origin, apiToken: 'stub-token' })
    )
  })
  await page.reload()
  await page.waitForSelector('#mockPage h1')
  await page.waitForFunction(() => Boolean(window.aiRewrite))
}

/**
 * Select the whole text of the first rewritable field and return its path.
 *
 * Dispatches `selectionchange` explicitly rather than trusting the implicit
 * one: the orchestrator debounces, so every caller waits on the button's
 * visibility instead of assuming event ordering.
 */
async function selectFirstField(page) {
  return page.evaluate(() => {
    const field = document.querySelector('#mockPage [data-rewrite-field]')
    const range = document.createRange()
    range.selectNodeContents(field)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
    return field.getAttribute('data-rewrite-field')
  })
}

/** Read a field's current text out of the in-memory page data. */
function readField(page, fieldPath) {
  return page.evaluate((path) => {
    const key = window.utils.getCurrentKey()
    const value = window.utils.getByPath(window.HHVC_DATA.pages[key], path)
    return typeof value === 'string' ? value : value?.text
  }, fieldPath)
}

test.describe('AI rewrite', () => {
  test('offers no rewrite button when the AI backend is unconfigured', async ({ page }) => {
    await gotoFresh(page)
    await selectFirstField(page)
    // `toBeHidden()` also passes the instant the button doesn't exist in the
    // DOM yet, which is true at t=0 regardless of outcome — the button is
    // created lazily and `handleSelection` is debounced 150ms. Waiting past
    // that window first means this actually confirms the debounced handler
    // ran and chose not to show it, not just that nothing has happened yet.
    await page.waitForTimeout(250)
    // A static deploy has no /api/ai/* runtime at all. An affordance that
    // always fails is worse than no affordance.
    await expect(page.locator('#aiRewriteButton')).toBeHidden()
  })

  test('offers no rewrite button when the server does not advertise the task', async ({ page }) => {
    await stubAi(page, { tasks: ['content'] })
    await gotoFresh(page)
    await configureAi(page)
    await selectFirstField(page)
    // See the sibling test above: wait past the 150ms selection debounce so
    // this asserts the handler ran and stayed hidden, not that it hasn't
    // fired yet.
    await page.waitForTimeout(250)
    await expect(page.locator('#aiRewriteButton')).toBeHidden()
  })

  test('rewrites the selected field and flags the applied copy unverified', async ({ page }) => {
    await stubAi(page)
    await gotoFresh(page)
    await configureAi(page)

    const path = await selectFirstField(page)
    await expect(page.locator('#aiRewriteButton')).toBeVisible()

    await page.click('#aiRewriteButton')
    // The popover shows the WHOLE field, which is what Apply will replace —
    // not merely the highlighted substring.
    await expect(page.locator('.ai-rewrite-field-text')).not.toBeEmpty()

    await page.click('#aiRewriteRun')
    await expect(page.locator('.ai-rewrite-suggestion')).toHaveText(REWRITTEN)

    await page.click('#aiRewriteApply')
    await expect(page.locator('#mockPage')).toContainText(REWRITTEN)
    await expect(page.locator('#mockPage .unverified-pill').first()).toBeVisible()

    // The in-memory page data carries the flag, not just the rendered pill —
    // that flag is what distinguishes AI-touched copy from human-authored copy.
    const applied = await page.evaluate((fieldPath) => {
      const key = window.utils.getCurrentKey()
      return window.utils.getByPath(window.HHVC_DATA.pages[key], fieldPath)
    }, path)
    expect(applied.text).toBe(REWRITTEN)
    expect(applied.unverified).toBe(true)
  })

  test('undo restores the original copy', async ({ page }) => {
    await stubAi(page)
    await gotoFresh(page)
    await configureAi(page)

    const path = await selectFirstField(page)
    const before = await readField(page, path)

    await page.click('#aiRewriteButton')
    await page.click('#aiRewriteRun')
    await page.click('#aiRewriteApply')
    await expect(page.locator('#mockPage')).toContainText(REWRITTEN)

    await page.click('#aiRewriteUndo')
    expect(await readField(page, path)).toBe(before)
    await expect(page.locator('#mockPage')).not.toContainText(REWRITTEN)
  })

  test('discard leaves the mockup copy untouched', async ({ page }) => {
    await stubAi(page)
    await gotoFresh(page)
    await configureAi(page)

    await selectFirstField(page)
    await page.click('#aiRewriteButton')
    const before = await page.locator('#mockPage').innerText()

    await page.click('#aiRewriteRun')
    await expect(page.locator('.ai-rewrite-suggestion')).toHaveText(REWRITTEN)
    await page.click('#aiRewriteDiscard')

    await expect(page.locator('#aiRewritePopover')).toBeHidden()
    expect(await page.locator('#mockPage').innerText()).toBe(before)
  })

  test('surfaces a validation issue instead of hiding the suggestion', async ({ page }) => {
    // A rewrite that dropped a link is still shown — the reviewer can see what
    // is wrong and decide. Hiding it would leave them with no explanation.
    await stubAi(page, {
      generate: generateBody({
        valid: false,
        issues: ['The link target "pestsTopic" was dropped. Keep every [label](target) link.'],
      }),
    })
    await gotoFresh(page)
    await configureAi(page)

    await selectFirstField(page)
    await page.click('#aiRewriteButton')
    await page.click('#aiRewriteRun')

    await expect(page.locator('.ai-rewrite-suggestion')).toHaveText(REWRITTEN)
    await expect(page.locator('.ai-rewrite-error')).toContainText('pestsTopic')
  })
})
