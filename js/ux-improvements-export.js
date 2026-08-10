/* Manager review: review summary, CSV export, and JSON backup/restore.
   Loads after js/ux-improvements-state-sync.js. */

import { hasValidPageData } from './utils.js'
;(function mountUxImprovementsExport() {
  const DATA = window.HHVC_DATA
  if (
    !hasValidPageData(DATA) ||
    !window.reviewState ||
    !window.reviewMerge ||
    !window.ReviewUx?.stateSync
  )
    return

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
    // Scored rules only, matching the Checks panel and the queue's ratio. Page
    // type / Audience / Reading target are schema-required and CI-enforced, so
    // counting them here would make a pasted summary disagree with the panel a
    // reviewer is looking at — the same self-contradiction this PR removed from
    // the KPI tiles, just relocated into a clipboard.
    const allRules = window.ReviewUx.stateSync.getRuleResults(page)
    // No `?? allRules` fallback. That is the tempting shape and it is wrong
    // here: if scoredRules() is missing, falling back to the unfiltered list
    // silently adds the three unscored page-fact rules — Page type, Audience,
    // Reading target — which are schema-required and can never fail. Every
    // ratio in the summary would then read high by a constant, in a document a
    // manager pastes into a decision record, with nothing on screen to say so.
    // A number that is quietly wrong is worse than an absent one, so say the
    // ratio is unavailable instead.
    const scoredRules = window.reviewChecks?.scoredRules
    const rules = typeof scoredRules === 'function' ? scoredRules(allRules) : null
    const checksLine = rules
      ? `${rules.filter((rule) => rule.pass).length}/${rules.length}`
      : 'unavailable (scored-rule filter not loaded)'
    const seoLimit = window.ReviewUx.stateSync.SEO_TITLE_LIMIT
    const metaLimit = window.ReviewUx.stateSync.META_DESCRIPTION_LIMIT

    return [
      'HHVC manager review summary',
      `Page: ${page.title || ''}`,
      `Page key: ${getCurrentKey()}`,
      `Type: ${page.type || ''}`,
      `URL: https://${getValue('urlInput') || page.slug || ''}`,
      `Decision: ${getValue('reviewDecision') || 'Needs review'}`,
      `Checks: ${checksLine}`,
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
      'edited_title',
      'edited_summary',
      'reading_target',
      'updated_at',
    ]

    const rows = [headers]
    /* Deleted pages are included, which `DATA.order` alone cannot express.
       Deleting a page keeps its review — that is the whole point of Restore —
       but the page leaves `order`, so iterating only `order` silently dropped
       those retained reviews from this export. The record is still in
       state.pages and a browser that has never deleted the page can import it,
       so omitting it loses review data the reviewer never asked to lose. */
    const exportKeys = [
      ...DATA.order.map(([pageKey]) => pageKey),
      ...(window.pageRegistry?.knownKeys?.() || []),
    ]
    const seenKeys = new Set()
    for (const pageKey of exportKeys) {
      if (seenKeys.has(pageKey)) continue
      seenKeys.add(pageKey)
      const saved = state.pages[pageKey]
      if (!saved) continue
      /* A deleted page has no entry in DATA.pages, so the record's own copies of
         these fields are the fallback rather than `{}` — which would have made
         defaultSeoTitle() emit the literal "undefined | San Francisco". */
      const page = DATA.pages[pageKey] || {
        title: saved.page_title || '',
        type: saved.page_type || '',
        slug: saved.url_slug || '',
        reading: saved.reading_target || '',
      }

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
        saved.edited_title || '',
        saved.edited_summary || '',
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

        /* Materialise the backup's added pages BEFORE the filter below.
           That filter requires DATA.pages[key], so without this every imported
           review record belonging to a reviewer-created page would be dropped
           silently — the reviewer would see "imported N reviews" and simply not
           get the pages they exported.

           This persists through its own reviewState.update, which is what keeps
           the globals merge further down safe to leave alone: updateLocalState
           re-reads state, so the `...state.globals` spread there carries the
           merged registry forward rather than overwriting it. */
        const registryResult = window.pageRegistry?.applyImportedRegistry?.(validated.data) || {
          added: [],
          hidden: [],
        }
        const pageChanges = registryResult.added.length + registryResult.hidden.length

        /* A DELETED page's review is imported too, which `DATA.pages[key]`
           alone cannot express: applyImportedRegistry() has just removed those
           pages from DATA.pages, so filtering on presence would drop exactly the
           records the reviewer deleted the page WITHOUT losing. Restoring such a
           page afterwards would then hand back the mockup and none of the
           review it was exported with. A key the registry knows about — added or
           hidden — is a real page for import purposes even when it is not
           currently in the mockup. */
        const registryKeys = new Set(window.pageRegistry?.knownKeys?.() || [])
        const entries = Object.entries(validated.data.pages).filter(
          ([key, value]) =>
            (DATA.pages[key] || registryKeys.has(key)) && value && typeof value === 'object'
        )
        /* A backup can legitimately carry pages and no matching reviews — for
           instance one exported before any of the added pages had been reviewed.
           Reporting that as a failure would tell the reviewer nothing happened
           when several pages had just appeared. */
        if (!entries.length) {
          if (pageChanges) {
            /* Still merge `ui` and `globals`. This branch returns before the
               update below, so without this a backup carrying pages and a
               reviewer name but no matching reviews would import the pages and
               silently drop the name, making the reviewer retype it. Same
               precedence as the main path: local wins. */
            window.reviewState.update((state) => {
              const merge = typeof window.defu === 'function' ? window.defu : null
              state.ui = merge
                ? merge({}, state.ui, validated.data.ui || {})
                : { ...state.ui, ...(validated.data.ui || {}) }
              if (validated.data.globals?.reviewer && !state.globals.reviewer) {
                state.globals.reviewer = validated.data.globals.reviewer
              }
              if (validated.data.globals?.owner && !state.globals.owner) {
                state.globals.owner = validated.data.globals.owner
              }
              return state
            })
            setText(
              'reviewExportStatus',
              `Imported ${pageChanges} added or deleted page(s) from backup. It carried no reviews for the current page list.`
            )
            if (typeof window.showToast === 'function')
              window.showToast(`Imported ${pageChanges} page change(s)`, 'success')
            return
          }
          fail('Import finished: the backup has no reviews matching the current page list.')
          return
        }

        const merge = typeof window.defu === 'function' ? window.defu : null
        window.reviewState.update((state) => {
          const nextPages = { ...state.pages }
          for (const [key, saved] of entries) {
            nextPages[key] = window.reviewMerge.mergeReviewRecord(
              { ...(state.pages[key] || {}), page_key: key },
              saved,
              { updatedBy: 'import' }
            )
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
        const pageNote = pageChanges ? `, plus ${pageChanges} added or deleted page(s)` : ''
        setText(
          'reviewExportStatus',
          `Imported ${entries.length} saved page reviews from backup${pageNote}.`
        )
        if (typeof window.showToast === 'function')
          window.showToast(`Imported ${entries.length} page reviews`, 'success')
      })
      .catch(() => fail('Import failed: could not read the selected file.'))
  }

  /**
   * Run whichever export the "What to export" scope currently names.
   *
   * The scope values are the union of what used to be six separate buttons in
   * two different places. Keeping the dispatch in one function is the point:
   * a reviewer picks what they want and presses one button, instead of choosing
   * between similarly-named controls whose difference was never on screen.
   * @param {string} scope value of #exportScope
   */
  function runExport(scope) {
    if (scope === 'current-csv') return window.ReviewExport?.currentCsv?.()
    if (scope === 'current-json') return window.ReviewExport?.currentJson?.()
    if (scope === 'template-csv') return window.ReviewExport?.blankTemplateCsv?.()
    if (scope === 'all-csv') return exportSavedLocalReviewsCsv()
    if (scope === 'backup-json') return exportReviewStateBackup()
    if (scope === 'summary-clipboard') return copyCurrentReviewSummary()
    return exportReviewStateBackup()
  }

  /** The clipboard scope: a human-readable summary for pasting into a ticket. */
  function copyCurrentReviewSummary() {
    window.ReviewUx.stateSync.saveCurrentPageToLocalStorage()
    return copyText(buildReviewSummary())
      .then(() => {
        setText('reviewExportStatus', 'Copied this page’s review to the clipboard.')
        window.showToast?.('Review summary copied', 'success')
      })
      .catch(() => {
        setText('reviewExportStatus', 'Copy failed. Select the text and copy it manually.')
        window.showToast?.('Copy failed. Copy manually instead.', 'warn')
      })
  }

  /**
   * Route an imported file by extension.
   *
   * One control accepts both formats rather than making the reviewer match a
   * file to the button that reads it — they arrive from this same tool, and
   * picking wrong used to mean an error rather than an import. Both paths merge
   * per page key through mergeReviewRecord; neither replaces saved state.
   * @param {File} file
   */
  function importReviewFile(file) {
    if (!file) return
    const isCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv'
    if (isCsv) {
      window.reviewQueue?.importReviewsFromCsvFile?.(file)
      return
    }
    importReviewStateBackup(file)
  }

  /**
   * Mount the two review-data controls plus the destructive clear.
   *
   * Replaces mountBackupControls/mountLocalStorageControls/mountCopySummaryButton,
   * which between them appended five buttons to this container while three more
   * sat in the markup and a ninth lived in the queue's bulk bar.
   */
  function mountReviewDataControls() {
    const actions = document.querySelector('.review-actions')
    if (!actions || document.getElementById('reviewImportFile')) return

    document.getElementById('exportReviews')?.addEventListener('click', () => {
      runExport(document.getElementById('exportScope')?.value || 'backup-json')
    })

    const importInput = document.createElement('input')
    importInput.type = 'file'
    // Both formats, one control. The queue's separate "Import CSV" button is
    // gone; this is the only import door now.
    importInput.accept = '.json,.csv,application/json,text/csv'
    importInput.id = 'reviewImportFile'
    importInput.hidden = true
    importInput.addEventListener('change', () => {
      importReviewFile(importInput.files?.[0])
      importInput.value = ''
    })
    actions.appendChild(importInput)

    document.getElementById('importReviews')?.addEventListener('click', () => importInput.click())

    // Sits in the same button group as Export/Import but is styled destructive
    // (`.danger-tool`), because it is the one control here that removes review
    // data rather than copying it. The styling is what distinguishes it — it
    // previously claimed to be "kept separate" while sharing the container, and
    // `.danger-tool` matched no CSS rule at all, so it rendered as a third blue
    // button identical to the two safe ones directly above it.
    const clearButton = document.createElement('button')
    clearButton.type = 'button'
    clearButton.className = 'tool-btn danger-tool'
    clearButton.id = 'clearSavedLocalReviews'
    clearButton.textContent = 'Clear saved reviews'
    clearButton.addEventListener('click', clearSavedLocalReviews)
    actions.querySelector('.review-actions-buttons')?.appendChild(clearButton)

    const status = document.createElement('p')
    status.id = 'localStorageStatus'
    status.className = 'field-help local-storage-status'
    status.textContent = 'No local review data saved yet.'
    actions.insertAdjacentElement('afterend', status)
  }

  /* Clears the storage key outright — the one place in this tool that deletes
     rather than merges, alongside the orphan prune.

     It RELOADS afterwards, which it did not need to before pages could be added
     or deleted in the browser. The storage key holds globals.page_registry, and
     js/page-registry.js has already mutated window.HHVC_DATA from it: added
     pages are in `order` and the picker, deleted ones are gone. Removing the key
     without reloading would leave both of those mutations in place with nothing
     left to explain them — the Help list empty, Restore impossible, and the
     added pages silently vanishing on the next load. The reload is what
     un-mutates HHVC_DATA, and it is also what makes this button the recovery
     path for a page registry so malformed that js/page-registry.js could not
     apply it. */
  function clearSavedLocalReviews() {
    const confirmed = window.confirm(
      'Clear all locally saved HHVC review data in this browser?\n\n' +
        'This deletes your decisions and notes, any content edits you made, and any pages you ' +
        'added or deleted during review. It does not change the mockup source files or exported ' +
        'CSVs. The page will reload.'
    )
    if (!confirmed) return

    localStorage.removeItem(window.reviewState.STORAGE_KEY)
    setText('reviewExportStatus', 'Cleared locally saved review data in this browser.')
    // Guarded so the unit/e2e environments that stub location keep working, and
    // so a browser that refuses the reload still lands in the old, consistent-
    // enough state rather than throwing on the way out.
    if (typeof window.location?.reload === 'function') {
      window.location.reload()
      return
    }
    window.ReviewUx.stateSync.clearReviewFieldsForNewPage()
    window.utils.setValue('reviewerInput', '')
    window.ReviewUx.stateSync.updateLocalStorageStatus()
    window.ReviewUx.refreshUx()
    if (typeof window.showToast === 'function')
      window.showToast('Local review data cleared', 'info')
  }

  window.ReviewUx = window.ReviewUx || {}
  window.ReviewUx.exportImport = {
    getCurrentReviewSummaryLines,
    buildReviewSummary,
    copyText,
    exportSavedLocalReviewsCsv,
    exportReviewStateBackup,
    importReviewStateBackup,
    importReviewFile,
    clearSavedLocalReviews,
    runExport,
    mountReviewDataControls,
  }
})()
