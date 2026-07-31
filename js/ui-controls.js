// General UI chrome: toasts, sidebar collapse/scroll persistence, the page
// picker dropdown, and the review checklist. Depends on js/state.js
// (escapeHtml, pageOrder, currentPageKey).

import { currentPageKey, pageData, pageOrder } from './state.js'
import { escapeHtml } from './utils.js'
function showToast(message, type) {
  const container = document.getElementById('toastContainer')
  if (!container) return
  const el = document.createElement('div')
  el.className = 'toast' + (type ? ' ' + type : '')
  el.textContent = message
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
