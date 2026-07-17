// Shared helpers for the Playwright e2e suite. Plain functions (no fixture
// framework) to match this repo's no-framework ethos.
const STORAGE_KEY = 'hhvcManagerReviewState:v1'

const DECISIONS = {
  needsReview: 'Needs review',
  approved: 'Approved',
  approvedWithEdits: 'Approved with edits',
  revise: 'Revise and resubmit',
  blocked: 'Blocked',
}

// Load the app with no saved reviewer state. Each Playwright test gets a
// fresh browser context, so storage is already empty on first navigation —
// deliberately no clear+reload here: the app flushes current field values to
// localStorage on pagehide, so a clear-then-reload would boot the app with a
// freshly recreated (non-virgin) state blob.
async function gotoFresh(page, path = '/') {
  await page.goto(path)
  await page.waitForSelector('#mockPage h1')
  // The sticky review bar mounts a beat after the first render; most flows
  // (workspace toggling, w shortcut) need it, so wait for full app init.
  await page.waitForSelector('[data-sticky-action="toggle-workspace"]')
}

// Record every toast that appears into window.__toasts. Toasts auto-dismiss
// after 4s, so under parallel-worker load a boot-time toast can be gone before
// page.goto() even resolves — call this BEFORE goto and assert on the record.
async function recordToasts(page) {
  await page.addInitScript(() => {
    window.__toasts = []
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1 && node.classList?.contains('toast')) {
            window.__toasts.push(node.textContent || '')
          }
        }
      }
      // Observe the Document node itself: at init-script time the eventual
      // <html> element doesn't exist yet (the parser replaces the initial one).
    }).observe(document, { childList: true, subtree: true })
  })
}

async function readRecordedToasts(page) {
  return page.evaluate(() => (window.__toasts || []).join('\n'))
}

async function clearState(page) {
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY)
}

async function readState(page) {
  return page.evaluate(() => window.reviewState.read())
}

// Seed saved review state directly. Callers usually reload() afterwards so the
// UI (queue rows, restored fields) reflects the seeded state.
async function seedState(page, pages, globals = {}) {
  await page.evaluate(
    ({ pages, globals }) => {
      window.reviewState.write({
        version: 1,
        updated_at: new Date().toISOString(),
        ui: {},
        globals,
        pages,
      })
    },
    { pages, globals }
  )
}

function makeReviewRecord(pageKey, overrides = {}) {
  return {
    page_key: pageKey,
    decision: DECISIONS.needsReview,
    notes: '',
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

async function openWorkspace(page) {
  const workspace = page.locator('#reviewWorkspace')
  if (!(await workspace.isVisible())) {
    await page.click('[data-sticky-action="toggle-workspace"]')
    await workspace.waitFor({ state: 'visible' })
  }
}

// Open a workspace tab by its data-workspace-tab value: overview | checks |
// sitemap | help. Queue, sitemap, and help panels mount lazily on first open.
async function openWorkspaceTab(page, tab) {
  await openWorkspace(page)
  await page.click(`.review-workspace-tab[data-workspace-tab="${tab}"]`)
  await page.locator(`.review-workspace-panel[data-workspace-panel="${tab}"]`).waitFor({
    state: 'visible',
  })
}

// The "Search metadata" sidebar group is a closed <details> by default, so
// its inputs are invisible to actionability checks until it's expanded.
async function openSearchMetadata(page) {
  const group = page.locator('details.control-group:has(#seoTitleInput)')
  if (!(await group.evaluate((el) => el.open))) {
    await group.locator('summary').click()
  }
  await page.locator('#seoTitleInput').waitFor({ state: 'visible' })
}

// Field persistence is debounced 300ms (js/ux-improvements.js); wait it out.
async function settleDebounce(page) {
  await page.waitForTimeout(400)
}

// Switch pages via the sidebar picker and wait for the render to land.
// renderPage() pushes ?page=<key> immediately but applies content inside a
// View Transition, so wait for #browserUrl to show the target page's slug —
// that's set by applyPageContent, i.e. only once the new page is in the DOM.
async function selectPage(page, key) {
  await page.selectOption('#pageSelect', key)
  await page.waitForFunction(
    (expected) =>
      document.getElementById('browserUrl')?.textContent ===
      'https://' + window.HHVC_PAGES[expected].slug,
    key
  )
  await page.waitForSelector('#mockPage h1')
}

module.exports = {
  STORAGE_KEY,
  DECISIONS,
  gotoFresh,
  recordToasts,
  readRecordedToasts,
  clearState,
  readState,
  seedState,
  makeReviewRecord,
  openWorkspace,
  openWorkspaceTab,
  openSearchMetadata,
  settleDebounce,
  selectPage,
}
