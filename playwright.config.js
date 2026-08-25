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

// What the webServer runs to get a serving `dist/` on :port.
//
// `bun run start` is `validate && build:app && copy-workshop-form && serve`,
// and on CI the first of those four is redundant: the `e2e` job declares
// `needs: format_validate_lint`, and that job has already run `bun run
// validate` to completion against this same commit. Running it again inside a
// 120s webServer window buys nothing and sits on the critical path, which the
// `e2e` job IS — it runs 338-380s while the other six jobs finish inside 70s.
//
// `copy-workshop-form.js` is NOT redundant and must stay: it copies the
// committed `forms/mosquito-workshop-request/dist` into
// `dist/forms/mosquito-workshop-request`, which `tests/e2e/workshop-form.spec.js`
// loads. `vite build` alone does not produce it.
//
// Off CI the full `start` is what you want. `reuseExistingServer` is on there
// and a fresh clone has no `dist/` at all, so a serve-only command would hand
// the reader a 120s webServer timeout against a missing static root — a
// failure that names the timeout rather than the missing build.
const serverCommand = process.env.CI
  ? 'bun run build:app && node build_scripts/copy-workshop-form.js && bun run serve'
  : 'bun run start'

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
    command: serverCommand,
    env: { ...process.env, PORT: port },
    url: origin,
    // Reuse is off whenever HHVC_E2E_PORT is set, not just in CI. Naming a
    // port is how a second checkout asks for isolation from whatever else is
    // running — silently reusing a stranger's server on that port is exactly
    // the footgun the port option exists to prevent, and it would defeat the
    // isolation just as thoroughly as always reusing on 8080 did.
    reuseExistingServer: !process.env.CI && !process.env.HHVC_E2E_PORT,
    timeout: 120_000,
  },
})
