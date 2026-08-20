## 2024-05-24 - Playwright test failures due to module.exports and window.marked instance isolated testing

**Learning:** When using `npx playwright test` with Vite built bundle, the dev server proxy that Vite starts may attempt to load ES modules via CommonJS `module.exports` and will fail loudly on Playwright runner if it lacks a `process.env` guard (like `process.env.PLAYWRIGHT_TEST_BASE_URL` or `process.env.NODE_ENV !== 'test'`).

**Action:** When creating tests or optimizing modules that might affect Playwright test runs, be sure not to alter the module.exports exports unless required or carefully gated.

**Learning:** the `marked` library exported `window.marked` behaves differently. Creating isolated instances of `marked` using `new window.marked.Marked()` provides optimal performance without global side-effects, but requires `_cachedMarkedInstance = new window.marked.Marked()` or falling back to `window.marked` when running in browser tests without global `Marked` export exposed explicitly.

**Action:** Whenever using `marked` globally on frontend or backend scripts, check for the existence of `.Marked` constructor to create an isolated scoped instance and cache the renderer for huge performance gains over `marked.use()`.
