// App bootstrap: wires up DOM event listeners and kicks off the initial
// render. Loaded after js/core/state.js, js/review/ui-controls.js, js/review/editor-panel.js,
// and js/mockup/page-render.js, all of which it depends on directly, and before
// js/review/ux-improvements.js, which subscribes to page-render.js's
// onAfterRender() registry rather than wrapping renderPage. No module wraps
// window.renderPage any more — see navigateTo()'s own comment below.

import { buildPageSelect, initChecklist, showToast } from '../review/ui-controls.js'
import { currentPageKey, pageData } from './state.js'
import { renderPage, repaintPage } from '../mockup/page-render.js'
import { resolvePageKey } from './utils.js'
import { updateSearchPreview } from '../review/editor-panel.js'

// Resolves a ?page= URL param to a real page key, following the
// consolidation alias map for retired keys and falling back to the
// default page. Without this, renderPage() silently no-ops on an unknown
// key (e.g. an old saved/shared link), leaving the viewer stuck on the
// static "Loading…" placeholder in index.html forever. Pure resolution
// logic lives in resolvePageKey() (js/core/utils.js) so it's independently
// testable; this wrapper only adds the toast side effect.
/**
 * Navigate to a page.
 *
 * **This used to route through `window.renderPage` on purpose, and no longer
 * needs to.** The indirection existed because modules decorated navigation by
 * reassigning `window.renderPage` to a wrapper, and reassigning it does NOT
 * rebind this module's `import` — which points at js/mockup/page-render.js's
 * original export forever. Under the old classic-`<script>` model `renderPage`
 * was a shared global, so a wrapper replaced the very binding this file called
 * and the decoration applied for free; as ES modules that silently stopped
 * being true, and calling the import bypassed every wrapper.
 *
 * There are now no wrappers. Four modules had one and all four are gone:
 * js/interactive-sitemap.js was deleted outright,
 * js/review/manager-review-export.js's went with the "Current page:" sidebar
 * label it refreshed, js/review/ux-improvements.js's became an onAfterRender()
 * subscriber in #191, and js/editing/inline-content-edit.js's became one too.
 * Every post-render concern reaches page-render.js's hook registry instead, so
 * it fires for the import and the global alike and there is nothing left for
 * this lookup to pick up.
 *
 * `window.renderPage = renderPage` still exists in page-render.js, but only so
 * the ~15 self-mounting IIFEs that CALL `window.renderPage?.(key)` keep working
 * — calling it, not wrapping it. If a future module reintroduces a wrapper,
 * prefer converting it to onAfterRender() over restoring this indirection.
 *
 * @param {string} key page key to render
 * @param {boolean} [skipHistory] forwarded; true suppresses a history entry
 * @returns {*} whatever renderPage returns (a Promise under View Transitions)
 */
function navigateTo(key, skipHistory) {
  return renderPage(key, skipHistory)
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
  // happens, in applySavedUiPreferences() (js/review/ux-improvements-state-sync.js).
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
      navigateTo(resolveInitialPageKey(pageKey), true)
    }
  })

  // The first render is a repaint, not a navigation: there is no history entry
  // to push (this IS the entry) and no outgoing page whose edits would need
  // flushing. js/review/ux-improvements.js does its own restoreInitialPage()
  // pass once it has registered its render subscribers.
  //
  // repaintPage() is renderPage(key, skipHistory: true, skipHooks: true).
  // The hook half matters here: this call happens at module-eval time, before
  // js/review/ux-improvements.js (loaded later in js/main.js) has registered
  // anything — but renderPage()'s after-hook dispatch is DEFERRED
  // (setTimeout(0) or a View Transitions promise), and that registration
  // happens synchronously, in the same script-evaluation tick, before any
  // deferred callback gets a turn. scheduleAfterRenderHooks() now binds the
  // subscriber list when the render is SCHEDULED, so that can no longer
  // happen even unflagged — but skipping stays explicit here, because it also
  // silences the synchronous before-channel and keeps the guarantee from
  // depending on js/main.js's import order. See renderPage()'s doc comment for
  // the measured bug (a persisted Karl-tags preference nobody set) that not
  // skipping once caused.
  const params = new URLSearchParams(window.location.search)
  const pageKey = params.get('page')
  repaintPage(resolveInitialPageKey(pageKey))
}
init()
