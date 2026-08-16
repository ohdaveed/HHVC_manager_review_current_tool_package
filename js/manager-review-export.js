// Manager review package additions. Runs locally in the browser only.
// Depends on js/utils.js (csvEscape via toCsv, today, downloadFile,
// defaultSeoTitle, defaultMetaDescription, setText, getPrimaryCta,
// buildReviewRecord), js/state.js, js/ui-controls.js (showToast), and
// js/page-render.js (renderPage, which this file wraps).

import {
  buildReviewRecord,
  defaultMetaDescription,
  defaultSeoTitle,
  downloadFile,
  setText,
  toCsv,
  today,
} from './utils.js'
import { currentPageKey, pageData, pageOrder } from './state.js'
import { showToast } from './ui-controls.js'
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
    'seo_title',
    'meta_description',
    'primary_cta',
    'edited_title',
    'edited_summary',
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
        seo_title: document.getElementById('seoTitleInput')?.value || defaultSeoTitle(page),
        meta_description:
          document.getElementById('metaDescriptionInput')?.value || defaultMetaDescription(page),
        edited_title: page.title || '',
        edited_summary: page.summary || '',
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
  /* This module used to wrap window.renderPage as well, purely to refresh a
     "Current page: <title>" label in the sidebar after each navigation. Both are
     gone: the label was the third permanent printing of the open page's name
     (the picker sits a few rows above it, the sticky bar names it too), and with
     nothing left to refresh, the decorator had no work to do. One fewer wrapper
     in the renderPage chain. */
  /* These three used to own a button each in the sidebar. They are published
     instead, and js/ux-improvements-export.js calls whichever one the single
     "Export reviews" control's scope names — see the comment on that markup in
     index.html for why nine buttons became two. Publishing rather than
     exporting keeps this module reachable from the self-mounting IIFE layers,
     which take no imports. */
  window.ReviewExport = window.ReviewExport || {}
  window.ReviewExport.currentCsv = exportCurrentManagerReviewCsv
  window.ReviewExport.currentJson = exportCurrentManagerReviewJson
  window.ReviewExport.blankTemplateCsv = exportAllPageDecisionTemplateCsv
  ;(function attachManagerReviewTools() {
    const dateInput = document.getElementById('reviewDateInput')
    if (dateInput && !dateInput.value) dateInput.value = today()
  })()
})()
