/* The Karl transcript panel: Preview, Copy and Download for the open page,
   in the collapsed section at the end of the Help tab.

   Static markup in index.html rendered at init, following
   js/mockup/mockup-image-export.js — NOT the three lazy `__mountXOnTabOpen` hooks.
   Those exist because AI assist, stored review data and the page registry all
   depend on server.ts, so on a deploy with no runtime they were permanently
   empty panels; the transcript needs no server, so a fourth lazy panel would
   mean touching setWorkspaceTab and the mountWorkspacePanelIfOpen catch-up for
   nothing.

   Nothing here writes to pages/*.js and nothing is sent anywhere. Copying a
   transcript publishes nothing — a human performs every keystroke in Karl.

   Load-order dependency: reads window.karlTranscript, window.reviewState,
   window.utils and window.showToast, so js/main.js must list it after all
   four. */
;(function mountKarlTranscriptPanel() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const HOST_ID = 'karlTranscriptControls'
  const PREVIEW_ID = 'karlTranscriptPreview'

  /**
   * The transcript for whatever page is open, with this browser's saved review
   * record applied.
   *
   * The page comes from window.utils.getCurrentPage() rather than from
   * #pageSelect.value, which is stale during the initial View Transition — the
   * same reason the React islands take their data as an argument instead of
   * reading it on mount.
   * @returns {{markdown: string, pageKey: string}}
   */
  function currentTranscript() {
    const { getCurrentPage, getCurrentKey } = window.utils
    const page = getCurrentPage()
    const pageKey = getCurrentKey()
    // Records live under state.pages[pageKey] — the same shape every other
    // review surface reads. A wrong key here would report every page as
    // unreviewed while looking like it worked.
    const state = window.reviewState && window.reviewState.read()
    const record = (state && state.pages && state.pages[pageKey]) || null
    const transcript = window.karlTranscript.buildTranscript(page, record, window.HHVC_DATA.pages)
    return { markdown: window.karlTranscript.renderTranscriptMarkdown(transcript), pageKey }
  }

  /**
   * Copy text to the clipboard, falling back to a hidden textarea where the
   * async API is unavailable — an insecure context, or a browser that blocks
   * it. Mirrors js/review/ux-improvements-export.js's copyText for the same reason it
   * exists there: a reviewer on a file:// URL still needs the button to work.
   * @param {string} text
   * @returns {Promise<void>}
   */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text)
    }
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    try {
      textarea.select()
      if (!document.execCommand('copy')) {
        return Promise.reject(new Error('Browser clipboard access is blocked.'))
      }
      return Promise.resolve()
    } catch (error) {
      return Promise.reject(error)
    } finally {
      textarea.remove()
    }
  }

  /** Report through the toast layer, which degrades to silence if absent. */
  function report(message) {
    if (typeof window.showToast === 'function') window.showToast(message)
  }

  /** Build the three controls and the preview, once. */
  function render() {
    const host = document.getElementById(HOST_ID)
    if (!host || host.querySelector('[data-karl-transcript]')) return

    const actions = document.createElement('div')
    actions.className = 'karl-transcript-actions'

    const preview = document.createElement('pre')
    preview.id = PREVIEW_ID
    preview.className = 'karl-transcript-preview'
    preview.hidden = true
    // A live region would announce the whole transcript on every press, which
    // for a Transaction page is several hundred lines. The button's own toast
    // is what reports the outcome.
    preview.setAttribute('tabindex', '0')

    const previewButton = document.createElement('button')
    previewButton.type = 'button'
    previewButton.id = 'karlTranscriptPreviewButton'
    previewButton.className = 'review-sticky-btn'
    previewButton.setAttribute('data-karl-transcript', 'preview')
    previewButton.textContent = 'Show transcript'
    previewButton.addEventListener('click', () => {
      const { markdown } = currentTranscript()
      preview.textContent = markdown
      preview.hidden = false
      previewButton.textContent = 'Refresh transcript'
    })

    const copyButton = document.createElement('button')
    copyButton.type = 'button'
    copyButton.id = 'karlTranscriptCopyButton'
    copyButton.className = 'review-sticky-btn secondary-tool'
    copyButton.setAttribute('data-karl-transcript', 'copy')
    copyButton.textContent = 'Copy transcript'
    copyButton.addEventListener('click', () => {
      const { markdown } = currentTranscript()
      copyText(markdown).then(
        () => report('Karl transcript copied. Copying publishes nothing.'),
        () => report('Could not copy — select the text in the preview instead.')
      )
    })

    const downloadButton = document.createElement('button')
    downloadButton.type = 'button'
    downloadButton.id = 'karlTranscriptDownloadButton'
    downloadButton.className = 'review-sticky-btn secondary-tool'
    downloadButton.setAttribute('data-karl-transcript', 'download')
    downloadButton.textContent = 'Download .md'
    downloadButton.addEventListener('click', () => {
      const { markdown, pageKey } = currentTranscript()
      window.utils.downloadFile(`${pageKey}-karl-transcript.md`, markdown, 'text/markdown')
      report('Karl transcript downloaded.')
    })

    actions.append(previewButton, copyButton, downloadButton)
    host.append(actions, preview)
  }

  function init() {
    render()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }

  window.karlTranscriptPanel = { render, currentTranscript }
})()
