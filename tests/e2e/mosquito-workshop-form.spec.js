const { test, expect } = require('@playwright/test')

const FORM_PATH = '/forms/mosquito-workshop-request/'

async function fillRequiredFields(page) {
  await page.fill('#organization', 'Example School')
  await page.fill('#contactName', 'Alex Example')
  await page.fill('#email', 'alex@example.test')
  await page.fill('#phone', '415-555-0100')
  await page.selectOption('#organizationType', 'School')
  await page.selectOption('#audienceAge', 'Grades 3–5')
  await page.fill('#groupSize', '24')
  await page.fill('#preferredDates', 'Week of June 1')
  await page.fill('#eventLocation', 'Mission District')
  await page.selectOption('#spaceType', 'Indoor classroom')
  await page.selectOption('#electricity', 'Yes')
}

// This form is a DESIGN REFERENCE with no intake backend on any deploy. It
// used to POST to "/" by the Netlify Forms convention, and once Netlify was
// retired that rendered a confirmation screen for every silently discarded
// submission (issue #172). The server answers 405 for that POST now, which
// made the failure visible — but a form that always fails reads as broken
// rather than as a mock, so it no longer submits at all.
//
// These tests therefore assert two different things, and the second is the
// one that matters: that no request leaves the page, and that nothing on the
// page can be read as "your request was received".
test.describe('mosquito workshop request form', () => {
  test('sends no network request when submitted', async ({ page }) => {
    const posts = []
    page.on('request', (request) => {
      if (request.method() !== 'GET') posts.push(`${request.method()} ${request.url()}`)
    })

    await page.goto(FORM_PATH)
    await fillRequiredFields(page)
    await page.click('button[type="submit"]')

    await expect(page.locator('.form-success')).toBeVisible()
    // Asserted on the collected list rather than a route mock: a mock would
    // prove only what the client does with a reply, which is exactly the gap
    // that let the original defect ship.
    expect(posts).toEqual([])
  })

  test('never claims a request was received', async ({ page }) => {
    await page.goto(FORM_PATH)
    await fillRequiredFields(page)
    await page.click('button[type="submit"]')

    const body = await page.locator('body').innerText()
    expect(body).not.toMatch(/we received your request/i)
    expect(body).not.toMatch(/thank you/i)
    await expect(page.locator('.form-success')).toContainText('Not submitted')
  })

  test('says it is a design reference before anything is entered', async ({ page }) => {
    await page.goto(FORM_PATH)
    await expect(page.locator('.form-mock-banner')).toContainText('not a live form')
    await expect(page.locator('.form-mock-banner')).toContainText('Fillout')
  })

  test('shows every captured field, including the ones left blank', async ({ page }) => {
    // The table IS the deliverable: it is the field inventory a reviewer
    // checks against what HHVC actually needs, so a blank optional field has
    // to appear rather than vanish.
    await page.goto(FORM_PATH)
    // Derive the expectation from the form itself. A hardcoded number lets a
    // dropped field keep the test green -- and this repo's own rule is that
    // counts come from the source of truth rather than a literal.
    const fieldCount = await page.locator('#workshopForm .form-field').count()
    expect(fieldCount).toBeGreaterThan(0)
    await fillRequiredFields(page)
    await page.click('button[type="submit"]')

    const rows = page.locator('.form-summary tbody tr')
    // EXACTLY, not at-least: the summary is the field inventory, so a missing
    // row and a duplicated one are both defects.
    expect(await rows.count()).toBe(fieldCount)
    await expect(page.locator('.form-summary')).toContainText('Example School')
    await expect(page.locator('.form-summary')).toContainText('(left blank)')
  })

  test('still enforces required fields', async ({ page }) => {
    // Validation is part of what the reference documents — which fields the
    // real Fillout form must make mandatory.
    await page.goto(FORM_PATH)
    await page.fill('#organization', 'Example School')
    await page.click('button[type="submit"]')

    await expect(page.locator('#workshopForm')).toBeVisible()
    await expect(page.locator('.form-success')).toHaveCount(0)
  })

  test('returns to the form from the preview', async ({ page }) => {
    await page.goto(FORM_PATH)
    await fillRequiredFields(page)
    await page.click('button[type="submit"]')
    await page.click('#backToForm')

    await expect(page.locator('#workshopForm')).toBeVisible()
    // The handler must be re-attached on the way back, or the second submit
    // does a native form GET and navigates away.
    await fillRequiredFields(page)
    await page.click('button[type="submit"]')
    await expect(page.locator('.form-success')).toBeVisible()
  })
})
