// App bootstrap: wires up DOM event listeners and kicks off the initial
// render. Loaded after js/core/state.js, js/review/ui-controls.js, js/review/editor-panel.js,
// and js/mockup/page-render.js, all of which it depends on directly, and before
// js/review/ux-improvements.js, which now subscribes to page-render.js's
// onAfterRender() registry rather than wrapping renderPage (see navigateTo()'s
// own comment below — a DIFFERENT module still wraps window.renderPage).

import { buildPageSelect, initChecklist, showToast } from '../review/ui-controls.js'
import { currentPageKey, pageData } from './state.js'
import { renderPage } from '../mockup/page-render.js'
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
 * Navigate to a page through whatever `window.renderPage` currently is.
 *
 * This indirection is load-bearing and must not be "simplified" back to the
 * imported `renderPage`. js/editing/inline-content-edit.js decorates
 * `window.renderPage` once it mounts (wrapRenderPageForDecoration()), reading
 * the current value, closing over it, and reassigning the wrapper, so that
 * decorateListControls()/decorateEditedFields() run after every render
 * regardless of who triggered it.
 *
 * It is the only wrapper left. js/review/ux-improvements.js used to be a second
 * one — it reassigned `window.renderPage` the same way — but Task 1 of the
 * module-coherence plan (2026-08-19) converted it to a page-render.js
 * onAfterRender() subscriber instead, which needs no `window` reference at
 * all: page-render.js calls its subscribers directly, so the dependency runs
 * from ux-improvements.js to page-render.js rather than the reverse. Before
 * that there were three: js/review/manager-review-export.js's existed only to
 * refresh a "Current page:" sidebar label that has since been cut, so it went
 * with the label, and js/interactive-sitemap.js, the third, was deleted
 * outright. One wrapper is still one more than zero: the hazard below is
 * unchanged, and a future module adding a second would rely on it.
 *
 * Reassigning `window.renderPage` does NOT rebind this module's `import`,
 * which points at js/mockup/page-render.js's original export forever. Under the old
 * classic-<script> model `renderPage` was a shared global, so `window.renderPage
 * = wrapper` replaced the very binding this file called and the decorator
 * applied for free; as ES modules that stops being true, silently.
 *
 * What the undecorated path skips is not cosmetic: without
 * js/editing/inline-content-edit.js's wrapper, a render triggered through the bare
 * import instead of `window.renderPage` leaves #mockPage's add/remove list
 * controls and Edited-field badges undecorated. (The sidebar-edit flush that
 * used to live in this same paragraph — describing js/review/ux-improvements.js's
 * OLD wrapper — moved with that conversion: it is now
 * handleAfterRender()'s concern, reached through page-render.js's
 * runAfterRenderHooks() rather than through this indirection, so it fires
 * whether or not a wrapper is installed on `window.renderPage` at all.)
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

  // The first render deliberately calls the import directly rather than
  // navigateTo(): init() runs before any module has wrapped window.renderPage,
  // so there is nothing to pick up, and there is no outgoing page whose edits
  // would need flushing. js/review/ux-improvements.js does its own restoreInitialPage()
  // pass once it has registered its onAfterRender() subscriber.
  //
  // skipAfterRenderHooks=true: this call happens at module-eval time, before
  // js/review/ux-improvements.js (loaded later in js/main.js) has registered
  // anything — but renderPage()'s hook dispatch is DEFERRED (setTimeout(0) or
  // a View Transitions promise), and that registration happens synchronously,
  // in the same script-evaluation tick, before any deferred callback gets a
  // turn. Without this flag the bootstrap render's own hook call fires anyway
  // once ux-improvements.js's subscriber exists, running handleAfterRender()
  // for a render restoreInitialPage() is about to redo properly — see
  // renderPage()'s own doc comment on this parameter for the measured bug
  // (a persisted Karl-tags preference nobody set) that not skipping it
  // caused.
  const params = new URLSearchParams(window.location.search)
  const pageKey = params.get('page')
  renderPage(resolveInitialPageKey(pageKey), true, true)
}
init()
