/* Global keyboard shortcuts for the manager review workflow.
   Shortcuts are ignored while typing in form fields so they never
   interfere with review notes or content edits. */
;(function initReviewKeyboardShortcuts() {
  const DATA = window.HHVC_DATA
  if (!hasValidPageData(DATA)) return

  const DIALOG_ID = 'shortcutsHelpDialog'

  const SHORTCUTS = [
    { keys: ['←', 'k'], description: 'Previous page (respects the active queue filter)' },
    { keys: ['→', 'j'], description: 'Next page (respects the active queue filter)' },
    { keys: ['n'], description: 'Jump to the next page that still needs review' },
    { keys: ['w'], description: 'Show or hide the review workspace' },
    { keys: ['a'], description: 'Set decision: Approved' },
    { keys: ['e'], description: 'Set decision: Approved with edits' },
    { keys: ['r'], description: 'Set decision: Revise and resubmit' },
    { keys: ['b'], description: 'Set decision: Blocked' },
    { keys: ['u'], description: 'Set decision: Needs review' },
    { keys: ['/'], description: 'Focus the page search box' },
    { keys: ['?'], description: 'Show or hide this shortcut list' },
  ]

  const { escapeHtml } = window.utils

  function isTypingContext(target) {
    if (!target) return false
    if (target.isContentEditable) return true
    const tag = target.tagName
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
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

  function setDecision(decision) {
    window.reviewDecisions?.set?.(decision)
  }

  function focusPageSearch() {
    const input =
      document.getElementById('pageFilterInput') || document.getElementById('pageSelect')
    if (!input) return
    input.focus()
    if (typeof input.select === 'function') input.select()
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
      <p class="shortcuts-dialog-note">Shortcuts pause automatically while you type in any field.</p>
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

  function handleKeyDown(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return
    if (isTypingContext(event.target)) return

    const dialog = document.getElementById(DIALOG_ID)
    if (dialog?.open && event.key !== '?' && event.key !== 'Escape') return

    switch (event.key) {
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
      case '/':
        event.preventDefault()
        focusPageSearch()
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
