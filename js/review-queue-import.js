/* Cross-page review queue: CSV import.
   Kept in its own file since this is the highest-regression-risk area (a
   prior bug here replaced saved review state wholesale instead of merging —
   see CLAUDE.md's "Local persistence" section). Loads after
   js/review-queue-render.js. */
;(function mountReviewQueueImport() {
  const DATA = window.HHVC_DATA
  if (!DATA || !DATA.pages || !DATA.order || !window.ReviewQueueInternal?.render) return

  const { parseCsv, getCurrentKey } = window.utils
  const { VALID_DECISIONS, normalize, toast, updateLocalReviewForPage } =
    window.ReviewQueueInternal.helpers
  const readLocalState = window.reviewState.read

  function importReviewsFromCsvText(text) {
    const rows = parseCsv(text)
    if (rows.length < 2) {
      toast('Import failed: CSV has no data rows.', 'warn')
      return 0
    }

    const headers = rows[0].map((header) => normalize(header).replaceAll(' ', '_'))
    const indexOf = (name) => headers.indexOf(name)
    const pageKeyIndex = indexOf('page_key')
    if (pageKeyIndex === -1) {
      toast('Import failed: CSV needs a page_key column.', 'warn')
      return 0
    }

    let imported = 0
    let skipped = 0

    for (const cells of rows.slice(1)) {
      const pageKey = String(cells[pageKeyIndex] || '').trim()
      if (!pageKey || !DATA.pages[pageKey]) {
        skipped += 1
        continue
      }

      const get = (name) => {
        const index = indexOf(name)
        return index === -1 ? '' : String(cells[index] ?? '').trim()
      }

      const csvDecision = get('decision')
      if (csvDecision !== '' && !VALID_DECISIONS.has(csvDecision)) {
        skipped += 1
        continue
      }

      const patch = {}
      const fields = [
        'page_title',
        'page_type',
        'url_slug',
        'decision',
        'notes',
        'risks_or_blockers',
        'follow_up_owner',
        'reviewer',
        'review_date',
        'seo_title',
        'meta_description',
        'primary_cta',
        'reading_target',
      ]

      let hasField = false
      for (const field of fields) {
        const val = get(field)
        if (val !== '') {
          patch[field] = val
          hasField = true
        }
      }

      if (!hasField) {
        skipped += 1
        continue
      }

      const existing = readLocalState().pages[pageKey] || {}
      const saved = updateLocalReviewForPage(pageKey, patch)
      if (saved && saved.updated_at !== existing.updated_at) {
        imported += 1
      } else {
        skipped += 1
      }
    }

    if (!imported) {
      toast(
        skipped
          ? 'Import finished: no matching pages were updated.'
          : 'Import failed: no valid review rows found.',
        'warn'
      )
      return 0
    }

    const currentKey = getCurrentKey()
    if (typeof window.renderPage === 'function') {
      window.renderPage(currentKey)
    }

    document.dispatchEvent(new CustomEvent('hhvc:review-data-changed'))
    window.ReviewQueueInternal.render.renderReviewQueue()
    toast(
      skipped
        ? `Imported ${imported} reviews (${skipped} skipped).`
        : `Imported ${imported} reviews.`,
      'success'
    )
    return imported
  }

  function importReviewsFromCsvFile(file) {
    file
      .text()
      .then((text) => importReviewsFromCsvText(text))
      .catch(() => toast('Import failed: could not read the CSV file.', 'warn'))
  }

  window.ReviewQueueInternal.importCsv = {
    importReviewsFromCsvText,
    importReviewsFromCsvFile,
  }
})()
