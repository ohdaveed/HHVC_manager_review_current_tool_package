/* Global keyboard shortcuts for the manager review workflow.
   Shortcuts are ignored while typing in form fields so they never
   interfere with review notes or content edits. */

import { hasValidPageData } from '../utils.js'
;(function initReviewKeyboardShortcuts() {
  const DATA = window.HHVC_DATA
  if (!hasValidPageData(DATA)) return

  const DIALOG_ID = 'shortcutsHelpDialog'

  const SHORTCUTS = [
    { keys: ['←', 'k'], description: 'Previous page (respects the active queue filter)' },
    { keys: ['→', 'j'], description: 'Next page (respects the active queue filter)' },
    { keys: ['n'], description: 'Jump to the next page that still needs review' },
    { keys: ['w'], description: 'Show or hide the review workspace' },
    { keys: ['1'], description: 'Open Overview workspace tab' },
    { keys: ['2'], description: 'Open Page checks workspace tab' },
    // Numbered left to right across the tab strip. Matching visual order
    // matters more than keeping any one tab on a fixed digit: the Help panel
    // renders this list, so the mapping documents itself the moment anyone
    // looks for it. Keep these in step with WORKSPACE_TABS in
    // js/review/ux-improvements-workspace.js and the tab markup in index.html.
    //
    // 4, 5 and 6 are unbound now. Sitemap was cut; AI assist and Tool status
    // moved inside Help, so they are reached by opening Help rather than by a
    // digit of their own.
    { keys: ['3'], description: 'Open Help workspace tab' },
    { keys: ['p'], description: 'Download this mockup as a PNG' },
    { keys: ['a'], description: 'Approve current page, or all selected pages' },
    { keys: ['e'], description: 'Approve with edits (current or selected)' },
    { keys: ['r'], description: 'Revise and resubmit (current or selected)' },
    { keys: ['b'], description: 'Blocked (current or selected)' },
    { keys: ['u'], description: 'Needs review (current or selected)' },
    { keys: ['z'], description: 'Undo the last decision action' },
    { keys: ['x'], description: 'Toggle selection for the current page' },
    { keys: ['s'], description: 'Select all visible queue pages' },
    { keys: ['Escape'], description: 'Clear the queue selection' },
    { keys: ['/'], description: 'Focus the page search box' },
    { keys: ['q'], description: 'Focus the review queue search box' },
    { keys: ['?'], description: 'Show or hide this shortcut list' },
  ]

  const { escapeHtml } = window.utils

  function isTypingContext(target) {
    if (!target) return false
    if (target.isContentEditable) return true
    const tag = target.tagName
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
  }

  function isShortcutContext(target) {
    const scopeNode = target instanceof Element ? target : document.activeElement
    if (!scopeNode) return false
    if (scopeNode.closest('#reviewWorkspace')) return true
    if (scopeNode.closest('.canvas-toolbar')) return true
    if (scopeNode.closest('#mockPage')) return true
    return false
  }

  function goToAdjacentPage(direction) {
    const filter = window.reviewQueue?.getFilter?.() || 'All'
    const key = window.reviewQueue?.getAdjacentKey?.(direction, filter)
    if (key) window.renderPage?.(key)
  }

  function goToNextNeedsReview() {
    const key = window.reviewQueue?.getNextNeedsReviewKey?.()
    if (key) {
      window.renderPage?.(key)
    } else if (typeof window.showToast === 'function') {
      window.showToast('No pages left that need review', 'success')
    }
  }

  function toggleWorkspace() {
    document.querySelector('[data-sticky-action="toggle-workspace"]')?.click()
  }

  /* Derived from the canonical decision table in js/utils.js. This was a
     hand-written literal that happened to be the exact inverse of ACTION_LABELS
     in js/review/review-queue-state.js — the same five pairs typed out twice, in two
     files, with nothing keeping them agreed. */
  const DECISION_TO_ACTION = window.utils.DECISION_SLUG_BY_LABEL

  function applyQueueAction(action) {
    if (typeof window.reviewQueue?.applyQueueAction !== 'function') return false
    const targets = window.reviewQueue.getActionTargets?.(window.utils.getCurrentKey()) ||
      window.reviewQueue.getSelectedKeys?.() || [window.utils.getCurrentKey()]
    if (!targets.length) return false
    window.reviewQueue.applyQueueAction(targets, action)
    return true
  }

  function setDecision(decision) {
    if (window.reviewDecisions && !window.reviewDecisions.validateReviewerForDecision?.(decision)) {
      return
    }
    const action = DECISION_TO_ACTION[decision]
    if (action && applyQueueAction(action)) return
    window.reviewDecisions?.set?.(decision)
  }

  function toggleCurrentSelection() {
    const key = window.utils.getCurrentKey()
    if (!key || !DATA.pages[key]) return
    window.reviewQueue?.toggleSelected?.(key)
    window.reviewQueue?.syncSelectionUi?.()
  }

  function selectAllVisible() {
    const workspace = document.getElementById('reviewWorkspace')
    const overviewTab = document.querySelector('[data-workspace-tab="overview"]')
    const isOverviewVisible =
      workspace &&
      !workspace.hidden &&
      overviewTab &&
      overviewTab.getAttribute('aria-selected') === 'true'
    if (!isOverviewVisible) return

    window.reviewQueue?.selectAllVisible?.()
    window.reviewQueue?.syncSelectionUi?.()
    const count = window.reviewQueue?.getSelectedKeys?.().length || 0
    if (typeof window.showToast === 'function') {
      window.showToast(count ? `Selected ${count} pages` : 'No visible pages to select', 'info')
    }
  }

  function clearSelection() {
    const count = window.reviewQueue?.getSelectedKeys?.().length || 0
    if (!count) return false
    window.reviewQueue?.clearSelection?.()
    window.reviewQueue?.syncSelectionUi?.()
    if (typeof window.showToast === 'function') window.showToast('Selection cleared', 'info')
    return true
  }

  function focusPageSearch() {
    const input =
      document.getElementById('pageFilterInput') || document.getElementById('pageSelect')
    if (!input) return
    input.focus()
    if (typeof input.select === 'function') input.select()
  }

  function focusQueueSearch() {
    if (typeof window.reviewQueue?.focusQueueSearch === 'function') {
      window.reviewQueue.focusQueueSearch()
      return
    }
    focusPageSearch()
  }

  function buildHelpDialog() {
    const dialog = document.createElement('dialog')
    dialog.id = DIALOG_ID
    dialog.className = 'shortcuts-dialog'
    dialog.setAttribute('aria-label', 'Keyboard shortcuts')
    dialog.innerHTML = `
      <div class="shortcuts-dialog-header">
        <h2>Keyboard shortcuts</h2>
        <button type="button" class="shortcuts-dialog-close" data-close-shortcuts aria-label="Close shortcut list">×</button>
      </div>
      <p class="shortcuts-dialog-note">Shortcuts pause automatically while you type in any field. Decision keys apply to selected queue pages when a selection exists.</p>
      <ul class="shortcuts-list">
        ${SHORTCUTS.map(
          (shortcut) => `
          <li class="shortcuts-item">
            <span class="shortcuts-keys">${shortcut.keys
              .map((key) => `<kbd>${escapeHtml(key)}</kbd>`)
              .join('<span class="shortcuts-or">or</span>')}</span>
            <span class="shortcuts-description">${escapeHtml(shortcut.description)}</span>
          </li>
        `
        ).join('')}
      </ul>
    `
    dialog.addEventListener('click', (event) => {
      // Close when the backdrop (the dialog element itself) or the close button is clicked.
      if (event.target === dialog || event.target.closest('[data-close-shortcuts]')) {
        dialog.close()
      }
    })
    document.body.appendChild(dialog)
    return dialog
  }

  function toggleHelpDialog() {
    const dialog = document.getElementById(DIALOG_ID) || buildHelpDialog()
    if (dialog.open) dialog.close()
    else dialog.showModal()
  }

  // The list is published at module scope because consumers read it
  // synchronously (js/review/dashboard-guidance.js's Help panel does, during its own
  // DOMContentLoaded init). `ready` is NOT set here — see init().
  window.reviewKeyboardShortcuts = { list: SHORTCUTS, toggleDialog: toggleHelpDialog, ready: false }

  function openWorkspaceTab(tabId) {
    const workspace = document.getElementById('reviewWorkspace')
    if (workspace?.hidden) {
      window.reviewWorkspace?.setOpen?.(true)
    }
    window.reviewWorkspace?.setTab?.(tabId)
  }

  function handleKeyDown(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return
    if (isTypingContext(event.target)) return
    if (!isShortcutContext(event.target)) return
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key

    const dialog = document.getElementById(DIALOG_ID)
    if (dialog?.open) {
      if (key === '?' || key === 'Escape') {
        event.preventDefault()
        dialog.close()
      }
      return
    }

    switch (key) {
      case 'ArrowLeft':
      case 'k':
        event.preventDefault()
        goToAdjacentPage(-1)
        break
      case 'ArrowRight':
      case 'j':
        event.preventDefault()
        goToAdjacentPage(1)
        break
      case 'n':
        event.preventDefault()
        goToNextNeedsReview()
        break
      case 'w':
        event.preventDefault()
        toggleWorkspace()
        break
      case '1':
        event.preventDefault()
        openWorkspaceTab('overview')
        break
      case '2':
        event.preventDefault()
        openWorkspaceTab('checks')
        break
      case '3':
        event.preventDefault()
        openWorkspaceTab('help')
        break
      case 'p':
        // Only the single-page export gets a shortcut. Bulk export navigates
        // through all 19 pages and fires a download for each, which is far too
        // much to hang off one keystroke a reviewer might hit by accident.
        event.preventDefault()
        window.MockupImageExport?.exportCurrentPage?.()
        break
      case 'a':
        event.preventDefault()
        setDecision('Approved')
        break
      case 'e':
        event.preventDefault()
        setDecision('Approved with edits')
        break
      case 'r':
        event.preventDefault()
        setDecision('Revise and resubmit')
        break
      case 'b':
        event.preventDefault()
        setDecision('Blocked')
        break
      case 'u':
        event.preventDefault()
        setDecision('Needs review')
        break
      case 'z':
        event.preventDefault()
        // Plain z, not Ctrl/Cmd+Z: shortcuts only fire outside form fields
        // (isShortcutContext), so this cannot shadow undo while typing a note.
        window.reviewQueue?.undoLast?.()
        break
      case 'x':
        event.preventDefault()
        toggleCurrentSelection()
        break
      case 's':
        event.preventDefault()
        selectAllVisible()
        break
      case 'Escape':
        if (clearSelection()) event.preventDefault()
        break
      case '/':
        event.preventDefault()
        focusPageSearch()
        break
      case 'q':
        event.preventDefault()
        focusQueueSearch()
        break
      case '?':
        event.preventDefault()
        toggleHelpDialog()
        break
    }
  }

  function mountShortcutHint() {
    const toolbar = document.querySelector('.canvas-toolbar')
    if (!toolbar || document.getElementById('shortcutsHintButton')) return

    const hint = document.createElement('button')
    hint.type = 'button'
    hint.id = 'shortcutsHintButton'
    hint.className = 'shortcuts-hint-button'
    hint.title = 'Keyboard shortcuts (?)'
    hint.setAttribute('aria-label', 'Show keyboard shortcuts')
    hint.innerHTML = '<kbd>?</kbd> Shortcuts'
    hint.addEventListener('click', toggleHelpDialog)
    toolbar.appendChild(hint)
  }

  function init() {
    document.addEventListener('keydown', handleKeyDown)
    mountShortcutHint()

    // Announce readiness only once the keydown listener actually exists.
    // This used to fire at module scope, i.e. while the page was still
    // parsing and long before any key could be handled — so anything that
    // waited for "shortcuts ready" and then sent a key was racing a promise
    // the event had already broken. Nothing in the app depended on the early
    // timing (js/review/dashboard-guidance.js only registers for this event as a
    // fallback when the list is missing, which cannot happen by its own init),
    // and a test or integration that needs to press a key now has a truthful
    // signal to wait on.
    window.reviewKeyboardShortcuts.ready = true
    document.dispatchEvent(new CustomEvent('hhvc:shortcuts-ready'))
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
