/* Manager review: review summary, CSV export, and JSON backup/restore.
   Loads after js/ux-improvements-state-sync.js. */
;(function mountUxImprovementsExport() {
  const DATA = window.HHVC_DATA
  if (!hasValidPageData(DATA) || !window.reviewState || !window.ReviewUx?.stateSync) return

  const {
    getValue,
    getPrimaryCta,
    getCurrentKey,
    today,
    toCsv,
    downloadFile,
    setText,
    defaultSeoTitle,
    defaultMetaDescription,
  } = window.utils

  function getCurrentReviewSummaryLines() {
    const page = window.ReviewUx.stateSync.getCurrentPage()
    const seoTitle = window.ReviewUx.stateSync.getSeoTitle(page)
    const metaDescription = window.ReviewUx.stateSync.getMetaDescription(page)
    const rules = window.ReviewUx.stateSync.getRuleResults(page)
    const passed = rules.filter((rule) => rule.pass).length
    const seoLimit = window.ReviewUx.stateSync.SEO_TITLE_LIMIT
    const metaLimit = window.ReviewUx.stateSync.META_DESCRIPTION_LIMIT

    return [
      'HHVC manager review summary',
      `Page: ${page.title || ''}`,
      `Page key: ${getCurrentKey()}`,
      `Type: ${page.type || ''}`,
      `URL: https://${getValue('urlInput') || page.slug || ''}`,
      `Decision: ${getValue('reviewDecision') || 'Needs review'}`,
      `Checks: ${passed}/${rules.length}`,
      `SEO title: ${seoTitle} (${seoTitle.length}/${seoLimit})`,
      `Meta description: ${metaDescription} (${metaDescription.length}/${metaLimit})`,
      `Reading target: ${page.reading || ''}`,
      `Primary CTA: ${getPrimaryCta(page) || ''}`,
      `Reviewer: ${getValue('reviewerInput')}`,
      `Review date: ${getValue('reviewDateInput')}`,
      `Notes: ${getValue('reviewNotes')}`,
      `Risks or blockers: ${getValue('reviewRisks')}`,
      `Follow-up owner: ${getValue('reviewOwner')}`,
    ]
  }

  function buildReviewSummary() {
    return getCurrentReviewSummaryLines().join('\n')
  }

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
      const copied = document.execCommand('copy')
      if (!copied) {
        return Promise.reject(
          new Error('Failed to copy text to clipboard. Browser clipboard access may be blocked.')
        )
      }
      return Promise.resolve()
    } catch (error) {
      return Promise.reject(error)
    } finally {
      textarea.remove()
    }
  }

  function exportSavedLocalReviewsCsv() {
    window.ReviewUx.stateSync.saveCurrentPageToLocalStorage()

    const state = window.reviewState.read()
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
      'updated_at',
    ]

    const rows = [headers]
    for (const [pageKey] of DATA.order) {
      const page = DATA.pages[pageKey] || {}
      const saved = state.pages[pageKey]
      if (!saved) continue

      rows.push([
        saved.review_date || '',
        saved.reviewer || state.globals.reviewer || '',
        pageKey,
        saved.page_title || page.title || '',
        saved.page_type || page.type || '',
        saved.url_slug || page.slug || '',
        saved.decision || 'Needs review',
        saved.notes || '',
        saved.risks_or_blockers || '',
        saved.follow_up_owner || '',
        saved.seo_title || defaultSeoTitle(page),
        saved.meta_description || defaultMetaDescription(page),
        saved.primary_cta || getPrimaryCta(page),
        saved.reading_target || page.reading || '',
        saved.updated_at || '',
      ])
    }

    downloadFile('hhvc-saved-local-manager-reviews.csv', toCsv(rows), 'text/csv;charset=utf-8')
    setText('reviewExportStatus', 'Exported saved local reviews CSV.')
    if (typeof window.showToast === 'function')
      window.showToast('Saved local reviews exported', 'success')
  }

  function exportReviewStateBackup() {
    window.ReviewUx.stateSync.saveCurrentPageToLocalStorage()
    const state = window.reviewState.read()
    downloadFile(
      `hhvc-review-state-backup-${today()}.json`,
      JSON.stringify(state, null, 2),
      'application/json;charset=utf-8'
    )
    setText('reviewExportStatus', 'Downloaded review state backup JSON.')
    if (typeof window.showToast === 'function')
      window.showToast('Review state backup downloaded', 'success')
  }

  function importReviewStateBackup(file) {
    const fail = (message) => {
      setText('reviewExportStatus', message)
      if (typeof window.showToast === 'function') window.showToast(message, 'warn')
    }

    file
      .text()
      .then((text) => {
        let parsed
        try {
          parsed = JSON.parse(text)
        } catch {
          fail('Import failed: the file is not valid JSON.')
          return
        }

        if (
          !parsed ||
          parsed.version !== window.reviewState.STORAGE_VERSION ||
          typeof parsed.pages !== 'object' ||
          !parsed.pages
        ) {
          fail('Import failed: not a valid HHVC review state backup.')
          return
        }

        const validator = window.reviewStateValidation?.validateReviewState
        const validated =
          typeof validator === 'function' ? validator(parsed) : { ok: true, data: parsed }
        if (!validated.ok) {
          fail(`Import failed: ${validated.error}`)
          return
        }

        const entries = Object.entries(validated.data.pages).filter(
          ([key, value]) => DATA.pages[key] && value && typeof value === 'object'
        )
        if (!entries.length) {
          fail('Import finished: the backup has no reviews matching the current page list.')
          return
        }

        const merge = typeof window.defu === 'function' ? window.defu : null
        window.reviewState.update((state) => {
          const nextPages = { ...state.pages }
          for (const [key, saved] of entries) {
            nextPages[key] = { ...(state.pages[key] || {}), ...saved, page_key: key }
          }
          return {
            ...state,
            ui: merge
              ? merge({}, state.ui, validated.data.ui || {})
              : { ...state.ui, ...(validated.data.ui || {}) },
            globals: {
              ...state.globals,
              ...(validated.data.globals?.reviewer && !state.globals.reviewer
                ? { reviewer: validated.data.globals.reviewer }
                : {}),
              ...(validated.data.globals?.owner && !state.globals.owner
                ? { owner: validated.data.globals.owner }
                : {}),
            },
            pages: nextPages,
          }
        })

        window.ReviewUx.stateSync.applySavedPageState(getCurrentKey())
        window.ReviewUx.refreshUx()
        setText('reviewExportStatus', `Imported ${entries.length} saved page reviews from backup.`)
        if (typeof window.showToast === 'function')
          window.showToast(`Imported ${entries.length} page reviews`, 'success')
      })
      .catch(() => fail('Import failed: could not read the selected file.'))
  }

  function mountBackupControls() {
    const actions = document.querySelector('.review-actions')
    if (!actions || document.getElementById('exportReviewStateBackup')) return

    const backupButton = document.createElement('button')
    backupButton.type = 'button'
    backupButton.className = 'tool-btn secondary-tool'
    backupButton.id = 'exportReviewStateBackup'
    backupButton.textContent = 'Download backup (JSON)'
    actions.appendChild(backupButton)
    backupButton.addEventListener('click', exportReviewStateBackup)

    const importInput = document.createElement('input')
    importInput.type = 'file'
    importInput.accept = 'application/json,.json'
    importInput.id = 'importReviewStateFile'
    importInput.hidden = true
    importInput.addEventListener('change', () => {
      const file = importInput.files?.[0]
      if (file) importReviewStateBackup(file)
      importInput.value = ''
    })

    const importButton = document.createElement('button')
    importButton.type = 'button'
    importButton.className = 'tool-btn secondary-tool'
    importButton.id = 'importReviewStateBackup'
    importButton.textContent = 'Import backup (JSON)'
    actions.appendChild(importButton)
    actions.appendChild(importInput)
    importButton.addEventListener('click', () => importInput.click())
  }

  function clearSavedLocalReviews() {
    const confirmed = window.confirm(
      'Clear all locally saved HHVC review data in this browser? This does not change source files or exported CSVs.'
    )
    if (!confirmed) return

    localStorage.removeItem(window.reviewState.STORAGE_KEY)
    window.ReviewUx.stateSync.clearReviewFieldsForNewPage()
    window.utils.setValue('reviewerInput', '')
    window.ReviewUx.stateSync.updateLocalStorageStatus()
    window.ReviewUx.refreshUx()
    setText('reviewExportStatus', 'Cleared locally saved review data in this browser.')
    if (typeof window.showToast === 'function')
      window.showToast('Local review data cleared', 'info')
  }

  function mountLocalStorageControls() {
    const actions = document.querySelector('.review-actions')
    if (!actions || document.getElementById('exportSavedLocalReviewsCsv')) return

    const exportButton = document.createElement('button')
    exportButton.type = 'button'
    exportButton.className = 'tool-btn secondary-tool'
    exportButton.id = 'exportSavedLocalReviewsCsv'
    exportButton.textContent = 'Export saved local reviews CSV'
    actions.appendChild(exportButton)
    exportButton.addEventListener('click', exportSavedLocalReviewsCsv)

    const clearButton = document.createElement('button')
    clearButton.type = 'button'
    clearButton.className = 'tool-btn danger-tool'
    clearButton.id = 'clearSavedLocalReviews'
    clearButton.textContent = 'Clear local saved reviews'
    actions.appendChild(clearButton)
    clearButton.addEventListener('click', clearSavedLocalReviews)

    const status = document.createElement('p')
    status.id = 'localStorageStatus'
    status.className = 'field-help local-storage-status'
    status.textContent = 'No local review data saved yet.'
    actions.insertAdjacentElement('afterend', status)
  }

  function mountCopySummaryButton() {
    const actions = document.querySelector('.review-actions')
    if (!actions || document.getElementById('copyReviewSummary')) return

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'tool-btn copy-summary'
    button.id = 'copyReviewSummary'
    button.textContent = 'Copy review summary'
    actions.appendChild(button)

    button.addEventListener('click', () => {
      window.ReviewUx.stateSync.saveCurrentPageToLocalStorage()
      copyText(buildReviewSummary())
        .then(() => {
          const status = document.getElementById('reviewExportStatus')
          if (status) status.textContent = 'Copied review summary to clipboard.'
          if (typeof window.showToast === 'function') {
            window.showToast('Review summary copied', 'success')
          }
        })
        .catch(() => {
          const status = document.getElementById('reviewExportStatus')
          if (status) status.textContent = 'Copy failed. Copy manually instead.'
          if (typeof window.showToast === 'function') {
            window.showToast('Copy failed. Copy manually instead.', 'warn')
          }
        })
    })
  }

  window.ReviewUx = window.ReviewUx || {}
  window.ReviewUx.exportImport = {
    getCurrentReviewSummaryLines,
    buildReviewSummary,
    copyText,
    mountCopySummaryButton,
    exportSavedLocalReviewsCsv,
    exportReviewStateBackup,
    importReviewStateBackup,
    mountBackupControls,
    clearSavedLocalReviews,
    mountLocalStorageControls,
  }
})()
