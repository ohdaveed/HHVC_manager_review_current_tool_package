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

test.describe('mosquito workshop request form', () => {
  test('keeps the request visible when submission fails', async ({ page }) => {
    await page.route('http://127.0.0.1:8080/', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 500, body: 'Submission failed' })
        return
      }
      await route.fallback()
    })
    await page.goto(FORM_PATH)
    await fillRequiredFields(page)

    await page.click('button[type="submit"]')

    await expect(page.locator('#workshopForm')).toBeVisible()
    await expect(page.locator('#submissionError')).toContainText('could not submit your request')
    await expect(page.locator('.form-success')).toHaveCount(0)
  })

  // BOTH tests above mock the response, which is what let the real defect ship:
  // they prove the client renders success on a 200 and an error on a 500, and
  // it does. Nothing asserted what the REAL server answers. It answered 200
  // with index.html for POST /, because the static branch matched on pathname
  // with no method check — so the form showed a confirmation for every
  // submission, and the suite stayed green throughout. See issue #172.
  //
  // This test uses no route mock at all.
  test('does not claim success when the real server has no form handler', async ({ page }) => {
    await page.goto(FORM_PATH)
    await fillRequiredFields(page)

    await page.click('button[type="submit"]')

    // The form is a mockup: there is no intake backend on any deploy. The one
    // thing it must never do is tell someone their request was received.
    await expect(page.locator('.form-success')).toHaveCount(0)
    await expect(page.locator('#submissionError')).toContainText('could not submit your request')
    await expect(page.locator('#workshopForm')).toBeVisible()
  })

  test('confirms a request accepted by the form handler', async ({ page }) => {
    await page.route('http://127.0.0.1:8080/', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 200 })
        return
      }
      await route.fallback()
    })
    await page.goto(FORM_PATH)
    await fillRequiredFields(page)

    await page.click('button[type="submit"]')

    await expect(page.locator('.form-success')).toContainText('we received your request')
  })
})
