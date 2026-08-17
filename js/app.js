// App bootstrap: wires up DOM event listeners and kicks off the initial
// render. Loaded after js/state.js, js/ui-controls.js, js/editor-panel.js,
// and js/page-render.js, all of which it depends on directly, and before
// js/ux-improvements.js, which wraps renderPage once init() has run.

import { buildPageSelect, initChecklist, showToast } from './ui-controls.js'
import { currentPageKey, pageData } from './state.js'
import { renderPage } from './page-render.js'
import { resolvePageKey } from './utils.js'
import { updateSearchPreview } from './editor-panel.js'

// Resolves a ?page= URL param to a real page key, following the
// consolidation alias map for retired keys and falling back to the
// default page. Without this, renderPage() silently no-ops on an unknown
// key (e.g. an old saved/shared link), leaving the viewer stuck on the
// static "Loading…" placeholder in index.html forever. Pure resolution
// logic lives in resolvePageKey() (js/utils.js) so it's independently
// testable; this wrapper only adds the toast side effect.
/**
 * Navigate to a page through whatever `window.renderPage` currently is.
 *
 * This indirection is load-bearing and must not be "simplified" back to the
 * imported `renderPage`. js/ux-improvements.js decorates `window.renderPage`
 * after init() runs, reading the current value, closing over it, and
 * reassigning the wrapper.
 *
 * It is the only wrapper left, and the count is worth stating carefully
 * because this comment used to claim three and then name two — listing
 * js/manager-review-export.js twice, the one module that provably no longer
 * wraps at all (see its own header). js/interactive-sitemap.js, the third,
 * was deleted outright. One wrapper is still one more than zero: the hazard
 * below is unchanged, and a future module adding a second would rely on it.
 *
 * Reassigning `window.renderPage` does NOT rebind this module's `import`,
 * which points at js/page-render.js's original export forever. Under the old
 * classic-<script> model `renderPage` was a shared global, so `window.renderPage
 * = wrapper` replaced the very binding this file called and the decorators
 * applied for free; as ES modules that stops being true, silently.
 *
 * What the undecorated path skips is not cosmetic: the js/ux-improvements.js
 * wrapper flushes in-progress sidebar edits BEFORE the page switch. Without
 * it, keystrokes still inside the autosave debounce are either dropped or
 * written under the incoming page's key, and applySavedPageState() never runs
 * for the destination — so the reviewer's saved decision/notes are not
 * restored. That is a review-data-loss bug this repo had already fixed once.
 *
 * Falls back to the import if nothing has published a wrapper yet, so the
 * function is safe to call at any point in the lifecycle.
 * @param {string} key page key to render
 * @param {boolean} [skipHistory] forwarded; true suppresses a history entry
 * @returns {*} whatever renderPage returns (a Promise under View Transitions)
 */
function navigateTo(key, skipHistory) {
  const current = typeof window.renderPage === 'function' ? window.renderPage : renderPage
  return current(key, skipHistory)
}

function resolveInitialPageKey(key) {
  const result = resolvePageKey(key, pageData, window.HHVC_DELETED_PAGE_ALIASES, 'pestsTopic')
  if (typeof showToast === 'function') {
    if (result.status === 'aliased') {
      showToast(
        `That page has been consolidated. Showing "${pageData[result.key].title}" instead.`,
        'info'
      )
    } else if (result.status === 'unknown') {
      showToast(
        `"${result.from}" is not a page in this mockup. Showing the default page instead.`,
        'info'
      )
    }
  }
  return result.key
}

function init() {
  buildPageSelect()
  const select = document.getElementById('pageSelect')
  select.addEventListener('change', (e) => navigateTo(e.target.value))
  const urlInput = document.getElementById('urlInput')
  if (urlInput) {
    urlInput.addEventListener('input', (e) => {
      document.getElementById('browserUrl').textContent = 'https://' + e.target.value
      updateSearchPreview()
    })
  }
  document.getElementById('seoTitleInput').addEventListener('input', (e) => {
    const page = pageData[currentPageKey]
    page.seoTitle = e.target.value
    page.seoTitleEdited = true
    updateSearchPreview()
  })
  document.getElementById('metaDescriptionInput').addEventListener('input', (e) => {
    const page = pageData[currentPageKey]
    page.metaDescription = e.target.value
    page.metaDescriptionEdited = true
    updateSearchPreview()
  })
  // No `hide-karl-tags` sync at init. `#tagToggle` ships unchecked and the
  // mockup ships annotated, which is deliberate: the class is the reviewer's
  // OWN later choice, and css/styles.css hides `.unverified-pill`,
  // `.editor-qa` and `.cms-help` under it alongside the tags. Applying it at
  // load therefore hid every Unverified pill on first paint — three e2e specs
  // (ai-rewrite, inline-content-edit) resolve those pills and assert they are
  // visible. Restoring a SAVED preference is a different thing and still
  // happens, in applySavedUiPreferences() (js/ux-improvements-state-sync.js).
  const tagToggle = document.getElementById('tagToggle')
  tagToggle.addEventListener('change', (e) => {
    document.body.classList.toggle('hide-karl-tags', !e.target.checked)
  })
  initChecklist()

  window.addEventListener('popstate', (e) => {
    if (e.state && e.state.key) {
      navigateTo(e.state.key, true)
    } else {
      const params = new URLSearchParams(window.location.search)
      const pageKey = params.get('page')
      navigateTo(pageKey ? resolveInitialPageKey(pageKey) : null, true)
    }
  })

  // The first render deliberately calls the import directly rather than
  // navigateTo(): init() runs before any module has wrapped window.renderPage,
  // so there is nothing to pick up, and there is no outgoing page whose edits
  // would need flushing. js/ux-improvements.js does its own restoreInitialPage()
  // pass once its wrapper is installed.
  const params = new URLSearchParams(window.location.search)
  const pageKey = params.get('page')
  renderPage(pageKey ? resolveInitialPageKey(pageKey) : null, true)
}
init()
