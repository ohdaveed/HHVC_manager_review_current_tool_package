// SEO/editor panel: syncing input fields with the current page, dirty-state
// indicators, the search-result preview, and per-field reset. Depends on
// js/state.js (pageData, ORIGINAL_DATA, currentPageKey, getPrimaryCta,
// setPrimaryCta, escapeHtml) and js/page-render.js (karlTag).
function defaultSeoTitle(page) {
  return page.seoTitle || `${page.title} | San Francisco`
}
function defaultMetaDescription(page) {
  return page.metaDescription || page.summary || ''
}
function setText(id, value) {
  const el = document.getElementById(id)
  if (el) el.textContent = value
}
function setField(id, value) {
  const el = document.getElementById(id)
  if (el) el.value = value || ''
}
function statusClass(length, max) {
  return length <= max ? 'ok' : 'warn'
}
function updateSearchPreview() {
  const page = pageData[currentPageKey]
  if (!page) return
  const seoTitle = document.getElementById('seoTitleInput')?.value || defaultSeoTitle(page)
  const metaDescription =
    document.getElementById('metaDescriptionInput')?.value || defaultMetaDescription(page)
  const slug = document.getElementById('urlInput')?.value || page.slug
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
  setField('titleInput', page.title)
  setField('descriptionInput', page.summary)
  setField('ctaInput', getPrimaryCta(page))
  setField('seoTitleInput', defaultSeoTitle(page))
  setField('metaDescriptionInput', defaultMetaDescription(page))
  updateSearchPreview()
}
function updateDirtyIndicators(key) {
  const page = pageData[key]
  const orig = ORIGINAL_DATA.pages[key]
  if (!page || !orig) return
  ;[
    ['titleInput', page.title !== orig.title],
    ['descriptionInput', page.summary !== orig.summary],
    ['ctaInput', getPrimaryCta(page) !== getPrimaryCta(orig)],
  ].forEach(([id, dirty]) => {
    document.getElementById(id)?.closest('.field-with-reset')?.classList.toggle('modified', dirty)
  })
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
const RESETTABLE_FIELDS = {
  title: { get: (page) => page.title, set: (page, value) => (page.title = value), inputId: 'titleInput' },
  summary: {
    get: (page) => page.summary,
    set: (page, value) => (page.summary = value),
    inputId: 'descriptionInput',
  },
  cta: { get: getPrimaryCta, set: setPrimaryCta, inputId: 'ctaInput' },
}

function resetField(fieldKey) {
  const key = currentPageKey
  const orig = ORIGINAL_DATA.pages[key]
  const page = pageData[key]
  const field = RESETTABLE_FIELDS[fieldKey]
  if (!orig || !page || !field) return

  const value = field.get(orig)
  field.set(page, value)
  setField(field.inputId, value)
  applyFieldToMockup(fieldKey, value)

  updateDirtyIndicators(key)
  showToast(fieldKey.charAt(0).toUpperCase() + fieldKey.slice(1) + ' reset to original.', 'info')
}
