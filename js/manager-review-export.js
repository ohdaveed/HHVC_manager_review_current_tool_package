// Manager review package additions. Runs locally in the browser only.
// Depends on js/utils.js (csvEscape via toCsv, today, downloadFile,
// defaultSeoTitle, defaultMetaDescription, setText, getPrimaryCta,
// buildReviewRecord), js/state.js, js/ui-controls.js (showToast), and
// js/page-render.js (renderPage, which this file wraps).
;(function initManagerReviewExport() {
  const MANAGER_REVIEW_RECORD_FIELDS = [
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
  function getManagerReviewSnapshot() {
    const page = pageData[currentPageKey] || {}
    return buildReviewRecord(
      page,
      currentPageKey,
      {
        review_date: document.getElementById('reviewDateInput')?.value || today(),
        reviewer: document.getElementById('reviewerInput')?.value || '',
        page_title: page.title || '',
        url_slug: document.getElementById('urlInput')?.value || page.slug || '',
        decision: document.getElementById('reviewDecision')?.value || 'Needs review',
        notes: document.getElementById('reviewNotes')?.value || '',
        risks_or_blockers: document.getElementById('reviewRisks')?.value || '',
        follow_up_owner: document.getElementById('reviewOwner')?.value || '',
        seo_title: document.getElementById('seoTitleInput')?.value || defaultSeoTitle(page),
        meta_description:
          document.getElementById('metaDescriptionInput')?.value || defaultMetaDescription(page),
      },
      MANAGER_REVIEW_RECORD_FIELDS
    )
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
    const rows = [MANAGER_REVIEW_RECORD_FIELDS]
    for (const [key] of pageOrder) {
      const page = pageData[key] || {}
      const record = buildReviewRecord(
        page,
        key,
        { page_title: page.title || '' },
        MANAGER_REVIEW_RECORD_FIELDS
      )
      rows.push(MANAGER_REVIEW_RECORD_FIELDS.map((field) => record[field]))
    }
    downloadFile('hhvc-all-page-manager-review-template.csv', toCsv(rows), 'text/csv;charset=utf-8')
    setText('reviewExportStatus', 'Exported all-page decision template.')
    showToast('All-page decision template exported', 'success')
  }
  function updateManagerReviewPageLabel() {
    const page = pageData[currentPageKey] || {}
    setText('reviewPageLabel', `Current page: ${page.title || currentPageKey}`)
  }
  function wrapRenderPageForManagerExport() {
    if (typeof window.renderPage !== 'function' || window.renderPage.__managerExportWrapped) return
    const originalRenderPage = window.renderPage
    window.renderPage = function renderPageWithManagerExportRefresh(key) {
      const result = originalRenderPage.call(this, key)
      // Under View Transitions, renderPage returns a promise that resolves once
      // applyPageContent has updated currentPageKey; refreshing earlier would
      // label the previous page.
      if (result && typeof result.then === 'function') result.then(updateManagerReviewPageLabel)
      else updateManagerReviewPageLabel()
      return result
    }
    window.renderPage.__managerExportWrapped = true
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
    wrapRenderPageForManagerExport()
    updateManagerReviewPageLabel()
  })()
})()
