import { showToast } from './ui-controls.js'

function setExpanded(trigger, expanded) {
  const panelId = trigger.getAttribute('aria-controls')
  const panel = panelId ? document.getElementById(panelId) : null
  if (!panel) return
  trigger.setAttribute('aria-expanded', expanded ? 'true' : 'false')
  panel.hidden = !expanded
}

/**
 * Copy one guide value to the clipboard, toasting only on a copy that
 * actually happened.
 *
 * Mirrors the hardened fallback in js/ux-improvements-export.js rather than
 * writing a third clipboard implementation. Three details are the whole
 * point: `document.execCommand('copy')` REPORTS failure by returning false
 * rather than throwing, so an ignored return toasts "copied" over an empty
 * clipboard and the reviewer pastes stale text into Karl; the textarea is
 * removed in a `finally` so a throw cannot leave it in the DOM; and the
 * secure-context check matches the sibling file, since `navigator.clipboard`
 * exists but rejects on an insecure origin.
 *
 * @param {string} value The exact text to place on the clipboard.
 * @returns {Promise<void>} Rejects when the copy did not happen.
 */
async function copyValue(value) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(value)
  } else {
    const input = document.createElement('textarea')
    input.value = value
    input.setAttribute('readonly', '')
    input.className = 'karl-copy-fallback'
    document.body.append(input)
    try {
      input.select()
      if (!document.execCommand('copy')) {
        throw new Error('Failed to copy the Karl value. Browser clipboard access may be blocked.')
      }
    } finally {
      input.remove()
    }
  }
  showToast('Karl value copied', 'success')
}

function initKarlGuides() {
  if (window.karlGuide?.ready) return
  document.addEventListener('click', (event) => {
    const copy = event.target.closest('[data-karl-copy]')
    if (copy) {
      event.preventDefault()
      event.stopPropagation()
      copyValue(copy.getAttribute('data-karl-copy') || '').catch(() =>
        showToast('Copy failed', 'error')
      )
      return
    }
    const trigger = event.target.closest('.karl-guide-trigger')
    if (!trigger) return
    event.preventDefault()
    event.stopPropagation()
    setExpanded(trigger, trigger.getAttribute('aria-expanded') !== 'true')
  })
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    /* **Resolve the trigger through the guide's wrapper, not from the event
       target.** The panel is a SIBLING of `.karl-guide-trigger` inside
       `[data-karl-guide]`, so `closest('.karl-guide-trigger')` returns null for
       anything focused inside the open panel — which is every Copy button in
       it. A keyboard reviewer who tabbed from the trigger into the panel found
       Escape did nothing and had no way back out except tabbing through every
       remaining control. Closing the OWNING guide also means Escape cannot
       reach past the panel and close some other guide that happens to be open. */
    const owner = event.target.closest?.('[data-karl-guide]')
    const trigger = owner?.querySelector('.karl-guide-trigger')
    if (!trigger || trigger.getAttribute('aria-expanded') !== 'true') return
    setExpanded(trigger, false)
    // Focus returns to the trigger rather than staying on a control that is now
    // inside a hidden subtree, which would leave the focus ring nowhere.
    trigger.focus()
  })
  window.karlGuide = { ready: true, setExpanded }
}

// Guarded because this module is imported for its exports as well as its mount:
// initKarlGuides() touches `document` and `window` at import time, so a
// non-browser import (a Bun test, or any Node-side consumer) would throw before
// the caller could reach anything this file exports. Same
// `typeof window === 'undefined'` early return the rest of the repo uses.
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  initKarlGuides()
}

export { copyValue, initKarlGuides, setExpanded }
