// SEO/editor panel: syncing search metadata fields with the current page,
// the search-result preview, and reading-target display. Depends on
// js/utils.js (defaultSeoTitle, defaultMetaDescription, getValue, setValue,
// setText) and js/state.js (pageData, currentPageKey).

import { currentPageKey, pageData } from '../state.js'
import { defaultMetaDescription, defaultSeoTitle, getValue, setText, setValue } from '../utils.js'
function statusClass(length, max) {
  return length <= max ? 'ok' : 'warn'
}
function updateSearchPreview() {
  const page = pageData[currentPageKey]
  if (!page) return
  const seoTitle = getValue('seoTitleInput') || defaultSeoTitle(page)
  const metaDescription = getValue('metaDescriptionInput') || defaultMetaDescription(page)
  const slug = getValue('urlInput') || page.slug
  setText('seoPreviewTitle', seoTitle)
  setText('seoPreviewUrl', 'https://' + slug)
  setText('seoPreviewDescription', metaDescription)
  const titleStatus = document.getElementById('seoTitleStatus')
  const descStatus = document.getElementById('metaDescriptionStatus')
  setText('seoTitleCount', `${seoTitle.length} characters`)
  setText('metaDescriptionCount', `${metaDescription.length} characters`)
  if (titleStatus) {
    titleStatus.className = statusClass(seoTitle.length, 60)
    titleStatus.textContent = seoTitle.length <= 60 ? 'OK: 60 or fewer' : 'Over 60 characters'
  }
  if (descStatus) {
    descStatus.className = statusClass(metaDescription.length, 110)
    descStatus.textContent =
      metaDescription.length <= 110 ? 'OK: 110 or fewer' : 'Over 110 characters'
  }
}
function syncEditorFields(page) {
  setValue('seoTitleInput', defaultSeoTitle(page))
  setValue('metaDescriptionInput', defaultMetaDescription(page))
  updateSearchPreview()
}
function updateReadingTarget(page) {
  const el = document.getElementById('readingTargetValue')
  if (el && page && page.reading) {
    el.textContent = page.reading
  } else if (el) {
    el.textContent = '\u2014'
  }
}
/* updatePageBadge() is gone with #currentPageBadge. The badge flashed
   "Viewing: <page>" for five seconds after each render — the fourth place the
   open page's name appeared, after the sidebar picker, the sidebar's "Current
   page:" label and the sticky review bar, all three of which are permanent
   rather than transient. */

// Republished as a browser global because js/review/ux-improvements-state-sync.js
// calls it as `window.updateSearchPreview?.()` — an optional call, so that
// module keeps working when the core editor panel is absent. See the longer
// note in js/review/ui-controls.js for why these stay globals rather than imports.
window.updateSearchPreview = updateSearchPreview

export { syncEditorFields, updateReadingTarget, updateSearchPreview }
