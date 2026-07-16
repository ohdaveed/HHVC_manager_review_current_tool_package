const { defineConfig } = require('@playwright/test')

// Sandboxes with a pre-installed Chromium (e.g. Claude Code on the web) may
// ship a browser revision older than the one this Playwright version wants to
// download. Point this at the system executable to use it instead of
// downloading: PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium
const chromiumExecutablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:8080',
    trace: 'on-first-retry',
    ...(chromiumExecutablePath
      ? { launchOptions: { executablePath: chromiumExecutablePath } }
      : {}),
  },
  webServer: {
    command: 'bun run start',
    url: 'http://127.0.0.1:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
