// General UI chrome: toasts, sidebar collapse/scroll persistence, the page
// picker dropdown, and the review checklist. Depends on js/state.js
// (escapeHtml, pageOrder, currentPageKey).

import { currentPageKey, pageData, pageOrder } from './state.js'
import { escapeHtml } from './utils.js'
/**
 * Show a transient toast, optionally with one action button.
 *
 * `action` was a real gap rather than a new feature: js/ux-improvements-workspace.js
 * has always passed a third argument offering a "Next Actionable Page" jump
 * after a decision, and `css/styles.css`'s `.toast .toast-action` has always
 * styled it \u2014 but this function only ever declared two parameters, so the
 * object was silently dropped and the button never rendered. Two parallel
 * sessions built the two halves and neither learned about the other.
 *
 * Deliberately ONE action, not a list: the toast self-dismisses after 4s, and
 * anything a reviewer needs longer than that to decide on does not belong here
 * (which is why queue undo lives in the bulk bar instead).
 * `action.className`/`action.dataset` are an additive extension for
 * js/inline-content-edit.js's one-step-undo toast (Task 7): its e2e coverage
 * and its own CSS both need to find/style the generated button by a specific
 * marker (`data-inline-edit-undo` / `.inline-edit-undo-action`), and DOM APIs
 * make that safe to add without touching how `message` itself is rendered.
 * `message` still always goes through `el.textContent`, never `innerHTML` —
 * several existing callers (e.g. js/review-state-sync.js's sync-failure
 * toasts) interpolate externally-supplied strings straight into it, and this
 * function must keep treating that text as inert.
 * @param {string} message
 * @param {string} [type] extra class, e.g. 'success' | 'error'
 * @param {{label: string, callback: () => void, className?: string, dataset?: Record<string, string>}} [action]
 */
function showToast(message, type, action) {
  const container = document.getElementById('toastContainer')
  if (!container) return
  const el = document.createElement('div')
  el.className = 'toast' + (type ? ' ' + type : '')
  el.textContent = message
  // A non-empty STRING label, not merely a truthy one: showToast is published on
  // window, so `action` is caller-supplied, and any other type would reach
  // textContent below and render as '[object Object]' — a button a reviewer
  // cannot interpret is worse than no button.
  if (
    action &&
    typeof action.label === 'string' &&
    action.label.trim() &&
    typeof action.callback === 'function'
  ) {
    const actionBtn = document.createElement('button')
    actionBtn.type = 'button'
    actionBtn.className = 'toast-action' + (action.className ? ' ' + action.className : '')
    // textContent, not innerHTML \u2014 the label is caller-supplied.
    actionBtn.textContent = action.label
    if (action.dataset && typeof action.dataset === 'object') {
      for (const [key, value] of Object.entries(action.dataset)) {
        actionBtn.dataset[key] = value
      }
    }
    actionBtn.addEventListener('click', () => {
      // Dismiss first: the callback usually navigates, and a toast left behind
      // describes the page the reviewer just left.
      el.remove()
      action.callback()
    })
    el.appendChild(actionBtn)
  }
  const close = document.createElement('button')
  close.className = 'toast-close'
  close.textContent = '\u00d7'
  close.setAttribute('aria-label', 'Dismiss')
  close.addEventListener('click', () => el.remove())
  el.appendChild(close)
  container.appendChild(el)
  setTimeout(() => {
    if (el.parentNode) el.remove()
  }, 4000)
}
function toggleSidebar() {
  const app = document.querySelector('.app')
  const btn = document.getElementById('sidebarToggle')
  if (!app || !btn) return
  app.classList.toggle('sidebar-collapsed')
  const coll = app.classList.contains('sidebar-collapsed')
  btn.textContent = coll ? '\u25b6' : '\u25c0'
  btn.setAttribute('aria-label', coll ? 'Expand sidebar' : 'Collapse sidebar')
}
// Sidebar scroll position and the per-page checklist toggles below are
// intentionally kept in sessionStorage rather than window.reviewState
// (js/ux-improvements.js's localStorage-backed review data): they're
// ephemeral viewport/UI positions scoped to this browser tab, not review
// content worth persisting across restarts or exporting.
function saveSidebarScroll() {
  const sb = document.querySelector('.sidebar')
  if (sb) sessionStorage.setItem('sidebarScroll', String(sb.scrollTop))
}
function restoreSidebarScroll() {
  const saved = sessionStorage.getItem('sidebarScroll')
  if (saved !== null)
    requestAnimationFrame(() => {
      const sb = document.querySelector('.sidebar')
      if (sb) sb.scrollTop = parseInt(saved, 10)
    })
}
function buildPageSelect() {
  const select = document.getElementById('pageSelect')
  if (!select) return
  const groups = {
    Topic: [],
    Transaction: [],
    'Resource Collection': [],
    Campaign: [],
    Information: [],
  }
  pageOrder.forEach(([key, label]) => {
    const pageType = pageData[key]?.type || ''
    const type = Object.prototype.hasOwnProperty.call(groups, pageType) ? pageType : 'Information'
    groups[type].push([
      key,
      label.replace(/^(Topic|Transaction|Resource Collection|Campaign|Information):\s*/, ''),
    ])
  })
  select.innerHTML = Object.entries(groups)
    .map(
      ([type, items]) =>
        '<optgroup label="' +
        escapeHtml(type) +
        ' pages">' +
        items.map(([k, l]) => '<option value="' + k + '">' + escapeHtml(l) + '</option>').join('') +
        '</optgroup>'
    )
    .join('')
}
function initChecklist() {
  document.querySelectorAll('.checklist .check').forEach((el, i) => {
    if (el.dataset.bound === 'true') return
    el.dataset.bound = 'true'
    el.setAttribute('role', 'checkbox')
    el.setAttribute('aria-checked', el.classList.contains('unchecked') ? 'false' : 'true')

    function toggleCheck() {
      el.classList.toggle('unchecked')
      const checked = !el.classList.contains('unchecked')
      el.setAttribute('aria-checked', checked ? 'true' : 'false')
      if (currentPageKey)
        sessionStorage.setItem('check_' + currentPageKey + '_' + i, checked ? '1' : '0')
    }

    el.addEventListener('click', toggleCheck)
    el.addEventListener('keydown', (event) => {
      if (event.key !== ' ' && event.key !== 'Enter') return
      event.preventDefault()
      toggleCheck()
    })
  })
}
function applyChecklistState(key) {
  document.querySelectorAll('.checklist .check').forEach((el, i) => {
    const saved = sessionStorage.getItem('check_' + key + '_' + i)
    if (saved === '0') el.classList.add('unchecked')
    else el.classList.remove('unchecked')
    el.setAttribute('aria-checked', el.classList.contains('unchecked') ? 'false' : 'true')
  })
}

/* Republished as browser globals, not just module exports.

   Under the old classic-<script> model every top-level function in this file
   was automatically a property of `window`, and two callers still depend on
   that rather than on importing:

   - `toggleSidebar` is invoked from an inline handler in index.html
     (`onclick="window.toggleSidebar?.()"`), which is plain HTML and has no
     way to reach a module scope.
   - `showToast` is called through `window.showToast?.(...)` by five of the
     self-mounting review/UX modules. They reach for it optionally on purpose:
     each is designed to degrade to silence rather than throw if the core
     failed to load, which an import would turn into a hard load-time failure.

   Assigning them here preserves both behaviors exactly. */
window.toggleSidebar = toggleSidebar
window.showToast = showToast

export {
  applyChecklistState,
  buildPageSelect,
  initChecklist,
  restoreSidebarScroll,
  saveSidebarScroll,
  showToast,
  toggleSidebar,
}
