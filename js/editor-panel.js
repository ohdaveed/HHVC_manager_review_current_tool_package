// SEO/editor panel: syncing search metadata fields with the current page,
// the search-result preview, and reading-target display. Depends on
// js/utils.js (defaultSeoTitle, defaultMetaDescription, getValue, setValue,
// setText) and js/state.js (pageData, currentPageKey).
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
function updatePageBadge(title) {
  const badge = document.getElementById('currentPageBadge')
  if (!badge) return
  // textContent needs no HTML escaping; escaping here would show literal
  // entities like &amp; in the badge.
  badge.textContent = 'Viewing: ' + (title || '')
  badge.classList.add('visible')
  clearTimeout(badge._timeout)
  badge._timeout = setTimeout(() => badge.classList.remove('visible'), 5000)
}
