/* PNG export for page mockups.

   Reviewers can already export their DECISIONS as CSV/JSON, but never the
   thing being decided on. Getting a mockup into a deck, an email or a Karl
   ticket meant taking a screenshot by hand, which produces inconsistent crops
   and captures whatever review chrome happened to be on screen. This exports
   the mockup itself, framed the same way every time.

   Rendering is done by modern-screenshot, which serialises the live DOM into
   an SVG <foreignObject> and lets the browser paint it. That matters for
   fidelity: the alternative approach (html2canvas and friends) reimplements
   CSS layout in JavaScript and gets grid, custom properties and modern colour
   functions wrong — all three of which this stylesheet leans on heavily.

   Load-order dependency: imported by js/main.js after js/review/ux-improvements.js,
   because it calls window.showToast for progress and window.renderPage to
   step through pages during a bulk export. */

import { domToBlob } from 'modern-screenshot'
import { downloadBlob, getCurrentKey, today } from '../core/utils.js'

/** What gets captured. The browser chrome frames the mockup the way a
    reviewer sees it, which reads better in a deck than a bare page. */
const CAPTURE_SELECTOR = 'figure.browser-shell'

/** Retina-ish output so the PNG stays sharp when scaled up in slides. */
const PIXEL_RATIO = 2

/** Gap between downloads in a bulk export. Browsers rate-limit or silently
    drop rapid successive downloads from one gesture; this keeps them apart
    enough to all land, and gives each page a frame to finish rendering. */
const BULK_DOWNLOAD_GAP_MS = 350

/**
 * Build the download filename for a page capture.
 *
 * Pure and exported so the naming is testable without a browser: it is the
 * part reviewers actually depend on when a folder fills up with exports.
 * @param {string} pageKey
 * @param {string} [dateStamp] defaults to today's YYYY-MM-DD
 * @returns {string}
 */
function buildFilename(pageKey, dateStamp) {
  const safeKey = String(pageKey || 'page').replace(/[^a-zA-Z0-9-_]/g, '-')
  return `hhvc-${safeKey}-${dateStamp || today()}.png`
}

/**
 * Capture one element to a PNG blob with the Karl annotation tags hidden.
 *
 * Karl tags are review scaffolding — they mark which CMS field each block
 * maps to — and are meaningless to whoever receives the image. They are
 * toggled off around the capture and restored afterwards rather than being
 * excluded by a filter, because they are inline spans woven through the
 * content: removing them from the capture tree would reflow the very layout
 * the reviewer is trying to show.
 * @param {Element} node
 * @returns {Promise<Blob>}
 */
async function captureNode(node) {
  const body = document.body
  const hadTagsHidden = body.classList.contains('hide-karl-tags')
  body.classList.add('hide-karl-tags')

  try {
    // Read the background off the captured node rather than hardcoding white:
    // in dark mode the tool chrome is dark, and a transparent PNG dropped into
    // a light slide would render unreadable text on nothing.
    const background = window.getComputedStyle(node).backgroundColor
    return await domToBlob(node, {
      scale: PIXEL_RATIO,
      backgroundColor: background && background !== 'rgba(0, 0, 0, 0)' ? background : '#ffffff',
      // The review UI injects its own controls; none belong in a deliverable.
      filter: (el) => !(el instanceof Element && el.hasAttribute('data-export-exclude')),
    })
  } finally {
    if (!hadTagsHidden) body.classList.remove('hide-karl-tags')
  }
}

/**
 * Export the page currently shown in the mockup viewer.
 * @returns {Promise<boolean>} whether a file was produced
 */
async function exportCurrentPage() {
  const node = document.querySelector(CAPTURE_SELECTOR)
  if (!node) return false

  try {
    const blob = await captureNode(node)
    downloadBlob(buildFilename(getCurrentKey()), blob)
    window.showToast?.('Saved a PNG of this mockup.', 'success')
    return true
  } catch (error) {
    console.error('PNG export failed:', error)
    window.showToast?.(`Could not save a PNG: ${error?.message || 'unknown error'}`, 'warn')
    return false
  }
}

/**
 * Export every page in navigation order, one PNG each.
 *
 * Sequential rather than parallel by necessity: there is one mockup viewport,
 * so each page has to be rendered into it and captured before the next one
 * replaces it. Navigation goes through window.renderPage so the review layers'
 * decorators still run — a bulk export must not be a path that quietly skips
 * the autosave flush (see js/core/app.js's navigateTo for why that matters).
 * @returns {Promise<{exported: number, failed: string[]}>}
 */
async function exportAllPages() {
  const order = window.HHVC_DATA?.order || []
  const startingKey = getCurrentKey()
  const failed = []
  let exported = 0

  window.showToast?.(`Exporting ${order.length} mockups as PNG…`, 'info')

  for (const [pageKey] of order) {
    try {
      await window.renderPage?.(pageKey)
      // Give the browser a frame to lay the new page out before serialising.
      await new Promise((resolve) => requestAnimationFrame(() => resolve()))
      const node = document.querySelector(CAPTURE_SELECTOR)
      if (!node) throw new Error('mockup element not found')
      const blob = await captureNode(node)
      downloadBlob(buildFilename(pageKey), blob)
      exported += 1
    } catch (error) {
      console.error(`PNG export failed for ${pageKey}:`, error)
      failed.push(pageKey)
    }
    await new Promise((resolve) => setTimeout(resolve, BULK_DOWNLOAD_GAP_MS))
  }

  // Put the reviewer back where they started; a bulk export is a side errand,
  // not a navigation.
  if (startingKey) await window.renderPage?.(startingKey)

  const summary = failed.length
    ? `Exported ${exported} of ${order.length} mockups. Failed: ${failed.join(', ')}.`
    : `Exported all ${exported} mockups as PNG.`
  window.showToast?.(summary, failed.length ? 'warn' : 'success')
  return { exported, failed }
}

/**
 * Add the export controls to the canvas toolbar.
 *
 * Injected rather than written into index.html so the buttons live next to the
 * behaviour that owns them, matching how the other review controls mount
 * (js/review/ux-improvements-export.js does the same for the export/import pair).
 * @returns {void}
 */
function mountExportControls() {
  // Was .canvas-toolbar, beside the decision chip and Previous/Next. Saving a
  // picture of a mockup is a real task but an occasional one — handing a
  // stakeholder something outside the review — and it does not belong in the
  // strip a reviewer uses on every page. It sits in Help's advanced section
  // now; the `p` shortcut is unchanged, so the fast path did not move.
  const toolbar = document.getElementById('mockupExportControls')
  if (!toolbar || toolbar.querySelector('[data-mockup-export]')) return

  const group = document.createElement('div')
  group.className = 'mockup-export-actions'
  // Never capture the export controls themselves.
  group.setAttribute('data-export-exclude', 'true')

  const one = document.createElement('button')
  one.type = 'button'
  one.className = 'review-sticky-btn'
  one.setAttribute('data-mockup-export', 'current')
  one.textContent = 'Download PNG'
  one.title = 'Save this mockup as a PNG (shortcut: p)'

  const all = document.createElement('button')
  all.type = 'button'
  all.className = 'review-sticky-btn'
  all.setAttribute('data-mockup-export', 'all')
  all.textContent = 'All PNGs'
  all.title = 'Save every mockup as a PNG'

  group.append(one, all)
  toolbar.appendChild(group)

  group.addEventListener('click', (event) => {
    const button = event.target.closest('[data-mockup-export]')
    if (!button || button.disabled) return
    const isAll = button.getAttribute('data-mockup-export') === 'all'
    // Disable both while a capture runs: the bulk path navigates pages, and a
    // second export starting mid-run would capture whichever page it landed on.
    group.querySelectorAll('button').forEach((el) => (el.disabled = true))
    const done = isAll ? exportAllPages() : exportCurrentPage()
    Promise.resolve(done).finally(() => {
      group.querySelectorAll('button').forEach((el) => (el.disabled = false))
    })
  })
}

window.MockupImageExport = {
  buildFilename,
  captureNode,
  exportCurrentPage,
  exportAllPages,
  mountExportControls,
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountExportControls, { once: true })
  } else {
    mountExportControls()
  }
}

export { buildFilename, captureNode, exportCurrentPage, exportAllPages, mountExportControls }
