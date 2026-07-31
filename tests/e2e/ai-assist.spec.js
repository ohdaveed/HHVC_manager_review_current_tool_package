const { test, expect } = require('@playwright/test')
const {
  gotoFresh,
  openWorkspaceTab,
  focusMockPage,
  recordToasts,
  readRecordedToasts,
} = require('./helpers')

// The AI assist panel, driven through the real UI.
//
// The server is never contacted: every /api/ai/* call is intercepted with
// page.route and fulfilled locally. That keeps the suite hermetic (no key, no
// paid call, no network) while still exercising the actual client, the actual
// rendering, and the actual page-preview path — which is the part worth
// testing, since it renders content nobody in this repo wrote.

const AI_ORIGIN = 'https://ai.example.test'

/** A draft that passes every check, as the server would report it. */
const VALID_RESULT = {
  task: 'content',
  provider: 'claude',
  model: 'claude-opus-5',
  attempts: 1,
  valid: true,
  issues: [],
  disclosure: 'AI-assisted draft. Not reviewed, not approved, and not publishable as-is.',
  result: {
    slug: 'sf.gov/report-a-pest-problem',
    type: 'Information',
    title: 'Report a pest problem',
    summary: 'Tell us about pests in your home. We will send an inspector.',
    audience: ['A tenant who sees pests at home'],
    reading: 'Grade 6',
    sections: [
      {
        heading: 'What to do',
        karl: 'what_to_do StreamField.',
        paragraphs: ['Call 311 to report the problem.'],
      },
    ],
  },
}

/** Intercept the AI API. `overrides` sets the response per route. */
async function stubAiApi(page, { capabilities, generate, generateStatus } = {}) {
  await page.route(`${AI_ORIGIN}/api/ai/capabilities`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        capabilities || {
          providers: { claude: true },
          models: { claude: 'claude-opus-5' },
          tasks: ['content'],
          groundedBy: ['writing-and-style.md'],
          pageCount: 19,
          disclosureRequired: true,
        }
      ),
    })
  )
  await page.route(`${AI_ORIGIN}/api/ai/generate`, (route) =>
    route.fulfill({
      status: generateStatus || 200,
      contentType: 'application/json',
      body: JSON.stringify(generate || VALID_RESULT),
    })
  )
}

/** Fill in and save the AI server settings through the real form. */
async function configure(page) {
  await page.fill('#aiAssistApiUrl', AI_ORIGIN)
  await page.fill('#aiAssistApiToken', 'test-token')
  await page.click('#aiAssistSaveSettings')
  await expect(page.locator('#aiAssistPrompt')).toBeEnabled()
}

test.describe('AI assist panel', () => {
  test('mounts lazily when its tab is first opened', async ({ page }) => {
    await gotoFresh(page)
    await expect(page.locator('#aiAssistPanel')).toHaveCount(0)

    await openWorkspaceTab(page, 'assist')

    await expect(page.locator('#aiAssistPanel')).toBeVisible()
  })

  test('explains what to configure when no server is set', async ({ page }) => {
    await gotoFresh(page)
    await openWorkspaceTab(page, 'assist')

    await expect(page.locator('#aiAssistPanel')).toContainText('Enter a server URL and token')
    // The form must be inert until it can actually do something.
    await expect(page.locator('#aiAssistPrompt')).toBeDisabled()
    await expect(page.locator('#aiAssistGenerate')).toBeDisabled()
  })

  test('distinguishes a server with no model key from no server at all', async ({ page }) => {
    await stubAiApi(page, {
      capabilities: { providers: { claude: false }, tasks: ['content'], groundedBy: [] },
    })
    await gotoFresh(page)
    await openWorkspaceTab(page, 'assist')
    await page.fill('#aiAssistApiUrl', AI_ORIGIN)
    await page.fill('#aiAssistApiToken', 'test-token')
    await page.click('#aiAssistSaveSettings')

    await expect(page.locator('#aiAssistPanel')).toContainText('ANTHROPIC_API_KEY')
    await expect(page.locator('#aiAssistGenerate')).toBeDisabled()
  })

  test('enables the form once the server reports a configured provider', async ({ page }) => {
    await stubAiApi(page)
    await gotoFresh(page)
    await openWorkspaceTab(page, 'assist')
    await configure(page)

    await expect(page.locator('#aiAssistGenerate')).toBeEnabled()
  })

  test('refuses to send an empty prompt', async ({ page }) => {
    await stubAiApi(page)
    await gotoFresh(page)
    await openWorkspaceTab(page, 'assist')
    await configure(page)

    await page.click('#aiAssistGenerate')

    await expect(page.locator('.ai-assist-error')).toContainText('Describe what the draft')
  })

  test('renders a draft, its disclosure, and a preview', async ({ page }) => {
    await stubAiApi(page)
    await gotoFresh(page)
    await openWorkspaceTab(page, 'assist')
    await configure(page)

    await page.fill('#aiAssistPrompt', 'Draft a pest reporting page.')
    await page.click('#aiAssistGenerate')

    // SF.gov's AI guidelines require disclosure; it must be on screen, not
    // just in the payload.
    await expect(page.locator('.ai-assist-disclosure')).toContainText('AI-assisted draft')
    await expect(page.locator('.ai-assist-verdict.pass')).toBeVisible()
    // The preview is rendered by the real page renderer.
    await expect(page.locator('.ai-assist-preview h1')).toHaveText('Report a pest problem')
  })

  test('shows every validation issue when a draft would fail CI', async ({ page }) => {
    await stubAiApi(page, {
      generate: {
        ...VALID_RESULT,
        valid: false,
        attempts: 2,
        issues: [
          'sections[0].paragraphs has 3 items. Lists of 3 or more must use bullets.',
          'No "shall": 1 use(s) of "shall"',
        ],
      },
    })
    await gotoFresh(page)
    await openWorkspaceTab(page, 'assist')
    await configure(page)
    await page.fill('#aiAssistPrompt', 'Draft a page.')
    await page.click('#aiAssistGenerate')

    await expect(page.locator('.ai-assist-verdict.fail')).toContainText('2 issue(s)')
    await expect(page.locator('.ai-assist-verdict.fail li')).toHaveCount(2)
    // The draft still renders: a reviewer needs to see what was wrong with it.
    await expect(page.locator('.ai-assist-preview h1')).toBeVisible()
  })

  test('surfaces a server error instead of failing silently', async ({ page }) => {
    await stubAiApi(page, {
      generateStatus: 422,
      generate: { error: 'The model declined this request.', category: 'cyber' },
    })
    await gotoFresh(page)
    await openWorkspaceTab(page, 'assist')
    await configure(page)
    await page.fill('#aiAssistPrompt', 'Something declined.')
    await page.click('#aiAssistGenerate')

    await expect(page.locator('.ai-assist-error')).toContainText('declined')
  })

  test('never writes the API token into the review state blob', async ({ page }) => {
    await stubAiApi(page)
    await gotoFresh(page)
    await openWorkspaceTab(page, 'assist')
    await configure(page)

    // The review-state blob round-trips through the shareable CSV/JSON export
    // paths, so a token reaching it would leak through a file people email.
    const reviewState = await page.evaluate(() =>
      window.localStorage.getItem('hhvcManagerReviewState:v1')
    )
    expect(reviewState || '').not.toContain('test-token')

    const aiConfig = await page.evaluate(() => window.localStorage.getItem('hhvcAiConfig'))
    expect(aiConfig).toContain('test-token')
  })

  test('leaves the mockup and its page data untouched by a draft', async ({ page }) => {
    await stubAiApi(page)
    await gotoFresh(page)
    const titleBefore = await page.locator('#mockPage h1').textContent()

    await openWorkspaceTab(page, 'assist')
    await configure(page)
    await page.fill('#aiAssistPrompt', 'Draft a page.')
    await page.click('#aiAssistGenerate')
    await expect(page.locator('.ai-assist-preview h1')).toBeVisible()

    // The draft must not enter the page universe: no new key, no reordering,
    // no change to what the mockup is showing.
    await expect(page.locator('#mockPage h1')).toHaveText(titleBefore)
    const pageCount = await page.evaluate(() => window.HHVC_DATA.order.length)
    expect(pageCount).toBe(19)
    const hasGenerated = await page.evaluate(() =>
      Object.keys(window.HHVC_DATA.pages).includes('reportAPestProblem')
    )
    expect(hasGenerated).toBe(false)
  })

  // Regression: the AI-assist toast helper must actually reach showToast.
  //
  // js/ai-assist.js guards with `typeof showToast === 'function'` against a
  // BARE identifier rather than window.showToast. A review flagged that as
  // dead under ES modules, which would silently swallow every AI-assist
  // toast — settings saved, generation failed, draft downloaded. Nothing
  // covered it either way, so this asserts the user-visible outcome rather
  // than the mechanism: save settings, expect the confirmation toast.
  test('saving AI settings shows a confirmation toast', async ({ page }) => {
    await recordToasts(page)
    await gotoFresh(page)
    await openWorkspaceTab(page, 'assist')

    await page.fill('#aiAssistApiUrl', 'https://example.test')
    await page.fill('#aiAssistApiToken', 'a-test-token')
    await page.click('#aiAssistSaveSettings')

    // Filtered by text rather than asserting on a bare `.toast`. Opening the
    // workspace raises its own "Review workspace opened" toast, and toasts live
    // for 4s, so whether the two overlap is a matter of how fast the machine
    // is: locally the first had expired by now, in CI it had not and the bare
    // locator hit a strict-mode violation against two elements. Naming the one
    // under test makes the assertion independent of that timing.
    await expect(page.locator('.toast').filter({ hasText: /AI settings saved/i })).toBeVisible()
    expect(await readRecordedToasts(page)).toMatch(/AI settings saved/i)
  })

  test('opens from the keyboard shortcut', async ({ page }) => {
    await gotoFresh(page)
    // Shortcuts only fire when focus is in a shortcut context; without this
    // the test races the first-run onboarding for focus. See focusMockPage.
    await focusMockPage(page)
    await page.keyboard.press('4')

    await expect(page.locator('[data-workspace-panel="assist"]')).toBeVisible()
    await expect(page.locator('#aiAssistPanel')).toBeVisible()
  })
})
