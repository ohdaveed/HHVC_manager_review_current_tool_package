// Manager review package additions. Runs locally in the browser only.
// Depends on js/utils.js (csvEscape via toCsv, today, downloadFile),
// js/state.js, js/editor-panel.js (defaultSeoTitle, defaultMetaDescription,
// setText), js/ui-controls.js (showToast), and js/page-render.js
// (renderPage, which this file wraps).
function getManagerReviewSnapshot() {
  const page = pageData[currentPageKey] || {}
  return {
    review_date: document.getElementById('reviewDateInput')?.value || today(),
    reviewer: document.getElementById('reviewerInput')?.value || '',
    page_key: currentPageKey,
    page_title: page.title || '',
    page_type: page.type || '',
    url_slug: document.getElementById('urlInput')?.value || page.slug || '',
    decision: document.getElementById('reviewDecision')?.value || 'Needs review',
    notes: document.getElementById('reviewNotes')?.value || '',
    risks_or_blockers: document.getElementById('reviewRisks')?.value || '',
    follow_up_owner: document.getElementById('reviewOwner')?.value || '',
    seo_title: document.getElementById('seoTitleInput')?.value || defaultSeoTitle(page),
    meta_description:
      document.getElementById('metaDescriptionInput')?.value || defaultMetaDescription(page),
    primary_cta: getPrimaryCta(page),
    reading_target: page.reading || '',
  }
}
function exportCurrentManagerReviewCsv() {
  const snapshot = getManagerReviewSnapshot()
  const headers = Object.keys(snapshot)
  const rows = [headers, headers.map((h) => snapshot[h])]
  downloadFile(`${snapshot.page_key}-manager-review.csv`, toCsv(rows), 'text/csv;charset=utf-8')
  setText('reviewExportStatus', `Exported CSV for ${snapshot.page_title}.`)
  showToast(`CSV exported for ${snapshot.page_title}`, 'success')
}
function exportCurrentManagerReviewJson() {
  const snapshot = getManagerReviewSnapshot()
  downloadFile(
    `${snapshot.page_key}-manager-review.json`,
    JSON.stringify(snapshot, null, 2),
    'application/json;charset=utf-8'
  )
  setText('reviewExportStatus', `Exported JSON for ${snapshot.page_title}.`)
  showToast(`JSON exported for ${snapshot.page_title}`, 'success')
}
function exportAllPageDecisionTemplateCsv() {
  const headers = [
    'review_date',
    'reviewer',
    'page_key',
    'page_title',
    'page_type',
    'url_slug',
    'decision',
    'notes',
    'risks_or_blockers',
    'follow_up_owner',
    'seo_title',
    'meta_description',
    'primary_cta',
    'reading_target',
  ]
  const rows = [headers]
  for (const [key] of pageOrder) {
    const page = pageData[key] || {}
    rows.push([
      today(),
      '',
      key,
      page.title || '',
      page.type || '',
      page.slug || '',
      'Needs review',
      '',
      '',
      '',
      defaultSeoTitle(page),
      defaultMetaDescription(page),
      getPrimaryCta(page),
      page.reading || '',
    ])
  }
  downloadFile('hhvc-all-page-manager-review-template.csv', toCsv(rows), 'text/csv;charset=utf-8')
  setText('reviewExportStatus', 'Exported all-page decision template.')
  showToast('All-page decision template exported', 'success')
}
function updateManagerReviewPageLabel() {
  const page = pageData[currentPageKey] || {}
  setText('reviewPageLabel', `Current page: ${page.title || currentPageKey}`)
}
;(function attachManagerReviewTools() {
  const dateInput = document.getElementById('reviewDateInput')
  if (dateInput && !dateInput.value) dateInput.value = today()
  document
    .getElementById('exportReviewCsv')
    ?.addEventListener('click', exportCurrentManagerReviewCsv)
  document
    .getElementById('exportReviewJson')
    ?.addEventListener('click', exportCurrentManagerReviewJson)
  document
    .getElementById('exportAllTemplateCsv')
    ?.addEventListener('click', exportAllPageDecisionTemplateCsv)
  const originalRenderPage = renderPage
  renderPage = function patchedRenderPage(key) {
    const result = originalRenderPage(key)
    // Under View Transitions, renderPage returns a promise that resolves once
    // applyPageContent has updated currentPageKey; refreshing earlier would
    // label the previous page.
    if (result && typeof result.then === 'function') result.then(updateManagerReviewPageLabel)
    else updateManagerReviewPageLabel()
    return result
  }
  updateManagerReviewPageLabel()
})()
