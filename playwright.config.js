const { defineConfig } = require('@playwright/test')

// Sandboxes with a pre-installed Chromium (e.g. Claude Code on the web) may
// ship a browser revision older than the one this Playwright version wants to
// download. Point this at the system executable to use it instead of
// downloading: PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium
const chromiumExecutablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH

// The port both the spawned server and the tests use. It is configurable
// because `reuseExistingServer` is on outside CI, which is a footgun the
// moment a second checkout of this repo exists: a dev server already bound to
// 8080 from ANOTHER worktree is silently reused, and the suite then reports on
// a build that has nothing to do with the branch under test. Green, and
// meaningless. Run a second checkout's suite on its own port instead:
//
//     HHVC_E2E_PORT=8085 bun run test:e2e
//
// `server.ts` and `vite.config.mjs` both already read PORT, so passing it
// through is all that is needed to move the whole stack.
const port = process.env.HHVC_E2E_PORT || process.env.PORT || '8080'
const origin = `http://127.0.0.1:${port}`

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: origin,
    trace: 'on-first-retry',
    ...(chromiumExecutablePath
      ? { launchOptions: { executablePath: chromiumExecutablePath } }
      : {}),
  },
  webServer: {
    command: 'bun run start',
    env: { ...process.env, PORT: port },
    url: origin,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
