const { test, expect } = require('@playwright/test')
const { gotoFresh, openWorkspaceTab } = require('./helpers')

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

  test('preview links do not navigate the real mockup', async ({ page }) => {
    // renderPageMain emits the same data-render-target buttons the live page
    // uses, and the click handler in js/page-render.js is bound to `document` —
    // so without neutralizing them, clicking a link inside a DRAFT would move
    // the reviewer off the page they were reviewing.
    await stubAiApi(page, {
      generate: {
        ...VALID_RESULT,
        result: {
          ...VALID_RESULT.result,
          sections: [
            {
              heading: 'Related pages',
              karl: 'Related section.',
              cards: [{ title: 'Report rats and mice', target: 'rodentsReport', karl: 'Card.' }],
            },
          ],
        },
      },
    })
    await gotoFresh(page)
    const keyBefore = await page.locator('#pageSelect').inputValue()

    await openWorkspaceTab(page, 'assist')
    await configure(page)
    await page.fill('#aiAssistPrompt', 'Draft a page with a related link.')
    await page.click('#aiAssistGenerate')
    await expect(page.locator('.ai-assist-preview')).toBeVisible()

    const previewLink = page.locator('.ai-assist-preview [data-render-inert]').first()
    await expect(previewLink).toBeVisible()
    // The live target attribute must be gone, not merely ignored.
    await expect(page.locator('.ai-assist-preview [data-render-target]')).toHaveCount(0)

    // Dispatched rather than clicked: the button also carries aria-disabled,
    // so a normal click never reaches it. This asserts the stronger property —
    // that even a click which does get through leaves the mockup alone,
    // because the document-level handler has no target to navigate to.
    await previewLink.dispatchEvent('click')
    await expect(page.locator('#pageSelect')).toHaveValue(keyBefore)
  })

  test('keeps the prompt when a generation fails', async ({ page }) => {
    await stubAiApi(page, {
      generateStatus: 500,
      generate: { error: 'Something broke upstream.' },
    })
    await gotoFresh(page)
    await openWorkspaceTab(page, 'assist')
    await configure(page)

    const prompt = 'Draft an Information page about bed bug reporting.'
    await page.fill('#aiAssistPrompt', prompt)
    await page.click('#aiAssistGenerate')

    await expect(page.locator('.ai-assist-error')).toBeVisible()
    // The panel re-renders on every state change, which replaces the textarea.
    // Losing the request on a failure would make the reviewer retype it to
    // retry — worst exactly when retrying is what they want to do.
    await expect(page.locator('#aiAssistPrompt')).toHaveValue(prompt)
  })

  test('keeps prompt text typed while the capability request is in flight', async ({ page }) => {
    // Saving settings kicks off a capability GET and re-renders when it
    // resolves. A reviewer can easily type through that round trip, and the
    // re-render replaces the textarea from panel state — so state has to be
    // re-read immediately before rendering, not just when Save was clicked.
    await stubAiApi(page)
    await gotoFresh(page)
    await openWorkspaceTab(page, 'assist')
    // Configure FIRST so the prompt field is already enabled. Otherwise
    // page.fill blocks until the field enables — which only happens after the
    // very re-render this test is about, so the race never occurs.
    await configure(page)

    // Now make the next capabilities call slow, leaving a window to type in.
    await page.route(`${AI_ORIGIN}/api/ai/capabilities`, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          providers: { claude: true },
          models: { claude: 'claude-opus-5' },
          tasks: ['content'],
          groundedBy: [],
          pageCount: 19,
        }),
      })
    })

    // The settings <details> collapses once configured, so re-open it before
    // reaching the Save button.
    await page.click('.ai-assist-settings summary')

    // Synchronize on the response rather than a fixed wait. A timeout that
    // expires before the re-render would let the assertion pass without the
    // behaviour under test ever happening — the test would look green and
    // guard nothing.
    const capabilities = page.waitForResponse((res) => res.url().includes('/api/ai/capabilities'))
    // Re-saving keeps the existing capabilities in state, so the field stays
    // enabled while the new request is in flight.
    await page.click('#aiAssistSaveSettings')
    const typed = 'Draft a page about reporting cockroaches.'
    await page.fill('#aiAssistPrompt', typed)

    await capabilities
    // The re-render happens in the microtask after the response resolves.
    await expect(page.locator('#aiAssistPrompt')).toHaveValue(typed)
  })

  test('opens from the keyboard shortcut', async ({ page }) => {
    await gotoFresh(page)

    // Focus has to be inside a shortcut context first — isShortcutContext in
    // js/keyboard-shortcuts.js ignores keys unless the event target is within
    // #reviewWorkspace, .canvas-toolbar, or #mockPage. Without this the test
    // depended on first-run onboarding happening to focus the workspace tab
    // before the keypress, which is a race: it passed locally and failed in
    // CI. Every test in keyboard-shortcuts.spec.js focuses the mock page for
    // exactly this reason.
    await page.locator('#mockPage h1').first().click()
    await page.keyboard.press('4')

    await expect(page.locator('[data-workspace-panel="assist"]')).toBeVisible()
    await expect(page.locator('#aiAssistPanel')).toBeVisible()
  })
})
